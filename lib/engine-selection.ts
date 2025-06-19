import path from 'path';
import fs from 'fs';
import logger from './logger';
import { OCREngine } from './multi-engine-ocr';
import { OCREngineRegistry } from './ocr-engine-registry';
import { Paligemma2VLService, DocumentAnalysis } from './paligemma2-service';
import { EnhancedTesseractEngine } from './enhanced-tesseract-engine';

export interface EngineSelectionCriteria {
  hasHandwriting?: boolean;
  hasTables?: boolean;
  poorQuality?: boolean;
  complexLayout?: boolean;
  fileExtension?: string;
  fileSize?: number;
  pageCount?: number;
  documentType?: string;
}

export interface EngineSelectionResult {
  primaryEngine: string;
  fallbackEngine?: string;
  confidence: number;
  criteria: EngineSelectionCriteria;
}

/**
 * Engine Selection Service - Determines the optimal OCR engine for a document
 * Pure TypeScript replacement for Python-based engine selection logic
 */
export class EngineSelectionService {
  private registry: OCREngineRegistry;
  private paligemma2Service: Paligemma2VLService;
  private documentAnalysisCache: Map<string, DocumentAnalysis> = new Map();
  
  constructor(
    registry: OCREngineRegistry,
    paligemma2Service: Paligemma2VLService
  ) {
    this.registry = registry;
    this.paligemma2Service = paligemma2Service;
  }

  /**
   * Select the optimal OCR engine for a document
   */
  async selectEngineForDocument(
    filePath: string,
    forcedEngine?: string
  ): Promise<EngineSelectionResult> {
    // If engine is forced, use it if available
    if (forcedEngine) {
      const engine = this.registry.getEngine(forcedEngine);
      if (engine) {
        return {
          primaryEngine: forcedEngine,
          confidence: 100,
          criteria: { fileExtension: path.extname(filePath) }
        };
      }
      logger.warn(`Forced engine '${forcedEngine}' not available, selecting optimal engine`);
    }
    
    // Analyze file characteristics
    const criteria = await this.analyzeDocument(filePath);
    
    // Select engine based on criteria
    const result = this.selectEngineBasedOnCriteria(criteria);
    
    logger.info(`Selected engine for ${path.basename(filePath)}: ${result.primaryEngine} (confidence: ${result.confidence}%)`);
    if (result.fallbackEngine) {
      logger.info(`Fallback engine: ${result.fallbackEngine}`);
    }
    
    return result;
  }

  /**
   * Analyze document to determine characteristics
   */
  private async analyzeDocument(filePath: string): Promise<EngineSelectionCriteria> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileSize = fs.statSync(filePath).size;
    
    // Skip document analysis for very small files or non-image/pdf files
    const skipAnalysis = 
      fileSize < 5000 || 
      !['.png', '.jpg', '.jpeg', '.pdf', '.tiff', '.tif', '.bmp'].includes(fileExtension);
    
    if (skipAnalysis) {
      return {
        fileExtension,
        fileSize,
        hasHandwriting: false,
        hasTables: false,
        poorQuality: false,
        complexLayout: false
      };
    }
    
    try {
      let analysis: DocumentAnalysis;
      
      // Check cache first
      const fileHash = await this.getFileHash(filePath);
      if (this.documentAnalysisCache.has(fileHash)) {
        analysis = this.documentAnalysisCache.get(fileHash)!;
      } else {
        // Get document analysis from Paligemma2
        analysis = await this.paligemma2Service.analyzeDocument(filePath);
        this.documentAnalysisCache.set(fileHash, analysis);
      }
      
      return {
        ...analysis,
        fileExtension,
        fileSize
      };
    } catch (error) {
      logger.error(`Error analyzing document with Paligemma2: ${error}`);
      // Fall back to basic analysis
      return {
        fileExtension,
        fileSize
      };
    }
  }

  /**
   * Select engine based on document criteria
   */
  private selectEngineBasedOnCriteria(criteria: EngineSelectionCriteria): EngineSelectionResult {
    // Get available engines
    const availableEngines = this.registry.getAvailableEngines();
    
    // Default fallback is always enhanced-tesseract
    const defaultEngine = 'enhanced-tesseract';
    
    // If no engines available, use default
    if (availableEngines.length === 0) {
      return {
        primaryEngine: defaultEngine,
        confidence: 60,
        criteria
      };
    }
    
    // Document type based selection
    if (criteria.documentType) {
      switch (criteria.documentType) {
        case 'handwritten':
          return {
            primaryEngine: 'enhanced-tesseract',
            fallbackEngine: 'tesseract-standard',
            confidence: 85,
            criteria
          };
          
        case 'table':
          return {
            primaryEngine: 'tf-vlm',
            fallbackEngine: 'enhanced-tesseract',
            confidence: 80,
            criteria
          };
          
        case 'poor_quality':
          return {
            primaryEngine: 'tf-vlm',
            fallbackEngine: 'enhanced-tesseract',
            confidence: 75,
            criteria
          };
          
        case 'medical':
          return {
            primaryEngine: 'enhanced-tesseract',
            fallbackEngine: 'tf-vlm',
            confidence: 70,
            criteria
          };
      }
    }
    
    // Feature-based selection
    if (criteria.hasHandwriting) {
      return {
        primaryEngine: 'enhanced-tesseract', // Replace Kraken
        fallbackEngine: 'tf-vlm',
        confidence: 80,
        criteria
      };
    }
    
    if (criteria.hasTables) {
      return {
        primaryEngine: 'tf-vlm', // Replace NanoVLM
        fallbackEngine: 'enhanced-tesseract',
        confidence: 75,
        criteria
      };
    }
    
    if (criteria.poorQuality) {
      return {
        primaryEngine: 'tf-vlm',
        fallbackEngine: 'enhanced-tesseract',
        confidence: 70,
        criteria
      };
    }
    
    if (criteria.complexLayout) {
      return {
        primaryEngine: 'tf-vlm',
        fallbackEngine: 'enhanced-tesseract',
        confidence: 65,
        criteria
      };
    }
    
    // Default selection based on file type
    const ext = criteria.fileExtension?.toLowerCase();
    if (ext === '.pdf') {
      return {
        primaryEngine: 'enhanced-tesseract',
        confidence: 80,
        criteria
      };
    }
    
    // Default to enhanced-tesseract for general usage
    return {
      primaryEngine: 'enhanced-tesseract',
      confidence: 75,
      criteria
    };
  }

  /**
   * Select optimal engine based on document characteristics
   */
  async selectOptimalEngine(characteristics: DocumentCharacteristics): Promise<EngineSelection> {
    const selection: EngineSelection = {
      primaryEngine: 'tesseract',
      fallbackEngine: 'enhanced-tesseract',
      engineOptions: {
        usePreprocessing: true,
        enablePostProcessing: true,
        usePaligemma2: true
      }
    };

    if (characteristics.isHandwritten) {
      selection.primaryEngine = 'enhanced-tesseract';
      selection.engineOptions.usePaligemma2 = true;
      selection.engineOptions.aggressivePreprocessing = true;
    }

    if (characteristics.isStructured) {
      selection.engineOptions.preserveLayout = true;
      selection.engineOptions.tableDetection = true;
    }

    if (characteristics.isLowQuality) {
      selection.engineOptions.aggressivePreprocessing = true;
      selection.engineOptions.usePaligemma2 = true;
    }

    return selection;
  }

  private async getFileHash(filePath: string): Promise<string> {
    // Implement file hash calculation
    // For demonstration purposes, return a fixed hash
    return 'fixed-hash';
  }
}

// Create singleton instance
export const engineSelectionService = new EngineSelectionService(
  require('./ocr-engine-registry').engineRegistry,
  require('./paligemma2-service').paligemma2Service
);

export default engineSelectionService;
