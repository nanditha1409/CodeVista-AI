import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileCode2,
  GitBranch,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Route,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useAnalysisStore } from "../stores/analysisStore";
import { useFileStore } from "../stores/fileStore";
import { flattenTree } from "../lib/treeParser";
import type { DepEdge, DepNode } from "../lib/dependencyExtractor";

interface FlowStep {
  node: DepNode;
  depth: number;
  via?: DepEdge;
  description: string;
  inCycle?: boolean;
}
type StepStatus = "pending" | "active" | "success" | "failed";
interface AnimState {
  currentStep: number;
  stepStatuses: StepStatus[];
  isPlaying: boolean;
  speed: number;
}

export function ExecFlowPanel() {
  const depNodes = useAnalysisStore((s) => s.depNodes);
  const depEdges = useAnalysisStore((s) => s.depEdges);
  const analysisPhase = useAnalysisStore((s) => s.analysisPhase);
  const selectedDepNodeId = useAnalysisStore((s) => s.selectedDepNodeId);
  const setSelectedDepNodeId = useAnalysisStore((s) => s.setSelectedDepNodeId);
  const moduleSummaries = useAnalysisStore((s) => s.moduleSummaries);
  const tree = useFileStore((s) => s.tree);
  const selectFile = useFileStore((s) => s.selectFile);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  const nodeById = useMemo(
    () => new Map(depNodes.map((n) => [n.id, n])),
    [depNodes],
  );
  const outgoingByNode = useMemo(
    () => groupEdges(depEdges, "source"),
    [depEdges],
  );
  const incomingByNode = useMemo(
    () => groupEdges(depEdges, "target"),
    [depEdges],
  );

  const entryNodes = useMemo(
    () =>
      [...depNodes]
        .sort((a, b) => {
          const sa =
            (a.inDegree === 0 ? 100 : 0) + a.outDegree * 4 + a.lineCount / 200;
          const sb =
            (b.inDegree === 0 ? 100 : 0) + b.outDegree * 4 + b.lineCount / 200;
          return sb - sa;
        })
        .slice(0, 12),
    [depNodes],
  );

  const activeNodeId =
    localSelectedId ?? selectedDepNodeId ?? entryNodes[0]?.id ?? null;
  const flow = useMemo(
    () => buildStaticImportFlow(activeNodeId, nodeById, outgoingByNode, moduleSummaries),
    [activeNodeId, nodeById, outgoingByNode, moduleSummaries],
  );

  const [anim, setAnim] = useState<AnimState>({
    currentStep: -1,
    stepStatuses: [],
    isPlaying: false,
    speed: 800,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnim({
      currentStep: -1,
      stepStatuses: flow.map(() => "pending"),
      isPlaying: false,
      speed: 800,
    });
  }, [flow]);

  useEffect(() => {
    if (!anim.isPlaying) return;
    if (anim.currentStep >= flow.length - 1) {
      setAnim((p) => ({ ...p, isPlaying: false }));
      return;
    }
    timerRef.current = setTimeout(() => {
      setAnim((p) => {
        const next = p.currentStep + 1;
        const s = [...p.stepStatuses];
        if (p.currentStep >= 0) s[p.currentStep] = "success";
        if (next < flow.length) s[next] = "active";
        return { ...p, currentStep: next, stepStatuses: s };
      });
    }, anim.speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [anim.isPlaying, anim.currentStep, anim.speed, flow.length]);

  const play = useCallback(
    () =>
      setAnim((p) => ({
        ...p,
        isPlaying: true,
        currentStep: p.currentStep === flow.length - 1 ? -1 : p.currentStep,
        stepStatuses:
          p.currentStep === flow.length - 1
            ? flow.map(() => "pending")
            : p.stepStatuses,
      })),
    [flow.length],
  );

  const pause = useCallback(
    () => setAnim((p) => ({ ...p, isPlaying: false })),
    [],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnim({
      currentStep: -1,
      stepStatuses: flow.map(() => "pending"),
      isPlaying: false,
      speed: 800,
    });
  }, [flow]);

  const jumpTo = useCallback(
    (idx: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAnim((p) => ({
        ...p,
        isPlaying: false,
        currentStep: idx,
        stepStatuses: flow.map((_, i) =>
          i < idx ? "success" : i === idx ? "active" : "pending",
        ),
      }));
    },
    [flow],
  );

  const openFile = useCallback(
    async (nodeId: string) => {
      if (!tree) return;
      const f = flattenTree(tree).find((x) => x.path === nodeId);
      if (f) {
        await selectFile(f);
        setSelectedDepNodeId(nodeId);
      }
    },
    [selectFile, setSelectedDepNodeId, tree],
  );

  if (analysisPhase === "fetching" || analysisPhase === "parsing")
    return (
      <EmptyPanel
        icon={<Cpu size={30} className="animate-pulse text-blue-400/60" />}
        title="Building import traversal"
        body="Parsing imports and source relationships to simulate dependency paths..."
      />
    );
  if (depNodes.length === 0)
    return (
      <EmptyPanel
        icon={<Activity size={40} strokeWidth={1} className="text-white/20" />}
        title="Import flow not ready"
        body="Click Analyze Architecture to derive simulated import paths from the dependency graph."
      />
    );

  const activeStep =
    anim.currentStep >= 0 && anim.currentStep < flow.length
      ? flow[anim.currentStep]
      : null;
  const hasResolvableImports = Boolean(
    activeNodeId && (outgoingByNode.get(activeNodeId)?.some((edge) => nodeById.has(edge.target)) ?? false),
  );

  return (
    <div className="flex h-full flex-col overflow-auto bg-[#1E1E2E] min-[1100px]:flex-row min-[1100px]:overflow-hidden">
      <aside className="min-h-[320px] w-full border-b border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden flex-shrink-0 min-[1100px]:min-h-0 min-[1100px]:w-72 min-[1100px]:border-r min-[1100px]:border-b-0">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Route size={15} className="text-sky-400" />
            <span className="text-sm font-semibold text-white/90">
              Entry Points
            </span>
          </div>
          <p className="text-xs text-white/40 mt-1">
            Select a module to simulate import-graph traversal (not a runtime
            call stack)
          </p>
        </div>
        <div className="max-h-64 overflow-auto p-3 min-[1100px]:max-h-none min-[1100px]:flex-1">
          {entryNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                setLocalSelectedId(node.id);
                setSelectedDepNodeId(node.id);
              }}
              className={`w-full text-left rounded-md border px-3 py-2.5 mb-2 transition-colors ${activeNodeId === node.id ? "bg-blue-600/15 border-blue-500/40" : "bg-white/4 border-white/10 hover:bg-white/8"}`}
            >
              <span className="block text-xs text-white/80 truncate">
                {node.label}
              </span>
              <span className="block text-[10px] text-white/30 font-mono truncate mt-0.5">
                {node.outDegree} imports ·{" "}
                {incomingByNode.get(node.id)?.length ?? 0} importers
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-[620px] flex-1 flex flex-col min-w-0 min-[1100px]:min-h-0">
        <div className="px-5 py-4 border-b border-white/10 bg-[#0F0F23] flex items-center justify-between gap-5 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-blue-400" />
              <span className="text-sm font-semibold text-white/90">
                Import Graph Traversal
              </span>
              <span
                className="text-[11px] text-white/45 border border-white/10 rounded px-1.5 py-0.5 cursor-help"
                title="This panel simulates walking the static import graph — it does not execute code or capture a real runtime call stack."
              >
                Simulated · not runtime
              </span>
            </div>
            <p className="text-xs text-white/35 mt-0.5 truncate">
              {activeNodeId ?? "No module selected"}
            </p>
          </div>
          {flow.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-white/30 font-mono tabular-nums">
                {anim.currentStep + 1} / {flow.length}
              </span>
              <div className="cv-toolbar flex items-center gap-0.5 p-0.5">
                {anim.isPlaying ? (
                  <CtrlBtn
                    onClick={pause}
                    title="Pause"
                    cls="text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Pause size={14} fill="currentColor" />
                  </CtrlBtn>
                ) : (
                  <CtrlBtn
                    onClick={play}
                    title="Play"
                    cls="text-green-400 hover:bg-green-500/10"
                  >
                    <Play size={14} fill="currentColor" />
                  </CtrlBtn>
                )}
                <CtrlBtn
                  onClick={() =>
                    jumpTo(Math.min(anim.currentStep + 1, flow.length - 1))
                  }
                  title="Next step"
                  cls="text-white/40 hover:text-white/80 hover:bg-white/8"
                >
                  <SkipForward size={14} />
                </CtrlBtn>
                <CtrlBtn
                  onClick={reset}
                  title="Reset"
                  cls="text-white/40 hover:text-white/80 hover:bg-white/8"
                >
                  <RefreshCw size={14} />
                </CtrlBtn>
              </div>
              <select
                value={anim.speed}
                onChange={(e) =>
                  setAnim((p) => ({ ...p, speed: Number(e.target.value) }))
                }
                className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 focus:outline-none focus:border-white/20"
              >
                <option value={300}>Fast</option>
                <option value={800}>Normal</option>
                <option value={1400}>Slow</option>
              </select>
            </div>
          )}
        </div>
        {flow.length === 0 ? (
          <EmptyPanel
            icon={
              <GitBranch size={34} strokeWidth={1} className="text-white/20" />
            }
            title="No downstream flow found"
            body="Select another entry point or run analysis on a repo with resolvable imports."
          />
        ) : (
          <div className="flex-1 overflow-auto p-5">
            <div className="max-w-3xl mx-auto">
              {!hasResolvableImports && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/75">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-300" />
                  No resolvable imports were found for this module. Showing its static entry only; external or unresolved imports are intentionally not invented as flow steps.
                </div>
              )}
              {flow.map((step, idx) => (
                <PipelineStep
                  key={step.node.id}
                  step={step}
                  index={idx}
                  status={anim.stepStatuses[idx] ?? "pending"}
                  isLast={idx === flow.length - 1}
                  onClickBadge={() => jumpTo(idx)}
                  onClickCard={() => openFile(step.node.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {activeStep && (
        <aside className="min-h-[420px] w-full border-t border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden flex-shrink-0 min-[1100px]:min-h-0 min-[1100px]:w-72 min-[1100px]:border-t-0 min-[1100px]:border-l">
          <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileCode2 size={15} className="text-purple-400" />
              <span className="text-sm font-semibold text-white/90">
                Step Details
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1.5">
                Module
              </p>
              <div className="bg-white/5 border border-white/8 rounded-md p-3">
                <p className="text-sm text-white/85 font-medium truncate">
                  {activeStep.node.label}
                </p>
                <p className="text-[10px] text-white/30 font-mono mt-1 break-all leading-relaxed">
                  {activeStep.node.path}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1.5">
                What is happening
              </p>
              <p className="text-xs text-white/70 leading-relaxed bg-white/5 border border-white/8 rounded-md p-3">
                {activeStep.description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Lines"
                value={activeStep.node.lineCount || "—"}
              />
              <MiniStat label="Outgoing" value={activeStep.node.outDegree} />
              <MiniStat label="Incoming" value={activeStep.node.inDegree} />
              <MiniStat label="Depth" value={activeStep.depth} />
            </div>
            {activeStep.via && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1.5">
                  Import type
                </p>
                <span className="inline-block text-xs text-blue-300 font-mono bg-blue-500/10 border border-blue-500/20 rounded px-2.5 py-1">
                  {activeStep.via.type}
                </span>
              </div>
            )}
            <button
              onClick={() => openFile(activeStep.node.id)}
              className="cv-button cv-button-primary w-full text-xs"
            >
              <FileCode2 size={13} />
              View Source File
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

function PipelineStep({
  step,
  index,
  status,
  isLast,
  onClickBadge,
  onClickCard,
}: {
  step: FlowStep;
  index: number;
  status: StepStatus;
  isLast: boolean;
  onClickBadge: () => void;
  onClickCard: () => void;
}) {
  const cfg = {
    pending: {
      icon: <div className="w-3 h-3 rounded-full border-2 border-white/20" />,
      label: "text-white/35",
      bg: "bg-white/4",
      border: "border-white/8",
    },
    active: {
      icon: <Loader2 size={13} className="animate-spin text-yellow-400" />,
      label: "text-yellow-300",
      bg: "bg-yellow-500/8",
      border: "border-yellow-500/30",
    },
    success: {
      icon: <CheckCircle2 size={13} className="text-green-400" />,
      label: "text-green-300",
      bg: "bg-green-500/8",
      border: "border-green-500/25",
    },
    failed: {
      icon: <XCircle size={13} className="text-red-400" />,
      label: "text-red-300",
      bg: "bg-red-500/8",
      border: "border-red-500/25",
    },
  }[status];
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
        <button
          onClick={onClickBadge}
          title="Jump to step"
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
          style={{
            borderColor: step.node.color,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {cfg.icon}
        </button>
        {!isLast && (
          <div
            className={`w-px h-8 transition-colors ${status === "success" ? "bg-green-500/35" : "bg-white/10"}`}
          />
        )}
      </div>
      <button
        onClick={onClickCard}
        className={`flex-1 min-w-0 text-left rounded-md border px-3 py-2.5 transition-all hover:border-white/20 ${cfg.bg} ${cfg.border}`}
        style={{ marginLeft: `${Math.min(step.depth, 4) * 14}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 mb-0.5">
          <span className="text-[10px] font-mono text-white/30 flex-shrink-0">
            #{index + 1}
          </span>
          <span className={`text-sm font-medium truncate ${cfg.label}`}>
            {step.node.label}
          </span>
          {step.via && (
            <span className="ml-auto flex-shrink-0 text-[9px] text-blue-300/70 bg-blue-500/10 border border-blue-500/15 rounded px-1.5 py-0.5">
              {step.via.type}
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/30 font-mono truncate mb-1">
          {step.node.path}
        </p>
        <p className="text-xs text-white/55 leading-relaxed line-clamp-2">
          {step.description}
        </p>
      </button>
    </div>
  );
}

function CtrlBtn({
  onClick,
  title,
  cls,
  children,
}: {
  onClick: () => void;
  title: string;
  cls: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-md p-2 text-center">
      <div className="text-sm font-bold text-white/75">{value}</div>
      <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
    </div>
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

function groupEdges(edges: DepEdge[], key: "source" | "target") {
  const map = new Map<string, DepEdge[]>();
  for (const edge of edges) {
    const list = map.get(edge[key]) ?? [];
    list.push(edge);
    map.set(edge[key], list);
  }
  return map;
}

export function buildStaticImportFlow(
  startId: string | null,
  nodeById: Map<string, DepNode>,
  outgoingByNode: Map<string, DepEdge[]>,
  moduleSummaries: Record<string, { summary: string }>,
): FlowStep[] {
  if (!startId) return [];
  const start = nodeById.get(startId);
  if (!start) return [];
  const reachable = new Set<string>([startId]);
  const depth = new Map<string, number>([[startId, 0]]);
  const via = new Map<string, DepEdge>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of outgoingByNode.get(id) ?? []) {
      if (!nodeById.has(edge.target) || reachable.has(edge.target)) continue;
      reachable.add(edge.target);
      depth.set(edge.target, (depth.get(id) ?? 0) + 1);
      via.set(edge.target, edge);
      queue.push(edge.target);
    }
  }
  // A plain Kahn sort leaves every member of a cycle behind. Condense strongly
  // connected components first so all reachable modules remain in a valid
  // topological order between cycle groups.
  const ordered = topologicallyOrderReachable(reachable, outgoingByNode, depth);
  return ordered.flatMap(({ id, inCycle }) => {
    const node = nodeById.get(id);
    if (!node) return [];
    const edge = via.get(id) ?? null;
    return [{ node, depth: depth.get(id) ?? 0, via: edge ?? undefined, inCycle,
      description: `${inCycle ? "Circular import detected. " : ""}${describe(node, edge, moduleSummaries)}` }];
  });
}

function topologicallyOrderReachable(
  reachable: Set<string>,
  outgoingByNode: Map<string, DepEdge[]>,
  depth: Map<string, number>,
): Array<{ id: string; inCycle: boolean }> {
  const adjacency = new Map<string, string[]>();
  for (const id of reachable) {
    adjacency.set(id, (outgoingByNode.get(id) ?? []).map((edge) => edge.target).filter((target) => reachable.has(target)));
  }
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, index); lowlinks.set(id, index++); stack.push(id); onStack.add(id);
    for (const target of adjacency.get(id) ?? []) {
      if (!indices.has(target)) { visit(target); lowlinks.set(id, Math.min(lowlinks.get(id)!, lowlinks.get(target)!)); }
      else if (onStack.has(target)) lowlinks.set(id, Math.min(lowlinks.get(id)!, indices.get(target)!));
    }
    if (lowlinks.get(id) === indices.get(id)) {
      const component: string[] = [];
      let member: string;
      do { member = stack.pop()!; onStack.delete(member); component.push(member); } while (member !== id);
      components.push(component);
    }
  };
  for (const id of reachable) if (!indices.has(id)) visit(id);

  const componentFor = new Map<string, number>();
  components.forEach((component, componentId) => component.forEach((id) => componentFor.set(id, componentId)));
  const componentEdges = new Map<number, Set<number>>();
  const inDegree = new Map<number, number>(components.map((_, id) => [id, 0]));
  for (const [source, targets] of adjacency) {
    const from = componentFor.get(source)!;
    for (const target of targets) {
      const to = componentFor.get(target)!;
      if (from === to) continue;
      const nextTargets = componentEdges.get(from) ?? new Set<number>();
      if (!nextTargets.has(to)) { nextTargets.add(to); componentEdges.set(from, nextTargets); inDegree.set(to, (inDegree.get(to) ?? 0) + 1); }
    }
  }
  const componentKey = (id: number) => Math.min(...components[id].map((nodeId) => depth.get(nodeId) ?? 0));
  const compareComponents = (a: number, b: number) => componentKey(a) - componentKey(b) || a - b;
  const ready = components.map((_, id) => id).filter((id) => inDegree.get(id) === 0).sort(compareComponents);
  const result: Array<{ id: string; inCycle: boolean }> = [];
  while (ready.length) {
    const componentId = ready.shift()!;
    const component = components[componentId];
    const inCycle = component.length > 1 || (adjacency.get(component[0]) ?? []).includes(component[0]);
    for (const id of [...component].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0) || a.localeCompare(b))) result.push({ id, inCycle });
    for (const target of componentEdges.get(componentId) ?? []) {
      const next = (inDegree.get(target) ?? 0) - 1;
      inDegree.set(target, next);
      if (next === 0) ready.push(target);
    }
    ready.sort(compareComponents);
  }
  return result;
}

function describe(
  node: DepNode,
  edge: DepEdge | null,
  moduleSummaries: Record<string, { summary: string }>,
): string {
  const cached = moduleSummaries[node.id];
  if (cached?.summary) return cached.summary;
  const via = edge ? `Imported via ${edge.type}.` : "Entry point.";
  const lang = node.language;
  const lines = node.lineCount;
  if (lang === "TypeScript" || lang === "TSX")
    return `${via} TypeScript module (${lines} lines) — processes data and exports typed interfaces.`;
  if (lang === "JavaScript" || lang === "JSX")
    return `${via} JavaScript module (${lines} lines) — static import-graph context for its component and export surface.`;
  if (lang === "Python")
    return `${via} Python module (${lines} lines) — defines classes, functions, and utilities.`;
  if (lang === "CSS" || lang === "SCSS")
    return `${via} Stylesheet (${lines} lines) — defines visual styling and layout rules.`;
  return `${via} ${lang} file (${lines} lines) with ${node.outDegree} outgoing dependencies.`;
}
