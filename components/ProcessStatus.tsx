import React from 'react';

// Helper function to infer output filename
const inferOutputFileName = (inputFileName: string): string => {
  if (!inputFileName) return '';
  
  // Remove .pdf extension
  const baseName = inputFileName.replace(/\.pdf$/i, '');
  
  // Create sanitized filename with timestamp
  const timestamp = Date.now();
  const sanitized = baseName
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 100);
  
  return `${sanitized}_${timestamp}_ocr.pdf`;
};

export interface ProcessStatusProps {
  processing: boolean;
  error: string | null;
  file: {
    name: string;
    path?: string;
  } | null;
}

export function ProcessStatus({ processing, error, file }: ProcessStatusProps) {
  const handleDownload = (file: { name: string; path?: string }) => {
    if (!file.path) {
      console.warn("Missing output file path, inferring from input name");
      // Try to infer output path based on input name
      const inferredPath = inferOutputFileName(file.name);
      file = { ...file, path: inferredPath };
    }
    
    // Ensure path is defined before using it
    if (!file.path) {
      console.error("Cannot download file: path is undefined");
      return;
    }
    
    // Download the file from the server
    window.open(`/api/download?file=${encodeURIComponent(file.path)}`, "_blank");
  };

  return (
    <div className="process-status">
      {processing && (
        <div className="flex items-center gap-2 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-blue-800 font-medium">
            Processing {file?.name}...
          </span>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium mb-2">Error occurred:</div>
          <div className="text-red-700">{error}</div>
          {file && (
            <div className="mt-3">
              <div className="text-sm text-red-600 mb-2">
                A fallback file may be available for download
              </div>
              <button 
                onClick={() => file && handleDownload(file)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Download Result
              </button>
            </div>
          )}
        </div>
      )}
      
      {!processing && !error && file && file.path && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 font-medium mb-3">
            Successfully processed {file.name}
          </div>
          <button
            onClick={() => handleDownload(file)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            Download Processed File
          </button>
        </div>
      )}
    </div>
  );
}
