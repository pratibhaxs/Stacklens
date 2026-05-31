'use client'
// components/dashboard/ScanStatus.js
// Displays the live scan state while the worker processes the job.
// Shows different UI for pending, running, completed, and failed states.

import { useScanStatus } from '../../lib/hooks/useScanStatus'

// Animated terminal-style log lines shown during analysis
const RUNNING_MESSAGES = [
  'Cloning repository...',
  'Walking file tree...',
  'Detecting tech stack...',
  'Parsing dependencies...',
  'Checking CVE database...',
  'Analyzing structure...',
  'Generating results...',
]

export function ScanStatus({ scanId, repoUrl, cached, onComplete }) {
  const { status, result, error, loading } = useScanStatus(scanId)

  // When scan completes, bubble result up to parent dashboard
  if (status === 'completed' && result) {
    onComplete(result)
    return null
  }

  return (
    <div className="w-full max-w-2xl border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <span className="font-mono text-xs text-zinc-500 ml-2">
          reposcan — analysis
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-5 bg-black font-mono text-sm min-h-[160px]">
        <p className="text-zinc-500 text-xs mb-4">
          $ reposcan analyze {repoUrl}
        </p>

        {/* Cached result */}
        {cached && (
          <div className="flex items-center gap-2 text-blue-400 text-xs mb-3">
            <span>ℹ</span>
            <span>Returning cached result (less than 6 hours old)</span>
          </div>
        )}

        {/* Loading / pending */}
        {(loading || status === 'pending') && (
          <div className="flex items-center gap-3 text-zinc-400">
            <Spinner />
            <span className="text-xs">Queued — waiting for worker...</span>
          </div>
        )}

        {/* Running — animated log lines */}
        {status === 'running' && (
          <AnimatedLog messages={RUNNING_MESSAGES} />
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="space-y-2">
            <p className="text-red-400 text-xs">✗ Analysis failed</p>
            <p className="text-zinc-500 text-xs">{error}</p>
            <p className="text-zinc-600 text-xs mt-3">
              You can try again by submitting the URL above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-3 h-3 border border-green-500 border-t-transparent
                    rounded-full animate-spin flex-shrink-0" />
  )
}

function AnimatedLog({ messages }) {
  return (
    <div className="space-y-1.5">
      {messages.map((msg, i) => (
        <div
          key={msg}
          className="flex items-center gap-2 text-xs"
          style={{
            animation: `fadeIn 0.3s ease forwards`,
            animationDelay: `${i * 0.6}s`,
            opacity: 0,
          }}
        >
          <span className="text-green-400">›</span>
          <span className="text-zinc-400">{msg}</span>
        </div>
      ))}
      {/* Blinking cursor */}
      <div className="flex items-center gap-2 text-xs mt-1">
        <span className="text-green-400">›</span>
        <span className="inline-block w-2 h-3 bg-green-400 animate-pulse" />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
