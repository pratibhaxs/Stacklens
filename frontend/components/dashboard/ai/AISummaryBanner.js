'use client'
// components/dashboard/ai/AISummaryBanner.js
// A compact banner shown at the very top of results — gives a one-line
// AI risk assessment before the user scrolls into detail panels.
// Why a separate banner: the full AIRecommendationsCard is below the fold.
// This gives immediate context the moment results load.

const RISK_STYLES = {
  critical: { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-300',    icon: '🚨', dot: 'bg-red-400' },
  high:     { bg: 'bg-orange-950', border: 'border-orange-800', text: 'text-orange-300', icon: '⚠️', dot: 'bg-orange-400' },
  medium:   { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-300', icon: '⚡', dot: 'bg-yellow-400' },
  low:      { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-300',  icon: '✓',  dot: 'bg-green-400' },
}

export function AISummaryBanner({ aiRecommendations }) {
  if (!aiRecommendations) return null

  const { summary, overallRisk, priorities } = aiRecommendations
  const style = RISK_STYLES[overallRisk] || RISK_STYLES.medium

  const topPriority = priorities?.[0]

  return (
    <div className={`border ${style.border} ${style.bg} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>

        <div className="flex-1 min-w-0">
          {/* Risk label */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
            <span className={`font-mono text-xs font-medium uppercase tracking-wider ${style.text}`}>
              {overallRisk} risk — AI Assessment
            </span>
          </div>

          {/* Summary */}
          <p className={`font-mono text-xs ${style.text} leading-relaxed opacity-90`}>
            {summary}
          </p>

          {/* Top priority hint */}
          {topPriority && (
            <p className="font-mono text-xs text-zinc-500 mt-2">
              Top priority: <span className="text-zinc-300">{topPriority.title}</span>
              {' '}— see AI Recommendations below
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
