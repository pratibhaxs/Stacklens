// app/dashboard/page.js
// Force dynamic rendering — prevents Next.js from trying to
// statically prerender this page at build time.
// Required because this page uses useSession() and useSearchParams()
// which only work in the browser, not during static generation.
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import DashboardClient from './DashboardClient'

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-xs text-zinc-500 animate-pulse">loading...</div>
      </div>
    }>
      <DashboardClient />
    </Suspense>
  )
}
