"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCcw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
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
    
    // Log the error to your monitoring service
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleRetry = (): void => {
    // Force clear local cache and reload
    try {
      // Clear application cache in some browsers
      if ('caches' in window) {
        caches.keys().then(keyList => {
          return Promise.all(keyList.map(key => {
            return caches.delete(key)
          }))
        })
      }
      
      // Clear session storage for Next.js
      sessionStorage.clear()
      
      // Reload the page
      window.location.reload()
    } catch (e) {
      console.error("Error during cache clearing:", e)
      // Just reload if the cache clearing fails
      window.location.reload()
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Otherwise, show a default error UI
      return (
        <div className="p-4 max-w-3xl mx-auto my-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || "An unexpected error occurred"}
            </AlertDescription>
          </Alert>
          
          {/* Show technical details for development */}
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
