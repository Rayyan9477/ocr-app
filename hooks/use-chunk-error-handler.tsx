"use client"

import { useEffect } from 'react'

/**
 * This hook handles chunk loading errors in Next.js applications
 * It adds a global error handler for chunk loading failures and attempts recovery
 */
export function useChunkErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Store original error handler
    const originalErrorHandler = window.onerror
    
    // Create a handler for chunk load errors
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event
      
      // Check if this is a chunk loading error
      const isChunkLoadError = error && (
        error.message?.includes('ChunkLoadError') ||
        error.message?.includes('Loading chunk') ||
        error.message?.includes('Loading CSS chunk') ||
        error.stack?.includes('webpack') ||
        error.stack?.includes('chunks')
      )
      
      if (isChunkLoadError) {
        console.warn('Chunk loading error detected. Attempting recovery...')
        
        // Try to clear cache and reload
        try {
          // Clear session storage for Next.js
          sessionStorage.clear()
          
          // Clear localStorage cache if any
          const cacheKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('_N_') || key.includes('webpack') || key.includes('chunk')
          )
          
          cacheKeys.forEach(key => {
            localStorage.removeItem(key)
          })
          
          // Reload the page after a small delay
          setTimeout(() => {
            window.location.reload()
          }, 100)
          
          // Prevent default error handling
          event.preventDefault()
          return true
        } catch (e) {
          console.error('Error during chunk error recovery:', e)
        }
      }
      
      // Call original handler for other errors
      if (typeof originalErrorHandler === 'function') {
        return originalErrorHandler.call(window, event)
      }
      
      return false
    }
    
    // Set up global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      return handleChunkError(error || new Error(String(message)))
    }
    
    // Also handle promise rejections related to chunks
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason
      if (error && (
        error.message?.includes('ChunkLoadError') ||
        error.message?.includes('Loading chunk') ||
        error.stack?.includes('webpack')
      )) {
        console.warn('Unhandled chunk loading rejection. Attempting recovery...')
        sessionStorage.clear()
        setTimeout(() => {
          window.location.reload()
        }, 100)
        event.preventDefault()
      }
    })
    
    // Cleanup
    return () => {
      window.onerror = originalErrorHandler
      window.removeEventListener('unhandledrejection', handleChunkError)
    }
  }, [])
  
  return null
}
