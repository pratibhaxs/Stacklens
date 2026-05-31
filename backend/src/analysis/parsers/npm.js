// src/analysis/parsers/npm.js
// Parses package.json to extract all dependencies with their installed versions.
// Why separate parser per ecosystem: each has its own format and quirks.
// Why not use a library: JSON.parse is sufficient, no extra dep needed.

import fs from 'fs'
import path from 'path'

export function parseNpmDependencies(rootDir) {
  const pkgPath = path.join(rootDir, 'package.json')

  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'No package.json found', dependencies: [] }
  }

  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch (e) {
    // Malformed JSON — return clean error, don't crash the pipeline
    return { ok: false, error: `Could not parse package.json: ${e.message}`, dependencies: [] }
  }

  const deps = []

  // Merge prod and dev deps — we check CVEs for both
  // Why devDependencies too: a vulnerable dev dep can still be exploited in CI/CD
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  }

  for (const [name, versionRange] of Object.entries(allDeps)) {
    // Strip semver range specifiers (^, ~, >=, etc.) to get the base version
    // We store the range for display but use the clean version for API calls
    const cleanVersion = versionRange.replace(/^[\^~>=<]/, '').split(' ')[0]

    deps.push({
      name,
      installedVersion: cleanVersion,
      versionRange,
      ecosystem: 'npm',
      isDev: !!(pkg.devDependencies?.[name]),
    })
  }

  return {
    ok: true,
    packageName: pkg.name || null,
    packageVersion: pkg.version || null,
    nodeVersion: pkg.engines?.node || null,
    scripts: Object.keys(pkg.scripts || {}),
    dependencies: deps,
    dependencyCount: {
      prod: Object.keys(pkg.dependencies || {}).length,
      dev: Object.keys(pkg.devDependencies || {}).length,
      total: deps.length,
    },
  }
}

// Fetches latest version from npm registry
// Why not use npm CLI: spawning processes is slow and creates security surface.
// The registry has a simple REST API that's fast and reliable.
export async function getLatestNpmVersion(packageName) {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),  // 5s timeout per package
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.version || null
  } catch {
    return null  // network error, rate limit, unknown package — skip gracefully
  }
}

// Compares installed vs latest version, returns how many major versions behind
export function compareVersions(installed, latest) {
  if (!installed || !latest) return null

  const parse = (v) => {
    const parts = v.replace(/[^0-9.]/g, '').split('.').map(Number)
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 }
  }

  const inst = parse(installed)
  const lat  = parse(latest)

  return {
    isOutdated: inst.major < lat.major || inst.minor < lat.minor || inst.patch < lat.patch,
    majorsBehind: Math.max(0, lat.major - inst.major),
    minorsBehind: inst.major === lat.major ? Math.max(0, lat.minor - inst.minor) : 0,
    installedVersion: installed,
    latestVersion: latest,
  }
}
