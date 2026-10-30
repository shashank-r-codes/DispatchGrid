import React from "react";
import { Grid, ArrowRight, Shield, Zap, Route, Cpu, RefreshCw, CheckCircle2, Award, Star, Compass } from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onExploreDemo: () => void;
  onViewDocs: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onExploreDemo, onViewDocs }) => {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold tracking-wide shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
          Intelligent Workforce Scheduling & Dynamic Recovery Platform
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Adaptive Dispatch, Route Optimization & Real-Time Recovery.
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Connect verified electricians, certified AC specialists, and master plumbers with algorithmic Dijkstra shortest-path transit, Google OR-Tools CP-SAT constraint optimization, and disruption-aware schedule resilience.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={onExploreDemo}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            Launch Command Dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onViewDocs}
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs"
          >
            Explore System Architecture
          </button>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 text-left text-xs">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <Route className="w-5 h-5 text-blue-600" />
            <div className="font-bold text-slate-900">Dijkstra Road Routing</div>
            <p className="text-[11px] text-slate-500">Calculates true road network travel minutes instead of euclidean line estimates.</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <div className="font-bold text-slate-900">OR-Tools CP-SAT</div>
            <p className="text-[11px] text-slate-500">Constraint-based global workforce optimizer minimizing travel time and SLA penalties.</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <RefreshCw className="w-5 h-5 text-rose-600" />
            <div className="font-bold text-slate-900">Dynamic Recovery</div>
            <p className="text-[11px] text-slate-500">Immediate adaptive rerouting upon technician sickness, delays, or emergency requests.</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <Shield className="w-5 h-5 text-emerald-600" />
            <div className="font-bold text-slate-900">AC Specialization Rule</div>
            <p className="text-[11px] text-slate-500">Strict organizational constraint: General electricians cannot take AC repair jobs.</p>
          </div>
        </div>
      </section>

      {/* Service Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Three Specialized Maintenance Departments</h2>
            <p className="text-xs text-slate-400">
              Each maintenance vertical enforces relational skills, trade licenses, and background audits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
                ⚡
              </div>
              <h3 className="text-base font-bold">1. Electrical Maintenance</h3>
              <p className="text-slate-400">
                Residential & commercial rewiring, RCCB circuit breakers, short circuit diagnosis, distribution switchboards, and fan mounting.
              </p>
              <div className="text-[11px] text-blue-300 font-mono">License: Wireman Grade A</div>
            </div>

            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
                ❄️
              </div>
              <h3 className="text-base font-bold">2. AC & HVAC Specialization</h3>
              <p className="text-slate-400">
                Split inverter installation, R32/R410A refrigerant vacuum charging, compressor rebuilds, coil chemical cleans, and thermostat calibration.
              </p>
              <div className="text-[11px] text-cyan-300 font-mono">Certification: EPA 608 Universal</div>
            </div>

            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
                🔧
              </div>
              <h3 className="text-base font-bold">3. Master Plumbing</h3>
              <p className="text-slate-400">
                Concealed acoustic pipe leak detection, designer single-lever mixers, hydro-jet drain cleaning, and booster pump overhaul.
              </p>
              <div className="text-[11px] text-amber-300 font-mono">License: Licensed Master Plumber</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
