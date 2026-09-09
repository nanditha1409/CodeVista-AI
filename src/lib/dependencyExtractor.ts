import type { FileNode } from '../types'
import {
  extractImports,
  resolveImportPath,
  normalizePath,
  isSourceFile,
  isLikelyGeneratedPath,
} from './astParser'
import { detectLanguage } from './languageMap'
import { flattenTree } from './treeParser'
import { countSourceLines } from './lineCounter'

export interface DepNode {
  id: string
  label: string
  path: string
  language: string
  color: string
  nodeSize: number
  lineCount: number
  inDegree: number
  outDegree: number
}

export interface DepEdge {
  id: string
  source: string
  target: string
  type: 'esm' | 'require' | 'dynamic' | 'python' | 'css' | 'go'
}

export interface DependencyGraph {
  nodes: DepNode[]
  edges: DepEdge[]
}

export function buildDependencyGraph(
  tree: FileNode,
  fileContents: Record<string, string>
): DependencyGraph {
  const allFiles = flattenTree(tree)
  const allPaths = allFiles.map((f) => f.path)
  const aliases = readTsconfigAliases(allPaths, fileContents)

  const nodeMap = new Map<string, DepNode>()
  const edgeSet = new Set<string>()
  const edges: DepEdge[] = []
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()

  // Helper to get or create a node
  const ensureNode = (file: FileNode, lineCount = 0) => {
    const existing = nodeMap.get(file.path)
    if (existing) {
      if (lineCount > existing.lineCount) {
        nodeMap.set(file.path, { ...existing, lineCount })
      }
      return
    }
    const lang = detectLanguage(file.name)
    nodeMap.set(file.path, {
      id: file.path,
      label: file.name,
      path: file.path,
      language: lang?.language ?? 'Unknown',
      color: lang?.color ?? '#6e7781',
      nodeSize: 24,
      lineCount,
      inDegree: 0,
      outDegree: 0,
    })
    inDegree.set(file.path, 0)
    outDegree.set(file.path, 0)
  }

  // Process all files that have content
  for (const file of allFiles) {
    if (!isSourceFile(file.name)) continue
    if (isLikelyGeneratedPath(file.path)) continue
    const content = fileContents[file.path]
    // Empty source files are still resolvable modules and must remain graph
    // nodes; otherwise a valid import can disappear from downstream flows.
    if (content === undefined) continue

    const lineCount = countSourceLines(content, file.name)
    ensureNode(file, lineCount)

    const imports = extractImports(content, file.path)

    for (const imp of imports) {
      const resolved = resolveImportPath(imp.source, file.path, allPaths, aliases)
      if (!resolved) continue

      const targetFile = allFiles.find((f) => f.path === resolved)
      if (!targetFile) continue

      ensureNode(targetFile)

      const edgeId = `${file.path}→${resolved}`
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId)
        edges.push({
          id: edgeId,
          source: file.path,
          target: resolved,
          type: imp.type,
        })
        outDegree.set(file.path, (outDegree.get(file.path) ?? 0) + 1)
        inDegree.set(resolved, (inDegree.get(resolved) ?? 0) + 1)
      }
    }
  }

  // Finalize node degrees
  const nodes: DepNode[] = Array.from(nodeMap.values()).map((n) => ({
    ...n,
    inDegree: inDegree.get(n.id) ?? 0,
    outDegree: outDegree.get(n.id) ?? 0,
    // Size proportional to connections + line count
    nodeSize: Math.min(
      Math.max(24 + (inDegree.get(n.id) ?? 0) * 3 + (outDegree.get(n.id) ?? 0) * 2, 20),
      60
    ),
  }))

  // Keep the complete graph. Truncating disconnected edges made downstream
  // traversal and what-if impact reports incorrect for non-trivial repos.
  return { nodes, edges }
}

function readTsconfigAliases(
  allPaths: string[],
  fileContents: Record<string, string>,
): Record<string, string> {
  const aliases: Record<string, string> = {}
  const configPaths = allPaths.filter((path) => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(path))
  for (const configPath of configPaths) {
    const content = fileContents[configPath]
    if (!content) continue
    try {
      // tsconfig commonly contains comments/trailing commas; strip those enough
      // to read compilerOptions.paths without making parsing a hard dependency.
      const parsed = JSON.parse(content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
      }
      const configDir = configPath.split("/").slice(0, -1).join("/")
      const baseUrl = parsed.compilerOptions?.baseUrl ?? ""
      for (const [pattern, targets] of Object.entries(parsed.compilerOptions?.paths ?? {})) {
        const target = targets[0]
        const alias = pattern.replace(/\*$/, "")
        // Merge distinct keys from every config; preserve an earlier explicit
        // mapping instead of silently replacing it with a later one.
        if (!target || aliases[alias]) continue
        aliases[alias] = normalizePath(`${configDir}/${baseUrl}/${target.replace(/\*$/, "")}`)
      }
    } catch {
      // A malformed config should not prevent aliases from other configs resolving.
    }
  }
  // Retain the historical convenience alias only when no config declares it.
  if (!aliases["@/"]) aliases["@/"] = "src/"
  return aliases
}

/**
 * Compute import counts per file – used for sorting summaries.
 */
export function getFileImportCounts(
  tree: FileNode,
  fileContents: Record<string, string>
): Map<string, number> {
  const counts = new Map<string, number>()
  const allFiles = flattenTree(tree)

  for (const file of allFiles) {
    const content = fileContents[file.path]
    if (!content) continue
    const imports = extractImports(content, file.path)
    counts.set(file.path, imports.length)
  }

  return counts
}
