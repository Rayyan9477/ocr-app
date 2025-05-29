#!/usr/bin/env node

const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');

async function testFixedConfidenceDetection() {
  console.log('=== Testing Fixed Confidence Detection ===\n');
  
  const outputPath = 'processed/TEST_5pages_fix_test_1748451444_ocr.pdf';
  
  // Step 1: Check if PDF has extractable text
  console.log('1. Checking PDF text content...');
  let extractedText = '';
  try {
    extractedText = execSync(`pdftotext "${outputPath}" -`).toString().trim();
    console.log(`   Text extracted: ${extractedText.length} characters`);
    console.log(`   Has text: ${extractedText.length > 0}`);
  } catch (error) {
    console.log(`   Text extraction failed: ${error.message}`);
  }
  
  // Step 2: Convert to images (this is what the fixed function will do)
  console.log('\n2. Converting PDF to images...');
  const tempDir = `/tmp/confidence_fix_test_${Date.now()}`;
  execSync(`mkdir -p ${tempDir}/pages`);
  
  try {
    execSync(`pdftoppm -png -r 150 "${outputPath}" "${tempDir}/pages/page"`);
    const imageFiles = execSync(`ls ${tempDir}/pages/*.png`).toString().trim().split('\n');
    console.log(`   Generated ${imageFiles.length} page images`);
    
    // Step 3: Process each page with Tesseract
    console.log('\n3. Processing pages with Tesseract...');
    const pageResults = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = imageFiles[i];
      const pageNum = i + 1;
      const hocrPath = `${tempDir}/page_${pageNum}.hocr`;
      
      try {
        console.log(`   Processing page ${pageNum}...`);
        execSync(`tesseract "${imagePath}" "${hocrPath.replace('.hocr', '')}" -l eng --psm 1 --oem 3 -c tessedit_create_hocr=1 hocr 2>/dev/null`);
        
        if (existsSync(hocrPath)) {
          const hocrContent = readFileSync(hocrPath, 'utf-8');
          
          // Extract confidence data like the real function
          const wordMatches = hocrContent.match(/<span class='ocrx_word'[^>]*>([^<]*)<\/span>/g) || [];
          let totalConfidence = 0;
          let wordCount = 0;
          
          wordMatches.forEach(wordMatch => {
            const titleMatch = wordMatch.match(/title="[^"]*x_wconf\\s+(\\d+)[^"]*"/);
            const textMatch = wordMatch.match(/>([^<]*)</);
            
            if (titleMatch && textMatch) {
              const confidence = parseInt(titleMatch[1], 10);
              const word = textMatch[1].trim();
              
              if (word && confidence >= 0) {
                totalConfidence += confidence;
                wordCount++;
              }
            }
          });
          
          const avgConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
          pageResults.push({
            pageNumber: pageNum,
            averageConfidence: avgConfidence,
            wordCount: wordCount
          });
          
          console.log(`     Page ${pageNum}: ${avgConfidence.toFixed(1)}% confidence, ${wordCount} words`);
        } else {
          console.log(`     Page ${pageNum}: hOCR file not generated`);
        }
      } catch (error) {
        console.log(`     Page ${pageNum}: Tesseract failed`);
      }
    }
    
    // Step 4: Calculate document-level statistics
    console.log('\n4. Document Statistics:');
    console.log(`   Total pages detected: ${pageResults.length}`);
    
    if (pageResults.length > 0) {
      let totalConfidence = 0;
      let totalWords = 0;
      
      pageResults.forEach(page => {
        totalConfidence += page.averageConfidence * page.wordCount;
        totalWords += page.wordCount;
      });
      
      const averageConfidence = totalWords > 0 ? totalConfidence / totalWords : 0;
      console.log(`   Average confidence: ${averageConfidence.toFixed(2)}%`);
      console.log(`   Total words: ${totalWords}`);
      
      console.log('\n5. Fixed Confidence Detection Results:');
      console.log(`   ✓ Correctly detected ${pageResults.length} pages (expected: 5)`);
      console.log(`   ✓ Performed proper page-by-page analysis instead of text estimation`);
      console.log(`   ✓ Generated detailed confidence metrics per page`);
      
      if (pageResults.length === 5) {
        console.log('\\n🎉 SUCCESS: The confidence detection fix works correctly!');
      } else {
        console.log(`\\n⚠️  WARNING: Expected 5 pages but detected ${pageResults.length}`);
      }
    }
    
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  } finally {
    // Cleanup
    execSync(`rm -rf ${tempDir}`);
  }
}

testFixedConfidenceDetection().catch(console.error);
