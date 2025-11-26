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
    } else {
      // Exclude Node.js modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        child_process: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

