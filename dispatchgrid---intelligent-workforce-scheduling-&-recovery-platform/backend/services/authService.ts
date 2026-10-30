import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db } from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "dispatchgrid-jwt-super-secret-key-2026-secure";

export interface TokenPayload {
  userId: string;
  email: string;
  role: "CUSTOMER" | "TECHNICIAN" | "ADMIN";
  fullName: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: "Invalid or expired session token" });
  }

  // Ensure user is still active in DB
  const user = db.prepare("SELECT user_id, role, account_status FROM users WHERE user_id = ?").get(payload.userId) as {
    user_id: string;
    role: string;
    account_status: string;
  } | undefined;

  if (!user || user.account_status === "SUSPENDED" || user.account_status === "REJECTED") {
    return res.status(403).json({ error: "Account is not active or has been suspended" });
  }

  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: ("CUSTOMER" | "TECHNICIAN" | "ADMIN")[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Unauthorized: Action requires one of [${allowedRoles.join(", ")}] roles. Current: ${req.user?.role || "none"}`,
      });
    }
    next();
  };
}
