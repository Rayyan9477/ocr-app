const { extractConfidenceScores } = require('./lib/confidence-detector.ts');
const path = require('path');

async function testConfidenceFix() {
  console.log('Testing confidence detection fix...');
  
  const inputPath = path.join(process.cwd(), 'uploads/TEST_5pages.pdf');
  const outputPath = path.join(process.cwd(), 'processed/TEST_5pages_confidence_test.pdf');
  
  try {
    // Test with processed file (useProcessedFile = true) 
    console.log('Testing with processed file analysis...');
    const confidenceData = await extractConfidenceScores(inputPath, outputPath, true);
    
    if (confidenceData) {
      console.log('✓ Confidence data extracted successfully');
      console.log(`Page count detected: ${confidenceData.pageConfidences.length}`);
      console.log(`Average confidence: ${confidenceData.averageConfidence.toFixed(2)}%`);
      console.log('Pages:', confidenceData.pageConfidences.map(p => ({
        page: p.pageNumber,
        confidence: p.averageConfidence,
        wordCount: p.wordCount
      })));
    } else {
      console.log('✗ No confidence data returned');
    }
  } catch (error) {
    console.error('Error testing confidence fix:', error.message);
  }
}

testConfidenceFix();
