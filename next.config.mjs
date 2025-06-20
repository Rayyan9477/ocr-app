/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/lib': path.join(__dirname, 'lib'),
    };
    return config;
  },
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
  webpack: (config, { isServer }) => {
    // Handle Node.js module imports
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        util: false,
        stream: false,
        constants: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        assert: false,
        url: false,
        querystring: false,
      };
    }
    
    // Prevent 'node:' scheme errors
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:fs': 'fs',
      'node:path': 'path',
      'node:util': 'util',
      'node:stream': 'stream',
      'node:crypto': 'crypto',
      'node:http': 'http',
      'node:https': 'https',
      'node:os': 'os',
      'node:child_process': 'child_process',
    };
    
    return config;
  },
}

export default nextConfig;
