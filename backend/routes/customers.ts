import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
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
customersRouter.get("/my/bookings", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = db.prepare("SELECT phone, email FROM users WHERE user_id = ?").get(userId) as any;
    const phone = user ? user.phone : "";

    const { status, search, page = "1", limit = "10" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE (b.customer_id = ? OR (b.customer_phone IS NOT NULL AND b.customer_phone = ?))";
    const params: any[] = [userId, phone];

    // Status filter mapping
    if (status && status !== "ALL") {
      const s = (status as string).toUpperCase();
      if (s === "PENDING") {
        whereClause += " AND b.booking_status = 'PENDING'";
      } else if (s === "AWAITING_ACCEPTANCE" || s === "AWAITING TECHNICIAN ACCEPTANCE") {
        whereClause += " AND (b.booking_status = 'OFFERED' OR EXISTS (SELECT 1 FROM job_offers jo WHERE jo.booking_id = b.booking_id AND jo.status = 'OFFERED'))";
      } else if (s === "ASSIGNED") {
        whereClause += " AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED')";
      } else if (s === "IN_PROGRESS") {
        whereClause += " AND b.booking_status IN ('IN_PROGRESS', 'ON_THE_WAY')";
      } else if (s === "COMPLETED") {
        whereClause += " AND b.booking_status = 'COMPLETED'";
      } else if (s === "CANCELLED") {
        whereClause += " AND b.booking_status = 'CANCELLED'";
      } else if (s === "UNASSIGNED") {
        whereClause += " AND b.booking_status = 'UNASSIGNED'";
      } else {
        whereClause += " AND b.booking_status = ?";
        params.push(s);
      }
    }

    // Search query filter
    if (search && (search as string).trim()) {
      const q = `%${(search as string).trim()}%`;
      whereClause += " AND (b.booking_reference LIKE ? OR b.booking_id LIKE ? OR s.service_name LIKE ? OR b.problem_description LIKE ?)";
      params.push(q, q, q, q);
    }

    // Count total matches
    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
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
        s.service_name as serviceName,
        s.category as category,
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
      JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users tu ON b.assigned_technician_id = tu.user_id
      LEFT JOIN technician_profiles tp ON b.assigned_technician_id = tp.user_id
      LEFT JOIN reviews r ON b.booking_id = r.booking_id
      ${whereClause}
      ORDER BY b.created_at DESC
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

    // Fetch complete offer history for each booking in the page
    const offerHistoryStmt = db.prepare(`
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
      const history = historyStmt.all(b.bookingId);
      const offerHistory = offerHistoryStmt.all(b.bookingId) as any[];

      // Calculate Dijkstra distance & travel time if technician assigned and coordinates available
      let distanceKm = 0;
      let travelMinutes = b.estimatedTravelTimeMinutes || 15;
      let estimatedArrivalTime: string | null = null;

      if (b.techLat && b.techLng && b.latitude && b.longitude) {
        try {
          const dijkstraResult = dijkstraService.calculateTravelBetweenCoords(
            b.techLat,
            b.techLng,
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

      // Visual Status Indicator determination (as defined in PART 1):
      // - Pending – Orange
      // - Awaiting Technician Acceptance – Yellow
      // - Reallocation in Progress – Purple
      // - Assigned – Blue
      // - In Progress – Cyan
      // - Completed – Green
      // - Cancelled – Grey
      // - Unassigned – Red
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
      } else if (["ASSIGNED", "SCHEDULED", "TECHNICIAN_ACCEPTED"].includes(b.bookingStatus)) {
        statusIndicator = "ASSIGNED";
        statusColor = "blue";
        statusLabel = "Assigned";
      } else {
        // PENDING or OFFERED
        const hasRejected = offerHistory.some((o) => o.offerStatus === "REJECTED" || o.offerStatus === "EXPIRED");
        const hasActiveOffer = offerHistory.some((o) => o.offerStatus === "OFFERED");
        if (hasRejected && hasActiveOffer) {
          statusIndicator = "REALLOCATING";
          statusColor = "purple";
          statusLabel = "Reallocation in Progress";
        } else if (hasActiveOffer || b.bookingStatus === "OFFERED" || b.offerStatus === "OFFERED") {
          statusIndicator = "AWAITING_ACCEPTANCE";
          statusColor = "yellow";
          statusLabel = "Awaiting Technician Acceptance";
        } else {
          statusIndicator = "PENDING";
          statusColor = "orange";
          statusLabel = "Pending";
        }
      }

      return {
        ...b,
        history,
        offerHistory,
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
