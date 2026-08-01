/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.56.1',
    '192.168.56.1:3000',
  ],
  devIndicators: {
    appIsrStatus: true,
    buildActivityPosition: 'bottom-right',
  },
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: 'stegshield.ai' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/home',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    const isProd = process.env.NODE_ENV === 'production'
    const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT || '4000'
    const envUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL
    const backendUrl = envUrl && envUrl.trim() ? envUrl : (isProd ? 'https://stegshield-backend.onrender.com/api' : `http://127.0.0.1:${backendPort}/api`)
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/+$/, '')}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
