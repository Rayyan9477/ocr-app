import logger from './logger';
import { OCREngine } from './multi-engine-ocr';
import { EnhancedTesseractEngine } from './enhanced-tesseract-engine';
import { TFVLMService } from './tf-vlm-service';

export interface EngineRegistryOptions {
  defaultEngine?: string;
  enableAllEngines?: boolean;
}

/**
 * OCR Engine Registry - manages available OCR engines
 * Replaces the mixed Python/JS implementation with pure TypeScript
 */
export class OCREngineRegistry {
  private engines: Map<string, OCREngine> = new Map();
  private defaultEngineName: string;
  
  constructor(options: EngineRegistryOptions = {}) {
    this.defaultEngineName = options.defaultEngine || 'enhanced-tesseract';
    
    // Register available engines
    this.registerBuiltInEngines(options.enableAllEngines || false);
  }

  /**
   * Register built-in OCR engines
   */
  private registerBuiltInEngines(enableAll: boolean): void {
    // Register EnhancedTesseractEngine as a replacement for Kraken
    this.registerEngine(new EnhancedTesseractEngine({
      enableHandwritingOptimization: true
    }));
    
    // Register standard Tesseract engine optimized for printed text
    this.registerEngine(new EnhancedTesseractEngine({
      enableHandwritingOptimization: false,
      psm: 3, // Auto page segmentation with OSD
      oem: 3  // Default LSTM engine
    }), 'tesseract-standard');
    
    // Always enable these engines
    if (enableAll) {
      // Register additional engines if needed
      logger.info('Registering all available OCR engines');
    }
    
    logger.info(`Registered ${this.engines.size} OCR engines`);
  }

  /**
   * Register a new OCR engine
   */
  registerEngine(engine: OCREngine, name?: string): void {
    const engineName = name || engine.getName();
    this.engines.set(engineName, engine);
    logger.info(`Registered OCR engine: ${engineName}`);
  }

  /**
   * Get an OCR engine by name
   */
  getEngine(name?: string): OCREngine | undefined {
    const engineName = name || this.defaultEngineName;
    return this.engines.get(engineName);
  }

  /**
   * Get all registered engines
   */
  getAllEngines(): Map<string, OCREngine> {
    return this.engines;
  }

  /**
   * Get list of available engine names
   */
  getAvailableEngines(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Initialize all registered engines
   */
  async initializeEngines(): Promise<void> {
    logger.info('Initializing all OCR engines...');
    
    for (const [name, engine] of this.engines.entries()) {
      try {
        logger.info(`Initializing engine: ${name}`);
        await engine.initialize();
      } catch (error) {
        logger.error(`Failed to initialize engine ${name}: ${error}`);
      }
    }
  }

  /**
   * Clean up all engine resources
   */
  async cleanupEngines(): Promise<void> {
    logger.info('Cleaning up OCR engines...');
    
    for (const [name, engine] of this.engines.entries()) {
      try {
        logger.info(`Terminating engine: ${name}`);
        await engine.terminate();
      } catch (error) {
        logger.error(`Error terminating engine ${name}: ${error}`);
      }
    }
  }
}

// Create a singleton instance
export const engineRegistry = new OCREngineRegistry();
export default engineRegistry;
