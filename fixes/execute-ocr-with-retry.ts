/**
 * Fix for app/page.tsx to implement robust JSON response handling
 * 
 * This file contains the modified version of the executeOcrWithRetry function
 * that uses the safeJsonParse utility to handle large or malformed JSON responses.
 */

// Add this import at the top of app/page.tsx
// import { handleOcrResponse } from "@/lib/json-response-helper";

// Replace the executeOcrWithRetry function with this improved version
/*
const executeOcrWithRetry = async (formData: FormData, fileName: string, retry: boolean = false, apiEndpoint: string = "/api/ocr"): Promise<OcrResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10-minute timeout
    
    appendOutput(`Starting OCR process for ${fileName}...`);
    if (apiEndpoint === "/api/smart-ocr") {
      appendOutput("🧠 Using Smart OCR with advanced processing...");
    }
    
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Handle response with our improved parser that can handle large responses
    try {
      // Use our enhanced response handler
      const data = await handleOcrResponse(response);
      
      // Check if the data was extracted from a text response rather than proper JSON
      if (data._extracted) {
        appendOutput(`⚠️ The OCR result text was truncated in the response for performance reasons.`);
        
        if (data.outputFile) {
          appendOutput(`🔗 Download the full OCR result: /api/download?file=${data.outputFile.replace('.pdf', '_result.html')}`);
          appendOutput(`✅ Successfully processed ${fileName}`);
          appendOutput(`📄 Output file: ${data.outputFile}`);
          
          // Add to processed files
          addProcessedFile({
            name: data.outputFile,
            path: `/api/download?file=${encodeURIComponent(data.outputFile)}`,
          });
        }
        
        return data;
      }
      
      // Handle error responses with valid JSON structure
      if (!response.ok) {
        appendOutput(`⚠️ Server responded with status ${response.status}: ${data.error || 'Unknown error'}`);
        
        // Even with an error status, the file might have been processed successfully
        if (data.outputFile) {
          appendOutput(`✅ Despite error, server indicates file was processed: ${data.outputFile}`);
          return data; // Return data with outputFile info
        }

        // If details is an array of engine failures, summarise failures
        if (Array.isArray(data.details)) {
          const summary = data.details.map((d: any) => `${d.engine}: ${d.error}`).join('; ');
          appendOutput(`⚠️ All OCR engines failed: ${summary}`);
          return data;
        }

        // If there's an error about file containing text, retry with force option
        if (typeof data.details === 'string' && data.details.toLowerCase().includes('already contains text') && !retry) {
          appendOutput("Attempting retry with force-ocr option...");
          return await handleSuccessResponse(data, fileName, retry);
        }

        // Just return the data - it contains structured error information
        return data;
      }
      
      // Handle success case
      return await handleSuccessResponse(data, fileName, retry);
    } catch (error) {
      console.error("Error handling OCR response:", error);
      
      // If all parsing fails, try one last approach - check if the file exists anyway
      const baseFileName = fileName.split('.').slice(0, -1).join('.');
      const expectedOutputFile = `${baseFileName}_ocr.pdf`;
      
      try {
        // Check if the file exists despite parsing errors
        const checkResponse = await fetch(`/api/download?file=${encodeURIComponent(expectedOutputFile)}`);
        if (checkResponse.ok) {
          appendOutput(`✅ Found processed file despite response parsing issues: ${expectedOutputFile}`);
          
          // Add to processed files
          addProcessedFile({
            name: expectedOutputFile,
            path: `/api/download?file=${encodeURIComponent(expectedOutputFile)}`,
          });
          
          return {
            success: true,
            outputFile: expectedOutputFile,
            details: "File was processed successfully despite response parsing issues"
          };
        }
      } catch (fileCheckError) {
        console.error("Error checking for output file:", fileCheckError);
      }
      
      // Last resort, check the status API for recent files
      try {
        const statusResponse = await fetch('/api/status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          // Look for recently created files (last 5 minutes) matching our filename pattern
          const recentTime = Date.now() - 5 * 60 * 1000;
          const recentFiles = statusData.files?.filter((f: any) => 
            f.name.includes(baseFileName.replace(/\d+$/, '')) && 
            f.name.includes('_ocr.pdf') && 
            (f.timestamp > recentTime)
          );
          
          if (recentFiles?.length > 0) {
            // Sort by timestamp descending to get most recent
            recentFiles.sort((a: any, b: any) => b.timestamp - a.timestamp);
            const mostRecentFile = recentFiles[0].name;
            
            appendOutput(`✅ Found recent matching processed file: ${mostRecentFile}`);
            
            // Add to processed files
            addProcessedFile({
              name: mostRecentFile,
              path: `/api/download?file=${encodeURIComponent(mostRecentFile)}`,
            });
            
            return {
              success: true,
              outputFile: mostRecentFile,
              details: "Found matching processed file from recent processing"
            };
          }
        }
      } catch (statusError) {
        console.error("Error checking status API:", statusError);
      }
      
      // If we still can't find the file, show the error
      if (error instanceof Error) {
        appendOutput(`❌ Failed to process file: ${error.message}`);
        throw error;
      }
      throw new Error('Unknown error during OCR response handling');
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
*/
