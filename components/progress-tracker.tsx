"use client"

import { Progress } from "@/components/ui/progress"

interface ProgressTrackerProps {
  currentStep: number
  totalSteps: number
  stepName: string
}

export function ProgressTracker({ currentStep, totalSteps, stepName }: ProgressTrackerProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{stepName}</span>
        <span>{percentage}%</span>
      </div>
      <Progress value={percentage} />
    </div>
  )
}
