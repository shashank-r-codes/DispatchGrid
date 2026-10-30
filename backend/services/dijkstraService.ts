// Dijkstra's Shortest Path Algorithm for Road Network Travel-Time Calculations
// Calculates minimum travel time between two road network nodes or coordinates.

import { METRO_NODES, METRO_EDGES, findClosestNode, RoadNode } from "../config/roadNetwork.js";

export interface DijkstraResult {
  fromNode: string;
  toNode: string;
  travelMinutes: number;
  distanceKm: number;
  path: string[];
  pathNodes: RoadNode[];
  steps: {
    from: string;
    to: string;
    roadName: string;
    travelMinutes: number;
    distanceKm: number;
  }[];
}

interface EdgeNeighbor {
  nodeId: string;
  travelMinutes: number;
  distanceKm: number;
  roadName: string;
}

class RoadGraph {
  private adjacencyList: Map<string, EdgeNeighbor[]> = new Map();

  constructor() {
    this.buildGraph();
  }

  private buildGraph() {
    // Initialize nodes
    for (const nodeId of Object.keys(METRO_NODES)) {
      this.adjacencyList.set(nodeId, []);
    }

    // Add edges
    for (const edge of METRO_EDGES) {
      if (!this.adjacencyList.has(edge.from)) {
        this.adjacencyList.set(edge.from, []);
      }
      this.adjacencyList.get(edge.from)!.push({
        nodeId: edge.to,
        travelMinutes: edge.travelMinutes,
        distanceKm: edge.distanceKm,
        roadName: edge.roadName,
      });
    }
  }

  /**
   * Dijkstra's Algorithm implementation using Min-Priority tracking
   */
  public findShortestPath(startNodeId: string, endNodeId: string): DijkstraResult {
    if (startNodeId === endNodeId) {
      const node = METRO_NODES[startNodeId] || METRO_NODES.NODE_CENTRAL;
      return {
        fromNode: startNodeId,
        toNode: endNodeId,
        travelMinutes: 0,
        distanceKm: 0,
        path: [startNodeId],
        pathNodes: [node],
        steps: [],
      };
    }

    const distances = new Map<string, number>();
    const distanceKmMap = new Map<string, number>();
    const previous = new Map<string, { prevNode: string; edge: EdgeNeighbor } | null>();
    const unvisited = new Set<string>();

    for (const nodeId of Object.keys(METRO_NODES)) {
      distances.set(nodeId, Number.POSITIVE_INFINITY);
      distanceKmMap.set(nodeId, 0);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    distances.set(startNodeId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentSmallest: string | null = null;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const node of unvisited) {
        const dist = distances.get(node) ?? Number.POSITIVE_INFINITY;
        if (dist < minDistance) {
          minDistance = dist;
          currentSmallest = node;
        }
      }

      if (currentSmallest === null || minDistance === Number.POSITIVE_INFINITY) {
        break; // remaining nodes are unreachable
      }

      if (currentSmallest === endNodeId) {
        break; // found shortest path to target
      }

      unvisited.delete(currentSmallest);

      const neighbors = this.adjacencyList.get(currentSmallest) || [];
      for (const neighbor of neighbors) {
        if (!unvisited.has(neighbor.nodeId)) continue;

        const candidateTime = minDistance + neighbor.travelMinutes;
        const currentBestTime = distances.get(neighbor.nodeId) ?? Number.POSITIVE_INFINITY;

        if (candidateTime < currentBestTime) {
          distances.set(neighbor.nodeId, candidateTime);
          distanceKmMap.set(neighbor.nodeId, (distanceKmMap.get(currentSmallest) || 0) + neighbor.distanceKm);
          previous.set(neighbor.nodeId, { prevNode: currentSmallest, edge: neighbor });
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    const steps: DijkstraResult["steps"] = [];
    let curr: string | null = endNodeId;

    while (curr && curr !== startNodeId) {
      const prevEntry = previous.get(curr);
      if (!prevEntry) break;
      path.unshift(curr);
      steps.unshift({
        from: prevEntry.prevNode,
        to: curr,
        roadName: prevEntry.edge.roadName,
        travelMinutes: prevEntry.edge.travelMinutes,
        distanceKm: prevEntry.edge.distanceKm,
      });
      curr = prevEntry.prevNode;
    }

    if (curr === startNodeId) {
      path.unshift(startNodeId);
    }

    const totalMinutes = distances.get(endNodeId);
    const resolvedMinutes = (totalMinutes === undefined || totalMinutes === Number.POSITIVE_INFINITY) ? 30 : totalMinutes;
    const resolvedKm = steps.reduce((sum, s) => sum + s.distanceKm, 0);

    return {
      fromNode: startNodeId,
      toNode: endNodeId,
      travelMinutes: resolvedMinutes,
      distanceKm: Number(resolvedKm.toFixed(1)),
      path,
      pathNodes: path.map(id => METRO_NODES[id] || { id, name: id, lat: 12.9716, lng: 77.5946, locality: "Metro" }),
      steps,
    };
  }

  /**
   * Helper to calculate travel between coordinates by mapping to nearest network nodes
   */
  public calculateTravelBetweenCoords(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): DijkstraResult {
    const fromNode = findClosestNode(fromLat, fromLng);
    const toNode = findClosestNode(toLat, toLng);
    return this.findShortestPath(fromNode, toNode);
  }
}

export const dijkstraService = new RoadGraph();
