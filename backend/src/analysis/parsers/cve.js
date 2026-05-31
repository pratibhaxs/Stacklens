// src/analysis/parsers/cve.js
// Checks dependencies against OSV.dev — Google's open vulnerability database.
// Why OSV.dev over Snyk/GitHub Advisory: completely free, no API key needed,
// supports npm, PyPI, Go, Rust, Maven in one unified API.
// Why batch API: one HTTP call for all deps instead of N calls (one per dep).
// 100 deps = 1 request, not 100 requests. Much faster, no rate limiting.

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch'

// Maps our ecosystem names to OSV's expected names
const ECOSYSTEM_MAP = {
  npm:   'npm',
  pypi:  'PyPI',
  go:    'Go',
  rust:  'crates.io',
  maven: 'Maven',
}

// Main function — takes all dependencies, returns enriched list with CVE data
export async function checkVulnerabilities(dependencies) {
  if (!dependencies || dependencies.length === 0) {
    return { vulnerabilities: [], checkedCount: 0 }
  }

  // Filter to deps with known versions and supported ecosystems
  const checkable = dependencies.filter(d =>
    d.installedVersion &&
    d.installedVersion !== 'latest' &&
    ECOSYSTEM_MAP[d.ecosystem]
  )

  if (checkable.length === 0) {
    return { vulnerabilities: [], checkedCount: 0 }
  }

  // Build OSV batch request
  // Format: { queries: [{ version, package: { name, ecosystem } }] }
  const queries = checkable.map(dep => ({
    version: dep.installedVersion,
    package: {
      name: dep.name,
      ecosystem: ECOSYSTEM_MAP[dep.ecosystem],
    },
  }))

  let osvResults
  try {
    const res = await fetch(OSV_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(30_000),  // 30s for potentially large batch
    })

    if (!res.ok) {
      console.warn(`[cve] OSV API returned ${res.status}`)
      return { vulnerabilities: [], checkedCount: 0, apiError: true }
    }

    osvResults = await res.json()
  } catch (e) {
    console.warn('[cve] OSV API call failed:', e.message)
    // CRITICAL: CVE check failure must not fail the whole analysis
    // Return empty — dashboard shows "CVE data unavailable" instead of crashing
    return { vulnerabilities: [], checkedCount: 0, apiError: true }
  }

  // Process results — osvResults.results[i] corresponds to queries[i]
  const vulnerabilities = []

  osvResults.results?.forEach((result, i) => {
    if (!result.vulns || result.vulns.length === 0) return

    const dep = checkable[i]

    result.vulns.forEach(vuln => {
      // Extract CVSS severity from the vulnerability data
      const severity = extractSeverity(vuln)

      vulnerabilities.push({
        packageName:       dep.name,
        ecosystem:         dep.ecosystem,
        installedVersion:  dep.installedVersion,
        isDev:             dep.isDev,
        vulnId:            vuln.id,                  // e.g. "CVE-2023-1234" or "GHSA-xxxx"
        summary:           vuln.summary || 'No description available',
        severity,                                    // CRITICAL, HIGH, MEDIUM, LOW
        severityScore:     getSeverityScore(severity), // numeric for sorting
        publishedAt:       vuln.published,
        modifiedAt:        vuln.modified,
        references:        (vuln.references || []).slice(0, 3).map(r => r.url),
        fixedVersions:     extractFixedVersions(vuln),
      })
    })
  })

  // Sort by severity score descending (CRITICAL first)
  vulnerabilities.sort((a, b) => b.severityScore - a.severityScore)

  return {
    vulnerabilities,
    checkedCount: checkable.length,
    totalCount: dependencies.length,
    summary: buildSummary(vulnerabilities),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSeverity(vuln) {
  // OSV stores severity in different places depending on the vuln source
  // Check CVSS v3, v2, and database-specific fields
  const severities = vuln.severity || []

  for (const sev of severities) {
    if (sev.type === 'CVSS_V3' && sev.score) {
      const score = parseFloat(sev.score)
      if (score >= 9.0) return 'CRITICAL'
      if (score >= 7.0) return 'HIGH'
      if (score >= 4.0) return 'MEDIUM'
      return 'LOW'
    }
  }

  // Fallback: check database_specific for GHSA severity
  const ghsa = vuln.database_specific?.severity?.toUpperCase()
  if (['CRITICAL','HIGH','MEDIUM','LOW'].includes(ghsa)) return ghsa

  return 'UNKNOWN'
}

function getSeverityScore(severity) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }[severity] || 0
}

function extractFixedVersions(vuln) {
  const fixed = []
  for (const affected of (vuln.affected || [])) {
    for (const range of (affected.ranges || [])) {
      for (const event of (range.events || [])) {
        if (event.fixed) fixed.push(event.fixed)
      }
    }
  }
  return [...new Set(fixed)]  // deduplicate
}

function buildSummary(vulnerabilities) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }
  vulnerabilities.forEach(v => { counts[v.severity] = (counts[v.severity] || 0) + 1 })
  return {
    total: vulnerabilities.length,
    ...counts,
    hasHighSeverity: counts.CRITICAL > 0 || counts.HIGH > 0,
  }
}
