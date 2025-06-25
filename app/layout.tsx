"use client"

import type { ReactNode } from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SafeHydration } from "@/components/SafeHydration"
import { Toaster } from "@/components/ui/toaster"
import NavigationWrapper from "@/components/navigation-wrapper"

const inter = Inter({ subsets: ["latin"] })

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SafeHydration>
            <div className="flex min-h-screen flex-col">
              <NavigationWrapper />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </SafeHydration>
        </ThemeProvider>
      </body>
    </html>
  )
}
