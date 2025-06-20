"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, FilePlus2, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ExtractablePdfConverter() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({
    preserveLayout: true,
    enhanceOCR: true,
    processAllPages: true,
    addMetadata: true,
    optimizeOutput: true
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setFile(null);
      setError('Please select a valid PDF file');
    }
  };

  const handleOptionChange = (option) => {
    setOptions({
      ...options,
      [option]: !options[option]
    });
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('pdf', file);
    
    // Add all options to the form data
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });

    try {
      // Start progress simulation
      const progressInterval = simulateProgress();

      // Make the API call
      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData
      });

      // Clear progress interval
      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process PDF');
      }

      const data = await response.json();
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred while processing the PDF');
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateProgress = () => {
    // Simulate progress for better UX
    return setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 1000);
  };

  const downloadResult = () => {
    if (result && result.url) {
      window.open(result.url, '_blank');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Make PDF Extractable
        </CardTitle>
        <CardDescription>
          Process a PDF to make text fully extractable while preserving the original appearance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload PDF</TabsTrigger>
            <TabsTrigger value="options">Processing Options</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="pdf-upload">Select PDF File</Label>
                <Input 
                  id="pdf-upload" 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              
              {error && (
                <div className="bg-destructive/10 p-3 rounded-md flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {result && (
                <div className="bg-primary/10 p-3 rounded-md flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <p className="text-sm">PDF processed successfully!</p>
                </div>
              )}
              
              {isProcessing && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Processing PDF...</p>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="options" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="preserve-layout">Preserve Layout</Label>
                  <p className="text-sm text-muted-foreground">Maintain the original document layout</p>
                </div>
                <Switch 
                  id="preserve-layout"
                  checked={options.preserveLayout}
                  onCheckedChange={() => handleOptionChange('preserveLayout')}
                  disabled={isProcessing}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enhance-ocr">Enhanced OCR</Label>
                  <p className="text-sm text-muted-foreground">Use advanced OCR for better accuracy</p>
                </div>
                <Switch 
                  id="enhance-ocr"
                  checked={options.enhanceOCR}
                  onCheckedChange={() => handleOptionChange('enhanceOCR')}
                  disabled={isProcessing}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="process-all">Process All Pages</Label>
                  <p className="text-sm text-muted-foreground">Process all pages in the PDF</p>
                </div>
                <Switch 
                  id="process-all"
                  checked={options.processAllPages}
                  onCheckedChange={() => handleOptionChange('processAllPages')}
                  disabled={isProcessing}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="add-metadata">Add Metadata</Label>
                  <p className="text-sm text-muted-foreground">Add processing metadata to the PDF</p>
                </div>
                <Switch 
                  id="add-metadata"
                  checked={options.addMetadata}
                  onCheckedChange={() => handleOptionChange('addMetadata')}
                  disabled={isProcessing}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="optimize">Optimize Output</Label>
                  <p className="text-sm text-muted-foreground">Optimize file size while maintaining quality</p>
                </div>
                <Switch 
                  id="optimize"
                  checked={options.optimizeOutput}
                  onCheckedChange={() => handleOptionChange('optimizeOutput')}
                  disabled={isProcessing}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => {
            setFile(null);
            setResult(null);
            setError(null);
          }}
          disabled={isProcessing || !file}
        >
          Clear
        </Button>
        <div className="flex gap-2">
          {result && (
            <Button 
              variant="secondary" 
              onClick={downloadResult}
            >
              Download Result
            </Button>
          )}
          <Button 
            onClick={handleProcess} 
            disabled={isProcessing || !file}
            className="flex items-center gap-2"
          >
            {isProcessing ? 'Processing...' : 'Make Extractable'}
            <FilePlus2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default ExtractablePdfConverter;
