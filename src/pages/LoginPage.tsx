import { RealisticDispatchConsole } from "../components/RealisticDispatchConsole";
import React, { useState } from "react";
import { Grid, Shield, User, Wrench, Lock, Mail, ArrowRight, AlertCircle, Sparkles, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type RoleChoice = "CUSTOMER" | "ADMIN" | "TECHNICIAN";

interface LoginPageProps {
  onLoginSuccess: (role: RoleChoice) => void;
  onContinueAsGuest?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
}) => {
  const { login, isLoading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleChoice>("ADMIN");
  const [email, setEmail] = useState<string>("admin@dispatchgrid.demo");
  const [password, setPassword] = useState<string>("admin123");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showTechPicker, setShowTechPicker] = useState<boolean>(false);

  // Pre-fill appropriate default demo credentials when switching role tab
  const handleRoleChange = (newRole: RoleChoice) => {
    setSelectedRole(newRole);
    setErrorMessage("");
    if (newRole === "ADMIN") {
      setEmail("admin@dispatchgrid.demo");
      setPassword("admin123");
    } else if (newRole === "CUSTOMER") {
      setEmail("customer@dispatchgrid.demo");
      setPassword("12345");
    } else if (newRole === "TECHNICIAN") {
      setEmail("electrician1@dispatchgrid.demo");
      setPassword("12345");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password, selectedRole);
      if (result.success) {
        onLoginSuccess(selectedRole);
      } else {
        setErrorMessage(result.error || "Login failed. Please check your credentials.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demo technician roster (all 20)
  const DEMO_TECHNICIANS = [
    { id: 1, email: "electrician1@dispatchgrid.demo", name: "Rajesh Kumar", category: "Electrical" },
    { id: 2, email: "electrician2@dispatchgrid.demo", name: "Amit Patel", category: "AC" },
    { id: 3, email: "electrician3@dispatchgrid.demo", name: "Suresh Reddy", category: "Plumbing" },
    { id: 4, email: "electrician4@dispatchgrid.demo", name: "Vikram Rao", category: "Electrical & AC" },
    { id: 5, email: "electrician5@dispatchgrid.demo", name: "Priya Sharma", category: "Electrical" },
    { id: 6, email: "electrician6@dispatchgrid.demo", name: "Karan Malhotra", category: "AC" },
    { id: 7, email: "electrician7@dispatchgrid.demo", name: "Manoj Swaminathan", category: "Plumbing" },
    { id: 8, email: "electrician8@dispatchgrid.demo", name: "Deepak Joshi", category: "Electrical" },
    { id: 9, email: "electrician9@dispatchgrid.demo", name: "Sunil Grover", category: "AC" },
    { id: 10, email: "electrician10@dispatchgrid.demo", name: "Rohan Kulkarni", category: "Electrical & Plumbing" },
    { id: 11, email: "electrician11@dispatchgrid.demo", name: "Girish Nair", category: "Plumbing" },
    { id: 12, email: "electrician12@dispatchgrid.demo", name: "Farhan Siddiqui", category: "AC" },
    { id: 13, email: "electrician13@dispatchgrid.demo", name: "Naveen Prasad", category: "Electrical" },
    { id: 14, email: "electrician14@dispatchgrid.demo", name: "Anil Deshmukh", category: "AC" },
    { id: 15, email: "electrician15@dispatchgrid.demo", name: "Vikas Hegde", category: "Plumbing" },
    { id: 16, email: "electrician16@dispatchgrid.demo", name: "Prakash Chawla", category: "Electrical & AC" },
    { id: 17, email: "electrician17@dispatchgrid.demo", name: "Dinesh Bhatt", category: "Electrical" },
    { id: 18, email: "electrician18@dispatchgrid.demo", name: "Sanjay Singhal", category: "AC" },
    { id: 19, email: "electrician19@dispatchgrid.demo", name: "Harish Chandra", category: "Plumbing" },
    { id: 20, email: "electrician20@dispatchgrid.demo", name: "Raghav Menon", category: "All (Electrical, AC, Plumbing)" },
  ];

  return (
    <div className="min-h-[90vh] py-10 px-4 sm:px-6 relative overflow-hidden flex flex-col items-center justify-center font-['Outfit',sans-serif]">
      {/* Background Ambient Glow Lights */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-float-reverse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-blue-400/5 to-purple-400/5 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

      {/* 1. CENTERED BRAND HEADER WITH OFFICIAL LOGO */}
      <div className="text-center space-y-3 mb-8 max-w-2xl mx-auto w-full animate-slide-up">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/90 border border-slate-200/90 shadow-xs text-slate-700 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold tracking-tight">Autonomous Dispatch Engine</span>
          <span className="text-slate-300">•</span>
          <span className="text-blue-600 font-semibold font-mono text-[11px]">Dijkstra Routing Active</span>
        </div>

        {/* Centered Official Logo */}
        <div className="flex justify-center pt-1">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 rounded-3xl blur-lg opacity-60 group-hover:opacity-90 transition duration-500 animate-pulse-glow" />
            <img
              src="/dispatchgrid-logo.png"
              alt="DispatchGrid - Intelligent Scheduling & Recovery"
              className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border-2 border-white/50 ring-4 ring-blue-500/20 transform group-hover:scale-105 transition-all duration-300"
            />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-['Outfit']">
            DISPATCH<span className="text-blue-600">GRID</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest font-['Outfit']">
            Workforce Scheduling & Dynamic Recovery Platform
          </p>
        </div>
      </div>

      {/* 2. SIDE-BY-SIDE GRID: REALISTIC CONSOLE (LEFT) + CREDENTIALS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto w-full relative z-10 animate-slide-up">
        {/* Left Side: Realistic Interactive Dispatch Console */}
        <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
          <div className="w-full sticky top-24">
            <RealisticDispatchConsole role={selectedRole} isSubmitting={isSubmitting} />
          </div>
        </div>

        {/* Right Side: Common Login Card */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div className="bg-white/95 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-200/60 space-y-5 transition-all">
            {/* Role Selection (Mandatory Section) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide font-['Outfit']">
                Select your role:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleChange("CUSTOMER")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex flex-col items-center gap-1 border cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                    selectedRole === "CUSTOMER"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-[1.02]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Customer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange("ADMIN")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex flex-col items-center gap-1 border cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                    selectedRole === "ADMIN"
                      ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/30 scale-[1.02]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange("TECHNICIAN")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex flex-col items-center gap-1 border cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                    selectedRole === "TECHNICIAN"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/30 scale-[1.02]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  <span>Technician</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Main Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-['Outfit']">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      selectedRole === "ADMIN"
                        ? "admin@dispatchgrid.demo"
                        : selectedRole === "CUSTOMER"
                        ? "customer@dispatchgrid.demo"
                        : "electrician1@dispatchgrid.demo"
                    }
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-['Outfit']">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className={`w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 font-['Outfit'] ${
                  selectedRole === "ADMIN"
                    ? "bg-purple-600 hover:bg-purple-700 shadow-purple-600/30"
                    : selectedRole === "CUSTOMER"
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                }`}
              >
                {isSubmitting ? (
                  "Authenticating..."
                ) : (
                  <>
                    <span>Sign In as {selectedRole.charAt(0) + selectedRole.slice(1).toLowerCase()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Assistant */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-['Outfit']">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Demo Credentials
                </span>
                <span className="font-mono text-[10px] text-slate-500">Auto-Fill</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole("ADMIN");
                    setEmail("admin@dispatchgrid.demo");
                    setPassword("admin123");
                    setErrorMessage("");
                  }}
                  className="p-1.5 rounded-lg border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 font-semibold text-center transition cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole("CUSTOMER");
                    setEmail("customer@dispatchgrid.demo");
                    setPassword("12345");
                    setErrorMessage("");
                  }}
                  className="p-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900 font-semibold text-center transition cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole("TECHNICIAN");
                    setEmail("electrician1@dispatchgrid.demo");
                    setPassword("12345");
                    setErrorMessage("");
                  }}
                  className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-semibold text-center transition cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  Tech 1 (Elec)
                </button>
              </div>

              {/* Expandable 20 Technicians Picker */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTechPicker(!showTechPicker)}
                  className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-700 flex items-center justify-between px-1 cursor-pointer font-['Outfit'] font-semibold"
                >
                  <span>Select any of 20 Technicians...</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTechPicker ? "rotate-180" : ""}`} />
                </button>

                {showTechPicker && (
                  <div className="max-h-44 overflow-y-auto mt-1 p-1 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                    {DEMO_TECHNICIANS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedRole("TECHNICIAN");
                          setEmail(t.email);
                          setPassword("12345");
                          setShowTechPicker(false);
                          setErrorMessage("");
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-white flex items-center justify-between text-slate-700 hover:text-slate-900 cursor-pointer transition"
                      >
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{t.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guest Booking Option (Part 1.B: Customer books without login) */}
          {onContinueAsGuest && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="group text-xs font-bold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1.5 hover:underline cursor-pointer font-['Outfit']"
              >
                <span>Book a Service as Guest (No Login Required)</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};