import React, { useState, useEffect } from "react";
import { X, Check, ArrowRight, ArrowLeft, ShieldAlert, MapPin, Calendar, Clock, User, Wrench, AlertCircle } from "lucide-react";
import { ServiceItem, Technician } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookingRef: string) => void;
}

export const BookingWizardModal: React.FC<BookingWizardModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<number>(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"Electrical" | "AC" | "Plumbing">("AC");

  // Form states
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [addressLine, setAddressLine] = useState<string>("");
  const [city, setCity] = useState<string>("Bengaluru");
  const [pincode, setPincode] = useState<string>("560034");
  const [latitude, setLatitude] = useState<number>(12.9352);
  const [longitude, setLongitude] = useState<number>(77.6245);
  const [preferredDate, setPreferredDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [preferredStartTime, setPreferredStartTime] = useState<string>("10:00");
  const [preferredEndTime, setPreferredEndTime] = useState<string>("11:00");
  const [alternativeWindow, setAlternativeWindow] = useState<string>("14:00 - 16:00");
  const [requestedPriority, setRequestedPriority] = useState<"NORMAL" | "HIGH" | "EMERGENCY">("NORMAL");
  const [preferredTechnicianId, setPreferredTechnicianId] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Load services
      fetch("/api/services")
        .then((res) => res.json())
        .then((data) => {
          setServices(data.services || []);
          if (data.services?.length) {
            setSelectedServiceId(data.services[0].serviceId);
            setSelectedCategory(data.services[0].category);
          }
        });

      // Load technicians
      fetch("/api/technicians")
        .then((res) => res.json())
        .then((data) => setTechnicians(data.technicians || []));

      // Auto-fill customer address if available
      if (user?.addresses && user.addresses.length > 0) {
        const def = user.addresses.find((a) => a.is_default) || user.addresses[0];
        setAddressLine(def.address_line);
        setCity(def.city);
        setPincode(def.pincode);
        setLatitude(def.latitude);
        setLongitude(def.longitude);
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentService = services.find((s) => s.serviceId === selectedServiceId);
  const eligibleTechs = technicians.filter((t) => t.verificationStatus === "APPROVED" && t.serviceCategories.includes(selectedCategory));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          problemDescription,
          photoUrl,
          addressLine,
          city,
          pincode,
          latitude,
          longitude,
          preferredDate,
          preferredStartTime,
          preferredEndTime,
          alternativeWindow,
          requestedPriority,
          preferredTechnicianId: preferredTechnicianId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess(data.bookingReference);
        onClose();
      } else {
        showToast(data.error || "Failed to submit booking", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Submission error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-bold text-base">Book a Maintenance Service</h3>
            <p className="text-xs text-slate-400">Step {step} of 6 &bull; Intelligent Technician Matching</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          {[
            "1. Service",
            "2. Details",
            "3. Location",
            "4. Schedule",
            "5. Priority",
            "6. Review",
          ].map((label, idx) => (
            <span
              key={label}
              className={`${
                step === idx + 1
                  ? "text-blue-600 font-bold"
                  : step > idx + 1
                  ? "text-emerald-600"
                  : "text-slate-400"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* STEP 1: SERVICE SELECTION */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Service Category
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["Electrical", "AC", "Plumbing"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        const firstInCat = services.find((s) => s.category === cat);
                        if (firstInCat) setSelectedServiceId(firstInCat.serviceId);
                      }}
                      className={`p-3 rounded-xl border text-center transition font-bold text-xs ${
                        selectedCategory === cat
                          ? "border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-200"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {cat === "AC" && "❄️ AC & HVAC"}
                      {cat === "Electrical" && "⚡ Electrical"}
                      {cat === "Plumbing" && "🔧 Plumbing"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Choose Specific Service
                </label>
                <div className="space-y-2">
                  {services
                    .filter((s) => s.category === selectedCategory)
                    .map((s) => (
                      <div
                        key={s.serviceId}
                        onClick={() => setSelectedServiceId(s.serviceId)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          selectedServiceId === s.serviceId
                            ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-500"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900">{s.serviceName}</div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{s.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">Est: {s.estimatedDurationMinutes} mins</span>
                            {s.requiredCertifications.length > 0 && (
                              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                                Certified Required
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 pl-3">
                          <span className="text-sm font-extrabold text-blue-900 font-mono">${s.indicativePrice}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROBLEM DETAILS */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Describe the Issue or Job Requirements *
                </label>
                <textarea
                  rows={4}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="E.g., Air conditioner blowing warm air and humming noisily; or circuit breaker trips when running heavy load..."
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 focus:bg-white focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Photo URL or Worksite Reference
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photos/ac-unit.jpg"
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Address Line *</label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Street address, building, apartment number"
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Smart Transit Mapping:</strong> Coordinates ({latitude.toFixed(4)}, {longitude.toFixed(4)}) will be matched to the closest urban road intersection node for accurate transit routing.
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PREFERENCES & TIME WINDOW */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={preferredStartTime}
                    onChange={(e) => setPreferredStartTime(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={preferredEndTime}
                    onChange={(e) => setPreferredEndTime(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Preferred Technician (Phase 4.5)
                </label>
                <select
                  value={preferredTechnicianId}
                  onChange={(e) => setPreferredTechnicianId(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
                >
                  <option value="">No preference (Auto-optimize best qualified technician)</option>
                  {eligibleTechs.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.fullName} (Rating: ★ {t.averageRating} &bull; {t.experienceYears} yrs exp)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Rule: Customer preferences are honored whenever all mandatory hard constraints (skills, certifications, shift) are satisfied.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: PRIORITY LEVEL */}
          {step === 5 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Service Urgency Priority
              </label>

              {[
                {
                  id: "NORMAL",
                  title: "Standard Scheduled Appointment",
                  desc: "Service within standard scheduling windows. Standard rate.",
                  badge: "bg-blue-100 text-blue-800",
                },
                {
                  id: "HIGH",
                  title: "High Priority Service",
                  desc: "Prioritized scheduling queue consideration for urgent home needs.",
                  badge: "bg-amber-100 text-amber-800",
                },
                {
                  id: "EMERGENCY",
                  title: "Critical Emergency Dispatch",
                  desc: "Immediate active hazard (pipe burst, active short circuit, toxic leak). Evaluated against reserved emergency capacity.",
                  badge: "bg-red-100 text-red-800 font-bold",
                },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setRequestedPriority(p.id as any)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    requestedPriority === p.id
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-200"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{p.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.badge}`}>{p.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{p.desc}</p>
                </div>
              ))}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Priority Verification Policy:</strong> Customer-requested emergencies are immediately triaged by dispatchers to prevent abuse while guaranteeing safety.
                </span>
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW & SUBMIT */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs text-slate-700">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Service:</span>
                  <span className="font-bold text-slate-900">{currentService?.serviceName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-slate-900">{selectedCategory}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Indicative Price:</span>
                  <span className="font-bold text-blue-900 font-mono">${currentService?.indicativePrice}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Appointment Window:</span>
                  <span className="font-semibold text-slate-900">
                    {preferredDate} ({preferredStartTime} - {preferredEndTime})
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-semibold text-slate-900 text-right truncate max-w-[280px]">
                    {addressLine}, {city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Urgency:</span>
                  <span className="font-bold text-slate-900">{requestedPriority}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center">
                Upon submission, DispatchGrid's intelligent matching engine will calculate the optimal technician based on optimized travel times, certifications, and availability.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-40 transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 2 && !problemDescription.trim()) {
                  showToast("Please enter a brief problem description.", "info");
                  return;
                }
                setStep((s) => Math.min(6, s + 1));
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Confirm & Book Service
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
