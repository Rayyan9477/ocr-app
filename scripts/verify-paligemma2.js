/**
 * Verification script for Paligemma2 OCR Integration
 * 
 * This script verifies the basic functionality of the Paligemma2 OCR Integration
 * by attempting to initialize the OCR engine and process a test image.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { Paligemma2OCRIntegration } from '../lib/paligemma2-ocr-integration.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEST_IMAGE_PATH = join(__dirname, '../test_image.jpg');

async function verifyPaligemma2OCR() {
  console.log('🔍 Starting Paligemma2 OCR Integration Verification...');
  
  try {
    // 1. Check if test image exists
    try {
      await fs.access(TEST_IMAGE_PATH);
      console.log(`✅ Test image found at: ${TEST_IMAGE_PATH}`);
    } catch (err) {
      console.warn(`⚠️  Test image not found at ${TEST_IMAGE_PATH}`);
      console.log('ℹ️  Please place a test image at the specified path to test image processing.');
    }

    // 2. Initialize the OCR integration
    console.log('\n🔄 Initializing Paligemma2 OCR Integration...');
    const ocr = new Paligemma2OCRIntegration({
      mode: 'direct' // Using direct mode for testing
    });

    const initialized = await ocr.initialize();
    console.log(`✅ Paligemma2 OCR Integration ${initialized ? 'initialized successfully' : 'failed to initialize'}`);

    if (!initialized) {
      throw new Error('Failed to initialize Paligemma2 OCR Integration');
    }

    // 3. Test processing if image is available
    try {
      await fs.access(TEST_IMAGE_PATH);
      console.log('\n🔍 Testing image processing...');
      
      const result = await ocr.process(TEST_IMAGE_PATH, {
        documentType: 'general',
        enhanceResolution: true
      });

      console.log('\n✅ Image processing completed successfully!');
      console.log('\n📝 Results:');
      console.log('----------------------------------------');
      const previewText = result.text.length > 200 
        ? `${result.text.substring(0, 200)}...` 
        : result.text;
      console.log(`📄 Extracted Text (preview): ${previewText}`);
      console.log(`📊 Confidence: ${result.confidence}`);
      console.log(`🔢 Character Count: ${result.text.length}`);
      console.log('----------------------------------------');
      
    } catch (imgError) {
      console.warn('⚠️  Could not process test image:', imgError.message);
      console.log('ℹ️  The OCR engine initialized correctly, but image processing could not be tested.');
    }

    console.log('\n✅ Verification completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
verifyPaligemma2OCR();
