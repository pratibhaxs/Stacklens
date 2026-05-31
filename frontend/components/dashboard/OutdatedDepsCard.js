'use client'
// components/dashboard/OutdatedDepsCard.js

export function OutdatedDepsCard({ outdated, dependencySummary }) {
  if (!outdated) return null

  const { outdated: deps = [], summary, checkedCount } = outdated

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
          Outdated Dependencies
        </p>
        <span className="font-mono text-xs text-zinc-500">
          {summary?.total || 0} outdated · {checkedCount} checked
        </span>
      </div>

      {/* Summary row */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'High risk',  count: summary?.highRisk || 0, color: 'text-red-400',    bg: 'bg-red-950 border-red-800' },
          { label: 'Medium',     count: summary?.medium || 0,   color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800' },
          { label: 'Low',        count: summary?.low || 0,      color: 'text-zinc-400',   bg: 'bg-zinc-900 border-zinc-700' },
        ].map(({ label, count, color, bg }) => (
          <div key={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-xs
                        ${count > 0 ? bg + ' ' + color : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
            <span className="font-medium">{count}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {deps.length === 0 ? (
        <div className="text-center py-6">
          <span className="font-mono text-sm text-green-400">✓ All dependencies up to date</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {deps.map((dep, i) => (
            <div key={i}
              className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Risk indicator dot */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  dep.updateSeverity === 'high'   ? 'bg-red-400' :
                  dep.updateSeverity === 'medium' ? 'bg-yellow-400' : 'bg-zinc-500'
                }`} />
                <span className="font-mono text-xs text-zinc-300 truncate">{dep.name}</span>
                {dep.isDev && <span className="font-mono text-xs text-zinc-600">dev</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className="font-mono text-xs text-zinc-600">{dep.installedVersion}</span>
                <span className="text-zinc-600">→</span>
                <span className="font-mono text-xs text-green-400">{dep.latestVersion}</span>
                {dep.majorsBehind > 0 && (
                  <span className="font-mono text-xs text-red-400">
                    +{dep.majorsBehind} major
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
