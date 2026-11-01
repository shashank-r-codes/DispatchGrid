import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { initDatabase, db } from "./backend/config/database.js";
import { authRouter } from "./backend/routes/auth.js";
import { customersRouter } from "./backend/routes/customers.js";
import { techniciansRouter } from "./backend/routes/technicians.js";
import { servicesRouter } from "./backend/routes/services.js";
import { bookingsRouter } from "./backend/routes/bookings.js";
import { dispatchRouter } from "./backend/routes/dispatch.js";
import { recoveryRouter } from "./backend/routes/recovery.js";
import { benchmarkRouter } from "./backend/routes/benchmark.js";
import { uploadRouter, UPLOADS_DIR } from "./backend/routes/upload.js";
import { notificationsRouter } from "./backend/routes/notifications.js";
import { trackingRouter } from "./backend/routes/tracking.js";
import { AssignmentEngine } from "./backend/services/assignmentEngine.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Basic security and parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Standard CORS and Same-Origin headers
app.use((req, res, next) => {
  const allowedOrigin = process.env.APP_URL || "*";
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Initialize SQLite database schema and seed data (only populates if empty)
initDatabase();

// Background 2-minute decision timer sweep:
// Checks all pending offers across the workforce. If an offer reaches 2 minutes without accept/reject,
// it automatically expires and reassigns the job to the next nearest qualified technician.
const timerSweepInterval = setInterval(() => {
  try {
    AssignmentEngine.checkAndExpireTimedOutOffers(120);
  } catch (err) {
    // ignore
  }
}, 2000);

// Serve profile photo uploads statically from persistent storage
app.use("/uploads", express.static(UPLOADS_DIR));

// Mount REST API Routes
app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/technicians", techniciansRouter);
app.use("/api/services", servicesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/recovery", recoveryRouter);
app.use("/api/benchmark", benchmarkRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/tracking", trackingRouter);

// Health check endpoint for Render service health monitoring
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    platform: "DispatchGrid Intelligent Workforce Scheduling & Recovery Platform",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Centralized Express error handler to prevent sensitive internal error leaks to customers
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[DispatchGrid Server Error]", err);
  if (res.headersSent) {
    return next(err);
  }
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProd
      ? "An unexpected internal server error occurred. Please try again later."
      : (err.message || "Internal server error"),
  });
});

async function startServer() {
  const distPath = path.resolve(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.resolve(distPath, "index.html"));
  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RENDER) ||
    (hasDist && process.env.NODE_ENV !== "development" && process.env.npm_lifecycle_event !== "dev");

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, ensure unmatched API requests return 404 JSON instead of HTML
    app.all("/api/*", (req, res) => {
      res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
    });

    if (!hasDist) {
      console.warn(`[DispatchGrid] WARNING: 'dist/index.html' not found at ${distPath}. Run 'npm run build' to generate production assets.`);
    }

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DispatchGrid] Production-ready full-stack server running on http://0.0.0.0:${PORT} [mode: ${isProduction ? "production" : "development"}]`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[DispatchGrid Startup Error] Port ${PORT} is already in use. Configure a different PORT environment variable.`);
    } else {
      console.error(`[DispatchGrid Startup Error] Server failed to start:`, err);
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`[DispatchGrid] Received ${signal}. Initiating graceful shutdown...`);
    clearInterval(timerSweepInterval);
    server.close(() => {
      console.log("[DispatchGrid] HTTP server closed.");
      try {
        db.close();
        console.log("[DispatchGrid] Database connection successfully closed.");
      } catch {
        // ignore
      }
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export { app, startServer };

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start DispatchGrid server:", err);
    process.exit(1);
  });
}
