/**
 * Search Export API Endpoint
 * Exports search results in multiple formats (CSV, JSON, PDF)
 */

import { NextRequest, NextResponse } from 'next/server';
import { SearchResult } from '@/lib/enhanced-search';
import { searchCache } from '@/lib/search-cache';
import logger from '@/lib/logger';

interface ExportRequest {
  results: SearchResult[];
  format: 'csv' | 'json' | 'pdf' | 'txt';
  query: string;
  includeMetadata?: boolean;
  filename?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { results, format, query, includeMetadata = true, filename } = body;

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Results array is required' }, { status: 400 });
    }

    if (!['csv', 'json', 'pdf', 'txt'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Supported: csv, json, pdf, txt' }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = filename || `search-results-${timestamp}`;

    let content: string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'csv':
        content = generateCSV(results, query, includeMetadata);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'json':
        content = generateJSON(results, query, includeMetadata);
        contentType = 'application/json';
        fileExtension = 'json';
        break;

      case 'txt':
        content = generateText(results, query, includeMetadata);
        contentType = 'text/plain';
        fileExtension = 'txt';
        break;

      case 'pdf':
        // For PDF, we'll return a special response that the frontend can handle
        const pdfData = generatePDFData(results, query, includeMetadata);
        return NextResponse.json({
          success: true,
          format: 'pdf',
          data: pdfData,
          filename: `${defaultFilename}.pdf`,
          message: 'PDF data generated for client-side processing'
        });

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    // Create response with file download headers
    const response = new NextResponse(content);
    response.headers.set('Content-Type', contentType);
    response.headers.set('Content-Disposition', `attachment; filename="${defaultFilename}.${fileExtension}"`);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return response;

  } catch (error) {
    logger.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV format
 */
function generateCSV(results: SearchResult[], query: string, includeMetadata: boolean): string {
  const headers = [
    'Document',
    'Page',
    'Text',
    'Confidence',
    'Score',
    'Is Handwritten',
    'Context'
  ];

  if (includeMetadata) {
    headers.push('Original Text', 'Corrected Text', 'Match Type');
  }

  const csvLines = [headers.join(',')];

  // Add metadata header
  if (includeMetadata) {
    csvLines.unshift(`# Search Results Export`);
    csvLines.unshift(`# Query: "${query}"`);
    csvLines.unshift(`# Generated: ${new Date().toISOString()}`);
    csvLines.unshift(`# Total Results: ${results.length}`);
    csvLines.unshift('');
  }

  results.forEach(result => {
    const row = [
      `"${result.documentName || 'Unknown'}"`,
      result.page?.toString() || 'N/A',
      `"${escapeCSV(result.text)}"`,
      result.confidence?.toFixed(2) || 'N/A',
      result.matchScore?.toFixed(4) || 'N/A',
      result.isHandwritten ? 'Yes' : 'No',
      `"${escapeCSV(result.context || '')}"`
    ];

    if (includeMetadata) {
      row.push(
        `"${escapeCSV((result as any).originalText || '')}"`,
        `"${escapeCSV((result as any).correctedText || '')}"`,
        `"${result.matchScore?.toFixed(4) || 'N/A'}"`
      );
    }

    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

/**
 * Generate JSON format
 */
function generateJSON(results: SearchResult[], query: string, includeMetadata: boolean): string {
  const exportData = {
    metadata: includeMetadata ? {
      query,
      generatedAt: new Date().toISOString(),
      totalResults: results.length,
      exportFormat: 'json'
    } : undefined,
    results: results.map(result => ({
      document: result.documentName || result.documentId || 'Unknown',
      pageNumber: result.page,
      text: result.text,
      confidence: result.confidence,
      score: result.matchScore,
      isHandwritten: result.isHandwritten,
      context: result.context,
      ...(includeMetadata && {
        originalText: (result as any).originalText,
        correctedText: (result as any).correctedText
      })
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate plain text format
 */
function generateText(results: SearchResult[], query: string, includeMetadata: boolean): string {
  const lines: string[] = [];

  if (includeMetadata) {
    lines.push('SEARCH RESULTS EXPORT');
    lines.push('====================');
    lines.push(`Query: "${query}"`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total Results: ${results.length}`);
    lines.push('');
  }

  results.forEach((result, index) => {
    lines.push(`Result ${index + 1}:`);
    lines.push(`Document: ${result.documentName || 'Unknown'}`);
    lines.push(`Page: ${result.page || 'N/A'}`);
    lines.push(`Confidence: ${result.confidence?.toFixed(2) || 'N/A'}%`);
    lines.push(`Score: ${result.matchScore?.toFixed(4) || 'N/A'}`);
    lines.push(`Handwritten: ${result.isHandwritten ? 'Yes' : 'No'}`);
    lines.push(`Text: ${result.text}`);
    
    if (result.context) {
      lines.push(`Context: ${result.context}`);
    }

    if (includeMetadata) {
      if ((result as any).originalText) {
        lines.push(`Original Text: ${(result as any).originalText}`);
      }
      if ((result as any).correctedText) {
        lines.push(`Corrected Text: ${(result as any).correctedText}`);
      }
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Generate PDF data structure (for client-side PDF generation)
 */
function generatePDFData(results: SearchResult[], query: string, includeMetadata: boolean) {
  return {
    title: 'Search Results Export',
    metadata: includeMetadata ? {
      query,
      generatedAt: new Date().toISOString(),
      totalResults: results.length
    } : undefined,
    content: results.map((result, index) => ({
      resultNumber: index + 1,
      document: result.documentName || result.documentId || 'Unknown',
      pageNumber: result.page,
      text: result.text,
      confidence: result.confidence,
      score: result.matchScore,
      isHandwritten: result.isHandwritten,
      context: result.context,
      originalText: (result as any).originalText,
      correctedText: (result as any).correctedText
    }))
  };
}

/**
 * Escape CSV special characters
 */
function escapeCSV(str: string): string {
  if (!str) return '';
  return str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
}

// GET method for export status or format information
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'formats') {
      return NextResponse.json({
        supportedFormats: [
          {
            format: 'csv',
            description: 'Comma-separated values - spreadsheet compatible',
            contentType: 'text/csv'
          },
          {
            format: 'json',
            description: 'JavaScript Object Notation - structured data',
            contentType: 'application/json'
          },
          {
            format: 'txt',
            description: 'Plain text format - human readable',
            contentType: 'text/plain'
          },
          {
            format: 'pdf',
            description: 'Portable Document Format - requires client-side generation',
            contentType: 'application/pdf'
          }
        ]
      });
    }

    if (action === 'stats') {
      return NextResponse.json({
        cacheStats: searchCache.getStats(),
        message: 'Export functionality is available via POST method'
      });
    }

    return NextResponse.json({
      message: 'Search Export API',
      usage: 'POST /api/search/export with { results, format, query }',
      supportedFormats: ['csv', 'json', 'pdf', 'txt']
    });

  } catch (error) {
    logger.error('Export GET API error:', error);
    return NextResponse.json(
      { error: 'Export info failed' },
      { status: 500 }
    );
  }
}
