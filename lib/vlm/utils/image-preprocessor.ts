/**
 * Image preprocessing utilities for VLM operations
 * Handles resizing, normalization, and format conversion for optimal VLM processing
 */

import sharp from 'sharp';
import { VlmError, VlmErrorType } from '../core/vlm-error-types';
import logger from '../../logger';

/**
 * Options for image preprocessing
 */
export interface ImageProcessingOptions {
  /** Target width for resizing (maintain aspect ratio if only one dimension provided) */
  width?: number;
  /** Target height for resizing (maintain aspect ratio if only one dimension provided) */
  height?: number;
  /** Maximum size for the longest dimension */
  maxDimension?: number;
  /** Output format (jpeg, png, webp) */
  format?: 'jpeg' | 'png' | 'webp';
  /** JPEG/WebP quality (1-100) */
  quality?: number;
  /** Apply normalization for ML models */
  normalize?: boolean;
  /** Remove alpha channel */
  removeAlpha?: boolean;
  /** Apply basic enhancement */
  enhance?: boolean;
}

/**
 * Default processing options optimized for PaliGemma2
 */
const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxDimension: 1024,
  format: 'jpeg',
  quality: 90,
  normalize: true,
  removeAlpha: true,
  enhance: false
};

/**
 * Processes an image for optimal VLM processing
 * 
 * @param input - The input image (buffer or file path)
 * @param options - Processing options
 * @returns Processed image path (for file inputs) or buffer (for buffer inputs)
 */
export async function processImage(
  input: string | Buffer,
  options: ImageProcessingOptions = {}
): Promise<string | Buffer> {
  // Merge with default options
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    let imageBuffer: Buffer;
    
    // Handle input type
    if (typeof input === 'string') {
      // Input is a file path
      try {
        const fs = await import('fs/promises');
        imageBuffer = await fs.readFile(input);
      } catch (error) {
        throw new VlmError(
          VlmErrorType.FILE_NOT_FOUND,
          `Failed to read image file: ${input}`,
          { path: input, error },
          false
        );
      }
    } else {
      // Input is already a buffer
      imageBuffer = input;
    }
    
    // Create a sharp instance
    let image = sharp(imageBuffer);
    
    // Get image metadata
    const metadata = await image.metadata();
    const { width = 0, height = 0 } = metadata;
    
    // Resize if needed
    if (opts.width && opts.height) {
      // Resize to exact dimensions
      image = image.resize(opts.width, opts.height, { fit: 'fill' });
    } else if (opts.maxDimension && (width > opts.maxDimension || height > opts.maxDimension)) {
      // Resize maintaining aspect ratio with maximum dimension
      image = image.resize(opts.maxDimension, opts.maxDimension, { 
        fit: 'inside',
        withoutEnlargement: true
      });
    } else if (opts.width || opts.height) {
      // Resize with one dimension, maintaining aspect ratio
      image = image.resize(opts.width, opts.height, { 
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Remove alpha channel if requested
    if (opts.removeAlpha && metadata.hasAlpha) {
      image = image.removeAlpha();
    }
    
    // Apply basic enhancement if requested
    if (opts.enhance) {
      image = image.modulate({
        brightness: 1.05,
        saturation: 1.1,
      }).sharpen();
    }
    
    // Apply format and quality
    if (opts.format === 'jpeg') {
      image = image.jpeg({ quality: opts.quality });
    } else if (opts.format === 'png') {
      image = image.png();
    } else if (opts.format === 'webp') {
      image = image.webp({ quality: opts.quality });
    }
    
    // Get processed buffer
    const processedBuffer = await image.toBuffer();
    
    // If input was a file path, save the processed image and return the path
    if (typeof input === 'string') {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Generate output path
        const dir = path.dirname(input);
        const ext = path.extname(input);
        const basename = path.basename(input, ext);
        const outputPath = path.join(dir, `${basename}_processed${ext}`);
        
        // Save processed image
        await fs.writeFile(outputPath, processedBuffer);
        return outputPath;
      } catch (error) {
        // If saving fails, return the buffer instead
        logger.warn(`Failed to save processed image to file, returning buffer: ${error instanceof Error ? error.message : String(error)}`);
        return processedBuffer;
      }
    } else {
      // Input was a buffer, return processed buffer
      return processedBuffer;
    }
  } catch (error) {
    logger.error(`Image processing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new VlmError(
      VlmErrorType.PREPROCESSING_ERROR,
      `Failed to process image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts an image buffer to a base64 data URL for API requests
 * 
 * @param buffer - Image buffer
 * @param mimeType - MIME type (defaults to image/jpeg)
 * @returns Base64 data URL
 */
export function bufferToBase64DataUrl(buffer: Buffer, mimeType = 'image/jpeg'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Extracts image dimensions from a buffer
 * 
 * @param buffer - Image buffer
 * @returns Object containing width and height
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  } catch (error) {
    logger.error(`Failed to get image dimensions: ${error instanceof Error ? error.message : String(error)}`);
    return { width: 0, height: 0 };
  }
}
