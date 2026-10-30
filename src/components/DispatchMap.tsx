import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { RoadNode, RoadEdge, Booking, Technician } from "../types";

interface DispatchMapProps {
  bookings: Booking[];
  technicians: Technician[];
  selectedBooking?: Booking | null;
  onSelectBooking?: (b: Booking) => void;
  onSelectTechnician?: (t: Technician) => void;
  height?: string;
}

export const DispatchMap: React.FC<DispatchMapProps> = ({
  bookings,
  technicians,
  selectedBooking,
  onSelectBooking,
  onSelectTechnician,
  height = "520px",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    roadsLayer: L.LayerGroup;
    nodesLayer: L.LayerGroup;
    techsLayer: L.LayerGroup;
    jobsLayer: L.LayerGroup;
    activeRouteLayer: L.LayerGroup;
  } | null>(null);

  const [roadData, setRoadData] = useState<{ nodes: RoadNode[]; edges: RoadEdge[] }>({
    nodes: [],
    edges: [],
  });

  const [showRoads, setShowRoads] = useState<boolean>(true);
  const [showTechs, setShowTechs] = useState<boolean>(true);
  const [showJobs, setShowJobs] = useState<boolean>(true);

  // Fetch road network definition
  useEffect(() => {
    fetch("/api/dispatch/road-network")
      .then((res) => res.json())
      .then((data) => setRoadData(data))
      .catch((err) => console.error("Failed to load road network", err));
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Metro Bengaluru coordinates
    const map = L.map(mapContainerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const roadsLayer = L.layerGroup().addTo(map);
    const nodesLayer = L.layerGroup().addTo(map);
    const techsLayer = L.layerGroup().addTo(map);
    const jobsLayer = L.layerGroup().addTo(map);
    const activeRouteLayer = L.layerGroup().addTo(map);

    layersRef.current = {
      roadsLayer,
      nodesLayer,
      techsLayer,
      jobsLayer,
      activeRouteLayer,
    };

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Road Network (Nodes and Edges with Dijkstra travel weights)
  useEffect(() => {
    if (!layersRef.current || !roadData.nodes.length) return;
    const { roadsLayer, nodesLayer } = layersRef.current;
    roadsLayer.clearLayers();
    nodesLayer.clearLayers();

    if (!showRoads) return;

    const nodeMap = new Map(roadData.nodes.map((n) => [n.id, n]));

    // Draw road edges
    roadData.edges.forEach((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (from && to) {
        const polyline = L.polyline(
          [
            [from.lat, from.lng],
            [to.lat, to.lng],
          ],
          {
            color: "#94a3b8",
            weight: 3,
            opacity: 0.6,
            dashArray: "4, 6",
          }
        );

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color: #1e3a8a;">${edge.roadName}</strong><br/>
            <span>Travel time: <b>${edge.travelMinutes} mins</b></span><br/>
            <span>Distance: ${edge.distanceKm} km</span>
          </div>
        `);

        roadsLayer.addLayer(polyline);
      }
    });

    // Draw road nodes
    roadData.nodes.forEach((node) => {
      const circle = L.circleMarker([node.lat, node.lng], {
        radius: 6,
        fillColor: "#1e40af",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      circle.bindTooltip(`<b>${node.name}</b><br/>Locality: ${node.locality}`, {
        permanent: false,
        direction: "top",
      });

      nodesLayer.addLayer(circle);
    });
  }, [roadData, showRoads]);

  // Render Technicians
  useEffect(() => {
    if (!layersRef.current) return;
    const { techsLayer } = layersRef.current;
    techsLayer.clearLayers();

    if (!showTechs) return;

    technicians.forEach((t) => {
      const isAC = t.serviceCategories.includes("AC");
      const isPlumb = t.serviceCategories.includes("Plumbing");
      const isElec = t.serviceCategories.includes("Electrical");

      let badgeColor = "#2563eb"; // blue
      let badgeLabel = "ELEC";

      if (isAC && !isElec) {
        badgeColor = "#0891b2"; // cyan
        badgeLabel = "AC";
      } else if (isPlumb && !isElec && !isAC) {
        badgeColor = "#d97706"; // amber
        badgeLabel = "PLUMB";
      } else if (isAC && isElec) {
        badgeColor = "#7c3aed"; // violet
        badgeLabel = "DUAL";
      }

      const icon = L.divIcon({
        className: "custom-tech-pin",
        html: `
          <div style="
            background: ${badgeColor};
            color: white;
            padding: 3px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
            border: 2px solid white;
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
          ">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${t.availabilityStatus === "AVAILABLE" ? "#22c55e" : "#ef4444"};"></span>
            ${badgeLabel}: ${t.fullName.split(" ")[0]}
          </div>
        `,
        iconSize: [80, 26],
        iconAnchor: [40, 13],
      });

      const marker = L.marker([t.currentLatitude, t.currentLongitude], { icon });

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">${t.fullName}</div>
          <div style="color: #64748b; font-size: 11px;">Status: <b style="color:${t.availabilityStatus === "AVAILABLE" ? "#16a34a" : "#dc2626"}">${t.availabilityStatus}</b></div>
          <div style="color: #64748b; font-size: 11px;">Verification: <b>${t.verificationStatus}</b></div>
          <div style="color: #64748b; font-size: 11px;">Shift: ${t.shiftStartTime} - ${t.shiftEndTime}</div>
          <div style="color: #64748b; font-size: 11px;">Rating: ★ ${t.averageRating} (${t.totalCompletedJobs} jobs)</div>
          <div style="margin-top: 6px; font-size: 11px;">Categories: <b>${t.serviceCategories.join(", ")}</b></div>
        </div>
      `);

      marker.on("click", () => {
        if (onSelectTechnician) onSelectTechnician(t);
      });

      techsLayer.addLayer(marker);
    });
  }, [technicians, showTechs, onSelectTechnician]);

  // Render Bookings & Selected Dijkstra Route
  useEffect(() => {
    if (!layersRef.current) return;
    const { jobsLayer, activeRouteLayer } = layersRef.current;
    jobsLayer.clearLayers();
    activeRouteLayer.clearLayers();

    if (!showJobs) return;

    bookings.forEach((b) => {
      const isEmergency = b.verifiedPriority === "EMERGENCY" || b.requestedPriority === "EMERGENCY";
      const isHigh = b.verifiedPriority === "HIGH" || b.requestedPriority === "HIGH";

      let pinBg = "#3b82f6";
      let borderColor = "#ffffff";
      let pulse = "";

      if (isEmergency) {
        pinBg = "#dc2626";
        borderColor = "#fee2e2";
        pulse = "box-shadow: 0 0 0 6px rgba(220, 38, 38, 0.4); animation: pulse 1.5s infinite;";
      } else if (isHigh) {
        pinBg = "#ea580c";
        borderColor = "#ffedd5";
      }

      const icon = L.divIcon({
        className: "custom-job-pin",
        html: `
          <div style="
            background: ${pinBg};
            color: white;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            border: 2px solid ${borderColor};
            ${pulse}
            white-space: nowrap;
            cursor: pointer;
          ">
            ${isEmergency ? "🚨 " : ""}${b.bookingReference}
          </div>
        `,
        iconSize: [85, 26],
        iconAnchor: [42, 13],
      });

      const marker = L.marker([b.latitude, b.longitude], { icon });

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; min-width: 220px;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${b.serviceName || b.category}</div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">Ref: <b>${b.bookingReference}</b></div>
          <div style="font-size: 11px; margin-bottom: 2px;">Priority: <b style="color:${isEmergency ? "#dc2626" : isHigh ? "#ea580c" : "#2563eb"}">${b.verifiedPriority}</b></div>
          <div style="font-size: 11px; margin-bottom: 2px;">Status: <b>${b.bookingStatus}</b></div>
          <div style="font-size: 11px; margin-bottom: 2px;">Address: ${b.serviceAddress}</div>
          <div style="font-size: 11px; margin-bottom: 4px;">Assigned: <b>${b.assignedTechnicianName || "Unassigned"}</b></div>
          ${b.estimatedTravelTimeMinutes ? `<div style="font-size: 11px; color:#16a34a; font-weight:600;">Est. Travel: ${b.estimatedTravelTimeMinutes} mins</div>` : ""}
        </div>
      `);

      marker.on("click", () => {
        if (onSelectBooking) onSelectBooking(b);
      });

      jobsLayer.addLayer(marker);
    });

    // Draw active Dijkstra route for selected booking
    if (selectedBooking && selectedBooking.assignedTechnicianId) {
      const assignedTech = technicians.find((t) => t.userId === selectedBooking.assignedTechnicianId);
      if (assignedTech) {
        const polyline = L.polyline(
          [
            [assignedTech.currentLatitude, assignedTech.currentLongitude],
            [selectedBooking.latitude, selectedBooking.longitude],
          ],
          {
            color: "#16a34a",
            weight: 4,
            opacity: 0.85,
            dashArray: "6, 8",
          }
        );

        polyline.bindTooltip(
          `<b>Transit Route</b>: ${assignedTech.fullName} &rarr; ${selectedBooking.bookingReference}<br/>Est. Travel: ${selectedBooking.estimatedTravelTimeMinutes || 15} mins`,
          { permanent: true, direction: "center" }
        );

        activeRouteLayer.addLayer(polyline);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds([
            [assignedTech.currentLatitude, assignedTech.currentLongitude],
            [selectedBooking.latitude, selectedBooking.longitude],
          ], { padding: [50, 50] });
        }
      }
    }
  }, [bookings, selectedBooking, technicians, showJobs, onSelectBooking]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Map Header & Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 shadow-md text-xs font-medium text-slate-700">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showRoads}
            onChange={(e) => setShowRoads(e.target.checked)}
            className="rounded text-blue-600 focus:ring-0"
          />
          <span>Road Network</span>
        </label>
        <div className="w-[1px] h-3 bg-slate-200"></div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showTechs}
            onChange={(e) => setShowTechs(e.target.checked)}
            className="rounded text-blue-600 focus:ring-0"
          />
          <span>Technicians ({technicians.length})</span>
        </label>
        <div className="w-[1px] h-3 bg-slate-200"></div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showJobs}
            onChange={(e) => setShowJobs(e.target.checked)}
            className="rounded text-blue-600 focus:ring-0"
          />
          <span>Jobs ({bookings.length})</span>
        </label>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-md text-xs text-slate-600 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block animate-pulse"></span>
          <span>Emergency Job</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span>Normal Job</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-600 inline-block"></span>
          <span>AC Specialist</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block"></span>
          <span>Electrician</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block"></span>
          <span>Plumber</span>
        </div>
      </div>

      <div ref={mapContainerRef} style={{ width: "100%", height }} />
    </div>
  );
};
