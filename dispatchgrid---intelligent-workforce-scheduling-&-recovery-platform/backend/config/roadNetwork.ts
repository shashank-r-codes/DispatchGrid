// Metro Road Network Graph Definition for Dijkstra Shortest Travel-Time Routing
// Nodes represent urban centers and intersections; edges represent road links with real travel minutes.

export interface RoadNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locality: string;
}

export interface RoadEdge {
  from: string;
  to: string;
  travelMinutes: number;
  distanceKm: number;
  roadName: string;
}

export const METRO_NODES: Record<string, RoadNode> = {
  NODE_CENTRAL: {
    id: "NODE_CENTRAL",
    name: "Central Metro Hub",
    lat: 12.9716,
    lng: 77.5946,
    locality: "CBD / Central",
  },
  NODE_NORTH: {
    id: "NODE_NORTH",
    name: "North Tech Boulevard",
    lat: 13.0358,
    lng: 77.5970,
    locality: "Hebbal / North",
  },
  NODE_EAST: {
    id: "NODE_EAST",
    name: "East Silicon Corridor",
    lat: 12.9840,
    lng: 77.6632,
    locality: "Indiranagar / East",
  },
  NODE_SOUTH: {
    id: "NODE_SOUTH",
    name: "South Gateway Park",
    lat: 12.9250,
    lng: 77.5938,
    locality: "Jayanagar / South",
  },
  NODE_WEST: {
    id: "NODE_WEST",
    name: "West Industrial District",
    lat: 12.9780,
    lng: 77.5450,
    locality: "Rajajinagar / West",
  },
  NODE_SOUTHEAST: {
    id: "NODE_SOUTHEAST",
    name: "Southeast Tech Enclave",
    lat: 12.9352,
    lng: 77.6245,
    locality: "Koramangala",
  },
  NODE_NORTHEAST: {
    id: "NODE_NORTHEAST",
    name: "Northeast Ring Junction",
    lat: 13.0068,
    lng: 77.6520,
    locality: "Kalyan Nagar",
  },
  NODE_SOUTHWEST: {
    id: "NODE_SOUTHWEST",
    name: "Southwest Valley Road",
    lat: 12.9120,
    lng: 77.5560,
    locality: "Banashankari",
  },
  NODE_WHITEFIELD: {
    id: "NODE_WHITEFIELD",
    name: "Whitefield Metro Park",
    lat: 12.9698,
    lng: 77.7499,
    locality: "Whitefield Outer",
  },
  NODE_ELECTRONIC_CITY: {
    id: "NODE_ELECTRONIC_CITY",
    name: "Electronic City Expressway",
    lat: 12.8452,
    lng: 77.6602,
    locality: "Electronic City South",
  },
};

export const METRO_EDGES: RoadEdge[] = [
  // Central connections
  { from: "NODE_CENTRAL", to: "NODE_NORTH", travelMinutes: 18, distanceKm: 7.2, roadName: "Bellary Main Rd" },
  { from: "NODE_NORTH", to: "NODE_CENTRAL", travelMinutes: 18, distanceKm: 7.2, roadName: "Bellary Main Rd" },

  { from: "NODE_CENTRAL", to: "NODE_EAST", travelMinutes: 14, distanceKm: 6.1, roadName: "Old Airport Arterial" },
  { from: "NODE_EAST", to: "NODE_CENTRAL", travelMinutes: 14, distanceKm: 6.1, roadName: "Old Airport Arterial" },

  { from: "NODE_CENTRAL", to: "NODE_SOUTH", travelMinutes: 15, distanceKm: 5.8, roadName: "Avenue Southern Link" },
  { from: "NODE_SOUTH", to: "NODE_CENTRAL", travelMinutes: 15, distanceKm: 5.8, roadName: "Avenue Southern Link" },

  { from: "NODE_CENTRAL", to: "NODE_WEST", travelMinutes: 16, distanceKm: 5.4, roadName: "Magadi Flyover Corridor" },
  { from: "NODE_WEST", to: "NODE_CENTRAL", travelMinutes: 16, distanceKm: 5.4, roadName: "Magadi Flyover Corridor" },

  // Outer Ring and Cross Links
  { from: "NODE_NORTH", to: "NODE_NORTHEAST", travelMinutes: 12, distanceKm: 5.0, roadName: "Outer Ring Rd North" },
  { from: "NODE_NORTHEAST", to: "NODE_NORTH", travelMinutes: 12, distanceKm: 5.0, roadName: "Outer Ring Rd North" },

  { from: "NODE_NORTHEAST", to: "NODE_EAST", travelMinutes: 13, distanceKm: 4.8, roadName: "Banaswadi Link Rd" },
  { from: "NODE_EAST", to: "NODE_NORTHEAST", travelMinutes: 13, distanceKm: 4.8, roadName: "Banaswadi Link Rd" },

  { from: "NODE_EAST", to: "NODE_SOUTHEAST", travelMinutes: 12, distanceKm: 4.5, roadName: "Intermediate Ring Rd" },
  { from: "NODE_SOUTHEAST", to: "NODE_EAST", travelMinutes: 12, distanceKm: 4.5, roadName: "Intermediate Ring Rd" },

  { from: "NODE_SOUTHEAST", to: "NODE_SOUTH", travelMinutes: 11, distanceKm: 3.9, roadName: "Dairy Circle Expressway" },
  { from: "NODE_SOUTH", to: "NODE_SOUTHEAST", travelMinutes: 11, distanceKm: 3.9, roadName: "Dairy Circle Expressway" },

  { from: "NODE_SOUTH", to: "NODE_SOUTHWEST", travelMinutes: 10, distanceKm: 4.1, roadName: "Kanakapura Connection" },
  { from: "NODE_SOUTHWEST", to: "NODE_SOUTH", travelMinutes: 10, distanceKm: 4.1, roadName: "Kanakapura Connection" },

  { from: "NODE_SOUTHWEST", to: "NODE_WEST", travelMinutes: 16, distanceKm: 6.8, roadName: "West Outer Radial" },
  { from: "NODE_WEST", to: "NODE_SOUTHWEST", travelMinutes: 16, distanceKm: 6.8, roadName: "West Outer Radial" },

  // Eastern Extension
  { from: "NODE_EAST", to: "NODE_WHITEFIELD", travelMinutes: 22, distanceKm: 11.2, roadName: "Whitefield Main Rd" },
  { from: "NODE_WHITEFIELD", to: "NODE_EAST", travelMinutes: 22, distanceKm: 11.2, roadName: "Whitefield Main Rd" },

  // Southern Extension
  { from: "NODE_SOUTHEAST", to: "NODE_ELECTRONIC_CITY", travelMinutes: 20, distanceKm: 13.5, roadName: "Hosur Elevated Tollway" },
  { from: "NODE_ELECTRONIC_CITY", to: "NODE_SOUTHEAST", travelMinutes: 20, distanceKm: 13.5, roadName: "Hosur Elevated Tollway" },
];

export function findClosestNode(lat: number, lng: number): string {
  let closestId = "NODE_CENTRAL";
  let minDistanceSq = Number.POSITIVE_INFINITY;

  for (const node of Object.values(METRO_NODES)) {
    const dLat = node.lat - lat;
    const dLng = node.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestId = node.id;
    }
  }

  return closestId;
}
