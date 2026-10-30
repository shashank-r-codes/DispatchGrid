import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../services/authService.js";
import { RecoveryEngine, DisruptionType } from "../services/recoveryEngine.js";

export const recoveryRouter = Router();

// Trigger / simulate disruption
recoveryRouter.post("/simulate", authenticateToken, requireRole("ADMIN", "TECHNICIAN"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { disruptionType, technicianId, bookingId, delayMinutes, reason } = req.body;

    if (!disruptionType) {
      return res.status(400).json({ error: "Disruption type is required" });
    }

    const result = RecoveryEngine.handleDisruption({
      disruptionType: disruptionType as DisruptionType,
      technicianId,
      bookingId,
      delayMinutes: delayMinutes ? parseInt(delayMinutes, 10) : undefined,
      reason,
    });

    return res.json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// View all recovery audit logs (Phase 7.8)
recoveryRouter.get("/audit-logs", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT 
        r.*,
        u.full_name as affected_technician_name
      FROM recovery_audit_logs r
      LEFT JOIN users u ON r.affected_technician_id = u.user_id
      ORDER BY r.timestamp DESC
      LIMIT 50
    `).all() as any[];

    const logs = rows.map((r) => ({
      ...r,
      affectedBookingIds: JSON.parse(r.affected_booking_ids || "[]"),
      previousAssignments: JSON.parse(r.previous_assignments || "{}"),
      revisedAssignments: JSON.parse(r.revised_assignments || "{}"),
      notificationsSent: JSON.parse(r.notifications_sent || "[]"),
    }));

    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
