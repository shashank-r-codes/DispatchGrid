import React, { useState } from "react";
import { X, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert, Truck, Thermometer, Clock } from "lucide-react";
import { Technician, Booking } from "../types";
import { useToast } from "../context/ToastContext";

interface DisruptionRecoveryModalProps {
  technicians: Technician[];
  bookings: Booking[];
  isOpen: boolean;
  onClose: () => void;
  onRecoveryComplete: () => void;
}

export const DisruptionRecoveryModal: React.FC<DisruptionRecoveryModalProps> = ({
  technicians,
  bookings,
  isOpen,
  onClose,
  onRecoveryComplete,
}) => {
  const { showToast } = useToast();
  const [disruptionType, setDisruptionType] = useState<
    "TECHNICIAN_SICKNESS" | "VEHICLE_BREAKDOWN" | "JOB_DELAY" | "EMERGENCY_REQUEST"
  >("TECHNICIAN_SICKNESS");
  const [selectedTechId, setSelectedTechId] = useState<string>(technicians[0]?.userId || "");
  const [selectedBookingId, setSelectedBookingId] = useState<string>(bookings[0]?.bookingId || "");
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [reason, setReason] = useState<string>("Sudden acute medical illness reported by technician");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/recovery/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          disruptionType,
          technicianId: selectedTechId,
          bookingId: selectedBookingId,
          delayMinutes,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data.result);
        showToast(`Disruption handled: ${data.result.explanation}`, "success");
        onRecoveryComplete();
      } else {
        showToast(data.error || "Recovery failed", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Disruption recovery execution failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-base">Dynamic Schedule Recovery Engine</h3>
              <p className="text-xs text-rose-100">Simulate Real-World Disruption & Adaptive Reassignment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Disruption Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Disruption Event Scenario
            </label>
            <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setDisruptionType("TECHNICIAN_SICKNESS");
                  setReason("Technician reported sudden illness / medical leave");
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                  disruptionType === "TECHNICIAN_SICKNESS"
                    ? "border-red-500 bg-red-50/80 text-red-900 ring-2 ring-red-200"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Thermometer className="w-4 h-4 text-red-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">Technician Sickness</div>
                  <div className="text-[10px] text-slate-500 font-normal">Reassign remaining shift</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDisruptionType("VEHICLE_BREAKDOWN");
                  setReason("Transit van tire puncture and radiator overheating");
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                  disruptionType === "VEHICLE_BREAKDOWN"
                    ? "border-amber-500 bg-amber-50/80 text-amber-900 ring-2 ring-amber-200"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Truck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">Vehicle Breakdown</div>
                  <div className="text-[10px] text-slate-500 font-normal">Immediate roadside rerouting</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDisruptionType("JOB_DELAY");
                  setReason("Complex concealed wiring fault requiring extra isolation time");
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                  disruptionType === "JOB_DELAY"
                    ? "border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-200"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">Unexpected Delay</div>
                  <div className="text-[10px] text-slate-500 font-normal">Downstream ripple evaluation</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDisruptionType("EMERGENCY_REQUEST");
                  setReason("Critical emergency pipe burst water flood");
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                  disruptionType === "EMERGENCY_REQUEST"
                    ? "border-purple-500 bg-purple-50/80 text-purple-900 ring-2 ring-purple-200"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">Verified Emergency Arrival</div>
                  <div className="text-[10px] text-slate-500 font-normal">Reserved buffer insertion</div>
                </div>
              </button>
            </div>
          </div>

          {/* Dynamic Inputs based on type */}
          {(disruptionType === "TECHNICIAN_SICKNESS" || disruptionType === "VEHICLE_BREAKDOWN") && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Affected Technician
              </label>
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:ring-blue-500"
              >
                {technicians.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.fullName} ({t.serviceCategories.join(", ")}) - {t.availabilityStatus}
                  </option>
                ))}
              </select>
            </div>
          )}

          {disruptionType === "JOB_DELAY" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delayed Booking</label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
                >
                  {bookings.map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      {b.bookingReference} - {b.serviceName} ({b.assignedTechnicianName || "Unassigned"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delay Duration</label>
                <select
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
                >
                  <option value={15}>+15 Minutes Delay</option>
                  <option value={30}>+30 Minutes Delay</option>
                  <option value={60}>+60 Minutes Delay</option>
                </select>
              </div>
            </div>
          )}

          {disruptionType === "EMERGENCY_REQUEST" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Booking to Triage as Verified Emergency
              </label>
              <select
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              >
                {bookings.map((b) => (
                  <option key={b.bookingId} value={b.bookingId}>
                    {b.bookingReference} - {b.serviceName} ({b.bookingStatus})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Disruption Context Note</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
            />
          </div>

          {/* Results Summary Box if already executed */}
          {result && (
            <div className="bg-slate-900 text-white rounded-xl p-4 text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Recovery Status: {result.status}
                </span>
                <span className="text-[11px] text-slate-400">Time: {result.executionTimeMs} ms</span>
              </div>
              <p className="text-slate-300">{result.explanation}</p>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-slate-800 p-2 rounded">Affected: {result.affectedJobsCount}</div>
                <div className="bg-slate-800 p-2 rounded text-emerald-400">Reassigned: {result.reassignedJobsCount}</div>
                <div className="bg-slate-800 p-2 rounded text-rose-400">Unresolved: {result.unresolvedJobsCount}</div>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-600/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Adaptive Recovery...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  Execute Disruption Recovery
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
