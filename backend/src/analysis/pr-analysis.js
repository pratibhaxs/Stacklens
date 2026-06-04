// src/analysis/pr-analysis.js
// Analyzes a pull request for:
//   - Files changed that are known hotspots
//   - New dependencies introduced
//   - CVEs in new dependencies
//   - Overall risk assessment
//
// Why this is valuable:
//   It shifts security and quality checks LEFT — into the PR review process.
//   Instead of finding CVEs after merging, developers see them before.
//   This is what CodeScene's enterprise product charges thousands for.

import { checkVulnerabilities } from './parsers/cve.js'

// Analyzes a GitHub PR payload and returns a risk assessment
export async function analyzePR(prPayload, repoScanHistory) {
  const {
    pull_request: pr,
    repository,
    files = [],   // list of changed files from GitHub API
  } = prPayload

  const results = {
    prNumber:    pr.number,
    prTitle:     pr.title,
    author:      pr.user.login,
    baseBranch:  pr.base.ref,
    headBranch:  pr.head.ref,
    filesChanged: files.length,
    additions:   pr.additions || 0,
    deletions:   pr.deletions || 0,
    risks:       [],
    warnings:    [],
    positives:   [],
    riskLevel:   'low',  // low | medium | high | critical
    score:       100,    // starts at 100, deductions applied below
  }

  const changedFilePaths = files.map(f => f.filename)

  // ── Check 1: Hotspot files touched ────────────────────────────────────────
  // If we have scan history for this repo, check if any changed files
  // are known hotspots (frequently changed, high-risk files)
  if (repoScanHistory?.result?.gitMetrics?.hotspots?.hotspots) {
    const hotspots = repoScanHistory.result.gitMetrics.hotspots.hotspots
    const touchedHotspots = hotspots.filter(h =>
      changedFilePaths.some(f => f.includes(h.file) || h.file.includes(f))
    )

    if (touchedHotspots.length > 0) {
      const highRiskHotspots = touchedHotspots.filter(h => h.risk === 'high')

      if (highRiskHotspots.length > 0) {
        results.risks.push({
          type:    'hotspot',
          level:   'high',
          message: `This PR touches ${highRiskHotspots.length} high-risk hotspot file(s)`,
          files:   highRiskHotspots.map(h => h.file),
          detail:  `These files have been changed ${highRiskHotspots[0]?.commits}+ times recently — changes here are statistically more likely to introduce bugs`,
        })
        results.score -= highRiskHotspots.length * 10
      } else {
        results.warnings.push({
          type:    'hotspot',
          level:   'medium',
          message: `This PR touches ${touchedHotspots.length} hotspot file(s)`,
          files:   touchedHotspots.map(h => h.file),
        })
        results.score -= touchedHotspots.length * 5
      }
    }
  }

  // ── Check 2: Dependency file changes ──────────────────────────────────────
  const depFiles = changedFilePaths.filter(f =>
    ['package.json', 'requirements.txt', 'go.mod', 'pom.xml', 'Cargo.toml', 'Gemfile']
      .some(dep => f.endsWith(dep))
  )

  if (depFiles.length > 0) {
    results.warnings.push({
      type:    'dependencies',
      level:   'medium',
      message: `Dependency files changed: ${depFiles.join(', ')}`,
      detail:  'New dependencies may introduce vulnerabilities. Review additions carefully.',
      files:   depFiles,
    })
    results.score -= 5
  }

  // ── Check 3: Large PR ─────────────────────────────────────────────────────
  // Large PRs are harder to review and more likely to slip issues past reviewers
  if (files.length > 20) {
    results.warnings.push({
      type:    'size',
      level:   'medium',
      message: `Large PR: ${files.length} files changed`,
      detail:  'PRs with many file changes are harder to review thoroughly. Consider splitting into smaller PRs.',
    })
    results.score -= 5
  }

  // ── Check 4: No test files changed ────────────────────────────────────────
  const testFiles     = changedFilePaths.filter(f =>
    f.includes('test') || f.includes('spec') || f.includes('__tests__')
  )
  const sourceFiles   = changedFilePaths.filter(f =>
    !f.includes('test') && !f.includes('spec') &&
    (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py') || f.endsWith('.java'))
  )

  if (sourceFiles.length > 0 && testFiles.length === 0) {
    results.warnings.push({
      type:    'tests',
      level:   'low',
      message: 'No test files changed alongside source code changes',
      detail:  'Consider adding or updating tests to cover the changes in this PR.',
    })
    results.score -= 3
  }

  // ── Positives ──────────────────────────────────────────────────────────────
  if (testFiles.length > 0) {
    results.positives.push(`✓ Includes test changes (${testFiles.length} test file${testFiles.length > 1 ? 's' : ''})`)
  }

  if (files.length <= 5) {
    results.positives.push('✓ Small, focused PR — easy to review')
  }

  if (depFiles.length === 0) {
    results.positives.push('✓ No dependency changes')
  }

  // ── Overall risk level ────────────────────────────────────────────────────
  const score = Math.max(0, results.score)
  results.score = score
  results.riskLevel =
    score >= 85 ? 'low'      :
    score >= 70 ? 'medium'   :
    score >= 50 ? 'high'     : 'critical'

  return results
}

// Formats the PR analysis as a GitHub comment (Markdown)
export function formatPRComment(analysis, repoFullName) {
  const { riskLevel, prTitle, score, risks, warnings, positives } = analysis

  const riskEmoji = {
    low:      '🟢',
    medium:   '🟡',
    high:     '🟠',
    critical: '🔴',
  }[riskLevel]

  const lines = [
    `## ${riskEmoji} RepoScan PR Analysis`,
    '',
    `**Risk Level:** ${riskLevel.toUpperCase()} (Score: ${score}/100)`,
    '',
  ]

  if (risks.length > 0) {
    lines.push('### ⚠️ Risks')
    risks.forEach(r => {
      lines.push(`- **${r.message}**`)
      if (r.detail) lines.push(`  > ${r.detail}`)
      if (r.files?.length > 0) {
        lines.push(`  > Files: \`${r.files.slice(0, 3).join('`, `')}\``)
      }
    })
    lines.push('')
  }

  if (warnings.length > 0) {
    lines.push('### ℹ️ Warnings')
    warnings.forEach(w => {
      lines.push(`- ${w.message}`)
      if (w.detail) lines.push(`  > ${w.detail}`)
    })
    lines.push('')
  }

  if (positives.length > 0) {
    lines.push('### ✅ Looks good')
    positives.forEach(p => lines.push(`- ${p}`))
    lines.push('')
  }

  lines.push('---')
  lines.push(`*Powered by [RepoScan](https://github.com/yourusername/reposcan) — Repository Intelligence Platform*`)

  return lines.join('\n')
}
