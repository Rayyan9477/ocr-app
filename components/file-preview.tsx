"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, CheckCircle, XCircle, Info, RefreshCw, Settings } from "lucide-react"

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
  // Reprocessing state
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [reprocessDialogOpen, setReprocessDialogOpen] = useState(false)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [enhancementMode, setEnhancementMode] = useState<string>("handwritten")
  const [reprocessReason, setReprocessReason] = useState("")
  const { toast } = useToast()

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

  const handleReprocessPages = async () => {
    if (!originalFile || !processedFilePath || selectedPages.length === 0) {
      toast({
        title: "Error",
        description: "Missing required information for reprocessing",
        variant: "error"
      })
      return
    }

    setIsReprocessing(true)
    
    try {
      // Get full file paths for the API
      const originalFilePath = originalFile.webkitRelativePath || originalFile.name
      
      const formData = new FormData()
      formData.append('originalFilePath', originalFilePath)
      formData.append('outputFilePath', processedFilePath)
      formData.append('pageNumbers', JSON.stringify(selectedPages))
      formData.append('enhancementMode', enhancementMode)
      formData.append('reason', reprocessReason)

      const response = await fetch('/api/reprocess-page', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Reprocessing Successful",
          description: `Successfully reprocessed ${selectedPages.length} pages using PaddleOCR`,
        })
        
        // Reset dialog state
        setReprocessDialogOpen(false)
        setSelectedPages([])
        setReprocessReason("")
        
        // Optionally trigger a refresh of the confidence data
        window.location.reload()
        
      } else {
        throw new Error(result.error || 'Reprocessing failed')
      }
    } catch (error) {
      console.error('Reprocessing error:', error)
      toast({
        title: "Reprocessing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "error"
      })
    } finally {
      setIsReprocessing(false)
    }
  }

  const openReprocessDialog = () => {
    // Pre-select low confidence pages
    const lowConfidencePages = [
      ...(confidence?.errorPages || []),
      ...(confidence?.warningPages || [])
    ]
    setSelectedPages(lowConfidencePages)
    setReprocessDialogOpen(true)
  }

  const togglePageSelection = (pageNumber: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber)
        : [...prev, pageNumber]
    )
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
                  <div className="space-y-2">
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
                    <div className="mt-3">
                      <Button 
                        onClick={openReprocessDialog}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reprocess with PaddleOCR
                      </Button>
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

        {/* Reprocess Dialog */}
        <Dialog open={reprocessDialogOpen} onOpenChange={setReprocessDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reprocess Pages with PaddleOCR</DialogTitle>
              <DialogDescription>
                Use advanced PaddleOCR engine to improve recognition accuracy for selected pages.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="enhancement-mode">Enhancement Mode</Label>
                <Select value={enhancementMode} onValueChange={setEnhancementMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handwritten">Handwritten (Specialized for handwritten text)</SelectItem>
                    <SelectItem value="aggressive">Aggressive (Maximum enhancement for poor quality)</SelectItem>
                    <SelectItem value="medical">Medical (Optimized for medical documents)</SelectItem>
                    <SelectItem value="enhanced">Enhanced (Recommended for general use)</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Handwritten mode is optimized for recognizing poor quality handwritten text. Aggressive mode provides maximum enhancement for extremely poor quality documents.
                </p>
              </div>

              <div>
                <Label htmlFor="page-selection">Pages to Reprocess</Label>
                {confidence && (confidence.errorPages.length > 0 || confidence.warningPages.length > 0) && (
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-2">
                      {[...confidence.errorPages, ...confidence.warningPages].sort((a, b) => a - b).map(pageNum => (
                        <Button
                          key={pageNum}
                          variant={selectedPages.includes(pageNum) ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePageSelection(pageNum)}
                          className="h-8"
                        >
                          Page {pageNum}
                          {confidence.errorPages.includes(pageNum) && " ⚠️"}
                        </Button>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click to select/deselect low confidence pages, or manually enter page numbers below.
                    </p>
                  </div>
                )}
                <Textarea
                  id="page-selection"
                  placeholder="Enter page numbers, e.g., 1, 2, 3 or 1-3"
                  value={selectedPages.join(', ')}
                  onChange={(e) => {
                    const value = e.target.value
                    const pages = value.split(',').flatMap(part => {
                      const trimmed = part.trim()
                      if (trimmed.includes('-')) {
                        const range = trimmed.split('-').map(num => parseInt(num.trim(), 10))
                        return range.length === 2 && !isNaN(range[0]) && !isNaN(range[1]) && range[0] <= range[1]
                          ? Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i)
                          : []
                      } else {
                        const num = parseInt(trimmed, 10)
                        return !isNaN(num) ? [num] : []
                      }
                    })
                    setSelectedPages([...new Set(pages)].sort((a, b) => a - b))
                  }}
                  rows={2}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Leave blank to reprocess all pages. Use commas to separate individual pages, and hyphens for ranges.
                </p>
              </div>

              <div>
                <Label htmlFor="reprocess-reason">Reason for Reprocessing (Optional)</Label>
                <Textarea
                  id="reprocess-reason"
                  placeholder="e.g., Low confidence scores, unclear text recognition"
                  value={reprocessReason}
                  onChange={(e) => setReprocessReason(e.target.value)}
                  rows={2}
                />
              </div>

              {selectedPages.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Selected pages:</strong> {selectedPages.join(', ')} 
                    <br />
                    <strong>Enhancement mode:</strong> {enhancementMode}
                    <br />
                    These pages will be reprocessed using PaddleOCR for improved accuracy.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReprocessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReprocessPages}
              disabled={isReprocessing || selectedPages.length === 0}
            >
              {isReprocessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reprocessing...
                </>
              ) : (
                `Reprocess ${selectedPages.length} page${selectedPages.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </Dialog>
      </CardContent>
    </Card>
  )
}
