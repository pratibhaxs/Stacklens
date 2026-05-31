// src/analysis/ai/client.js
// Calls the Claude API to generate recommendations from structured findings.
//
// Architecture decision: AI is a NON-BLOCKING ENHANCEMENT.
// If this file throws, crashes, times out, or returns garbage,
// the scan still completes with a null aiRecommendations field.
// The dashboard shows all real analysis data — just without the AI panel.
//
// Why this matters: AI APIs go down. Quotas get hit. Networks blip.
// A portfolio project that breaks entirely when the AI is unavailable
// is less impressive than one that gracefully degrades.

import { buildAnalysisPrompt } from './prompt.js'

const AI_TIMEOUT_MS  = 30_000  // 30s — Claude can be slow on complex prompts
const MAX_RETRIES    = 1       // one retry on transient failures

export async function generateAIRecommendations(findings) {
  // If no API key configured, return null silently
  // Why: don't crash in development if the key isn't set yet
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[ai] No API key configured — skipping AI recommendations')
    return null
  }

  const prompt = buildAnalysisPrompt(findings)

  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = process.env.ANTHROPIC_API_KEY
        ? await callClaude(prompt, apiKey)
        : await callOpenAI(prompt, apiKey)

      return parseAIResponse(raw)

    } catch (err) {
      lastError = err
      // Only retry on transient errors, not on invalid key or bad request
      if (err.code === 'INVALID_KEY' || err.code === 'BAD_REQUEST') break
      if (attempt < MAX_RETRIES) {
        console.warn(`[ai] Attempt ${attempt + 1} failed, retrying...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  // All attempts failed — log and return null (non-fatal)
  console.warn('[ai] All attempts failed:', lastError?.message)
  return null
}

// ─── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(prompt, apiKey) {
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 401) {
    const err = new Error('Invalid Anthropic API key')
    err.code  = 'INVALID_KEY'
    throw err
  }
  if (res.status === 429) throw new Error('Anthropic rate limit exceeded')
  if (!res.ok)             throw new Error(`Anthropic API error: ${res.status}`)

  const data = await res.json()

  // Extract text from Claude's content array
  const text = data.content?.find(b => b.type === 'text')?.text
  if (!text) throw new Error('Empty response from Claude')

  return text
}

// ─── OpenAI API (fallback if OPENAI_API_KEY set instead) ──────────────────────
async function callOpenAI(prompt, apiKey) {
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  let res
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',  // cheapest capable model
        max_tokens:  1500,
        temperature: 0.3,           // lower = more consistent JSON output
        messages:    [{ role: 'user', content: prompt }],
      }),
    })
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 401) {
    const err = new Error('Invalid OpenAI API key')
    err.code  = 'INVALID_KEY'
    throw err
  }
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Response parser ───────────────────────────────────────────────────────────
// Parses and validates the AI's JSON response.
// Why strict validation: AI sometimes returns JSON with extra text,
// truncated fields, or wrong types. We validate so the frontend
// never receives malformed data that crashes React components.
function parseAIResponse(raw) {
  if (!raw) return null

  // Strip markdown code fences if present (AI sometimes wraps in ```json)
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/,      '')
    .replace(/```\s*$/,      '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn('[ai] Could not parse AI response as JSON')
      return null
    }
    try { parsed = JSON.parse(match[0]) }
    catch { return null }
  }

  // Validate required fields exist and are right types
  if (typeof parsed.summary !== 'string') return null
  if (!Array.isArray(parsed.priorities))  return null

  // Sanitize priorities — ensure each has required fields
  const validPriorities = (parsed.priorities || [])
    .filter(p => p.title && p.description && p.action)
    .slice(0, 5)  // max 5 priorities
    .map((p, i) => ({
      rank:        i + 1,
      category:    p.category    || 'general',
      title:       String(p.title).slice(0, 100),
      description: String(p.description).slice(0, 500),
      action:      String(p.action).slice(0, 300),
      effort:      ['low','medium','high'].includes(p.effort) ? p.effort : 'medium',
      impact:      ['low','medium','high'].includes(p.impact) ? p.impact : 'medium',
    }))

  return {
    summary:             String(parsed.summary).slice(0, 600),
    overallRisk:         ['critical','high','medium','low'].includes(parsed.overallRisk)
                           ? parsed.overallRisk : 'medium',
    priorities:          validPriorities,
    positives:           (parsed.positives || []).slice(0, 3).map(String),
    modernizationRoadmap: (parsed.modernizationRoadmap || [])
                           .slice(0, 6)
                           .map(r => ({
                             timeframe: r.timeframe || 'this month',
                             action:    String(r.action).slice(0, 200),
                           })),
    generatedAt:         new Date().toISOString(),
  }
}
