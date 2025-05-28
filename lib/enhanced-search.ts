/**
 * Enhanced Search Engine for OCR Results
 * Specialized for handwriting detection and fuzzy matching
 */

import Fuse, { IFuseOptions } from 'fuse.js';
import logger from './logger';

export interface SearchResult {
  text: string;
  confidence: number;
  page: number;
  matchScore: number;
  boundingBox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  context?: string; // Surrounding text for context
  isHandwritten?: boolean;
  qualityScore?: number;
  documentName?: string;
  documentId?: string;
}

export interface DocumentSearchData {
  documentId: string;
  fileName: string;
  pages: PageSearchData[];
  totalConfidence: number;
  hasHandwriting: boolean;
}

export interface PageSearchData {
  pageNumber: number;
  textBlocks: TextBlock[];
  averageConfidence: number;
  hasHandwriting: boolean;
  qualityMetrics: {
    textDensity: number;
    uniformity: number;
    clarity: number;
  };
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  isHandwritten: boolean;
  font?: {
    family: string;
    size: number;
    style: string;
  };
}

export interface SearchOptions {
  fuzzyThreshold: number; // 0.0 to 1.0 (0 = exact match, 1 = very fuzzy)
  includeHandwriting: boolean;
  minConfidence: number;
  contextLength: number; // Characters to include around match
  sortBy: 'relevance' | 'confidence' | 'page';
  maxResults: number;
  enablePhoneticMatching: boolean; // For medical terms and names
  enableTypoCorrection: boolean;
}

export class EnhancedSearchEngine {
  private fuseOptions: IFuseOptions<TextBlock>;
  private documents: Map<string, DocumentSearchData> = new Map();

  constructor() {
    this.fuseOptions = {
      keys: [
        { name: 'text', weight: 1.0 },
        { name: 'context', weight: 0.3 }
      ],
      threshold: 0.3, // Default fuzzy threshold
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      findAllMatches: true,
    };
  }

  /**
   * Add document to search index
   */
  addDocument(docData: DocumentSearchData): void {
    this.documents.set(docData.documentId, docData);
    logger.info(`Added document ${docData.fileName} to search index`);
  }

  /**
   * Remove document from search index
   */
  removeDocument(documentId: string): void {
    this.documents.delete(documentId);
    logger.info(`Removed document ${documentId} from search index`);
  }

  /**
   * Perform enhanced search across all documents
   */
  search(query: string, options: Partial<SearchOptions> = {}): SearchResult[] {
    const searchOptions: SearchOptions = {
      fuzzyThreshold: 0.3,
      includeHandwriting: true,
      minConfidence: 0,
      contextLength: 50,
      sortBy: 'relevance',
      maxResults: 100,
      enablePhoneticMatching: false,
      enableTypoCorrection: true,
      ...options
    };

    if (!query.trim()) {
      return [];
    }

    const allResults: SearchResult[] = [];

    // Process each document
    for (const [docId, docData] of this.documents) {
      const docResults = this.searchInDocument(docData, query, searchOptions);
      allResults.push(...docResults);
    }

    // Apply post-processing filters and sorting
    return this.processSearchResults(allResults, query, searchOptions);
  }

  /**
   * Search within a specific document
   */
  private searchInDocument(
    document: DocumentSearchData,
    query: string,
    options: SearchOptions
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const page of document.pages) {
      // Filter text blocks based on options
      let textBlocks = page.textBlocks.filter(block => {
        if (!options.includeHandwriting && block.isHandwritten) {
          return false;
        }
        if (block.confidence < options.minConfidence) {
          return false;
        }
        return true;
      });

      // Prepare data for Fuse.js
      const searchData = textBlocks.map(block => ({
        ...block,
        context: this.getContext(block, page.textBlocks, options.contextLength)
      }));

      // Configure Fuse with current threshold
      const fuse = new Fuse(searchData, {
        ...this.fuseOptions,
        threshold: options.fuzzyThreshold
      });

      // Perform search
      const fuseResults = fuse.search(query);

      // Convert Fuse results to SearchResult format
      for (const fuseResult of fuseResults) {
        const block = fuseResult.item;
        const score = fuseResult.score || 0;

        // Enhanced scoring for handwriting
        let adjustedScore = score;
        if (block.isHandwritten) {
          // Give slight penalty to handwritten text matches due to lower reliability
          adjustedScore = Math.min(score * 1.2, 1.0);
        }

        results.push({
          text: block.text,
          confidence: block.confidence,
          page: page.pageNumber,
          matchScore: 1 - adjustedScore, // Convert to positive score
          boundingBox: block.boundingBox,
          context: block.context,
          isHandwritten: block.isHandwritten,
          qualityScore: this.calculateQualityScore(block, page),
          documentName: document.fileName,
          documentId: document.documentId
        });
      }
    }

    return results;
  }

  /**
   * Get surrounding context for a text block
   */
  private getContext(
    targetBlock: TextBlock,
    allBlocks: TextBlock[],
    contextLength: number
  ): string {
    // Sort blocks by position (simple top-to-bottom, left-to-right)
    const sortedBlocks = allBlocks.sort((a, b) => {
      if (Math.abs(a.boundingBox.y0 - b.boundingBox.y0) > 10) {
        return a.boundingBox.y0 - b.boundingBox.y0; // Different lines
      }
      return a.boundingBox.x0 - b.boundingBox.x0; // Same line
    });

    const targetIndex = sortedBlocks.findIndex(b => 
      b.boundingBox.x0 === targetBlock.boundingBox.x0 &&
      b.boundingBox.y0 === targetBlock.boundingBox.y0
    );

    if (targetIndex === -1) return targetBlock.text;

    // Get surrounding text
    let contextText = '';
    let charCount = 0;

    // Add preceding context
    for (let i = targetIndex - 1; i >= 0 && charCount < contextLength / 2; i--) {
      const blockText = sortedBlocks[i].text + ' ';
      if (charCount + blockText.length <= contextLength / 2) {
        contextText = blockText + contextText;
        charCount += blockText.length;
      } else {
        break;
      }
    }

    // Add target text
    contextText += targetBlock.text;

    // Add following context
    charCount = targetBlock.text.length;
    for (let i = targetIndex + 1; i < sortedBlocks.length && charCount < contextLength; i++) {
      const blockText = ' ' + sortedBlocks[i].text;
      if (charCount + blockText.length <= contextLength) {
        contextText += blockText;
        charCount += blockText.length;
      } else {
        break;
      }
    }

    return contextText;
  }

  /**
   * Calculate quality score for a text block
   */
  private calculateQualityScore(block: TextBlock, page: PageSearchData): number {
    let score = block.confidence / 100; // Base score from OCR confidence

    // Adjust for handwriting (generally lower quality)
    if (block.isHandwritten) {
      score *= 0.8;
    }

    // Adjust for page quality metrics
    score *= (page.qualityMetrics.clarity + page.qualityMetrics.uniformity) / 2;

    // Text length factor (very short text might be noise)
    if (block.text.length < 3) {
      score *= 0.5;
    } else if (block.text.length > 20) {
      score *= 1.1; // Slight bonus for longer text
    }

    return Math.min(score, 1.0);
  }

  /**
   * Process and sort search results
   */
  private processSearchResults(
    results: SearchResult[],
    query: string,
    options: SearchOptions
  ): SearchResult[] {
    // Apply typo correction if enabled
    if (options.enableTypoCorrection) {
      results.forEach(result => {
        result.matchScore *= this.calculateTypoCorrection(query, result.text);
      });
    }

    // Sort results
    results.sort((a, b) => {
      switch (options.sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'page':
          return a.page - b.page;
        case 'relevance':
        default:
          // Combine match score and quality score
          const scoreA = (a.matchScore * 0.7) + ((a.qualityScore || 0) * 0.3);
          const scoreB = (b.matchScore * 0.7) + ((b.qualityScore || 0) * 0.3);
          return scoreB - scoreA;
      }
    });

    // Limit results
    return results.slice(0, options.maxResults);
  }

  /**
   * Calculate typo correction score
   */
  private calculateTypoCorrection(query: string, text: string): number {
    // Simple Levenshtein distance based correction
    const distance = this.levenshteinDistance(
      query.toLowerCase(), 
      text.toLowerCase()
    );
    const maxLength = Math.max(query.length, text.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get search suggestions based on existing document content
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    for (const [_, document] of this.documents) {
      for (const page of document.pages) {
        for (const block of page.textBlocks) {
          const words = block.text.toLowerCase().split(/\s+/);
          for (const word of words) {
            if (word.length > 2 && word.startsWith(queryLower) && word !== queryLower) {
              suggestions.add(word);
              if (suggestions.size >= limit) {
                return Array.from(suggestions);
              }
            }
          }
        }
      }
    }

    return Array.from(suggestions);
  }

  /**
   * Get document statistics
   */
  getStats(): {
    totalDocuments: number;
    totalPages: number;
    handwritingPages: number;
    averageConfidence: number;
  } {
    let totalPages = 0;
    let handwritingPages = 0;
    let totalConfidence = 0;
    let totalBlocks = 0;

    for (const [_, document] of this.documents) {
      totalPages += document.pages.length;
      
      for (const page of document.pages) {
        if (page.hasHandwriting) {
          handwritingPages++;
        }
        
        for (const block of page.textBlocks) {
          totalConfidence += block.confidence;
          totalBlocks++;
        }
      }
    }

    return {
      totalDocuments: this.documents.size,
      totalPages,
      handwritingPages,
      averageConfidence: totalBlocks > 0 ? totalConfidence / totalBlocks : 0
    };
  }
}

export default EnhancedSearchEngine;
