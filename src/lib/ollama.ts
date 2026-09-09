/**
 * Ollama client — model-agnostic with phi3 as the primary target.
 * Set VITE_OLLAMA_URL env var to point at a remote Ollama instance.
 * Default: http://localhost:11434
 */

import { countSourceLines } from "./lineCounter";

const OLLAMA_BASE = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";

const PREFERRED_MODELS = [
  "phi3:mini",
  "phi3",
  "llama3",
  "mistral",
];

/**
 * The model to suggest in "no model found" UI messages.
 * Always stays in sync with the top of PREFERRED_MODELS.
 */
export const SUGGESTED_MODEL = PREFERRED_MODELS[0];

export interface OllamaStatus {
  available: boolean;
  model: string | null;
  baseUrl: string;
}

/** Thrown when Ollama is reachable but the generation request itself failed. */
export class OllamaGenerationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OllamaGenerationError";
  }
}

let _statusCache: OllamaStatus | null = null;
let _statusCacheAt = 0;
const STATUS_CACHE_TTL_MS = 30_000;

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  if (_statusCache && Date.now() - _statusCacheAt < STATUS_CACHE_TTL_MS) {
    return _statusCache;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      _statusCache = { available: false, model: null, baseUrl: OLLAMA_BASE };
      _statusCacheAt = Date.now();
      return _statusCache;
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = data.models ?? [];
    const modelNames = models.map((m) => m.name);

    let model: string | null = null;
    for (const preferred of PREFERRED_MODELS) {
      const found = modelNames.find((m) =>
        m.startsWith(preferred.split(":")[0]),
      );
      if (found) {
        model = found;
        break;
      }
    }

    _statusCache = { available: true, model, baseUrl: OLLAMA_BASE };
    _statusCacheAt = Date.now();
    return _statusCache;
  } catch {
    _statusCache = { available: false, model: null, baseUrl: OLLAMA_BASE };
    _statusCacheAt = Date.now();
    return _statusCache;
  }
}

export function resetOllamaStatusCache() {
  _statusCache = null;
  _statusCacheAt = 0;
}

export interface SummarizeResult {
  text: string;
  usedFallback: boolean;
}

export async function summarizeModule(
  code: string,
  filepath: string,
  model: string,
): Promise<SummarizeResult> {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";
  // 900 chars captures imports + top-level declarations — enough signal for a
  // "main purpose" summary while keeping prompt-eval time low (~4s on phi3).
  const snippet = code.slice(0, 900);

  const prompt = `Write exactly ONE short sentence (under 20 words) describing the main purpose of this file. No preamble, no lists.

File: ${filepath}
\`\`\`${ext}
${snippet}
\`\`\`

Summary:`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // num_predict=40 targets ~20 words; stop on double-newline as safety net.
        // Primary length control is num_predict, not the stop sequence.
        options: { temperature: 0.1, num_predict: 40, stop: ["\n\n"] },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) throw new OllamaGenerationError(`HTTP ${res.status} from Ollama`);
    const data = (await res.json()) as { response?: string };
    const text = data.response?.trim() ?? "";
    if (!text) throw new OllamaGenerationError("Empty response from Ollama");
    return { text, usedFallback: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Ollama] summarizeModule failed for ${filepath}: ${msg}`);
    throw err instanceof OllamaGenerationError
      ? err
      : new OllamaGenerationError(msg, { cause: err });
  }
}

export interface ChangePlanRequest {
  changeDescription: string;
  moduleCount: number;
  edgeCount: number;
  affectedModules: string[];
  intent: string;
  proposalPlacement: string;
  recommendedPlacement: string;
  riskTitles: string[];
}

export interface ChangePlanResult {
  planText: string;
  recommendationText: string;
  feasibilitySummary: string;
  usedFallback: boolean;
}

export type ChangePlanSource = "ollama" | "heuristic";
export interface ChangePlanFallbackResult extends ChangePlanResult {
  source: ChangePlanSource;
  notice: string;
}

export async function planChange(
  context: ChangePlanRequest,
  model: string,
): Promise<ChangePlanResult> {
  // Lenient prompt: request sections but accept any coherent response
  const prompt = `You are a senior software architect. A developer wants to make this change:

"${context.changeDescription}"

Repository context:
- ${context.moduleCount} modules, ${context.edgeCount} import edges
- Detected intent: ${context.intent}
- User proposed placement: ${context.proposalPlacement}
- Recommended placement: ${context.recommendedPlacement}
- Likely affected modules: ${context.affectedModules.slice(0, 10).join(", ") || "unknown"}
- Risk signals: ${context.riskTitles.join("; ") || "none detected"}

Write 3 paragraphs:
1. Feasibility (is this change feasible and why)
2. Assessment (assessment of implementing exactly as proposed)
3. Recommendation (safer architectural approach)

Be concise and technical.`;

  let rawResponse = "";
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500,
          // Removed triple-newline stop — it was truncating output prematurely
        },
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new OllamaGenerationError(
        `HTTP ${res.status} from Ollama${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await res.json()) as { response?: string; error?: string };

    if (data.error) {
      throw new OllamaGenerationError(`Ollama model error: ${data.error}`);
    }

    rawResponse = data.response?.trim() ?? "";
    if (import.meta.env.DEV) {
      console.log("[Ollama] planChange raw response:", rawResponse.slice(0, 400));
    }

    if (!rawResponse) {
      throw new OllamaGenerationError("Empty response from Ollama — model may have timed out or stopped early");
    }
  } catch (err) {
    const msg = err instanceof OllamaGenerationError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
    console.warn(`[Ollama] planChange failed: ${msg}`);
    throw err instanceof OllamaGenerationError
      ? err
      : new OllamaGenerationError(msg, { cause: err });
  }

  // Lenient parsing: try "---" splits first, fall back to paragraph splits
  let sections: string[];
  if (rawResponse.includes("---")) {
    sections = rawResponse.split("---").map((s) => s.trim()).filter(Boolean);
  } else {
    // Split on double-newlines as paragraph boundaries
    sections = rawResponse.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  }

  const feasibilitySummary = stripSectionLabel(sections[0] ?? rawResponse);
  const planText = stripSectionLabel(sections[1] ?? sections[0] ?? rawResponse);
  const recommendationText = stripSectionLabel(sections[2] ?? sections[1] ?? sections[0] ?? rawResponse);

  return {
    planText: planText || feasibilitySummary,
    recommendationText: recommendationText || planText || feasibilitySummary,
    feasibilitySummary,
    usedFallback: false,
  };
}

/** Explicit, observable model chain: local Ollama → graph-derived heuristic.
 *  Only called from the explicit "Basic mode" path — NOT from the main AI flow. */
export async function planChangeWithFallback(
  context: ChangePlanRequest,
  ollamaStatus: OllamaStatus,
): Promise<ChangePlanFallbackResult> {
  if (ollamaStatus.available && ollamaStatus.model) {
    try {
      const result = await planChange(context, ollamaStatus.model);
      return { ...result, source: "ollama", notice: "Generated with local Ollama." };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Even in basic-mode fallback path, surface the real reason
      return {
        ...generateFallbackChangePlan(context),
        usedFallback: true,
        source: "heuristic",
        notice: `Ollama request failed: ${reason}`,
      };
    }
  }
  return {
    ...generateFallbackChangePlan(context),
    usedFallback: true,
    source: "heuristic",
    notice: "Ollama unavailable — using pattern-based analysis.",
  };
}

function stripSectionLabel(text: string): string {
  return text
    // Strip labelled section headers: "FEASIBILITY:", "USER PLAN:", "RECOMMENDATION:", etc.
    .replace(/^(FEASIBILITY|USER PLAN|ASSESSMENT|RECOMMENDATION)\s*:?\s*/i, "")
    // Strip numbered headers: "1.", "2.", "3." at the start
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function generateFallbackChangePlan(context: ChangePlanRequest): Omit<ChangePlanResult, "usedFallback"> {
  const affected = context.affectedModules.slice(0, 5).join(", ") || "related modules";
  return {
    feasibilitySummary: `This ${context.intent.toLowerCase()} request touches ${context.affectedModules.length || "several"} likely module(s) in the dependency graph (${affected}). Feasibility depends on keeping changes behind clear module boundaries.`,
    planText: `Implement the change at ${context.proposalPlacement} as proposed. Update imports for affected callers and run a build to catch resolution errors.`,
    recommendationText: `Prefer ${context.recommendedPlacement} as a dedicated boundary. Expose a narrow contract consumed by existing callers and migrate incrementally.`,
  };
}

export function generateFallbackSummary(
  code: string,
  filepath: string,
): string {
  const filename = filepath.split("/").pop() ?? filepath;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const lines = countSourceLines(code, filepath);

  // Pattern detection
  const isReactComponent =
    /export\s+(default\s+)?function\s+[A-Z]|:\s*React\.FC|:\s*JSX\.Element|return\s*\([\s\S]{0,40}</.test(
      code,
    );
  const isHook = /^(export\s+)?(?:default\s+)?function\s+use[A-Z]/m.test(code);
  const isStore = /create\s*\(|createSlice|createStore|defineStore/.test(code);
  const isApi = /fetch\s*\(|axios\.|http\.|\.get\(|\.post\(/.test(code);
  const isClass = /^(export\s+)?(abstract\s+)?class\s+\w+/m.test(code);
  const isTest = /describe\s*\(|it\s*\(|test\s*\(|expect\s*\(/.test(code);
  const isConfig = /module\.exports|defineConfig|export\s+default\s*\{/.test(
    code,
  );

  const exportNames = (
    code.match(
      /export\s+(?:default\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/g,
    ) ?? []
  )
    .slice(0, 3)
    .map((e) => e.split(/\s+/).pop())
    .filter(Boolean)
    .join(", ");

  const suffix = exportNames ? ` Key exports: \`${exportNames}\`.` : "";

  if (isTest)
    return `Test suite (${lines} lines) containing unit/integration tests.${suffix}`;
  if (isHook)
    return `Custom React hook (${lines} lines) encapsulating reusable stateful logic.${suffix}`;
  if (isReactComponent)
    return `React component (${lines} lines) rendering UI elements and handling user interactions.${suffix}`;
  if (isStore)
    return `State management module (${lines} lines) managing application-wide state.${suffix}`;
  if (isApi)
    return `API client module (${lines} lines) handling HTTP requests and data fetching.${suffix}`;
  if (isClass)
    return `Class-based module (${lines} lines) implementing object-oriented patterns.${suffix}`;
  if (isConfig)
    return `Configuration module (${lines} lines) exporting project settings.${suffix}`;

  const langLabel = getLanguageName(ext);
  return `${langLabel} module (${lines} lines) providing utility functions and type definitions.${suffix}`;
}

function getLanguageName(ext: string): string {
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "React JSX",
    py: "Python",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    md: "Markdown",
    go: "Go",
    rs: "Rust",
    java: "Java",
    rb: "Ruby",
    php: "PHP",
    swift: "Swift",
    kt: "Kotlin",
  };
  return map[ext] ?? ext.toUpperCase();
}
