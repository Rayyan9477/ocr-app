import fs from 'fs';
import path from 'path';
import { MultiEngineOCR } from './multi-engine-ocr';
import { ABTestingFramework } from './ab-testing';
import logger from './logger';

interface BenchmarkConfig {
  datasets: {
    [key: string]: {
      path: string;
      groundTruth: string;
      documentType: string;
    }
  };
  engines: string[];
}

export class Benchmark {
  private multiEngineOCR: MultiEngineOCR;
  private abTesting: ABTestingFramework;
  private config: BenchmarkConfig;
  
  constructor(
    configPath = path.join(process.cwd(), 'config', 'benchmark.json'),
    multiEngineOCR: MultiEngineOCR,
    abTesting: ABTestingFramework
  ) {
    this.multiEngineOCR = multiEngineOCR;
    this.abTesting = abTesting;
    
    // Load benchmark configuration
    try {
      if (fs.existsSync(configPath)) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        throw new Error(`Benchmark config not found: ${configPath}`);
      }
    } catch (error) {
      logger.error(`Error loading benchmark config: ${error}`);
      throw error;
    }
  }
  
  async runBenchmarks() {
    logger.info('Starting benchmark tests');
    
    for (const [datasetName, dataset] of Object.entries(this.config.datasets)) {
      logger.info(`Testing dataset: ${datasetName}`);
      
      // Load ground truth data
      const groundTruthPath = path.join(process.cwd(), dataset.groundTruth);
      let groundTruth = '';
      
      try {
        groundTruth = fs.readFileSync(groundTruthPath, 'utf8');
      } catch (error) {
        logger.error(`Failed to load ground truth for ${datasetName}: ${error}`);
        continue;
      }
      
      // Process with each engine
      for (const engineName of this.config.engines) {
        try {
          logger.info(`Running ${engineName} on ${datasetName}`);
          
          const outputDir = path.join(process.cwd(), 'benchmark-results', datasetName);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const result = await this.multiEngineOCR.processWithEngine(
            engineName,
            path.join(process.cwd(), dataset.path),
            outputDir,
            dataset.documentType
          );
          
          // Record result in AB testing framework
          this.abTesting.recordResult(
            engineName,
            result,
            groundTruth,
            dataset.documentType
          );
          
          logger.info(`${engineName} completed processing ${datasetName}`);
        } catch (error) {
          logger.error(`Error benchmarking ${engineName} on ${datasetName}: ${error}`);
        }
      }
    }
    
    // Generate benchmark report
    const report = await this.abTesting.generateReport();
    logger.info('Benchmark completed. Report generated.');
    
    return report;
  }
}
