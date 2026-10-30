import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { RecoveryEngine } from "../services/recoveryEngine.js";
import { AssignmentEngine } from "../services/assignmentEngine.js";
import { dijkstraService } from "../services/dijkstraService.js";
import { randomUUID } from "crypto";

export const techniciansRouter = Router();

// List all technicians (Admin or system view)
techniciansRouter.get("/", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        u.user_id as userId,
        u.username,
        u.full_name as fullName,
        u.email,
        u.phone,
        u.account_status as accountStatus,
        tp.experience_years as experienceYears,
        tp.service_categories as serviceCategories,
        tp.verification_status as verificationStatus,
        tp.verification_notes as verificationNotes,
        tp.verified_at as verifiedAt,
        tp.residential_address as residentialAddress,
        tp.city,
        tp.pincode,
        tp.current_latitude as currentLatitude,
        tp.current_longitude as currentLongitude,
        tp.service_areas as serviceAreas,
        tp.availability_status as availabilityStatus,
        tp.working_days as workingDays,
        tp.shift_start_time as shiftStartTime,
        tp.shift_end_time as shiftEndTime,
        tp.reserved_emergency_capacity as reservedEmergencyCapacity,
        tp.total_completed_jobs as totalCompletedJobs,
        tp.average_rating as averageRating
      FROM users u
      JOIN technician_profiles tp ON u.user_id = tp.user_id
      ORDER BY tp.average_rating DESC, u.full_name ASC
    `).all() as any[];

    const result = rows.map((r) => {
      const skills = db.prepare(`
        SELECT s.skill_id as skillId, s.skill_name as skillName, s.category, ts.years_experience as yearsExperience
        FROM technician_skills ts
        JOIN skills s ON ts.skill_id = s.skill_id
        WHERE ts.technician_id = ?
      `).all(r.userId);

      const certifications = db.prepare(`
        SELECT c.certification_id as certId, c.certification_name as certName, c.category, tc.certificate_number as certNumber, tc.expiry_date as expiryDate
        FROM technician_certifications tc
        JOIN certifications c ON tc.certification_id = c.certification_id
        WHERE tc.technician_id = ?
      `).all(r.userId);

      let serviceAreasList = [];
      try {
        serviceAreasList = JSON.parse(r.serviceAreas);
      } catch {
        serviceAreasList = r.serviceAreas ? r.serviceAreas.split(",") : [];
      }

      // Count active assigned jobs today
      const today = new Date().toISOString().split("T")[0];
      const activeCount = db.prepare(`
        SELECT COUNT(*) as count FROM bookings
        WHERE assigned_technician_id = ?
        AND preferred_date = ?
        AND booking_status IN ('ASSIGNED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
      `).get(r.userId, today) as { count: number };

      return {
        ...r,
        username: r.username || "",
        serviceCategories: r.serviceCategories ? r.serviceCategories.split(",") : [],
        serviceAreas: serviceAreasList,
        workingDays: r.workingDays ? r.workingDays.split(",") : [],
        skills,
        certifications,
        activeBookingsCount: activeCount.count,
      };
    });

    return res.json({ technicians: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// View technician's own pending job offers (Part 4)
techniciansRouter.get("/my/offers", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techId = req.user!.userId;

    const offers = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.booking_id as bookingId,
        jo.status as offerStatus,
        jo.offered_at as offeredAt,
        jo.travel_minutes as travelMinutes,
        jo.distance_km as distanceKm,
        b.booking_reference as bookingReference,
        b.problem_description as problemDescription,
        b.service_address as serviceAddress,
        b.latitude as customerLat,
        b.longitude as customerLng,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        b.requested_priority as requestedPriority,
        b.verified_priority as verifiedPriority,
        s.service_name as serviceName,
        s.category as category,
        s.estimated_duration_minutes as estimatedDurationMinutes,
        s.indicative_price as price
      FROM job_offers jo
      JOIN bookings b ON jo.booking_id = b.booking_id
      JOIN services s ON b.service_id = s.service_id
      WHERE jo.technician_id = ?
      AND jo.status = 'OFFERED'
      ORDER BY jo.offered_at DESC
    `).all(techId) as any[];

    return res.json({ offers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Accept a job offer (Part 4)
techniciansRouter.post("/offers/:offerId/accept", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const offerId = req.params.offerId;
    const techUserId = req.user!.userId;

    const result = AssignmentEngine.acceptJobOffer(offerId, techUserId);
    return res.json({
      message: "Job offer accepted successfully! Booking confirmed.",
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Reject a job offer with reason -> automatically triggers re-offer to next eligible tech (Part 4)
techniciansRouter.post("/offers/:offerId/reject", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const offerId = req.params.offerId;
    const techUserId = req.user!.userId;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Please provide a valid rejection reason." });
    }

    const result = AssignmentEngine.rejectJobOffer(offerId, techUserId, reason);
    return res.json({
      message: "Offer declined. Intelligent scheduling engine automatically dispatched to next suitable candidate.",
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Update availability & working shift
techniciansRouter.put("/availability", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.user!.role === "ADMIN" && req.body.userId ? req.body.userId : req.user!.userId;
    const { availabilityStatus, shiftStartTime, shiftEndTime, workingDays, reservedEmergencyCapacity } = req.body;

    const workingDaysStr = Array.isArray(workingDays) ? workingDays.join(",") : workingDays;

    db.prepare(`
      UPDATE technician_profiles
      SET availability_status = COALESCE(?, availability_status),
          shift_start_time = COALESCE(?, shift_start_time),
          shift_end_time = COALESCE(?, shift_end_time),
          working_days = COALESCE(?, working_days),
          reserved_emergency_capacity = COALESCE(?, reserved_emergency_capacity),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(availabilityStatus, shiftStartTime, shiftEndTime, workingDaysStr, reservedEmergencyCapacity, targetUserId);

    return res.json({ message: "Availability updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Report delay
techniciansRouter.post("/report-delay", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookingId, delayMinutes, reason } = req.body;
    if (!bookingId || !delayMinutes) {
      return res.status(400).json({ error: "Booking ID and delay minutes are required" });
    }

    const recoveryResult = RecoveryEngine.handleDisruption({
      disruptionType: "JOB_DELAY",
      bookingId,
      delayMinutes: parseInt(delayMinutes, 10),
      reason,
      technicianId: req.user!.userId,
    });

    return res.json({
      message: `Delay of ${delayMinutes} mins recorded and handled`,
      recovery: recoveryResult,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Report sickness or vehicle breakdown (triggers dynamic recovery)
techniciansRouter.post("/report-unavailability", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { disruptionType, reason } = req.body;
    const type = disruptionType === "VEHICLE_BREAKDOWN" ? "VEHICLE_BREAKDOWN" : "TECHNICIAN_SICKNESS";

    const recoveryResult = RecoveryEngine.handleDisruption({
      disruptionType: type,
      technicianId: req.user!.userId,
      reason: reason || "Technician reported urgent unavailability",
    });

    return res.json({
      message: "Unavailability reported. Shift recovery engine executed.",
      recovery: recoveryResult,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Verification (Approve, Reject, Review Notes, Suspend/Reactivate)
techniciansRouter.put("/:id/verify", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techUserId = req.params.id;
    const { status, notes } = req.body;

    if (!["APPROVED", "REJECTED", "PENDING", "SUSPENDED"].includes(status)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }

    const now = new Date().toISOString();
    const isApproved = status === "APPROVED";

    const verifyTx = db.transaction(() => {
      // Update profile
      db.prepare(`
        UPDATE technician_profiles
        SET verification_status = ?,
            verification_notes = ?,
            verified_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(status === "SUSPENDED" ? "REJECTED" : status, notes || "Reviewed by DispatchGrid Administrator", isApproved ? now : null, techUserId);

      // Update user account status
      db.prepare(`
        UPDATE users
        SET account_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(status === "APPROVED" ? "ACTIVE" : status === "SUSPENDED" ? "SUSPENDED" : status === "REJECTED" ? "REJECTED" : "PENDING", techUserId);

      // Notification to technician
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Technician Verification Status Updated', ?, 'VERIFICATION', ?)
      `).run(
        randomUUID(),
        techUserId,
        `Your DispatchGrid verification status is now: ${status}. Admin notes: ${notes || "None"}`,
        techUserId
      );
    });

    verifyTx();

    return res.json({
      message: `Technician ${techUserId} status set to ${status}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
