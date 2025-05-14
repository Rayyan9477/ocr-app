"use client"

import { Progress } from "@/components/ui/progress"
import { CheckCircle, Clock, Hourglass } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProgressTrackerProps {
  currentStep: number
  totalSteps: number
  stepName: string
  showDetails?: boolean
  className?: string
  fileProgress?: number
  fileCount?: number
  fileTotal?: number
}

export function ProgressTracker({ 
  currentStep, 
  totalSteps, 
  stepName, 
  showDetails = true,
  className,
  fileProgress = 0,
  fileCount = 0,
  fileTotal = 0
}: ProgressTrackerProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100)
  const filePercentage = Math.round(fileProgress)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex justify-between text-sm items-center">
        <div className="flex items-center gap-2">
          {percentage < 100 ? (
            <Hourglass className="h-4 w-4 text-primary animate-pulse" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="font-medium">{stepName}</span>
        </div>
        <span className="text-sm font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {percentage}%
        </span>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      {showDetails && fileTotal > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>
                Processing file {fileCount} of {fileTotal}
              </span>
            </div>
            <span>{filePercentage}%</span>
          </div>
          <Progress value={filePercentage} className="h-1" />
        </div>
      )}
    </div>
  )
}
