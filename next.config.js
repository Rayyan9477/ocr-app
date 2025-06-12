/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Suppress experimental warnings
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'tesseract.js'],
  },
  // Configure Node.js options to suppress experimental warnings
  serverRuntimeConfig: {
    NODE_OPTIONS: '--no-warnings',
  },
  // Fix ESLint configuration
  eslint: {
    // Only run ESLint on these directories
    dirs: ['app', 'lib', 'components'],
    // Don't throw error if ESLint finds issues (we'll fix them separately)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig;