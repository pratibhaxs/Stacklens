'use client'
// components/dashboard/HealthScoreCard.js
// The centrepiece of the Phase 2 dashboard.
// Shows the 0-100 health score, letter grade, and every deduction
// with the reason — making the score trustworthy and auditable.

export function HealthScoreCard({ healthScore, summary }) {
  if (!healthScore) return null

  const { score, grade, label, deductions, breakdown } = healthScore

  const scoreColor =
    score >= 75 ? 'text-green-400'  :
    score >= 50 ? 'text-yellow-400' :
                  'text-red-400'

  const ringColor =
    score >= 75 ? 'stroke-green-400'  :
    score >= 50 ? 'stroke-yellow-400' :
                  'stroke-red-400'

  // SVG ring progress
  const radius      = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset  = circumference - (score / 100) * circumference

  return (
    <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/40">
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-5">
        Repository Health Score
      </p>

      <div className="flex items-center gap-8 mb-6">
        {/* Circular progress ring */}
        <div className="relative flex-shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Background ring */}
            <circle
              cx="64" cy="64" r={radius}
              fill="none" stroke="#27272a" strokeWidth="8"
            />
            {/* Score ring */}
            <circle
              cx="64" cy="64" r={radius}
              fill="none"
              className={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-mono text-3xl font-bold ${scoreColor}`}>{score}</span>
            <span className="font-mono text-xs text-zinc-500">/100</span>
          </div>
        </div>

        {/* Grade + label + category breakdown */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-mono text-5xl font-bold ${scoreColor}`}>{grade}</span>
            <span className="font-mono text-lg text-zinc-300">{label}</span>
          </div>

          {/* Category breakdown bars */}
          <div className="space-y-2 mt-3">
            {[
              { key: 'security',        label: 'Security',        color: 'bg-red-500' },
              { key: 'dependencies',    label: 'Dependencies',    color: 'bg-orange-500' },
              { key: 'devops',          label: 'DevOps',          color: 'bg-blue-500' },
              { key: 'maintainability', label: 'Maintainability', color: 'bg-purple-500' },
            ].map(({ key, label: catLabel, color }) => {
              const pts = breakdown?.[key] || 0
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500 w-28">{catLabel}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full`}
                      style={{ width: `${Math.min((pts / 30) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-zinc-500 w-10 text-right">
                    {pts > 0 ? `-${pts}` : '✓'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Deduction list */}
      {deductions.length > 0 ? (
        <div>
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-3">
            Score deductions
          </p>
          <div className="space-y-1.5">
            {deductions.map((d, i) => (
              <div key={i} className="flex items-start gap-3 text-xs font-mono">
                <span className="text-red-400 flex-shrink-0 w-12">−{d.points} pts</span>
                <span className="text-zinc-400">{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <span className="font-mono text-xs text-green-400">
            ✓ No issues found — excellent repository health
          </span>
        </div>
      )}
    </div>
  )
}
