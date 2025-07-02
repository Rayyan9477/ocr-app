'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Download, Archive, Terminal, Shield, Clock, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ProcessingResult {
  fileName: string;
  success: boolean;
  outputFile?: string;
  downloadUrl?: string;
  text?: string;
  confidence?: number;
  processingTime: number;
  error?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

export default function HIPAAOCRProcessor() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('eng');
  const [showLogs, setShowLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Real-time log streaming
  useEffect(() => {
    if (!sessionId || !showLogs) return;

    const eventSource = new EventSource(`/api/hipaa-logs?sessionId=${sessionId}&stream=true`);
    
    eventSource.onmessage = (event) => {
      try {
        const logEntry: LogEntry = JSON.parse(event.data);
        setLogs(prev => {
          // Avoid duplicates
          const exists = prev.some(log => 
            log.timestamp === logEntry.timestamp && log.message === logEntry.message
          );
          if (exists) return prev;
          
          // Keep only last 100 logs
          const newLogs = [...prev, logEntry];
          return newLogs.slice(-100);
        });
      } catch (error) {
        console.error('Error parsing log entry:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Log stream error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, showLogs]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
    setResults([]);
    setError('');
    setLogs([]);
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      setError('Please select files to process');
      return;
    }

    setProcessing(true);
    setError('');
    setResults([]);
    setProgress(0);
    setLogs([]);
    setShowLogs(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('language', language);
      formData.append('noRetention', 'true');
      formData.append('immediateProcessing', 'true');

      const response = await fetch('/api/hipaa-ocr', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setResults(data.results || []);
      setSessionId(data.sessionId);
      setProgress(100);

    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      setError('Download failed');
    }
  };

  const downloadZip = async () => {
    const successfulFiles = results.filter(r => r.success && r.outputFile);
    if (successfulFiles.length === 0) return;

    const fileNames = successfulFiles.map(r => encodeURIComponent(r.outputFile!)).join(',');
    const zipUrl = `/api/hipaa-download/zip?files=${fileNames}&zipName=hipaa-documents.zip`;
    
    await downloadFile(zipUrl, 'hipaa-documents.zip');
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const successCount = results.filter(r => r.success).length;
  const totalFiles = files.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            HIPAA-Compliant OCR Processor
          </CardTitle>
          <CardDescription>
            Secure document processing with no retention policy, real-time logs, and immediate downloads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="font-medium">HIPAA Compliant</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Full audit logging and secure processing</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="font-medium">No Retention</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Files deleted immediately after processing</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Real-time Logs</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Live processing status and logs</p>
            </Card>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload & Process</TabsTrigger>
              <TabsTrigger value="results">Results & Downloads</TabsTrigger>
              <TabsTrigger value="logs">Processing Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="files">Select Files</Label>
                  <Input
                    ref={fileInputRef}
                    id="files"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={handleFileChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="language">OCR Language</Label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="eng">English</option>
                    <option value="spa">Spanish</option>
                    <option value="fra">French</option>
                    <option value="deu">German</option>
                  </select>
                </div>

                {files.length > 0 && (
                  <div>
                    <Label>Selected Files ({files.length})</Label>
                    <div className="mt-2 space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{file.name}</span>
                          <Badge variant="secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleProcess}
                  disabled={processing || files.length === 0}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <FileUp className="w-4 h-4 mr-2 animate-spin" />
                      Processing Files...
                    </>
                  ) : (
                    <>
                      <FileUp className="w-4 h-4 mr-2" />
                      Process Files
                    </>
                  )}
                </Button>

                {processing && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Processing Progress</span>
                      <span className="text-sm">{successCount}/{totalFiles} completed</span>
                    </div>
                    <Progress value={(successCount / Math.max(totalFiles, 1)) * 100} />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {results.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Processing Results</h3>
                    {results.filter(r => r.success).length > 1 && (
                      <Button onClick={downloadZip} variant="outline">
                        <Archive className="w-4 h-4 mr-2" />
                        Download All as ZIP
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <Card key={index} className={`p-4 ${result.success ? 'border-green-200' : 'border-red-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium">{result.fileName}</p>
                              {result.success && (
                                <p className="text-sm text-gray-600">
                                  Confidence: {result.confidence?.toFixed(1)}% | 
                                  Time: {result.processingTime}ms
                                </p>
                              )}
                              {result.error && (
                                <p className="text-sm text-red-600">{result.error}</p>
                              )}
                            </div>
                          </div>
                          
                          {result.success && result.downloadUrl && (
                            <Button
                              onClick={() => downloadFile(result.downloadUrl!, result.outputFile!)}
                              variant="outline"
                              size="sm"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                        
                        {result.text && (
                          <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                            <p className="font-medium mb-1">Extracted Text (Preview):</p>
                            <p className="text-gray-700">{result.text.substring(0, 200)}...</p>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {results.length === 0 && !processing && (
                <Card className="p-8 text-center">
                  <p className="text-gray-500">No results yet. Process some files to see results here.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Real-time Processing Logs</h3>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Terminal className="w-3 h-3" />
                  {logs.length} entries
                </Badge>
              </div>

              <Card className="h-96 overflow-hidden">
                <div 
                  ref={logsContainerRef}
                  className="h-full overflow-y-auto p-4 font-mono text-sm space-y-1"
                >
                  {logs.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No logs yet. Start processing to see real-time logs here.
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 py-1">
                        {getLogIcon(log.level)}
                        <span className="text-xs text-gray-500 min-w-[60px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`flex-1 ${
                          log.level === 'error' ? 'text-red-600' : 
                          log.level === 'warning' ? 'text-yellow-600' :
                          log.level === 'success' ? 'text-green-600' : 
                          'text-gray-700'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
