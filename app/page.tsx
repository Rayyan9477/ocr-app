"use client"

import { useState, useRef, useEffect } from "react"
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
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OCRmyPDF failed:", errorText);
  
        // Check for PriorOcrFoundError and retry with --force-ocr if not already retried
        if (!retry && errorText.includes("PriorOcrFoundError")) {
          appendOutput("⚠️ Detected prior OCR layer. Retrying with --force-ocr.");
          formData.set("force", "true");
          return await executeOcrWithRetry(formData, fileName, true);
        }
  
        throw new Error(`Failed to execute OCRmyPDF: ${errorText}`);
      }
  
      return await response.json();
    } catch (error) {
      console.error("Error during OCR execution:", error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  // Update processFiles to log reasons for disabling options
  const processFiles = async () => {
    if (files.length === 0) {
      toast({ title: "No Files", description: "Please upload files to process.", variant: "warning" });
      return;
    }

    setIsProcessing(true);
    setOutput("");
    setCurrentFileIndex(0);
    setProcessingStep(0);
    setProcessingStepName("");
    setError(null);

    for (const [index, file] of files.entries()) {
      autoSelectOcrMode(file);
      setCurrentFileIndex(index);
      const opts = { ...commandOptions };
      let data: any = null;

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
          setError(errorMessage);
          toast({
            title: "Processing Error",
            description: `Failed to process ${file.name}: ${errorMessage}`,
            variant: "destructive",
          });
          continue;
        }

        if (data.stderr && data.stderr.includes("lots of diacritics")) {
          appendOutput("⚠️ Detected poor OCR quality due to diacritics. Consider adjusting language settings.");
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

        toast({
          title: "Processing Complete",
          description: `Successfully processed ${file.name}`,
          variant: "success",
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        appendOutput(`❌ Error processing ${file.name}: ${errorMessage}`);
        setError(errorMessage);
        toast({
          title: "Processing Error",
          description: `Failed to process ${file.name}: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }

    setIsProcessing(false);
    setProcessingStep(0);
    setProcessingStepName("");
  };

  // Update the Processed Files tab to display file details and download links
  const ProcessStatus = ({ files, isProcessing }: { files: { name: string; path: string }[]; isProcessing: boolean }) => {
    if (isProcessing) {
      return <p className="text-center text-gray-500">Processing files, please wait...</p>;
    }
  
    if (files.length === 0) {
      return <p className="text-center text-gray-500">No processed files available.</p>;
    }
  
    return (
      <ul className="space-y-4">
        {files.map((file, index) => (
          <li key={index} className="flex items-center justify-between p-4 bg-gray-100 rounded-md shadow">
            <span className="text-gray-800 font-medium">{file.name}</span>
            <a
              href={file.path}
              download
              className="text-blue-600 hover:underline font-medium"
            >
              Download
            </a>
          </li>
        ))}
      </ul>
    );
  };

  // Update the UI to improve UX
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

              <Button
                className="w-full mt-4"
                onClick={processFiles}
                disabled={isProcessing || files.length === 0}
              >
                {isProcessing ? "Processing..." : "Start OCR"}
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
