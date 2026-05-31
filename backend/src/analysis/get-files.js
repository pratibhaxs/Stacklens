// src/analysis/get-files.js
// Smart file traversal — ignores node_modules, build output, binaries.
// This is the single function every other analyzer calls to get a clean
// list of files to work with. Running analysis on 60,000 node_modules
// files would produce noise, waste memory, and timeout every scan.

import fs from 'fs'
import path from 'path'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out',
  'coverage', '.nyc_output', '__pycache__', '.pytest_cache',
  'venv', '.venv', 'env', '.env', 'vendor', 'target',
  '.gradle', '.idea', '.vscode', 'logs', 'tmp', '.cache',
  '.turbo', '.parcel-cache', 'storybook-static',
])

const IGNORED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyo',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.mp4', '.mp3', '.wav', '.mov',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.map', '.lock', '.pdf', '.docx', '.xlsx',
])

const ALWAYS_INCLUDE = new Set([
  'package.json', 'package-lock.json', 'yarn.lock',
  'requirements.txt', 'Pipfile', 'pyproject.toml',
  'go.mod', 'go.sum', 'Cargo.toml', 'pom.xml',
  'build.gradle', 'Dockerfile', 'docker-compose.yml',
  'docker-compose.yaml', '.env.example', 'Makefile',
])

export function getAllFiles(dirPath, options = {}) {
  const { maxFiles = 5000, maxDepth = 15 } = options

  const results = {
    sourceFiles: [],
    configFiles: [],
    allFiles:    [],
    skippedDirs: [],
    stats:       { totalScanned: 0, totalSkipped: 0, truncated: false },
  }

  function walk(currentDir, depth = 0) {
    if (results.allFiles.length >= maxFiles) { results.stats.truncated = true; return }
    if (depth > maxDepth) return

    let entries
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }) }
    catch { return }

    for (const entry of entries) {
      const fullPath     = path.join(currentDir, entry.name)
      const relativePath = path.relative(dirPath, fullPath)

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
          results.skippedDirs.push(relativePath)
          results.stats.totalSkipped++
          continue
        }
        walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        results.stats.totalScanned++
        const ext             = path.extname(entry.name).toLowerCase()
        const isAlwaysInclude = ALWAYS_INCLUDE.has(entry.name)
        const isIgnoredExt    = IGNORED_EXTENSIONS.has(ext)

        if (entry.name.endsWith('.min.js') || entry.name.endsWith('.min.css')) {
          results.stats.totalSkipped++; continue
        }

        try {
          const stat = fs.statSync(fullPath)
          if (stat.size > 500_000 && !isAlwaysInclude) {
            results.stats.totalSkipped++; continue
          }
        } catch { continue }

        if (!isIgnoredExt || isAlwaysInclude) {
          const fileInfo = { path: fullPath, relativePath, name: entry.name, ext }
          results.allFiles.push(fileInfo)
          if (isAlwaysInclude) results.configFiles.push(fileInfo)
          else results.sourceFiles.push(fileInfo)
        } else {
          results.stats.totalSkipped++
        }
      }
    }
  }

  walk(dirPath)
  return results
}
