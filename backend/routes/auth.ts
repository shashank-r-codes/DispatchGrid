import { Router, Response } from "express";
import { db } from "../config/database.js";
import {
  generateToken,
  hashPassword,
  comparePassword,
  authenticateToken,
  AuthenticatedRequest,
} from "../services/authService.js";
import { randomUUID } from "crypto";
import { findClosestNode } from "../config/roadNetwork.js";

export const authRouter = Router();

// Customer Registration
authRouter.post("/register-customer", (req, res) => {
  try {
    const { fullName, email, phone, password, address, city, state, pincode, latitude, longitude } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: "Missing mandatory registration fields" });
    }

    const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered in DispatchGrid" });
    }

    const userId = "USR_CUST_" + randomUUID().substring(0, 8);
    const passwordHash = hashPassword(password);
    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;

    const createTx = db.transaction(() => {
      // 1. Create User
      db.prepare(`
        INSERT INTO users (user_id, full_name, email, phone, password_hash, role, account_status)
        VALUES (?, ?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')
      `).run(userId, fullName, email, phone, passwordHash);

      // 2. Create Customer Profile
      db.prepare(`
        INSERT INTO customer_profiles (customer_id, user_id)
        VALUES (?, ?)
      `).run("CP_" + randomUUID().substring(0, 8), userId);

      // 3. Create Default Address
      if (address) {
        db.prepare(`
          INSERT INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
          VALUES (?, ?, 'Primary Residence', ?, ?, ?, ?, ?, ?, 1)
        `).run(
          "ADDR_" + randomUUID().substring(0, 8),
          userId,
          address,
          city || "Bengaluru",
          state || "Karnataka",
          pincode || "560001",
          lat,
          lng
        );
      }
    });

    createTx();

    const token = generateToken({
      userId,
      email,
      role: "CUSTOMER",
      fullName,
    });

    return res.status(201).json({
      message: "Customer registered successfully",
      token,
      user: {
        userId,
        fullName,
        email,
        phone,
        role: "CUSTOMER",
        accountStatus: "ACTIVE",
      },
    });
  } catch (err: any) {
    console.error("Register Customer Error:", err);
    return res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// Technician Registration (Phase 1 & Phase 2)
authRouter.post("/register-technician", (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      experienceYears,
      serviceCategories, // Array or string
      residentialAddress,
      city,
      pincode,
      latitude,
      longitude,
      serviceAreas, // Array or string
      selectedSkillIds, // Array of skill IDs
      certifications, // Array of { name, authority, certNumber }
      workingDays,
      shiftStartTime,
      shiftEndTime,
    } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: "Missing required technician registration details" });
    }

    const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const userId = "USR_TECH_" + randomUUID().substring(0, 8);
    const passwordHash = hashPassword(password);
    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;

    const categoriesStr = Array.isArray(serviceCategories)
      ? serviceCategories.join(",")
      : serviceCategories || "Electrical";

    const areasJson = JSON.stringify(
      Array.isArray(serviceAreas) ? serviceAreas : [serviceAreas || "CBD / Central"]
    );

    const workingDaysStr = Array.isArray(workingDays)
      ? workingDays.join(",")
      : workingDays || "Mon,Tue,Wed,Thu,Fri,Sat";

    const createTechTx = db.transaction(() => {
      // 1. Create User in PENDING status (requires admin verification!)
      db.prepare(`
        INSERT INTO users (user_id, full_name, email, phone, password_hash, role, account_status)
        VALUES (?, ?, ?, ?, ?, 'TECHNICIAN', 'PENDING')
      `).run(userId, fullName, email, phone, passwordHash);

      // 2. Create Technician Profile
      db.prepare(`
        INSERT INTO technician_profiles (
          technician_id, user_id, experience_years, service_categories,
          verification_status, residential_address, city, pincode,
          current_latitude, current_longitude, service_areas,
          working_days, shift_start_time, shift_end_time, availability_status
        ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
      `).run(
        "TP_" + randomUUID().substring(0, 8),
        userId,
        parseInt(experienceYears || "1", 10),
        categoriesStr,
        residentialAddress || "Bangalore Central",
        city || "Bengaluru",
        pincode || "560001",
        lat,
        lng,
        areasJson,
        workingDaysStr,
        shiftStartTime || "08:00",
        shiftEndTime || "18:00"
      );

      // 3. Attach Skills
      if (Array.isArray(selectedSkillIds)) {
        const insertTechSkill = db.prepare(
          "INSERT OR IGNORE INTO technician_skills (technician_id, skill_id, years_experience) VALUES (?, ?, ?)"
        );
        for (const skillId of selectedSkillIds) {
          insertTechSkill.run(userId, skillId, parseInt(experienceYears || "1", 10));
        }
      }

      // 4. Attach Certifications if provided
      if (Array.isArray(certifications)) {
        for (const cert of certifications) {
          const certId = "CERT_" + randomUUID().substring(0, 8);
          db.prepare(`
            INSERT OR IGNORE INTO certifications (certification_id, category, certification_name, issuing_authority)
            VALUES (?, ?, ?, ?)
          `).run(certId, categoriesStr.split(",")[0] || "Electrical", cert.name || "Trade License", cert.authority || "Licensing Authority");

          db.prepare(`
            INSERT INTO technician_certifications (id, technician_id, certification_id, certificate_number)
            VALUES (?, ?, ?, ?)
          `).run(randomUUID(), userId, certId, cert.certNumber || "DG-CERT-PENDING");
        }
      }

      // 5. Notify Admins
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id)
        VALUES (?, 'USR_ADMIN_01', 'New Technician Registration Pending Review', ?, 'VERIFICATION', ?)
      `).run(
        randomUUID(),
        `Technician ${fullName} (${categoriesStr}) submitted registration. Review qualifications and approve.`,
        userId
      );
    });

    createTechTx();

    const token = generateToken({
      userId,
      email,
      role: "TECHNICIAN",
      fullName,
    });

    return res.status(201).json({
      message: "Technician application submitted. Account is pending administrator verification.",
      token,
      user: {
        userId,
        fullName,
        email,
        phone,
        role: "TECHNICIAN",
        accountStatus: "PENDING",
      },
    });
  } catch (err: any) {
    console.error("Register Technician Error:", err);
    return res.status(500).json({ error: err.message || "Technician registration failed" });
  }
});

// Login
authRouter.post("/login", (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const identifier = (username || email || "").trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: "Username/Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ? OR email = ?").get(identifier, identifier) as any;
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Role verification against database record
    if (role) {
      const normalizedRole = role.toUpperCase().trim();
      if (user.role !== normalizedRole) {
        return res.status(403).json({
          error: `Role mismatch: This account is registered as '${user.role}', but you selected '${normalizedRole}'. Please select the '${user.role}' role to sign in.`,
        });
      }
    }

    if (user.account_status === "SUSPENDED" || user.account_status === "REJECTED") {
      return res.status(403).json({
        error: `Account access restricted: Status is ${user.account_status}. Contact DispatchGrid administrator.`,
      });
    }

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    });

    return res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.account_status,
        profilePictureUrl: user.profile_picture_url || null,
      },
    });
  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: err.message || "Login failed" });
  }
});

// Me / Current Session User
authRouter.get("/me", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.prepare("SELECT user_id, username, full_name, email, phone, role, account_status, profile_picture_url, created_at FROM users WHERE user_id = ?").get(req.user!.userId) as any;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let extraProfile: any = {};
    if (user.role === "CUSTOMER") {
      const addresses = db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC").all(user.user_id);
      const custProf = db.prepare("SELECT profile_picture_url FROM customer_profiles WHERE user_id = ?").get(user.user_id) as any;
      extraProfile = { addresses, profilePictureUrl: user.profile_picture_url || custProf?.profile_picture_url || null };
    } else if (user.role === "TECHNICIAN") {
      const techProfile = db.prepare("SELECT * FROM technician_profiles WHERE user_id = ?").get(user.user_id) as any;
      const skills = db.prepare(`
        SELECT s.skill_id, s.skill_name, s.category
        FROM technician_skills ts
        JOIN skills s ON ts.skill_id = s.skill_id
        WHERE ts.technician_id = ?
      `).all(user.user_id);
      const certifications = db.prepare(`
        SELECT c.certification_id, c.certification_name, c.issuing_authority, tc.certificate_number
        FROM technician_certifications tc
        JOIN certifications c ON tc.certification_id = c.certification_id
        WHERE tc.technician_id = ?
      `).all(user.user_id);

      extraProfile = {
        ...techProfile,
        availabilityStatus: techProfile?.availability_status || "AVAILABLE",
        totalCompletedJobs: techProfile?.total_completed_jobs || 0,
        averageRating: techProfile?.average_rating || 5.0,
        profilePictureUrl: user.profile_picture_url || techProfile?.profile_picture_url || null,
        skills,
        certifications,
        serviceAreas: techProfile ? JSON.parse(techProfile.service_areas || "[]") : [],
      };
    }

    return res.json({
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.account_status,
        profilePictureUrl: user.profile_picture_url || extraProfile.profilePictureUrl || null,
        ...extraProfile,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
