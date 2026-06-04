// src/analysis/architecture/anti-patterns.js
// Detects specific architectural anti-patterns using AST metrics + dependency graph.
//
// The 6 anti-patterns detected:
//   1. God Module    — one file does everything (too big, too many responsibilities)
//   2. Circular Deps — A imports B imports A (tight coupling, maintenance nightmare)
//   3. High Coupling — one module imports too many others (fragile, hard to test)
//   4. Anemic Model  — classes with fields but no methods (logic leak to services)
//   5. Feature Envy  — module heavily accesses another module's internals
//   6. Layer Violation — controller accesses repo directly, skipping service layer

// ─── 1. God Module Detection ─────────────────────────────────────────────────
export function detectGodModules(fileMetrics) {
  const godModules = []

  for (const metrics of fileMetrics) {
    if (!metrics) continue

    const score  = calculateGodScore(metrics)
    const issues = []

    if (metrics.linesOfCode > 500)    issues.push(`${metrics.linesOfCode} lines of code (threshold: 500)`)
    if (metrics.functions.length > 15) issues.push(`${metrics.functions.length} functions (threshold: 15)`)
    if (metrics.imports.length > 15)   issues.push(`${metrics.imports.length} imports (threshold: 15)`)
    if (metrics.classes.length > 3)    issues.push(`${metrics.classes.length} classes in one file (threshold: 3)`)

    if (score >= 2) {
      godModules.push({
        file:          simplifyPath(metrics.filePath),
        fullPath:      metrics.filePath,
        score,
        severity:      score >= 4 ? 'critical' : score >= 3 ? 'high' : 'medium',
        linesOfCode:   metrics.linesOfCode,
        functionCount: metrics.functions.length,
        importCount:   metrics.imports.length,
        classCount:    metrics.classes.length,
        issues,
        suggestion:    `Consider splitting ${simplifyPath(metrics.filePath)} into smaller, focused modules`,
      })
    }
  }

  return godModules.sort((a, b) => b.score - a.score)
}

function calculateGodScore(metrics) {
  let score = 0
  if (metrics.linesOfCode > 500)     score++
  if (metrics.linesOfCode > 1000)    score++
  if (metrics.functions.length > 15) score++
  if (metrics.functions.length > 30) score++
  if (metrics.imports.length > 15)   score++
  if (metrics.classes.length > 3)    score++
  return score
}

// ─── 2. Circular Dependency Formatting ───────────────────────────────────────
// (Detection done in dependency-graph.js — this formats the results)
export function formatCircularDeps(cycles) {
  return cycles.slice(0, 10).map(cycle => {
    const simplified = cycle.map(simplifyPath)
    return {
      cycle:      simplified,
      length:     cycle.length,
      severity:   cycle.length <= 2 ? 'high' : cycle.length <= 4 ? 'medium' : 'low',
      display:    simplified.join(' → '),
      suggestion: `Break the cycle by extracting shared logic into a separate module that neither ${simplified[0]} nor ${simplified[simplified.length - 2]} imports`,
    }
  })
}

// ─── 3. High Coupling Formatting ─────────────────────────────────────────────
export function formatHighCoupling(couplingData) {
  return couplingData
    .filter(c => c.couplingRisk === 'critical' || c.couplingRisk === 'high')
    .slice(0, 10)
    .map(c => ({
      ...c,
      file:       simplifyPath(c.file),
      suggestion: c.efferentCoupling >= 7
        ? `${simplifyPath(c.file)} imports ${c.efferentCoupling} modules — consider dependency injection or splitting responsibilities`
        : `${simplifyPath(c.file)} has high coupling — review if all dependencies are necessary`,
    }))
}

// ─── 4. Anemic Domain Model Detection ────────────────────────────────────────
// A class with many properties but few methods = data bag, no behavior
// Logic is probably leaking into service classes elsewhere
export function detectAnemicModels(fileMetrics) {
  const anemicModels = []

  for (const metrics of fileMetrics) {
    if (!metrics) continue

    for (const cls of metrics.classes) {
      // Anemic: has properties (fields) but almost no methods
      // Ignore classes with < 2 properties — probably simple value objects
      if (cls.properties >= 3 && cls.methodCount <= 1) {
        anemicModels.push({
          className:   cls.name,
          file:        simplifyPath(metrics.filePath),
          properties:  cls.properties,
          methods:     cls.methodCount,
          severity:    cls.properties >= 6 && cls.methodCount === 0 ? 'high' : 'medium',
          suggestion:  `${cls.name} has ${cls.properties} properties but ${cls.methodCount} method(s). Consider moving related business logic into the class itself`,
        })
      }
    }
  }

  return anemicModels.sort((a, b) => (b.properties - b.methods) - (a.properties - a.methods))
}

// ─── 5. Feature Envy Detection ───────────────────────────────────────────────
// Module A repeatedly imports from Module B AND uses many of B's exports
// Suggests A might be doing B's job — A "envies" B's data/functionality
export function detectFeatureEnvy(fileMetrics, graph) {
  const featureEnvy = []

  for (const metrics of fileMetrics) {
    if (!metrics) continue

    // Count how many times each module is imported
    const importCounts = new Map()
    for (const imp of metrics.imports) {
      if (!imp.source.startsWith('.')) continue  // skip node_modules
      const count = importCounts.get(imp.source) || 0
      importCounts.set(imp.source, count + imp.specifiers.length)
    }

    // Flag if a module imports many specifiers from one source
    // More than 5 named imports from one module = feature envy
    for (const [source, count] of importCounts.entries()) {
      if (count >= 5) {
        featureEnvy.push({
          envyingModule: simplifyPath(metrics.filePath),
          enviedModule:  source,
          importCount:   count,
          severity:      count >= 10 ? 'high' : 'medium',
          suggestion:    `${simplifyPath(metrics.filePath)} imports ${count} items from ${source}. Consider moving related logic closer to ${source} or creating an abstraction`,
        })
      }
    }
  }

  return featureEnvy.sort((a, b) => b.importCount - a.importCount).slice(0, 10)
}

// ─── 6. Layer Violation Detection ────────────────────────────────────────────
// Detects when presentation layer (controller/route) directly accesses
// data layer (repository/model) bypassing the service/business layer.
// Only works for projects following a layered architecture naming convention.
export function detectLayerViolations(fileMetrics, graph) {
  const violations = []

  // Identify layers by directory/filename patterns
  const LAYER_PATTERNS = {
    controller: ['controller', 'route', 'handler', 'resolver'],
    service:    ['service', 'usecase', 'use-case', 'domain'],
    repository: ['repository', 'repo', 'dao', 'model', 'entity', 'schema'],
  }

  function getLayer(filePath) {
    const lower = filePath.toLowerCase()
    for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
      if (patterns.some(p => lower.includes(p))) return layer
    }
    return null
  }

  for (const metrics of fileMetrics) {
    if (!metrics) continue

    const fromLayer = getLayer(metrics.filePath)
    if (fromLayer !== 'controller') continue  // only check controllers

    for (const imp of metrics.imports) {
      if (!imp.source.startsWith('.')) continue

      const toLayer = getLayer(imp.source)
      if (toLayer === 'repository') {
        violations.push({
          from:       simplifyPath(metrics.filePath),
          to:         imp.source,
          fromLayer:  'controller',
          toLayer:    'repository',
          severity:   'high',
          suggestion: `${simplifyPath(metrics.filePath)} directly imports from repository layer. Route through a service layer to maintain separation of concerns`,
        })
      }
    }
  }

  return violations
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function simplifyPath(filePath) {
  if (!filePath) return ''
  const parts = filePath.replace(/\\/g, '/').split('/')
  // Return last 2-3 path segments for readability
  return parts.slice(-3).join('/')
}
