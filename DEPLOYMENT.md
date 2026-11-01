# DispatchGrid — Production Deployment Guide for Render

This guide provides end-to-end instructions for deploying the **DispatchGrid Intelligent Workforce Scheduling & Recovery Platform** to [Render](https://render.com) as a production Web Service with persistent SQLite storage.

---

## 1. Architecture Overview

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Motion, Leaflet.
- **Backend**: Node.js, Express, TypeScript (`tsx`), better-sqlite3.
- **Single-Origin Deployment**: In production, Express serves the compiled Vite static assets from `/dist` and handles SPA client-side deep links (`/customer-portal`, `/admin-dashboard`, `/technician-portal`, etc.) with fallback to `index.html`. Unmatched API requests (`/api/*`) strictly return JSON `404` errors.
- **Database & Persistence**: SQLite using `better-sqlite3`. On Render, database and user file uploads are stored on a mounted **Persistent Disk** (e.g. `/var/data`).
- **Safety**: On a new empty database, DispatchGrid automatically seeds the initial catalog, users, and 20 technicians. On every subsequent server restart or redeploy, DispatchGrid detects existing data and **never** drops tables or reseeds.

---

## 2. Render Web Service Configuration

In your [Render Dashboard](https://dashboard.render.com/):

1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository: `https://github.com/shashank973r-collab/DispatchGrid` (or select your fork).
3. Set the following primary configuration options:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `dispatchgrid` | Or your preferred service name |
| **Region** | Singapore / Frankfurt / Oregon | Choose closest to your target audience |
| **Branch** | `master` (or `main`) | The deployment branch |
| **Root Directory** | *(Leave blank)* | Defaults to repository root `.` |
| **Runtime** | `Node` | Node.js 18+ or 20+ |
| **Build Command** | `npm install && npm run build` | Installs dependencies and builds the Vite frontend |
| **Start Command** | `npm start` | Runs `tsx server.ts` |
| **Plan** | Starter or Standard | Requires a plan that supports **Persistent Disks** |

---

## 3. Persistent Disk Configuration (CRITICAL for SQLite)

SQLite writes directly to the local disk. Render containers have an ephemeral filesystem that resets on every deploy or restart. To persist your database, customer bookings, reviews, and uploaded photos permanently:

1. In your Web Service settings, navigate to the **Disks** tab.
2. Click **Add Disk** / **Attach Disk**.
3. Configure the persistent disk:
   - **Disk Name**: `dispatchgrid-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (minimum; scale up as your volume grows)
4. Save changes.

---

## 4. Environment Variables

In your Render service settings, navigate to **Environment** and add the following environment variables:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production static asset serving, optimized caching, and error sanitization |
| `PORT` | `10000` | Render injects this automatically; Express dynamically listens on `process.env.PORT` bound to `0.0.0.0` |
| `APP_URL` | `https://your-service-name.onrender.com` | Replace with your actual Render Web Service URL |
| `DATABASE_PATH` | `/var/data/dispatchgrid.db` | Points SQLite to the mounted persistent disk |
| `UPLOADS_PATH` | `/var/data/uploads` | Stores uploaded profile photos on the persistent disk |
| `JWT_SECRET` | *(Generate a 32+ character random string)* | Used to sign and verify secure session tokens |
| `NOTIFICATION_TEST_MODE` | `true` | Logs notifications to server console without requiring paid SMS gateway credits |
| `MSG91_AUTH_KEY` | *(Optional)* | Enter your MSG91 Auth Key if live SMS alerts are desired |
| `MSG91_SMS_SENDER_ID` | *(Optional)* | Approved 6-character sender ID |
| `MSG91_SMS_TEMPLATE_ID` | *(Optional)* | Template ID for booking SMS alerts |
| `MSG91_EMAIL_CONFIGURED` | `false` | Set to `true` if MSG91 transactional email is configured |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@dispatchgrid.demo` | Administrator email for emergency dispatch alerts |
| `ADMIN_NOTIFICATION_PHONE` | `+91-98000-00001` | Administrator alert phone number |

> [!TIP]
> To generate a secure `JWT_SECRET` from your command line:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. SQLite Persistence & Auto-Seeding Lifecycle

1. **First-Time Boot (Fresh Persistent Disk)**:
   - When `/var/data/dispatchgrid.db` does not exist, SQLite creates the file and schema.
   - DispatchGrid detects `0` users in the database and automatically populates the seed dataset:
     - 1 Administrator account (`admin@dispatchgrid.demo`)
     - 1 Customer account (`customer@dispatchgrid.demo`)
     - 20 Certified Technicians (`electrician1@dispatchgrid.demo` .. `electrician20@dispatchgrid.demo`)
     - 17 Standard Services across Electrical, AC, and Plumbing categories
     - Core skills and certifications
     - Realistic Bengaluru road network nodes & Dijkstra topology
     - 105+ Historical and Active Service Jobs
2. **Subsequent Restarts / Redeployments**:
   - The server inspects the `users` table and detects existing records.
   - It **skips** seeding and logs:
     `[DispatchGrid] Persistent database detected with XX registered users. Preserving existing data.`
   - Customer bookings, technician locations, reviews, rejection histories, and decision records remain 100% intact.
3. **WAL Mode Compatibility**:
   - The database automatically attempts to activate `PRAGMA journal_mode = WAL`.
   - If the mounted filesystem does not support WAL shared memory (`.db-shm`), DispatchGrid automatically falls back to `DELETE` journal mode without crashing.

---

## 6. External APIs & Network Requirements

| Service | Protocol | Key Required? | Purpose |
| :--- | :--- | :--- | :--- |
| **OpenStreetMap Raster Tiles** | Client HTTPS (`https://*.tile.openstreetmap.org`) | **No API Key** | Interactive Leaflet map rendering in client browser |
| **Dijkstra Road Routing Engine** | In-Memory Local Algorithm | **No API Key** | Real-time shortest path, distance, and travel time computation (0 external cost/latency) |
| **Live Technician Tracking Simulation** | Server-Sent Events (SSE) | **No API Key** | Smooth waypoint interpolation and real-time live map updates |
| **MSG91 SMS / Email** | HTTPS API (`https://api.msg91.com`) | Optional | Live SMS OTP/booking confirmations (bypassed when `NOTIFICATION_TEST_MODE=true`) |

---

## 7. Demo Credentials for Validation

After deployment, open your Render URL in your browser:

- **Admin Login**:
  - URL: `/login` (Select **Admin** role)
  - Email: `admin@dispatchgrid.demo`
  - Password: `admin123`
- **Customer Login**:
  - URL: `/login` (Select **Customer** role)
  - Email: `customer@dispatchgrid.demo`
  - Password: `12345`
- **Technician Login**:
  - URL: `/login` (Select **Technician** role)
  - Email: `electrician1@dispatchgrid.demo` .. `electrician20@dispatchgrid.demo`
  - Password: `12345`
- **Demo Live Tracking Mode (Amit Patel)**:
  - Email: `electrician2@dispatchgrid.demo` (or `amit.patel@dispatchgrid.demo`)
  - Password: `12345`

---

## 8. Verification & Health Monitoring

- **Health Check Endpoint**:
  ```bash
  curl https://your-service-name.onrender.com/api/health
  ```
  Expected Response:
  ```json
  {
    "status": "healthy",
    "platform": "DispatchGrid Intelligent Workforce Scheduling & Recovery Platform",
    "environment": "production",
    "timestamp": "2026-11-01T..."
  }
  ```

- **Local Verification Commands (Run Before Pushing)**:
  ```bash
  # 1. Verify build
  npm run build

  # 2. Run comprehensive automated test suite (86/86 criteria)
  npm test

  # 3. Run production validation probe
  npx tsx scripts/validateProduction.ts
  ```

