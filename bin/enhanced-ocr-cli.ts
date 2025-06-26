#!/usr/bin/env node

import { EnhancedOCRService } from '../lib/enhanced-ocr-service';
import * as path from 'path';
import * as fs from 'fs';

interface CLIOptions {
  input?: string;
  output?: string;
  applyCLAHE?: boolean;
  deskew?: boolean;
  enhanceEdges?: boolean;
  normalize?: boolean;
  perspectiveCorrection?: boolean;
  optimizeHighlightedText?: boolean;
  enableHandwritingDetection?: boolean;
  language?: string;
  edgeStrength?: number;
  claheClipLimit?: number;
  help?: boolean;
  verbose?: boolean;
}

/**
 * Enhanced OCR CLI Tool
 * Provides command-line access to the enhanced OCR pipeline
 */
class EnhancedOCRCLI {
  private service: EnhancedOCRService;

  constructor() {
    this.service = new EnhancedOCRService();
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(): CLIOptions {
    const args = process.argv.slice(2);
    const options: CLIOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '-i':
        case '--input':
          options.input = args[++i];
          break;
        case '-o':
        case '--output':
          options.output = args[++i];
          break;
        case '--clahe':
          options.applyCLAHE = true;
          break;
        case '--no-clahe':
          options.applyCLAHE = false;
          break;
        case '--deskew':
          options.deskew = true;
          break;
        case '--no-deskew':
          options.deskew = false;
          break;
        case '--edges':
          options.enhanceEdges = true;
          break;
        case '--edge-strength':
          options.edgeStrength = parseFloat(args[++i]);
          break;
        case '--normalize':
          options.normalize = true;
          break;
        case '--perspective':
          options.perspectiveCorrection = true;
          break;
        case '--highlight':
          options.optimizeHighlightedText = true;
          break;
        case '--handwriting':
          options.enableHandwritingDetection = true;
          break;
        case '--language':
        case '-l':
          options.language = args[++i];
          break;
        case '--clahe-limit':
          options.claheClipLimit = parseFloat(args[++i]);
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
        default:
          if (!options.input && !arg.startsWith('-')) {
            options.input = arg;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Display help information
   */
  private showHelp(): void {
    console.log(`
Enhanced OCR CLI Tool

Usage: enhanced-ocr [options] <input-file>

Options:
  -i, --input <file>          Input image or PDF file
  -o, --output <file>         Output text file (optional)
  -l, --language <lang>       OCR language (default: eng)
  -v, --verbose               Enable verbose output
  -h, --help                  Show this help message

Preprocessing Options:
  --clahe                     Enable CLAHE contrast enhancement (default)
  --no-clahe                  Disable CLAHE enhancement
  --clahe-limit <value>       CLAHE clip limit (default: 2.0)
  --deskew                    Enable document deskewing (default)
  --no-deskew                 Disable deskewing
  --edges                     Enable edge enhancement
  --edge-strength <value>     Edge enhancement strength (default: 1.0)
  --normalize                 Enable image normalization
  --perspective               Enable perspective correction
  --highlight                 Enable highlighted text optimization
  --handwriting               Enable handwriting detection

Examples:
  enhanced-ocr document.png
  enhanced-ocr --clahe --edges --highlight document.pdf
  enhanced-ocr -i scan.jpg -o result.txt --handwriting --verbose
  enhanced-ocr --normalize --perspective --language fra document.png

Supported formats: PNG, JPG, JPEG, TIFF, PDF
Supported languages: eng, fra, deu, spa, ita, and more
`);
  }

  /**
   * Process document with enhanced OCR
   */
  async processDocument(options: CLIOptions): Promise<void> {
    if (!options.input) {
      console.error('Error: Input file is required');
      this.showHelp();
      process.exit(1);
    }

    if (!fs.existsSync(options.input)) {
      console.error(`Error: Input file not found: ${options.input}`);
      process.exit(1);
    }

    try {
      console.log('🚀 Starting Enhanced OCR Processing...');
      console.log(`📄 Input: ${options.input}`);

      if (options.verbose) {
        console.log('⚙️ Processing options:');
        console.log(`   CLAHE: ${options.applyCLAHE !== false}`);
        console.log(`   Deskew: ${options.deskew !== false}`);
        console.log(`   Edge Enhancement: ${options.enhanceEdges || false}`);
        console.log(`   Normalization: ${options.normalize || false}`);
        console.log(`   Perspective Correction: ${options.perspectiveCorrection || false}`);
        console.log(`   Highlight Optimization: ${options.optimizeHighlightedText || false}`);
        console.log(`   Handwriting Detection: ${options.enableHandwritingDetection || false}`);
        console.log(`   Language: ${options.language || 'eng'}`);
        console.log('');
      }

      const startTime = Date.now();
      
      const result = await this.service.processDocument(options.input, {
        applyCLAHE: options.applyCLAHE,
        deskew: options.deskew,
        enhanceEdges: options.enhanceEdges,
        normalize: options.normalize,
        perspectiveCorrection: options.perspectiveCorrection,
        optimizeHighlightedText: options.optimizeHighlightedText,
        enableHandwritingDetection: options.enableHandwritingDetection,
        language: options.language,
        edgeStrength: options.edgeStrength,
        claheClipLimit: options.claheClipLimit
      });

      const totalTime = Date.now() - startTime;

      if (result.success) {
        console.log('✅ Enhanced OCR completed successfully!');
        console.log('');
        console.log('📊 Results:');
        console.log(`   Confidence: ${result.confidence.toFixed(1)}%`);
        console.log(`   Word Count: ${result.wordCount}`);
        console.log(`   Document Type: ${result.documentType || 'Unknown'}`);
        console.log(`   Quality Score: ${result.qualityScore || 'N/A'}`);
        console.log(`   Processing Time: ${totalTime}ms`);
        
        if (result.highlightedRegions && result.highlightedRegions.length > 0) {
          console.log(`   Highlighted Regions: ${result.highlightedRegions.length}`);
        }

        if (options.verbose && result.preprocessingOperations.length > 0) {
          console.log(`   Preprocessing: ${result.preprocessingOperations.join(', ')}`);
        }

        if (result.recommendationsApplied && result.recommendationsApplied.length > 0) {
          console.log('💡 Recommendations:');
          result.recommendationsApplied.forEach(rec => console.log(`   • ${rec}`));
        }

        console.log('');
        console.log('📝 Extracted Text:');
        console.log('═'.repeat(50));
        console.log(result.text || '(No text extracted)');
        console.log('═'.repeat(50));

        // Save to output file if specified
        if (options.output) {
          fs.writeFileSync(options.output, result.text);
          console.log(`💾 Text saved to: ${options.output}`);
        }

        // Save enhanced image info
        if (result.enhancedImagePath && options.verbose) {
          console.log(`🖼️ Enhanced image: ${result.enhancedImagePath}`);
        }

      } else {
        console.error('❌ Enhanced OCR processing failed');
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    } finally {
      // Cleanup
      this.service.cleanup();
    }
  }

  /**
   * Show capabilities
   */
  showCapabilities(): void {
    const capabilities = this.service.getCapabilities();
    
    console.log('🔧 Enhanced OCR Capabilities:');
    console.log('');
    console.log(`📁 Supported Formats: ${capabilities.supportedFormats.join(', ')}`);
    console.log(`🌍 Supported Languages: ${capabilities.supportedLanguages.join(', ')}`);
    console.log(`🛠️ Preprocessing Options:`);
    capabilities.preprocessingOptions.forEach((option: string) => {
      console.log(`   • ${option}`);
    });
    console.log(`⚡ Features:`);
    console.log(`   • Highlight Detection: ${capabilities.highlightDetection ? 'Yes' : 'No'}`);
    console.log(`   • Handwriting Support: ${capabilities.handwritingSupport ? 'Yes' : 'No'}`);
    console.log(`   • Batch Processing: ${capabilities.batchProcessing ? 'Yes' : 'No'}`);
    console.log(`   • Max File Size: ${capabilities.maxFileSize}`);
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    const options = this.parseArguments();

    if (options.help || process.argv.length === 2) {
      this.showHelp();
      return;
    }

    if (process.argv.includes('--capabilities')) {
      this.showCapabilities();
      return;
    }

    await this.processDocument(options);
  }
}

// Run the CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new EnhancedOCRCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { EnhancedOCRCLI };
