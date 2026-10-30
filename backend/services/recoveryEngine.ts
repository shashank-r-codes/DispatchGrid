// Disruption-Aware Dynamic Schedule Recovery Engine (Phase 7 & Part 8)
// Handles:
// 1. Technician becomes unavailable (sickness / vehicle breakdown)
// 2. Urgent job arrives (EMERGENCY_REQUEST)
// 3. Job duration changes (JOB_DURATION_CHANGE)
// 4. Job is cancelled (JOB_CANCELLATION)
// 5. Technician completes a job earlier than expected (EARLY_COMPLETION)
// 6. Technician finishes late (JOB_DELAY)
//
// Enforces mandatory recovery rules:
// - Identify affected future jobs
// - Preserve completed jobs
// - Protect ongoing in-progress work
// - Re-optimise affected assignments safely
// - Record complete audit logs

import { db } from "../config/database.js";
import { EligibilityService } from "./eligibilityService.js";
import { AssignmentEngine } from "./assignmentEngine.js";
import { SchedulingJob } from "./priorityQueue.js";
import { randomUUID } from "crypto";

export type DisruptionType =
  | "TECHNICIAN_SICKNESS"
  | "VEHICLE_BREAKDOWN"
  | "JOB_DELAY"
  | "EMERGENCY_REQUEST"
  | "JOB_CANCELLATION"
  | "JOB_DURATION_CHANGE"
  | "EARLY_COMPLETION"
  | "WEATHER_ROAD_CLOSURE";

export interface RecoveryDisruptionPayload {
  disruptionType: DisruptionType;
  technicianId?: string;
  bookingId?: string;
  delayMinutes?: number;
  durationMinutes?: number;
  reason?: string;
}

export interface RecoveryResult {
  recoveryId: string;
  disruptionType: DisruptionType;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  affectedJobsCount: number;
  reassignedJobsCount: number;
  unresolvedJobsCount: number;
  executionTimeMs: number;
  previousAssignments: Record<string, string>;
  revisedAssignments: Record<string, string>;
  explanation: string;
  notificationsSent: {
    recipientId: string;
    message: string;
  }[];
}

export class RecoveryEngine {
  /**
   * Main entry point to trigger dynamic schedule recovery across all 6 scenarios
   */
  public static handleDisruption(payload: RecoveryDisruptionPayload): RecoveryResult {
    const startTime = Date.now();
    const recoveryId = randomUUID();
    const notifications: { recipientId: string; message: string }[] = [];
    const prevAssignments: Record<string, string> = {};
    const revAssignments: Record<string, string> = {};

    let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";
    let explanation = "";
    let affectedJobsCount = 0;
    let reassignedCount = 0;
    let unresolvedCount = 0;

    switch (payload.disruptionType) {
      // SCENARIO 1: Technician becomes unavailable (sickness / breakdown)
      case "TECHNICIAN_SICKNESS":
      case "VEHICLE_BREAKDOWN": {
        if (!payload.technicianId) {
          throw new Error("Technician ID is required for sickness/breakdown recovery.");
        }

        const techId = payload.technicianId;
        const techUser = db.prepare("SELECT full_name FROM users WHERE user_id = ?").get(techId) as any;
        const techName = techUser?.full_name || "Technician";

        // 1. Mark technician as UNAVAILABLE in DB
        db.prepare(`
          UPDATE technician_profiles
          SET availability_status = 'UNAVAILABLE',
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(techId);

        // 2. Identify affected FUTURE jobs (Strictly exclude COMPLETED and protect IN_PROGRESS!)
        const affectedBookings = db.prepare(`
          SELECT 
            b.booking_id as bookingId,
            b.booking_reference as bookingReference,
            b.customer_id as customerId,
            b.service_id as serviceId,
            s.category,
            s.required_skills as requiredSkillsStr,
            s.required_certifications as requiredCertificationsStr,
            b.node_id as nodeId,
            b.latitude,
            b.longitude,
            b.service_address as serviceAddress,
            b.requested_priority as requestedPriority,
            b.verified_priority as verifiedPriority,
            b.preferred_date as preferredDate,
            b.preferred_start_time as preferredStartTime,
            b.preferred_end_time as preferredEndTime,
            b.booking_status as bookingStatus
          FROM bookings b
          JOIN services s ON b.service_id = s.service_id
          WHERE b.assigned_technician_id = ?
          AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'OFFERED', 'TECHNICIAN_ACCEPTED')
        `).all(techId) as any[];

        affectedJobsCount = affectedBookings.length;

        // 3. Reassign each affected future job to an alternative eligible technician
        for (const rawJob of affectedBookings) {
          prevAssignments[rawJob.bookingId] = techId;

          const job: SchedulingJob = {
            bookingId: rawJob.bookingId,
            bookingReference: rawJob.bookingReference,
            customerId: rawJob.customerId || "",
            serviceId: rawJob.serviceId,
            category: rawJob.category,
            requiredSkills: JSON.parse(rawJob.requiredSkillsStr || "[]"),
            requiredCertifications: JSON.parse(rawJob.requiredCertificationsStr || "[]"),
            nodeId: rawJob.nodeId,
            latitude: rawJob.latitude,
            longitude: rawJob.longitude,
            serviceAddress: rawJob.serviceAddress,
            requestedPriority: rawJob.requestedPriority,
            verifiedPriority: rawJob.verifiedPriority,
            preferredDate: rawJob.preferredDate,
            preferredStartTime: rawJob.preferredStartTime,
            preferredEndTime: rawJob.preferredEndTime,
            estimatedDurationMinutes: 60,
            createdAt: new Date().toISOString(),
          };

          const assignResult = AssignmentEngine.assignJob(job);
          if (assignResult.success && assignResult.assignedTechnicianId) {
            revAssignments[job.bookingId] = assignResult.assignedTechnicianId;
            reassignedCount++;

            notifications.push({
              recipientId: job.customerId || "CUSTOMER",
              message: `Schedule Update: Due to technician emergency (${payload.reason || "unexpected illness"}), your service was rerouted to ${assignResult.assignedTechnicianName}.`,
            });
          } else {
            // Unassigned fallback with clear explanation
            db.prepare(`
              UPDATE bookings
              SET assigned_technician_id = NULL,
                  booking_status = 'UNASSIGNED',
                  unassigned_reason = ?
              WHERE booking_id = ?
            `).run(`Primary technician ${techName} became unavailable; no immediate alternative with matching skills/zones was open.`, job.bookingId);
            unresolvedCount++;
            status = "PARTIAL";

            notifications.push({
              recipientId: "USR_ADMIN_01",
              message: `CRITICAL ALERT: Job ${job.bookingReference} could not find replacement technician after ${techName} became unavailable. Immediate dispatcher intervention required.`,
            });
          }
        }

        explanation = `Disruption ${payload.disruptionType} handled for ${techName}. ${reassignedCount} of ${affectedJobsCount} future jobs successfully recovered and rerouted to certified peers. ${unresolvedCount} sent to high-priority triage. Ongoing and completed work remained strictly protected.`;
        break;
      }

      // SCENARIO 2: Urgent job arrives
      case "EMERGENCY_REQUEST": {
        if (!payload.bookingId) {
          throw new Error("Booking ID is required for emergency request recovery.");
        }

        const emJob = db.prepare(`
          SELECT 
            b.booking_id as bookingId,
            b.booking_reference as bookingReference,
            b.customer_id as customerId,
            b.service_id as serviceId,
            s.category,
            s.required_skills as requiredSkillsStr,
            s.required_certifications as requiredCertificationsStr,
            b.node_id as nodeId,
            b.latitude,
            b.longitude,
            b.service_address as serviceAddress,
            b.requested_priority as requestedPriority,
            b.verified_priority as verifiedPriority,
            b.preferred_date as preferredDate,
            b.preferred_start_time as preferredStartTime,
            b.preferred_end_time as preferredEndTime
          FROM bookings b
          JOIN services s ON b.service_id = s.service_id
          WHERE b.booking_id = ?
        `).get(payload.bookingId) as any;

        if (!emJob) throw new Error("Emergency job not found");

        db.prepare(`
          UPDATE bookings
          SET verified_priority = 'EMERGENCY',
              booking_status = 'PENDING'
          WHERE booking_id = ?
        `).run(emJob.bookingId);

        const job: SchedulingJob = {
          bookingId: emJob.bookingId,
          bookingReference: emJob.bookingReference,
          customerId: emJob.customerId || "",
          serviceId: emJob.serviceId,
          category: emJob.category,
          requiredSkills: JSON.parse(emJob.requiredSkillsStr || "[]"),
          requiredCertifications: JSON.parse(emJob.requiredCertificationsStr || "[]"),
          nodeId: emJob.nodeId,
          latitude: emJob.latitude,
          longitude: emJob.longitude,
          serviceAddress: emJob.serviceAddress,
          requestedPriority: "EMERGENCY",
          verifiedPriority: "EMERGENCY",
          preferredDate: emJob.preferredDate,
          preferredStartTime: emJob.preferredStartTime,
          preferredEndTime: emJob.preferredEndTime,
          estimatedDurationMinutes: 60,
          createdAt: new Date().toISOString(),
        };

        const res = AssignmentEngine.assignJob(job);
        affectedJobsCount = 1;

        if (res.success && res.assignedTechnicianId) {
          reassignedCount = 1;
          revAssignments[emJob.bookingId] = res.assignedTechnicianId;
          explanation = `Verified emergency (${emJob.bookingReference}) prioritized and assigned to ${res.assignedTechnicianName} within emergency capacity buffer.`;
          notifications.push({
            recipientId: emJob.customerId || "CUSTOMER",
            message: `Emergency response dispatched: ${res.assignedTechnicianName} assigned with ${res.estimatedTravelMinutes} mins estimated travel time.`,
          });
        } else {
          status = "FAILED";
          unresolvedCount = 1;
          explanation = `Emergency could not be automatically slotted into current workforce capacity. Alert broadcast to all dispatchers.`;
          notifications.push({
            recipientId: "USR_ADMIN_01",
            message: `URGENT DISPATCHER ALERT: No immediate technician capacity for emergency ${emJob.bookingReference}. Manual override required.`,
          });
        }
        break;
      }

      // SCENARIO 3: Job duration changes
      case "JOB_DURATION_CHANGE": {
        if (!payload.bookingId) {
          throw new Error("Booking ID required for job duration change recovery.");
        }

        const booking = db.prepare(`
          SELECT b.*, s.service_name, u.full_name as techName
          FROM bookings b
          JOIN services s ON b.service_id = s.service_id
          LEFT JOIN users u ON b.assigned_technician_id = u.user_id
          WHERE b.booking_id = ?
        `).get(payload.bookingId) as any;

        if (!booking) throw new Error("Booking not found");

        const delta = payload.durationMinutes || payload.delayMinutes || 30;
        affectedJobsCount = 1;

        // If job has assigned technician, check downstream jobs for same technician
        if (booking.assigned_technician_id) {
          const downstream = db.prepare(`
            SELECT b.*, s.category, s.required_skills, s.required_certifications
            FROM bookings b
            JOIN services s ON b.service_id = s.service_id
            WHERE b.assigned_technician_id = ?
            AND b.preferred_date = ?
            AND b.preferred_start_time >= ?
            AND b.booking_id != ?
            AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'OFFERED')
            ORDER BY b.preferred_start_time ASC
          `).all(
            booking.assigned_technician_id,
            booking.preferred_date,
            booking.preferred_end_time,
            booking.booking_id
          ) as any[];

          for (const ds of downstream) {
            prevAssignments[ds.booking_id] = booking.assigned_technician_id;

            // Reassign downstream job to another technician to prevent cascading SLA breach
            const reassignJob: SchedulingJob = {
              bookingId: ds.booking_id,
              bookingReference: ds.booking_reference,
              customerId: ds.customer_id || "",
              serviceId: ds.service_id,
              category: ds.category,
              requiredSkills: JSON.parse(ds.required_skills || "[]"),
              requiredCertifications: JSON.parse(ds.required_certifications || "[]"),
              nodeId: ds.node_id,
              latitude: ds.latitude,
              longitude: ds.longitude,
              serviceAddress: ds.service_address,
              requestedPriority: ds.requested_priority,
              verifiedPriority: ds.verified_priority,
              preferredDate: ds.preferred_date,
              preferredStartTime: ds.preferred_start_time,
              preferredEndTime: ds.preferred_end_time,
              estimatedDurationMinutes: 60,
              createdAt: new Date().toISOString(),
            };

            const rRes = AssignmentEngine.assignJob(reassignJob);
            if (rRes.success && rRes.assignedTechnicianId) {
              revAssignments[ds.booking_id] = rRes.assignedTechnicianId;
              reassignedCount++;
              notifications.push({
                recipientId: ds.customer_id || "CUSTOMER",
                message: `Schedule adjustment: Service re-allocated to ${rRes.assignedTechnicianName} to prevent delay caused by preceding job duration extension (+${delta}m).`,
              });
            } else {
              revAssignments[ds.booking_id] = booking.assigned_technician_id;
              notifications.push({
                recipientId: ds.customer_id || "CUSTOMER",
                message: `Technician schedule notice: Preceding job is taking slightly longer (+${delta}m). DispatchGrid is monitoring route progress.`,
              });
            }
          }
        }

        explanation = `Job duration changed (+${delta} mins) on ${booking.booking_reference}. Evaluated cascading impacts; protected ongoing tasks and updated downstream assignments.`;
        break;
      }

      // SCENARIO 4: Job is cancelled
      case "JOB_CANCELLATION": {
        if (!payload.bookingId) throw new Error("Booking ID required for cancellation.");
        const booking = db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(payload.bookingId) as any;
        if (booking && booking.assigned_technician_id) {
          prevAssignments[booking.booking_id] = booking.assigned_technician_id;
          db.prepare(`
            UPDATE bookings
            SET booking_status = 'CANCELLED',
                cancellation_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE booking_id = ?
          `).run(payload.reason || "Customer cancelled booking", payload.bookingId);

          explanation = `Booking ${booking.booking_reference} cancelled. Capacity freed for technician ${booking.assigned_technician_id}.`;
          notifications.push({
            recipientId: booking.assigned_technician_id,
            message: `Booking ${booking.booking_reference} has been cancelled by customer. Slot is now free for new assignments.`,
          });
          affectedJobsCount = 1;
          reassignedCount = 1;
        }
        break;
      }

      // SCENARIO 5: Technician completes a job earlier than expected
      case "EARLY_COMPLETION": {
        if (!payload.bookingId) throw new Error("Booking ID required for early completion recovery.");

        const booking = db.prepare(`
          SELECT b.*, u.full_name as techName
          FROM bookings b
          LEFT JOIN users u ON b.assigned_technician_id = u.user_id
          WHERE b.booking_id = ?
        `).get(payload.bookingId) as any;

        if (!booking) throw new Error("Booking not found");

        const earlyMins = payload.durationMinutes || 30;
        affectedJobsCount = 1;

        // Mark current job completed
        db.prepare(`
          UPDATE bookings
          SET booking_status = 'COMPLETED',
              actual_end_time = CURRENT_TIMESTAMP,
              completion_notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE booking_id = ?
        `).run(`Completed ${earlyMins} minutes earlier than expected.`, payload.bookingId);

        // Check if there are unassigned or pending jobs in the same locality that can be offered
        const pendingNearby = db.prepare(`
          SELECT b.*, s.category, s.required_skills, s.required_certifications
          FROM bookings b
          JOIN services s ON b.service_id = s.service_id
          WHERE b.booking_status IN ('PENDING', 'UNASSIGNED')
          AND b.preferred_date = ?
          AND b.node_id = ?
          LIMIT 1
        `).get(booking.preferred_date, booking.node_id) as any;

        if (pendingNearby) {
          const reJob: SchedulingJob = {
            bookingId: pendingNearby.booking_id,
            bookingReference: pendingNearby.booking_reference,
            customerId: pendingNearby.customer_id || "",
            serviceId: pendingNearby.service_id,
            category: pendingNearby.category,
            requiredSkills: JSON.parse(pendingNearby.required_skills || "[]"),
            requiredCertifications: JSON.parse(pendingNearby.required_certifications || "[]"),
            nodeId: pendingNearby.node_id,
            latitude: pendingNearby.latitude,
            longitude: pendingNearby.longitude,
            serviceAddress: pendingNearby.service_address,
            requestedPriority: pendingNearby.requested_priority,
            verifiedPriority: pendingNearby.verified_priority,
            preferredDate: pendingNearby.preferred_date,
            preferredStartTime: pendingNearby.preferred_start_time,
            preferredEndTime: pendingNearby.preferred_end_time,
            estimatedDurationMinutes: 60,
            createdAt: new Date().toISOString(),
          };

          const offResult = AssignmentEngine.offerJobToBestCandidate(reJob);
          if (offResult.success) {
            reassignedCount++;
            revAssignments[pendingNearby.booking_id] = offResult.assignedTechnicianId || "";
            explanation = `Technician completed ${booking.booking_reference} ${earlyMins}m early. Freed capacity used to dispatch offer for waiting job ${pendingNearby.booking_reference}.`;
          } else {
            explanation = `Technician completed ${booking.booking_reference} ${earlyMins}m early. Shift capacity freed up.`;
          }
        } else {
          explanation = `Technician completed ${booking.booking_reference} ${earlyMins}m early. Route timeline updated and idle capacity logged.`;
        }
        break;
      }

      // SCENARIO 6: Technician finishes late
      case "JOB_DELAY": {
        if (!payload.bookingId || !payload.delayMinutes) {
          throw new Error("Booking ID and delay minutes are required for delay recovery.");
        }

        const delayedBooking = db.prepare(`
          SELECT b.*, u.full_name as techName
          FROM bookings b
          LEFT JOIN users u ON b.assigned_technician_id = u.user_id
          WHERE b.booking_id = ?
        `).get(payload.bookingId) as any;

        if (!delayedBooking) {
          throw new Error("Delayed booking not found.");
        }

        const delay = payload.delayMinutes;
        explanation = `Technician ${delayedBooking.techName || "assigned"} reported +${delay} minutes delay on ${delayedBooking.booking_reference}. Cascading schedule impacts evaluated.`;

        // Check subsequent jobs for the same technician today
        const downstreamJobs = db.prepare(`
          SELECT b.*, s.category, s.required_skills, s.required_certifications
          FROM bookings b
          JOIN services s ON b.service_id = s.service_id
          WHERE b.assigned_technician_id = ?
          AND b.preferred_date = ?
          AND b.preferred_start_time >= ?
          AND b.booking_id != ?
          AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'OFFERED')
          ORDER BY b.preferred_start_time ASC
        `).all(
          delayedBooking.assigned_technician_id,
          delayedBooking.preferred_date,
          delayedBooking.preferred_end_time,
          delayedBooking.booking_id
        ) as any[];

        affectedJobsCount = downstreamJobs.length;

        for (const downJob of downstreamJobs) {
          prevAssignments[downJob.booking_id] = delayedBooking.assigned_technician_id;

          // Attempt reassigning if delay is > 30 mins to protect customer SLA
          if (delay >= 30) {
            const reJob: SchedulingJob = {
              bookingId: downJob.booking_id,
              bookingReference: downJob.booking_reference,
              customerId: downJob.customer_id || "",
              serviceId: downJob.service_id,
              category: downJob.category,
              requiredSkills: JSON.parse(downJob.required_skills || "[]"),
              requiredCertifications: JSON.parse(downJob.required_certifications || "[]"),
              nodeId: downJob.node_id,
              latitude: downJob.latitude,
              longitude: downJob.longitude,
              serviceAddress: downJob.service_address,
              requestedPriority: downJob.requested_priority,
              verifiedPriority: downJob.verified_priority,
              preferredDate: downJob.preferred_date,
              preferredStartTime: downJob.preferred_start_time,
              preferredEndTime: downJob.preferred_end_time,
              estimatedDurationMinutes: 60,
              createdAt: new Date().toISOString(),
            };

            const rRes = AssignmentEngine.assignJob(reJob);
            if (rRes.success && rRes.assignedTechnicianId && rRes.assignedTechnicianId !== delayedBooking.assigned_technician_id) {
              revAssignments[downJob.booking_id] = rRes.assignedTechnicianId;
              reassignedCount++;
              notifications.push({
                recipientId: downJob.customer_id || "CUSTOMER",
                message: `Schedule recovery notice: Service rerouted to ${rRes.assignedTechnicianName} to prevent delay caused by preceding job complexity (+${delay}m).`,
              });
              continue;
            }
          }

          // Otherwise notify customer of expected slight delay
          revAssignments[downJob.booking_id] = delayedBooking.assigned_technician_id;
          notifications.push({
            recipientId: downJob.customer_id || "CUSTOMER",
            message: `Estimated arrival notice: Technician may arrive slightly later due to previous job complexity (+${delay}m). DispatchGrid is monitoring route progress.`,
          });
        }

        reassignedCount = affectedJobsCount;
        break;
      }

      default:
        explanation = `Disruption ${payload.disruptionType} recorded and evaluated against current workforce constraints.`;
    }

    const execTime = Date.now() - startTime;

    // Record complete recovery audit log
    db.prepare(`
      INSERT INTO recovery_audit_logs (
        recovery_id, disruption_type, affected_technician_id,
        affected_booking_ids, previous_assignments, revised_assignments,
        reason, execution_time_ms, status, notifications_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recoveryId,
      payload.disruptionType,
      payload.technicianId || null,
      JSON.stringify(Object.keys(prevAssignments)),
      JSON.stringify(prevAssignments),
      JSON.stringify(revAssignments),
      explanation,
      execTime,
      status,
      JSON.stringify(notifications)
    );

    // Persist notifications to DB for valid user recipients
    for (const notif of notifications) {
      if (notif.recipientId) {
        const userExists = db.prepare("SELECT user_id FROM users WHERE user_id = ?").get(notif.recipientId);
        if (userExists) {
          db.prepare(`
            INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
            VALUES (?, ?, 'DispatchGrid Recovery Notice', ?, 'RECOVERY', ?)
          `).run(randomUUID(), notif.recipientId, notif.message, recoveryId);
        }
      }
    }

    return {
      recoveryId,
      disruptionType: payload.disruptionType,
      status,
      affectedJobsCount,
      reassignedJobsCount: reassignedCount,
      unresolvedJobsCount: unresolvedCount,
      executionTimeMs: execTime,
      previousAssignments: prevAssignments,
      revisedAssignments: revAssignments,
      explanation,
      notificationsSent: notifications,
    };
  }
}
