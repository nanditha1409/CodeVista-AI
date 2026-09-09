import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  GitBranch,
  Layers3,
  Lightbulb,
  Network,
  Route,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAnalysisStore } from "../stores/analysisStore";
import { useFileStore } from "../stores/fileStore";
import { flattenTree } from "../lib/treeParser";
import type { FileNode } from "../types";
import type { DepEdge, DepNode } from "../lib/dependencyExtractor";
import { UmlDiagram } from "./UmlDiagram";

type Severity = "low" | "medium" | "high" | "critical";
type ChangeIntent =
  | "add-feature"
  | "move-module"
  | "create-service"
  | "replace-library"
  | "modify-api"
  | "unknown";

interface PlannerRequest {
  id: string;
  text: string;
  createdAt: string;
}

interface ChangeAnalysis {
  request: PlannerRequest;
  intent: ChangeIntent;
  targetText: string;
  targetFolder: string | null;
  matchedNodes: DepNode[];
  matchedFolders: string[];
  affectedNodes: DepNode[];
  proposal: PlanOption;
  recommendation: PlanOption;
  risks: PredictedRisk[];
  metrics: ComparisonMetric[];
  feasibility: {
    score: number;
    status: "feasible" | "risky" | "unsafe";
    confidence: number;
    summary: string;
  };
  diagrams: {
    proposalArchitecture: string;
    recommendedArchitecture: string;
    proposalDependency: string;
    recommendedDependency: string;
  };
}

interface PlanOption {
  title: string;
  summary: string;
  placement: string;
  strategy: string[];
  affected: DepNode[];
  score: number;
}

interface PredictedRisk {
  title: string;
  severity: Severity;
  confidence: number;
  detail: string;
  modules: DepNode[];
}

interface ComparisonMetric {
  label: string;
  userScore: number;
  aiScore: number;
  hint: string;
}

const EXAMPLE_PROMPTS = [
  "Add payment gateway support",
  "Move AuthService into microservices/auth",
  "Create NotificationService in services/",
  "Add abc.ts inside xyz folder",
  "Replace Redux with Zustand",
  "Add PaymentLogic directly inside Dashboard.tsx",
];

export function ChangePlannerPanel() {
  const depNodes = useAnalysisStore((s) => s.depNodes);
  const depEdges = useAnalysisStore((s) => s.depEdges);
  const analysisPhase = useAnalysisStore((s) => s.analysisPhase);
  const selectedDepNodeId = useAnalysisStore((s) => s.selectedDepNodeId);
  const setSelectedDepNodeId = useAnalysisStore((s) => s.setSelectedDepNodeId);
  const tree = useFileStore((s) => s.tree);
  const selectFile = useFileStore((s) => s.selectFile);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<PlannerRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  const allFiles = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);
  const sourceFolders = useMemo(() => collectFolders(allFiles), [allFiles]);
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

  const selectedNode =
    (selectedDepNodeId ? nodeById.get(selectedDepNodeId) : null) ??
    depNodes[0] ??
    null;

  const activeRequest =
    history.find((item) => item.id === activeRequestId) ?? history[0] ?? null;

  // Graph-based analysis runs synchronously on every request — no Ollama calls.
  const analysis = useMemo(() => {
    if (!activeRequest) return null;
    return analyzeNaturalLanguageChange({
      request: activeRequest,
      depNodes,
      depEdges,
      nodeById,
      incomingByNode,
      outgoingByNode,
      folders: sourceFolders,
      selectedNode,
    });
  }, [
    activeRequest,
    depEdges,
    depNodes,
    incomingByNode,
    nodeById,
    outgoingByNode,
    selectedNode,
    sourceFolders,
  ]);

  const contextStats = useMemo(
    () => ({
      modules: depNodes.length,
      edges: depEdges.length,
      folders: sourceFolders.length,
      highCoupling: depNodes.filter(
        (node) => node.inDegree + node.outDegree > 8,
      ).length,
    }),
    [depEdges.length, depNodes, sourceFolders.length],
  );

  const submitRequest = (event?: FormEvent) => {
    event?.preventDefault();
    const text = prompt.trim();
    if (text.length < 8) return;
    const request: PlannerRequest = {
      id: `${Date.now()}-${history.length}`,
      text,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setHistory((items) => [request, ...items].slice(0, 8));
    setActiveRequestId(request.id);
    setPrompt("");
  };

  const openFile = async (nodeId: string) => {
    if (!tree) return;
    const fileNode = allFiles.find((file) => file.path === nodeId);
    if (fileNode) {
      setSelectedDepNodeId(nodeId);
      await selectFile(fileNode);
    }
  };

  if (analysisPhase === "fetching" || analysisPhase === "parsing") {
    return (
      <EmptyState
        icon={<Route size={38} className="animate-pulse text-cyan-300/60" />}
        title="Preparing planner"
        body="The architect assistant is waiting for repository graph extraction."
      />
    );
  }

  if (depNodes.length === 0) {
    return (
      <EmptyState
        icon={
          <BrainCircuit size={42} strokeWidth={1} className="text-white/20" />
        }
        title="Change Planner not ready"
        body="Click Analyze Architecture to build the repository graph used by the change planner."
      />
    );
  }

  return (
    <div className="grid h-full grid-cols-1 overflow-auto bg-[#1E1E2E] min-[1400px]:grid-cols-[minmax(300px,22%)_minmax(0,1fr)_minmax(320px,26%)] min-[1400px]:overflow-hidden">
      <aside className="min-h-[420px] border-b border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden min-[1400px]:min-h-0 min-[1400px]:border-r min-[1400px]:border-b-0">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={16} className="text-cyan-300" />
            <span className="text-sm font-semibold text-white/90">
              Change Planner
            </span>
            {analysis && (
              <span className="ml-auto flex items-center gap-1 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
                <span className="text-sky-300/60">Graph-based analysis</span>
              </span>
            )}
          </div>
          <form onSubmit={submitRequest} className="space-y-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe a planned change..."
              className="h-24 w-full resize-none rounded-md border border-cyan-400/20 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/80 placeholder-white/25 focus:border-cyan-300/60 focus:outline-none"
            />
            {prompt.trim().length > 0 && prompt.trim().length < 8 && (
              <p className="text-[10px] text-amber-300/75">Describe the change in at least 8 characters.</p>
            )}
            <button
              type="submit"
              disabled={prompt.trim().length < 8}
              className="cv-button w-full border border-cyan-300/25 bg-cyan-500/18 px-3 py-2.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={13} />
              Analyze Change
            </button>
          </form>
        </div>

        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">
            Examples
          </p>
          <div className="space-y-1.5">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="w-full text-left rounded border border-white/8 bg-white/4 px-2.5 py-1.5 text-[11px] text-white/45 hover:text-white/75 hover:bg-white/8 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers3 size={13} className="text-purple-300/75" />
            <p className="text-xs font-semibold text-white/75">
              Repository Context
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ContextStat label="modules" value={contextStats.modules} />
            <ContextStat label="imports" value={contextStats.edges} />
            <ContextStat label="folders" value={contextStats.folders} />
            <ContextStat label="coupled" value={contextStats.highCoupling} />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={13} className="text-white/35" />
            <p className="text-xs font-semibold text-white/70">
              Request History
            </p>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-white/25 bg-white/4 border border-white/8 rounded-md p-3">
              Ask about a change to generate feasibility, risk, and diagrams.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveRequestId(item.id)}
                  className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                    activeRequest?.id === item.id
                      ? "bg-cyan-500/12 border-cyan-300/25"
                      : "bg-white/4 border-white/8 hover:bg-white/8"
                  }`}
                >
                  <span className="block text-xs text-white/75 line-clamp-2">
                    {item.text}
                  </span>
                  <span className="block text-[10px] text-white/30 mt-1">
                    {item.createdAt}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-[520px] flex flex-col min-w-0 overflow-hidden min-[1400px]:min-h-0">
        <div className="px-5 py-4 border-b border-white/10 bg-[#0F0F23]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-cyan-300/80" />
                <h1 className="text-sm font-semibold text-white/90">
                  Feasibility & Recommendation
                </h1>
              </div>
              <p className="text-xs text-white/35 mt-1 truncate">
                {activeRequest?.text ??
                  "Describe a change to start architectural planning."}
              </p>
            </div>
            {analysis && (
              <SeverityPill severity={analysis.risks[0]?.severity ?? "low"} />
            )}
          </div>
        </div>

        {!analysis ? (
          <EmptyState
            icon={<Lightbulb size={38} className="text-cyan-300/30" />}
            title="Awaiting change request"
            body="Describe the feature, refactor, file move, API change, or dependency replacement you want to evaluate."
          />
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-5">
            <section>
              <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Network size={10} />
                Computed from dependency graph
              </p>
              <div className="grid grid-cols-3 gap-3">
                <PlannerMetric
                  label="feasibility"
                  value={`${analysis.feasibility.score}%`}
                  severity={scoreToSeverity(100 - analysis.feasibility.score)}
                />
                <PlannerMetric
                  label="confidence"
                  value={`${analysis.feasibility.confidence}%`}
                  severity="low"
                />
                <PlannerMetric
                  label="affected files"
                  value={String(analysis.affectedNodes.length)}
                  severity={scoreToSeverity(analysis.affectedNodes.length * 8)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wide flex items-center gap-1.5">
                <BrainCircuit size={10} className="text-sky-400/60" />
                Graph-based analysis
              </p>

              <section className="planner-glow rounded-md border border-cyan-400/15 bg-cyan-500/6 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={14} className="text-cyan-200/80" />
                  <h2 className="text-xs font-semibold text-cyan-200/85">
                    Feasibility Verdict
                  </h2>
                </div>
                <p className="text-xs text-white/68 leading-relaxed">
                  {analysis.feasibility.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Tag label={intentLabel(analysis.intent)} tone="cyan" />
                  {analysis.targetFolder && (
                    <Tag
                      label={`folder: ${analysis.targetFolder}`}
                      tone="purple"
                    />
                  )}
                  {analysis.matchedNodes.slice(0, 3).map((node) => (
                    <button
                      key={node.id}
                      onClick={() => openFile(node.id)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/55 hover:text-white/85"
                    >
                      {node.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-4">
                <PlanCard
                  title="User Proposed Plan"
                  icon={<Zap size={14} />}
                  option={analysis.proposal}
                  tone="amber"
                />
                <PlanCard
                  title="Graph Recommendation"
                  icon={<BrainCircuit size={14} />}
                  option={analysis.recommendation}
                  tone="cyan"
                  badge="Graph-based"
                />
              </section>

              <section className="rounded-md border border-white/8 bg-white/4 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Network size={14} className="text-purple-300/80" />
                  <h2 className="text-xs font-semibold text-white/80">
                    User Plan vs Graph Recommendation
                  </h2>
                </div>
                <div className="space-y-2">
                  {analysis.metrics.map((metric) => (
                    <ComparisonRow key={metric.label} metric={metric} />
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-red-400/15 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-red-300/85" />
                  <h2 className="text-xs font-semibold text-red-100/85">
                    Risk & Failure Prediction
                  </h2>
                </div>
                <div className="space-y-2">
                  {analysis.risks.map((risk) => (
                    <RiskCard
                      key={risk.title}
                      risk={risk}
                      expanded={expandedRisk === risk.title}
                      onToggle={() =>
                        setExpandedRisk((current) =>
                          current === risk.title ? null : risk.title,
                        )
                      }
                      onOpenFile={openFile}
                    />
                  ))}
                </div>
              </section>
            </section>
          </div>
        )}
      </main>

      <aside className="min-h-[520px] border-t border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden min-[1400px]:min-h-0 min-[1400px]:border-t-0 min-[1400px]:border-l">
        <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-purple-300" />
            <span className="text-sm font-semibold text-white/90">
              Architecture Preview
            </span>
          </div>
          <p className="text-xs text-white/30 mt-1">
            Proposal and recommendation diagrams update from real repo graph
            data.
          </p>
        </div>
        {analysis ? (
          <div className="flex-1 overflow-auto planner-diagram-stack">
            <DiagramBlock
              title="User Proposed Architecture"
              diagram={analysis.diagrams.proposalArchitecture}
              exportName="planner-user-architecture"
            />
            <DiagramBlock
              title="Graph Recommended Architecture"
              diagram={analysis.diagrams.recommendedArchitecture}
              exportName="planner-graph-architecture"
            />
            <DiagramBlock
              title="User Proposed Dependencies"
              diagram={analysis.diagrams.proposalDependency}
              exportName="planner-user-dependencies"
            />
            <DiagramBlock
              title="Graph Recommended Dependencies"
              diagram={analysis.diagrams.recommendedDependency}
              exportName="planner-graph-dependencies"
            />
          </div>
        ) : (
          <EmptyState
            icon={<GitBranch size={34} className="text-white/20" />}
            title="No diagrams yet"
            body="Run a change analysis to render proposal and recommendation graphs."
          />
        )}
      </aside>
    </div>
  );
}

function analyzeNaturalLanguageChange({
  request,
  depNodes,
  depEdges,
  nodeById,
  incomingByNode,
  outgoingByNode,
  folders,
  selectedNode,
}: {
  request: PlannerRequest;
  depNodes: DepNode[];
  depEdges: DepEdge[];
  nodeById: Map<string, DepNode>;
  incomingByNode: Map<string, DepEdge[]>;
  outgoingByNode: Map<string, DepEdge[]>;
  folders: string[];
  selectedNode: DepNode | null;
}): ChangeAnalysis {
  const text = request.text.trim();
  const lower = text.toLowerCase();
  const intent = detectIntent(lower);
  const matchedNodes = matchNodes(text, depNodes);
  const matchedFolders = matchFolders(text, folders);
  const primary =
    matchedNodes[0] ?? selectedNode ?? findLikelyAnchor(intent, depNodes);
  const targetFolder =
    matchedFolders[0] ?? inferTargetFolder(lower, folders, primary) ?? null;
  const affectedNodes = collectAffectedNodes(
    primary,
    matchedNodes,
    incomingByNode,
    outgoingByNode,
    nodeById,
  );
  const couplingScore = affectedNodes.reduce(
    (sum, node) => sum + node.inDegree + node.outDegree,
    0,
  );
  const proposalPlacement = inferProposalPlacement(text, targetFolder, primary);
  const recommendedPlacement = recommendPlacement(
    intent,
    lower,
    targetFolder,
    folders,
    primary,
  );
  const riskSignals = buildRiskSignals({
    text: lower,
    intent,
    primary,
    affectedNodes,
    proposalPlacement,
    recommendedPlacement,
    couplingScore,
    depEdges,
  });
  const riskScore = clamp(
    Math.round(
      riskSignals.reduce(
        (sum, risk) => sum + severityWeight(risk.severity),
        0,
      ) *
        10 +
        affectedNodes.length * 4 +
        couplingScore,
    ),
    5,
    98,
  );
  const feasibilityScore = clamp(100 - riskScore, 12, 96);
  const confidence = clamp(
    58 +
      matchedNodes.length * 8 +
      matchedFolders.length * 7 +
      affectedNodes.length,
    60,
    94,
  );
  const proposalScore = clamp(100 - riskScore, 5, 95);
  const aiScore = clamp(proposalScore + 12 + riskSignals.length * 4, 38, 98);
  const proposal: PlanOption = {
    title: "Implement exactly as proposed",
    summary: summarizeProposal(intent, text, proposalPlacement, primary),
    placement: proposalPlacement,
    strategy: buildProposalSteps(intent, primary, affectedNodes),
    affected: affectedNodes,
    score: proposalScore,
  };
  const recommendation: PlanOption = {
    title: shouldRecommendAlternative(riskSignals)
      ? "Safer architecture recommendation"
      : "Validated implementation strategy",
    summary: summarizeRecommendation(
      intent,
      recommendedPlacement,
      primary,
      riskSignals,
    ),
    placement: recommendedPlacement,
    strategy: buildRecommendedSteps(
      intent,
      recommendedPlacement,
      primary,
      affectedNodes,
    ),
    affected: affectedNodes,
    score: aiScore,
  };
  const metrics = buildMetrics(
    proposalScore,
    aiScore,
    riskSignals,
    affectedNodes,
  );
  const status =
    feasibilityScore < 45
      ? "unsafe"
      : feasibilityScore < 70
        ? "risky"
        : "feasible";
  const diagrams = {
    proposalArchitecture: buildArchitectureDiagram({
      title: "User proposal",
      mode: "proposal",
      intent,
      requestText: text,
      placement: proposalPlacement,
      affectedNodes,
      primary,
      risks: riskSignals,
    }),
    recommendedArchitecture: buildArchitectureDiagram({
      title: "AI recommendation",
      mode: "recommendation",
      intent,
      requestText: text,
      placement: recommendedPlacement,
      affectedNodes,
      primary,
      risks: riskSignals,
    }),
    proposalDependency: buildDependencyDiagram({
      title: "User dependency impact",
      mode: "proposal",
      placement: proposalPlacement,
      affectedNodes,
      primary,
      risks: riskSignals,
      depEdges,
      nodeById,
    }),
    recommendedDependency: buildDependencyDiagram({
      title: "Recommended dependency impact",
      mode: "recommendation",
      placement: recommendedPlacement,
      affectedNodes,
      primary,
      risks: riskSignals,
      depEdges,
      nodeById,
    }),
  };

  return {
    request,
    intent,
    targetText: text,
    targetFolder,
    matchedNodes,
    matchedFolders,
    affectedNodes,
    proposal,
    recommendation,
    risks: riskSignals,
    metrics,
    feasibility: {
      score: feasibilityScore,
      status,
      confidence,
      summary: feasibilitySummary(status, intent, affectedNodes, riskSignals),
    },
    diagrams,
  };
}

function detectIntent(lower: string): ChangeIntent {
  if (/\b(replace|migrate|swap)\b/.test(lower)) return "replace-library";
  if (/\b(move|relocate|extract)\b/.test(lower)) return "move-module";
  if (/\b(service|microservice|gateway|worker)\b/.test(lower))
    return "create-service";
  if (/\b(api|endpoint|function|class|interface|contract)\b/.test(lower))
    return "modify-api";
  if (/\b(add|create|build|implement|support)\b/.test(lower))
    return "add-feature";
  return "unknown";
}

function matchNodes(text: string, nodes: DepNode[]) {
  const lower = normalize(text);
  const tokens = tokenSet(lower);
  return nodes
    .map((node) => {
      const name = normalize(node.label);
      const path = normalize(node.path);
      let score = 0;
      if (lower.includes(name)) score += 20;
      if (lower.includes(path)) score += 30;
      for (const token of tokens) {
        if (token.length < 3) continue;
        if (name.includes(token)) score += 5;
        if (path.includes(token)) score += 2;
      }
      return { node, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.node);
}

function matchFolders(text: string, folders: string[]) {
  const lower = normalize(text);
  const tokens = tokenSet(lower);
  return folders
    .map((folder) => {
      const normalized = normalize(folder);
      let score = lower.includes(normalized) ? 20 : 0;
      for (const token of tokens) {
        if (token.length > 2 && normalized.includes(token)) score += 3;
      }
      return { folder, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.folder);
}

function collectAffectedNodes(
  primary: DepNode | null,
  matchedNodes: DepNode[],
  incomingByNode: Map<string, DepEdge[]>,
  outgoingByNode: Map<string, DepEdge[]>,
  nodeById: Map<string, DepNode>,
) {
  const ids = new Set<string>();
  for (const node of matchedNodes) ids.add(node.id);
  if (primary) ids.add(primary.id);
  const seedIds = [...ids];
  for (const id of seedIds) {
    for (const edge of [
      ...(incomingByNode.get(id) ?? []),
      ...(outgoingByNode.get(id) ?? []),
    ]) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
  }
  return [...ids]
    .map((id) => nodeById.get(id))
    .filter((node): node is DepNode => Boolean(node))
    .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
    .slice(0, 14);
}

function buildRiskSignals({
  text,
  intent,
  primary,
  affectedNodes,
  proposalPlacement,
  recommendedPlacement,
  couplingScore,
  depEdges,
}: {
  text: string;
  intent: ChangeIntent;
  primary: DepNode | null;
  affectedNodes: DepNode[];
  proposalPlacement: string;
  recommendedPlacement: string;
  couplingScore: number;
  depEdges: DepEdge[];
}): PredictedRisk[] {
  const risks: PredictedRisk[] = [];
  const primaryModules = affectedNodes.slice(0, 5);

  if (
    /dashboard|component|tsx|jsx|page|view/.test(text) &&
    /logic|payment|auth|api|service/.test(text)
  ) {
    risks.push({
      title: "UI-business logic coupling",
      severity: "high",
      confidence: 86,
      detail:
        "The proposal appears to place domain or integration logic inside a UI-facing module, which makes reuse, testing, and failure isolation weaker.",
      modules: primaryModules,
    });
  }

  if (intent === "move-module" && primary && primary.inDegree > 0) {
    risks.push({
      title: "Import resolution failure",
      severity: primary.inDegree > 4 ? "critical" : "high",
      confidence: clamp(70 + primary.inDegree * 4, 72, 94),
      detail: `${primary.label} has ${primary.inDegree} caller${primary.inDegree === 1 ? "" : "s"} that may need import path updates after a move.`,
      modules: primaryModules,
    });
  }

  if (intent === "replace-library") {
    risks.push({
      title: "State or dependency migration conflict",
      severity: "high",
      confidence: 82,
      detail:
        "A dependency replacement can leave mixed state patterns, incompatible APIs, and duplicated integration code unless migrated behind a small adapter boundary.",
      modules: primaryModules,
    });
  }

  if (couplingScore > 18) {
    risks.push({
      title: "High coupling propagation",
      severity: couplingScore > 32 ? "critical" : "high",
      confidence: clamp(64 + couplingScore, 70, 96),
      detail:
        "The affected module set is highly connected, so changes may cascade across callers and downstream imports.",
      modules: primaryModules,
    });
  }

  if (proposalPlacement !== recommendedPlacement) {
    risks.push({
      title: "Suboptimal file placement",
      severity: "medium",
      confidence: 78,
      detail: `The requested placement points to ${proposalPlacement}, while the safer boundary is ${recommendedPlacement}.`,
      modules: primaryModules,
    });
  }

  if (depEdges.some((edge) => edge.source === edge.target)) {
    risks.push({
      title: "Circular dependency warning",
      severity: "medium",
      confidence: 68,
      detail:
        "The dependency graph contains a self-reference signal. New imports should avoid closing another cycle around the changed module.",
      modules: primaryModules,
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: "Low architectural risk",
      severity: "low",
      confidence: 74,
      detail:
        "No major graph-level hazards were detected. Keep the change behind clear module boundaries and verify imports with a build.",
      modules: primaryModules,
    });
  }

  return risks;
}

function buildArchitectureDiagram({
  title,
  mode,
  intent,
  requestText,
  placement,
  affectedNodes,
  primary,
  risks,
}: {
  title: string;
  mode: "proposal" | "recommendation";
  intent: ChangeIntent;
  requestText: string;
  placement: string;
  affectedNodes: DepNode[];
  primary: DepNode | null;
  risks: PredictedRisk[];
}) {
  const risky = risks.some((risk) =>
    ["high", "critical"].includes(risk.severity),
  );
  const proposedName = inferChangeNodeName(requestText, intent);
  const serviceName =
    mode === "recommendation"
      ? inferRecommendedNodeName(requestText, intent)
      : proposedName;
  const anchor = primary?.label ?? "Repository";
  const modules = affectedNodes.slice(0, 6);
  const lines = [
    "flowchart TB",
    mermaidClassDefs(),
    `  Goal["${esc(title)}<br/>${esc(intentLabel(intent))}"]:::changed`,
    `  Placement["${esc(placement)}"]:::${mode === "proposal" && risky ? "risky" : "stable"}`,
    `  Anchor["${esc(anchor)}"]:::${mode === "proposal" && risky ? "failure" : "stable"}`,
    `  Change["${esc(serviceName)}"]:::${mode === "proposal" && risky ? "risky" : "changed"}`,
    "  Goal --> Placement",
    "  Placement --> Change",
  ];

  if (mode === "recommendation") {
    lines.push(`  Boundary["Dedicated boundary / adapter"]:::stable`);
    lines.push("  Change --> Boundary");
    lines.push("  Boundary --> Anchor");
  } else {
    lines.push("  Change --> Anchor");
  }

  modules.forEach((node, index) => {
    const id = `M${index}`;
    const cls =
      mode === "proposal" && index < 3 && risky ? "failure" : "stable";
    lines.push(`  ${id}["${esc(node.label)}"]:::${cls}`);
    lines.push(`  Anchor --> ${id}`);
  });

  if (mode === "proposal" && risky) {
    lines.push(`  Warning["Scalability / runtime risk"]:::failure`);
    lines.push("  Change -. risk path .-> Warning");
  } else {
    lines.push(`  Tests["Focused tests + import validation"]:::stable`);
    lines.push("  Boundary --> Tests");
  }

  return lines.join("\n");
}

function buildDependencyDiagram({
  title,
  mode,
  placement,
  affectedNodes,
  primary,
  risks,
  depEdges,
  nodeById,
}: {
  title: string;
  mode: "proposal" | "recommendation";
  placement: string;
  affectedNodes: DepNode[];
  primary: DepNode | null;
  risks: PredictedRisk[];
  depEdges: DepEdge[];
  nodeById: Map<string, DepNode>;
}) {
  const risky = risks.some((risk) =>
    ["high", "critical"].includes(risk.severity),
  );
  const ids = new Set(affectedNodes.slice(0, 9).map((node) => node.id));
  if (primary) ids.add(primary.id);
  const relevantEdges = depEdges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .slice(0, 16);
  const idFor = (value: string) => `N${hashPath(value)}`;
  const lines = [
    "flowchart LR",
    mermaidClassDefs(),
    `  Plan["${esc(title)}"]:::changed`,
    `  NewModule["${esc(placement)}"]:::${mode === "proposal" && risky ? "risky" : "stable"}`,
    "  Plan --> NewModule",
  ];

  for (const nodeId of ids) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const cls =
      mode === "proposal" && risky && node.inDegree + node.outDegree > 3
        ? "failure"
        : "stable";
    lines.push(`  ${idFor(node.id)}["${esc(node.label)}"]:::${cls}`);
  }

  if (relevantEdges.length === 0 && primary) {
    lines.push(`  NewModule --> ${idFor(primary.id)}`);
  } else {
    for (const edge of relevantEdges) {
      lines.push(
        `  ${idFor(edge.source)} -->|"${edge.type}"| ${idFor(edge.target)}`,
      );
    }
    if (primary) {
      lines.push(
        mode === "recommendation"
          ? `  NewModule -->|"adapter call"| ${idFor(primary.id)}`
          : `  NewModule -->|"direct import"| ${idFor(primary.id)}`,
      );
    }
  }

  if (mode === "recommendation") {
    lines.push(`  Contract["Stable contract"]:::changed`);
    lines.push("  NewModule --> Contract");
  }

  return lines.join("\n");
}

function mermaidClassDefs() {
  return [
    "  classDef stable fill:#052e1a,stroke:#22c55e,color:#bbf7d0,rx:6,ry:6",
    "  classDef risky fill:#422006,stroke:#facc15,color:#fef9c3,rx:6,ry:6",
    "  classDef failure fill:#450a0a,stroke:#ef4444,color:#fecaca,rx:6,ry:6",
    "  classDef changed fill:#083344,stroke:#22d3ee,color:#cffafe,rx:6,ry:6",
  ].join("\n");
}

function buildMetrics(
  proposalScore: number,
  aiScore: number,
  risks: PredictedRisk[],
  affectedNodes: DepNode[],
): ComparisonMetric[] {
  const riskPenalty = risks.reduce(
    (sum, risk) => sum + severityWeight(risk.severity) * 5,
    0,
  );
  const couplingPenalty = affectedNodes.reduce(
    (sum, node) => sum + node.inDegree + node.outDegree,
    0,
  );
  return [
    {
      label: "Maintainability",
      userScore: clamp(proposalScore - riskPenalty / 3, 5, 96),
      aiScore,
      hint: "Higher when business logic has a clear module boundary.",
    },
    {
      label: "Scalability",
      userScore: clamp(proposalScore - couplingPenalty / 3, 5, 96),
      aiScore: clamp(aiScore + 2, 20, 98),
      hint: "Improves when new services avoid UI or shared-core congestion.",
    },
    {
      label: "Coupling",
      userScore: clamp(88 - couplingPenalty, 5, 95),
      aiScore: clamp(92 - couplingPenalty / 3, 25, 98),
      hint: "Lower coupling means fewer modules need coordinated edits.",
    },
    {
      label: "Dependency Complexity",
      userScore: clamp(82 - affectedNodes.length * 5, 5, 95),
      aiScore: clamp(88 - affectedNodes.length * 2, 25, 98),
      hint: "Adapters and service boundaries reduce import fan-out.",
    },
    {
      label: "Performance",
      userScore: clamp(proposalScore + 4, 15, 96),
      aiScore: clamp(aiScore - 1, 25, 98),
      hint: "Separation keeps expensive integration work out of render paths.",
    },
    {
      label: "Architecture Health",
      userScore: proposalScore,
      aiScore,
      hint: "Overall graph safety and future-change resilience.",
    },
    {
      label: "Failure Risk",
      userScore: clamp(100 - proposalScore, 5, 95),
      aiScore: clamp(100 - aiScore, 2, 80),
      hint: "Lower is better for this metric.",
    },
  ];
}

function buildProposalSteps(
  intent: ChangeIntent,
  primary: DepNode | null,
  affectedNodes: DepNode[],
) {
  return [
    `Apply the requested ${intentLabel(intent).toLowerCase()} in ${primary?.label ?? "the inferred target module"}.`,
    `Update imports for ${affectedNodes.length} likely affected module${affectedNodes.length === 1 ? "" : "s"}.`,
    "Run the existing build to catch missing imports and incompatible interfaces.",
  ];
}

function buildRecommendedSteps(
  intent: ChangeIntent,
  placement: string,
  primary: DepNode | null,
  affectedNodes: DepNode[],
) {
  return [
    `Create or update a focused ${intentLabel(intent).toLowerCase()} boundary at ${placement}.`,
    `Expose a narrow contract consumed by ${primary?.label ?? "the current callers"}.`,
    `Migrate ${Math.min(affectedNodes.length, 6)} affected module${affectedNodes.length === 1 ? "" : "s"} incrementally behind that contract.`,
    "Validate with build, targeted import checks, and the What-If impact diagrams.",
  ];
}

function summarizeProposal(
  intent: ChangeIntent,
  text: string,
  placement: string,
  primary: DepNode | null,
) {
  return `The user plan is interpreted as ${intentLabel(intent).toLowerCase()} for "${text}" placed around ${placement}${primary ? ` with ${primary.label} as the nearest graph anchor` : ""}.`;
}

function summarizeRecommendation(
  intent: ChangeIntent,
  placement: string,
  primary: DepNode | null,
  risks: PredictedRisk[],
) {
  const risky = shouldRecommendAlternative(risks);
  if (!risky) {
    return `The request is architecturally reasonable. Keep it in ${placement}, preserve existing import direction, and validate affected callers.`;
  }
  return `Use ${placement} as a dedicated ${intentLabel(intent).toLowerCase()} boundary${primary ? ` and connect it to ${primary.label} through a narrow contract` : ""}. This reduces coupling and keeps risky logic out of unstable paths.`;
}

function feasibilitySummary(
  status: ChangeAnalysis["feasibility"]["status"],
  intent: ChangeIntent,
  affectedNodes: DepNode[],
  risks: PredictedRisk[],
) {
  const topRisk = risks[0];
  const base = `The request maps to ${intentLabel(intent).toLowerCase()} and touches ${affectedNodes.length} likely module${affectedNodes.length === 1 ? "" : "s"} in the current dependency graph.`;
  if (status === "unsafe") {
    return `${base} It is not architecturally safe as proposed because ${topRisk.detail}`;
  }
  if (status === "risky") {
    return `${base} It is feasible, but the safer path is to use the recommendation because ${topRisk.detail}`;
  }
  return `${base} It appears feasible with low graph-level risk. Keep the implementation modular and verify imports before merging.`;
}

function inferProposalPlacement(
  text: string,
  targetFolder: string | null,
  primary: DepNode | null,
) {
  const fileMatch = text.match(/([\w.-]+\.(tsx|ts|jsx|js|py|go|java|rb|php))/i);
  if (fileMatch && targetFolder) return `${targetFolder}/${fileMatch[1]}`;
  if (fileMatch) return fileMatch[1];
  if (targetFolder) return targetFolder;
  return primary?.path ?? "repository root";
}

function recommendPlacement(
  intent: ChangeIntent,
  lower: string,
  targetFolder: string | null,
  folders: string[],
  primary: DepNode | null,
) {
  const serviceFolder =
    findFolder(folders, ["services", "service", "lib/services"]) ??
    findFolder(folders, ["src/lib", "lib", "src"]);
  const stateFolder =
    findFolder(folders, ["stores", "store", "state"]) ?? serviceFolder;
  const authFolder =
    findFolder(folders, ["auth", "authentication"]) ?? "src/services/auth";
  if (/auth/.test(lower)) return authFolder;
  if (intent === "replace-library" && /redux|zustand|state/.test(lower))
    return stateFolder ?? targetFolder ?? primary?.path ?? "src/stores";
  if (
    intent === "create-service" ||
    /payment|notification|gateway|logic/.test(lower)
  )
    return serviceFolder ?? targetFolder ?? "src/services";
  return targetFolder ?? parentPath(primary?.path) ?? serviceFolder ?? "src";
}

function inferTargetFolder(
  lower: string,
  folders: string[],
  primary: DepNode | null,
) {
  const explicit = lower.match(/\b(?:inside|into|in|under)\s+([\w./-]+)/);
  if (explicit) {
    const clean = explicit[1].replace(/[.,]$/, "");
    const matched = folders.find((folder) =>
      normalize(folder).includes(normalize(clean)),
    );
    return matched ?? clean;
  }
  return parentPath(primary?.path) ?? null;
}

function findLikelyAnchor(intent: ChangeIntent, nodes: DepNode[]) {
  const patterns =
    intent === "create-service"
      ? ["service", "api", "client"]
      : intent === "replace-library"
        ? ["store", "state", "redux", "zustand"]
        : ["app", "index", "main"];
  return (
    nodes.find((node) =>
      patterns.some((pattern) => normalize(node.path).includes(pattern)),
    ) ??
    nodes[0] ??
    null
  );
}

function inferChangeNodeName(text: string, intent: ChangeIntent) {
  const fileMatch = text.match(/([\w.-]+\.(tsx|ts|jsx|js|py|go|java|rb|php))/i);
  if (fileMatch) return fileMatch[1];
  const serviceMatch = text.match(
    /\b([A-Z][A-Za-z0-9]*(Service|Logic|API|Controller|Manager))\b/,
  );
  if (serviceMatch) return serviceMatch[1];
  if (/payment/i.test(text)) return "PaymentService";
  if (/notification/i.test(text)) return "NotificationService";
  if (/auth/i.test(text)) return "AuthService";
  return intent === "replace-library" ? "StateAdapter" : "PlannedChange";
}

function inferRecommendedNodeName(text: string, intent: ChangeIntent) {
  if (intent === "replace-library") return "StateAdapter";
  const name = inferChangeNodeName(text, intent);
  if (/Logic$/.test(name)) return name.replace(/Logic$/, "Service");
  return name.includes("Service")
    ? name
    : `${name.replace(/\.(tsx|ts|jsx|js)$/i, "")}Service`;
}

function collectFolders(files: FileNode[]) {
  const folders = new Set<string>();
  for (const file of files) {
    const parent = parentPath(file.path);
    if (parent) folders.add(parent);
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

function groupEdges(edges: DepEdge[], key: "source" | "target") {
  const map = new Map<string, DepEdge[]>();
  for (const edge of edges) {
    const list = map.get(edge[key]) ?? [];
    list.push(edge);
    map.set(edge[key], list);
  }
  return map;
}

function findFolder(folders: string[], candidates: string[]) {
  return folders.find((folder) =>
    candidates.some((candidate) =>
      normalize(folder).includes(normalize(candidate)),
    ),
  );
}

function parentPath(path?: string) {
  if (!path || !path.includes("/")) return null;
  return path.split("/").slice(0, -1).join("/");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_.-]+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

function intentLabel(intent: ChangeIntent) {
  return {
    "add-feature": "Add Feature",
    "move-module": "Move Module",
    "create-service": "Create Service",
    "replace-library": "Replace Library",
    "modify-api": "API / Interface Update",
    unknown: "General Change",
  }[intent];
}

function severityWeight(severity: Severity) {
  return { low: 1, medium: 3, high: 6, critical: 8 }[severity];
}

function scoreToSeverity(score: number): Severity {
  if (score >= 75) return "critical";
  if (score >= 48) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function shouldRecommendAlternative(risks: PredictedRisk[]) {
  return risks.some((risk) =>
    ["medium", "high", "critical"].includes(risk.severity),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function esc(value: string) {
  return value.replace(/[`"]/g, "'").replace(/[<>{}[\]#|]/g, "");
}

function hashPath(path: string) {
  let hash = 0;
  for (let i = 0; i < path.length; i++)
    hash = (hash * 31 + path.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-white/8 bg-white/4 p-2">
      <div className="text-sm font-bold text-white/80">{value}</div>
      <div className="text-[10px] uppercase text-white/30">{label}</div>
    </div>
  );
}

function PlannerMetric({
  label,
  value,
  severity,
}: {
  label: string;
  value: string;
  severity: Severity;
}) {
  const color = severityText(severity);
  return (
    <div className="planner-glow rounded-md border border-white/8 bg-white/4 p-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-white/30">
        {label}
      </div>
    </div>
  );
}

function PlanCard({
  title,
  icon,
  option,
  tone,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  option: PlanOption;
  tone: "amber" | "cyan";
  badge?: string;
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-500/6 text-cyan-200"
      : "border-amber-300/20 bg-amber-500/6 text-amber-200";
  return (
    <section className={`rounded-md border p-3 ${toneClass}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-semibold">{title}</h2>
          {badge && (
            <span className="rounded border border-white/15 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/45">
              {badge}
            </span>
          )}
        </div>
        <span className="rounded bg-black/20 px-2 py-0.5 text-[10px] font-mono">
          {option.score}/100
        </span>
      </div>
      <p className="text-xs leading-relaxed text-white/65">{option.summary}</p>
      <p className="mt-2 truncate rounded border border-white/8 bg-black/15 px-2 py-1 text-[10px] font-mono text-white/45">
        {option.placement}
      </p>
      <ul className="mt-3 space-y-1.5">
        {option.strategy.map((step) => (
          <li key={step} className="flex gap-2 text-xs text-white/55">
            <ArrowRight size={12} className="mt-0.5 flex-shrink-0" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComparisonRow({ metric }: { metric: ComparisonMetric }) {
  const lowerIsBetter = metric.label === "Failure Risk";
  const aiBetter = lowerIsBetter
    ? metric.aiScore < metric.userScore
    : metric.aiScore > metric.userScore;
  return (
    <div className="grid grid-cols-[120px_1fr_1fr_24px] items-center gap-3 text-xs">
      <div className="text-white/60" title={metric.hint}>
        {metric.label}
      </div>
      <ScoreBar value={metric.userScore} tone="amber" />
      <ScoreBar value={metric.aiScore} tone="cyan" />
      {aiBetter ? (
        <CheckCircle2 size={14} className="text-emerald-300" />
      ) : (
        <AlertTriangle size={14} className="text-amber-300" />
      )}
    </div>
  );
}

function ScoreBar({ value, tone }: { value: number; tone: "amber" | "cyan" }) {
  const color = tone === "cyan" ? "bg-cyan-300" : "bg-amber-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-white/40">{value}</span>
    </div>
  );
}

function RiskCard({
  risk,
  expanded,
  onToggle,
  onOpenFile,
}: {
  risk: PredictedRisk;
  expanded: boolean;
  onToggle: () => void;
  onOpenFile: (nodeId: string) => void;
}) {
  return (
    <div className="rounded-md border border-white/8 bg-white/4">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span
          className={`text-xs font-semibold ${severityText(risk.severity)}`}
        >
          {risk.title}
        </span>
        <span className="ml-auto rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/45">
          {risk.confidence}% confidence
        </span>
      </button>
      {expanded && (
        <div className="border-t border-white/8 px-3 py-3">
          <p className="text-xs leading-relaxed text-white/58">{risk.detail}</p>
          {risk.modules.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {risk.modules.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onOpenFile(node.id)}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50 hover:text-white/85"
                >
                  {node.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagramBlock({
  title,
  diagram,
  exportName,
}: {
  title: string;
  diagram: string;
  exportName: string;
}) {
  return (
    <section className="h-[360px] border-b border-white/8">
      <UmlDiagram diagram={diagram} title={title} exportName={exportName} />
    </section>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide ${severityPill(severity)}`}
    >
      {severity}
    </span>
  );
}

function Tag({ label, tone }: { label: string; tone: "cyan" | "purple" }) {
  const cls =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200/75"
      : "border-purple-300/20 bg-purple-400/10 text-purple-200/75";
  return (
    <span className={`rounded border px-2 py-1 text-[10px] ${cls}`}>
      {label}
    </span>
  );
}

function severityText(severity: Severity) {
  return {
    low: "text-emerald-300",
    medium: "text-amber-300",
    high: "text-orange-300",
    critical: "text-red-300",
  }[severity];
}

function severityPill(severity: Severity) {
  return {
    low: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    medium: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    high: "border-orange-300/20 bg-orange-400/10 text-orange-200",
    critical: "border-red-300/20 bg-red-400/10 text-red-200",
  }[severity];
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-white/30">
      {icon}
      <div className="text-center">
        <p className="mb-1 text-sm font-medium text-white/50">{title}</p>
        <p className="text-xs text-white/25">{body}</p>
      </div>
    </div>
  );
}
