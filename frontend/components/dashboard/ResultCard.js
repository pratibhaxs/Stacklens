'use client'
// components/dashboard/ResultCard.js — Phase 4
// Adds RepoHistoryCard below AI recommendations.

import { HealthScoreCard }       from './HealthScoreCard.js'
import { VulnerabilityCard }     from './VulnerabilityCard.js'
import { OutdatedDepsCard }      from './OutdatedDepsCard.js'
import { GitMetricsCard }        from './GitMetricsCard.js'
import { StackCard }             from './StackCard.js'
import { AIRecommendationsCard } from './ai/AIRecommendationsCard.js'
import { AISummaryBanner }       from './ai/AISummaryBanner.js'
import { RepoHistoryCard }       from './history/RepoHistoryCard.js'

export function ResultCard({ result, repoUrl, scanId, onRescan }) {
  if (!result) return null

  if (result.insufficient) {
    return (
      <div className="w-full max-w-3xl border border-zinc-800 rounded-lg p-8 text-center">
        <p className="font-mono text-zinc-400 mb-2">⚠ {result.message}</p>
        <p className="font-mono text-xs text-zinc-600">Try a repository with more source code files.</p>
      </div>
    )
  }

  const { repo, summary, stack, architecture, dependencies,
          vulnerabilities, outdated, docker, gitMetrics,
          healthScore, aiRecommendations, stats } = result
  // Guard against incomplete results
if (!stats || !repo || !summary) {
  return (
    <div className="w-full max-w-3xl border border-zinc-800 rounded-lg p-8 text-center">
      <p className="font-mono text-zinc-400 mb-2">⚠ Analysis returned incomplete data</p>
      <p className="font-mono text-xs text-zinc-600">Please try rescanning the repository.</p>
    </div>
  )
}        

  return (
    <div className="w-full max-w-3xl space-y-4">

      {/* Repo header */}
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="font-mono text-xs text-green-400 tracking-wider uppercase">Analysis complete</span>
              {summary.hasAI && (
                <span className="font-mono text-xs text-purple-400 tracking-wider">· AI enhanced</span>
              )}
            </div>
            <h2 className="font-mono text-xl font-bold text-white">{repo.owner}/{repo.name}</h2>
            <p className="font-mono text-xs text-zinc-500 mt-1">
              {(stats?.totalFiles ?? 0).toLocaleString()} files · {(stats?.totalSizeKB ?? 0).toLocaleString()} KB
              {stats.truncated && ' · (truncated at 5000 files)'}
            </p>
          </div>
          <button onClick={onRescan}
            className="px-3 py-1.5 border border-zinc-700 text-zinc-400 font-mono text-xs rounded
                       hover:border-zinc-500 hover:text-zinc-200 transition-colors whitespace-nowrap">
            ↺ Rescan
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <QuickStat value={summary.score} label="Health score"
            color={summary.score >= 75 ? 'text-green-400' : summary.score >= 50 ? 'text-yellow-400' : 'text-red-400'} />
          <QuickStat value={summary.totalVulns} label="CVEs"
            color={summary.totalVulns > 0 ? 'text-red-400' : 'text-green-400'} />
          <QuickStat value={summary.outdatedDeps} label="Outdated deps"
            color={summary.outdatedDeps > 0 ? 'text-yellow-400' : 'text-green-400'} />
          <QuickStat value={summary.hotspotCount || '—'} label="Hotspots" color="text-zinc-300" />
        </div>
      </div>

      {/* AI summary banner */}
      <AISummaryBanner aiRecommendations={aiRecommendations} />

      {/* Phase 2 panels */}
      <HealthScoreCard healthScore={healthScore} summary={summary} />
      <StackCard stack={stack} architecture={architecture} dependencies={dependencies} />
      <VulnerabilityCard vulnerabilities={vulnerabilities} />
      <OutdatedDepsCard outdated={outdated} dependencySummary={dependencies?.summary} />
      <GitMetricsCard gitMetrics={gitMetrics} />
      {docker?.found && <DockerCard docker={docker} />}

      {/* Phase 3: AI recommendations */}
      <AIRecommendationsCard aiRecommendations={aiRecommendations} scanId={scanId} />

      {/* Phase 4: history + trend chart */}
      <RepoHistoryCard repoUrl={repoUrl} currentScanId={scanId} />

      <p className="font-mono text-xs text-zinc-700 text-right pb-4">
        Scanned {new Date(result.scannedAt).toLocaleString()} · Phase {result.phase}
      </p>
    </div>
  )
}

function QuickStat({ value, label, color }) {
  return (
    <div className="text-center p-2 border border-zinc-800 rounded bg-zinc-900/60">
      <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
      <div className="font-mono text-xs text-zinc-600 mt-0.5">{label}</div>
    </div>
  )
}

function DockerCard({ docker }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">Docker Configuration</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
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
      {docker.issues?.length > 0 && (
        <div className="space-y-2">
          {docker.issues.map((issue, i) => (
            <div key={i} className="border border-zinc-800 rounded p-3">
              <p className="font-mono text-xs text-yellow-400 mb-1">⚠ {issue.issue}</p>
              <p className="font-mono text-xs text-zinc-500">Fix: {issue.fix}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
