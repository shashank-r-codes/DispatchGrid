import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { METRO_NODES } from "./roadNetwork.js";

const dbPath = path.resolve(process.cwd(), "dispatchgrid.db");
export const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CUSTOMER', 'TECHNICIAN', 'ADMIN')),
      account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
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
      customer_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      assigned_technician_id TEXT,
      requested_priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(requested_priority IN ('NORMAL', 'HIGH', 'EMERGENCY')),
      verified_priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(verified_priority IN ('NORMAL', 'HIGH', 'EMERGENCY')),
      priority_verified_by TEXT,
      booking_status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(booking_status IN (
        'REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'SCHEDULED', 'TECHNICIAN_ACCEPTED',
        'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'
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
      FOREIGN KEY (customer_id) REFERENCES users(user_id),
      FOREIGN KEY (service_id) REFERENCES services(service_id),
      FOREIGN KEY (assigned_technician_id) REFERENCES users(user_id)
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
      customer_id TEXT NOT NULL,
      technician_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      service_quality_tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
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

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) return; // Already seeded

  console.log("Seeding DispatchGrid production-grade initial dataset...");

  const hash = bcrypt.hashSync("password123", 10);
  const adminHash = bcrypt.hashSync("admin123", 10);

  // 1. Users
  const insertUser = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, role, account_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  insertUser.run("USR_ADMIN_01", "Chief Dispatcher Alex Mercer", "admin@dispatchgrid.io", "+1-555-010-0001", adminHash, "ADMIN", "ACTIVE");

  // Customers
  insertUser.run("USR_CUST_01", "David Miller", "customer@example.com", "+1-555-011-1001", hash, "CUSTOMER", "ACTIVE");
  insertUser.run("USR_CUST_02", "Elena Rostova", "elena@example.com", "+1-555-011-1002", hash, "CUSTOMER", "ACTIVE");
  insertUser.run("USR_CUST_03", "Marcus Vance", "marcus@example.com", "+1-555-011-1003", hash, "CUSTOMER", "ACTIVE");

  // Technicians
  // Tech 1: Rajesh Kumar - General Electrical Specialist (No AC certification)
  insertUser.run("USR_TECH_01", "Rajesh Kumar", "rajesh.elec@dispatchgrid.io", "+1-555-012-2001", hash, "TECHNICIAN", "ACTIVE");
  // Tech 2: Amit Patel - Dedicated AC & HVAC Master (Certified)
  insertUser.run("USR_TECH_02", "Amit Patel", "amit.ac@dispatchgrid.io", "+1-555-012-2002", hash, "TECHNICIAN", "ACTIVE");
  // Tech 3: Suresh Reddy - Senior Master Plumber
  insertUser.run("USR_TECH_03", "Suresh Reddy", "suresh.plumb@dispatchgrid.io", "+1-555-012-2003", hash, "TECHNICIAN", "ACTIVE");
  // Tech 4: Vikram Rao - Dual Electrical & AC Technician (Certified)
  insertUser.run("USR_TECH_04", "Vikram Rao", "vikram.tech@dispatchgrid.io", "+1-555-012-2004", hash, "TECHNICIAN", "ACTIVE");
  // Tech 5: Priya Sharma - Rapid Electrical Tech (Central zone)
  insertUser.run("USR_TECH_05", "Priya Sharma", "priya.elec@dispatchgrid.io", "+1-555-012-2005", hash, "TECHNICIAN", "ACTIVE");
  // Tech 6: Arun Varma - Pending verification applicant (Phase 2 test)
  insertUser.run("USR_TECH_06", "Arun Varma", "arun.pending@dispatchgrid.io", "+1-555-012-2006", hash, "TECHNICIAN", "PENDING");
  // Tech 7: Sunil Mehta - Rejected applicant (Phase 2 test)
  insertUser.run("USR_TECH_07", "Sunil Mehta", "sunil.rej@dispatchgrid.io", "+1-555-012-2007", hash, "TECHNICIAN", "REJECTED");

  // Customer Profiles & Addresses
  const insertCustProfile = db.prepare("INSERT INTO customer_profiles (customer_id, user_id) VALUES (?, ?)");
  insertCustProfile.run("CP_01", "USR_CUST_01");
  insertCustProfile.run("CP_02", "USR_CUST_02");
  insertCustProfile.run("CP_03", "USR_CUST_03");

  const insertAddr = db.prepare(`
    INSERT INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAddr.run("ADDR_01", "USR_CUST_01", "Home Villa", "742 Evergreen Terrace, Koramangala 4th Block", "Bengaluru", "Karnataka", "560034", 12.9352, 77.6245, 1);
  insertAddr.run("ADDR_02", "USR_CUST_01", "Design Studio", "Unit 402, Indiranagar 100ft Road", "Bengaluru", "Karnataka", "560038", 12.9840, 77.6632, 0);
  insertAddr.run("ADDR_03", "USR_CUST_02", "Apartment", "Skyline Heights, Hebbal Flyover Outer", "Bengaluru", "Karnataka", "560024", 13.0358, 77.5970, 1);
  insertAddr.run("ADDR_04", "USR_CUST_03", "Downtown Loft", "Brigade Road Central Promenade", "Bengaluru", "Karnataka", "560001", 12.9716, 77.5946, 1);

  // Technician Profiles
  const insertTechProfile = db.prepare(`
    INSERT INTO technician_profiles (
      technician_id, user_id, experience_years, service_categories, verification_status,
      verification_notes, verified_at, residential_address, city, pincode, current_latitude,
      current_longitude, service_areas, availability_status, working_days, shift_start_time,
      shift_end_time, reserved_emergency_capacity, total_completed_jobs, average_rating
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTechProfile.run(
    "TP_01", "USR_TECH_01", 8, "Electrical", "APPROVED",
    "Verified electrical trade license. High reliability rating.", "2026-01-15T09:00:00Z",
    "45 Malleshwaram 7th Cross", "Bengaluru", "560003", 12.9780, 77.5450,
    JSON.stringify(["Rajajinagar / West", "CBD / Central", "Hebbal / North"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri,Sat", "08:00", "18:00", "11:00-11:30", 142, 4.92
  );

  insertTechProfile.run(
    "TP_02", "USR_TECH_02", 7, "AC", "APPROVED",
    "Certified HVAC Specialist with EPA 608 Universal and R32 refrigerant handler license.", "2026-02-10T10:30:00Z",
    "12 Indiranagar 12th Main", "Bengaluru", "560038", 12.9840, 77.6632,
    JSON.stringify(["Indiranagar / East", "Kalyan Nagar", "Whitefield Outer", "CBD / Central"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri,Sat", "08:00", "18:00", "11:00-11:30", 188, 4.95
  );

  insertTechProfile.run(
    "TP_03", "USR_TECH_03", 10, "Plumbing", "APPROVED",
    "Master Plumber certification verified. Expert in high-pressure lines and drainage.", "2026-01-20T11:00:00Z",
    "88 Jayanagar 4th T Block", "Bengaluru", "560041", 12.9250, 77.5938,
    JSON.stringify(["Jayanagar / South", "Banashankari", "Koramangala", "CBD / Central"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri,Sat", "08:00", "18:00", "11:00-11:30", 215, 4.88
  );

  insertTechProfile.run(
    "TP_04", "USR_TECH_04", 6, "Electrical,AC", "APPROVED",
    "Dual accredited in electrical switchgear and AC inverter compressor diagnostics.", "2026-03-05T14:00:00Z",
    "20 Koramangala 80ft Road", "Bengaluru", "560095", 12.9352, 77.6245,
    JSON.stringify(["Koramangala", "Indiranagar / East", "CBD / Central", "Electronic City South"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri,Sat", "08:00", "18:00", "11:00-11:30", 98, 4.85
  );

  insertTechProfile.run(
    "TP_05", "USR_TECH_05", 5, "Electrical", "APPROVED",
    "Rapid electrical deployment technician specializing in urgent fault diagnosis.", "2026-03-12T09:30:00Z",
    "9 MG Road Metro Circle", "Bengaluru", "560001", 12.9716, 77.5946,
    JSON.stringify(["CBD / Central", "Indiranagar / East", "Jayanagar / South", "Rajajinagar / West"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri,Sat", "08:00", "18:00", "14:00-14:30", 76, 4.90
  );

  insertTechProfile.run(
    "TP_06", "USR_TECH_06", 3, "AC", "PENDING",
    "Application pending certification document audit and background verification.", null,
    "15 Hebbal Lake Road", "Bengaluru", "560024", 13.0358, 77.5970,
    JSON.stringify(["Hebbal / North", "Kalyan Nagar"]), "AVAILABLE",
    "Mon,Tue,Wed,Thu,Fri", "09:00", "17:00", "11:00-11:30", 0, 5.0
  );

  insertTechProfile.run(
    "TP_07", "USR_TECH_07", 2, "Plumbing", "REJECTED",
    "Failed practical plumbing pressure test and expired municipal permit.", null,
    "3 Banashankari 3rd Stage", "Bengaluru", "560085", 12.9120, 77.5560,
    JSON.stringify(["Banashankari"]), "UNAVAILABLE",
    "Mon,Tue,Wed,Thu,Fri", "09:00", "17:00", "11:00-11:30", 0, 0
  );

  // Skills
  const insertSkill = db.prepare("INSERT INTO skills (skill_id, category, skill_name, description) VALUES (?, ?, ?, ?)");
  // Electrical Skills
  insertSkill.run("SK_E_01", "Electrical", "Wiring", "Residential & commercial electrical wiring and conduit installation");
  insertSkill.run("SK_E_02", "Electrical", "Electrical fault diagnosis", "Short circuit, earthing, and insulation failure detection");
  insertSkill.run("SK_E_03", "Electrical", "Switchboard repair", "Distribution board overhaul, MCB and RCCB replacements");
  insertSkill.run("SK_E_04", "Electrical", "Circuit breaker installation", "Heavy duty industrial and home trip-switch configuration");
  insertSkill.run("SK_E_05", "Electrical", "Fan installation and repair", "Ceiling and exhaust fan mounting, speed regulator setup");
  insertSkill.run("SK_E_06", "Electrical", "Lighting installation", "LED spotlights, chandelier wiring, smart dimmer setups");

  // AC Skills (Distinct specialization - NOT general electrical!)
  insertSkill.run("SK_AC_01", "AC", "AC installation", "Split and multi-split indoor/outdoor unit mounting and piping");
  insertSkill.run("SK_AC_02", "AC", "AC servicing", "Coil chemical wash, filter deep cleaning, blower balancing");
  insertSkill.run("SK_AC_03", "AC", "Refrigerant handling", "R32 and R410A vacuum testing, leak detection and gas top-up");
  insertSkill.run("SK_AC_04", "AC", "Compressor repair", "Inverter inverter PCB and rotary compressor replacement");
  insertSkill.run("SK_AC_05", "AC", "AC troubleshooting", "Thermostat sensor malfunction, cooling drop diagnosis");

  // Plumbing Skills
  insertSkill.run("SK_P_01", "Plumbing", "Pipe leakage repair", "CPVC/PPR pipe repair, concealed leak acoustic tracing");
  insertSkill.run("SK_P_02", "Plumbing", "Tap installation", "Mixer taps, angle valves, fixture seating and sealant");
  insertSkill.run("SK_P_03", "Plumbing", "Drainage maintenance", "Hydro-jet drain unclogging, grease trap remediation");
  insertSkill.run("SK_P_04", "Plumbing", "Water pump repair", "Submersible pump capacitor, impeller, and pressure switch");
  insertSkill.run("SK_P_05", "Plumbing", "Pipeline installation", "Main overhead tank to manifold plumbing layout");

  // Certifications
  const insertCert = db.prepare("INSERT INTO certifications (certification_id, category, certification_name, issuing_authority) VALUES (?, ?, ?, ?)");
  insertCert.run("CERT_E_01", "Electrical", "Licensed Electrical Contractor (Wireman Grade A)", "State Electrical Licensing Board");
  insertCert.run("CERT_E_02", "Electrical", "Certified High Voltage Safety Inspector", "National Safety Council");
  insertCert.run("CERT_AC_01", "AC", "EPA Section 608 Universal Certification", "Environmental Protection Agency");
  insertCert.run("CERT_AC_02", "AC", "HVAC Excellence Master Specialist", "HVAC Excellence Org");
  insertCert.run("CERT_P_01", "Plumbing", "Licensed Master Plumber (LMP)", "Plumbing Standards Authority");
  insertCert.run("CERT_P_02", "Plumbing", "Backflow Prevention & Pressure Safety", "Water Works Board");

  // Link Skills to Technicians
  const insertTechSkill = db.prepare("INSERT INTO technician_skills (technician_id, skill_id, years_experience) VALUES (?, ?, ?)");
  // Rajesh (Electrician - No AC)
  insertTechSkill.run("USR_TECH_01", "SK_E_01", 8);
  insertTechSkill.run("USR_TECH_01", "SK_E_02", 7);
  insertTechSkill.run("USR_TECH_01", "SK_E_03", 8);
  insertTechSkill.run("USR_TECH_01", "SK_E_04", 6);
  insertTechSkill.run("USR_TECH_01", "SK_E_05", 8);
  insertTechSkill.run("USR_TECH_01", "SK_E_06", 8);

  // Amit (AC Specialist)
  insertTechSkill.run("USR_TECH_02", "SK_AC_01", 7);
  insertTechSkill.run("USR_TECH_02", "SK_AC_02", 7);
  insertTechSkill.run("USR_TECH_02", "SK_AC_03", 6);
  insertTechSkill.run("USR_TECH_02", "SK_AC_04", 5);
  insertTechSkill.run("USR_TECH_02", "SK_AC_05", 7);

  // Suresh (Plumber)
  insertTechSkill.run("USR_TECH_03", "SK_P_01", 10);
  insertTechSkill.run("USR_TECH_03", "SK_P_02", 10);
  insertTechSkill.run("USR_TECH_03", "SK_P_03", 9);
  insertTechSkill.run("USR_TECH_03", "SK_P_04", 8);
  insertTechSkill.run("USR_TECH_03", "SK_P_05", 10);

  // Vikram (Dual Electrical & AC)
  insertTechSkill.run("USR_TECH_04", "SK_E_01", 6);
  insertTechSkill.run("USR_TECH_04", "SK_E_02", 5);
  insertTechSkill.run("USR_TECH_04", "SK_AC_01", 5);
  insertTechSkill.run("USR_TECH_04", "SK_AC_02", 6);
  insertTechSkill.run("USR_TECH_04", "SK_AC_05", 6);

  // Priya (Electrical)
  insertTechSkill.run("USR_TECH_05", "SK_E_01", 5);
  insertTechSkill.run("USR_TECH_05", "SK_E_02", 5);
  insertTechSkill.run("USR_TECH_05", "SK_E_03", 4);

  // Link Certifications
  const insertTechCert = db.prepare("INSERT INTO technician_certifications (id, technician_id, certification_id, certificate_number, expiry_date) VALUES (?, ?, ?, ?, ?)");
  insertTechCert.run("TC_01", "USR_TECH_01", "CERT_E_01", "EL-2021-9981", "2028-12-31");
  insertTechCert.run("TC_02", "USR_TECH_02", "CERT_AC_01", "EPA-608-8837", "2029-06-30");
  insertTechCert.run("TC_03", "USR_TECH_02", "CERT_AC_02", "HVAC-EX-1049", "2027-08-15");
  insertTechCert.run("TC_04", "USR_TECH_03", "CERT_P_01", "MP-2019-4412", "2028-05-20");
  insertTechCert.run("TC_05", "USR_TECH_04", "CERT_AC_01", "EPA-608-3329", "2028-10-10");
  insertTechCert.run("TC_06", "USR_TECH_04", "CERT_E_01", "EL-2022-5501", "2027-11-25");
  insertTechCert.run("TC_07", "USR_TECH_05", "CERT_E_01", "EL-2023-7721", "2029-01-14");

  // Services Catalogue
  const insertService = db.prepare(`
    INSERT INTO services (service_id, service_name, category, description, estimated_duration_minutes, indicative_price, required_skills, required_certifications, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // Electrical Services
  insertService.run("SRV_E_01", "Wiring and Rewiring", "Electrical", "Complete apartment or office circuit rewire with fire-resistant conduit", 90, 89.0, JSON.stringify(["Wiring"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
  insertService.run("SRV_E_02", "Switchboard Repair & Upgrade", "Electrical", "Repair sparking switchboard, replace faulty modular sockets and switches", 45, 39.0, JSON.stringify(["Switchboard repair"]), null);
  insertService.run("SRV_E_03", "Circuit Breaker Installation", "Electrical", "Install Siemens/Schneider RCCB trip-switches for surge protection", 60, 59.0, JSON.stringify(["Circuit breaker installation"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
  insertService.run("SRV_E_04", "Electrical Fault Emergency Diagnosis", "Electrical", "Rapid pinpointing of short circuit trips and burnt neutral wire failures", 60, 75.0, JSON.stringify(["Electrical fault diagnosis"]), JSON.stringify(["Licensed Electrical Contractor (Wireman Grade A)"]));
  insertService.run("SRV_E_05", "Fan Installation & Repair", "Electrical", "Mount BLDC energy-saving ceiling fan with balanced blade tuning", 45, 35.0, JSON.stringify(["Fan installation and repair"]), null);
  insertService.run("SRV_E_06", "Architectural Lighting Installation", "Electrical", "Concealed profile lighting, track spots, and chandelier mounting", 60, 65.0, JSON.stringify(["Lighting installation"]), null);

  // AC Services
  insertService.run("SRV_AC_01", "AC Inverter Installation", "AC", "Professional indoor and copper refrigerant line vacuum mounting", 120, 119.0, JSON.stringify(["AC installation"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
  insertService.run("SRV_AC_02", "AC Chemical Deep Servicing", "AC", "Full outdoor and indoor jet pump coil wash, bacterial sanitation", 60, 55.0, JSON.stringify(["AC servicing"]), null);
  insertService.run("SRV_AC_03", "AC Gas Refilling & Leak Repair", "AC", "Pressure leak testing with nitrogen, vacuuming, and pure R32/R410A top-up", 75, 85.0, JSON.stringify(["Refrigerant handling"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
  insertService.run("SRV_AC_04", "AC Cooling Drop Troubleshooting", "AC", "Diagnostic of sensor drift, PCB capacitor issue, or capillary blockage", 60, 69.0, JSON.stringify(["AC troubleshooting"]), JSON.stringify(["EPA Section 608 Universal Certification"]));
  insertService.run("SRV_AC_05", "Compressor Overhaul & Repair", "AC", "Heavy duty compressor replacement and inverter motor calibration", 120, 160.0, JSON.stringify(["Compressor repair"]), JSON.stringify(["HVAC Excellence Master Specialist"]));
  insertService.run("SRV_AC_06", "Seasonal AC Preventive Maintenance", "AC", "Comprehensive amp draw check, drain line blow out, and thermostat calibration", 60, 49.0, JSON.stringify(["AC servicing", "AC troubleshooting"]), null);

  // Plumbing Services
  insertService.run("SRV_P_01", "Pipe Leakage Detection & Repair", "Plumbing", "Concealed wall acoustic leak finding and pipe replacement", 60, 59.0, JSON.stringify(["Pipe leakage repair"]), null);
  insertService.run("SRV_P_02", "Designer Tap & Fixture Installation", "Plumbing", "Install premium single-lever mixer taps and diverter fixtures", 45, 39.0, JSON.stringify(["Tap installation"]), null);
  insertService.run("SRV_P_03", "Drainage High-Pressure Unblocking", "Plumbing", "Electro-mechanical snake and high-pressure jet unblocking of choked drains", 75, 79.0, JSON.stringify(["Drainage maintenance"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));
  insertService.run("SRV_P_04", "Water Pump Repair & Pressure Tank", "Plumbing", "Fix dry-run burnouts, pressure sensor calibration, and automatic float switches", 90, 89.0, JSON.stringify(["Water pump repair"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));
  insertService.run("SRV_P_05", "Fresh Pipeline Layout Installation", "Plumbing", "CPVC water supply loop installation for bathrooms and kitchens", 120, 149.0, JSON.stringify(["Pipeline installation"]), JSON.stringify(["Licensed Master Plumber (LMP)"]));

  // Seed Initial Bookings
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      booking_id, booking_reference, customer_id, service_id, assigned_technician_id,
      requested_priority, verified_priority, priority_verified_by, booking_status,
      problem_description, service_address, latitude, longitude, node_id,
      preferred_date, preferred_start_time, preferred_end_time,
      confirmed_start_time, confirmed_end_time, estimated_travel_time_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split("T")[0];

  // Booking 1: Scheduled AC deep service for customer 1
  insertBooking.run(
    "BK_001", "DG-2026-901", "USR_CUST_01", "SRV_AC_02", "USR_TECH_02",
    "NORMAL", "NORMAL", "USR_ADMIN_01", "SCHEDULED",
    "Master bedroom AC blowing lukewarm air and slight rattling sound",
    "742 Evergreen Terrace, Koramangala 4th Block", 12.9352, 77.6245, "NODE_SOUTHEAST",
    today, "09:00", "10:00",
    `${today}T09:00:00Z`, `${today}T10:00:00Z`, 12
  );

  // Booking 2: Electrical fault diagnosis
  insertBooking.run(
    "BK_002", "DG-2026-902", "USR_CUST_02", "SRV_E_04", "USR_TECH_01",
    "HIGH", "HIGH", "USR_ADMIN_01", "IN_PROGRESS",
    "Main breaker trips whenever water heater or heavy appliance is engaged",
    "Skyline Heights, Hebbal Flyover Outer", 13.0358, 77.5970, "NODE_NORTH",
    today, "10:30", "11:30",
    `${today}T10:30:00Z`, `${today}T11:30:00Z`, 18
  );

  // Booking 3: Emergency Pipe Burst (Requested Emergency, pending verification)
  insertBooking.run(
    "BK_003", "DG-2026-903", "USR_CUST_03", "SRV_P_01", null,
    "EMERGENCY", "EMERGENCY", "USR_ADMIN_01", "ACCEPTED",
    "URGENT: Ceiling pipe burst above kitchen cabinets, water flooding floor rapidly",
    "Brigade Road Central Promenade", 12.9716, 77.5946, "NODE_CENTRAL",
    today, "11:00", "12:00",
    null, null, 0
  );

  // Booking 4: AC installation (Requested, ready for auto-assignment demonstration)
  insertBooking.run(
    "BK_004", "DG-2026-904", "USR_CUST_01", "SRV_AC_01", null,
    "NORMAL", "NORMAL", null, "ACCEPTED",
    "New 2-ton Daikin split AC installation on 3rd floor balcony wall",
    "Unit 402, Indiranagar 100ft Road", 12.9840, 77.6632, "NODE_EAST",
    today, "14:00", "16:00",
    null, null, 0
  );

  // Booking 5: Completed booking with customer review
  insertBooking.run(
    "BK_005", "DG-2026-900", "USR_CUST_02", "SRV_E_02", "USR_TECH_05",
    "NORMAL", "NORMAL", "USR_ADMIN_01", "COMPLETED",
    "Burnt switch in kitchen repaired promptly with safety certificate",
    "Skyline Heights, Hebbal Flyover Outer", 13.0358, 77.5970, "NODE_NORTH",
    today, "08:00", "09:00",
    `${today}T08:00:00Z`, `${today}T08:50:00Z`, 18
  );

  // Status history for seeded bookings
  const insertHistory = db.prepare("INSERT INTO booking_status_history (history_id, booking_id, from_status, to_status, changed_by_user_id, change_reason) VALUES (?, ?, ?, ?, ?, ?)");
  insertHistory.run("H_01", "BK_001", "REQUESTED", "ACCEPTED", "USR_ADMIN_01", "Initial customer request approved");
  insertHistory.run("H_02", "BK_001", "ACCEPTED", "SCHEDULED", "USR_ADMIN_01", "Assigned to Amit Patel (HVAC Certified)");
  insertHistory.run("H_03", "BK_002", "REQUESTED", "SCHEDULED", "USR_ADMIN_01", "Assigned to Rajesh Kumar");
  insertHistory.run("H_04", "BK_002", "SCHEDULED", "IN_PROGRESS", "USR_TECH_01", "Technician arrived on site and commenced fault isolation");
  insertHistory.run("H_05", "BK_005", "IN_PROGRESS", "COMPLETED", "USR_TECH_05", "Replaced burnt 16A socket and insulated lead wires");

  // Review for completed BK_005
  db.prepare(`
    INSERT INTO reviews (review_id, booking_id, customer_id, technician_id, rating, comment, service_quality_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "REV_01", "BK_005", "USR_CUST_02", "USR_TECH_05", 5,
    "Priya arrived exactly on time, was extremely knowledgeable, and fixed the hazardous short circuit quickly. Exceptional professionalism!",
    "Punctual,Expert Diagnostician,Clean Worksite"
  );

  // Notifications
  const insertNotif = db.prepare("INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?, ?)");
  insertNotif.run("NOTIF_01", "USR_ADMIN_01", "Emergency Service Alert", "Booking DG-2026-903 marked as EMERGENCY: Ceiling pipe burst flooding kitchen.", "EMERGENCY", "BK_003");
  insertNotif.run("NOTIF_02", "USR_TECH_02", "New Assignment Confirmed", "You have been scheduled for AC Deep Service at Koramangala 4th Block.", "ASSIGNMENT", "BK_001");
  insertNotif.run("NOTIF_03", "USR_CUST_01", "Technician Assigned", "Amit Patel (Certified HVAC Specialist) has been scheduled for your AC service.", "STATUS_CHANGE", "BK_001");

  console.log("DispatchGrid seed data initialization complete.");
}
