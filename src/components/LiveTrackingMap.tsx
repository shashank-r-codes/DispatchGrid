import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { TrackingSessionData } from "../types";

interface LiveTrackingMapProps {
  session: TrackingSessionData | null;
  height?: string;
  className?: string;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  session,
  height = "420px",
  className = "",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const techMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = session?.destinationLatitude || 12.9716;
    const initialLng = session?.destinationLongitude || 77.5946;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers and Polyline Route whenever session coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !session) return;

    const destCoords: [number, number] = [session.destinationLatitude, session.destinationLongitude];
    const techCoords: [number, number] = [session.currentLatitude, session.currentLongitude];

    // 1. Destination Marker (Customer Address)
    if (!destMarkerRef.current) {
      const destIcon = L.divIcon({
        className: "custom-dest-pin",
        html: `
          <div style="
            background: #0f172a;
            color: #38bdf8;
            border: 2px solid #38bdf8;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4);
            white-space: nowrap;
          ">
            <span>🏠</span>
            <span>Customer Destination</span>
          </div>
        `,
        iconSize: [150, 30],
        iconAnchor: [75, 15],
      });

      destMarkerRef.current = L.marker(destCoords, { icon: destIcon }).addTo(map);
      destMarkerRef.current.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 800; color: #0f172a;">Customer Location</div>
          <div style="color: #475569; font-size: 11px;">${session.serviceAddress}</div>
          <div style="margin-top: 4px; font-weight: 700; color: #2563eb;">${session.serviceName} (${session.category})</div>
        </div>
      `);
    } else {
      destMarkerRef.current.setLatLng(destCoords);
    }

    // 2. Technician Moving Marker
    const isMoving = session.trackingStatus === "TRAVELLING";
    const isArrived = session.trackingStatus === "ARRIVED";

    const techIcon = L.divIcon({
      className: "custom-tech-pin",
      html: `
        <div style="
          background: ${isArrived ? '#059669' : '#2563eb'};
          color: white;
          border: 2px solid white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 10px 20px -3px rgba(37, 99, 235, 0.45);
          white-space: nowrap;
          position: relative;
        ">
          <span style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${isArrived ? '#34d399' : '#60a5fa'};
            box-shadow: 0 0 8px ${isArrived ? '#34d399' : '#60a5fa'};
            animation: pulse 1s infinite;
          "></span>
          <span>${isArrived ? '✓ Arrived:' : '🚗'} ${session.technicianName}</span>
        </div>
      `,
      iconSize: [140, 32],
      iconAnchor: [70, 16],
    });

    if (!techMarkerRef.current) {
      techMarkerRef.current = L.marker(techCoords, { icon: techIcon }).addTo(map);
      techMarkerRef.current.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <div style="font-weight: 800; color: #0f172a;">${session.technicianName}</div>
          <div style="color: #2563eb; font-weight: 700; font-size: 11px;">Status: ${session.trackingStatus}</div>
          <div style="color: #64748b; font-size: 11px;">Remaining ETA: ~${session.remainingTravelMinutes} mins (${session.remainingDistanceKm} km)</div>
        </div>
      `);
    } else {
      techMarkerRef.current.setIcon(techIcon);
      techMarkerRef.current.setLatLng(techCoords);
    }

    // 3. Polyline Route Line
    const path = session.routePath && session.routePath.length > 0 ? session.routePath : [techCoords, destCoords];

    if (!routePolylineRef.current) {
      routePolylineRef.current = L.polyline(path, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
        dashArray: isMoving ? "1, 8" : undefined,
      }).addTo(map);
    } else {
      routePolylineRef.current.setLatLngs(path);
      if (isMoving) {
        routePolylineRef.current.setStyle({ dashArray: "1, 8" });
      } else {
        routePolylineRef.current.setStyle({ dashArray: undefined });
      }
    }

    // Fit bounds to show both customer destination and technician
    try {
      const bounds = L.latLngBounds([destCoords, techCoords]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } catch {}
  }, [session]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`} style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Visual Demo Badge overlay on top of map */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span>DEMO / SIMULATED LIVE GPS</span>
      </div>
    </div>
  );
};

