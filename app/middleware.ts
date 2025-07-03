import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers)

  // Get the path
  const path = request.nextUrl.pathname
  console.log(`Processing middleware request for path: ${path}`);

  // Note: Direct file access is now handled by middleware.files.ts
  // This prevents conflicts between multiple middleware handlers

  // Check if authentication is required
  const requireAuth = process.env.REQUIRE_AUTHENTICATION === 'true'
  
  // Public paths that don't require authentication
  const publicPaths = [
    '/api/auth/signin',
    '/api/auth/callback',
    '/api/health',
    '/api/direct-file',
    '/auth/signin',
    '/auth/error',
    '/favicon.ico',
    '/_next',
    '/images',
  ]

  // Check if the path is public
  const isPublicPath = publicPaths.some(publicPath => 
    path.startsWith(publicPath)
  )

  if (requireAuth && !isPublicPath) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.JWT_SECRET
      })

      if (!token) {
        return NextResponse.redirect(new URL('/api/auth/signin', request.url))
      }
    } catch (error) {
      console.error('Auth middleware error:', error)
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }
  }

  // Rate limiting
  const ip = request.ip ?? 'unknown'
  const rateLimit = {
    window: parseInt(process.env.RATE_LIMIT_WINDOW ?? '15'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100')
  }

  // Add security headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // CORS headers for API routes
  if (path.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
  }

  // Cache control for static assets
  if (path.startsWith('/_next/') || path.startsWith('/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. _next/static (static files)
     * 2. _next/image (image optimization files)
     * 3. favicon.ico (favicon file)
     * 4. PDF files (handled by middleware.files.ts)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.pdf).*)',
  ],
}
