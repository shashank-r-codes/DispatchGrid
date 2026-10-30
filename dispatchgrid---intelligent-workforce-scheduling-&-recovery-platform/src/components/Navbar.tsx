import React, { useState } from "react";
import { Grid, Shield, User, LogOut, Bell, Wrench, Zap, CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenBookingModal?: () => void;
  onOpenDisruptionModal?: () => void;
  onOpenBenchmarkModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenBookingModal,
  onOpenDisruptionModal,
  onOpenBenchmarkModal,
}) => {
  const { user, role, switchRoleQuick, logout } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState<boolean>(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-[1500] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab("dashboard")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Grid className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                DISPATCH<span className="text-blue-400">GRID</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                Intelligent Scheduling & Recovery
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => onSelectTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentTab === "dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              Dashboard
            </button>

            {role === "ADMIN" && (
              <>
                <button
                  onClick={() => onOpenDisruptionModal && onOpenDisruptionModal()}
                  className="px-3 py-1.5 rounded-lg text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-800/40 transition flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Disruption Simulator
                </button>
                <button
                  onClick={() => onOpenBenchmarkModal && onOpenBenchmarkModal()}
                  className="px-3 py-1.5 rounded-lg text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/40 border border-cyan-800/40 transition flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Benchmark Runner
                </button>
              </>
            )}

            {role === "CUSTOMER" && onOpenBookingModal && (
              <button
                onClick={onOpenBookingModal}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition font-bold flex items-center gap-1 shadow-sm"
              >
                + Book Service
              </button>
            )}

            <button
              onClick={() => onSelectTab("docs")}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                currentTab === "docs"
                  ? "bg-slate-800 text-blue-400"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Docs & Architecture
            </button>
          </nav>

          {/* Role Quick Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Demo Role Pill */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    role === "ADMIN"
                      ? "bg-purple-400"
                      : role === "TECHNICIAN"
                      ? "bg-emerald-400"
                      : "bg-blue-400"
                  }`}
                />
                <span className="text-slate-200">{user?.fullName || "Switch Persona"}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 rounded font-mono text-slate-400">
                  {role}
                </span>
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 text-xs z-[2000] animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Quick Persona Switcher (Demo)
                  </div>
                  <button
                    onClick={() => {
                      switchRoleQuick("ADMIN");
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-purple-300">Admin Dispatcher</div>
                      <div className="text-[10px] text-slate-400">Alex Mercer &bull; Full Control</div>
                    </div>
                    {role === "ADMIN" && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                  </button>
                  <button
                    onClick={() => {
                      switchRoleQuick("CUSTOMER");
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-blue-300">Customer</div>
                      <div className="text-[10px] text-slate-400">David Miller &bull; Koramangala</div>
                    </div>
                    {role === "CUSTOMER" && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                  </button>
                  <button
                    onClick={() => {
                      switchRoleQuick("TECH_AC");
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-cyan-300">Technician (Certified AC)</div>
                      <div className="text-[10px] text-slate-400">Amit Patel &bull; HVAC Master</div>
                    </div>
                    {user?.email === "amit.ac@dispatchgrid.io" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </button>
                  <button
                    onClick={() => {
                      switchRoleQuick("TECH_ELEC");
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-emerald-300">Technician (Electrician)</div>
                      <div className="text-[10px] text-slate-400">Rajesh Kumar &bull; No AC Cert</div>
                    </div>
                    {user?.email === "rajesh.elec@dispatchgrid.io" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
