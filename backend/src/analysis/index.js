// src/analysis/index.js
// Phase 3 — adds AI recommendations on top of Phase 2 findings.
// The AI layer is always the LAST step — it receives all real findings
// and generates explanations. If it fails, everything else still works.

import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import simpleGit from 'simple-git'

import { getAllFiles }                from './get-files.js'
import { detectStack }               from './detectors/stack.js'
import { detectArchitecture }        from './detectors/architecture.js'
import { parseNpmDependencies }      from './parsers/npm.js'
import { parsePythonDependencies }   from './parsers/python.js'
import { checkVulnerabilities }      from './parsers/cve.js'
import { checkOutdatedDependencies } from './parsers/outdated.js'
import { parseDockerfile, parseDockerCompose } from './parsers/docker.js'
import { analyzeGitHistory }         from './git-metrics.js'
import { calculateHealthScore }      from './scoring.js'
import { generateAIRecommendations } from './ai/client.js'

export async function runAnalysis(repoUrl, owner, repoName) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'reposcan-'))

  try {
    // ── 1. Clone ───────────────────────────────────────────────────────────────
    console.log(`[analysis] Cloning ${repoUrl}`)
    const git = simpleGit()
    await git.clone(repoUrl, tmpDir, ['--depth', '200', '--single-branch', '--no-tags'])

    // ── 2. File traversal ──────────────────────────────────────────────────────
    console.log('[analysis] Walking file tree')
    const files = getAllFiles(tmpDir, { maxFiles: 5000 })

    if (files.sourceFiles.length < 3) {
      return {
        phase: 3, scannedAt: new Date().toISOString(),
        repo: { owner, name: repoName, url: repoUrl },
        insufficient: true,
        message: `Insufficient source code (found ${files.sourceFiles.length} source files)`,
        stats: files.stats,
      }
    }

    // ── 3. Stack + Architecture ────────────────────────────────────────────────
    console.log('[analysis] Detecting stack and architecture')
    const stack        = detectStack(tmpDir, files.configFiles)
    const architecture = detectArchitecture(tmpDir, stack)

    // ── 4. Dependency parsing ──────────────────────────────────────────────────
    console.log(`[analysis] Parsing dependencies (${stack.primary?.name || 'unknown'})`)
    let parsedDeps = { ok: false, dependencies: [] }
    if (stack.primary?.name === 'nodejs')  parsedDeps = parseNpmDependencies(tmpDir)
    else if (stack.primary?.name === 'python') parsedDeps = parsePythonDependencies(tmpDir)
    const allDependencies = parsedDeps.dependencies || []

    // ── 5-7. Concurrent analysis ───────────────────────────────────────────────
    console.log('[analysis] Running CVE, outdated, Docker, git analysis concurrently')
    const [vulnsR, outdatedR, dockerR, composeR, gitR] = await Promise.allSettled([
      checkVulnerabilities(allDependencies),
      checkOutdatedDependencies(allDependencies),
      Promise.resolve(parseDockerfile(tmpDir, files.configFiles)),
      Promise.resolve(parseDockerCompose(tmpDir)),
      analyzeGitHistory(tmpDir),
    ])

    const x = (r) => r.status === 'fulfilled' ? r.value : null
    const vulnerabilities = x(vulnsR)   || { vulnerabilities: [], checkedCount: 0 }
    const outdated        = x(outdatedR) || { outdated: [], checkedCount: 0 }
    const docker          = x(dockerR)  || { found: false }
    const dockerCompose   = x(composeR) || { found: false }
    const gitMetrics      = x(gitR)     || null

    // ── 8. Health score ────────────────────────────────────────────────────────
    console.log('[analysis] Calculating health score')
    const healthScore = calculateHealthScore({ vulnerabilities, outdated, docker, gitMetrics, stack })

    // ── 9. AI recommendations ──────────────────────────────────────────────────
    // Always last — receives real findings, never raw code.
    // Returns null if API unavailable — never fails the scan.
    console.log('[analysis] Generating AI recommendations')
    const allFindings = { healthScore, stack, architecture, vulnerabilities, outdated, docker, gitMetrics }
    const aiRecommendations = await generateAIRecommendations(allFindings)

    if (aiRecommendations) console.log('[analysis] AI recommendations generated successfully')
    else console.warn('[analysis] AI recommendations unavailable — proceeding without them')

    return {
      phase:     3,
      scannedAt: new Date().toISOString(),
      repo:      { owner, name: repoName, url: repoUrl, size: files.stats.totalSizeKB },
      stats:         files.stats,
      stack,
      architecture,
      dependencies: {
        ...parsedDeps,
        dependencies: undefined,
        summary: {
          total:     allDependencies.length,
          prod:      allDependencies.filter(d => !d.isDev).length,
          dev:       allDependencies.filter(d => d.isDev).length,
          ecosystem: stack.primary?.name || 'unknown',
        },
      },
      vulnerabilities,
      outdated,
      docker,
      dockerCompose,
      gitMetrics,
      healthScore,
      aiRecommendations,  // null if unavailable — dashboard handles gracefully
      summary: buildSummary(vulnerabilities, outdated, docker, healthScore, gitMetrics, aiRecommendations),
    }

  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) }
    catch (e) { console.error('[analysis] Cleanup failed:', e.message) }
  }
}

function buildSummary(vulnerabilities, outdated, docker, healthScore, gitMetrics, aiRecommendations) {
  return {
    score:             healthScore.score,
    grade:             healthScore.grade,
    scoreLabel:        healthScore.label,
    scoreColor:        healthScore.color,
    criticalCVEs:      vulnerabilities.summary?.CRITICAL || 0,
    highCVEs:          vulnerabilities.summary?.HIGH || 0,
    totalVulns:        vulnerabilities.summary?.total || 0,
    outdatedDeps:      outdated.summary?.total || 0,
    highRiskOutdated:  outdated.summary?.highRisk || 0,
    hasDocker:         docker.found || false,
    dockerIssues:      docker.issueCount || 0,
    hotspotCount:      gitMetrics?.hotspots?.hotspots?.length || 0,
    busFactorScore:    gitMetrics?.busFactor?.busFactorScore || null,
    commitTrend:       gitMetrics?.commitFrequency?.trend || null,
    topHotspot:        gitMetrics?.hotspots?.mostChanged?.file || null,
    hasAI:             aiRecommendations !== null,
    aiRisk:            aiRecommendations?.overallRisk || null,
  }
}
