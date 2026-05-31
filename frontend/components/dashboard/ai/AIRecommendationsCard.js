'use client'
// components/dashboard/ai/AIRecommendationsCard.js — Phase 3 final
// Full AI recommendations panel with priorities, roadmap, positives,
// and regenerate button when AI is unavailable.

import { useState } from 'react'
import { regenerateAI } from '../../../lib/api.js'

const RISK_STYLES = {
  critical: { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-400',    dot: 'bg-red-400' },
  high:     { bg: 'bg-orange-950', border: 'border-orange-800', text: 'text-orange-400', dot: 'bg-orange-400' },
  medium:   { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  low:      { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-400',  dot: 'bg-green-400' },
}

const CATEGORY_ICONS = {
  security: '🔒', dependencies: '📦', devops: '⚙️',
  maintainability: '🔧', architecture: '🏗️', general: '💡',
}

const EFFORT_COLORS = { low: 'text-green-400', medium: 'text-yellow-400', high: 'text-red-400' }
const TIMEFRAME_ORDER = ['this week', 'this month', 'this quarter']
const TIMEFRAME_STYLES = {
  'this week':    { color: 'text-red-400',    border: 'border-red-900',    bg: 'bg-red-950/50' },
  'this month':   { color: 'text-yellow-400', border: 'border-yellow-900', bg: 'bg-yellow-950/50' },
  'this quarter': { color: 'text-blue-400',   border: 'border-blue-900',   bg: 'bg-blue-950/50' },
}

export function AIRecommendationsCard({ aiRecommendations, scanId, onAIRegenerated }) {
  const [activeTab, setActiveTab]   = useState('priorities')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [localAI, setLocalAI]       = useState(aiRecommendations)

  async function handleRegenerate() {
    if (!scanId) return
    setLoading(true)
    setError(null)
    try {
      const result = await regenerateAI(scanId)
      setLocalAI(result.aiRecommendations)
      onAIRegenerated?.(result.aiRecommendations)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Unavailable state with regenerate option
  if (!localAI) {
    return (
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">AI Recommendations</p>
          <span className="font-mono text-xs text-zinc-600 px-2 py-1 border border-zinc-800 rounded">
            Powered by Claude
          </span>
        </div>
        <div className="text-center py-6 space-y-3">
          <p className="font-mono text-sm text-zinc-500">AI recommendations unavailable</p>
          <p className="font-mono text-xs text-zinc-700 max-w-sm mx-auto">
            All analysis data above is unaffected. AI recommendations require a valid
            ANTHROPIC_API_KEY or OPENAI_API_KEY in your backend .env.
          </p>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          {scanId && (
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="font-mono text-xs px-4 py-2 border border-zinc-700 text-zinc-400
                         rounded hover:border-zinc-500 hover:text-zinc-200
                         transition-colors disabled:opacity-40"
            >
              {loading ? 'Generating...' : '↺ Try generating AI recommendations'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const { summary, overallRisk, priorities, positives, modernizationRoadmap, generatedAt } = localAI
  const riskStyle = RISK_STYLES[overallRisk] || RISK_STYLES.medium

  const roadmapByTimeframe = TIMEFRAME_ORDER.reduce((acc, tf) => {
    const items = (modernizationRoadmap || []).filter(r =>
      r.timeframe?.toLowerCase().includes(tf.split(' ')[1]) || r.timeframe === tf
    )
    if (items.length > 0) acc[tf] = items
    return acc
  }, {})

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <p className="font-mono text-xs text-zinc-400 uppercase tracking-wider">AI Recommendations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs
                          ${riskStyle.bg} ${riskStyle.border} ${riskStyle.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />
            {overallRisk} risk
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/20">
        <p className="font-mono text-sm text-zinc-300 leading-relaxed">{summary}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {[
          { key: 'priorities', label: `Priorities (${priorities?.length || 0})` },
          { key: 'roadmap',    label: 'Roadmap' },
          { key: 'positives',  label: 'Positives' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`font-mono text-xs px-4 py-3 border-b-2 transition-colors
              ${activeTab === tab.key
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === 'priorities' && <PrioritiesTab priorities={priorities} />}
        {activeTab === 'roadmap'    && <RoadmapTab roadmap={roadmapByTimeframe} />}
        {activeTab === 'positives'  && <PositivesTab positives={positives} />}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-zinc-800 bg-zinc-900/40">
        <p className="font-mono text-xs text-zinc-700">
          Generated {new Date(generatedAt).toLocaleString()} ·
          Based on real analysis findings only
        </p>
      </div>
    </div>
  )
}

function PrioritiesTab({ priorities }) {
  const [expanded, setExpanded] = useState(0)
  if (!priorities?.length) return <p className="font-mono text-xs text-zinc-600 text-center py-6">No priorities identified</p>

  return (
    <div className="space-y-3">
      {priorities.map((p, i) => (
        <div key={i} className="border border-zinc-800 rounded-md overflow-hidden">
          <button onClick={() => setExpanded(expanded === i ? -1 : i)}
            className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-900/60 transition-colors">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-xs text-zinc-600 w-4">#{p.rank}</span>
              <span className="text-base">{CATEGORY_ICONS[p.category] || '💡'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm text-zinc-200 font-medium">{p.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-xs text-zinc-600 capitalize">{p.category}</span>
                <span className="font-mono text-xs text-zinc-700">·</span>
                <span className={`font-mono text-xs ${EFFORT_COLORS[p.effort]}`}>{p.effort} effort</span>
                <span className="font-mono text-xs text-zinc-700">·</span>
                <span className={`font-mono text-xs ${EFFORT_COLORS[p.impact]}`}>{p.impact} impact</span>
              </div>
            </div>
            <span className="font-mono text-xs text-zinc-600 flex-shrink-0">{expanded === i ? '▲' : '▼'}</span>
          </button>
          {expanded === i && (
            <div className="border-t border-zinc-800 p-4 bg-zinc-900/40 space-y-3">
              <div>
                <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-1">Why this matters</p>
                <p className="font-mono text-xs text-zinc-400 leading-relaxed">{p.description}</p>
              </div>
              <div className="border border-zinc-700 rounded p-3 bg-zinc-900">
                <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-1">Action</p>
                <p className="font-mono text-xs text-green-400 leading-relaxed">→ {p.action}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RoadmapTab({ roadmap }) {
  const timeframes = Object.keys(roadmap)
  if (!timeframes.length) return <p className="font-mono text-xs text-zinc-600 text-center py-6">No roadmap generated</p>

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-zinc-600">Prioritized modernization plan based on your repository's findings</p>
      {timeframes.map(tf => {
        const style = TIMEFRAME_STYLES[tf] || TIMEFRAME_STYLES['this month']
        return (
          <div key={tf}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-px flex-1 ${style.border} border-t`} />
              <span className={`font-mono text-xs font-medium uppercase tracking-wider ${style.color}`}>{tf}</span>
              <div className={`h-px flex-1 ${style.border} border-t`} />
            </div>
            <div className="space-y-2">
              {roadmap[tf].map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded border ${style.border} ${style.bg}`}>
                  <span className={`font-mono text-xs ${style.color} flex-shrink-0 mt-0.5`}>→</span>
                  <p className="font-mono text-xs text-zinc-300 leading-relaxed">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PositivesTab({ positives }) {
  if (!positives?.length) return (
    <p className="font-mono text-xs text-zinc-600 text-center py-6">
      No specific positives identified in the current analysis
    </p>
  )

  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-zinc-600 mb-4">Things this repository does well</p>
      {positives.map((p, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border border-green-900 rounded bg-green-950/30">
          <span className="text-green-400 flex-shrink-0">✓</span>
          <p className="font-mono text-xs text-zinc-300 leading-relaxed">{p}</p>
        </div>
      ))}
    </div>
  )
}
