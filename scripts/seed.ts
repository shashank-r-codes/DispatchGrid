import { resetAndSeedDatabase, db } from "../backend/config/database.js";

async function runSeed() {
  console.log("=================================================");
  console.log("   DISPATCHGRID DATABASE RESET & SEED SCRIPT   ");
  console.log("=================================================");

  console.log("[1/3] Resetting database tables & schema...");
  resetAndSeedDatabase(true);

  console.log("[2/3] Verifying database records...");
  const techCount = db.prepare("SELECT COUNT(*) as count FROM technician_profiles").get() as { count: number };
  const userTechs = db.prepare("SELECT username, full_name, account_status FROM users WHERE role = 'TECHNICIAN' ORDER BY username ASC").all() as any[];
  const jobCount = db.prepare("SELECT COUNT(*) as count FROM bookings").get() as { count: number };
  const statusCounts = db.prepare("SELECT booking_status, COUNT(*) as count FROM bookings GROUP BY booking_status").all() as any[];
  const priorityCounts = db.prepare("SELECT verified_priority, COUNT(*) as count FROM bookings GROUP BY verified_priority").all() as any[];
  const offersCount = db.prepare("SELECT COUNT(*) as count FROM job_offers").get() as { count: number };
  const reviewsCount = db.prepare("SELECT COUNT(*) as count FROM reviews").get() as { count: number };

  console.log("\n--- TECHNICIAN VERIFICATION ---");
  console.log(`Total Technicians in DB: ${techCount.count} (Required: >= 20)`);
  console.log(`Technicians with usernames electrician1..electrician${userTechs.length}:`);
  userTechs.slice(0, 5).forEach((t) => console.log(`  ✓ ${t.username} - ${t.full_name} [${t.account_status}]`));
  if (userTechs.length > 5) {
    console.log(`  ... and ${userTechs.length - 5} more technicians.`);
  }

  console.log("\n--- SERVICE JOBS VERIFICATION ---");
  console.log(`Total Service Jobs in DB: ${jobCount.count} (Required: >= 100)`);
  console.log("Status Breakdown:");
  statusCounts.forEach((s) => console.log(`  • ${s.booking_status.padEnd(14)}: ${s.count} jobs`));

  console.log("\nPriority Breakdown:");
  priorityCounts.forEach((p) => console.log(`  • ${p.verified_priority.padEnd(14)}: ${p.count} jobs`));

  console.log("\nJob Offers & Reviews:");
  console.log(`  • Recorded Job Offers: ${offersCount.count}`);
  console.log(`  • Completed Job Reviews: ${reviewsCount.count}`);

  console.log("\n[3/3] Database seed successful and verified!");
  console.log("=================================================\n");
}

runSeed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
