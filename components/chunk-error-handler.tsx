"use client"

import { useChunkErrorHandler } from "@/hooks/use-chunk-error-handler"

export function ChunkErrorHandler() {
  // This component doesn't render anything visible
  // It just sets up the chunk error handling
  useChunkErrorHandler()
  
  return null
}
