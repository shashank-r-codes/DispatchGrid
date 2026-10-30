import React, { useState, useEffect } from "react";
import {
  Wrench,
  Search,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Snowflake,
  Droplets,
  Phone,
  User,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Navigation,
  Star,
  Info,
} from "lucide-react";
import { ServiceItem, ServiceCategory, PriorityLevel } from "../types";
import { DispatchMap } from "../components/DispatchMap";
import { METRO_NODES } from "../../backend/config/roadNetwork";
import { useToast } from "../context/ToastContext";

export const CustomerPortal: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"book" | "track">("book");

  // Booking Form State
  const [step, setStep] = useState<number>(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("Electrical");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [serviceAddress, setServiceAddress] = useState<string>("");
  const [selectedZoneKey, setSelectedZoneKey] = useState<string>("NODE_CENTRAL");
  const [latitude, setLatitude] = useState<number>(12.9716);
  const [longitude, setLongitude] = useState<number>(77.5946);
  const [preferredDate, setPreferredDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [preferredStartTime, setPreferredStartTime] = useState<string>("10:00");
  const [preferredEndTime, setPreferredEndTime] = useState<string>("11:00");
  const [priority, setPriority] = useState<PriorityLevel>("NORMAL");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<any>(null);

  // Tracking State
  const [trackRef, setTrackRef] = useState<string>("");
  const [trackPhone, setTrackPhone] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [trackedBooking, setTrackedBooking] = useState<any>(null);
  const [trackError, setTrackError] = useState<string>("");

  useEffect(() => {
    fetch("/api/services?activeOnly=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.services) {
          setServices(data.services);
          const firstCatService = data.services.find((s: ServiceItem) => s.category === "Electrical");
          if (firstCatService) setSelectedServiceId(firstCatService.serviceId);
        }
      })
      .catch((err) => console.error("Error loading services:", err));
  }, []);

  const handleCategorySelect = (cat: ServiceCategory) => {
    setSelectedCategory(cat);
    const firstInCat = services.find((s) => s.category === cat);
    if (firstInCat) setSelectedServiceId(firstInCat.serviceId);
  };

  const handleZoneSelect = (key: string) => {
    setSelectedZoneKey(key);
    const node = METRO_NODES[key];
    if (node) {
      setLatitude(node.lat);
      setLongitude(node.lng);
      setServiceAddress(`${node.name}, ${node.locality}, Bengaluru`);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !problemDescription || !serviceAddress) {
      showToast("Please fill in all mandatory booking fields.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          customerName,
          customerPhone,
          problemDescription,
          addressLine: serviceAddress,
          city: "Bengaluru",
          latitude,
          longitude,
          preferredDate,
          preferredStartTime,
          preferredEndTime,
          requestedPriority: priority,
          notes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookingConfirmation(data);
        setStep(4);
        showToast("Booking created & auto-allotment initiated!", "success");
      } else {
        showToast(data.error || "Failed to create booking", "error");
      }
    } catch {
      showToast("Network error creating booking", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError("");
    setTrackedBooking(null);

    if (!trackRef.trim() || !trackPhone.trim()) {
      setTrackError("Please enter both your Booking Reference / ID and your registered Phone Number.");
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/bookings/track?reference=${encodeURIComponent(trackRef.trim())}&phone=${encodeURIComponent(trackPhone.trim())}`);
      const data = await res.json();
      if (res.ok && data.booking) {
        setTrackedBooking(data.booking);
      } else {
        setTrackError(data.error || "No matching booking found. Please check your reference and phone number.");
      }
    } catch {
      setTrackError("Error contacting tracking service. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectedService = services.find((s) => s.serviceId === selectedServiceId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Customer Branding Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 tracking-wider uppercase">
              Fast, Certified Home Services
            </span>
            <span className="text-xs text-slate-400">Autonomous Instant Dispatch Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Dispatch<span className="text-blue-400">Grid</span> Service Hub
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-xl">
            Book professional maintenance instantly without an account. Our intelligent dispatch engine finds and confirms the best available certified specialist in minutes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 relative z-10 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("book")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "book"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Wrench className="w-4 h-4" /> Book a Service
          </button>
          <button
            onClick={() => setActiveTab("track")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "track"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Search className="w-4 h-4" /> Track My Booking
          </button>
        </div>
      </div>

      {/* VIEW 1: BOOK A SERVICE */}
      {activeTab === "book" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
          {/* Progress Steps Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            {[
              { num: 1, title: "1. Service Category" },
              { num: 2, title: "2. Details & Location" },
              { num: 3, title: "3. Review & Submit" },
              { num: 4, title: "4. Auto-Allotment" },
            ].map((st) => (
              <div
                key={st.num}
                className={`flex items-center gap-2 text-xs font-bold ${
                  step === st.num
                    ? "text-blue-600"
                    : step > st.num
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                    step === st.num
                      ? "bg-blue-600 text-white"
                      : step > st.num
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > st.num ? "✓" : st.num}
                </div>
                <span className="hidden sm:inline">{st.title}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: Select Category & Service */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Step 1: Choose Service Department</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Select your requirement. <strong>Rule:</strong> AC maintenance is handled by EPA/HVAC certified specialists, separate from general electrical work.
                </p>
              </div>

              {/* Category Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Electrical */}
                <div
                  onClick={() => handleCategorySelect("Electrical")}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer relative ${
                    selectedCategory === "Electrical"
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Electrical</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Wiring, tripping MCBs, switchboards, fan & lighting installation.
                  </p>
                  {selectedCategory === "Electrical" && (
                    <div className="absolute top-4 right-4 text-blue-600">✓</div>
                  )}
                </div>

                {/* AC (Distinct Specialization) */}
                <div
                  onClick={() => handleCategorySelect("AC")}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer relative ${
                    selectedCategory === "AC"
                      ? "border-cyan-600 bg-cyan-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                    <Snowflake className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-900 text-sm">Air Conditioning</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
                      EPA Certified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Inverter AC, chemical deep wash, R32 gas charging, compressor diagnostics.
                  </p>
                  {selectedCategory === "AC" && (
                    <div className="absolute top-4 right-4 text-cyan-600">✓</div>
                  )}
                </div>

                {/* Plumbing */}
                <div
                  onClick={() => handleCategorySelect("Plumbing")}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer relative ${
                    selectedCategory === "Plumbing"
                      ? "border-amber-600 bg-amber-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Plumbing</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Concealed leak repair, tap mixers, choked drainage jetting, water pumps.
                  </p>
                  {selectedCategory === "Plumbing" && (
                    <div className="absolute top-4 right-4 text-amber-600">✓</div>
                  )}
                </div>
              </div>

              {/* Specific Services in Category */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Specific Service ({selectedCategory})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services
                    .filter((s) => s.category === selectedCategory)
                    .map((s) => (
                      <div
                        key={s.serviceId}
                        onClick={() => setSelectedServiceId(s.serviceId)}
                        className={`p-4 rounded-xl border text-xs transition cursor-pointer flex items-start justify-between gap-3 ${
                          selectedServiceId === s.serviceId
                            ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-100"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{s.serviceName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{s.description}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Est: ~{s.estimatedDurationMinutes} mins &bull; Indicative: ${s.indicativePrice}
                          </div>
                        </div>
                        {selectedServiceId === s.serviceId && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                >
                  Continue to Details <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Job Information, Customer Info & Location */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Step 2: Enter Job & Contact Information</h2>
                <p className="text-xs text-slate-500 mt-1">
                  No login required. We will send an SMS confirmation and assign the closest certified specialist.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Contact Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Required for Tracking) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91-98801-XXXXX"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Problem Description *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Explain symptoms, e.g. Split AC blowing warm air and humming noise..."
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Additional Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Gate code #402, call when 5 mins away"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Right: Location & Appointment Window */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Service Zone</label>
                    <select
                      value={selectedZoneKey}
                      onChange={(e) => handleZoneSelect(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 font-semibold"
                    >
                      {Object.entries(METRO_NODES).map(([k, node]: [string, any]) => (
                        <option key={k} value={k}>
                          {node.locality} ({node.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Service Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="House No, Apartment, Street"
                      value={serviceAddress}
                      onChange={(e) => setServiceAddress(e.target.value)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value))}
                        className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value))}
                        className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={preferredStartTime}
                        onChange={(e) => setPreferredStartTime(e.target.value)}
                        className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={preferredEndTime}
                        onChange={(e) => setPreferredEndTime(e.target.value)}
                        className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Requested Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority (Urgent)</option>
                      <option value="EMERGENCY">Emergency (Pipe burst, sparking hazards - subject to triage)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Back to Service Selection
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                >
                  Review Booking <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Submit Booking */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Step 3: Review Your Booking</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Once submitted, the DispatchGrid scheduling engine immediately evaluates all certified technicians to find your match.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Service</span>
                    <span className="text-sm font-bold text-slate-900">{selectedService?.serviceName}</span>
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {selectedCategory}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Indicative Price</span>
                    <span className="text-sm font-bold text-slate-900">${selectedService?.indicativePrice}</span>
                    <span className="text-slate-500 text-[11px] ml-1">(&plusmn; parts)</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Contact</span>
                    <span className="font-semibold text-slate-800">{customerName}</span>
                    <span className="text-slate-500 block">{customerPhone}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Appointment Window</span>
                    <span className="font-semibold text-slate-800">
                      {preferredDate} ({preferredStartTime} - {preferredEndTime})
                    </span>
                    <span className="text-slate-500 block">Priority: {priority}</span>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Service Address</span>
                    <span className="font-semibold text-slate-800">{serviceAddress}</span>
                    <span className="text-slate-400 text-[10px] block font-mono">GPS: ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Problem Summary</span>
                    <p className="text-slate-700 italic">"{problemDescription}"</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Back to Edit Details
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitBooking}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "Triggering Auto-Scheduler..."
                  ) : (
                    <>
                      Confirm & Trigger Auto-Allotment <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation & Automatic Allotment Result */}
          {step === 4 && bookingConfirmation && (
            <div className="space-y-6 text-center max-w-xl mx-auto py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold shadow-md shadow-emerald-500/10">
                ✓
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Booking Saved & Auto-Scheduled
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                  Booking #{bookingConfirmation.bookingReference}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Keep this booking reference and your phone number to track technician arrival anytime.
                </p>
              </div>

              {bookingConfirmation.allocation && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Scheduling Engine Status
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        bookingConfirmation.allocation.success
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {bookingConfirmation.status}
                    </span>
                  </div>

                  {bookingConfirmation.allocation.success ? (
                    <div className="space-y-1.5">
                      <div className="text-slate-900 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Offer sent to: {bookingConfirmation.allocation.assignedTechnicianName}
                      </div>
                      <div className="text-slate-600">
                        Estimated Dijkstra Travel Time: <strong>{bookingConfirmation.allocation.estimatedTravelMinutes} mins</strong>
                      </div>
                      <div className="text-slate-500 text-[11px] italic">
                        Selection reason: {bookingConfirmation.allocation.selectionReason}
                      </div>
                    </div>
                  ) : (
                    <div className="text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <strong>Notice:</strong> {bookingConfirmation.allocation.selectionReason}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setTrackRef(bookingConfirmation.bookingReference);
                    setTrackPhone(customerPhone);
                    setActiveTab("track");
                    // Trigger tracking
                    setTimeout(() => {
                      document.getElementById("track-search-btn")?.click();
                    }, 100);
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" /> Track Arrival in Real Time
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setBookingConfirmation(null);
                    setProblemDescription("");
                  }}
                  className="w-full sm:w-auto px-5 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Book Another Service
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TRACK MY BOOKING */}
      {activeTab === "track" && (
        <div className="space-y-6">
          {/* Tracking Search Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Track Service Appointment</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your Booking ID or Reference (e.g., <code>DG-2026-101</code>) and the phone number used at booking to access live status and technician ETA.
              </p>
            </div>

            <form onSubmit={handleTrackSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Booking Reference / ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DG-2026-901 or BK_101"
                  value={trackRef}
                  onChange={(e) => setTrackRef(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 font-mono text-slate-900 uppercase"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Registered Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91-98801-XXXXX"
                  value={trackPhone}
                  onChange={(e) => setTrackPhone(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-3 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  id="track-search-btn"
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSearching ? "Searching..." : "Track"}
                </button>
              </div>
            </form>

            {trackError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>{trackError}</span>
              </div>
            )}
          </div>

          {/* Tracking Result View */}
          {trackedBooking && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Status Card & Technician Details */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {trackedBooking.bookingReference}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        trackedBooking.bookingStatus === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : trackedBooking.bookingStatus === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800 animate-pulse"
                          : trackedBooking.bookingStatus === "ON_THE_WAY"
                          ? "bg-blue-100 text-blue-800 animate-pulse"
                          : trackedBooking.bookingStatus === "ASSIGNED"
                          ? "bg-indigo-100 text-indigo-800"
                          : trackedBooking.bookingStatus === "UNASSIGNED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {trackedBooking.bookingStatus}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">{trackedBooking.serviceName}</h3>
                    <p className="text-xs text-slate-600 mt-1">{trackedBooking.problemDescription}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Date: <strong>{trackedBooking.preferredDate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Window: <strong>{trackedBooking.preferredStartTime} - {trackedBooking.preferredEndTime}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{trackedBooking.serviceAddress}</span>
                    </div>
                  </div>

                  {/* Unassigned Explanation if any */}
                  {trackedBooking.unassignedReason && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Allocation Notice:
                      </div>
                      <p>{trackedBooking.unassignedReason}</p>
                    </div>
                  )}

                  {/* Assigned Technician Profile */}
                  {trackedBooking.technicianName ? (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-2xl border border-blue-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                          Assigned Specialist
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Confirmed
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-blue-500/20">
                          {trackedBooking.technicianName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">
                            {trackedBooking.technicianName}
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{trackedBooking.technicianRating || 4.9}</span>
                            <span>&bull;</span>
                            <span>{trackedBooking.technicianCompletedJobs || 120} jobs</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-200/60 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Dijkstra Road Distance</span>
                          <span className="font-bold text-slate-900">{trackedBooking.distanceKm} km</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Estimated Travel Time</span>
                          <span className="font-bold text-emerald-700">{trackedBooking.travelMinutes} mins</span>
                        </div>
                      </div>

                      {trackedBooking.estimatedArrivalTime && (
                        <div className="bg-white p-2.5 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">Estimated Arrival</span>
                          <span className="font-extrabold text-blue-700">{trackedBooking.estimatedArrivalTime}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
                      Our intelligent scheduler is actively matching an available certified technician in your zone.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Map Tracking with Simulated Route */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Live Arrival Route Map
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      (Simulated Live GPS)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Calculated via Metro Dijkstra Road Network
                  </span>
                </div>

                <DispatchMap
                  bookings={[
                    {
                      bookingId: trackedBooking.bookingId,
                      bookingReference: trackedBooking.bookingReference,
                      serviceId: trackedBooking.serviceId || "SRV_DEFAULT",
                      serviceAddress: trackedBooking.serviceAddress,
                      serviceName: trackedBooking.serviceName,
                      latitude: trackedBooking.customerLat,
                      longitude: trackedBooking.customerLng,
                      category: trackedBooking.category,
                      bookingStatus: trackedBooking.bookingStatus,
                      assignedTechnicianId: trackedBooking.technicianId,
                      assignedTechnicianName: trackedBooking.technicianName,
                      estimatedTravelTimeMinutes: trackedBooking.travelMinutes,
                      preferredDate: trackedBooking.preferredDate,
                      preferredStartTime: trackedBooking.preferredStartTime,
                      preferredEndTime: trackedBooking.preferredEndTime,
                      requestedPriority: trackedBooking.requestedPriority,
                      verifiedPriority: trackedBooking.verifiedPriority,
                      problemDescription: trackedBooking.problemDescription,
                      nodeId: trackedBooking.nodeId,
                      createdAt: trackedBooking.createdAt,
                    },
                  ]}
                  technicians={
                    trackedBooking.techLat && trackedBooking.techLng
                      ? [
                          {
                            userId: trackedBooking.technicianId || "TECH",
                            fullName: trackedBooking.technicianName || "Assigned Specialist",
                            email: "technician@dispatchgrid.io",
                            phone: trackedBooking.technicianPhone || "+91-98801-00000",
                            accountStatus: "ACTIVE",
                            experienceYears: 8,
                            serviceCategories: [trackedBooking.category || "Electrical"],
                            verificationStatus: "APPROVED",
                            residentialAddress: "Bangalore",
                            city: "Bengaluru",
                            pincode: "560001",
                            currentLatitude: trackedBooking.techLat,
                            currentLongitude: trackedBooking.techLng,
                            serviceAreas: ["CBD / Central"],
                            availabilityStatus: "AVAILABLE",
                            workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                            shiftStartTime: "08:00",
                            shiftEndTime: "18:00",
                            reservedEmergencyCapacity: "11:00-11:30",
                            totalCompletedJobs: 140,
                            averageRating: trackedBooking.technicianRating || 4.9,
                            skills: [],
                            certifications: [],
                          },
                        ]
                      : []
                  }
                  selectedBooking={{
                    bookingId: trackedBooking.bookingId,
                    bookingReference: trackedBooking.bookingReference,
                    serviceId: trackedBooking.serviceId || "SRV_DEFAULT",
                    serviceAddress: trackedBooking.serviceAddress,
                    serviceName: trackedBooking.serviceName,
                    latitude: trackedBooking.customerLat,
                    longitude: trackedBooking.customerLng,
                    category: trackedBooking.category,
                    bookingStatus: trackedBooking.bookingStatus,
                    assignedTechnicianId: trackedBooking.technicianId,
                    assignedTechnicianName: trackedBooking.technicianName,
                    estimatedTravelTimeMinutes: trackedBooking.travelMinutes,
                    preferredDate: trackedBooking.preferredDate,
                    preferredStartTime: trackedBooking.preferredStartTime,
                    preferredEndTime: trackedBooking.preferredEndTime,
                    requestedPriority: trackedBooking.requestedPriority,
                    verifiedPriority: trackedBooking.verifiedPriority,
                    problemDescription: trackedBooking.problemDescription,
                    nodeId: trackedBooking.nodeId,
                    createdAt: trackedBooking.createdAt,
                  }}
                  height="480px"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
