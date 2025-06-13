import { type NextRequest, NextResponse } from "next/server"
import { readdir } from "fs/promises"
import { join } from "path"
import { loadConfidenceData, type DocumentConfidence } from "@/lib/confidence-detector"
import { normalizeConfidenceData } from "@/lib/confidence-utils"

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
  const format = searchParams.get('format') || 'summary'; // 'summary', 'detailed', or 'csv'
  const threshold = parseFloat(searchParams.get('threshold') || '85');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  
  try {
    const processedDir = join(process.cwd(), "processed");
    const files = await readdir(processedDir);
    const confidenceFiles = files.filter(f => f.endsWith('_confidence.json'));
    
    const allConfidenceData: DocumentConfidence[] = [];
    
    // Load all confidence data
    for (const file of confidenceFiles) {
      try {
        const pdfFile = file.replace('_confidence.json', '.pdf');
        const confidenceData = await loadConfidenceData(join(processedDir, pdfFile));
        if (confidenceData) {
          // Apply date filtering if specified
          const processedDate = new Date(confidenceData.processedAt);
          
          if (dateFrom && processedDate < new Date(dateFrom)) continue;
          if (dateTo && processedDate > new Date(dateTo)) continue;
          
          allConfidenceData.push(confidenceData);
        }
      } catch (error) {
        console.warn(`Failed to load confidence data from ${file}:`, error);
      }
    }
    
    // Sort by processing date (newest first)
    allConfidenceData.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
    
    if (format === 'csv') {
      // Generate CSV report
      const csvHeaders = [
        'Document ID',
        'Input File',
        'Output File',
        'Average Confidence',
        'Page Count',
        'Has Low Confidence Pages',
        'Warning Pages',
        'Error Pages',
        'Processed At'
      ];
      
      const csvRows = allConfidenceData.map(d => [
        d.documentId,
        d.inputFile.split('/').pop() || '',
        d.outputFile.split('/').pop() || '',
        d.averageConfidence.toFixed(2),
        d.pageConfidences.length.toString(),
        d.hasLowConfidencePages ? 'Yes' : 'No',
        d.warningPages.join(';'),
        d.errorPages.join(';'),
        new Date(d.processedAt).toISOString()
      ]);
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ocr-confidence-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    
    // Calculate comprehensive statistics
    const totalDocuments = allConfidenceData.length;
    const documentsWithLowConfidence = allConfidenceData.filter(d => d.hasLowConfidencePages).length;
    const documentsWithErrors = allConfidenceData.filter(d => d.errorPages.length > 0).length;
    const documentsWithWarnings = allConfidenceData.filter(d => d.warningPages.length > 0 && d.errorPages.length === 0).length;
    
    const totalPages = allConfidenceData.reduce((sum, d) => sum + d.pageConfidences.length, 0);
    const totalErrorPages = allConfidenceData.reduce((sum, d) => sum + d.errorPages.length, 0);
    const totalWarningPages = allConfidenceData.reduce((sum, d) => sum + d.warningPages.length, 0);
    
    const averageConfidence = totalDocuments > 0 
      ? allConfidenceData.reduce((sum, d) => sum + d.averageConfidence, 0) / totalDocuments 
      : 0;
    
    // Confidence distribution
    const confidenceRanges = {
      excellent: allConfidenceData.filter(d => d.averageConfidence >= 95).length,
      good: allConfidenceData.filter(d => d.averageConfidence >= 85 && d.averageConfidence < 95).length,
      warning: allConfidenceData.filter(d => d.averageConfidence >= 70 && d.averageConfidence < 85).length,
      error: allConfidenceData.filter(d => d.averageConfidence < 70).length,
    };
    
    // Time-based analysis (last 7 days, 30 days)
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentDocuments = allConfidenceData.filter(d => new Date(d.processedAt) >= last7Days);
    const monthlyDocuments = allConfidenceData.filter(d => new Date(d.processedAt) >= last30Days);
    
    const summary = {
      reportGenerated: new Date().toISOString(),
      dateRange: {
        from: dateFrom || (allConfidenceData.length > 0 ? allConfidenceData[allConfidenceData.length - 1].processedAt : null),
        to: dateTo || (allConfidenceData.length > 0 ? allConfidenceData[0].processedAt : null)
      },
      overview: {
        totalDocuments,
        totalPages,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        documentsWithIssues: documentsWithLowConfidence,
        issueRate: totalDocuments > 0 ? Math.round((documentsWithLowConfidence / totalDocuments) * 100 * 100) / 100 : 0
      },
      qualityBreakdown: {
        excellent: confidenceRanges.excellent,
        good: confidenceRanges.good,
        warning: confidenceRanges.warning,
        error: confidenceRanges.error
      },
      pageAnalysis: {
        totalPages,
        goodPages: totalPages - totalWarningPages - totalErrorPages,
        warningPages: totalWarningPages,
        errorPages: totalErrorPages,
        errorRate: totalPages > 0 ? Math.round((totalErrorPages / totalPages) * 100 * 100) / 100 : 0
      },
      trends: {
        last7Days: {
          documents: recentDocuments.length,
          averageConfidence: recentDocuments.length > 0 
            ? Math.round((recentDocuments.reduce((sum, d) => sum + d.averageConfidence, 0) / recentDocuments.length) * 100) / 100 
            : 0,
          issueRate: recentDocuments.length > 0 
            ? Math.round((recentDocuments.filter(d => d.hasLowConfidencePages).length / recentDocuments.length) * 100 * 100) / 100 
            : 0
        },
        last30Days: {
          documents: monthlyDocuments.length,
          averageConfidence: monthlyDocuments.length > 0 
            ? Math.round((monthlyDocuments.reduce((sum, d) => sum + d.averageConfidence, 0) / monthlyDocuments.length) * 100) / 100 
            : 0,
          issueRate: monthlyDocuments.length > 0 
            ? Math.round((monthlyDocuments.filter(d => d.hasLowConfidencePages).length / monthlyDocuments.length) * 100 * 100) / 100 
            : 0
        }
      }
    };
    
    if (format === 'summary') {
      return createJsonResponse({
        success: true,
        summary
      });
    }
    
    // Detailed format includes individual document data
    const detailedDocuments = allConfidenceData
      .filter(d => threshold ? d.averageConfidence < threshold : true)
      .map(d => ({
        documentId: d.documentId,
        inputFile: d.inputFile.split('/').pop(),
        outputFile: d.outputFile.split('/').pop(),
        averageConfidence: Math.round(d.averageConfidence * 100) / 100,
        hasLowConfidencePages: d.hasLowConfidencePages,
        warningPages: d.warningPages,
        errorPages: d.errorPages,
        pageCount: d.pageConfidences.length,
        processedAt: d.processedAt,
        pageDetails: d.pageConfidences.map(p => ({
          pageNumber: p.pageNumber,
          confidence: Math.round(p.averageConfidence * 100) / 100,
          wordCount: p.wordCount,
          lowConfidenceWordCount: p.lowConfidenceWords.length
        }))
      }));
    
    return createJsonResponse({
      success: true,
      summary,
      documents: detailedDocuments
    });
    
  } catch (error) {
    console.error("Error generating low confidence report:", error);
    return createJsonResponse({
      success: false,
      error: "Failed to generate low confidence report",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
};

// Support OPTIONS for CORS requests
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
