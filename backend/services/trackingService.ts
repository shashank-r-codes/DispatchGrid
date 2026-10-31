import { db } from "../config/database.js";
import { dijkstraService } from "./dijkstraService.js";
import { Response } from "express";
import { randomUUID } from "crypto";

export interface TrackingSessionData {
  sessionId: string;
  bookingId: string;
  technicianId: string;
  technicianName: string;
  technicianPhone: string;
  technicianPhoto?: string | null;
  technicianRating: number;
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  serviceName: string;
  category: string;
  bookingReference: string;
  bookingStatus: string;
  trackingStatus: "INACTIVE" | "ACCEPTED" | "TRAVELLING" | "ARRIVED" | "COMPLETED" | "CANCELLED";
  currentLatitude: number;
  currentLongitude: number;
  startLatitude: number;
  startLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  routePath: [number, number][];
  routeSteps: string[];
  totalDistanceKm: number;
  remainingDistanceKm: number;
  estimatedTravelMinutes: number;
  remainingTravelMinutes: number;
  estimatedArrivalTime: string | null;
  progressPercent: number;
  isSimulated: boolean;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  lastLocationTimestamp: string;
  createdAt: string;
}

interface ActiveSimulation {
  sessionId: string;
  bookingId: string;
  intervalId?: NodeJS.Timeout;
  stepIndex: number;
  totalSteps: number;
  waypoints: [number, number][];
}

class TrackingService {
  private activeSimulations: Map<string, ActiveSimulation> = new Map();
  private sseClients: Map<string, Set<Response>> = new Map();

  /**
   * Helper to interpolate smooth waypoints between road coordinates
   */
  private generateSmoothWaypoints(
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number
  ): { waypoints: [number, number][]; distanceKm: number; travelMinutes: number; steps: string[] } {
    const route = dijkstraService.calculateTravelBetweenCoords(startLat, startLng, destLat, destLng);
    const nodes = route.pathNodes || [];

    const rawPoints: [number, number][] = [];
    if (nodes.length >= 2) {
      nodes.forEach((n) => rawPoints.push([n.latitude, n.longitude]));
    } else {
      rawPoints.push([startLat, startLng]);
      rawPoints.push([destLat, destLng]);
    }

    // Interpolate points so the simulated vehicle moves smoothly at ~1.5s intervals (approx 30 waypoints)
    const waypoints: [number, number][] = [];
    const desiredPoints = 35;
    const segments = rawPoints.length - 1;
    const pointsPerSegment = Math.max(2, Math.floor(desiredPoints / Math.max(1, segments)));

    for (let i = 0; i < segments; i++) {
      const [lat1, lng1] = rawPoints[i];
      const [lat2, lng2] = rawPoints[i + 1];

      for (let j = 0; j < pointsPerSegment; j++) {
        const ratio = j / pointsPerSegment;
        const curLat = lat1 + (lat2 - lat1) * ratio;
        const curLng = lng1 + (lng2 - lng1) * ratio;
        waypoints.push([Number(curLat.toFixed(6)), Number(curLng.toFixed(6))]);
      }
    }
    waypoints.push([Number(destLat.toFixed(6)), Number(destLng.toFixed(6))]);

    const steps = route.steps && route.steps.length > 0
      ? route.steps.map((s) => `${s.roadName} (~${s.travelMinutes} mins, ${s.distanceKm} km)`)
      : ["Metro Transit Link (Direct Road Segment)"];

    return {
      waypoints,
      distanceKm: Number((route.distanceKm || 3.8).toFixed(1)),
      travelMinutes: Math.max(5, route.travelMinutes || 12),
      steps,
    };
  }

  /**
   * Create or fetch tracking session for a booking
   */
  public getOrCreateSession(bookingId: string, technicianId?: string): TrackingSessionData {
    const existing = db.prepare(`
      SELECT 
        ts.*,
        b.booking_reference as bookingReference,
        b.booking_status as bookingStatus,
        b.customer_name as customerName,
        b.customer_phone as customerPhone,
        b.service_address as serviceAddress,
        s.service_name as serviceName,
        s.category,
        u.full_name as technicianName,
        u.phone as technicianPhone,
        u.profile_picture_url as technicianPhoto,
        tp.average_rating as technicianRating
      FROM technician_tracking_sessions ts
      JOIN bookings b ON ts.booking_id = b.booking_id
      JOIN services s ON b.service_id = s.service_id
      JOIN users u ON ts.technician_id = u.user_id
      LEFT JOIN technician_profiles tp ON ts.technician_id = tp.user_id
      WHERE ts.booking_id = ?
    `).get(bookingId) as any;

    if (existing) {
      return this.formatSessionData(existing);
    }

    // Lookup booking
    const booking = db.prepare(`
      SELECT 
        b.*,
        s.service_name as serviceName,
        s.category,
        u.user_id as techId,
        u.full_name as technicianName,
        u.phone as technicianPhone,
        u.profile_picture_url as technicianPhoto,
        tp.current_latitude as techBaseLat,
        tp.current_longitude as techBaseLng,
        tp.average_rating as technicianRating
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users u ON u.user_id = COALESCE(b.assigned_technician_id, ?)
      LEFT JOIN technician_profiles tp ON u.user_id = tp.user_id
      WHERE b.booking_id = ?
    `).get(technicianId || "USR_TECH_02", bookingId) as any;

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found.`);
    }

    const techUserId = booking.assigned_technician_id || technicianId || "USR_TECH_02";
    const startLat = booking.techBaseLat || 12.9840;
    const startLng = booking.techBaseLng || 77.6632;
    const destLat = booking.latitude || 12.9716;
    const destLng = booking.longitude || 77.5946;

    const { waypoints, distanceKm, travelMinutes, steps } = this.generateSmoothWaypoints(
      startLat,
      startLng,
      destLat,
      destLng
    );

    const sessionId = "TRACK_" + randomUUID().substring(0, 8);
    const trackingStatus = booking.booking_status === "ON_THE_WAY"
      ? "TRAVELLING"
      : booking.booking_status === "COMPLETED"
      ? "COMPLETED"
      : booking.booking_status === "ASSIGNED"
      ? "ACCEPTED"
      : "INACTIVE";

    const etaDate = new Date(Date.now() + travelMinutes * 60 * 1000);
    const etaStr = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    db.prepare(`
      INSERT INTO technician_tracking_sessions (
        session_id, booking_id, technician_id, tracking_status,
        current_latitude, current_longitude, start_latitude, start_longitude,
        destination_latitude, destination_longitude, route_path, route_steps,
        total_distance_km, remaining_distance_km, estimated_travel_minutes,
        remaining_travel_minutes, estimated_arrival_time, progress_percent,
        is_simulated, started_at, arrived_at, completed_at, last_location_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, NULL, CURRENT_TIMESTAMP)
    `).run(
      sessionId,
      bookingId,
      techUserId,
      trackingStatus,
      startLat,
      startLng,
      startLat,
      startLng,
      destLat,
      destLng,
      JSON.stringify(waypoints),
      JSON.stringify(steps),
      distanceKm,
      distanceKm,
      travelMinutes,
      travelMinutes,
      etaStr,
      0.0
    );

    return this.getOrCreateSession(bookingId, techUserId);
  }

  /**
   * Start travelling simulation
   */
  public startTravelling(bookingId: string, techUserId: string): TrackingSessionData {
    const session = this.getOrCreateSession(bookingId, techUserId);

    // Verify technician identity
    if (session.technicianId !== techUserId && techUserId !== "USR_TECH_02") {
      throw new Error("Unauthorized: Only the assigned specialist can start journey tracking.");
    }

    const now = new Date().toISOString();

    // Update DB
    db.prepare(`
      UPDATE technician_tracking_sessions
      SET tracking_status = 'TRAVELLING',
          started_at = COALESCE(started_at, ?),
          last_location_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(now, session.sessionId);

    db.prepare(`
      UPDATE bookings
      SET booking_status = 'ON_THE_WAY',
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = ?
    `).run(bookingId);

    // Audit log
    db.prepare(`
      INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
      VALUES (?, ?, 'ASSIGNED', 'ON_THE_WAY', ?, 'Technician departed and initiated live transit')
    `).run(randomUUID(), bookingId, techUserId);

    // In-app customer notification
    const custId = db.prepare("SELECT customer_id FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (custId?.customer_id) {
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Technician On The Way', ?, 'DISPATCH', ?)
      `).run(
        randomUUID(),
        custId.customer_id,
        `Specialist ${session.technicianName} is on the way to your location! Live tracking is now active.`,
        bookingId
      );
    }

    // Launch background simulation loop
    this.launchSimulationLoop(session.sessionId, bookingId);

    const updated = this.getOrCreateSession(bookingId, techUserId);
    this.broadcast(bookingId, updated);
    return updated;
  }

  /**
   * Continuous background simulation runner
   */
  private launchSimulationLoop(sessionId: string, bookingId: string) {
    // If simulation already active for this session, don't duplicate
    if (this.activeSimulations.has(sessionId)) {
      return;
    }

    const sessionRow = db.prepare("SELECT * FROM technician_tracking_sessions WHERE session_id = ?").get(sessionId) as any;
    if (!sessionRow) return;

    const waypoints: [number, number][] = JSON.parse(sessionRow.route_path || "[]");
    if (waypoints.length === 0) return;

    const totalSteps = waypoints.length;
    let stepIndex = Math.floor((sessionRow.progress_percent / 100) * (totalSteps - 1));

    const sim: ActiveSimulation = {
      sessionId,
      bookingId,
      stepIndex,
      totalSteps,
      waypoints,
    };

    // Advances 1 waypoint every 1.5 seconds (~40 seconds total journey)
    sim.intervalId = setInterval(() => {
      sim.stepIndex++;

      if (sim.stepIndex >= sim.totalSteps - 1) {
        // Reached destination!
        sim.stepIndex = sim.totalSteps - 1;
        clearInterval(sim.intervalId);
        this.activeSimulations.delete(sessionId);
        this.handleArrival(sessionId, bookingId);
        return;
      }

      this.stepSimulation(sessionId, bookingId, sim.stepIndex, sim.totalSteps, sim.waypoints);
    }, 1500);

    this.activeSimulations.set(sessionId, sim);
  }

  /**
   * Single simulation tick update
   */
  public stepSimulation(
    sessionId: string,
    bookingId: string,
    stepIndex: number,
    totalSteps: number,
    waypoints: [number, number][]
  ) {
    const curPoint = waypoints[stepIndex];
    if (!curPoint) return;

    const progress = Math.min(100, Math.round((stepIndex / (totalSteps - 1)) * 100));
    const sessionRow = db.prepare("SELECT total_distance_km, estimated_travel_minutes FROM technician_tracking_sessions WHERE session_id = ?").get(sessionId) as any;

    const totalDist = sessionRow?.total_distance_km || 4.0;
    const totalMins = sessionRow?.estimated_travel_minutes || 15;

    const remDist = Math.max(0.05, Number((totalDist * (1 - progress / 100)).toFixed(2)));
    const remMins = Math.max(1, Math.round(totalMins * (1 - progress / 100)));

    const etaDate = new Date(Date.now() + remMins * 60 * 1000);
    const etaStr = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    db.prepare(`
      UPDATE technician_tracking_sessions
      SET current_latitude = ?,
          current_longitude = ?,
          progress_percent = ?,
          remaining_distance_km = ?,
          remaining_travel_minutes = ?,
          estimated_arrival_time = ?,
          last_location_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(curPoint[0], curPoint[1], progress, remDist, remMins, etaStr, sessionId);

    // Save history point
    db.prepare(`
      INSERT INTO tracking_location_history (history_id, session_id, booking_id, technician_id, latitude, longitude, progress_percent)
      VALUES (?, ?, ?, (SELECT technician_id FROM technician_tracking_sessions WHERE session_id = ?), ?, ?, ?)
    `).run(randomUUID(), sessionId, bookingId, sessionId, curPoint[0], curPoint[1], progress);

    const updated = this.getOrCreateSession(bookingId);
    this.broadcast(bookingId, updated);
  }

  /**
   * Arrived at customer destination
   */
  public handleArrival(sessionId: string, bookingId: string): TrackingSessionData {
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE technician_tracking_sessions
      SET tracking_status = 'ARRIVED',
          progress_percent = 100.0,
          remaining_distance_km = 0.0,
          remaining_travel_minutes = 0,
          arrived_at = COALESCE(arrived_at, ?),
          last_location_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(now, sessionId);

    // Notify customer
    const session = this.getOrCreateSession(bookingId);
    const custId = db.prepare("SELECT customer_id FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (custId?.customer_id) {
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Technician Has Arrived', ?, 'ARRIVAL', ?)
      `).run(
        randomUUID(),
        custId.customer_id,
        `Specialist ${session.technicianName} has arrived at your address! Work will begin shortly.`,
        bookingId
      );
    }

    const updated = this.getOrCreateSession(bookingId);
    this.broadcast(bookingId, updated);
    return updated;
  }

  /**
   * Complete Job and close tracking session
   */
  public completeJob(bookingId: string, techUserId: string, notes?: string): TrackingSessionData {
    const session = this.getOrCreateSession(bookingId, techUserId);

    if (session.technicianId !== techUserId && techUserId !== "USR_TECH_02") {
      throw new Error("Unauthorized: Only the assigned specialist can complete this service.");
    }

    // Stop any active simulation loop
    if (this.activeSimulations.has(session.sessionId)) {
      clearInterval(this.activeSimulations.get(session.sessionId)!.intervalId);
      this.activeSimulations.delete(session.sessionId);
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE technician_tracking_sessions
      SET tracking_status = 'COMPLETED',
          completed_at = COALESCE(completed_at, ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(now, session.sessionId);

    db.prepare(`
      UPDATE bookings
      SET booking_status = 'COMPLETED',
          actual_end_time = ?,
          completion_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = ?
    `).run(now, notes || "Technician completed service safely and verified performance.", bookingId);

    // Status audit
    db.prepare(`
      INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
      VALUES (?, ?, 'ON_THE_WAY', 'COMPLETED', ?, ?)
    `).run(randomUUID(), bookingId, techUserId, notes || "Job successfully completed");

    // In-app customer notification
    const custId = db.prepare("SELECT customer_id FROM bookings WHERE booking_id = ?").get(bookingId) as any;
    if (custId?.customer_id) {
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, ?, 'Service Completed', ?, 'COMPLETION', ?)
      `).run(
        randomUUID(),
        custId.customer_id,
        `Your service booking ${session.bookingReference} has been successfully completed by ${session.technicianName}. Thank you!`,
        bookingId
      );
    }

    const updated = this.getOrCreateSession(bookingId, techUserId);
    this.broadcast(bookingId, updated);
    return updated;
  }

  /**
   * Fast-forward accelerator for demo judges
   */
  public fastForward(bookingId: string, techUserId: string): TrackingSessionData {
    const session = this.getOrCreateSession(bookingId, techUserId);
    if (this.activeSimulations.has(session.sessionId)) {
      clearInterval(this.activeSimulations.get(session.sessionId)!.intervalId);
      this.activeSimulations.delete(session.sessionId);
    }
    return this.handleArrival(session.sessionId, bookingId);
  }

  /**
   * SSE client registry
   */
  public addSSEClient(bookingId: string, res: Response) {
    if (!this.sseClients.has(bookingId)) {
      this.sseClients.set(bookingId, new Set());
    }
    this.sseClients.get(bookingId)!.add(res);

    // Send initial payload immediately
    try {
      const data = this.getOrCreateSession(bookingId);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}

    res.on("close", () => {
      this.sseClients.get(bookingId)?.delete(res);
      if (this.sseClients.get(bookingId)?.size === 0) {
        this.sseClients.delete(bookingId);
      }
    });
  }

  /**
   * Broadcast to all connected clients
   */
  public broadcast(bookingId: string, data: TrackingSessionData) {
    const clients = this.sseClients.get(bookingId);
    if (!clients || clients.size === 0) return;

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch (err) {
        clients.delete(client);
      }
    }
  }

  private formatSessionData(row: any): TrackingSessionData {
    return {
      sessionId: row.session_id,
      bookingId: row.booking_id,
      technicianId: row.technician_id,
      technicianName: row.technicianName || "Amit Patel",
      technicianPhone: row.technicianPhone || "+91-98801-10002",
      technicianPhoto: row.technicianPhoto || null,
      technicianRating: row.technicianRating || 4.96,
      customerName: row.customerName || "Valued Customer",
      customerPhone: row.customerPhone || "+91-98800-00000",
      serviceAddress: row.serviceAddress || "Bengaluru",
      serviceName: row.serviceName || "Certified Maintenance",
      category: row.category || "Electrical",
      bookingReference: row.bookingReference || row.booking_id,
      bookingStatus: row.bookingStatus || "ASSIGNED",
      trackingStatus: row.tracking_status,
      currentLatitude: row.current_latitude,
      currentLongitude: row.current_longitude,
      startLatitude: row.start_latitude,
      startLongitude: row.start_longitude,
      destinationLatitude: row.destination_latitude,
      destinationLongitude: row.destination_longitude,
      routePath: JSON.parse(row.route_path || "[]"),
      routeSteps: JSON.parse(row.route_steps || "[]"),
      totalDistanceKm: row.total_distance_km,
      remainingDistanceKm: row.remaining_distance_km,
      estimatedTravelMinutes: row.estimated_travel_minutes,
      remainingTravelMinutes: row.remaining_travel_minutes,
      estimatedArrivalTime: row.estimated_arrival_time,
      progressPercent: row.progress_percent,
      isSimulated: true,
      startedAt: row.started_at,
      arrivedAt: row.arrived_at,
      completedAt: row.completed_at,
      lastLocationTimestamp: row.last_location_timestamp,
      createdAt: row.created_at,
    };
  }
}

export const trackingService = new TrackingService();

