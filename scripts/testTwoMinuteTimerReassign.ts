import assert from "assert";
import { db } from "../backend/config/database.js";
import { AssignmentEngine } from "../backend/services/assignmentEngine.js";
import { randomUUID } from "crypto";

console.log("\n=======================================================");
console.log("   DISPATCHGRID: 2-MINUTE TIMER & AUTO-REASSIGN TEST   ");
console.log("=======================================================\n");

// 1. Create a customer booking for Electrical service
const testBookingId = "BK_TIMER_" + randomUUID().substring(0, 8);
const testBookingRef = "DG-TIMER-" + Math.floor(1000 + Math.random() * 9000);
const custId = "USR_CUST_DEMO";

console.log("[1/4] Customer submits a service booking request...");
db.prepare(`
  INSERT INTO bookings (
    booking_id, booking_reference, customer_id, customer_name, customer_phone, service_id,
    requested_priority, verified_priority, booking_status, problem_description,
    service_address, latitude, longitude, node_id, preferred_date,
    preferred_start_time, preferred_end_time
  ) VALUES (?, ?, ?, 'David Miller (Valued Customer)', '+91-98800-00001', 'SRV_E_01', 'NORMAL', 'NORMAL', 'PENDING',
    'Main breaker tripping constantly', 'Indiranagar 100ft Road, Bengaluru', 12.9784, 77.6408, 'NODE_EAST',
    '2026-10-31', '14:00', '15:00')
`).run(testBookingId, testBookingRef, custId);

// 2. Dispatch offer to initial nearest technician
const initialOfferRes = AssignmentEngine.offerJobToBestCandidate({
  bookingId: testBookingId,
  bookingReference: testBookingRef,
  customerId: custId,
  serviceId: "SRV_E_01",
  category: "Electrical",
  requiredSkills: ["Wiring", "Switchboard repair"],
  requiredCertifications: ["Licensed Electrical Contractor (Wireman Grade A)"],
  nodeId: "NODE_EAST",
  latitude: 12.9784,
  longitude: 77.6408,
  serviceAddress: "Indiranagar 100ft Road, Bengaluru",
  requestedPriority: "NORMAL",
  verifiedPriority: "NORMAL",
  preferredDate: "2026-10-31",
  preferredStartTime: "14:00",
  preferredEndTime: "15:00",
  estimatedDurationMinutes: 60,
  createdAt: new Date().toISOString(),
});

assert(initialOfferRes.success, "Initial job offer successfully dispatched");
const tech1Id = initialOfferRes.assignedTechnicianId;
const tech1Name = initialOfferRes.assignedTechnicianName;
const offer1Id = initialOfferRes.offerId!;
console.log(`✓ Job offered to Technician 1: ${tech1Name} (${tech1Id})`);
console.log(`✓ 2-Minute Decision Timer started for Technician 1 (Offer ID: ${offer1Id})`);

// 3. Simulate 2 minutes elapsing without acceptance or rejection
console.log("\n[2/4] Simulating 2-minute decision timer elapsing (120 seconds passed without action)...");
// Set offered_at to 125 seconds ago
const pastTime = new Date(Date.now() - 125 * 1000).toISOString();
db.prepare("UPDATE job_offers SET offered_at = ? WHERE offer_id = ?").run(pastTime, offer1Id);

// Run the auto-timeout sweep
const sweepResults = AssignmentEngine.checkAndExpireTimedOutOffers(120);
assert(sweepResults.length > 0, "Background auto-timeout sweep detected expired offer");

const expiredOffer = db.prepare("SELECT status, rejection_reason FROM job_offers WHERE offer_id = ?").get(offer1Id) as any;
assert(expiredOffer.status === "EXPIRED", "Offer 1 status automatically updated to EXPIRED");
assert(expiredOffer.rejection_reason.includes("Timeout"), "Rejection reason records timeout without response");
console.log("✓ Offer 1 automatically marked EXPIRED due to 2-minute timeout");

// 4. Verify automatic reassignment to next nearest qualified technician
console.log("\n[3/4] Verifying automatic reassignment to next nearest technician...");
const activeOffers = db.prepare("SELECT * FROM job_offers WHERE booking_id = ? AND status = 'OFFERED'").all(testBookingId) as any[];
assert(activeOffers.length === 1, "Exactly one replacement offer dispatched to next candidate");
const offer2 = activeOffers[0];
assert(offer2.technician_id !== tech1Id, "Reassigned technician is distinct from Technician 1");
assert(offer2.attempt_number === 2, "Offer attempt number incremented to 2");

const tech2User = db.prepare("SELECT full_name FROM users WHERE user_id = ?").get(offer2.technician_id) as any;
console.log(`✓ Booking automatically reassigned to next nearest person: ${tech2User.full_name} (${offer2.technician_id})`);
console.log(`✓ New 2-minute decision timer started at Technician 2's portal`);

// 5. Verify customer notification & audit history
console.log("\n[4/4] Verifying customer notification & audit history...");
const notifs = db.prepare("SELECT * FROM notifications WHERE reference_id = ? ORDER BY created_at DESC").all(testBookingId) as any[];
assert(notifs.some(n => n.type === "REALLOCATION" || n.title.includes("Finding another technician")), "Customer received automatic reallocation notification");
console.log(`✓ Customer notified: Finding another suitable technician automatically`);

// =========================================================================
// TEST CASE 2: DEMO TRACKING BOOKING (AMIT PATEL) TIMEOUT & AUTO-REASSIGNMENT
// =========================================================================
console.log("\n-------------------------------------------------------");
console.log("   TEST CASE 2: Amit Patel Demo Booking Timeout        ");
console.log("-------------------------------------------------------\n");

const amitBookingId = "BK_AMIT_TO_" + randomUUID().substring(0, 8);
const amitBookingRef = "DG-AMIT-" + Math.floor(1000 + Math.random() * 9000);

console.log("[1/3] Customer books service in Demo Tracking Mode (offered to Amit Patel)...");
db.prepare(`
  INSERT INTO bookings (
    booking_id, booking_reference, customer_id, customer_name, customer_phone, service_id,
    requested_priority, verified_priority, booking_status, problem_description,
    service_address, latitude, longitude, node_id, preferred_date,
    preferred_start_time, preferred_end_time, is_demo_tracking, assigned_technician_id,
    estimated_travel_time_minutes
  ) VALUES (?, ?, ?, 'David Miller', '+91-98800-00001', 'SRV_E_01', 'NORMAL', 'NORMAL', 'OFFERED',
    'Circuit breaker issue', 'Indiranagar, Bengaluru', 12.9784, 77.6408, 'NODE_EAST',
    '2026-10-31', '16:00', '17:00', 1, 'USR_TECH_02', 12)
`).run(amitBookingId, amitBookingRef, custId);

const amitOfferId = "OFF_AMIT_" + randomUUID().substring(0, 8);
db.prepare(`
  INSERT INTO job_offers (offer_id, booking_id, technician_id, status, travel_minutes, distance_km, score, attempt_number, offered_at)
  VALUES (?, ?, 'USR_TECH_02', 'OFFERED', 12, 3.5, 0.1, 1, ?)
`).run(amitOfferId, amitBookingId, new Date(Date.now() - 130 * 1000).toISOString());

console.log(`✓ Demo offer dispatched to Amit Patel (Offer ID: ${amitOfferId})`);
console.log("[2/3] 2 minutes elapsed without Amit accepting or rejecting (timer at 0:00)...");

// Run auto-timeout sweep
const sweepDemoResults = AssignmentEngine.checkAndExpireTimedOutOffers(120);
assert(sweepDemoResults.length > 0, "Sweep detected expired offer for Amit Patel");

const expiredAmitOffer = db.prepare("SELECT status FROM job_offers WHERE offer_id = ?").get(amitOfferId) as any;
assert(expiredAmitOffer.status === "EXPIRED", "Amit Patel offer status updated to EXPIRED");
console.log("✓ Amit Patel offer marked EXPIRED");

console.log("[3/3] Verifying immediate automatic reassignment to next nearest technician...");
const amitReplacements = db.prepare("SELECT * FROM job_offers WHERE booking_id = ? AND status = 'OFFERED'").all(amitBookingId) as any[];
assert(amitReplacements.length === 1, "Next qualified technician received offer immediately");
const replacementOffer = amitReplacements[0];
assert(replacementOffer.technician_id !== "USR_TECH_02", "Reassigned technician is NOT Amit Patel");

const nextTechUser = db.prepare("SELECT full_name FROM users WHERE user_id = ?").get(replacementOffer.technician_id) as any;
console.log(`✓ Job immediately reassigned to next nearest qualified specialist: ${nextTechUser.full_name} (${replacementOffer.technician_id})`);

const updatedBooking = db.prepare("SELECT booking_status, assigned_technician_id FROM bookings WHERE booking_id = ?").get(amitBookingId) as any;
assert(updatedBooking.booking_status === "OFFERED", "Booking status remains OFFERED with new candidate");
assert(updatedBooking.assigned_technician_id === replacementOffer.technician_id, "Booking assigned_technician_id updated to next specialist");
console.log(`✓ Booking assigned_technician_id updated to ${nextTechUser.full_name}`);

console.log("\n=======================================================");
console.log("  ✓ ALL 2-MINUTE TIMER & AUTO-REASSIGN TESTS PASSED!   ");
console.log("=======================================================\n");

