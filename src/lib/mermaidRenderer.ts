import type { FileNode } from "../types";
import type { DepEdge } from "./dependencyExtractor";
import { isSourceFile } from "./astParser";

const MAX_SUBGRAPH_DEPTH = 2;
const MAX_FILES_PER_DIR = 10;
const MAX_TOP_LEVEL_DIRS = 8;
const MAX_EDGES_IN_DIAGRAM = 25;

/** Sanitize a path/name into a valid Mermaid node ID */
let idRegistry = new Map<string, string>();
let idCounter = 0;

function toId(path: string): string {
  const existing = idRegistry.get(path);
  if (existing) return existing;
  const id = "N" + ++idCounter;
  idRegistry.set(path, id);
  return id;
}

/** Escape label for Mermaid double-quote strings */
function esc(s: string): string {
  return s.replace(/[`"]/g, "'").replace(/[<>{}[\]#|]/g, "");
}

function folderIcon(name: string): string {
  const icons: Record<string, string> = {
    components: "🧩",
    component: "🧩",
    lib: "📚",
    libs: "📚",
    utils: "🔧",
    util: "🔧",
    helpers: "🔧",
    hooks: "🪝",
    hook: "🪝",
    stores: "🗄",
    store: "🗄",
    state: "🗄",
    types: "📝",
    type: "📝",
    interfaces: "📝",
    pages: "📄",
    page: "📄",
    views: "📄",
    view: "📄",
    api: "🌐",
    apis: "🌐",
    routes: "🛣",
    route: "🛣",
    middleware: "⚙",
    tests: "🧪",
    test: "🧪",
    __tests__: "🧪",
    spec: "🧪",
    styles: "🎨",
    style: "🎨",
    css: "🎨",
    assets: "🖼",
    asset: "🖼",
    public: "🌍",
    static: "🌍",
    src: "📦",
    source: "📦",
    app: "🚀",
    core: "⚡",
    config: "⚙",
    configs: "⚙",
    services: "🔌",
    service: "🔌",
    models: "🏗",
    model: "🏗",
    schemas: "🏗",
    schema: "🏗",
    controllers: "🎮",
    controller: "🎮",
  };
  return icons[name.toLowerCase()] ?? "📁";
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    tsx: "⚛",
    jsx: "⚛",
    ts: "🔷",
    js: "🟨",
    py: "🐍",
    css: "🎨",
    scss: "🎨",
    less: "🎨",
    json: "{}",
    md: "📝",
    go: "🐹",
    rs: "⚙",
    java: "☕",
    rb: "💎",
    php: "🐘",
    swift: "🦅",
    kt: "🏔",
    html: "🌐",
    vue: "💚",
    svelte: "🧡",
    yaml: "⚙",
    yml: "⚙",
    toml: "⚙",
    sh: "📟",
    bash: "📟",
  };
  return icons[ext] ?? "📄";
}

interface TreeLines {
  lines: string[];
  nodeIds: string[];
}

function renderNode(node: FileNode, depth: number, indent: string, hiddenNodePaths: Set<string>): TreeLines {
  const lines: string[] = [];
  const nodeIds: string[] = [];

  if (node.type === "folder") {
    if (depth >= MAX_SUBGRAPH_DEPTH) {
      // Show as a single collapsed node
      const id = toId(node.id);
      const fileCount = countFiles(node);
      lines.push(
        `${indent}${id}["${folderIcon(node.name)} ${esc(node.name)} (${fileCount} files)"]:::folder`,
      );
      nodeIds.push(id);
      return { lines, nodeIds };
    }

    const icon = folderIcon(node.name);
    lines.push(
      `${indent}subgraph ${toId(node.id)}["${icon} ${esc(node.name)}"]`,
    );

    const children = node.children ?? [];
    const files = children
      .filter((c) => c.type === "file" && isSourceFile(c.name))
      .slice(0, MAX_FILES_PER_DIR);
    const folders = children.filter((c) => c.type === "folder");

    for (const child of [...folders, ...files]) {
      const sub = renderNode(child, depth + 1, indent + "  ", hiddenNodePaths);
      lines.push(...sub.lines);
      nodeIds.push(...sub.nodeIds);
    }

    lines.push(`${indent}end`);
  } else {
    if (hiddenNodePaths.has(node.path)) return { lines, nodeIds };
    // File node
    const id = toId(node.id);
    const icon = fileIcon(node.name);
    lines.push(`${indent}${id}["${icon} ${esc(node.name)}"]`);
    nodeIds.push(id);
  }

  return { lines, nodeIds };
}

function countFiles(node: FileNode): number {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((s, c) => s + countFiles(c), 0);
}

export interface DiagramHighlights {
  /** Path IDs of upstream (needs-retest) nodes */
  upstream?: Set<string>;
  /** Path IDs of downstream (needs-inspection) nodes */
  downstream?: Set<string>;
  /** Path ID of the actively-simulated node */
  active?: string;
  /** File paths removed by a what-if scenario. */
  hiddenNodePaths?: Set<string>;
}

/**
 * Generate a Mermaid flowchart diagram from a file tree + dependency edges.
 */
export function generateMermaidDiagram(
  tree: FileNode,
  edges: DepEdge[],
  highlights?: DiagramHighlights,
): string {
  idRegistry = new Map<string, string>();
  idCounter = 0;

  const lines: string[] = [
    "flowchart LR",
    "  classDef folder fill:#2d2d3d,stroke:#4a4a6a,color:#a0a0c0,rx:6,ry:6",
    "  classDef default fill:#1a2744,stroke:#3b6fd4,color:#93c5fd,rx:4,ry:4",
  ];

  if (highlights) {
    lines.push(
      "  classDef upstreamNode fill:#451a03,stroke:#f59e0b,color:#fef3c7,rx:4,ry:4",
    );
    lines.push(
      "  classDef downstreamNode fill:#0c1a3d,stroke:#38bdf8,color:#bae6fd,rx:4,ry:4",
    );
    lines.push(
      "  classDef activeNode fill:#2e1065,stroke:#a855f7,color:#e9d5ff,rx:4,ry:4",
    );
  }

  const topLevel = (tree.children ?? []).slice(0, MAX_TOP_LEVEL_DIRS);
  const allNodeIds: string[] = [];

  for (const child of topLevel) {
    const { lines: childLines, nodeIds } = renderNode(child, 0, "  ", highlights?.hiddenNodePaths ?? new Set());
    lines.push(...childLines);
    allNodeIds.push(...nodeIds);
  }

  // Add edges (limit to avoid clutter)
  const keptNodeIds = new Set(allNodeIds);
  const addedEdges = new Set<string>();

  // Sort edges by type priority: esm first
  const sortedEdges = [...edges].sort((a, b) => {
    const priority = {
      esm: 0,
      require: 1,
      dynamic: 2,
      python: 0,
      css: 3,
      go: 0,
    };
    return (priority[a.type] ?? 5) - (priority[b.type] ?? 5);
  });

  for (const edge of sortedEdges) {
    if (addedEdges.size >= MAX_EDGES_IN_DIAGRAM) break;
    const srcId = toId(edge.source);
    const tgtId = toId(edge.target);
    const key = `${srcId}-->${tgtId}`;
    if (
      keptNodeIds.has(srcId) &&
      keptNodeIds.has(tgtId) &&
      !addedEdges.has(key)
    ) {
      addedEdges.add(key);
      lines.push(`  ${srcId} --> ${tgtId}`);
    }
  }

  // Apply what-if simulation highlights using Mermaid class assignments
  if (highlights) {
    const { upstream, downstream, active } = highlights;
    const classedIds = new Set<string>();

    if (active) {
      const id = idRegistry.get(active);
      if (id) {
        lines.push(`  class ${id} activeNode`);
        classedIds.add(id);
      }
    }
    if (upstream) {
      for (const path of upstream) {
        const id = idRegistry.get(path);
        if (id && !classedIds.has(id)) {
          lines.push(`  class ${id} upstreamNode`);
          classedIds.add(id);
        }
      }
    }
    if (downstream) {
      for (const path of downstream) {
        const id = idRegistry.get(path);
        if (id && !classedIds.has(id)) {
          lines.push(`  class ${id} downstreamNode`);
          classedIds.add(id);
        }
      }
    }
  }

  return lines.join("\n");
}
