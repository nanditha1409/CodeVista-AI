import { createHighlighter, type Highlighter } from 'shiki'

let highlighterInstance: Highlighter | null = null
let initPromise: Promise<Highlighter> | null = null

const SUPPORTED_LANGS = [
  'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'css', 'html', 'json', 'markdown',
  'yaml', 'bash', 'rust', 'go', 'java', 'cpp',
  'c', 'php', 'ruby', 'swift', 'kotlin', 'vue',
  'svelte', 'sql', 'toml', 'xml', 'graphql',
  'hcl', 'makefile', 'dockerfile', 'diff', 'ini',
  'csharp', 'dart', 'lua', 'scala', 'zig',
] as const

export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

const THEME = 'github-dark-dimmed'

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return highlighterInstance
  if (initPromise) return initPromise

  try {
    initPromise = createHighlighter({
      themes: [THEME],
      langs: [...SUPPORTED_LANGS],
    })

    highlighterInstance = await initPromise
    return highlighterInstance
  } catch (err) {
    initPromise = null
    throw err
  }
}

export async function highlightCode(
  code: string,
  lang: string
): Promise<string> {
  const hl = await getHighlighter()

  const safeLang = SUPPORTED_LANGS.includes(lang as SupportedLang)
    ? lang
    : 'bash'

  try {
    return hl.codeToHtml(code, { lang: safeLang, theme: THEME })
  } catch {
    // Fallback: escape HTML
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getShikiLang(shikiLang?: string): string {
  if (!shikiLang) return 'bash'
  return SUPPORTED_LANGS.includes(shikiLang as SupportedLang) ? shikiLang : 'bash'
}
