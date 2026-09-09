import { useRef, useEffect, useState } from "react";
import {
  Bot,
  FileCode2,
  AlertTriangle,
  Cpu,
  RefreshCw,
  Zap,
  Download,
  FileText,
  FlaskConical,
  X,
  ArrowUpFromLine,
  ArrowDownToLine,
  WifiOff,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAnalysisStore } from "../stores/analysisStore";
import { generateFallbackSummary, SUGGESTED_MODEL } from "../lib/ollama";
import { UmlDiagram } from "./UmlDiagram";
import type { ModuleSummary } from "../types";

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadSummariesAsTxt(summaries: ModuleSummary[], repoName: string) {
  const lines: string[] = [
    `CodeVista AI — Module Summaries`,
    `Repository: ${repoName}`,
    `Generated: ${new Date().toLocaleString()}`,
    `Total modules: ${summaries.length}`,
    "",
    "═".repeat(60),
    "",
  ];

  for (const s of summaries) {
    lines.push(`FILE: ${s.filename}`);
    lines.push(`PATH: ${s.path}`);
    lines.push(
      `LANG: ${s.language}  |  LINES: ${s.lineCount}  |  IMPORTS: ${s.importCount}  |  SOURCE: ${s.source}`,
    );
    lines.push("");
    lines.push(s.summary);
    lines.push("");
    lines.push("─".repeat(60));
    lines.push("");
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${repoName}-summaries.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadSummariesAsPng(
  containerEl: HTMLDivElement,
  summaries: ModuleSummary[],
  repoName: string,
) {
  const CARD_W = 680;
  const PADDING = 28;
  const HEADER_H = 80;
  const CARD_H = 110;
  const GAP = 12;
  const totalH = HEADER_H + summaries.length * (CARD_H + GAP) + PADDING * 2;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = CARD_W * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, CARD_W, totalH);

  // Header
  ctx.fillStyle = "#3b82f6";
  ctx.font = "bold 16px ui-monospace, monospace";
  ctx.fillText("CodeVista AI — Module Summaries", PADDING, 36);
  ctx.fillStyle = "#ffffff44";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText(
    `${repoName}  ·  ${summaries.length} modules  ·  ${new Date().toLocaleDateString()}`,
    PADDING,
    56,
  );

  // Divider
  ctx.fillStyle = "#ffffff14";
  ctx.fillRect(PADDING, 66, CARD_W - PADDING * 2, 1);

  // Cards
  let y = HEADER_H + PADDING;
  for (const s of summaries) {
    // Card bg
    ctx.fillStyle = "#1a1a2e";
    roundRect(ctx, PADDING, y, CARD_W - PADDING * 2, CARD_H, 8);
    ctx.fill();

    // Color dot
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(PADDING + 16, y + 20, 5, 0, Math.PI * 2);
    ctx.fill();

    // Filename
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.fillText(truncate(s.filename, 55), PADDING + 28, y + 24);

    // Source badge
    if (s.source === "ollama") {
      ctx.fillStyle = "#7c3aed44";
      roundRect(ctx, CARD_W - PADDING - 36, y + 10, 32, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#a78bfa";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("AI", CARD_W - PADDING - 26, y + 22);
    }

    // Path
    ctx.fillStyle = "#ffffff44";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(truncate(s.path, 72), PADDING + 28, y + 40);

    // Summary
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    const summaryLines = wrapText(ctx, s.summary, CARD_W - PADDING * 2 - 28, 2);
    summaryLines.forEach((line, i) =>
      ctx.fillText(line, PADDING + 28, y + 58 + i * 16),
    );

    // Meta
    ctx.fillStyle = "#ffffff30";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(
      `${s.lineCount} lines  ·  ${s.importCount} imports  ·  ${s.language}`,
      PADDING + 28,
      y + CARD_H - 10,
    );

    y += CARD_H + GAP;
  }

  void containerEl; // suppress unused warning

  const pngUrl = canvas.toDataURL("image/png", 1.0);
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = `${repoName}-summaries.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArchitecturePanel() {
  const {
    umlDiagram,
    moduleSummaries,
    analysisPhase,
    analysisError,
    ollamaAvailable,
    ollamaModel,
    ollamaStatus,
    ollamaStatusChecking,
    whatIfSimulation,
    setWhatIfSimulation,
    checkAndStoreOllamaStatus,
  } = useAnalysisStore();
  const summaryPanelRef = useRef<HTMLDivElement>(null);
  const [useBasicMode, setUseBasicMode] = useState(false);

  // Check Ollama status on mount
  useEffect(() => {
    if (ollamaStatus === null) {
      checkAndStoreOllamaStatus();
    }
  }, [ollamaStatus, checkAndStoreOllamaStatus]);

  const isSimulationActive = Boolean(whatIfSimulation?.simulatedDiagram);
  const activeDiagram = isSimulationActive
    ? whatIfSimulation!.simulatedDiagram!
    : umlDiagram;

  // Build the summaries list. In basic mode, fill in fallback text for empty summaries.
  const rawSummaries = Object.values(moduleSummaries).sort(
    (a, b) => b.importCount - a.importCount,
  );

  // We need file contents to generate fallback summaries — but we don't have
  // them in this panel. We build a "display" list that marks empty ones as needing AI.
  const summaries: (ModuleSummary & { needsAi?: boolean })[] = rawSummaries.map((s) => {
    if (s.summary) return s;
    if (useBasicMode) {
      // Generate pattern-based fallback from what we know (no file content here,
      // so we produce a lightweight stub using filename/lang/lines).
      const fallback = generateFallbackSummary("", s.path);
      return { ...s, summary: fallback, source: "fallback" as const };
    }
    return { ...s, needsAi: true };
  });

  const ollamaSummaries = summaries.filter((s) => s.source === "ollama").length;
  const fallbackSummaries = summaries.filter((s) => s.source === "fallback").length;

  const repoName = "codevista-export";

  const handleDownloadTxt = () => {
    if (summaries.length === 0) return;
    downloadSummariesAsTxt(summaries, repoName);
  };

  const handleDownloadPng = async () => {
    if (summaries.length === 0 || !summaryPanelRef.current) return;
    await downloadSummariesAsPng(summaryPanelRef.current, summaries, repoName);
  };

  if (analysisPhase === "error" && analysisError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40 p-8">
        <AlertTriangle size={32} className="text-red-400/70" />
        <p className="text-sm font-medium text-white/60">Analysis failed</p>
        <p className="text-xs text-white/30 text-center max-w-sm">
          {analysisError}
        </p>
      </div>
    );
  }

  if (!umlDiagram) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30 p-8">
        <Cpu size={40} strokeWidth={1} className="text-white/20" />
        <div className="text-center">
          <p className="text-sm font-medium text-white/50 mb-1">
            Architecture not yet analyzed
          </p>
          <p className="text-xs text-white/25">
            Click{" "}
            <span className="text-blue-400/70 font-mono">
              Analyze Architecture
            </span>{" "}
            to generate UML diagrams and module summaries
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: UML Diagram */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* What-If simulation banner */}
        {isSimulationActive && whatIfSimulation && (
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-purple-900/30 border-b border-purple-500/25 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FlaskConical
                size={13}
                className="text-purple-400 flex-shrink-0"
              />
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs text-purple-300/90 font-medium">
                  What-If:{" "}
                  <span className="text-purple-200">
                    {whatIfSimulation.activeNodeLabel}
                  </span>
                </span>
                <span className="text-[10px] text-purple-300/50 bg-purple-500/10 border border-purple-400/15 rounded px-1.5 py-0.5">
                  {whatIfSimulation.scenarioName} ·{" "}
                  {whatIfSimulation.impactMultiplier}x
                </span>
                <span className="flex items-center gap-1 text-[10px] text-amber-300/70">
                  <ArrowUpFromLine size={10} />
                  {whatIfSimulation.upstreamPaths.length} upstream
                </span>
                <span className="flex items-center gap-1 text-[10px] text-cyan-300/70">
                  <ArrowDownToLine size={10} />
                  {whatIfSimulation.downstreamPaths.length} downstream
                </span>
              </div>
            </div>
            <button
              onClick={() => setWhatIfSimulation(null)}
              className="cv-button flex-shrink-0 border border-purple-400/20 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-300/60 hover:bg-purple-500/20 hover:text-purple-200"
              title="Clear simulation and restore base diagram"
            >
              <X size={10} />
              Clear
            </button>
          </div>
        )}
        <UmlDiagram diagram={activeDiagram!} />
      </div>

      {/* Right: Module Summaries */}
      <div
        className="border-l border-white/10 bg-[#0D0D1F] flex flex-col overflow-hidden flex-shrink-0"
        style={{ width: "300px", minWidth: "220px", maxWidth: "360px" }}
      >
        {/* Panel header */}
        <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white/90">
                Module Summaries
              </span>
            </div>
            {/* Download buttons */}
            {summaries.length > 0 && ollamaAvailable && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDownloadTxt}
                  title="Download summaries as text file"
                  className="cv-button cv-button-secondary px-2 py-1 text-[11px]"
                >
                  <FileText size={11} />
                  TXT
                </button>
                <button
                  onClick={handleDownloadPng}
                  title="Download summaries as PNG image"
                  className="cv-button cv-button-secondary px-2 py-1 text-[11px]"
                >
                  <Download size={11} />
                  PNG
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/30">
            {ollamaAvailable ? (
              <span className="flex items-center gap-1 text-emerald-400/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Ollama · {ollamaModel?.split(":")[0] ?? "connected"}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white/25">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                {ollamaStatus === null ? "Checking…" : "Ollama offline"}
              </span>
            )}
            {ollamaSummaries > 0 && (
              <span className="text-purple-400/60">
                {ollamaSummaries} AI · {fallbackSummaries} auto
              </span>
            )}
          </div>
        </div>

        {/* Ollama unavailable — blocking state */}
        {!ollamaAvailable && ollamaStatus !== null && summaries.length > 0 && (
          <OllamaRequiredBanner
            ollamaStatus={ollamaStatus}
            checking={ollamaStatusChecking}
            useBasicMode={useBasicMode}
            onRetry={() => checkAndStoreOllamaStatus(true)}
            onToggleBasicMode={() => setUseBasicMode((v) => !v)}
          />
        )}

        {/* Summaries list */}
        {summaries.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-white/20">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-xs">Generating summaries…</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto" ref={summaryPanelRef}>
            {summaries.map((summary) => (
              <SummaryCard
                key={summary.path}
                summary={summary}
                showAiRequired={!ollamaAvailable && !useBasicMode && !summary.summary}
              />
            ))}
          </div>
        )}

        {summaries.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
            <p className="text-[10px] text-white/20 text-center">
              {summaries.length} modules · sorted by import count
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ollama required banner ───────────────────────────────────────────────────

interface OllamaRequiredBannerProps {
  ollamaStatus: import("../lib/ollama").OllamaStatus;
  checking: boolean;
  useBasicMode: boolean;
  onRetry: () => void;
  onToggleBasicMode: () => void;
}

function OllamaRequiredBanner({
  ollamaStatus,
  checking,
  useBasicMode,
  onRetry,
  onToggleBasicMode,
}: OllamaRequiredBannerProps) {
  const modelMissing = ollamaStatus.available && !ollamaStatus.model;

  return (
    <div className="mx-3 my-3 rounded-md border border-amber-400/20 bg-amber-500/6 p-3 flex-shrink-0">
      <div className="flex items-start gap-2 mb-2">
        <WifiOff size={13} className="text-amber-400/80 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-200/85">
            {modelMissing ? "No model found" : "Ollama required"}
          </p>
          {modelMissing ? (
            <p className="text-[11px] text-amber-100/60 mt-0.5 leading-relaxed">
              Ollama is running but no supported model is pulled. Run:
              <code className="block mt-1 px-2 py-1 bg-black/30 rounded text-amber-100/80 text-[10px] font-mono">
                ollama pull {SUGGESTED_MODEL}
              </code>
            </p>
          ) : (
            <p className="text-[11px] text-amber-100/60 mt-0.5 leading-relaxed">
              Module summaries require a running Ollama instance at{" "}
              <code className="text-amber-100/80 font-mono text-[10px]">
                {ollamaStatus.baseUrl}
              </code>
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={checking}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] rounded border border-amber-400/20 bg-amber-500/10 text-amber-200/80 hover:bg-amber-500/20 px-2 py-1.5 transition-colors disabled:opacity-50 mb-2"
      >
        {checking ? (
          <RefreshCw size={11} className="animate-spin" />
        ) : (
          <RefreshCw size={11} />
        )}
        Retry connection
      </button>
      <button
        onClick={onToggleBasicMode}
        className="w-full flex items-center justify-between text-[11px] rounded border border-white/10 bg-white/4 text-white/50 hover:bg-white/8 px-2 py-1.5 transition-colors"
        title="Use pattern-based analysis without AI"
      >
        <span className="flex items-center gap-1.5">
          {useBasicMode ? (
            <ToggleRight size={13} className="text-amber-400" />
          ) : (
            <ToggleLeft size={13} />
          )}
          Use basic offline analysis
        </span>
        <span className="text-[10px] text-white/30">no AI, pattern-based</span>
      </button>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  summary: ModuleSummary & { needsAi?: boolean };
  showAiRequired?: boolean;
}

function SummaryCard({ summary, showAiRequired }: SummaryCardProps) {
  return (
    <div className="border-b border-white/10 px-4 py-4 hover:bg-white/3 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCode2 size={11} className="text-white/30 flex-shrink-0" />
          <span
            className="text-xs font-medium text-white/80 truncate"
            title={summary.path}
          >
            {summary.filename}
          </span>
        </div>
        {summary.source === "ollama" && (
          <span className="text-[9px] text-purple-400/70 bg-purple-500/10 border border-purple-500/20 rounded px-1 py-0.5 flex-shrink-0 flex items-center gap-1">
            <Zap size={8} />
            AI
          </span>
        )}
        {summary.source === "fallback" && summary.summary && (
          <span className="text-[9px] text-amber-400/60 bg-amber-500/8 border border-amber-500/15 rounded px-1 py-0.5 flex-shrink-0">
            Pattern-based, not AI-generated
          </span>
        )}
      </div>
      {showAiRequired || (!summary.summary && !showAiRequired) ? (
        <p className="text-[11px] text-white/25 italic leading-relaxed mb-2">
          Ollama required for summary
        </p>
      ) : (
        <p className="text-[11px] text-white/55 leading-relaxed mb-2">
          {summary.summary}
        </p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-white/25">
        <span className="font-mono">
          {summary.lineCount.toLocaleString()} lines
        </span>
        <span>{summary.importCount} imports</span>
        <span
          className="px-1 py-0.5 rounded text-[9px]"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {summary.language}
        </span>
      </div>
    </div>
  );
}
