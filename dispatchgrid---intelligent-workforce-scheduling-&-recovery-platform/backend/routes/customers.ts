import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { randomUUID } from "crypto";
import { findClosestNode } from "../config/roadNetwork.js";

export const customersRouter = Router();

// Profile management
customersRouter.get("/profile", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.prepare("SELECT user_id, full_name, email, phone, created_at FROM users WHERE user_id = ?").get(req.user!.userId) as any;
    const profile = db.prepare("SELECT * FROM customer_profiles WHERE user_id = ?").get(req.user!.userId) as any;
    const addresses = db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC").all(req.user!.userId);

    return res.json({
      user,
      profile,
      addresses,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update profile details
customersRouter.put("/profile", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, profilePictureUrl } = req.body;
    db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(fullName, phone, req.user!.userId);

    if (profilePictureUrl !== undefined) {
      db.prepare(`
        UPDATE customer_profiles
        SET profile_picture_url = ?
        WHERE user_id = ?
      `).run(profilePictureUrl, req.user!.userId);
    }

    return res.json({ message: "Customer profile updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Addresses
customersRouter.get("/addresses", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const addresses = db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC").all(req.user!.userId);
    return res.json({ addresses });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

customersRouter.post("/addresses", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { label, addressLine, city, state, pincode, latitude, longitude, isDefault } = req.body;
    if (!addressLine || !city) {
      return res.status(400).json({ error: "Address line and city are mandatory" });
    }

    const lat = latitude ? parseFloat(latitude) : 12.9716;
    const lng = longitude ? parseFloat(longitude) : 77.5946;
    const addressId = "ADDR_" + randomUUID().substring(0, 8);

    if (isDefault) {
      db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(req.user!.userId);
    }

    db.prepare(`
      INSERT INTO customer_addresses (address_id, customer_id, label, address_line, city, state, pincode, latitude, longitude, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      addressId,
      req.user!.userId,
      label || "Home",
      addressLine,
      city || "Bengaluru",
      state || "Karnataka",
      pincode || "560001",
      lat,
      lng,
      isDefault ? 1 : 0
    );

    return res.status(201).json({ message: "Address added successfully", addressId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

customersRouter.delete("/addresses/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.prepare("DELETE FROM customer_addresses WHERE address_id = ? AND customer_id = ?").run(req.params.id, req.user!.userId);
    return res.json({ message: "Address deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
