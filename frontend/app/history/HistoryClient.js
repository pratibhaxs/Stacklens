'use client'
// app/history/HistoryClient.js

import { useState, useEffect }    from 'react'
import { useSession }             from 'next-auth/react'
import { useRouter }              from 'next/navigation'
import Link                       from 'next/link'
import { Navbar }                 from '../../components/ui/Navbar.js'
import { getScannedRepos }        from '../../lib/api.js'

export default function HistoryClient() {
  const { status }           = useSession()
  const router               = useRouter()
  const [repos,   setRepos]  = useState(null)
  const [loading, setLoading]= useState(true)
  const [error,   setError]  = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    getScannedRepos()
      .then(data => { setRepos(data.repos); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [status])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-xs text-zinc-500 animate-pulse">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px),
                            linear-gradient(90deg, #22c55e 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <Navbar />
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-green-400 tracking-widest uppercase mb-2">Scan History</p>
              <h1 className="font-mono text-2xl font-bold text-white">Your Repositories</h1>
              <p className="font-mono text-sm text-zinc-500 mt-1">All repos you've analyzed</p>
            </div>
            <Link href="/dashboard"
              className="font-mono text-xs px-4 py-2 border border-zinc-700 text-zinc-400
                         rounded hover:border-zinc-500 hover:text-zinc-200 transition-colors">
              + New scan
            </Link>
          </div>
        </div>

        {error && (
          <div className="border border-red-900 rounded-lg p-4 mb-6">
            <p className="font-mono text-xs text-red-400">Error: {error}</p>
          </div>
        )}

        {repos?.length === 0 && (
          <div className="border border-zinc-800 rounded-lg p-12 text-center">
            <p className="font-mono text-zinc-500 mb-2">No scans yet</p>
            <Link href="/dashboard"
              className="font-mono text-xs px-4 py-2 bg-green-500 text-black rounded hover:bg-green-400 transition-colors">
              Analyze your first repo →
            </Link>
          </div>
        )}

        {repos?.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <SummaryCard value={repos.length} label="Repos tracked" />
              <SummaryCard
                value={Math.round(repos.reduce((s, r) => s + r.score, 0) / repos.length)}
                label="Avg health score"
                color={repos.reduce((s, r) => s + r.score, 0) / repos.length >= 75 ? 'text-green-400' : 'text-yellow-400'}
              />
              <SummaryCard
                value={repos.filter(r => r.totalVulns > 0).length}
                label="Repos with CVEs"
                color={repos.filter(r => r.totalVulns > 0).length > 0 ? 'text-red-400' : 'text-green-400'}
              />
            </div>
            <div className="space-y-3">
              {repos.map((repo) => <RepoRow key={repo.id} repo={repo} />)}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ value, label, color = 'text-white' }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 text-center">
      <div className={`font-mono text-2xl font-bold ${color}`}>{value}</div>
      <div className="font-mono text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function RepoRow({ repo }) {
  const scoreColor =
    repo.score >= 75 ? 'text-green-400' :
    repo.score >= 50 ? 'text-yellow-400' : 'text-red-400'
  const gradeBg =
    repo.score >= 75 ? 'bg-green-950 border-green-800' :
    repo.score >= 50 ? 'bg-yellow-950 border-yellow-800' : 'bg-red-950 border-red-800'

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/20 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded border flex items-center justify-center flex-shrink-0 ${gradeBg}`}>
            <span className={`font-mono text-lg font-bold ${scoreColor}`}>{repo.grade}</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-white truncate">{repo.repoOwner}/{repo.repoName}</p>
            <p className="font-mono text-xs text-zinc-500 mt-0.5">
              Last scanned {new Date(repo.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="text-center hidden sm:block">
            <div className={`font-mono text-lg font-bold ${scoreColor}`}>{repo.score}</div>
            <div className="font-mono text-xs text-zinc-600">score</div>
          </div>
          {repo.totalVulns > 0 && (
            <div className="text-center">
              <div className="font-mono text-sm font-bold text-red-400">{repo.totalVulns}</div>
              <div className="font-mono text-xs text-zinc-600">CVEs</div>
            </div>
          )}
          <Link
            href={`/dashboard?repo=${encodeURIComponent(`https://github.com/${repo.repoOwner}/${repo.repoName}`)}`}
            className="font-mono text-xs px-3 py-1.5 border border-zinc-700 text-zinc-400 rounded
                       hover:border-zinc-500 hover:text-zinc-200 transition-colors whitespace-nowrap">
            View →
          </Link>
        </div>
      </div>
    </div>
  )
}
