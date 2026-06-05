// Combined entry point for Render free tier deployment.
// Starts the Express API server AND the worker polling loop in the same process.
//
// Why this works:
//   The worker is just a setInterval loop — it doesn't need its own process.
//   Node.js is single-threaded but non-blocking. The worker awaits async operations
//   (DB queries, git clone, HTTP calls) so the event loop stays free for API requests.
//   Both can coexist in one process with no performance issues for a portfolio project.
//


import 'dotenv/config'
import express from 'express'
import cors    from 'cors'

import scansRouter   from './routes/scans.js'
import historyRouter from './routes/history.js'
import reportsRouter from './routes/reports.js'
import webhookRouter from './routes/webhook.js'
import prisma        from './lib/prisma.js'
import { runAnalysis } from './analysis/index.js'

// ── Express setup ─────────────────────────────────────────────────────────────
const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))

app.use('/api/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

app.use('/api/scans',   scansRouter)
app.use('/api/history', historyRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/webhook', webhookRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) })
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error('[server] Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Worker logic (inlined) ────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5_000
const JOB_TIMEOUT_MS   = 5 * 60 * 1000

async function rescueOrphanedJobs() {
  const staleThreshold = new Date(Date.now() - JOB_TIMEOUT_MS)
  const rescued = await prisma.scan.updateMany({
    where: { status: 'running', startedAt: { lt: staleThreshold } },
    data:  { status: 'failed', errorMsg: 'Job orphaned — server restarted. Please rescan.' },
  })
  if (rescued.count > 0) console.log(`[worker] Rescued ${rescued.count} orphaned job(s)`)
}

async function processNextJob() {
  const scan = await prisma.scan.findFirst({
    where:   { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  })
  if (!scan) return

  console.log(`[worker] Picked up job ${scan.id} — ${scan.repoUrl}`)

  await prisma.scan.update({
    where: { id: scan.id },
    data:  { status: 'running', startedAt: new Date() },
  })

  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Timed out after ${JOB_TIMEOUT_MS / 60000} minutes`)),
      JOB_TIMEOUT_MS
    )
  })

  try {
    const result = await Promise.race([
      runAnalysis(scan.repoUrl, scan.repoOwner, scan.repoName),
      timeoutPromise,
    ])
    clearTimeout(timeoutId)

    await prisma.scan.update({
      where: { id: scan.id },
      data:  { status: 'completed', completedAt: new Date(), result },
    })

    // Save history snapshot
    if (result?.healthScore?.score !== undefined) {
      await prisma.scanHistory.create({
        data: {
          repoUrl:       scan.repoUrl,
          repoOwner:     scan.repoOwner || result.repo?.owner || null,
          repoName:      scan.repoName  || result.repo?.name  || null,
          scanId:        scan.id,
          score:         result.healthScore.score,
          grade:         result.healthScore.grade,
          criticalCVEs:  result.summary?.criticalCVEs  || 0,
          highCVEs:      result.summary?.highCVEs      || 0,
          totalVulns:    result.summary?.totalVulns    || 0,
          outdatedDeps:  result.summary?.outdatedDeps  || 0,
          busFactorScore: result.summary?.busFactorScore ?? null,
          commitTrend:   result.summary?.commitTrend   || null,
        },
      })
    }

    console.log(`[worker] Completed job ${scan.id}`)

  } catch (error) {
    clearTimeout(timeoutId)
    console.error(`[worker] Failed job ${scan.id}:`, error.message)
    await prisma.scan.update({
      where: { id: scan.id },
      data:  { status: 'failed', errorMsg: error.message },
    })
  }
}

async function startWorkerLoop() {
  console.log('[worker] Starting polling loop...')
  await rescueOrphanedJobs()

  // Use setInterval instead of while loop so it doesn't block the event loop
  setInterval(async () => {
    try {
      await processNextJob()
    } catch (err) {
      console.error('[worker] Poll error:', err.message)
    }
  }, POLL_INTERVAL_MS)

  console.log(`[worker] Polling every ${POLL_INTERVAL_MS / 1000}s`)
}

// ── Start everything ──────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)

  // Start worker loop after server is listening
  await startWorkerLoop()
})

export default app
