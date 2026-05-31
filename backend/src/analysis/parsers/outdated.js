// src/analysis/parsers/outdated.js
// Checks each dependency against its registry to find the latest version.
// Why rate-limit concurrent requests: npm registry has rate limits.
// Hammering 200 requests simultaneously gets you blocked.
// Batching in groups of 10 with small delays is polite and reliable.

import { getLatestNpmVersion, compareVersions } from './npm.js'
import { getLatestPypiVersion } from './python.js'

const BATCH_SIZE = 10        // requests per batch
const BATCH_DELAY_MS = 100   // delay between batches

export async function checkOutdatedDependencies(dependencies) {
  if (!dependencies || dependencies.length === 0) {
    return { outdated: [], checkedCount: 0 }
  }

  const checkable = dependencies.filter(d =>
    d.installedVersion &&
    d.installedVersion !== 'latest' &&
    (d.ecosystem === 'npm' || d.ecosystem === 'pypi')
  )

  const results = []

  // Process in batches to avoid rate limiting
  for (let i = 0; i < checkable.length; i += BATCH_SIZE) {
    const batch = checkable.slice(i, i + BATCH_SIZE)

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (dep) => {
        try {
          const latestVersion = dep.ecosystem === 'npm'
            ? await getLatestNpmVersion(dep.name)
            : await getLatestPypiVersion(dep.name)

          if (!latestVersion) return null

          const comparison = compareVersions(dep.installedVersion, latestVersion)
          if (!comparison?.isOutdated) return null

          return {
            name:             dep.name,
            ecosystem:        dep.ecosystem,
            isDev:            dep.isDev,
            installedVersion: dep.installedVersion,
            latestVersion,
            majorsBehind:     comparison.majorsBehind,
            minorsBehind:     comparison.minorsBehind,
            // Severity of being outdated — major version behind is more serious
            updateSeverity:   comparison.majorsBehind >= 2 ? 'high'
                            : comparison.majorsBehind === 1 ? 'medium' : 'low',
          }
        } catch {
          return null  // individual package failure never stops the batch
        }
      })
    )

    results.push(...batchResults.filter(Boolean))

    // Polite delay between batches (skip after last batch)
    if (i + BATCH_SIZE < checkable.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  // Sort: most outdated first
  results.sort((a, b) => b.majorsBehind - a.majorsBehind || b.minorsBehind - a.minorsBehind)

  return {
    outdated: results,
    checkedCount: checkable.length,
    summary: {
      total:    results.length,
      highRisk: results.filter(d => d.updateSeverity === 'high').length,
      medium:   results.filter(d => d.updateSeverity === 'medium').length,
      low:      results.filter(d => d.updateSeverity === 'low').length,
    },
  }
}
