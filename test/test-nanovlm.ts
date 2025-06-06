import path from 'path';
import fs from 'fs';
import { NanoVLMService } from '../lib/nano-vlm-service';
import logger from '../lib/logger';

const TEST_IMAGE = path.join(process.cwd(), 'test', 'assets', 'sample.png');
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test', 'output');

async function testNanoVLMService() {
  try {
    // Initialize the service
    console.log('📋 Initializing nanoVLM service...');
    const nanoVLMService = new NanoVLMService();
    
    // Test availability
    console.log('🔍 Checking service availability...');
    const isAvailable = await nanoVLMService.isAvailable();
    console.log(`✅ Service availability: ${isAvailable}\n`);
    
    if (!isAvailable) {
      console.error('❌ nanoVLM service is not available. Check the logs for details.');
      process.exit(1);
    }
    
    // Test image processing
    if (!fs.existsSync(TEST_IMAGE)) {
      console.log('⚠️  Test image not found, skipping processing test');
      return;
    }
    
    console.log('🖼️  Testing image processing...');
    
    // Create output directory
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    
    // Test different document types
    const testCases = [
      { documentType: 'general', description: 'General document' },
      { documentType: 'handwritten', description: 'Handwritten text' },
      { documentType: 'table', description: 'Table data' },
      { documentType: 'poor_quality', description: 'Poor quality image' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📄 Processing ${testCase.description}...`);
      
      const result = await nanoVLMService.processImage(TEST_IMAGE, TEST_OUTPUT_DIR, {
        documentType: testCase.documentType as any,
        confidenceThreshold: 0.7,
        enhanceResolution: true,
        preserveLayout: true
      });
      
      console.log(`   ✅ Text: ${result.text.substring(0, 60)}...`);
      console.log(`   ✅ Confidence: ${result.confidence}`);
      console.log(`   ✅ Processing time: ${result.processingTime}ms`);
      if (result.structuredData) {
        console.log(`   ✅ Structured data: ${JSON.stringify(result.structuredData, null, 2)}`);
      }
      if (result.layout) {
        console.log(`   ✅ Layout elements: ${result.layout.length}`);
      }
    }
    
    console.log('\n✨ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNanoVLMService();
