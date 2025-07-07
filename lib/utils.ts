import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import path from 'path';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Create a standardized JSON response for API endpoints
 */
export function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Generate proper output filename based on input
 * @param inputPath Path to the input file
 * @param engineName Name of the OCR engine
 * @param suffix Optional suffix to add to the filename
 * @returns Formatted output filename
 */
export function generateOutputFilename(inputPath: string, engineName: string, suffix: string = 'ocr'): string {
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  // Remove any timestamp prefix that might exist
  const cleanedName = inputBasename.replace(/^input_\d+_/, '');
  // Just use _ocr as suffix, ignore engine name and custom suffix
  return `${cleanedName}_ocr${path.extname(inputPath) === '.pdf' ? '.pdf' : '.txt'}`;
}

/**
 * Truncate text for JSON responses to prevent truncation
 * @param text Text to truncate
 * @param maxLength Maximum length of the truncated text
 * @returns Truncated text
 */
export function truncateTextForResponse(text: string, maxLength: number = 1000): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '... (truncated)';
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for calculating similarity between OCR results
 * @param a First string
 * @param b Second string
 * @returns Levenshtein distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-100%)
 * @param a First string
 * @param b Second string
 * @returns Similarity percentage
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Convert image buffer to base64 data URL
 * @param buffer Image buffer
 * @param mimeType MIME type of the image
 * @returns Base64 data URL
 */
export function bufferToDataURL(buffer: Buffer, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
