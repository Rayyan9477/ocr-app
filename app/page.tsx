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

const MAX_FILE_SIZE_MB = 100; // Maximum file size in MB

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
    if (files.length === 0) {
      toast({ title: "No Files", description: "Please upload files to process.", variant: "warning" })
      return
    }

    setIsProcessing(true)
    setOutput("")
    setCurrentFileIndex(0)
    setProcessingStep(0)
    setProcessingStepName("")
    setError(null)

    for (const [index, file] of files.entries()) {
      setCurrentFileIndex(index)
      const opts = { ...commandOptions }
      let data: any = null

      appendOutput(`Starting OCR process for ${file.name}...`)
      try {
        // Validate file size before uploading
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { // 100MB limit
          throw new Error(`File too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        }

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
        appendOutput(`Uploading file (${(file.size / (1024 * 1024)).toFixed(2)} MB) and starting OCR process...`)

        // Set up fetch with timeout and better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5-minute timeout

        try {
          const response = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          // Handle responses
          const contentType = response.headers.get("content-type");

          // Create a clone of the response for reading the text
          const responseClone = response.clone();

          // Get response text for better error reporting
          let responseText;
          try {
            responseText = await responseClone.text();
            // If response text is too long, truncate it for display
            const displayText = responseText.length > 500
              ? responseText.substring(0, 500) + "... [truncated]"
              : responseText;

            // Log the full response for debugging
            console.log("Full response text:", responseText);
            console.log("Response headers:", Object.fromEntries([...response.headers.entries()]));

            // Check if the response is JSON
            if (!contentType || !contentType.includes("application/json")) {
              appendOutput(`Server returned non-JSON response with status ${response.status}`);
              appendOutput(`Content-Type: ${contentType || "not specified"}`);

              // Try to parse the response as JSON anyway, in case the Content-Type header is wrong
              try {
                data = JSON.parse(responseText);
                appendOutput("Successfully parsed response as JSON despite incorrect Content-Type");
              } catch (jsonError) {
                // If it's a 400 error, it might be a validation error
                if (response.status === 400) {
                  appendOutput("Validation error occurred. Check file format and options.");
                  // Try to extract error message from text if possible
                  const errorMatch = responseText.match(/error["\s:]+([^"]+)/i);
                  if (errorMatch && errorMatch[1]) {
                    throw new Error(`Validation error: ${errorMatch[1]}`);
                  }
                }

                // If it's a 500 error, suggest retrying with force OCR
                if (response.status === 500) {
                  appendOutput("Server error occurred. Retrying with Force OCR enabled...");
                  setCommandOptions((prev) => ({ ...prev, force: true }));
                  throw new Error(`Server error (500). Retrying with Force OCR. Details: ${displayText}`);
                }

                // Not JSON, throw an error with the response text
                console.error("Failed to parse response as JSON:", jsonError);
                throw new Error(`Server returned non-JSON response: ${displayText}`);
              }
            } else {
              // Response is JSON
              try {
                data = JSON.parse(responseText);
              } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                throw new Error(`Failed to parse JSON response: ${displayText}`);
              }
            }
          } catch (error) {
            const textError = error as Error;
            console.error("Error reading response text:", textError);
            appendOutput(`Error reading server response: ${textError.message}`);
            throw new Error(`Could not read server response: ${textError.message}`);
          }

          if (!response.ok) {
            if (data.errorType === "tagged_pdf" || data.errorType === "has_text") {
              setCommandOptions((prev) => ({ ...prev, force: true }))
              appendOutput(`⚡ Retrying with "Force OCR" enabled`)
              continue
            }
            throw new Error(data.error || response.statusText)
          }
        } catch (error) {
          const fetchError = error as any;
          if (fetchError.name === 'AbortError') {
            throw new Error('Upload timed out after 5 minutes. The file may be too large or the server is busy.');
          }
          throw error;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        appendOutput(`❌ Error processing ${file.name}: ${msg}`)
        setError(msg)
        toast({ title: "Processing Error", description: `Failed to process ${file.name}: ${msg}`, variant: "destructive" })
        continue
      }

      try {
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

        // Log the full response data for debugging
        console.log("OCR API Response:", data);

        if (!data || !data.success) {
          throw new Error("OCR process did not return a successful response");
        }

        if (data.stdout) {
          appendOutput("OCR Process Output:")
          appendOutput(data.stdout)
        }

        if (data.stderr && data.stderr.trim() !== "") {
          appendOutput("Warnings/Errors:")

          // Check for jbig2 warning in stderr
          if (data.stderr.includes("The program 'jbig2' could not be executed")) {
            appendOutput(`⚠️ Warning: jbig2 program not found. PDF optimization may be limited.`);
            appendOutput(`This is not critical and your PDF has been processed successfully.`);

            // Filter out the jbig2 warning from the stderr output to reduce noise
            const filteredStderr = data.stderr
              .split('\n')
              .filter((line: string) => !line.includes('jbig2') && !line.includes('aptitude') && !line.includes('dnf install'))
              .join('\n');

            if (filteredStderr.trim() !== "") {
              appendOutput(filteredStderr);
            }
          } else {
            appendOutput(data.stderr);
          }
        }

        // Check for tagged PDF warning
        if (data.stderr && data.stderr.includes("This PDF is marked as a Tagged PDF")) {
          appendOutput(`ℹ️ Note: This PDF was marked as a Tagged PDF. OCR has been applied anyway.`);
        }

        // Verify that we have an output file path
        if (!data.outputFile) {
          appendOutput("⚠️ Warning: No output file path received from server");
          throw new Error("No output file path received from server");
        }

        appendOutput(`✅ Successfully processed ${file.name}`)
        appendOutput(`Output file: ${data.outputFile}`)

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

              <div className="space-y-2 mt-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={async () => {
                    try {
                      appendOutput("Checking system status...");
                      const response = await fetch("/api/status");
                      const data = await response.json();
                      appendOutput("System Status:");
                      appendOutput(JSON.stringify(data, null, 2));

                      // Check for common issues
                      if (!data.system.ocrmypdf.version || data.system.ocrmypdf.version === "Not available") {
                        appendOutput("⚠️ OCRmyPDF is not installed or not in PATH");
                      }

                      if (!data.system.ocrmypdf.jbig2.available) {
                        appendOutput("⚠️ jbig2 is not available - PDF optimization will be limited");
                      }

                      if (!data.system.directories.uploads.exists || !data.system.directories.uploads.writable) {
                        appendOutput("⚠️ Uploads directory is not available or not writable");
                      }

                      if (!data.system.directories.processed.exists || !data.system.directories.processed.writable) {
                        appendOutput("⚠️ Processed directory is not available or not writable");
                      }
                    } catch (error) {
                      appendOutput(`❌ Error checking status: ${(error as Error).message}`);
                    }
                  }}
                >
                  Check System Status
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={async () => {
                    try {
                      appendOutput("Checking file system...");
                      const response = await fetch("/api/debug");
                      const data = await response.json();
                      appendOutput("File System Debug Info:");
                      appendOutput(JSON.stringify(data, null, 2));

                      // Check for processed files
                      if (data.directories.processed.files.length > 0) {
                        appendOutput(`Found ${data.directories.processed.files.length} processed files:`);
                        data.directories.processed.files.forEach((file: any) => {
                          appendOutput(`- ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

                          // Add to processed files list if not already there
                          setProcessedFiles((prev) => {
                            const exists = prev.some(f => f.name === file.name);
                            if (!exists) {
                              return [...prev, {
                                name: file.name,
                                path: `/api/download?file=${encodeURIComponent(file.name)}`,
                              }];
                            }
                            return prev;
                          });
                        });
                      } else {
                        appendOutput("No processed files found.");
                      }
                    } catch (error) {
                      appendOutput(`❌ Error checking file system: ${(error as Error).message}`);
                    }
                  }}
                >
                  Check File System
                </Button>
              </div>

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
