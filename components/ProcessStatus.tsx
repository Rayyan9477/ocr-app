import React from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';

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
    
    // Download the file from the server
    window.open(`/api/download?file=${encodeURIComponent(file.path)}`, "_blank");
  };

  return (
    <Box>
      {processing && (
        <Box display="flex" alignItems="center" gap={2}>
          <CircularProgress size={24} />
          <Typography>Processing {file?.name}...</Typography>
        </Box>
      )}
      
      {error && (
        <Box color="error.main">
          <Typography variant="body1">{error}</Typography>
          {file && (
            <Box mt={2}>
              <Typography variant="body2">
                A fallback file may be available for download
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => file && handleDownload(file)}
                sx={{ mt: 1 }}
              >
                Download Result
              </Button>
            </Box>
          )}
        </Box>
      )}
      
      {!processing && !error && file && file.path && (
        <Box>
          <Typography variant="body1">
            Successfully processed {file.name}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleDownload(file)}
            sx={{ mt: 2 }}
          >
            Download Processed File
          </Button>
        </Box>
      )}
    </Box>
  );
}
