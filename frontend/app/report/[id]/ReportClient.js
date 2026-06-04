'use client'
// app/report/[id]/ReportClient.js
// Public report viewer — displays a completed scan result without requiring login.
// Reuses all the same dashboard panels from the authenticated view.

import { useState, useEffect }    from 'react'
import Link                       from 'next/link'
import { getPublicReport }        from '../../../lib/api.js'
import { HealthScoreCard }        from '../../../components/dashboard/HealthScoreCard.js'
import { VulnerabilityCard }      from '../../../components/dashboard/VulnerabilityCard.js'
import { OutdatedDepsCard }       from '../../../components/dashboard/OutdatedDepsCard.js'
import { GitMetricsCard }         from '../../../components/dashboard/GitMetricsCard.js'
import { StackCard }              from '../../../components/dashboard/StackCard.js'
import { AIRecommendationsCard }  from '../../../components/dashboard/ai/AIRecommendationsCard.js'
import { AISummaryBanner }        from '../../../components/dashboard/ai/AISummaryBanner.js'

export default function ReportClient({ scanId }) {
  const [report,  setReport]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!scanId) return
    getPublicReport(scanId)
      .then(data => { setReport(data); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [scanId])

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mx-auto" />
          <p className="font-mono text-xs text-zinc-500">Loading report...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-4">
          <p className="font-mono text-zinc-400">Report not found</p>
          <p className="font-mono text-xs text-zinc-600">{error}</p>
          <Link href="/"
            className="font-mono text-xs text-green-400 hover:text-green-300 underline">
            Analyze a repository →
          </Link>
        </div>
      </div>
    )
  }

  const { result, repoOwner, repoName, repoUrl, completedAt } = report
  const { summary, stack, architecture, dependencies,
          vulnerabilities, outdated, docker,
          gitMetrics, healthScore, aiRecommendations, stats } = result

  return (
    <div className="min-h-screen bg-black">
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px),
                            linear-gradient(90deg, #22c55e 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Public header — no nav, just branding + CTA */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono text-sm font-bold text-white">RepoScan</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Copy share link */}
            <button
              onClick={handleCopy}
              className={`font-mono text-xs px-3 py-1.5 border rounded transition-colors
                          ${copied
                            ? 'border-green-700 bg-green-950 text-green-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
            >
              {copied ? '✓ Copied' : '↗ Share'}
            </button>
            {/* CTA to analyze their own repo */}
            <Link href="/dashboard"
              className="font-mono text-xs px-3 py-1.5 bg-green-500 text-black rounded
                         hover:bg-green-400 transition-colors">
              Analyze your repo →
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10 space-y-4">

        {/* Repo header */}
        <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="font-mono text-xs text-green-400 tracking-wider uppercase">
              Public Report
            </span>
            {summary?.hasAI && (
              <span className="font-mono text-xs text-purple-400">· AI enhanced</span>
            )}
          </div>
          <h1 className="font-mono text-xl font-bold text-white">{repoOwner}/{repoName}</h1>
          <div className="flex items-center gap-4 mt-2">
            <a href={repoUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-zinc-500 hover:text-zinc-300 underline truncate">
              {repoUrl}
            </a>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <QuickStat value={summary?.score} label="Health score"
              color={summary?.score >= 75 ? 'text-green-400' : summary?.score >= 50 ? 'text-yellow-400' : 'text-red-400'} />
            <QuickStat value={summary?.totalVulns} label="CVEs"
              color={summary?.totalVulns > 0 ? 'text-red-400' : 'text-green-400'} />
            <QuickStat value={summary?.outdatedDeps} label="Outdated"
              color={summary?.outdatedDeps > 0 ? 'text-yellow-400' : 'text-green-400'} />
            <QuickStat value={summary?.hotspotCount || '—'} label="Hotspots" color="text-zinc-300" />
          </div>
        </div>

        {/* All analysis panels — same as authenticated dashboard */}
        <AISummaryBanner aiRecommendations={aiRecommendations} />
        <HealthScoreCard healthScore={healthScore} summary={summary} />
        <StackCard stack={stack} architecture={architecture} dependencies={dependencies} />
        <VulnerabilityCard vulnerabilities={vulnerabilities} />
        <OutdatedDepsCard outdated={outdated} dependencySummary={dependencies?.summary} />
        <GitMetricsCard gitMetrics={gitMetrics} />
        {docker?.found && <DockerCard docker={docker} />}
        <AIRecommendationsCard aiRecommendations={aiRecommendations} />

        {/* Footer CTA */}
        <div className="border border-zinc-800 rounded-lg p-6 text-center bg-zinc-900/20">
          <p className="font-mono text-sm text-zinc-300 mb-1">
            Want to analyze your own repository?
          </p>
          <p className="font-mono text-xs text-zinc-600 mb-4">
            Free · No installation · Results in 60 seconds
          </p>
          <Link href="/dashboard"
            className="font-mono text-sm px-6 py-3 bg-green-500 text-black rounded-md
                       hover:bg-green-400 transition-colors inline-block">
            Analyze a repository →
          </Link>
        </div>

        <p className="font-mono text-xs text-zinc-700 text-center pb-4">
          Report generated {new Date(completedAt).toLocaleString()} · RepoScan
        </p>
      </main>
    </div>
  )
}

function QuickStat({ value, label, color }) {
  return (
    <div className="text-center p-2 border border-zinc-800 rounded bg-zinc-900/60">
      <div className={`font-mono text-xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="font-mono text-xs text-zinc-600 mt-0.5">{label}</div>
    </div>
  )
}

function DockerCard({ docker }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">Docker Configuration</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 border border-zinc-800 rounded">
          <div className="font-mono text-sm font-bold text-white">{docker.isMultiStage ? 'Multi-stage' : 'Single-stage'}</div>
          <div className="font-mono text-xs text-zinc-600">Build type</div>
        </div>
        <div className="text-center p-2 border border-zinc-800 rounded">
          <div className={`font-mono text-sm font-bold ${docker.hasDockerignore ? 'text-green-400' : 'text-yellow-400'}`}>
            {docker.hasDockerignore ? '✓ Present' : '✗ Missing'}
          </div>
          <div className="font-mono text-xs text-zinc-600">.dockerignore</div>
        </div>
        <div className="text-center p-2 border border-zinc-800 rounded">
          <div className={`font-mono text-sm font-bold ${docker.issueCount === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
            {docker.issueCount} issues
          </div>
          <div className="font-mono text-xs text-zinc-600">Config issues</div>
        </div>
      </div>
    </div>
  )
}
