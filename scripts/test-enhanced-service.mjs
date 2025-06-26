import { EnhancedOCRService } from '../dist/enhanced-ocr-service.js';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';

async function testEnhancedService() {
  console.log('🚀 Testing Enhanced OCR Service...\n');
  
  // Create test image
  const testImagePath = path.join(os.tmpdir(), 'enhanced_test_image.png');
  
  try {
    console.log('📝 Creating test image...');
    execSync(`convert -size 800x300 xc:white -pointsize 20 -fill black -gravity northwest -annotate +50+50 "Enhanced OCR Service Test\\n\\nThis is a test document with multiple lines.\\nIt includes various text formatting and spacing.\\n\\nTest completed successfully." "${testImagePath}"`);
    
    console.log('✅ Test image created');
    
  } catch (error) {
    console.error('❌ Could not create test image:', error.message);
    console.log('Please ensure ImageMagick is installed: sudo apt-get install imagemagick');
    return;
  }
  
  const service = new EnhancedOCRService();
  
  try {
    // Test different enhancement configurations
    const testConfigs = [
      {
        name: 'No Enhancements',
        options: {}
      },
      {
        name: 'Basic Enhancements',
        options: {
          applyCLAHE: true,
          deskew: true
        }
      },
      {
        name: 'Full Enhancements',
        options: {
          applyCLAHE: true,
          deskew: true,
          enhanceEdges: true,
          normalize: true,
          perspectiveCorrection: true
        }
      }
    ];
    
    console.log('📊 Testing different configurations...\n');
    
    for (const config of testConfigs) {
      console.log(`--- ${config.name} ---`);
      
      const startTime = Date.now();
      const result = await service.processDocument(testImagePath, config.options);
      const endTime = Date.now();
      
      console.log(`Success: ${result.success}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Processing Time: ${endTime - startTime}ms`);
      console.log(`Word Count: ${result.wordCount}`);
      console.log(`Preprocessing: ${result.preprocessingOperations.join(', ')}`);
      
      if (result.text) {
        const preview = result.text.length > 100 
          ? result.text.substring(0, 100) + '...' 
          : result.text;
        console.log(`Text Preview: "${preview}"`);
      }
      
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    service.cleanup();
    
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
    console.log('🧹 Cleanup completed');
  }
  
  console.log('🎉 Enhanced OCR Service test completed!');
}

// Run the test
testEnhancedService().catch(console.error);
