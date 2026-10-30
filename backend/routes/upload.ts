import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../services/authService.js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const uploadRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Maximum file size in bytes (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed mime types
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Upload profile photo
 * Expects { image: "data:image/png;base64,..." }
 * Validates format (JPG, PNG, WEBP only) and max 5MB size limit.
 */
uploadRouter.post("/profile-photo", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "No image data provided. Please select an image." });
    }

    // Match data URI header: data:image/png;base64,...
    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        error: "Invalid image format. Supported formats are JPG, PNG, and WEBP.",
      });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) {
      return res.status(400).json({
        error: `Unsupported file type: ${mimeType}. Only JPG, PNG, and WEBP are allowed.`,
      });
    }

    // Decode buffer and test byte length
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File size exceeds the 5MB limit (Uploaded size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`,
      });
    }

    if (buffer.length < 10) {
      return res.status(400).json({ error: "The uploaded image file is empty or corrupted." });
    }

    const filename = `avatar-${randomUUID()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;
    return res.status(200).json({
      success: true,
      url: fileUrl,
      sizeBytes: buffer.length,
      mimeType,
      message: "Profile photo uploaded successfully.",
    });
  } catch (err: any) {
    console.error("Profile photo upload failed:", err);
    return res.status(500).json({ error: err.message || "Failed to upload photo" });
  }
});

