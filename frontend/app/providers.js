'use client'
// app/providers.js
// NextAuth's SessionProvider is a client component (uses React context).
// Next.js App Router server components can't directly wrap client components,
// so we extract this into its own 'use client' file.
// Why this pattern: lets layout.js stay a server component while still
// providing session context to all client components below it.

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
