// src/routes/scans.js
import express from 'express'
import prisma  from '../lib/prisma.js'
import { parseRepoUrl, checkRepoExists, MAX_REPO_SIZE_KB } from '../lib/github.js'
import { generateAIRecommendations } from '../analysis/ai/client.js'

const router = express.Router()

// POST /api/scans — create a new scan job
router.post('/', async (req, res) => {
  try {
    const { repoUrl } = req.body

    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ error: 'Repository URL is required', code: 'MISSING_URL' })
    }

    const parsed = parseRepoUrl(repoUrl)
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid GitHub URL. Expected: https://github.com/owner/repo',
        code:  'INVALID_URL',
      })
    }

    const { owner, repo } = parsed

    // Block duplicate in-progress scans
    const activeScan = await prisma.scan.findFirst({
      where: { repoUrl: repoUrl.trim(), status: { in: ['pending', 'running'] } },
    })
    if (activeScan) {
      return res.json({ scanId: activeScan.id, status: activeScan.status, cached: false,
        message: 'Analysis already in progress' })
    }

    // Return cached result (6 hours)
    const SIX_HOURS_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const cachedScan = await prisma.scan.findFirst({
      where: { repoUrl: repoUrl.trim(), status: 'completed', createdAt: { gte: SIX_HOURS_AGO } },
      orderBy: { createdAt: 'desc' },
    })
    if (cachedScan) {
      return res.json({ scanId: cachedScan.id, status: 'completed', cached: true,
        cachedAt: cachedScan.completedAt })
    }

    // Check repo exists on GitHub
    const { exists, reason, metadata } = await checkRepoExists(owner, repo)
    if (!exists) return res.status(404).json({ error: reason, code: 'REPO_NOT_FOUND' })

    // Reject oversized repos
    if (metadata.size > MAX_REPO_SIZE_KB) {
      const sizeMB  = Math.round(metadata.size / 1024)
      const limitMB = Math.round(MAX_REPO_SIZE_KB / 1024)
      return res.status(400).json({
        error: `Repository too large (${sizeMB}MB). Limit is ${limitMB}MB.`,
        code:  'REPO_TOO_LARGE',
      })
    }

    const scan = await prisma.scan.create({
      data: {
        repoUrl:   repoUrl.trim(),
        repoOwner: metadata.owner,
        repoName:  metadata.repo,
        repoSize:  metadata.size,
        status:    'pending',
      },
    })

    return res.status(201).json({ scanId: scan.id, status: 'pending', cached: false,
      repoName: metadata.repo, repoOwner: metadata.owner })

  } catch (error) {
    console.error('[POST /api/scans]', error)
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
})

// GET /api/scans/:id — poll scan status
router.get('/:id', async (req, res) => {
  try {
    const scan = await prisma.scan.findUnique({ where: { id: req.params.id } })
    if (!scan) return res.status(404).json({ error: 'Scan not found' })
    const { result, ...scanMeta } = scan
    return res.json({ ...scanMeta, hasResult: result !== null })
  } catch (error) {
    console.error('[GET /api/scans/:id]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/scans/:id/result — fetch full result once complete
router.get('/:id/result', async (req, res) => {
  try {
    const scan = await prisma.scan.findUnique({ where: { id: req.params.id } })
    if (!scan) return res.status(404).json({ error: 'Scan not found' })
    if (scan.status !== 'completed') {
      return res.status(409).json({ error: 'Analysis not yet complete', status: scan.status })
    }
    return res.json({ scanId: scan.id, repoUrl: scan.repoUrl, repoOwner: scan.repoOwner,
      repoName: scan.repoName, completedAt: scan.completedAt, result: scan.result })
  } catch (error) {
    console.error('[GET /api/scans/:id/result]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/scans/:id/rescan — force fresh scan bypassing cache
router.post('/:id/rescan', async (req, res) => {
  try {
    const existing = await prisma.scan.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Scan not found' })
    const newScan = await prisma.scan.create({
      data: { repoUrl: existing.repoUrl, repoOwner: existing.repoOwner,
              repoName: existing.repoName, repoSize: existing.repoSize, status: 'pending' },
    })
    return res.status(201).json({ scanId: newScan.id, status: 'pending', message: 'Rescan queued' })
  } catch (error) {
    console.error('[POST /api/scans/:id/rescan]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/scans/:id/regenerate-ai — re-run AI without re-scanning
router.post('/:id/regenerate-ai', async (req, res) => {
  try {
    const scan = await prisma.scan.findUnique({ where: { id: req.params.id } })
    if (!scan)                       return res.status(404).json({ error: 'Scan not found' })
    if (scan.status !== 'completed') return res.status(409).json({ error: 'Scan not complete' })
    if (!scan.result)                return res.status(409).json({ error: 'No analysis data' })

    const aiRecommendations = await generateAIRecommendations(scan.result)
    if (!aiRecommendations) {
      return res.status(503).json({ error: 'AI service unavailable — check your API key' })
    }

    await prisma.scan.update({
      where: { id: scan.id },
      data:  { aiRecommendations, aiGeneratedAt: new Date(),
               result: { ...(scan.result), aiRecommendations } },
    })

    return res.json({ success: true, aiRecommendations })
  } catch (error) {
    console.error('[POST /api/scans/:id/regenerate-ai]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
