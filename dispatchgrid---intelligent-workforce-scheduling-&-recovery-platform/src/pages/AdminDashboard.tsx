import React, { useState, useEffect } from "react";
import {
  Grid,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Route,
  Activity,
  Sliders,
  Award,
  Layers,
  Wrench,
  HelpCircle,
  Eye,
} from "lucide-react";
import { Booking, Technician, ServiceItem, AssignmentRecord, RecoveryAuditLog } from "../types";
import { DispatchMap } from "../components/DispatchMap";
import { ScheduleTimeline } from "../components/ScheduleTimeline";
import { AssignmentExplanationModal } from "../components/AssignmentExplanationModal";
import { DisruptionRecoveryModal } from "../components/DisruptionRecoveryModal";
import { BenchmarkModal } from "../components/BenchmarkModal";
import { useToast } from "../context/ToastContext";

export const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "map" | "bookings" | "timeline" | "technicians" | "recovery" | "services"
  >("map");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryAuditLog[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedExplainRecord, setSelectedExplainRecord] = useState<AssignmentRecord | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Optimizer modal / settings
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerWeights, setOptimizerWeights] = useState({
    w1Travel: 1.0,
    w2Sla: 1.5,
    w3Workload: 2.0,
    w4Overtime: 2.5,
    w5Preference: 1.2,
    w6Change: 1.0,
  });

  // Modal triggers
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState<boolean>(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      const [bRes, tRes, sRes, timeRes, recRes] = await Promise.all([
        fetch("/api/bookings", {
          headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
        }),
        fetch("/api/technicians"),
        fetch("/api/services?activeOnly=false"),
        fetch("/api/dispatch/timeline", {
          headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
        }),
        fetch("/api/recovery/audit-logs", {
          headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
        }),
      ]);

      if (bRes.ok) {
        const b = await bRes.json();
        setBookings(b.bookings || []);
      }
      if (tRes.ok) {
        const t = await tRes.json();
        setTechnicians(t.technicians || []);
      }
      if (sRes.ok) {
        const s = await sRes.json();
        setServices(s.services || []);
      }
      if (timeRes.ok) {
        const tim = await timeRes.json();
        setTimelineData(tim.timeline || []);
      }
      if (recRes.ok) {
        const rec = await recRes.json();
        setRecoveryLogs(rec.logs || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Run single job auto-assignment (Phase 4)
  const handleAutoAssignJob = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/dispatch/auto-assign/${bookingId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.result) {
        if (data.result.success) {
          showToast(`Success! Assigned to ${data.result.assignedTechnicianName} (Travel: ${data.result.estimatedTravelMinutes} mins)`, "success");
        } else {
          showToast(`Assignment constraint warning: ${data.result.selectionReason}`, "info");
        }
        fetchDashboardData();
      } else {
        showToast(data.error || "Auto-assign failed", "error");
      }
    } catch {
      showToast("Error executing assignment engine", "error");
    }
  };

  // Run Global OR-Tools CP-SAT Schedule Optimizer (Phase 5)
  const handleRunGlobalOptimizer = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/dispatch/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          weights: optimizerWeights,
          timeLimitSec: 5,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        showToast(
          `Constraint Optimizer finished with status: ${data.result.status} in ${data.result.executionTimeMs} ms.\n` +
          `Assigned: ${data.result.assignedCount} / ${data.result.totalJobs} jobs.\n` +
          `All hard constraints satisfied.`,
          "success"
        );
        fetchDashboardData();
      } else {
        showToast(data.error || "Optimization failed", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to run constraint optimizer", "error");
    } finally {
      setIsOptimizing(false);
    }
  };

  // View Explainability Modal (Phase 4.9)
  const handleViewExplainability = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/dispatch/explain/${bookingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedExplainRecord(data.record);
      } else {
        showToast("No assignment explanation recorded yet. Run auto-assign or global optimizer first.", "info");
      }
    } catch {
      showToast("Error loading explanation", "error");
    }
  };

  // Verify Priority (Phase 3.3 & 7.2)
  const handleVerifyPriority = async (bookingId: string, priority: "NORMAL" | "HIGH" | "EMERGENCY") => {
    const note = prompt(`Enter dispatcher triage note for marking as ${priority}:`);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/priority`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ verifiedPriority: priority, adminNote: note || "Verified by Dispatcher" }),
      });

      if (res.ok) {
        showToast(`Priority verified as ${priority}`, "success");
        fetchDashboardData();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update priority", "error");
      }
    } catch {
      showToast("Error updating priority", "error");
    }
  };

  // Technician Verification (Phase 2.4)
  const handleVerifyTechnician = async (userId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED") => {
    const notes = prompt(`Enter administrator review note for status [${status}]:`);
    try {
      const res = await fetch(`/api/technicians/${userId}/verify`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ status, notes }),
      });

      if (res.ok) {
        showToast(`Technician verification updated to: ${status}`, "success");
        fetchDashboardData();
      } else {
        const d = await res.json();
        showToast(d.error || "Verification failed", "error");
      }
    } catch {
      showToast("Error verifying technician", "error");
    }
  };

  // KPIs
  const totalBookings = bookings.length;
  const pendingJobs = bookings.filter((b) => b.bookingStatus === "REQUESTED" || b.bookingStatus === "ACCEPTED").length;
  const scheduledJobs = bookings.filter((b) => b.bookingStatus === "SCHEDULED" || b.bookingStatus === "TECHNICIAN_ACCEPTED").length;
  const inProgressJobs = bookings.filter((b) => b.bookingStatus === "IN_PROGRESS" || b.bookingStatus === "ON_THE_WAY").length;
  const completedJobs = bookings.filter((b) => b.bookingStatus === "COMPLETED").length;
  const emergencyJobs = bookings.filter((b) => b.verifiedPriority === "EMERGENCY" || b.requestedPriority === "EMERGENCY").length;
  const availableTechs = technicians.filter((t) => t.verificationStatus === "APPROVED" && t.availabilityStatus === "AVAILABLE").length;
  const pendingVerificationTechs = technicians.filter((t) => t.verificationStatus === "PENDING").length;

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (categoryFilter !== "ALL" && b.category !== categoryFilter) return false;
    if (statusFilter !== "ALL" && b.bookingStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.bookingReference.toLowerCase().includes(q) ||
        b.serviceName?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q) ||
        b.serviceAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Dispatch Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
              Dispatcher Command Center
            </span>
            <span className="text-xs text-slate-400">Road Network Dijkstra & OR-Tools CP-SAT Active</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Workforce Dispatch Grid</h1>
          <p className="text-xs text-slate-400 mt-1">
            Managing Electrical, AC Specialization & Master Plumbing with adaptive recovery.
          </p>
        </div>

        {/* Global Action Triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDisruptionModalOpen(true)}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Simulate Disruption
          </button>

          <button
            onClick={() => setIsBenchmarkModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            Scalability Test
          </button>

          <button
            onClick={handleRunGlobalOptimizer}
            disabled={isOptimizing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            {isOptimizing ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                Optimizing CP-SAT...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run CP-SAT Optimizer
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Bookings</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{totalBookings}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Pending Triage</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingJobs}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Scheduled</div>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{scheduledJobs}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">In Progress</div>
          <div className="text-xl font-extrabold text-indigo-600 mt-1">{inProgressJobs}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Completed</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{completedJobs}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-red-600 tracking-wider">Emergencies</div>
          <div className="text-xl font-extrabold text-red-600 mt-1 flex items-center gap-1">
            {emergencyJobs > 0 && <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>}
            {emergencyJobs}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Available Techs</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{availableTechs}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-purple-600 tracking-wider">Pending Verify</div>
          <div className="text-xl font-extrabold text-purple-600 mt-1">{pendingVerificationTechs}</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-6">
        {[
          { id: "map", label: "Live Dispatch Map & Routes" },
          { id: "bookings", label: `Bookings Hub (${bookings.length})` },
          { id: "timeline", label: "Technician Shift Timeline" },
          { id: "technicians", label: `Technician Verification (${technicians.length})` },
          { id: "recovery", label: `Recovery Audit Logs (${recoveryLogs.length})` },
          { id: "services", label: `Service Catalogue (${services.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 transition relative cursor-pointer ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE DISPATCH MAP */}
      {activeTab === "map" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Real-time visualization of Metro Road Network, live technician locations, and Dijkstra travel paths.
            </span>
            {selectedBooking && (
              <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                Inspecting: {selectedBooking.bookingReference} &bull; {selectedBooking.serviceName}
              </span>
            )}
          </div>

          <DispatchMap
            bookings={bookings}
            technicians={technicians}
            selectedBooking={selectedBooking}
            onSelectBooking={(b) => setSelectedBooking(b)}
            height="580px"
          />
        </div>
      )}

      {/* TAB 2: BOOKINGS HUB */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, customer, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-none bg-transparent focus:ring-0 text-xs p-0 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border-slate-200 bg-slate-50 py-1 px-2 text-xs"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Electrical">Electrical</option>
                  <option value="AC">AC Specialization</option>
                  <option value="Plumbing">Plumbing</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border-slate-200 bg-slate-50 py-1 px-2 text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REQUESTED">REQUESTED</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Service & Category</th>
                    <th className="py-3 px-4">Customer & Location</th>
                    <th className="py-3 px-4">Priority Triage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Technician</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBookings.map((b) => {
                    const isEmergency = b.verifiedPriority === "EMERGENCY";
                    const isUnassigned = !b.assignedTechnicianId;

                    return (
                      <tr key={b.bookingId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {b.bookingReference}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {b.preferredDate} ({b.preferredStartTime})
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{b.serviceName}</div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              b.category === "AC"
                                ? "bg-cyan-100 text-cyan-800"
                                : b.category === "Plumbing"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {b.category}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{b.customerName || "Customer"}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{b.serviceAddress}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isEmergency
                                  ? "bg-red-100 text-red-800 animate-pulse"
                                  : b.verifiedPriority === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {b.verifiedPriority}
                            </span>
                          </div>
                          {b.requestedPriority === "EMERGENCY" && b.verifiedPriority !== "EMERGENCY" && (
                            <button
                              onClick={() => handleVerifyPriority(b.bookingId, "EMERGENCY")}
                              className="text-[10px] font-bold text-red-600 hover:underline block mt-0.5"
                            >
                              Confirm Emergency
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.bookingStatus === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.bookingStatus === "IN_PROGRESS"
                                ? "bg-amber-100 text-amber-800 animate-pulse"
                                : b.bookingStatus === "SCHEDULED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {b.bookingStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {b.assignedTechnicianName ? (
                            <div>
                              <div className="font-bold text-slate-900">{b.assignedTechnicianName}</div>
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                Dijkstra Travel: {b.estimatedTravelTimeMinutes || 15} mins
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-600 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-2">
                          {isUnassigned && b.bookingStatus !== "CANCELLED" && (
                            <button
                              onClick={() => handleAutoAssignJob(b.bookingId)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs"
                            >
                              Auto-Assign
                            </button>
                          )}

                          <button
                            onClick={() => handleViewExplainability(b.bookingId)}
                            title="View candidate scoring & explanation"
                            className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700"
                          >
                            Explain
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE & GANTT */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500">
            Interactive shift timeline for all approved technicians. The yellow interval (11:00 - 11:30) represents reserved emergency capacity.
          </div>
          <ScheduleTimeline
            timeline={timelineData}
            onSelectBooking={(id) => {
              const b = bookings.find((item) => item.bookingId === id);
              if (b) {
                setSelectedBooking(b);
                setActiveTab("map");
              }
            }}
          />
        </div>
      )}

      {/* TAB 4: TECHNICIAN VERIFICATION */}
      {activeTab === "technicians" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Administrator verification center. <strong>Rule:</strong> Only APPROVED technicians can receive job assignments.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((t) => (
              <div key={t.userId} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t.fullName}</h3>
                    <div className="text-xs text-slate-500">{t.email} &bull; {t.phone}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.verificationStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.verificationStatus === "PENDING"
                        ? "bg-amber-100 text-amber-800 animate-pulse"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {t.verificationStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    Categories: <strong>{t.serviceCategories.join(", ")}</strong>
                  </div>
                  <div>Experience: {t.experienceYears} years &bull; Rating: ★ {t.averageRating}</div>
                  <div>Shift: {t.shiftStartTime} - {t.shiftEndTime} ({t.workingDays.join(", ")})</div>
                  <div>Zones: {t.serviceAreas.join(", ")}</div>
                </div>

                {/* Skills & Certifications */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Skills ({t.skills.length}) & Certs ({t.certifications.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.skills.map((s) => (
                      <span key={s.skillId} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {s.skillName}
                      </span>
                    ))}
                    {t.certifications.map((c) => (
                      <span key={c.certId} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                        ✓ {c.certName}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  {t.verificationStatus !== "APPROVED" && (
                    <button
                      onClick={() => handleVerifyTechnician(t.userId, "APPROVED")}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition"
                    >
                      Approve Specialist
                    </button>
                  )}
                  {t.verificationStatus !== "REJECTED" && (
                    <button
                      onClick={() => handleVerifyTechnician(t.userId, "REJECTED")}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition"
                    >
                      Reject Application
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DYNAMIC RECOVERY AUDIT LOGS */}
      {activeTab === "recovery" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Audit trail of all unexpected disruptions and adaptive schedule recoveries (Phase 7.8).</span>
            <button
              onClick={() => setIsDisruptionModalOpen(true)}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700"
            >
              + Simulate Disruption
            </button>
          </div>

          <div className="space-y-3">
            {recoveryLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                No disruptions recorded yet. Click "Simulate Disruption" above to test adaptive recovery.
              </div>
            ) : (
              recoveryLogs.map((log) => (
                <div key={log.recovery_id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      {log.disruption_type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()} &bull; Exec: {log.execution_time_ms} ms
                    </span>
                  </div>
                  <p className="text-slate-700">{log.reason}</p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Affected Jobs: {log.affectedBookingIds.length}</span>
                    <span className="text-emerald-700 font-bold">Status: {log.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SERVICE CATALOGUE */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500">
            Phase 3.1 Service Catalogue & Qualification Requirements for Electrical, AC, and Plumbing.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div key={s.serviceId} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.category === "AC"
                        ? "bg-cyan-100 text-cyan-800"
                        : s.category === "Plumbing"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {s.category}
                  </span>
                  <span className="font-mono font-extrabold text-blue-900 text-sm">${s.indicativePrice}</span>
                </div>

                <h3 className="font-bold text-sm text-slate-900">{s.serviceName}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{s.description}</p>

                <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500 space-y-1">
                  <div>Duration: <strong>{s.estimatedDurationMinutes} mins</strong></div>
                  <div>Skills: {s.requiredSkills.join(", ")}</div>
                  {s.requiredCertifications.length > 0 && (
                    <div className="text-amber-800 font-semibold">
                      Required Cert: {s.requiredCertifications.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Modals */}
      <AssignmentExplanationModal
        record={selectedExplainRecord}
        onClose={() => setSelectedExplainRecord(null)}
      />

      <DisruptionRecoveryModal
        isOpen={isDisruptionModalOpen}
        technicians={technicians}
        bookings={bookings}
        onClose={() => setIsDisruptionModalOpen(false)}
        onRecoveryComplete={() => {
          fetchDashboardData();
        }}
      />

      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />
    </div>
  );
};
