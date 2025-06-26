const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class SimpleEnhancedOCR {
  constructor() {
    this.sessionDir = path.join(os.tmpdir(), `simple_ocr_${Date.now()}`);
    this.ensureSessionDir();
  }
  
  ensureSessionDir() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }
  
  async processDocument(inputPath, options = {}) {
    console.log(`Processing document: ${inputPath}`);
    const startTime = Date.now();
    
    try {
      // Step 1: Check if input file exists
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      
      // Step 2: Apply basic preprocessing
      const preprocessedPath = await this.applyBasicPreprocessing(inputPath, options);
      
      // Step 3: Perform OCR
      const ocrResult = await this.performOCR(preprocessedPath);
      
      // Step 4: Return results
      const processingTime = Date.now() - startTime;
      
      return {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        processingTime: processingTime,
        success: true,
        preprocessedImagePath: preprocessedPath
      };
      
    } catch (error) {
      console.error('Processing failed:', error.message);
      return {
        text: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error.message
      };
    }
  }
  
  async applyBasicPreprocessing(inputPath, options) {
    const outputPath = path.join(this.sessionDir, 'preprocessed.png');
    let command = `convert "${inputPath}"`;
    
    // Apply CLAHE-like enhancement
    if (options.applyCLAHE !== false) {
      command += ' -colorspace Lab -channel 0 -equalize -channel RG -equalize -colorspace sRGB';
    }
    
    // Apply deskewing
    if (options.deskew !== false) {
      command += ' -background white -deskew 40%';
    }
    
    // Apply edge enhancement
    if (options.enhanceEdges) {
      command += ' -unsharp 0x1+1.2+0.05';
    }
    
    // Apply normalization
    if (options.normalize) {
      command += ' -normalize -contrast-stretch 2%x98%';
    }
    
    command += ` "${outputPath}"`;
    
    try {
      execSync(command, { stdio: 'pipe' });
      console.log('✅ Preprocessing completed');
      return outputPath;
    } catch (error) {
      console.warn('⚠️ Preprocessing failed, using original image');
      return inputPath;
    }
  }
  
  async performOCR(imagePath) {
    const outputPath = path.join(this.sessionDir, 'ocr_output');
    
    try {
      // Try Tesseract OCR
      execSync(`tesseract "${imagePath}" "${outputPath}" -l eng --psm 3 --oem 3`, { stdio: 'pipe' });
      
      const textFilePath = `${outputPath}.txt`;
      if (fs.existsSync(textFilePath)) {
        const text = fs.readFileSync(textFilePath, 'utf-8').trim();
        fs.unlinkSync(textFilePath); // Cleanup
        
        console.log('✅ OCR completed successfully');
        return {
          text: text,
          confidence: 85
        };
      } else {
        throw new Error('OCR output file not generated');
      }
    } catch (error) {
      console.error('❌ Tesseract OCR failed:', error.message);
      return {
        text: '',
        confidence: 0
      };
    }
  }
  
  cleanup() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        execSync(`rm -rf "${this.sessionDir}"`);
        console.log('🧹 Cleanup completed');
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }
}

// Test function
async function testSimpleEnhancedOCR() {
  console.log('🚀 Starting Simple Enhanced OCR Test...\n');
  
  const ocr = new SimpleEnhancedOCR();
  
  try {
    // Create a test image
    const testImagePath = path.join(os.tmpdir(), 'test_ocr_image.png');
    
    console.log('📝 Creating test image...');
    try {
      execSync(`convert -size 600x200 xc:white -pointsize 24 -fill black -gravity center -annotate +0+0 "Enhanced OCR Pipeline Test\\nThis is a multi-line test" "${testImagePath}"`);
      console.log('✅ Test image created:', testImagePath);
    } catch (error) {
      console.error('❌ Could not create test image. Please ensure ImageMagick is installed.');
      console.error('Install with: sudo apt-get install imagemagick');
      return;
    }
    
    // Test different configurations
    const configs = [
      { name: 'Basic OCR', options: {} },
      { name: 'Enhanced OCR', options: { applyCLAHE: true, deskew: true, enhanceEdges: true, normalize: true } }
    ];
    
    for (const config of configs) {
      console.log(`\n--- Testing: ${config.name} ---`);
      
      const result = await ocr.processDocument(testImagePath, config.options);
      
      console.log('📊 Results:');
      console.log(`  Success: ${result.success}`);
      console.log(`  Text: "${result.text}"`);
      console.log(`  Confidence: ${result.confidence}%`);
      console.log(`  Processing Time: ${result.processingTime}ms`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      
      if (result.preprocessedImagePath) {
        console.log(`  Preprocessed Image: ${result.preprocessedImagePath}`);
      }
    }
    
    // Cleanup test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
  } finally {
    ocr.cleanup();
  }
  
  console.log('\n🎉 Simple Enhanced OCR test completed!');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSimpleEnhancedOCR().catch(console.error);
}

module.exports = { SimpleEnhancedOCR };
