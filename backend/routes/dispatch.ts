import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { AssignmentEngine, DEFAULT_WEIGHTS } from "../services/assignmentEngine.js";
import { OptimizerService, DEFAULT_OPT_WEIGHTS } from "../services/optimizerService.js";
import { dijkstraService } from "../services/dijkstraService.js";
import { METRO_NODES, METRO_EDGES } from "../config/roadNetwork.js";
import { SchedulingJob } from "../services/priorityQueue.js";
import { randomUUID } from "crypto";

export const dispatchRouter = Router();

// Road network graph data for Leaflet Map
dispatchRouter.get("/road-network", (req, res) => {
  return res.json({
    nodes: Object.values(METRO_NODES),
    edges: METRO_EDGES,
  });
});

// Run intelligent single job assignment
dispatchRouter.post("/auto-assign/:bookingId", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.bookingId;
    const { weights, directAssign } = req.body;

    const row = db.prepare(`
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
        b.preferred_technician_id as preferredTechnicianId,
        b.created_at as createdAt,
        s.estimated_duration_minutes as estimatedDurationMinutes
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      WHERE b.booking_id = ?
    `).get(bookingId) as any;

    if (!row) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const job: SchedulingJob = {
      bookingId: row.bookingId,
      bookingReference: row.bookingReference,
      customerId: row.customerId,
      serviceId: row.serviceId,
      category: row.category,
      requiredSkills: JSON.parse(row.requiredSkillsStr || "[]"),
      requiredCertifications: JSON.parse(row.requiredCertificationsStr || "[]"),
      nodeId: row.nodeId,
      latitude: row.latitude,
      longitude: row.longitude,
      serviceAddress: row.serviceAddress,
      requestedPriority: row.requestedPriority,
      verifiedPriority: row.verifiedPriority,
      preferredDate: row.preferredDate,
      preferredStartTime: row.preferredStartTime,
      preferredEndTime: row.preferredEndTime,
      preferredTechnicianId: row.preferredTechnicianId,
      estimatedDurationMinutes: row.estimatedDurationMinutes || 60,
      createdAt: row.createdAt,
    };

    const result = directAssign
      ? AssignmentEngine.assignJob(job, weights || DEFAULT_WEIGHTS)
      : AssignmentEngine.offerJobToBestCandidate(job, weights || DEFAULT_WEIGHTS);

    return res.json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Run global schedule optimization (Phase 5)
dispatchRouter.post("/optimize", authenticateToken, requireRole("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { weights, timeLimitSec } = req.body;
    const result = await OptimizerService.optimizeSchedule(
      weights || DEFAULT_OPT_WEIGHTS,
      timeLimitSec || 5
    );
    return res.json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// History of all job offers and acceptance/rejection (Part 4 & Part 11)
dispatchRouter.get("/offers-history", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.booking_id as bookingId,
        jo.technician_id as technicianId,
        jo.status as status,
        jo.rejection_reason as rejectionReason,
        jo.offered_at as offeredAt,
        jo.responded_at as respondedAt,
        jo.travel_minutes as travelMinutes,
        jo.distance_km as distanceKm,
        jo.score,
        b.booking_reference as bookingReference,
        b.service_address as serviceAddress,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        s.service_name as serviceName,
        s.category,
        u.full_name as technicianName,
        u.username as technicianUsername
      FROM job_offers jo
      JOIN bookings b ON jo.booking_id = b.booking_id
      JOIN services s ON b.service_id = s.service_id
      JOIN users u ON jo.technician_id = u.user_id
      ORDER BY jo.offered_at DESC
      LIMIT 100
    `).all();

    return res.json({ offers: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Manual assignment by dispatcher
dispatchRouter.post("/manual-assign", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookingId, technicianId, overrideReason } = req.body;
    if (!bookingId || !technicianId) {
      return res.status(400).json({ error: "Booking ID and Technician ID required" });
    }

    const booking = db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    const tech = db.prepare("SELECT * FROM technician_profiles tp JOIN users u ON tp.user_id = u.user_id WHERE tp.user_id = ?").get(technicianId) as any;

    if (!booking || !tech) {
      return res.status(404).json({ error: "Booking or Technician not found" });
    }

    // Calculate Dijkstra travel
    const travel = dijkstraService.calculateTravelBetweenCoords(
      tech.current_latitude,
      tech.current_longitude,
      booking.latitude,
      booking.longitude
    );

    const reason = overrideReason || `Manual assignment by Dispatcher ${req.user!.fullName}`;

    const assignTx = db.transaction(() => {
      db.prepare(`
        UPDATE bookings
        SET assigned_technician_id = ?,
            booking_status = 'ASSIGNED',
            estimated_travel_time_minutes = ?,
            unassigned_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(technicianId, travel.travelMinutes, bookingId);

      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, ?, 'ASSIGNED', ?, ?)
      `).run(randomUUID(), bookingId, booking.booking_status, req.user!.userId, reason);

      db.prepare(`
        INSERT INTO assignment_records (
          record_id, scheduling_run_id, booking_id, assigned_technician_id,
          calculated_travel_time_minutes, assignment_score, selection_reason,
          evaluated_candidates, rejected_alternatives
        ) VALUES (?, ?, ?, ?, ?, 0.0, ?, '[]', '[]')
      `).run(randomUUID(), "MANUAL_DISPATCH", bookingId, technicianId, travel.travelMinutes, reason);
    });

    assignTx();

    return res.json({
      message: `Technician ${tech.full_name} assigned manually. Travel time: ${travel.travelMinutes} mins.`,
      travelMinutes: travel.travelMinutes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Explainability endpoint: get audit record for a booking assignment
dispatchRouter.get("/explain/:bookingId", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = db.prepare(`
      SELECT ar.*, u.full_name as technician_name, b.booking_reference
      FROM assignment_records ar
      LEFT JOIN users u ON ar.assigned_technician_id = u.user_id
      JOIN bookings b ON ar.booking_id = b.booking_id
      WHERE ar.booking_id = ?
      ORDER BY ar.assigned_at DESC
      LIMIT 1
    `).get(req.params.bookingId) as any;

    if (!record) {
      return res.status(404).json({ error: "No assignment explanation found for this booking" });
    }

    return res.json({
      record: {
        ...record,
        technician_name: record.technician_name || "Unassigned",
        evaluatedCandidates: JSON.parse(record.evaluated_candidates || "[]"),
        rejectedAlternatives: JSON.parse(record.rejected_alternatives || "[]"),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Daily technician timeline / Gantt chart
dispatchRouter.get("/timeline", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

    const techs = db.prepare(`
      SELECT u.user_id as userId, u.username, u.full_name as fullName, tp.shift_start_time as shiftStart, tp.shift_end_time as shiftEnd, tp.service_categories as categories, tp.availability_status as status
      FROM users u
      JOIN technician_profiles tp ON u.user_id = tp.user_id
      WHERE tp.verification_status = 'APPROVED'
      ORDER BY u.full_name ASC
    `).all() as any[];

    const timelineData = techs.map((t) => {
      const bookings = db.prepare(`
        SELECT 
          b.booking_id as bookingId,
          b.booking_reference as bookingReference,
          b.preferred_start_time as startTime,
          b.preferred_end_time as endTime,
          b.booking_status as status,
          b.verified_priority as priority,
          s.service_name as serviceName,
          s.category as category,
          b.estimated_travel_time_minutes as travelMinutes,
          COALESCE(b.customer_name, cu.full_name, 'Customer') as customerName
        FROM bookings b
        JOIN services s ON b.service_id = s.service_id
        LEFT JOIN users cu ON b.customer_id = cu.user_id
        WHERE b.assigned_technician_id = ?
        AND b.preferred_date = ?
        AND b.booking_status NOT IN ('CANCELLED', 'REJECTED')
        ORDER BY b.preferred_start_time ASC
      `).all(t.userId, date);

      return {
        technician: t,
        assignments: bookings,
      };
    });

    return res.json({ timeline: timelineData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
