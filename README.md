# CodeVista AI — Phase 2: Core Analysis Engine

> **GitHub repo explorer + UML architecture diagrams + interactive dependency graphs + AI module summaries**

![CodeVista AI Phase 2](https://via.placeholder.com/1200x630/0F0F23/3B82F6?text=CodeVista+AI+Phase+2)

---

## ✨ What's New in Phase 2

| Feature | Status |
|---------|--------|
| **🚀 Analyze Architecture** button — one-click full analysis | ✅ |
| **UML Component Diagram** — Mermaid flowchart with subgraphs | ✅ |
| **Interactive Dependency Graph** — Cytoscape.js force-directed | ✅ |
| **Files \| Architecture \| Dependencies** tab system | ✅ |
| **AI Module Summaries** — CodeLlama via Ollama (offline fallback) | ✅ |
| **Export PNG / SVG** — 2K crisp exports from both diagrams | ✅ |
| **Click node → file preview** — dependency graph links to source | ✅ |
| **12-hour localStorage cache** — instant re-analysis | ✅ |
| **Shareable links** — `?repo=https://github.com/owner/repo` | ✅ |
| **Offline Ollama fallback** — rule-based summaries when AI unavailable | ✅ |
| **Static import-flow traversal** — complete topological traversal with cycle warnings | ✅ |
| **What-If removal simulation** — recomputed graph edges and Mermaid diagram | ✅ |
| **Dependency Graph search** — debounced match, focus, and fade | ✅ |
| **Change Planner fallback chain** — Ollama → graph-derived heuristic | ✅ |

### Phase 1 Features (Preserved Unchanged)

| Feature | Status |
|---------|--------|
| GitHub repo URL → full recursive file tree | ✅ |
| Local ZIP upload → same tree view | ✅ |
| Syntax highlighting (50+ languages via Shiki) | ✅ |
| Folder expand/collapse + Ctrl+K search | ✅ |
| "Analyze All" → per-file stats table | ✅ |
| Line numbers + word-wrap + copy-to-clipboard | ✅ |
| Language badges + colored language bar | ✅ |

---

## 🚀 Quick Start

```bash
git clone https://github.com/your-username/codevista-ai
cd codevista-ai
npm install
cp .env.example .env          # add your GitHub token (optional)
npm run dev                   # → http://localhost:5173
```

### Optional: Enable AI Summaries (Ollama)

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull a CodeLlama model (4GB, one-time download)
ollama pull codellama:7b-code-q4_0

# 3. Start Ollama with CORS enabled (required for browser access)
OLLAMA_ORIGINS="*" ollama serve

# 4. Add to your .env
VITE_OLLAMA_URL=http://localhost:11434
```

> **No Ollama?** The app still works perfectly — module summaries fall back to smart rule-based detection (React components, hooks, stores, API clients, etc.)

---

## 🔑 Environment Variables

```env
# GitHub API (optional — increases rate limit from 60 → 5000 req/hr)
VITE_GITHUB_TOKEN=your_github_pat_here

# Ollama (optional — enables AI module summaries)
VITE_OLLAMA_URL=http://localhost:11434

```

Create a GitHub token at [github.com/settings/tokens](https://github.com/settings/tokens) with **no scopes** (public repos only).

---

## 🎬 30-Second Demo

1. Open the app and paste a GitHub URL (e.g. `https://github.com/vitejs/vite`)
2. Click **🚀 Analyze Architecture**
3. Watch the multi-step progress bar: *Fetching → Parsing → Generating → Summarizing*
4. The **Architecture tab** opens automatically with:
   - Mermaid UML diagram showing file structure + dependencies
   - Module summaries sidebar (AI or rule-based)
5. Switch to **Dependencies tab** → interactive Cytoscape graph
6. Click any node → see in/out degree, line count, AI summary, file path
7. Click a node's filename → source code opens in Files tab
8. Hit **Export PNG** → 2K resolution download

---

## ⚡ Performance Targets

| Step | Target | Notes |
|------|--------|-------|
| GitHub tree fetch | ~2s | Cached in sessionStorage |
| File content fetch | ~5s | Batched, up to 150 files |
| AST/import parsing | ~1s | Regex-based, no WASM |
| UML generation | ~0.5s | Pure JS |
| Cytoscape layout | ~2s | CoSE force-directed |
| Ollama summaries | ~15s | 25 files × ~0.6s each |
| **Total (no Ollama)** | **~10s** | |
| **Total (with Ollama)** | **~25s** | |

---

## 🏗️ Architecture

```
src/
├── components/
│   ├── FileTree.tsx          # Phase 1 — react-arborist tree
│   ├── FileViewer.tsx        # Phase 1 — Shiki syntax viewer
│   ├── RepoInput.tsx         # Phase 1 — GitHub URL input
│   ├── UploadZone.tsx        # Phase 1 — ZIP upload
│   ├── AnalyzePanel.tsx      # Phase 1 — file stats table
│   ├── LanguageBadge.tsx     # Phase 1 — language chip
│   ├── LoadingSkeleton.tsx   # Phase 1 — skeleton loaders
│   │
│   ├── ArchitecturePanel.tsx # Phase 2 — UML + summaries layout
│   ├── DependenciesPanel.tsx # Phase 2 — Cytoscape panel
│   ├── UmlDiagram.tsx        # Phase 2 — Mermaid renderer + export
│   └── DependencyGraph.tsx   # Phase 2 — Cytoscape graph + export
│
├── stores/
│   ├── fileStore.ts          # Phase 1 — file tree + viewer state
│   └── analysisStore.ts      # Phase 2 — analysis pipeline + tabs
│
├── lib/
│   ├── octokit.ts            # Phase 1 — GitHub API + cache
│   ├── treeParser.ts         # Phase 1 — tree builder + flatten
│   ├── zipParser.ts          # Phase 1 — JSZip adapter
│   ├── languageMap.ts        # Phase 1 — 50+ language definitions
│   ├── highlighter.ts        # Phase 1 — Shiki singleton
│   │
│   ├── ollama.ts             # Phase 2 — CodeLlama client + fallback
│   ├── astParser.ts          # Phase 2 — regex import extraction
│   ├── dependencyExtractor.ts # Phase 2 — dep graph builder
│   └── mermaidRenderer.ts    # Phase 2 — Mermaid diagram generator
│
└── types/
    └── index.ts              # Shared TypeScript interfaces
```

---

## 📦 Full Tech Stack

| Layer | Package | Version | Purpose |
|-------|---------|---------|---------|
| Framework | React | 18 | UI |
| Build | Vite | 8 | Bundler |
| Styling | Tailwind CSS | 4 | Utility CSS |
| State | Zustand | 5 | Global state |
| **UML Diagrams** | **Mermaid** | **11** | **Flowchart rendering** |
| **Dependency Graph** | **Cytoscape.js** | **3** | **Interactive graph** |
| **AI Summaries** | **Ollama + CodeLlama** | **7B-Q4** | **Module analysis** |
| Tree View | react-arborist | 3.4 | File tree |
| Syntax | Shiki | 4 | Code highlighting |
| GitHub API | @octokit/rest | 22 | Repo fetching |
| ZIP | JSZip | 3.10 | Local uploads |
| Routing | React Router | 7 | SPA routing |
| Icons | Lucide React | 1.7 | Icon set |

---

## 🧩 Phase 2 Deep Dive

### Analysis Pipeline (6 steps)

```
Step 1: Collect source files from tree (JS/TS/PY/GO/CSS/…)
Step 2: Batch-fetch file contents (6 at a time, up to 150 files)
Step 3: Regex-parse imports → build DepNode[] + DepEdge[]
Step 4: Generate Mermaid flowchart LR diagram (max 8 dirs, 25 edges)
Step 5: Check Ollama → summarize 25 key modules (streaming updates)
Step 6: Cache to localStorage (12-hour TTL) → switch to Architecture tab
```

### Import Extraction (regex-based, no WASM)

Supports:
- **JS/TS**: `import X from '...'`, `require('...')`, `import('...')`, side-effect imports
- **Python**: `from X import Y`, `import X`
- **CSS/SCSS**: `@import '...'`
- **Go**: `import "pkg"`, multi-import blocks

### Dependency Graph

- Nodes: sized by connectivity (in-degree × 3 + out-degree × 2), colored by language
- Layout options: **CoSE** (force-directed), **Hierarchy** (breadthfirst), **Circle**, **Grid**
- Click node → highlights neighborhood, shows AI summary + stats in side panel
- Click node label → jumps to source file in Files tab
- Export: Cytoscape `.png()` at 2× scale, dark background

### UML Architecture Diagram

- Mermaid `flowchart LR` with `subgraph` for directories
- Folder icons by semantic name (🧩 components, 📚 lib, 🗄 stores, 🌐 api, …)
- Auto-retry with simplified diagram on render failure
- CSS zoom controls + SVG/PNG export

### Planner and Traversal Reliability

- Import paths include relative files, barrel `index.*` files, dynamic imports, stylesheet imports, and `tsconfig` `baseUrl`/`paths` aliases (including nested config directories).
- Execution Flow is deliberately static analysis, not a runtime stack: it condenses cyclic imports into strongly connected groups before topological ordering, so cycles are marked without dropping reachable modules. Modules with no resolved import show an explicit static-entry notice.
- What-If offers **Modify** and **Remove** modes; removal recomputes edges and excludes the removed module and its incident edges from both Mermaid “After” views.
- The Change Planner always starts with actual dependency-graph and parsed-module data. Its visible fallback order is **Ollama → graph-derived heuristic**; it never embeds a cloud-provider API key in the client bundle.

### AI Summaries (Ollama)

When Ollama is running with CodeLlama:
- 2-sentence technical summaries per file
- Identifies: purpose + key exports
- 120-token limit, temperature 0.1 (deterministic)

Fallback (no Ollama):
- Pattern detection: React component / hook / store / API client / class / test / config
- Shows: language, line count, detected export names
- 100% offline, instant

---

## 🔗 Shareable Links

Any analyzed repo can be shared directly:

```
https://your-app.vercel.app/?repo=https://github.com/vitejs/vite
https://your-app.vercel.app/?repo=https://github.com/pallets/flask
```

The app auto-loads the repo on page mount when `?repo=` is present.

---

## 🧪 Test Scenarios

```bash
# Phase 1 (must pass — unchanged)
✅ https://github.com/vitejs/vite         → tree + syntax highlighting
✅ https://github.com/pallets/flask        → Python files
✅ ZIP upload                              → local project tree
✅ Ctrl+K                                 → file search

# Phase 2
✅ https://github.com/vitejs/vite         → UML + 30+ dep nodes
✅ https://github.com/pallets/flask        → Python imports graph
✅ Offline Ollama                          → fallback summaries shown
✅ Export PNG                             → crisp 2K download
✅ ?repo=URL                              → auto-load + analyze
✅ Click dep node                          → opens file in viewer
✅ Layout switch                           → CoSE / Hierarchy / Circle / Grid
✅ Cache hit                              → instant reload (<1s)
✅ Execution Flow: deep 50+ node chain    → all reachable modules listed in dependency order
✅ Execution Flow: A → B → A              → both modules listed and cycle warning shown
✅ Execution Flow: entry → cycle → leaf   → every reachable module retained; cycle group stays between entry and leaf
✅ Import resolution: nested `tsconfig` alias + barrel/CSS import → target node and edge are retained
✅ What-If: remove selected module         → selected node/incident edges absent from “After” diagrams
✅ What-If module search: `auth` / `AUTH`  → same partial, case-insensitive matches
✅ Planner: Ollama unavailable             → visible graph fallback (never a blank plan)
✅ Dependency graph search: partial name   → matching nodes highlighted, first match centered, others faded
```

---

## 🐳 Docker: Ollama Setup

```yaml
# docker-compose.yml
version: "3.8"
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_ORIGINS=*
    command: serve

volumes:
  ollama_data:
```

```bash
docker compose up -d
docker compose exec ollama ollama pull codellama:7b-code-q4_0
```

---

## 🚢 Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

**Vercel Environment Variables** (Project Settings → Environment Variables):

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_GITHUB_TOKEN` | GitHub PAT (no scopes) | Optional |
| `VITE_OLLAMA_URL` | Remote Ollama URL | Optional |

> For Ollama + Vercel: host Ollama on a VPS/cloud VM with `OLLAMA_ORIGINS=https://your-app.vercel.app` and use the public URL as `VITE_OLLAMA_URL`.

---

## 📋 Scripts

```bash
npm run dev      # Start dev server → http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
npm run lint     # ESLint check
```

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | File tree + GitHub + syntax highlighting | ✅ Done |
| 2 | UML diagrams + dependency graphs + AI summaries | ✅ Done |
| 3 | AST-level call graphs + class hierarchy diagrams | 🔜 Planned |
| 3 | Git blame + commit history overlay | 🔜 Planned |
| 3 | Multi-repo comparison view | 🔜 Planned |

---

**CodeVista AI Phase 2** 
