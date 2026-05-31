'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginClient() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-green-400 font-mono text-sm animate-pulse">initializing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px),
                            linear-gradient(90deg, #22c55e 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 font-mono text-xs tracking-widest uppercase">RepoScan v1.0</span>
          </div>
          <h1 className="text-3xl font-mono font-bold text-white mb-2">
            Repository<br /><span className="text-green-400">Intelligence</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm">
            Analyze GitHub repos for vulnerabilities,<br />outdated deps, and architectural risks
          </p>
        </div>
        <div className="border border-zinc-800 rounded-lg p-8 bg-zinc-900/50 backdrop-blur">
          <p className="text-zinc-400 font-mono text-xs text-center mb-6 tracking-wider uppercase">Authentication required</p>
          <button
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-3 bg-white text-black
                       font-mono font-medium py-3 px-6 rounded-md hover:bg-zinc-100 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </button>
          <p className="text-zinc-600 font-mono text-xs text-center mt-4">Only public repo access requested</p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {['CVE Detection', 'Health Score', 'AI Insights'].map(f => (
            <div key={f} className="border border-zinc-800 rounded p-2">
              <span className="text-zinc-500 font-mono text-xs">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
