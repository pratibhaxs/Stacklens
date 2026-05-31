// app/page.js
// Root page — just redirects based on auth state.
// Why not put dashboard logic here: cleaner URL structure.
// /dashboard is more bookmarkable and meaningful than /.

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function HomePage() {
  const session = await getServerSession()
  // Server-side redirect — no flash of wrong content
  if (session) redirect('/dashboard')
  else redirect('/login')
}
