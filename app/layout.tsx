import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NextAuthProvider } from "@/components/auth/next-auth-provider"
import dynamic from "next/dynamic"

// Import the error boundary with client-side only rendering
const ClientErrorBoundary = dynamic(
  () => import('@/components/client-error-boundary'),
  { ssr: true }
)

export const metadata: Metadata = {
  title: "OCR Application",
  description: "A comprehensive OCR application for PDF files",
  generator: 'Next.js',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/ocr-logo.svg',
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ClientErrorBoundary>
          <NextAuthProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              {children}
              <Toaster />
            </ThemeProvider>
          </NextAuthProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  )
}
