"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Play } from "lucide-react"

interface FloatingActionButtonProps {
  onClick: () => void
  isProcessing: boolean
  filesCount: number
}

export function FloatingActionButton({ onClick, isProcessing, filesCount }: FloatingActionButtonProps) {
  if (filesCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button 
        size="lg"
        onClick={onClick}
        disabled={isProcessing || filesCount === 0}
        className="shadow-lg hover:shadow-xl transition-shadow bg-primary hover:bg-primary/90 text-white px-6"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="mr-2 h-5 w-5" />
            Start OCR ({filesCount} files)
          </>
        )}
      </Button>
    </div>
  )
}
