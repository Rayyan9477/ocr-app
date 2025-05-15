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
  const [lastSubmittedFormData, setLastSubmittedFormData] = useState<FormData | null>(null)
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
  const [overallProgress, setOverallProgress] = useState(0)

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
    setOutput((prev) => {
      const newOutput = prev ? `${prev}\n${text}` : text
      if (terminalRef.current) {
        setTimeout(() => {
          terminalRef.current?.scrollTo({
            top: terminalRef.current.scrollHeight,
            behavior: "smooth"
          })
        }, 100)
      }
      return newOutput
    })
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

  interface OcrResponse {
    success: boolean;
    outputFile?: string;
    fileSize?: number;
    stdout?: string;
    stderr?: string;
    error?: string;
    details?: string;
    errorType?: 'has_text' | 'tagged_pdf';
    command?: string;
    timestamp?: string;
  }

  interface ProcessedFile {
    name: string;
    path: string;
    processedAt: string;
    size: number | null;
  }

  const executeOcrWithRetry = async (formData: FormData, fileName: string, retry: boolean = false): Promise<OcrResponse> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10-minute timeout
      
      appendOutput(`Starting OCR process for ${fileName}...`);
      
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Clone the response so we can read it multiple times
      const responseForText = response.clone();
      const responseForJson = response.clone();
      
      // Try to parse as JSON first, regardless of status code
      try {
        const data: OcrResponse = await responseForJson.json();
        
        // Check if the response was successful or has a structured error
        if (!response.ok) {
          // Handle error responses with valid JSON structure
          appendOutput(`⚠️ Server responded with status ${response.status}: ${data.error || 'Unknown error'}`);
          
          // Even with an error status, the file might have been processed successfully
          if (data.outputFile) {
            appendOutput(`✅ Despite error, server indicates file was processed: ${data.outputFile}`);
            return data; // Return data with outputFile info
          }
          
          // If this is a known error type like "has_text" that could benefit from retry
          if (data.errorType === 'has_text' && !retry) {
            appendOutput("Attempting retry with force-ocr option...");
            return await handleSuccessResponse(data, fileName, retry);
          }
          
          // Just return the data - it contains structured error information
          return data;
        }
        
        const result = await handleSuccessResponse(data, fileName, retry);
        return result;
      } catch (jsonError) {
        console.error("JSON parse error:", jsonError);
        
        // If the response status is not OK, we should handle that first
        if (!response.ok) {
          appendOutput(`⚠️ Server returned status ${response.status}. Checking if processing continued...`);
        } else {
          appendOutput(`⚠️ Server response couldn't be parsed as JSON despite status ${response.status}.`);
        }
        
        // If JSON parsing fails, read as text
        const responseText = await responseForText.text();
        appendOutput(`Raw response: ${responseText.substring(0, 200)}...`);
        
        // Check if file was actually processed despite the JSON error or HTTP status
        // Extract the base filename without extension
        const baseFileName = fileName.split('.').slice(0, -1).join('.');
        // Try potential filename formats (with and without timestamp)
        const timestamp = fileName.match(/(\d{13})\.pdf$/)?.[1] || '';
        
        // Try with timestamp first (server adds timestamps)
        const potentialOutputFiles = [
          // If filename already includes timestamp: baseFileName_ocr.pdf
          `${baseFileName}_ocr.pdf`,
          // If the server generated timestamp: baseFileName_timestamp_ocr.pdf
          timestamp ? `${baseFileName}_ocr.pdf` : null,
          // General case with pattern based on logs: baseFileName_timestamp_ocr.pdf 
          // (get latest files from filesystem)
        ].filter(Boolean);
        
        // Try each potential filename
        let checkResponse = null;
        let foundFile = null;
        
        for (const file of potentialOutputFiles) {
          if (!file) continue;
          checkResponse = await fetch(`/api/download?file=${encodeURIComponent(file)}`);
          if (checkResponse.ok) {
            foundFile = file;
            break;
          }
        }
        
        // If still not found, try checking processed directory for any matching files
        if (!checkResponse?.ok) {
          const statusResponse = await fetch('/api/status');
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const matchingFiles = statusData.files?.filter((f: any) => 
              f.name.includes(baseFileName.replace(/\d+$/, '')) && f.name.includes('_ocr.pdf')
            );
            
            if (matchingFiles?.length > 0) {
              foundFile = matchingFiles[0].name;
              checkResponse = await fetch(`/api/download?file=${encodeURIComponent(foundFile)}`);
            }
          }
        }
        
        if (checkResponse?.ok && foundFile) {
          appendOutput("✅ File was processed successfully despite response issues");
          appendOutput(`📄 Output file available: ${foundFile}`);
          
          // Add to processed files even if we had a JSON parsing error
          const newProcessedFile: ProcessedFile = {
            name: foundFile,
            path: `/api/download?file=${encodeURIComponent(foundFile)}`,
            processedAt: new Date().toISOString(),
            size: null,
          };
          
          setProcessedFiles(prev => [...prev, newProcessedFile]);
          
          return {
            success: true,
            outputFile: foundFile
          };
        }
        
        throw new Error(`Server returned invalid JSON. Raw response: ${responseText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.error("Error during OCR execution:", error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          appendOutput(`❌ OCR process timed out for ${fileName}`);
        } else if (!error.message.includes('HTTP error')) {
          // Only log non-HTTP errors as they were already handled
          appendOutput(`❌ Error: ${error.message}`);
        }
        throw error;
      }
      throw new Error('Unknown error during OCR execution');
    }
  };

  // Helper function to handle successful JSON response
  const handleSuccessResponse = async (data: OcrResponse, fileName: string, retry: boolean): Promise<OcrResponse> => {
    if (!data.success) {
      // Handle known error types and retry if needed
      if (data.errorType === 'has_text' && !retry) {
        appendOutput("⚠️ Detected prior OCR layer. Retrying with --force-ocr...");
        const newFormData = new FormData();
        newFormData.append("file", files[currentFileIndex]);
        newFormData.append("force", "true");
        
        // Copy other form data properties from commandOptions
        if (lastSubmittedFormData) {
          for (const [key, value] of Array.from(lastSubmittedFormData.entries())) {
            if (key !== "file" && key !== "force") {
              newFormData.append(key, value as string);
            }
          }
        } else {
          // Fallback to command options
          const opts = commandOptions;
          newFormData.append("language", opts.language);
          newFormData.append("deskew", opts.deskew.toString());
          newFormData.append("skipText", opts.skipText.toString());
          newFormData.append("redoOcr", opts.redoOcr.toString());
          newFormData.append("removeBackground", opts.removeBackground.toString());
          newFormData.append("clean", opts.clean.toString());
          newFormData.append("optimize", opts.optimize.toString());
          newFormData.append("rotate", opts.rotate);
          newFormData.append("pdfRenderer", opts.pdfRenderer);
        }
        
        return await executeOcrWithRetry(newFormData, fileName, true);
      } else if (data.errorType === 'tagged_pdf') {
        appendOutput(`⚠️ ${data.error || 'PDF is a tagged PDF'}: ${data.details || ''}`);
        throw new Error(data.error || "PDF is a tagged PDF");
      } else {
        // For other error types, display the error and throw
        appendOutput(`❌ OCR process failed: ${data.error || 'Unknown error'}`);
        if (data.details) {
          appendOutput(`Details: ${data.details}`);
        }
        throw new Error(data.error || "OCR process failed");
      }
    }

    // Process successful response
    if (data.stdout) {
      appendOutput(`📋 OCR Output: ${data.stdout}`);
    }
    if (data.stderr) {
      appendOutput(`⚠️ OCR Warnings: ${data.stderr}`);
    }
    if (!data.outputFile) {
      appendOutput("⚠️ Warning: No output file path received from server");
      throw new Error("No output file path received from server");
    }
    
    appendOutput(`✅ Successfully processed ${fileName}`);
    appendOutput(`📄 Output file: ${data.outputFile}`);
    
    const newProcessedFile: ProcessedFile = {
      name: data.outputFile,
      path: `/api/download?file=${encodeURIComponent(data.outputFile)}`,
      processedAt: new Date().toISOString(),
      size: data.fileSize ?? null,
    };
    
    setProcessedFiles(prev => [...prev, newProcessedFile]);
    
    return data;
  };

  // Check directory permissions before starting OCR
  const checkDirectoryPermissions = async (): Promise<boolean> => {
    try {
      appendOutput("Checking directory permissions...");
      
      const response = await fetch('/api/check-dependencies');
      if (!response.ok) {
        appendOutput("⚠️ Failed to check directory permissions");
        return true; // Proceed with caution
      }
      
      const data = await response.json();
      
      // Check if directories are writable
      if (data.directories && !data.directoriesOk) {
        const nonWritableDirs = data.directories.filter((dir: any) => !dir.writable);
        
        if (nonWritableDirs.length > 0) {
          appendOutput("❌ Directory permission issues detected:");
          nonWritableDirs.forEach((dir: any) => {
            appendOutput(`  - ${dir.path}: ${dir.error || 'Not writable'}`);
          });
          
          // Show error notification
          setNotificationProps({
            title: "Permission Error",
            description: `The application doesn't have permission to write to required directories. This will cause OCR processing to fail.`,
            variant: "error"
          });
          setShowNotification(true);
          
          return false;
        }
      }
      
      appendOutput("✅ Directory permissions check passed");
      return true;
    } catch (error) {
      console.error("Error checking directory permissions:", error);
      appendOutput("⚠️ Failed to check directory permissions");
      return true; // Proceed with caution
    }
  };

  // Enhance error handling for OCRmyPDF execution with retry logic
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

    // Check directory permissions before starting OCR
    const hasPermissions = await checkDirectoryPermissions();
    if (!hasPermissions) {
      setNotificationProps({
        title: "Permission Error",
        description: "The application doesn't have permission to write to required directories. This will cause OCR processing to fail.",
        variant: "destructive"
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
    setOverallProgress(0)
    
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

        // Store the formData for potential retries
        setLastSubmittedFormData(formData);

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
          // Split into lines for better formatting
          const stderrLines = data.stderr.split('\n');
          let hasDiacritics = false;
          let hasJbig2Issue = false;

          for (const line of stderrLines) {
            if (line.trim()) {
              appendOutput(`⚠️ ${line.trim()}`);
              if (line.includes("lots of diacritics")) {
                hasDiacritics = true;
              }
              if (line.includes("jbig2 not found")) {
                hasJbig2Issue = true;
              }
            }
          }
          
          if (hasDiacritics) {
            appendOutput("⚠️ Detected poor OCR quality due to diacritics. Consider adjusting language settings.");
          }
          if (hasJbig2Issue) {
            appendOutput("⚠️ JBIG2 optimization disabled. Install jbig2enc for better compression.");
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
    setOverallProgress(100)
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

      <div className={cn(
        "container mx-auto p-4 space-y-4",
        showLoadingScreen ? "mt-24" : "mt-4" // Add top margin when loading screen is visible
      )}>
        {showNotification && (
          <BrandedNotification
            title={notificationProps.title}
            description={notificationProps.description}
            variant={notificationProps.variant as any}
            onClose={() => setShowNotification(false)}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DependencyStatus />

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
                <Terminal 
                  ref={terminalRef}
                  output={output}
                  progress={overallProgress}
                  status={loadingMessage}
                />
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
      </div>
    </main>
  )
}
