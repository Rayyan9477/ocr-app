import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Paligemma2OCRIntegration } from './lib/paligemma2-ocr-integration.js';

// Add __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPaligemma2OCR() {
  console.log('Starting Paligemma2 OCR Integration Test...');
  
  // Initialize the OCR integration
  const ocr = new Paligemma2OCRIntegration({
    mode: 'direct'
  });

  try {
    // Test initialization
    console.log('Initializing Paligemma2...');
    const initialized = await ocr.initialize();
    console.log(`Initialization ${initialized ? 'succeeded' : 'failed'}`);
    
    if (!initialized) {
      throw new Error('Failed to initialize Paligemma2 OCR');
    }

    // Test text processing with a sample image path
    // Note: Replace with an actual image path for testing
    const testImagePath = './test-image.jpg';
    
    console.log(`\nProcessing test image: ${testImagePath}`);
    const result = await ocr.process(testImagePath, {
      documentType: 'general',
      enhanceResolution: true
    });

    console.log('\nOCR Results:');
    console.log('------------');
    console.log(`Text: ${result.text.substring(0, 200)}...`); // Show first 200 chars
    console.log(`Confidence: ${result.confidence}`);
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testPaligemma2OCR();
