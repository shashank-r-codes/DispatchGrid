// Intelligent Assignment Engine
// Combines Dijkstra Routing, Weighted Multi-Criteria Scoring, Customer Preference, Round Robin, Atomic Commits,
// and Automatic Offer / Re-Offer Lifecycle.

import { db } from "../config/database.js";
import { EligibilityService, EligibilityResult } from "./eligibilityService.js";
import { SchedulingJob } from "./priorityQueue.js";
import { randomUUID } from "crypto";
import { trackingService } from "./trackingService.js";

export interface AssignmentWeights {
  w1Travel: number; // default 0.35
  w2SlaRisk: number; // default 0.25
  w3Workload: number; // default 0.25
  w4Disruption: number; // default 0.15
}

export const DEFAULT_WEIGHTS: AssignmentWeights = {
  w1Travel: 0.35,
  w2SlaRisk: 0.25,
  w3Workload: 0.25,
  w4Disruption: 0.15,
};

export interface ScoredCandidate {
  technicianId: string;
  fullName: string;
  phone: string;
  travelMinutes: number;
  distanceKm: number;
  activeJobsCount: number;
  rating: number;
  travelCostNorm: number;
  slaRiskNorm: number;
  workloadNorm: number;
  disruptionNorm: number;
  assignmentCost: number;
  isPreferredByCustomer: boolean;
  scoreBreakdown: {
    travelScore: number;
    slaScore: number;
    workloadScore: number;
    disruptionScore: number;
  };
}

export interface OfferExecutionResult {
  bookingId: string;
  bookingReference: string;
  success: boolean;
  offerId?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  estimatedTravelMinutes?: number;
  selectionReason: string;
  winningScore?: number;
  evaluatedCandidates: ScoredCandidate[];
  rejectedAlternatives: {
    technicianId: string;
    fullName: string;
    reasons: string[];
  }[];
  runId: string;
}

export class AssignmentEngine {
  /**
   * Evaluates candidates, scores them, and sends a formal job offer to the best feasible technician.
   * If rejected or unavailable, automatically attempts finding next eligible candidate.
   */
  public static offerJobToBestCandidate(
    job: SchedulingJob,
    weights: AssignmentWeights = DEFAULT_WEIGHTS,
    runId: string = randomUUID(),
    options?: { excludedTechnicianIds?: string[] }
  ): OfferExecutionResult {
    // 1. Evaluate hard constraints for all technicians
    const eligibilityResults = EligibilityService.evaluateCandidates(job, options);

    const eligible = eligibilityResults.filter((r) => r.isEligible);
    const rejected = eligibilityResults
      .filter((r) => !r.isEligible)
      .map((r) => ({
        technicianId: r.technician.userId,
        fullName: r.technician.fullName,
        reasons: r.rejectionReasons,
      }));

    if (eligible.length === 0) {
      // Determine actionable explanation
      let actionableReason = "No eligible technicians found meeting mandatory skills, certifications, and schedule availability.";
      
      const acCertMissing = rejected.some(r => r.reasons.some(reason => reason.toLowerCase().includes("ac")));
      const allDeclined = rejected.every(r => r.reasons.some(reason => reason.toLowerCase().includes("declined") || reason.toLowerCase().includes("rejected") || reason.toLowerCase().includes("timed out")));
      const outsideZone = rejected.every(r => r.reasons.some(reason => reason.toLowerCase().includes("zone") || reason.toLowerCase().includes("locality")));
      const shiftConflict = rejected.every(r => r.reasons.some(reason => reason.toLowerCase().includes("shift") || reason.toLowerCase().includes("outside")));
      const scheduleOverlap = rejected.some(r => r.reasons.some(reason => reason.toLowerCase().includes("conflict") || reason.toLowerCase().includes("overlap")));

      if (allDeclined && rejected.length > 0) {
        actionableReason = "All suitable technicians rejected the offer.";
      } else if (job.category === "AC" && acCertMissing) {
        actionableReason = "Technician lacks the required AC certification (Rule: General Electrical technicians do not qualify for AC repair).";
      } else if (outsideZone) {
        actionableReason = "Job location is outside registered service zones.";
      } else if (shiftConflict) {
        actionableReason = "Appointment time falls outside all technician shift working hours.";
      } else if (scheduleOverlap) {
        actionableReason = "All certified technicians have existing schedule conflicts for this appointment window.";
      }

      // Commit unassigned status and clear assigned technician
      db.prepare(`
        UPDATE bookings
        SET booking_status = 'UNASSIGNED',
            assigned_technician_id = NULL,
            unassigned_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(actionableReason, job.bookingId);

      // Audit status history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'PENDING', 'UNASSIGNED', 'SYSTEM_DISPATCH_ENGINE', ?)
      `).run(randomUUID(), job.bookingId, actionableReason);

      // Explainability record
      db.prepare(`
        INSERT INTO assignment_records (
          record_id, scheduling_run_id, booking_id, assigned_technician_id,
          calculated_travel_time_minutes, assignment_score, selection_reason,
          evaluated_candidates, rejected_alternatives
        ) VALUES (?, ?, ?, 'NONE', 0, 999.0, ?, '[]', ?)
      `).run(
        randomUUID(),
        runId,
        job.bookingId,
        actionableReason,
        JSON.stringify(rejected)
      );

      // Notify Admin
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, 'USR_ADMIN_01', 'Booking Unassigned Alert', ?, 'UNASSIGNED', ?)
      `).run(
        randomUUID(),
        `Booking ${job.bookingReference} (${job.category}) could not be auto-assigned: ${actionableReason}`,
        job.bookingId
      );

      // Notify Customer (Section 6 Requirement)
      let custUserId = job.customerId;
      if (!custUserId || custUserId === "GUEST") {
        const b = db.prepare("SELECT customer_id, customer_phone FROM bookings WHERE booking_id = ?").get(job.bookingId) as any;
        if (b?.customer_id && b.customer_id !== "GUEST") {
          custUserId = b.customer_id;
        } else if (b?.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(b.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'No Technician Available', ?, 'UNASSIGNED', ?)
        `).run(
          randomUUID(),
          custUserId,
          `We could not find an available technician for your selected appointment. Your request is still recorded. Please select an alternative time or contact support. (Booking ID: ${job.bookingReference})`,
          job.bookingId
        );
      }

      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: false,
        selectionReason: actionableReason,
        evaluatedCandidates: [],
        rejectedAlternatives: rejected,
        runId,
      };
    }

    // 2. Multi-Criteria Assignment Scoring
    const maxTravel = Math.max(...eligible.map((e) => e.travelMinutes), 30);
    const maxWorkload = Math.max(...eligible.map((e) => e.technician.activeBookingsCount), 4);

    const scoredCandidates: ScoredCandidate[] = eligible.map((cand) => {
      const travelNorm = Math.min(1, cand.travelMinutes / maxTravel);
      const slaRiskNorm = job.verifiedPriority === "EMERGENCY" ? 0.9 : job.verifiedPriority === "HIGH" ? 0.5 : 0.2;
      const workloadNorm = Math.min(1, cand.technician.activeBookingsCount / maxWorkload);
      const disruptionNorm = 0.1;

      const assignmentCost =
        weights.w1Travel * travelNorm +
        weights.w2SlaRisk * slaRiskNorm +
        weights.w3Workload * workloadNorm +
        weights.w4Disruption * disruptionNorm;

      const isPreferred = cand.technician.userId === job.preferredTechnicianId;

      return {
        technicianId: cand.technician.userId,
        fullName: cand.technician.fullName,
        phone: cand.technician.phone,
        travelMinutes: cand.travelMinutes,
        distanceKm: cand.distanceKm,
        activeJobsCount: cand.technician.activeBookingsCount,
        rating: cand.technician.averageRating,
        travelCostNorm: Number(travelNorm.toFixed(3)),
        slaRiskNorm: Number(slaRiskNorm.toFixed(3)),
        workloadNorm: Number(workloadNorm.toFixed(3)),
        disruptionNorm: Number(disruptionNorm.toFixed(3)),
        assignmentCost: Number(assignmentCost.toFixed(4)),
        isPreferredByCustomer: isPreferred,
        scoreBreakdown: {
          travelScore: Number((weights.w1Travel * travelNorm).toFixed(3)),
          slaScore: Number((weights.w2SlaRisk * slaRiskNorm).toFixed(3)),
          workloadScore: Number((weights.w3Workload * workloadNorm).toFixed(3)),
          disruptionScore: Number((weights.w4Disruption * disruptionNorm).toFixed(3)),
        },
      };
    });

    // Sort by cost ascending
    scoredCandidates.sort((a, b) => a.assignmentCost - b.assignmentCost);

    // Round Robin fairness tie-break if top two are within 0.05
    let winner: ScoredCandidate = scoredCandidates[0];
    let reason = "";

    const preferredCandidate = eligible.find((e) => e.technician.userId === job.preferredTechnicianId);
    if (preferredCandidate) {
      winner = scoredCandidates.find((c) => c.technicianId === job.preferredTechnicianId)!;
      reason = `Customer preferred technician selected: ${winner.fullName} meets all qualifications and shift criteria.`;
    } else {
      const second = scoredCandidates[1];
      if (second && Math.abs(winner.assignmentCost - second.assignmentCost) < 0.05) {
        if (second.activeJobsCount < winner.activeJobsCount) {
          winner = second;
          reason = `Selected via Round-Robin fairness tie-break: ${second.fullName} (Active load: ${second.activeJobsCount}) vs ${scoredCandidates[0].fullName} (Active load: ${scoredCandidates[0].activeJobsCount}).`;
        } else {
          reason = `Optimal candidate selected: score ${winner.assignmentCost.toFixed(3)} (Travel: ${winner.travelMinutes}m, Active load: ${winner.activeJobsCount}).`;
        }
      } else {
        reason = `Optimal candidate selected with lowest cost ${winner.assignmentCost.toFixed(3)} (Travel: ${winner.travelMinutes}m, Active load: ${winner.activeJobsCount}).`;
      }
    }

    // 3. Commit Atomic Job Offer to Database
    const offerId = "OFFER_" + randomUUID().substring(0, 8);
    const prevOffersRow = db.prepare("SELECT COUNT(*) as count FROM job_offers WHERE booking_id = ?").get(job.bookingId) as { count: number };
    const attemptNumber = (prevOffersRow ? prevOffersRow.count : 0) + 1;

    const offerTx = db.transaction(() => {
      // Create offer record with attempt_number and runId
      db.prepare(`
        INSERT INTO job_offers (offer_id, booking_id, technician_id, status, travel_minutes, distance_km, score, attempt_number, scheduling_run_id)
        VALUES (?, ?, ?, 'OFFERED', ?, ?, ?, ?, ?)
      `).run(offerId, job.bookingId, winner.technicianId, winner.travelMinutes, winner.distanceKm, winner.assignmentCost, attemptNumber, runId);

      // Update booking status to OFFERED
      db.prepare(`
        UPDATE bookings
        SET booking_status = 'OFFERED',
            assigned_technician_id = ?,
            estimated_travel_time_minutes = ?,
            unassigned_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(winner.technicianId, winner.travelMinutes, job.bookingId);

      // Record audit history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'PENDING', 'OFFERED', 'SYSTEM_DISPATCH_ENGINE', ?)
      `).run(randomUUID(), job.bookingId, `Job offer (Attempt #${attemptNumber}) dispatched to ${winner.fullName}: ${reason}`);

      // Explainability record
      db.prepare(`
        INSERT INTO assignment_records (
          record_id, scheduling_run_id, booking_id, assigned_technician_id,
          calculated_travel_time_minutes, assignment_score, selection_reason,
          evaluated_candidates, rejected_alternatives
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        runId,
        job.bookingId,
        winner.technicianId,
        winner.travelMinutes,
        winner.assignmentCost,
        reason,
        JSON.stringify(scoredCandidates),
        JSON.stringify(rejected)
      );

      // In-App Notification to Technician
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'New Job Offer Received', ?, 'OFFER', ?)
      `).run(
        randomUUID(),
        winner.technicianId,
        `New ${job.category} Job Offer: ${job.bookingReference} at ${job.serviceAddress}. Window: ${job.preferredStartTime}-${job.preferredEndTime}. Travel: ${winner.travelMinutes} mins. Accept or decline.`,
        offerId
      );

      // Customer Notification (Section 4 Requirements)
      let custUserId = job.customerId;
      if (!custUserId || custUserId === "GUEST") {
        const b = db.prepare("SELECT customer_id, customer_phone FROM bookings WHERE booking_id = ?").get(job.bookingId) as any;
        if (b?.customer_id && b.customer_id !== "GUEST") {
          custUserId = b.customer_id;
        } else if (b?.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(b.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        if (attemptNumber > 1) {
          // Notification 2: New technician selected after reallocation
          db.prepare(`
            INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
            VALUES (?, ?, 'Awaiting technician acceptance', ?, 'REALLOCATION', ?)
          `).run(
            randomUUID(),
            custUserId,
            `Good news! Your request has been sent to another technician. Specialist: ${winner.fullName}. Status: Awaiting technician acceptance. (Booking ID: ${job.bookingReference})`,
            job.bookingId
          );
        } else {
          // Initial Offer Notification
          db.prepare(`
            INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
            VALUES (?, ?, 'Specialist Matched', ?, 'STATUS_UPDATE', ?)
          `).run(
            randomUUID(),
            custUserId,
            `We have matched certified specialist ${winner.fullName} for your booking (${job.bookingReference}). Status: Awaiting technician acceptance.`,
            job.bookingId
          );
        }
      }
    });

    try {
      offerTx();
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: true,
        offerId,
        assignedTechnicianId: winner.technicianId,
        assignedTechnicianName: winner.fullName,
        estimatedTravelMinutes: winner.travelMinutes,
        selectionReason: reason,
        winningScore: winner.assignmentCost,
        evaluatedCandidates: scoredCandidates,
        rejectedAlternatives: rejected,
        runId,
      };
    } catch (err: any) {
      console.error("Failed to commit job offer:", err);
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: false,
        selectionReason: `Offer commit failed: ${err.message}`,
        evaluatedCandidates: scoredCandidates,
        rejectedAlternatives: rejected,
        runId,
      };
    }
  }

  /**
   * Technician accepts a job offer.
   * Atomically confirms booking status to ASSIGNED.
   */
  public static acceptJobOffer(offerId: string, technicianUserId: string) {
    const offer = db.prepare(`
      SELECT jo.*, b.booking_reference, b.service_id, b.preferred_date, b.preferred_start_time, b.preferred_end_time, b.customer_id, b.service_address
      FROM job_offers jo
      JOIN bookings b ON jo.booking_id = b.booking_id
      WHERE jo.offer_id = ?
    `).get(offerId) as any;

    if (!offer) {
      throw new Error("Offer not found.");
    }

    if (offer.technician_id !== technicianUserId) {
      throw new Error("Unauthorized: Offer does not belong to this technician.");
    }

    if (offer.status !== "OFFERED") {
      throw new Error(`Offer is no longer valid (Current status: ${offer.status}).`);
    }

    // Protection against two technicians accepting the same booking
    const currentBooking = db.prepare("SELECT booking_status, assigned_technician_id FROM bookings WHERE booking_id = ?").get(offer.booking_id) as any;
    if (currentBooking && currentBooking.booking_status === "ASSIGNED" && currentBooking.assigned_technician_id !== technicianUserId) {
      throw new Error("Conflict: This booking has already been accepted and assigned to another technician.");
    }

    const techUser = db.prepare("SELECT full_name, phone FROM users WHERE user_id = ?").get(technicianUserId) as any;

    const acceptTx = db.transaction(() => {
      // 1. Mark offer accepted
      db.prepare(`
        UPDATE job_offers
        SET status = 'ACCEPTED',
            responded_at = CURRENT_TIMESTAMP
        WHERE offer_id = ?
      `).run(offerId);

      // 2. Withdraw any other pending offers for this booking
      db.prepare(`
        UPDATE job_offers
        SET status = 'WITHDRAWN',
            responded_at = CURRENT_TIMESTAMP
        WHERE booking_id = ? AND offer_id != ? AND status = 'OFFERED'
      `).run(offer.booking_id, offerId);

      // 3. Confirm booking assignment
      const confirmedStart = `${offer.preferred_date}T${offer.preferred_start_time}:00Z`;
      const confirmedEnd = `${offer.preferred_date}T${offer.preferred_end_time}:00Z`;

      db.prepare(`
        UPDATE bookings
        SET assigned_technician_id = ?,
            booking_status = 'ASSIGNED',
            confirmed_start_time = ?,
            confirmed_end_time = ?,
            estimated_travel_time_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(technicianUserId, confirmedStart, confirmedEnd, offer.travel_minutes, offer.booking_id);

      // 4. Record status history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'OFFERED', 'ASSIGNED', ?, 'Technician accepted assignment')
      `).run(randomUUID(), offer.booking_id, technicianUserId);

      // 5. Notifications - Customer Notification 3 (Technician Confirmed)
      let custUserId = offer.customer_id;
      if (!custUserId || custUserId === "GUEST") {
        const b = db.prepare("SELECT customer_id, customer_phone FROM bookings WHERE booking_id = ?").get(offer.booking_id) as any;
        if (b?.customer_id && b.customer_id !== "GUEST") {
          custUserId = b.customer_id;
        } else if (b?.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(b.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'Technician confirmed', ?, 'CONFIRMATION', ?)
        `).run(
          randomUUID(),
          custUserId,
          `Your technician has accepted your service request! Technician Name: ${techUser?.full_name || "Specialist"}, Technician ID: ${technicianUserId}, Estimated Distance: ${offer.distance_km} km, Estimated Arrival: ${offer.travel_minutes} mins. Status: Technician confirmed. (Booking ID: ${offer.booking_reference})`,
          offer.booking_id
        );
      }

      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Assignment Confirmed', ?, 'ASSIGNMENT', ?)
      `).run(
        randomUUID(),
        technicianUserId,
        `You have confirmed booking ${offer.booking_reference}. Appointment window: ${offer.preferred_start_time} - ${offer.preferred_end_time}.`,
        offer.booking_id
      );
    });

    acceptTx();

    try {
      trackingService.getOrCreateSession(offer.booking_id, technicianUserId);
    } catch (e) {
      console.error("Tracking session init on accept error:", e);
    }

    return {
      success: true,
      bookingId: offer.booking_id,
      bookingReference: offer.booking_reference,
      technicianName: techUser?.full_name,
      confirmedStartTime: `${offer.preferred_date}T${offer.preferred_start_time}:00Z`,
      confirmedEndTime: `${offer.preferred_date}T${offer.preferred_end_time}:00Z`,
      travelMinutes: offer.travel_minutes,
      distanceKm: offer.distance_km,
    };
  }

  /**
   * Technician rejects a job offer with a reason.
   * Automatically invokes the engine to offer the job to the next best eligible technician!
   */
  public static rejectJobOffer(offerId: string, technicianUserId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new Error("A rejection reason is required.");
    }

    const offer = db.prepare(`
      SELECT jo.*, b.booking_reference, b.is_demo_tracking, b.service_id, b.customer_id, b.customer_phone, b.problem_description,
             b.service_address, b.latitude, b.longitude, b.node_id, b.preferred_date,
             b.preferred_start_time, b.preferred_end_time, b.requested_priority, b.verified_priority,
             s.category, s.required_skills, s.required_certifications, s.estimated_duration_minutes
      FROM job_offers jo
      JOIN bookings b ON jo.booking_id = b.booking_id
      JOIN services s ON b.service_id = s.service_id
      WHERE jo.offer_id = ?
    `).get(offerId) as any;

    if (!offer) {
      throw new Error("Offer not found.");
    }

    if (offer.technician_id !== technicianUserId) {
      throw new Error("Unauthorized: Offer does not belong to this technician.");
    }

    // Idempotency: if already rejected, don't trigger duplicate reallocation
    if (offer.status === "REJECTED") {
      return {
        success: true,
        message: "Offer was already rejected.",
        bookingId: offer.booking_id,
        alreadyProcessed: true,
      };
    }

    const rejectTx = db.transaction(() => {
      // 1. Mark offer rejected
      db.prepare(`
        UPDATE job_offers
        SET status = 'REJECTED',
            rejection_reason = ?,
            responded_at = CURRENT_TIMESTAMP
        WHERE offer_id = ?
      `).run(reason.trim(), offerId);

      // 2. Unassign technician from booking so it is NOT marked as assigned to them
      db.prepare(`
        UPDATE bookings
        SET assigned_technician_id = NULL,
            booking_status = 'PENDING',
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(offer.booking_id);

      // 3. Status history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'OFFERED', 'PENDING', ?, ?)
      `).run(randomUUID(), offer.booking_id, technicianUserId, `Technician declined offer: ${reason.trim()}`);

      // 4. Notification 1 to Customer: Technician unavailable, finding another suitable technician
      let custUserId = offer.customer_id;
      if (!custUserId || custUserId === "GUEST") {
        if (offer.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(offer.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'Finding another technician', ?, 'REALLOCATION', ?)
        `).run(
          randomUUID(),
          custUserId,
          `Your previously contacted technician is unavailable for this request. We are automatically finding another suitable technician for you. (Booking ID: ${offer.booking_reference})`,
          offer.booking_id
        );
      }
    });

    rejectTx();

    // If this is a Demo Tracking Mode booking, do NOT re-allocate to other technicians!
    if (offer.is_demo_tracking) {
      db.prepare(`
        UPDATE bookings
        SET booking_status = 'UNASSIGNED',
            unassigned_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(`Demo technician Amit Patel declined: ${reason}`, offer.booking_id);

      let custUserId = offer.customer_id;
      if (!custUserId || custUserId === "GUEST") {
        if (offer.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(offer.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'Demo Technician Declined', ?, 'DEMO_DECLINE', ?)
        `).run(
          randomUUID(),
          custUserId,
          `Demo technician Amit Patel declined your booking: "${reason}". In demo mode, this booking will not be assigned to other technicians.`,
          offer.booking_id
        );
      }

      return {
        success: true,
        bookingId: offer.booking_id,
        bookingReference: offer.booking_reference,
        isDemoTracking: true,
        rejectionReason: reason,
        message: "Demo technician Amit Patel declined. Demo tracking stopped as requested.",
      };
    }

    // 5. Exclude ALL technicians who have rejected this booking from future offers
    const previousRejectors = (db.prepare(`
      SELECT DISTINCT technician_id FROM job_offers
      WHERE booking_id = ? AND status = 'REJECTED'
    `).all(offer.booking_id) as any[]).map((r) => r.technician_id);

    // 6. Immediately trigger automatic re-offer to NEXT suitable technician!
    const job: SchedulingJob = {
      bookingId: offer.booking_id,
      bookingReference: offer.booking_reference,
      customerId: offer.customer_id,
      serviceId: offer.service_id,
      category: offer.category,
      requiredSkills: JSON.parse(offer.required_skills || "[]"),
      requiredCertifications: JSON.parse(offer.required_certifications || "[]"),
      nodeId: offer.node_id,
      latitude: offer.latitude,
      longitude: offer.longitude,
      serviceAddress: offer.service_address,
      requestedPriority: offer.requested_priority,
      verifiedPriority: offer.verified_priority,
      preferredDate: offer.preferred_date,
      preferredStartTime: offer.preferred_start_time,
      preferredEndTime: offer.preferred_end_time,
      estimatedDurationMinutes: offer.estimated_duration_minutes || 60,
      createdAt: new Date().toISOString(),
    };

    const reofferResult = this.offerJobToBestCandidate(
      job,
      DEFAULT_WEIGHTS,
      randomUUID(),
      { excludedTechnicianIds: previousRejectors }
    );

    return {
      success: true,
      rejectedOfferId: offerId,
      bookingId: offer.booking_id,
      reallocation: reofferResult,
      reallocated: reofferResult.success,
      nextOfferId: reofferResult.offerId,
      nextTechnicianId: reofferResult.assignedTechnicianId,
      nextTechnicianName: reofferResult.assignedTechnicianName,
    };
  }

  /**
   * Expires an offer due to timeout and automatically triggers reallocation
   */
  public static expireJobOffer(offerId: string) {
    const offer = db.prepare(`
      SELECT jo.*, b.booking_reference, b.is_demo_tracking, b.service_id, b.customer_id, b.customer_phone, b.problem_description,
             b.service_address, b.latitude, b.longitude, b.node_id, b.preferred_date,
             b.preferred_start_time, b.preferred_end_time, b.requested_priority, b.verified_priority,
             s.category, s.required_skills, s.required_certifications, s.estimated_duration_minutes
      FROM job_offers jo
      JOIN bookings b ON jo.booking_id = b.booking_id
      JOIN services s ON b.service_id = s.service_id
      WHERE jo.offer_id = ?
    `).get(offerId) as any;

    if (!offer) {
      throw new Error("Offer not found.");
    }

    if (offer.status !== "OFFERED") {
      return { success: false, message: `Offer is already ${offer.status}` };
    }

    const expireTx = db.transaction(() => {
      db.prepare(`
        UPDATE job_offers
        SET status = 'EXPIRED',
            rejection_reason = 'Offer expired without response (Timeout)',
            responded_at = CURRENT_TIMESTAMP
        WHERE offer_id = ?
      `).run(offerId);

      db.prepare(`
        UPDATE bookings
        SET assigned_technician_id = NULL,
            booking_status = 'PENDING',
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(offer.booking_id);

      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'OFFERED', 'PENDING', 'SYSTEM_TIMEOUT', 'Offer timed out without technician response')
      `).run(randomUUID(), offer.booking_id);

      // Customer notification
      let custUserId = offer.customer_id;
      if (!custUserId || custUserId === "GUEST") {
        if (offer.customer_phone) {
          const u = db.prepare("SELECT user_id FROM users WHERE phone = ? AND role = 'CUSTOMER'").get(offer.customer_phone) as any;
          if (u) custUserId = u.user_id;
        }
      }

      if (custUserId && custUserId !== "GUEST") {
        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'Finding another technician', ?, 'REALLOCATION', ?)
        `).run(
          randomUUID(),
          custUserId,
          `Your previously contacted technician did not respond within the time window. We are automatically finding another suitable technician for you. (Booking ID: ${offer.booking_reference})`,
          offer.booking_id
        );
      }
    });

    expireTx();

    const job: SchedulingJob = {
      bookingId: offer.booking_id,
      bookingReference: offer.booking_reference,
      customerId: offer.customer_id,
      serviceId: offer.service_id,
      category: offer.category,
      requiredSkills: JSON.parse(offer.required_skills || "[]"),
      requiredCertifications: JSON.parse(offer.required_certifications || "[]"),
      nodeId: offer.node_id,
      latitude: offer.latitude,
      longitude: offer.longitude,
      serviceAddress: offer.service_address,
      requestedPriority: offer.requested_priority,
      verifiedPriority: offer.verified_priority,
      preferredDate: offer.preferred_date,
      preferredStartTime: offer.preferred_start_time,
      preferredEndTime: offer.preferred_end_time,
      estimatedDurationMinutes: offer.estimated_duration_minutes || 60,
      createdAt: new Date().toISOString(),
    };

    const previousExcludes = (db.prepare(`
      SELECT DISTINCT technician_id FROM job_offers
      WHERE booking_id = ? AND status IN ('REJECTED', 'EXPIRED')
    `).all(offer.booking_id) as any[]).map((r) => r.technician_id);

    const reofferResult = this.offerJobToBestCandidate(
      job,
      DEFAULT_WEIGHTS,
      randomUUID(),
      { excludedTechnicianIds: previousExcludes }
    );

    return {
      success: true,
      expiredOfferId: offerId,
      bookingId: offer.booking_id,
      reallocation: reofferResult,
      reallocated: reofferResult.success,
      nextOfferId: reofferResult.offerId,
      nextTechnicianId: reofferResult.assignedTechnicianId,
      nextTechnicianName: reofferResult.assignedTechnicianName,
    };
  }

  /**
   * Direct assignment helper for administrative overrides or tests
   */
  public static assignJob(
    job: SchedulingJob,
    weights: AssignmentWeights = DEFAULT_WEIGHTS,
    runId: string = randomUUID()
  ) {
    const offerRes = this.offerJobToBestCandidate(job, weights, runId);
    if (!offerRes.success || !offerRes.offerId || !offerRes.assignedTechnicianId) {
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: false,
        selectionReason: offerRes.selectionReason,
        evaluatedCandidates: offerRes.evaluatedCandidates,
        rejectedAlternatives: offerRes.rejectedAlternatives,
        runId,
      };
    }

    // Auto-accept the offer for direct assignment mode
    const acceptRes = this.acceptJobOffer(offerRes.offerId, offerRes.assignedTechnicianId);

    return {
      bookingId: job.bookingId,
      bookingReference: job.bookingReference,
      success: true,
      assignedTechnicianId: offerRes.assignedTechnicianId,
      assignedTechnicianName: offerRes.assignedTechnicianName,
      estimatedTravelMinutes: offerRes.estimatedTravelMinutes,
      confirmedStartTime: acceptRes.confirmedStartTime,
      confirmedEndTime: acceptRes.confirmedEndTime,
      selectionReason: offerRes.selectionReason,
      winningScore: offerRes.winningScore,
      evaluatedCandidates: offerRes.evaluatedCandidates,
      rejectedAlternatives: offerRes.rejectedAlternatives,
      runId,
    };
  }
}
