import React, { useState } from "react";
import { Grid, Shield, User, Wrench, Lock, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface LoginPageProps {
  onNavigateRegisterCustomer: () => void;
  onNavigateRegisterTechnician: () => void;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateRegisterCustomer,
  onNavigateRegisterTechnician,
  onLoginSuccess,
}) => {
  const { login, switchRoleQuick, isLoading } = useAuth();
  const [email, setEmail] = useState<string>("admin@dispatchgrid.io");
  const [password, setPassword] = useState<string>("admin123");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      onLoginSuccess();
    }
  };

  const handleQuickDemo = async (role: "ADMIN" | "CUSTOMER" | "TECH_AC" | "TECH_ELEC") => {
    await switchRoleQuick(role);
    onLoginSuccess();
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-600 text-white items-center justify-center shadow-lg shadow-blue-500/20">
            <Grid className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sign in to DispatchGrid
          </h2>
          <p className="text-xs text-slate-500">
            Intelligent Workforce Scheduling & Dynamic Recovery Platform
          </p>
        </div>

        {/* Demo Fast Login Cards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            1-Click Demo Personas
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickDemo("ADMIN")}
              className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/70 text-purple-950 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Admin Dispatcher</div>
                <div className="text-[10px] text-purple-700">Alex Mercer</div>
              </div>
              <Shield className="w-4 h-4 text-purple-600" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("CUSTOMER")}
              className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-950 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Customer</div>
                <div className="text-[10px] text-blue-700">David Miller</div>
              </div>
              <User className="w-4 h-4 text-blue-600" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("TECH_AC")}
              className="p-2.5 rounded-xl border border-cyan-200 bg-cyan-50/70 hover:bg-cyan-100/70 text-cyan-950 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Amit (AC Tech)</div>
                <div className="text-[10px] text-cyan-700">Certified HVAC</div>
              </div>
              <Wrench className="w-4 h-4 text-cyan-600" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("TECH_ELEC")}
              className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Rajesh (Electrician)</div>
                <div className="text-[10px] text-emerald-700">Master Wireman</div>
              </div>
              <Wrench className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* Regular Login Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 pl-9 p-2.5 focus:bg-white focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 pl-9 p-2.5 focus:bg-white focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10"
          >
            Sign In with JWT Credentials <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Registration Links */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-2">
          <button
            type="button"
            onClick={onNavigateRegisterCustomer}
            className="hover:text-blue-600 font-semibold"
          >
            Register as Customer &rarr;
          </button>
          <button
            type="button"
            onClick={onNavigateRegisterTechnician}
            className="hover:text-blue-600 font-semibold"
          >
            Join as Technician &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
