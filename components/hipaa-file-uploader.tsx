"use client"

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { OCRProcessingStatus } from "./hipaa-ocr-status";
import { 
  Shield, 
  Upload, 
  FileText, 
  Lock, 
  Clock, 
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  Download,
  Archive
} from "lucide-react";
import { useDropzone } from "react-dropzone";

interface ProcessedFile {
  fileName: string;
  success: boolean;
  averageConfidence?: number;
  processId?: string;
  downloadToken?: string;
  pages?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  downloadUrl?: string;
  zipDownloadUrl?: string;
  error?: string;
}

interface HIPAAFileUploaderProps {
  onFilesProcessed: (results: ProcessedFile[]) => void;
  className?: string;
}

export function HIPAAFileUploader({ onFilesProcessed, className }: HIPAAFileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // OCR Options
  const [options, setOptions] = useState({
    language: 'eng',
    confidenceThreshold: 85,
    usePreprocessing: true,
    useMultiEngine: true,
    autoDelete: true,
    retentionHours: 24
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Validate file types and sizes
    const validFiles = acceptedFiles.filter(file => {
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'].includes(file.type);
      const isValidSize = file.size <= 100 * 1024 * 1024; // 100MB limit
      
      if (!isValidType) {
        setError(`${file.name}: Unsupported file type. Please use PDF, JPEG, PNG, or TIFF files.`);
        return false;
      }
      
      if (!isValidSize) {
        setError(`${file.name}: File too large. Maximum size is 100MB.`);
        return false;
      }
      
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif']
    },
    maxSize: 100 * 1024 * 1024 // 100MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) {
      setError("Please select files to process");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      
      // Append all files with the correct field name 'files'
      files.forEach(file => {
        formData.append('files', file);
      });

      // Add options
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });

      const response = await fetch('/api/hipaa-ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const result = await response.json();

      if (result.success && result.results) {
        // Process the results array from the API
        const newProcessedFiles: ProcessedFile[] = result.results.map((fileResult: any, index: number) => ({
          fileName: fileResult.fileName,
          success: fileResult.success,
          processId: `${Date.now()}-${index}`, // Generate a simple process ID
          downloadToken: undefined, // No token needed for immediate processing
          averageConfidence: fileResult.confidence,
          downloadUrl: fileResult.downloadUrl, // Use the URL provided by the API
          zipDownloadUrl: undefined, // Will be set if available
          error: fileResult.error,
          pages: fileResult.text ? [{
            pageNumber: 1,
            text: fileResult.text,
            confidence: fileResult.confidence || 0
          }] : undefined
        }));

        setProcessedFiles(prev => [...prev, ...newProcessedFiles]);
        onFilesProcessed([...processedFiles, ...newProcessedFiles]);

        // Show success toast for successfully processed files
        const successfulFiles = newProcessedFiles.filter(f => f.success);
        if (successfulFiles.length > 0) {
          toast({
            title: 'Files Processed Successfully',
            description: `${successfulFiles.length} file(s) processed successfully`,
            variant: 'default',
          });
        }

        // Show error toast for failed files
        const failedFiles = newProcessedFiles.filter(f => !f.success);
        if (failedFiles.length > 0) {
          toast({
            title: 'Some Files Failed',
            description: `${failedFiles.length} file(s) failed to process`,
            variant: 'error',
          });
        }
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      toast({
        title: 'Processing Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'error',
      });
    } finally {
      // Clear files after processing attempt
      setFiles([]);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <Lock className="h-4 w-4 text-green-600" />
            <div>
              <CardTitle>HIPAA-Compliant OCR Processing</CardTitle>
              <CardDescription>
                Secure, encrypted processing with automatic audit logging
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragActive
                  ? 'Drop files here...'
                  : 'Drag & drop files here, or click to browse'}
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, JPEG, PNG, and TIFF files (max 100MB each)
              </p>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Selected Files ({files.length})</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm truncate max-w-xs">{file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="col-span-full font-medium">Processing Options</h3>
            
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={options.language}
                onChange={(e) => setOptions(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                <option value="eng">English</option>
                <option value="spa">Spanish</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
                <option value="ita">Italian</option>
                <option value="por">Portuguese</option>
                <option value="chi_sim">Chinese (Simplified)</option>
                <option value="jpn">Japanese</option>
                <option value="kor">Korean</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Threshold: {options.confidenceThreshold}%</Label>
              <Input
                id="confidence"
                type="range"
                min="0"
                max="100"
                value={options.confidenceThreshold}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  confidenceThreshold: parseInt(e.target.value) 
                }))}
                disabled={isProcessing}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="preprocessing"
                checked={options.usePreprocessing}
                onCheckedChange={(checked) => setOptions(prev => ({ 
                  ...prev, 
                  usePreprocessing: checked 
                }))}
                disabled={isProcessing}
              />
              <Label htmlFor="preprocessing">Enhanced Preprocessing</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="multiengine"
                checked={options.useMultiEngine}
                onCheckedChange={(checked) => setOptions(prev => ({ 
                  ...prev, 
                  useMultiEngine: checked 
                }))}
                disabled={isProcessing}
              />
              <Label htmlFor="multiengine">Multi-Engine Processing</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="autodelete"
                checked={options.autoDelete}
                onCheckedChange={(checked) => setOptions(prev => ({ 
                  ...prev, 
                  autoDelete: checked 
                }))}
                disabled={isProcessing}
              />
              <Label htmlFor="autodelete">Auto-Delete Files</Label>
            </div>

            {options.autoDelete && (
              <div className="space-y-2">
                <Label htmlFor="retention">Retention Hours: {options.retentionHours}h</Label>
                <Input
                  id="retention"
                  type="range"
                  min="1"
                  max="168" // 7 days
                  value={options.retentionHours}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    retentionHours: parseInt(e.target.value) 
                  }))}
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing files...</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Process Button */}
          <Button
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Process Files Securely
              </>
            )}
          </Button>

          {/* HIPAA Compliance Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800 space-y-1">
                <p><strong>HIPAA Compliance Features:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>End-to-end encryption in transit and at rest</li>
                  <li>Comprehensive audit logging of all access</li>
                  <li>Automatic file deletion after processing</li>
                  <li>Access control and user authentication</li>
                  <li>Data integrity verification</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {processedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Processing Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processedFiles.map((file, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{file.fileName}</span>
                      <Badge variant={file.success ? "default" : "destructive"}>
                        {file.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    {file.success && file.downloadUrl && (
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Results
                      </Button>
                    )}
                  </div>
                  
                  {file.success && file.averageConfidence && (
                    <div className="text-sm text-gray-600">
                      Average Confidence: {file.averageConfidence.toFixed(1)}%
                      {file.pages && ` • ${file.pages.length} pages processed`}
                    </div>
                  )}
                  
                  {!file.success && file.error && (
                    <div className="text-sm text-red-600">
                      Error: {file.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
