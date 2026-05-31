'use client'
// components/dashboard/history/ScanComparisonPanel.js
// Side-by-side comparison of two scan results — shows what changed.
// Why comparison view: this is the "feedback loop" that makes the tool useful.
// User fixes vulnerabilities, rescans, sees score improve.
// That before/after story is what you demo to recruiters.

export function ScanComparisonPanel({ older, newer, comparison }) {
  if (!older || !newer || !comparison) return null

  const { scoreDiff, vulnChange, outdatedChange, daysBetween, summary } = comparison

  const oldResult = older.result || {}
  const newResult = newer.result || {}

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-zinc-900/60 border-b border-zinc-800">
        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-1">
          Scan Comparison
        </p>
        <p className={`font-mono text-sm font-medium ${
          scoreDiff > 0 ? 'text-green-400' :
          scoreDiff < 0 ? 'text-red-400'   : 'text-zinc-400'
        }`}>
          {summary}
        </p>
        <p className="font-mono text-xs text-zinc-600 mt-0.5">
          {daysBetween} day{daysBetween !== 1 ? 's' : ''} between scans
        </p>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-2 divide-x divide-zinc-800">
        <ScoreColumn label="Before" scan={older} result={oldResult} side="older" />
        <ScoreColumn label="After"  scan={newer} result={newResult} side="newer"
          diff={{ score: scoreDiff, vulns: vulnChange, outdated: outdatedChange }} />
      </div>

      {/* Metric changes grid */}
      <div className="border-t border-zinc-800 p-4">
        <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-3">
          What changed
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MetricChange
            label="Health Score"
            oldVal={oldResult.healthScore?.score}
            newVal={newResult.healthScore?.score}
            higherIsBetter
            suffix="/100"
          />
          <MetricChange
            label="CVE Vulnerabilities"
            oldVal={oldResult.summary?.totalVulns}
            newVal={newResult.summary?.totalVulns}
            higherIsBetter={false}
          />
          <MetricChange
            label="Outdated Deps"
            oldVal={oldResult.summary?.outdatedDeps}
            newVal={newResult.summary?.outdatedDeps}
            higherIsBetter={false}
          />
          <MetricChange
            label="Bus Factor"
            oldVal={oldResult.summary?.busFactorScore}
            newVal={newResult.summary?.busFactorScore}
            higherIsBetter
            nullLabel="N/A"
          />
        </div>
      </div>

      {/* Deduction changes */}
      {oldResult.healthScore?.deductions && newResult.healthScore?.deductions && (
        <div className="border-t border-zinc-800 p-4">
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-3">
            Score deductions — before vs after
          </p>
          <DeductionDiff
            oldDeductions={oldResult.healthScore.deductions}
            newDeductions={newResult.healthScore.deductions}
          />
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreColumn({ label, scan, result, side, diff }) {
  const score = result.healthScore?.score
  const grade = result.healthScore?.grade
  const scoreColor =
    score >= 75 ? 'text-green-400' :
    score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="p-4 text-center">
      <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-2">{label}</p>
      {score !== undefined ? (
        <>
          <div className={`font-mono text-4xl font-bold ${scoreColor}`}>{score}</div>
          <div className={`font-mono text-lg ${scoreColor} opacity-70`}>{grade}</div>
          {diff?.score !== undefined && diff.score !== null && side === 'newer' && (
            <div className={`font-mono text-xs mt-1 ${
              diff.score > 0 ? 'text-green-400' : diff.score < 0 ? 'text-red-400' : 'text-zinc-500'
            }`}>
              {diff.score > 0 ? '+' : ''}{diff.score} pts
            </div>
          )}
        </>
      ) : (
        <div className="font-mono text-2xl text-zinc-600">—</div>
      )}
      <p className="font-mono text-xs text-zinc-600 mt-2">
        {new Date(scan.createdAt).toLocaleDateString()}
      </p>
    </div>
  )
}

function MetricChange({ label, oldVal, newVal, higherIsBetter, suffix = '', nullLabel = '?' }) {
  const hasValues = oldVal !== undefined && oldVal !== null &&
                    newVal !== undefined && newVal !== null
  const diff = hasValues ? newVal - oldVal : null
  const improved = diff !== null && (higherIsBetter ? diff > 0 : diff < 0)
  const worsened = diff !== null && (higherIsBetter ? diff < 0 : diff > 0)

  return (
    <div className="border border-zinc-800 rounded p-3">
      <p className="font-mono text-xs text-zinc-600 mb-2">{label}</p>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-zinc-400">
          {oldVal !== null && oldVal !== undefined ? `${oldVal}${suffix}` : nullLabel}
        </span>
        <span className="font-mono text-xs text-zinc-700 mx-1">→</span>
        <span className="font-mono text-sm text-zinc-200">
          {newVal !== null && newVal !== undefined ? `${newVal}${suffix}` : nullLabel}
        </span>
        {diff !== null && diff !== 0 && (
          <span className={`font-mono text-xs ml-2 ${
            improved ? 'text-green-400' : worsened ? 'text-red-400' : 'text-zinc-500'
          }`}>
            {diff > 0 ? '+' : ''}{diff}{suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function DeductionDiff({ oldDeductions, newDeductions }) {
  // Map deductions by reason for comparison
  const oldMap = Object.fromEntries((oldDeductions || []).map(d => [d.reason, d.points]))
  const newMap = Object.fromEntries((newDeductions || []).map(d => [d.reason, d.points]))

  const allReasons = [...new Set([
    ...Object.keys(oldMap),
    ...Object.keys(newMap),
  ])]

  if (!allReasons.length) {
    return <p className="font-mono text-xs text-zinc-600">No deduction data</p>
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {allReasons.map((reason, i) => {
        const oldPts = oldMap[reason] || 0
        const newPts = newMap[reason] || 0
        const diff   = newPts - oldPts    // positive = got worse, negative = improved

        return (
          <div key={i} className="flex items-center gap-2 font-mono text-xs">
            <span className={`w-14 text-right flex-shrink-0 ${
              diff < 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-zinc-500'
            }`}>
              {diff < 0 ? `↓ ${newPts}` : diff > 0 ? `↑ ${newPts}` : `${newPts}`} pts
            </span>
            <span className="text-zinc-500 truncate">{reason}</span>
          </div>
        )
      })}
    </div>
  )
}
