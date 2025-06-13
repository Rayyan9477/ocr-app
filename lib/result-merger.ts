import logger from './logger';
import { OCRResult } from './nano-vlm-service';
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
    if (results['nanovlm']) {
      return Promise.resolve(results['nanovlm']);
    }
    
    // Add fallback logic when nanoVLM isn't available
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
  
  private mergeHandwritingResults(results: { [engine: string]: OCRResult }): Promise<OCRResult> {
    // Prefer engines that handle handwriting better
    if (results['nanovlm']) {
      return Promise.resolve(results['nanovlm']);
    }
    
    // Fallback to other engines if available
    const preferredOrder = ['tesseract', 'ocrmypdf'];
    for (const engine of preferredOrder) {
      if (results[engine]) {
        return Promise.resolve(results[engine]);
      }
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
  
  private mergeGeneralResults(results: { [engine: string]: OCRResult }): Promise<OCRResult> {
    // For general documents, we can use a simple confidence-based selection
    let bestResult: OCRResult | null = null;
    let highestConfidence = -1;
    
    for (const engine in results) {
      const result = results[engine];
      const confidence = typeof result.confidence === 'number' 
        ? result.confidence 
        : result.confidence.averageConfidence || 0;
        
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestResult = result;
      }
    }
    
    // If we found a result with confidence, return it
    if (bestResult) {
      return Promise.resolve(bestResult);
    }
    
    // Fallback to the first available result
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
}