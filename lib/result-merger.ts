import logger from './logger';
import { OCRResult } from './multi-engine-ocr';
import { DocumentAnalysis } from './document-analyzer';

export class ResultMerger {
  async mergeResults(
    results: { [engine: string]: OCRResult },
    documentAnalysis: DocumentAnalysis
  ): Promise<OCRResult> {
    try {
      const engines = Object.keys(results);
      
      // If only one engine was used, return its result
      if (engines.length === 1) {
        return results[engines[0]];
      }
      
      // Apply different merging strategies based on document type
      if (documentAnalysis.hasTables) {
        return this.mergeTableResults(results);
      } else if (documentAnalysis.hasHandwriting) {
        return this.mergeHandwritingResults(results);
      } else {
        return this.mergeGeneralResults(results);
      }
    } catch (error) {
      logger.error(`Error merging results: ${error}`);
      
      // Return the first available result in case of error
      const firstEngine = Object.keys(results)[0];
      return results[firstEngine];
    }
  }
  
  private mergeTableResults(results: { [engine: string]: OCRResult }): Promise<OCRResult> {
    // Use enhanced-tesseract as primary engine for tables after Python dependencies removal
    if (results['enhanced-tesseract']) {
      return Promise.resolve(results['enhanced-tesseract']);
    }
    
    // Fallback to standard tesseract
    if (results['tesseract']) {
      return Promise.resolve(results['tesseract']);
    }
    
    // If no preferred engines are available, return the first result
    const firstEngine = Object.keys(results)[0];
    if (firstEngine) {
      return Promise.resolve(results[firstEngine]);
    }
    
    // If no results at all, return an empty result
    return Promise.resolve({
      text: '',
      confidence: 0,
      processingTime: 0
    });
  }
  
  // ...existing code...
}