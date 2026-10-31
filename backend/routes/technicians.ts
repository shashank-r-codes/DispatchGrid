import { Router, Response, Request } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { RecoveryEngine } from "../services/recoveryEngine.js";
import { AssignmentEngine } from "../services/assignmentEngine.js";
import { dijkstraService } from "../services/dijkstraService.js";
import { addNotification } from "./notifications.js";
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
        u.profile_picture_url as profilePictureUrl,
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
        SELECT c.certification_id as certId, c.certification_name as certName, c.category, c.issuing_authority as issuingAuthority, tc.certificate_number as certNumber, tc.expiry_date as expiryDate
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

// GET /api/technicians/my/profile - Authenticated technician full profile
techniciansRouter.get("/my/profile", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techUserId = req.user!.userId;
    const user = db.prepare(`
      SELECT user_id as userId, username, full_name as fullName, email, phone, role, account_status as accountStatus, profile_picture_url as profilePictureUrl, created_at as createdAt
      FROM users WHERE user_id = ?
    `).get(techUserId) as any;

    if (!user) {
      return res.status(404).json({ error: "Technician user not found" });
    }

    const tp = db.prepare(`
      SELECT * FROM technician_profiles WHERE user_id = ?
    `).get(techUserId) as any;

    const skills = db.prepare(`
      SELECT s.skill_id as skillId, s.skill_name as skillName, s.category, ts.years_experience as yearsExperience
      FROM technician_skills ts
      JOIN skills s ON ts.skill_id = s.skill_id
      WHERE ts.technician_id = ?
    `).all(techUserId);

    const certifications = db.prepare(`
      SELECT c.certification_id as certId, c.certification_name as certName, c.category, c.issuing_authority as issuingAuthority, tc.certificate_number as certNumber, tc.expiry_date as expiryDate
      FROM technician_certifications tc
      JOIN certifications c ON tc.certification_id = c.certification_id
      WHERE tc.technician_id = ?
    `).all(techUserId);

    let serviceAreasList = [];
    try {
      serviceAreasList = JSON.parse(tp?.service_areas || "[]");
    } catch {
      serviceAreasList = tp?.service_areas ? tp.service_areas.split(",") : [];
    }

    const avatar = user.profilePictureUrl || tp?.profile_picture_url || null;

    return res.json({
      technician: {
        ...user,
        profilePictureUrl: avatar,
        experienceYears: tp?.experience_years || 1,
        serviceCategories: tp?.service_categories ? tp.service_categories.split(",") : [],
        verificationStatus: tp?.verification_status || "PENDING",
        verificationNotes: tp?.verification_notes || "",
        verifiedAt: tp?.verified_at || null,
        residentialAddress: tp?.residential_address || "",
        city: tp?.city || "Bengaluru",
        pincode: tp?.pincode || "560001",
        currentLatitude: tp?.current_latitude || 12.9716,
        currentLongitude: tp?.current_longitude || 77.5946,
        serviceAreas: serviceAreasList,
        availabilityStatus: tp?.availability_status || "AVAILABLE",
        workingDays: tp?.working_days ? tp.working_days.split(",") : [],
        shiftStartTime: tp?.shift_start_time || "08:00",
        shiftEndTime: tp?.shift_end_time || "18:00",
        reservedEmergencyCapacity: tp?.reserved_emergency_capacity || "11:00-11:30",
        totalCompletedJobs: tp?.total_completed_jobs || 0,
        averageRating: tp?.average_rating || 5.0,
        skills,
        certifications,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/technicians/my/profile - Update technician profile with restrictions
techniciansRouter.put("/my/profile", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techUserId = req.user!.userId;
    const {
      fullName,
      phone,
      email,
      residentialAddress,
      city,
      pincode,
      serviceAreas,
      shiftStartTime,
      shiftEndTime,
      workingDays,
      profilePictureUrl,
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // Email validation and duplicate checking
    if (email) {
      const emailTrimmed = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      const duplicate = db.prepare("SELECT user_id FROM users WHERE LOWER(email) = ? AND user_id != ?").get(emailTrimmed, techUserId) as any;
      if (duplicate) {
        return res.status(400).json({ error: "This email address is already registered to another account." });
      }
    }

    const workingDaysStr = Array.isArray(workingDays) ? workingDays.join(",") : workingDays;
    const serviceAreasStr = Array.isArray(serviceAreas) ? JSON.stringify(serviceAreas) : (serviceAreas ? JSON.stringify(String(serviceAreas).split(",")) : undefined);

    const updateTx = db.transaction(() => {
      // 1. Update users table (name, phone, email, profile photo)
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
        techUserId
      );

      // 2. Update technician_profiles (address, service zones, working hours, profile photo)
      // Note: verification_status, verified_at, average_rating, and total_completed_jobs are intentionally excluded
      // and CANNOT be altered by the technician.
      db.prepare(`
        UPDATE technician_profiles
        SET residential_address = COALESCE(?, residential_address),
            city = COALESCE(?, city),
            pincode = COALESCE(?, pincode),
            service_areas = COALESCE(?, service_areas),
            shift_start_time = COALESCE(?, shift_start_time),
            shift_end_time = COALESCE(?, shift_end_time),
            working_days = COALESCE(?, working_days),
            profile_picture_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        residentialAddress || null,
        city || null,
        pincode || null,
        serviceAreasStr || null,
        shiftStartTime || null,
        shiftEndTime || null,
        workingDaysStr || null,
        profilePictureUrl !== undefined ? profilePictureUrl : null,
        techUserId
      );

      addNotification({
        recipientUserId: techUserId,
        title: "Technician Profile Saved",
        message: "Your profile details and shift preferences were updated successfully.",
        type: "PROFILE_UPDATE",
      });
    });

    updateTx();

    return res.json({
      message: "Technician profile updated successfully",
      profilePictureUrl: profilePictureUrl || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// View technician's own pending job offers (with 2-Minute Decision Timer)
techniciansRouter.get("/my/offers", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techId = req.user!.userId;

    // Run sweep: If any offer exceeded 2 minutes (120s), automatically reassign to next nearest candidate
    AssignmentEngine.checkAndExpireTimedOutOffers(120);

    const offers = db.prepare(`
      SELECT 
        jo.offer_id as offerId,
        jo.booking_id as bookingId,
        jo.status as offerStatus,
        jo.offered_at as offeredAt,
        jo.travel_minutes as travelMinutes,
        jo.distance_km as distanceKm,
        b.booking_reference as bookingReference,
        b.customer_name as customerName,
        b.customer_phone as customerPhone,
        b.is_demo_tracking as isDemoTracking,
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

    // Enrich each offer with 2-minute decision timer metadata (120 seconds) with timezone safety
    const enrichedOffers = offers.map((o) => {
      let s = String(o.offeredAt || "").trim();
      if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T") + "Z";
      else if (s && !s.endsWith("Z") && !s.includes("+") && !s.includes("-", 10)) s += "Z";
      const offeredTime = s ? new Date(s).getTime() : Date.now();
      const expiresAt = new Date(offeredTime + 120 * 1000).toISOString();
      const remainingSeconds = Math.max(0, Math.floor((offeredTime + 120 * 1000 - Date.now()) / 1000));
      return {
        ...o,
        offeredAt: new Date(offeredTime).toISOString(),
        timeoutSeconds: 120,
        expiresAt,
        remainingSeconds,
      };
    });

    return res.json({ offers: enrichedOffers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Accept a job offer
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

// Reject a job offer with reason -> automatically triggers re-offer to next eligible tech
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

// Expire a job offer (timeout) -> automatically triggers re-offer to next eligible tech
techniciansRouter.post("/offers/:offerId/expire", (req: Request, res: Response) => {
  try {
    const offerId = req.params.offerId;
    const result = AssignmentEngine.expireJobOffer(offerId);
    return res.json({
      message: "Offer expired. Automatic reallocation dispatched to next candidate.",
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/technicians/my/schedule
 * Comprehensive Technician Individual Schedule Endpoint
 * Supports: view ('daily', 'weekly', 'list'), date (YYYY-MM-DD), filter ('today', 'this_week', 'upcoming', 'completed', 'all')
 * Calculates Dijkstra travel segments, shift bounds, 11:00-11:30 break buffer, and free time slots.
 * Strict Rejection Isolation: Excludes rejected offers and jobs of other technicians.
 */
techniciansRouter.get("/my/schedule", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const techUserId = req.user!.userId;
    const view = (req.query.view as string || "daily").toLowerCase();
    const filter = (req.query.filter as string || "today").toLowerCase();
    const dateParam = (req.query.date as string) || new Date().toISOString().split("T")[0];

    // Fetch technician's profile for base location & shift hours
    const profile = db.prepare(`
      SELECT 
        tp.current_latitude as baseLat,
        tp.current_longitude as baseLng,
        tp.shift_start_time as shiftStart,
        tp.shift_end_time as shiftEnd,
        tp.reserved_emergency_capacity as emergencyBuffer,
        tp.availability_status as availabilityStatus,
        tp.working_days as workingDays
      FROM technician_profiles tp
      WHERE tp.user_id = ?
    `).get(techUserId) as any;

    const baseLat = profile?.baseLat || 12.9716;
    const baseLng = profile?.baseLng || 77.5946;
    const shiftStart = profile?.shiftStart || "08:00";
    const shiftEnd = profile?.shiftEnd || "18:00";
    const emergencyBuffer = profile?.emergencyBuffer || "11:00-11:30";

    // Query confirmed jobs assigned to THIS technician only
    // Exclude any job where this technician rejected the offer
    const baseJobsQuery = `
      SELECT 
        b.booking_id as bookingId,
        b.booking_reference as bookingReference,
        b.customer_name as customerName,
        b.customer_phone as customerPhone,
        b.service_address as serviceAddress,
        b.latitude as lat,
        b.longitude as lng,
        b.node_id as nodeId,
        b.preferred_date as preferredDate,
        b.preferred_start_time as preferredStartTime,
        b.preferred_end_time as preferredEndTime,
        b.confirmed_start_time as confirmedStartTime,
        b.confirmed_end_time as confirmedEndTime,
        b.actual_start_time as actualStartTime,
        b.actual_end_time as actualEndTime,
        b.estimated_travel_time_minutes as estimatedTravelMinutes,
        b.booking_status as bookingStatus,
        b.requested_priority as requestedPriority,
        b.verified_priority as verifiedPriority,
        b.problem_description as problemDescription,
        b.notes,
        s.service_name as serviceName,
        s.category,
        s.estimated_duration_minutes as durationMinutes,
        s.indicative_price as price,
        cu.profile_picture_url as customerAvatar
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users cu ON b.customer_id = cu.user_id
      WHERE b.assigned_technician_id = ?
      AND b.booking_status IN ('ASSIGNED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED')
      AND NOT EXISTS (
        SELECT 1 FROM job_offers jo 
        WHERE jo.booking_id = b.booking_id 
        AND jo.technician_id = ? 
        AND jo.status = 'REJECTED'
      )
    `;

    // 1. DAILY SCHEDULE VIEW
    if (view === "daily") {
      const dailyJobs = db.prepare(`
        ${baseJobsQuery}
        AND b.preferred_date = ?
        ORDER BY b.preferred_start_time ASC, b.confirmed_start_time ASC
      `).all(techUserId, techUserId, dateParam) as any[];

      // Construct timeline with travel time segments and free slots
      const timelineBlocks: any[] = [];
      let previousLocation = { lat: baseLat, lng: baseLng, name: "Home Base" };
      let previousTime = shiftStart;

      // Add Shift Start Marker
      timelineBlocks.push({
        type: "SHIFT_START",
        title: "Shift Starts",
        startTime: shiftStart,
        endTime: shiftStart,
        description: `Scheduled shift start at ${shiftStart}`,
      });

      // Parse emergency capacity bounds (e.g. 11:00 - 11:30)
      const [bufferStart, bufferEnd] = emergencyBuffer.split("-");

      for (let i = 0; i < dailyJobs.length; i++) {
        const job = dailyJobs[i];
        const jobStartTime = job.preferredStartTime;
        const jobEndTime = job.preferredEndTime;

        // Calculate travel time from previous location to this job using Dijkstra
        const dijkstraRes = dijkstraService.calculateTravelBetweenCoords(
          previousLocation.lat,
          previousLocation.lng,
          job.lat,
          job.lng
        );

        const travelMinutes = dijkstraRes.travelMinutes || job.estimatedTravelMinutes || 15;
        const distanceKm = dijkstraRes.distanceKm || 5.0;

        // If there's free time before this job (accounting for travel time)
        if (jobStartTime > previousTime) {
          timelineBlocks.push({
            type: "FREE",
            title: "Available Time Slot",
            startTime: previousTime,
            endTime: jobStartTime,
            durationMinutes: 0,
          });
        }

        // Travel Segment Block
        timelineBlocks.push({
          type: "TRAVEL",
          title: `Travel to ${job.serviceName}`,
          destinationAddress: job.serviceAddress,
          travelMinutes,
          distanceKm,
          path: dijkstraRes.path,
          pathNodes: dijkstraRes.pathNodes,
          fromName: previousLocation.name,
          toName: job.bookingReference,
        });

        // Job Block
        timelineBlocks.push({
          type: "JOB",
          title: job.serviceName,
          booking: job,
          startTime: jobStartTime,
          endTime: jobEndTime,
          status: job.bookingStatus,
          priority: job.verifiedPriority,
        });

        previousTime = jobEndTime;
        previousLocation = { lat: job.lat, lng: job.lng, name: job.bookingReference };
      }

      // Check for lunch / emergency capacity buffer inclusion
      const hasBufferBlock = timelineBlocks.some(
        (b) => b.type === "BREAK" || (b.startTime <= bufferStart && b.endTime >= bufferEnd && b.type === "JOB")
      );

      if (!hasBufferBlock) {
        timelineBlocks.push({
          type: "BREAK",
          title: "Reserved Emergency Capacity & Lunch Buffer",
          startTime: bufferStart,
          endTime: bufferEnd,
          description: "Protected 30-minute buffer reserved for urgent dispatches and mandatory technician break.",
        });
      }

      // Sort timeline blocks chronologically
      timelineBlocks.sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));

      // Shift End Marker
      timelineBlocks.push({
        type: "SHIFT_END",
        title: "Shift Ends",
        startTime: shiftEnd,
        endTime: shiftEnd,
        description: `Scheduled shift finish at ${shiftEnd}`,
      });

      return res.json({
        view: "daily",
        date: dateParam,
        shiftStart,
        shiftEnd,
        emergencyBuffer,
        availabilityStatus: profile?.availabilityStatus || "AVAILABLE",
        jobs: dailyJobs,
        timeline: timelineBlocks,
        totalJobs: dailyJobs.length,
      });
    }

    // 2. WEEKLY SCHEDULE VIEW (Monday to Sunday)
    if (view === "weekly") {
      // Calculate Monday of the target date's week
      const d = new Date(dateParam);
      const day = d.getDay();
      const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diffToMon));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const mondayStr = monday.toISOString().split("T")[0];
      const sundayStr = sunday.toISOString().split("T")[0];

      const prevWeekMon = new Date(monday);
      prevWeekMon.setDate(monday.getDate() - 7);
      const nextWeekMon = new Date(monday);
      nextWeekMon.setDate(monday.getDate() + 7);

      const weekJobs = db.prepare(`
        ${baseJobsQuery}
        AND b.preferred_date >= ? AND b.preferred_date <= ?
        ORDER BY b.preferred_date ASC, b.preferred_start_time ASC
      `).all(techUserId, techUserId, mondayStr, sundayStr) as any[];

      // Group jobs by day of week
      const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const dayMap: Record<string, { date: string; dayName: string; jobs: any[]; totalDuration: number }> = {};

      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + i);
        const curStr = cur.toISOString().split("T")[0];
        const dayName = daysOfWeek[i];
        dayMap[curStr] = {
          date: curStr,
          dayName,
          jobs: [],
          totalDuration: 0,
        };
      }

      weekJobs.forEach((j) => {
        if (dayMap[j.preferredDate]) {
          dayMap[j.preferredDate].jobs.push(j);
          dayMap[j.preferredDate].totalDuration += j.durationMinutes || 60;
        }
      });

      return res.json({
        view: "weekly",
        startDate: mondayStr,
        endDate: sundayStr,
        prevWeekDate: prevWeekMon.toISOString().split("T")[0],
        nextWeekDate: nextWeekMon.toISOString().split("T")[0],
        days: Object.values(dayMap),
        totalJobs: weekJobs.length,
      });
    }

    // 3. LIST VIEW (Supports filter: today, this_week, upcoming, completed, all)
    let listQuery = baseJobsQuery;
    const listParams: any[] = [techUserId, techUserId];
    const todayStr = new Date().toISOString().split("T")[0];

    if (filter === "today") {
      listQuery += " AND b.preferred_date = ?";
      listParams.push(todayStr);
    } else if (filter === "this_week") {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diffToMon)).toISOString().split("T")[0];
      const sunDate = new Date(now.setDate(diffToMon + 6)).toISOString().split("T")[0];
      listQuery += " AND b.preferred_date >= ? AND b.preferred_date <= ?";
      listParams.push(mon, sunDate);
    } else if (filter === "upcoming") {
      listQuery += " AND b.preferred_date >= ? AND b.booking_status != 'COMPLETED'";
      listParams.push(todayStr);
    } else if (filter === "completed") {
      listQuery += " AND b.booking_status = 'COMPLETED'";
    }

    listQuery += " ORDER BY b.preferred_date DESC, b.preferred_start_time ASC";
    const listJobs = db.prepare(listQuery).all(...listParams) as any[];

    return res.json({
      view: "list",
      filter,
      jobs: listJobs,
      totalJobs: listJobs.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update technician profile details (Full name, phone, email, avatar, address, experience)
techniciansRouter.put("/profile", authenticateToken, requireRole("TECHNICIAN", "ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.user!.role === "ADMIN" && req.body.userId ? req.body.userId : req.user!.userId;
    const { fullName, phone, email, profilePictureUrl, experienceYears, residentialAddress, city, pincode } = req.body;

    const tx = db.transaction(() => {
      // 1. Update users table
      db.prepare(`
        UPDATE users
        SET full_name = COALESCE(?, full_name),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            profile_picture_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        fullName !== undefined ? fullName : null,
        phone !== undefined ? phone : null,
        email !== undefined ? email : null,
        profilePictureUrl !== undefined ? profilePictureUrl : null,
        targetUserId
      );

      // 2. Update technician_profiles table
      db.prepare(`
        UPDATE technician_profiles
        SET experience_years = COALESCE(?, experience_years),
            residential_address = COALESCE(?, residential_address),
            city = COALESCE(?, city),
            pincode = COALESCE(?, pincode),
            profile_picture_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        experienceYears !== undefined ? experienceYears : null,
        residentialAddress !== undefined ? residentialAddress : null,
        city !== undefined ? city : null,
        pincode !== undefined ? pincode : null,
        profilePictureUrl !== undefined ? profilePictureUrl : null,
        targetUserId
      );
    });

    tx();

    return res.json({ success: true, message: "Technician profile updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

// Update availability & working shift (triggers dynamic recovery if unavailable)
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

    let recoveryResult = null;
    // If technician reported UNAVAILABLE or ON_LEAVE, immediately trigger adaptive recovery for future unstarted jobs!
    if (availabilityStatus === "UNAVAILABLE" || availabilityStatus === "ON_LEAVE") {
      recoveryResult = RecoveryEngine.handleDisruption({
        disruptionType: "TECHNICIAN_SICKNESS",
        technicianId: targetUserId,
        reason: `Technician updated availability status to ${availabilityStatus}. Shift recovery activated.`,
      });

      addNotification({
        recipientUserId: targetUserId,
        title: "Availability Updated & Schedule Recovered",
        message: `Your status was set to ${availabilityStatus}. Any pending unstarted jobs were re-dispatched to backup specialists.`,
        type: "SCHEDULE_UPDATE",
      });
    }

    return res.json({
      message: "Availability updated successfully",
      availabilityStatus,
      recovery: recoveryResult,
    });
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
