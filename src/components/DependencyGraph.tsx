import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Filter,
  FlaskConical,
  GitBranch,
  Link2,
  Loader2,
  Maximize2,
  ScanSearch,
  ZoomIn,
  ZoomOut,
  Search,
} from "lucide-react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import contextMenus from "cytoscape-context-menus";
import "cytoscape-context-menus/cytoscape-context-menus.css";
import type { DepEdge, DepNode } from "../lib/dependencyExtractor";
import { useAnalysisStore } from "../stores/analysisStore";
import { NodeDetailsPanel } from "./NodeDetailsPanel";
import { useGraphState } from "../hooks/useGraphState";

cytoscape.use(contextMenus);

interface DependencyGraphProps {
  nodes: DepNode[];
  edges: DepEdge[];
  onNodeClick?: (node: DepNode) => void;
}

type LayoutName = "cose" | "breadthfirst" | "grid" | "circle";

export function DependencyGraph({
  nodes,
  edges,
  onNodeClick,
}: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const contextMenuRef = useRef<cytoscape.ContextMenuInstance | null>(null);
  const mountedRef = useRef(false);
  const [layout, setLayout] = useState<LayoutName>("cose");
  const [isExporting, setIsExporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClearedForSearch, setFilterClearedForSearch] = useState(false);
  const [graphReady, setGraphReady] = useState(0);
  const {
    selectedDepNodeId,
    setSelectedDepNodeId,
    moduleSummaries,
    whatIfSimulation,
  } = useAnalysisStore();

  const {
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
    setFilterMode,
  } = useGraphState(nodes, edges);

  const elements = useMemo<ElementDefinition[]>(
    () => [
      ...nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color,
          nodeSize: node.nodeSize,
          language: node.language,
          lineCount: node.lineCount,
          inDegree: node.inDegree,
          outDegree: node.outDegree,
        },
        group: "nodes" as const,
      })),
      ...edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
        },
        group: "edges" as const,
      })),
    ],
    [edges, nodes],
  );
  const elementsRef = useRef(elements);

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return new Set<string>();
    return new Set(nodes.filter((node) => node.label.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)).map((node) => node.id));
  }, [nodes, searchQuery]);
  const visibleSearchMatchCount = useMemo(
    () => [...searchMatches].filter((id) => visibleNodeIds.has(id)).length,
    [searchMatches, visibleNodeIds],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setFilterClearedForSearch(false);
  }, [searchQuery]);

  useEffect(() => {
    if (
      searchQuery.trim() &&
      searchMatches.size > 0 &&
      visibleSearchMatchCount === 0 &&
      filterMode !== "all"
    ) {
      setFilterMode("all");
      setFilterClearedForSearch(true);
    }
  }, [filterMode, searchMatches, searchQuery, setFilterMode, visibleSearchMatchCount]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const viewFile = useCallback(
    (nodeId: string) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      selectNode(nodeId);
      setSelectedDepNodeId(nodeId);
      onNodeClick?.(node);
    },
    [nodeById, onNodeClick, selectNode, setSelectedDepNodeId],
  );

  const handleGraphSelect = useCallback(
    (nodeId: string) => {
      viewFile(nodeId);
    },
    [viewFile],
  );

  const resetVisualFocus = useCallback(() => {
    clearSelection();
    setSelectedDepNodeId(null);
  }, [clearSelection, setSelectedDepNodeId]);

  const getContextNodeId = useCallback(
    (event: cytoscape.ContextMenuEventObject) => {
      if (event.target && "id" in event.target) {
        return event.target.id();
      }
      return null;
    },
    [],
  );

  const runLayout = useCallback(
    (cy: Core) => {
      const effectiveLayout =
        edges.length === 0 && layout === "cose" ? "grid" : layout;
      cy.layout({
        name: effectiveLayout,
        animate: false,
        randomize: effectiveLayout === "cose",
        fit: true,
        padding: 48,
      }).run();
    },
    [edges.length, layout],
  );

  // Apply visibility based on visibleNodeIds
  const applyVisibleGraph = useCallback(
    (cy: Core) => {
      const visibleEdges = new Set(
        edges
          .filter(
            (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
          )
          .map((e) => e.id),
      );

      cy.batch(() => {
        cy.nodes().forEach((node) => {
          node.style(
            "display",
            visibleNodeIds.has(node.id()) ? "element" : "none",
          );
        });
        cy.edges().forEach((edge) => {
          edge.style(
            "display",
            visibleEdges.has(edge.id()) ? "element" : "none",
          );
        });
      });

      cy.resize();
      runLayout(cy);
      cy.fit(cy.elements(":visible"), 48);
    },
    [edges, runLayout, visibleNodeIds],
  );

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;
    mountedRef.current = true;

    if (contextMenuRef.current) {
      contextMenuRef.current.destroy();
      contextMenuRef.current = null;
    }
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: elementsRef.current,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "background-opacity": 0.85,
            label: "data(label)",
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "font-size": "10px",
            "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#dbeafe",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 7,
            "text-max-width": "84px",
            "text-wrap": "ellipsis",
            "border-width": 1.5,
            "border-color": "data(color)",
            "border-opacity": 0.4,
            "overlay-padding": 4,
            "transition-property":
              "background-opacity, border-width, opacity, border-color",
            "transition-duration": 150,
          },
        },
        {
          selector: "node:selected, node.selected-node",
          style: {
            "background-opacity": 1,
            "border-width": 3,
            "border-color": "#facc15",
            "border-opacity": 1,
            "z-index": 20,
          },
        },
        {
          selector: "node.highlighted",
          style: {
            "background-opacity": 1,
            "border-width": 2.5,
            "border-color": "#38bdf8",
            "border-opacity": 1,
            "z-index": 12,
          },
        },
        {
          selector: "node.path-highlight",
          style: {
            "background-color": "#f59e0b",
            "background-opacity": 1,
            "border-width": 3,
            "border-color": "#fef08a",
            "border-opacity": 1,
            "z-index": 18,
          },
        },
        {
          selector: "node.faded",
          style: {
            "background-opacity": 0.06,
            color: "#475569",
            "border-opacity": 0.04,
            opacity: 0.12,
          },
        },
        {
          selector: "node.search-match",
          style: { "background-color": "#facc15", "background-opacity": 1, "border-width": 4, "border-color": "#fef08a", "border-opacity": 1, "underlay-color": "#facc15", "underlay-opacity": 0.35, "underlay-padding": 8, "z-index": 24 },
        },
        {
          // What-If simulation: active node
          selector: "node.whatif-active",
          style: {
            "background-color": "#7c3aed",
            "background-opacity": 1,
            "border-width": 3,
            "border-color": "#a78bfa",
            "border-opacity": 1,
            "z-index": 22,
          },
        },
        {
          // What-If simulation: upstream nodes (need retest)
          selector: "node.whatif-upstream",
          style: {
            "background-color": "#92400e",
            "background-opacity": 1,
            "border-width": 2,
            "border-color": "#f59e0b",
            "border-opacity": 1,
            "z-index": 14,
          },
        },
        {
          // What-If simulation: downstream nodes (need inspection)
          selector: "node.whatif-downstream",
          style: {
            "background-color": "#164e63",
            "background-opacity": 1,
            "border-width": 2,
            "border-color": "#38bdf8",
            "border-opacity": 1,
            "z-index": 14,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.4,
            "line-color": "#374151",
            "target-arrow-color": "#4b5563",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.56,
            "transition-property":
              "line-color, target-arrow-color, opacity, width",
            "transition-duration": 150,
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            "line-color": "#38bdf8",
            "target-arrow-color": "#38bdf8",
            opacity: 1,
            width: 2.4,
          },
        },
        {
          selector: "edge.path-highlight",
          style: {
            "line-color": "#ef4444",
            "target-arrow-color": "#ef4444",
            opacity: 1,
            width: 3,
            "z-index": 16,
          },
        },
        {
          selector: "edge.faded",
          style: { opacity: 0.06 },
        },
      ],
      layout: {
        name: edges.length === 0 && layout === "cose" ? "grid" : layout,
        animate: false,
        randomize: edges.length > 0 && layout === "cose",
        fit: true,
        padding: 48,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.05,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    contextMenuRef.current = cy.contextMenus({
      evtType: "cxttap",
      menuItemClasses: ["codevista-context-menu-item"],
      contextMenuClasses: ["codevista-context-menu"],
      menuItems: [
        {
          id: "view-file",
          content: "📄 View File",
          tooltipText: "Open the selected file",
          selector: "node",
          onClickFunction: (event) => {
            const nodeId = getContextNodeId(event);
            if (nodeId) viewFile(nodeId);
          },
        },
        {
          id: "show-callers",
          content: "⬆ Show Callers",
          tooltipText: "Highlight incoming dependencies",
          selector: "node",
          onClickFunction: (event) => {
            const nodeId = getContextNodeId(event);
            if (nodeId) {
              selectNode(nodeId);
              showCallers(nodeId);
            }
          },
        },
        {
          id: "show-callees",
          content: "⬇ Show Callees",
          tooltipText: "Highlight outgoing dependencies",
          selector: "node",
          onClickFunction: (event) => {
            const nodeId = getContextNodeId(event);
            if (nodeId) {
              selectNode(nodeId);
              showCallees(nodeId);
            }
          },
        },
        {
          id: "highlight-path",
          content: "🔴 Highlight Path",
          tooltipText: "Highlight direct dependency path",
          selector: "node",
          onClickFunction: (event) => {
            const nodeId = getContextNodeId(event);
            if (nodeId) {
              selectNode(nodeId);
              highlightPath(nodeId);
            }
          },
        },
      ],
    });

    cy.on("tap", "node", (event) => {
      handleGraphSelect(event.target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        resetVisualFocus();
      }
    });

    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const renderedPosition = node.renderedPosition();
      setHoveredNode({
        id: node.id(),
        label: String(node.data("label")),
        x: renderedPosition.x,
        y: renderedPosition.y,
      });
      containerRef.current?.classList.add("is-node-hovering");
    });

    cy.on("mouseout", "node", () => {
      setHoveredNode(null);
      containerRef.current?.classList.remove("is-node-hovering");
    });

    cy.on("pan zoom", () => {
      if (!mountedRef.current) return;
      setHoveredNode((current) => {
        if (!current) return null;
        const node = cy.getElementById(current.id);
        if (!node.length || !node.visible()) return null;
        const renderedPosition = node.renderedPosition();
        return { ...current, x: renderedPosition.x, y: renderedPosition.y };
      });
    });

    cyRef.current = cy;

    cy.ready(() => {
      requestAnimationFrame(() => {
        cy.resize();
        runLayout(cy);
        applyVisibleGraph(cy);
        setGraphReady((version) => version + 1);
      });
    });

    let hasLaidOutAtRealSize = false;
    const resizeObserver = new ResizeObserver(() => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      cy.resize();
      if (!hasLaidOutAtRealSize) {
        hasLaidOutAtRealSize = true;
        runLayout(cy);
      }
      cy.fit(cy.elements(":visible"), 48);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      mountedRef.current = false;
      resizeObserver.disconnect();
      contextMenuRef.current?.destroy();
      contextMenuRef.current = null;
      cy.destroy();
      cyRef.current = null;
    };
  }, [
    applyVisibleGraph,
    edges.length,
    getContextNodeId,
    handleGraphSelect,
    highlightPath,
    layout,
    nodes.length,
    resetVisualFocus,
    selectNode,
    setHoveredNode,
    showCallees,
    showCallers,
    viewFile,
  ]);

  // Sync elements when nodes/edges change
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.json({ elements });
  }, [elements]);

  // Apply visibility whenever visibleNodeIds or collapsedGroups change
  useEffect(() => {
    if (!cyRef.current) return;
    applyVisibleGraph(cyRef.current);
  }, [applyVisibleGraph]);

  // Apply highlight classes — search and selection/highlight coexist independently
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const hasSearch = searchQuery.trim().length > 0;
    const hasHighlight = highlightedNodes.size > 0 || highlightedEdges.size > 0;
    const hasSelection = Boolean(selectedNodeId);

    cy.batch(() => {
      cy.elements().removeClass(
        "selected-node highlighted path-highlight faded search-match whatif-active whatif-upstream whatif-downstream",
      );

      // Build the union of "stay visible" ids from both search and selection/highlight
      const visibleIds = new Set<string>();

      if (hasSearch) {
        for (const nodeId of searchMatches) visibleIds.add(nodeId);
      }

      if (hasSelection) {
        visibleIds.add(selectedNodeId!);
      }

      if (hasHighlight) {
        for (const nodeId of highlightedNodes) visibleIds.add(nodeId);
        for (const edgeId of highlightedEdges) visibleIds.add(edgeId);
      }

      // Fade everything that isn't in the visible set (only when something is active)
      const shouldFade = hasSearch || hasHighlight || hasSelection;
      if (shouldFade) {
        cy.elements(":visible").forEach((el) => {
          if (!visibleIds.has(el.id())) el.addClass("faded");
        });
      }

      // Apply search-match styling independently
      if (hasSearch) {
        for (const nodeId of searchMatches) {
          cy.getElementById(nodeId).removeClass("faded").addClass("search-match");
        }
      }

      // Apply selected-node styling independently
      if (hasSelection) {
        cy.getElementById(selectedNodeId!).removeClass("faded").addClass("selected-node");
      }

      // Apply highlighted / path-highlight styling independently
      if (hasHighlight) {
        for (const nodeId of highlightedNodes) {
          cy.getElementById(nodeId)
            .removeClass("faded")
            .addClass(highlightMode === "path" ? "path-highlight" : "highlighted");
        }
        for (const edgeId of highlightedEdges) {
          cy.getElementById(edgeId)
            .removeClass("faded")
            .addClass(highlightMode === "path" ? "path-highlight" : "highlighted");
        }
      }

      // What-if overlay only when there is no user selection or active search/highlight
      if (!hasSelection && !hasSearch && !hasHighlight && whatIfSimulation) {
        const { activeNodeId, upstreamPaths, downstreamPaths } = whatIfSimulation;
        const upstreamSet = new Set(upstreamPaths);
        const downstreamSet = new Set(downstreamPaths);

        cy.elements(":visible").addClass("faded");

        if (activeNodeId) {
          cy.getElementById(activeNodeId).removeClass("faded").addClass("whatif-active");
        }
        for (const path of upstreamSet) {
          cy.getElementById(path).removeClass("faded").addClass("whatif-upstream");
        }
        for (const path of downstreamSet) {
          cy.getElementById(path).removeClass("faded").addClass("whatif-downstream");
        }
      }
    });
  }, [
    highlightMode,
    graphReady,
    highlightedEdges,
    highlightedNodes,
    searchMatches,
    searchQuery,
    selectedNodeId,
    visibleNodeIds,
    whatIfSimulation,
  ]);

  useEffect(() => {
    if (!searchQuery.trim() || searchMatches.size === 0 || !cyRef.current) return;
    // A directional filter that hid every match is cleared above before this
    // effect can center. If a subset remains visible, center a visible match.
    const firstVisibleId = [...searchMatches].find((id) => visibleNodeIds.has(id));
    if (!firstVisibleId) return;
    const first = cyRef.current.getElementById(firstVisibleId);
    if (first.nonempty() && first.visible()) cyRef.current.animate({ center: { eles: first }, zoom: Math.max(cyRef.current.zoom(), 1.15) }, { duration: 180 });
  }, [graphReady, searchMatches, searchQuery, visibleNodeIds]);

  // Sync external selectedDepNodeId → internal selection
  useEffect(() => {
    if (!selectedDepNodeId || selectedDepNodeId === selectedNodeId) return;
    if (nodeById.has(selectedDepNodeId)) {
      selectNode(selectedDepNodeId);
    }
  }, [nodeById, selectNode, selectedDepNodeId, selectedNodeId]);

  const fitGraph = useCallback(() => {
    cyRef.current?.fit(cyRef.current.elements(":visible"), 44);
  }, []);

  const zoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 1.22, renderedPosition: { x: 360, y: 260 } });
  }, []);

  const zoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 0.82, renderedPosition: { x: 360, y: 260 } });
  }, []);

  // Fixed PNG export: Cytoscape's .png() returns a base64 data URL string, not a Blob
  const exportPng = useCallback(async () => {
    const cy = cyRef.current;
    if (!cy) return;

    setIsExporting(true);
    try {
      // Fit to all visible elements before export for clean capture
      cy.fit(cy.elements(":visible"), 32);

      // Small delay to let layout settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Cytoscape .png() returns a base64 data URL string
      const dataUrl = cy.png({
        output: "base64uri",
        scale: 3,
        bg: "#0d0d1a",
        full: true,
      }) as string;

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "dependency-graph.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const selectedSummary = selectedNodeId
    ? moduleSummaries[selectedNodeId]
    : null;
  const graphHasEdges = edges.length > 0;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
        <GitBranch size={36} strokeWidth={1} />
        <p className="text-sm">No dependency data available</p>
        <p className="text-xs text-white/20 text-center max-w-xs">
          Run analysis on a repository with JS, TS, or Python source files
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0F0F23] px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="text-xs text-white/40 whitespace-nowrap">
            <span className="text-white/60 font-medium">{nodes.length}</span>{" "}
            modules ·{" "}
            <span className="text-white/60 font-medium">{edges.length}</span>{" "}
            edges
            {filterMode !== "all" && visibleNodeIds.size < nodes.length && (
              <>
                {" "}
                ·{" "}
                <span className="text-blue-400/70">
                  {visibleNodeIds.size} filtered
                </span>
              </>
            )}
          </span>
          {whatIfSimulation && !selectedNodeId && (
            <span className="text-[10px] text-purple-300/70 bg-purple-500/10 border border-purple-400/20 rounded px-2 py-1 flex items-center gap-1">
              <FlaskConical size={10} />
              What-If: {whatIfSimulation.activeNodeLabel}
            </span>
          )}
          {!graphHasEdges && (
            <span className="text-[10px] text-sky-200/65 bg-sky-400/10 border border-sky-300/10 rounded px-2 py-1">
              No imports resolved — showing modules
            </span>
          )}

          {/* Filter mode buttons */}
          <div className="cv-toolbar flex items-center gap-1 p-1">
            <FilterButton
              active={filterMode === "all"}
              onClick={() => setFilterMode("all")}
              icon={<Filter size={11} />}
              label="All"
            />
            <FilterButton
              active={filterMode === "upstream"}
              onClick={() => setFilterMode("upstream")}
              icon={<ArrowUpFromLine size={11} />}
              label="Upstream"
            />
            <FilterButton
              active={filterMode === "downstream"}
              onClick={() => setFilterMode("downstream")}
              icon={<ArrowDownToLine size={11} />}
              label="Downstream"
            />
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search modules..." aria-label="Search dependency graph modules" className="w-44 bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-1.5 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/60" />
          </div>
          {searchQuery.trim() && <span className={`text-[10px] ${searchMatches.size ? "text-yellow-200/75" : "text-amber-300"}`}>{searchMatches.size ? `${searchMatches.size} match${searchMatches.size === 1 ? "" : "es"}` : "No matches"}</span>}
          {filterClearedForSearch && (
            <span className="text-[10px] text-sky-200/75">
              Filter cleared to show search results
            </span>
          )}

          <select
            value={layout}
            onChange={(event) => setLayout(event.target.value as LayoutName)}
            className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 focus:outline-none focus:border-white/20"
          >
            <option value="cose">Force (CoSE)</option>
            <option value="breadthfirst">Hierarchy</option>
            <option value="circle">Circle</option>
            <option value="grid">Grid</option>
          </select>
        </div>

        <div className="cv-toolbar flex items-center gap-1 p-1 flex-shrink-0">
          <IconButton label="Zoom out" onClick={zoomOut}>
            <ZoomOut size={14} />
          </IconButton>
          <IconButton label="Fit graph" onClick={fitGraph}>
            <Maximize2 size={14} />
          </IconButton>
          <IconButton label="Zoom in" onClick={zoomIn}>
            <ZoomIn size={14} />
          </IconButton>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={exportPng}
            disabled={isExporting}
            className="cv-button cv-button-primary px-2.5 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            {isExporting ? "Exporting…" : "PNG"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 bg-[#0d0d1a] min-w-0 min-h-0">
          <div
            ref={containerRef}
            className="absolute inset-0 h-full w-full dependency-graph-canvas"
          />

          {/* Hover tooltip */}
          {hoveredNode && (
            <div
              className="absolute z-20 flex items-center gap-1 rounded-md border border-white/10 bg-[#111827]/95 p-1 shadow-xl shadow-black/30"
              style={{
                left: hoveredNode.x + 16,
                top: hoveredNode.y - 18,
                pointerEvents: "auto",
              }}
              onMouseEnter={() => {
                containerRef.current?.classList.add("is-node-hovering");
              }}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <HoverButton
                label={`Inspect ${hoveredNode.label}`}
                onClick={() => viewFile(hoveredNode.id)}
              >
                <ScanSearch size={13} />
              </HoverButton>
              <HoverButton
                label={`Show dependencies for ${hoveredNode.label}`}
                onClick={() => {
                  selectNode(hoveredNode.id);
                  showDependencies(hoveredNode.id);
                }}
              >
                <Link2 size={13} />
              </HoverButton>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-white/30 bg-[#0d0d1a]/80 border border-white/8 rounded-md px-3 py-1.5 pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-yellow-400/70 inline-block" />
              selected
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400/70 inline-block" />
              highlighted
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-400/70 inline-block" />
              path
            </span>
            {whatIfSimulation && !selectedNodeId && (
              <>
                <span className="flex items-center gap-1 text-purple-400/70">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-purple-400/80 inline-block" />
                  what-if active
                </span>
                <span className="flex items-center gap-1 text-amber-400/70">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-400/80 inline-block" />
                  upstream
                </span>
                <span className="flex items-center gap-1 text-cyan-400/70">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400/80 inline-block" />
                  downstream
                </span>
              </>
            )}
          </div>
        </div>

        <NodeDetailsPanel
          node={selectedDetails?.node ?? null}
          incoming={selectedDetails?.incoming ?? []}
          outgoing={selectedDetails?.outgoing ?? []}
          summary={selectedSummary}
          onViewFile={viewFile}
          onShowCallers={(nodeId) => {
            selectNode(nodeId);
            showCallers(nodeId);
          }}
          onShowCallees={(nodeId) => {
            selectNode(nodeId);
            showCallees(nodeId);
          }}
          onHighlightPath={(nodeId) => {
            selectNode(nodeId);
            highlightPath(nodeId);
          }}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 bg-[#0F0F23] px-5 py-2.5 flex-shrink-0">
        <span className="text-[10px] text-white/25">
          Click to inspect · Right-click for actions · Hover for quick tools ·
          Scroll to zoom · Drag to pan
        </span>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
        active
          ? "bg-blue-600/30 text-blue-300 border border-blue-500/30"
          : "text-white/40 hover:text-white/70"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors"
    >
      {children}
    </button>
  );
}

function HoverButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-7 w-7 inline-flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}
