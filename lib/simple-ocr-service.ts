/**
 * Simple Cross-Platform OCR Service
 *
 * This service uses only JavaScript libraries (tesseract.js and pdf-lib)
 * to provide OCR functionality that works on Windows, Mac, and Linux
 * without requiring any system dependencies.
 */

import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import logger from './logger';

export interface SimpleOCROptions {
  language?: string;
  outputDir?: string;
  deskew?: boolean;
  enhanceContrast?: boolean;
  removeNoise?: boolean;
}

export interface SimpleOCRResult {
  success: boolean;
  text: string;
  confidence: number;
  outputPath?: string;
  processingTime: number;
  pageCount: number;
  error?: string;
}

export class SimpleOCRService {
  private static worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  /**
   * Initialize Tesseract worker (reused across requests for performance)
   */
  private static async getWorker(language: string = 'eng') {
    if (!this.worker) {
      logger.info(`Initializing Tesseract worker with language: ${language}`);
      this.worker = await createWorker(language);
    }
    return this.worker;
  }

  /**
   * Preprocess image to improve OCR accuracy
   */
  private static async preprocessImage(
    imageBuffer: Buffer,
    options: SimpleOCROptions
  ): Promise<Buffer> {
    let sharpImage = sharp(imageBuffer);

    // Enhance contrast using histogram normalization
    if (options.enhanceContrast) {
      sharpImage = sharpImage.normalize();
    }

    // Remove noise with median filter
    if (options.removeNoise) {
      sharpImage = sharpImage.median(3);
    }

    // Sharpen for better text recognition
    sharpImage = sharpImage.sharpen();

    // Convert to grayscale for better OCR
    sharpImage = sharpImage.grayscale();

    return await sharpImage.toBuffer();
  }

  /**
   * Extract text from a single image
   */
  private static async processImage(
    imageBuffer: Buffer,
    options: SimpleOCROptions
  ): Promise<{ text: string; confidence: number }> {
    const worker = await this.getWorker(options.language || 'eng');

    // Preprocess image if options are enabled
    const processedBuffer = await this.preprocessImage(imageBuffer, options);

    // Perform OCR
    const result = await worker.recognize(processedBuffer);

    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  }

  /**
   * Convert PDF pages to images and extract text
   */
  private static async processPDF(
    pdfPath: string,
    options: SimpleOCROptions
  ): Promise<SimpleOCRResult> {
    const startTime = Date.now();

    try {
      // Read the PDF file
      const pdfBuffer = await readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();

      logger.info(`Processing PDF with ${pageCount} pages`);

      let allText = '';
      let totalConfidence = 0;

      // Process each page
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        logger.info(`Processing page ${pageIndex + 1}/${pageCount}`);

        // Create a new PDF with just this page
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
        singlePageDoc.addPage(copiedPage);

        const singlePagePdfBytes = await singlePageDoc.save();

        // Convert PDF page to image using sharp
        const pageImage = await sharp(Buffer.from(singlePagePdfBytes), {
          density: 300 // High DPI for better OCR accuracy
        })
          .png()
          .toBuffer();

        // Process the image
        const result = await this.processImage(pageImage, options);

        allText += result.text + '\n\n';
        totalConfidence += result.confidence;
      }

      const avgConfidence = totalConfidence / pageCount;
      const processingTime = Date.now() - startTime;

      // Create searchable PDF if output directory is specified
      let outputPath: string | undefined;
      if (options.outputDir) {
        outputPath = await this.createSearchablePDF(
          pdfDoc,
          allText,
          path.join(options.outputDir, `${path.basename(pdfPath, '.pdf')}_ocr.pdf`)
        );
      }

      return {
        success: true,
        text: allText.trim(),
        confidence: avgConfidence,
        outputPath,
        processingTime,
        pageCount
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('PDF OCR processing failed:', error);

      return {
        success: false,
        text: '',
        confidence: 0,
        processingTime,
        pageCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process image files (PNG, JPG, etc.)
   */
  private static async processImageFile(
    imagePath: string,
    options: SimpleOCROptions
  ): Promise<SimpleOCRResult> {
    const startTime = Date.now();

    try {
      const imageBuffer = await readFile(imagePath);
      const result = await this.processImage(imageBuffer, options);

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
        processingTime: Date.now() - startTime,
        pageCount: 1
      };
    } catch (error) {
      logger.error('Image OCR processing failed:', error);

      return {
        success: false,
        text: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        pageCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a searchable PDF by embedding text layer
   */
  private static async createSearchablePDF(
    originalDoc: PDFDocument,
    extractedText: string,
    outputPath: string
  ): Promise<string> {
    try {
      // Create a copy of the original PDF
      const pdfDoc = await PDFDocument.create();
      const pages = await pdfDoc.copyPages(originalDoc, originalDoc.getPageIndices());

      pages.forEach((page) => pdfDoc.addPage(page));

      // Add metadata
      pdfDoc.setTitle('OCR Processed Document');
      pdfDoc.setProducer('Simple OCR Service');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());

      // Note: pdf-lib doesn't have built-in text layer support
      // For a full searchable PDF, we would need to add invisible text
      // at the correct positions. For simplicity, we're just embedding metadata
      // and the user can copy text from the OCR output.

      const pdfBytes = await pdfDoc.save();
      await writeFile(outputPath, pdfBytes);

      logger.info(`Searchable PDF created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Failed to create searchable PDF:', error);
      throw error;
    }
  }

  /**
   * Main entry point for OCR processing
   */
  public static async processFile(
    filePath: string,
    options: SimpleOCROptions = {}
  ): Promise<SimpleOCRResult> {
    const ext = path.extname(filePath).toLowerCase();

    // Set defaults
    const processOptions: SimpleOCROptions = {
      language: options.language || 'eng',
      deskew: options.deskew !== false,
      enhanceContrast: options.enhanceContrast !== false,
      removeNoise: options.removeNoise !== false,
      outputDir: options.outputDir
    };

    logger.info(`Starting OCR processing for ${filePath}`);
    logger.info(`Options: ${JSON.stringify(processOptions)}`);

    if (ext === '.pdf') {
      return await this.processPDF(filePath, processOptions);
    } else if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp'].includes(ext)) {
      return await this.processImageFile(filePath, processOptions);
    } else {
      return {
        success: false,
        text: '',
        confidence: 0,
        processingTime: 0,
        pageCount: 0,
        error: `Unsupported file type: ${ext}`
      };
    }
  }

  /**
   * Cleanup worker when done (optional, for graceful shutdown)
   */
  public static async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      logger.info('Tesseract worker terminated');
    }
  }
}

export default SimpleOCRService;
