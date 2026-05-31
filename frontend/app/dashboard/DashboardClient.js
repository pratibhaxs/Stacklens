'use client'
// app/dashboard/DashboardClient.js
// Moved from page.js — requires Suspense boundary because it uses useSearchParams()

import { useState, useEffect }   from 'react'
import { useSession }            from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navbar }                from '../../components/ui/Navbar.js'
import { RepoInput }             from '../../components/dashboard/RepoInput.js'
import { ScanStatus }            from '../../components/dashboard/ScanStatus.js'
import { ResultCard }            from '../../components/dashboard/ResultCard.js'
import { rescan }                from '../../lib/api.js'
import Link                      from 'next/link'

export default function DashboardClient() {
  const { data: session, status } = useSession()
  const router                    = useRouter()
  const searchParams              = useSearchParams()

  const [activeScan, setActiveScan] = useState(null)
  const [result,     setResult]     = useState(null)
  const [scanId,     setScanId]     = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const prefilledRepo = searchParams?.get('repo') || ''

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-xs text-zinc-500 animate-pulse">loading...</div>
      </div>
    )
  }

  function handleSubmit(newScanId, cached, repoUrl) {
    setResult(null)
    setScanId(newScanId)
    setActiveScan({ scanId: newScanId, repoUrl, cached })
  }

  function handleScanComplete(analysisResult) {
    setResult(analysisResult)
    setActiveScan(null)
  }

  async function handleRescan() {
    try {
      if (!scanId) return
      const newScan = await rescan(scanId)
      setResult(null)
      setScanId(newScan.scanId)
      setActiveScan({ scanId: newScan.scanId, repoUrl: activeScan?.repoUrl || result?.repo?.url || '', cached: false })
    } catch (err) {
      console.error('Rescan failed:', err)
    }
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

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="font-mono text-xs text-green-400 tracking-widest uppercase mb-2">
              Repository Intelligence
            </p>
            <h1 className="font-mono text-2xl font-bold text-white mb-1">
              Analyze any GitHub repository
            </h1>
            <p className="font-mono text-sm text-zinc-500">
              CVEs · outdated deps · git hotspots · AI recommendations
            </p>
          </div>
          <Link href="/history"
            className="font-mono text-xs px-3 py-1.5 border border-zinc-800 text-zinc-500
                       rounded hover:border-zinc-600 hover:text-zinc-300 transition-colors
                       whitespace-nowrap flex-shrink-0">
            View history →
          </Link>
        </div>

        <RepoInputWithUrl onSubmit={handleSubmit} defaultValue={prefilledRepo} />

        <div className="mt-8 space-y-6">
          {activeScan && (
            <ScanStatus
              scanId={activeScan.scanId}
              repoUrl={activeScan.repoUrl}
              cached={activeScan.cached}
              onComplete={handleScanComplete}
            />
          )}
          {result && !activeScan && (
            <ResultCard
              result={result}
              repoUrl={result.repo?.url || ''}
              scanId={scanId}
              onRescan={handleRescan}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function RepoInputWithUrl({ onSubmit, defaultValue }) {
  const [pendingUrl, setPendingUrl] = useState(defaultValue || '')
  return (
    <RepoInput
      defaultValue={defaultValue}
      onUrlChange={setPendingUrl}
      onScanCreated={(scanId, cached) => onSubmit(scanId, cached, pendingUrl)}
    />
  )
}
