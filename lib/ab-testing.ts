import fs from 'fs';
import path from 'path';
import logger from './logger';

export interface TestResult {
  accuracy: number;
  processingTime: number;
  confidenceScore: number;
  documentType: string;
}

export class ABTestingFramework {
  private engineResults: Map<string, TestResult[]> = new Map();
  private resultsPath: string;
  
  constructor(resultsPath = path.join(process.cwd(), 'test-results')) {
    this.resultsPath = resultsPath;
    
    // Create results directory if it doesn't exist
    if (!fs.existsSync(this.resultsPath)) {
      fs.mkdirSync(this.resultsPath, { recursive: true });
    }
  }
  
  recordResult(engineName: string, result: any, groundTruth: string, documentType: string) {
    if (!this.engineResults.has(engineName)) {
      this.engineResults.set(engineName, []);
    }
    
    const accuracy = this.calculateAccuracy(result.text, groundTruth);
    this.engineResults.get(engineName).push({
      accuracy,
      processingTime: result.processingTime,
      confidenceScore: result.confidence,
      documentType
    });
  }
  
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {},
      byDocumentType: {},
      recommendations: []
    };
    
    // Process results for each engine
    for (const [engine, results] of this.engineResults.entries()) {
      // Calculate overall stats
      const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      
      report.summary[engine] = {
        averageAccuracy: avgAccuracy,
        averageProcessingTime: avgProcessingTime,
        sampleCount: results.length
      };
      
      // Group by document type
      const docTypes = [...new Set(results.map(r => r.documentType))];
      for (const docType of docTypes) {
        if (!report.byDocumentType[docType]) {
          report.byDocumentType[docType] = {};
        }
        
        const typeResults = results.filter(r => r.documentType === docType);
        const typeAvgAccuracy = typeResults.reduce((sum, r) => sum + r.accuracy, 0) / typeResults.length;
        
        report.byDocumentType[docType][engine] = {
          averageAccuracy: typeAvgAccuracy,
          sampleCount: typeResults.length
        };
      }
    }
    
    // Generate recommendations
    const docTypes = Object.keys(report.byDocumentType);
    for (const docType of docTypes) {
      const engines = Object.keys(report.byDocumentType[docType]);
      if (engines.length > 1) {
        engines.sort((a, b) => 
          report.byDocumentType[docType][b].averageAccuracy - 
          report.byDocumentType[docType][a].averageAccuracy
        );
        
        report.recommendations.push({
          documentType: docType,
          recommendedEngine: engines[0],
          reason: `Best accuracy (${report.byDocumentType[docType][engines[0]].averageAccuracy.toFixed(2)})`
        });
      }
    }
    
    // Save report to file
    const reportPath = path.join(this.resultsPath, `report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }
  
  private calculateAccuracy(recognized: string, groundTruth: string): number {
    // Simple implementation using Levenshtein distance
    const distance = this.levenshteinDistance(recognized, groundTruth);
    const maxLength = Math.max(recognized.length, groundTruth.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }
  
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    // Initialize the matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill in the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1, // substitution
            matrix[i][j-1] + 1,   // insertion
            matrix[i-1][j] + 1    // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
}
