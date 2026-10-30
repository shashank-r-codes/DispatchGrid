import React, { useState, useEffect } from "react";
import { CheckCircle2, Clock, MapPin, Phone, AlertTriangle, Truck, Thermometer, ShieldAlert, Award, Navigation, ChevronRight } from "lucide-react";
import { Booking, Technician } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DispatchMap } from "../components/DispatchMap";

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick action states
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [completionNotes, setCompletionNotes] = useState<string>("");
  const [activeCompletingId, setActiveCompletingId] = useState<string | null>(null);

  const fetchTechData = async () => {
    setIsLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/bookings", {
          headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
        }),
        fetch("/api/technicians"),
      ]);

      if (bRes.ok) {
        const bData = await bRes.json();
        setBookings(bData.bookings || []);
        if (bData.bookings?.length && !selectedBooking) {
          setSelectedBooking(bData.bookings[0]);
        }
      }

      if (tRes.ok) {
        const tData = await tRes.json();
        setTechnicians(tData.technicians || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTechData();
  }, []);

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
          reason: `Technician updated progress to ${status}`,
        }),
      });

      if (res.ok) {
        fetchTechData();
        setActiveCompletingId(null);
        setCompletionNotes("");
        showToast(`Status updated to ${status}`, "success");
      } else {
        const d = await res.json();
        showToast(d.error || "Status update failed", "error");
      }
    } catch {
      showToast("Error updating status", "error");
    }
  };

  const handleReportDelay = async (bookingId: string) => {
    try {
      const res = await fetch("/api/technicians/report-delay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          bookingId,
          delayMinutes,
          reason: `Technician reported ${delayMinutes} mins delay`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchTechData();
      } else {
        showToast(data.error || "Delay report failed", "error");
      }
    } catch {
      showToast("Error reporting delay", "error");
    }
  };

  const handleReportUnavailability = async () => {
    const reason = prompt("Enter reason for sudden unavailability (e.g., Medical sickness or vehicle breakdown):");
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
        showToast(`Disruption registered! ${data.recovery.explanation}`, "success");
        fetchTechData();
      } else {
        showToast(data.error || "Report failed", "error");
      }
    } catch {
      showToast("Error reporting unavailability", "error");
    }
  };

  const currentTechProfile = technicians.find((t) => t.userId === user?.userId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
              {currentTechProfile?.verificationStatus === "APPROVED" ? "Verified Specialist" : "Pending Verification"}
            </span>
            <span className="text-xs text-slate-400">
              Shift: {currentTechProfile?.shiftStartTime || "08:00"} - {currentTechProfile?.shiftEndTime || "18:00"}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{user?.fullName || "Technician Portal"}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Categories: <strong className="text-blue-300">{currentTechProfile?.serviceCategories.join(", ")}</strong> &bull; Rating: ★ {currentTechProfile?.averageRating || 5.0} ({currentTechProfile?.totalCompletedJobs || 0} jobs)
          </p>
        </div>

        {/* Unavailability Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReportUnavailability}
            className="px-4 py-2 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
          >
            <Thermometer className="w-3.5 h-3.5" /> Report Sickness / Unavailability
          </button>
        </div>
      </div>

      {/* Main Grid: Shift Assignments & Route Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Assigned Shift Route */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            Today's Job Route ({bookings.length})
          </h2>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading your route...
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
              No jobs assigned to you for today yet. Stay available in your service area.
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const isSelected = selectedBooking?.bookingId === b.bookingId;
                const isCompleting = activeCompletingId === b.bookingId;

                return (
                  <div
                    key={b.bookingId}
                    onClick={() => setSelectedBooking(b)}
                    className={`p-4 rounded-xl border bg-white transition cursor-pointer space-y-3 ${
                      isSelected
                        ? "border-blue-600 ring-2 ring-blue-100 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{b.bookingReference}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          b.bookingStatus === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : b.bookingStatus === "ON_THE_WAY"
                            ? "bg-blue-100 text-blue-800"
                            : b.bookingStatus === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {b.bookingStatus}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-900">{b.serviceName}</div>
                      <p className="text-xs text-slate-600 mt-0.5">{b.problemDescription}</p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="truncate">{b.serviceAddress}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-slate-500">
                        <span>Window: <b>{b.preferredStartTime} - {b.preferredEndTime}</b></span>
                        <span className="text-emerald-700 font-semibold">Travel: {b.estimatedTravelTimeMinutes || 15}m</span>
                      </div>
                    </div>

                    {/* Action Buttons for Technician Lifecycle (Phase 6.2 & 6.4) */}
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {b.bookingStatus === "SCHEDULED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(b.bookingId, "ON_THE_WAY");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" /> Mark On The Way
                        </button>
                      )}

                      {b.bookingStatus === "ON_THE_WAY" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(b.bookingId, "IN_PROGRESS");
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Start Job (In Progress)
                        </button>
                      )}

                      {b.bookingStatus === "IN_PROGRESS" && !isCompleting && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCompletingId(b.bookingId);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Complete Job
                        </button>
                      )}

                      {/* Report Delay Dropdown */}
                      {b.bookingStatus !== "COMPLETED" && (
                        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={delayMinutes}
                            onChange={(e) => setDelayMinutes(Number(e.target.value))}
                            className="text-[11px] rounded-lg border-slate-200 bg-slate-50 py-1 px-1.5"
                          >
                            <option value={15}>+15m</option>
                            <option value={30}>+30m</option>
                            <option value={60}>+60m</option>
                          </select>
                          <button
                            onClick={() => handleReportDelay(b.bookingId)}
                            className="px-2 py-1 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-[11px] font-semibold"
                          >
                            Report Delay
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Completion Notes Input if active */}
                    {isCompleting && (
                      <div className="pt-2 space-y-2 border-t border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-[11px] font-bold text-slate-700">Completion Summary Notes *</label>
                        <textarea
                          rows={2}
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                          placeholder="Replaced damaged capacitor, vacuum tested lines, system running at optimal amp draw."
                          className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActiveCompletingId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(b.bookingId, "COMPLETED", completionNotes)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold"
                          >
                            Submit Completion
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map & Live Navigation View */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-blue-600" />
              Live Route Navigation & Metro Grid
            </h2>
            {selectedBooking && (
              <span className="text-xs font-mono font-semibold text-slate-500">
                Route: {selectedBooking.bookingReference}
              </span>
            )}
          </div>

          <DispatchMap
            bookings={bookings}
            technicians={technicians}
            selectedBooking={selectedBooking}
            onSelectBooking={(b) => setSelectedBooking(b)}
            height="500px"
          />
        </div>
      </div>
    </div>
  );
};
