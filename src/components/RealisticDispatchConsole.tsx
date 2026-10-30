import React, { useEffect, useState, useRef } from "react";
import { Activity, ShieldCheck, MapPin, Radio, Cpu, Navigation, Zap } from "lucide-react";

interface RealisticDispatchConsoleProps {
  role?: "CUSTOMER" | "ADMIN" | "TECHNICIAN";
  isSubmitting?: boolean;
}

export const RealisticDispatchConsole: React.FC<RealisticDispatchConsoleProps> = ({
  role = "ADMIN",
  isSubmitting = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reticle, setReticle] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [currentTime, setCurrentTime] = useState<string>("");
  const [randomPing, setRandomPing] = useState<number>(14);

  // Update clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update ping latency slightly
  useEffect(() => {
    const pingTimer = setInterval(() => {
      setRandomPing(Math.floor(12 + Math.random() * 5));
    }, 2500);
    return () => clearInterval(pingTimer);
  }, []);

  // Interactive mouse tracking for 3D tilt & screen reticle
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Realistic subtle 3D tilt (-12 to +12 deg)
      const maxTilt = 12;
      const tiltY = Math.max(-maxTilt, Math.min(maxTilt, (deltaX / window.innerWidth) * 28));
      const tiltX = Math.max(-maxTilt, Math.min(maxTilt, -(deltaY / window.innerHeight) * 28));
      setTilt({ x: tiltX, y: tiltY });

      // Screen target reticle follows cursor position relative to terminal
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      setReticle({
        x: Math.max(10, Math.min(90, relX)),
        y: Math.max(15, Math.min(85, relY)),
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Color schemes for hardware indicators and screen mode
  const theme =
    role === "ADMIN"
      ? {
          modeName: "COMMAND & RECOVERY DISPATCH",
          badge: "bg-purple-500/20 text-purple-300 border-purple-400/30",
          accentColor: "#a855f7",
          led: "bg-purple-400",
          ring: "ring-purple-500/20",
          glow: "from-purple-900/40 via-slate-900 to-slate-950",
          highlight: "text-purple-400",
        }
      : role === "CUSTOMER"
      ? {
          modeName: "AUTONOMOUS SERVICE DISPATCH",
          badge: "bg-blue-500/20 text-blue-300 border-blue-400/30",
          accentColor: "#3b82f6",
          led: "bg-blue-400",
          ring: "ring-blue-500/20",
          glow: "from-blue-900/40 via-slate-900 to-slate-950",
          highlight: "text-blue-400",
        }
      : {
          modeName: "SPECIALIST TELEMETRY & SHIFTS",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
          accentColor: "#10b981",
          led: "bg-emerald-400",
          ring: "ring-emerald-500/20",
          glow: "from-emerald-900/40 via-slate-900 to-slate-950",
          highlight: "text-emerald-400",
        };

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col items-center select-none"
      style={{ perspective: 1000 }}
    >
      {/* 3D Tilting Field Terminal Chassis */}
      <div
        className="w-full max-w-md rounded-3xl p-3 bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900 border border-slate-700/80 shadow-2xl shadow-black/40 transition-transform duration-150 ease-out relative overflow-hidden"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Realistic Metallic Chamfer & Screws */}
        <div className="absolute top-2 left-3 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-xs" />
        <div className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-xs" />
        <div className="absolute bottom-2 left-3 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-xs" />
        <div className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-500 shadow-xs" />

        {/* Top Hardware Header Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 border-b border-slate-800/80 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            <span className="text-slate-300 font-bold tracking-wider">DSP-GRID MK-IV</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-blue-400" />
              <span>{randomPing}ms</span>
            </span>
            <span className="text-slate-200 font-semibold">{currentTime || "LIVE"}</span>
          </div>
        </div>

        {/* High-Tech Terminal Glass Display Screen */}
        <div
          className={`w-full rounded-2xl bg-gradient-to-b ${theme.glow} p-3.5 border border-slate-750 relative overflow-hidden shadow-inner font-sans`}
        >
          {/* Subtle Ambient Scanline & Glass Reflection */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent h-12 pointer-events-none rounded-t-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-8 pointer-events-none animate-scanline" />

          {/* Screen Top Status Bar */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 mb-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-extrabold text-white tracking-wide uppercase">{theme.modeName}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${theme.badge}`}>
              {isSubmitting ? "PROCESSING..." : "OPTIMIZED"}
            </span>
          </div>

          {/* Interactive Dijkstra Road Network Radar Canvas Simulation */}
          <div className="relative h-44 rounded-xl bg-slate-950/90 border border-slate-800/90 overflow-hidden mb-3 p-2">
            {/* Grid Coordinates Background */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Concentric Radar Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full border border-sky-500/20" />
              <div className="w-20 h-20 rounded-full border border-sky-500/30" />
              <div className="w-8 h-8 rounded-full border border-sky-500/40" />
              {/* Sweeping Radar Scanner Line */}
              <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500/20 via-transparent to-transparent animate-spin origin-center" />
            </div>

            {/* Interactive Target Reticle following cursor */}
            <div
              className="absolute pointer-events-none transition-all duration-75 ease-out"
              style={{
                left: `${reticle.x}%`,
                top: `${reticle.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-7 h-7 rounded-full border border-cyan-400/90 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="absolute left-8 top-0 whitespace-nowrap bg-slate-900/90 px-1.5 py-0.5 rounded text-[8px] font-mono text-cyan-300 border border-cyan-500/40 shadow-xs">
                COORD [{reticle.x.toFixed(0)}, {reticle.y.toFixed(0)}] &bull; DIJKSTRA
              </div>
            </div>

            {/* Simulated Live Metro Zone Nodes */}
            <div className="absolute top-4 left-6 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
              <span className="text-[9px] font-mono text-slate-300 font-bold">NODE_CENTRAL</span>
            </div>
            <div className="absolute top-10 right-6 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
              <span className="text-[9px] font-mono text-slate-400">WHITEFIELD</span>
            </div>
            <div className="absolute bottom-6 left-10 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400" />
              <span className="text-[9px] font-mono text-slate-400">KORAMANGALA</span>
            </div>
            <div className="absolute bottom-5 right-8 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              <span className="text-[9px] font-mono text-slate-300 font-bold">HSR_LAYOUT</span>
            </div>

            {/* Connecting Dijkstra Graph Edges (SVG overlay) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
              <line x1="15%" y1="20%" x2="45%" y2="55%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="45%" y1="55%" x2="80%" y2="25%" stroke="#38bdf8" strokeWidth="1" />
              <line x1="45%" y1="55%" x2="30%" y2="75%" stroke="#10b981" strokeWidth="1.5" />
              <line x1="45%" y1="55%" x2="75%" y2="78%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            </svg>
          </div>

          {/* Live Telemetry Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> SLA Rate
              </div>
              <div className="text-sm font-black text-white mt-0.5 font-mono">99.8%</div>
              <div className="text-[8px] text-emerald-400 font-semibold">Strict Met</div>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Match SLA
              </div>
              <div className="text-sm font-black text-white mt-0.5 font-mono">&lt; 1.8m</div>
              <div className="text-[8px] text-blue-400 font-semibold">Dijkstra RT</div>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3 text-cyan-400" /> Specialists
              </div>
              <div className="text-sm font-black text-white mt-0.5 font-mono">20 / 20</div>
              <div className="text-[8px] text-emerald-400 font-semibold">Verified</div>
            </div>
          </div>

          {/* Dynamic Console Prompt line */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-cyan-400">&gt;</span>
              <span className="text-slate-300 truncate">
                {isSubmitting
                  ? "Authenticating credentials and loading schedule..."
                  : role === "ADMIN"
                  ? "System Ready &bull; CP-SAT & Dijkstra engines standby"
                  : role === "CUSTOMER"
                  ? "Instant Booking &bull; Live technician availability"
                  : "Technician Roster &bull; Shifts, routes & auto-reallocation"}
              </span>
            </div>
            <span className="w-1.5 h-3 bg-cyan-400 animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Lower Terminal Bezel Hardware Bar */}
        <div className="flex items-center justify-between px-3 pt-2 text-[9px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-xs" />
            <span className="tracking-widest uppercase">DISPATCHGRID ENGINE</span>
          </div>
          <span className="text-slate-500 text-[8px]">INTERACTIVE TELEMETRY &bull; 60 FPS</span>
        </div>
      </div>
    </div>
  );
};
