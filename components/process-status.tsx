"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ProcessedFile {
  name: string
  path: string
  size?: number
  processedAt?: string
  pages?: number
}

interface ProcessStatusProps {
  files: ProcessedFile[]
  isProcessing: boolean
}

export function ProcessStatus({ files, isProcessing }: ProcessStatusProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently'
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDownload = async (file: ProcessedFile) => {
    try {
      setDownloading(file.name)
      setDownloadProgress(0)
      setError(null)

      const response = await fetch(file.path)
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
      if (!response.body) throw new Error('No response body')

      const contentLength = Number(response.headers.get('content-length'))
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        receivedLength += value.length

        if (contentLength) {
          setDownloadProgress((receivedLength / contentLength) * 100)
        }
      }

      const blob = new Blob(chunks)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Download error:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setDownloading(null)
      setDownloadProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {files.length > 0 && (
        <div className="grid gap-4">
          {files.map((file) => (
            <Card key={file.name}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {file.name}
                </CardTitle>
                {file.processedAt && (
                  <CardDescription>
                    Processed: {new Date(file.processedAt).toLocaleString()}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {downloading === file.name ? (
                  <div className="space-y-2">
                    <Progress value={downloadProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      Downloading... {downloadProgress.toFixed(0)}%
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => handleDownload(file)}
                    disabled={isProcessing}
                  >
                    Download
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!files.length && !isProcessing && (
        <Alert>
          <AlertDescription>
            No processed files yet. Upload and process files to see them here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
