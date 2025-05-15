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
    <div className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm z-[100] border-b shadow-lg animate-in slide-in-from-top duration-300">
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10 flex-shrink-0">
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
          
          <div className="flex-grow">
            <h2 className="text-sm font-medium text-foreground">{message}</h2>
            {showProgress && (
              <div className="mt-2">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {progress < 5 ? 'Starting...' : progress >= 100 ? 'Finishing...' : 'Processing...'}
                  </p>
                  <p className="text-xs font-medium">{Math.round(progress)}%</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
