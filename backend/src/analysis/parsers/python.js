// src/analysis/parsers/python.js
// Parses requirements.txt and pyproject.toml to extract Python dependencies.
// Why support both: requirements.txt is classic, pyproject.toml is modern (Poetry/PEP 517).
// Many real repos use both — we check both and merge.

import fs from 'fs'
import path from 'path'

export function parsePythonDependencies(rootDir) {
  const dependencies = []
  const errors = []

  // ── requirements.txt ────────────────────────────────────────────────────────
  const reqPath = path.join(rootDir, 'requirements.txt')
  if (fs.existsSync(reqPath)) {
    try {
      const lines = fs.readFileSync(reqPath, 'utf-8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        // Skip comments, empty lines, and -r includes
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue

        // Parse "package==1.2.3", "package>=1.0", "package~=1.0", "package"
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*([><=~!]+)?\s*([0-9][0-9a-zA-Z.*+-]*)?/)
        if (match) {
          const cleanVersion = match[3]?.replace(/[^0-9.]/g, '').split('.').slice(0, 3).join('.')
          dependencies.push({
            name: match[1].toLowerCase(),
            installedVersion: cleanVersion || null,
            versionRange: trimmed,
            ecosystem: 'pypi',
            isDev: false,
          })
        }
      }
    } catch (e) {
      errors.push(`Could not parse requirements.txt: ${e.message}`)
    }
  }

  // ── pyproject.toml (basic parsing — no TOML library needed for simple cases) ─
  const pyprojectPath = path.join(rootDir, 'pyproject.toml')
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf-8')
      // Extract dependencies section — handles both [tool.poetry.dependencies] and [project]
      const depsSection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/)
      if (depsSection) {
        const lines = depsSection[1].split('\n')
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9_.-]+)\s*=\s*"([^"]+)"/)
          if (match && match[1] !== 'python') {
            const cleanVersion = match[2].replace(/[^0-9.]/g, '')
            dependencies.push({
              name: match[1].toLowerCase(),
              installedVersion: cleanVersion || null,
              versionRange: match[2],
              ecosystem: 'pypi',
              isDev: false,
            })
          }
        }
      }
    } catch (e) {
      errors.push(`Could not parse pyproject.toml: ${e.message}`)
    }
  }

  const hasAnyFile = fs.existsSync(reqPath) || fs.existsSync(pyprojectPath)

  return {
    ok: hasAnyFile,
    error: errors.length > 0 ? errors.join('; ') : null,
    dependencies,
    dependencyCount: { total: dependencies.length },
  }
}

// Fetches latest version from PyPI
export async function getLatestPypiVersion(packageName) {
  try {
    const res = await fetch(
      `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.info?.version || null
  } catch {
    return null
  }
}
