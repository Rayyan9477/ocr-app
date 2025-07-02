import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NextAuthProvider } from "@/components/auth/next-auth-provider"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <NextAuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
