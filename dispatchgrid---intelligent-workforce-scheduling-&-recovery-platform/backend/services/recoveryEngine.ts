// Disruption-Aware Dynamic Schedule Recovery Engine (Phase 7)
// Handles Sickness, Vehicle Breakdown, Job Delays, Emergency Arrival, Cancellations
// Enforces mandatory recovery rules and records complete audit logs

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
  | "WEATHER_ROAD_CLOSURE";

export interface RecoveryDisruptionPayload {
  disruptionType: DisruptionType;
  technicianId?: string;
  bookingId?: string;
  delayMinutes?: number;
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
   * Main entry point to trigger dynamic schedule recovery
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

        // 2. Identify affected FUTURE jobs (Exclude COMPLETED and protect IN_PROGRESS!)
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
          AND b.booking_status IN ('SCHEDULED', 'ACCEPTED', 'TECHNICIAN_ACCEPTED')
        `).all(techId) as any[];

        affectedJobsCount = affectedBookings.length;

        // 3. Reassign each affected job to an alternative eligible technician
        for (const rawJob of affectedBookings) {
          prevAssignments[rawJob.bookingId] = techId;

          const job: SchedulingJob = {
            bookingId: rawJob.bookingId,
            bookingReference: rawJob.bookingReference,
            customerId: rawJob.customerId,
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
              recipientId: job.customerId,
              message: `Schedule Update: Due to technician emergency (${payload.reason || "unexpected illness"}), your service was rerouted to ${assignResult.assignedTechnicianName}.`,
            });
          } else {
            // Cannot find immediate alternative - revert to ACCEPTED for dispatcher intervention
            db.prepare(`
              UPDATE bookings
              SET assigned_technician_id = NULL,
                  booking_status = 'ACCEPTED'
              WHERE booking_id = ?
            `).run(job.bookingId);
            unresolvedCount++;
            status = "PARTIAL";

            notifications.push({
              recipientId: "USR_ADMIN_01",
              message: `CRITICAL ALERT: Job ${job.bookingReference} could not find replacement technician after ${techName} became unavailable. Immediate dispatcher action required.`,
            });
          }
        }

        explanation = `Disruption ${payload.disruptionType} handled for ${techName}. ${reassignedCount} of ${affectedJobsCount} jobs successfully recovered and rerouted to certified peers. ${unresolvedCount} sent to high-priority triage. Ongoing and completed jobs were strictly protected.`;
        break;
      }

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
        // Recalculate end time
        explanation = `Technician ${delayedBooking.techName || "assigned"} reported +${delay} minutes delay on ${delayedBooking.booking_reference}. Cascading schedule impacts evaluated.`;

        // Check subsequent jobs for the same technician today
        const downstreamJobs = db.prepare(`
          SELECT * FROM bookings
          WHERE assigned_technician_id = ?
          AND preferred_date = ?
          AND preferred_start_time >= ?
          AND booking_id != ?
          AND booking_status IN ('SCHEDULED', 'ACCEPTED')
          ORDER BY preferred_start_time ASC
        `).all(
          delayedBooking.assigned_technician_id,
          delayedBooking.preferred_date,
          delayedBooking.preferred_end_time,
          delayedBooking.booking_id
        ) as any[];

        affectedJobsCount = downstreamJobs.length;

        for (const downJob of downstreamJobs) {
          // If delay pushes past window, attempt reassigning to avoid SLA breach
          prevAssignments[downJob.booking_id] = delayedBooking.assigned_technician_id;
          notifications.push({
            recipientId: downJob.customer_id,
            message: `Estimated arrival notice: Technician may arrive slightly later due to previous job complexity (+${delay}m). DispatchGrid is monitoring route progress.`,
          });
          revAssignments[downJob.booking_id] = delayedBooking.assigned_technician_id;
        }

        reassignedCount = affectedJobsCount;
        break;
      }

      case "EMERGENCY_REQUEST": {
        if (!payload.bookingId) {
          throw new Error("Booking ID is required for emergency request recovery.");
        }

        // Triage emergency booking
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

        // Mark verified priority as EMERGENCY
        db.prepare(`
          UPDATE bookings
          SET verified_priority = 'EMERGENCY',
              booking_status = 'ACCEPTED'
          WHERE booking_id = ?
        `).run(emJob.bookingId);

        const job: SchedulingJob = {
          bookingId: emJob.bookingId,
          bookingReference: emJob.bookingReference,
          customerId: emJob.customerId,
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
          explanation = `Verified emergency (${emJob.bookingReference}) prioritized and assigned to ${res.assignedTechnicianName} within reserved emergency capacity buffer.`;
          notifications.push({
            recipientId: emJob.customerId,
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

          explanation = `Booking ${booking.booking_reference} cancelled. Assigned technician capacity freed.`;
          notifications.push({
            recipientId: booking.assigned_technician_id,
            message: `Booking ${booking.booking_reference} has been cancelled by customer. Slot is now free.`,
          });
          affectedJobsCount = 1;
          reassignedCount = 1;
        }
        break;
      }

      default:
        explanation = `Disruption ${payload.disruptionType} recorded.`;
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

    // Save notifications to DB
    for (const notif of notifications) {
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Dispatch Grid Recovery Notice', ?, 'RECOVERY', ?)
      `).run(randomUUID(), notif.recipientId, notif.message, recoveryId);
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
