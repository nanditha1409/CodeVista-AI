import { create } from "zustand";
import type {
  MainTab,
  ModuleSummary,
  AnalysisPhase,
  AnalysisCache,
} from "../types";
import type { DepNode, DepEdge } from "../lib/dependencyExtractor";
import { useFileStore } from "./fileStore";
import { fetchFileContent } from "../lib/octokit";
import { getZipFileContent } from "../lib/zipParser";
import { flattenTree } from "../lib/treeParser";
import {
  isLikelyGeneratedPath,
  isSourceFile,
  extractImports,
} from "../lib/astParser";
import { buildDependencyGraph } from "../lib/dependencyExtractor";
import { generateMermaidDiagram } from "../lib/mermaidRenderer";
import { countSourceLines } from "../lib/lineCounter";
import {
  checkOllamaStatus,
  resetOllamaStatusCache,
  summarizeModule,
  type OllamaStatus,
} from "../lib/ollama";

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = "codevista_analysis_v1_";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function getCacheKey(owner: string, repo: string, branch: string, revision?: string) {
  return `${CACHE_KEY_PREFIX}${owner}_${repo}_${branch}_${revision ?? "unknown"}`;
}

function loadFromCache(key: string): AnalysisCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisCache;
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveToCache(key: string, data: AnalysisCache) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* storage full — silently skip */
  }
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface WhatIfSimulationState {
  activeNodeId: string;
  activeNodeLabel: string;
  scenarioName: string;
  impactMultiplier: number;
  upstreamPaths: string[];
  downstreamPaths: string[];
  simulatedDiagram: string | null;
}

interface AnalysisState {
  // Tabs
  activeMainTab: MainTab;
  setActiveMainTab: (tab: MainTab) => void;

  // Phase 2 analysis state
  analysisPhase: AnalysisPhase;
  analysisProgress: number;
  analysisStep: string;
  analysisError: string | null;
  ollamaAvailable: boolean;
  ollamaModel: string | null;

  /** Full Ollama status — null means not yet checked */
  ollamaStatus: OllamaStatus | null;
  ollamaStatusChecking: boolean;

  // Results
  umlDiagram: string | null;
  depNodes: DepNode[];
  depEdges: DepEdge[];
  moduleSummaries: Record<string, ModuleSummary>;

  // Selected dependency node
  selectedDepNodeId: string | null;
  setSelectedDepNodeId: (id: string | null) => void;

  // What-If simulation overlay
  whatIfSimulation: WhatIfSimulationState | null;
  setWhatIfSimulation: (sim: WhatIfSimulationState | null) => void;

  // Actions
  analyzeRepo: (opts?: { forceRefresh?: boolean }) => Promise<void>;
  refreshOllamaStatus: () => Promise<void>;
  /** Force-checks Ollama status, bypassing the TTL cache */
  checkAndStoreOllamaStatus: (force?: boolean) => Promise<OllamaStatus>;
  clearAnalysis: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

const MAX_FILES_TO_SUMMARIZE = 25;
const FETCH_BATCH = 6;

export const useAnalysisStore = create<AnalysisState>((set) => ({
  // Tabs
  activeMainTab: "files",
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),

  // Analysis
  analysisPhase: "idle",
  analysisProgress: 0,
  analysisStep: "",
  analysisError: null,
  ollamaAvailable: false,
  ollamaModel: null,
  ollamaStatus: null,
  ollamaStatusChecking: false,

  // Results
  umlDiagram: null,
  depNodes: [],
  depEdges: [],
  moduleSummaries: {},

  selectedDepNodeId: null,
  setSelectedDepNodeId: (id) => set({ selectedDepNodeId: id }),

  whatIfSimulation: null,
  setWhatIfSimulation: (sim) => set({ whatIfSimulation: sim }),

  refreshOllamaStatus: async () => {
    resetOllamaStatusCache();
    const status = await checkOllamaStatus();
    set({
      ollamaAvailable: status.available,
      ollamaModel: status.model,
      ollamaStatus: status,
    });
  },

  checkAndStoreOllamaStatus: async (force = false) => {
    if (force) resetOllamaStatusCache();
    set({ ollamaStatusChecking: true });
    const status = await checkOllamaStatus();
    set({
      ollamaAvailable: status.available,
      ollamaModel: status.model,
      ollamaStatus: status,
      ollamaStatusChecking: false,
    });
    return status;
  },

  clearAnalysis: () =>
    set({
      analysisPhase: "idle",
      analysisProgress: 0,
      analysisStep: "",
      analysisError: null,
      umlDiagram: null,
      depNodes: [],
      depEdges: [],
      moduleSummaries: {},
      selectedDepNodeId: null,
      whatIfSimulation: null,
      activeMainTab: "files",
    }),

  analyzeRepo: async (opts = {}) => {
    resetOllamaStatusCache();

    const fileStoreState = useFileStore.getState();
    const { tree, repoInfo, sourceType } = fileStoreState;

    if (!tree) {
      set({
        analysisError:
          "No repository loaded. Please load a GitHub URL or ZIP first.",
      });
      return;
    }

    const allFiles = flattenTree(tree);
    const sourceFiles = allFiles.filter(
      (f) => isSourceFile(f.name) && !isLikelyGeneratedPath(f.path),
    );

    const fetchSourceContents = async () => {
      set({
        analysisPhase: "fetching",
        analysisStep: `Fetching ${sourceFiles.length} source files…`,
        analysisProgress: 5,
      });

      const contents: Record<string, string> = {
        ...useFileStore.getState().fileContents,
      };
      const unfetched = sourceFiles
        .filter((f) => !contents[f.path])
        .slice(0, 150); // cap at 150 files

      for (let i = 0; i < unfetched.length; i += FETCH_BATCH) {
        const batch = unfetched.slice(i, i + FETCH_BATCH);
        await Promise.all(
          batch.map(async (file) => {
            try {
              if (sourceType === "github" && repoInfo) {
                contents[file.path] = await fetchFileContent(
                  repoInfo.owner,
                  repoInfo.repo,
                  repoInfo.branch,
                  file.path,
                );
              } else if (sourceType === "zip") {
                contents[file.path] =
                  (await getZipFileContent(file.path)) ?? "";
              }
            } catch {
              /* skip inaccessible files */
            }
          }),
        );
        const pct =
          5 +
          Math.round(((i + FETCH_BATCH) / Math.max(unfetched.length, 1)) * 40);
        set({
          analysisProgress: Math.min(pct, 45),
          analysisStep: `Fetching files… (${Math.min(i + FETCH_BATCH, unfetched.length)}/${unfetched.length})`,
          analysisPhase: "fetching",
        });
      }

      useFileStore.setState((state) => ({
        fileContents: { ...state.fileContents, ...contents },
      }));

      return contents;
    };

    // Check for cached results (GitHub repos only)
    if (!opts.forceRefresh && sourceType === "github" && repoInfo) {
      const cacheKey = getCacheKey(
        repoInfo.owner,
        repoInfo.repo,
        repoInfo.branch,
        tree.sha,
      );
      const cached = loadFromCache(cacheKey);
      if (cached) {
        // Check current Ollama status before deciding whether to use the cache.
        // If the cache was written without Ollama (ollamaModel === null) but
        // Ollama is now available with a model, bypass the cache so real
        // summaries can be generated. Also bypass if the model tag changed.
        const currentOllama = await checkOllamaStatus();
        const cacheHasRealSummaries =
          cached.ollamaModel != null && cached.ollamaModel !== "";
        const ollamaStateChanged =
          currentOllama.available &&
          currentOllama.model !== null &&
          currentOllama.model !== cached.ollamaModel;

        if (cacheHasRealSummaries && !ollamaStateChanged) {
          // Cache is valid — use it
          const contents = await fetchSourceContents();
          set({
            analysisPhase: "parsing",
            analysisStep: "Parsing imports & dependencies…",
            analysisProgress: 50,
          });
          const { nodes, edges } = buildDependencyGraph(tree, contents);
          set({
            umlDiagram: cached.umlDiagram,
            moduleSummaries: cached.moduleSummaries,
            depNodes: nodes,
            depEdges: edges,
            ollamaAvailable: currentOllama.available,
            ollamaModel: currentOllama.model,
            ollamaStatus: currentOllama,
            analysisPhase: "done",
            analysisProgress: 100,
            analysisStep: "Loaded from cache ✓",
            activeMainTab: "architecture",
          });
          return;
        }
        // Cache invalid (no AI summaries or model changed) — fall through to fresh analysis
      }
    }

    set({
      analysisPhase: "fetching",
      analysisProgress: 0,
      analysisStep: "Collecting source files…",
      analysisError: null,
      umlDiagram: null,
      depNodes: [],
      depEdges: [],
      moduleSummaries: {},
    });

    try {
      // ── Step 1: Fetch file contents ──────────────────────────────────────
      const contents = await fetchSourceContents();

      // ── Step 2: Build dependency graph ───────────────────────────────────
      set({
        analysisPhase: "parsing",
        analysisStep: "Parsing imports & dependencies…",
        analysisProgress: 50,
      });
      const { nodes, edges } = buildDependencyGraph(tree, contents);
      set({ depNodes: nodes, depEdges: edges, analysisProgress: 58 });

      // ── Step 3: Generate UML diagram ─────────────────────────────────────
      set({
        analysisStep: "Generating architecture diagram…",
        analysisProgress: 62,
        analysisPhase: "generating",
      });
      const uml = generateMermaidDiagram(tree, edges);
      set({ umlDiagram: uml, analysisProgress: 68 });

      // ── Step 4: Check Ollama ─────────────────────────────────────────────
      set({
        analysisStep: "Checking AI availability…",
        analysisProgress: 70,
        analysisPhase: "summarizing",
      });
      const ollamaStatus = await checkOllamaStatus();
      set({
        ollamaAvailable: ollamaStatus.available,
        ollamaModel: ollamaStatus.model,
        ollamaStatus,
      });

      // ── Step 5: Generate summaries ───────────────────────────────────────
      const toSummarize = sourceFiles
        .filter((f) => contents[f.path] && contents[f.path].length > 30)
        .slice(0, MAX_FILES_TO_SUMMARIZE);

      const summaries: Record<string, ModuleSummary> = {};

      for (let i = 0; i < toSummarize.length; i++) {
        const file = toSummarize[i];
        const content = contents[file.path];
        const imports = extractImports(content, file.path);

        let summaryText: string;
        let summarySource: "ollama" | "fallback";

        if (ollamaStatus.available && ollamaStatus.model) {
          try {
            const result = await summarizeModule(
              content,
              file.path,
              ollamaStatus.model,
            );
            summaryText = result.text;
            summarySource = "ollama";
          } catch {
            // Ollama call failed mid-analysis — leave summary empty rather
            // than silently inserting pattern-based prose.
            summaryText = "";
            summarySource = "fallback";
          }
        } else {
          // Ollama unavailable — skip AI summaries; components will show the
          // "Ollama required" state rather than silent pattern-based prose.
          // We still record the module metadata so the list can be rendered.
          summaryText = "";
          summarySource = "fallback";
        }

        const lang = file.language ?? "Unknown";
        const lineCount = countSourceLines(content, file.name);

        summaries[file.path] = {
          path: file.path,
          filename: file.name,
          summary: summaryText,
          language: lang,
          lineCount,
          importCount: imports.length,
          source: summarySource,
        };

        const pct =
          toSummarize.length > 0
            ? 70 + Math.round(((i + 1) / toSummarize.length) * 26)
            : 96;
        set({
          analysisProgress: pct,
          moduleSummaries: { ...summaries },
          analysisStep: `Summarizing modules… (${i + 1}/${toSummarize.length})`,
        });
      }

      // ── Step 6: Cache & finalize ─────────────────────────────────────────
      // Only cache when Ollama was available — don't persist empty summaries
      // as "good" results that would block future AI-enabled runs.
      if (sourceType === "github" && repoInfo && ollamaStatus.model !== null) {
        const cacheKey = getCacheKey(
          repoInfo.owner,
          repoInfo.repo,
          repoInfo.branch,
          tree.sha,
        );
        saveToCache(cacheKey, {
          repoKey: cacheKey,
          timestamp: Date.now(),
          umlDiagram: uml,
          moduleSummaries: summaries,
          ollamaModel: ollamaStatus.model,
        });
      }

      set({
        analysisPhase: "done",
        analysisProgress: 100,
        analysisStep: "Analysis complete ✓",
        moduleSummaries: summaries,
        activeMainTab: "architecture",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error during analysis";
      set({
        analysisPhase: "error",
        analysisError: msg,
        analysisStep: "",
      });
    }
  },
}));
