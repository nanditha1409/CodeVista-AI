import { useRef, useCallback, useState, useEffect, type KeyboardEvent } from 'react'
import { Tree, type NodeRendererProps } from 'react-arborist'
import {
  Folder, FolderOpen, ChevronRight, ChevronDown,
  Search, X, FileCode, FileText, FileImage, AlertTriangle,
} from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { LanguageBadge } from './LanguageBadge'
import { TreeSkeleton } from './LoadingSkeleton'
import { detectLanguage } from '../lib/languageMap'
import { filterTree } from '../lib/treeParser'
import type { FileNode } from '../types'

// ─── Node renderer ───────────────────────────────────────────────────────────

function getFileIcon(name: string) {
  const info = detectLanguage(name)
  if (!info) {
    const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp']
    if (imgExts.some((e) => name.toLowerCase().endsWith(e)))
      return <FileImage size={14} className="text-yellow-400 flex-shrink-0" />
    return <FileText size={14} className="text-white/40 flex-shrink-0" />
  }
  return (
    <FileCode
      size={14}
      className="flex-shrink-0"
      style={{ color: info.color }}
    />
  )
}

function NodeRenderer({ node, style, dragHandle }: NodeRendererProps<FileNode>) {
  const selectFile = useFileStore((s) => s.selectFile)
  const selectedFile = useFileStore((s) => s.selectedFile)
  const isSelected = selectedFile?.path === node.data.path

  const handleClick = useCallback(() => {
    if (node.isInternal) {
      node.toggle()
    } else {
      selectFile(node.data)
    }
  }, [node, selectFile])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  const isFolder = node.data.type === 'folder'

  return (
    <div
      style={style}
      ref={dragHandle}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={isFolder ? node.isOpen : undefined}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        group flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer text-sm
        transition-all duration-100 select-none outline-none
        ${isSelected
          ? 'bg-blue-600/25 text-blue-200'
          : 'hover:bg-white/6 text-white/75 hover:text-white/95 focus:bg-white/8'
        }
      `}
    >
      {/* Expand/collapse chevron for folders */}
      {isFolder ? (
        <span className="text-white/30 flex-shrink-0 w-3.5">
          {node.isOpen
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />
          }
        </span>
      ) : (
        <span className="w-3.5 flex-shrink-0" />
      )}

      {/* Icon */}
      {isFolder ? (
        node.isOpen
          ? <FolderOpen size={14} className="text-yellow-400/80 flex-shrink-0" />
          : <Folder size={14} className="text-yellow-400/60 flex-shrink-0" />
      ) : (
        getFileIcon(node.data.name)
      )}

      {/* Name */}
      <span className="truncate flex-1 text-[13px]">{node.data.name}</span>

      {/* Language badge (files only, shown on hover) */}
      {!isFolder && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          <LanguageBadge filename={node.data.name} size="sm" />
        </span>
      )}

      {/* Size indicator */}
      {!isFolder && node.data.size && node.data.size > 0 && (
        <span className="text-[11px] text-white/45 flex-shrink-0 hidden group-hover:block">
          {formatSize(node.data.size)}
        </span>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// ─── Stats bar ───────────────────────────────────────────────────────────────

function StatsBar({ root }: { root: FileNode }) {
  const { repoInfo } = useFileStore()
  const [stats, setStats] = useState<Record<string, { count: number; color: string }>>({})

  useEffect(() => {
    import('../lib/languageMap').then(({ getLanguageStats }) => {
      setStats(getLanguageStats(root))
    })
  }, [root])

  const total = Object.values(stats).reduce((s, v) => s + v.count, 0)

  return (
    <div className="border-b border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/40">
          {repoInfo?.totalFiles ?? total} files
          {repoInfo?.stars !== undefined && (
            <span className="ml-2">⭐ {repoInfo.stars.toLocaleString()}</span>
          )}
        </span>
        <span className="text-xs text-white/45">{Object.keys(stats).length} langs</span>
      </div>
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          {Object.entries(stats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 8)
            .map(([lang, { count, color }]) => (
              <div
                key={lang}
                title={`${lang}: ${count} files`}
                className="transition-all"
                style={{
                  width: `${(count / total) * 100}%`,
                  backgroundColor: color,
                }}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty / Error states ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-white/25 gap-2">
      <Folder size={32} />
      <p className="text-sm">No files found</p>
    </div>
  )
}

// ─── Main FileTree component ──────────────────────────────────────────────────

export function FileTree() {
  const { tree, loading, searchQuery, setSearchQuery, truncated } = useFileStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleSearchKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setSearchQuery('')
  }, [setSearchQuery])

  const treeData = tree
    ? searchQuery
      ? filterTree(tree, searchQuery).children ?? []
      : tree.children ?? []
    : []

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="border-b border-white/10 bg-[#0D0D1F] px-4 py-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Filter files... (Ctrl+K)"
            className="w-full bg-white/5 border border-white/10 rounded-md pl-8 pr-7 py-2 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/60 focus:bg-white/8 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Language stats bar */}
      {tree && <StatsBar root={tree} />}
      {truncated && (
        <div className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-400/8 px-4 py-3 text-amber-200/75">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs">GitHub returned a partial file tree for this repository.</p>
        </div>
      )}

      {/* Tree content */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {loading ? (
          <TreeSkeleton />
        ) : treeData.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="animate-fade-in">
            <Tree
              data={treeData}
              height={height}
              indent={16}
              rowHeight={32}
              overscanCount={8}
              openByDefault={false}
              searchTerm={searchQuery}
              searchMatch={(node, term) =>
                node.data.name.toLowerCase().includes(term.toLowerCase())
              }
              disableDrag={true}
              disableDrop={true}
            >
              {NodeRenderer}
            </Tree>
          </div>
        )}
      </div>
    </div>
  )
}
