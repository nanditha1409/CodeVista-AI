import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownUp,
  Activity,
  Cpu,
  FileCode2,
  FlaskConical,
  GitCompare,
  GitBranch,
  Lightbulb,
  Search,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useAnalysisStore } from "../stores/analysisStore";
import { useFileStore } from "../stores/fileStore";
import { flattenTree } from "../lib/treeParser";
import { generateMermaidDiagram } from "../lib/mermaidRenderer";
import { UmlDiagram } from "./UmlDiagram";
import type { DepEdge, DepNode } from "../lib/dependencyExtractor";

interface ModificationScenario {
  name: string;
  description: string;
  impactMultiplier: number;
}

const SCENARIOS: ModificationScenario[] = [
  {
    name: "Minor Refactor",
    description: "Small internal changes",
    impactMultiplier: 0.3,
  },
  {
    name: "API Change",
    description: "Public interface modification",
    impactMultiplier: 0.7,
  },
  {
    name: "Major Rewrite",
    description: "Significant structural changes",
    impactMultiplier: 1.0,
  },
  {
    name: "Breaking Change",
    description: "Incompatible modifications",
    impactMultiplier: 1.5,
  },
];

export function WhatIfPanel() {
  const depNodes = useAnalysisStore((s) => s.depNodes);
  const depEdges = useAnalysisStore((s) => s.depEdges);
  const analysisPhase = useAnalysisStore((s) => s.analysisPhase);
  const selectedDepNodeId = useAnalysisStore((s) => s.selectedDepNodeId);
  const setSelectedDepNodeId = useAnalysisStore((s) => s.setSelectedDepNodeId);
  const setWhatIfSimulation = useAnalysisStore((s) => s.setWhatIfSimulation);
  const moduleSummaries = useAnalysisStore((s) => s.moduleSummaries);
  const umlDiagram = useAnalysisStore((s) => s.umlDiagram);
  const tree = useFileStore((s) => s.tree);
  const selectFile = useFileStore((s) => s.selectFile);
  const navigate = useNavigate();
  const preserveSimulationRef = useRef(false);

  const [query, setQuery] = useState("");
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] =
    useState<ModificationScenario>(SCENARIOS[1]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonNodeId, setComparisonNodeId] = useState<string | null>(null);
  const [simulationAction, setSimulationAction] = useState<"modify" | "remove">("modify");

  const nodeById = useMemo(
    () => new Map(depNodes.map((node) => [node.id, node])),
    [depNodes],
  );
  const incomingByNode = useMemo(
    () => groupEdges(depEdges, "target"),
    [depEdges],
  );
  const outgoingByNode = useMemo(
    () => groupEdges(depEdges, "source"),
    [depEdges],
  );

  const sortedNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...depNodes]
      .filter(
        (node) =>
          !q ||
          node.label.toLowerCase().includes(q) ||
          node.path.toLowerCase().includes(q),
      )
      .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
      .slice(0, 80);
  }, [depNodes, query]);

  const activeNodeId =
    localSelectedId ?? selectedDepNodeId ?? sortedNodes[0]?.id ?? null;
  const activeNode = activeNodeId ? (nodeById.get(activeNodeId) ?? null) : null;

  const impact = useMemo(
    () =>
      calculateImpact(
        activeNodeId,
        nodeById,
        incomingByNode,
        outgoingByNode,
        selectedScenario.impactMultiplier,
      ),
    [
      activeNodeId,
      incomingByNode,
      nodeById,
      outgoingByNode,
      selectedScenario.impactMultiplier,
    ],
  );

  const comparisonImpact = useMemo(
    () =>
      comparisonMode && comparisonNodeId
        ? calculateImpact(
            comparisonNodeId,
            nodeById,
            incomingByNode,
            outgoingByNode,
            selectedScenario.impactMultiplier,
          )
        : null,
    [
      comparisonMode,
      comparisonNodeId,
      incomingByNode,
      nodeById,
      outgoingByNode,
      selectedScenario.impactMultiplier,
    ],
  );

  const summary = activeNodeId ? moduleSummaries[activeNodeId] : null;
  const simulatedEdges = useMemo(() => {
    if (!activeNode) return depEdges;
    return simulationAction === "remove"
      ? depEdges.filter((edge) => edge.source !== activeNode.id && edge.target !== activeNode.id)
      : depEdges;
  }, [activeNode, depEdges, simulationAction]);
  const simulatedNodeIds = useMemo(
    () => new Set(simulationAction === "remove" && activeNode ? depNodes.filter((node) => node.id !== activeNode.id).map((node) => node.id) : depNodes.map((node) => node.id)),
    [activeNode, depNodes, simulationAction],
  );

  const visualDiagrams = useMemo(() => {
    if (!activeNode) return null;

    const impactedIds = new Set([
      activeNode.id,
      ...impact.upstream.map((node) => node.id),
      ...impact.downstream.map((node) => node.id),
    ]);

    const baseArchitecture =
      umlDiagram ??
      (tree ? generateMermaidDiagram(tree, depEdges) : null);
    const simulatedArchitecture = tree
      ? generateMermaidDiagram(tree, simulatedEdges, {
          active: activeNode.id,
          upstream: new Set(impact.upstream.map((node) => node.id)),
          downstream: new Set(impact.downstream.map((node) => node.id)),
          hiddenNodePaths: simulationAction === "remove" ? new Set([activeNode.id]) : undefined,
        })
      : null;

    return {
      baseArchitecture,
      simulatedArchitecture,
      dependencyBefore: generateDependencyImpactDiagram({
        activeNode,
        depEdges,
        nodeById,
        impactedIds,
        mode: "before",
        scenarioName: selectedScenario.name,
        impactMultiplier: selectedScenario.impactMultiplier,
      }),
      dependencyAfter: generateDependencyImpactDiagram({
        activeNode,
        depEdges: simulatedEdges,
        nodeById,
        impactedIds: new Set([...impactedIds].filter((id) => simulatedNodeIds.has(id))),
        mode: "after",
        scenarioName: selectedScenario.name,
        impactMultiplier: selectedScenario.impactMultiplier,
        hiddenNodeIds: simulationAction === "remove" ? new Set([activeNode.id]) : undefined,
      }),
    };
  }, [
    activeNode,
    depEdges,
    impact.downstream,
    impact.upstream,
    nodeById,
    selectedScenario.impactMultiplier,
    selectedScenario.name,
    simulatedEdges,
    simulationAction,
    simulatedNodeIds,
    tree,
    umlDiagram,
  ]);

  // ── Sync simulation → architecture diagram ──────────────────────────────
  useEffect(() => {
    if (!activeNode || !tree) {
      setWhatIfSimulation(null);
      return;
    }

    const upstreamPaths = impact.upstream.map((n) => n.id);
    const downstreamPaths = impact.downstream.map((n) => n.id);

    // Regenerate the mermaid diagram with highlights applied
    const simulatedDiagram = generateMermaidDiagram(tree, simulatedEdges, {
      active: activeNode.id,
      upstream: new Set(upstreamPaths),
      downstream: new Set(downstreamPaths),
      hiddenNodePaths: simulationAction === "remove" ? new Set([activeNode.id]) : undefined,
    });

    setWhatIfSimulation({
      activeNodeId: activeNode.id,
      activeNodeLabel: activeNode.label,
      scenarioName: selectedScenario.name,
      impactMultiplier: selectedScenario.impactMultiplier,
      upstreamPaths,
      downstreamPaths,
      simulatedDiagram,
    });
  }, [
    activeNode,
    selectedScenario,
    simulationAction,
    impact,
    tree,
    simulatedEdges,
    setWhatIfSimulation,
  ]);

  // Clear simulation when this panel unmounts
  useEffect(() => {
    return () => {
      if (!preserveSimulationRef.current) setWhatIfSimulation(null);
    };
  }, [setWhatIfSimulation]);

  const viewInArchitecture = () => {
    preserveSimulationRef.current = true;
    navigate("/architecture");
  };

  const chooseNode = (nodeId: string) => {
    if (comparisonMode && !comparisonNodeId) {
      setComparisonNodeId(nodeId);
    } else {
      setLocalSelectedId(nodeId);
      setSelectedDepNodeId(nodeId);
      if (comparisonMode) {
        setComparisonNodeId(null);
      }
    }
  };

  const toggleComparison = () => {
    setComparisonMode(!comparisonMode);
    setComparisonNodeId(null);
  };

  const openFile = async (nodeId: string) => {
    if (!tree) return;
    const fileNode = flattenTree(tree).find((file) => file.path === nodeId);
    if (fileNode) await selectFile(fileNode);
  };

  if (analysisPhase === "fetching" || analysisPhase === "parsing") {
    return (
      <EmptyPanel
        icon={
          <FlaskConical
            size={32}
            className="animate-pulse text-purple-400/60"
          />
        }
        title="Preparing impact analysis"
        body="Parsing dependency relationships…"
      />
    );
  }

  if (depNodes.length === 0) {
    return (
      <EmptyPanel
        icon={
          <FlaskConical size={40} strokeWidth={1} className="text-white/20" />
        }
        title="What-If analysis not ready"
        body="Click Analyze Architecture to calculate module impact."
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-[#1E1E2E] min-[1100px]:flex-row min-[1100px]:overflow-hidden">
      {/* Left sidebar: Module selector */}
      <aside className="min-h-[360px] w-full border-b border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden flex-shrink-0 min-[1100px]:min-h-0 min-[1100px]:w-80 min-[1100px]:border-r min-[1100px]:border-b-0">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={15} className="text-purple-400" />
            <span className="text-sm font-semibold text-white/90">
              What-If Scenarios
            </span>
          </div>
          <div className="relative mb-3">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules..."
              className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-2 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-purple-400/60"
            />
          </div>
          <button
            onClick={toggleComparison}
            className={`cv-button w-full text-xs ${
              comparisonMode
                ? "bg-amber-600/20 text-amber-300 border border-amber-500/30"
                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/8"
            }`}
          >
            <GitCompare size={13} />
            {comparisonMode ? "Comparison Mode Active" : "Enable Comparison"}
          </button>
        </div>
        <div className="max-h-72 overflow-auto p-3 min-[1100px]:max-h-none min-[1100px]:flex-1">
          {sortedNodes.length === 0 ? (
            <p className="px-3 py-4 text-xs text-white/35 text-center">No modules match “{query.trim()}”.</p>
          ) : sortedNodes.map((node) => {
            const isActive = activeNodeId === node.id;
            const isComparison = comparisonNodeId === node.id;
            return (
              <button
                key={node.id}
                onClick={() => chooseNode(node.id)}
                className={`w-full text-left rounded-md border px-3 py-2.5 mb-2 transition-colors ${
                  isActive
                    ? "bg-purple-600/15 border-purple-500/30"
                    : isComparison
                      ? "bg-amber-600/15 border-amber-500/30"
                      : "bg-white/4 border-white/10 hover:bg-white/8"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="block text-xs text-white/80 truncate flex-1">
                    {node.label}
                  </span>
                  {isComparison && (
                    <span className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/15 rounded px-1.5 py-0.5">
                      B
                    </span>
                  )}
                </div>
                <span className="block text-[10px] text-white/30 font-mono truncate mt-0.5">
                  {node.inDegree} callers · {node.outDegree} callees
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <section className="min-h-[680px] flex-1 flex flex-col min-w-0 min-[1100px]:min-h-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0F0F23]">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-300/80" />
                <span className="text-sm font-semibold text-white/90">
                  {activeNode
                    ? `Impact: ${activeNode.label}`
                    : "Select a module"}
                </span>
              </div>
              <p className="text-xs text-white/35 mt-1 truncate">
                {activeNode?.path ?? "No module selected"}
              </p>
            </div>
            {activeNode && (
            <div className="cv-toolbar flex items-center gap-1 p-1 flex-shrink-0">
                <button
                  onClick={viewInArchitecture}
                  className="cv-button border border-purple-500/25 bg-purple-600/15 px-2.5 py-1.5 text-xs text-purple-300/80 hover:bg-purple-600/25 hover:text-purple-200"
                  title="View simulation in Architecture diagram"
                >
                  <Cpu size={12} />
                  Architecture
                </button>
                <button
                  onClick={() => openFile(activeNode.id)}
                  className="cv-button cv-button-secondary px-2.5 py-1.5 text-xs"
                >
                  <FileCode2 size={12} />
                  View File
                </button>
              </div>
            )}
          </div>

          {/* Scenario selector */}
          <div className="cv-toolbar flex items-center gap-2 p-2">
            <Sliders size={13} className="text-white/40 flex-shrink-0" />
            <div className="flex gap-1 flex-1 overflow-x-auto">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.name}
                  onClick={() => setSelectedScenario(scenario)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-md transition-colors ${
                    selectedScenario.name === scenario.name
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                      : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/8"
                  }`}
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-2">
            <button onClick={() => setSimulationAction("modify")} className={`text-[10px] px-2 py-1 rounded border ${simulationAction === "modify" ? "border-purple-400/40 text-purple-200 bg-purple-500/15" : "border-white/10 text-white/45"}`}>Modify module</button>
            <button onClick={() => setSimulationAction("remove")} className={`text-[10px] px-2 py-1 rounded border ${simulationAction === "remove" ? "border-red-400/40 text-red-200 bg-red-500/15" : "border-white/10 text-white/45"}`}>Remove module</button>
          </div>
        </div>

        {!activeNode ? (
          <EmptyPanel
            icon={
              <ArrowDownUp
                size={34}
                strokeWidth={1}
                className="text-white/20"
              />
            }
            title="No module selected"
            body="Choose a module to inspect upstream and downstream impact."
          />
        ) : (
          <div className="flex-1 overflow-auto p-5">
            {/* Impact stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <ImpactStat
                label="direct callers"
                value={impact.directCallers.length}
                comparison={comparisonImpact?.directCallers.length}
                tone="blue"
              />
              <ImpactStat
                label="direct callees"
                value={impact.directCallees.length}
                comparison={comparisonImpact?.directCallees.length}
                tone="green"
              />
              <ImpactStat
                label="upstream risk"
                value={impact.upstream.length}
                comparison={comparisonImpact?.upstream.length}
                tone="amber"
              />
              <ImpactStat
                label="downstream touch"
                value={impact.downstream.length}
                comparison={comparisonImpact?.downstream.length}
                tone="purple"
              />
            </div>

            {/* Scenario description */}
            <section className="bg-purple-600/8 border border-purple-500/15 rounded-md p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={13} className="text-purple-300/80" />
                <h2 className="text-xs font-semibold text-purple-300/80">
                  Scenario: {selectedScenario.name}
                </h2>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                {selectedScenario.description}. Impact multiplier:{" "}
                <span className="font-mono text-purple-300">
                  {selectedScenario.impactMultiplier}x
                </span>
              </p>
              <p className="text-xs text-white/55 leading-relaxed">
                {summary?.summary ??
                  "No module summary available. Run analysis to generate AI-powered insights."}
              </p>
            </section>

            {visualDiagrams && (
              <VisualImpactMaps
                architectureBefore={visualDiagrams.baseArchitecture}
                architectureAfter={visualDiagrams.simulatedArchitecture}
                dependencyBefore={visualDiagrams.dependencyBefore}
                dependencyAfter={visualDiagrams.dependencyAfter}
                activeNode={activeNode}
                scenario={selectedScenario}
                upstreamCount={impact.upstream.length}
                downstreamCount={impact.downstream.length}
              />
            )}

            {/* Comparison view */}
            {comparisonMode && comparisonImpact && comparisonNodeId && (
              <section className="bg-amber-600/8 border border-amber-500/15 rounded-md p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitCompare size={13} className="text-amber-300/80" />
                  <h2 className="text-xs font-semibold text-amber-300/80">
                    Comparing with: {nodeById.get(comparisonNodeId)?.label}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/40">Upstream difference:</span>
                    <span
                      className={`ml-2 font-mono ${getDiffColor(impact.upstream.length - comparisonImpact.upstream.length)}`}
                    >
                      {formatDiff(
                        impact.upstream.length -
                          comparisonImpact.upstream.length,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40">
                      Downstream difference:
                    </span>
                    <span
                      className={`ml-2 font-mono ${getDiffColor(impact.downstream.length - comparisonImpact.downstream.length)}`}
                    >
                      {formatDiff(
                        impact.downstream.length -
                          comparisonImpact.downstream.length,
                      )}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Impact lists */}
            <div className="grid grid-cols-2 gap-4">
              <ImpactList
                title="Upstream modules to retest"
                emptyText="No upstream callers were resolved."
                nodes={impact.upstream}
                highlightedNodes={
                  comparisonImpact
                    ? getUnique(impact.upstream, comparisonImpact.upstream)
                    : new Set()
                }
                onOpen={openFile}
              />
              <ImpactList
                title="Downstream modules to inspect"
                emptyText="No downstream dependencies were resolved."
                nodes={impact.downstream}
                highlightedNodes={
                  comparisonImpact
                    ? getUnique(impact.downstream, comparisonImpact.downstream)
                    : new Set()
                }
                onOpen={openFile}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function groupEdges(edges: DepEdge[], key: "source" | "target") {
  const map = new Map<string, DepEdge[]>();
  for (const edge of edges) {
    const list = map.get(edge[key]) ?? [];
    list.push(edge);
    map.set(edge[key], list);
  }
  return map;
}

function calculateImpact(
  nodeId: string | null,
  nodeById: Map<string, DepNode>,
  incomingByNode: Map<string, DepEdge[]>,
  outgoingByNode: Map<string, DepEdge[]>,
  multiplier: number,
) {
  const directCallers = collectDirect(
    nodeId,
    incomingByNode,
    nodeById,
    "source",
  );
  const directCallees = collectDirect(
    nodeId,
    outgoingByNode,
    nodeById,
    "target",
  );

  // Apply multiplier to transitive closure depth
  const maxNodes = Math.floor(60 * multiplier);

  return {
    directCallers,
    directCallees,
    upstream: collectTransitive(
      nodeId,
      incomingByNode,
      nodeById,
      "source",
      maxNodes,
    ),
    downstream: collectTransitive(
      nodeId,
      outgoingByNode,
      nodeById,
      "target",
      maxNodes,
    ),
  };
}

function collectDirect(
  nodeId: string | null,
  edgeMap: Map<string, DepEdge[]>,
  nodeById: Map<string, DepNode>,
  edgeField: "source" | "target",
) {
  if (!nodeId) return [];
  return (edgeMap.get(nodeId) ?? [])
    .map((edge) => nodeById.get(edge[edgeField]))
    .filter((node): node is DepNode => Boolean(node));
}

function collectTransitive(
  nodeId: string | null,
  edgeMap: Map<string, DepEdge[]>,
  nodeById: Map<string, DepNode>,
  edgeField: "source" | "target",
  maxNodes: number,
) {
  if (!nodeId) return [];
  const result: DepNode[] = [];
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0 && result.length < maxNodes) {
    const current = queue.shift();
    if (!current) continue;
    for (const edge of edgeMap.get(current) ?? []) {
      const nextId = edge[edgeField];
      if (visited.has(nextId)) continue;
      const node = nodeById.get(nextId);
      if (!node) continue;
      visited.add(nextId);
      result.push(node);
      queue.push(nextId);
      if (result.length >= maxNodes) break;
    }
  }

  return result;
}

function getUnique(listA: DepNode[], listB: DepNode[]): Set<string> {
  const idsB = new Set(listB.map((n) => n.id));
  return new Set(listA.filter((n) => !idsB.has(n.id)).map((n) => n.id));
}

function getDiffColor(diff: number): string {
  if (diff > 0) return "text-red-400";
  if (diff < 0) return "text-green-400";
  return "text-white/40";
}

function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "0";
}

function generateDependencyImpactDiagram({
  activeNode,
  depEdges,
  nodeById,
  impactedIds,
  mode,
  scenarioName,
  impactMultiplier,
  hiddenNodeIds = new Set<string>(),
}: {
  activeNode: DepNode;
  depEdges: DepEdge[];
  nodeById: Map<string, DepNode>;
  impactedIds: Set<string>;
  mode: "before" | "after";
  scenarioName: string;
  impactMultiplier: number;
  hiddenNodeIds?: Set<string>;
}) {
  const nodeIds = new Set<string>();
  if (!hiddenNodeIds.has(activeNode.id)) nodeIds.add(activeNode.id);
  const relevantEdges = depEdges
    .filter(
      (edge) =>
        !hiddenNodeIds.has(edge.source) &&
        !hiddenNodeIds.has(edge.target) &&
        (edge.source === activeNode.id ||
          edge.target === activeNode.id ||
          (impactedIds.has(edge.source) && impactedIds.has(edge.target))),
    )
    .slice(0, 36);

  for (const edge of relevantEdges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  const idFor = (path: string) => `D${hashPath(path)}`;
  const isBreakingScenario =
    scenarioName === "Breaking Change" || impactMultiplier >= 1;

  const lines = [
    "flowchart LR",
    "  classDef stable fill:#052e1a,stroke:#22c55e,color:#bbf7d0,rx:6,ry:6",
    "  classDef risky fill:#422006,stroke:#facc15,color:#fef9c3,rx:6,ry:6",
    "  classDef failure fill:#450a0a,stroke:#ef4444,color:#fecaca,rx:6,ry:6",
    "  classDef changed fill:#2e1065,stroke:#c084fc,color:#f3e8ff,rx:6,ry:6",
    "  classDef muted fill:#111827,stroke:#475569,color:#94a3b8,rx:6,ry:6",
  ];

  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const suffix =
      mode === "after" && node.id === activeNode.id
        ? "modified"
        : mode === "after" && impactedIds.has(node.id)
          ? isBreakingScenario
            ? "failure risk"
            : "impact risk"
          : "stable";
    lines.push(`  ${idFor(node.id)}["${escMermaidLabel(node.label)}<br/>${suffix}"]`);
  }

  if (relevantEdges.length === 0 && !hiddenNodeIds.has(activeNode.id)) {
    lines.push(`  ${idFor(activeNode.id)} --> ${idFor(activeNode.id)}`);
  } else if (relevantEdges.length === 0) {
    lines.push(`  Removed["${escMermaidLabel(activeNode.label)} removed"]`);
    lines.push("  class Removed muted");
  } else {
    for (const edge of relevantEdges) {
      const label =
        mode === "after" && impactedIds.has(edge.source) && impactedIds.has(edge.target)
          ? isBreakingScenario
            ? "possible break"
            : "impact path"
          : edge.type;
      lines.push(
        `  ${idFor(edge.source)} -->|"${escMermaidLabel(label)}"| ${idFor(edge.target)}`,
      );
    }
  }

  for (const nodeId of nodeIds) {
    const className =
      mode === "before"
        ? nodeId === activeNode.id
          ? "changed"
          : "stable"
        : nodeId === activeNode.id
          ? "changed"
          : impactedIds.has(nodeId)
            ? isBreakingScenario
              ? "failure"
              : "risky"
            : "stable";
    lines.push(`  class ${idFor(nodeId)} ${className}`);
  }

  return lines.join("\n");
}

function hashPath(path: string) {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = (hash * 31 + path.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function escMermaidLabel(value: string) {
  return value.replace(/[`"]/g, "'").replace(/[<>{}[\]#|]/g, "");
}

// ─── Components ───────────────────────────────────────────────────────────────

interface VisualImpactMapsProps {
  architectureBefore: string | null;
  architectureAfter: string | null;
  dependencyBefore: string;
  dependencyAfter: string;
  activeNode: DepNode;
  scenario: ModificationScenario;
  upstreamCount: number;
  downstreamCount: number;
}

function VisualImpactMaps({
  architectureBefore,
  architectureAfter,
  dependencyBefore,
  dependencyAfter,
  activeNode,
  scenario,
  upstreamCount,
  downstreamCount,
}: VisualImpactMapsProps) {
  const predictsFailure =
    scenario.name === "Breaking Change" ||
    scenario.impactMultiplier >= 1 ||
    upstreamCount + downstreamCount > 20;

  return (
    <section className="mb-4 border border-cyan-400/15 bg-cyan-500/5 rounded-md overflow-hidden what-if-visual-maps">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/8 bg-[#0F0F23]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={13} className="text-cyan-300/80" />
          <h2 className="text-xs font-semibold text-cyan-200/80">
            Visual Impact Maps
          </h2>
          <span className="text-[10px] text-white/35 truncate">
            {activeNode.label} · {scenario.name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/35 flex-shrink-0">
          <LegendDot tone="stable" label="stable" />
          <LegendDot tone="risky" label="impacted" />
          <LegendDot tone="failure" label="likely break" />
        </div>
      </div>

      {predictsFailure && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/8 border-b border-red-400/15 text-[11px] text-red-200/80">
          <AlertTriangle size={12} className="text-red-300" />
          Predicted failure paths are highlighted in red. Hover the diagrams to inspect rendered nodes and edge labels.
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-white/8">
        <DiagramFrame
          icon={<Cpu size={12} />}
          title="Architecture Before"
          diagram={architectureBefore}
          exportName="what-if-architecture-before"
        />
        <DiagramFrame
          icon={<Cpu size={12} />}
          title="Architecture After"
          diagram={architectureAfter}
          exportName="what-if-architecture-after"
          changed
        />
        <DiagramFrame
          icon={<GitBranch size={12} />}
          title="Dependencies Before"
          diagram={dependencyBefore}
          exportName="what-if-dependencies-before"
        />
        <DiagramFrame
          icon={<Activity size={12} />}
          title="Dependency Impact After"
          diagram={dependencyAfter}
          exportName="what-if-dependencies-after"
          changed
        />
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/8 text-[11px]">
        <FailureChip
          label="Possible runtime failure"
          active={predictsFailure}
        />
        <FailureChip
          label="Dependency mismatch"
          active={downstreamCount > 0 && scenario.impactMultiplier >= 0.7}
        />
        <FailureChip
          label="Circular dependency warning"
          active={upstreamCount > 0 && downstreamCount > 0}
        />
      </div>
    </section>
  );
}

function DiagramFrame({
  icon,
  title,
  diagram,
  exportName,
  changed = false,
}: {
  icon: React.ReactNode;
  title: string;
  diagram: string | null;
  exportName: string;
  changed?: boolean;
}) {
  return (
    <div className="bg-[#0d0d1a] min-h-[360px] h-[360px] flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/8 bg-[#111126]">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className={changed ? "text-amber-300" : "text-emerald-300"}>
            {icon}
          </span>
          {title}
        </div>
        {changed && (
          <span className="what-if-pulse text-[10px] text-amber-200/80 border border-amber-300/20 bg-amber-400/10 rounded px-1.5 py-0.5">
            changed
          </span>
        )}
      </div>
      {diagram ? (
        <UmlDiagram diagram={diagram} title={title} exportName={exportName} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-white/30">
          Diagram data unavailable
        </div>
      )}
    </div>
  );
}

function LegendDot({
  tone,
  label,
}: {
  tone: "stable" | "risky" | "failure";
  label: string;
}) {
  const color = {
    stable: "bg-emerald-400",
    risky: "bg-amber-300",
    failure: "bg-red-400",
  }[tone];

  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function FailureChip({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`px-3 py-2 ${
        active ? "bg-red-500/8 text-red-200/75" : "bg-[#0F0F23] text-white/30"
      }`}
      title={active ? label : "No current signal from this What-If scenario"}
    >
      {label}
    </div>
  );
}

interface ImpactStatProps {
  label: string;
  value: number;
  comparison?: number;
  tone: "blue" | "green" | "amber" | "purple";
}

function ImpactStat({ label, value, comparison, tone }: ImpactStatProps) {
  const toneClass = {
    blue: "text-sky-300",
    green: "text-emerald-300",
    amber: "text-amber-300",
    purple: "text-purple-300",
  }[tone];

  const diff = comparison !== undefined ? value - comparison : null;

  return (
    <div className="bg-white/4 border border-white/8 rounded-md p-3">
      <div className="flex items-baseline gap-2">
        <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
        {diff !== null && diff !== 0 && (
          <span className={`text-xs font-mono ${getDiffColor(diff)}`}>
            {formatDiff(diff)}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-white/30 mt-1">
        {label}
      </div>
    </div>
  );
}

interface ImpactListProps {
  title: string;
  emptyText: string;
  nodes: DepNode[];
  highlightedNodes: Set<string>;
  onOpen: (nodeId: string) => void;
}

function ImpactList({
  title,
  emptyText,
  nodes,
  highlightedNodes,
  onOpen,
}: ImpactListProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-white/75">{title}</h3>
        <span className="text-[10px] text-white/25">{nodes.length}</span>
      </div>
      {nodes.length === 0 ? (
        <p className="text-xs text-white/25 bg-white/4 border border-white/8 rounded-md px-3 py-3">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-auto">
          {nodes.map((node) => {
            const isHighlighted = highlightedNodes.has(node.id);
            return (
              <button
                key={node.id}
                onClick={() => onOpen(node.id)}
                className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                  isHighlighted
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-white/4 hover:bg-white/8 border-white/8 hover:border-white/14"
                }`}
              >
                <span className="block text-xs text-white/75 truncate">
                  {node.label}
                </span>
                <span className="block text-[10px] text-white/30 font-mono truncate mt-0.5">
                  {node.path}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30 p-8">
      {icon}
      <div className="text-center">
        <p className="text-sm font-medium text-white/50 mb-1">{title}</p>
        <p className="text-xs text-white/25">{body}</p>
      </div>
    </div>
  );
}
