import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import logger from './logger';
import { MultiEngineOCR } from './multi-engine-ocr';
import { NanoVLMService } from './models/nanovlm-service';
import { ResultMerger } from './result-merger';
import { DocumentAnalyzer } from './document-analyzer';
import { AutoCustomization } from './auto-customization';

interface OCRResult {
  text: string;
  confidence: number;
  engine: string;
  metadata?: any;
}

export class IntegratedOCRService {
  private multiEngine: MultiEngineOCR;
  private nanovlm: NanoVLMService;
  private resultMerger: ResultMerger;
  private docAnalyzer: DocumentAnalyzer;
  private autoCustomization: AutoCustomization;

  constructor() {
    this.multiEngine = new MultiEngineOCR();
    this.nanovlm = new NanoVLMService();
    this.resultMerger = new ResultMerger();
    this.docAnalyzer = new DocumentAnalyzer();
    this.autoCustomization = new AutoCustomization();
  }

  async processDocument(
    inputPath: string,
    options: any = {}
  ): Promise<OCRResult> {
    try {
      // Analyze document characteristics
      const docCharacteristics = await this.docAnalyzer.analyze(inputPath);
      
      // Get customized settings based on document type
      const customizedSettings = await this.autoCustomization.getOptimizedSettings(
        docCharacteristics
      );

      // Process with primary OCR engines
      const primaryResult = await this.multiEngine.processDocument(
        inputPath,
        { ...options, ...customizedSettings }
      );

      // If confidence is high enough, return primary result
      if (primaryResult.confidence >= 0.95) {
        return primaryResult;
      }

      // Process with NanoVLM for enhancement
      const vlmResult = await this.nanovlm.processDocument(
        inputPath,
        customizedSettings
      );

      // Merge results intelligently
      const mergedResult = await this.resultMerger.mergeResults(
        primaryResult,
        vlmResult,
        docCharacteristics
      );

      return {
        ...mergedResult,
        metadata: {
          ...mergedResult.metadata,
          enhancement: 'nanovlm-assisted',
          originalConfidence: primaryResult.confidence,
          vlmConfidence: vlmResult.confidence
        }
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
