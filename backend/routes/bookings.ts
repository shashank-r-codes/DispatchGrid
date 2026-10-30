import { Router, Response, Request } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest, verifyToken } from "../services/authService.js";
import { findClosestNode, METRO_NODES } from "../config/roadNetwork.js";
import { AssignmentEngine } from "../services/assignmentEngine.js";
import { dijkstraService } from "../services/dijkstraService.js";
import { SchedulingJob } from "../services/priorityQueue.js";
import { randomUUID } from "crypto";

export const bookingsRouter = Router();

// Public Customer Tracking Endpoint (Protected by Booking Reference + Phone Number match)
bookingsRouter.get("/track", (req: Request, res: Response) => {
  try {
    const reference = (req.query.reference as string || req.query.bookingId as string || "").trim();
    const phone = (req.query.phone as string || "").trim();

    if (!reference || !phone) {
      return res.status(400).json({ error: "Booking reference / ID and registered phone number are required." });
    }

    const booking = db.prepare(`
      SELECT 
        b.booking_id as bookingId,
        b.booking_reference as bookingReference,
        b.customer_name as customerName,
        b.customer_phone as customerPhone,
        b.service_address as serviceAddress,
        b.latitude as customerLat,
        b.longitude as customerLng,
        b.node_id as nodeId,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        b.booking_status as bookingStatus,
        b.requested_priority as requestedPriority,
        b.verified_priority as verifiedPriority,
        b.problem_description as problemDescription,
        b.notes,
        b.unassigned_reason as unassignedReason,
        b.confirmed_start_time as confirmedStartTime,
        b.confirmed_end_time as confirmedEndTime,
        b.estimated_travel_time_minutes as estimatedTravelTimeMinutes,
        b.created_at as createdAt,
        s.service_name as serviceName,
        s.category,
        s.indicative_price as indicativePrice,
        s.estimated_duration_minutes as estimatedDurationMinutes,
        tu.user_id as technicianId,
        tu.full_name as technicianName,
        tu.phone as technicianPhone,
        tp.average_rating as technicianRating,
        tp.total_completed_jobs as technicianCompletedJobs,
        tp.current_latitude as techLat,
        tp.current_longitude as techLng,
        jo.status as offerStatus,
        jo.offered_at as offerTime,
        jo.rejection_reason as rejectionReason
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      LEFT JOIN job_offers jo ON b.booking_id = jo.booking_id AND jo.status IN ('OFFERED', 'ACCEPTED')
      WHERE (b.booking_reference = ? OR b.booking_id = ?)
    `).get(reference, reference) as any;

    if (!booking) {
      return res.status(404).json({ error: `Booking reference "${reference}" was not found.` });
    }

    // Security check: phone number must match customer_phone (strip non-digits for comparison)
    const normalizePhone = (p: string) => (p || "").replace(/\D/g, "");
    const cleanPhone = normalizePhone(phone);
    const storedPhone = normalizePhone(booking.customerPhone);

    if (cleanPhone.length < 4 || !storedPhone.endsWith(cleanPhone)) {
      return res.status(403).json({ error: "Access denied. The provided phone number does not match this booking record." });
    }

    // Calculate Dijkstra path if technician is assigned
    let routeData: any = null;
    let distanceKm = 0;
    let travelMinutes = booking.estimatedTravelTimeMinutes || 15;
    let estimatedArrivalTime: string | null = null;

    if (booking.techLat && booking.techLng && booking.customerLat && booking.customerLng) {
      const dijkstraResult = dijkstraService.calculateTravelBetweenCoords(
        booking.techLat,
        booking.techLng,
        booking.customerLat,
        booking.customerLng
      );
      routeData = {
        path: dijkstraResult.path,
        pathNodes: dijkstraResult.pathNodes,
        steps: dijkstraResult.steps,
      };
      distanceKm = dijkstraResult.distanceKm;
      travelMinutes = dijkstraResult.travelMinutes;

      // Compute estimated arrival ISO timestamp
      const etaDate = new Date(Date.now() + travelMinutes * 60 * 1000);
      estimatedArrivalTime = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Fetch complete offer history for this booking (Section 5 Requirement)
    const offerHistory = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.technician_id as technicianId,
        u.full_name as technicianName,
        jo.status as offerStatus,
        jo.rejection_reason as rejectionReason,
        jo.offered_at as offeredAt,
        jo.responded_at as respondedAt,
        jo.distance_km as distanceKm,
        jo.travel_minutes as travelMinutes,
        COALESCE(jo.attempt_number, 1) as attemptNumber
      FROM job_offers jo
      JOIN users u ON jo.technician_id = u.user_id
      WHERE jo.booking_id = ?
      ORDER BY COALESCE(jo.attempt_number, 1) ASC, jo.rowid ASC
    `).all(booking.bookingId) as any[];

    const activeOffer = offerHistory.find((o) => o.offerStatus === "OFFERED") || 
                        offerHistory.find((o) => o.offerStatus === "ACCEPTED") || 
                        offerHistory[offerHistory.length - 1] || null;

    const latestNotif = db.prepare(`
      SELECT title, message, created_at, type
      FROM notifications
      WHERE reference_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(booking.bookingId) as any;

    return res.json({
      booking: {
        ...booking,
        offerHistory,
        techniciansContactedCount: offerHistory.length,
        currentTechnicianName: activeOffer ? activeOffer.technicianName : (booking.technicianName || null),
        currentOfferStatus: activeOffer ? activeOffer.offerStatus : (booking.bookingStatus === "OFFERED" ? "OFFERED" : null),
        latestNotification: latestNotif || null,
        distanceKm,
        travelMinutes,
        estimatedArrivalTime,
        isSimulatedTracking: true, // Clearly documented: simulated GPS tracking along road network
        lastLocationUpdate: new Date().toISOString(),
        route: routeData,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// List bookings with role-based filtering
bookingsRouter.get("/", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, category, priority, date } = req.query;
    let query = `
      SELECT 
        b.booking_id as bookingId,
        b.booking_reference as bookingReference,
        b.customer_id as customerId,
        COALESCE(b.customer_name, cu.full_name, 'Guest Customer') as customerName,
        COALESCE(b.customer_phone, cu.phone, 'N/A') as customerPhone,
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
        b.notes,
        b.unassigned_reason as unassignedReason,
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
      LEFT JOIN users cu ON b.customer_id = cu.user_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      LEFT JOIN users pref_u ON b.preferred_technician_id = pref_u.user_id
      LEFT JOIN reviews r ON b.booking_id = r.booking_id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Role restrictions
    if (req.user!.role === "CUSTOMER") {
      const custUser = db.prepare("SELECT phone FROM users WHERE user_id = ?").get(req.user!.userId) as { phone: string } | undefined;
      query += " AND (b.customer_id = ? OR (b.customer_phone IS NOT NULL AND b.customer_phone = ?))";
      params.push(req.user!.userId, custUser?.phone || "");
    } else if (req.user!.role === "TECHNICIAN") {
      query += ` AND (b.assigned_technician_id = ? OR (b.booking_id IN (SELECT booking_id FROM job_offers WHERE technician_id = ? AND status = 'OFFERED')))` +
               ` AND NOT EXISTS (SELECT 1 FROM job_offers jo_r WHERE jo_r.booking_id = b.booking_id AND jo_r.technician_id = ? AND jo_r.status = 'REJECTED')`;
      params.push(req.user!.userId, req.user!.userId, req.user!.userId);
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

    const bookings = db.prepare(query).all(...params) as any[];

    // Attach offers and reallocation info for each booking (Section 7 Admin Dashboard Requirement)
    const offerStmt = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.technician_id as technicianId,
        u.full_name as technicianName,
        jo.status as offerStatus,
        jo.rejection_reason as rejectionReason,
        jo.offered_at as offeredAt,
        jo.responded_at as respondedAt,
        jo.distance_km as distanceKm,
        jo.travel_minutes as travelMinutes,
        COALESCE(jo.attempt_number, 1) as attemptNumber
      FROM job_offers jo
      JOIN users u ON jo.technician_id = u.user_id
      WHERE jo.booking_id = ?
      ORDER BY COALESCE(jo.attempt_number, 1) ASC, jo.rowid ASC
    `);

    const enrichedBookings = bookings.map((b) => {
      const offers = offerStmt.all(b.bookingId) as any[];
      const rejectedOffers = offers.filter((o) => o.offerStatus === "REJECTED");
      const activeOff = offers.find((o) => o.offerStatus === "OFFERED");
      return {
        ...b,
        offers,
        offerCount: offers.length,
        rejectedOfferCount: rejectedOffers.length,
        currentContactedTechnician: activeOff ? activeOff.technicianName : (b.assignedTechnicianName || null),
        currentOfferStatus: activeOff ? "OFFERED" : (b.bookingStatus === "OFFERED" ? "OFFERED" : null),
      };
    });

    return res.json({ bookings: enrichedBookings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Single booking details with full audit timeline & admin notes
bookingsRouter.get("/:id", (req: Request, res: Response) => {
  try {
    // Optional auth verification
    let tokenUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      tokenUser = verifyToken(token);
    }

    const booking = db.prepare(`
      SELECT 
        b.*,
        s.service_name,
        s.category,
        s.indicative_price,
        s.estimated_duration_minutes,
        s.required_skills,
        s.required_certifications,
        COALESCE(b.customer_name, cu.full_name, 'Guest Customer') as customer_name,
        COALESCE(b.customer_phone, cu.phone, 'N/A') as customer_phone,
        tu.full_name as technician_name,
        tu.phone as technician_phone,
        tp.average_rating as technician_rating,
        tp.total_completed_jobs as technician_completed_jobs
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users cu ON b.customer_id = cu.user_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      WHERE b.booking_id = ?
    `).get(req.params.id) as any;

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Role security check if authenticated
    if (tokenUser && tokenUser.role === "CUSTOMER" && booking.customer_id && booking.customer_id !== tokenUser.userId) {
      return res.status(403).json({ error: "Unauthorized access to booking" });
    }

    const history = db.prepare(`
      SELECT h.*, u.full_name as changed_by_name
      FROM booking_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.user_id
      WHERE h.booking_id = ?
      ORDER BY h.timestamp ASC
    `).all(req.params.id);

    const offers = db.prepare(`
      SELECT jo.*, u.full_name as technician_name, u.phone as technician_phone
      FROM job_offers jo
      JOIN users u ON jo.technician_id = u.user_id
      WHERE jo.booking_id = ?
      ORDER BY jo.offered_at DESC
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
      offers,
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

// Create new booking (Open to Customers WITHOUT Login requirement - Part 1.B & Part 3)
bookingsRouter.post("/", (req: Request, res: Response) => {
  try {
    // Check if user is authenticated (optional)
    let authenticatedUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      authenticatedUser = verifyToken(token);
    }

    const {
      serviceId,
      customerName,
      customerPhone,
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
      notes,
    } = req.body;

    if (!serviceId || !problemDescription || !preferredDate || !preferredStartTime || !preferredEndTime) {
      return res.status(400).json({ error: "Missing required booking details (service, problem description, or appointment window)" });
    }

    const effectiveName = customerName || authenticatedUser?.fullName || "Valued Customer";
    const effectivePhone = customerPhone || "+91-98800-00000";

    const service = db.prepare("SELECT * FROM services WHERE service_id = ? AND is_active = 1").get(serviceId) as any;
    if (!service) {
      return res.status(400).json({ error: "Selected service is invalid or currently inactive" });
    }

    const bookingId = "BK_" + randomUUID().substring(0, 8);
    const bookingRef = "DG-2026-" + Math.floor(1000 + Math.random() * 9000);
    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;
    const nodeId = findClosestNode(lat, lng);
    const priority = ["NORMAL", "HIGH", "EMERGENCY"].includes(requestedPriority) ? requestedPriority : "NORMAL";

    const customerId = authenticatedUser ? authenticatedUser.userId : null;
    const fullAddress = addressLine ? `${addressLine}, ${city || "Bengaluru"}, ${state || "Karnataka"} - ${pincode || "560001"}` : "Bengaluru Central";

    // 1. Save Booking in Database in PENDING status
    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO bookings (
          booking_id, booking_reference, customer_id, customer_name, customer_phone, notes,
          service_id, requested_priority, verified_priority, booking_status,
          problem_description, photo_url, service_address, latitude, longitude, node_id,
          preferred_date, preferred_start_time, preferred_end_time,
          alternative_window, preferred_technician_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bookingId,
        bookingRef,
        customerId,
        effectiveName,
        effectivePhone,
        notes || null,
        serviceId,
        priority,
        priority === "EMERGENCY" ? "NORMAL" : priority, // Emergency subject to verification
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
        VALUES (?, ?, NULL, 'PENDING', ?, 'Customer submitted booking request')
      `).run(randomUUID(), bookingId, customerId || "GUEST_CUSTOMER");
    });

    insertTx();

    // 2. AUTOMATIC SCHEDULING ENGINE TRIGGER (Part 3 Core Requirement)
    // Runs automatically upon booking creation! No admin button needed!
    const schedulingJob: SchedulingJob = {
      bookingId,
      bookingReference: bookingRef,
      customerId: customerId || "",
      serviceId,
      category: service.category,
      requiredSkills: JSON.parse(service.required_skills || "[]"),
      requiredCertifications: JSON.parse(service.required_certifications || "[]"),
      nodeId,
      latitude: lat,
      longitude: lng,
      serviceAddress: fullAddress,
      requestedPriority: priority,
      verifiedPriority: priority === "EMERGENCY" ? "NORMAL" : priority,
      preferredDate,
      preferredStartTime,
      preferredEndTime,
      preferredTechnicianId,
      estimatedDurationMinutes: service.estimated_duration_minutes || 60,
      createdAt: new Date().toISOString(),
    };

    const allocationResult = AssignmentEngine.offerJobToBestCandidate(schedulingJob);

    return res.status(201).json({
      message: allocationResult.success
        ? `Booking confirmed! Offer dispatched automatically to ${allocationResult.assignedTechnicianName}.`
        : `Booking recorded. Notice: ${allocationResult.selectionReason}`,
      bookingId,
      bookingReference: bookingRef,
      status: allocationResult.success ? "OFFERED" : "UNASSIGNED",
      allocation: allocationResult,
    });
  } catch (err: any) {
    console.error("Booking creation error:", err);
    return res.status(500).json({ error: err.message || "Failed to create booking" });
  }
});

// Update controlled status lifecycle
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["OFFERED", "ASSIGNED", "CANCELLED", "UNASSIGNED", "REJECTED"],
  OFFERED: ["ASSIGNED", "PENDING", "UNASSIGNED", "CANCELLED"],
  ASSIGNED: ["ON_THE_WAY", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["TECHNICIAN_ACCEPTED", "ON_THE_WAY", "CANCELLED"],
  TECHNICIAN_ACCEPTED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  REQUESTED: ["UNDER_REVIEW", "ACCEPTED", "CANCELLED", "REJECTED"],
  UNDER_REVIEW: ["ACCEPTED", "CANCELLED", "REJECTED"],
  ACCEPTED: ["SCHEDULED", "ASSIGNED", "CANCELLED", "REJECTED"],
  COMPLETED: [],
  CANCELLED: [],
  UNASSIGNED: ["PENDING", "OFFERED", "ASSIGNED", "CANCELLED"],
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

    // Transition checks
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus) && req.user!.role !== "ADMIN") {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed: [${allowed.join(", ")}]`,
      });
    }

    // Role check: Technician can only update their own assigned jobs
    if (req.user!.role === "TECHNICIAN" && booking.assigned_technician_id !== req.user!.userId) {
      return res.status(403).json({ error: "You are not assigned to this booking." });
    }

    // Rule: Cannot complete without starting (Part 9 constraint)
    if (targetStatus === "COMPLETED" && currentStatus !== "IN_PROGRESS" && req.user!.role !== "ADMIN") {
      return res.status(400).json({ error: "Technician cannot complete a job that has not been started (must be IN_PROGRESS first)." });
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
      if (booking.customer_id) {
        let custNotif = `Your booking ${booking.booking_reference} status is now: ${targetStatus}.`;
        if (targetStatus === "ON_THE_WAY") custNotif = `Technician is on the way to your location for booking ${booking.booking_reference}.`;
        if (targetStatus === "IN_PROGRESS") custNotif = `Technician has arrived and work is now IN PROGRESS for booking ${booking.booking_reference}.`;
        if (targetStatus === "COMPLETED") custNotif = `Service completed for booking ${booking.booking_reference}. Thank you for using DispatchGrid!`;

        db.prepare(`
          INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
          VALUES (?, ?, 'Booking Update', ?, 'STATUS_UPDATE', ?)
        `).run(randomUUID(), booking.customer_id, custNotif, bookingId);
      }
    });

    updateTx();

    return res.json({ message: `Booking status transitioned to ${targetStatus}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin verify priority
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

// Review submission
bookingsRouter.post("/:id/review", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { rating, comment, qualityTags } = req.body;

    const booking = db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.booking_status !== "COMPLETED") return res.status(400).json({ error: "Only completed services can be reviewed" });

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
        SELECT AVG(rating) as avgRating
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
