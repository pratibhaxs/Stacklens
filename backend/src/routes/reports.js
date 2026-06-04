// src/routes/reports.js
// Public report endpoints — no authentication required.
// Anyone with the share link can view a scan result.
//
// Why a separate route from /api/scans:
//   /api/scans requires auth — private data
//   /api/reports is public — intentionally shared data
//   Keeping them separate makes the access control explicit and auditable.
//
// Share token = the scan's cuid ID.
// We don't generate a separate token because:
//   - cuid IDs are already unguessable (random 25-char string)
//   - No extra DB field needed
//   - User controls sharing by choosing whether to share the URL

import express from 'express'
import prisma  from '../lib/prisma.js'

const router = express.Router()

// GET /api/reports/:id — fetch a completed scan result publicly
// Returns a sanitised version — strips internal fields, keeps display data
router.get('/:id', async (req, res) => {
  try {
    const scan = await prisma.scan.findUnique({
      where: { id: req.params.id },
    })

    if (!scan) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (scan.status !== 'completed') {
      return res.status(409).json({
        error: 'This scan has not completed yet',
        status: scan.status,
      })
    }

    if (!scan.result) {
      return res.status(404).json({ error: 'No analysis data found for this report' })
    }

    // Return public-safe fields only
    // Why strip userId: don't expose who ran the scan
    // Why keep result: that's the whole point of sharing
    return res.json({
      id:           scan.id,
      repoUrl:      scan.repoUrl,
      repoOwner:    scan.repoOwner,
      repoName:     scan.repoName,
      completedAt:  scan.completedAt,
      createdAt:    scan.createdAt,
      result:       scan.result,
      shareUrl:     `${process.env.FRONTEND_URL}/report/${scan.id}`,
    })

  } catch (error) {
    console.error('[GET /api/reports/:id]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/:id/summary — lightweight summary for embed/preview
// Used for link previews (Open Graph) and quick stats without full result
router.get('/:id/summary', async (req, res) => {
  try {
    const scan = await prisma.scan.findUnique({
      where: { id: req.params.id },
      select: {
        id:          true,
        repoUrl:     true,
        repoOwner:   true,
        repoName:    true,
        completedAt: true,
        status:      true,
        result:      true,
      },
    })

    if (!scan || scan.status !== 'completed' || !scan.result) {
      return res.status(404).json({ error: 'Report not found' })
    }

    const result = scan.result
    const summary = result.summary || {}

    return res.json({
      id:          scan.id,
      repoOwner:   scan.repoOwner,
      repoName:    scan.repoName,
      completedAt: scan.completedAt,
      score:       summary.score,
      grade:       summary.grade,
      scoreLabel:  summary.scoreLabel,
      totalVulns:  summary.totalVulns,
      outdatedDeps: summary.outdatedDeps,
      hasAI:       summary.hasAI,
      shareUrl:    `${process.env.FRONTEND_URL}/report/${scan.id}`,
    })

  } catch (error) {
    console.error('[GET /api/reports/:id/summary]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
