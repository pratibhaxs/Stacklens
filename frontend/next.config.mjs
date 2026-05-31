/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker deployment — creates a standalone build
  // that includes only what's needed to run the app
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
}

export default nextConfig
