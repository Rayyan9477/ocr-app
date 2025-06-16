/**
 * Client-side utilities for handling large PDF OCR processing
 */

import { safeJsonParse } from './safe-response-handler';
import { ConfidenceData } from './types/ocr-types';
import { normalizeConfidenceData, getConfidenceValue } from './confidence-utils';

/**
 * Interface for OCR response
 */
export interface OcrResponse {
  success: boolean;
  text?: string;
  outputFile?: string;
  error?: string;
  details?: string | Array<any>;
  // Confidence can be a complex object or a simple number
  confidence?: ConfidenceData | number;
  chunksProcessed?: number;
  chunksTotal?: number;
  pagesProcessed?: number;
  fullTextAvailable?: boolean;
  textLength?: number;
  textContentId?: string;
  retrievalEndpoint?: string;
}

/**
 * Process a large PDF file with OCR
 * 
 * @param file The PDF file to process
 * @param options Processing options
 * @returns OCR processing result
 */
export async function processLargePdf(
  file: File, 
  options: {
    documentType?: string;
    chunkedProcessing?: boolean;
    preferredEngine?: string;
    maxRetries?: number;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<OcrResponse> {
  // Set default options
  const {
    documentType = 'general',
    chunkedProcessing = true,
    preferredEngine = '',
    maxRetries = 1,
    onProgress
  } = options;
  
  // Check if file is a PDF
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('File must be a PDF');
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  formData.append('chunkedProcessing', String(chunkedProcessing));
  
  if (preferredEngine) {
    formData.append('engine', preferredEngine);
  }
  
  // Initialize progress tracking
  if (onProgress) {
    onProgress(0);
  }
  
  // Process with retries
  let lastError: Error | null = null;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      // If it's a retry, notify progress
      if (retryCount > 0 && onProgress) {
        onProgress(0.1 * retryCount); // 10% progress for each retry attempt
      }
      
      console.log(`Processing large PDF (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Process the PDF
      const response = await fetch('/api/large-pdf-ocr', {
        method: 'POST',
        body: formData,
      });
      
      // Update progress
      if (onProgress) {
        onProgress(0.5); // 50% progress when we get a response
      }
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      // Try to parse the response
      try {
        // Normal JSON parsing
        const result = await response.json();
        
        // Normalize confidence data if present
        if (result.confidence) {
          result.confidence = normalizeConfidenceData(result.confidence);
        } else {
          // Provide default confidence if missing
          result.confidence = { averageConfidence: 0 };
        }
        
        // Update progress to complete
        if (onProgress) {
          onProgress(1.0);
        }
        
        return result;
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        
        // Try the safe parsing approach
        try {
          const result = await safeJsonParse(response);
          
          // Normalize confidence data if present
          if (result.confidence) {
            result.confidence = normalizeConfidenceData(result.confidence);
          } else {
            // Provide default confidence if missing
            result.confidence = { averageConfidence: 0 };
          }
          
          // Update progress to complete
          if (onProgress) {
            onProgress(1.0);
          }
          
          return result;
        } catch (parseError) {
          // Check if the file was processed despite the parsing error
          const text = await response.text();
          
          // Check if response is very large (which might cause parsing issues)
          if (text.length > 1000000) { // 1MB
            console.warn(`Response is very large (${(text.length/1024/1024).toFixed(2)}MB). This may be causing parsing issues.`);
            
            // Try to extract the output file path using regex
            const outputFileMatch = text.match(/\"outputFile\":\"([^\"]+)\"/);
            if (outputFileMatch && outputFileMatch[1]) {
              console.log(`Successfully extracted output file from response: ${outputFileMatch[1]}`);
              
              // Update progress to complete
              if (onProgress) {
                onProgress(1.0);
              }
              
              return {
                success: true,
                outputFile: outputFileMatch[1],
                text: "Text too large to display - see PDF for full content",
                details: "Processed successfully but response was too large to parse as JSON",
                confidence: { averageConfidence: 0 } // Default confidence when parsing fails
              };
            }
          }
          
          throw new Error('Failed to parse server response');
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${retryCount + 1} failed:`, lastError);
      
      // Increment retry count
      retryCount++;
      
      // If we have more retries, wait before trying again
      if (retryCount <= maxRetries) {
        // Wait longer for each retry
        const waitTime = 2000 * retryCount;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If we're here, all retries failed
  throw lastError || new Error('Processing failed after multiple attempts');
}

/**
 * Checks if a file should be processed as a large PDF
 * 
 * @param file The file to check
 * @returns Boolean indicating if it should be treated as a large PDF
 */
export function isLargePdf(file: File): boolean {
  // Check if it's a PDF
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  
  if (!isPdf) {
    return false;
  }
  
  // Consider PDFs larger than 100MB as large
  const isLargeSize = file.size > 100 * 1024 * 1024; // 100MB
  
  return isLargeSize;
}

/**
 * Retrieve full text content for a large OCR result
 * 
 * @param textContentId The ID of the text content to retrieve
 * @returns The full text content
 */
export async function retrieveFullText(textContentId: string): Promise<string> {
  try {
    const response = await fetch(`/api/ocr-text/${textContentId}`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.text) {
      throw new Error(result.error || 'Failed to retrieve text content');
    }
    
    return result.text;
  } catch (error) {
    console.error('Error retrieving full text:', error);
    throw error;
  }
}
