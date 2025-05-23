"use client"

import type React from "react"

import { useEffect } from "react"
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export type ToastActionElement = React.ReactNode

export interface ToastProps {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "error" | "success" | "warning" | "info"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

// Export individual toast components that match the imports in toaster.tsx
export const Toast = ({ 
  children, 
  className,
  variant = "default", 
  ...props 
}: React.PropsWithChildren<ToastProps>) => {
  const bgColors: Record<string, string> = {
    default: "bg-white",
    error: "bg-white border-red-200",
    success: "bg-white border-green-200",
    warning: "bg-white border-yellow-200",
    info: "bg-white border-blue-200"
  };
  
  const bgColor = bgColors[variant || "default"];
  
  return (
    <div className={`${bgColor} rounded-lg shadow-lg border p-4 flex items-start gap-3 animate-in slide-in-from-right ${className || ''}`}>
      {children}
    </div>
  );
};

export const ToastTitle = ({ children }: React.PropsWithChildren<{}>) => {
  return <h3 className="font-medium">{children}</h3>;
};

export const ToastDescription = ({ children }: React.PropsWithChildren<{}>) => {
  return <p className="text-sm text-gray-500 mt-1">{children}</p>;
};

export const ToastClose = () => {
  const { dismiss } = useToast();
  return (
    <button
      onClick={() => dismiss()}
      className="shrink-0 rounded-md p-1 hover:bg-gray-100"
      aria-label="Close toast"
    >
      <X className="h-4 w-4" />
    </button>
  );
};

export const ToastProvider = ({ children }: React.PropsWithChildren<{}>) => {
  return <div className="toast-provider">{children}</div>;
};

export const ToastViewport = () => {
  return <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-w-md w-full toast-viewport" />;
};

// Original implementation renamed to Toasts
export function Toasts() {
  const { toasts, dismiss } = useToast()

  // Remove toasts when ESC key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toasts.forEach((toast) => dismiss(toast.id))
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [toasts, dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-w-md w-full">
      {toasts.map((toast) => {
        let bgColor = "bg-white"
        let icon = <Info className="h-5 w-5 text-blue-500" />

        if (toast.variant === "error") {
          bgColor = "bg-white border-red-200"
          icon = <AlertCircle className="h-5 w-5 text-red-500" />
        } else if (toast.variant === "success") {
          bgColor = "bg-white border-green-200"
          icon = <CheckCircle className="h-5 w-5 text-green-500" />
        } else if (toast.variant === "warning") {
          bgColor = "bg-white border-yellow-200"
          icon = <AlertTriangle className="h-5 w-5 text-yellow-500" />
        }

        return (
          <div
            key={toast.id}
            className={`${bgColor} rounded-lg shadow-lg border p-4 flex items-start gap-3 animate-in slide-in-from-right`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1">
              <h3 className="font-medium">{toast.title}</h3>
              {toast.description && <p className="text-sm text-gray-500 mt-1">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-1 hover:bg-gray-100"
              aria-label="Close toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
