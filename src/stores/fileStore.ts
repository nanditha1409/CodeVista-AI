import { create } from 'zustand'
import type { FileNode, RepoInfo, FileAnalysis, AnalysisStatus } from '../types'
import { parseGitHubUrl, fetchRepoInfo, fetchRepoTree, fetchFileContent } from '../lib/octokit'
import { parseZipFile, getZipFileContent, clearZipStore } from '../lib/zipParser'
import { detectLanguage } from '../lib/languageMap'
import { flattenTree } from '../lib/treeParser'
import { countSourceLines } from '../lib/lineCounter'

type SourceType = 'github' | 'zip' | null

interface FileState {
  // Tree state
  tree: FileNode | null
  loading: boolean
  error: string | null
  repoInfo: RepoInfo | null
  sourceType: SourceType
  truncated: boolean

  // File viewer
  selectedFile: FileNode | null
  fileContents: Record<string, string>
  loadingContent: boolean
  contentError: string | null

  // Search
  searchQuery: string

  // Analysis
  analyses: Record<string, FileAnalysis>
  isAnalyzing: boolean
  analyzeProgress: number

  // Actions
  fetchGitHub: (url: string) => Promise<void>
  uploadZip: (file: File) => Promise<void>
  selectFile: (node: FileNode) => Promise<void>
  setSearchQuery: (q: string) => void
  analyzeAll: () => Promise<void>
  analyzeFile: (path: string) => Promise<void>
  reset: () => void
}

const initialState = {
  tree: null,
  loading: false,
  error: null,
  repoInfo: null,
  sourceType: null as SourceType,
  truncated: false,
  selectedFile: null,
  fileContents: {} as Record<string, string>,
  loadingContent: false,
  contentError: null,
  searchQuery: '',
  analyses: {} as Record<string, FileAnalysis>,
  isAnalyzing: false,
  analyzeProgress: 0,
}

export const useFileStore = create<FileState>((set, get) => ({
  ...initialState,

  fetchGitHub: async (url: string) => {
    set({ loading: true, error: null, tree: null, selectedFile: null, analyses: {}, searchQuery: '' })
    try {
      const parsed = parseGitHubUrl(url)
      if (!parsed) throw new Error('Invalid GitHub URL. Use format: https://github.com/owner/repo')

      const { owner, repo } = parsed
      const repoInfo = await fetchRepoInfo(owner, repo)

      // Check size limit (GitHub reports size in KB)
      // We allow up to 50MB (50000 KB)
      const tree = await fetchRepoTree(owner, repo, repoInfo.branch)

      const allFiles = flattenTree(tree)
      const updatedInfo: RepoInfo = { ...repoInfo, totalFiles: allFiles.length }

      clearZipStore()
      set({
        tree,
        repoInfo: updatedInfo,
        sourceType: 'github',
        truncated: tree.truncated ?? false,
        loading: false,
        error: null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load repository'
      const friendly = msg.includes('404')
        ? 'Repository not found. Check the URL and try again.'
        : msg.toLowerCase().includes('bad credentials')
        ? 'GitHub token is invalid. Remove or replace VITE_GITHUB_TOKEN, then restart the dev server.'
        : msg.includes('403') || msg.includes('rate limit')
        ? 'GitHub API rate limit exceeded. Try again in an hour or add a GitHub token.'
        : msg.includes('Invalid GitHub URL')
        ? msg
        : `Error loading repo: ${msg}`
      set({ loading: false, error: friendly })
    }
  },

  uploadZip: async (file: File) => {
    set({ loading: true, error: null, tree: null, selectedFile: null, analyses: {}, searchQuery: '' })
    try {
      if (!file.name.endsWith('.zip')) throw new Error('Please upload a .zip file')
      if (file.size > 50 * 1024 * 1024) throw new Error('ZIP file too large (max 50MB)')

      const tree = await parseZipFile(file)
      const allFiles = flattenTree(tree)
      const repoInfo: RepoInfo = {
        owner: 'local',
        repo: file.name.replace('.zip', ''),
        branch: 'local',
        totalFiles: allFiles.length,
      }

      set({
        tree,
        repoInfo,
        sourceType: 'zip',
        truncated: false,
        loading: false,
        error: null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse ZIP file'
      set({ loading: false, error: msg })
    }
  },

  selectFile: async (node: FileNode) => {
    if (node.type === 'folder') return
    set({ selectedFile: node, loadingContent: true, contentError: null })

    const { fileContents, repoInfo, sourceType } = get()
    if (fileContents[node.path]) {
      set({ loadingContent: false })
      return
    }
    if (!sourceType) {
      set({ loadingContent: false, contentError: 'No source loaded' })
      return
    }

    try {
      let content = ''
      if (sourceType === 'github' && repoInfo) {
        content = await fetchFileContent(repoInfo.owner, repoInfo.repo, repoInfo.branch, node.path)
      } else if (sourceType === 'zip') {
        content = (await getZipFileContent(node.path)) ?? '// Unable to load file content'
      }
      set({
        fileContents: { ...get().fileContents, [node.path]: content },
        loadingContent: false,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load file'
      set({ loadingContent: false, contentError: msg })
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  analyzeFile: async (path: string) => {
    const { tree, repoInfo, sourceType } = get()
    if (!tree) return

    const allFiles = flattenTree(tree)
    const node = allFiles.find((f) => f.path === path)
    if (!node) return

    const langInfo = detectLanguage(node.name)
    const update = (status: AnalysisStatus, extra: Partial<FileAnalysis> = {}) =>
      set((s) => ({
        analyses: {
          ...s.analyses,
          [path]: {
            path,
            name: node.name,
            language: langInfo?.language ?? 'Unknown',
            lineCount: 0,
            size: node.size ?? 0,
            status,
            ...extra,
          },
        },
      }))

    update('analyzing')

    try {
      let content = get().fileContents[path]
      if (!content) {
        if (sourceType === 'github' && repoInfo) {
          content = await fetchFileContent(repoInfo.owner, repoInfo.repo, repoInfo.branch, path)
        } else if (sourceType === 'zip') {
          content = (await getZipFileContent(path)) ?? ''
        }
        if (content) {
          set((s) => ({ fileContents: { ...s.fileContents, [path]: content } }))
        }
      }
      const lineCount = content ? countSourceLines(content, node.name) : 0
      update('done', { lineCount, size: node.size ?? new Blob([content ?? '']).size })
    } catch {
      update('error', { error: 'Failed to analyze' })
    }
  },

  analyzeAll: async () => {
    const { tree, analyzeFile } = get()
    if (!tree) return

    const allFiles = flattenTree(tree)
    if (allFiles.length === 0) return

    set({ isAnalyzing: true, analyzeProgress: 0 })

    const pending = allFiles.map((f) => ({
      path: f.path,
      name: f.name,
      language: detectLanguage(f.name)?.language ?? 'Unknown',
      lineCount: 0,
      size: f.size ?? 0,
      status: 'pending' as AnalysisStatus,
    }))

    const initial: Record<string, FileAnalysis> = {}
    pending.forEach((a) => (initial[a.path] = a))
    set({ analyses: initial })

    // Analyze in batches of 5
    const BATCH = 5
    for (let i = 0; i < allFiles.length; i += BATCH) {
      const batch = allFiles.slice(i, i + BATCH)
      await Promise.all(batch.map((f) => analyzeFile(f.path)))
      set({ analyzeProgress: Math.min(Math.round(((i + BATCH) / allFiles.length) * 100), 99) })
    }

    set({ isAnalyzing: false, analyzeProgress: 100 })
  },

  reset: () => {
    clearZipStore()
    set({ ...initialState })
  },
}))
