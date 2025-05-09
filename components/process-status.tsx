"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { FileCheck, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface ProcessedFile {
  name: string
  path: string
}

interface ProcessStatusProps {
  files: ProcessedFile[]
  isProcessing: boolean
}

export function ProcessStatus({ files, isProcessing }: ProcessStatusProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const { toast } = useToast()

  const handleDownload = async (file: ProcessedFile) => {
    try {
      setDownloading(file.name)

      // First check if the file exists by making a HEAD request
      // Use try/catch for the fetch operation itself
      try {
        const checkResponse = await fetch(file.path, { method: "HEAD" })

        if (!checkResponse.ok) {
          // If the server returns an error status code
          const contentType = checkResponse.headers.get('content-type');
          
          // If the error response is JSON, try to parse it for more details
          if (contentType && contentType.includes('application/json')) {
            try {
              const errorData = await checkResponse.json();
              throw new Error(errorData.error || `File not found or not accessible (${checkResponse.status})`);
            } catch (jsonError) {
              // If JSON parsing fails, just use the status code
              throw new Error(`File not found or not accessible (${checkResponse.status})`);
            }
          } else {
            throw new Error(`File not found or not accessible (${checkResponse.status})`);
          }
        }
      } catch (fetchError) {
        // Handle network errors or JSON parsing errors
        throw new Error(`Error checking file: ${(fetchError as Error).message}`);
      }

      // Create a direct link to the file
      const link = document.createElement("a")
      link.href = file.path
      link.setAttribute("download", file.name)
      link.setAttribute("target", "_blank")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Download Started",
        description: `Downloading ${file.name}`,
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Download Error",
        description: `Failed to download ${file.name}: ${(error as Error).message}`,
        variant: "destructive",
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      {files.length === 0 && !isProcessing ? (
        <div className="text-center py-12 border-2 border-dashed rounded-md">
          <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No processed files yet</h3>
          <p className="mt-1 text-sm text-gray-500">Process some PDF files to see them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file, index) => (
            <Card key={index} className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileCheck className="h-5 w-5 text-green-500" />
                <span className="truncate max-w-[300px]">{file.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => handleDownload(file)}
                disabled={downloading === file.name}
              >
                <Download className="h-4 w-4" />
                {downloading === file.name ? "Downloading..." : "Download"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
