import JSZip from 'jszip'
import type { FileNode } from '../types'
import { parseGitHubTree } from './treeParser'

export async function parseZipFile(file: File): Promise<FileNode> {
  const zip = await JSZip.loadAsync(file)

  const items: { path: string; type: 'tree' | 'blob'; size: number }[] = []
  const seenFolders = new Set<string>()

  zip.forEach((relativePath, entry) => {
    // Skip __MACOSX and hidden system files
    if (relativePath.startsWith('__MACOSX') || relativePath.includes('/.')) return

    // Strip top-level folder if all files share one root (common in zip exports)
    const path = relativePath.replace(/\/$/, '')
    if (!path) return

    if (entry.dir) {
      items.push({ path, type: 'tree', size: 0 })
      seenFolders.add(path)
    } else {
      // JSZip retains the uncompressed byte count on loaded entries. Use zero
      // only for unusual archives where metadata is unavailable, never undefined.
      const size = (entry as unknown as { _data?: { uncompressedSize?: number } })
        ._data?.uncompressedSize ?? 0
      items.push({ path, type: 'blob', size })
    }
  })

  // Strip common root prefix (e.g., "myrepo-main/")
  const allPaths = items.map((i) => i.path)
  const commonPrefix = getCommonPrefix(allPaths)

  const stripped = items
    .map((item) => ({
      ...item,
      path: commonPrefix ? item.path.slice(commonPrefix.length) : item.path,
    }))
    .filter((item) => item.path.length > 0)

  const tree = parseGitHubTree(stripped)

  // Attach content extractors for file nodes (lazy)
  attachContentMap(tree, zip, commonPrefix)

  return tree
}

function getCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return ''
  const firstParts = paths[0].split('/')
  let prefix = ''
  for (let i = 0; i < firstParts.length; i++) {
    const candidate = firstParts.slice(0, i + 1).join('/') + '/'
    if (paths.every((p) => p.startsWith(candidate))) {
      prefix = candidate
    } else {
      break
    }
  }
  return prefix
}

// Store zip reference for lazy content loading
const zipStore = new Map<string, JSZip>()
const zipPrefixStore = new Map<string, string>()

function attachContentMap(node: FileNode, zip: JSZip, prefix: string) {
  if (node.type === 'file') {
    zipStore.set(node.path, zip)
    zipPrefixStore.set(node.path, prefix)
  }
  node.children?.forEach((child) => attachContentMap(child, zip, prefix))
}

export async function getZipFileContent(path: string): Promise<string | null> {
  const zip = zipStore.get(path)
  const prefix = zipPrefixStore.get(path)
  if (!zip) return null

  const fullPath = prefix ? prefix + path : path
  const entry = zip.file(fullPath)
  if (!entry) {
    // Try without prefix
    const entry2 = zip.file(path)
    if (!entry2) return null
    return entry2.async('string')
  }
  return entry.async('string')
}

export function clearZipStore() {
  zipStore.clear()
  zipPrefixStore.clear()
}
