// src/routes/history.js
// API routes for scan history — powers the history page and trend charts.
// Three endpoints:
//   GET /api/history?repoUrl=...  → all history for a repo (chart data)
//   GET /api/history/repos        → all repos the user has scanned
//   GET /api/history/compare/:id1/:id2 → side-by-side comparison of two scans

import express from 'express'
import prisma from '../lib/prisma.js'

const router = express.Router()

// ─── GET /api/history?repoUrl=... ─────────────────────────────────────────────
// Returns all history snapshots for a repo, ordered oldest-first for chart display.
// Why oldest-first: recharts expects time-series data in ascending order.
router.get('/', async (req, res) => {
  try {
    const { repoUrl } = req.query

    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl query param required' })
    }

    const history = await prisma.scanHistory.findMany({
      where:   { repoUrl: decodeURIComponent(repoUrl) },
      orderBy: { scannedAt: 'asc' },          // oldest first for trend charts
      take:    50,                             // max 50 data points — enough for a year
    })

    // Compute trend: is score improving or declining?
    const trend = computeTrend(history)

    return res.json({
      repoUrl,
      history,
      count:    history.length,
      trend,
      latest:   history[history.length - 1] || null,
      earliest: history[0] || null,
    })

  } catch (error) {
    console.error('[GET /api/history]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/history/repos ────────────────────────────────────────────────────
// Returns all unique repos the user has scanned, with their latest score.
// Powers the "My Repositories" list on the history page.
router.get('/repos', async (req, res) => {
  try {
    // Get all unique repos with their most recent history entry
    const allHistory = await prisma.scanHistory.findMany({
      orderBy: { scannedAt: 'desc' },
      take:    500,
    })

    // Deduplicate by repoUrl — keep the most recent entry per repo
    const repoMap = new Map()
    for (const h of allHistory) {
      if (!repoMap.has(h.repoUrl)) {
        repoMap.set(h.repoUrl, h)
      }
    }

    const repos = Array.from(repoMap.values())
      .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))

    return res.json({ repos, count: repos.length })

  } catch (error) {
    console.error('[GET /api/history/repos]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/history/compare/:id1/:id2 ───────────────────────────────────────
// Side-by-side comparison of two completed scans.
// Why comparison endpoint: users want to see "did my fixes improve the score?"
// This powers the comparison view when the user selects two scan dates.
router.get('/compare/:id1/:id2', async (req, res) => {
  try {
    const [scan1, scan2] = await Promise.all([
      prisma.scan.findUnique({ where: { id: req.params.id1 } }),
      prisma.scan.findUnique({ where: { id: req.params.id2 } }),
    ])

    if (!scan1 || !scan2) {
      return res.status(404).json({ error: 'One or both scans not found' })
    }

    if (scan1.status !== 'completed' || scan2.status !== 'completed') {
      return res.status(409).json({ error: 'Both scans must be completed' })
    }

    // Ensure same repo
    if (scan1.repoUrl !== scan2.repoUrl) {
      return res.status(400).json({ error: 'Scans must be for the same repository' })
    }

    // Order: older scan first (baseline), newer scan second (current)
    const [older, newer] = new Date(scan1.createdAt) < new Date(scan2.createdAt)
      ? [scan1, scan2]
      : [scan2, scan1]

    const comparison = buildComparison(older, newer)

    return res.json({ older, newer, comparison })

  } catch (error) {
    console.error('[GET /api/history/compare]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Computes whether the repo's health is improving, declining, or stable
function computeTrend(history) {
  if (history.length < 2) return { direction: 'insufficient_data', change: 0 }

  const latest   = history[history.length - 1].score
  const previous = history[history.length - 2].score
  const oldest   = history[0].score
  const change   = latest - previous
  const totalChange = latest - oldest

  return {
    direction:   change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable',
    change,                              // change from last scan
    totalChange,                         // change since first scan
    latestScore:  latest,
    previousScore: previous,
  }
}

// Builds a human-readable comparison between two scan results
function buildComparison(older, newer) {
  const oldResult = older.result || {}
  const newResult = newer.result || {}

  const oldScore = oldResult.healthScore?.score ?? null
  const newScore = newResult.healthScore?.score ?? null

  const scoreDiff  = (newScore !== null && oldScore !== null) ? newScore - oldScore : null
  const oldVulns   = oldResult.summary?.totalVulns   ?? 0
  const newVulns   = newResult.summary?.totalVulns   ?? 0
  const oldOutdated = oldResult.summary?.outdatedDeps ?? 0
  const newOutdated = newResult.summary?.outdatedDeps ?? 0

  return {
    scoreDiff,
    scoreImproved: scoreDiff !== null && scoreDiff > 0,
    vulnChange:    newVulns - oldVulns,
    outdatedChange: newOutdated - oldOutdated,
    daysBetween:   Math.round(
      (new Date(newer.createdAt) - new Date(older.createdAt)) / (1000 * 60 * 60 * 24)
    ),
    summary: scoreDiff === null ? 'No score data to compare'
           : scoreDiff > 0  ? `Health score improved by ${scoreDiff} points`
           : scoreDiff < 0  ? `Health score declined by ${Math.abs(scoreDiff)} points`
           : 'Health score unchanged',
  }
}

export default router
