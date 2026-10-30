import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { Navbar } from "./components/Navbar";
import { LoginPage, RoleChoice } from "./pages/LoginPage";
import { CustomerPortal } from "./pages/CustomerPortal";
import { TechnicianPortal } from "./pages/TechnicianPortal";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DisruptionRecoveryModal } from "./components/DisruptionRecoveryModal";
import { BenchmarkModal } from "./components/BenchmarkModal";
import { BookingWizardModal } from "./components/BookingWizardModal";
import { Booking, Technician } from "./types";

const MainAppContent: React.FC = () => {
  const { user, role, isLoading } = useAuth();
  const { showToast } = useToast();

  // Active view: "login" | "customer-portal" | "technician-portal" | "admin-dashboard"
  const [currentTab, setCurrentTab] = useState<string>("login");
  const [customerSubTab, setCustomerSubTab] = useState<string>("dashboard");
  const [technicianSubTab, setTechnicianSubTab] = useState<string>("dashboard");
  const [adminSubTab, setAdminSubTab] = useState<string>("overview");
  interface NavHistoryItem {
    tab: string;
    customerSubTab?: string;
    technicianSubTab?: string;
    adminSubTab?: string;
  }
  const [historyStack, setHistoryStack] = useState<NavHistoryItem[]>([]);

  // Global modals
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState<boolean>(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("dg_theme") as "dark" | "light") || "light";
  });

  useEffect(() => {
    localStorage.setItem("dg_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };


  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Synchronize dashboard based on authentication state
  useEffect(() => {
    if (!isLoading) {
      if (user && role) {
        // Authenticated user arriving or switching
        if (currentTab === "login") {
          if (role === "ADMIN") setCurrentTab("admin-dashboard");
          else if (role === "TECHNICIAN") setCurrentTab("technician-portal");
          else setCurrentTab("customer-portal");
        }
      } else {
        // Unauthenticated user
        if (currentTab !== "customer-portal") {
          setCurrentTab("login");
        }
      }
    }
  }, [user, role, isLoading]);

  const navigateTo = (
    newTab: string,
    subTabChange?: { customer?: string; technician?: string; admin?: string }
  ) => {
    const nextCustomerSub = subTabChange?.customer || customerSubTab;
    const nextTechSub = subTabChange?.technician || technicianSubTab;
    const nextAdminSub = subTabChange?.admin || adminSubTab;

    if (
      newTab === currentTab &&
      nextCustomerSub === customerSubTab &&
      nextTechSub === technicianSubTab &&
      nextAdminSub === adminSubTab
    ) {
      return;
    }

    setHistoryStack((prev) => [
      ...prev,
      {
        tab: currentTab,
        customerSubTab,
        technicianSubTab,
        adminSubTab,
      },
    ]);

    setCurrentTab(newTab);
    if (subTabChange?.customer) setCustomerSubTab(subTabChange.customer);
    if (subTabChange?.technician) setTechnicianSubTab(subTabChange.technician);
    if (subTabChange?.admin) setAdminSubTab(subTabChange.admin);
  };

  // Consistent Back button behavior across desktop and mobile
  const handleBack = () => {
    if (historyStack.length > 0) {
      const nextHistory = [...historyStack];
      let prev = nextHistory.pop()!;
      // Do not send authenticated users back to login screen
      if (user && prev.tab === "login") {
        if (role === "ADMIN") prev = { tab: "admin-dashboard", adminSubTab: "overview" };
        else if (role === "TECHNICIAN") prev = { tab: "technician-portal", technicianSubTab: "dashboard" };
        else prev = { tab: "customer-portal", customerSubTab: "dashboard" };
      }
      setHistoryStack(nextHistory);
      setCurrentTab(prev.tab);
      if (prev.customerSubTab) setCustomerSubTab(prev.customerSubTab);
      if (prev.technicianSubTab) setTechnicianSubTab(prev.technicianSubTab);
      if (prev.adminSubTab) setAdminSubTab(prev.adminSubTab);
    } else {
      // Fallback to role-specific home dashboard
      if (role === "ADMIN") {
        setCurrentTab("admin-dashboard");
        setAdminSubTab("overview");
      } else if (role === "TECHNICIAN") {
        setCurrentTab("technician-portal");
        setTechnicianSubTab("dashboard");
      } else if (role === "CUSTOMER") {
        setCurrentTab("customer-portal");
        setCustomerSubTab("dashboard");
      } else {
        setCurrentTab("login");
      }
    }
  };

  const handleLoginSuccess = (selectedRole: RoleChoice) => {
    setHistoryStack([]);
    if (selectedRole === "ADMIN") {
      setCurrentTab("admin-dashboard");
    } else if (selectedRole === "TECHNICIAN") {
      setCurrentTab("technician-portal");
    } else {
      setCurrentTab("customer-portal");
    }
    showToast(`Welcome! Signed in as ${selectedRole.toLowerCase()}.`, "success");
  };

  const loadBaseData = async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/bookings", {
          headers: { Authorization: `Bearer ${localStorage.getItem("dg_token")}` },
        }),
        fetch("/api/technicians"),
      ]);
      if (bRes.ok) {
        const b = await bRes.json();
        setBookings(b.bookings || []);
      }
      if (tRes.ok) {
        const t = await tRes.json();
        setTechnicians(t.technicians || []);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenDisruption = async () => {
    await loadBaseData();
    setIsDisruptionModalOpen(true);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200 ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-100/70 text-slate-900"}`}>
      {/* Top Navigation Bar with Back Button */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={navigateTo}
        onBack={currentTab !== "login" ? handleBack : undefined}
        canGoBack={historyStack.length > 0}
        customerSubTab={customerSubTab}
        onSelectCustomerSubTab={(tab) => {
          navigateTo("customer-portal", { customer: tab });
        }}
        technicianSubTab={technicianSubTab}
        onSelectTechnicianSubTab={(tab) => {
          navigateTo("technician-portal", { technician: tab });
        }}
        adminSubTab={adminSubTab}
        onSelectAdminSubTab={(tab) => {
          navigateTo("admin-dashboard", { admin: tab });
        }}
        onOpenBookingModal={() => setIsBookingModalOpen(true)}
        onOpenDisruptionModal={handleOpenDisruption}
        onOpenBenchmarkModal={() => setIsBenchmarkModalOpen(true)}
        onNavigateLogin={() => navigateTo("login")}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 pb-16">
        {isLoading ? (
          <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-500 font-medium">
            Initializing DispatchGrid session...
          </div>
        ) : (
          <>
            {/* 0. ONE COMMON LOGIN PAGE (Part 1 Requirement) */}
            {currentTab === "login" && !user && (
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onContinueAsGuest={() => navigateTo("customer-portal")}
              />
            )}

            {/* 1. CUSTOMER EXPERIENCE (Part 1.B) */}
            {currentTab === "customer-portal" && (
              <CustomerPortal
                onBack={handleBack}
                onNavigateLogin={() => navigateTo("login")}
                activeSubTab={customerSubTab}
                onSubTabChange={(tab) => navigateTo("customer-portal", { customer: tab })}
              />
            )}

            {/* 2. TECHNICIAN EXPERIENCE (Part 1.C) */}
            {currentTab === "technician-portal" && (
              <TechnicianPortal
                onBack={handleBack}
                activeSubTab={technicianSubTab}
                onSubTabChange={(tab) => setTechnicianSubTab(tab)}
              />
            )}

            {/* 3. ADMIN / DISPATCHER EXPERIENCE (Part 1.A) */}
            {(currentTab === "admin-dashboard" || currentTab === "dashboard") && (
              <AdminDashboard
                onBack={handleBack}
                activeSubTab={adminSubTab}
                onSubTabChange={(tab) => setAdminSubTab(tab)}
              />
            )}
          </>
        )}
      </main>

      {/* Global Modals */}
      <BookingWizardModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={(ref) => {
          showToast(`Booking ${ref} confirmed! Schedule optimizer will match eligible technicians.`, "success");
          navigateTo("admin-dashboard");
        }}
      />

      <DisruptionRecoveryModal
        isOpen={isDisruptionModalOpen}
        technicians={technicians}
        bookings={bookings}
        onClose={() => setIsDisruptionModalOpen(false)}
        onRecoveryComplete={() => {
          // data refreshed
        }}
      />

      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-semibold text-slate-700">
            DispatchGrid &copy; {new Date().getFullYear()} &bull; Intelligent Workforce Scheduling & Recovery Platform
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Dijkstra Shortest Road Path</span>
            <span>&bull;</span>
            <span>Google OR-Tools CP-SAT</span>
            <span>&bull;</span>
            <span>Dynamic Recovery Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}