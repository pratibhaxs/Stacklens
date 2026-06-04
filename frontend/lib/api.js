// lib/api.js — all backend API calls in one place
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.error || `API error ${res.status}`)
    error.code   = data.code
    error.status = res.status
    throw error
  }
  return data
}

// ─── Scans ────────────────────────────────────────────────────────────────────
export async function createScan(repoUrl) {
  return request('/api/scans', { method: 'POST', body: JSON.stringify({ repoUrl }) })
}

export async function getScanStatus(scanId) {
  return request(`/api/scans/${scanId}`)
}

export async function getScanResult(scanId) {
  return request(`/api/scans/${scanId}/result`)
}

export async function rescan(scanId) {
  return request(`/api/scans/${scanId}/rescan`, { method: 'POST' })
}

export async function regenerateAI(scanId) {
  return request(`/api/scans/${scanId}/regenerate-ai`, { method: 'POST' })
}

// ─── History ──────────────────────────────────────────────────────────────────
export async function getRepoHistory(repoUrl) {
  return request(`/api/history?repoUrl=${encodeURIComponent(repoUrl)}`)
}

export async function getScannedRepos() {
  return request('/api/history/repos')
}

export async function compareScans(scanId1, scanId2) {
  return request(`/api/history/compare/${scanId1}/${scanId2}`)
}

// ─── Public Reports ───────────────────────────────────────────────────────────

// Fetch a public report by scan ID (no auth needed)
export async function getPublicReport(scanId) {
  return request(`/api/reports/${scanId}`)
}

// Fetch lightweight summary for preview
export async function getReportSummary(scanId) {
  return request(`/api/reports/${scanId}/summary`)
}
