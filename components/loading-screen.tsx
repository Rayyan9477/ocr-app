import React from "react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";

interface LoadingScreenProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function LoadingScreen({
  message = "Processing...",
  progress = 0,
  showProgress = false,
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-[9999] animate-in fade-in duration-300">
      <div className="flex flex-col items-center space-y-6 p-6 rounded-lg bg-card shadow-lg border animate-in zoom-in-90 duration-300">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse-glow" 
               style={{ animationDuration: '3s' }}></div>
          <Image
            src="/ocr-logo.svg"
            alt="OCR App Logo"
            fill
            className="object-contain animate-spin-slow"
            style={{ animationDuration: '15s' }}
          />
        </div>
        <h2 className="text-xl font-semibold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">{message}</h2>
        {showProgress && (
          <div className="w-full max-w-xs animate-in slide-in-from-bottom duration-500">
            <Progress value={progress} className="h-2 w-full" />
            <div className="flex justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {progress < 5 ? 'Starting...' : progress >= 100 ? 'Finishing...' : 'Processing...'}
              </p>
              <p className="text-xs font-medium">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
        )}
        
        <div className="flex gap-2 mt-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
        </div>
      </div>
    </div>
  );
}
