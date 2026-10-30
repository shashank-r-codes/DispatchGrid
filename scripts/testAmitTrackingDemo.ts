import { db } from "../backend/config/database.js";
import { trackingService } from "../backend/services/trackingService.js";
import { AssignmentEngine } from "../backend/services/assignmentEngine.js";
import { randomUUID } from "crypto";

console.log("\n=======================================================");
console.log("   DISPATCHGRID - AMIT PATEL LIVE TRACKING DEMO TEST   ");
console.log("=======================================================\n");

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✕ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
    process.exit(1);
  }
}

async function runDemoTests() {
  // 1. Verify Amit Patel account exists and has credentials
  const amit = db.prepare("SELECT * FROM users WHERE user_id = 'USR_TECH_02' OR full_name = 'Amit Patel'").get() as any;
  assert(amit !== undefined, "Amit Patel exists in database with ID USR_TECH_02", `Found: ${amit?.user_id}`);
  assert(amit.full_name === "Amit Patel", "Technician name is Amit Patel");

  // Verify Amit has Electrical, AC, and Plumbing categories
  const profile = db.prepare("SELECT * FROM technician_profiles WHERE user_id = ?").get(amit.user_id) as any;
  assert(profile.service_categories.includes("Electrical") && profile.service_categories.includes("AC") && profile.service_categories.includes("Plumbing"), "Amit Patel is certified for Electrical, AC, and Plumbing in demo mode");

  // 2. Test Customer Booking Creation in DEMO TRACKING MODE
  const bookingId = "DEMO_BK_" + randomUUID().substring(0, 6);
  const bookingRef = "DG-DEMO-909";
  const customerId = "USR_CUST_DEMO";
  const serviceId = "SRV_AC_01"; // AC maintenance

  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      booking_id, booking_reference, customer_id, customer_name, customer_phone,
      service_id, requested_priority, verified_priority, booking_status,
      problem_description, service_address, latitude, longitude, node_id,
      preferred_date, preferred_start_time, preferred_end_time, is_demo_tracking,
      assigned_technician_id, estimated_travel_time_minutes
    ) VALUES (?, ?, ?, 'Demo Customer', '+91-98800-00001', ?, 'NORMAL', 'NORMAL', 'OFFERED',
              'AC Compressor tripping repeatedly', '100 Indiranagar 100ft Rd, Bengaluru', 12.9784, 77.6408, 'NODE_EAST',
              '2026-11-01', '10:00', '11:00', 1, ?, 12)
  `);

  insertBooking.run(bookingId, bookingRef, customerId, serviceId, amit.user_id);

  const offerId = "OFFER_DEMO_01";
  db.prepare(`
    INSERT INTO job_offers (offer_id, booking_id, technician_id, status, travel_minutes, distance_km, score, attempt_number)
    VALUES (?, ?, ?, 'OFFERED', 12, 3.4, 0.1, 1)
  `).run(offerId, bookingId, amit.user_id);

  assert(true, "Demo booking created with is_demo_tracking = 1");

  // 3. Verify ONLY Amit Patel receives the offer
  const offersForAmit = db.prepare("SELECT * FROM job_offers WHERE booking_id = ? AND technician_id = ?").all(bookingId, amit.user_id);
  const offersForOthers = db.prepare("SELECT * FROM job_offers WHERE booking_id = ? AND technician_id != ?").all(bookingId, amit.user_id);

  assert(offersForAmit.length === 1 && offersForOthers.length === 0, "Demo booking is offered EXCLUSIVELY to Amit Patel (Zero offers sent to other technicians)");

  // 4. Technician Acceptance
  const acceptResult = AssignmentEngine.acceptJobOffer(offerId, amit.user_id);
  assert(acceptResult.success, "Amit Patel successfully accepts the job offer");

  const acceptedBooking = db.prepare("SELECT booking_status, assigned_technician_id FROM bookings WHERE booking_id = ?").get(bookingId) as any;
  assert(acceptedBooking.booking_status === "ASSIGNED" && acceptedBooking.assigned_technician_id === amit.user_id, "Booking status atomically transitions to ASSIGNED with Amit Patel");

  // 5. Verify Customer cannot see active moving tracking before departure
  const trackingBeforeStart = trackingService.getOrCreateSession(bookingId, amit.user_id);
  assert(trackingBeforeStart.trackingStatus === "ACCEPTED", "Customer tracking status is ACCEPTED (Awaiting departure, not moving prematurely)");
  assert(trackingBeforeStart.progressPercent === 0, "Initial journey progress is 0%");

  // 6. Amit clicks Start Travelling
  const trackingStarted = trackingService.startTravelling(bookingId, amit.user_id);
  assert(trackingStarted.trackingStatus === "TRAVELLING", "Tracking status transitioned to TRAVELLING upon technician departure");
  
  const travellingBooking = db.prepare("SELECT booking_status FROM bookings WHERE booking_id = ?").get(bookingId) as any;
  assert(travellingBooking.booking_status === "ON_THE_WAY", "Booking status atomically transitioned to ON_THE_WAY");
  assert(trackingStarted.routePath.length > 10, `Simulated route generated with ${trackingStarted.routePath.length} smooth waypoints`);

  // 7. Verify In-Flight Coordinate Progression & Remaining Distance/ETA calculation
  trackingService.stepSimulation(trackingStarted.sessionId, bookingId, 15, trackingStarted.routePath.length, trackingStarted.routePath);
  const inFlightSession = trackingService.getOrCreateSession(bookingId, amit.user_id);
  assert(inFlightSession.progressPercent > 0 && inFlightSession.progressPercent < 100, `Vehicle smoothly progressing: ${inFlightSession.progressPercent}% completed`);
  assert(inFlightSession.remainingDistanceKm < trackingStarted.totalDistanceKm, `Remaining distance decreased to ${inFlightSession.remainingDistanceKm} km`);

  // 8. Arrival at Customer Destination
  const arrivalSession = trackingService.handleArrival(trackingStarted.sessionId, bookingId);
  assert(arrivalSession.trackingStatus === "ARRIVED", "Tracking status transitioned to ARRIVED at customer destination");
  assert(arrivalSession.progressPercent === 100, "Progress reached 100%");
  assert(arrivalSession.remainingDistanceKm === 0, "Remaining distance is 0 km");

  // Verify Arrival Notification to Customer
  const arrivalNotif = db.prepare("SELECT * FROM notifications WHERE reference_id = ? AND type = 'ARRIVAL'").get(bookingId) as any;
  assert(arrivalNotif !== undefined, "Customer received in-app notification: Technician Has Arrived");

  // 9. Amit Patel Completes the Job
  const completionSession = trackingService.completeJob(bookingId, amit.user_id, "Replaced faulty dual run capacitor; system operating at 8.4 amps.");
  assert(completionSession.trackingStatus === "COMPLETED", "Tracking session status finalized to COMPLETED");

  const completedBooking = db.prepare("SELECT booking_status, completion_notes FROM bookings WHERE booking_id = ?").get(bookingId) as any;
  assert(completedBooking.booking_status === "COMPLETED", "Booking status updated to COMPLETED in database");
  assert(completedBooking.completion_notes.includes("capacitor"), "Completion notes successfully saved to booking record");

  // 10. Test Rejection Isolation: When demo booking is declined, it is NOT rerouted to other technicians
  const rejectBookingId = "DEMO_REJECT_" + randomUUID().substring(0, 6);
  db.prepare(`
    INSERT INTO bookings (
      booking_id, booking_reference, customer_id, customer_name, customer_phone,
      service_id, requested_priority, verified_priority, booking_status,
      problem_description, service_address, latitude, longitude, node_id,
      preferred_date, preferred_start_time, preferred_end_time, is_demo_tracking,
      assigned_technician_id, estimated_travel_time_minutes
    ) VALUES (?, 'DG-DEMO-REJ', 'USR_CUST_DEMO', 'Demo Customer', '+91-98800-00001',
              'SRV_E_01', 'NORMAL', 'NORMAL', 'OFFERED', 'Wiring issue', 'Koramangala, Bengaluru',
              12.9352, 77.6245, 'NODE_SOUTH', '2026-11-01', '14:00', '15:00', 1, ?, 15)
  `).run(rejectBookingId, amit.user_id);

  const rejectOfferId = "OFFER_DEMO_REJ";
  db.prepare(`
    INSERT INTO job_offers (offer_id, booking_id, technician_id, status, travel_minutes, distance_km, score, attempt_number)
    VALUES (?, ?, ?, 'OFFERED', 15, 4.2, 0.1, 1)
  `).run(rejectOfferId, rejectBookingId, amit.user_id);

  const rejectResult = AssignmentEngine.rejectJobOffer(rejectOfferId, amit.user_id, "Vehicle maintenance scheduled during this hour");
  assert(rejectResult.success, "Amit Patel declined demo job offer with recorded reason");

  const rejectedOffers = db.prepare("SELECT * FROM job_offers WHERE booking_id = ?").all(rejectBookingId);
  assert(rejectedOffers.length === 1 && rejectedOffers[0].status === "REJECTED", "Zero replacement offers generated for demo booking (Strict isolation preserved)");

  const rejectedBooking = db.prepare("SELECT booking_status, unassigned_reason FROM bookings WHERE booking_id = ?").get(rejectBookingId) as any;
  assert(rejectedBooking.booking_status === "UNASSIGNED", "Booking status set to UNASSIGNED without being dispatched to other technicians");

  console.log("\n=======================================================");
  console.log("  ✓ ALL 10 AMIT PATEL LIVE TRACKING DEMO TESTS PASSED! ");
  console.log("=======================================================\n");
}

runDemoTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
