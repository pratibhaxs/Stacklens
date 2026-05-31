'use client'
// components/dashboard/history/ScoreTrendChart.js
// Line chart showing health score over time for a repo.
// Why Recharts: already in the stack, declarative API, good defaults.
// Why not a canvas-based lib: Recharts integrates cleanly with React state.

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts'

// Custom tooltip for the chart — shows score + grade + date
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  const scoreColor =
    data.score >= 75 ? '#22c55e' :
    data.score >= 50 ? '#eab308' : '#ef4444'

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-md p-3 font-mono text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{new Date(data.scannedAt).toLocaleDateString()}</p>
      <p style={{ color: scoreColor }} className="text-lg font-bold">
        {data.score} <span className="text-sm">({data.grade})</span>
      </p>
      <div className="mt-1.5 space-y-0.5 text-zinc-500">
        {data.totalVulns > 0 && (
          <p className="text-red-400">{data.totalVulns} CVE{data.totalVulns !== 1 ? 's' : ''}</p>
        )}
        {data.outdatedDeps > 0 && (
          <p className="text-yellow-400">{data.outdatedDeps} outdated</p>
        )}
      </div>
    </div>
  )
}

// Custom dot — bigger on hover, colored by score
function CustomDot({ cx, cy, payload }) {
  if (!cx || !cy) return null
  const color =
    payload.score >= 75 ? '#22c55e' :
    payload.score >= 50 ? '#eab308' : '#ef4444'

  return (
    <circle
      cx={cx} cy={cy} r={4}
      fill={color} stroke="#18181b" strokeWidth={2}
    />
  )
}

export function ScoreTrendChart({ history, trend }) {
  if (!history?.length) {
    return (
      <div className="flex items-center justify-center h-40 border border-zinc-800 rounded-lg">
        <p className="font-mono text-xs text-zinc-600">
          No history yet — scores will appear here after multiple scans
        </p>
      </div>
    )
  }

  if (history.length === 1) {
    return (
      <div className="flex items-center justify-center h-40 border border-zinc-800 rounded-lg">
        <p className="font-mono text-xs text-zinc-600">
          Scan again to see the trend — only one data point so far
        </p>
      </div>
    )
  }

  // Format data for recharts
  const chartData = history.map(h => ({
    ...h,
    date:  new Date(h.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: h.score,
  }))

  const trendColor =
    trend?.direction === 'improving' ? '#22c55e' :
    trend?.direction === 'declining' ? '#ef4444' : '#71717a'

  return (
    <div>
      {/* Trend summary */}
      {trend && trend.direction !== 'insufficient_data' && (
        <div className="flex items-center gap-3 mb-4">
          <span className={`font-mono text-xs font-medium ${
            trend.direction === 'improving' ? 'text-green-400' :
            trend.direction === 'declining' ? 'text-red-400' : 'text-zinc-400'
          }`}>
            {trend.direction === 'improving' ? '↑' :
             trend.direction === 'declining' ? '↓' : '→'}
            {' '}{trend.direction}
          </span>
          <span className="font-mono text-xs text-zinc-500">
            {trend.change > 0 ? '+' : ''}{trend.change} pts since last scan
          </span>
          {trend.totalChange !== trend.change && (
            <span className="font-mono text-xs text-zinc-600">
              · {trend.totalChange > 0 ? '+' : ''}{trend.totalChange} pts overall
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={trendColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />

          {/* Reference lines for grade boundaries */}
          <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="2 4" strokeOpacity={0.3} />
          <ReferenceLine y={75} stroke="#eab308" strokeDasharray="2 4" strokeOpacity={0.3} />
          <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.3} />

          <XAxis
            dataKey="date"
            tick={{ fontFamily: 'monospace', fontSize: 10, fill: '#52525b' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontFamily: 'monospace', fontSize: 10, fill: '#52525b' }}
            axisLine={false} tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="score"
            stroke={trendColor}
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: trendColor, stroke: '#18181b', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Grade reference */}
      <div className="flex gap-4 mt-2 justify-end">
        {[
          { range: '90–100', grade: 'A', color: 'text-green-400' },
          { range: '75–89',  grade: 'B', color: 'text-green-400' },
          { range: '50–74',  grade: 'C–D', color: 'text-yellow-400' },
          { range: '0–49',   grade: 'F', color: 'text-red-400' },
        ].map(({ range, grade, color }) => (
          <span key={grade} className={`font-mono text-xs ${color} opacity-50`}>
            {grade} ({range})
          </span>
        ))}
      </div>
    </div>
  )
}
