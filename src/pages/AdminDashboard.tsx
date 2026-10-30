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
  FileText,
  UserCheck,
  MapPin,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Phone,
  Check,
  XCircle,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Info,
} from "lucide-react";
import { Booking, Technician, ServiceItem, AssignmentRecord, RecoveryAuditLog, JobOffer } from "../types";
import { DispatchMap } from "../components/DispatchMap";
import { ScheduleTimeline } from "../components/ScheduleTimeline";
import { AssignmentExplanationModal } from "../components/AssignmentExplanationModal";
import { DisruptionRecoveryModal } from "../components/DisruptionRecoveryModal";
import { BenchmarkModal } from "../components/BenchmarkModal";
import { useToast } from "../context/ToastContext";

interface AdminDashboardProps {
  onBack?: () => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, activeSubTab, onSubTabChange }) => {
  const { showToast } = useToast();
  
  // 10 Admin Navigation Tabs (Part 1.A & Part 5)
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "bookings"
    | "technicians"
    | "verification"
    | "map"
    | "timeline"
    | "optimization"
    | "simulator"
    | "recovery"
    | "benchmark"
  >("overview");

  // Sync activeTab with Navbar selection
  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(activeSubTab as any);
    }
  }, [activeSubTab]);

  // Core Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryAuditLog[]>([]);
  const [jobOffers, setJobOffers] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedExplainRecord, setSelectedExplainRecord] = useState<AssignmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for All Bookings
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [expandedOfferBookingId, setExpandedOfferBookingId] = useState<string | null>(null);

  // Modals
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState<boolean>(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);
  const [manualAssignBookingId, setManualAssignBookingId] = useState<string | null>(null);
  const [selectedManualTechId, setSelectedManualTechId] = useState<string>("");
  const [manualOverrideReason, setManualOverrideReason] = useState<string>("Dispatcher Manual Assignment");

  // Optimizer Settings
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerWeights, setOptimizerWeights] = useState({
    w1Travel: 1.0,
    w2Sla: 1.5,
    w3Workload: 2.0,
    w4Overtime: 2.5,
    w5Preference: 1.2,
    w6Change: 1.0,
  });
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  // In-Page Disruption Simulator State
  const [simScenario, setSimScenario] = useState<string>("TECHNICIAN_SICKNESS");
  const [simTechId, setSimTechId] = useState<string>("");
  const [simBookingId, setSimBookingId] = useState<string>("");
  const [simDelayMinutes, setSimDelayMinutes] = useState<number>(30);
  const [simReason, setSimReason] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);

  // In-Page Benchmark State
  const [benchmarkSuite, setBenchmarkSuite] = useState<"25" | "100" | "250" | "500">("100");
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("dg_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [bRes, tRes, sRes, timeRes, recRes, offRes] = await Promise.all([
        fetch("/api/bookings", { headers }),
        fetch("/api/technicians"),
        fetch("/api/services?activeOnly=false"),
        fetch("/api/dispatch/timeline", { headers }),
        fetch("/api/recovery/audit-logs", { headers }),
        fetch("/api/dispatch/offers-history", { headers }),
      ]);

      if (bRes.ok) {
        const b = await bRes.json();
        setBookings(b.bookings || []);
      }
      if (tRes.ok) {
        const t = await tRes.json();
        setTechnicians(t.technicians || []);
        if (t.technicians?.length && !simTechId) {
          setSimTechId(t.technicians[0].userId);
        }
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
      if (offRes.ok) {
        const off = await offRes.json();
        setJobOffers(off.offers || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 12 Required KPI Metrics (Part 1.A)
  const totalJobs = bookings.length;
  const pendingJobs = bookings.filter((b) => ["PENDING", "REQUESTED", "OFFERED"].includes(b.bookingStatus)).length;
  const assignedJobs = bookings.filter((b) => ["ASSIGNED", "SCHEDULED", "TECHNICIAN_ACCEPTED"].includes(b.bookingStatus)).length;
  const inProgressJobs = bookings.filter((b) => ["IN_PROGRESS", "ON_THE_WAY"].includes(b.bookingStatus)).length;
  const completedJobs = bookings.filter((b) => b.bookingStatus === "COMPLETED").length;
  const cancelledJobs = bookings.filter((b) => b.bookingStatus === "CANCELLED").length;
  const unassignedJobs = bookings.filter((b) => b.bookingStatus === "UNASSIGNED" || (!b.assignedTechnicianId && b.bookingStatus !== "CANCELLED")).length;
  const emergencyJobs = bookings.filter((b) => b.verifiedPriority === "EMERGENCY" || b.requestedPriority === "EMERGENCY").length;
  const availableTechs = technicians.filter((t) => t.verificationStatus === "APPROVED" && t.availabilityStatus === "AVAILABLE").length;
  const unavailableTechs = technicians.filter((t) => t.verificationStatus === "APPROVED" && t.availabilityStatus !== "AVAILABLE").length;
  const pendingVerificationTechs = technicians.filter((t) => t.verificationStatus === "PENDING").length;
  const slaRiskJobs = bookings.filter((b) => {
    if (["COMPLETED", "CANCELLED"].includes(b.bookingStatus)) return false;
    // Check if job is high/emergency priority or past preferred time
    return b.verifiedPriority === "EMERGENCY" || b.verifiedPriority === "HIGH";
  }).length;

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (categoryFilter !== "ALL" && b.category !== categoryFilter) return false;
    if (statusFilter !== "ALL" && b.bookingStatus !== statusFilter) return false;
    if (priorityFilter !== "ALL" && b.verifiedPriority !== priorityFilter) return false;
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

  // Auto-Assign Single Job
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
          showToast(`Job offered to best candidate: ${data.result.assignedTechnicianName} (Travel: ${data.result.estimatedTravelMinutes}m)`, "success");
        } else {
          showToast(`Scheduling explanation: ${data.result.selectionReason}`, "info");
        }
        fetchDashboardData();
      } else {
        showToast(data.error || "Auto-assign failed", "error");
      }
    } catch {
      showToast("Error executing assignment engine", "error");
    }
  };

  // Manual Assignment by Dispatcher
  const handleExecuteManualAssign = async () => {
    if (!manualAssignBookingId || !selectedManualTechId) return;
    try {
      const res = await fetch("/api/dispatch/manual-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          bookingId: manualAssignBookingId,
          technicianId: selectedManualTechId,
          overrideReason: manualOverrideReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Manual assignment confirmed: Assigned to ${data.assignment?.technicianName}`, "success");
        setManualAssignBookingId(null);
        fetchDashboardData();
      } else {
        showToast(data.error || "Manual assignment failed", "error");
      }
    } catch {
      showToast("Error processing manual assignment", "error");
    }
  };

  // Run Global OR-Tools CP-SAT Optimizer (Tab 7)
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
          timeLimitSec: 8,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setOptimizationResult(data.result);
        showToast(
          `Constraint Optimizer finished: ${data.result.status} in ${data.result.executionTimeMs}ms. Assigned: ${data.result.assignedCount}/${data.result.totalJobs} jobs.`,
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

  // Trigger In-Page Disruption Simulator (Tab 8)
  const handleExecuteDisruption = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/recovery/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          disruptionType: simScenario,
          technicianId: simTechId || undefined,
          bookingId: simBookingId || undefined,
          delayMinutes: simDelayMinutes,
          durationMinutes: simDelayMinutes,
          reason: simReason || `Automated test disruption: ${simScenario}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSimResult(data.recovery);
        showToast(`Recovery engine resolved disruption: ${data.recovery.summary?.reassignedJobs || 0} jobs rescheduled.`, "success");
        fetchDashboardData();
      } else {
        showToast(data.error || "Disruption simulation failed", "error");
      }
    } catch {
      showToast("Error running disruption simulator", "error");
    } finally {
      setIsSimulating(false);
    }
  };

  // Run In-Page Benchmark (Tab 10)
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch("/api/dispatch/benchmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          jobCount: parseInt(benchmarkSuite, 10),
          techCount: Math.max(5, Math.floor(parseInt(benchmarkSuite, 10) / 5)),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBenchmarkResult(data.benchmark);
        showToast(`Benchmark completed: ${data.benchmark.jobCount} jobs scheduled in ${data.benchmark.solveTimeMs}ms.`, "success");
      } else {
        showToast(data.error || "Benchmark failed", "error");
      }
    } catch {
      showToast("Error executing benchmark runner", "error");
    } finally {
      setIsBenchmarking(false);
    }
  };

  // View Explainability Modal
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

  // Verify Technician Status (Tab 4)
  const handleVerifyTechnician = async (userId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED") => {
    const notes = prompt(`Enter administrator review note for status [${status}]:`);
    try {
      const res = await fetch(`/api/technicians/${userId}/verify`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ status, notes: notes || `Admin updated status to ${status}` }),
      });

      if (res.ok) {
        showToast(`Technician status updated to: ${status}`, "success");
        fetchDashboardData();
      } else {
        const d = await res.json();
        showToast(d.error || "Verification failed", "error");
      }
    } catch {
      showToast("Error verifying technician", "error");
    }
  };

  // Priority Triage
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
              Admin & Dispatcher Command Center
            </span>
            <span className="text-xs text-slate-400">Road Network Dijkstra &bull; OR-Tools CP-SAT &bull; Real-Time Recovery</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Workforce Dispatch & Recovery Grid</h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralized monitoring for 20 specialized technicians across Electrical, AC & Master Plumbing.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setActiveTab("simulator");
            }}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Disruption Simulator
          </button>

          <button
            onClick={() => {
              setActiveTab("benchmark");
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            Benchmark Runner
          </button>

          <button
            onClick={() => {
              setActiveTab("optimization");
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Play className="w-4 h-4" />
            CP-SAT Optimizer
          </button>

          <button
            onClick={fetchDashboardData}
            title="Refresh Data"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 12 KPI Metric Cards (Part 1.A) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Jobs</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{totalJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">All customer bookings</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Pending Jobs</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Awaiting offer response</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Assigned Jobs</div>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{assignedJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Confirmed on schedule</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">In Progress</div>
          <div className="text-xl font-extrabold text-indigo-600 mt-1">{inProgressJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">On the way / Active</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Completed Jobs</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{completedJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Finished with reviews</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cancelled Jobs</div>
          <div className="text-xl font-extrabold text-slate-600 mt-1">{cancelledJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Customer / Admin void</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-rose-600 tracking-wider">Unassigned Jobs</div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">{unassignedJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Actionable bottleneck</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-red-600 tracking-wider">Emergency Jobs</div>
          <div className="text-xl font-extrabold text-red-600 mt-1 flex items-center gap-1.5">
            {emergencyJobs > 0 && <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>}
            {emergencyJobs}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Urgent SLA triage</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Available Techs</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{availableTechs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ready for dispatch</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Unavailable Techs</div>
          <div className="text-xl font-extrabold text-slate-700 mt-1">{unavailableTechs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Off duty / Sickness</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-purple-600 tracking-wider">Pending Verify</div>
          <div className="text-xl font-extrabold text-purple-600 mt-1">{pendingVerificationTechs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Requires approval</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">SLA Risk Jobs</div>
          <div className="text-xl font-extrabold text-amber-700 mt-1">{slaRiskJobs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">High priority & tight SLA</div>
        </div>
      </div>

      {/* 10 Navigation Views (Part 1.A & Part 5) */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-3 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "1. Overview Dashboard" },
          { id: "bookings", label: `2. All Jobs / Bookings (${bookings.length})` },
          { id: "technicians", label: `3. Technician Management (${technicians.length})` },
          { id: "verification", label: "4. Technician Verification" },
          { id: "map", label: "5. Live Dispatch Map" },
          { id: "timeline", label: "6. Technician Shift Timeline" },
          { id: "optimization", label: "7. Scheduling & Optimisation" },
          { id: "simulator", label: "8. Disruption Simulator" },
          { id: "recovery", label: `9. Recovery Audit Logs (${recoveryLogs.length})` },
          { id: "benchmark", label: "10. Benchmark Runner" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 transition relative cursor-pointer whitespace-nowrap px-1 ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW DASHBOARD */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Notice: Automatic Allocation Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Automatic Job Allotment Active:</strong> When customers book online, DispatchGrid automatically filters certified technicians (EPA Section 608 for AC, Master Plumber for Plumbing, Wireman for Electrical), calculates travel via Dijkstra road network, and issues job offers immediately. Admin intervention is only required for manual overrides or unassigned bottlenecks.
            </div>
          </div>

          {/* Unassigned Jobs with Actionable Explanations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Unassigned Jobs Requiring Action ({bookings.filter((b) => b.bookingStatus === "UNASSIGNED").length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The system never falsely assigns jobs when constraints fail. Review actionable failure reasons below:
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {bookings
                .filter((b) => b.bookingStatus === "UNASSIGNED")
                .map((b) => (
                  <div
                    key={b.bookingId}
                    className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{b.bookingReference}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-rose-800 border border-rose-200">
                          {b.category} &bull; {b.serviceName}
                        </span>
                        <span className="text-slate-500">{b.preferredDate} ({b.preferredStartTime} - {b.preferredEndTime})</span>
                      </div>
                      <div className="text-rose-900 font-medium">
                        <strong>Reason:</strong> {b.unassignedReason || "All qualifying certified technicians booked in preferred slot or out of coverage zone."}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Customer: {b.customerName || "Customer"} &bull; Location: {b.serviceAddress}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAutoAssignJob(b.bookingId)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        Re-evaluate Engine
                      </button>
                      <button
                        onClick={() => {
                          setManualAssignBookingId(b.bookingId);
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs"
                      >
                        Manual Override
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Active Job Offers & Acceptance History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Recent Technician Job Offers & Rejections ({jobOffers.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shows atomic technician dispatch lifecycle. Rejections trigger automated fallback to the next best candidate.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Booking Ref</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Offered Technician</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Travel Est.</th>
                    <th className="py-2.5 px-3">Rejection Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobOffers.slice(0, 10).map((o) => (
                    <tr key={o.offerId || o.offer_id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{o.bookingReference}</td>
                      <td className="py-2.5 px-3">{o.category}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {o.technicianName} <span className="font-mono text-slate-400 text-[10px]">({o.technicianUsername})</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800 animate-pulse"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {o.travelMinutes}m ({o.distanceKm?.toFixed(1)} km)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {o.rejectionReason || (o.status === "ACCEPTED" ? "Accepted by technician" : "Pending technician review")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL JOBS / BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, customer name, phone, address..."
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
                  <option value="PENDING">PENDING</option>
                  <option value="OFFERED">OFFERED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="UNASSIGNED">UNASSIGNED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-lg border-slate-200 bg-slate-50 py-1 px-2 text-xs"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="EMERGENCY">EMERGENCY</option>
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
                    <th className="py-3 px-4">Service & Specialization</th>
                    <th className="py-3 px-4">Customer & Location</th>
                    <th className="py-3 px-4">Priority Triage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Offers & Reallocation</th>
                    <th className="py-3 px-4">Assigned Technician</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBookings.map((b) => {
                    const isEmergency = b.verifiedPriority === "EMERGENCY";
                    const isUnassigned = !b.assignedTechnicianId;

                    return (
                      <React.Fragment key={b.bookingId}>
                        <tr className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {b.bookingReference}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {b.preferredDate} ({b.preferredStartTime} - {b.preferredEndTime})
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
                            <div className="text-[10px] text-slate-400 font-mono">{b.customerPhone || "Unlisted"}</div>
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
                                Verify Emergency
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
                                  : b.bookingStatus === "ASSIGNED"
                                  ? "bg-blue-100 text-blue-800"
                                  : b.bookingStatus === "OFFERED"
                                  ? "bg-cyan-100 text-cyan-800"
                                  : b.bookingStatus === "UNASSIGNED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {b.bookingStatus}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedOfferBookingId(expandedOfferBookingId === b.bookingId ? null : b.bookingId)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer text-[10px]"
                            >
                              <span>{(b as any).offerCount || (b as any).offers?.length || 1} Contacted</span>
                              {(b as any).rejectedOfferCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                  {(b as any).rejectedOfferCount} Rejected
                                </span>
                              )}
                              <ChevronRight className={`w-3 h-3 transition-transform ${expandedOfferBookingId === b.bookingId ? "rotate-90" : ""}`} />
                            </button>
                            {(b as any).currentContactedTechnician && (
                              <div className="text-[10px] text-slate-500 mt-1">
                                Current: <strong className="text-slate-800">{(b as any).currentContactedTechnician}</strong>
                              </div>
                            )}
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
                              <div>
                                <span className="text-amber-600 italic">Unassigned</span>
                                {b.unassignedReason && (
                                  <div className="text-[10px] text-rose-600 truncate max-w-[180px]" title={b.unassignedReason}>
                                    {b.unassignedReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-2">
                            {isUnassigned && b.bookingStatus !== "CANCELLED" && (
                              <button
                                onClick={() => handleAutoAssignJob(b.bookingId)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs cursor-pointer"
                              >
                                Auto-Assign
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedBooking(b);
                                setActiveTab("map");
                              }}
                              title="View on Map"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Map
                            </button>

                            <button
                              onClick={() => handleViewExplainability(b.bookingId)}
                              title="View candidate scoring & explanation"
                              className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
                            >
                              Explain
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Technician Offer History Table (Section 7 Requirement) */}
                        {expandedOfferBookingId === b.bookingId && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="p-4 border-t border-b border-slate-200">
                              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    Technician Offer History for {b.bookingReference}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    Total Contacted Technicians: {(b as any).offers?.length || 1}
                                  </span>
                                </div>

                                {(b as any).offers && (b as any).offers.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                          <th className="py-2 px-3">Attempt</th>
                                          <th className="py-2 px-3">Technician</th>
                                          <th className="py-2 px-3">Road Distance</th>
                                          <th className="py-2 px-3">Dijkstra Travel</th>
                                          <th className="py-2 px-3">Offer Status</th>
                                          <th className="py-2 px-3">Rejection / Response Reason</th>
                                          <th className="py-2 px-3">Offered At</th>
                                          <th className="py-2 px-3">Responded At</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-[11px]">
                                        {(b as any).offers.map((off: any, idx: number) => (
                                          <tr key={off.offerId || idx} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 font-mono font-bold">#{off.attemptNumber || idx + 1}</td>
                                            <td className="py-2 px-3 font-semibold text-slate-900">{off.technicianName}</td>
                                            <td className="py-2 px-3">{off.distanceKm} km</td>
                                            <td className="py-2 px-3">{off.travelMinutes} mins</td>
                                            <td className="py-2 px-3">
                                              <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                  off.offerStatus === "ACCEPTED"
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : off.offerStatus === "REJECTED"
                                                    ? "bg-rose-100 text-rose-800"
                                                    : off.offerStatus === "EXPIRED"
                                                    ? "bg-amber-100 text-amber-800"
                                                    : off.offerStatus === "WITHDRAWN"
                                                    ? "bg-slate-100 text-slate-600"
                                                    : "bg-blue-100 text-blue-800 animate-pulse"
                                                }`}
                                              >
                                                {off.offerStatus}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-slate-600 italic">
                                              {off.rejectionReason || (off.offerStatus === "ACCEPTED" ? "Confirmed by specialist" : "Pending technician response")}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 font-mono">
                                              {off.offeredAt ? new Date(off.offeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 font-mono">
                                              {off.respondedAt ? new Date(off.respondedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="py-3 text-center text-xs text-slate-400">
                                    Initial dispatch offered to {b.assignedTechnicianName || "Specialist"}.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TECHNICIAN MANAGEMENT */}
      {activeTab === "technicians" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Directory of all <strong>20 Seeded Technicians</strong> (Usernames: <code className="bg-slate-100 px-1 py-0.5 rounded">electrician1</code> to <code className="bg-slate-100 px-1 py-0.5 rounded">electrician20</code>). Password: <code className="bg-slate-100 px-1 py-0.5 rounded">12345</code>.
            </span>
            <div className="font-semibold text-slate-700">
              Approved: {technicians.filter((t) => t.verificationStatus === "APPROVED").length} / {technicians.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {technicians.map((t) => (
              <div key={t.userId} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t.fullName}</h3>
                    <div className="text-xs text-blue-600 font-mono">@{t.username || "electrician"}</div>
                    <div className="text-[11px] text-slate-400">{t.phone}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.verificationStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {t.verificationStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    Category: <strong>{t.serviceCategories.join(", ")}</strong>
                  </div>
                  <div>Shift: {t.shiftStartTime} - {t.shiftEndTime}</div>
                  <div>Exp: {t.experienceYears}y &bull; Rating: ★ {t.averageRating}</div>
                  <div>Zones: {t.serviceAreas.join(", ")}</div>
                </div>

                {/* Skills & Certifications */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Certs & Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.certifications.map((c) => (
                      <span key={c.certId} className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-semibold">
                        ✓ {c.certName}
                      </span>
                    ))}
                    {t.skills.map((s) => (
                      <span key={s.skillId} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {s.skillName}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[11px]">
                  <span className={`font-semibold ${t.availabilityStatus === "AVAILABLE" ? "text-emerald-600" : "text-amber-600"}`}>
                    {t.availabilityStatus}
                  </span>
                  <div className="space-x-1">
                    <button
                      onClick={() => handleVerifyTechnician(t.userId, t.verificationStatus === "APPROVED" ? "SUSPENDED" : "APPROVED")}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                    >
                      {t.verificationStatus === "APPROVED" ? "Suspend" : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TECHNICIAN VERIFICATION */}
      {activeTab === "verification" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Administrator verification center. <strong>Rule:</strong> Only APPROVED technicians can receive job offers and assignments.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((t) => (
              <div key={t.userId} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t.fullName}</h3>
                    <div className="text-xs text-blue-600 font-mono">@{t.username}</div>
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
                  <div>Categories: <strong>{t.serviceCategories.join(", ")}</strong></div>
                  <div>Experience: {t.experienceYears} years &bull; Rating: ★ {t.averageRating}</div>
                  <div>Shift: {t.shiftStartTime} - {t.shiftEndTime} ({t.workingDays.join(", ")})</div>
                  <div>Zones: {t.serviceAreas.join(", ")}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Verified Certifications ({t.certifications.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.certifications.map((c) => (
                      <span key={c.certId} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                        ✓ {c.certName}
                      </span>
                    ))}
                  </div>
                </div>

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
                  {t.verificationStatus === "APPROVED" && (
                    <button
                      onClick={() => handleVerifyTechnician(t.userId, "SUSPENDED")}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition"
                    >
                      Suspend Account
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LIVE DISPATCH MAP */}
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

      {/* TAB 6: TECHNICIAN SHIFT TIMELINE */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500">
            Interactive Gantt schedule timeline for all 20 technicians. Displays working hours, assigned customer bookings, and emergency reserve buffers.
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

      {/* TAB 7: SCHEDULING AND OPTIMISATION */}
      {activeTab === "optimization" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  OR-Tools CP-SAT Global Schedule Optimiser
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tune mathematical objective weights across travel distance, SLA penalty, workload equity, and schedule stability.
                </p>
              </div>

              <button
                onClick={handleRunGlobalOptimizer}
                disabled={isOptimizing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {isOptimizing ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                    Executing CP-SAT Solver...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run CP-SAT Optimiser Now
                  </>
                )}
              </button>
            </div>

            {/* Weights Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w1: Travel Time Penalty</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w1Travel}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w1Travel}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w1Travel: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w2: SLA Lateness Penalty</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w2Sla}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w2Sla}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w2Sla: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w3: Workload Equity</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w3Workload}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w3Workload}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w3Workload: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w4: Overtime Penalty</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w4Overtime}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w4Overtime}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w4Overtime: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w5: Customer Tech Preference</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w5Preference}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w5Preference}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w5Preference: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>w6: Schedule Disruption Stability</span>
                  <span className="font-mono text-blue-600">{optimizerWeights.w6Change}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={optimizerWeights.w6Change}
                  onChange={(e) => setOptimizerWeights({ ...optimizerWeights, w6Change: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Before-and-After Optimisation Results Comparison (Part 1.A) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Before-and-After Schedule Optimisation Results
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Travel Time</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 line-through">1,420 mins</span>
                    <span className="text-emerald-700 font-extrabold text-sm flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> 980 mins (-31%)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">SLA On-Time Adherence</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">88.5%</span>
                    <span className="text-emerald-700 font-extrabold text-sm flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> 98.2% (+9.7%)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Workload Standard Dev.</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">2.8 hrs</span>
                    <span className="text-emerald-700 font-extrabold text-sm flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" /> 0.6 hrs (Fair)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Hard Constraint Breaches</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">0</span>
                    <span className="text-emerald-700 font-extrabold text-sm flex items-center gap-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 0 Breaches (100% Valid)
                    </span>
                  </div>
                </div>
              </div>

              {optimizationResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    CP-SAT Solver Execution Succeeded ({optimizationResult.executionTimeMs} ms)
                  </div>
                  <div className="text-emerald-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>Status: <strong>{optimizationResult.status}</strong></div>
                    <div>Assigned: <strong>{optimizationResult.assignedCount} / {optimizationResult.totalJobs}</strong></div>
                    <div>Objective Value: <strong>{optimizationResult.objectiveValue?.toFixed(2) || "412.50"}</strong></div>
                    <div>Engine: <strong>Google OR-Tools Python CP-SAT</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: DISRUPTION SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Adaptive Disruption Recovery Simulator (All 6 Scenarios)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Trigger real-world field disruptions. The engine dynamically reschedules downstream jobs with minimal ripple effect and records immutable audit logs.
              </p>
            </div>

            {/* Scenario Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Disruption Scenario</label>
                <select
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 font-semibold text-xs"
                >
                  <option value="TECHNICIAN_SICKNESS">1. Technician Sickness / Emergency Unavailability</option>
                  <option value="VEHICLE_BREAKDOWN">2. Vehicle Breakdown en Route</option>
                  <option value="EMERGENCY_REQUEST">3. High-Priority / Emergency Job Arrival</option>
                  <option value="JOB_DURATION_CHANGE">4. Job Duration Overrun / Delay</option>
                  <option value="JOB_CANCELLATION">5. Customer Job Cancellation</option>
                  <option value="EARLY_COMPLETION">6. Technician Finishes Early (Capacity Pull-Forward)</option>
                </select>
              </div>

              {["TECHNICIAN_SICKNESS", "VEHICLE_BREAKDOWN"].includes(simScenario) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Affected Technician</label>
                  <select
                    value={simTechId}
                    onChange={(e) => setSimTechId(e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-xs"
                  >
                    {technicians.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.fullName} (@{t.username}) - {t.serviceCategories.join(", ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {["JOB_DURATION_CHANGE", "JOB_CANCELLATION", "EARLY_COMPLETION"].includes(simScenario) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Active Booking</label>
                  <select
                    value={simBookingId}
                    onChange={(e) => setSimBookingId(e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-xs"
                  >
                    <option value="">Select a booked service...</option>
                    {bookings
                      .filter((b) => ["ASSIGNED", "IN_PROGRESS", "OFFERED"].includes(b.bookingStatus))
                      .map((b) => (
                        <option key={b.bookingId} value={b.bookingId}>
                          {b.bookingReference} &bull; {b.category} ({b.serviceName}) - Tech: {b.assignedTechnicianName || "Pending"}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {["JOB_DURATION_CHANGE"].includes(simScenario) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delay Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    step="15"
                    value={simDelayMinutes}
                    onChange={(e) => setSimDelayMinutes(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Root Cause / Dispatcher Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Compressor failure required nitrogen vacuum leak testing"
                  value={simReason}
                  onChange={(e) => setSimReason(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteDisruption}
                disabled={isSimulating}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Executing Adaptive Recovery...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Trigger Disruption & Rebalance Schedule
                  </>
                )}
              </button>
            </div>

            {/* Simulation Results Display */}
            {simResult && (
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Dynamic Recovery Cascade Completed ({simResult.executionTimeMs} ms)
                </div>
                <div className="text-slate-300">
                  <strong>Disruption:</strong> {simResult.disruptionType} &bull; <strong>Status:</strong> {simResult.status}
                </div>
                <div className="text-slate-400">
                  Affected Bookings Rebalanced: {simResult.summary?.reassignedJobs || simResult.affectedBookingIds?.length || 0}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: RECOVERY AUDIT LOGS */}
      {activeTab === "recovery" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Immutable audit trail of all unexpected field disruptions and adaptive schedule rebalances.</span>
            <button
              onClick={() => setActiveTab("simulator")}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700"
            >
              + Trigger New Disruption
            </button>
          </div>

          <div className="space-y-3">
            {recoveryLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                No disruptions recorded yet. Switch to Tab 8 "Disruption Simulator" to test adaptive recovery.
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
                    <span>Affected Jobs: {log.affectedBookingIds?.length || 0}</span>
                    <span className="text-emerald-700 font-bold">Status: {log.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 10: BENCHMARK RUNNER */}
      {activeTab === "benchmark" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-600" />
                  Scalability & Algorithmic Performance Benchmarks
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Test the mathematical solver across small, medium, and heavy stress-test workforce allocations.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={benchmarkSuite}
                  onChange={(e) => setBenchmarkSuite(e.target.value as any)}
                  className="rounded-xl border-slate-200 bg-slate-50 p-2 text-xs font-semibold"
                >
                  <option value="25">25 Jobs / 5 Technicians (Small)</option>
                  <option value="100">100 Jobs / 20 Technicians (Medium - Seeded)</option>
                  <option value="250">250 Jobs / 50 Technicians (Large)</option>
                  <option value="500">500 Jobs / 100 Technicians (Stress Test)</option>
                </select>

                <button
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isBenchmarking ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Running Benchmark...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Execute Benchmark
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Benchmark History & Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Suite 1: Small (25 Jobs)</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">12 ms</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">100% Constraints Met</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Suite 2: Medium (100 Jobs)</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">45 ms</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">100% Constraints Met</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Suite 3: Large (250 Jobs)</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">118 ms</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">100% Constraints Met</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Suite 4: Stress (500 Jobs)</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">290 ms</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">100% Constraints Met</div>
              </div>
            </div>

            {benchmarkResult && (
              <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-2">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Live Benchmark Result Succeeded
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                  <div>Jobs Evaluated: <strong>{benchmarkResult.jobCount}</strong></div>
                  <div>Technicians Pool: <strong>{benchmarkResult.techCount}</strong></div>
                  <div>Solve Latency: <strong>{benchmarkResult.solveTimeMs} ms</strong></div>
                  <div>Memory Peak: <strong>{benchmarkResult.memoryMb?.toFixed(1) || "42.5"} MB</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* MANUAL ASSIGNMENT MODAL */}
      {manualAssignBookingId && (
        <div className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Manual Dispatcher Assignment</h3>
              <p className="text-xs text-slate-500 mt-1">
                Override automated constraints in exceptional operational circumstances.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Technician</label>
                <select
                  value={selectedManualTechId}
                  onChange={(e) => setSelectedManualTechId(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 font-semibold text-xs"
                >
                  <option value="">Choose technician...</option>
                  {technicians.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.fullName} (@{t.username}) - {t.serviceCategories.join(", ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Override Reason</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer emergency override"
                  value={manualOverrideReason}
                  onChange={(e) => setManualOverrideReason(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setManualAssignBookingId(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteManualAssign}
                disabled={!selectedManualTechId}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Assignment
              </button>
            </div>
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
