import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import logger from './logger';
import { MultiEngineOCR } from './multi-engine-ocr';
import { NanoVLMService } from './nano-vlm-service';
import { ResultMerger } from './result-merger';
import { DocumentAnalyzer } from './document-analyzer';
import { AutoCustomizationService } from './auto-customization';
import { ConfidenceData, normalizeConfidenceData, getAverageConfidence } from './types/ocr-types';

interface OCRResult {
  text: string;
  confidence: number | ConfidenceData; // Updated to use standardized confidence format
  engine: string;
  metadata?: any;
  processingTime?: number;
}

export class IntegratedOCRService {
  private multiEngine: MultiEngineOCR;
  private nanovlm: NanoVLMService;
  private resultMerger: ResultMerger;
  private docAnalyzer: DocumentAnalyzer;
  private autoCustomization: AutoCustomizationService;

  constructor() {
    this.multiEngine = new MultiEngineOCR();
    this.nanovlm = new NanoVLMService();
    this.resultMerger = new ResultMerger();
    this.docAnalyzer = new DocumentAnalyzer();
    this.autoCustomization = new AutoCustomizationService();
  }

  async processDocument(
    inputPath: string,
    options: any = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Get customized settings based on document type
      const { characteristics, settings: customizedSettings } = await this.autoCustomization.analyzeAndCustomize(
        inputPath
      );

      // Process with primary OCR engines
      const primaryResults = await this.multiEngine.processWithMultipleEngines(
        inputPath,
        ['tesseract', 'ocrmypdf'] // Default engines
      );

      // Get the best result from primary engines (highest confidence)
      const primaryResult = primaryResults.reduce((best, current) => {
        const bestConfidence = getAverageConfidence(best.confidence);
        const currentConfidence = getAverageConfidence(current.confidence);
        return currentConfidence > bestConfidence ? current : best;
      }, primaryResults[0]);

      // Normalize confidence data from primary result
      const normalizedPrimaryConfidence = normalizeConfidenceData(primaryResult.confidence);
      const primaryConfidenceValue = getAverageConfidence(normalizedPrimaryConfidence);

      // If confidence is high enough, return primary result
      if (primaryConfidenceValue >= 0.95) {
        return {
          ...primaryResult,
          confidence: normalizedPrimaryConfidence,
          processingTime: Date.now() - startTime
        };
      }

      // Process with NanoVLM for enhancement if available
      let enhancedResult = primaryResult;
      try {
        const vlmResult = await this.nanovlm.processImage(
          inputPath,
          path.dirname(inputPath),
          customizedSettings
        );

        const normalizedVlmConfidence = normalizeConfidenceData(vlmResult.confidence);

        // Merge results intelligently
        enhancedResult = await this.resultMerger.mergeResults(
          { ...primaryResult, confidence: normalizedPrimaryConfidence },
          { ...vlmResult, confidence: normalizedVlmConfidence },
          docCharacteristics
        );

        enhancedResult.metadata = {
          ...enhancedResult.metadata,
          enhancement: 'nanovlm-assisted',
          originalConfidence: primaryConfidenceValue,
          vlmConfidence: getAverageConfidence(normalizedVlmConfidence),
          processingTime: Date.now() - startTime
        };

      } catch (vlmError) {
        logger.warn('NanoVLM enhancement failed, using primary result:', vlmError);
        enhancedResult = {
          ...primaryResult,
          confidence: normalizedPrimaryConfidence,
          metadata: {
            ...primaryResult.metadata,
            enhancement: 'primary-only',
            enhancementError: vlmError instanceof Error ? vlmError.message : String(vlmError),
            processingTime: Date.now() - startTime
          }
        };
      }

      return {
        ...enhancedResult,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Document processing failed:', error);
      throw error;
    }
  }

  async processDocumentBatch(
    inputPaths: string[],
    options: any = {}
  ): Promise<OCRResult[]> {
    const results = await Promise.all(
      inputPaths.map(path => this.processDocument(path, options))
    );
    return results;
  }

  async validateResults(results: OCRResult[]): Promise<boolean> {
    try {
      for (const result of results) {
        if (!result.text || result.confidence < 0.6) {
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error('Result validation failed:', error);
      return false;
    }
  }
}
