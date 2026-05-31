// src/analysis/ai/prompt.js
// Builds the prompt sent to the AI.
// The single most important rule: AI only receives STRUCTURED FINDINGS JSON.
// Never raw source code. Never file contents. Never git diffs.
//
// Why: if you send raw code, the AI invents issues unrelated to actual findings.
// Sending structured data means every AI statement is grounded in something real.
// The explicit "do NOT mention" instruction is the hallucination guard.
//
// This file is separated from the API call so it's easy to test and iterate
// the prompt without touching network code.

export function buildAnalysisPrompt(findings) {
  // Strip the findings down to only what the AI needs
  // Why: smaller context = faster response, lower cost, less hallucination surface
  const condensed = condenseFindings(findings)

  return `You are a senior software engineer reviewing automated analysis results for a GitHub repository.

Your job is to provide actionable, specific engineering recommendations based ONLY on the data provided.

STRICT RULES:
- Only comment on issues present in the JSON data below
- Do NOT mention technologies, tools, patterns, or issues not present in the data
- Do NOT invent problems. If data is missing (null), skip that category entirely
- Be specific — reference actual package names, file names, and numbers from the data
- Prioritize by impact, not by category

Repository analysis data:
${JSON.stringify(condensed, null, 2)}

Respond with ONLY valid JSON in this exact structure (no markdown, no backticks, no preamble):
{
  "summary": "2-3 sentence plain-English overview of the repository's health. Be specific about what you found.",
  "overallRisk": "critical|high|medium|low",
  "priorities": [
    {
      "rank": 1,
      "category": "security|dependencies|devops|maintainability|architecture",
      "title": "Short specific title referencing actual findings",
      "description": "What the problem is and why it matters. Reference specific packages/files/numbers.",
      "action": "Specific step to fix this. Not generic advice.",
      "effort": "low|medium|high",
      "impact": "low|medium|high"
    }
  ],
  "positives": [
    "One specific thing the repo does well (only if genuinely present in the data)"
  ],
  "modernizationRoadmap": [
    {
      "timeframe": "this week|this month|this quarter",
      "action": "Specific action referencing actual findings"
    }
  ]
}`
}

// Condenses findings into minimal structure for the prompt
// Why condense: full findings JSON can be 50KB+. We extract only the signal.
function condenseFindings(findings) {
  const out = {}

  // Health score
  if (findings.healthScore) {
    out.healthScore = {
      score:      findings.healthScore.score,
      grade:      findings.healthScore.grade,
      label:      findings.healthScore.label,
      deductions: findings.healthScore.deductions?.slice(0, 10), // top 10 deductions
    }
  }

  // Stack
  if (findings.stack?.primary) {
    out.stack = {
      primary:    findings.stack.primary.label,
      frameworks: findings.stack.frameworks,
      isMonorepo: findings.stack.isMonorepo,
      support:    findings.stack.supportLevel,
    }
  }

  // Architecture
  if (findings.architecture?.architecture !== 'unclear') {
    out.architecture = {
      type:       findings.architecture.architecture,
      label:      findings.architecture.label,
      confidence: findings.architecture.confidence,
    }
  }

  // CVEs — only include critical and high severity
  // Why filter: sending 200 low-severity CVEs wastes tokens
  const vulns = findings.vulnerabilities?.vulnerabilities || []
  const criticalAndHigh = vulns.filter(v => ['CRITICAL', 'HIGH'].includes(v.severity))
  if (criticalAndHigh.length > 0) {
    out.vulnerabilities = {
      summary:  findings.vulnerabilities.summary,
      topIssues: criticalAndHigh.slice(0, 10).map(v => ({
        package:  v.packageName,
        version:  v.installedVersion,
        severity: v.severity,
        id:       v.vulnId,
        summary:  v.summary?.slice(0, 120),  // truncate long summaries
        fixed:    v.fixedVersions?.[0] || null,
      })),
    }
  } else if (findings.vulnerabilities?.summary?.total > 0) {
    out.vulnerabilities = { summary: findings.vulnerabilities.summary, topIssues: [] }
  }

  // Outdated deps — only major version gaps
  const outdated = findings.outdated?.outdated || []
  const majorOutdated = outdated.filter(d => d.majorsBehind >= 1)
  if (majorOutdated.length > 0) {
    out.outdatedDependencies = {
      total:    findings.outdated.summary?.total,
      highRisk: findings.outdated.summary?.highRisk,
      packages: majorOutdated.slice(0, 8).map(d => ({
        name:     d.name,
        current:  d.installedVersion,
        latest:   d.latestVersion,
        majors:   d.majorsBehind,
      })),
    }
  }

  // Docker issues
  if (findings.docker?.found && findings.docker?.issues?.length > 0) {
    out.dockerIssues = findings.docker.issues.map(i => ({
      severity: i.severity,
      issue:    i.issue,
    }))
  }

  // Git metrics — key signals only
  if (findings.gitMetrics) {
    const gm = findings.gitMetrics
    out.gitIntelligence = {}

    if (gm.busFactor) {
      out.gitIntelligence.busFactor = {
        score:          gm.busFactor.busFactorScore,
        interpretation: gm.busFactor.interpretation,
        riskFiles:      gm.busFactor.riskFiles?.slice(0, 5).map(f => f.file),
      }
    }

    if (gm.hotspots?.hotspots?.length > 0) {
      out.gitIntelligence.hotspots = gm.hotspots.hotspots
        .filter(h => h.risk === 'high' || h.risk === 'medium')
        .slice(0, 5)
        .map(h => ({ file: h.file, commits: h.commits, risk: h.risk }))
    }

    if (gm.commitFrequency?.trend) {
      out.gitIntelligence.commitTrend = {
        trend:   gm.commitFrequency.trend,
        label:   gm.commitFrequency.trendLabel,
        avgPerWeek: gm.commitFrequency.avgPerWeek,
      }
    }
  }

  return out
}
