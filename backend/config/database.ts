import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { METRO_NODES } from "./roadNetwork.js";
import { SEED_TECHNICIANS } from "./seedData.js";
import { generateSeedJobs } from "./seedJobs.js";
import { randomUUID } from "crypto";

const dbPath = path.resolve(process.cwd(), "dispatchgrid.db");
export const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase(autoSeed = true) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CUSTOMER', 'TECHNICIAN', 'ADMIN')),
      account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
      profile_picture_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_profiles (
      customer_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      profile_picture_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      address_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'Home',
      address_line TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technician_profiles (
      technician_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      experience_years INTEGER NOT NULL DEFAULT 1,
      service_categories TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      verification_notes TEXT,
      verified_at TEXT,
      residential_address TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      current_latitude REAL NOT NULL,
      current_longitude REAL NOT NULL,
      service_areas TEXT NOT NULL,
      availability_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(availability_status IN ('AVAILABLE', 'BUSY', 'UNAVAILABLE', 'ON_BREAK')),
      working_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
      shift_start_time TEXT NOT NULL DEFAULT '08:00',
      shift_end_time TEXT NOT NULL DEFAULT '18:00',
      reserved_emergency_capacity TEXT DEFAULT '11:00-11:30',
      total_completed_jobs INTEGER NOT NULL DEFAULT 0,
      average_rating REAL NOT NULL DEFAULT 5.0,
      profile_picture_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skills (
      skill_id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('Electrical', 'AC', 'Plumbing')),
      skill_name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS certifications (
      certification_id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('Electrical', 'AC', 'Plumbing')),
      certification_name TEXT NOT NULL UNIQUE,
      issuing_authority TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technician_skills (
      technician_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      years_experience INTEGER DEFAULT 1,
      PRIMARY KEY (technician_id, skill_id),
      FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technician_certifications (
      id TEXT PRIMARY KEY,
      technician_id TEXT NOT NULL,
      certification_id TEXT NOT NULL,
      certificate_number TEXT,
      expiry_date TEXT,
      FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (certification_id) REFERENCES certifications(certification_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      service_id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Electrical', 'AC', 'Plumbing')),
      description TEXT NOT NULL,
      estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,
      indicative_price REAL NOT NULL DEFAULT 49.99,
      required_skills TEXT NOT NULL,
      required_certifications TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      booking_id TEXT PRIMARY KEY,
      booking_reference TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      notes TEXT,
      unassigned_reason TEXT,
      service_id TEXT NOT NULL,
      assigned_technician_id TEXT,
      requested_priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(requested_priority IN ('NORMAL', 'HIGH', 'EMERGENCY')),
      verified_priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(verified_priority IN ('NORMAL', 'HIGH', 'EMERGENCY')),
      priority_verified_by TEXT,
      booking_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(booking_status IN (
        'PENDING', 'OFFERED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'UNASSIGNED',
        'REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'REJECTED'
      )),
      problem_description TEXT NOT NULL,
      photo_url TEXT,
      service_address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      node_id TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_start_time TEXT NOT NULL,
      preferred_end_time TEXT NOT NULL,
      alternative_window TEXT,
      preferred_technician_id TEXT,
      confirmed_start_time TEXT,
      confirmed_end_time TEXT,
      estimated_travel_time_minutes INTEGER DEFAULT 0,
      actual_start_time TEXT,
      actual_end_time TEXT,
      completion_notes TEXT,
      cancellation_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (service_id) REFERENCES services(service_id),
      FOREIGN KEY (assigned_technician_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS job_offers (
      offer_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      technician_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OFFERED' CHECK(status IN ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN')),
      rejection_reason TEXT,
      offered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
      travel_minutes INTEGER DEFAULT 0,
      distance_km REAL DEFAULT 0.0,
      score REAL DEFAULT 0.0,
      attempt_number INTEGER DEFAULT 1,
      scheduling_run_id TEXT,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS booking_status_history (
      history_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL,
      change_reason TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS booking_admin_notes (
      note_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      admin_user_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignment_records (
      record_id TEXT PRIMARY KEY,
      scheduling_run_id TEXT NOT NULL,
      booking_id TEXT NOT NULL,
      assigned_technician_id TEXT NOT NULL,
      calculated_travel_time_minutes INTEGER NOT NULL,
      assignment_score REAL NOT NULL,
      selection_reason TEXT NOT NULL,
      evaluated_candidates TEXT NOT NULL,
      rejected_alternatives TEXT NOT NULL,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recovery_audit_logs (
      recovery_id TEXT PRIMARY KEY,
      disruption_type TEXT NOT NULL,
      affected_technician_id TEXT,
      affected_booking_ids TEXT NOT NULL,
      previous_assignments TEXT NOT NULL,
      revised_assignments TEXT NOT NULL,
      reason TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
      notifications_sent TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      review_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      technician_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      service_quality_tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      recipient_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for preexisting databases
  try { db.exec("ALTER TABLE users ADD COLUMN username TEXT;"); } catch {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN profile_picture_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE technician_profiles ADD COLUMN profile_picture_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE customer_profiles ADD COLUMN profile_picture_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN customer_name TEXT;"); } catch {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN customer_phone TEXT;"); } catch {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN notes TEXT;"); } catch {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN unassigned_reason TEXT;"); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_job_offers_tech ON job_offers(technician_id, status);"); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_job_offers_booking ON job_offers(booking_id, status);"); } catch {}
  try { db.exec("ALTER TABLE job_offers ADD COLUMN attempt_number INTEGER DEFAULT 1;"); } catch {}
  try { db.exec("ALTER TABLE job_offers ADD COLUMN scheduling_run_id TEXT;"); } catch {}

  // Check if initial full seed is needed
  if (autoSeed) {
    const techCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'TECHNICIAN'").get() as { count: number };
    if (techCount.count < 20) {
      resetAndSeedDatabase(true);
    }
  }
}

export function resetAndSeedDatabase(force = false) {
  if (force) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS reviews;
      DROP TABLE IF EXISTS recovery_audit_logs;
      DROP TABLE IF EXISTS assignment_records;
      DROP TABLE IF EXISTS booking_admin_notes;
      DROP TABLE IF EXISTS booking_status_history;
      DROP TABLE IF EXISTS job_offers;
      DROP TABLE IF EXISTS bookings;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS customer_addresses;
      DROP TABLE IF EXISTS customer_profiles;
      DROP TABLE IF EXISTS technician_certifications;
      DROP TABLE IF EXISTS technician_skills;
      DROP TABLE IF EXISTS technician_profiles;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS services;
      DROP TABLE IF EXISTS certifications;
      DROP TABLE IF EXISTS skills;
      PRAGMA foreign_keys = ON;
    `);
  }
  initDatabase(false);
  console.log("[DispatchGrid] Initializing and seeding comprehensive workforce dataset...");

  const baseDate = new Date().toISOString().split("T")[0];

  const seedTx = db.transaction(() => {

    // 1. Core Skills
    const insertSkill = db.prepare("INSERT OR IGNORE INTO skills (skill_id, category, skill_name, description) VALUES (?, ?, ?, ?)");
    insertSkill.run("SK_E_01", "Electrical", "Wiring", "Residential & commercial electrical wiring and conduit installation");
    insertSkill.run("SK_E_02", "Electrical", "Electrical fault diagnosis", "Short circuit, earthing, and insulation failure detection");
    insertSkill.run("SK_E_03", "Electrical", "Switchboard repair", "Distribution board overhaul, MCB and RCCB replacements");
    insertSkill.run("SK_E_04", "Electrical", "Circuit breaker installation", "Heavy duty industrial and home trip-switch configuration");
    insertSkill.run("SK_E_05", "Electrical", "Fan installation and repair", "Ceiling and exhaust fan mounting, speed regulator setup");
    insertSkill.run("SK_E_06", "Electrical", "Lighting installation", "LED spotlights, chandelier wiring, smart dimmer setups");

    insertSkill.run("SK_AC_01", "AC", "AC installation", "Split and multi-split indoor/outdoor unit mounting and piping");
    insertSkill.run("SK_AC_02", "AC", "AC servicing", "Coil chemical wash, filter deep cleaning, blower balancing");
    insertSkill.run("SK_AC_03", "AC", "Refrigerant handling", "R32 and R410A vacuum testing, leak detection and gas top-up");
    insertSkill.run("SK_AC_04", "AC", "Compressor repair", "Inverter inverter PCB and rotary compressor replacement");
    insertSkill.run("SK_AC_05", "AC", "AC troubleshooting", "Thermostat sensor malfunction, cooling drop diagnosis");

    insertSkill.run("SK_P_01", "Plumbing", "Pipe leakage repair", "CPVC/PPR pipe repair, concealed leak acoustic tracing");
    insertSkill.run("SK_P_02", "Plumbing", "Tap installation", "Mixer taps, angle valves, fixture seating and sealant");
    insertSkill.run("SK_P_03", "Plumbing", "Drainage maintenance", "Hydro-jet drain unclogging, grease trap remediation");
    insertSkill.run("SK_P_04", "Plumbing", "Water pump repair", "Submersible pump capacitor, impeller, and pressure switch");
    insertSkill.run("SK_P_05", "Plumbing", "Pipeline installation", "Main overhead tank to manifold plumbing layout");

    // 2. Core Certifications
    const insertCert = db.prepare("INSERT OR IGNORE INTO certifications (certification_id, category, certification_name, issuing_authority) VALUES (?, ?, ?, ?)");
    insertCert.run("CERT_E_01", "Electrical", "Licensed Electrical Contractor (Wireman Grade A)", "State Electrical Licensing Board");
    insertCert.run("CERT_E_02", "Electrical", "Certified High Voltage Safety Inspector", "National Safety Council");
    insertCert.run("CERT_AC_01", "AC", "EPA Section 608 Universal Certification", "Environmental Protection Agency");
    insertCert.run("CERT_AC_02", "AC", "HVAC Excellence Master Specialist", "HVAC Excellence Org");
    insertCert.run("CERT_P_01", "Plumbing", "Licensed Master Plumber (LMP)", "Plumbing Standards Authority");
    insertCert.run("CERT_P_02", "Plumbing", "Backflow Prevention & Pressure Safety", "Water Works Board");

    // 3. Service Catalogue (with strict required certifications)
    const insertService = db.prepare(`
      INSERT OR REPLACE INTO services (service_id, service_name, category, description, estimated_duration_minutes, indicative_price, required_skills, required_certifications, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertService.run("SRV_E_01", "Wiring and Rewiring", "Electrical", "Complete apartment or office circuit rewire with fire-resistant conduit", 90, 89.0, JSON.stringify(["Wiring"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
    insertService.run("SRV_E_02", "Switchboard Repair & Upgrade", "Electrical", "Repair sparking switchboard, replace faulty modular sockets and switches", 45, 39.0, JSON.stringify(["Switchboard repair"]), JSON.stringify([]));
    insertService.run("SRV_E_03", "Circuit Breaker Installation", "Electrical", "Install Siemens/Schneider RCCB trip-switches for surge protection", 60, 59.0, JSON.stringify(["Circuit breaker installation"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
    insertService.run("SRV_E_04", "Electrical Fault Emergency Diagnosis", "Electrical", "Rapid pinpointing of short circuit trips and burnt neutral wire failures", 60, 75.0, JSON.stringify(["Electrical fault diagnosis"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
    insertService.run("SRV_E_05", "Fan Installation & Repair", "Electrical", "Mount BLDC energy-saving ceiling fan with balanced blade tuning", 45, 35.0, JSON.stringify(["Fan installation and repair"]), JSON.stringify([]));
    insertService.run("SRV_E_06", "Architectural Lighting Installation", "Electrical", "Concealed profile lighting, track spots, and chandelier mounting", 60, 65.0, JSON.stringify(["Lighting installation"]), JSON.stringify([]));

    insertService.run("SRV_AC_01", "AC Inverter Installation", "AC", "Professional indoor and copper refrigerant line vacuum mounting", 120, 119.0, JSON.stringify(["AC installation"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
    insertService.run("SRV_AC_02", "AC Chemical Deep Servicing", "AC", "Full outdoor and indoor jet pump coil wash, bacterial sanitation", 60, 55.0, JSON.stringify(["AC servicing"]), JSON.stringify([]));
    insertService.run("SRV_AC_03", "AC Gas Refilling & Leak Repair", "AC", "Pressure leak testing with nitrogen, vacuuming, and pure R32/R410A top-up", 75, 85.0, JSON.stringify(["Refrigerant handling"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
    insertService.run("SRV_AC_04", "AC Cooling Drop Troubleshooting", "AC", "Diagnostic of sensor drift, PCB capacitor issue, or capillary blockage", 60, 69.0, JSON.stringify(["AC troubleshooting"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
    insertService.run("SRV_AC_05", "Compressor Overhaul & Repair", "AC", "Heavy duty compressor replacement and inverter motor calibration", 120, 160.0, JSON.stringify(["Compressor repair"]), JSON.stringify(["HVAC Excellence Master Specialist"]));
    insertService.run("SRV_AC_06", "Seasonal AC Preventive Maintenance", "AC", "Comprehensive amp draw check, drain line blow out, and thermostat calibration", 60, 49.0, JSON.stringify(["AC servicing", "AC troubleshooting"]), JSON.stringify([]));

    insertService.run("SRV_P_01", "Pipe Leakage Detection & Repair", "Plumbing", "Concealed wall acoustic leak finding and pipe replacement", 60, 59.0, JSON.stringify(["Pipe leakage repair"]), JSON.stringify([]));
    insertService.run("SRV_P_02", "Designer Tap & Fixture Installation", "Plumbing", "Install premium single-lever mixer taps and diverter fixtures", 45, 39.0, JSON.stringify(["Tap installation"]), JSON.stringify([]));
    insertService.run("SRV_P_03", "Drainage High-Pressure Unblocking", "Plumbing", "Electro-mechanical snake and high-pressure jet unblocking of choked drains", 75, 79.0, JSON.stringify(["Drainage maintenance"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));
    insertService.run("SRV_P_04", "Water Pump Repair & Pressure Tank", "Plumbing", "Fix dry-run burnouts, pressure sensor calibration, and automatic float switches", 90, 89.0, JSON.stringify(["Water pump repair"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));
    insertService.run("SRV_P_05", "Fresh Pipeline Layout Installation", "Plumbing", "CPVC water supply loop installation for bathrooms and kitchens", 120, 149.0, JSON.stringify(["Pipeline installation"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));

    // 4. Admin and Customer Seed Users
    const adminHash = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT OR REPLACE INTO users (user_id, username, full_name, email, phone, password_hash, role, account_status)
      VALUES (?, ?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE')
    `).run("USR_ADMIN_01", "admin", "Alex Mercer (Chief Dispatcher)", "admin@dispatchgrid.demo", "+91-98000-00001", adminHash);

    const customerHash = bcrypt.hashSync("12345", 10);
    db.prepare(`
      INSERT OR REPLACE INTO users (user_id, username, full_name, email, phone, password_hash, role, account_status)
      VALUES (?, ?, ?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')
    `).run("USR_CUST_DEMO", "customer", "David Miller (Valued Customer)", "customer@dispatchgrid.demo", "+91-98800-00001", customerHash);

    db.prepare(`
      INSERT OR REPLACE INTO customer_profiles (customer_id, user_id)
      VALUES (?, ?)
    `).run("CP_DEMO_01", "USR_CUST_DEMO");

    db.prepare(`
      INSERT OR REPLACE INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
      VALUES (?, ?, 'Primary Residence', ?, ?, ?, ?, ?, ?, 1)
    `).run("ADDR_DEMO_01", "USR_CUST_DEMO", "100 Indiranagar 12th Main", "Bengaluru", "Karnataka", "560038", 12.9784, 77.6408);

    // 5. Seed Exactly 20 Technicians (username: electrician1 .. electrician20, password: 12345)
    const techPasswordHash = bcrypt.hashSync("12345", 10);

    const insertUserStmt = db.prepare(`
      INSERT OR REPLACE INTO users (user_id, username, full_name, email, phone, password_hash, role, account_status)
      VALUES (?, ?, ?, ?, ?, ?, 'TECHNICIAN', 'ACTIVE')
    `);

    const insertTechProfileStmt = db.prepare(`
      INSERT OR REPLACE INTO technician_profiles (
        technician_id, user_id, experience_years, service_categories, verification_status,
        verification_notes, verified_at, residential_address, city, pincode,
        current_latitude, current_longitude, service_areas, availability_status,
        working_days, shift_start_time, shift_end_time, reserved_emergency_capacity,
        total_completed_jobs, average_rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTechSkillStmt = db.prepare("INSERT OR REPLACE INTO technician_skills (technician_id, skill_id, years_experience) VALUES (?, ?, ?)");
    const insertTechCertStmt = db.prepare("INSERT OR REPLACE INTO technician_certifications (id, technician_id, certification_id, certificate_number, expiry_date) VALUES (?, ?, ?, ?, ?)");

    // Lookup skill IDs and cert IDs by name
    const allSkills = db.prepare("SELECT skill_id, skill_name FROM skills").all() as { skill_id: string; skill_name: string }[];
    const skillMap = new Map(allSkills.map(s => [s.skill_name.toLowerCase(), s.skill_id]));

    const allCerts = db.prepare("SELECT certification_id, certification_name FROM certifications").all() as { certification_id: string; certification_name: string }[];
    const certMap = new Map(allCerts.map(c => [c.certification_name.toLowerCase(), c.certification_id]));

    SEED_TECHNICIANS.forEach((tDef, idx) => {
      const uId = `USR_TECH_${String(idx + 1).padStart(2, "0")}`;
      const tpId = `TP_${String(idx + 1).padStart(2, "0")}`;

      insertUserStmt.run(uId, tDef.username, tDef.fullName, tDef.email, tDef.phone, techPasswordHash);

      insertTechProfileStmt.run(
        tpId,
        uId,
        tDef.experienceYears,
        tDef.categories.join(","),
        tDef.verificationStatus,
        `Verified professional qualifications: ${tDef.certifications.join(", ")}`,
        "2026-01-10T09:00:00Z",
        tDef.address,
        "Bengaluru",
        "560001",
        tDef.lat,
        tDef.lng,
        JSON.stringify(tDef.serviceAreas),
        tDef.availability,
        tDef.workingDays.join(","),
        tDef.shiftStart,
        tDef.shiftEnd,
        "11:00-11:30",
        tDef.completedJobs,
        tDef.rating
      );

      // Link skills
      for (const skName of tDef.skills) {
        const sId = skillMap.get(skName.toLowerCase());
        if (sId) {
          insertTechSkillStmt.run(uId, sId, tDef.experienceYears);
        }
      }

      // Link certifications
      for (const ctName of tDef.certifications) {
        const cId = certMap.get(ctName.toLowerCase());
        if (cId) {
          insertTechCertStmt.run(`TC_${uId}_${cId}`, uId, cId, `DG-CERT-${idx + 1001}`, "2029-12-31");
        }
      }
    });

    // 6. Generate 105+ Diverse Service Jobs
    const seedJobs = generateSeedJobs(baseDate);

    const insertBookingStmt = db.prepare(`
      INSERT OR REPLACE INTO bookings (
        booking_id, booking_reference, customer_id, customer_name, customer_phone, notes, unassigned_reason,
        service_id, assigned_technician_id, requested_priority, verified_priority,
        priority_verified_by, booking_status, problem_description, service_address,
        latitude, longitude, node_id, preferred_date, preferred_start_time, preferred_end_time,
        confirmed_start_time, confirmed_end_time, estimated_travel_time_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOfferStmt = db.prepare(`
      INSERT OR REPLACE INTO job_offers (offer_id, booking_id, technician_id, status, travel_minutes, distance_km, score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHistoryStmt = db.prepare(`
      INSERT OR REPLACE INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertReviewStmt = db.prepare(`
      INSERT OR REPLACE INTO reviews (review_id, booking_id, customer_id, technician_id, rating, comment, service_quality_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Username to user_id lookup
    const techUserMap = new Map<string, string>();
    for (let i = 1; i <= 20; i++) {
      techUserMap.set(`electrician${i}`, `USR_TECH_${String(i).padStart(2, "0")}`);
    }

    seedJobs.forEach((j, idx) => {
      const assignedTechId = j.assignedTechUsername ? techUserMap.get(j.assignedTechUsername) || null : null;
      const isScheduledOrActive = ["ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(j.bookingStatus);
      const confStart = isScheduledOrActive ? `${j.preferredDate}T${j.preferredStartTime}:00Z` : null;
      const confEnd = isScheduledOrActive ? `${j.preferredDate}T${j.preferredEndTime}:00Z` : null;

      // Assign a rich variety of 7 bookings to the demo customer account
      const isDemoCustomerJob = [0, 6, 12, 19, 27, 34, 45].includes(idx);
      const custId = isDemoCustomerJob ? "USR_CUST_DEMO" : null;
      const cName = isDemoCustomerJob ? "David Miller (Valued Customer)" : j.customerName;
      const cPhone = isDemoCustomerJob ? "+91-98800-00001" : j.customerPhone;

      insertBookingStmt.run(
        j.bookingId,
        j.bookingReference,
        custId,
        cName,
        cPhone,
        j.notes || null,
        j.unassignedReason || null,
        j.serviceId,
        assignedTechId,
        j.requestedPriority,
        j.verifiedPriority,
        assignedTechId ? "USR_ADMIN_01" : null,
        j.bookingStatus,
        j.problemDescription,
        j.serviceAddress,
        j.lat,
        j.lng,
        j.nodeId,
        j.preferredDate,
        j.preferredStartTime,
        j.preferredEndTime,
        confStart,
        confEnd,
        j.travelMinutes || 0
      );

      // Record offer if job is OFFERED or ASSIGNED
      if (j.bookingStatus === "OFFERED" && assignedTechId) {
        insertOfferStmt.run(`OFFER_${j.bookingId}`, j.bookingId, assignedTechId, "OFFERED", j.travelMinutes || 15, 6.2, 0.18);
        insertHistoryStmt.run(`H_${j.bookingId}_OFFER`, j.bookingId, "PENDING", "OFFERED", "SYSTEM_DISPATCH_ENGINE", "Auto-dispatched offer to highest ranked specialist");
      } else if (isScheduledOrActive && assignedTechId) {
        insertOfferStmt.run(`OFFER_${j.bookingId}`, j.bookingId, assignedTechId, "ACCEPTED", j.travelMinutes || 15, 5.0, 0.12);
        insertHistoryStmt.run(`H_${j.bookingId}_ASSIGN`, j.bookingId, "OFFERED", "ASSIGNED", assignedTechId, "Technician accepted assignment");
      }

      // Review if completed
      if (j.bookingStatus === "COMPLETED" && j.customerReview && assignedTechId) {
        insertReviewStmt.run(
          `REV_${j.bookingId}`,
          j.bookingId,
          isDemoCustomerJob ? "USR_CUST_DEMO" : null,
          assignedTechId,
          j.customerReview.rating,
          j.customerReview.comment,
          j.customerReview.tags
        );
      }
    });

    // 7. Seed Initial Notifications
    const insertNotifStmt = db.prepare(`
      INSERT OR REPLACE INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertNotifStmt.run("NOTIF_01", "USR_CUST_DEMO", "Booking Confirmed", "Your service booking DG-2026-101 has been assigned to Rajesh Kumar.", "BOOKING_UPDATE", "DG-2026-101", 0);
    insertNotifStmt.run("NOTIF_02", "USR_CUST_DEMO", "Technician Dispatched", "Technician is on the way for booking DG-2026-107. Estimated arrival in 18 minutes.", "DISPATCH", "DG-2026-107", 0);
    insertNotifStmt.run("NOTIF_03", "USR_TECH_01", "New Job Offer Dispatched", "New high-priority wiring repair offer assigned in CBD / Central zone.", "JOB_OFFER", "BOOK_ELEC_01", 0);
    insertNotifStmt.run("NOTIF_04", "USR_ADMIN_01", "Disruption Auto-Recovered", "Technician reported delay handled smoothly via Dijkstra re-optimization.", "RECOVERY", "REC_AUTO_01", 1);

    console.log(`[DispatchGrid] Seed complete: 20 Technicians & ${seedJobs.length} Service Jobs successfully populated.`);
  });

  seedTx();
}
