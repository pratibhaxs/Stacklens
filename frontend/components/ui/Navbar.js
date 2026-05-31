'use client'
// components/ui/Navbar.js — Phase 4
// Added History link in nav

import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const navLinks = [
    { href: '/dashboard', label: 'Analyze' },
    { href: '/history',   label: 'History' },
  ]

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">

        {/* Logo + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono text-sm font-bold text-white tracking-tight">RepoScan</span>
            <span className="font-mono text-xs text-zinc-600 ml-1">v1.0</span>
          </Link>

          {session && (
            <div className="flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`font-mono text-xs px-3 py-1.5 rounded transition-colors
                    ${pathname === href
                      ? 'text-white bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || 'User'}
                width={28} height={28}
                className="rounded-full border border-zinc-700"
              />
            )}
            <span className="font-mono text-xs text-zinc-400 hidden sm:block">
              {session.user.username || session.user.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
