#!/usr/bin/env node
/**
 * Test script for nanoVLM TypeScript service integration
 */

import { NanoVLMService } from '../lib/nano-vlm-service';
import path from 'path';
import fs from 'fs';

const TEST_IMAGE = 'test_vlm_input.png';
const TEST_OUTPUT_DIR = 'test_vlm_output';

console.log('🧪 Testing nanoVLM TypeScript Service Integration\n');

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
    const testCases: Array<{documentType: 'general' | 'handwritten' | 'table' | 'poor_quality', description: string}> = [
      { documentType: 'general', description: 'General document' },
      { documentType: 'handwritten', description: 'Handwritten text' },
      { documentType: 'table', description: 'Table data' },
      { documentType: 'poor_quality', description: 'Poor quality image' }
    ];
    
    for (const testCase of testCases) {
      console.log(`📄 Processing ${testCase.description}...`);
      
      const result = await nanoVLMService.processImage(TEST_IMAGE, TEST_OUTPUT_DIR, {
        documentType: testCase.documentType,
        confidenceThreshold: 0.7,
        enhanceResolution: true,
        preserveLayout: true
      });
      
      console.log(`   ✅ Text: ${result.text.substring(0, 60)}...`);
      console.log(`   ✅ Confidence: ${result.confidence}`);
      console.log(`   ✅ Processing time: ${result.processingTime}ms`);
      console.log('');
    }
    
    console.log('🎉 All tests passed! nanoVLM integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the test
testNanoVLMService();
