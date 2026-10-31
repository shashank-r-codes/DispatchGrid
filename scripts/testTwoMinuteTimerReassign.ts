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

// 5. Verify customer notification & history
console.log("\n[4/4] Verifying customer notification & audit history...");
const notifs = db.prepare("SELECT * FROM notifications WHERE reference_id = ? ORDER BY created_at DESC").all(testBookingId) as any[];
assert(notifs.some(n => n.type === "REALLOCATION" || n.title.includes("Finding another technician")), "Customer received automatic reallocation notification");
console.log(`✓ Customer notified: Finding another suitable technician automatically`);

console.log("\n=======================================================");
console.log("  ✓ ALL 2-MINUTE TIMER & AUTO-REASSIGN TESTS PASSED!   ");
console.log("=======================================================\n");
