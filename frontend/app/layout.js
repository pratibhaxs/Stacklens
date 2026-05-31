// app/layout.js
import './globals.css'
import { SessionProvider } from './providers'

export const metadata = {
  title: 'RepoScan — Repository Intelligence Platform',
  description: 'Analyze GitHub repositories for vulnerabilities, outdated dependencies, and architectural issues',
}

// Root layout wraps every page — the place for global providers and styles
// Why SessionProvider here: NextAuth's useSession() hook needs the provider
// higher in the tree than any component that uses it.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
