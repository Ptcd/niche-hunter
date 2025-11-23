/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@niche-hunter/db', '@niche-hunter/core', '@niche-hunter/crawler'],
}

module.exports = nextConfig

