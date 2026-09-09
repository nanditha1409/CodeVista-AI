import { useCallback, useMemo, useState } from "react";
import type { DepEdge, DepNode } from "../lib/dependencyExtractor";

export type GraphHighlightMode = "selection" | "callers" | "callees" | "path";
export type GraphFilterMode = "all" | "upstream" | "downstream";

export interface HoveredGraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphSelectionDetails {
  node: DepNode;
  incoming: DepNode[];
  outgoing: DepNode[];
}

export function useGraphState(nodes: DepNode[], edges: DepEdge[]) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredGraphNode | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightMode, setHighlightMode] =
    useState<GraphHighlightMode>("selection");
  const [filterMode, setFilterMode] = useState<GraphFilterMode>("all");

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const incomingByNode = useMemo(() => {
    const map = new Map<string, DepEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.target) ?? [];
      list.push(edge);
      map.set(edge.target, list);
    }
    return map;
  }, [edges]);

  const outgoingByNode = useMemo(() => {
    const map = new Map<string, DepEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.source) ?? [];
      list.push(edge);
      map.set(edge.source, list);
    }
    return map;
  }, [edges]);

  /**
   * All nodes are visible by default.
   * When a directional filter is active with a selection, restrict to
   * the upstream or downstream subgraph of that selection only.
   */
  const visibleNodeIds = useMemo(() => {
    const allNodeIds = new Set(nodes.map((n) => n.id));

    if (filterMode !== "all" && selectedNodeId) {
      const filtered = new Set<string>([selectedNodeId]);
      const queue = [selectedNodeId];
      const visited = new Set<string>([selectedNodeId]);

      if (filterMode === "upstream") {
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const edge of incomingByNode.get(cur) ?? []) {
            if (!visited.has(edge.source)) {
              visited.add(edge.source);
              filtered.add(edge.source);
              queue.push(edge.source);
            }
          }
        }
      } else {
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const edge of outgoingByNode.get(cur) ?? []) {
            if (!visited.has(edge.target)) {
              visited.add(edge.target);
              filtered.add(edge.target);
              queue.push(edge.target);
            }
          }
        }
      }
      return filtered;
    }

    return allNodeIds;
  }, [nodes, selectedNodeId, filterMode, incomingByNode, outgoingByNode]);

  const selectedDetails = useMemo<GraphSelectionDetails | null>(() => {
    if (!selectedNodeId) return null;
    const node = nodeById.get(selectedNodeId);
    if (!node) return null;
    const incoming = (incomingByNode.get(selectedNodeId) ?? [])
      .map((e) => nodeById.get(e.source))
      .filter((n): n is DepNode => Boolean(n));
    const outgoing = (outgoingByNode.get(selectedNodeId) ?? [])
      .map((e) => nodeById.get(e.target))
      .filter((n): n is DepNode => Boolean(n));
    return { node, incoming, outgoing };
  }, [incomingByNode, nodeById, outgoingByNode, selectedNodeId]);

  // ── Highlight helpers ─────────────────────────────────────────────────────
  const setHighlightForEdges = useCallback(
    (nodeId: string, graphEdges: DepEdge[], mode: GraphHighlightMode) => {
      const nodeIds = new Set<string>([nodeId]);
      const edgeIds = new Set<string>();
      for (const edge of graphEdges) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
      setHighlightedNodes(nodeIds);
      setHighlightedEdges(edgeIds);
      setHighlightMode(mode);
    },
    [],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const selectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setHighlightForEdges(
        nodeId,
        [
          ...(incomingByNode.get(nodeId) ?? []),
          ...(outgoingByNode.get(nodeId) ?? []),
        ],
        "selection",
      );
    },
    [incomingByNode, outgoingByNode, setHighlightForEdges],
  );

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setHoveredNode(null);
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setHighlightMode("selection");
    setFilterMode("all");
  }, []);

  const showCallers = useCallback(
    (nodeId: string) => {
      setHighlightForEdges(nodeId, incomingByNode.get(nodeId) ?? [], "callers");
    },
    [incomingByNode, setHighlightForEdges],
  );

  const showCallees = useCallback(
    (nodeId: string) => {
      setHighlightForEdges(nodeId, outgoingByNode.get(nodeId) ?? [], "callees");
    },
    [outgoingByNode, setHighlightForEdges],
  );

  const showDependencies = useCallback(
    (nodeId: string) => {
      setHighlightForEdges(
        nodeId,
        [
          ...(incomingByNode.get(nodeId) ?? []),
          ...(outgoingByNode.get(nodeId) ?? []),
        ],
        "selection",
      );
    },
    [incomingByNode, outgoingByNode, setHighlightForEdges],
  );

  const highlightPath = useCallback(
    (nodeId: string) => {
      setHighlightForEdges(
        nodeId,
        [
          ...(incomingByNode.get(nodeId) ?? []),
          ...(outgoingByNode.get(nodeId) ?? []),
        ],
        "path",
      );
    },
    [incomingByNode, outgoingByNode, setHighlightForEdges],
  );

  /** Reset view: clears selection and highlights without hiding nodes */
  const resetView = useCallback(() => {
    setSelectedNodeId(null);
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setHighlightMode("selection");
    setFilterMode("all");
  }, []);

  return {
    selectedNodeId,
    hoveredNode,
    highlightedNodes,
    highlightedEdges,
    visibleNodeIds,
    selectedDetails,
    highlightMode,
    filterMode,
    nodeById,
    setHoveredNode,
    selectNode,
    clearSelection,
    showCallers,
    showCallees,
    showDependencies,
    highlightPath,
    resetView,
    setFilterMode,
  };
}
