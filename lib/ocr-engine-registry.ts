import { EnhancedTesseractEngine } from './enhanced-tesseract-engine';
import { Paligemma2OCRIntegration } from './paligemma2-ocr-integration';
import logger from './logger';

/**
 * Registry of available OCR engines
 */
export class OCREngineRegistry {
  private engines = new Map();

  constructor() {
    this.registerDefaultEngines();
  }

  private registerDefaultEngines() {
    // Register basic Tesseract
    this.engines.set('tesseract', {
      name: 'tesseract',
      create: () => ({
        process: (input: string) => {
          // Basic Tesseract implementation
          return Promise.resolve({ text: '', confidence: 0 });
        }
      })
    });

    // Register enhanced Tesseract engine
    this.registerEngine('enhanced-tesseract', {
      name: 'enhanced-tesseract',
      create: () => new EnhancedTesseractEngine()
    });

    // Register Paligemma2 Integration
    this.registerEngine('paligemma2', {
      name: 'paligemma2',
      create: () => new Paligemma2OCRIntegration({ mode: 'adaptive' })
    });

    logger.info('Default OCR engines registered');
  }

  /**
   * Register a new OCR engine
   */
  registerEngine(name: string, engine: any) {
    this.engines.set(name, engine);
    logger.info(`Registered OCR engine: ${name}`);
  }

  /**
   * Get an OCR engine by name
   */
  getEngine(name: string) {
    return this.engines.get(name);
  }

  /**
   * Get all registered engines
   */
  getAllEngines() {
    return Array.from(this.engines.values());
  }
}

// Create a singleton instance
export const engineRegistry = new OCREngineRegistry();
export default engineRegistry;
