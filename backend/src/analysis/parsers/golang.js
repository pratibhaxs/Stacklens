// src/analysis/parsers/golang.js
// Parses go.mod to extract Go module dependencies.
// go.mod has a simple, consistent format — text parsing is the right approach.
// No XML, no JSON, just plain text with a well-defined grammar.

import fs   from 'fs'
import path from 'path'

export function parseGoDependencies(rootDir) {
  const goModPath = path.join(rootDir, 'go.mod')

  if (!fs.existsSync(goModPath)) {
    return { ok: false, error: 'No go.mod found', dependencies: [] }
  }

  let content
  try {
    content = fs.readFileSync(goModPath, 'utf-8')
  } catch (e) {
    return { ok: false, error: `Could not read go.mod: ${e.message}`, dependencies: [] }
  }

  const lines       = content.split('\n')
  const dependencies = []

  // Extract module name (first line: "module github.com/owner/repo")
  const moduleLine = lines.find(l => l.trim().startsWith('module '))
  const moduleName = moduleLine ? moduleLine.replace('module', '').trim() : null

  // Extract Go version ("go 1.21")
  const goVersionLine = lines.find(l => l.trim().startsWith('go '))
  const goVersion = goVersionLine ? goVersionLine.replace('go', '').trim() : null

  // Parse require blocks
  // Two formats:
  // Single: require github.com/pkg/errors v0.9.1
  // Block:  require (
  //           github.com/pkg/errors v0.9.1
  //           github.com/stretchr/testify v1.8.0 // indirect
  //         )
  let inRequireBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Enter require block
    if (trimmed === 'require (' || trimmed.startsWith('require (')) {
      inRequireBlock = true
      continue
    }

    // Exit require block
    if (inRequireBlock && trimmed === ')') {
      inRequireBlock = false
      continue
    }

    // Single require statement
    if (trimmed.startsWith('require ') && !trimmed.includes('(')) {
      const dep = parseGoRequireLine(trimmed.replace('require ', ''))
      if (dep) dependencies.push(dep)
      continue
    }

    // Line inside require block
    if (inRequireBlock && trimmed && !trimmed.startsWith('//')) {
      const dep = parseGoRequireLine(trimmed)
      if (dep) dependencies.push(dep)
    }
  }

  return {
    ok:          true,
    moduleName,
    goVersion,
    dependencies,
    dependencyCount: {
      total:    dependencies.length,
      direct:   dependencies.filter(d => !d.isIndirect).length,
      indirect: dependencies.filter(d => d.isIndirect).length,
    },
  }
}

// Parses a single go.mod require line
// Format: "github.com/pkg/errors v0.9.1 // indirect"
function parseGoRequireLine(line) {
  // Remove inline comments
  const withoutComment = line.split('//')[0].trim()
  const isIndirect     = line.includes('// indirect')

  const parts = withoutComment.split(/\s+/)
  if (parts.length < 2) return null

  const [modulePath, version] = parts

  // Skip replace directives and empty lines
  if (!modulePath || !version || modulePath === '=>') return null

  // Clean version — strip leading 'v'
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version

  return {
    name:             modulePath,
    installedVersion: cleanVersion,
    versionRange:     version,   // keep original with 'v' prefix
    ecosystem:        'go',
    isDev:            isIndirect, // indirect = transitive dep, closer to dev
    isIndirect,
    // Extract package name for display (last segment of module path)
    displayName:      modulePath.split('/').slice(-1)[0],
  }
}

// Fetches latest version from Go module proxy
// proxy.golang.org is the official Go module proxy — free, no auth
export async function getLatestGoVersion(modulePath) {
  try {
    const res = await fetch(
      `https://proxy.golang.org/${encodeURIComponent(modulePath)}/@latest`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Version comes back as "v1.2.3" — strip the 'v'
    return data.Version ? data.Version.replace(/^v/, '') : null
  } catch {
    return null
  }
}
