'use client'
// components/dashboard/history/RepoHistoryCard.js
// Shown below scan results on the dashboard — displays the trend chart
// and lets users select two scans for comparison.
// Why inline on dashboard: users don't need to navigate away to see history.
// The trend appears immediately after every scan.

import { useState, useEffect } from 'react'
import { getRepoHistory, compareScans } from '../../../lib/api.js'
import { ScoreTrendChart }              from './ScoreTrendChart.js'
import { ScanComparisonPanel }          from './ScanComparisonPanel.js'

export function RepoHistoryCard({ repoUrl, currentScanId }) {
  const [history,    setHistory]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [comparison, setComparison] = useState(null)
  const [comparing,  setComparing]  = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    if (!repoUrl) return
    setLoading(true)
    getRepoHistory(repoUrl)
      .then(data => { setHistory(data); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [repoUrl, currentScanId])  // re-fetch when new scan completes

  async function handleCompare() {
    if (selectedIds.length !== 2) return
    setComparing(true)
    try {
      const result = await compareScans(selectedIds[0], selectedIds[1])
      setComparison(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setComparing(false)
    }
  }

  function toggleSelect(scanId) {
    setSelectedIds(prev =>
      prev.includes(scanId)
        ? prev.filter(id => id !== scanId)
        : prev.length < 2 ? [...prev, scanId] : [prev[1], scanId]
    )
    setComparison(null)
  }

  if (loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-3">
          Scan History
        </p>
        <p className="font-mono text-xs text-zinc-600 animate-pulse">Loading history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-3">Scan History</p>
        <p className="font-mono text-xs text-red-400">Error loading history: {error}</p>
      </div>
    )
  }

  const historyItems = history?.history || []
  const trend        = history?.trend

  return (
    <div className="space-y-4">
      {/* Trend chart */}
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
            Health Score History
          </p>
          <span className="font-mono text-xs text-zinc-600">
            {historyItems.length} scan{historyItems.length !== 1 ? 's' : ''}
          </span>
        </div>

        <ScoreTrendChart history={historyItems} trend={trend} />
      </div>

      {/* Scan list + comparison selector */}
      {historyItems.length >= 2 && (
        <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
              Compare Scans
            </p>
            <p className="font-mono text-xs text-zinc-600">
              Select 2 scans to compare
            </p>
          </div>

          {/* Scan list — newest first for display */}
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {[...historyItems].reverse().map((h) => {
              const isSelected  = selectedIds.includes(h.scanId)
              const scoreColor  =
                h.score >= 75 ? 'text-green-400' :
                h.score >= 50 ? 'text-yellow-400' : 'text-red-400'
              const isCurrent   = h.scanId === currentScanId

              return (
                <button
                  key={h.id}
                  onClick={() => toggleSelect(h.scanId)}
                  className={`w-full flex items-center justify-between p-3 rounded border
                              font-mono text-xs transition-colors text-left
                              ${isSelected
                                ? 'border-blue-700 bg-blue-950/40'
                                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isSelected ? 'bg-blue-400' : 'bg-zinc-700'
                    }`} />
                    <span className="text-zinc-400">
                      {new Date(h.scannedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    {isCurrent && (
                      <span className="text-green-400 text-xs">(current)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${scoreColor}`}>{h.score}</span>
                    <span className={scoreColor}>{h.grade}</span>
                    {h.totalVulns > 0 && (
                      <span className="text-red-400">{h.totalVulns} CVE{h.totalVulns !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Compare button */}
          <button
            onClick={handleCompare}
            disabled={selectedIds.length !== 2 || comparing}
            className="w-full py-2.5 border border-zinc-700 text-zinc-300 font-mono text-xs
                       rounded hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors"
          >
            {comparing ? 'Comparing...' :
             selectedIds.length === 2 ? 'Compare selected scans →' :
             `Select ${2 - selectedIds.length} more scan${2 - selectedIds.length !== 1 ? 's' : ''}`}
          </button>

          {/* Comparison result */}
          {comparison && (
            <div className="mt-4">
              <ScanComparisonPanel
                older={comparison.older}
                newer={comparison.newer}
                comparison={comparison.comparison}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
