#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the confidence detector function (need to handle TypeScript compilation)
async function loadConfidenceDetector() {
  try {
    // Try importing the compiled JS version
    const module = await import('./lib/confidence-detector.js');
    return module;
  } catch (e) {
    console.log('Could not import compiled JS, testing with direct TypeScript...');
    console.log('Error:', e.message);
    return null;
  }
}

async function testConfidenceDetection() {
  console.log('Testing confidence detection...\n');
  
  // Load the confidence detector
  const confidenceModule = await loadConfidenceDetector();
  if (!confidenceModule) {
    console.log('❌ Could not load confidence detector module');
    return;
  }
  
  const { extractConfidenceScores } = confidenceModule;
  
  // Create a test PDF with some text
  const testPdfPath = path.join(__dirname, 'test_page-01.jpg');
  
  if (!fs.existsSync(testPdfPath)) {
    console.log('Test file not found, creating one...');
    return;
  }
  
  console.log(`Testing with file: ${testPdfPath}`);
  
  try {
    const confidenceData = await extractConfidenceScores(
      testPdfPath,
      testPdfPath.replace('.jpg', '_processed.pdf'),
      false
    );
    
    console.log('\n=== CONFIDENCE DETECTION RESULTS ===');
    
    if (!confidenceData) {
      console.log('❌ No confidence data returned');
      return;
    }
    
    console.log(`✓ Document ID: ${confidenceData.documentId}`);
    console.log(`✓ Average Confidence: ${confidenceData.averageConfidence.toFixed(2)}%`);
    console.log(`✓ Pages Processed: ${confidenceData.pageConfidences.length}`);
    console.log(`✓ Warning Pages: ${confidenceData.warningPages.length}`);
    console.log(`✓ Error Pages: ${confidenceData.errorPages.length}`);
    
    // Print page-by-page details
    console.log('\n=== PAGE DETAILS ===');
    confidenceData.pageConfidences.forEach(page => {
      console.log(`Page ${page.pageNumber}:`);
      console.log(`  - Average Confidence: ${page.averageConfidence.toFixed(2)}%`);
      console.log(`  - Word Count: ${page.wordCount}`);
      console.log(`  - Low Confidence Words: ${page.lowConfidenceWords.length}`);
      
      if (page.lowConfidenceWords.length > 0) {
        console.log(`  - Sample low confidence words:`);
        page.lowConfidenceWords.slice(0, 5).forEach(word => {
          console.log(`    * "${word.word}" (${word.confidence}%)`);
        });
      }
    });
    
    if (confidenceData.averageConfidence === 0) {
      console.log('\n❌ ISSUE DETECTED: Confidence is 0.0%');
      console.log('This indicates a problem with confidence calculation.');
      console.log('Checking page details for debugging...');
      
      confidenceData.pageConfidences.forEach(page => {
        if (page.wordCount === 0) {
          console.log(`❌ Page ${page.pageNumber} has 0 words - OCR may have failed`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error during confidence detection:', error);
  }
}

// Run the test
testConfidenceDetection().catch(console.error);
