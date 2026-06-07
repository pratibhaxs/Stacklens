// src/analysis/index.js — with Architecture Intelligence
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import simpleGit from 'simple-git'

import { getAllFiles }              from './get-files.js'
import { detectStack }             from './detectors/stack.js'
import { detectArchitecture }      from './detectors/architecture.js'
import { parseNpmDependencies }    from './parsers/npm.js'
import { parsePythonDependencies } from './parsers/python.js'
import { parseJavaDependencies, parseGradleDependencies } from './parsers/java.js'
import { parseGoDependencies }     from './parsers/golang.js'
import { checkVulnerabilities }    from './parsers/cve.js'
import { checkOutdatedDependencies } from './parsers/outdated.js'
import { parseDockerfile, parseDockerCompose } from './parsers/docker.js'
import { analyzeGitHistory }       from './git-metrics.js'
import { calculateHealthScore }    from './scoring.js'
import { generateAIRecommendations } from './ai/client.js'
import { analyzeArchitecture }     from './architecture/index.js'

export async function runAnalysis(repoUrl, owner, repoName) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'reposcan-'))

  try {
    // 1. Clone
    console.log(`[analysis] Cloning ${repoUrl}`)
    const git = simpleGit()
    await git.clone(repoUrl, tmpDir, ['--depth', '200', '--single-branch', '--no-tags'])

    // 2. File traversal
    console.log('[analysis] Walking file tree')
    const files = getAllFiles(tmpDir, { maxFiles: 5000 })

    if (files.sourceFiles.length < 3) {
      return {
        phase: 4, scannedAt: new Date().toISOString(),
        repo: { owner, name: repoName, url: repoUrl },
        insufficient: true,
        message: `Insufficient source code (found ${files.sourceFiles.length} source files)`,
        stats: files.stats,
      }
    }

    // 3. Stack + architecture classifier
    console.log('[analysis] Detecting stack and architecture')
    const stack        = detectStack(tmpDir, files.configFiles)
    const architecture = detectArchitecture(tmpDir, stack)

    // 4. Dependency parsing
    console.log(`[analysis] Parsing dependencies (${stack.primary?.name || 'unknown'})`)
    let parsedDeps = { ok: false, dependencies: [] }
    switch (stack.primary?.name) {
      case 'nodejs':  parsedDeps = parseNpmDependencies(tmpDir); break
      case 'python':  parsedDeps = parsePythonDependencies(tmpDir); break
      case 'java':
        parsedDeps = parseJavaDependencies(tmpDir)
        if (!parsedDeps.ok || parsedDeps.dependencies.length === 0)
          parsedDeps = parseGradleDependencies(tmpDir)
        break
      case 'go':      parsedDeps = parseGoDependencies(tmpDir); break
      default:        parsedDeps = parseNpmDependencies(tmpDir); break
    }
    const allDependencies = parsedDeps.dependencies || []

    // 5-8. Concurrent analysis — all independent, run simultaneously
    console.log('[analysis] Running concurrent analysis (CVE, outdated, Docker, git, architecture)')
    const [vulnsR, outdatedR, dockerR, composeR, gitR, archR] = await Promise.allSettled([
      checkVulnerabilities(allDependencies),
      checkOutdatedDependencies(allDependencies),
      Promise.resolve(parseDockerfile(tmpDir, files.configFiles)),
      Promise.resolve(parseDockerCompose(tmpDir)),
      analyzeGitHistory(tmpDir),
      analyzeArchitecture(files, tmpDir, null),  // git metrics passed after git analysis
    ])

    const x = (r) => r.status === 'fulfilled' ? r.value : null
    const vulnerabilities  = x(vulnsR)   || { vulnerabilities: [], checkedCount: 0 }
    const outdated         = x(outdatedR) || { outdated: [], checkedCount: 0 }
    const docker           = x(dockerR)  || { found: false }
    const dockerCompose    = x(composeR) || { found: false }
    const gitMetrics       = x(gitR)     || null

    // Architecture analysis needs git metrics for hotspot correlation
    // Re-run if git succeeded — this is fast since AST was already parsed
    let architectureIntel = x(archR)
    if (gitMetrics && architectureIntel?.supported) {
      try {
        architectureIntel = await analyzeArchitecture(files, tmpDir, gitMetrics)
      } catch { /* use first result */ }
    }

    // 9. Health score — now includes architecture score
    console.log('[analysis] Calculating health score')
    const healthScore = calculateHealthScore({
      vulnerabilities, outdated, docker, gitMetrics, stack, architectureIntel
    })

    // 10. AI recommendations — receives architecture findings too
    console.log('[analysis] Generating AI recommendations')
    const aiRecommendations = await generateAIRecommendations({
      healthScore, stack, architecture, vulnerabilities, outdated, docker,
      gitMetrics, architectureIntel
    })

    return {
      phase:     4,
      scannedAt: new Date().toISOString(),
      repo:      { owner, name: repoName, url: repoUrl, size: files.stats.totalSizeKB },
      stats:         files.stats,
      stack,
      architecture,
      architectureIntel,   // full architecture intelligence data
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
      aiRecommendations,
      summary: buildSummary(vulnerabilities, outdated, docker, healthScore, gitMetrics, aiRecommendations, architectureIntel),
    }

  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) }
    catch (e) { console.error('[analysis] Cleanup failed:', e.message) }
  }
}

function buildSummary(vulnerabilities, outdated, docker, healthScore, gitMetrics, aiRecommendations, architectureIntel) {
  return {
    score:               healthScore.score,
    grade:               healthScore.grade,
    scoreLabel:          healthScore.label,
    scoreColor:          healthScore.color,
    criticalCVEs:        vulnerabilities.summary?.CRITICAL || 0,
    highCVEs:            vulnerabilities.summary?.HIGH || 0,
    totalVulns:          vulnerabilities.summary?.total || 0,
    outdatedDeps:        outdated.summary?.total || 0,
    highRiskOutdated:    outdated.summary?.highRisk || 0,
    hasDocker:           docker.found || false,
    dockerIssues:        docker.issueCount || 0,
    hotspotCount:        gitMetrics?.hotspots?.hotspots?.length || 0,
    busFactorScore:      gitMetrics?.busFactor?.busFactorScore || null,
    commitTrend:         gitMetrics?.commitFrequency?.trend || null,
    topHotspot:          gitMetrics?.hotspots?.mostChanged?.file || null,
    hasAI:               aiRecommendations !== null,
    aiRisk:              aiRecommendations?.overallRisk || null,
    // Architecture
    architectureScore:   architectureIntel?.architectureScore?.score || null,
    architectureGrade:   architectureIntel?.architectureScore?.grade || null,
    circularDepsCount:   architectureIntel?.summary?.totalCycles || 0,
    godModulesCount:     architectureIntel?.summary?.godModulesCount || 0,
    archTopIssues:       architectureIntel?.topIssues?.length || 0,
  }
}