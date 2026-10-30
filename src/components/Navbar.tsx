import React, { useState } from "react";
import { Grid, Shield, User, LogOut, Bell, Wrench, Zap, CheckCircle2, AlertTriangle, BookOpen, UserCheck, Compass } from "lucide-react";
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab("admin-dashboard")}>
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

          {/* 3 Core Experience Navigation Items (Part 1 Requirements) */}
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
            {/* Customer Portal */}
            <button
              onClick={() => onSelectTab("customer-portal")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                currentTab === "customer-portal"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Customer Portal</span>
            </button>

            {/* Technician Portal */}
            <button
              onClick={() => onSelectTab("technician-portal")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                currentTab === "technician-portal"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Technician Portal</span>
            </button>

            {/* Admin / Dispatcher Dashboard */}
            <button
              onClick={() => onSelectTab("admin-dashboard")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                currentTab === "admin-dashboard" || currentTab === "dashboard"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>Admin / Dispatcher</span>
            </button>

            <button
              onClick={() => onSelectTab("docs")}
              className={`hidden lg:flex px-3 py-1.5 rounded-xl transition items-center gap-1 cursor-pointer ${
                currentTab === "docs"
                  ? "bg-slate-800 text-blue-400"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>System Docs</span>
            </button>
          </nav>

          {/* Role Status & Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-slate-300 font-medium">{user.fullName || user.username}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">
                  {user.role}
                </span>
              </div>
            )}

            {user && (
              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
