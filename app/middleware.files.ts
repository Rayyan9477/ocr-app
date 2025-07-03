import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// This middleware focuses specifically on handling direct file access patterns
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  console.log(`[File Middleware] Processing request for: ${pathname}`);

  // Handle direct file access for OCR files
  const fileAccessPattern = /^\/(input_\d+_smart_ocr\.pdf|.*_\d+_smart_ocr\.pdf|.*_forced_ocr\.pdf|.*_ocr\.pdf|.*_smart_ocr\.pdf)$/;
  if (fileAccessPattern.test(pathname)) {
    const fileName = pathname.substring(1); // Remove the leading slash
    console.log(`[File Middleware] Redirecting direct file access: ${pathname} to /api/direct-file/${fileName}`);
    
    // Create new URL with the API endpoint
    const apiUrl = new URL(`/api/direct-file/${fileName}`, request.url);
    
    // Return a 307 temporary redirect
    return NextResponse.redirect(apiUrl, 307);
  }

  return NextResponse.next();
}

// Configure the matcher to only run this middleware for potential PDF files
export const config = {
  matcher: [
    '/:path*.pdf',
    '/input_*',
  ],
};
