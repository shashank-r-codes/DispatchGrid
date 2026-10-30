import React, { useState, useEffect } from "react";
import { Plus, Calendar, Clock, MapPin, CheckCircle2, AlertTriangle, ShieldCheck, Star, XCircle, ChevronRight, User, Wrench } from "lucide-react";
import { Booking, Technician } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DispatchMap } from "../components/DispatchMap";
import { BookingWizardModal } from "../components/BookingWizardModal";
import { ReviewModal } from "../components/ReviewModal";

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  const fetchCustomerData = async () => {
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
    fetchCustomerData();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    const reason = prompt("Please provide a reason for cancellation:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({ status: "CANCELLED", reason }),
      });

      if (res.ok) {
        showToast("Booking cancelled successfully", "success");
        fetchCustomerData();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to cancel", "error");
      }
    } catch {
      showToast("Error cancelling booking", "error");
    }
  };

  const activeBookings = bookings.filter((b) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(b.bookingStatus));
  const pastBookings = bookings.filter((b) => ["COMPLETED", "CANCELLED", "REJECTED"].includes(b.bookingStatus));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.fullName || "Valued Customer"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            DispatchGrid Intelligent Maintenance: Electrical, Certified AC & Master Plumbing
          </p>
        </div>
        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" /> Book New Service
        </button>
      </div>

      {/* Main Grid: Active Appointments & Live Map Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active Appointments List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Active Appointments ({activeBookings.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading your appointments...
            </div>
          ) : activeBookings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">No active maintenance bookings</div>
              <p className="text-[11px] text-slate-500">Need an AC tune-up, electrical repair, or plumbing fix?</p>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg"
              >
                Book a Service Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBookings.map((b) => {
                const isSelected = selectedBooking?.bookingId === b.bookingId;
                const isEmergency = b.verifiedPriority === "EMERGENCY";

                return (
                  <div
                    key={b.bookingId}
                    onClick={() => setSelectedBooking(b)}
                    className={`p-4 rounded-xl border transition cursor-pointer relative bg-white ${
                      isSelected
                        ? "border-blue-600 ring-2 ring-blue-100 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{b.bookingReference}</span>
                      <div className="flex items-center gap-1.5">
                        {isEmergency && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 animate-pulse">
                            🚨 EMERGENCY
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                          {b.bookingStatus}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-bold text-slate-900 mb-1">{b.serviceName}</div>
                    <p className="text-xs text-slate-500 line-clamp-1 mb-3">{b.problemDescription}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {b.preferredDate} ({b.preferredStartTime})
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{b.serviceAddress}</span>
                      </div>
                    </div>

                    {/* Assigned Technician Card */}
                    {b.assignedTechnicianName ? (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                            {b.assignedTechnicianName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{b.assignedTechnicianName}</div>
                            <div className="text-[10px] text-slate-500">
                              ★ {b.assignedTechnicianRating || 4.9} &bull; {b.category} Verified
                            </div>
                          </div>
                        </div>
                        {b.estimatedTravelTimeMinutes ? (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Estimated ETA</span>
                            <span className="font-bold text-emerald-700">{b.estimatedTravelTimeMinutes} mins</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                        Awaiting intelligent technician matching...
                      </div>
                    )}

                    {/* Cancel action */}
                    {b.bookingStatus !== "IN_PROGRESS" && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelBooking(b.bookingId);
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Map Tracking & Route Polyline */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              Live Route Tracking & Metro Road Network
            </h2>
            {selectedBooking && (
              <span className="text-xs font-mono font-semibold text-slate-500">
                Selected: {selectedBooking.bookingReference}
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

      {/* Booking History & Reviews Section (Phase 6.6) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Completed Services & Feedback History
        </h2>

        {pastBookings.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">No completed service records yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pastBookings.map((b) => (
              <div key={b.bookingId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{b.bookingReference}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        b.bookingStatus === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {b.bookingStatus}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{b.serviceName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Technician: {b.assignedTechnicianName || "N/A"} &bull; Completed: {b.preferredDate}
                  </div>
                  {b.customerReview && (
                    <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 italic">
                      "★ {b.customerRating} - {b.customerReview}"
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {b.bookingStatus === "COMPLETED" && !b.customerRating && (
                    <button
                      onClick={() => setReviewBooking(b)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Star className="w-3.5 h-3.5 fill-white" /> Rate & Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <BookingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={(ref) => {
          showToast(`Booking ${ref} confirmed! Our intelligent scheduler is calculating assignments.`, "success");
          fetchCustomerData();
        }}
      />

      <ReviewModal
        isOpen={Boolean(reviewBooking)}
        booking={reviewBooking}
        onClose={() => setReviewBooking(null)}
        onSuccess={() => {
          showToast("Thank you! Your feedback has been published.", "success");
          fetchCustomerData();
        }}
      />
    </div>
  );
};
