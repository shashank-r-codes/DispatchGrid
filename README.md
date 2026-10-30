# DispatchGrid – Intelligent Workforce Scheduling & Recovery Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-blue.svg)](https://www.sqlite.org/)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-CP--SAT-orange.svg)](https://developers.google.com/optimization)
[![Tests](https://img.shields.io/badge/Tests-45%2F45%20Passing-emerald.svg)](scripts/runTests.ts)

**DispatchGrid** is an end-to-end intelligent workforce dispatch and dynamic schedule recovery platform designed for field service management across **Electrical**, **AC (Air Conditioning)**, and **Plumbing** specialisations. 

It implements automated customer self-service booking, strict qualification and certification filtering, Metro Dijkstra road-network routing, deterministic multi-criteria scoring, atomic technician job offers with rejection cascading, Google OR-Tools CP-SAT schedule optimisation, and real-time disruption recovery across 6 field scenarios.

---

## 📑 Table of Contents

1. [Architecture & 3 Distinct Experiences](#1-three-separate-application-experiences)
2. [Demo Credentials (20 Technicians & Admin)](#2-demo-credentials)
3. [Quick Start & Setup Instructions](#3-quick-start--setup-instructions)
4. [Dataset & Seed Script](#4-exact-dataset-requirements)
5. [Scheduling Algorithms & Multi-Criteria Scoring](#5-scheduling-engine--algorithms)
6. [Disruption & Adaptive Recovery Scenarios](#6-disruption--adaptive-recovery-scenarios)
7. [Database Schema & Table Changes](#7-database-schema--tables)
8. [REST API Endpoints](#8-rest-api-documentation)
9. [Automated Test Suite & Acceptance Results](#9-automated-test-suite)
10. [Assumptions & Limitations](#10-assumptions--limitations)

---

## 1. Three Separate Application Experiences

DispatchGrid provides three completely decoupled user experiences:

### A. Admin / Dispatcher Command Center (`/` or `Admin / Dispatcher` pill)
Full operational visibility and manual override controls across 11 dedicated navigation tabs:
1. **Overview Dashboard**: High-level operational summaries, 12 live KPI cards, unassigned jobs requiring triage with actionable explanations, and real-time offer cascade logs.
2. **All Jobs / Bookings**: Filterable table of all 105+ service bookings with priority triage, auto-assign trigger, and explainability modals.
3. **Technician Management**: Directory of all 20 technicians showing username, display name, skills, certifications, shift hours, ratings, and current workload.
4. **Technician Verification**: Administrator review center to approve, reject, or suspend specialist accounts.
5. **Live Dispatch Map**: Full-screen interactive Leaflet map rendering Bengaluru Metro Road Network nodes, active routes, and technician GPS pins.
6. **Technician Shift Timeline**: Gantt schedule timeline displaying shift boundaries (08:00–18:00), booked appointments, travel times, and emergency capacity buffers.
7. **Scheduling and Optimisation**: OR-Tools CP-SAT objective weight tuning panel with "Run CP-SAT Optimizer" execution and Before-and-After schedule comparisons.
8. **Disruption Simulator**: In-page interactive simulator supporting all 6 disruption scenarios with immediate cascading rebalance.
9. **Recovery Audit Logs**: Immutable audit log of all system recovery operations, timestamps, affected bookings, and root cause notes.
10. **Benchmark Runner**: Algorithmic performance benchmark suite testing 25, 100, 250, and 500 problem sizes.
11. **Documentation and Architecture**: Complete embedded technical reference.

#### 12 Admin Dashboard KPI Metrics:
- **Total Jobs**
- **Pending Jobs**
- **Assigned Jobs**
- **Jobs in Progress**
- **Completed Jobs**
- **Cancelled Jobs**
- **Unassigned Jobs**
- **Emergency Jobs**
- **Available Technicians**
- **Unavailable Technicians**
- **Pending Technician Verifications**
- **SLA Violations and Jobs at Risk**

### B. Customer Portal (`Customer Portal` pill)
Public self-service interface without requiring customer login:
- **Step 1: Service Selection**: Electrical, AC, or Plumbing.
  > *Strict Specialisation Rule*: AC is isolated from general electricians. Technicians must hold verified EPA Section 608 Universal or HVAC Excellence certifications.
- **Step 2: Job Information**: Customer name, phone, address, coordinates, preferred appointment window, duration, requested priority, and notes.
- **Step 3: Instant Booking Submission**: Automatically generates a unique booking reference (`DG-2026-XXXXX`), persists record in SQLite, and immediately triggers the automatic scheduling engine. **No admin intervention or "Auto Allot" button required!**
- **Step 4: Live Booking Tracking**: Lookup by Booking Reference + Registered Phone Number (protects customer privacy). Displays assigned technician name, contact, Dijkstra road distance, travel time, estimated arrival time (ETA), and Leaflet route with simulated GPS tracking.

### C. Technician Portal (`Technician Portal` pill)
Private workspace for technicians (`electrician1` to `electrician20`):
- **Technician Login View**: Clean authentication screen with username/password inputs and a 1-click test selector for all 20 seeded specialists.
- **7 Dashboard Navigation Tabs**:
  1. *My Dashboard*: Shift status, workload, rating, and immediate alerts.
  2. *New Job Offers*: Prominent offer cards with customer details, Dijkstra travel distance, travel minutes, and **Accept** / **Reject** buttons (with mandatory rejection reason).
  3. *My Assigned Jobs*: Active job lifecycle buttons (`On The Way` → `Start Work` → `Complete Job`) and "Report Service Delay".
  4. *My Schedule*: Daily itinerary with map route navigation.
  5. *Availability*: Shift working hours update and "Report Sickness / Unavailability".
  6. *Job History*: Completed service jobs with customer ratings and reviews.
  7. *Profile and Skills*: Verified certifications, skills, and licensed categories.
- **Strict Data Isolation**: Technicians can only view their own offers and assigned jobs.

---

## 2. Demo Credentials

### Seeded Technician Accounts (Password: `12345`)
All 20 technicians are seeded with hashed passwords (`bcryptjs`) and initial status `APPROVED`:

| Username | Specialist Display Name | Primary Category | Verified Certifications & Skills |
|---|---|---|---|
| `electrician1` | Rajesh Kumar | Electrical | Licensed Wireman Grade A &middot; Wiring, DB Overhaul |
| `electrician2` | Amit Patel | AC | EPA Section 608 Universal, HVAC Master &middot; Split AC, R32 |
| `electrician3` | Suresh Nair | Plumbing | Licensed Master Plumber (LMP) &middot; Concealed Pipe Leakage |
| `electrician4` | Vikram Rao | Electrical | Wireman Grade A &middot; Circuit Breakers, Switchboards |
| `electrician5` | Kavita Sharma | Plumbing | Licensed Master Plumber (LMP) &middot; Fixtures, Drainage |
| `electrician6` | Mohammad Ali | Electrical | Wireman Grade A &middot; Lighting, Short Circuit Faults |
| `electrician7` | Pooja Hegde | AC | HVAC Excellence Master &middot; Compressor Inverter PCB |
| `electrician8` | Arjun Reddy | Electrical & Plumbing | Wireman Grade A &middot; General Repairs |
| `electrician9` | Deepak Verma | AC | EPA Section 608 &middot; Refrigerant R410A Vacuum Testing |
| `electrician10` | Rohan Kulkarni | Electrical | Wireman Grade A &middot; Domestic Wiring, Fans |
| `electrician11` | Girish Nair | Electrical | Wireman Grade A &middot; Industrial Power Setup |
| `electrician12` | Farhan Siddiqui | AC | EPA Section 608 &middot; Multi-split HVAC Servicing |
| `electrician13` | Naveen Prasad | Plumbing | Licensed Master Plumber &middot; Submersible Booster Pumps |
| `electrician14` | Prakash Joshi | Electrical | Wireman Grade A &middot; Surge Protection, Grounding |
| `electrician15` | Santosh Yadav | AC | HVAC Excellence Master &middot; Commercial Chillers |
| `electrician16` | Manoj Deshmukh | Plumbing | Licensed Master Plumber &middot; Acoustic Leak Detection |
| `electrician17` | Anand Iyer | Electrical | Wireman Grade A &middot; Emergency Fault Pinpointing |
| `electrician18` | Karthik Subramanian | AC | EPA Section 608 Universal &middot; Inverter AC Diagnostics |
| `electrician19` | Sachin Patil | Plumbing | Licensed Master Plumber &middot; Hydro-jet Pipe De-clogging |
| `electrician20` | Vinay Kumar | Multi-Skill (All 3) | EPA Universal, Master Plumber, Wireman Grade A |

### Administrator Account
- **Username / Email**: `admin` or `admin@dispatchgrid.io`
- **Password**: `admin123`
- **Role**: `ADMIN` (Full operational dispatch control)

---

## 3. Quick Start & Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: 3.10+ (optional, required only for executing external OR-Tools CP-SAT solver script)

### Installation & Run

```bash
# 1. Clone or navigate to the repository
cd dispatchgrid

# 2. Install dependencies
npm install

# 3. Seed the comprehensive workforce dataset (20 Techs & 105 Jobs)
npm run seed

# 4. Run the automated test suite (verifies all 45 criteria)
npm test

# 5. Start the full-stack development server
npm run dev
```

The application will be live at: **http://localhost:3000**

---

## 4. Exact Dataset Requirements

The seed script (`npm run seed` or `npx tsx scripts/seed.ts`) populates a realistic, reproducible dataset in SQLite (`dispatchgrid.db`):

- **20 Technicians**:
  - Exactly matched to usernames `electrician1` through `electrician20` (Password: `12345`).
  - Realistic names, addresses, ratings (4.75–4.95), and varied categories (Electrical, AC, Plumbing, Multi-skill).
  - All initial technicians seeded as `APPROVED` and `ACTIVE`.
- **105 Service Jobs**:
  - **25 Completed Jobs**: Stored with realistic customer ratings and review comments.
  - **15 In-Progress Jobs**: Active jobs currently occupying technician capacity.
  - **30 Assigned Jobs**: Confirmed appointments distributed across Bengaluru road nodes.
  - **8 Active Offers**: Real-time job offers awaiting technician response.
  - **15 Pending Jobs**: Feasible customer requests ready for auto-assignment.
  - **7 Unassignable Jobs**: Infeasible bookings with actionable explanations (e.g., all EPA AC techs booked, location outside coverage zone).
  - **5 Cancelled Jobs**: Retained for audit and capacity accounting.
- **Priority Distribution**:
  - **3 Emergency Jobs**: Verified emergency status with reserved capacity allocation.
  - **18 High-Priority Jobs**: Tight SLA deadlines.
  - **84 Normal Jobs**: Standard appointments.
- **Idempotency**: The seed script drops and rebuilds tables cleanly without producing duplicate keys.

---

## 5. Scheduling Engine & Algorithms

### Workflow Architecture

```
CUSTOMER SUBMITS REQUEST (Guest / No Login)
              │
              ▼
   SAVE JOB IN DATABASE (Status: PENDING)
              │
              ▼
    TRIGGER SCHEDULING ENGINE IMMEDIATELY
              │
              ▼
   PRIORITY QUEUE ORDERING (Emergency > High > Normal + Aging)
              │
              ▼
   HARD CONSTRAINT ELIGIBILITY FILTERING
   (Verification, AC Certification, Shift Hours, Service Area, Overlaps)
              │
              ▼
   DIJKSTRA SHORTEST ROAD PATH ROUTING
   (Metro Road Network Edge Weights: Travel Minutes & Km)
              │
              ▼
   MULTI-CRITERIA CANDIDATE SCORING
   Cost = w1*Travel + w2*SLA + w3*Workload + w4*Disruption
   (Round-Robin fairness tie-break within 0.05 score)
              │
              ▼
   ATOMIC JOB OFFER CREATED (Status: OFFERED)
              │
   ┌──────────┴──────────┐
   ▼                     ▼
TECHNICIAN ACCEPTS    TECHNICIAN REJECTS
   │                     │
   ▼                     ▼
CONFIRM ASSIGNMENT    RECORD REJECTION REASON
Status: ASSIGNED      AUTOMATICALLY FIND NEXT BEST CANDIDATE
Update Customer ETA   SEND REPLACEMENT OFFER
```

### Deterministic Multi-Criteria Cost Function
For candidate $i$ on job $j$:

$$\text{Cost}_i = w_1 \cdot \frac{\text{TravelTime}_i}{\max(\text{Travel})} + w_2 \cdot \text{SLARisk} + w_3 \cdot \frac{\text{ActiveJobs}_i}{\max(\text{Workload})} + w_4 \cdot \text{Disruption}$$

- **Travel Time ($w_1 = 0.35$)**: Dijkstra shortest path minutes on road network.
- **SLA Risk ($w_2 = 0.25$)**: Penalty based on urgency and deadline proximity.
- **Workload Balance ($w_3 = 0.25$)**: Equitable distribution to avoid technician burnout.
- **Disruption Cost ($w_4 = 0.15$)**: Minimises cascading ripple effect on existing schedule.

---

## 6. Disruption & Adaptive Recovery Scenarios

The dynamic recovery engine (`RecoveryEngine.handleDisruption`) manages all 6 real-world disruption scenarios:

1. **Technician Unavailable (Sickness / Breakdown)**:
   - Sets technician to `UNAVAILABLE`.
   - Protects `IN_PROGRESS` and `COMPLETED` work.
   - Re-optimises downstream future jobs to alternative qualified technicians.
2. **Vehicle Breakdown**:
   - Immediately reroutes technician's next en-route booking.
3. **Emergency Job Arrival**:
   - Taps reserved emergency capacity (11:00–11:30) or preempts low-priority bookings.
4. **Job Duration Overrun / Delay**:
   - Propagates delay downstream, recalculates travel time, and reschedules conflicting slots.
5. **Job Cancellation**:
   - Frees up technician capacity and pulls forward subsequent bookings.
6. **Early Completion**:
   - Opens immediate capacity to pull forward scheduled jobs.

---

## 7. Database Schema & Tables

Stored in SQLite with WAL mode (`better-sqlite3`):
- `users`: Core credentials, roles (`ADMIN`, `CUSTOMER`, `TECHNICIAN`), hashed passwords, account statuses.
- `technician_profiles`: Specialisations, shift hours, ratings, verification status (`APPROVED`, `PENDING`, `REJECTED`, `SUSPENDED`).
- `skills` & `technician_skills`: Skills registry across Electrical, AC, and Plumbing.
- `certifications` & `technician_certifications`: Trade licenses and certifications (EPA Section 608 Universal, HVAC Excellence, Master Plumber, Wireman Grade A).
- `services`: Service catalogue with duration, prices, and required skills/certs.
- `bookings`: Master job records (`PENDING`, `OFFERED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `UNASSIGNED`).
- `job_offers`: Atomic offer ledger (`offer_id`, `booking_id`, `technician_id`, `status` ['OFFERED','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN'], `rejection_reason`, travel time, score).
- `assignment_records`: Explainability log storing evaluated candidates and rejected alternatives.
- `recovery_audit_logs`: Immutable audit trail of all disruptions and cascading rebalances.
- `notifications`: In-app notification queue for customers and technicians.

---

## 8. REST API Documentation

### Authentication & Profiles
- `POST /api/auth/login`: Authenticate with `username` or `email` and `password`. Returns JWT token.
- `GET /api/auth/me`: Current session profile.

### Customer Bookings & Tracking
- `POST /api/bookings`: Guest or authenticated booking submission (initiates immediate auto-dispatch).
- `GET /api/bookings/track?reference=...&phone=...`: Protected customer tracking with phone verification. Returns technician location, distance, travel time, and Dijkstra road path.

### Technician Workspace
- `GET /api/technicians/my/offers`: Active job offers for logged-in technician.
- `POST /api/technicians/offers/:offerId/accept`: Atomically accepts offer and locks assignment.
- `POST /api/technicians/offers/:offerId/reject`: Rejects offer with mandatory reason; **triggers automatic re-offer cascade to next best candidate**.
- `PUT /api/bookings/:bookingId/status`: Status lifecycle updates (`ON_THE_WAY`, `IN_PROGRESS`, `COMPLETED`).
- `POST /api/technicians/report-delay`: Report expected delay in minutes with root cause.
- `POST /api/technicians/report-unavailability`: Report sickness or vehicle breakdown.

### Admin Operations
- `GET /api/bookings`: All bookings with filters (category, status, priority, date).
- `GET /api/technicians`: All 20 technicians.
- `GET /api/dispatch/offers-history`: Complete offer and rejection audit log.
- `POST /api/dispatch/optimize`: Execute OR-Tools CP-SAT global schedule optimizer.
- `POST /api/recovery/simulate`: In-page disruption simulator.
- `POST /api/dispatch/benchmark`: Algorithmic benchmark runner (25, 100, 250, 500 sizes).

---

## 9. Automated Test Suite

Run the full automated test suite verifying all Part 13 acceptance criteria:

```bash
npm test
```

### Test Results Summary:
```
=================================================
   DISPATCHGRID COMPREHENSIVE AUTOMATED TESTS   
=================================================
▶ SUITE 1: DATASET VERIFICATION (Part 6 & 13)
  ✓ PASS: Database contains at least 20 seeded technicians
  ✓ PASS: Database contains at least 100 service jobs
  ✓ PASS: All 20 seeded technicians are initialised as APPROVED for demo
  ✓ PASS: Sufficient AC certified specialists seeded
  ✓ PASS: Sufficient Plumbing specialists seeded
  ✓ PASS: Sufficient Electrical specialists seeded
  ✓ PASS: Dataset contains EMERGENCY, HIGH, and NORMAL priority jobs

▶ SUITE 2: TECHNICIAN AUTHENTICATION & LOGIN (Part 2)
  ✓ PASS: Technician electrician1 exists in database
  ✓ PASS: Password 12345 verifies for electrician1
  ✓ PASS: Invalid password correctly rejected for electrician1
  ✓ PASS: Technician electrician2 exists in database
  ✓ PASS: Password 12345 verifies for electrician2
  ✓ PASS: JWT session token generated and verified accurately

▶ SUITE 3: CUSTOMER BOOKING & TRACKING (Part 1.B & 5)
  ✓ PASS: Customer submits Electrical booking without requiring login
  ✓ PASS: Automatic scheduling engine finds best candidate immediately without admin intervention
  ✓ PASS: Job offer dispatched to selected technician with status OFFERED
  ✓ PASS: Customer tracking succeeds with matching reference and phone number
  ✓ PASS: Dijkstra road routing calculates distance and travel time for customer ETA
  ✓ PASS: Customer privacy strictly protected: access rejected with incorrect phone number

▶ SUITE 4: SCHEDULING CONSTRAINTS & AC SPECIALISATION (Part 1.B & 3)
  ✓ PASS: AC specialization enforced: General electrician rejected for AC job
  ✓ PASS: Actionable explanation cites lack of required AC specialisation/certification
  ✓ PASS: Certified AC specialist is evaluated as eligible
  ✓ PASS: Priority queue prioritises EMERGENCY score (10,000) over NORMAL score (1,000)

▶ SUITE 5: TECHNICIAN ACCEPTANCE, REJECTION & CASCADE (Part 4)
  ✓ PASS: Technician rejects job offer with recorded reason
  ✓ PASS: Offer status atomically transitioned to REJECTED
  ✓ PASS: Rejection reason persisted permanently in database
  ✓ PASS: System automatically finds next best eligible technician and creates replacement offer
  ✓ PASS: Next technician accepts the replacement job offer
  ✓ PASS: Accepted offer atomically marked ACCEPTED
  ✓ PASS: Booking status atomically updated to ASSIGNED in schedule
  ✓ PASS: Confirmed start and end times locked in schedule
  ✓ PASS: Job status transitions to IN_PROGRESS when technician starts work
  ✓ PASS: Job status transitions to COMPLETED upon finish

▶ SUITE 6: ADAPTIVE DISRUPTION RECOVERY (Part 8)
  ✓ PASS: Scenario 1: Technician sickness triggers dynamic schedule recovery
  ✓ PASS: Scenario 1: Recovery completed successfully
  ✓ PASS: Immutable audit log recorded in recovery_audit_logs for sickness
  ✓ PASS: Scenario 2: Vehicle breakdown handled with adaptive rerouting
  ✓ PASS: Scenario 3: Emergency request capacity dynamically allocated
  ✓ PASS: Scenario 4: Job duration overrun adjusted without schedule churn
  ✓ PASS: Scenario 5: Job cancellation safely removes booking and frees capacity
  ✓ PASS: Scenario 6: Early completion frees technician for downstream capacity
  ✓ PASS: Mandatory Recovery Rule: Completed jobs remain strictly unchanged

▶ SUITE 7: ADMIN AUDIT & MONITORING (Part 1.A & 11)
  ✓ PASS: Admin can inspect all 20 technicians in workforce
  ✓ PASS: Unassigned jobs contain actionable constraint explanations
  ✓ PASS: Admin can inspect complete technician offer & rejection history

=================================================
             TEST EXECUTION SUMMARY              
=================================================
  Total Criteria Tested: 45
  Passed:                45
  Failed:                0

✓ ALL 32 ACCEPTANCE CRITERIA PASSED 100%!
=================================================
```

---

## 10. Assumptions & Limitations

1. **Simulated GPS**: In local development, technician coordinates along the route are simulated via Metro Dijkstra road network nodes and clearly tagged with a `(Simulated Live GPS)` indicator badge.
2. **Demo Password**: All seeded technicians share the password `12345` for initial demonstration convenience; this must be rotated before production deployment.
3. **Road Graph**: The road network model uses 10 primary metro hubs across Bengaluru (CBD, Indiranagar, Whitefield, Koramangala, Hebbal, Jayanagar, Rajajinagar, Electronic City, Kalyan Nagar, Banashankari).
4. **Time Windows**: Default service windows range between 45 and 90 minutes with 15–30 minute road buffer intervals.
