import { useEffect, useState, useCallback } from 'react'
import {
  File, WrapText, Hash, Copy, Check,
  ChevronRight, Code2, AlertCircle
} from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { highlightCode } from '../lib/highlighter'
import { detectLanguage } from '../lib/languageMap'
import { LanguageBadge } from './LanguageBadge'
import { CodeSkeleton } from './LoadingSkeleton'
import { countSourceLines } from '../lib/lineCounter'

export function FileViewer() {
  const { selectedFile, fileContents, loadingContent, contentError } = useFileStore()
  const [highlighted, setHighlighted] = useState<{ key: string; html: string } | null>(null)
  const [wordWrap, setWordWrap] = useState(false)
  const [lineNumbers, setLineNumbers] = useState(true)
  const [copied, setCopied] = useState(false)

  const content = selectedFile ? fileContents[selectedFile.path] : null
  const langInfo = selectedFile ? detectLanguage(selectedFile.name) : null
  const highlightKey = selectedFile && content && langInfo
    ? `${selectedFile.path}:${content.length}:${langInfo.shikiLang}`
    : null
  const html = highlightKey && highlighted?.key === highlightKey ? highlighted.html : null
  const highlighting = Boolean(highlightKey && !html)

  useEffect(() => {
    if (!content || !langInfo || !highlightKey) return
    let cancelled = false
    highlightCode(content, langInfo.shikiLang)
      .then((result) => {
        if (!cancelled) {
          setHighlighted({ key: highlightKey, html: result })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlighted({
            key: highlightKey,
            html: `<pre class="shiki"><code>${escapeHtml(content)}</code></pre>`,
          })
        }
      })
    return () => { cancelled = true }
  }, [content, highlightKey, langInfo])

  const handleCopy = useCallback(async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  // Welcome screen
  if (!selectedFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/20 gap-4">
        <Code2 size={48} strokeWidth={1} />
        <div className="text-center">
          <p className="text-lg font-medium text-white/30">No file selected</p>
          <p className="text-sm mt-1">Click a file in the tree to view its contents</p>
        </div>
      </div>
    )
  }

  const lineCount = content ? countSourceLines(content, selectedFile.name) : 0
  const fileSize = content ? new Blob([content]).size : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <File size={14} className="text-white/40 flex-shrink-0" />
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-white/50 min-w-0 overflow-hidden">
            {selectedFile.path.split('/').map((part, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} className="text-white/20 flex-shrink-0" />}
                <span
                  className={`${i === arr.length - 1 ? 'text-white/90 font-medium' : 'text-white/40'} truncate`}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
          {langInfo && (
            <LanguageBadge filename={selectedFile.name} size="sm" />
          )}
        </div>

        <div className="cv-toolbar flex items-center gap-1 p-1 flex-shrink-0">
          <span className="text-xs text-white/25 mr-2">
            {lineCount} lines · {formatBytes(fileSize)}
          </span>
          <button
            onClick={() => setLineNumbers(!lineNumbers)}
            title="Toggle line numbers"
            className={`p-1.5 rounded transition-colors ${lineNumbers ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'}`}
          >
            <Hash size={13} />
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            title="Toggle word wrap"
            className={`p-1.5 rounded transition-colors ${wordWrap ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'}`}
          >
            <WrapText size={13} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1.5 rounded text-white/30 hover:text-white/70 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#1E1E2E]">
        {loadingContent || highlighting ? (
          <CodeSkeleton />
        ) : contentError ? (
          <div className="flex items-center gap-2 m-4 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle size={16} />
            <p className="text-sm">{contentError}</p>
          </div>
        ) : html ? (
          <div
            className={`code-container ${wordWrap ? 'wrap' : ''} ${lineNumbers ? 'with-line-numbers' : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : content ? (
          <pre className="p-4 text-sm text-white/70 font-mono overflow-x-auto whitespace-pre">
            {content}
          </pre>
        ) : null}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
