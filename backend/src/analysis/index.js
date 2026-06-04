// src/analysis/architecture/index.js
// Main entry point for architecture intelligence analysis.
// Orchestrates: AST parsing → dependency graph → anti-pattern detection → scoring.
//
// Only runs on JS/TS files — the languages where AST parsing is supported.
// For Java/Python/Go, we fall back to file-level metrics (LOC, import count).
// This is intentional — deep AST analysis of every language would take too long.

import path from 'path'
import { PARSEABLE_EXTENSIONS, parseFile } from './ast-parser.js'
import { buildDependencyGraph, detectCycles, calculateCoupling } from './dependency-graph.js'
import {
  detectGodModules,
  formatCircularDeps,
  formatHighCoupling,
  detectAnemicModels,
  detectFeatureEnvy,
  detectLayerViolations,
} from './anti-patterns.js'
import { calculateArchitectureScore, calculateArchitecturalHotspots } from './scorer.js'

const MAX_FILES_TO_PARSE = 150  // cap for performance — parsing AST is CPU-intensive

export async function analyzeArchitecture(files, rootDir, gitMetrics) {
  // Filter to parseable JS/TS source files only
  const parseableFiles = files.sourceFiles
    .filter(f => PARSEABLE_EXTENSIONS.has(f.ext))
    .slice(0, MAX_FILES_TO_PARSE)

  if (parseableFiles.length < 3) {
    return {
      supported:   false,
      reason:      'Insufficient JavaScript/TypeScript files for architecture analysis',
      fileCount:   parseableFiles.length,
    }
  }

  console.log(`[architecture] Parsing ${parseableFiles.length} JS/TS files...`)

  // ── Phase A: Parse all files ──────────────────────────────────────────────
  const fileMetrics = parseableFiles
    .map(f => parseFile(f.path))
    .filter(Boolean)  // remove files that failed to parse

  console.log(`[architecture] Successfully parsed ${fileMetrics.length} files`)

  // ── Phase B: Build dependency graph ───────────────────────────────────────
  const { graph, reverseGraph } = buildDependencyGraph(fileMetrics, rootDir)

  // ── Phase C: Detect all anti-patterns ─────────────────────────────────────
  const rawCycles      = detectCycles(graph)
  const couplingData   = calculateCoupling(graph, reverseGraph)

  const godModules        = detectGodModules(fileMetrics)
  const circularDeps      = formatCircularDeps(rawCycles)
  const highCoupling      = formatHighCoupling(couplingData)
  const anemicModels      = detectAnemicModels(fileMetrics)
  const featureEnvy       = detectFeatureEnvy(fileMetrics, graph)
  const layerViolations   = detectLayerViolations(fileMetrics, graph)

  // ── Phase D: Calculate scores ─────────────────────────────────────────────
  const architectureData = { godModules, circularDeps, highCoupling, anemicModels, featureEnvy, layerViolations }
  const architectureScore = calculateArchitectureScore(architectureData)

  // ── Phase E: Architectural hotspots (combines all signals) ────────────────
  const architecturalHotspots = calculateArchitecturalHotspots(
    fileMetrics,
    couplingData,
    gitMetrics?.hotspots
  )

  // ── Phase F: Summary stats ────────────────────────────────────────────────
  const summary = {
    filesAnalyzed:      fileMetrics.length,
    totalCycles:        rawCycles.length,
    criticalCycles:     circularDeps.filter(c => c.severity === 'high').length,
    godModulesCount:    godModules.length,
    highCouplingCount:  highCoupling.length,
    anemicModelsCount:  anemicModels.length,
    featureEnvyCount:   featureEnvy.length,
    layerViolations:    layerViolations.length,
    hotspotCount:       architecturalHotspots.length,
    architectureScore:  architectureScore.score,
    architectureGrade:  architectureScore.grade,
  }

  // Top issues for quick display
  const topIssues = buildTopIssues(godModules, circularDeps, highCoupling, layerViolations)

  return {
    supported:           true,
    filesParsed:         fileMetrics.length,
    architectureScore,
    summary,
    topIssues,
    godModules:          godModules.slice(0, 5),
    circularDeps:        circularDeps.slice(0, 5),
    highCoupling:        highCoupling.slice(0, 8),
    anemicModels:        anemicModels.slice(0, 5),
    featureEnvy:         featureEnvy.slice(0, 5),
    layerViolations,
    architecturalHotspots,
    // Full coupling data for dependency graph visualization
    couplingData:        couplingData.slice(0, 20),
  }
}

// Builds a prioritized list of top issues across all categories
function buildTopIssues(godModules, circularDeps, highCoupling, layerViolations) {
  const issues = []

  circularDeps
    .filter(c => c.severity === 'high')
    .slice(0, 3)
    .forEach(c => issues.push({
      severity: 'critical',
      category: 'circular-dependency',
      title:    'Circular dependency detected',
      detail:   c.display,
      fix:      c.suggestion,
    }))

  layerViolations
    .slice(0, 3)
    .forEach(v => issues.push({
      severity: 'high',
      category: 'layer-violation',
      title:    'Architecture layer violation',
      detail:   `${v.from} → ${v.to}`,
      fix:      v.suggestion,
    }))

  godModules
    .filter(g => g.severity === 'critical')
    .slice(0, 3)
    .forEach(g => issues.push({
      severity: 'high',
      category: 'god-module',
      title:    'God module detected',
      detail:   `${g.file} (${g.linesOfCode} LOC, ${g.functionCount} functions)`,
      fix:      g.suggestion,
    }))

  highCoupling
    .filter(c => c.couplingRisk === 'critical')
    .slice(0, 3)
    .forEach(c => issues.push({
      severity: 'medium',
      category: 'high-coupling',
      title:    'High coupling detected',
      detail:   `${c.file} has ${c.efferentCoupling} outgoing dependencies`,
      fix:      c.suggestion,
    }))

  return issues.slice(0, 8)
}
