import { Octokit } from '@octokit/rest'
import type { FileNode } from '../types'
import type { RepoInfo } from '../types'
import { parseGitHubTree } from './treeParser'

const githubToken = import.meta.env.VITE_GITHUB_TOKEN
const validTokenPattern = /^(ghp|github_pat|gho|ghu|ghs|ghr)_/
const normalizedToken =
  typeof githubToken === 'string'
    ? githubToken.trim().replace(/^['"]|['"]$/g, '')
    : undefined
const configuredGitHubToken =
  normalizedToken &&
  normalizedToken !== 'your_github_token_here' &&
  validTokenPattern.test(normalizedToken)
    ? normalizedToken
    : undefined

const GITHUB_TOKEN_STORAGE_KEY = 'codevista_github_token'
const anonymousOctokit = new Octokit()
let authenticatedOctokit: Octokit | null = null
let shouldUseAuthenticatedClient = false

function normalizeRuntimeToken(token: string | null | undefined) {
  const normalized = token?.trim().replace(/^['"]|['"]$/g, '')
  return normalized && validTokenPattern.test(normalized) ? normalized : undefined
}

/** Set a browser-local token without exposing it in the deployed build. */
export function setRuntimeGitHubToken(token: string) {
  const validToken = normalizeRuntimeToken(token)
  try {
    if (validToken) localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, validToken)
    else localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
  } catch {
    // Private browsing can disable storage; the token still works until reload.
  }
  authenticatedOctokit = validToken ? new Octokit({ auth: validToken }) : configuredGitHubToken ? new Octokit({ auth: configuredGitHubToken }) : null
  shouldUseAuthenticatedClient = Boolean(authenticatedOctokit)
  return Boolean(validToken)
}

export function getRuntimeGitHubToken() {
  try {
    return localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function initializeOctokit() {
  const storedToken = getRuntimeGitHubToken()
  const token = normalizeRuntimeToken(storedToken) ?? configuredGitHubToken
  authenticatedOctokit = token ? new Octokit({ auth: token }) : null
  shouldUseAuthenticatedClient = Boolean(authenticatedOctokit)
}

initializeOctokit()

async function withGitHubFallback<T>(request: (client: Octokit) => Promise<T>): Promise<T> {
  if (!authenticatedOctokit || !shouldUseAuthenticatedClient) {
    return request(anonymousOctokit)
  }

  try {
    return await request(authenticatedOctokit)
  } catch (error) {
    if (isBadCredentialsError(error)) {
      shouldUseAuthenticatedClient = false
      return request(anonymousOctokit)
    }
    throw error
  }
}

function isBadCredentialsError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const maybeError = error as { status?: number; message?: string }
  return maybeError.status === 401 || maybeError.message?.toLowerCase().includes('bad credentials')
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/\.git$/, '')
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)/,
    /^github\.com\/([^/]+)\/([^/]+)/,
    /^([^/]+)\/([^/]+)$/,
  ]
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) return { owner: match[1], repo: match[2] }
  }
  return null
}

const SESSION_CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getCached(key: string) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > SESSION_CACHE_TTL) {
      sessionStorage.removeItem(key)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCache(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* storage full */ }
}

export async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const cacheKey = `repo_info_${owner}_${repo}`
  const cached = getCached(cacheKey)
  if (cached) return cached as RepoInfo

  const { data } = await withGitHubFallback((client) =>
    client.rest.repos.get({ owner, repo })
  )
  const info: RepoInfo = {
    owner,
    repo,
    branch: data.default_branch,
    description: data.description ?? undefined,
    stars: data.stargazers_count,
    url: data.html_url,
  }
  setCache(cacheKey, info)
  return info
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<FileNode> {
  const cacheKey = `repo_tree_${owner}_${repo}_${branch}`
  const cached = getCached(cacheKey)
  if (cached) return cached as FileNode

  const { data } = await withGitHubFallback((client) =>
    client.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: '1',
    })
  )

  const tree = parseGitHubTree(data.tree)
  // The response SHA identifies the exact commit/tree analyzed, unlike a moving branch name.
  tree.sha = data.sha
  tree.truncated = data.truncated ?? false
  setCache(cacheKey, tree)
  return tree
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string> {
  const cacheKey = `file_${owner}_${repo}_${branch}_${path}`
  const cached = getCached(cacheKey)
  if (cached) return cached as string

  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  const text = await res.text()
  setCache(cacheKey, text)
  return text
}
