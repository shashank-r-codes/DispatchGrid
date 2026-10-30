import React, { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Navigation,
  Star,
  Info,
  Camera,
  Upload,
  Trash2,
  Edit3,
  Save,
  X,
  Mail,
  Check,
  AlertCircle,
  Building,
  Loader2,
  LayoutDashboard,
  RefreshCw,
  FileText,
} from "lucide-react";
import { ServiceItem, ServiceCategory, PriorityLevel } from "../types";
import { DispatchMap } from "../components/DispatchMap";
import { METRO_NODES } from "../../backend/config/roadNetwork";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface CustomerPortalProps {
  onBack?: () => void;
  onNavigateLogin?: () => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onBack,
  onNavigateLogin,
  activeSubTab,
  onSubTabChange,
}) => {
  const { user, token, refreshUserProfile } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"dashboard" | "book" | "history" | "track" | "profile">(
    user ? "dashboard" : "book"
  );

  // Sync activeTab with Navbar selection
  useEffect(() => {
    if (activeSubTab && ["dashboard", "book", "history", "track", "profile"].includes(activeSubTab)) {
      setActiveTab(activeSubTab as any);
    }
  }, [activeSubTab]);

  const switchTab = (tab: "dashboard" | "book" | "history" | "track" | "profile") => {
    setActiveTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  // Recent Bookings (PART 1: Latest 5 for Customer Dashboard)
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState<boolean>(false);
  const [recentError, setRecentError] = useState<string>("");

  // Full History Bookings State (My Booking History)
  const [historyBookings, setHistoryBookings] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState<number>(0);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyFilter, setHistoryFilter] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Booking Details Modal
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);

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

  // Customer Profile State
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editFullName, setEditFullName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editAddressLine, setEditAddressLine] = useState<string>("");
  const [editCity, setEditCity] = useState<string>("Bengaluru");
  const [editState, setEditState] = useState<string>("Karnataka");
  const [editPincode, setEditPincode] = useState<string>("560001");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileBase64, setPhotoFileBase64] = useState<string | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState<boolean>(false);
  const [profileFormError, setProfileFormError] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Latest 5 Customer Bookings for Dashboard
  const fetchCustomerBookings = async () => {
    const curToken = token || localStorage.getItem("dg_token");
    if (!curToken) return;
    setIsLoadingRecent(true);
    try {
      const res = await fetch("/api/customers/my/bookings?limit=5", {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentBookings(data.bookings || []);
        setRecentError("");
      } else {
        setRecentError("Could not load recent bookings.");
      }
    } catch (err: any) {
      setRecentError(err.message || "Failed to fetch bookings.");
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // Fetch All History Bookings with Filters & Pagination
  const fetchHistoryBookings = async (
    page = historyPage,
    status = historyFilter,
    search = historySearch
  ) => {
    const curToken = token || localStorage.getItem("dg_token");
    if (!curToken) return;
    setIsLoadingHistory(true);
    try {
      let url = `/api/customers/my/bookings?page=${page}&limit=10`;
      if (status && status !== "ALL") {
        url += `&status=${encodeURIComponent(status)}`;
      }
      if (search && search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryBookings(data.bookings || []);
        setHistoryTotal(data.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load history bookings:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Periodic Auto-Refresh: Real-time status updates on acceptance/rejection/reallocation
  useEffect(() => {
    if (user && (activeTab === "dashboard" || activeTab === "history")) {
      if (activeTab === "dashboard") fetchCustomerBookings();
      if (activeTab === "history") fetchHistoryBookings(historyPage, historyFilter, historySearch);

      const interval = setInterval(() => {
        if (activeTab === "dashboard") fetchCustomerBookings();
        if (activeTab === "history") fetchHistoryBookings(historyPage, historyFilter, historySearch);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab, historyPage, historyFilter, historySearch]);

  // Status Indicator renderer (PART 1 Requirement: 8 explicit colors)
  const getStatusBadge = (b: any) => {
    let color = b.statusColor;
    let label = b.statusLabel;

    if (!color || !label) {
      if (b.bookingStatus === "CANCELLED") {
        color = "grey";
        label = "Cancelled";
      } else if (b.bookingStatus === "COMPLETED") {
        color = "green";
        label = "Completed";
      } else if (b.bookingStatus === "IN_PROGRESS" || b.bookingStatus === "ON_THE_WAY") {
        color = "cyan";
        label = "In Progress";
      } else if (b.bookingStatus === "UNASSIGNED") {
        color = "red";
        label = "Unassigned";
      } else if (["ASSIGNED", "SCHEDULED", "TECHNICIAN_ACCEPTED"].includes(b.bookingStatus)) {
        color = "blue";
        label = "Assigned";
      } else {
        const offers = b.offerHistory || [];
        const hasRejected = offers.some((o: any) => o.offerStatus === "REJECTED" || o.offerStatus === "EXPIRED");
        const hasActive = offers.some((o: any) => o.offerStatus === "OFFERED");
        if (hasRejected && hasActive) {
          color = "purple";
          label = "Reallocation in Progress";
        } else if (hasActive || b.bookingStatus === "OFFERED" || b.offerStatus === "OFFERED") {
          color = "yellow";
          label = "Awaiting Technician Acceptance";
        } else {
          color = "orange";
          label = "Pending";
        }
      }
    }

    const colorMap: Record<string, { bg: string; text: string; border: string; dot: string; pulse?: boolean }> = {
      orange: { bg: "bg-amber-500/10", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500" },
      yellow: { bg: "bg-yellow-500/10", text: "text-yellow-800", border: "border-yellow-400", dot: "bg-yellow-500" },
      purple: { bg: "bg-purple-500/10", text: "text-purple-800", border: "border-purple-300", dot: "bg-purple-500", pulse: true },
      blue: { bg: "bg-blue-500/10", text: "text-blue-800", border: "border-blue-300", dot: "bg-blue-500" },
      cyan: { bg: "bg-cyan-500/10", text: "text-cyan-800", border: "border-cyan-300", dot: "bg-cyan-500", pulse: true },
      green: { bg: "bg-emerald-500/10", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
      grey: { bg: "bg-slate-500/10", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-400" },
      red: { bg: "bg-rose-500/10", text: "text-rose-800", border: "border-rose-300", dot: "bg-rose-500" },
    };

    const style = colorMap[color] || colorMap.orange;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
        <span className={`w-2 h-2 rounded-full ${style.dot} ${style.pulse ? "animate-pulse" : ""}`} />
        <span>{label}</span>
      </span>
    );
  };

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.fullName || "");
      if (!customerPhone) setCustomerPhone(user.phone || "");
    }
  }, [user]);

  const fetchCustomerProfile = async () => {
    const curToken = token || localStorage.getItem("dg_token");
    if (!curToken) return;
    setIsLoadingProfile(true);
    try {
      const res = await fetch("/api/customers/profile", {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        const primaryAddr = data.addresses && data.addresses.length > 0 ? data.addresses[0] : null;
        setEditFullName(data.user?.fullName || "");
        setEditEmail(data.user?.email || "");
        setEditPhone(data.user?.phone || "");
        setEditAddressLine(primaryAddr?.address_line || "");
        setEditCity(primaryAddr?.city || "Bengaluru");
        setEditState(primaryAddr?.state || "Karnataka");
        setEditPincode(primaryAddr?.pincode || "560001");
        setPhotoPreview(data.user?.profilePictureUrl || null);
        setPhotoFileBase64(null);
        setIsPhotoRemoved(false);
      }
    } catch (err) {
      console.error("Error loading customer profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === "profile") {
      fetchCustomerProfile();
    }
  }, [user, activeTab]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileFormError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type.toLowerCase())) {
      setProfileFormError("Please upload a valid image file (JPG, PNG, or WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileFormError(`File size must be 5MB or less. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result as string;
      setPhotoPreview(base64Str);
      setPhotoFileBase64(base64Str);
      setIsPhotoRemoved(false);
    };
    reader.onerror = () => {
      setProfileFormError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFileBase64(null);
    setIsPhotoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileFormError("");
    if (profileData) {
      const primaryAddr = profileData.addresses && profileData.addresses.length > 0 ? profileData.addresses[0] : null;
      setEditFullName(profileData.user?.fullName || "");
      setEditEmail(profileData.user?.email || "");
      setEditPhone(profileData.user?.phone || "");
      setEditAddressLine(primaryAddr?.address_line || "");
      setEditCity(primaryAddr?.city || "Bengaluru");
      setEditState(primaryAddr?.state || "Karnataka");
      setEditPincode(primaryAddr?.pincode || "560001");
      setPhotoPreview(profileData.user?.profilePictureUrl || null);
      setPhotoFileBase64(null);
      setIsPhotoRemoved(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFormError("");

    if (!editFullName.trim()) {
      setProfileFormError("Full name is required.");
      return;
    }

    if (!editPhone.trim()) {
      setProfileFormError("Phone number is required.");
      return;
    }

    if (editEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editEmail.trim())) {
        setProfileFormError("Please enter a valid email address.");
        return;
      }
    }

    const curToken = token || localStorage.getItem("dg_token");
    if (!curToken) {
      setProfileFormError("You must be logged in to update your profile.");
      return;
    }

    setIsSavingProfile(true);
    try {
      let finalAvatarUrl: string | null | undefined = profileData?.user?.profilePictureUrl;

      // 1. If new photo selected, upload first
      if (photoFileBase64) {
        const uploadRes = await fetch("/api/upload/profile-photo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${curToken}`,
          },
          body: JSON.stringify({ image: photoFileBase64 }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload photo");
        }
        finalAvatarUrl = uploadData.url;
      } else if (isPhotoRemoved) {
        finalAvatarUrl = null;
      }

      // 2. Update profile
      const res = await fetch("/api/customers/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${curToken}`,
        },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          profilePictureUrl: finalAvatarUrl,
          addressLine: editAddressLine.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          pincode: editPincode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileFormError(data.error || "Failed to update profile.");
        return;
      }

      showToast("Customer profile updated successfully!", "success");
      await refreshUserProfile();
      await fetchCustomerProfile();
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileFormError(err.message || "Network error updating profile.");
      showToast(err.message || "Failed to save profile changes", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

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
        fetchCustomerBookings();
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
      </div>

      {/* VIEW 0: CUSTOMER DASHBOARD (PART 1 Core Requirement) */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Welcome & Overview Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white border border-slate-700/80 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Customer Operations Hub
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Real-Time Autonomous Dispatch</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome back, <span className="text-blue-400">{user?.fullName || "Valued Customer"}</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Book certified technicians, track live dispatch progress, and monitor automatic reallocation seamlessly.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => switchTab("book")}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Book a Service</span>
                </button>
                <button
                  onClick={() => switchTab("history")}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>View All History</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section: My Recent Service Requests (PART 1 Core Requirement) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    My Recent Service Requests
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Latest 5
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Your most recent service bookings with live status, technician details, and offer status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchCustomerBookings();
                    showToast("Refreshed recent service requests.", "info");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
                  title="Refresh bookings"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Content State: Loading / Unauthenticated / Empty / List */}
            {isLoadingRecent && recentBookings.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Loading your recent service requests...</span>
              </div>
            ) : !user ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">Sign in to view your service requests</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Sign in to track your service requests, view technician assignments, and access booking history.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={() => (onNavigateLogin ? onNavigateLogin() : switchTab("book"))}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => switchTab("book")}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Book as Guest
                  </button>
                </div>
              </div>
            ) : recentBookings.length === 0 ? (
              /* Empty State (Explicit requirement) */
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">No service requests yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No service requests yet. Book your first service with DispatchGrid.
                  </p>
                </div>
                <button
                  onClick={() => switchTab("book")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Book a Service</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bookings Card List */}
                {recentBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    onClick={() => setSelectedBookingForDetails(b)}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all bg-white cursor-pointer group space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Service Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                            b.category === "Electrical"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : b.category === "AC"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {b.category === "Electrical" ? (
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                          ) : b.category === "AC" ? (
                            <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                          ) : (
                            <Droplets className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{b.category}</span>
                        </span>

                        {/* Booking ID */}
                        <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          #{b.bookingReference || b.bookingId}
                        </span>

                        {/* Specific Service Requested */}
                        <span className="text-xs font-bold text-slate-800">
                          &bull; {b.serviceName}
                        </span>
                      </div>

                      {/* Status Indicator (8 distinct colors) */}
                      <div>{getStatusBadge(b)}</div>
                    </div>

                    {/* Booking Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      {/* Booking Date & Preferred Appointment */}
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Booking & Appointment
                        </div>
                        <div className="font-semibold text-slate-800">
                          {b.preferredDate} &bull; {b.preferredStartTime} - {b.preferredEndTime}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Booked on: {new Date(b.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>

                      {/* Assigned Technician */}
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3" /> Assigned Technician
                        </div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {b.assignedTechnicianName ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>{b.assignedTechnicianName}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Searching / Awaiting Acceptance</span>
                          )}
                        </div>
                        {b.assignedTechnicianRating && (
                          <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{Number(b.assignedTechnicianRating).toFixed(1)} rating</span>
                          </div>
                        )}
                      </div>

                      {/* Technician Offer Status */}
                      <div className="space-y-0.5 flex flex-col justify-between sm:items-end">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Technician Offer Status
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {b.offerStatus || "PENDING"}
                          </span>
                          <span className="text-blue-600 text-xs font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* View All History Link / Button (PART 1 Requirement) */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Showing latest {recentBookings.length} bookings. View your complete service history with status filters.
                  </span>
                  <button
                    onClick={() => switchTab("history")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <span>View All History</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    "Triggering Auto-Scheduler..."
                  ) : (
                    <>
                      Confirm Booking & Trigger Auto Allocation <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation & Automatic Allotment Result (Part 3 Requirements) */}
          {step === 4 && bookingConfirmation && (
            <div className="space-y-6 max-w-xl mx-auto py-2 animate-fadeIn">
              {bookingConfirmation.allocation && bookingConfirmation.allocation.success ? (
                /* POPUP 1: SUCCESSFUL AUTO-ALLOCATION */
                <div className="bg-white rounded-3xl border-2 border-emerald-500/80 shadow-2xl p-6 sm:p-8 space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>

                  <div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 tracking-wider uppercase">
                      BOOKING REQUEST SENT
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-2 font-mono tracking-tight">
                      {bookingConfirmation.bookingReference}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Your service request has been created and auto-dispatched to the top-scoring certified technician.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        Service
                      </span>
                      <span className="font-bold text-slate-900">
                        {selectedService?.serviceName || "Certified Maintenance"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        Assigned Technician
                      </span>
                      <span className="font-extrabold text-blue-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        {bookingConfirmation.allocation.assignedTechnicianName}
                        <span className="text-[10px] font-mono text-slate-500">
                          ({bookingConfirmation.allocation.assignedTechnicianId})
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        Status
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        Awaiting technician acceptance
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Dijkstra Travel ETA:</span>
                      <span className="font-bold text-slate-900">
                        ~{bookingConfirmation.allocation.estimatedTravelMinutes || bookingConfirmation.allocation.travelMinutes || 15} mins ({bookingConfirmation.allocation.distanceKm || 3.5} km)
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 italic bg-white p-2.5 rounded-xl border border-slate-200">
                      <strong>AI Match Logic:</strong> {bookingConfirmation.allocation.selectionReason}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackRef(bookingConfirmation.bookingReference);
                        setTrackPhone(customerPhone);
                        setActiveTab("track");
                        setTimeout(() => {
                          document.getElementById("track-search-btn")?.click();
                        }, 100);
                      }}
                      className="w-full sm:w-auto px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                    >
                      <Navigation className="w-4 h-4" /> Track My Booking
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setBookingConfirmation(null);
                        setProblemDescription("");
                      }}
                      className="w-full sm:w-auto px-5 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Book Another Service
                    </button>
                  </div>
                </div>
              ) : (
                /* POPUP 2: NO TECHNICIAN CURRENTLY AVAILABLE (NEVER FAKE TECHNICIAN) */
                <div className="bg-white rounded-3xl border-2 border-amber-500/80 shadow-2xl p-6 sm:p-8 space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  </div>

                  <div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 tracking-wider uppercase">
                      BOOKING QUEUED – NO TECHNICIAN AVAILABLE
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-2 font-mono tracking-tight">
                      {bookingConfirmation.bookingReference}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Your booking has been saved, but no certified technician could be immediately assigned.
                    </p>
                  </div>

                  <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 text-left text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">
                        Service Requested
                      </span>
                      <span className="font-bold text-slate-900">
                        {selectedService?.serviceName || "Certified Maintenance"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">
                        Assignment Status
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                        UNASSIGNED / QUEUED
                      </span>
                    </div>

                    <div className="text-slate-700 text-xs leading-relaxed">
                      <strong>Reason:</strong>{" "}
                      {bookingConfirmation.allocation?.selectionReason ||
                        "All certified specialists with matching category/skills are currently occupied or outside the operational travel perimeter for this slot."}
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1.5 text-[11px]">
                      <div className="font-bold text-slate-800">What happens next?</div>
                      <ul className="list-disc list-inside text-slate-600 space-y-1">
                        <li>Our autonomous recovery engine continuously polls for cancellations or completed early shifts.</li>
                        <li>A dispatcher has been alerted for manual review and emergency dispatch if needed.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackRef(bookingConfirmation.bookingReference);
                        setTrackPhone(customerPhone);
                        setActiveTab("track");
                      }}
                      className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Search className="w-4 h-4" /> Track Queue Status
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep(2);
                        setBookingConfirmation(null);
                      }}
                      className="w-full sm:w-auto px-5 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Select Different Time Window
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 1.5: MY BOOKING HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  My Booking History
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  View and manage all previous and active service requests with complete dispatch records.
                </p>
              </div>

              <button
                onClick={() => {
                  fetchHistoryBookings(historyPage, historyFilter, historySearch);
                  showToast("Refreshed booking history.", "info");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
                title="Refresh history"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Search Bar & Status Filters */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search by Booking ID, service name, or problem description..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                    fetchHistoryBookings(1, historyFilter, e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "ALL", label: "All Bookings" },
                  { id: "PENDING", label: "Pending" },
                  { id: "AWAITING_ACCEPTANCE", label: "Awaiting Acceptance" },
                  { id: "ASSIGNED", label: "Assigned" },
                  { id: "IN_PROGRESS", label: "In Progress" },
                  { id: "COMPLETED", label: "Completed" },
                  { id: "CANCELLED", label: "Cancelled" },
                  { id: "UNASSIGNED", label: "Unassigned" },
                ].map((flt) => {
                  const isSelected = historyFilter === flt.id;
                  return (
                    <button
                      key={flt.id}
                      onClick={() => {
                        setHistoryFilter(flt.id);
                        setHistoryPage(1);
                        fetchHistoryBookings(1, flt.id, historySearch);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {flt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* History Bookings Cards / Table */}
            {isLoadingHistory && historyBookings.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Loading your booking history...</span>
              </div>
            ) : !user ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-3">
                <User className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">Sign in to view your complete history</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your persistent booking history is secured to your customer account.
                </p>
                <button
                  onClick={() => (onNavigateLogin ? onNavigateLogin() : switchTab("book"))}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            ) : historyBookings.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-3">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No bookings found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {historySearch || historyFilter !== "ALL"
                    ? "No service requests match your search or filter criteria."
                    : "You haven't placed any service requests yet."}
                </p>
                <button
                  onClick={() => switchTab("book")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Wrench className="w-4 h-4" /> Book a Service
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {historyBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    onClick={() => setSelectedBookingForDetails(b)}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all bg-white cursor-pointer group space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Service Category */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                            b.category === "Electrical"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : b.category === "AC"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {b.category === "Electrical" ? (
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                          ) : b.category === "AC" ? (
                            <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                          ) : (
                            <Droplets className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{b.category}</span>
                        </span>

                        {/* Booking ID */}
                        <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          #{b.bookingReference || b.bookingId}
                        </span>

                        {/* Specific Service Name */}
                        <span className="text-xs font-bold text-slate-800">
                          &bull; {b.serviceName}
                        </span>
                      </div>

                      {/* Status Indicator */}
                      <div>{getStatusBadge(b)}</div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Preferred Schedule
                        </span>
                        <span className="font-semibold text-slate-800">
                          {b.preferredDate} &bull; {b.preferredStartTime} - {b.preferredEndTime}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Booked: {new Date(b.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Assigned Technician
                        </span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {b.assignedTechnicianName ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>{b.assignedTechnicianName}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Searching / Awaiting Acceptance</span>
                          )}
                        </span>
                        {b.completionDate && (
                          <span className="text-[10px] text-emerald-700 font-semibold block">
                            Completed: {new Date(b.completionDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col justify-between sm:items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Technician Offer Status
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {b.offerStatus || "PENDING"}
                          </span>
                          <span className="text-blue-600 text-xs font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                <div className="pt-4 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100">
                  <span>
                    Total: <strong className="text-slate-900">{historyTotal}</strong> bookings
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => {
                        const p = Math.max(1, historyPage - 1);
                        setHistoryPage(p);
                        fetchHistoryBookings(p, historyFilter, historySearch);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer font-semibold"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-slate-700 font-bold">
                      Page {historyPage} of {Math.ceil(historyTotal / 10) || 1}
                    </span>
                    <button
                      disabled={historyPage >= Math.ceil(historyTotal / 10)}
                      onClick={() => {
                        const p = historyPage + 1;
                        setHistoryPage(p);
                        fetchHistoryBookings(p, historyFilter, historySearch);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer font-semibold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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

                  {/* Latest Notification Alert (Section 4 & 5 Requirement) */}
                  {trackedBooking.latestNotification && (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-blue-900 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-600" />
                          {trackedBooking.latestNotification.title}
                        </span>
                        <span className="text-[10px] text-blue-600 font-normal">
                          {new Date(trackedBooking.latestNotification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        {trackedBooking.latestNotification.message}
                      </p>
                    </div>
                  )}

                  {/* Dynamic Reallocation Journey Timeline (Section 5 Requirement) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Allocation & Reallocation Journey
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                        {trackedBooking.techniciansContactedCount || 1} Contacted
                      </span>
                    </div>

                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 text-xs">
                      {/* Step 1: Request Submitted */}
                      <div className="flex items-start gap-3 relative">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10">
                          ✓
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">Customer Request Submitted</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {trackedBooking.createdAt ? new Date(trackedBooking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Initial"}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Each Offer Attempt */}
                      {trackedBooking.offerHistory && trackedBooking.offerHistory.length > 0 ? (
                        trackedBooking.offerHistory.map((offer: any, idx: number) => {
                          const isRejected = offer.offerStatus === "REJECTED" || offer.offerStatus === "EXPIRED";
                          const isAccepted = offer.offerStatus === "ACCEPTED";
                          const isPending = offer.offerStatus === "OFFERED";

                          return (
                            <React.Fragment key={offer.offerId || idx}>
                              <div className="flex items-start gap-3 relative">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 ${
                                    isAccepted
                                      ? "bg-emerald-600 text-white"
                                      : isRejected
                                      ? "bg-rose-500 text-white"
                                      : "bg-blue-600 text-white animate-pulse"
                                  }`}
                                >
                                  {isAccepted ? "✓" : isRejected ? "✕" : (idx + 1)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900">
                                      Technician {idx + 1} ({offer.technicianName})
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                        isAccepted
                                          ? "bg-emerald-100 text-emerald-800"
                                          : isRejected
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-blue-100 text-blue-800"
                                      }`}
                                    >
                                      {isAccepted
                                        ? "Accepted"
                                        : isRejected
                                        ? (offer.offerStatus === "EXPIRED" ? "Timed Out" : "Rejected")
                                        : "Offer Dispatched"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Travel: {offer.travelMinutes} mins ({offer.distanceKm} km)
                                    {offer.offeredAt && (
                                      <span> &bull; {new Date(offer.offeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Intermediate: Searching for next technician */}
                              {isRejected && idx < (trackedBooking.offerHistory.length - 1 || 1) && (
                                <div className="flex items-start gap-3 relative pl-1 text-[11px] text-blue-700 font-semibold italic">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] flex-shrink-0 z-10">
                                    ⟳
                                  </div>
                                  <div>Searching for next nearest qualified specialist...</div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <div className="flex items-start gap-3 relative">
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 animate-pulse">
                            1
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {trackedBooking.currentTechnicianName || "Specialist"} – Offer Dispatched
                            </div>
                            <div className="text-[10px] text-blue-600 font-semibold">
                              Awaiting technician acceptance
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Final Step: Confirmed or Unassigned */}
                      {trackedBooking.bookingStatus === "ASSIGNED" || trackedBooking.bookingStatus === "IN_PROGRESS" || trackedBooking.bookingStatus === "COMPLETED" ? (
                        <div className="flex items-start gap-3 relative">
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 shadow-sm shadow-emerald-500/30">
                            ★
                          </div>
                          <div>
                            <div className="font-extrabold text-emerald-800">Technician Confirmed</div>
                            <div className="text-[10px] text-slate-500">
                              Specialist confirmed assignment and schedule locked.
                            </div>
                          </div>
                        </div>
                      ) : trackedBooking.bookingStatus === "UNASSIGNED" ? (
                        <div className="flex items-start gap-3 relative">
                          <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10">
                            !
                          </div>
                          <div>
                            <div className="font-extrabold text-rose-800">No Suitable Technician Available</div>
                            <div className="text-[10px] text-slate-500">
                              All contacted technicians declined or are outside operational boundaries.
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

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

      {/* VIEW 3: CUSTOMER PROFILE MANAGEMENT (Part 2) */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {!user ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <User className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Account Required</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You are currently browsing the DispatchGrid Service Hub in guest mode. Sign in to your verified customer account to edit your contact details, service address, and profile photo.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => (onNavigateLogin ? onNavigateLogin() : setActiveTab("book"))}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 inline-flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In as Customer</span>
                </button>
              </div>
            </div>
          ) : isLoadingProfile && !profileData ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading customer profile details...
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Profile Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-8 text-white relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    {/* Avatar Display */}
                    <div className="relative">
                      {photoPreview || profileData?.user?.profilePictureUrl || user.profilePictureUrl ? (
                        <img
                          src={photoPreview || profileData?.user?.profilePictureUrl || user.profilePictureUrl}
                          alt={user.fullName}
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 shadow-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-white/30 shadow-lg">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : "C"}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white" title="Verified Customer">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                          {profileData?.user?.fullName || user.fullName}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                          VERIFIED CUSTOMER
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                        <span>{profileData?.user?.email || user.email}</span>
                        <span>&bull;</span>
                        <span>{profileData?.user?.phone || user.phone}</span>
                      </p>
                    </div>
                  </div>

                  {!isEditingProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(true);
                        setProfileFormError("");
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20 shadow-sm cursor-pointer self-start sm:self-auto"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {/* View vs Edit Profile Body */}
              <div className="p-6 sm:p-8">
                {isEditingProfile ? (
                  /* Profile Edit Form */
                  <form onSubmit={handleSaveProfile} className="space-y-6 max-w-3xl">
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-base font-extrabold text-slate-900">Edit Personal Information</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Update your registered name, contact phone, verified email address, and service location.
                      </p>
                    </div>

                    {profileFormError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{profileFormError}</span>
                      </div>
                    )}

                    {/* Photo Management Section */}
                    <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Profile Photo
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 flex-shrink-0 border border-slate-300 flex items-center justify-center">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-8 h-8 text-slate-400" />
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handlePhotoSelect}
                            className="hidden"
                            id="customer-photo-input"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5 text-blue-600" />
                              <span>{photoPreview ? "Change Photo" : "Upload Photo"}</span>
                            </button>
                            {photoPreview && (
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove Photo</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Accepted file formats: JPG, PNG, WEBP. Maximum file size: 5MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Personal Information Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Contact Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+91-98800-00000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="customer@dispatchgrid.demo"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Used for login, dispatch notifications, and verified digital invoices. Duplicate emails are strictly rejected.
                        </span>
                      </div>
                    </div>

                    {/* Address Information Section */}
                    <div className="pt-2 border-t border-slate-100 space-y-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Primary Service Address
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Street Address / Residence
                          </label>
                          <input
                            type="text"
                            value={editAddressLine}
                            onChange={(e) => setEditAddressLine(e.target.value)}
                            placeholder="e.g. 100 Indiranagar 12th Main, HAL 2nd Stage"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                          <input
                            type="text"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            placeholder="Bengaluru"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                          <input
                            type="text"
                            value={editState}
                            onChange={(e) => setEditState(e.target.value)}
                            placeholder="Karnataka"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                          <input
                            type="text"
                            value={editPincode}
                            onChange={(e) => setEditPincode(e.target.value)}
                            placeholder="560038"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSavingProfile}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingProfile ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving Changes...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Profile Details View */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Personal Details Card */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <User className="w-4 h-4 text-blue-600" />
                          <span>Personal Information</span>
                        </div>

                        <div className="divide-y divide-slate-200/60 text-xs">
                          <div className="py-2.5 flex items-center justify-between">
                            <span className="text-slate-500">Full Name</span>
                            <span className="font-bold text-slate-900">
                              {profileData?.user?.fullName || user.fullName}
                            </span>
                          </div>
                          <div className="py-2.5 flex items-center justify-between">
                            <span className="text-slate-500">Email Address</span>
                            <span className="font-bold text-slate-900">
                              {profileData?.user?.email || user.email}
                            </span>
                          </div>
                          <div className="py-2.5 flex items-center justify-between">
                            <span className="text-slate-500">Phone Number</span>
                            <span className="font-bold text-slate-900">
                              {profileData?.user?.phone || user.phone}
                            </span>
                          </div>
                          <div className="py-2.5 flex items-center justify-between">
                            <span className="text-slate-500">Account Role</span>
                            <span className="font-bold text-emerald-700">Verified Customer</span>
                          </div>
                          <div className="py-2.5 flex items-center justify-between">
                            <span className="text-slate-500">Member Since</span>
                            <span className="text-slate-600 font-medium">
                              {profileData?.user?.createdAt
                                ? new Date(profileData.user.createdAt).toLocaleDateString()
                                : "October 2026"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Registered Address Card */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <span>Default Service Address</span>
                        </div>

                        {profileData?.addresses && profileData.addresses.length > 0 ? (
                          <div className="space-y-3">
                            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">
                                  {profileData.addresses[0].label || "Primary Residence"}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Default
                                </span>
                              </div>
                              <p className="text-slate-600">
                                {profileData.addresses[0].address_line}
                              </p>
                              <p className="text-slate-500 text-[11px]">
                                {profileData.addresses[0].city}, {profileData.addresses[0].state} - {profileData.addresses[0].pincode}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-2">
                            <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
                            <div>No default address registered yet.</div>
                            <button
                              type="button"
                              onClick={() => setIsEditingProfile(true)}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              Add address now
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dispatch & Booking Preferences Card */}
                    <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-5 rounded-2xl border border-blue-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        <span>DispatchGrid Certified Service Guarantee</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Your bookings automatically benefit from Google OR-Tools CP-SAT scheduling optimization, Dijkstra metro shortest path routing, EPA-certified HVAC technicians, and instant emergency allocation.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOOKING DETAILS MODAL (PART 1 Requirement) */}
      {selectedBookingForDetails && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                    #{selectedBookingForDetails.bookingReference || selectedBookingForDetails.bookingId}
                  </span>
                  {getStatusBadge(selectedBookingForDetails)}
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                  {selectedBookingForDetails.serviceName}
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed Service Request & Autonomous Dispatch Record
                </p>
              </div>

              <button
                onClick={() => setSelectedBookingForDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Complete Service Information */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Complete Service Information
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-400 font-semibold">Category</div>
                  <div className="font-bold text-slate-800">{selectedBookingForDetails.category}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Indicative Price</div>
                  <div className="font-bold text-emerald-700">₹{selectedBookingForDetails.indicativePrice || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Estimated Duration</div>
                  <div className="font-bold text-slate-800">{selectedBookingForDetails.estimatedDurationMinutes || 60} mins</div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Priority Level</div>
                  <div className="font-bold text-blue-700">{selectedBookingForDetails.requestedPriority || "NORMAL"}</div>
                </div>
              </div>
              
              {selectedBookingForDetails.problemDescription && (
                <div className="pt-2 border-t border-slate-200/60 text-xs">
                  <div className="text-slate-400 font-semibold mb-1">Problem Description:</div>
                  <div className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                    {selectedBookingForDetails.problemDescription}
                  </div>
                </div>
              )}

              {selectedBookingForDetails.notes && (
                <div className="text-xs text-slate-500 italic">
                  Note: {selectedBookingForDetails.notes}
                </div>
              )}
            </div>

            {/* Appointment Information */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Appointment Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-slate-400 font-semibold">Preferred Schedule</div>
                  <div className="font-bold text-slate-800">
                    {selectedBookingForDetails.preferredDate} &bull; {selectedBookingForDetails.preferredStartTime} - {selectedBookingForDetails.preferredEndTime}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Booking Creation Date</div>
                  <div className="font-bold text-slate-800">
                    {new Date(selectedBookingForDetails.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-slate-400 font-semibold">Service Address</div>
                  <div className="font-bold text-slate-800">
                    {selectedBookingForDetails.serviceAddress}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Zone Node: {selectedBookingForDetails.nodeId || "NODE_CENTRAL"}
                  </div>
                </div>
              </div>
            </div>

            {/* Technician Information */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Technician Information
              </div>
              {selectedBookingForDetails.assignedTechnicianName ? (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {selectedBookingForDetails.assignedTechnicianAvatar ? (
                      <img
                        src={selectedBookingForDetails.assignedTechnicianAvatar}
                        alt={selectedBookingForDetails.assignedTechnicianName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {selectedBookingForDetails.assignedTechnicianName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {selectedBookingForDetails.assignedTechnicianName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Technician ID: {selectedBookingForDetails.assignedTechnicianId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedBookingForDetails.assignedTechnicianRating && (
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200 font-bold text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{Number(selectedBookingForDetails.assignedTechnicianRating).toFixed(1)} Rating</span>
                      </div>
                    )}
                    {selectedBookingForDetails.assignedTechnicianPhone && (
                      <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{selectedBookingForDetails.assignedTechnicianPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic">
                  No technician currently confirmed. Automated scheduler is contacting qualified specialists.
                </div>
              )}
            </div>

            {/* Technician Offer History & Reallocation History */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Technician Offer & Reallocation History
                </div>
                {selectedBookingForDetails.offerHistory && selectedBookingForDetails.offerHistory.length > 1 && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Automatic Reallocation Triggered
                  </span>
                )}
              </div>

              {selectedBookingForDetails.offerHistory && selectedBookingForDetails.offerHistory.length > 0 ? (
                <div className="space-y-2">
                  {selectedBookingForDetails.offerHistory.map((offer: any, idx: number) => (
                    <div
                      key={offer.offerId || idx}
                      className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {offer.attemptNumber || idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800">{offer.technicianName}</span>
                          <div className="text-[10px] text-slate-400">
                            Offered: {new Date(offer.offeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {offer.respondedAt && (
                              <span> &bull; Responded: {new Date(offer.respondedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                            offer.offerStatus === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : offer.offerStatus === "REJECTED" || offer.offerStatus === "EXPIRED"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : offer.offerStatus === "WITHDRAWN"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {offer.offerStatus}
                        </span>
                        {offer.rejectionReason && (
                          <span className="text-[10px] text-rose-600 italic">
                            ({offer.rejectionReason})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedBookingForDetails.offerHistory.length > 1 && (
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200/70 text-[11px] text-purple-900 leading-snug">
                      <strong>Reallocation Record:</strong> When previous technician declined, DispatchGrid automatically evaluated remaining verified technicians in the service zone and dispatched an offer to the next nearest qualified candidate using Dijkstra road travel calculation.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 italic text-xs">
                  No previous offers logged for this service request.
                </div>
              )}
            </div>

            {/* Travel Distance and ETA (when technician accepted or assigned) */}
            {(selectedBookingForDetails.distanceKm > 0 || selectedBookingForDetails.assignedTechnicianId) && (
              <div className="bg-blue-50/70 p-4 sm:p-5 rounded-2xl border border-blue-200/80 space-y-2 text-xs">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" /> Dijkstra Road Travel & ETA
                </div>
                <div className="grid grid-cols-3 gap-3 text-slate-800 font-semibold">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Shortest Road Distance</span>
                    <span className="text-sm font-extrabold text-blue-700">{selectedBookingForDetails.distanceKm || 4.2} km</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Estimated Travel Time</span>
                    <span className="text-sm font-extrabold text-blue-700">{selectedBookingForDetails.travelMinutes || 18} mins</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Arrival Window</span>
                    <span className="text-sm font-extrabold text-blue-700">{selectedBookingForDetails.estimatedArrivalTime || "On Schedule"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Job Completion Details (if completed) */}
            {selectedBookingForDetails.bookingStatus === "COMPLETED" && (
              <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-2 text-xs">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Job Completion Record
                </div>
                <div className="text-slate-700">
                  {selectedBookingForDetails.completionNotes || "Service successfully completed and verified by customer."}
                </div>
                {selectedBookingForDetails.completionDate && (
                  <div className="text-[10px] text-slate-500">
                    Completed on: {new Date(selectedBookingForDetails.completionDate).toLocaleString()}
                  </div>
                )}
                {selectedBookingForDetails.customerRating && (
                  <div className="text-[11px] text-amber-700 font-bold flex items-center gap-1 pt-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>Customer Review: {selectedBookingForDetails.customerRating}/5 - "{selectedBookingForDetails.customerReview}"</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button
                onClick={() => {
                  const ref = selectedBookingForDetails.bookingReference || selectedBookingForDetails.bookingId;
                  const ph = selectedBookingForDetails.customerPhone || user?.phone || "";
                  setTrackRef(ref);
                  if (ph) setTrackPhone(ph);
                  setSelectedBookingForDetails(null);
                  switchTab("track");
                  setTimeout(() => {
                    document.getElementById("track-search-btn")?.click();
                  }, 150);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Track on Live Map</span>
              </button>

              <button
                onClick={() => setSelectedBookingForDetails(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
