import {
  Bot,
  Eye,
  FileCode2,
  GitPullRequestArrow,
  Network,
  Route,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DepNode } from "../lib/dependencyExtractor";
import type { ModuleSummary } from "../types";

interface NodeDetailsPanelProps {
  node: DepNode | null;
  incoming: DepNode[];
  outgoing: DepNode[];
  summary?: ModuleSummary | null;
  onViewFile: (nodeId: string) => void;
  onShowCallers: (nodeId: string) => void;
  onShowCallees: (nodeId: string) => void;
  onHighlightPath: (nodeId: string) => void;
}

export function NodeDetailsPanel({
  node,
  incoming,
  outgoing,
  summary,
  onViewFile,
  onShowCallers,
  onShowCallees,
  onHighlightPath,
}: NodeDetailsPanelProps) {
  if (!node) {
    return (
      <aside className="w-80 border-l border-white/10 bg-[#0F0F23] flex flex-col overflow-hidden flex-shrink-0">
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center text-white/30">
          <Network size={34} strokeWidth={1.4} />
          <div>
            <p className="text-sm font-medium text-white/45">Select a module</p>
            <p className="text-xs text-white/25 mt-1">
              Click a graph node to inspect callers, callees, and summary.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l border-white/10 bg-[#0F0F23] flex flex-col overflow-hidden flex-shrink-0">
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-start gap-3">
          <span
            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-4 ring-white/5"
            style={{ backgroundColor: node.color }}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/90 truncate">
              {node.label}
            </h2>
            <p className="text-[11px] text-white/35 font-mono break-all leading-relaxed mt-1">
              {node.path}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="callers" value={incoming.length} tone="blue" />
          <Stat label="callees" value={outgoing.length} tone="green" />
          <Stat label="lines" value={node.lineCount || "?"} tone="slate" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PanelButton
            icon={<Eye size={13} />}
            label="View File"
            onClick={() => onViewFile(node.id)}
          />
          <PanelButton
            icon={<Route size={13} />}
            label="Highlight"
            onClick={() => onHighlightPath(node.id)}
          />
          <PanelButton
            icon={<GitPullRequestArrow size={13} />}
            label="Callers"
            onClick={() => onShowCallers(node.id)}
          />
          <PanelButton
            icon={<FileCode2 size={13} />}
            label="Callees"
            onClick={() => onShowCallees(node.id)}
          />
        </div>

        <DependencyList
          title="Incoming dependencies"
          emptyText="No callers found"
          nodes={incoming}
          onSelect={onViewFile}
        />
        <DependencyList
          title="Outgoing dependencies"
          emptyText="No callees found"
          nodes={outgoing}
          onSelect={onViewFile}
        />

        <section className="bg-blue-600/8 border border-blue-500/15 rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={13} className="text-blue-300/80" />
            <h3 className="text-[11px] uppercase tracking-wider text-blue-300/80 font-semibold">
              AI summary
            </h3>
          </div>
          <p className="text-[12px] text-white/70 leading-relaxed">
            {summary?.summary ??
              "Summary will appear here when AI analysis is available for this module."}
          </p>
        </section>
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "green" | "slate";
}) {
  const toneClass = {
    blue: "text-sky-300",
    green: "text-emerald-300",
    slate: "text-white/75",
  }[tone];

  return (
    <div className="bg-white/5 border border-white/8 rounded-md p-2 text-center">
      <div className={`text-sm font-bold ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
    </div>
  );
}

function PanelButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-md px-2 py-2 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function DependencyList({
  title,
  emptyText,
  nodes,
  onSelect,
}: {
  title: string;
  emptyText: string;
  nodes: DepNode[];
  onSelect: (nodeId: string) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-white/35 font-semibold">
          {title}
        </h3>
        <span className="text-[10px] text-white/25">{nodes.length}</span>
      </div>
      {nodes.length === 0 ? (
        <p className="text-xs text-white/25 bg-white/4 border border-white/8 rounded-md px-3 py-2">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1.5">
          {nodes.map((depNode) => (
            <button
              key={depNode.id}
              onClick={() => onSelect(depNode.id)}
              className="w-full text-left bg-white/4 hover:bg-white/8 border border-white/8 hover:border-white/14 rounded-md px-3 py-2 transition-colors"
            >
              <span className="block text-xs text-white/75 truncate">
                {depNode.label}
              </span>
              <span className="block text-[10px] text-white/30 font-mono truncate mt-0.5">
                {depNode.path}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
