import { Router, Response } from "express";
import { db } from "../config/database.js";
import { authenticateToken, AuthenticatedRequest } from "../services/authService.js";
import { randomUUID } from "crypto";

export const notificationsRouter = Router();

/**
 * Helper to record persistent notification
 */
export function addNotification(params: {
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
}) {
  try {
    const id = "NOTIF_" + randomUUID().substring(0, 10);
    db.prepare(`
      INSERT INTO notifications (notification_id, recipient_user_id, title, message, type, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(id, params.recipientUserId, params.title, params.message, params.type, params.referenceId || null);
    return id;
  } catch (err) {
    console.error("Failed to insert notification:", err);
    return null;
  }
}

// Get user's notifications
notificationsRouter.get("/", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notifications = db.prepare(`
      SELECT notification_id, recipient_user_id, title, message, type, reference_id, is_read, created_at
      FROM notifications
      WHERE recipient_user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE recipient_user_id = ? AND is_read = 0
    `).get(userId) as { count: number };

    return res.json({
      notifications,
      unreadCount: unreadCount ? unreadCount.count : 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark single notification as read
notificationsRouter.put("/:id/read", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notifId = req.params.id;

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE notification_id = ? AND recipient_user_id = ?
    `).run(notifId, userId);

    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read
notificationsRouter.post("/mark-all-read", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE recipient_user_id = ?
    `).run(userId);

    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

