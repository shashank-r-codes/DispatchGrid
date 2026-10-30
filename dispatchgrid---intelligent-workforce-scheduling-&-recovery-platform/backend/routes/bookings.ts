import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { findClosestNode, METRO_NODES } from "../config/roadNetwork.js";
import { randomUUID } from "crypto";

export const bookingsRouter = Router();

// List bookings with role-based filtering
bookingsRouter.get("/", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, category, priority, date } = req.query;
    let query = `
      SELECT 
        b.booking_id as bookingId,
        b.booking_reference as bookingReference,
        b.customer_id as customerId,
        cu.full_name as customerName,
        cu.phone as customerPhone,
        b.service_id as serviceId,
        s.service_name as serviceName,
        s.category as category,
        s.indicative_price as indicativePrice,
        s.estimated_duration_minutes as estimatedDurationMinutes,
        b.assigned_technician_id as assignedTechnicianId,
        tu.full_name as assignedTechnicianName,
        tu.phone as assignedTechnicianPhone,
        tp.average_rating as assignedTechnicianRating,
        b.requested_priority as requestedPriority,
        b.verified_priority as verifiedPriority,
        b.booking_status as bookingStatus,
        b.problem_description as problemDescription,
        b.photo_url as photoUrl,
        b.service_address as serviceAddress,
        b.latitude,
        b.longitude,
        b.node_id as nodeId,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        b.preferred_technician_id as preferredTechnicianId,
        pref_u.full_name as preferredTechnicianName,
        b.confirmed_start_time as confirmedStartTime,
        b.confirmed_end_time as confirmedEndTime,
        b.estimated_travel_time_minutes as estimatedTravelTimeMinutes,
        b.created_at as createdAt,
        r.rating as customerRating,
        r.comment as customerReview
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      JOIN users cu ON b.customer_id = cu.user_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      LEFT JOIN users pref_u ON b.preferred_technician_id = pref_u.user_id
      LEFT JOIN reviews r ON b.booking_id = r.booking_id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Role restrictions
    if (req.user!.role === "CUSTOMER") {
      query += " AND b.customer_id = ?";
      params.push(req.user!.userId);
    } else if (req.user!.role === "TECHNICIAN") {
      query += " AND b.assigned_technician_id = ?";
      params.push(req.user!.userId);
    }

    if (status) {
      query += " AND b.booking_status = ?";
      params.push(status);
    }

    if (category) {
      query += " AND s.category = ?";
      params.push(category);
    }

    if (priority) {
      query += " AND b.verified_priority = ?";
      params.push(priority);
    }

    if (date) {
      query += " AND b.preferred_date = ?";
      params.push(date);
    }

    query += " ORDER BY b.created_at DESC";

    const bookings = db.prepare(query).all(...params);
    return res.json({ bookings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Single booking details with full audit timeline & admin notes
bookingsRouter.get("/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = db.prepare(`
      SELECT 
        b.*,
        s.service_name,
        s.category,
        s.indicative_price,
        s.estimated_duration_minutes,
        s.required_skills,
        s.required_certifications,
        cu.full_name as customer_name,
        cu.phone as customer_phone,
        tu.full_name as technician_name,
        tu.phone as technician_phone,
        tp.average_rating as technician_rating,
        tp.total_completed_jobs as technician_completed_jobs
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      JOIN users cu ON b.customer_id = cu.user_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      WHERE b.booking_id = ?
    `).get(req.params.id) as any;

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Role security check: customer can only view their own
    if (req.user!.role === "CUSTOMER" && booking.customer_id !== req.user!.userId) {
      return res.status(403).json({ error: "Unauthorized access to booking" });
    }

    const history = db.prepare(`
      SELECT h.*, u.full_name as changed_by_name
      FROM booking_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.user_id
      WHERE h.booking_id = ?
      ORDER BY h.timestamp ASC
    `).all(req.params.id);

    const adminNotes = db.prepare(`
      SELECT n.*, u.full_name as admin_name
      FROM booking_admin_notes n
      JOIN users u ON n.admin_user_id = u.user_id
      WHERE n.booking_id = ?
      ORDER BY n.created_at DESC
    `).all(req.params.id);

    const review = db.prepare("SELECT * FROM reviews WHERE booking_id = ?").get(req.params.id);
    const assignmentRecord = db.prepare("SELECT * FROM assignment_records WHERE booking_id = ? ORDER BY assigned_at DESC LIMIT 1").get(req.params.id) as any;

    return res.json({
      booking: {
        ...booking,
        requiredSkills: JSON.parse(booking.required_skills || "[]"),
        requiredCertifications: JSON.parse(booking.required_certifications || "[]"),
      },
      history,
      adminNotes,
      review,
      assignmentRecord: assignmentRecord ? {
        ...assignmentRecord,
        evaluatedCandidates: JSON.parse(assignmentRecord.evaluated_candidates || "[]"),
        rejectedAlternatives: JSON.parse(assignmentRecord.rejected_alternatives || "[]"),
      } : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create new booking (Phase 3 Multi-Step Booking Workflow)
bookingsRouter.post("/", authenticateToken, requireRole("CUSTOMER", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      serviceId,
      problemDescription,
      photoUrl,
      addressLine,
      city,
      state,
      pincode,
      latitude,
      longitude,
      preferredDate,
      preferredStartTime,
      preferredEndTime,
      alternativeWindow,
      requestedPriority,
      preferredTechnicianId,
    } = req.body;

    if (!serviceId || !problemDescription || !preferredDate || !preferredStartTime || !preferredEndTime) {
      return res.status(400).json({ error: "Missing required booking details (service, problem description, or appointment window)" });
    }

    const service = db.prepare("SELECT * FROM services WHERE service_id = ? AND is_active = 1").get(serviceId) as any;
    if (!service) {
      return res.status(400).json({ error: "Selected service is invalid or currently inactive" });
    }

    const bookingId = "BK_" + randomUUID().substring(0, 8);
    const bookingRef = "DG-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;
    const nodeId = findClosestNode(lat, lng);
    const priority = ["NORMAL", "HIGH", "EMERGENCY"].includes(requestedPriority) ? requestedPriority : "NORMAL";

    const customerId = req.user!.role === "CUSTOMER" ? req.user!.userId : req.body.customerId || req.user!.userId;

    const fullAddress = addressLine ? `${addressLine}, ${city || "Bengaluru"}, ${state || "Karnataka"} - ${pincode || "560001"}` : "Bengaluru Central";

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO bookings (
          booking_id, booking_reference, customer_id, service_id,
          requested_priority, verified_priority, booking_status,
          problem_description, photo_url, service_address, latitude, longitude, node_id,
          preferred_date, preferred_start_time, preferred_end_time,
          alternative_window, preferred_technician_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bookingId,
        bookingRef,
        customerId,
        serviceId,
        priority,
        priority === "EMERGENCY" ? "NORMAL" : priority, // Emergency requires dispatcher verification!
        problemDescription,
        photoUrl || null,
        fullAddress,
        lat,
        lng,
        nodeId,
        preferredDate,
        preferredStartTime,
        preferredEndTime,
        alternativeWindow || null,
        preferredTechnicianId || null
      );

      // Audit status history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, NULL, 'REQUESTED', ?, 'Customer created booking')
      `).run(randomUUID(), bookingId, req.user!.userId);

      // Notify Admin
      const notifMsg = priority === "EMERGENCY"
        ? `EMERGENCY ALERT: New emergency requested for ${service.service_name} (${bookingRef}). Triage and verify priority immediately.`
        : `New booking submitted: ${service.service_name} (${bookingRef}) by ${req.user!.fullName}.`;

      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, 'USR_ADMIN_01', 'New Booking Received', ?, ?, ?)
      `).run(randomUUID(), notifMsg, priority === "EMERGENCY" ? "EMERGENCY" : "BOOKING", bookingId);
    });

    insertTx();

    return res.status(201).json({
      message: "Booking submitted successfully",
      bookingId,
      bookingReference: bookingRef,
    });
  } catch (err: any) {
    console.error("Booking creation error:", err);
    return res.status(500).json({ error: err.message || "Failed to create booking" });
  }
});

// Update controlled status lifecycle
const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["UNDER_REVIEW", "ACCEPTED", "CANCELLED", "REJECTED"],
  UNDER_REVIEW: ["ACCEPTED", "CANCELLED", "REJECTED"],
  ACCEPTED: ["SCHEDULED", "CANCELLED", "REJECTED"],
  SCHEDULED: ["TECHNICIAN_ACCEPTED", "ON_THE_WAY", "CANCELLED"],
  TECHNICIAN_ACCEPTED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

bookingsRouter.put("/:id/status", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { status: targetStatus, reason, completionNotes } = req.body;

    const booking = db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const currentStatus = booking.booking_status;

    // Check transition validity
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus) && req.user!.role !== "ADMIN") {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed: [${allowed.join(", ")}]`,
      });
    }

    // Rule: Cannot transition to SCHEDULED without an actual technician!
    if (targetStatus === "SCHEDULED" && !booking.assigned_technician_id && !req.body.technicianId) {
      return res.status(400).json({
        error: "A booking cannot be marked SCHEDULED without an assigned technician.",
      });
    }

    const now = new Date().toISOString();
    let actualStart = booking.actual_start_time;
    let actualEnd = booking.actual_end_time;

    if (targetStatus === "IN_PROGRESS" && !actualStart) {
      actualStart = now;
    }
    if (targetStatus === "COMPLETED") {
      actualEnd = now;
    }

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE bookings
        SET booking_status = ?,
            actual_start_time = COALESCE(?, actual_start_time),
            actual_end_time = COALESCE(?, actual_end_time),
            completion_notes = COALESCE(?, completion_notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(targetStatus, actualStart, actualEnd, completionNotes, bookingId);

      // Audit history
      db.prepare(`
        INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), bookingId, currentStatus, targetStatus, req.user!.userId, reason || `Status updated to ${targetStatus}`);

      // Notifications
      let custNotif = `Your booking ${booking.booking_reference} status is now: ${targetStatus}.`;
      if (targetStatus === "ON_THE_WAY") custNotif = `Technician is on the way to your location for booking ${booking.booking_reference}.`;
      if (targetStatus === "COMPLETED") custNotif = `Service completed for booking ${booking.booking_reference}. Please share your rating and review!`;

      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Booking Update', ?, 'STATUS_UPDATE', ?)
      `).run(randomUUID(), booking.customer_id, custNotif, bookingId);
    });

    updateTx();

    return res.json({ message: `Booking status transitioned to ${targetStatus}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin verify priority (Phase 3.3 & Phase 7.2)
bookingsRouter.put("/:id/priority", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { verifiedPriority, adminNote } = req.body;

    if (!["NORMAL", "HIGH", "EMERGENCY"].includes(verifiedPriority)) {
      return res.status(400).json({ error: "Invalid priority level" });
    }

    const verifyTx = db.transaction(() => {
      db.prepare(`
        UPDATE bookings
        SET verified_priority = ?,
            priority_verified_by = ?,
            booking_status = CASE WHEN booking_status = 'REQUESTED' THEN 'ACCEPTED' ELSE booking_status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ?
      `).run(verifiedPriority, req.user!.userId, bookingId);

      if (adminNote) {
        db.prepare(`
          INSERT INTO booking_admin_notes (note_id, booking_id, admin_user_id, note)
          VALUES (?, ?, ?, ?)
        `).run(randomUUID(), bookingId, req.user!.userId, `Priority verified as ${verifiedPriority}: ${adminNote}`);
      }
    });

    verifyTx();

    return res.json({ message: `Priority verified as ${verifiedPriority}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Customer Rating & Review (Phase 6.6)
bookingsRouter.post("/:id/review", authenticateToken, requireRole("CUSTOMER"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { rating, comment, qualityTags } = req.body;

    const booking = db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.customer_id !== req.user!.userId) return res.status(403).json({ error: "Unauthorized" });
    if (booking.booking_status !== "COMPLETED") return res.status(400).json({ error: "Only completed services can be reviewed" });

    // Check duplicate
    const existing = db.prepare("SELECT review_id FROM reviews WHERE booking_id = ?").get(bookingId);
    if (existing) {
      return res.status(409).json({ error: "Review has already been submitted for this booking" });
    }

    const rNum = parseInt(rating, 10);
    if (isNaN(rNum) || rNum < 1 || rNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 stars" });
    }

    const reviewTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO reviews (review_id, booking_id, customer_id, technician_id, rating, comment, service_quality_tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        bookingId,
        req.user!.userId,
        booking.assigned_technician_id,
        rNum,
        comment || "",
        Array.isArray(qualityTags) ? qualityTags.join(",") : qualityTags || "Punctual,Professional"
      );

      // Recalculate technician average rating
      const avgRow = db.prepare(`
        SELECT AVG(rating) as avgRating, COUNT(*) as count
        FROM reviews
        WHERE technician_id = ?
      `).get(booking.assigned_technician_id) as any;

      if (avgRow && avgRow.avgRating) {
        db.prepare(`
          UPDATE technician_profiles
          SET average_rating = ?,
              total_completed_jobs = total_completed_jobs + 1
          WHERE user_id = ?
        `).run(Number(avgRow.avgRating.toFixed(2)), booking.assigned_technician_id);
      }
    });

    reviewTx();

    return res.status(201).json({ message: "Thank you! Your feedback has been recorded." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin internal notes
bookingsRouter.post("/:id/admin-notes", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: "Note content required" });

    db.prepare(`
      INSERT INTO booking_admin_notes (note_id, booking_id, admin_user_id, note)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), bookingId, req.user!.userId, note);

    return res.status(201).json({ message: "Admin note added" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
