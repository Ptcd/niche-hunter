/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@niche-hunter/db', '@niche-hunter/core', '@niche-hunter/crawler', '@niche-hunter/ai'],
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client', 'prisma');
    }
    return config;
  },
}

module.exports = nextConfig

