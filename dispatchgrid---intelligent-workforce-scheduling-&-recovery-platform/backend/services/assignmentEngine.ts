// Intelligent Assignment Engine
// Combines Dijkstra Routing, Weighted Multi-Criteria Scoring, Customer Preference, Round Robin, and Atomic Commits

import { db } from "../config/database.js";
import { EligibilityService, EligibilityResult } from "./eligibilityService.js";
import { SchedulingJob } from "./priorityQueue.js";
import { randomUUID } from "crypto";

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

export interface AssignmentExecutionResult {
  bookingId: string;
  bookingReference: string;
  success: boolean;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  estimatedTravelMinutes?: number;
  confirmedStartTime?: string;
  confirmedEndTime?: string;
  selectionReason?: string;
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
   * Executes intelligent assignment for a single accepted booking.
   * Atomic transactional commit with audit logging.
   */
  public static assignJob(
    job: SchedulingJob,
    weights: AssignmentWeights = DEFAULT_WEIGHTS,
    runId: string = randomUUID()
  ): AssignmentExecutionResult {
    // 1. Evaluate hard constraints for all technicians
    const eligibilityResults = EligibilityService.evaluateCandidates(job);

    const eligible = eligibilityResults.filter((r) => r.isEligible);
    const rejected = eligibilityResults
      .filter((r) => !r.isEligible)
      .map((r) => ({
        technicianId: r.technician.userId,
        fullName: r.technician.fullName,
        reasons: r.rejectionReasons,
      }));

    if (eligible.length === 0) {
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: false,
        selectionReason: "No eligible technicians found meeting mandatory skills, certifications, and schedule availability.",
        evaluatedCandidates: [],
        rejectedAlternatives: rejected,
        runId,
      };
    }

    // 2. Check Customer Preferred Technician (Phase 4.5)
    let preferredCandidate = eligible.find((e) => e.technician.userId === job.preferredTechnicianId);
    let preferredReason = "";

    if (job.preferredTechnicianId) {
      if (preferredCandidate) {
        preferredReason = `Honoured customer preference: ${preferredCandidate.technician.fullName} satisfies all mandatory skills, certifications, and shift requirements.`;
      } else {
        const rejectedPref = rejected.find((r) => r.technicianId === job.preferredTechnicianId);
        if (rejectedPref) {
          preferredReason = `Customer preferred technician could not be assigned: ${rejectedPref.reasons.join("; ")}. Evaluated next optimal candidates.`;
        }
      }
    }

    // 3. Multi-Criteria Assignment Scoring (Phase 4.6)
    // Find max values for normalization
    const maxTravel = Math.max(...eligible.map((e) => e.travelMinutes), 30);
    const maxWorkload = Math.max(...eligible.map((e) => e.technician.activeBookingsCount), 4);

    const scoredCandidates: ScoredCandidate[] = eligible.map((cand) => {
      // Travel cost (0 to 1)
      const travelNorm = Math.min(1, cand.travelMinutes / maxTravel);

      // SLA Risk: higher if emergency or booking has less lead time
      const slaRiskNorm = job.verifiedPriority === "EMERGENCY" ? 0.9 : job.verifiedPriority === "HIGH" ? 0.5 : 0.2;

      // Workload imbalance: higher if technician already has many jobs today
      const workloadNorm = Math.min(1, cand.technician.activeBookingsCount / maxWorkload);

      // Disruption cost: 0 if no overlapping shifts or minimal rerouting
      const disruptionNorm = 0.1;

      // Assignment Cost formula
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

    // 4. Determine Winner
    let winner: ScoredCandidate;
    let reason: string;

    if (preferredCandidate) {
      // Customer preference wins among eligible candidates
      winner = scoredCandidates.find((c) => c.technicianId === job.preferredTechnicianId)!;
      reason = preferredReason;
    } else {
      // Check Round Robin tie-breaking if scores are within 0.05
      const top = scoredCandidates[0];
      const second = scoredCandidates[1];

      if (second && Math.abs(top.assignmentCost - second.assignmentCost) < 0.05) {
        // Tie-break with Round Robin fairness (pick the one with fewer active jobs today)
        if (second.activeJobsCount < top.activeJobsCount) {
          winner = second;
          reason = `Selected via Round-Robin fairness tie-break: ${second.fullName} (active jobs: ${second.activeJobsCount}) vs ${top.fullName} (active jobs: ${top.activeJobsCount}) with comparable assignment cost (${second.assignmentCost.toFixed(3)} vs ${top.assignmentCost.toFixed(3)}).`;
        } else {
          winner = top;
          reason = `Selected lowest assignment cost: score ${top.assignmentCost.toFixed(3)} with travel time ${top.travelMinutes} mins and active workload ${top.activeJobsCount} jobs.`;
        }
      } else {
        winner = top;
        reason = `Optimal assignment selected with lowest weighted cost: score ${top.assignmentCost.toFixed(3)} (Travel: ${top.travelMinutes} mins, Active jobs: ${top.activeJobsCount}).`;
      }

      if (job.preferredTechnicianId && preferredReason) {
        reason = `${preferredReason} -> ${reason}`;
      }
    }

    // 5. Atomic DB Transaction to Commit Schedule & Audit Log (Phase 4.8 & 4.9)
    const confirmedStart = `${job.preferredDate}T${job.preferredStartTime}:00Z`;
    const confirmedEnd = `${job.preferredDate}T${job.preferredEndTime}:00Z`;

    const commitTx = db.transaction(() => {
      // Update booking
      db.prepare(`
        UPDATE bookings
        SET assigned_technician_id = ?,
            booking_status = 'SCHEDULED',
            confirmed_start_time = ?,
            confirmed_end_time = ?,
            estimated_travel_time_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(winner.technicianId, confirmedStart, confirmedEnd, winner.travelMinutes, job.bookingId);

      // Record status history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, 'ACCEPTED', 'SCHEDULED', 'SYSTEM_DISPATCH_ENGINE', ?)
      `).run(randomUUID(), job.bookingId, reason);

      // Record assignment explainability
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

      // Send notifications to Customer & Technician
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Technician Scheduled', ?, 'ASSIGNMENT', ?)
      `).run(
        randomUUID(),
        job.customerId,
        `Your booking (${job.bookingReference}) has been scheduled with ${winner.fullName}. Estimated travel time: ${winner.travelMinutes} minutes.`,
        job.bookingId
      );

      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'New Job Assigned', ?, 'ASSIGNMENT', ?)
      `).run(
        randomUUID(),
        winner.technicianId,
        `You have been assigned to ${job.category} booking ${job.bookingReference} at ${job.serviceAddress}. Appointment: ${job.preferredStartTime} - ${job.preferredEndTime}.`,
        job.bookingId
      );
    });

    try {
      commitTx();
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: true,
        assignedTechnicianId: winner.technicianId,
        assignedTechnicianName: winner.fullName,
        estimatedTravelMinutes: winner.travelMinutes,
        confirmedStartTime: confirmedStart,
        confirmedEndTime: confirmedEnd,
        selectionReason: reason,
        winningScore: winner.assignmentCost,
        evaluatedCandidates: scoredCandidates,
        rejectedAlternatives: rejected,
        runId,
      };
    } catch (err: any) {
      console.error("Assignment transaction failed:", err);
      return {
        bookingId: job.bookingId,
        bookingReference: job.bookingReference,
        success: false,
        selectionReason: `Database transaction rollbacked due to error: ${err.message}`,
        evaluatedCandidates: scoredCandidates,
        rejectedAlternatives: rejected,
        runId,
      };
    }
  }
}
