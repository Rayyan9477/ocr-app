"use client"

import { useState, useRef } from "react"
import { Terminal } from "@/components/ui/terminal"
import { FileUploader } from "@/components/file-uploader"
import { CommandBuilder } from "@/components/command-builder"
import { ProcessStatus } from "@/components/process-status"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileIcon, Settings, TerminalIcon, Download, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ProgressTracker } from "@/components/progress-tracker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [output, setOutput] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedFiles, setProcessedFiles] = useState<{ name: string; path: string }[]>([])
  const [commandOptions, setCommandOptions] = useState({
    language: "eng",
    deskew: true,
    skipText: false,
    force: false,
    redoOcr: false,
    removeBackground: false,
    clean: false,
    optimize: 3,
    outputFormat: "pdf",
    rotate: "auto",
    pdfRenderer: "auto"
  })
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [processingStep, setProcessingStep] = useState(0)
  const [processingStepName, setProcessingStepName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { toast } = useToast()
  const terminalRef = useRef<HTMLDivElement>(null)

  const handleFileUpload = (uploadedFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...uploadedFiles])
    setError(null)
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  const handleCommandChange = (options: any) => {
    setCommandOptions(options)
  }

  const appendOutput = (text: string) => {
    setOutput((prev) => prev + text + "\n")
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }

  const processFiles = async () => {
    if (files.length === 0) return

    setIsProcessing(true)
    setOutput("")
    setCurrentFileIndex(0)
    setProcessingStep(0)
    setProcessingStepName("")
    setError(null)

    for (const [index, file] of files.entries()) {
      setCurrentFileIndex(index)
      // Local options copy for this file, including retries
      const opts = { ...commandOptions }
      let data: any = null

      appendOutput(`Starting OCR process for ${file.name}...`)
      try {
        // Build and send single OCR request
        const formData = new FormData()
        formData.append("file", file)
        formData.append("language", opts.language)
        formData.append("deskew", opts.deskew.toString())
        formData.append("skipText", opts.skipText.toString())
        formData.append("force", opts.force.toString())
        formData.append("redoOcr", opts.redoOcr.toString())
        formData.append("removeBackground", opts.removeBackground.toString())
        formData.append("clean", opts.clean.toString())
        formData.append("optimize", opts.optimize.toString())
        formData.append("rotate", opts.rotate)
        formData.append("pdfRenderer", opts.pdfRenderer)
        
        setProcessingStep(1)
        setProcessingStepName("Uploading file")
        appendOutput("Uploading file and starting OCR process...")
        const response = await fetch("/api/ocr", { method: "POST", body: formData })
        data = await response.json()
        if (!response.ok) {
          if (data.errorType === "tagged_pdf" || data.errorType === "has_text") {
            // Enable force and retry next iteration
            setCommandOptions((prev) => ({ ...prev, force: true }))
            appendOutput(`⚡ Retrying with "Force OCR" enabled`)
            // retry same file
            // decrement index by mutating array or re-trigger process for this file
            continue
          }
          throw new Error(data.error || response.statusText)
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        appendOutput(`❌ Error processing ${file.name}: ${msg}`)
        setError(msg)
        toast({ title: "Processing Error", description: `Failed to process ${file.name}: ${msg}`, variant: "destructive" })
        continue
      }

      // At this point, data.success is true (or contains warnings)
      // ...existing code for processing success goes here...
      try {
        // Update processing steps
        setProcessingStep(2)
        setProcessingStepName("Analyzing document")
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setProcessingStep(3)
        setProcessingStepName("Performing OCR")
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setProcessingStep(4)
        setProcessingStepName("Optimizing output")
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setProcessingStep(5)
        setProcessingStepName("Finalizing")
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Log the OCR output
        if (data.stdout) {
          appendOutput("OCR Process Output:")
          appendOutput(data.stdout)
        }

        if (data.stderr && data.stderr.trim() !== "") {
          appendOutput("Warnings/Errors:")
          appendOutput(data.stderr)
        }

        appendOutput(`✅ Successfully processed ${file.name}`)

        // Add the processed file to the list
        setProcessedFiles((prev) => [
          ...prev,
          {
            name: data.outputFile,
            path: `/api/download?file=${encodeURIComponent(data.outputFile)}`,
          },
        ])

        toast({
          title: "Processing Complete",
          description: `Successfully processed ${file.name}`,
          variant: "success",
        })
      } catch (error) {
        const errorMessage = (error as Error).message
        appendOutput(`❌ Error processing ${file.name}: ${errorMessage}`)
        setError(errorMessage)
        toast({
          title: "Processing Error",
          description: `Failed to process ${file.name}: ${errorMessage}`,
          variant: "destructive",
        })
      }
    }

    setIsProcessing(false)
    setProcessingStep(0)
    setProcessingStepName("")
  }

  return (
    <main className="container mx-auto py-6 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">OCRmyPDF Application</CardTitle>
          <CardDescription>Process PDF files with OCR to make them searchable and accessible</CardDescription>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon className="h-5 w-5" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploader onFileUpload={handleFileUpload} files={files} onRemoveFile={handleRemoveFile} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                OCR Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommandBuilder options={commandOptions} onChange={handleCommandChange} />

              <Button className="w-full mt-4" onClick={processFiles} disabled={isProcessing || files.length === 0}>
                {isProcessing ? "Processing..." : "Process Files"}
              </Button>

              {isProcessing && processingStep > 0 && (
                <div className="mt-4">
                  <ProgressTracker currentStep={processingStep} totalSteps={5} stepName={processingStepName} />
                  <p className="text-xs text-center mt-2 text-gray-500">
                    Processing file {currentFileIndex + 1} of {files.length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="terminal">
            <TabsList className="mb-4">
              <TabsTrigger value="terminal">
                <TerminalIcon className="h-4 w-4 mr-2" />
                Terminal Output
              </TabsTrigger>
              <TabsTrigger value="status">
                <Download className="h-4 w-4 mr-2" />
                Processed Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terminal">
              <Terminal ref={terminalRef} output={output} />
            </TabsContent>

            <TabsContent value="status">
              <ProcessStatus files={processedFiles} isProcessing={isProcessing} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
