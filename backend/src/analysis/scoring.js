// src/analysis/scoring.js
// Calculates a 0–100 health score from all analysis findings.
// Every deduction is explicit, logged, and explainable.
// Why explainable scoring: a score of 67 means nothing without knowing why.
// The deductions array powers the "Score Breakdown" panel on the dashboard.
// Why not a black-box ML model: this is a portfolio project — you need to
// explain the scoring logic in interviews. Simple weighted rules beat unexplainable models.

export function calculateHealthScore(findings) {
  let score = 100
  const deductions = []

  const deduct = (points, reason, category) => {
    const actual = Math.min(points, score)  // can't deduct more than remaining score
    score -= actual
    deductions.push({ points: actual, reason, category })
  }

  // ── CVE Vulnerabilities ──────────────────────────────────────────────────────
  // Critical CVEs are the most serious — active exploitation is possible
  const vulns = findings.vulnerabilities?.vulnerabilities || []

  const criticalCount = vulns.filter(v => v.severity === 'CRITICAL').length
  const highCount     = vulns.filter(v => v.severity === 'HIGH').length
  const mediumCount   = vulns.filter(v => v.severity === 'MEDIUM').length
  const lowCount      = vulns.filter(v => v.severity === 'LOW').length

  if (criticalCount > 0) deduct(criticalCount * 15, `${criticalCount} critical CVE${criticalCount > 1 ? 's' : ''} in dependencies`, 'security')
  if (highCount > 0)     deduct(Math.min(highCount * 8, 20),  `${highCount} high severity CVE${highCount > 1 ? 's' : ''}`, 'security')
  if (mediumCount > 0)   deduct(Math.min(mediumCount * 3, 10), `${mediumCount} medium severity CVE${mediumCount > 1 ? 's' : ''}`, 'security')
  if (lowCount > 0)      deduct(Math.min(lowCount * 1, 5),    `${lowCount} low severity CVE${lowCount > 1 ? 's' : ''}`, 'security')

  // ── Outdated Dependencies ────────────────────────────────────────────────────
  const outdated = findings.outdated?.outdated || []

  const majorBehind = outdated.filter(d => d.majorsBehind >= 2)
  const oneMajor    = outdated.filter(d => d.majorsBehind === 1)
  const minorBehind = outdated.filter(d => d.majorsBehind === 0 && d.minorsBehind > 0)

  if (majorBehind.length > 0) deduct(Math.min(majorBehind.length * 4, 15), `${majorBehind.length} deps are 2+ major versions behind`, 'dependencies')
  if (oneMajor.length > 0)    deduct(Math.min(oneMajor.length * 2, 10),    `${oneMajor.length} deps are 1 major version behind`, 'dependencies')
  if (minorBehind.length > 0) deduct(Math.min(minorBehind.length * 1, 5),  `${minorBehind.length} deps have minor updates available`, 'dependencies')

  // ── Docker issues ─────────────────────────────────────────────────────────
  const dockerIssues = findings.docker?.issues || []
  const dockerMedium = dockerIssues.filter(i => i.severity === 'medium')
  const dockerLow    = dockerIssues.filter(i => i.severity === 'low')

  if (dockerMedium.length > 0) deduct(dockerMedium.length * 3, `${dockerMedium.length} Dockerfile configuration issue${dockerMedium.length > 1 ? 's' : ''}`, 'devops')
  if (dockerLow.length > 0)    deduct(dockerLow.length * 1,    `${dockerLow.length} Dockerfile best practice gap${dockerLow.length > 1 ? 's' : ''}`, 'devops')

  // ── Git health signals ───────────────────────────────────────────────────────
  const busFactor = findings.gitMetrics?.busFactor
  if (busFactor) {
    if (busFactor.busFactorScore === 1) deduct(8, 'Bus factor of 1 — single point of knowledge failure', 'maintainability')
    else if (busFactor.busFactorScore === 2) deduct(3, 'Bus factor of 2 — limited knowledge distribution', 'maintainability')
  }

  const commitFreq = findings.gitMetrics?.commitFrequency
  if (commitFreq?.trend === 'declining') {
    deduct(5, 'Commit activity declining significantly', 'maintainability')
  }

  // High churn in many files = unstable codebase
  const highChurnFiles = findings.gitMetrics?.churn?.highChurnFiles?.filter(f => f.churnRisk === 'high') || []
  if (highChurnFiles.length >= 5) deduct(5, `${highChurnFiles.length} files with very high recent churn`, 'maintainability')

  // ── Stack support penalty ────────────────────────────────────────────────────
  // Partial/limited support means we couldn't fully analyze — score is less trustworthy
  if (findings.stack?.supportLevel === 'limited') deduct(0, 'Limited stack support — analysis may be incomplete', 'info')

  // Ensure score stays in 0–100 range
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    grade:  getGrade(score),
    label:  getLabel(score),
    color:  getColor(score),
    deductions,
    breakdown: {
      security:        deductions.filter(d => d.category === 'security').reduce((s, d) => s + d.points, 0),
      dependencies:    deductions.filter(d => d.category === 'dependencies').reduce((s, d) => s + d.points, 0),
      devops:          deductions.filter(d => d.category === 'devops').reduce((s, d) => s + d.points, 0),
      maintainability: deductions.filter(d => d.category === 'maintainability').reduce((s, d) => s + d.points, 0),
    },
    maxDeductions: 100 - score,
  }
}

function getGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function getLabel(score) {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Poor'
  return 'Critical'
}

function getColor(score) {
  if (score >= 75) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}
