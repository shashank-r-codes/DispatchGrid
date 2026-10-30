import React, { useEffect, useState, useRef } from "react";

interface CuteComputerMascotProps {
  role?: "CUSTOMER" | "ADMIN" | "TECHNICIAN";
  isSubmitting?: boolean;
}

export const CuteComputerMascot: React.FC<CuteComputerMascotProps> = ({
  role = "ADMIN",
  isSubmitting = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [speechText, setSpeechText] = useState<string>("Ready for evaluation!");

  // Track cursor position globally
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.hypot(deltaX, deltaY);

      // Clamp tilt angles (-18 deg to +18 deg)
      const maxTilt = 18;
      const tiltY = Math.max(-maxTilt, Math.min(maxTilt, (deltaX / window.innerWidth) * 40));
      const tiltX = Math.max(-maxTilt, Math.min(maxTilt, -(deltaY / window.innerHeight) * 40));
      setTilt({ x: tiltX, y: tiltY });

      // Pupil offset (-10px to +10px)
      const maxPupil = 9;
      const angle = Math.atan2(deltaY, deltaX);
      const intensity = Math.min(dist / 200, 1);
      const pupilX = Math.cos(angle) * maxPupil * intensity;
      const pupilY = Math.sin(angle) * maxPupil * intensity;
      setEyeOffset({ x: pupilX, y: pupilY });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Periodic blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Dynamic reaction to role change
  useEffect(() => {
    if (role === "ADMIN") {
      setSpeechText("Admin mode: Full Dijkstra control!");
    } else if (role === "CUSTOMER") {
      setSpeechText("Customer mode: Instant dispatch!");
    } else if (role === "TECHNICIAN") {
      setSpeechText("Technician mode: 20 active specialists!");
    }
  }, [role]);

  // Color scheme based on active role
  const screenTheme =
    role === "ADMIN"
      ? {
          glow: "from-purple-500/20 via-indigo-500/10 to-transparent",
          border: "border-purple-400/40",
          eyeGlow: "shadow-purple-400/50",
          led: "bg-purple-400",
          badge: "bg-purple-500/20 text-purple-300 border-purple-400/30",
        }
      : role === "CUSTOMER"
      ? {
          glow: "from-blue-500/20 via-cyan-500/10 to-transparent",
          border: "border-blue-400/40",
          eyeGlow: "shadow-blue-400/50",
          led: "bg-cyan-400",
          badge: "bg-blue-500/20 text-blue-300 border-blue-400/30",
        }
      : {
          glow: "from-emerald-500/20 via-teal-500/10 to-transparent",
          border: "border-emerald-400/40",
          eyeGlow: "shadow-emerald-400/50",
          led: "bg-emerald-400",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
        };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center select-none"
      style={{ perspective: 800 }}
    >
      {/* Speech Bubble / Thought Pill */}
      <div className="mb-2 z-20 animate-float-slow">
        <div className="relative bg-slate-900/90 text-slate-100 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700/80 shadow-lg backdrop-blur-md flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${screenTheme.led} animate-pulse`} />
          <span>{isSubmitting ? "Authenticating session..." : speechText}</span>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45" />
        </div>
      </div>

      {/* 3D CRT Computer Unit (Spline Follow Cursor recreation) */}
      <div
        className="relative transition-transform duration-100 ease-out"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Antenna */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div
            className={`w-3.5 h-3.5 rounded-full ${screenTheme.led} shadow-md ${screenTheme.eyeGlow} animate-pulse`}
          />
          <div className="w-1 h-3.5 bg-slate-400" />
        </div>

        {/* Outer Monitor Body */}
        <div className="w-40 sm:w-44 h-32 sm:h-36 rounded-3xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 p-2.5 shadow-2xl shadow-slate-900/25 border-4 border-slate-300/80 relative overflow-hidden flex flex-col items-center justify-between">
          {/* Top highlight / specular reflection */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-white/60 rounded-t-3xl blur-[1px] pointer-events-none" />

          {/* Inner CRT Screen Bezel */}
          <div
            className={`w-full h-24 sm:h-28 rounded-2xl bg-slate-950 p-2 relative overflow-hidden border-2 ${screenTheme.border} shadow-inner flex flex-col items-center justify-center`}
          >
            {/* Ambient CRT Scanline Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-6 pointer-events-none animate-scanline" />

            {/* Glowing Screen Aura */}
            <div
              className={`absolute inset-0 bg-radial ${screenTheme.glow} pointer-events-none`}
            />

            {/* Eyes Container */}
            <div className="relative z-10 flex items-center justify-center gap-6 w-full">
              {/* Left Eye */}
              <div
                className={`w-5 sm:w-6 h-7 sm:h-8 rounded-full bg-slate-900 border-2 border-cyan-400/80 relative overflow-hidden flex items-center justify-center transition-all ${
                  isBlinking ? "scale-y-0 opacity-20" : "scale-y-100 opacity-100"
                }`}
              >
                {/* Pupil following mouse */}
                <div
                  className="w-3.5 sm:w-4 h-5 sm:h-6 rounded-full bg-gradient-to-b from-cyan-300 to-blue-500 shadow-md shadow-cyan-400/80 relative"
                  style={{
                    transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                    transition: "transform 0.05s linear",
                  }}
                >
                  {/* Glossy catchlight */}
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>

              {/* Right Eye */}
              <div
                className={`w-5 sm:w-6 h-7 sm:h-8 rounded-full bg-slate-900 border-2 border-cyan-400/80 relative overflow-hidden flex items-center justify-center transition-all ${
                  isBlinking ? "scale-y-0 opacity-20" : "scale-y-100 opacity-100"
                }`}
              >
                {/* Pupil following mouse */}
                <div
                  className="w-3.5 sm:w-4 h-5 sm:h-6 rounded-full bg-gradient-to-b from-cyan-300 to-blue-500 shadow-md shadow-cyan-400/80 relative"
                  style={{
                    transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                    transition: "transform 0.05s linear",
                  }}
                >
                  {/* Glossy catchlight */}
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </div>

            {/* Cute Smile / Mouth */}
            <div className="relative z-10 mt-1 flex justify-center">
              <div className="w-5 h-2 border-b-2 border-cyan-300/80 rounded-full" />
            </div>

            {/* Retro CRT Grid Scan Indicator */}
            <div className="absolute bottom-1 right-2 flex items-center gap-1 opacity-60">
              <span className={`w-1 h-1 rounded-full ${screenTheme.led} animate-ping`} />
              <span className="text-[7px] text-cyan-400/70 font-mono tracking-tighter">AI.GRID</span>
            </div>
          </div>

          {/* Lower Chassis: Floppy Slot & Power LED */}
          <div className="w-full flex items-center justify-between px-2 pt-1 text-[8px] text-slate-500 font-bold">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${screenTheme.led} shadow-xs`} />
              <span className="font-mono text-[9px] text-slate-600">DISPATCH-BOT</span>
            </div>
            {/* Floppy Drive Slot */}
            <div className="w-8 h-1 bg-slate-400 rounded-full border border-slate-300" />
          </div>
        </div>

        {/* Computer Stand / Base */}
        <div className="w-20 h-3 bg-slate-300 rounded-b-xl mx-auto shadow-md border-t border-slate-400" />
        <div className="w-28 h-2.5 bg-slate-400 rounded-full mx-auto shadow-lg" />
      </div>

      {/* Floating Status Pill */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
          <span>Interactive 3D Follow Cursor</span>
          <span className="text-slate-300">•</span>
          <span className="text-blue-600 font-mono">Spline Inspired</span>
        </span>
      </div>
    </div>
  );
};
