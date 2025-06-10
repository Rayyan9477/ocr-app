/**
 * Next.js Configuration Module
 * Modular configuration for Next.js with ES module compatibility
 */
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Core settings
  reactStrictMode: true,
  
  // Build optimization
  eslint: {
    ignoreDuringBuilds: true,    
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Image optimization
  images: {
    unoptimized: true,
    domains: [],
    remotePatterns: [],
  },
  
  // Experimental features
  experimental: {
    largePageDataBytes: 128 * 1024 * 1024, // 128MB
  },
  
  // Module system compatibility
  transpilePackages: [],
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle ES modules properly
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    }
    
    // Ensure proper module resolution
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    }
    
    // Fix for ES module compatibility  
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '..'),
    }
    
    return config
  },
}

export default nextConfig
