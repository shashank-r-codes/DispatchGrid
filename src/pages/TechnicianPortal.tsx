import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Thermometer,
  Star,
  Award,
  ShieldCheck,
  Calendar,
  XCircle,
  Phone,
  User,
  Wrench,
  Check,
  ChevronRight,
  Send,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { JobOffer, Booking, Technician } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DispatchMap } from "../components/DispatchMap";

interface TechnicianPortalProps {
  onBack?: () => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const TechnicianPortal: React.FC<TechnicianPortalProps> = ({ onBack, activeSubTab, onSubTabChange }) => {
  const { user, login, logout, refreshUserProfile } = useAuth();
  const { showToast } = useToast();

  const [loginEmail, setLoginEmail] = useState<string>("amit.patel@dispatchgrid.demo");
  const [loginPassword, setLoginPassword] = useState<string>("12345");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "offers" | "assigned" | "availability" | "history" | "profile"
  >("dashboard");

  // Sync activeTab with Navbar selection
  useEffect(() => {
    if (activeSubTab && ["dashboard", "offers", "assigned", "availability", "history", "profile"].includes(activeSubTab)) {
      setActiveTab(activeSubTab as any);
    }
  }, [activeSubTab]);

  const switchTab = (tab: "dashboard" | "offers" | "assigned" | "availability" | "history" | "profile") => {
    setActiveTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [assignedBookings, setAssignedBookings] = useState<Booking[]>([]);

  // 1-second live decision timer ticker (2 minutes)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const expiringOffersRef = useRef<Set<string>>(new Set());

  // Helper to accurately parse SQLite / ISO UTC timestamps across all browsers and timezones
  const parseOfferTime = (dateStr?: string | null): number => {
    if (!dateStr) return currentTime;
    let s = String(dateStr).trim();
    if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T") + "Z";
    else if (!s.endsWith("Z") && !s.includes("+") && !s.includes("-", 10)) s += "Z";
    const t = new Date(s).getTime();
    return isNaN(t) ? currentTime : t;
  };

  // Filter active valid offers where remaining decision window > 0.
  // The exact millisecond diffSec becomes 0, the offer vanishes from this portal immediately,
  // matching the instantaneous feedback of clicking "Decline / Reject".
  const validOffers = useMemo(() => {
    return offers.filter((o) => {
      const offeredTime = parseOfferTime(o.offeredAt);
      const remainingMs = offeredTime + 120 * 1000 - currentTime;
      return remainingMs > 0;
    });
  }, [offers, currentTime]);

  const handleOfferTimeout = async (offerId: string, bookingRef: string) => {
    if (expiringOffersRef.current.has(offerId)) return;
    expiringOffersRef.current.add(offerId);

    // Optimistically remove the expired offer immediately from local state
    // EXACT SAME instant feedback as clicking "Decline / Reject"
    setOffers((prev) => prev.filter((o) => o.offerId !== offerId));

    try {
      const token = localStorage.getItem("dg_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`/api/technicians/offers/${offerId}/expire`, {
        method: "POST",
        headers,
      });

      showToast(
        `Decision timer expired for ${bookingRef}. Job immediately reassigned to next nearest technician!`,
        "info"
      );

      // Instantly notify Customer Portal and peer windows in real time
      window.dispatchEvent(new Event("dg_booking_reassigned"));
      localStorage.setItem("dg_reassigned_at", Date.now().toString());

      await fetchTechnicianData();
    } catch (err) {
      console.error("Auto-expire failed:", err);
    }
  };

  // Live Decision Timer Monitor:
  // Runs every second across all tabs. The exact second the 2-minute (120s) window hits 0,
  // immediately expires the offer and triggers instant automatic reassignment to next nearest person.
  useEffect(() => {
    if (!offers || offers.length === 0) return;
    for (const offer of offers) {
      const offeredTime = parseOfferTime(offer.offeredAt);
      const expiresTime = offeredTime + 120 * 1000;
      const diffSec = Math.floor((expiresTime - currentTime) / 1000);
      if (diffSec <= 0 && !expiringOffersRef.current.has(offer.offerId)) {
        handleOfferTimeout(offer.offerId, offer.bookingReference || "Booking");
      }
    }
  }, [currentTime, offers]);
  const [technicianProfile, setTechnicianProfile] = useState<Technician | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reject offer modal state
  const [rejectOfferId, setRejectOfferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("Too far from current location");
  const [customRejectReason, setCustomRejectReason] = useState<string>("");

  // Delay reporting state
  const [delayBookingId, setDelayBookingId] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [delayReason, setDelayReason] = useState<string>("");

  // Job Completion modal state
  const [completeBookingId, setCompleteBookingId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>("");

  // Availability state
  const [availabilityStatus, setAvailabilityStatus] = useState<string>("AVAILABLE");
  const [shiftStart, setShiftStart] = useState<string>("08:00");
  const [shiftEnd, setShiftEnd] = useState<string>("18:00");

  const fetchTechnicianData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("dg_token");
      const [offersRes, bookingsRes, meRes] = await Promise.all([
        fetch("/api/technicians/my/offers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/bookings", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (offersRes.ok) {
        const d = await offersRes.json();
        setOffers(d.offers || []);
      }

      if (bookingsRes.ok) {
        const b = await bookingsRes.json();
        setAssignedBookings(b.bookings || []);
        if (b.bookings?.length && !selectedBooking) {
          setSelectedBooking(b.bookings[0]);
        }
      }

      if (meRes.ok) {
        const me = await meRes.json();
        setTechnicianProfile(me.user);
        setAvailabilityStatus(me.user.availability_status || me.user.availabilityStatus || "AVAILABLE");
        setShiftStart(me.user.shift_start_time || me.user.shiftStartTime || "08:00");
        setShiftEnd(me.user.shift_end_time || me.user.shiftEndTime || "18:00");
      }
    } catch (err) {
      console.error("Error fetching technician portal data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicianData();
    const poll = setInterval(() => {
      fetchTechnicianData();
    }, 3000);
    return () => clearInterval(poll);
  }, [user]);

  // Handle Offer Accept (Part 4)
  const handleAcceptOffer = async (offerId: string) => {
    try {
      const res = await fetch(`/api/technicians/offers/${offerId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Offer accepted! Assignment confirmed into your shift schedule.", "success");
        fetchTechnicianData();
        setActiveTab("assigned");
      } else {
        showToast(data.error || "Failed to accept offer", "error");
      }
    } catch {
      showToast("Error processing acceptance", "error");
    }
  };

  // Handle Offer Reject (Part 4 - Rejection with reason & auto re-allotment)
  const handleRejectOffer = async () => {
    if (!rejectOfferId) return;
    const finalReason = rejectionReason === "Other" ? customRejectReason : rejectionReason;
    if (!finalReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/technicians/offers/${rejectOfferId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ reason: finalReason }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Offer declined. System automatically offered job to next eligible candidate.", "info");
        setRejectOfferId(null);
        setCustomRejectReason("");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to reject offer", "error");
      }
    } catch {
      showToast("Error processing rejection", "error");
    }
  };

  // Handle Status Transitions
  const handleUpdateStatus = async (bookingId: string, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          status,
          completionNotes: notes,
          reason: `Technician transitioned status to ${status}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Job status updated to ${status}!`, "success");
        setCompleteBookingId(null);
        setCompletionNotes("");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to update status", "error");
      }
    } catch {
      showToast("Error updating status", "error");
    }
  };

  // Report Delay
  const handleReportDelay = async () => {
    if (!delayBookingId) return;
    try {
      const res = await fetch("/api/technicians/report-delay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          bookingId: delayBookingId,
          delayMinutes,
          reason: delayReason || `Technician reported ${delayMinutes}m delay due to complex repair`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Delay of ${delayMinutes} mins recorded. Route evaluated.`, "info");
        setDelayBookingId(null);
        setDelayReason("");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to report delay", "error");
      }
    } catch {
      showToast("Error reporting delay", "error");
    }
  };


  // Live Tracking Journey Handlers (Section 5 & 7 Requirements)
  const handleStartTravelling = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/tracking/${bookingId}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Journey started! Live simulated GPS broadcasting to customer.", "success");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to start travel", "error");
      }
    } catch {
      showToast("Error starting travel", "error");
    }
  };

  const handleFastForward = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/tracking/${bookingId}/fast-forward`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Fast-forwarded: Technician arrived at destination!", "info");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to fast-forward", "error");
      }
    } catch {
      showToast("Error fast-forwarding", "error");
    }
  };

  const handleCompleteJobWithTracking = async (bookingId: string, notes?: string) => {
    try {
      const res = await fetch(`/api/tracking/${bookingId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ notes: notes || completionNotes || "Service completed safely." }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Job completed! Tracking session finalized.", "success");
        setCompleteBookingId(null);
        setCompletionNotes("");
        fetchTechnicianData();
      } else {
        handleUpdateStatus(bookingId, "COMPLETED", notes);
      }
    } catch {
      handleUpdateStatus(bookingId, "COMPLETED", notes);
    }
  };

  // Report Sickness / Unavailability (triggers dynamic recovery)
  const handleReportUnavailability = async () => {
    const reason = prompt("Enter reason for unexpected unavailability (e.g., Medical sickness or vehicle breakdown):");
    if (!reason) return;

    try {
      const res = await fetch("/api/technicians/report-unavailability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          disruptionType: "TECHNICIAN_SICKNESS",
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Unavailability registered! Adaptive recovery: ${data.recovery.explanation}`, "success");
        fetchTechnicianData();
      } else {
        showToast(data.error || "Failed to report unavailability", "error");
      }
    } catch {
      showToast("Error reporting unavailability", "error");
    }
  };

  // Update Availability & Shift
  const handleSaveAvailability = async () => {
    try {
      const res = await fetch("/api/technicians/availability", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          availabilityStatus,
          shiftStartTime: shiftStart,
          shiftEndTime: shiftEnd,
        }),
      });

      if (res.ok) {
        showToast("Working hours & availability updated successfully", "success");
        fetchTechnicianData();
      } else {
        showToast("Failed to update availability", "error");
      }
    } catch {
      showToast("Error saving availability", "error");
    }
  };

  const activeJobs = assignedBookings.filter((b) => ["ASSIGNED", "ON_THE_WAY", "IN_PROGRESS", "SCHEDULED"].includes(b.bookingStatus));
  const completedJobs = assignedBookings.filter((b) => b.bookingStatus === "COMPLETED");

  const handleTechnicianLogin = async (overrideEmail?: string, overridePass?: string) => {
    setIsLoggingIn(true);
    setLoginError("");
    const em = overrideEmail || loginEmail;
    const p = overridePass || loginPassword;
    const result = await login(em, p, "TECHNICIAN");
    if (!result.success) {
      setLoginError(result.error || "Invalid technician credentials. Please check email and password.");
    }
    setIsLoggingIn(false);
  };

  const SEEDED_TECH_ACCOUNTS = [
    { email: "electrician1@dispatchgrid.demo", name: "Rajesh Kumar", category: "Electrical", cert: "Wireman Grade A" },
    { email: "amit.patel@dispatchgrid.demo", name: "Amit Patel (Demo Specialist)", category: "Electrical, AC & Plumbing", cert: "Master Wireman, EPA Universal & LMP" },
    { email: "electrician3@dispatchgrid.demo", name: "Suresh Reddy", category: "Plumbing Specialist", cert: "Master Plumber" },
    { email: "electrician4@dispatchgrid.demo", name: "Vikram Rao", category: "Electrical & AC", cert: "EPA Section 608" },
    { email: "electrician5@dispatchgrid.demo", name: "Priya Sharma", category: "Electrical", cert: "Wireman Grade A" },
    { email: "electrician6@dispatchgrid.demo", name: "Karan Malhotra", category: "AC Specialist", cert: "EPA Section 608" },
    { email: "electrician7@dispatchgrid.demo", name: "Manoj Swaminathan", category: "Plumbing Specialist", cert: "Master Plumber" },
    { email: "electrician8@dispatchgrid.demo", name: "Deepak Joshi", category: "Electrical", cert: "HV Safety Inspector" },
    { email: "electrician9@dispatchgrid.demo", name: "Sunil Grover", category: "AC Specialist", cert: "HVAC Specialist" },
    { email: "electrician10@dispatchgrid.demo", name: "Rohan Kulkarni", category: "Electrical & Plumbing", cert: "Wireman & Plumber" },
    { email: "electrician11@dispatchgrid.demo", name: "Girish Nair", category: "Plumbing Specialist", cert: "Master Plumber" },
    { email: "electrician12@dispatchgrid.demo", name: "Farhan Siddiqui", category: "AC Specialist", cert: "EPA Section 608" },
    { email: "electrician13@dispatchgrid.demo", name: "Naveen Prasad", category: "Electrical", cert: "Wireman Grade A" },
    { email: "electrician14@dispatchgrid.demo", name: "Anil Deshmukh", category: "AC Specialist", cert: "HVAC Specialist" },
    { email: "electrician15@dispatchgrid.demo", name: "Vikas Hegde", category: "Plumbing Specialist", cert: "Master Plumber" },
    { email: "electrician16@dispatchgrid.demo", name: "Prakash Chawla", category: "Electrical & AC", cert: "Wireman & EPA" },
    { email: "electrician17@dispatchgrid.demo", name: "Dinesh Bhatt", category: "Electrical", cert: "Wireman Grade A" },
    { email: "electrician18@dispatchgrid.demo", name: "Sanjay Singhal", category: "AC Specialist", cert: "EPA Section 608" },
    { email: "electrician19@dispatchgrid.demo", name: "Harish Chandra", category: "Plumbing Specialist", cert: "Master Plumber" },
    { email: "electrician20@dispatchgrid.demo", name: "Raghav Menon", category: "All (Electrical, AC, Plumbing)", cert: "Wireman, EPA, Master Plumber" },
  ];

  if (!user || user.role !== "TECHNICIAN") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 mb-2">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Technician Portal Login</h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Log in to your private technician workspace to view new job offers, accept or decline assignments, report delays, and update your schedule.
          </p>
        </div>

        {/* Login Card */}
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-4">
          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              {loginError}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Technician Email</label>
              <input
                type="email"
                placeholder="e.g. electrician1@dispatchgrid.demo"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 font-mono text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="Default demo password: 12345"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => handleTechnicianLogin()}
              disabled={isLoggingIn}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? "Logging in..." : "Log In to Technician Portal"}
            </button>
          </div>
        </div>

        {/* 1-Click Quick Select for the 20 Seeded Technicians */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Quick 1-Click Technician Account Selector (20 Seeded Specialists)</span>
            <span className="text-slate-400">All Passwords: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">12345</code></span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {SEEDED_TECH_ACCOUNTS.map((t) => (
              <button
                key={t.email}
                onClick={() => {
                  setLoginEmail(t.email);
                  setLoginPassword("12345");
                  handleTechnicianLogin(t.email, "12345");
                }}
                className="p-2.5 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-xl text-left transition space-y-1 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600 text-[11px] group-hover:underline">
                    {t.email.split("@")[0]}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded text-slate-500">
                    12345
                  </span>
                </div>
                <div className="font-bold text-slate-800 text-xs truncate">{t.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{t.category}</div>
                <div className="text-[9px] text-cyan-700 font-semibold truncate">✓ {t.cert}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Profile Banner with Back Button */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              {technicianProfile?.username || "Technician Portal"}
            </span>
            <span className="text-xs text-slate-400">
              Shift: {shiftStart} - {shiftEnd} &bull; Status:{" "}
              <strong className={availabilityStatus === "AVAILABLE" ? "text-emerald-400" : "text-rose-400"}>
                {availabilityStatus}
              </strong>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{technicianProfile?.fullName || user?.fullName}</h1>
          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
            <span>
              Categories: <strong className="text-blue-300">{technicianProfile?.serviceCategories?.join(", ") || "Electrical"}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Rating: ★ {technicianProfile?.averageRating || 4.9} ({technicianProfile?.totalCompletedJobs || 0} jobs)
            </span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-semibold">✓ Verified Specialist</span>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5">
          {validOffers.length > 0 && (
            <button
              onClick={() => setActiveTab("offers")}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 animate-pulse"
            >
              <Zap className="w-4 h-4 fill-white" />
              {validOffers.length} New Offer{validOffers.length > 1 ? "s" : ""}
            </button>
          )}

          <button
            onClick={handleReportUnavailability}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Thermometer className="w-4 h-4 text-rose-400" />
            Report Sickness
          </button>

          <button
            onClick={logout}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Technician Dashboard Navigation (Part 1.C: 7 Tabs) */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-4 sm:gap-6 overflow-x-auto pb-1">
        {[
          { id: "dashboard", label: "My Dashboard" },
          { id: "offers", label: `New Job Offers (${validOffers.length})` },
          { id: "assigned", label: `My Assigned Jobs (${activeJobs.length})` },
          { id: "availability", label: "Availability" },
          { id: "history", label: `Job History (${completedJobs.length})` },
          { id: "profile", label: "Profile and Skills" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-3 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MY DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Offers</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{validOffers.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Awaiting accept/reject</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Active Assignments</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{activeJobs.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Scheduled for today</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed Jobs</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{completedJobs.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">With customer ratings</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Overall Rating</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">★ {technicianProfile?.averageRating || 4.9}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Quality score</div>
            </div>
          </div>

          {/* New Offer Callout Banner with Live 2-Minute Decision Timer */}
          {validOffers.length > 0 && (() => {
            const firstOffer = validOffers[0];
            const offTime = parseOfferTime(firstOffer.offeredAt);
            const diff = Math.max(0, Math.floor((offTime + 120 * 1000 - currentTime) / 1000));
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

            return (
              <div className={`text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                diff <= 30
                  ? "bg-gradient-to-r from-rose-600 to-red-600 animate-pulse"
                  : "bg-gradient-to-r from-amber-500 to-amber-600"
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base">You have {validOffers.length} pending job offer{validOffers.length > 1 ? "s" : ""}!</h3>
                    <span className="font-mono text-xs font-black bg-white/20 px-2 py-0.5 rounded-lg border border-white/30">
                      ⏳ {timeStr}
                    </span>
                  </div>
                  <p className="text-xs text-amber-100 mt-0.5">
                    2-minute decision timer running: accept or decline before it automatically reassigns to the next nearest person.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("offers")}
                  className="px-4 py-2 bg-white text-amber-900 font-extrabold rounded-xl text-xs hover:bg-amber-50 transition shadow-sm cursor-pointer whitespace-nowrap"
                >
                  Review Offers ({timeStr})
                </button>
              </div>
            );
          })()}

          {/* Next Immediate Assignment */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Next Scheduled Appointment
            </h2>

            {activeJobs.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                No active assignments in your schedule right now. Keep your availability active to receive new offers.
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{activeJobs[0].bookingReference}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {activeJobs[0].bookingStatus}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{activeJobs[0].serviceName}</div>
                  <p className="text-slate-600 mt-0.5">{activeJobs[0].problemDescription}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{activeJobs[0].serviceAddress}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeJobs[0].preferredStartTime} - {activeJobs[0].preferredEndTime}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NEW JOB OFFERS (Part 4) */}
      {activeTab === "offers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Pending Job Offers ({validOffers.length})
            </h2>
            <span className="text-xs text-slate-500">
              Accepting confirms assignment atomically. Declining prompts a reason and automatically reroutes to the next specialist.
            </span>
          </div>

          {validOffers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-semibold text-slate-700">All caught up! No pending offers.</div>
              <p>When new customer bookings matching your skills and zone are submitted, they will appear here instantly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validOffers.map((offer) => {
                const offeredTime = parseOfferTime(offer.offeredAt);
                const expiresTime = offeredTime + 120 * 1000;
                const diffSec = Math.max(0, Math.floor((expiresTime - currentTime) / 1000));
                const mins = Math.floor(diffSec / 60);
                const secs = diffSec % 60;
                const formattedCountdown = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                const timerPercent = Math.min(100, Math.max(0, (diffSec / 120) * 100));

                return (
                <div
                  key={offer.offerId}
                  className="bg-white rounded-2xl border-2 border-amber-400/80 p-5 shadow-sm space-y-4 relative"
                >
                  {/* 2-Minute Decision Timer Header */}
                  <div className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    diffSec <= 30
                      ? "bg-rose-50 border-rose-300 text-rose-800 animate-pulse shadow-xs"
                      : diffSec <= 60
                      ? "bg-amber-50 border-amber-300 text-amber-800 shadow-xs"
                      : "bg-blue-50 border-blue-200 text-blue-900 shadow-xs"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-4 h-4 ${diffSec <= 30 ? "text-rose-600 animate-spin-slow" : "text-blue-600"}`} />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">
                          2-Min Decision Timer:
                        </span>
                        <span className="font-mono text-sm font-black tracking-wider px-2 py-0.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                          {formattedCountdown}
                        </span>
                      </div>

                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        diffSec <= 30
                          ? "bg-rose-200 text-rose-900"
                          : diffSec <= 60
                          ? "bg-amber-200 text-amber-900"
                          : "bg-blue-200 text-blue-900"
                      }`}>
                        Auto-Reassigns on 00:00
                      </span>
                    </div>

                    {/* Smooth countdown progress bar */}
                    <div className="mt-2 w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          diffSec <= 30
                            ? "bg-rose-500"
                            : diffSec <= 60
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${timerPercent}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>Requested: {new Date(offeredTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className="text-purple-700 font-bold">Target: Next Nearest Person</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900">{offer.bookingReference}</span>
                      {offer.isDemoTracking && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                          DEMO MODE (AMIT PATEL)
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        offer.verifiedPriority === "EMERGENCY"
                          ? "bg-red-100 text-red-800 animate-pulse"
                          : offer.verifiedPriority === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {offer.verifiedPriority}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-extrabold text-slate-900">{offer.serviceName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {offer.category}
                      </span>
                      <span className="text-xs text-slate-600 font-semibold">
                        Customer: <strong>{offer.customerName || "Valued Customer"}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{offer.problemDescription}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span className="truncate">{offer.serviceAddress}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200 text-[11px]">
                      <span>Window: <strong>{offer.preferredStartTime} - {offer.preferredEndTime}</strong></span>
                      <span className="text-emerald-700 font-bold">ETA: ~{offer.travelMinutes} mins</span>
                    </div>
                    {offer.offeredAt && (
                      <div className="text-[10px] text-slate-400">
                        Offered: {new Date(offer.offeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* Accept & Reject Action Buttons (Part 4) */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => {
                        setRejectOfferId(offer.offerId);
                      }}
                      className="py-2.5 px-3 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                    <button
                      onClick={() => handleAcceptOffer(offer.offerId)}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20"
                    >
                      <Check className="w-4 h-4" /> Accept Job
                    </button>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY ASSIGNED JOBS (Status Progression) */}
      {activeTab === "assigned" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Confirmed Assignments ({activeJobs.length})
            </h2>
          </div>

          {activeJobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
              No active jobs in progress. Check the "New Job Offers" tab to accept upcoming work.
            </div>
          ) : (
            <div className="space-y-4">
              {activeJobs.map((b) => (
                <div key={b.bookingId} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{b.bookingReference}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                        {b.bookingStatus}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">
                      {b.preferredDate} ({b.preferredStartTime} - {b.preferredEndTime})
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{b.serviceName}</h3>
                    <p className="text-xs text-slate-600 mt-1">{b.problemDescription}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-800">{b.serviceAddress}</span>
                    </div>
                    <div className="text-emerald-700 font-bold">
                      Estimated Travel: ~{b.estimatedTravelTimeMinutes || 15} mins
                    </div>
                  </div>

                  {/* Lifecycle Buttons (Part 9: Valid Transitions & Live Tracking) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    {(b.bookingStatus === "ASSIGNED" || b.bookingStatus === "SCHEDULED") && (
                      <button
                        onClick={() => handleStartTravelling(b.bookingId)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Start Travelling (Begin Live GPS)
                      </button>
                    )}

                    {b.bookingStatus === "ON_THE_WAY" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                          Live Tracking Active (Simulated GPS Broadcasting)
                        </span>
                        <button
                          onClick={() => handleFastForward(b.bookingId)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Instant demo arrival"
                        >
                          <Zap className="w-3 h-3" /> Demo: Instant Arrive
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(b.bookingId, "IN_PROGRESS")}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" /> Arrived on Site (Start Work)
                        </button>
                      </div>
                    )}

                    {(b.bookingStatus === "IN_PROGRESS" || b.bookingStatus === "ARRIVED") && (
                      <button
                        onClick={() => setCompleteBookingId(b.bookingId)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete Job & Finalize
                      </button>
                    )}

                    <button
                      onClick={() => setDelayBookingId(b.bookingId)}
                      className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold ml-auto"
                    >
                      Report Delay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


{/* TAB 5: AVAILABILITY & SHIFTS */}
      {activeTab === "availability" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 max-w-xl shadow-xs">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Working Shift & Availability Settings</h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure your daily shift hours and current status. If you are unavailable, no new offers will be dispatched.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Availability Status</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 font-semibold text-slate-900"
              >
                <option value="AVAILABLE">AVAILABLE (Ready to accept jobs)</option>
                <option value="BUSY">BUSY (On active assignment)</option>
                <option value="UNAVAILABLE">UNAVAILABLE (Off-duty / Sick)</option>
                <option value="ON_BREAK">ON_BREAK</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Start Time</label>
                <input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift End Time</label>
                <input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveAvailability}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
              >
                Save Availability Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: JOB HISTORY & REVIEWS */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Completed Service Record ({completedJobs.length})
          </h2>

          {completedJobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No completed jobs yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {completedJobs.map((b) => (
                <div key={b.bookingId} className="py-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{b.bookingReference}</span>
                    <span className="text-slate-400">{b.preferredDate}</span>
                  </div>
                  <div className="font-bold text-slate-800">{b.serviceName}</div>
                  <p className="text-slate-500">{b.serviceAddress}</p>
                  {b.customerReview && (
                    <div className="mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-700 italic">
                      "★ {b.customerRating} - {b.customerReview}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: PROFILE AND SKILLS (Part 1.C & Part 2) */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 max-w-2xl shadow-xs">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Technician Credentials & Certifications</h2>
            <p className="text-xs text-slate-500 mt-1">
              Verified skills, licenses, and authorized service zones recognized by the DispatchGrid scheduling engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Technician ID & Username</span>
              <div className="font-mono font-bold text-slate-900">{technicianProfile?.username || "electrician"}</div>
              <div className="text-slate-500">{technicianProfile?.email}</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Experience & Rating</span>
              <div className="font-bold text-slate-900">{technicianProfile?.experienceYears || 5} Years Practical Trade</div>
              <div className="text-slate-500">★ {technicianProfile?.averageRating || 4.9} Overall Rating</div>
            </div>

            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Authorized Service Zones</span>
              <div className="flex flex-wrap gap-1.5">
                {technicianProfile?.serviceAreas?.map((zone) => (
                  <span key={zone} className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[11px] font-semibold">
                    {zone}
                  </span>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Professional Certifications</span>
              <div className="space-y-1">
                {technicianProfile?.certifications?.map((c) => (
                  <div key={c.certId} className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{c.certName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Verified Skills</span>
              <div className="flex flex-wrap gap-1">
                {technicianProfile?.skills?.map((s) => (
                  <span key={s.skillId} className="px-2 py-1 rounded-lg bg-slate-200/80 text-slate-700 text-[11px]">
                    {s.skillName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT OFFER MODAL (Part 4) */}
      {rejectOfferId && (
        <div className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Decline Job Offer</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please provide a reason. The DispatchGrid engine will automatically re-offer this job to the next best eligible technician.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Rejection *</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 font-semibold"
                >
                  <option value="Too far from current location">Too far from current location</option>
                  <option value="Requires specialized tools not currently in vehicle">Requires specialized tools not currently in vehicle</option>
                  <option value="Prior job running late causing schedule overlap">Prior job running late causing schedule overlap</option>
                  <option value="Personal emergency or doctor appointment">Personal emergency or doctor appointment</option>
                  <option value="Other">Other (enter custom reason)</option>
                </select>
              </div>

              {rejectionReason === "Other" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Explanation</label>
                  <textarea
                    rows={2}
                    value={customRejectReason}
                    onChange={(e) => setCustomRejectReason(e.target.value)}
                    placeholder="Enter details..."
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-3"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectOfferId(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectOffer}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
              >
                Submit Rejection & Reallocate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DELAY MODAL */}
      {delayBookingId && (
        <div className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Report Service Delay</h3>
              <p className="text-xs text-slate-500 mt-1">
                Inform the platform of unexpected delays so downstream customers are notified and subsequent slots can be protected.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expected Delay (Minutes)</label>
                <select
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 font-semibold"
                >
                  <option value={15}>+15 Minutes</option>
                  <option value={30}>+30 Minutes</option>
                  <option value={45}>+45 Minutes</option>
                  <option value={60}>+60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Delay</label>
                <input
                  type="text"
                  placeholder="e.g. Traffic jam on Bellary Rd or complex compressor wiring"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDelayBookingId(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReportDelay}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
              >
                Send Delay Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE SERVICE MODAL */}
      {completeBookingId && (
        <div className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Complete Job & Submit Summary</h3>
              <p className="text-xs text-slate-500 mt-1">
                Summarize work performed, parts replaced, and safety tests before marking this booking COMPLETED.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Completion Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Replaced damaged capacitor, nitrogen vacuum leak tested, system running at optimal amp draw."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setCompleteBookingId(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCompleteJobWithTracking(completeBookingId, completionNotes)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
              >
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
