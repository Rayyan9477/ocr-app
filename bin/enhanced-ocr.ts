#!/usr/bin/env node

/**
 * Enhanced OCR CLI Tool
 * Command-line interface for testing the enhanced OCR pipeline
 * with advanced preprocessing capabilities
 */

import { EnhancedOCRPipeline, EnhancedOCROptions } from '../lib/enhanced-ocr-pipeline';
import { EnhancedPreprocessingOptions } from '../lib/enhanced-preprocessing-types';
import logger from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // Parse arguments
  const inputPath = args[args.length - 1];
  const outputDir = getArgValue(args, ['--output', '-o']) || process.cwd();
  
  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  // Determine options
  const enableAll = args.includes('--all') || args.includes('-a');
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  const preprocessingOptions: EnhancedPreprocessingOptions = {
    applyCLAHE: enableAll || args.includes('--clahe') || args.includes('-c'),
    claheClipLimit: parseFloat(getArgValue(args, ['--clahe-limit']) || '2.5'),
    deskew: enableAll || args.includes('--deskew') || args.includes('-d'),
    perspectiveCorrection: enableAll || args.includes('--perspective') || args.includes('-p'),
    optimizeHighlightedText: enableAll || args.includes('--highlight') || args.includes('-hl'),
    enhanceEdges: enableAll || args.includes('--edges') || args.includes('-e'),
    edgeStrength: parseFloat(getArgValue(args, ['--edge-strength']) || '1.2'),
    normalize: enableAll || args.includes('--normalize') || args.includes('-n')
  };
  
  const options: EnhancedOCROptions = {
    outputDir,
    language: getArgValue(args, ['--language', '-l']) || 'eng',
    preprocessing: preprocessingOptions,
    enhanceWithVLM: args.includes('--vlm'),
    useVLMRecommendations: args.includes('--vlm-recommend')
  };
  
  // Process the document
  console.log(`🚀 Processing document: ${path.basename(inputPath)}`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  if (verbose) {
    console.log(`⚙️  Options:`, JSON.stringify(preprocessingOptions, null, 2));
  }
  
  const pipeline = new EnhancedOCRPipeline();
  const startTime = Date.now();
  
  try {
    const result = await pipeline.processDocument(inputPath, options);
    const processingTime = Date.now() - startTime;
    
    if (result.error) {
      console.error(`❌ Processing failed: ${result.error}`);
      process.exit(1);
    }
    
    // Save results
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputTextPath = path.join(outputDir, `${baseName}_enhanced.txt`);
    const outputJsonPath = path.join(outputDir, `${baseName}_metadata.json`);
    
    fs.writeFileSync(outputTextPath, result.text);
    
    // Create detailed metadata
    const metadata = {
      processingTime: processingTime,
      confidence: result.confidence,
      documentType: result.documentType,
      wordCount: result.wordCount,
      preprocessingOperations: result.preprocessingOperations,
      highlightedRegionsCount: result.highlightedRegions.length,
      selectedEngine: result.error ? 'none' : 'enhanced-pipeline',
      inputFile: inputPath,
      outputFile: outputTextPath,
      enhancedImage: result.enhancedImagePath,
      timestamp: new Date().toISOString(),
      options: preprocessingOptions
    };
    
    fs.writeFileSync(outputJsonPath, JSON.stringify(metadata, null, 2));
    
    // Display results
    console.log(`\n✅ OCR Processing Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 Text saved to: ${outputTextPath}`);
    console.log(`📊 Metadata saved to: ${outputJsonPath}`);
    console.log(`🎯 Confidence: ${result.confidence.toFixed(2)}%`);
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log(`📝 Document type: ${result.documentType}`);
    console.log(`🔢 Word count: ${result.wordCount}`);
    console.log(`🔧 Preprocessing: ${result.preprocessingOperations.join(', ') || 'None'}`);
    console.log(`🏷️  Engine used: ${result.error ? 'none' : 'enhanced-pipeline'}`);
    
    if (result.highlightedRegions.length > 0) {
      console.log(`🌟 Highlighted regions: ${result.highlightedRegions.length}`);
      
      if (verbose) {
        console.log(`\n📋 Highlighted Text:`);
        result.highlightedRegions.forEach((region, index) => {
          if (region.text) {
            console.log(`   ${index + 1}. "${region.text.substring(0, 50)}${region.text.length > 50 ? '...' : ''}"`);
          }
        });
      }
    }
    
    if (result.enhancedImagePath) {
      console.log(`🖼️  Enhanced image: ${result.enhancedImagePath}`);
    }
    
    if (verbose && result.text) {
      console.log(`\n📖 Text Preview (first 200 characters):`);
      console.log(`   "${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}"`);
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
  } catch (error) {
    console.error(`❌ Error during processing: ${error}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔍 Enhanced OCR CLI Tool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Advanced OCR processing with enhanced preprocessing capabilities

Usage: enhanced-ocr [options] <input-file>

📁 Input/Output Options:
  --output, -o <path>      Output directory (default: current directory)
  --language, -l <lang>    OCR language (default: eng)

🔧 Preprocessing Options:
  --clahe, -c              Apply CLAHE contrast enhancement
  --clahe-limit <value>    CLAHE clip limit (default: 2.5)
  --deskew, -d             Apply document deskewing
  --perspective, -p        Apply perspective correction
  --highlight, -hl         Optimize highlighted text recognition
  --edges, -e              Apply edge enhancement
  --edge-strength <value>  Edge enhancement strength (default: 1.2)
  --normalize, -n          Apply image normalization
  --all, -a                Enable all preprocessing enhancements

🤖 VLM Options:
  --vlm                    Enhance results with VLM post-processing
  --vlm-recommend          Use VLM for preprocessing recommendations

🛠️  Other Options:
  --verbose, -v            Enable verbose output
  --help, -h               Show this help

📋 Examples:
  enhanced-ocr document.pdf
  enhanced-ocr --all --verbose scan.jpg
  enhanced-ocr --clahe --deskew --highlight document.png
  enhanced-ocr --output /results --language spa document.pdf
  enhanced-ocr --vlm --vlm-recommend complex_form.jpg

💡 Tips:
  • Use --all for maximum enhancement (slower but better quality)
  • Use --highlight for documents with yellow/colored highlighting
  • Use --clahe for low-contrast or poor quality scans
  • Use --verbose to see detailed processing information
`);
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

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Processing interrupted by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(`💥 Uncaught exception: ${error.message}`);
  process.exit(1);
});

main().catch(error => {
  logger.error(`CLI Error: ${error}`);
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
