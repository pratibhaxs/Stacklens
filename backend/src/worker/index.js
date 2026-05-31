// src/worker/index.js — Phase 4
// Added: saves a ScanHistory snapshot after every completed scan
// so the history page can show health score trends over time.

import prisma from '../lib/prisma.js'
import { runAnalysis } from '../analysis/index.js'

const POLL_INTERVAL_MS = 5_000
const JOB_TIMEOUT_MS   = 5 * 60 * 1000

let isShuttingDown = false

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

    // Save completed scan
    await prisma.scan.update({
      where: { id: scan.id },
      data:  { status: 'completed', completedAt: new Date(), result },
    })

    // ── Phase 4: save history snapshot ───────────────────────────────────────
    // Only save if we got a valid health score — don't pollute history with
    // incomplete results (e.g. unsupported stack with no score)
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
      console.log(`[worker] Saved history snapshot — score: ${result.healthScore.score}`)
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

async function startWorker() {
  console.log('[worker] Starting...')
  await rescueOrphanedJobs()
  console.log(`[worker] Polling every ${POLL_INTERVAL_MS / 1000}s`)

  while (!isShuttingDown) {
    try { await processNextJob() }
    catch (err) { console.error('[worker] Poll error:', err) }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }

  console.log('[worker] Shut down cleanly')
}

process.on('SIGTERM', () => { console.log('[worker] SIGTERM'); isShuttingDown = true })
process.on('SIGINT',  () => { console.log('[worker] SIGINT');  isShuttingDown = true })

startWorker().catch(err => { console.error('[worker] Fatal:', err); process.exit(1) })
