"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react"

interface ConfidenceInfo {
  averageConfidence: number
  hasLowConfidencePages: boolean
  warningPages: number[]
  errorPages: number[]
  pageCount: number
}

interface FilePreviewProps {
  originalFile: File | null
  processedFilePath: string | null
  confidence?: ConfidenceInfo
}

export function FilePreview({ originalFile, processedFilePath, confidence }: FilePreviewProps) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)

  // Create object URL for the original file when it changes
  useEffect(() => {
    if (!originalFile) {
      setOriginalUrl(null)
      return
    }
    const url = URL.createObjectURL(originalFile)
    setOriginalUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [originalFile])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return "text-green-600"
    if (confidence >= 85) return "text-yellow-600"
    if (confidence >= 70) return "text-orange-600"
    return "text-red-600"
  }

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 95) return "default"
    if (confidence >= 85) return "secondary"
    if (confidence >= 70) return "outline"
    return "destructive"
  }

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 85) return <CheckCircle className="h-4 w-4" />
    if (confidence >= 70) return <AlertTriangle className="h-4 w-4" />
    return <XCircle className="h-4 w-4" />
  }

  if (!originalFile && !processedFilePath) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          File Preview
          {confidence && (
            <div className="flex items-center gap-2">
              {getConfidenceIcon(confidence.averageConfidence)}
              <Badge variant={getConfidenceBadgeVariant(confidence.averageConfidence)}>
                {confidence.averageConfidence.toFixed(1)}% confidence
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Confidence Information Panel */}
        {confidence && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>OCR Confidence</span>
                  <span className={getConfidenceColor(confidence.averageConfidence)}>
                    {confidence.averageConfidence.toFixed(1)}%
                  </span>
                </div>
                <Progress value={confidence.averageConfidence} className="h-2" />
              </div>
              <div className="text-sm text-muted-foreground">
                {confidence.pageCount} page{confidence.pageCount !== 1 ? 's' : ''}
              </div>
            </div>

            {confidence.hasLowConfidencePages && (
              <Alert variant={confidence.errorPages.length > 0 ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Low Confidence Detected</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1">
                    {confidence.errorPages.length > 0 && (
                      <div>
                        <span className="font-medium text-red-600">Error pages (&lt;70%)</span>: {confidence.errorPages.join(', ')}
                      </div>
                    )}
                    {confidence.warningPages.length > 0 && (
                      <div>
                        <span className="font-medium text-orange-600">Warning pages (70-85%)</span>: {confidence.warningPages.join(', ')}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground mt-2">
                      These pages may require manual review for accuracy.
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!confidence.hasLowConfidencePages && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>High Confidence OCR</AlertTitle>
                <AlertDescription>
                  All pages processed with good confidence levels (&gt;85%). The OCR results should be highly accurate.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Tabs defaultValue={processedFilePath ? "processed" : "original"}>
          <TabsList className="mb-4">
            {originalUrl && <TabsTrigger value="original">Original</TabsTrigger>}
            {processedFilePath && <TabsTrigger value="processed">Processed</TabsTrigger>}
            {confidence && <TabsTrigger value="confidence">Confidence Details</TabsTrigger>}
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

          {confidence && (
            <TabsContent value="confidence" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Overall Quality</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-1 flex items-center gap-2">
                      {getConfidenceIcon(confidence.averageConfidence)}
                      <span className={getConfidenceColor(confidence.averageConfidence)}>
                        {confidence.averageConfidence.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Average confidence across all pages
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Page Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Total pages:</span>
                        <Badge variant="outline">{confidence.pageCount}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Good quality:</span>
                        <Badge variant="default">
                          {confidence.pageCount - confidence.warningPages.length - confidence.errorPages.length}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Warnings:</span>
                        <Badge variant="secondary">{confidence.warningPages.length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Errors:</span>
                        <Badge variant="destructive">{confidence.errorPages.length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {confidence.averageConfidence >= 95 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Excellent quality
                        </div>
                      )}
                      {confidence.averageConfidence >= 85 && confidence.averageConfidence < 95 && (
                        <div className="flex items-center gap-2 text-yellow-600">
                          <Info className="h-3 w-3" />
                          Good quality
                        </div>
                      )}
                      {confidence.averageConfidence < 85 && (
                        <div className="flex items-center gap-2 text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          Review recommended
                        </div>
                      )}
                      {confidence.errorPages.length > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-3 w-3" />
                          Manual verification needed
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(confidence.warningPages.length > 0 || confidence.errorPages.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Page-by-Page Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {Array.from({ length: confidence.pageCount }, (_, i) => i + 1).map(pageNum => {
                        const isError = confidence.errorPages.includes(pageNum)
                        const isWarning = confidence.warningPages.includes(pageNum)
                        const variant = isError ? "destructive" : isWarning ? "secondary" : "default"
                        
                        return (
                          <Badge key={pageNum} variant={variant} className="justify-center">
                            Page {pageNum}
                          </Badge>
                        )
                      })}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded"></div>
                          <span>Good (&gt;85%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                          <span>Warning (70-85%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-500 rounded"></div>
                          <span>Error (&lt;70%)</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}
