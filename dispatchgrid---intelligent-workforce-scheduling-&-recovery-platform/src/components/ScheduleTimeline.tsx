import React from "react";
import { Clock, ShieldAlert, CheckCircle, Wrench } from "lucide-react";

interface TimelineItem {
  technician: {
    userId: string;
    fullName: string;
    shiftStart: string;
    shiftEnd: string;
    categories: string;
    status: string;
  };
  assignments: {
    bookingId: string;
    bookingReference: string;
    startTime: string;
    endTime: string;
    status: string;
    priority: string;
    serviceName: string;
    category: string;
    travelMinutes: number;
    customerName: string;
  }[];
}

interface ScheduleTimelineProps {
  timeline: TimelineItem[];
  onSelectBooking?: (bookingId: string) => void;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ timeline, onSelectBooking }) => {
  // Hours 08:00 to 18:00 (10 hours total = 600 minutes)
  const START_HOUR = 8;
  const END_HOUR = 18;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

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
    return Math.max(2, ((end - start) / (TOTAL_HOURS * 60)) * 100);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-sm">Technician Shift & Appointment Schedule (08:00 - 18:00)</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block"></span> Reserved Emergency Capacity
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[850px] p-4">
          {/* Time Header Grid */}
          <div className="flex border-b border-slate-200 pb-2 mb-3 text-xs font-semibold text-slate-400">
            <div className="w-48 flex-shrink-0 text-slate-600">Technician</div>
            <div className="flex-1 relative h-6">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute text-[11px] transform -translate-x-1/2"
                  style={{ left: `${(i / TOTAL_HOURS) * 100}%` }}
                >
                  {h < 10 ? `0${h}:00` : `${h}:00`}
                </div>
              ))}
            </div>
          </div>

          {/* Technician Rows */}
          <div className="space-y-4">
            {timeline.map(({ technician: t, assignments }) => (
              <div key={t.userId} className="flex items-center group">
                {/* Tech info */}
                <div className="w-48 flex-shrink-0 pr-3">
                  <div className="font-semibold text-slate-900 text-xs truncate">{t.fullName}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 font-medium text-[10px] text-slate-600">
                      {t.categories}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${t.status === "AVAILABLE" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                  </div>
                </div>

                {/* Timeline Bar Track */}
                <div className="flex-1 relative h-11 bg-slate-100/80 rounded-lg border border-slate-200 overflow-hidden">
                  {/* Hour Guidelines */}
                  {hours.slice(1, -1).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-[1px] bg-slate-200/80"
                      style={{ left: `${((i + 1) / TOTAL_HOURS) * 100}%` }}
                    />
                  ))}

                  {/* Reserved Emergency Capacity interval (11:00 to 11:30) */}
                  <div
                    className="absolute top-0 bottom-0 bg-amber-200/40 border-x border-amber-300/80 flex items-center justify-center text-[10px] font-bold text-amber-800"
                    style={{
                      left: `${getPositionPercent("11:00")}%`,
                      width: `${getDurationPercent("11:00", "11:30")}%`,
                    }}
                    title="Reserved Emergency Buffer: Priority triage window"
                  >
                    <span className="truncate px-1">Buffer</span>
                  </div>

                  {/* Scheduled Assignments */}
                  {assignments.map((job) => {
                    const left = getPositionPercent(job.startTime);
                    const width = getDurationPercent(job.startTime, job.endTime);

                    let bg = "bg-blue-600 text-white";
                    if (job.status === "IN_PROGRESS") bg = "bg-amber-500 text-white animate-pulse";
                    if (job.status === "COMPLETED") bg = "bg-emerald-600 text-white";
                    if (job.priority === "EMERGENCY") bg = "bg-red-600 text-white ring-2 ring-red-300";

                    return (
                      <div
                        key={job.bookingId}
                        onClick={() => onSelectBooking && onSelectBooking(job.bookingId)}
                        className={`absolute top-1 bottom-1 ${bg} rounded px-2 py-0.5 text-xs font-semibold shadow-sm cursor-pointer hover:brightness-110 flex items-center justify-between gap-1 overflow-hidden transition-all`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${job.bookingReference} | ${job.serviceName} (${job.startTime} - ${job.endTime})\nCustomer: ${job.customerName}\nStatus: ${job.status}`}
                      >
                        <div className="truncate text-[11px] leading-tight">
                          <span className="font-mono">{job.bookingReference}</span> {job.serviceName}
                        </div>
                        {job.priority === "EMERGENCY" && <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
