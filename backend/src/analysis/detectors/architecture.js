// src/analysis/detectors/architecture.js
// Classifies the architectural pattern of a repo using signal scoring.
// Why signal scoring instead of simple if/else: no single file proves architecture.
// Multiple weak signals together form a confident conclusion.
// Why "unclear" when uncertain: wrong confident answer destroys trust.
// "unclear" is honest and doesn't mislead the user or the AI layer.

import fs from 'fs'
import path from 'path'

export function detectArchitecture(rootDir, stackInfo) {
  const scores = {
    microservices: 0,
    monolith:      0,
    serverless:    0,
    library:       0,
  }

  const signals = []  // collected for dashboard display — "why we think this"

  // ── Microservices signals ────────────────────────────────────────────────────
  const hasDockerCompose = fs.existsSync(path.join(rootDir, 'docker-compose.yml')) ||
                           fs.existsSync(path.join(rootDir, 'docker-compose.yaml'))
  if (hasDockerCompose) {
    try {
      const compose = fs.readFileSync(
        path.join(rootDir, fs.existsSync(path.join(rootDir,'docker-compose.yml'))
          ? 'docker-compose.yml' : 'docker-compose.yaml'), 'utf-8'
      )
      // count services in docker-compose — 3+ services strongly suggests microservices
      const serviceMatches = compose.match(/^\s{2}[a-zA-Z0-9_-]+:/gm) || []
      if (serviceMatches.length >= 3) {
        scores.microservices += 3
        signals.push({ type: 'microservices', text: `docker-compose.yml has ${serviceMatches.length} services` })
      } else if (serviceMatches.length >= 2) {
        scores.microservices += 1
        signals.push({ type: 'microservices', text: 'docker-compose.yml with multiple services' })
      }
    } catch { /* ignore parse error */ }
  }

  // Multiple package.json files in subdirectories = strong microservices/monorepo signal
  if (stackInfo.isMonorepo) {
    scores.microservices += 2
    signals.push({ type: 'microservices', text: `Monorepo structure detected (${stackInfo.monorepoWorkspaces.join(', ')})` })
  }

  // API gateway pattern
  const hasApiGateway = ['api-gateway', 'gateway', 'proxy'].some(d =>
    fs.existsSync(path.join(rootDir, d))
  )
  if (hasApiGateway) {
    scores.microservices += 2
    signals.push({ type: 'microservices', text: 'API gateway directory found' })
  }

  // ── Serverless signals ───────────────────────────────────────────────────────
  const hasServerlessConfig = ['serverless.yml', 'serverless.yaml', 'serverless.json'].some(f =>
    fs.existsSync(path.join(rootDir, f))
  )
  if (hasServerlessConfig) {
    scores.serverless += 4
    signals.push({ type: 'serverless', text: 'serverless.yml configuration found' })
  }

  const hasSAM = fs.existsSync(path.join(rootDir, 'template.yaml')) ||
                  fs.existsSync(path.join(rootDir, 'sam.yaml'))
  if (hasSAM) {
    scores.serverless += 3
    signals.push({ type: 'serverless', text: 'AWS SAM template found' })
  }

  // Lambda functions directory
  if (fs.existsSync(path.join(rootDir, 'functions')) ||
      fs.existsSync(path.join(rootDir, 'lambdas'))) {
    scores.serverless += 2
    signals.push({ type: 'serverless', text: 'Functions/lambdas directory found' })
  }

  // ── Library/package signals ──────────────────────────────────────────────────
  if (stackInfo.primary?.name === 'nodejs') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'))
      if (pkg.main || pkg.exports || pkg.module) {
        scores.library += 3
        signals.push({ type: 'library', text: 'package.json has main/exports entry point (published package)' })
      }
      if (!pkg.scripts?.start && !pkg.scripts?.dev) {
        scores.library += 1
        signals.push({ type: 'library', text: 'No start/dev scripts (likely a library, not an app)' })
      }
    } catch { /* ignore */ }
  }

  // ── Monolith signals ─────────────────────────────────────────────────────────
  const MONOLITH_DIRS = ['src', 'app', 'lib', 'core', 'domain', 'models', 'controllers', 'views']
  const foundMonolithDirs = MONOLITH_DIRS.filter(d => fs.existsSync(path.join(rootDir, d)))
  scores.monolith += foundMonolithDirs.length
  if (foundMonolithDirs.length > 0) {
    signals.push({ type: 'monolith', text: `Standard app structure: ${foundMonolithDirs.join(', ')}` })
  }

  // Single package.json at root with no subdirectory packages = monolith
  if (stackInfo.primary?.name === 'nodejs' && !stackInfo.isMonorepo) {
    scores.monolith += 2
    signals.push({ type: 'monolith', text: 'Single root package.json (not a monorepo)' })
  }

  // ── Determine winner ─────────────────────────────────────────────────────────
  const sorted = Object.entries(scores).sort(([,a],[,b]) => b - a)
  const [topType, topScore] = sorted[0]
  const [, secondScore] = sorted[1]
  const confidence = topScore - secondScore

  // Require minimum score AND meaningful separation from second place
  // Why: a monolith with score 2 and microservices with score 1 isn't confident enough
  const architecture = (topScore >= 3 && confidence >= 2) ? topType : 'unclear'

  const ARCHITECTURE_LABELS = {
    microservices: 'Microservices / Distributed',
    monolith:      'Monolithic Application',
    serverless:    'Serverless',
    library:       'Library / Package',
    unclear:       'Architecture unclear',
  }

  return {
    architecture,
    label: ARCHITECTURE_LABELS[architecture],
    confidence: confidence >= 4 ? 'high' : confidence >= 2 ? 'medium' : 'low',
    scores,
    signals: signals.filter(s => s.type === architecture || architecture === 'unclear'),
    allSignals: signals,
  }
}
