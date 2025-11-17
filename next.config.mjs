/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for better Azure App Service compatibility
  output: 'standalone',
  
  // Essential for Azure App Service
  // Exclude packages that need native module resolution from webpack bundling
  serverExternalPackages: ['@tensorflow/tfjs-node', 'tesseract.js', 'tesseract.js-core', 'sharp'],
  poweredByHeader: false,
  
  experimental: {
    largePageDataBytes: 128 * 1024 * 1024,
    optimizeCss: false,
  },
  
  // Configure for Azure App Service
  staticPageGenerationTimeout: 1000,
  generateEtags: false,
  compress: true,
  
  // Disable TypeScript and ESLint checking during build for faster CI
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: 'tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Add rewrites for direct file access
  async rewrites() {
    return [
      {
        source: '/input_:timestamp_smart_ocr.pdf',
        destination: '/api/direct-file/input_:timestamp_smart_ocr.pdf',
      },
      {
        source: '/:filename_:timestamp_smart_ocr.pdf',
        destination: '/api/direct-file/:filename_:timestamp_smart_ocr.pdf',
      },
      {
        source: '/:filename_ocr.pdf',
        destination: '/api/direct-file/:filename_ocr.pdf',
      },
      {
        source: '/:filename_forced_ocr.pdf',
        destination: '/api/direct-file/:filename_forced_ocr.pdf',
      }
    ];
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  },
  webpack: (config, { isServer, dev }) => {
    // Improve chunk loading for development and production
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|next|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
              reuseExistingChunk: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              chunks: 'all',
              name(module, chunks) {
                const moduleFileName = module
                  .identifier()
                  .split('/')
                  .reduceRight((item) => item);
                return `npm.${moduleFileName.replace(/(\W|_)/g, '')}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
          },
        },
        runtimeChunk: { name: 'runtime' },
      };
      
      // Disable webpack cache in development to prevent chunk loading issues
      config.cache = false;
    }

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
