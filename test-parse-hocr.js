#!/usr/bin/env node

const fs = require('fs');

// Simple test of the hOCR parsing logic
function testParseHocrConfidence(hocrContent) {
  console.log('Testing hOCR parsing...\n');
  
  const pages = [];
  
  // Use a more robust method to extract pages by finding page divs and matching closing tags
  const pageRegex = /<div class='ocr_page'[^>]*>/g;
  let pageMatch;
  const pageStarts = [];
  
  // Find all page start positions
  while ((pageMatch = pageRegex.exec(hocrContent)) !== null) {
    pageStarts.push(pageMatch.index);
  }
  
  console.log(`Found ${pageStarts.length} pages`);
  
  if (pageStarts.length === 0) {
    console.log('❌ No pages found in hOCR');
    return pages;
  }
  
  // Process each page
  pageStarts.forEach((pageStart, pageIndex) => {
    console.log(`\nProcessing page ${pageIndex + 1}:`);
    
    // Find the content for this page
    let pageContent;
    
    if (pageIndex < pageStarts.length - 1) {
      // Not the last page - content goes until the next page starts
      pageContent = hocrContent.substring(pageStart, pageStarts[pageIndex + 1]);
    } else {
      // Last page - content goes until </body>
      const bodyEndIndex = hocrContent.indexOf('</body>');
      pageContent = hocrContent.substring(pageStart, bodyEndIndex > -1 ? bodyEndIndex : hocrContent.length);
    }
    
    // Extract words with confidence scores from this page
    const wordMatches = pageContent.match(/<span class='ocrx_word'[^>]*>([^<]*)<\/span>/g) || [];
    
    console.log(`  Found ${wordMatches.length} word matches`);
    
    const words = [];
    let totalConfidence = 0;
    let wordCount = 0;

    wordMatches.forEach((wordMatch, wordIndex) => {
      // Extract confidence score from title attribute (handle both single and double quotes)
      const titleMatch = wordMatch.match(/title=['"][^'"]*x_wconf\s+(\d+)[^'"]*['"]/) || 
                        wordMatch.match(/x_wconf\s+(\d+)/);
      const textMatch = wordMatch.match(/>([^<]*)</);
      const bboxMatch = wordMatch.match(/bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      
      if (wordIndex < 3) { // Show first few words for debugging
        console.log(`    Word ${wordIndex + 1}: "${wordMatch}"`);
        console.log(`      titleMatch: ${titleMatch ? titleMatch[1] : 'null'}`);
        console.log(`      textMatch: ${textMatch ? textMatch[1] : 'null'}`);
        console.log(`      bboxMatch: ${bboxMatch ? 'found' : 'null'}`);
      }
      
      if (titleMatch && textMatch && bboxMatch) {
        const confidence = parseInt(titleMatch[1], 10);
        const word = textMatch[1].trim();
        const bbox = {
          x0: parseInt(bboxMatch[1], 10),
          y0: parseInt(bboxMatch[2], 10),
          x1: parseInt(bboxMatch[3], 10),
          y1: parseInt(bboxMatch[4], 10),
        };

        if (word && confidence >= 0) {
          totalConfidence += confidence;
          wordCount++;

          // Store low confidence words (below 85% threshold)
          if (confidence < 85) {
            words.push({ word, confidence, bbox });
          }
        }
      }
    });

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
    
    console.log(`  Total confidence: ${totalConfidence}`);
    console.log(`  Word count: ${wordCount}`);
    console.log(`  Average confidence: ${averageConfidence.toFixed(2)}%`);
    console.log(`  Low confidence words: ${words.length}`);

    pages.push({
      pageNumber: pageIndex + 1,
      averageConfidence,
      wordCount,
      lowConfidenceWords: words,
    });
  });

  return pages;
}

// Test with the hOCR file
const hocrPath = '/tmp/test_output.hocr';

if (fs.existsSync(hocrPath)) {
  const hocrContent = fs.readFileSync(hocrPath, 'utf-8');
  console.log(`Loaded hOCR file: ${hocrPath}`);
  console.log(`Content length: ${hocrContent.length} characters\n`);
  
  const result = testParseHocrConfidence(hocrContent);
  
  console.log('\n=== FINAL RESULT ===');
  console.log(`Pages processed: ${result.length}`);
  
  result.forEach(page => {
    console.log(`Page ${page.pageNumber}: ${page.averageConfidence.toFixed(2)}% (${page.wordCount} words)`);
  });
  
  if (result.length > 0) {
    const overallConfidence = result.reduce((sum, page) => sum + page.averageConfidence * page.wordCount, 0) / 
                             result.reduce((sum, page) => sum + page.wordCount, 0);
    console.log(`Overall confidence: ${overallConfidence.toFixed(2)}%`);
    
    if (overallConfidence === 0) {
      console.log('\n❌ ISSUE: Confidence is 0.0% - debugging...');
    } else {
      console.log('\n✓ Confidence calculation working correctly');
    }
  }
  
} else {
  console.log(`❌ hOCR file not found: ${hocrPath}`);
  console.log('Please run: tesseract test_page-01.jpg /tmp/test_output -l eng --psm 1 hocr');
}
