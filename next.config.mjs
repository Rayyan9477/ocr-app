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
  // API configuration is moved to the route.ts file using export const config
  // The api configuration here is deprecated in Next.js 13+
  // Add experimental settings for large data handling
  experimental: {
    serverExternalPackages: ['sharp'],
    largePageDataBytes: 128 * 1024 * 1024, // 128MB
  },
}

export default nextConfig
