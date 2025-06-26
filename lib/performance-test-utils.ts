/**
 * Utility functions for OCR performance testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { EnhancedOCRResult } from './enhanced-ocr-pipeline';

interface PerformanceTestResult {
  testId: string;
  documentType: string;
  featureSet: string;
  processingTime: number;
  confidence: number;
  success: boolean;
  memoryUsage: number;
  cpuUsage?: number;
  wordCount: number;
  timestamp: Date;
}

interface TestStats {
  averageTime: number;
  averageConfidence: number;
  successRate: number;
  averageMemoryUsage: number;
  averageCpuUsage?: number;
  sampleCount: number;
}

interface PerformanceReport {
  overallStats: TestStats;
  byDocumentType: Record<string, TestStats>;
  byFeatureSet: Record<string, TestStats>;
  byDocumentAndFeature: Record<string, TestStats>;
  recommendations: string[];
  timestamp: Date;
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  private static readonly RESULTS_DIR = './test_performance/results';

  /**
   * Save a test result to the performance log
   */
  static saveTestResult(result: PerformanceTestResult): void {
    // Ensure results directory exists
    if (!fs.existsSync(this.RESULTS_DIR)) {
      fs.mkdirSync(this.RESULTS_DIR, { recursive: true });
    }

    // Build results file path
    const resultsFile = path.join(this.RESULTS_DIR, 'performance_log.jsonl');

    // Append result to file
    fs.appendFileSync(
      resultsFile, 
      JSON.stringify(result) + '\n'
    );
  }

  /**
   * Generate performance report from test results
   */
  static generatePerformanceReport(): PerformanceReport {
    // Ensure results directory exists
    if (!fs.existsSync(this.RESULTS_DIR)) {
      throw new Error('No test results found');
    }

    // Load test results
    const resultsFile = path.join(this.RESULTS_DIR, 'performance_log.jsonl');
    if (!fs.existsSync(resultsFile)) {
      throw new Error('No test results found');
    }

    const content = fs.readFileSync(resultsFile, 'utf-8');
    const results: PerformanceTestResult[] = content.split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

    // Initialize statistics
    const overallStats = this.initializeTestStats();
    const byDocumentType: Record<string, TestStats> = {};
    const byFeatureSet: Record<string, TestStats> = {};
    const byDocumentAndFeature: Record<string, TestStats> = {};

    // Process results
    for (const result of results) {
      // Update overall stats
      this.updateStats(overallStats, result);

      // Update by document type
      if (!byDocumentType[result.documentType]) {
        byDocumentType[result.documentType] = this.initializeTestStats();
      }
      this.updateStats(byDocumentType[result.documentType], result);

      // Update by feature set
      if (!byFeatureSet[result.featureSet]) {
        byFeatureSet[result.featureSet] = this.initializeTestStats();
      }
      this.updateStats(byFeatureSet[result.featureSet], result);

      // Update by document and feature
      const key = `${result.documentType}-${result.featureSet}`;
      if (!byDocumentAndFeature[key]) {
        byDocumentAndFeature[key] = this.initializeTestStats();
      }
      this.updateStats(byDocumentAndFeature[key], result);
    }

    // Finalize stats
    this.finalizeStats(overallStats);
    Object.values(byDocumentType).forEach(stats => this.finalizeStats(stats));
    Object.values(byFeatureSet).forEach(stats => this.finalizeStats(stats));
    Object.values(byDocumentAndFeature).forEach(stats => this.finalizeStats(stats));

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      byFeatureSet,
      byDocumentAndFeature
    );

    // Create report
    return {
      overallStats,
      byDocumentType,
      byFeatureSet,
      byDocumentAndFeature,
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Initialize test statistics
   */
  private static initializeTestStats(): TestStats {
    return {
      averageTime: 0,
      averageConfidence: 0,
      successRate: 0,
      averageMemoryUsage: 0,
      averageCpuUsage: 0,
      sampleCount: 0
    };
  }

  /**
   * Update statistics with a test result
   */
  private static updateStats(stats: TestStats, result: PerformanceTestResult): void {
    stats.averageTime += result.processingTime;
    stats.averageConfidence += result.confidence;
    stats.successRate += result.success ? 1 : 0;
    stats.averageMemoryUsage += result.memoryUsage;
    if (result.cpuUsage) {
      stats.averageCpuUsage! += result.cpuUsage;
    }
    stats.sampleCount++;
  }

  /**
   * Finalize statistics by calculating averages
   */
  private static finalizeStats(stats: TestStats): void {
    if (stats.sampleCount > 0) {
      stats.averageTime /= stats.sampleCount;
      stats.averageConfidence /= stats.sampleCount;
      stats.successRate = (stats.successRate / stats.sampleCount) * 100;
      stats.averageMemoryUsage /= stats.sampleCount;
      if (stats.averageCpuUsage !== undefined) {
        stats.averageCpuUsage /= stats.sampleCount;
      }
    }
  }

  /**
   * Generate performance recommendations based on test results
   */
  private static generateRecommendations(
    byFeatureSet: Record<string, TestStats>,
    byDocumentAndFeature: Record<string, TestStats>
  ): string[] {
    const recommendations: string[] = [];

    // Find best feature set for overall performance
    let bestFeatureSet = '';
    let bestConfidence = 0;

    for (const [featureSet, stats] of Object.entries(byFeatureSet)) {
      if (stats.averageConfidence > bestConfidence) {
        bestConfidence = stats.averageConfidence;
        bestFeatureSet = featureSet;
      }
    }

    if (bestFeatureSet) {
      recommendations.push(`Best overall performance: ${bestFeatureSet} feature set (${bestConfidence.toFixed(2)} confidence)`);
    }

    // Find best feature set for each document type
    const docTypeMap: Record<string, {feature: string, confidence: number}> = {};

    for (const [key, stats] of Object.entries(byDocumentAndFeature)) {
      const [docType, featureSet] = key.split('-');

      if (!docTypeMap[docType] || stats.averageConfidence > docTypeMap[docType].confidence) {
        docTypeMap[docType] = {
          feature: featureSet,
          confidence: stats.averageConfidence
        };
      }
    }

    for (const [docType, bestMatch] of Object.entries(docTypeMap)) {
      recommendations.push(`Best for ${docType} documents: ${bestMatch.feature} feature set (${bestMatch.confidence.toFixed(2)} confidence)`);
    }

    // Check for performance bottlenecks
    const baselineStats = byFeatureSet['base'];
    if (baselineStats) {
      for (const [featureSet, stats] of Object.entries(byFeatureSet)) {
        if (featureSet !== 'base') {
          const timeRatio = stats.averageTime / baselineStats.averageTime;
          const confidenceRatio = stats.averageConfidence / baselineStats.averageConfidence;

          if (timeRatio > 2 && confidenceRatio < 1.2) {
            recommendations.push(`Performance concern: ${featureSet} feature set is ${timeRatio.toFixed(1)}x slower than baseline but only ${((confidenceRatio - 1) * 100).toFixed(1)}% more accurate`);
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Save performance report to file
   */
  static savePerformanceReport(report: PerformanceReport): string {
    // Ensure results directory exists
    if (!fs.existsSync(this.RESULTS_DIR)) {
      fs.mkdirSync(this.RESULTS_DIR, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.RESULTS_DIR, `performance_report_${timestamp}.json`);

    // Save report
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    return reportFile;
  }
}
