import type { FileNode } from '../types'
import { detectLanguage } from './languageMap'

type GitHubTreeItem = {
  path?: string
  type?: string
  size?: number
  sha?: string
}

export function parseGitHubTree(items: GitHubTreeItem[]): FileNode {
  const root: FileNode = {
    id: '__root__',
    name: 'root',
    path: '',
    type: 'folder',
    children: [],
  }

  // Sort: folders before files, then alphabetically
  const sorted = [...items].sort((a, b) => {
    if (!a.path || !b.path) return 0
    const aIsDir = a.type === 'tree'
    const bIsDir = b.type === 'tree'
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.path.localeCompare(b.path)
  })

  for (const item of sorted) {
    if (!item.path || item.type === 'commit') continue

    const parts = item.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const pathSoFar = parts.slice(0, i + 1).join('/')

      if (isLast) {
        const node: FileNode = {
          id: item.path,
          name: part,
          path: item.path,
          type: item.type === 'tree' ? 'folder' : 'file',
          size: item.size,
          sha: item.sha,
          language: item.type === 'blob' ? detectLanguage(part)?.language : undefined,
          children: item.type === 'tree' ? [] : undefined,
        }
        current.children = current.children ?? []
        current.children.push(node)
      } else {
        let folder = current.children?.find(
          (c) => c.name === part && c.type === 'folder'
        )
        if (!folder) {
          folder = {
            id: pathSoFar,
            name: part,
            path: pathSoFar,
            type: 'folder',
            children: [],
          }
          current.children = current.children ?? []
          current.children.push(folder)
        }
        current = folder
      }
    }
  }

  return root
}

export function flattenTree(root: FileNode): FileNode[] {
  const result: FileNode[] = []
  function traverse(node: FileNode) {
    if (node.type === 'file') result.push(node)
    node.children?.forEach(traverse)
  }
  root.children?.forEach(traverse)
  return result
}

export function filterTree(root: FileNode, query: string): FileNode {
  if (!query.trim()) return root
  const q = query.toLowerCase()

  function filterNode(node: FileNode): FileNode | null {
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(q) ? node : null
    }
    // A matching folder is useful even if none of its files match: keep its
    // complete subtree so the user can browse the folder they searched for.
    if (node.name.toLowerCase().includes(q)) return node
    const filteredChildren = (node.children ?? [])
      .map(filterNode)
      .filter(Boolean) as FileNode[]
    if (filteredChildren.length === 0) return null
    return { ...node, children: filteredChildren }
  }

  return filterNode(root) ?? { ...root, children: [] }
}
