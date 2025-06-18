import logger from './logger';
import { OCREngine } from './multi-engine-ocr';
import { EnhancedTesseractEngine } from './enhanced-tesseract-engine';
import { TFVLMService } from './tf-vlm-service';
import { paligemma2Integration, Paligemma2IntegrationMode } from './paligemma2-ocr-integration';

export interface EngineRegistryOptions {
  defaultEngine?: string;
  enableAllEngines?: boolean;
  enablePaligemma2?: boolean;
  paligemma2Mode?: Paligemma2IntegrationMode;
}

/**
 * OCR Engine Registry - manages available OCR engines
 * Replaces the mixed Python/JS implementation with pure TypeScript
 */
export class OCREngineRegistry {
  private engines: Map<string, OCREngine> = new Map();
  private defaultEngineName: string;
  private paligemma2Enabled: boolean;
  private paligemma2Mode: Paligemma2IntegrationMode;
  
  constructor(options: EngineRegistryOptions = {}) {
    this.defaultEngineName = options.defaultEngine || 'enhanced-tesseract';
    this.paligemma2Enabled = options.enablePaligemma2 !== false; // Enable by default
    this.paligemma2Mode = options.paligemma2Mode || Paligemma2IntegrationMode.ASSIST;
    
    // Register available engines
    this.registerBuiltInEngines(options.enableAllEngines || false);
    
    // Initialize Paligemma 2 if enabled
    if (this.paligemma2Enabled) {
      this.initializePaligemma2();
    }
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
    
    // Initialize Paligemma 2 if enabled
    if (this.paligemma2Enabled) {
      await this.initializePaligemma2();
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
    
    // Clean up Paligemma 2 if enabled
    if (this.paligemma2Enabled) {
      try {
        logger.info('Terminating Paligemma 2 integration...');
        await paligemma2Integration.dispose();
      } catch (error) {
        logger.error(`Error terminating Paligemma 2 integration: ${error}`);
      }
    }
  }

  /**
   * Initialize Paligemma 2 integration
   */
  private async initializePaligemma2(): Promise<void> {
    try {
      logger.info(`Initializing Paligemma 2 integration in ${this.paligemma2Mode} mode...`);
      await paligemma2Integration.initialize();
      logger.info('Paligemma 2 integration initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Paligemma 2 integration: ${error}`);
    }
  }
}

// Create a singleton instance
export const engineRegistry = new OCREngineRegistry();
export default engineRegistry;
