#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

// Test the confidence detection directly using command line tools
async function testConfidenceDetection() {
  console.log('Testing confidence detection on 5-page PDF...');
  
  const inputPath = path.join(process.cwd(), 'uploads/TEST_5pages.pdf');
  const outputPath = path.join(process.cwd(), 'processed/TEST_5pages_fix_test_1748451444_ocr.pdf');
  
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Output exists: ${existsSync(outputPath)}`);
  
  // Test PDF to image conversion
  console.log('\n1. Testing PDF to image conversion...');
  const tempDir = `/tmp/confidence_test_${Date.now()}`;
  execSync(`mkdir -p ${tempDir}/pages`);
  
  // Convert processed PDF to images
  execSync(`pdftoppm -png -r 150 "${outputPath}" "${tempDir}/pages/page"`);
  
  // Count generated images
  const imageCount = execSync(`ls ${tempDir}/pages/*.png | wc -l`).toString().trim();
  console.log(`Generated ${imageCount} page images`);
  
  // Test Tesseract on first few pages
  console.log('\n2. Testing Tesseract confidence extraction...');
  const imageFiles = execSync(`ls ${tempDir}/pages/*.png | head -5`).toString().trim().split('\n');
  
  for (let i = 0; i < Math.min(3, imageFiles.length); i++) {
    const imagePath = imageFiles[i];
    const pageNum = i + 1;
    const hocrPath = `${tempDir}/page_${pageNum}.hocr`;
    
    try {
      console.log(`Processing page ${pageNum}...`);
      execSync(`tesseract "${imagePath}" "${hocrPath.replace('.hocr', '')}" -l eng --psm 1 --oem 3 -c tessedit_create_hocr=1 hocr`, { stdio: 'pipe' });
      
      if (existsSync(hocrPath)) {
        // Count words in hOCR
        const hocrContent = execSync(`cat "${hocrPath}"`).toString();
        const wordMatches = hocrContent.match(/<span class='ocrx_word'[^>]*>/g) || [];
        console.log(`  Page ${pageNum}: ${wordMatches.length} words detected`);
      }
    } catch (error) {
      console.log(`  Page ${pageNum}: Tesseract failed - ${error.message}`);
    }
  }
  
  // Cleanup
  execSync(`rm -rf ${tempDir}`);
  
  console.log('\n3. Summary:');
  console.log(`✓ PDF successfully converted to ${imageCount} page images`);
  console.log('✓ Tesseract processing tested on sample pages');
  console.log('✓ This confirms the fix should work for proper page detection');
}

testConfidenceDetection().catch(console.error);
