import { Router, Response, Request } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest, verifyToken } from "../services/authService.js";
import { randomUUID } from "crypto";
import { addNotification } from "./notifications.js";
import { dijkstraService } from "../services/dijkstraService.js";

export const customersRouter = Router();

// Profile management
customersRouter.get("/profile", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.prepare(`
      SELECT user_id, full_name, email, phone, role, profile_picture_url, created_at 
      FROM users 
      WHERE user_id = ?
    `).get(req.user!.userId) as any;

    if (!user) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const profile = db.prepare("SELECT * FROM customer_profiles WHERE user_id = ?").get(req.user!.userId) as any;
    const addresses = db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC").all(req.user!.userId);

    const avatarUrl = user.profile_picture_url || profile?.profile_picture_url || null;

    return res.json({
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePictureUrl: avatarUrl,
        createdAt: user.created_at,
      },
      profile,
      addresses,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update profile details with email uniqueness validation
customersRouter.put("/profile", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, email, profilePictureUrl, addressLine, city, state, pincode } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // Email validation & uniqueness
    if (email) {
      const emailTrimmed = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      const duplicate = db.prepare("SELECT user_id FROM users WHERE LOWER(email) = ? AND user_id != ?").get(emailTrimmed, req.user!.userId) as any;
      if (duplicate) {
        return res.status(400).json({ error: "This email address is already registered to another account." });
      }
    }

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET full_name = COALESCE(?, full_name),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            profile_picture_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        fullName.trim(),
        phone.trim(),
        email ? email.trim().toLowerCase() : null,
        profilePictureUrl !== undefined ? profilePictureUrl : null,
        req.user!.userId
      );

      // Ensure customer_profiles record exists and is synced
      const cp = db.prepare("SELECT customer_id FROM customer_profiles WHERE user_id = ?").get(req.user!.userId);
      if (!cp) {
        db.prepare("INSERT INTO customer_profiles (customer_id, user_id, profile_picture_url) VALUES (?, ?, ?)").run(
          "CP_" + randomUUID().substring(0, 8),
          req.user!.userId,
          profilePictureUrl !== undefined ? profilePictureUrl : null
        );
      } else if (profilePictureUrl !== undefined) {
        db.prepare("UPDATE customer_profiles SET profile_picture_url = ? WHERE user_id = ?").run(profilePictureUrl, req.user!.userId);
      }

      // Address update if provided
      if (addressLine !== undefined) {
        const existingAddr = db.prepare("SELECT address_id FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1").get(req.user!.userId) as any;
        if (existingAddr) {
          db.prepare(`
            UPDATE customer_addresses
            SET address_line = ?,
                city = COALESCE(?, city),
                state = COALESCE(?, state),
                pincode = COALESCE(?, pincode)
            WHERE address_id = ?
          `).run(
            addressLine.trim(),
            city ? city.trim() : "Bengaluru",
            state ? state.trim() : "Karnataka",
            pincode ? pincode.trim() : "560001",
            existingAddr.address_id
          );
        } else if (addressLine && addressLine.trim()) {
          db.prepare(`
            INSERT INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
            VALUES (?, ?, 'Primary Residence', ?, ?, ?, ?, 12.9716, 77.5946, 1)
          `).run(
            "ADDR_" + randomUUID().substring(0, 8),
            req.user!.userId,
            addressLine.trim(),
            city ? city.trim() : "Bengaluru",
            state ? state.trim() : "Karnataka",
            pincode ? pincode.trim() : "560001"
          );
        }
      }

      addNotification({
        recipientUserId: req.user!.userId,
        title: "Profile Updated",
        message: "Your customer personal details and preferences were saved successfully.",
        type: "PROFILE_UPDATE",
      });
    });

    updateTx();

    const updatedUser = db.prepare(`
      SELECT user_id, full_name, email, phone, role, profile_picture_url 
      FROM users WHERE user_id = ?
    `).get(req.user!.userId) as any;

    return res.json({
      message: "Customer profile updated successfully",
      user: {
        userId: updatedUser.user_id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        profilePictureUrl: updatedUser.profile_picture_url,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Dedicated Customer Booking History Endpoint
customersRouter.get("/my/bookings", (req: Request, res: Response) => {
  try {
    let authenticatedUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        authenticatedUser = verifyToken(token);
      } catch {}
    }

    // Single Customer System: There is only ONE customer all the time (David Miller, USR_CUST_DEMO)
    // Only synthetic automated test suites with USR_TEST_CUST_ are isolated
    let targetUserId = authenticatedUser?.userId;
    if (!targetUserId || !targetUserId.startsWith("USR_TEST_CUST_")) {
      targetUserId = "USR_CUST_DEMO";
    }

    const user = db.prepare("SELECT phone, email FROM users WHERE user_id = ?").get(targetUserId) as any;
    const phone = user ? user.phone : "+91-98800-00001";

    const { status, search, page = "1", limit = "10", sort = "newest" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Single Customer Mode: Retrieve all bookings for the customer
    let whereClause = targetUserId === "USR_CUST_DEMO"
      ? "WHERE (b.customer_id = 'USR_CUST_DEMO' OR b.customer_id IS NULL OR b.customer_phone = '+91-98800-00001')"
      : "WHERE b.customer_id = ?";

    const params: any[] = targetUserId === "USR_CUST_DEMO" ? [] : [targetUserId];

    // Status filter mapping supporting ALL, ACTIVE, COMPLETED, CANCELLED, REALLOCATED
    if (status && status !== "ALL") {
      const s = (status as string).toUpperCase();
      if (s === "ACTIVE") {
        whereClause += " AND b.booking_status IN ('PENDING', 'OFFERED', 'ASSIGNED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')";
      } else if (s === "COMPLETED") {
        whereClause += " AND b.booking_status = 'COMPLETED'";
      } else if (s === "CANCELLED") {
        whereClause += " AND b.booking_status = 'CANCELLED'";
      } else if (s === "REALLOCATED") {
        whereClause += " AND EXISTS (SELECT 1 FROM job_offers jo_r WHERE jo_r.booking_id = b.booking_id AND jo_r.status IN ('REJECTED', 'EXPIRED'))";
      } else if (s === "PENDING") {
        whereClause += " AND b.booking_status = 'PENDING'";
      } else if (s === "AWAITING_ACCEPTANCE" || s === "AWAITING TECHNICIAN ACCEPTANCE") {
        whereClause += " AND (b.booking_status = 'OFFERED' OR EXISTS (SELECT 1 FROM job_offers jo WHERE jo.booking_id = b.booking_id AND jo.status = 'OFFERED'))";
      } else if (s === "ASSIGNED") {
        whereClause += " AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED')";
      } else if (s === "IN_PROGRESS") {
        whereClause += " AND b.booking_status IN ('IN_PROGRESS', 'ON_THE_WAY')";
      } else if (s === "UNASSIGNED") {
        whereClause += " AND b.booking_status = 'UNASSIGNED'";
      } else {
        whereClause += " AND b.booking_status = ?";
        params.push(s);
      }
    }

    // Search query filter: booking ID / reference, service name, or problem description
    if (search && (search as string).trim()) {
      const q = `%${(search as string).trim()}%`;
      whereClause += " AND (b.booking_reference LIKE ? OR b.booking_id LIKE ? OR s.service_name LIKE ? OR b.problem_description LIKE ?)";
      params.push(q, q, q, q);
    }

    // Sorting order: newest first (default) or oldest first
    const sortDir = (sort as string).toLowerCase() === "oldest" ? "ASC" : "DESC";

    // Count total matches
    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereClause}
    `).get(...params) as { total: number };

    const total = totalCountRow ? totalCountRow.total : 0;

    // Fetch page items with full details
    const bookingsQuery = `
      SELECT 
        b.booking_id as bookingId,
        b.booking_reference as bookingReference,
        b.customer_id as customerId,
        b.customer_name as customerName,
        b.customer_phone as customerPhone,
        b.service_id as serviceId,
        COALESCE(s.service_name, 'General Service') as serviceName,
        COALESCE(s.category, 'General') as category,
        s.indicative_price as indicativePrice,
        s.estimated_duration_minutes as estimatedDurationMinutes,
        b.assigned_technician_id as assignedTechnicianId,
        tu.full_name as assignedTechnicianName,
        tu.phone as assignedTechnicianPhone,
        tu.profile_picture_url as assignedTechnicianAvatar,
        tp.average_rating as assignedTechnicianRating,
        tp.total_completed_jobs as assignedTechnicianCompletedJobs,
        b.requested_priority as requestedPriority,
        b.verified_priority as verifiedPriority,
        b.booking_status as bookingStatus,
        b.problem_description as problemDescription,
        b.notes,
        b.unassigned_reason as unassignedReason,
        b.service_address as serviceAddress,
        b.latitude,
        b.longitude,
        b.node_id as nodeId,
        tp.current_latitude as techLat,
        tp.current_longitude as techLng,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        b.confirmed_start_time as confirmedStartTime,
        b.confirmed_end_time as confirmedEndTime,
        b.actual_start_time as actualStartTime,
        b.actual_end_time as actualEndTime,
        b.estimated_travel_time_minutes as estimatedTravelTimeMinutes,
        b.cancellation_reason as cancellationReason,
        b.completion_notes as completionNotes,
        b.created_at as createdAt,
        r.rating as customerRating,
        r.comment as customerReview,
        (
          SELECT jo.status FROM job_offers jo 
          WHERE jo.booking_id = b.booking_id 
          ORDER BY jo.offered_at DESC LIMIT 1
        ) as offerStatus
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      LEFT JOIN reviews r ON b.booking_id = r.booking_id
      ${whereClause}
      ORDER BY b.created_at ${sortDir}
      LIMIT ? OFFSET ?
    `;

    const bookings = db.prepare(bookingsQuery).all(...params, limitNum, offset) as any[];

    // Fetch status history for each booking in the page
    const historyStmt = db.prepare(`
      SELECT history_id, from_status, to_status, changed_by_user_id, change_reason, timestamp
      FROM booking_status_history
      WHERE booking_id = ?
      ORDER BY timestamp ASC
    `);

    // Fetch complete offer history with technician profiles for each booking
    const offerHistoryStmt = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.technician_id as technicianId,
        u.full_name as technicianName,
        u.phone as technicianPhone,
        u.profile_picture_url as technicianAvatar,
        tp.average_rating as technicianRating,
        tp.total_completed_jobs as technicianCompletedJobs,
        (
          SELECT json_group_array(s.skill_name)
          FROM technician_skills ts
          JOIN skills s ON ts.skill_id = s.skill_id
          WHERE ts.technician_id = u.user_id
        ) as technicianSkills,
        tp.service_categories as technicianCategories,
        tp.current_latitude as techLat,
        tp.current_longitude as techLng,
        jo.status as offerStatus,
        jo.offered_at as offeredAt,
        jo.responded_at as respondedAt,
        jo.distance_km as distanceKm,
        jo.travel_minutes as travelMinutes,
        COALESCE(jo.attempt_number, 1) as attemptNumber
      FROM job_offers jo
      JOIN users u ON jo.technician_id = u.user_id
      LEFT JOIN technician_profiles tp ON jo.technician_id = tp.user_id
      WHERE jo.booking_id = ?
      ORDER BY COALESCE(jo.attempt_number, 1) ASC, jo.rowid ASC
    `);

    const enrichedBookings = bookings.map((b) => {
      const history = historyStmt.all(b.bookingId);
      const rawOffers = offerHistoryStmt.all(b.bookingId) as any[];

      // Reallocation determination
      const hasRejected = rawOffers.some((o) => o.offerStatus === "REJECTED" || o.offerStatus === "EXPIRED");
      const isReallocated = hasRejected;

      // Identify currently allocated / active candidate
      // Priority 1: ACCEPTED offer
      // Priority 2: OFFERED offer
      // Priority 3: assignedTechnician if present
      // Priority 4: Latest offer
      const activeOffer =
        rawOffers.find((o) => o.offerStatus === "ACCEPTED") ||
        rawOffers.find((o) => o.offerStatus === "OFFERED") ||
        (b.assignedTechnicianId ? rawOffers.find((o) => o.technicianId === b.assignedTechnicianId) : null) ||
        (rawOffers.length > 0 ? rawOffers[rawOffers.length - 1] : null);

      const currentTechnicianId = activeOffer ? activeOffer.technicianId : (b.assignedTechnicianId || null);
      const currentTechnicianName = activeOffer ? activeOffer.technicianName : (b.assignedTechnicianName || null);
      const currentTechnicianPhone = activeOffer ? activeOffer.technicianPhone : (b.assignedTechnicianPhone || null);
      const currentTechnicianAvatar = activeOffer ? activeOffer.technicianAvatar : (b.assignedTechnicianAvatar || null);
      const currentTechnicianRating = activeOffer ? activeOffer.technicianRating : (b.assignedTechnicianRating || null);
      const currentTechnicianCompletedJobs = activeOffer ? activeOffer.technicianCompletedJobs : (b.assignedTechnicianCompletedJobs || 0);

      let currentTechnicianSkills: string[] = [];
      try {
        const rawSkills = activeOffer?.technicianSkills;
        if (typeof rawSkills === "string") currentTechnicianSkills = JSON.parse(rawSkills);
        else if (Array.isArray(rawSkills)) currentTechnicianSkills = rawSkills;
      } catch {
        currentTechnicianSkills = [];
      }

      let currentTechnicianCategories: string[] = [];
      try {
        const rawCats = activeOffer?.technicianCategories;
        if (typeof rawCats === "string") currentTechnicianCategories = JSON.parse(rawCats);
        else if (Array.isArray(rawCats)) currentTechnicianCategories = rawCats;
      } catch {
        currentTechnicianCategories = [b.category];
      }

      const currentOfferStatus = activeOffer ? activeOffer.offerStatus : (b.bookingStatus === "OFFERED" ? "OFFERED" : null);
      const isConfirmedAccepted =
        currentOfferStatus === "ACCEPTED" ||
        ["ASSIGNED", "SCHEDULED", "TECHNICIAN_ACCEPTED", "IN_PROGRESS", "ON_THE_WAY", "COMPLETED"].includes(b.bookingStatus);
      const acceptanceStatus = isConfirmedAccepted
        ? "ACCEPTED"
        : currentOfferStatus === "OFFERED"
        ? "AWAITING_ACCEPTANCE"
        : (b.bookingStatus || "PENDING");

      // Required user-facing status messages for reallocation
      let reallocationMessage: string | null = null;
      if (isReallocated) {
        if (isConfirmedAccepted) {
          reallocationMessage = `Your service has been successfully reallocated to ${currentTechnicianName || "the assigned technician"}.`;
        } else {
          reallocationMessage = "Your service has been reallocated. New technician contacted – Awaiting acceptance.";
        }
      }

      // Sanitize reallocation offer history for customer portal (NO private comments exposed!)
      const offerHistory = rawOffers.map((o, idx) => {
        const isCurrentAllocated =
          (activeOffer && o.offerId === activeOffer.offerId) ||
          (!rawOffers.some((x) => x.offerStatus === "ACCEPTED") && idx === rawOffers.length - 1);
        let techSkills: string[] = [];
        try {
          if (typeof o.technicianSkills === "string") techSkills = JSON.parse(o.technicianSkills);
          else if (Array.isArray(o.technicianSkills)) techSkills = o.technicianSkills;
        } catch {}
        return {
          offerId: o.offerId,
          technicianId: o.technicianId,
          technicianName: o.technicianName,
          technicianAvatar: o.technicianAvatar,
          technicianRating: o.technicianRating,
          technicianSkills: techSkills,
          offerStatus: o.offerStatus,
          offeredAt: o.offeredAt,
          respondedAt: o.respondedAt,
          distanceKm: o.distanceKm,
          travelMinutes: o.travelMinutes,
          attemptNumber: o.attemptNumber,
          isCurrentAllocated,
          isPrevious: !isCurrentAllocated,
        };
      });

      // Calculate Dijkstra distance & travel time using current technician location
      let distanceKm = 0;
      let travelMinutes = b.estimatedTravelTimeMinutes || 15;
      let estimatedArrivalTime: string | null = null;

      const techLat = activeOffer?.techLat || b.techLat;
      const techLng = activeOffer?.techLng || b.techLng;

      if (techLat && techLng && b.latitude && b.longitude) {
        try {
          const dijkstraResult = dijkstraService.calculateTravelBetweenCoords(
            techLat,
            techLng,
            b.latitude,
            b.longitude
          );
          distanceKm = dijkstraResult.distanceKm;
          travelMinutes = dijkstraResult.travelMinutes;
          const etaDate = new Date(Date.now() + travelMinutes * 60 * 1000);
          estimatedArrivalTime = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
          // fallback to defaults
        }
      }

      // Visual Status Indicator determination
      let statusIndicator = "PENDING";
      let statusColor = "orange";
      let statusLabel = "Pending";

      if (b.bookingStatus === "CANCELLED") {
        statusIndicator = "CANCELLED";
        statusColor = "grey";
        statusLabel = "Cancelled";
      } else if (b.bookingStatus === "COMPLETED") {
        statusIndicator = "COMPLETED";
        statusColor = "green";
        statusLabel = "Completed";
      } else if (b.bookingStatus === "IN_PROGRESS" || b.bookingStatus === "ON_THE_WAY") {
        statusIndicator = "IN_PROGRESS";
        statusColor = "cyan";
        statusLabel = "In Progress";
      } else if (b.bookingStatus === "UNASSIGNED") {
        statusIndicator = "UNASSIGNED";
        statusColor = "red";
        statusLabel = "Unassigned";
      } else if (isConfirmedAccepted) {
        statusIndicator = "ASSIGNED";
        statusColor = "blue";
        statusLabel = "Assigned";
      } else if (isReallocated) {
        statusIndicator = "REALLOCATING";
        statusColor = "purple";
        statusLabel = "Reallocation in Progress";
      } else if (currentOfferStatus === "OFFERED" || b.bookingStatus === "OFFERED") {
        statusIndicator = "AWAITING_ACCEPTANCE";
        statusColor = "yellow";
        statusLabel = "Awaiting Technician Acceptance";
      } else {
        statusIndicator = "PENDING";
        statusColor = "orange";
        statusLabel = "Pending";
      }

      return {
        ...b,
        history,
        offerHistory,
        reallocationHistory: offerHistory,
        isReallocated,
        reallocationMessage,
        currentTechnicianId,
        currentTechnicianName,
        currentTechnicianPhone,
        currentTechnicianAvatar,
        currentTechnicianRating,
        currentTechnicianCompletedJobs,
        currentTechnicianSkills,
        currentTechnicianCategories,
        currentOfferStatus,
        acceptanceStatus,
        distanceKm,
        travelMinutes,
        estimatedArrivalTime,
        statusIndicator,
        statusColor,
        statusLabel,
        completionDate: b.actualEndTime || b.confirmedEndTime || (b.bookingStatus === "COMPLETED" ? b.createdAt : null),
      };
    });

    return res.json({
      bookings: enrichedBookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Addresses
customersRouter.get("/addresses", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const addresses = db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC").all(req.user!.userId);
    return res.json({ addresses });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

customersRouter.post("/addresses", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { label, addressLine, city, state, pincode, latitude, longitude, isDefault } = req.body;
    if (!addressLine || !city) {
      return res.status(400).json({ error: "Address line and city are mandatory" });
    }

    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;
    const addressId = "ADDR_" + randomUUID().substring(0, 8);

    if (isDefault) {
      db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(req.user!.userId);
    }

    db.prepare(`
      INSERT INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      addressId,
      req.user!.userId,
      label || "Home",
      addressLine,
      city || "Bengaluru",
      state || "Karnataka",
      pincode || "560001",
      lat,
      lng,
      isDefault ? 1 : 0
    );

    return res.status(201).json({ message: "Address added successfully", addressId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

customersRouter.delete("/addresses/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.prepare("DELETE FROM customer_addresses WHERE address_id = ? AND customer_id = ?").run(req.params.id, req.user!.userId);
    return res.json({ message: "Address deleted" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
