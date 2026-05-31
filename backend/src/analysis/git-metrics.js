// src/analysis/git-metrics.js
// Git history intelligence — inspired by CodeScene and Adam Tornhill's
// "Your Code as a Crime Scene" methodology.
//
// Core insight: version control is a temporal database of developer decisions.
// Files changed most often (hotspots) combined with complexity = highest risk.
// Files touched by one person (bus factor) = knowledge silos.
// Rapid recent changes (churn) = unstable code.
//
// All of this comes from git log — no external tools, no Java, no extra deps.
// Just simple-git, which you already have.

import simpleGit from 'simple-git'

// How far back to look — 6 months captures current active development
// without including ancient history that's no longer relevant
const HISTORY_MONTHS = 6
const MAX_HOTSPOT_FILES = 15

export async function analyzeGitHistory(repoPath) {
  const git = simpleGit(repoPath)

  // Run all analyses concurrently — they're independent git log queries
  // Why Promise.allSettled not Promise.all: one failing query shouldn't
  // kill the others. Git history analysis is enhancement, not core.
  const [
    hotspotsResult,
    busFactorResult,
    churnResult,
    commitFrequencyResult,
    contributorsResult,
  ] = await Promise.allSettled([
    getHotspots(git),
    getBusFactor(git),
    getCodeChurn(git),
    getCommitFrequency(git),
    getContributors(git),
  ])

  // Extract value or null for each result
  const extract = (r) => r.status === 'fulfilled' ? r.value : null

  return {
    hotspots:        extract(hotspotsResult),
    busFactor:       extract(busFactorResult),
    churn:           extract(churnResult),
    commitFrequency: extract(commitFrequencyResult),
    contributors:    extract(contributorsResult),
    analyzedMonths:  HISTORY_MONTHS,
  }
}

// ─── Hotspot Detection ─────────────────────────────────────────────────────────
// Files changed most frequently in recent history.
// High commit count = high churn = high maintenance burden.
// Combined with large file size = complexity hotspot.
// This is the primary metric CodeScene is famous for.
async function getHotspots(git) {
  const sinceDate = getDateMonthsAgo(HISTORY_MONTHS)

  // --name-only lists files changed in each commit, --format= suppresses commit header
  const log = await git.raw([
    'log',
    '--name-only',
    '--format=',
    `--since=${sinceDate}`,
    '--diff-filter=AM',  // only Added or Modified — ignore deleted files
  ])

  const fileCounts = {}
  log.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('diff') && l.includes('.'))
    .forEach(file => {
      // Skip noise directories
      if (shouldSkipFile(file)) return
      fileCounts[file] = (fileCounts[file] || 0) + 1
    })

  const hotspots = Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_HOTSPOT_FILES)
    .map(([file, commits]) => ({
      file,
      commits,
      // Risk label based on commit frequency
      risk: commits >= 20 ? 'high' : commits >= 10 ? 'medium' : 'low',
    }))

  return {
    hotspots,
    totalFilesChanged: Object.keys(fileCounts).length,
    mostChanged: hotspots[0] || null,
  }
}

// ─── Bus Factor Analysis ───────────────────────────────────────────────────────
// Bus factor = "how many people need to be hit by a bus for this code to be unmaintainable?"
// Low bus factor = knowledge concentrated in one person = organizational risk.
// Files where only 1 author made all recent commits are highest risk.
async function getBusFactor(git) {
  const sinceDate = getDateMonthsAgo(HISTORY_MONTHS)

  // --format=%ae outputs committer email per commit, then lists files changed
  const log = await git.raw([
    'log',
    '--format=%ae',
    '--name-only',
    `--since=${sinceDate}`,
    '--diff-filter=AM',
  ])

  const fileAuthors = {}  // file → Set of author emails
  let currentAuthor = null

  log.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) return

    // Lines with @ are email addresses (author lines)
    if (trimmed.includes('@') && !trimmed.includes('/')) {
      currentAuthor = trimmed.toLowerCase()
    } else if (currentAuthor && trimmed.includes('.') && !shouldSkipFile(trimmed)) {
      if (!fileAuthors[trimmed]) fileAuthors[trimmed] = new Set()
      fileAuthors[trimmed].add(currentAuthor)
    }
  })

  // Files with only 1 author = bus factor risk
  const busFactorRisks = Object.entries(fileAuthors)
    .filter(([, authors]) => authors.size === 1)
    .sort(([fileA], [fileB]) => fileA.localeCompare(fileB))
    .slice(0, 10)
    .map(([file, authors]) => ({
      file,
      authorCount: authors.size,
      risk: 'high',  // single author = always high risk
    }))

  // Overall bus factor: minimum authors needed to cover 50% of codebase
  const authorFileCounts = {}
  Object.values(fileAuthors).forEach(authors => {
    authors.forEach(author => {
      authorFileCounts[author] = (authorFileCounts[author] || 0) + 1
    })
  })

  const totalFiles = Object.keys(fileAuthors).length
  const sortedAuthors = Object.entries(authorFileCounts)
    .sort(([, a], [, b]) => b - a)

  let covered = 0
  let busFactorScore = 0
  for (const [, count] of sortedAuthors) {
    covered += count
    busFactorScore++
    if (covered / totalFiles >= 0.5) break
  }

  return {
    busFactorScore,           // number of people who know 50% of the codebase
    riskFiles: busFactorRisks,
    totalContributors: sortedAuthors.length,
    interpretation: busFactorScore === 1
      ? 'Critical: one person holds most knowledge'
      : busFactorScore <= 2
      ? 'Low: very few people understand this codebase'
      : 'Healthy: knowledge distributed across team',
  }
}

// ─── Code Churn ───────────────────────────────────────────────────────────────
// Lines added + deleted per file in the last 3 months.
// High recent churn = unstable, actively changing area = higher bug risk.
// This is different from commit count — a file could have 1 commit but 1000 line changes.
async function getCodeChurn(git) {
  const sinceDate = getDateMonthsAgo(3)  // shorter window for churn — recent instability

  // --numstat outputs: added_lines deleted_lines filename
  const log = await git.raw([
    'log',
    '--numstat',
    '--format=',
    `--since=${sinceDate}`,
  ])

  const fileChurn = {}

  log.split('\n').forEach(line => {
    const parts = line.trim().split('\t')
    if (parts.length !== 3) return

    const [added, deleted, file] = parts
    if (!file || shouldSkipFile(file)) return
    if (added === '-' || deleted === '-') return  // binary file

    const addedNum   = parseInt(added, 10) || 0
    const deletedNum = parseInt(deleted, 10) || 0
    const total      = addedNum + deletedNum

    if (!fileChurn[file]) fileChurn[file] = { added: 0, deleted: 0 }
    fileChurn[file].added   += addedNum
    fileChurn[file].deleted += deletedNum
  })

  const churnRanking = Object.entries(fileChurn)
    .map(([file, { added, deleted }]) => ({
      file,
      linesAdded:   added,
      linesDeleted: deleted,
      totalChurn:   added + deleted,
      churnRisk:    (added + deleted) >= 500 ? 'high'
                  : (added + deleted) >= 100 ? 'medium' : 'low',
    }))
    .sort((a, b) => b.totalChurn - a.totalChurn)
    .slice(0, 10)

  return {
    highChurnFiles: churnRanking,
    totalLinesChanged: churnRanking.reduce((s, f) => s + f.totalChurn, 0),
    analyzedMonths: 3,
  }
}

// ─── Commit Frequency ─────────────────────────────────────────────────────────
// Commits per week over the last 6 months.
// Shows project health and development velocity.
// A sharp drop in commits = team change, feature freeze, or project abandonment.
async function getCommitFrequency(git) {
  const sinceDate = getDateMonthsAgo(HISTORY_MONTHS)

  const log = await git.raw([
    'log',
    '--format=%ci',  // commit date with timezone
    `--since=${sinceDate}`,
  ])

  const weekCounts = {}

  log.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) return
    const date = new Date(trimmed)
    if (isNaN(date)) return

    // Group by ISO week (YYYY-WW)
    const weekKey = getWeekKey(date)
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1
  })

  const weeks = Object.entries(weekCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, commits]) => ({ week, commits }))

  const totalCommits = weeks.reduce((s, w) => s + w.commits, 0)
  const avgPerWeek   = weeks.length > 0 ? Math.round(totalCommits / weeks.length) : 0

  // Detect if project is slowing down — last 4 weeks vs previous 4 weeks
  const recent = weeks.slice(-4).reduce((s, w) => s + w.commits, 0)
  const prev   = weeks.slice(-8, -4).reduce((s, w) => s + w.commits, 0)
  const trend  = prev === 0 ? 'new'
               : recent >= prev * 1.1 ? 'increasing'
               : recent <= prev * 0.5 ? 'declining'
               : 'stable'

  return {
    weeklyData:    weeks,
    totalCommits,
    avgPerWeek,
    trend,
    trendLabel: {
      increasing: 'Activity increasing',
      stable:     'Activity stable',
      declining:  'Activity declining — fewer commits recently',
      new:        'New or recently revived project',
    }[trend],
  }
}

// ─── Contributors ──────────────────────────────────────────────────────────────
async function getContributors(git) {
  const sinceDate = getDateMonthsAgo(HISTORY_MONTHS)

  const log = await git.raw([
    'shortlog', '-sne',
    `--since=${sinceDate}`,
    'HEAD',
  ])

  const contributors = log.split('\n')
    .filter(Boolean)
    .map(line => {
      const match = line.trim().match(/^\s*(\d+)\s+(.+?)\s+<(.+)>$/)
      if (!match) return null
      return {
        commits:  parseInt(match[1], 10),
        name:     match[2],
        email:    match[3],
      }
    })
    .filter(Boolean)
    .slice(0, 10)

  return {
    contributors,
    totalContributors: contributors.length,
    topContributor: contributors[0] || null,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getDateMonthsAgo(months) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().split('T')[0]  // YYYY-MM-DD
}

function getWeekKey(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())  // start of week (Sunday)
  return d.toISOString().split('T')[0]
}

// Files to skip in git analysis — same philosophy as file traversal
function shouldSkipFile(filePath) {
  const SKIP_PATTERNS = [
    'node_modules/', '.git/', 'dist/', 'build/', '.next/',
    '__pycache__/', 'venv/', 'vendor/', 'target/',
    'package-lock.json', 'yarn.lock', 'poetry.lock',  // lockfiles churn a lot but aren't meaningful
  ]
  return SKIP_PATTERNS.some(p => filePath.includes(p))
}
