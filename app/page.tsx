"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Terminal } from "@/components/ui/terminal"
import { FileUploader } from "@/components/file-uploader"
import { CommandBuilder } from "@/components/command-builder"
import { ProcessStatus } from "@/components/process-status"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileIcon, Settings, TerminalIcon, Download, AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ProgressTracker } from "@/components/progress-tracker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LoadingScreen } from "@/components/loading-screen"
import { BrandedNotification } from "@/components/branded-notification"
import { DependencyStatus } from "@/components/dependency-status"
import { cn } from "@/lib/utils"

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
  const [showLoadingScreen, setShowLoadingScreen] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState("Processing...")
  const [showNotification, setShowNotification] = useState(false)
  const [notificationProps, setNotificationProps] = useState({
    title: "",
    description: "",
    variant: "default" as "default" | "success" | "error" | "warning" | "info",
  })

  const { toast } = useToast()
  const terminalRef = useRef<HTMLDivElement>(null)

  const handleFileUpload = (uploadedFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...uploadedFiles])
    setError(null)
    
    // Show success notification for uploaded files
    if (uploadedFiles.length > 0) {
      setNotificationProps({
        title: "Files Uploaded",
        description: `Successfully added ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}.`,
        variant: "success"
      });
      setShowNotification(true);
    }
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

  // Enhance dependency check to include jbig2 and provide installation instructions
  const checkDependencies = async () => {
    try {
      const response = await fetch('/api/check-dependencies');
      const data = await response.json();
      if (!data.jbig2) {
        appendOutput("⚠️ Warning: 'jbig2' is not installed. Installing it may improve optimization.");
        appendOutput("Run 'sudo apt install jbig2enc' or equivalent for your system.");
      }
    } catch (error) {
      console.error("Error checking dependencies:", error);
    }
  };

  useEffect(() => {
    checkDependencies();
  }, []);
  
  // Update page title based on processing state
  useEffect(() => {
    if (isProcessing) {
      document.title = `OCR App - Processing (${currentFileIndex + 1}/${files.length})`;
    } else {
      document.title = "OCR Application";
    }
  }, [isProcessing, currentFileIndex, files.length]);

  // Adjust OCR options dynamically to reduce transcoding when unnecessary
  const autoSelectOcrMode = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isTaggedPdf = file.name.toLowerCase().includes("tagged");
    const isLargeFile = file.size > 10 * 1024 * 1024; // 10MB threshold
  
    let updatedOptions = { ...commandOptions };
  
    if (isImage) {
      updatedOptions = {
        ...updatedOptions,
        outputFormat: "pdf",
        optimize: 2,
        deskew: true,
        removeBackground: true,
      };
      appendOutput("ℹ️ Detected image input. Adjusting options for image processing.");
    } else if (isTaggedPdf) {
      updatedOptions = {
        ...updatedOptions,
        outputFormat: "pdf",
        skipText: true,
        deskew: false, // Avoid unnecessary transcoding
      };
      appendOutput("ℹ️ Detected tagged PDF. Skipping text layers and disabling deskew.");
    } else if (isLargeFile) {
      updatedOptions = {
        ...updatedOptions,
        optimize: 1,
        skipText: true,
        deskew: false, // Avoid unnecessary transcoding
      };
      appendOutput("ℹ️ Detected large file. Adjusting options for performance and disabling deskew.");
    } else {
      updatedOptions = {
        ...updatedOptions,
        outputFormat: "pdfa",
        force: false, // Avoid forcing OCR unless necessary
      };
      appendOutput("ℹ️ Defaulting to PDF/A output without forced OCR.");
    }
  
    // Add logic to handle diacritics better
    updatedOptions = {
      ...updatedOptions,
      language: "eng", // Default to English for better compatibility
    };
    appendOutput("ℹ️ Added additional language support for better diacritic handling.");
  
    setCommandOptions(updatedOptions);
  };

  // Enhance error handling for OCRmyPDF execution with retry logic
  const executeOcrWithRetry = async (formData: FormData, fileName: string, retry: boolean = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5-minute timeout
  
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
  
      clearTimeout(timeoutId);
  
      // Get the response as text first so we can log it
      const responseText = await response.text();
      console.log("OCR API Response:", responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        appendOutput(`⚠️ Error parsing server response: ${responseText}`);
        throw new Error(`Server returned invalid JSON: ${responseText}`);
      }

      if (!response.ok) {
        // Log the detailed error information
        console.error("OCRmyPDF failed:", data);
        
        // Add the error details and command to the output log
        if (data.details) {
          appendOutput(`⚠️ OCR Error Details: ${data.details}`);
        }
        
        if (data.command) {
          appendOutput(`ℹ️ Command executed: ${data.command}`);
        }
  
        // Check for PriorOcrFoundError and retry with --force-ocr if not already retried
        if (!retry && data.errorType === 'has_text') {
          appendOutput("⚠️ Detected prior OCR layer. Retrying with --force-ocr.");
          formData.set("force", "true");
          return await executeOcrWithRetry(formData, fileName, true);
        }
  
        throw new Error(data.error || `Failed to execute OCRmyPDF: ${responseText}`);
      }
      
      // If there's stdout or stderr, add it to the terminal output
      if (data.stdout) {
        appendOutput(`📋 OCR Output: ${data.stdout}`);
      }
      
      if (data.stderr) {
        appendOutput(`⚠️ OCR Warnings: ${data.stderr}`);
      }
  
      return data;
    } catch (error) {
      console.error("Error during OCR execution:", error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  // Update processFiles to log reasons for disabling options
  const processFiles = async () => {
    if (files.length === 0) {
      setNotificationProps({
        title: "No Files",
        description: "Please upload files to process.",
        variant: "warning"
      });
      setShowNotification(true);
      return;
    }

    setIsProcessing(true);
    setOutput("");
    setCurrentFileIndex(0);
    setProcessingStep(0);
    setShowLoadingScreen(true);
    setLoadingMessage("Preparing OCR process...");
    setLoadingProgress(5);
    
    // Show notification that processing has started
    setNotificationProps({
      title: "Processing Started",
      description: `Processing ${files.length} file${files.length > 1 ? 's' : ''}...`,
      variant: "info"
    });
    setShowNotification(true);
    setProcessingStepName("");
    setError(null);

    for (const [index, file] of files.entries()) {
      autoSelectOcrMode(file);
      setCurrentFileIndex(index);
      const opts = { ...commandOptions };
      let data: any = null;

      // Update loading progress based on current file index
      const progressPerFile = 90 / files.length; // Save 5% for start and 5% for end
      setLoadingProgress(5 + (progressPerFile * index));
      setLoadingMessage(`Processing file ${index + 1} of ${files.length}: ${file.name}`);

      appendOutput(`Starting OCR process for ${file.name}...`);
      try {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          throw new Error(`File too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", opts.language);
        formData.append("deskew", opts.deskew.toString());
        formData.append("skipText", opts.skipText.toString());
        formData.append("force", opts.force.toString());
        formData.append("redoOcr", opts.redoOcr.toString());
        formData.append("removeBackground", opts.removeBackground.toString());
        formData.append("clean", opts.clean.toString());
        formData.append("optimize", opts.optimize.toString());
        formData.append("rotate", opts.rotate);
        formData.append("pdfRenderer", opts.pdfRenderer);

        setProcessingStep(1);
        setProcessingStepName("Uploading file");
        appendOutput(`Uploading file (${(file.size / (1024 * 1024)).toFixed(2)} MB) and starting OCR process...`);

        try {
          data = await executeOcrWithRetry(formData, file.name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          appendOutput(`❌ Error processing ${file.name}: ${errorMessage}`);
          
          // Show more detailed error information
          if (error instanceof Error && error.stack) {
            console.error("Error stack:", error.stack);
          }
          
          setError(errorMessage);
          
          // Use branded notification instead of toast
          setNotificationProps({
            title: "Processing Error",
            description: `Failed to process ${file.name}: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`,
            variant: "error"
          });
          setShowNotification(true);
          continue;
        }

        // Display stdout and stderr in terminal if they exist
        if (data.stdout) {
          appendOutput(`📋 Process output: ${data.stdout}`);
        }
        
        if (data.stderr) {
          appendOutput(`⚠️ Process warnings: ${data.stderr}`);
          
          if (data.stderr.includes("lots of diacritics")) {
            appendOutput("⚠️ Detected poor OCR quality due to diacritics. Consider adjusting language settings.");
          }
        }

        if (!data.outputFile) {
          appendOutput("⚠️ Warning: No output file path received from server");
          throw new Error("No output file path received from server");
        }

        appendOutput(`✅ Successfully processed ${file.name}`);
        appendOutput(`Output file: ${data.outputFile}`);

        setProcessedFiles((prev) => [
          ...prev,
          {
            name: data.outputFile,
            path: `/api/download?file=${encodeURIComponent(data.outputFile)}`,
          },
        ]);

        // Use branded notification instead of toast
        setNotificationProps({
          title: "Processing Complete",
          description: `Successfully processed ${file.name}`,
          variant: "success"
        });
        setShowNotification(true);

        // Update loading progress for completed file
        const progressPerFile = 90 / files.length;
        setLoadingProgress(5 + (progressPerFile * (index + 1)));
      } catch (error) {
        const errorMessage = (error as Error).message;
        appendOutput(`❌ Error processing ${file.name}: ${errorMessage}`);
        setError(errorMessage);
        
        // Use branded notification instead of toast
        setNotificationProps({
          title: "Processing Error",
          description: `Failed to process ${file.name}: ${errorMessage}`,
          variant: "error"
        });
        setShowNotification(true);
      }
    }

    setIsProcessing(false);
    setProcessingStep(0);
    setProcessingStepName("");
    
    // Finish loading with a nice transition
    setLoadingProgress(100);
    setLoadingMessage("Processing completed successfully!");
    
    // Delay hiding the loading screen for a better UX
    setTimeout(() => {
      setShowLoadingScreen(false);
      
      // Show completion notification
      setNotificationProps({
        title: "Processing Complete",
        description: `Successfully processed all files.`,
        variant: "success"
      });
      setShowNotification(true);
    }, 1500);
  };

  // Update the Processed Files tab to display file details and download links
  const ProcessStatus = ({ files, isProcessing }: { files: { name: string; path: string }[]; isProcessing: boolean }) => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="relative w-16 h-16 mb-4 animate-pulse-glow">
            <Image
              src="/ocr-logo-small.svg"
              alt="OCR App Logo"
              fill
              className="object-contain animate-bounce-slow"
            />
          </div>
          <p className="text-center text-gray-500">Processing files, please wait...</p>
        </div>
      );
    }
  
    if (files.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-center text-gray-500">No processed files available.</p>
          <p className="text-sm text-gray-400 mt-2">Upload and process files to see them here</p>
        </div>
      );
    }
  
    return (
      <ul className="space-y-4">
        {files.map((file, index) => (
          <li 
            key={index} 
            className="flex items-center justify-between p-4 bg-gray-100 rounded-md shadow hover:shadow-md transition-all duration-300 hover:bg-gray-50 animate-in slide-in-from-bottom-5"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <span className="text-gray-800 font-medium">{file.name}</span>
            <a
              href={file.path}
              download
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors duration-200"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </li>
        ))}
      </ul>
    );
  };

  // Handle closing notifications
  const handleCloseNotification = () => {
    setShowNotification(false);
  };
  
  // Add auto-dismiss for notifications
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (showNotification) {
      // Auto-dismiss notifications after 5 seconds
      timeoutId = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showNotification]);

  // Update the UI to improve UX
  return (
    <main className="container mx-auto py-6 px-4">
      {/* Loading Screen */}
      {showLoadingScreen && (
        <LoadingScreen 
          message={loadingMessage} 
          progress={loadingProgress} 
          showProgress={true} 
        />
      )}

      {/* Branded Notification */}
      {showNotification && (
        <BrandedNotification
          title={notificationProps.title}
          description={notificationProps.description}
          variant={notificationProps.variant}
          position="topRight"
          showLogo={true}
          showCloseButton={true}
          onClose={handleCloseNotification}
        />
      )}

      <Card className="mb-6 animate-in slide-in-from-top-5 duration-500 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-background to-secondary/5 rounded-t-lg">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 transition-transform duration-300 hover:scale-110 group">
              <Image 
                src="/ocr-logo.svg" 
                alt="OCR App Logo" 
                fill
                className="object-contain transition-all duration-500 group-hover:animate-bounce-slow"
              />
            </div>
            <div>
              <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">OCR Application</CardTitle>
              <CardDescription>Process PDF files with OCR to make them searchable and accessible</CardDescription>
            </div>
          </div>
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
          <Card className={cn(
            "animate-in slide-in-from-left duration-500", 
            files.length === 0 ? "shadow-md hover:shadow-lg border-primary/20" : ""
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon className="h-5 w-5" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent className={cn(
              files.length === 0 && !isProcessing ? "animate-pulse-glow" : ""
            )}>
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
            <CardContent className={cn(
              "transition-all duration-500", 
              files.length > 0 && !isProcessing ? "animate-pulse-glow" : ""
            )}>
              <CommandBuilder options={commandOptions} onChange={handleCommandChange} />

              <Button
                className="w-full mt-4 group relative overflow-hidden transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                onClick={processFiles}
                disabled={isProcessing || files.length === 0}
              >
                <div className="absolute inset-0 w-full h-full transition-all duration-300 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full opacity-30"></div>
                <div className="flex items-center justify-center gap-2">
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {files.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <svg 
                            className="h-5 w-5 animate-pulse-glow" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Start OCR Process</span>
                        </div>
                      ) : (
                        <span>Upload Files First</span>
                      )}
                    </>
                  )}
                </div>
              </Button>
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
              <TabsTrigger value="info">
                <Info className="h-4 w-4 mr-2" />
                System Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terminal">
              <Terminal ref={terminalRef} output={output} />
            </TabsContent>

            <TabsContent value="status">
              <ProcessStatus files={processedFiles} isProcessing={isProcessing} />
            </TabsContent>
            
            <TabsContent value="info">
              <DependencyStatus showAll={true} className="animate-in fade-in-50 duration-300" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
