/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@tensorflow/tfjs-node'],
  experimental: {
    largePageDataBytes: 128 * 1024 * 1024,
  },
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        aws4: false,
        'aws-sdk': false,
        'mock-aws-s3': false,
        nock: false,
        npm: false,
        'node-gyp': false,
        long: false,
      };
    }

    // Handle node-pre-gyp HTML file
    config.module.rules.push({
      test: /\.html$/,
      loader: 'raw-loader',
    });

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
}

export default nextConfig;
