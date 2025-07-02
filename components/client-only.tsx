"use client"

import { useEffect, useState } from 'react'

interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * A wrapper component that only renders its children on the client-side
 * This prevents hydration errors and issues with browser-only APIs
 * 
 * @param children The components to render client-side only
 * @param fallback Optional fallback to render during SSR (defaults to null)
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    return () => {
      setMounted(false)
    }
  }, [])

  if (!mounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
