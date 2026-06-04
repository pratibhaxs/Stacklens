// src/analysis/architecture/scorer.js
// Combines all architecture metrics into a single Architecture Score (0-100).
// Also generates architectural hotspots by combining git churn + coupling + complexity.

export function calculateArchitectureScore(architectureData) {
  let score = 100
  const deductions = []

  const deduct = (pts, reason, category) => {
    const actual = Math.min(pts, score)
    score -= actual
    deductions.push({ points: actual, reason, category })
  }

  const { godModules, circularDeps, highCoupling, anemicModels, featureEnvy, layerViolations } = architectureData

  // God modules
  const criticalGods = (godModules || []).filter(g => g.severity === 'critical')
  const highGods     = (godModules || []).filter(g => g.severity === 'high')
  if (criticalGods.length > 0) deduct(criticalGods.length * 10, `${criticalGods.length} critical god module(s) detected`, 'complexity')
  if (highGods.length > 0)     deduct(highGods.length * 6, `${highGods.length} high-complexity god module(s)`, 'complexity')

  // Circular dependencies
  const criticalCycles = (circularDeps || []).filter(c => c.severity === 'high')
  const otherCycles    = (circularDeps || []).filter(c => c.severity !== 'high')
  if (criticalCycles.length > 0) deduct(criticalCycles.length * 8, `${criticalCycles.length} critical circular dependency cycle(s)`, 'coupling')
  if (otherCycles.length > 0)    deduct(otherCycles.length * 4, `${otherCycles.length} circular dependency cycle(s)`, 'coupling')

  // High coupling
  const criticalCoupling = (highCoupling || []).filter(c => c.couplingRisk === 'critical')
  const highCouplingMods = (highCoupling || []).filter(c => c.couplingRisk === 'high')
  if (criticalCoupling.length > 0) deduct(criticalCoupling.length * 6, `${criticalCoupling.length} critically coupled module(s)`, 'coupling')
  if (highCouplingMods.length > 0) deduct(highCouplingMods.length * 3, `${highCouplingMods.length} highly coupled module(s)`, 'coupling')

  // Anemic models
  const highAnemic = (anemicModels || []).filter(a => a.severity === 'high')
  if (highAnemic.length > 0) deduct(highAnemic.length * 4, `${highAnemic.length} anemic domain model(s)`, 'design')

  // Feature envy
  const highEnvy = (featureEnvy || []).filter(f => f.severity === 'high')
  if (highEnvy.length > 0) deduct(highEnvy.length * 3, `${highEnvy.length} feature envy instance(s)`, 'design')

  // Layer violations
  if ((layerViolations || []).length > 0) deduct(layerViolations.length * 5, `${layerViolations.length} architecture layer violation(s)`, 'structure')

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    grade:      getGrade(score),
    label:      getLabel(score),
    deductions,
    breakdown: {
      complexity: deductions.filter(d => d.category === 'complexity').reduce((s, d) => s + d.points, 0),
      coupling:   deductions.filter(d => d.category === 'coupling').reduce((s, d) => s + d.points, 0),
      design:     deductions.filter(d => d.category === 'design').reduce((s, d) => s + d.points, 0),
      structure:  deductions.filter(d => d.category === 'structure').reduce((s, d) => s + d.points, 0),
    },
  }
}

// Combines git churn + coupling + complexity into architectural hotspots
// These are the files that are simultaneously complex, coupled, AND frequently changed
// — the highest risk areas in any codebase
export function calculateArchitecturalHotspots(fileMetrics, couplingData, gitHotspots) {
  const hotspots = []

  const couplingMap = new Map(
    (couplingData || []).map(c => [c.file, c])
  )

  const gitHotspotMap = new Map()
  if (gitHotspots?.hotspots) {
    for (const h of gitHotspots.hotspots) {
      gitHotspotMap.set(h.file, h)
    }
  }

  for (const metrics of (fileMetrics || [])) {
    if (!metrics) continue

    const simplePath = metrics.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/')
    const coupling   = couplingMap.get(simplePath)
    const gitData    = gitHotspotMap.get(simplePath) ||
                       [...gitHotspotMap.entries()].find(([k]) => simplePath.includes(k))?.[1]

    // Calculate composite hotspot score
    let hotspotScore = 0
    const signals    = []

    // Complexity signal
    if (metrics.linesOfCode > 300) {
      hotspotScore += 2
      signals.push(`${metrics.linesOfCode} LOC`)
    }
    if (metrics.functions.length > 10) {
      hotspotScore += 1
      signals.push(`${metrics.functions.length} functions`)
    }

    // Coupling signal
    if (coupling?.efferentCoupling >= 5) {
      hotspotScore += 2
      signals.push(`${coupling.efferentCoupling} dependencies`)
    }

    // Git churn signal
    if (gitData?.commits >= 10) {
      hotspotScore += 2
      signals.push(`${gitData.commits} recent commits`)
    } else if (gitData?.commits >= 5) {
      hotspotScore += 1
      signals.push(`${gitData.commits} recent commits`)
    }

    if (hotspotScore >= 3) {
      hotspots.push({
        file:          simplePath,
        hotspotScore,
        severity:      hotspotScore >= 5 ? 'critical' : hotspotScore >= 4 ? 'high' : 'medium',
        signals,
        linesOfCode:   metrics.linesOfCode,
        coupling:      coupling?.efferentCoupling || 0,
        gitCommits:    gitData?.commits || 0,
        suggestion:    `High-priority refactor candidate: complex, coupled, and frequently changed`,
      })
    }
  }

  return hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore).slice(0, 10)
}

function getGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function getLabel(score) {
  if (score >= 90) return 'Excellent architecture'
  if (score >= 75) return 'Good architecture'
  if (score >= 60) return 'Some architectural concerns'
  if (score >= 40) return 'Significant architectural debt'
  return 'Critical architectural issues'
}
