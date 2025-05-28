/**
 * Search Suggestions API Endpoint
 * Provides search suggestions and auto-completion for enhanced search
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import EnhancedSearchEngine from '@/lib/enhanced-search';
import HandwritingDetector from '@/lib/handwriting-detector';
import logger from '@/lib/logger';

const handwritingDetector = new HandwritingDetector();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeHandwriting = searchParams.get('includeHandwriting') !== 'false';
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');

    if (query.length < 2) {
      return NextResponse.json({ 
        suggestions: [],
        message: 'Query too short for suggestions'
      });
    }

    // Load vocabulary from processed documents
    const vocabulary = await loadVocabulary(includeHandwriting, minConfidence);
    
    // Generate suggestions based on query
    const suggestions = generateSuggestions(query, vocabulary, limit);
    
    // Add medical term suggestions if applicable
    const medicalSuggestions = generateMedicalSuggestions(query, limit);
    
    // Combine and deduplicate suggestions
    const allSuggestions = [...suggestions, ...medicalSuggestions]
      .filter((suggestion, index, arr) => arr.indexOf(suggestion) === index)
      .slice(0, limit);

    return NextResponse.json({
      suggestions: allSuggestions,
      query,
      totalSuggestions: allSuggestions.length,
      includesMedicalTerms: medicalSuggestions.length > 0
    });

  } catch (error) {
    logger.error('Search suggestions API error:', error);
    return NextResponse.json(
      { error: 'Internal suggestions error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Load vocabulary from processed OCR documents
 */
async function loadVocabulary(includeHandwriting: boolean, minConfidence: number): Promise<Set<string>> {
  const processedDir = path.join(process.cwd(), 'processed');
  const vocabulary = new Set<string>();

  try {
    if (!fs.existsSync(processedDir)) {
      return vocabulary;
    }

    const files = fs.readdirSync(processedDir);
    const confidenceFiles = files.filter(f => f.endsWith('_confidence.json'));

    for (const confidenceFile of confidenceFiles) {
      try {
        const confidencePath = path.join(processedDir, confidenceFile);
        const confidenceData = JSON.parse(fs.readFileSync(confidencePath, 'utf8'));

        if (confidenceData.pages && Array.isArray(confidenceData.pages)) {
          for (const page of confidenceData.pages) {
            if (page.words && Array.isArray(page.words)) {
              for (const word of page.words) {
                if (word.text && word.text.trim() && 
                    word.confidence >= minConfidence) {
                  
                  // Check if handwriting should be included
                  if (!includeHandwriting) {
                    const handwritingMetrics = handwritingDetector.analyzeHandwriting(
                      word.text,
                      word.confidence || 0
                    );
                    if (handwritingMetrics.isHandwritten) {
                      continue;
                    }
                  }

                  // Clean and add words
                  const cleanText = word.text.trim()
                    .replace(/[^\w\s]/g, '') // Remove special characters
                    .toLowerCase();
                  
                  if (cleanText.length >= 2) {
                    vocabulary.add(cleanText);
                    
                    // Also add individual words if it's a phrase
                    const words = cleanText.split(/\s+/);
                    words.forEach((w: string) => {
                      if (w.length >= 2) {
                        vocabulary.add(w);
                      }
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing confidence file ${confidenceFile}:`, error);
      }
    }

    logger.info(`Loaded vocabulary with ${vocabulary.size} terms`);
    return vocabulary;

  } catch (error) {
    logger.error('Error loading vocabulary:', error);
    return vocabulary;
  }
}

/**
 * Generate suggestions based on fuzzy matching
 */
function generateSuggestions(query: string, vocabulary: Set<string>, limit: number): string[] {
  const queryLower = query.toLowerCase();
  const suggestions: Array<{ term: string; score: number }> = [];

  for (const term of vocabulary) {
    if (term.includes(queryLower)) {
      // Exact substring match gets highest score
      suggestions.push({
        term,
        score: term.indexOf(queryLower) === 0 ? 1.0 : 0.8
      });
    } else if (levenshteinDistance(queryLower, term) <= Math.max(1, Math.floor(queryLower.length / 3))) {
      // Fuzzy match within edit distance threshold
      const score = 1 - (levenshteinDistance(queryLower, term) / Math.max(queryLower.length, term.length));
      suggestions.push({ term, score });
    }
  }

  // Sort by score and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.term);
}

/**
 * Generate medical term suggestions
 */
function generateMedicalSuggestions(query: string, limit: number): string[] {
  const medicalTerms = [
    // Common medical terms
    'patient', 'doctor', 'prescription', 'medicine', 'medication',
    'insurance', 'diagnosis', 'treatment', 'hospital', 'clinic',
    'appointment', 'symptoms', 'allergies', 'copayment', 'deductible',
    'emergency', 'physician', 'nurse', 'therapy', 'surgery',
    
    // Medical conditions
    'hypertension', 'diabetes', 'asthma', 'copd', 'cardiovascular',
    'arthritis', 'depression', 'anxiety', 'migraine', 'pneumonia',
    
    // Medical units and measurements
    'milligrams', 'milliliters', 'units', 'dose', 'dosage',
    'blood pressure', 'heart rate', 'temperature', 'weight', 'height',
    
    // Medical frequency terms
    'daily', 'twice daily', 'three times daily', 'as needed',
    'before meals', 'after meals', 'bedtime', 'morning', 'evening',
    
    // Insurance and billing terms
    'copay', 'coinsurance', 'out of pocket', 'prior authorization',
    'formulary', 'generic', 'brand name', 'network', 'provider'
  ];

  const queryLower = query.toLowerCase();
  const suggestions: Array<{ term: string; score: number }> = [];

  for (const term of medicalTerms) {
    if (term.includes(queryLower)) {
      suggestions.push({
        term,
        score: term.indexOf(queryLower) === 0 ? 1.0 : 0.7
      });
    } else if (levenshteinDistance(queryLower, term) <= 2) {
      const score = 1 - (levenshteinDistance(queryLower, term) / Math.max(queryLower.length, term.length));
      suggestions.push({ term, score });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.floor(limit / 2))
    .map(s => s.term);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}
