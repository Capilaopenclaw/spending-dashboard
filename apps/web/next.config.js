/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@spending-dashboard/shared'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

module.exports = nextConfig
