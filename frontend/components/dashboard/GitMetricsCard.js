'use client'
// components/dashboard/GitMetricsCard.js
// The CodeScene-inspired panel — shows hotspots, bus factor, churn, commit trend.
// This is the differentiator panel that no other tool in your class builds.

import { useState } from 'react'

const TABS = ['Hotspots', 'Bus Factor', 'Churn', 'Activity']

export function GitMetricsCard({ gitMetrics }) {
  const [activeTab, setActiveTab] = useState('Hotspots')

  if (!gitMetrics) return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-3">
        Git Intelligence
      </p>
      <p className="font-mono text-xs text-zinc-600 text-center py-6">
        Git analysis unavailable for this repository
      </p>
    </div>
  )

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
          Git Intelligence
        </p>
        <span className="font-mono text-xs text-zinc-600">
          Last {gitMetrics.analyzedMonths} months
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-zinc-800 pb-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-mono text-xs px-3 py-2 border-b-2 transition-colors duration-150
              ${activeTab === tab
                ? 'border-green-400 text-green-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Hotspots' && <HotspotsTab hotspots={gitMetrics.hotspots} />}
      {activeTab === 'Bus Factor' && <BusFactorTab busFactor={gitMetrics.busFactor} />}
      {activeTab === 'Churn' && <ChurnTab churn={gitMetrics.churn} />}
      {activeTab === 'Activity' && <ActivityTab commitFrequency={gitMetrics.commitFrequency} contributors={gitMetrics.contributors} />}
    </div>
  )
}

// ─── Tab: Hotspots ────────────────────────────────────────────────────────────
function HotspotsTab({ hotspots }) {
  if (!hotspots?.hotspots?.length) return <EmptyState msg="No hotspot data available" />

  const maxCommits = hotspots.hotspots[0]?.commits || 1

  return (
    <div>
      <p className="font-mono text-xs text-zinc-600 mb-3">
        Files changed most frequently — high churn = high maintenance burden
      </p>
      <div className="space-y-2">
        {hotspots.hotspots.map((h, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-xs text-zinc-300 truncate max-w-[70%]">
                {truncatePath(h.file)}
              </span>
              <span className={`font-mono text-xs flex-shrink-0 ml-2 ${
                h.risk === 'high' ? 'text-red-400' :
                h.risk === 'medium' ? 'text-yellow-400' : 'text-zinc-500'
              }`}>
                {h.commits} commits
              </span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  h.risk === 'high' ? 'bg-red-500' :
                  h.risk === 'medium' ? 'bg-yellow-500' : 'bg-zinc-500'
                }`}
                style={{ width: `${(h.commits / maxCommits) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Bus Factor ──────────────────────────────────────────────────────────
function BusFactorTab({ busFactor }) {
  if (!busFactor) return <EmptyState msg="Bus factor analysis unavailable" />

  const scoreColor =
    busFactor.busFactorScore === 1 ? 'text-red-400' :
    busFactor.busFactorScore <= 2  ? 'text-yellow-400' : 'text-green-400'

  return (
    <div>
      {/* Bus factor score */}
      <div className="flex items-center gap-4 mb-4 p-3 border border-zinc-800 rounded-md bg-zinc-900">
        <div className="text-center">
          <div className={`font-mono text-4xl font-bold ${scoreColor}`}>
            {busFactor.busFactorScore}
          </div>
          <div className="font-mono text-xs text-zinc-500">bus factor</div>
        </div>
        <p className="font-mono text-xs text-zinc-400 leading-relaxed">
          {busFactor.interpretation}
        </p>
      </div>

      {/* Risk files */}
      {busFactor.riskFiles?.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">
            Files with single-author knowledge:
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {busFactor.riskFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-red-400 text-xs">⚠</span>
                <span className="font-mono text-xs text-zinc-400 truncate">
                  {truncatePath(f.file)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Churn ───────────────────────────────────────────────────────────────
function ChurnTab({ churn }) {
  if (!churn?.highChurnFiles?.length) return <EmptyState msg="No churn data available" />

  const maxChurn = churn.highChurnFiles[0]?.totalChurn || 1

  return (
    <div>
      <p className="font-mono text-xs text-zinc-600 mb-3">
        Lines added + deleted last 3 months — rapid change = unstable code
      </p>
      <div className="space-y-2">
        {churn.highChurnFiles.map((f, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-xs text-zinc-300 truncate max-w-[65%]">
                {truncatePath(f.file)}
              </span>
              <span className={`font-mono text-xs flex-shrink-0 ml-2 ${
                f.churnRisk === 'high' ? 'text-red-400' :
                f.churnRisk === 'medium' ? 'text-yellow-400' : 'text-zinc-500'
              }`}>
                {f.totalChurn.toLocaleString()} lines
              </span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  f.churnRisk === 'high' ? 'bg-red-500' :
                  f.churnRisk === 'medium' ? 'bg-yellow-500' : 'bg-zinc-500'
                }`}
                style={{ width: `${(f.totalChurn / maxChurn) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Activity ────────────────────────────────────────────────────────────
function ActivityTab({ commitFrequency, contributors }) {
  if (!commitFrequency) return <EmptyState msg="Activity data unavailable" />

  const trendColor =
    commitFrequency.trend === 'increasing' ? 'text-green-400' :
    commitFrequency.trend === 'declining'  ? 'text-red-400'   : 'text-zinc-400'

  // Mini bar chart from weekly data
  const weeks   = commitFrequency.weeklyData?.slice(-12) || []  // last 12 weeks
  const maxWeek = Math.max(...weeks.map(w => w.commits), 1)

  return (
    <div>
      {/* Stats row */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 text-center p-2 border border-zinc-800 rounded">
          <div className="font-mono text-xl font-bold text-white">{commitFrequency.totalCommits}</div>
          <div className="font-mono text-xs text-zinc-500">total commits</div>
        </div>
        <div className="flex-1 text-center p-2 border border-zinc-800 rounded">
          <div className="font-mono text-xl font-bold text-white">{commitFrequency.avgPerWeek}</div>
          <div className="font-mono text-xs text-zinc-500">per week avg</div>
        </div>
        <div className="flex-1 text-center p-2 border border-zinc-800 rounded">
          <div className={`font-mono text-sm font-bold ${trendColor}`}>
            {commitFrequency.trend === 'increasing' ? '↑' :
             commitFrequency.trend === 'declining'  ? '↓' : '→'}
            {' '}{commitFrequency.trend}
          </div>
          <div className="font-mono text-xs text-zinc-500">trend</div>
        </div>
      </div>

      {/* Mini bar chart */}
      {weeks.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">Weekly commits (last 12 weeks)</p>
          <div className="flex items-end gap-0.5 h-16">
            {weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <div
                  className="bg-green-500 opacity-70 rounded-sm min-h-[2px]"
                  style={{ height: `${Math.max((w.commits / maxWeek) * 100, 5)}%` }}
                  title={`${w.week}: ${w.commits} commits`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top contributors */}
      {contributors?.contributors?.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-xs text-zinc-600 mb-2">Top contributors</p>
          <div className="space-y-1">
            {contributors.contributors.slice(0, 5).map((c, i) => (
              <div key={i} className="flex justify-between font-mono text-xs">
                <span className="text-zinc-400 truncate max-w-[70%]">{c.name}</span>
                <span className="text-zinc-500">{c.commits} commits</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EmptyState({ msg }) {
  return (
    <p className="font-mono text-xs text-zinc-600 text-center py-6">{msg}</p>
  )
}

function truncatePath(filePath) {
  if (!filePath) return ''
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '…/' + parts.slice(-2).join('/')
}
