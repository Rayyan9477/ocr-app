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
  webpack: (config, { isServer }) => {
    // Exclude TensorFlow.js from client-side bundling
    if (!isServer) {
      config.resolve.alias['@tensorflow/tfjs-node'] = false;
    }
    
    // Add the following to handle HTML and other non-JS files in node modules
    config.module.rules.push({
      test: /\.html$/,
      issuer: /node_modules/,
      use: 'null-loader',
    });
    
    return config;
  },
}

export default nextConfig;
