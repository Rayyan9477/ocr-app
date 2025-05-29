import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    largePageDataBytes: 128 * 1024 * 1024, // 128MB
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Optimize for reduced recompilation frequency
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/uploads/**',
          '**/processed/**',
          '**/tmp/**',
          '**/logs/**',
          '**/*.log',
          '**/output/**',
          '**/test_output/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**', // Fixed: use string pattern instead of regex
        ],
        aggregateTimeout: 2000, // Increased delay before rebuilding
        poll: false, // Disable polling to reduce CPU usage
      };
      
      // Optimize module resolution for better performance
      config.resolve = {
        ...config.resolve,
        symlinks: false, // Disable symlink resolution for better performance
      };
      
      // Disable source maps in development for faster builds
      if (config.devtool) {
        config.devtool = false;
      }
    }
    return config;
  },
}

export default nextConfig;
