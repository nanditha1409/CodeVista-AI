import type { FileNode } from '../types'

export interface LanguageInfo {
  language: string
  color: string
  shikiLang: string
  textColor?: string
}

export const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  '.js':  { language: 'JavaScript', color: '#F7DF1E', textColor: '#000', shikiLang: 'javascript' },
  '.jsx': { language: 'JSX',        color: '#61DAFB', textColor: '#000', shikiLang: 'jsx' },
  '.ts':  { language: 'TypeScript', color: '#3178C6', shikiLang: 'typescript' },
  '.tsx': { language: 'TSX',        color: '#3178C6', shikiLang: 'tsx' },
  '.py':  { language: 'Python',     color: '#3572A5', shikiLang: 'python' },
  '.css': { language: 'CSS',        color: '#563D7C', shikiLang: 'css' },
  '.scss':{ language: 'SCSS',       color: '#c6538c', shikiLang: 'scss' },
  '.less':{ language: 'LESS',       color: '#1d365d', shikiLang: 'less' },
  '.html':{ language: 'HTML',       color: '#E34C26', shikiLang: 'html' },
  '.json':{ language: 'JSON',       color: '#6e7781', shikiLang: 'json' },
  '.md':  { language: 'Markdown',   color: '#083fa1', shikiLang: 'markdown' },
  '.mdx': { language: 'MDX',        color: '#1B1F24', shikiLang: 'markdown' },
  '.yaml':{ language: 'YAML',       color: '#cb171e', shikiLang: 'yaml' },
  '.yml': { language: 'YAML',       color: '#cb171e', shikiLang: 'yaml' },
  '.sh':  { language: 'Shell',      color: '#89e051', textColor: '#000', shikiLang: 'bash' },
  '.bash':{ language: 'Bash',       color: '#89e051', textColor: '#000', shikiLang: 'bash' },
  '.zsh': { language: 'Zsh',        color: '#89e051', textColor: '#000', shikiLang: 'bash' },
  '.rs':  { language: 'Rust',       color: '#dea584', textColor: '#000', shikiLang: 'rust' },
  '.go':  { language: 'Go',         color: '#00ADD8', textColor: '#000', shikiLang: 'go' },
  '.java':{ language: 'Java',       color: '#b07219', shikiLang: 'java' },
  '.cpp': { language: 'C++',        color: '#f34b7d', shikiLang: 'cpp' },
  '.cc':  { language: 'C++',        color: '#f34b7d', shikiLang: 'cpp' },
  '.c':   { language: 'C',          color: '#555555', shikiLang: 'c' },
  '.h':   { language: 'C Header',   color: '#555555', shikiLang: 'c' },
  '.hpp': { language: 'C++ Header', color: '#f34b7d', shikiLang: 'cpp' },
  '.php': { language: 'PHP',        color: '#4F5D95', shikiLang: 'php' },
  '.rb':  { language: 'Ruby',       color: '#701516', shikiLang: 'ruby' },
  '.swift':{ language: 'Swift',     color: '#F05138', shikiLang: 'swift' },
  '.kt':  { language: 'Kotlin',     color: '#A97BFF', shikiLang: 'kotlin' },
  '.kts': { language: 'Kotlin',     color: '#A97BFF', shikiLang: 'kotlin' },
  '.vue': { language: 'Vue',        color: '#41b883', textColor: '#000', shikiLang: 'vue' },
  '.svelte':{ language: 'Svelte',   color: '#ff3e00', shikiLang: 'svelte' },
  '.sql': { language: 'SQL',        color: '#e38c00', shikiLang: 'sql' },
  '.graphql':{ language: 'GraphQL', color: '#e10098', shikiLang: 'graphql' },
  '.gql': { language: 'GraphQL',    color: '#e10098', shikiLang: 'graphql' },
  '.toml':{ language: 'TOML',       color: '#9c4221', shikiLang: 'toml' },
  '.xml': { language: 'XML',        color: '#0060ac', shikiLang: 'xml' },
  '.tf':  { language: 'Terraform',  color: '#844FBA', shikiLang: 'hcl' },
  '.dart':{ language: 'Dart',       color: '#00B4AB', shikiLang: 'dart' },
  '.lua': { language: 'Lua',        color: '#000080', shikiLang: 'lua' },
  '.r':   { language: 'R',          color: '#198CE7', shikiLang: 'r' },
  '.cs':  { language: 'C#',         color: '#178600', shikiLang: 'csharp' },
  '.zig': { language: 'Zig',        color: '#ec915c', textColor: '#000', shikiLang: 'zig' },
}

export const SPECIAL_FILENAMES: Record<string, LanguageInfo> = {
  'Dockerfile':           { language: 'Dockerfile',    color: '#384d54', shikiLang: 'dockerfile' },
  'docker-compose.yml':   { language: 'Docker Compose',color: '#0db7ed', shikiLang: 'yaml' },
  'docker-compose.yaml':  { language: 'Docker Compose',color: '#0db7ed', shikiLang: 'yaml' },
  'Makefile':             { language: 'Makefile',       color: '#427819', shikiLang: 'makefile' },
  '.gitignore':           { language: 'Git Config',     color: '#f54d27', shikiLang: 'bash' },
  '.env':                 { language: 'Env File',       color: '#89e051', textColor: '#000', shikiLang: 'bash' },
  '.env.example':         { language: 'Env File',       color: '#89e051', textColor: '#000', shikiLang: 'bash' },
  '.env.local':           { language: 'Env File',       color: '#89e051', textColor: '#000', shikiLang: 'bash' },
}

export function detectLanguage(filename: string): LanguageInfo | undefined {
  const special = SPECIAL_FILENAMES[filename]
  if (special) return special
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return undefined
  const ext = filename.slice(lastDot).toLowerCase()
  return LANGUAGE_MAP[ext]
}

export function getLanguageStats(root: FileNode): Record<string, { count: number; color: string }> {
  const stats: Record<string, { count: number; color: string }> = {}
  function traverse(node: FileNode) {
    if (node.type === 'file') {
      const info = detectLanguage(node.name)
      const lang = info?.language ?? 'Other'
      const color = info?.color ?? '#6e7781'
      if (!stats[lang]) stats[lang] = { count: 0, color }
      stats[lang].count++
    }
    node.children?.forEach(traverse)
  }
  traverse(root)
  return stats
}

export function countAllFiles(root: FileNode): number {
  let count = 0
  function traverse(node: FileNode) {
    if (node.type === 'file') count++
    node.children?.forEach(traverse)
  }
  traverse(root)
  return count
}
