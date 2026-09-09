import { useState, type FormEvent } from 'react'
import { Globe, Search, X, AlertCircle, KeyRound, ChevronDown } from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { useAnalysisStore } from '../stores/analysisStore'
import { getRuntimeGitHubToken, setRuntimeGitHubToken } from '../lib/octokit'

const DEMO_REPOS = [
  { label: 'React (Meta)', url: 'https://github.com/facebook/react' },
  { label: 'Flask (Python)', url: 'https://github.com/pallets/flask' },
  { label: 'Vite', url: 'https://github.com/vitejs/vite' },
  { label: 'FastAPI', url: 'https://github.com/tiangolo/fastapi' },
]

export function RepoInput() {
  const [value, setValue] = useState('')
  const [showTokenSettings, setShowTokenSettings] = useState(false)
  const [token, setToken] = useState(() => getRuntimeGitHubToken())
  const [tokenMessage, setTokenMessage] = useState('')
  const { fetchGitHub, loading, error, reset } = useFileStore()
  const clearAnalysis = useAnalysisStore((s) => s.clearAnalysis)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    clearAnalysis()
    await fetchGitHub(value.trim())
  }

  const handlePasteFromClipboard = async () => {
    try {
      const pasted = await navigator.clipboard.readText()
      if (pasted.trim()) setValue(pasted.trim())
    } catch {
      /* Browser clipboard permission can be denied; normal keyboard paste still works. */
    }
  }

  const saveToken = () => {
    const saved = setRuntimeGitHubToken(token)
    setTokenMessage(token.trim() ? (saved ? 'Token saved in this browser.' : 'Enter a valid GitHub PAT.') : 'Token removed; using anonymous requests.')
  }

  return (
    <section className="border-b border-white/10 bg-[#101023] px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-white/90">GitHub Repository</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-9 py-2.5 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all disabled:opacity-50"
          />
          {value && (
            <button
              type="button"
              onClick={() => { setValue(''); reset(); clearAnalysis() }}
              title="Clear repository URL"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          disabled={loading}
          className="cv-button cv-button-secondary disabled:opacity-40 disabled:cursor-not-allowed text-xs"
        >
          Paste
        </button>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="cv-button cv-button-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
        >
          <Search size={14} />
          {loading ? 'Loading...' : 'Load'}
        </button>
      </form>

      {loading && (
        <div className="mt-2">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse-bar w-3/4" />
          </div>
          <p className="text-xs text-white/40 mt-1">Fetching repository tree...</p>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
        <button
          type="button"
          onClick={() => setShowTokenSettings((open) => !open)}
          className="flex w-full items-center gap-2 text-xs text-white/55 hover:text-white/85 transition-colors"
          aria-expanded={showTokenSettings}
        >
          <KeyRound size={13} className="text-blue-300" />
          GitHub access token
          <ChevronDown size={13} className={`ml-auto transition-transform ${showTokenSettings ? 'rotate-180' : ''}`} />
        </button>
        {showTokenSettings && (
          <div className="mt-3 space-y-3 rounded-md border border-white/10 bg-black/10 p-3">
            <p className="text-xs text-white/50">Optional: use your own PAT to avoid shared API rate limits. Stored only in this browser’s local storage.</p>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_… or ghp_…"
              autoComplete="off"
              className="w-full rounded border border-white/10 bg-[#0D0D1F] px-3 py-2 text-xs text-white/85 placeholder-white/30 focus:border-blue-400/60 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={saveToken} className="cv-button cv-button-primary px-3 py-1.5 text-xs">Save token</button>
              {tokenMessage && <span className="text-xs text-white/50">{tokenMessage}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/30">Try a demo repository</p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_REPOS.map((d) => (
            <button
              key={d.url}
              onClick={() => { setValue(d.url); clearAnalysis(); fetchGitHub(d.url) }}
              disabled={loading}
              className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/45 transition-all hover:bg-white/8 hover:text-white/75 disabled:opacity-40"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
