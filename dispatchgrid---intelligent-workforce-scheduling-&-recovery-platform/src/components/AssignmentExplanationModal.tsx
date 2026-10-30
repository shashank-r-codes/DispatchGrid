import React from "react";
import { X, CheckCircle, AlertTriangle, Route, Award, Clock } from "lucide-react";
import { AssignmentRecord } from "../types";

interface AssignmentExplanationModalProps {
  record: AssignmentRecord | null;
  onClose: () => void;
}

export const AssignmentExplanationModal: React.FC<AssignmentExplanationModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <h3 className="font-bold text-base">Assignment Decision & Explainability Audit</h3>
              <p className="text-xs text-slate-400">
                Booking: <span className="font-mono text-blue-400">{record.booking_reference || record.booking_id}</span> | Run ID: {record.scheduling_run_id.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Winner Card */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Winning Candidate Selected</h4>
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{record.technician_name}</div>
              <p className="text-xs text-emerald-800 mt-0.5">{record.selection_reason}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-xs flex-shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Dijkstra Travel</span>
                <span className="text-slate-900 text-sm font-bold flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-blue-600" /> {record.calculated_travel_time_minutes} mins
                </span>
              </div>
              <div className="w-[1px] h-6 bg-slate-200"></div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Objective Score</span>
                <span className="text-emerald-600 text-sm font-bold">{record.assignment_score.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Evaluated Candidates Comparison Table */}
          {record.evaluatedCandidates && record.evaluatedCandidates.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Evaluated Eligible Candidates ({record.evaluatedCandidates.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Technician</th>
                      <th className="py-2.5 px-3">Travel Time</th>
                      <th className="py-2.5 px-3">Active Load</th>
                      <th className="py-2.5 px-3">Score Breakdown</th>
                      <th className="py-2.5 px-3 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {record.evaluatedCandidates.map((cand, idx) => {
                      const isWinner = cand.technicianId === record.assigned_technician_id;
                      return (
                        <tr key={cand.technicianId} className={isWinner ? "bg-emerald-50/50 font-medium" : "hover:bg-slate-50"}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {cand.fullName}
                              {isWinner && <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px]">Assigned</span>}
                              {cand.isPreferredByCustomer && <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px]">Customer Preferred</span>}
                            </div>
                            <div className="text-[11px] text-slate-400">★ {cand.rating}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{cand.travelMinutes} mins ({cand.distanceKm} km)</td>
                          <td className="py-2.5 px-3 text-slate-700">{cand.activeJobsCount} active jobs</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500">
                            Travel: {cand.scoreBreakdown?.travelScore} | SLA: {cand.scoreBreakdown?.slaScore} | Load: {cand.scoreBreakdown?.workloadScore}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {cand.assignmentCost.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rejected Candidates & Constraint Failures */}
          {record.rejectedAlternatives && record.rejectedAlternatives.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Hard Constraint Exclusions ({record.rejectedAlternatives.length})
              </h4>
              <div className="space-y-2">
                {record.rejectedAlternatives.map((rej) => (
                  <div key={rej.technicianId} className="border border-slate-200 bg-slate-50/60 rounded-lg p-3 text-xs">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {rej.fullName}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                      {rej.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
