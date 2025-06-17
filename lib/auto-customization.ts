import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import logger from './logger';

const execAsync = promisify(exec);

export interface DocumentCharacteristics {
  isHandwritten: boolean;
  isMedicalDocument: boolean;
  isLowQuality: boolean;
  hasStructuredData: boolean;
  isMultiColumn: boolean;
  hasImages: boolean;
  language: string;
  dpi: number;
  pageCount: number;
}

export interface OptimizedOCRSettings {
  language: string;
  psm: number; // Page segmentation mode
  oem: number; // OCR engine mode
  usePreprocessing: boolean;
  aggressivePreprocessing: boolean;
  tesseractParams: string[];
  ocrmypdfParams: string[];
  enhancedParams: string[]; // Parameters for enhanced-tesseract engine
  confidenceThreshold: number;
  enginePreference: string[];
}

/**
 * Auto-customization service that analyzes document characteristics
 * and provides optimized OCR settings
 */
export class AutoCustomizationService {
  
  /**
   * Analyze document characteristics to determine optimal OCR settings
   */
  async analyzeAndCustomize(filePath: string): Promise<{
    characteristics: DocumentCharacteristics;
    settings: OptimizedOCRSettings;
  }> {
    try {
      logger.info(`Analyzing document characteristics: ${filePath}`);
      
      const characteristics = await this.analyzeDocument(filePath);
      const settings = this.generateOptimizedSettings(characteristics);
      
      logger.info(`Document analysis complete. Detected: ${JSON.stringify(characteristics)}`);
      logger.info(`Optimized settings: ${JSON.stringify(settings)}`);
      
      return { characteristics, settings };
    } catch (error) {
      logger.warn(`Document analysis failed, using default settings: ${error}`);
      return {
        characteristics: this.getDefaultCharacteristics(),
        settings: this.getDefaultSettings()
      };
    }
  }

  /**
   * Analyze document to determine its characteristics
   */
  private async analyzeDocument(filePath: string): Promise<DocumentCharacteristics> {
    const characteristics: DocumentCharacteristics = {
      isHandwritten: false,
      isMedicalDocument: false,
      isLowQuality: false,
      hasStructuredData: false,
      isMultiColumn: false,
      hasImages: false,
      language: 'eng',
      dpi: 300,
      pageCount: 1
    };

    try {
      // First, check filename for medical patterns
      const fileName = filePath.toLowerCase();
      const medicalFilePatterns = ['medical', 'bill', 'invoice', 'seiba', 'coded', 'hospital', 'clinic', 'ov.', 'snf.'];
      const filePatternMatches = medicalFilePatterns.filter(pattern => fileName.includes(pattern)).length;
      
      if (filePatternMatches >= 1) {
        characteristics.isMedicalDocument = true;
        logger.info(`Medical document detected from filename: ${filePath}`);
      }

      // Get basic PDF info
      const pdfInfo = await this.getPDFInfo(filePath);
      characteristics.pageCount = pdfInfo.pageCount;

      // Convert first page to image for analysis
      const imagePath = await this.convertToImage(filePath, 1);
      
      if (existsSync(imagePath)) {
        // Analyze image characteristics
        const imageAnalysis = await this.analyzeImage(imagePath);
        Object.assign(characteristics, imageAnalysis);

        // Quick OCR sample to detect content type
        const sampleText = await this.quickOCRSample(imagePath);
        const contentAnalysis = this.analyzeTextContent(sampleText);
        Object.assign(characteristics, contentAnalysis);

        // Cleanup temp image
        await execAsync(`rm -f "${imagePath}"`);
      }

    } catch (error) {
      logger.warn(`Error during document analysis: ${error}`);
    }

    return characteristics;
  }

  /**
   * Get PDF information using pdfinfo
   */
  private async getPDFInfo(filePath: string): Promise<{ pageCount: number }> {
    try {
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      const pageMatch = stdout.match(/Pages:\s+(\d+)/);
      return {
        pageCount: pageMatch ? parseInt(pageMatch[1]) : 1
      };
    } catch (error) {
      return { pageCount: 1 };
    }
  }

  /**
   * Convert PDF page to image for analysis
   */
  private async convertToImage(filePath: string, page: number = 1): Promise<string> {
    const imagePath = `/tmp/analysis_${Date.now()}_page${page}.png`;
    await execAsync(`pdftoppm -f ${page} -l ${page} -png -r 150 "${filePath}" "${imagePath.replace('.png', '')}"`);
    return `${imagePath.replace('.png', '')}-${page.toString().padStart(3, '0')}.png`;
  }

  /**
   * Analyze image characteristics using ImageMagick
   */
  private async analyzeImage(imagePath: string): Promise<Partial<DocumentCharacteristics>> {
    try {
      // Get image statistics
      const { stdout } = await execAsync(`identify -verbose "${imagePath}"`);
      
      const characteristics: Partial<DocumentCharacteristics> = {};
      
      // Check resolution
      const resolutionMatch = stdout.match(/Resolution: (\d+)x(\d+)/);
      if (resolutionMatch) {
        characteristics.dpi = parseInt(resolutionMatch[1]);
        characteristics.isLowQuality = characteristics.dpi < 200;
      }

      // Check for images/graphics (high color count might indicate images)
      const colorsMatch = stdout.match(/Colors: (\d+)/);
      if (colorsMatch) {
        const colorCount = parseInt(colorsMatch[1]);
        characteristics.hasImages = colorCount > 100;
      }

      // Analyze layout using basic image processing
      const layoutAnalysis = await this.analyzeLayout(imagePath);
      Object.assign(characteristics, layoutAnalysis);

      return characteristics;
    } catch (error) {
      logger.warn(`Image analysis failed: ${error}`);
      return {};
    }
  }

  /**
   * Analyze document layout to detect columns, structure
   */
  private async analyzeLayout(imagePath: string): Promise<Partial<DocumentCharacteristics>> {
    try {
      // Use basic edge detection to analyze structure
      const tempEdgePath = `/tmp/edges_${Date.now()}.png`;
      await execAsync(`convert "${imagePath}" -edge 2 -threshold 50% "${tempEdgePath}"`);
      
      // Count vertical lines (indicates columns)
      const { stdout } = await execAsync(`convert "${tempEdgePath}" -morphology Thinning "1x3:0,1,0" -format "%[fx:w*h-mean*w*h]" info:`);
      const edgeCount = parseFloat(stdout.trim());
      
      await execAsync(`rm -f "${tempEdgePath}"`);
      
      return {
        isMultiColumn: edgeCount > 1000, // Threshold for detecting multiple columns
        hasStructuredData: edgeCount > 500 // Threshold for structured content
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Perform quick OCR sample to analyze content
   */
  private async quickOCRSample(imagePath: string): Promise<string> {
    try {
      // Quick OCR with basic settings to get sample text
      const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l eng --psm 1`);
      return stdout.trim();
    } catch (error) {
      return '';
    }
  }

  /**
   * Analyze text content to determine document characteristics
   */
  private analyzeTextContent(text: string): Partial<DocumentCharacteristics> {
    const characteristics: Partial<DocumentCharacteristics> = {};
    
    if (text.length === 0) {
      characteristics.isLowQuality = true;
      return characteristics;
    }

    const lowerText = text.toLowerCase();
    
    // Enhanced medical document detection with more comprehensive keywords
    const medicalKeywords = [
      'patient', 'doctor', 'hospital', 'medical', 'diagnosis', 'prescription',
      'medication', 'treatment', 'symptoms', 'clinic', 'physician', 'nurse',
      'medical record', 'health', 'dosage', 'mg', 'ml', 'units', 'blood pressure',
      'temperature', 'pulse', 'weight', 'height', 'allergies', 'insurance',
      'copay', 'deductible', 'provider', 'billing', 'claim', 'invoice',
      'procedure', 'surgery', 'therapy', 'consultation', 'examination',
      'lab', 'test', 'result', 'radiology', 'x-ray', 'mri', 'ct scan',
      'injection', 'tablet', 'capsule', 'syrup', 'cream', 'ointment',
      'appointment', 'follow-up', 'visit', 'emergency', 'discharge'
    ];
    
    // Check for medical patterns in filename as well
    const fileName = text.toLowerCase();
    const medicalFilePatterns = ['medical', 'bill', 'invoice', 'seiba', 'coded', 'hospital', 'clinic'];
    const filePatternMatches = medicalFilePatterns.filter(pattern => fileName.includes(pattern)).length;
    
    const medicalMatches = medicalKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length;
    
    // Lower threshold for medical detection and include file pattern matches
    characteristics.isMedicalDocument = medicalMatches >= 2 || filePatternMatches >= 1;

    // Enhanced handwritten detection with better heuristics
    const irregularSpacing = (text.match(/\s{2,}/g) || []).length;
    const shortWords = text.split(/\s+/).filter(word => word.length < 3).length;
    const totalWords = text.split(/\s+/).length;
    const specialChars = (text.match(/[^a-zA-Z0-9\s,.!?]/g) || []).length;
    const lowercaseRatio = (text.match(/[a-z]/g) || []).length / text.length;
    
    // More sophisticated handwriting detection
    characteristics.isHandwritten = (
      irregularSpacing > totalWords * 0.2 || // Lower threshold
      shortWords > totalWords * 0.3 || // Lower threshold
      text.length < 200 || // Increased threshold for short text
      specialChars > text.length * 0.1 || // Many special chars indicate OCR issues
      lowercaseRatio < 0.3 || // Mostly uppercase might indicate handwriting OCR issues
      (totalWords > 0 && totalWords < 50 && text.length < 300) // Very sparse text
    );

    // Structured data detection
    const numberPatterns = (text.match(/\d+/g) || []).length;
    const punctuationPatterns = (text.match(/[,.;:()]/g) || []).length;
    
    characteristics.hasStructuredData = (
      numberPatterns > totalWords * 0.15 || // Lower threshold
      punctuationPatterns > totalWords * 0.25 // Lower threshold
    );

    return characteristics;
  }

  /**
   * Generate optimized OCR settings based on document characteristics
   */
  private generateOptimizedSettings(characteristics: DocumentCharacteristics): OptimizedOCRSettings {
    const settings: OptimizedOCRSettings = {
      language: characteristics.language,
      psm: 1, // Default: automatic page segmentation
      oem: 3, // Default: neural nets LSTM + legacy
      usePreprocessing: false,
      aggressivePreprocessing: false,
      tesseractParams: [],
      ocrmypdfParams: [],
      confidenceThreshold: 70,
      enginePreference: ['tesseract', 'ocrmypdf']
    };

    // Adjust based on document characteristics
    if (characteristics.isMedicalDocument) {
      settings.psm = 1; // Automatic page segmentation
      settings.confidenceThreshold = 60; // Lower threshold for medical docs
      const medicalWordsPath = path.join(process.cwd(), 'config', 'medical-words.txt');
      if (existsSync(medicalWordsPath)) {
        settings.tesseractParams.push('--user-words', medicalWordsPath);
      }
      settings.usePreprocessing = true;
      logger.info('Applied medical document optimizations');
    }

    if (characteristics.isHandwritten) {
      settings.psm = 13; // Raw line. Treat the image as a single text line
      settings.oem = 1; // Neural nets LSTM only
      settings.confidenceThreshold = 50; // Much lower threshold
      settings.aggressivePreprocessing = true;
      settings.enginePreference = ['tesseract']; // Tesseract better for handwriting
      logger.info('Applied handwritten document optimizations');
    }

    if (characteristics.isLowQuality) {
      settings.usePreprocessing = true;
      settings.aggressivePreprocessing = true;
      settings.psm = 1; // Automatic page segmentation
      settings.confidenceThreshold = 55;
      settings.tesseractParams.push('-c', 'preserve_interword_spaces=1');
      logger.info('Applied low quality document optimizations');
    }

    if (characteristics.hasStructuredData) {
      settings.psm = 6; // Assume a single uniform block of text
      settings.tesseractParams.push('-c', 'preserve_interword_spaces=1');
      settings.ocrmypdfParams.push('--optimize', '1');
      logger.info('Applied structured data optimizations');
    }

    if (characteristics.isMultiColumn) {
      settings.psm = 1; // Automatic page segmentation with orientation and script detection
      settings.tesseractParams.push('-c', 'preserve_interword_spaces=1');
      logger.info('Applied multi-column optimizations');
    }

    if (characteristics.hasImages) {
      settings.psm = 1; // Automatic page segmentation
      settings.ocrmypdfParams.push('--skip-text'); // Skip existing text
      settings.enginePreference = ['ocrmypdf', 'tesseract'];
      logger.info('Applied image-heavy document optimizations');
    }

    return settings;
  }

  /**
   * Get default characteristics when analysis fails
   */
  private getDefaultCharacteristics(): DocumentCharacteristics {
    return {
      isHandwritten: false,
      isMedicalDocument: false,
      isLowQuality: false,
      hasStructuredData: false,
      isMultiColumn: false,
      hasImages: false,
      language: 'eng',
      dpi: 300,
      pageCount: 1
    };
  }

  /**
   * Get default OCR settings
   */
  private getDefaultSettings(): OptimizedOCRSettings {
    return {
      language: 'eng',
      psm: 1,
      oem: 3,
      usePreprocessing: false,
      aggressivePreprocessing: false,
      tesseractParams: [],
      ocrmypdfParams: [],
      enhancedParams: [],
      confidenceThreshold: 70,
      enginePreference: ['tesseract', 'ocrmypdf', 'enhanced-tesseract']
    };
  }
}

export const autoCustomization = new AutoCustomizationService();
