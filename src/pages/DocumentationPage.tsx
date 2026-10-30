import React, { useState } from "react";
import { BookOpen, Layers, Database, Cpu, CheckCircle2, ShieldCheck, Terminal, Server, Compass, FileText } from "lucide-react";

export const DocumentationPage: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<
    "architecture" | "algorithms" | "schema" | "api" | "demo" | "deployment"
  >("architecture");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-1 text-blue-400 text-xs font-bold uppercase tracking-wider">
          <BookOpen className="w-4 h-4" /> Technical Documentation & Specification
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          DispatchGrid Enterprise Architecture & System Guide
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Complete implementation blueprint covering Phases 1 through 8, MySQL schemas, Dijkstra routing, CP-SAT optimizer, and dynamic recovery engine.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-6">
        {[
          { id: "architecture", label: "1. System Architecture" },
          { id: "algorithms", label: "2. Implemented Algorithms" },
          { id: "schema", label: "3. Relational Schema & DDL" },
          { id: "api", label: "4. REST API Documentation" },
          { id: "demo", label: "5. 10 Demonstration Scenarios" },
          { id: "deployment", label: "6. Setup & Deployment" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveDocTab(tab.id as any)}
            className={`pb-3 transition relative cursor-pointer ${
              activeDocTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ARCHITECTURE */}
      {activeDocTab === "architecture" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" /> End-to-End System Architecture (Phase 1 - 8)
          </h2>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre overflow-x-auto">
{`CUSTOMER APP            TECHNICIAN APP            ADMIN DISPATCHER
      │                       │                         │
      └───────────────────────┼─────────────────────────┘
                              ▼
                REACT FRONTEND (Vite, Tailwind, Leaflet)
                              │
                              ▼ [REST + JWT Bearer Auth]
              NODE.JS + EXPRESS BACKEND (Port 3000)
                              │
          ┌───────────────────┼─────────────────────────┐
          ▼                   ▼                         ▼
  Authentication &      Service Catalogue &        Dynamic Recovery
  Role Authorization    Booking Lifecycle          Engine (Phase 7)
          │                   │                         │
          └───────────────────┼─────────────────────────┘
                              ▼
            INTELLIGENT SCHEDULING & ASSIGNMENT ENGINE
    ┌────────────────────────────────────────────────────────┐
    │ 1. Priority Queue (Emergency, SLA, Aging Anti-Starve)  │
    │ 2. Eligibility Filter (10 Hard Constraints + AC Rule)  │
    │ 3. Dijkstra Shortest Road Network Routing              │
    │ 4. Customer Technician Preference Handling             │
    │ 5. Multi-Criteria Assignment Scoring (w1 to w4)        │
    │ 6. Round Robin Fairness Tie-Breaker                    │
    │ 7. Google OR-Tools CP-SAT Formulation (Python Engine)  │
    └────────────────────────────────────────────────────────┘
                              │
                              ▼
          RELATIONAL DATABASE STORAGE (ACID Transactions)
                 MySQL 8.0 DDL & SQLite WAL Engine
          (Tables: users, profiles, skills, certs, bookings,
           assignment_records, recovery_audit_logs, reviews)`}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 text-sm">Organisational Rule</div>
              <p className="text-slate-600">
                AC is an organisational specialisation under the Electrical department, but possesses distinct skills and certifications (EPA 608 Universal). A general electrician is strictly disqualified from AC assignments.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 text-sm">Hard Constraints</div>
              <p className="text-slate-600">
                10 non-negotiable constraints: Verification (APPROVED only), Skills match, Certifications, Working hours, Non-overlapping appointments, Travel feasibility, Service areas, Ongoing/Completed work protection.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 text-sm">Disruption Recovery</div>
              <p className="text-slate-600">
                Automated triage of technician sickness, van breakdowns, and job delays (+15m/+30m/+60m). Evaluated against reserved emergency capacity intervals (11:00-11:30) with complete audit logging.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALGORITHMS */}
      {activeDocTab === "algorithms" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" /> Algorithmic Formulations & Constraints
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-900 text-sm">1. Priority Queue & Dynamic Aging</div>
              <p>
                Calculates dynamic dispatch ranking:
                <br />
                <code>Priority Score = Base Priority (Emergency: 10000, High: 5000, Normal: 1000) + (Waiting Minutes × 5) + SLA Urgency Factor</code>
                <br />
                Aging prevents starvation of normal priority jobs while ensuring emergencies are prioritized.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-900 text-sm">2. Dijkstra Shortest Road Network Routing</div>
              <p>
                Urban road networks are represented as weighted graphs: <code>G = (V, E)</code> where nodes represent major metro junctions and edge weights represent real traffic travel minutes (e.g., Bellary Main Rd, Hosur Elevated Tollway).
                Calculates true transit time instead of straight-line euclidean distance.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-900 text-sm">3. Multi-Criteria Assignment Cost Formula (Phase 4.6)</div>
              <p>
                <code>Assignment Cost = (w1 × Travel Cost) + (w2 × SLA Risk) + (w3 × Workload Imbalance) + (w4 × Schedule Disruption Cost)</code>
                <br />
                Weights: <code>w1 = 0.35, w2 = 0.25, w3 = 0.25, w4 = 0.15</code>. The candidate with the lowest cost is selected. Round Robin fairness serves as tie-breaker when costs are within 0.05.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-900 text-sm">4. Google OR-Tools CP-SAT Objective (Phase 5.5)</div>
              <p>
                <code>Total Cost = (w1 × Total Travel) + (w2 × SLA Penalty) + (w3 × Workload Imbalance) + (w4 × Overtime) + (w5 × Preference Penalty) + (w6 × Schedule Change Penalty)</code>
                <br />
                Respects 10 hard constraints. Completed and ongoing jobs are locked and protected.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCHEMA */}
      {activeDocTab === "schema" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs text-slate-700">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" /> Relational Database Schema (MySQL 8.0+ / SQLite)
          </h2>
          <p className="text-slate-500">
            Exported from <code>database/schema.sql</code>. All tables enforce foreign keys, unique references, and indexes.
          </p>

          <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[500px]">
{`-- Relational Tables Implemented in DispatchGrid:
1. users (user_id PK, full_name, email UNIQUE, role, account_status, password_hash)
2. customer_profiles (customer_id PK, user_id FK, profile_picture_url)
3. customer_addresses (address_id PK, customer_id FK, address_line, city, state, pincode, latitude, longitude, is_default)
4. technician_profiles (technician_id PK, user_id FK, experience_years, service_categories, verification_status, shift_start_time, shift_end_time, reserved_emergency_capacity, average_rating)
5. skills (skill_id PK, category, skill_name UNIQUE)
6. certifications (certification_id PK, category, certification_name UNIQUE, issuing_authority)
7. technician_skills (technician_id FK, skill_id FK, years_experience)
8. technician_certifications (id PK, technician_id FK, certification_id FK, certificate_number)
9. services (service_id PK, service_name, category, indicative_price, estimated_duration_minutes, required_skills, required_certifications)
10. bookings (booking_id PK, booking_reference UNIQUE, customer_id FK, service_id FK, assigned_technician_id FK, requested_priority, verified_priority, booking_status, latitude, longitude, preferred_date, preferred_start_time, estimated_travel_time_minutes)
11. booking_status_history (history_id PK, booking_id FK, from_status, to_status, changed_by_user_id, change_reason, timestamp)
12. assignment_records (record_id PK, scheduling_run_id, booking_id FK, assigned_technician_id, calculated_travel_time_minutes, assignment_score, selection_reason, evaluated_candidates, rejected_alternatives)
13. recovery_audit_logs (recovery_id PK, disruption_type, affected_technician_id, affected_booking_ids, previous_assignments, revised_assignments, reason, execution_time_ms, status)
14. reviews (review_id PK, booking_id FK UNIQUE, customer_id FK, technician_id FK, rating, comment, service_quality_tags)`}
          </pre>
        </div>
      )}

      {/* TAB 4: API */}
      {activeDocTab === "api" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs text-slate-700">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" /> REST API Endpoints Specification
          </h2>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 font-mono text-[11px]">
            <div className="p-3 bg-slate-50 font-bold text-slate-800">Authentication & Roles</div>
            <div className="p-3 flex justify-between"><span>POST /api/auth/register-customer</span><span className="text-slate-500">Register customer with address</span></div>
            <div className="p-3 flex justify-between"><span>POST /api/auth/register-technician</span><span className="text-slate-500">Technician application (status: PENDING)</span></div>
            <div className="p-3 flex justify-between"><span>POST /api/auth/login</span><span className="text-slate-500">JWT login (Role: ADMIN, CUSTOMER, TECHNICIAN)</span></div>
            <div className="p-3 flex justify-between"><span>GET /api/auth/me</span><span className="text-slate-500">Get current profile & permissions</span></div>

            <div className="p-3 bg-slate-50 font-bold text-slate-800">Service Booking & Lifecycle</div>
            <div className="p-3 flex justify-between"><span>POST /api/bookings</span><span className="text-slate-500">Submit multi-step booking (6 steps)</span></div>
            <div className="p-3 flex justify-between"><span>GET /api/bookings</span><span className="text-slate-500">Role-filtered bookings list</span></div>
            <div className="p-3 flex justify-between"><span>PUT /api/bookings/:id/status</span><span className="text-slate-500">Controlled lifecycle status transition</span></div>
            <div className="p-3 flex justify-between"><span>PUT /api/bookings/:id/priority</span><span className="text-slate-500">Admin priority verification (Emergency triage)</span></div>
            <div className="p-3 flex justify-between"><span>POST /api/bookings/:id/review</span><span className="text-slate-500">Submit 1-5 star review & quality tags</span></div>

            <div className="p-3 bg-slate-50 font-bold text-slate-800">Intelligent Scheduling & Optimization</div>
            <div className="p-3 flex justify-between"><span>POST /api/dispatch/auto-assign/:id</span><span className="text-slate-500">Run multi-criteria matching on single job</span></div>
            <div className="p-3 flex justify-between"><span>POST /api/dispatch/optimize</span><span className="text-slate-500">Run global CP-SAT optimizer (weights w1-w6)</span></div>
            <div className="p-3 flex justify-between"><span>GET /api/dispatch/explain/:id</span><span className="text-slate-500">Inspect assignment decision audit</span></div>
            <div className="p-3 flex justify-between"><span>GET /api/dispatch/road-network</span><span className="text-slate-500">Dijkstra graph nodes & edges</span></div>

            <div className="p-3 bg-slate-50 font-bold text-slate-800">Dynamic Recovery & Scalability</div>
            <div className="p-3 flex justify-between"><span>POST /api/recovery/simulate</span><span className="text-slate-500">Simulate Sickness / Breakdown / Delay</span></div>
            <div className="p-3 flex justify-between"><span>GET /api/recovery/audit-logs</span><span className="text-slate-500">List all recovery events & notifications</span></div>
            <div className="p-3 flex justify-between"><span>POST /api/benchmark/run</span><span className="text-slate-500">Run 100 to 5,000 job benchmark suite</span></div>
          </div>
        </div>
      )}

      {/* TAB 5: DEMONSTRATION SCENARIOS */}
      {activeDocTab === "demo" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs text-slate-700">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" /> 10 Final Demonstration Scenarios (Phase 8.9)
          </h2>

          <div className="space-y-3">
            {[
              { num: 1, title: "Normal AC Repair Booking", desc: "Customer books AC Deep Servicing. System evaluates Amit Patel (Certified HVAC Specialist) vs General Electrician and assigns Amit." },
              { num: 2, title: "Customer Requesting Preferred Technician", desc: "Customer selects Amit Patel. Since Amit satisfies skills, certs, and shift constraints, preference is honored over default cost." },
              { num: 3, title: "Nearest Technician Lacking Required Skills", desc: "Rajesh Kumar is geographically closer (5m away) to an AC installation booking, but lacks EPA 608 certification. Hard constraint excludes Rajesh; Amit is assigned." },
              { num: 4, title: "Workload Balancing Across Technicians", desc: "Two electricians have similar travel distance; Round Robin fairness selects the technician with fewer active jobs today." },
              { num: 5, title: "Technician Becoming Unavailable (Sickness)", desc: "Click 'Simulate Disruption' -> Technician Sickness. All future scheduled appointments are immediately rerouted to certified peers; ongoing work is protected." },
              { num: 6, title: "Verified Emergency Arriving", desc: "Customer submits Emergency pipe burst. Admin verifies priority. System assigns into reserved emergency capacity buffer (11:00-11:30)." },
              { num: 7, title: "Technician Reporting Unexpected Delay", desc: "Technician reports +30m delay on an active job. System updates completion time and verifies downstream appointment feasibility." },
              { num: 8, title: "No Eligible Technician Available", desc: "Booking requests rare certification with zero matching active technicians. Engine safely flags job as unassigned and alerts dispatcher." },
              { num: 9, title: "Multiple Concurrent Booking Requests", desc: "Global CP-SAT optimizer processes all accepted jobs simultaneously with zero overlapping conflicts." },
              { num: 10, title: "Optimization Engine Fallback & Recovery", desc: "If the Python solver times out, the native resilient constraint heuristic takes over without destroying the previous valid schedule." },
            ].map((s) => (
              <div key={s.num} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {s.num}
                </span>
                <div>
                  <div className="font-bold text-slate-900">{s.title}</div>
                  <p className="text-slate-600 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: DEPLOYMENT */}
      {activeDocTab === "deployment" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" /> Production Setup & Deployment Instructions
          </h2>

          <div className="space-y-3 font-mono text-[11px]">
            <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-2">
              <div className="text-blue-400 font-bold"># 1. Local Run (Development):</div>
              <div>git clone https://github.com/organization/dispatchgrid.git</div>
              <div>cd dispatchgrid</div>
              <div>npm install</div>
              <div>npm run dev   # Runs full-stack Express server on http://localhost:3000</div>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-2">
              <div className="text-blue-400 font-bold"># 2. Production Build & Start:</div>
              <div>npm run build</div>
              <div>npm start     # Starts production Express server serving Vite dist</div>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-2">
              <div className="text-blue-400 font-bold"># 3. MySQL Production Database Migration:</div>
              <div>mysql -u root -p -h localhost &lt; database/schema.sql</div>
              <div># Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD in production .env</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
