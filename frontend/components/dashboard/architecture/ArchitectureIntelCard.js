'use client'
// components/dashboard/architecture/ArchitectureIntelCard.js
// The flagship architecture intelligence panel.
// Shows: score, circular deps, god modules, coupling, anemic models,
// feature envy, layer violations, and architectural hotspots.

import { useState } from 'react'

const SEVERITY_COLORS = {
  critical: { text: 'text-red-400',    bg: 'bg-red-950',    border: 'border-red-800',    badge: 'bg-red-500 text-black' },
  high:     { text: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-800', badge: 'bg-orange-500 text-black' },
  medium:   { text: 'text-yellow-400', bg: 'bg-yellow-950', border: 'border-yellow-800', badge: 'bg-yellow-500 text-black' },
  low:      { text: 'text-zinc-400',   bg: 'bg-zinc-900',   border: 'border-zinc-700',   badge: 'bg-zinc-500 text-white' },
}

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'circular',   label: 'Circular Deps' },
  { key: 'coupling',   label: 'Coupling' },
  { key: 'god',        label: 'God Modules' },
  { key: 'patterns',   label: 'Anti-Patterns' },
  { key: 'hotspots',   label: 'Arch Hotspots' },
]

export function ArchitectureIntelCard({ architectureIntel }) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!architectureIntel) return null

  if (!architectureIntel.supported) {
    return (
      <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
        <div className="flex items-center gap-2 mb-3">
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
            Architecture Intelligence
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-600 text-center py-4">
          {architectureIntel.reason || 'Architecture analysis not available for this repository'}
        </p>
      </div>
    )
  }

  const {
    architectureScore, summary, topIssues,
    godModules, circularDeps, highCoupling,
    anemicModels, featureEnvy, layerViolations,
    architecturalHotspots, couplingData,
  } = architectureIntel

  const scoreColor =
    architectureScore?.score >= 75 ? 'text-green-400' :
    architectureScore?.score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <p className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            Architecture Intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          {architectureScore && (
            <div className="flex items-center gap-2">
              <span className={`font-mono text-lg font-bold ${scoreColor}`}>
                {architectureScore.score}
              </span>
              <span className={`font-mono text-sm ${scoreColor}`}>
                {architectureScore.grade}
              </span>
              <span className="font-mono text-xs text-zinc-600">
                architecture score
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-mono text-xs px-4 py-3 border-b-2 whitespace-nowrap transition-colors
              ${activeTab === tab.key
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab.label}
            {/* Badge for issue counts */}
            {tab.key === 'circular'  && circularDeps?.length > 0   && <IssueBadge count={circularDeps.length} />}
            {tab.key === 'god'       && godModules?.length > 0      && <IssueBadge count={godModules.length} />}
            {tab.key === 'patterns'  && (anemicModels?.length + featureEnvy?.length + layerViolations?.length) > 0 &&
              <IssueBadge count={anemicModels?.length + featureEnvy?.length + layerViolations?.length} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === 'overview'  && <OverviewTab summary={summary} topIssues={topIssues} architectureScore={architectureScore} />}
        {activeTab === 'circular'  && <CircularDepsTab circularDeps={circularDeps} />}
        {activeTab === 'coupling'  && <CouplingTab highCoupling={highCoupling} couplingData={couplingData} />}
        {activeTab === 'god'       && <GodModulesTab godModules={godModules} />}
        {activeTab === 'patterns'  && <PatternsTab anemicModels={anemicModels} featureEnvy={featureEnvy} layerViolations={layerViolations} />}
        {activeTab === 'hotspots'  && <ArchHotspotsTab hotspots={architecturalHotspots} />}
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ summary, topIssues, architectureScore }) {
  return (
    <div className="space-y-4">
      {/* Score breakdown */}
      {architectureScore?.breakdown && (
        <div>
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-3">Score breakdown</p>
          <div className="space-y-2">
            {[
              { key: 'complexity', label: 'Complexity', color: 'bg-orange-500' },
              { key: 'coupling',   label: 'Coupling',   color: 'bg-red-500' },
              { key: 'design',     label: 'Design',     color: 'bg-purple-500' },
              { key: 'structure',  label: 'Structure',  color: 'bg-yellow-500' },
            ].map(({ key, label, color }) => {
              const pts = architectureScore.breakdown[key] || 0
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500 w-20">{label}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`}
                      style={{ width: `${Math.min((pts / 25) * 100, 100)}%` }} />
                  </div>
                  <span className="font-mono text-xs text-zinc-500 w-12 text-right">
                    {pts > 0 ? `-${pts}pts` : '✓'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={summary?.totalCycles || 0}       label="Circular deps"  color={summary?.totalCycles > 0 ? 'text-red-400' : 'text-green-400'} />
        <StatCard value={summary?.godModulesCount || 0}   label="God modules"    color={summary?.godModulesCount > 0 ? 'text-orange-400' : 'text-green-400'} />
        <StatCard value={summary?.highCouplingCount || 0} label="High coupling"  color={summary?.highCouplingCount > 0 ? 'text-yellow-400' : 'text-green-400'} />
        <StatCard value={summary?.anemicModelsCount || 0} label="Anemic models"  color={summary?.anemicModelsCount > 0 ? 'text-yellow-400' : 'text-green-400'} />
        <StatCard value={summary?.featureEnvyCount || 0}  label="Feature envy"   color={summary?.featureEnvyCount > 0 ? 'text-yellow-400' : 'text-green-400'} />
        <StatCard value={summary?.layerViolations || 0}   label="Layer violations" color={summary?.layerViolations > 0 ? 'text-red-400' : 'text-green-400'} />
      </div>

      {/* Top issues */}
      {topIssues?.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider mb-3">Top issues to fix</p>
          <div className="space-y-2">
            {topIssues.map((issue, i) => {
              const sev = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.medium
              return (
                <div key={i} className={`border ${sev.border} ${sev.bg} rounded p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${sev.badge}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <span className={`font-mono text-xs font-medium ${sev.text}`}>{issue.title}</span>
                  </div>
                  <p className="font-mono text-xs text-zinc-400">{issue.detail}</p>
                  {issue.fix && (
                    <p className="font-mono text-xs text-green-400 mt-1">→ {issue.fix}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {topIssues?.length === 0 && (
        <div className="text-center py-4">
          <p className="font-mono text-sm text-green-400">✓ No major architectural issues detected</p>
        </div>
      )}
    </div>
  )
}

// ─── Circular Deps Tab ────────────────────────────────────────────────────────
function CircularDepsTab({ circularDeps }) {
  if (!circularDeps?.length) {
    return <EmptyState msg="✓ No circular dependencies detected" color="text-green-400" />
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-zinc-600">
        Circular dependencies create tight coupling and make testing difficult.
        Break cycles by extracting shared code into a separate module.
      </p>
      {circularDeps.map((cycle, i) => {
        const sev = SEVERITY_COLORS[cycle.severity]
        return (
          <div key={i} className={`border ${sev.border} ${sev.bg} rounded p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${sev.badge}`}>
                {cycle.severity.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-zinc-400">{cycle.length} modules in cycle</span>
            </div>
            <p className={`font-mono text-xs ${sev.text} mb-2 break-all`}>{cycle.display}</p>
            <p className="font-mono text-xs text-green-400">→ {cycle.suggestion}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Coupling Tab ─────────────────────────────────────────────────────────────
function CouplingTab({ highCoupling, couplingData }) {
  if (!highCoupling?.length) {
    return <EmptyState msg="✓ No high coupling issues detected" color="text-green-400" />
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-zinc-600 mb-3">
        High efferent coupling (outgoing deps) makes a module fragile — changes elsewhere break it.
      </p>
      {highCoupling.map((c, i) => {
        const sev = SEVERITY_COLORS[c.couplingRisk] || SEVERITY_COLORS.medium
        return (
          <div key={i} className={`border ${sev.border} rounded p-3 ${sev.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-mono text-xs font-medium ${sev.text} truncate max-w-[70%]`}>
                {c.file}
              </span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${sev.badge}`}>
                {c.efferentCoupling} deps
              </span>
            </div>
            <div className="flex gap-4 mb-1">
              <span className="font-mono text-xs text-zinc-500">
                outgoing: <span className="text-red-400">{c.efferentCoupling}</span>
              </span>
              <span className="font-mono text-xs text-zinc-500">
                incoming: <span className="text-blue-400">{c.afferentCoupling}</span>
              </span>
              <span className="font-mono text-xs text-zinc-500">
                instability: <span className="text-zinc-300">{(c.instability * 100).toFixed(0)}%</span>
              </span>
            </div>
            <p className="font-mono text-xs text-green-400">→ {c.suggestion}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── God Modules Tab ──────────────────────────────────────────────────────────
function GodModulesTab({ godModules }) {
  if (!godModules?.length) {
    return <EmptyState msg="✓ No god modules detected" color="text-green-400" />
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-zinc-600 mb-3">
        God modules do too many things. They're hard to test, understand, and modify safely.
      </p>
      {godModules.map((g, i) => {
        const sev = SEVERITY_COLORS[g.severity]
        return (
          <div key={i} className={`border ${sev.border} ${sev.bg} rounded p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${sev.badge}`}>
                {g.severity.toUpperCase()}
              </span>
              <span className={`font-mono text-xs font-medium ${sev.text} truncate`}>{g.file}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center p-1 border border-zinc-800 rounded">
                <div className="font-mono text-sm font-bold text-white">{g.linesOfCode}</div>
                <div className="font-mono text-xs text-zinc-600">lines</div>
              </div>
              <div className="text-center p-1 border border-zinc-800 rounded">
                <div className="font-mono text-sm font-bold text-white">{g.functionCount}</div>
                <div className="font-mono text-xs text-zinc-600">functions</div>
              </div>
              <div className="text-center p-1 border border-zinc-800 rounded">
                <div className="font-mono text-sm font-bold text-white">{g.importCount}</div>
                <div className="font-mono text-xs text-zinc-600">imports</div>
              </div>
            </div>
            <p className="font-mono text-xs text-green-400">→ {g.suggestion}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Anti-Patterns Tab ────────────────────────────────────────────────────────
function PatternsTab({ anemicModels, featureEnvy, layerViolations }) {
  const hasIssues = anemicModels?.length || featureEnvy?.length || layerViolations?.length

  if (!hasIssues) {
    return <EmptyState msg="✓ No additional anti-patterns detected" color="text-green-400" />
  }

  return (
    <div className="space-y-5">
      {/* Layer violations */}
      {layerViolations?.length > 0 && (
        <div>
          <p className="font-mono text-xs text-red-400 uppercase tracking-wider mb-2">
            Layer Violations ({layerViolations.length})
          </p>
          <div className="space-y-2">
            {layerViolations.map((v, i) => (
              <div key={i} className="border border-red-800 bg-red-950 rounded p-3">
                <p className="font-mono text-xs text-red-400 mb-1">{v.from} → {v.to}</p>
                <p className="font-mono text-xs text-green-400">→ {v.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anemic models */}
      {anemicModels?.length > 0 && (
        <div>
          <p className="font-mono text-xs text-yellow-400 uppercase tracking-wider mb-2">
            Anemic Domain Models ({anemicModels.length})
          </p>
          <div className="space-y-2">
            {anemicModels.map((a, i) => (
              <div key={i} className="border border-yellow-800 bg-yellow-950 rounded p-3">
                <p className="font-mono text-xs text-yellow-400 font-medium mb-1">
                  {a.className} <span className="text-zinc-500 font-normal">in {a.file}</span>
                </p>
                <p className="font-mono text-xs text-zinc-400">
                  {a.properties} properties, {a.methods} method(s)
                </p>
                <p className="font-mono text-xs text-green-400 mt-1">→ {a.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature envy */}
      {featureEnvy?.length > 0 && (
        <div>
          <p className="font-mono text-xs text-orange-400 uppercase tracking-wider mb-2">
            Feature Envy ({featureEnvy.length})
          </p>
          <div className="space-y-2">
            {featureEnvy.map((f, i) => (
              <div key={i} className="border border-orange-800 bg-orange-950 rounded p-3">
                <p className="font-mono text-xs text-orange-400 mb-1">
                  {f.envyingModule}
                  <span className="text-zinc-500"> imports {f.importCount} items from </span>
                  {f.enviedModule}
                </p>
                <p className="font-mono text-xs text-green-400">→ {f.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Architectural Hotspots Tab ───────────────────────────────────────────────
function ArchHotspotsTab({ hotspots }) {
  if (!hotspots?.length) {
    return <EmptyState msg="No architectural hotspots detected" color="text-zinc-500" />
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-zinc-600 mb-3">
        Files that are simultaneously complex, highly coupled, AND frequently changed.
        These are your highest-priority refactor candidates.
      </p>
      {hotspots.map((h, i) => {
        const sev = SEVERITY_COLORS[h.severity]
        return (
          <div key={i} className={`border ${sev.border} ${sev.bg} rounded p-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-xs font-medium ${sev.text} truncate max-w-[70%]`}>
                {h.file}
              </span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${sev.badge}`}>
                {h.severity.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {h.signals.map((s, j) => (
                <span key={j} className="font-mono text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">
                  {s}
                </span>
              ))}
            </div>
            <p className="font-mono text-xs text-green-400">→ {h.suggestion}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ value, label, color }) {
  return (
    <div className="text-center p-2 border border-zinc-800 rounded bg-zinc-900/60">
      <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
      <div className="font-mono text-xs text-zinc-600 mt-0.5">{label}</div>
    </div>
  )
}

function IssueBadge({ count }) {
  return (
    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full
                     bg-red-500 text-black font-mono text-xs font-bold">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function EmptyState({ msg, color = 'text-zinc-500' }) {
  return (
    <p className={`font-mono text-sm ${color} text-center py-6`}>{msg}</p>
  )
}
