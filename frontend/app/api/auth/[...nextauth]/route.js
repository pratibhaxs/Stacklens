// app/api/auth/[...nextauth]/route.js
// NextAuth catch-all route — handles /api/auth/signin, /api/auth/callback/github, etc.
// Why NextAuth: handles the entire OAuth flow (redirect → callback → session)
// in ~20 lines of config. Building it manually takes days and is easy to get wrong.

import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'

const handler = NextAuth({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // Request read:user scope so we can get their GitHub profile
      // Why not more scopes: ask for minimum needed. Users are more likely
      // to approve limited scopes, and it's better security practice.
      authorization: {
        params: { scope: 'read:user user:email' },
      },
    }),
  ],

  // JWT strategy: session stored in a signed cookie, no DB needed for auth
  // Why JWT over database sessions: one less table, no session cleanup needed,
  // works across multiple server instances without shared session store.
  session: { strategy: 'jwt' },

  callbacks: {
    // jwt callback: runs when token is created or refreshed
    // We add GitHub user data to the token so it's available in the session
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.githubId = profile.id
        token.username = profile.login
        token.avatarUrl = profile.avatar_url
        // Store access token — needed if you want to make GitHub API calls
        // on behalf of the user (e.g. access their private repos)
        token.accessToken = account.access_token
      }
      return token
    },

    // session callback: runs when session is read by the client
    // Exposes token data to the frontend via useSession()
    async session({ session, token }) {
      session.user.githubId = token.githubId
      session.user.username = token.username
      session.user.avatarUrl = token.avatarUrl
      // Note: don't expose accessToken to the client — keep it server-side only
      return session
    },
  },

  pages: {
    signIn: '/login',      // redirect here instead of NextAuth's default login page
    error: '/login',       // redirect auth errors to login page too
  },
})

export { handler as GET, handler as POST }
