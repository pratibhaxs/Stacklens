// src/routes/webhook.js
// GitHub webhook handler for PR events.
//
// Setup in GitHub (per repo):
//   Settings → Webhooks → Add webhook
//   Payload URL:  https://your-backend.railway.app/api/webhook/github
//   Content type: application/json
//   Secret:       same value as WEBHOOK_SECRET in your .env
//   Events:       Pull requests
//
// Why HMAC signature verification:
//   Without it, anyone could POST fake payloads to your endpoint.
//   GitHub signs every payload with your secret — we verify the signature
//   before processing. This is a security requirement, not optional.

import express          from 'express'
import crypto           from 'crypto'
import prisma           from '../lib/prisma.js'
import { analyzePR, formatPRComment } from '../analysis/pr-analysis.js'

const router = express.Router()

// ─── POST /api/webhook/github ─────────────────────────────────────────────────
router.post('/github', async (req, res) => {
  try {
    // ── Step 1: Verify GitHub signature ──────────────────────────────────────
    const signature = req.headers['x-hub-signature-256']
    const secret    = process.env.WEBHOOK_SECRET

    if (secret && signature) {
      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(req.body)  // req.body is raw buffer (set up in server.js)
        .digest('hex')

      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      )) {
        console.warn('[webhook] Invalid signature — rejected')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // ── Step 2: Parse payload ─────────────────────────────────────────────────
    let payload
    try {
      payload = JSON.parse(req.body.toString())
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' })
    }

    const event = req.headers['x-github-event']

    // Only process pull_request events
    if (event !== 'pull_request') {
      return res.status(200).json({ message: `Event '${event}' ignored` })
    }

    // Only analyze when PR is opened or updated (not closed/merged)
    const action = payload.action
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return res.status(200).json({ message: `Action '${action}' ignored` })
    }

    const repoFullName = payload.repository?.full_name
    const prNumber     = payload.pull_request?.number
    const installToken = process.env.GITHUB_TOKEN

    if (!repoFullName || !prNumber) {
      return res.status(400).json({ error: 'Missing repo or PR info in payload' })
    }

    console.log(`[webhook] PR #${prNumber} ${action} in ${repoFullName}`)

    // Acknowledge immediately — GitHub expects response within 10s
    // Long-running analysis happens asynchronously after response
    res.status(200).json({ message: 'Webhook received, analyzing...' })

    // ── Step 3: Fetch PR files from GitHub API ────────────────────────────────
    // Do this async after responding to GitHub
    const filesRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${installToken}`,
          Accept:        'application/vnd.github.v3+json',
          'User-Agent':  'reposcan-app',
        },
      }
    )

    const files = filesRes.ok ? await filesRes.json() : []

    // ── Step 4: Get existing scan for this repo (for hotspot data) ────────────
    const repoUrl   = `https://github.com/${repoFullName}`
    const lastScan  = await prisma.scan.findFirst({
      where:   { repoUrl, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    })

    // ── Step 5: Analyze the PR ────────────────────────────────────────────────
    const analysis = await analyzePR(
      { ...payload, files },
      lastScan   // pass last scan for hotspot comparison (null if no scans yet)
    )

    // ── Step 6: Post comment to GitHub PR ─────────────────────────────────────
    const comment = formatPRComment(analysis, repoFullName)

    await fetch(
      `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`,
      {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${installToken}`,
          Accept:        'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent':  'reposcan-app',
        },
        body: JSON.stringify({ body: comment }),
      }
    )

    console.log(`[webhook] Posted analysis comment on PR #${prNumber}`)

  } catch (error) {
    console.error('[webhook] Error processing webhook:', error)
    // Don't send error response — we already sent 200
  }
})

export default router
