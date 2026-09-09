import { useState } from 'react'
import {
  BarChart2, CheckCircle2, Loader2, Circle,
  AlertCircle, Play, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { flattenTree } from '../lib/treeParser'
import type { FileAnalysis } from '../types'
import { PanelHeader } from './PanelHeader'

function StatusIcon({ status }: { status: FileAnalysis['status'] }) {
  switch (status) {
    case 'pending':   return <Circle size={12} className="text-white/25" />
    case 'analyzing': return <Loader2 size={12} className="text-blue-400 animate-spin" />
    case 'done':      return <CheckCircle2 size={12} className="text-emerald-400" />
    case 'error':     return <AlertCircle size={12} className="text-red-400" />
  }
}

function StatusBadge({ status }: { status: FileAnalysis['status'] }) {
  const map: Record<FileAnalysis['status'], string> = {
    pending:   'bg-white/5 text-white/30',
    analyzing: 'bg-blue-500/15 text-blue-400',
    done:      'bg-emerald-500/15 text-emerald-400',
    error:     'bg-red-500/15 text-red-400',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${map[status]}`}>
      {status}
    </span>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 bg-white/10 rounded-full overflow-hidden mx-4 mb-2">
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function AnalyzePanel() {
  const {
    tree, analyses, isAnalyzing, analyzeProgress,
    analyzeAll, analyzeFile, selectedFile, selectFile,
  } = useFileStore()

  const [expanded, setExpanded] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'lines' | 'size'>('name')

  if (!tree) return null

  const items = Object.values(analyses)
  const doneCount = items.filter((a) => a.status === 'done').length
  const totalLines = items.reduce((s, a) => s + a.lineCount, 0)

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'lines') return b.lineCount - a.lineCount
    if (sortBy === 'size') return b.size - a.size
    return a.name.localeCompare(b.name)
  })

  const handleRowClick = (path: string) => {
    const allFiles = flattenTree(tree)
    const node = allFiles.find((f) => f.path === path)
    if (node) selectFile(node)
  }

  return (
    <div
      className="border-t border-white/10 flex flex-col bg-[#0F0F23]"
      style={{ maxHeight: expanded ? '45%' : 'auto' }}
    >
      {/* Header */}
      <PanelHeader
        icon={<BarChart2 size={16} />}
        title="Analysis"
        badges={doneCount > 0 && <span className="text-xs text-white/40">{doneCount}/{items.length} · {totalLines.toLocaleString()} lines total</span>}
      >
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/60 focus:outline-none"
            >
              <option value="name">Name</option>
              <option value="lines">Lines</option>
              <option value="size">Size</option>
            </select>
          )}
          <button
            onClick={analyzeAll}
            disabled={isAnalyzing}
            className="cv-button cv-button-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing
              ? <><Loader2 size={11} className="animate-spin" /> Analyzing...</>
              : <><Play size={11} /> Analyze All</>
            }
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </PanelHeader>

      {expanded && (
        <>
          {isAnalyzing && <ProgressBar progress={analyzeProgress} />}

          {items.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-white/25 text-sm">
              Click "Analyze All" to scan every file
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#16162b] border-y border-white/15 shadow-sm">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-white/50 font-medium">File</th>
                    <th className="text-left px-4 py-2.5 text-white/50 font-medium hidden sm:table-cell">Language</th>
                    <th className="text-right px-4 py-2.5 text-white/50 font-medium">Lines</th>
                    <th className="text-right px-4 py-2.5 text-white/50 font-medium hidden md:table-cell">Size</th>
                    <th className="text-center px-4 py-2.5 text-white/50 font-medium">Status</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.path}
                      className={`
                        border-b border-white/5 transition-colors cursor-pointer
                        ${selectedFile?.path === item.path ? 'bg-blue-600/10' : 'hover:bg-white/3'}
                      `}
                      onClick={() => handleRowClick(item.path)}
                    >
                      <td className="px-4 py-2.5 text-white/75 max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={item.status} />
                          <span className="truncate" title={item.path}>{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-white/50 font-mono hidden sm:table-cell">
                        {item.language}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/55 font-mono">
                        {item.lineCount > 0 ? item.lineCount.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/50 font-mono hidden md:table-cell">
                        {item.size > 0 ? formatBytes(item.size) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-2 py-1.5">
                        {(item.status === 'pending' || item.status === 'error') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); analyzeFile(item.path) }}
                            className="text-white/25 hover:text-white/60 transition-colors"
                            title="Re-analyze this file"
                          >
                            <Play size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
