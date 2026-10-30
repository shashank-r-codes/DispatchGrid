import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { Navbar } from "./components/Navbar";
import { CustomerPortal } from "./pages/CustomerPortal";
import { TechnicianPortal } from "./pages/TechnicianPortal";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DocumentationPage } from "./pages/DocumentationPage";
import { DisruptionRecoveryModal } from "./components/DisruptionRecoveryModal";
import { BenchmarkModal } from "./components/BenchmarkModal";
import { BookingWizardModal } from "./components/BookingWizardModal";
import { Booking, Technician } from "./types";

const MainAppContent: React.FC = () => {
  const { user, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<string>("admin-dashboard");

  // Global modals
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState<boolean>(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

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
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenBookingModal={() => setIsBookingModalOpen(true)}
        onOpenDisruptionModal={handleOpenDisruption}
        onOpenBenchmarkModal={() => setIsBenchmarkModalOpen(true)}
      />

      <main className="flex-1 pb-16">
        {isLoading ? (
          <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-500 font-medium">
            Initializing DispatchGrid session...
          </div>
        ) : (
          <>
            {/* 1. CUSTOMER EXPERIENCE (Part 1.B) */}
            {currentTab === "customer-portal" && (
              <CustomerPortal />
            )}

            {/* 2. TECHNICIAN EXPERIENCE (Part 1.C) */}
            {currentTab === "technician-portal" && (
              <TechnicianPortal />
            )}

            {/* 3. ADMIN / DISPATCHER EXPERIENCE (Part 1.A) */}
            {(currentTab === "admin-dashboard" || currentTab === "dashboard") && (
              <AdminDashboard />
            )}

            {/* 4. DOCUMENTATION VIEW */}
            {currentTab === "docs" && (
              <DocumentationPage />
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
          setCurrentTab("admin-dashboard");
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
