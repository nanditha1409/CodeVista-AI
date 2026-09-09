import { useEffect, useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Code2,
  Globe,
  Star,
  GitBranch,
  RefreshCw,
  File,
  Cpu,
  Network,
  Loader2,
  Zap,
  Activity,
  FlaskConical,
  Route as RouteIcon,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { RepoInput } from "./components/RepoInput";
import { UploadZone } from "./components/UploadZone";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { ArchitecturePanel } from "./components/ArchitecturePanel";
import { DependenciesPanel } from "./components/DependenciesPanel";
import { ExecFlowPanel } from "./components/ExecFlowPanel";
import { WhatIfPanel } from "./components/WhatIfPanel";
import { ChangePlannerPanel } from "./components/ChangePlannerPanel";
import { useFileStore } from "./stores/fileStore";
import { useAnalysisStore } from "./stores/analysisStore";
import type { MainTab } from "./types";

const TAB_PATHS: Record<MainTab, string> = {
  files: "/",
  architecture: "/architecture",
  dependencies: "/dependencies",
  "exec-flow": "/exec-flow",
  "what-if": "/what-if",
  "change-planner": "/change-planner",
};

const TOOL_TITLES: Record<Exclude<MainTab, "files">, string> = {
  architecture: "Architecture",
  dependencies: "Dependencies",
  "exec-flow": "Execution Flow",
  "what-if": "What-If Analysis",
  "change-planner": "Change Planner",
};

function tabFromPath(pathname: string): MainTab {
  return (Object.entries(TAB_PATHS).find(([, path]) => path === pathname)?.[0] as MainTab | undefined) ?? "files";
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const { repoInfo, tree, reset, sourceType } = useFileStore();
  const { clearAnalysis } = useAnalysisStore();

  const handleReset = () => {
    reset();
    clearAnalysis();
  };

  return (
    <header className="z-20 flex min-h-16 items-center justify-between gap-6 border-b border-white/10 bg-[#0b0b1a] px-6 py-3 shadow-md shadow-black/20 flex-shrink-0">
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Code2 size={20} className="text-blue-400" />
          <span className="font-bold text-white text-[18px] tracking-tight">
            Code<span className="text-blue-400">Vista</span>
            <span className="text-xs text-white/45 ml-1 font-normal">AI</span>
          </span>
        </div>
        {repoInfo && (
          <div className="flex items-center gap-2 text-xs text-white/40 min-w-0 overflow-hidden">
            {sourceType === "github" && repoInfo.url ? (
              <a
                href={repoInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 hover:bg-white/8 hover:text-white/80 transition-colors truncate"
              >
                <Globe size={12} className="flex-shrink-0" />
                <span className="truncate">
                  {repoInfo.owner}/{repoInfo.repo}
                </span>
              </a>
            ) : (
              <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 truncate">
                <GitBranch size={12} className="flex-shrink-0" />
                <span className="truncate">{repoInfo.repo}</span>
              </span>
            )}
            {sourceType === "github" && repoInfo.branch && (
              <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-white/55 flex-shrink-0">
                <GitBranch size={10} />
                {repoInfo.branch}
              </span>
            )}
            {repoInfo.stars !== undefined && (
              <span className="flex items-center gap-1 rounded-md bg-yellow-400/5 px-2 py-1 text-yellow-400/70 flex-shrink-0">
                <Star size={10} />
                {repoInfo.stars.toLocaleString()}
              </span>
            )}
            {repoInfo.totalFiles !== undefined && (
              <span className="rounded-md bg-white/5 px-2 py-1 text-white/55 flex-shrink-0">
                {repoInfo.totalFiles.toLocaleString()} files
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {tree && (
          <button
            onClick={handleReset}
            className="cv-button cv-button-ghost text-xs"
          >
            <RefreshCw size={12} />
            Reset
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ width, collapsed, onToggle, onResize }: { width: number; collapsed: boolean; onToggle: () => void; onResize: (width: number) => void }) {
  const startResize = (event: ReactMouseEvent) => {
    const startX = event.clientX;
    const startWidth = width;
    const move = (moveEvent: MouseEvent) => onResize(Math.min(480, Math.max(280, startWidth + moveEvent.clientX - startX)));
    const end = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
  };

  if (collapsed) {
    return <button onClick={onToggle} title="Expand sidebar" className="w-9 border-r border-white/10 bg-[#0D0D1F] text-white/55 hover:text-white"><PanelLeftOpen size={16} className="mx-auto" /></button>;
  }
  return (
    <aside
      className="relative flex flex-col border-r border-white/10 bg-[#0D0D1F] flex-shrink-0 overflow-hidden"
      style={{ width, minWidth: "280px", maxWidth: "480px" }}
    >
      <button onClick={onToggle} title="Collapse sidebar" className="absolute right-2 top-2 z-10 rounded p-1 text-white/45 hover:bg-white/8 hover:text-white"><PanelLeftClose size={15} /></button>
      <RepoInput />
      <UploadZone />
      <div className="flex-1 overflow-hidden bg-black/5">
        <FileTree />
      </div>
      <div onMouseDown={startResize} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/60" />
    </aside>
  );
}

// ─── Tab bar + Analyze button ─────────────────────────────────────────────────

interface TabButtonProps {
  tab: MainTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function TabButton({ tab, label, icon, badge }: TabButtonProps) {
  const navigate = useNavigate();
  const setActiveMainTab = useAnalysisStore((s) => s.setActiveMainTab);
  const active = tabFromPath(useLocation().pathname) === tab;
  return (
    <button
      onClick={() => {
        setActiveMainTab(tab);
        navigate(TAB_PATHS[tab]);
      }}
      className={`
        relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all border-b-2
        ${
          active
            ? "bg-blue-600/15 text-blue-200 border-blue-400"
            : "text-white/45 hover:text-white/80 hover:bg-white/5 border-transparent"
        }
      `}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-0.5 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-mono">
          {badge}
        </span>
      )}
    </button>
  );
}

function AnalyzeButton({ navigateOnComplete = false }: { navigateOnComplete?: boolean }) {
  const { analyzeRepo, analysisPhase, analysisStep, analysisProgress } =
    useAnalysisStore();
  const { tree } = useFileStore();
  const navigate = useNavigate();

  const isLoading = [
    "fetching",
    "parsing",
    "summarizing",
    "generating",
  ].includes(analysisPhase);

  if (!tree) return null;

  const handleAnalyze = async (forceRefresh = false) => {
    await analyzeRepo({ forceRefresh });
    if (navigateOnComplete && useAnalysisStore.getState().analysisPhase === "done") {
      navigate("/architecture");
    }
  };

  return (
      <div className="flex items-center gap-3">
      {isLoading && (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-white/35 truncate max-w-[140px] hidden sm:block">
            {analysisStep}
          </span>
        </div>
      )}
      <button
        onClick={() => void handleAnalyze(false)}
        disabled={isLoading}
        className={`
          cv-button text-xs font-semibold
          ${
            isLoading
              ? "bg-blue-600/30 text-blue-400/60 cursor-not-allowed border border-blue-500/20"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 border border-blue-500/40"
          }
        `}
      >
        {isLoading ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Analyzing…
          </>
        ) : (
          <>
            <Zap size={12} /> Analyze Architecture
          </>
        )}
      </button>
      {!isLoading && (
        <button
          onClick={() => void handleAnalyze(true)}
          title="Re-analyze and ignore cache — forces fresh AI summaries"
          className="cv-button cv-button-ghost text-[11px] text-white/40 hover:text-white/70 px-2"
        >
          <RefreshCw size={11} />
          Re-analyze
        </button>
      )}
    </div>
  );
}

// ─── Main pane ────────────────────────────────────────────────────────────────

function OllamaNotice() {
  const { ollamaAvailable, refreshOllamaStatus } = useAnalysisStore();
  const [isRetryingOllama, setIsRetryingOllama] = useState(false);
  const retryOllamaConnection = async () => {
    setIsRetryingOllama(true);
    try {
      await refreshOllamaStatus();
    } finally {
      setIsRetryingOllama(false);
    }
  };

  if (ollamaAvailable) return null;
  return (
    <div className="flex items-start gap-3 border-y border-amber-400/25 bg-amber-500/10 px-5 py-3 text-xs text-amber-100/85">
      <Info size={15} className="mt-0.5 flex-shrink-0 text-amber-300" />
      <span className="flex-1">AI summaries and change recommendations need Ollama. Run Ollama locally, or set <code className="font-mono text-amber-100">VITE_OLLAMA_URL</code> to a hosted instance; heuristic summaries remain available.</span>
      <button onClick={() => void retryOllamaConnection()} disabled={isRetryingOllama} className="cv-button cv-button-secondary flex-shrink-0 border-amber-300/30 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-400/10 disabled:opacity-50">
        <RefreshCw size={11} className={isRetryingOllama ? "animate-spin" : ""} />
        Retry connection
      </button>
    </div>
  );
}

function WorkspacePane() {
  const depNodes = useAnalysisStore((s) => s.depNodes);
  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-[#1E1E2E] min-w-0">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#141429] shadow-sm shadow-black/20 flex-shrink-0 gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <TabButton tab="files" label="Files" icon={<File size={12} />} />
          <TabButton
            tab="architecture"
            label="Architecture"
            icon={<Cpu size={12} />}
          />
          <TabButton
            tab="dependencies"
            label="Dependencies"
            icon={<Network size={12} />}
            badge={depNodes.length || undefined}
          />
          <span className="w-px h-5 bg-white/10 mx-2" />
          <TabButton
            tab="exec-flow"
            label="Exec Flow"
            icon={<Activity size={12} />}
          />
          <TabButton
            tab="what-if"
            label="What-If"
            icon={<FlaskConical size={12} />}
          />
          <TabButton
            tab="change-planner"
            label="Change Planner"
            icon={<RouteIcon size={12} />}
          />
        </div>
        <AnalyzeButton navigateOnComplete />
      </div>

      <div className="flex-1 overflow-hidden">
        <FileViewer />
      </div>
      <AnalyzePanel />
    </main>
  );
}

function ToolPageLayout({ tab, children }: { tab: Exclude<MainTab, "files">; children: React.ReactNode }) {
  const navigate = useNavigate();
  const { repoInfo } = useFileStore();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0F0F23] text-white">
      <header className="flex min-h-14 items-center gap-4 border-b border-white/10 bg-[#0b0b1a] px-5 py-3">
        <div className="flex items-center gap-2 text-[16px] font-semibold"><Code2 size={18} className="text-blue-400" />Code<span className="text-blue-400">Vista</span></div>
        {repoInfo && <span className="min-w-0 truncate text-xs text-white/45">{repoInfo.owner ? `${repoInfo.owner}/` : ""}{repoInfo.repo}{repoInfo.branch ? ` · ${repoInfo.branch}` : ""}</span>}
        <span className="hidden h-4 w-px bg-white/10 sm:block" />
        <h1 className="text-[16px] font-semibold text-white/85">{TOOL_TITLES[tab]}</h1>
        <div className="ml-auto flex items-center gap-2"><AnalyzeButton /><button onClick={() => navigate("/")} className="cv-button cv-button-ghost text-xs">← Back to workspace</button></div>
      </header>
      {(tab === "architecture" || tab === "change-planner") && <OllamaNotice />}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { fetchGitHub, tree } = useFileStore();
  const clearAnalysis = useAnalysisStore((s) => s.clearAnalysis);
  const initialLoadRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const setActiveMainTab = useAnalysisStore((s) => s.setActiveMainTab);

  useEffect(() => {
    setActiveMainTab(tabFromPath(location.pathname));
  }, [location.pathname, setActiveMainTab]);

  // Auto-load from ?repo=URL shareable links
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const repoUrl = params.get("repo");
    if (repoUrl && !tree) {
      clearAnalysis();
      fetchGitHub(decodeURIComponent(repoUrl));
    }
  }, [clearAnalysis, fetchGitHub, tree]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Filter"]',
      );
      input?.focus();
      input?.select();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Routes>
      <Route path="/" element={<div className="flex flex-col h-screen overflow-hidden bg-[#0F0F23] text-white"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar width={sidebarWidth} collapsed={sidebarCollapsed} onResize={setSidebarWidth} onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)} /><WorkspacePane /></div></div>} />
      <Route path="/files" element={<Navigate to="/" replace />} />
      <Route path="/architecture" element={<ToolPageLayout tab="architecture"><ArchitecturePanel /></ToolPageLayout>} />
      <Route path="/dependencies" element={<ToolPageLayout tab="dependencies"><DependenciesPanel /></ToolPageLayout>} />
      <Route path="/exec-flow" element={<ToolPageLayout tab="exec-flow"><ExecFlowPanel /></ToolPageLayout>} />
      <Route path="/what-if" element={<ToolPageLayout tab="what-if"><WhatIfPanel /></ToolPageLayout>} />
      <Route path="/change-planner" element={<ToolPageLayout tab="change-planner"><ChangePlannerPanel /></ToolPageLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
