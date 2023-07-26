/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['pbs.twimg.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'authorization',
            value: 'Bearer (.*)',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
