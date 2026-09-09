export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  language?: string;
  children?: FileNode[];
  size?: number;
  sha?: string;
  content?: string;
  truncated?: boolean;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  description?: string;
  stars?: number;
  url?: string;
  totalFiles?: number;
}

export type AnalysisStatus = "pending" | "analyzing" | "done" | "error";

export interface FileAnalysis {
  path: string;
  name: string;
  language: string;
  lineCount: number;
  size: number;
  status: AnalysisStatus;
  error?: string;
}

// ─── Phase 2: Analysis Engine Types ─────────────────────────────────────────

export type MainTab =
  | "files"
  | "architecture"
  | "dependencies"
  | "exec-flow"
  | "what-if"
  | "change-planner";

export type AnalysisPhase =
  | "idle"
  | "fetching"
  | "parsing"
  | "summarizing"
  | "generating"
  | "done"
  | "error";

export interface ModuleSummary {
  path: string;
  filename: string;
  summary: string;
  language: string;
  lineCount: number;
  importCount: number;
  source: "ollama" | "fallback";
}

export interface AnalysisCache {
  repoKey: string;
  timestamp: number;
  umlDiagram: string;
  moduleSummaries: Record<string, ModuleSummary>;
  /** Ollama model tag used to generate summaries, or null if Ollama was unavailable */
  ollamaModel: string | null;
}
