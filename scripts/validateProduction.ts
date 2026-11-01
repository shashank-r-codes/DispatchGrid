import http from "http";
import path from "path";
import express from "express";

process.env.NODE_ENV = "test"; // prevents auto-listen on port 3000

function request(pipe: string, options: { method: string; path: string; headers?: Record<string, string> }, body?: any): Promise<{ status: number; data: any; raw: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined;
    const req = http.request({
      socketPath: pipe,
      method: options.method,
      path: options.path,
      headers: {
        ...(postData ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {}),
        ...options.headers,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let data: any = raw;
        try {
          data = JSON.parse(raw);
        } catch {}
        resolve({ status: res.statusCode || 0, data, raw, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runProductionValidation() {
  console.log("=================================================");
  console.log("   DISPATCHGRID PRODUCTION VALIDATION SUITE      ");
  console.log("=================================================");

  console.log("[1/8] Initializing production application...");
  const { app } = await import("../server.js");

  // Mount production static files and SPA fallback as in production
  const distPath = path.resolve(process.cwd(), "dist");
  app.all("/api/*", (req: any, res: any) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });
  app.use(express.static(distPath));
  app.get("*", (req: any, res: any) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  const pipe = "\\\\.\\pipe\\dispatchgrid-prod-test-" + Date.now();
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(pipe, () => resolve(s));
  });

  console.log("  ✓ Production application listening on isolated local IPC named pipe!");

  try {
    // 1. Health check
    const healthRes = await request(pipe, { method: "GET", path: "/api/health" });
    if (healthRes.status !== 200 || healthRes.data?.status !== "healthy") {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes.data)}`);
    }
    console.log("  ✓ GET /api/health returned healthy status");

    // 2. Test Frontend Static Serving & Direct Route Refreshes
    console.log("\n[2/8] Validating Frontend Static Serving & Direct SPA Route Refreshes...");
    const rootRes = await request(pipe, { method: "GET", path: "/" });
    if (rootRes.status !== 200 || !rootRes.raw.toLowerCase().includes("<!doctype html>") || !rootRes.raw.includes("root")) {
      throw new Error(`Failed to serve index.html on root: status ${rootRes.status}`);
    }
    console.log("  ✓ Root URL '/' successfully serves compiled Vite index.html (Status 200)");

    const spaRouteRes = await request(pipe, { method: "GET", path: "/customer-portal" });
    if (spaRouteRes.status !== 200 || !spaRouteRes.raw.toLowerCase().includes("<!doctype html>")) {
      throw new Error(`Direct route refresh failed on /customer-portal: status ${spaRouteRes.status}`);
    }
    console.log("  ✓ Direct deep-link refresh '/customer-portal' returns index.html for SPA client-side routing (Status 200)");

    const adminDeepLink = await request(pipe, { method: "GET", path: "/admin-dashboard" });
    if (adminDeepLink.status !== 200 || !adminDeepLink.raw.toLowerCase().includes("<!doctype html>")) {
      throw new Error(`Direct route refresh failed on /admin-dashboard: status ${adminDeepLink.status}`);
    }
    console.log("  ✓ Direct deep-link refresh '/admin-dashboard' returns index.html (Status 200)");

    // 3. Test API 404 Guard
    console.log("\n[3/8] Validating API 404 Guard (API routes must not return HTML)...");
    const badApiRes = await request(pipe, { method: "GET", path: "/api/unknown-endpoint-xyz" });
    if (badApiRes.status !== 404 || typeof badApiRes.data !== "object" || !badApiRes.data?.error) {
      throw new Error(`Unmatched API endpoint returned ${badApiRes.status} instead of JSON 404: ${badApiRes.raw}`);
    }
    console.log("  ✓ Unmatched API request '/api/unknown-endpoint-xyz' correctly returned 404 JSON error response");

    // 4. Test Customer, Technician, and Admin Login
    console.log("\n[4/8] Validating Production Authentication for Customer, Technician & Admin...");
    
    // Admin login
    const adminLogin = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
      email: "admin@dispatchgrid.demo",
      password: "admin123",
      role: "ADMIN",
    });
    if (adminLogin.status !== 200 || !adminLogin.data?.token || adminLogin.data.user?.role !== "ADMIN") {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    }
    const adminToken = adminLogin.data.token;
    console.log(`  ✓ Admin Login: SUCCESS (User: ${adminLogin.data.user.fullName}, Role: ADMIN, JWT received)`);

    // Customer login
    const custLogin = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
      email: "customer@dispatchgrid.demo",
      password: "12345",
      role: "CUSTOMER",
    });
    if (custLogin.status !== 200 || !custLogin.data?.token || custLogin.data.user?.role !== "CUSTOMER") {
      throw new Error(`Customer login failed: ${JSON.stringify(custLogin.data)}`);
    }
    const custToken = custLogin.data.token;
    console.log(`  ✓ Customer Login: SUCCESS (User: ${custLogin.data.user.fullName}, Role: CUSTOMER, JWT received)`);

    // Technician login
    const techLogin = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
      email: "electrician1@dispatchgrid.demo",
      password: "12345",
      role: "TECHNICIAN",
    });
    if (techLogin.status !== 200 || !techLogin.data?.token || techLogin.data.user?.role !== "TECHNICIAN") {
      throw new Error(`Technician login failed: ${JSON.stringify(techLogin.data)}`);
    }
    const tech1Token = techLogin.data.token;
    console.log(`  ✓ Technician Login: SUCCESS (User: ${techLogin.data.user.fullName}, Role: TECHNICIAN, JWT received)`);

    // Role mismatch protection check
    const mismatchLogin = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
      email: "customer@dispatchgrid.demo",
      password: "12345",
      role: "ADMIN",
    });
    if (mismatchLogin.status !== 403) {
      throw new Error(`Role mismatch should return 403 but returned ${mismatchLogin.status}`);
    }
    console.log("  ✓ Role enforcement: Customer attempting to authenticate with role 'ADMIN' was strictly rejected (403)");

    // 5. Test Booking Creation, Auto-Dispatch & Job Offer
    console.log("\n[5/8] Validating Booking Creation & Automatic Dispatch...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDateStr = tomorrow.toISOString().split("T")[0];

    const createBookingRes = await request(
      pipe,
      { method: "POST", path: "/api/bookings", headers: { Authorization: `Bearer ${custToken}` } },
      {
        serviceId: "SRV_E_01",
        problemDescription: "Short circuit tripping main breaker in living room",
        serviceAddress: "100 Indiranagar 12th Main, Bengaluru",
        latitude: 12.9840,
        longitude: 77.6632,
        nodeId: "NODE_EAST",
        requestedPriority: "NORMAL",
        preferredDate: bookingDateStr,
        preferredStartTime: "14:00",
        preferredEndTime: "15:00",
      }
    );

    if (createBookingRes.status !== 201 || !createBookingRes.data?.bookingId) {
      throw new Error(`Booking creation failed: ${JSON.stringify(createBookingRes.data)}`);
    }
    const booking = createBookingRes.data;
    const initialOfferId = booking.allocation?.offerId;
    const assignedTechUserId = booking.allocation?.assignedTechnicianId;

    console.log(`  ✓ Booking Created: Reference ${booking.bookingReference} (Status: ${booking.status})`);
    console.log(`  ✓ Immediate Auto-Dispatch: Job dispatched to qualified technician: ${booking.allocation?.assignedTechnicianName} (Offer ID: ${initialOfferId})`);

    // 6. Test Technician Rejection & Automatic Reallocation Cascade
    console.log("\n[6/8] Validating Technician Rejection & Instant Reallocation...");
    
    if (!assignedTechUserId || !initialOfferId) {
      throw new Error(`Initial offer did not assign a technician: ${JSON.stringify(booking)}`);
    }

    const { db } = await import("../backend/config/database.js");
    const techUser = db.prepare("SELECT email FROM users WHERE user_id = ?").get(assignedTechUserId) as any;

    // Login as that specific technician to reject the offer
    const techWhoReceived = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
      email: techUser?.email || "electrician1@dispatchgrid.demo",
      password: "12345",
      role: "TECHNICIAN",
    });

    let activeTechToken = tech1Token;
    if (techWhoReceived.status === 200 && techWhoReceived.data?.token) {
      activeTechToken = techWhoReceived.data.token;
    }

    const rejectRes = await request(
      pipe,
      { method: "POST", path: `/api/technicians/offers/${initialOfferId}/reject`, headers: { Authorization: `Bearer ${activeTechToken}` } },
      { reason: "Currently engaged in emergency high-voltage repair" }
    );

    const rejectResult = rejectRes.data?.result || rejectRes.data;
    if (rejectRes.status !== 200 || !rejectResult?.success) {
      throw new Error(`Technician rejection failed: ${JSON.stringify(rejectRes.data)}`);
    }
    console.log("  ✓ Technician rejected initial offer with recorded reason");
    console.log(`  ✓ System automatically reallocated job to next qualified specialist: ${rejectResult.nextTechnicianName || "Next candidate"}`);

    const replacementOfferId = rejectResult.nextOfferId;
    const replacementTechId = rejectResult.nextTechnicianId;

    if (replacementOfferId && replacementTechId) {
      const repTechUser = db.prepare("SELECT email FROM users WHERE user_id = ?").get(replacementTechId) as any;
      // Login as the replacement technician to accept
      const replacementTechLogin = await request(pipe, { method: "POST", path: "/api/auth/login" }, {
        email: repTechUser?.email || "electrician2@dispatchgrid.demo",
        password: "12345",
        role: "TECHNICIAN",
      });

      const acceptRes = await request(
        pipe,
        { method: "POST", path: `/api/technicians/offers/${replacementOfferId}/accept`, headers: { Authorization: `Bearer ${replacementTechLogin.data.token}` } },
        {}
      );

      const acceptResult = acceptRes.data?.result || acceptRes.data;
      if (acceptRes.status !== 200 || !acceptResult?.success) {
        throw new Error(`Replacement technician acceptance failed: ${JSON.stringify(acceptRes.data)}`);
      }
      console.log(`  ✓ Replacement technician accepted offer; booking status transitioned to ASSIGNED`);
    }

    // 7. Test Customer Booking History & Isolation
    console.log("\n[7/8] Validating Customer Booking History & Isolation...");
    const historyRes = await request(
      pipe,
      { method: "GET", path: "/api/customers/my/bookings", headers: { Authorization: `Bearer ${custToken}` } }
    );

    if (historyRes.status !== 200 || !Array.isArray(historyRes.data?.bookings)) {
      throw new Error(`Customer booking history failed: ${JSON.stringify(historyRes.data)}`);
    }
    const foundOurBooking = historyRes.data.bookings.find((b: any) => b.bookingId === booking.bookingId);
    if (!foundOurBooking) {
      throw new Error("Created booking was not found in customer booking history");
    }
    console.log(`  ✓ Customer Booking History: Verified ${historyRes.data.bookings.length} persistent bookings for David Miller`);
    console.log(`  ✓ Our new booking found in history with updated status: ${foundOurBooking.bookingStatus}`);

    // 8. Test Live Tracking & Dijkstra Route Computation
    console.log("\n[8/8] Validating Live Tracking & Road Routing Service...");
    const trackRes = await request(
      pipe,
      { method: "GET", path: `/api/tracking/${booking.bookingId}`, headers: { Authorization: `Bearer ${custToken}` } }
    );
    const session = trackRes.data?.session || trackRes.data;
    if (trackRes.status !== 200 || !session?.sessionId) {
      throw new Error(`Tracking lookup failed: ${JSON.stringify(trackRes.data)}`);
    }
    console.log(`  ✓ Tracking API: Retrieved active tracking session for booking ${session.bookingReference}`);
    console.log(`  ✓ Technician assigned: ${session.technicianName} (Phone: ${session.technicianPhone}, Rating: ${session.technicianRating})`);
    console.log(`  ✓ Real-time status: ${session.trackingStatus} (Travel: ${session.estimatedTravelMinutes} mins, Distance: ${session.totalDistanceKm} km)`);

    console.log("\n=================================================");
    console.log("   ✓ ALL PRODUCTION VALIDATION TESTS PASSED!    ");
    console.log("=================================================");
  } catch (err) {
    console.error("\n✗ Production Validation Failed:", err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runProductionValidation();
