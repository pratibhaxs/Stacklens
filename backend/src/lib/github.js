// src/lib/github.js
// Why a dedicated module: GitHub API calls happen in multiple places
// (validation, size check, metadata fetch). Centralizing them means one
// place to update if the API changes, and easy to mock in tests.

// Parses "https://github.com/owner/repo" into { owner, repo }
// Why this regex: handles trailing slashes, .git suffixes, query strings
export function parseRepoUrl(url) {
  if (!url || typeof url !== 'string') return null

  // normalize: trim whitespace, remove trailing slash, remove .git suffix
  const normalized = url.trim().replace(/\.git$/, '').replace(/\/$/, '')

  const match = normalized.match(
    /^(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/
  )
  if (!match) return null

  return { owner: match[1], repo: match[2] }
}

// Checks if a repo exists, is accessible, and returns metadata including size
// Why we check BEFORE cloning: cloning a private/missing repo wastes time,
// produces confusing git errors, and might hang. The API check is instant.
export async function checkRepoExists(owner, repo) {
  const token = process.env.GITHUB_TOKEN

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      // Auth header: without a token, GitHub rate-limits to 60 req/hour
      // With a token: 5000 req/hour — critical for a tool that makes many API calls
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': 'reposcan-app',  // GitHub requires a User-Agent header
    },
  })

  // 404 = not found OR private (GitHub hides private repos as 404 for security)
  if (response.status === 404) {
    return { exists: false, reason: 'Repository not found or is private' }
  }

  // 403 = rate limited or access forbidden
  if (response.status === 403) {
    const data = await response.json()
    if (data.message?.includes('rate limit')) {
      return { exists: false, reason: 'GitHub API rate limit exceeded — try again in an hour' }
    }
    return { exists: false, reason: 'Access forbidden' }
  }

  if (!response.ok) {
    return { exists: false, reason: `GitHub API error: ${response.status}` }
  }

  const data = await response.json()

  // size is in KB — GitHub calculates this as approximate disk usage
  return {
    exists: true,
    metadata: {
      owner: data.owner.login,
      repo: data.name,
      fullName: data.full_name,
      description: data.description,
      language: data.language,         // primary language GitHub detected
      size: data.size,                 // KB — we use this to reject huge repos
      stars: data.stargazers_count,
      isPrivate: data.private,
      defaultBranch: data.default_branch,
      updatedAt: data.updated_at,
    },
  }
}

// Maximum repo size we'll accept in KB (200MB)
// Why 200MB: big enough for almost any real project, small enough to avoid
// memory issues and timeouts. The Linux kernel is ~4GB — we don't want that.
export const MAX_REPO_SIZE_KB = 200_000
