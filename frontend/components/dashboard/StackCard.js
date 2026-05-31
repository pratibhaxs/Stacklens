'use client'
// components/dashboard/StackCard.js

const SUPPORT_STYLES = {
  full:    { color: 'text-green-400',  bg: 'bg-green-950 border-green-800',  label: 'Full support' },
  partial: { color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800', label: 'Partial support' },
  limited: { color: 'text-orange-400', bg: 'bg-orange-950 border-orange-800', label: 'Limited support' },
  none:    { color: 'text-zinc-400',   bg: 'bg-zinc-900 border-zinc-700',     label: 'Unsupported' },
}

const ARCH_COLORS = {
  microservices: 'text-blue-400',
  monolith:      'text-green-400',
  serverless:    'text-purple-400',
  library:       'text-yellow-400',
  unclear:       'text-zinc-500',
}

export function StackCard({ stack, architecture, dependencies }) {
  if (!stack) return null

  const supportStyle = SUPPORT_STYLES[stack.supportLevel] || SUPPORT_STYLES.none

  return (
    <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">
        Stack &amp; Architecture
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Primary stack */}
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">Primary stack</p>
          {stack.primary ? (
            <div>
              <span className="font-mono text-sm font-bold text-white">
                {stack.primary.label}
              </span>
              <div className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded border text-xs font-mono ${supportStyle.bg} ${supportStyle.color}`}>
                {supportStyle.label}
              </div>
              {stack.frameworks?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {stack.frameworks.map(f => (
                    <span key={f} className="font-mono text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="font-mono text-sm text-zinc-500">Unknown</span>
          )}
        </div>

        {/* Architecture */}
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">Architecture</p>
          <span className={`font-mono text-sm font-bold ${ARCH_COLORS[architecture?.architecture] || 'text-zinc-400'}`}>
            {architecture?.label || 'Unknown'}
          </span>
          {architecture?.confidence && (
            <p className="font-mono text-xs text-zinc-600 mt-1">
              {architecture.confidence} confidence
            </p>
          )}
        </div>

        {/* Dependencies summary */}
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">Dependencies</p>
          <span className="font-mono text-sm font-bold text-white">
            {dependencies?.summary?.total || 0}
          </span>
          <p className="font-mono text-xs text-zinc-600 mt-0.5">
            {dependencies?.summary?.prod || 0} prod · {dependencies?.summary?.dev || 0} dev
          </p>
        </div>

        {/* Monorepo indicator */}
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-2">Structure</p>
          <span className={`font-mono text-sm font-bold ${stack.isMonorepo ? 'text-blue-400' : 'text-zinc-300'}`}>
            {stack.isMonorepo ? 'Monorepo' : 'Single repo'}
          </span>
          {stack.isMonorepo && stack.monorepoWorkspaces?.length > 0 && (
            <p className="font-mono text-xs text-zinc-600 mt-0.5">
              {stack.monorepoWorkspaces.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Support message */}
      {stack.supportMessage && stack.supportLevel !== 'full' && (
        <div className={`mt-4 p-2 rounded border font-mono text-xs ${supportStyle.bg} ${supportStyle.color}`}>
          ℹ {stack.supportMessage}
        </div>
      )}
    </div>
  )
}
