import { type NextRequest, NextResponse } from "next/server"
import { readdir, readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { loadConfidenceData, type DocumentConfidence } from "@/lib/confidence-detector"

// Helper function to create consistent JSON responses
const createJsonResponse = (data: any, status: number = 200) => {
  return new NextResponse(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
};

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const outputFile = searchParams.get('outputFile');
  
  try {
    const processedDir = join(process.cwd(), "processed");
    
    if (documentId || outputFile) {
      // Get specific document confidence data
      let targetFile = '';
      
      if (outputFile) {
        targetFile = join(processedDir, outputFile);
      } else if (documentId) {
        // Find file by document ID (this might require scanning files)
        const files = await readdir(processedDir);
        const confidenceFiles = files.filter(f => f.endsWith('_confidence.json'));
        
        for (const file of confidenceFiles) {
          const confidenceData = await loadConfidenceData(join(processedDir, file.replace('_confidence.json', '.pdf')));
          if (confidenceData && confidenceData.documentId === documentId) {
            return createJsonResponse({
              success: true,
              confidence: confidenceData
            });
          }
        }
        
        return createJsonResponse({
          success: false,
          error: `Document with ID ${documentId} not found`
        }, 404);
      }
      
      if (targetFile && existsSync(targetFile)) {
        const confidenceData = await loadConfidenceData(targetFile);
        if (confidenceData) {
          return createJsonResponse({
            success: true,
            confidence: confidenceData
          });
        } else {
          return createJsonResponse({
            success: false,
            error: 'No confidence data found for this document'
          }, 404);
        }
      }
      
      return createJsonResponse({
        success: false,
        error: 'Document not found'
      }, 404);
    } else {
      // Get all confidence data (summary)
      const files = await readdir(processedDir);
      const confidenceFiles = files.filter(f => f.endsWith('_confidence.json'));
      
      const allConfidenceData: DocumentConfidence[] = [];
      
      for (const file of confidenceFiles) {
        try {
          const pdfFile = file.replace('_confidence.json', '.pdf');
          const confidenceData = await loadConfidenceData(join(processedDir, pdfFile));
          if (confidenceData) {
            allConfidenceData.push(confidenceData);
          }
        } catch (error) {
          console.warn(`Failed to load confidence data from ${file}:`, error);
        }
      }
      
      // Calculate summary statistics
      const totalDocuments = allConfidenceData.length;
      const documentsWithLowConfidence = allConfidenceData.filter(d => d.hasLowConfidencePages).length;
      const averageConfidence = totalDocuments > 0 
        ? allConfidenceData.reduce((sum, d) => sum + d.averageConfidence, 0) / totalDocuments 
        : 0;
      
      return createJsonResponse({
        success: true,
        summary: {
          totalDocuments,
          documentsWithLowConfidence,
          averageConfidence: Math.round(averageConfidence * 100) / 100,
          lowConfidencePercentage: totalDocuments > 0 
            ? Math.round((documentsWithLowConfidence / totalDocuments) * 100 * 100) / 100 
            : 0
        },
        documents: allConfidenceData.map(d => ({
          documentId: d.documentId,
          inputFile: d.inputFile.split('/').pop(),
          outputFile: d.outputFile.split('/').pop(),
          averageConfidence: Math.round(d.averageConfidence * 100) / 100,
          hasLowConfidencePages: d.hasLowConfidencePages,
          warningPages: d.warningPages,
          errorPages: d.errorPages,
          pageCount: d.pageConfidences.length,
          processedAt: d.processedAt
        }))
      });
    }
  } catch (error) {
    console.error("Error retrieving confidence data:", error);
    return createJsonResponse({
      success: false,
      error: "Failed to retrieve confidence data",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
};

export const DELETE = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const outputFile = searchParams.get('outputFile');
  
  if (!outputFile) {
    return createJsonResponse({
      success: false,
      error: "outputFile parameter is required"
    }, 400);
  }
  
  try {
    const processedDir = join(process.cwd(), "processed");
    const confidenceFile = join(processedDir, outputFile.replace('.pdf', '_confidence.json'));
    
    if (existsSync(confidenceFile)) {
      const { unlink } = await import('fs/promises');
      await unlink(confidenceFile);
      
      return createJsonResponse({
        success: true,
        message: "Confidence data deleted successfully"
      });
    } else {
      return createJsonResponse({
        success: false,
        error: "Confidence data file not found"
      }, 404);
    }
  } catch (error) {
    console.error("Error deleting confidence data:", error);
    return createJsonResponse({
      success: false,
      error: "Failed to delete confidence data",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
};

// Support OPTIONS for CORS requests
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
