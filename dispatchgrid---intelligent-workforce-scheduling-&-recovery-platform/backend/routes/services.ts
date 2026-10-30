import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { randomUUID } from "crypto";

export const servicesRouter = Router();

// Get full service catalogue
servicesRouter.get("/", (req, res) => {
  try {
    const { category, activeOnly } = req.query;
    let query = "SELECT * FROM services WHERE 1=1";
    const params: any[] = [];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (activeOnly !== "false") {
      query += " AND is_active = 1";
    }

    query += " ORDER BY category ASC, service_name ASC";

    const rows = db.prepare(query).all(...params) as any[];

    const services = rows.map((r) => ({
      ...r,
      requiredSkills: JSON.parse(r.required_skills || "[]"),
      requiredCertifications: JSON.parse(r.required_certifications || "[]"),
      isActive: Boolean(r.is_active),
      indicativePrice: r.indicative_price,
      estimatedDurationMinutes: r.estimated_duration_minutes,
      serviceId: r.service_id,
      serviceName: r.service_name,
    }));

    // Also get all distinct skills and certs for dropdowns
    const allSkills = db.prepare("SELECT * FROM skills ORDER BY category ASC, skill_name ASC").all();
    const allCerts = db.prepare("SELECT * FROM certifications ORDER BY category ASC, certification_name ASC").all();

    return res.json({ services, allSkills, allCerts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin add service
servicesRouter.post("/", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceName, category, description, estimatedDurationMinutes, indicativePrice, requiredSkills, requiredCertifications } = req.body;

    if (!serviceName || !category || !description) {
      return res.status(400).json({ error: "Service name, category, and description are required" });
    }

    const serviceId = "SRV_" + (category === "AC" ? "AC_" : category === "Plumbing" ? "P_" : "E_") + randomUUID().substring(0, 6);

    db.prepare(`
      INSERT INTO services (service_id, service_name, category, description, estimated_duration_minutes, indicative_price, required_skills, required_certifications, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      serviceId,
      serviceName,
      category,
      description,
      parseInt(estimatedDurationMinutes || "60", 10),
      parseFloat(indicativePrice || "49.99"),
      JSON.stringify(requiredSkills || []),
      JSON.stringify(requiredCertifications || [])
    );

    return res.status(201).json({ message: "Service added successfully", serviceId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin edit service or toggle status
servicesRouter.put("/:id", authenticateToken, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const serviceId = req.params.id;
    const { serviceName, description, estimatedDurationMinutes, indicativePrice, requiredSkills, requiredCertifications, isActive } = req.body;

    db.prepare(`
      UPDATE services
      SET service_name = COALESCE(?, service_name),
          description = COALESCE(?, description),
          estimated_duration_minutes = COALESCE(?, estimated_duration_minutes),
          indicative_price = COALESCE(?, indicative_price),
          required_skills = COALESCE(?, required_skills),
          required_certifications = COALESCE(?, required_certifications),
          is_active = COALESCE(?, is_active)
      WHERE service_id = ?
    `).run(
      serviceName,
      description,
      estimatedDurationMinutes ? parseInt(estimatedDurationMinutes, 10) : null,
      indicativePrice ? parseFloat(indicativePrice) : null,
      requiredSkills ? JSON.stringify(requiredSkills) : null,
      requiredCertifications ? JSON.stringify(requiredCertifications) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      serviceId
    );

    return res.json({ message: "Service updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
