#!/usr/bin/env node

/**
 * Enhanced OCR CLI Tool
 * Command-line interface for testing the enhanced OCR pipeline
 */

import { EnhancedOCRPipeline } from '../lib/enhanced-ocr-pipeline';
import logger from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Enhanced OCR CLI Tool
Usage: enhanced-ocr [options] <input-file>

Options:
  --output, -o <path>      Output directory (default: current directory)
  --highlight, -hl         Optimize for highlighted text
  --clahe, -c              Apply CLAHE enhancement
  --deskew, -d             Apply deskewing
  --perspective, -p        Apply perspective correction
  --edge-enhance, -e       Apply edge enhancement
  --normalize, -n          Apply image normalization
  --all, -a                Enable all enhancements
  --language, -l <lang>    OCR language (default: eng)
  --verbose, -v            Verbose output
  --help, -h               Show this help

Examples:
  enhanced-ocr document.pdf
  enhanced-ocr --all --output ./results document.jpg
  enhanced-ocr --highlight --clahe medical-bill.pdf
    `);
    return;
  }
  
  // Parse arguments
  const inputPath = args[args.length - 1];
  const outputDir = getArgValue(args, ['--output', '-o']) || process.cwd();
  const language = getArgValue(args, ['--language', '-l']) || 'eng';
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  // Determine options
  const enableAll = args.includes('--all') || args.includes('-a');
  
  const options = {
    outputDir,
    language,
    preprocessing: {
      applyCLAHE: enableAll || args.includes('--clahe') || args.includes('-c'),
      claheClipLimit: 2.0,
      deskew: enableAll || args.includes('--deskew') || args.includes('-d'),
      perspectiveCorrection: enableAll || args.includes('--perspective') || args.includes('-p'),
      optimizeHighlightedText: enableAll || args.includes('--highlight') || args.includes('-hl'),
      enhanceEdges: enableAll || args.includes('--edge-enhance') || args.includes('-e'),
      edgeStrength: 1.2,
      normalize: enableAll || args.includes('--normalize') || args.includes('-n')
    }
  };
  
  if (verbose) {
    console.log(`📋 Processing Configuration:`);
    console.log(`   Input: ${inputPath}`);
    console.log(`   Output: ${outputDir}`);
    console.log(`   Language: ${language}`);
    console.log(`   Options: ${JSON.stringify(options.preprocessing, null, 2)}`);
    console.log('');
  }
  
  // Process the document
  console.log(`🚀 Processing document: ${path.basename(inputPath)}`);
  
  const pipeline = new EnhancedOCRPipeline();
  const startTime = Date.now();
  
  try {
    const result = await pipeline.processDocument(inputPath, options);
    
    if (result.error) {
      console.error(`❌ Processing failed: ${result.error}`);
      process.exit(1);
    }
    
    // Save results
    const outputTextPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}_enhanced.txt`);
    fs.writeFileSync(outputTextPath, result.text);
    
    // Save metadata
    const metadataPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}_metadata.json`);
    const metadata = {
      inputFile: inputPath,
      processingTime: result.processingTime,
      confidence: result.confidence,
      documentType: result.documentType,
      wordCount: result.wordCount,
      preprocessingOperations: result.preprocessingOperations,
      highlightedRegions: result.highlightedRegions.length,
      enhancedImagePath: result.enhancedImagePath
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Display results
    console.log(`\n✅ OCR Processing Complete!`);
    console.log(`📄 Results:`);
    console.log(`   Text saved to: ${outputTextPath}`);
    console.log(`   Metadata saved to: ${metadataPath}`);
    console.log(`   Confidence: ${result.confidence.toFixed(1)}%`);
    console.log(`   Processing time: ${result.processingTime}ms`);
    console.log(`   Document type: ${result.documentType}`);
    console.log(`   Word count: ${result.wordCount}`);
    
    if (result.preprocessingOperations.length > 0) {
      console.log(`   Preprocessing: ${result.preprocessingOperations.join(', ')}`);
    }
    
    if (result.highlightedRegions.length > 0) {
      console.log(`   Highlighted regions: ${result.highlightedRegions.length}`);
    }
    
    if (result.enhancedImagePath) {
      console.log(`   Enhanced image: ${result.enhancedImagePath}`);
    }
    
    if (verbose && result.text.length > 0) {
      console.log(`\n📝 Extracted Text (first 200 characters):`);
      console.log(`   "${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}"`);
    }
    
  } catch (error) {
    console.error(`❌ Processing failed: ${error}`);
    process.exit(1);
  }
}

function getArgValue(args: string[], flags: string[]): string | undefined {
  for (const flag of flags) {
    const index = args.indexOf(flag);
    if (index !== -1 && index < args.length - 1) {
      return args[index + 1];
    }
  }
  return undefined;
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚡ Process interrupted by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

main().catch(error => {
  logger.error(`CLI Error: ${error}`);
  console.error(`❌ Error: ${error}`);
  process.exit(1);
});
