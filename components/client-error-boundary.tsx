"use client"

import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCcw } from "lucide-react"

// Component to handle chunk loading errors
function ChunkErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Store original error handler
    const originalErrorHandler = window.onerror
    
    // Create a handler for chunk load errors
    const handleChunkError = (event: ErrorEvent | Error) => {
      const error = event instanceof ErrorEvent ? event.error : event
      const errorMsg = error?.message || (event instanceof ErrorEvent ? event.message : String(event))
      
      // Check if this is a chunk loading error
      const isChunkLoadError = 
        errorMsg.includes('ChunkLoadError') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('Loading CSS chunk') ||
        error?.stack?.includes('webpack') ||
        error?.stack?.includes('chunks')
      
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
          
          return true
        } catch (e) {
          console.error('Error during chunk error recovery:', e)
        }
      }
      
      return false
    }
    
    // Set up global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      if (handleChunkError(error || new Error(String(message)))) {
        return true
      }
      
      // Call original handler for other errors
      if (typeof originalErrorHandler === 'function') {
        return originalErrorHandler.call(window, message, source, lineno, colno, error)
      }
      
      return false
    }
    
    // Also handle promise rejections related to chunks
    const handleRejection = (event: PromiseRejectionEvent) => {
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
    }
    
    window.addEventListener('unhandledrejection', handleRejection)
    
    // Cleanup
    return () => {
      window.onerror = originalErrorHandler
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  
  return null
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo
    })
    
    // Log the error
    console.error("Error caught by boundary:", error, errorInfo)
  }

  handleRetry = (): void => {
    // Clear cache and reload the page
    try {
      sessionStorage.clear()
      window.location.reload()
    } catch (e) {
      console.error("Error during retry:", e)
      window.location.reload()
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Default error UI
      return (
        <div className="p-4 max-w-3xl mx-auto my-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || "An unexpected error occurred"}
            </AlertDescription>
          </Alert>
          
          {/* Show technical details in development */}
          {process.env.NODE_ENV !== "production" && this.state.errorInfo && (
            <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto max-h-60 text-xs">
              <details>
                <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            </div>
          )}
          
          <div className="mt-6 flex justify-center">
            <Button
              onClick={this.handleRetry}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function ClientErrorBoundary({ children, fallback }: Props) {
  return (
    <ErrorBoundaryComponent fallback={fallback}>
      <ChunkErrorHandler />
      {children}
    </ErrorBoundaryComponent>
  )
}
