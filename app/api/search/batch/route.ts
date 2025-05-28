/**
 * Batch Search API Endpoint
 * Enables searching across multiple documents simultaneously with advanced filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import EnhancedSearchEngine, { SearchOptions, DocumentSearchData, SearchResult } from '@/lib/enhanced-search';
import HandwritingDetector from '@/lib/handwriting-detector';
import { searchCache } from '@/lib/search-cache';
import logger from '@/lib/logger';

const batchSearchEngine = new EnhancedSearchEngine();
const handwritingDetector = new HandwritingDetector();

interface BatchSearchRequest {
  queries: string[];
  documentIds?: string[];
  options?: SearchOptions;
  combineResults?: boolean;
  aggregateStats?: boolean;
}

interface BatchSearchResult {
  query: string;
  results: SearchResult[];
  totalResults: number;
  processingTimeMs: number;
  cached: boolean;
}

interface BatchSearchResponse {
  batchResults: BatchSearchResult[];
  aggregatedStats?: {
    totalQueries: number;
    totalResults: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    documentsSearched: number;
  };
  combineResults?: SearchResult[];
  processingInfo: {
    startTime: string;
    endTime: string;
    totalProcessingTimeMs: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const startTimeISO = new Date().toISOString();

  try {
    const body: BatchSearchRequest = await request.json();
    const { 
      queries, 
      documentIds = [], 
      options = {}, 
      combineResults = false,
      aggregateStats = true 
    } = body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ 
        error: 'Queries array is required and must not be empty' 
      }, { status: 400 });
    }

    if (queries.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 queries allowed per batch request' 
      }, { status: 400 });
    }

    const searchOptions: SearchOptions = {
      fuzzyThreshold: 0.3,
      includeHandwriting: true,
      minConfidence: 0,
      contextLength: 100,
      sortBy: 'relevance',
      maxResults: 50,
      enablePhoneticMatching: false,
      enableTypoCorrection: false,
      ...options
    };

    // Load documents
    const documents = await loadDocumentsData(documentIds.length > 0 ? documentIds : null);
    
    if (documents.length === 0) {
      return NextResponse.json({
        error: 'No documents available for batch search',
        batchResults: [],
        processingInfo: {
          startTime: startTimeISO,
          endTime: new Date().toISOString(),
          totalProcessingTimeMs: Date.now() - startTime
        }
      });
    }

    // Index documents once for all searches
    for (const doc of documents) {
      batchSearchEngine.addDocument(doc);
    }

    const batchResults: BatchSearchResult[] = [];
    const allResults: SearchResult[] = [];
    let totalCacheHits = 0;
    let totalProcessingTime = 0;

    // Process each query
    for (const query of queries) {
      const queryStartTime = Date.now();
      
      // Check cache first
      const cachedResults = searchCache.get(query, searchOptions);
      
      let results: SearchResult[];
      let cached = false;

      if (cachedResults) {
        results = cachedResults;
        cached = true;
        totalCacheHits++;
      } else {
        // Perform search
        results = batchSearchEngine.search(query, searchOptions);
        
        // Apply medical text corrections
        results = results.map(result => {
          if (result.isHandwritten || result.confidence < 70) {
            const correctedText = handwritingDetector.applyMedicalCorrections(result.text);
            return {
              ...result,
              originalText: result.text,
              correctedText: correctedText !== result.text ? correctedText : undefined
            };
          }
          return result;
        });

        // Cache the results
        searchCache.set(query, searchOptions, results);
      }

      const queryProcessingTime = Date.now() - queryStartTime;
      totalProcessingTime += queryProcessingTime;

      batchResults.push({
        query,
        results,
        totalResults: results.length,
        processingTimeMs: queryProcessingTime,
        cached
      });

      // Collect all results for combination if requested
      if (combineResults) {
        allResults.push(...results.map(result => ({ ...result, sourceQuery: query })));
      }
    }

    const endTime = Date.now();
    const totalBatchTime = endTime - startTime;

    // Prepare response
    const response: BatchSearchResponse = {
      batchResults,
      processingInfo: {
        startTime: startTimeISO,
        endTime: new Date(endTime).toISOString(),
        totalProcessingTimeMs: totalBatchTime
      }
    };

    // Add aggregated statistics if requested
    if (aggregateStats) {
      const totalResults = batchResults.reduce((sum, result) => sum + result.totalResults, 0);
      
      response.aggregatedStats = {
        totalQueries: queries.length,
        totalResults,
        averageProcessingTime: totalProcessingTime / queries.length,
        cacheHitRate: (totalCacheHits / queries.length) * 100,
        documentsSearched: documents.length
      };
    }

    // Add combined results if requested
    if (combineResults) {
      // Remove duplicates and sort by relevance
      const uniqueResults = removeDuplicateResults(allResults);
      const sortedResults = uniqueResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      
      response.combineResults = sortedResults.slice(0, searchOptions.maxResults || 100);
    }

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Batch search API error:', error);
    return NextResponse.json(
      { 
        error: 'Batch search failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        processingInfo: {
          startTime: startTimeISO,
          endTime: new Date().toISOString(),
          totalProcessingTimeMs: Date.now() - startTime
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'limits') {
      return NextResponse.json({
        maxQueriesPerBatch: 50,
        maxResultsPerQuery: 200,
        recommendedQueriesPerBatch: 10,
        supportedOptions: [
          'fuzzyThreshold',
          'includeHandwriting',
          'minConfidence',
          'contextLength',
          'sortBy',
          'maxResults',
          'enablePhoneticMatching',
          'enableTypoCorrection'
        ]
      });
    }

    if (action === 'stats') {
      return NextResponse.json({
        searchEngineStats: batchSearchEngine.getStats(),
        cacheStats: searchCache.getStats()
      });
    }

    return NextResponse.json({
      message: 'Batch Search API',
      usage: 'POST /api/search/batch with { queries: string[], options?: SearchOptions }',
      features: [
        'Multiple query processing',
        'Result caching and optimization',
        'Medical text correction',
        'Aggregated statistics',
        'Combined result deduplication'
      ]
    });

  } catch (error) {
    logger.error('Batch search GET API error:', error);
    return NextResponse.json(
      { error: 'Batch search info failed' },
      { status: 500 }
    );
  }
}

/**
 * Load documents data from processed OCR results
 */
async function loadDocumentsData(documentFilter?: string[] | null): Promise<DocumentSearchData[]> {
  const processedDir = path.join(process.cwd(), 'processed');
  const documents: DocumentSearchData[] = [];

  try {
    if (!fs.existsSync(processedDir)) {
      logger.warn('Processed directory does not exist');
      return documents;
    }

    const files = fs.readdirSync(processedDir);
    const confidenceFiles = files.filter(file => file.endsWith('_confidence.json'));

    for (const file of confidenceFiles) {
      const baseFilename = file.replace('_confidence.json', '');
      
      // Apply document filter if provided
      if (documentFilter && !documentFilter.some(filter => 
        baseFilename.includes(filter) || file.includes(filter)
      )) {
        continue;
      }

      const filePath = path.join(processedDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const confidenceData = JSON.parse(content);
        
        const document = convertToSearchData(confidenceData, baseFilename);
        if (document) {
          documents.push(document);
        }
      } catch (error) {
        logger.error(`Error reading confidence file ${file}:`, error);
      }
    }

    logger.info(`Loaded ${documents.length} documents for batch search`);
    return documents;

  } catch (error) {
    logger.error('Error loading documents data:', error);
    return documents;
  }
}

/**
 * Convert confidence data to search data format
 */
function convertToSearchData(confidenceData: any, filename: string): DocumentSearchData | null {
  try {
    const pages: any[] = [];

    if (confidenceData.pages && Array.isArray(confidenceData.pages)) {
      confidenceData.pages.forEach((page: any, pageIndex: number) => {
        const textBlocks: any[] = [];
        
        if (page.words && Array.isArray(page.words)) {
          page.words.forEach((word: any) => {
            textBlocks.push({
              text: word.text || '',
              confidence: word.confidence || 0,
              boundingBox: word.bbox ? {
                x0: word.bbox.x0 || 0,
                y0: word.bbox.y0 || 0,
                x1: word.bbox.x1 || 0,
                y1: word.bbox.y1 || 0
              } : null,
              isHandwritten: word.isHandwritten || false
            });
          });
        }

        pages.push({
          pageNumber: pageIndex + 1,
          textBlocks,
          averageConfidence: page.averageConfidence || 0,
          hasHandwriting: page.hasHandwriting || false,
          qualityMetrics: {
            textDensity: page.qualityMetrics?.textDensity || 0,
            uniformity: page.qualityMetrics?.uniformity || 0,
            clarity: page.qualityMetrics?.clarity || 0
          }
        });
      });
    }

    return {
      documentId: filename,
      fileName: filename,
      pages,
      totalConfidence: confidenceData.averageConfidence || 0,
      hasHandwriting: confidenceData.hasHandwriting || false
    };

  } catch (error) {
    logger.error(`Error converting confidence data for ${filename}:`, error);
    return null;
  }
}

/**
 * Remove duplicate results from combined search results
 */
function removeDuplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const key = `${result.documentName || result.documentId}-${result.page}-${result.text.slice(0, 50)}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  return unique;
}
