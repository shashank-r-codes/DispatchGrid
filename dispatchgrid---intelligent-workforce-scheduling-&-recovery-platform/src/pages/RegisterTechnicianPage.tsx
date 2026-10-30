import React, { useState, useEffect } from "react";
import { Wrench, Shield, CheckCircle2, ArrowRight, ArrowLeft, Award, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface RegisterTechnicianPageProps {
  onNavigateLogin: () => void;
  onSuccess: () => void;
}

export const RegisterTechnicianPage: React.FC<RegisterTechnicianPageProps> = ({ onNavigateLogin, onSuccess }) => {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("+1-555-018-4491");
  const [password, setPassword] = useState<string>("tech123");
  const [experienceYears, setExperienceYears] = useState<number>(4);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["AC"]);
  const [residentialAddress, setResidentialAddress] = useState<string>("14 Indiranagar 100ft Road");
  const [city, setCity] = useState<string>("Bengaluru");
  const [pincode, setPincode] = useState<string>("560038");

  // Certifications
  const [certName, setCertName] = useState<string>("EPA Section 608 Universal Certification");
  const [certAuthority, setCertAuthority] = useState<string>("Environmental Protection Agency");
  const [certNumber, setCertNumber] = useState<string>("EPA-608-APP-" + Math.floor(1000 + Math.random() * 9000));

  const [shiftStart, setShiftStart] = useState<string>("08:00");
  const [shiftEnd, setShiftEnd] = useState<string>("18:00");

  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => {
        setAvailableSkills(data.allSkills || []);
        if (data.allSkills?.length) {
          // Preselect relevant skills for AC
          const acSkillIds = data.allSkills.filter((s: any) => s.category === "AC").map((s: any) => s.skill_id);
          setSelectedSkillIds(acSkillIds);
        }
      });
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      showToast("Please select at least one service category", "error");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register-technician", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          experienceYears,
          serviceCategories: selectedCategories,
          residentialAddress,
          city,
          pincode,
          latitude: 12.9840,
          longitude: 77.6632,
          serviceAreas: ["Indiranagar / East", "CBD / Central", "Koramangala"],
          selectedSkillIds,
          certifications: certName ? [{ name: certName, authority: certAuthority, certNumber }] : [],
          workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          shiftStartTime: shiftStart,
          shiftEndTime: shiftEnd,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          "Technician application submitted! Account status: PENDING. Administrator audit required.",
          "success"
        );
        onNavigateLogin();
      } else {
        showToast(data.error || "Technician registration failed", "error");
      }
    } catch {
      showToast("Error submitting application", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-slate-900 text-white items-center justify-center shadow-lg">
            <Wrench className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Technician Verification Application
          </h2>
          <p className="text-xs text-slate-500">
            Submit your professional qualifications, trade skills, and certifications for administrator audit.
          </p>
        </div>

        {/* Category Specialization Rule Callout */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            Important Organisational Specialization Rule
          </div>
          <p>
            AC is an organisational specialisation under the Electrical department, but requires distinct skills and certifications (e.g. EPA 608 Universal, R32 handling). A general electrician does not qualify for AC repair assignments.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 text-xs">
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Vikram Singh"
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vikram.ac@dispatchgrid.io"
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Years Experience</label>
              <input
                type="number"
                min={1}
                max={40}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
          </div>

          {/* Department Categories */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Service Specialization Categories *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "Electrical", label: "⚡ Electrical" },
                { id: "AC", label: "❄️ AC & HVAC Specialist" },
                { id: "Plumbing", label: "🔧 Master Plumbing" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`p-3 rounded-xl border text-center font-bold transition ${
                    selectedCategories.includes(cat.id)
                      ? "border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-200"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Professional Certification */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" /> Professional Certification Details
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Certification Name</label>
                <input
                  type="text"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  className="w-full rounded-lg border-slate-200 bg-white p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuing Authority</label>
                <input
                  type="text"
                  value={certAuthority}
                  onChange={(e) => setCertAuthority(e.target.value)}
                  className="w-full rounded-lg border-slate-200 bg-white p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">License / Cert ID</label>
                <input
                  type="text"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  className="w-full rounded-lg border-slate-200 bg-white p-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Skills Checklist */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
              Verified Technical Skills Checklist
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableSkills
                .filter((s) => selectedCategories.includes(s.category))
                .map((s) => (
                  <button
                    key={s.skill_id}
                    type="button"
                    onClick={() => toggleSkill(s.skill_id)}
                    className={`p-2 rounded-lg border text-left transition flex items-center gap-2 ${
                      selectedSkillIds.includes(s.skill_id)
                        ? "border-blue-600 bg-blue-50 text-blue-900 font-bold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 font-normal"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                        selectedSkillIds.includes(s.skill_id)
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "border-slate-300"
                      }`}
                    >
                      {selectedSkillIds.includes(s.skill_id) && "✓"}
                    </span>
                    <span className="truncate">{s.skill_name}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Shift Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift End Time</label>
              <input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
          >
            Submit Application for Administrator Verification <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center">
          <button onClick={onNavigateLogin} className="text-xs text-slate-500 hover:text-slate-800 font-semibold">
            Already verified? Sign in &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
