import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { initDatabase } from "./backend/config/database.js";
import { authRouter } from "./backend/routes/auth.js";
import { customersRouter } from "./backend/routes/customers.js";
import { techniciansRouter } from "./backend/routes/technicians.js";
import { servicesRouter } from "./backend/routes/services.js";
import { bookingsRouter } from "./backend/routes/bookings.js";
import { dispatchRouter } from "./backend/routes/dispatch.js";
import { recoveryRouter } from "./backend/routes/recovery.js";
import { benchmarkRouter } from "./backend/routes/benchmark.js";
import { uploadRouter } from "./backend/routes/upload.js";
import { notificationsRouter } from "./backend/routes/notifications.js";
import { trackingRouter } from "./backend/routes/tracking.js";
import { AssignmentEngine } from "./backend/services/assignmentEngine.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize SQLite database schema and seed data
initDatabase();

// Background 2-minute decision timer sweep:
// Checks all pending offers across the workforce. If an offer reaches 2 minutes without accept/reject,
// it automatically expires and reassigns the job to the next nearest qualified technician.
setInterval(() => {
  try {
    AssignmentEngine.checkAndExpireTimedOutOffers(120);
  } catch (err) {
    // ignore
  }
}, 2000);

// Serve profile photo uploads statically
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    platform: "DispatchGrid Intelligent Workforce Scheduling & Recovery Platform",
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DispatchGrid] Production-ready full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start DispatchGrid server:", err);
  process.exit(1);
});
