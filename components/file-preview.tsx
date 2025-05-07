"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface FilePreviewProps {
  originalFile: File | null
  processedFilePath: string | null
}

export function FilePreview({ originalFile, processedFilePath }: FilePreviewProps) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)

  // Create object URL for the original file when it changes
  useState(() => {
    if (originalFile) {
      const url = URL.createObjectURL(originalFile)
      setOriginalUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  })

  if (!originalFile && !processedFilePath) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={processedFilePath ? "processed" : "original"}>
          <TabsList className="mb-4">
            {originalUrl && <TabsTrigger value="original">Original</TabsTrigger>}
            {processedFilePath && <TabsTrigger value="processed">Processed</TabsTrigger>}
          </TabsList>

          {originalUrl && (
            <TabsContent value="original" className="h-[500px] overflow-auto">
              <iframe src={originalUrl} className="w-full h-full border rounded" title="Original PDF" />
            </TabsContent>
          )}

          {processedFilePath && (
            <TabsContent value="processed" className="h-[500px] overflow-auto">
              <iframe src={processedFilePath} className="w-full h-full border rounded" title="Processed PDF" />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}
