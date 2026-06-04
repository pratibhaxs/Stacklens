// src/analysis/architecture/dependency-graph.js
// Builds a directed graph of module dependencies from parsed file metrics.
// Nodes = files, Edges = import relationships.
// Used for: circular dependency detection, coupling analysis, feature envy.

import path from 'path'

// Builds dependency graph from array of parsed file metrics
// Returns adjacency list + reverse adjacency list
export function buildDependencyGraph(fileMetrics, rootDir) {
  // node = relative file path
  // edge A→B = file A imports file B
  const graph        = new Map()  // file → Set of files it imports
  const reverseGraph = new Map()  // file → Set of files that import it

  // Build file lookup: module name → actual file path
  const fileIndex = buildFileIndex(fileMetrics, rootDir)

  // Initialize all nodes
  for (const metrics of fileMetrics) {
    const rel = metrics.filePath.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '')
    if (!graph.has(rel))        graph.set(rel, new Set())
    if (!reverseGraph.has(rel)) reverseGraph.set(rel, new Set())
  }

  // Add edges from imports
  for (const metrics of fileMetrics) {
    const fromRel = metrics.filePath.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '')

    for (const imp of metrics.imports) {
      // Only track relative imports (local modules, not node_modules)
      // Why: we want to analyze YOUR code structure, not library dependencies
      if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) continue

      const resolvedPath = resolveImport(metrics.filePath, imp.source, fileIndex, rootDir)
      if (!resolvedPath) continue

      const toRel = resolvedPath.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '')

      if (graph.has(fromRel) && graph.has(toRel) && fromRel !== toRel) {
        graph.get(fromRel).add(toRel)
        reverseGraph.get(toRel).add(fromRel)
      }
    }
  }

  return { graph, reverseGraph, fileIndex }
}

// Detects all cycles in the dependency graph using DFS
// Returns array of cycles, each cycle is an array of file paths
export function detectCycles(graph) {
  const cycles  = []
  const visited = new Set()
  const inStack = new Set()

  function dfs(node, stack) {
    visited.add(node)
    inStack.add(node)
    stack.push(node)

    const neighbors = graph.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, stack)
      } else if (inStack.has(neighbor)) {
        // Found a cycle — extract it from the stack
        const cycleStart = stack.indexOf(neighbor)
        if (cycleStart !== -1) {
          const cycle = stack.slice(cycleStart)
          // Deduplicate cycles (same cycle found from different starting points)
          const cycleKey = [...cycle].sort().join('|')
          if (!cycles.find(c => [...c].sort().join('|') === cycleKey)) {
            cycles.push([...cycle, neighbor])  // add the start node again to show the loop
          }
        }
      }
    }

    stack.pop()
    inStack.delete(node)
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [])
    }
  }

  return cycles
}

// Calculates coupling score for each module
// Afferent coupling (Ca) = how many modules import this one (instability risk)
// Efferent coupling (Ce) = how many modules this imports (dependency risk)
export function calculateCoupling(graph, reverseGraph) {
  const coupling = []

  for (const [file, imports] of graph.entries()) {
    const ce = imports.size                              // efferent: this imports N others
    const ca = (reverseGraph.get(file) || new Set()).size  // afferent: N others import this

    const instability = (ce + ca) > 0 ? ce / (ce + ca) : 0  // 0=stable, 1=unstable

    coupling.push({
      file,
      efferentCoupling: ce,    // outgoing dependencies
      afferentCoupling: ca,    // incoming dependencies (how widely used)
      totalCoupling:    ce + ca,
      instability:      Math.round(instability * 100) / 100,
      // Risk: high outgoing (depends on many) + low incoming (few depend on it) = unstable
      couplingRisk:
        ce >= 10  ? 'critical' :
        ce >= 7   ? 'high'     :
        ce >= 4   ? 'medium'   : 'low',
    })
  }

  // Sort by total coupling descending
  return coupling.sort((a, b) => b.totalCoupling - a.totalCoupling)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFileIndex(fileMetrics, rootDir) {
  const index = new Map()
  for (const m of fileMetrics) {
    const rel = m.filePath.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '')
    // Index by relative path, filename without extension, and full path
    index.set(rel, m.filePath)
    const noExt = rel.replace(/\.(js|jsx|ts|tsx|mjs)$/, '')
    index.set(noExt, m.filePath)
  }
  return index
}

function resolveImport(fromFile, importSource, fileIndex, rootDir) {
  const fromDir  = path.dirname(fromFile)
  const resolved = path.resolve(fromDir, importSource)
  const relResolved = resolved.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '')

  // Try exact path
  if (fileIndex.has(relResolved)) return fileIndex.get(relResolved)

  // Try with common extensions
  for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.mjs']) {
    const withExt = relResolved + ext
    if (fileIndex.has(withExt)) return fileIndex.get(withExt)
  }

  // Try index file
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    const indexPath = relResolved + '/index' + ext
    if (fileIndex.has(indexPath)) return fileIndex.get(indexPath)
  }

  return null
}
