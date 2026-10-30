import React, { useState } from "react";
import {
  Grid,
  Shield,
  User,
  LogOut,
  Wrench,
  ArrowLeft,
  LogIn,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  Clock,
  Navigation,
  Calendar,
  CheckCircle2,
  Users,
  MapPin,
  Zap,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  customerSubTab?: string;
  onSelectCustomerSubTab?: (tab: string) => void;
  technicianSubTab?: string;
  onSelectTechnicianSubTab?: (tab: string) => void;
  adminSubTab?: string;
  onSelectAdminSubTab?: (tab: string) => void;
  onOpenBookingModal?: () => void;
  onOpenDisruptionModal?: () => void;
  onOpenBenchmarkModal?: () => void;
  onNavigateLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onBack,
  canGoBack,
  customerSubTab = "dashboard",
  onSelectCustomerSubTab,
  technicianSubTab = "dashboard",
  onSelectTechnicianSubTab,
  adminSubTab = "overview",
  onSelectAdminSubTab,
  onOpenBookingModal,
  onOpenDisruptionModal,
  onOpenBenchmarkModal,
  onNavigateLogin,
}) => {
  const { user, role, logout, notifications, markNotificationRead, markAllNotificationsRead } = useAuth();
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleBrandClick = () => {
    if (role === "ADMIN") {
      if (onSelectAdminSubTab) onSelectAdminSubTab("overview");
      onSelectTab("admin-dashboard");
    } else if (role === "TECHNICIAN") {
      if (onSelectTechnicianSubTab) onSelectTechnicianSubTab("dashboard");
      onSelectTab("technician-portal");
    } else {
      if (onSelectCustomerSubTab) onSelectCustomerSubTab("dashboard");
      onSelectTab("customer-portal");
    }
    setMobileMenuOpen(false);
  };

  // Customer Navigation Items (PART 2 Requirement)
  const customerNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "book", label: "Book a Service", icon: Wrench },
    { id: "history", label: "My Booking History", icon: Clock },
    { id: "track", label: "Track Booking", icon: Navigation },
    { id: "profile", label: "My Profile", icon: User },
  ];

  // Technician Navigation Items (PART 2 Requirement)
  const technicianNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "offers", label: "Job Offers", icon: Bell },
    { id: "schedule", label: "My Schedule", icon: Calendar },
    { id: "availability", label: "Availability", icon: Clock },
    { id: "history", label: "Job History", icon: CheckCircle2 },
    { id: "profile", label: "My Profile", icon: User },
  ];

  // Admin Navigation Items (PART 2 Requirement)
  const adminNavItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "bookings", label: "All Bookings", icon: Calendar },
    { id: "technicians", label: "Technicians", icon: Users },
    { id: "map", label: "Live Map", icon: MapPin },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "simulator", label: "Simulator", icon: Zap },
    { id: "benchmark", label: "Benchmark", icon: BarChart3 },
  ];

  // Technician availability status helper
  const techAvailability = user?.availabilityStatus || (user as any)?.availability_status || "AVAILABLE";
  const isTechAvailable = techAvailability === "AVAILABLE";
  const isTechBusy = techAvailability === "BUSY" || techAvailability === "ON_JOB";

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-[1500] shadow-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* LEFT: Back Button + Brand Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back to previous page"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700/80 shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {/* Brand Logo & Title */}
            <div
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              onClick={handleBrandClick}
            >
              <img
                src="/dispatchgrid-logo.png"
                alt="DispatchGrid Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-150 border border-blue-500/30"
              />
              <div>
                <div className="font-black text-sm tracking-tight flex items-center gap-1 leading-none">
                  DISPATCH<span className="text-blue-400">GRID</span>
                </div>
                <div className="text-[9px] text-slate-400 font-medium tracking-wider uppercase hidden sm:block mt-0.5">
                  Workforce Scheduling & Recovery
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Role-Specific Navigation (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
            {/* Customer Navigation */}
            {(!role || role === "CUSTOMER") &&
              customerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === "customer-portal" && customerSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectCustomerSubTab) onSelectCustomerSubTab(item.id);
                      if (currentTab !== "customer-portal") onSelectTab("customer-portal");
                    }}
                    className={`h-9 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-blue-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Technician Navigation */}
            {role === "TECHNICIAN" &&
              technicianNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === "technician-portal" && technicianSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectTechnicianSubTab) onSelectTechnicianSubTab(item.id);
                      if (currentTab !== "technician-portal") onSelectTab("technician-portal");
                    }}
                    className={`h-9 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 font-bold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-emerald-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Admin Navigation */}
            {role === "ADMIN" &&
              adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  (currentTab === "admin-dashboard" || currentTab === "dashboard") &&
                  adminSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectAdminSubTab) onSelectAdminSubTab(item.id);
                      if (currentTab !== "admin-dashboard") onSelectTab("admin-dashboard");
                    }}
                    className={`h-9 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30 font-bold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-purple-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>

          {/* RIGHT: Notifications, Profile / Status, Logout, Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {user ? (
              <>
                {/* Notification Bell Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/90 transition flex items-center justify-center relative cursor-pointer border border-slate-800"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center animate-bounce">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-blue-400" />
                          <span>Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-blue-600/30 text-blue-300 px-1.5 py-0.2 rounded text-[10px]">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllNotificationsRead}
                            className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">No notifications yet.</div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-800/50">
                          {notifications.slice(0, 15).map((n) => (
                            <div
                              key={n.notification_id}
                              onClick={() => !n.is_read && markNotificationRead(n.notification_id)}
                              className={`pt-2 first:pt-0 cursor-pointer p-2 rounded-xl transition ${
                                n.is_read ? "opacity-60 hover:bg-slate-800/40" : "bg-slate-800/70 hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className={`font-bold ${n.is_read ? "text-slate-300" : "text-white"}`}>
                                  {n.title}
                                </span>
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1"></span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                              <span className="text-[9px] text-slate-500 mt-1 block">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Profile Info & Status */}
                <div className="flex items-center gap-2 bg-slate-800/50 px-2 py-1 rounded-xl border border-slate-700/60">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt={user.fullName}
                      className="w-7 h-7 rounded-full object-cover border border-slate-600 shadow-sm"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 border border-slate-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                      {(user.fullName || user.username || "U").charAt(0)}
                    </div>
                  )}

                  <div className="hidden sm:flex flex-col text-xs leading-tight">
                    <span className="text-slate-100 font-bold truncate max-w-[110px]">
                      {user.fullName || user.username}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${
                          role === "ADMIN"
                            ? "text-purple-400"
                            : role === "TECHNICIAN"
                            ? "text-emerald-400"
                            : "text-blue-400"
                        }`}
                      >
                        {user.role}
                      </span>
                      {/* Technician Live Availability Indicator */}
                      {role === "TECHNICIAN" && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                            isTechAvailable
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : isTechBusy
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-slate-500/20 text-slate-300 border border-slate-500/40"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isTechAvailable
                                ? "bg-emerald-400 animate-pulse"
                                : isTechBusy
                                ? "bg-amber-400"
                                : "bg-slate-400"
                            }`}
                          />
                          {isTechAvailable ? "Available" : isTechBusy ? "Busy" : "Unavailable"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logout Button (Visually consistent with navbar) */}
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="h-9 px-3 rounded-xl border border-slate-700/80 bg-slate-800/40 hover:bg-rose-500/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={onNavigateLogin}
                className="h-9 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer shadow-blue-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition border border-slate-700/80 cursor-pointer"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* MOBILE RESPONSIVE COLLAPSIBLE DRAWER (< lg screens) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 py-3 px-1 animate-fadeIn space-y-1">
            {/* Customer mobile items */}
            {(!role || role === "CUSTOMER") &&
              customerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === "customer-portal" && customerSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectCustomerSubTab) onSelectCustomerSubTab(item.id);
                      if (currentTab !== "customer-portal") onSelectTab("customer-portal");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full h-10 px-3.5 rounded-xl transition flex items-center gap-2.5 text-xs font-semibold cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm font-bold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-blue-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Technician mobile items */}
            {role === "TECHNICIAN" &&
              technicianNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === "technician-portal" && technicianSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectTechnicianSubTab) onSelectTechnicianSubTab(item.id);
                      if (currentTab !== "technician-portal") onSelectTab("technician-portal");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full h-10 px-3.5 rounded-xl transition flex items-center gap-2.5 text-xs font-semibold cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm font-bold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-emerald-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Admin mobile items */}
            {role === "ADMIN" &&
              adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  (currentTab === "admin-dashboard" || currentTab === "dashboard") &&
                  adminSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectAdminSubTab) onSelectAdminSubTab(item.id);
                      if (currentTab !== "admin-dashboard") onSelectTab("admin-dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full h-10 px-3.5 rounded-xl transition flex items-center gap-2.5 text-xs font-semibold cursor-pointer ${
                      isActive
                        ? "bg-purple-600 text-white shadow-sm font-bold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-purple-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Mobile user profile row */}
            {user && (
              <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-between px-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Signed in as</span>
                  <span className="text-white font-bold">{user.fullName || user.username}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
