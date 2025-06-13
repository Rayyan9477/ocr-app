import { extractConfidenceScores } from './lib/confidence-detector';
import { normalizeConfidenceData, getConfidenceValue } from './lib/confidence-utils';

async function debugConfidencePages() {
    try {
        const inputFile = './uploads/test_3page.pdf';
        const outputFile = './processed/debug_output.pdf'; // Temporary output path
        console.log(`\n=== Debugging Confidence Page Detection ===`);
        console.log(`Testing file: ${inputFile}`);
        
        // Call the confidence extraction function
        const result = await extractConfidenceScores(inputFile, outputFile, false);
        
        if (result) {
            // Normalize confidence data to ensure consistent structure
            const normalizedConfidence = normalizeConfidenceData(result);
            
            console.log('\n=== Results ===');
            console.log('Page Count:', result.pageConfidences?.length || 0);
            console.log('Average Confidence:', getConfidenceValue(normalizedConfidence).toFixed(2) + '%');
            console.log('Has Low Confidence Pages:', result.hasLowConfidencePages);
            console.log('Warning Pages:', result.warningPages);
            console.log('Error Pages:', result.errorPages);
            
            console.log('\n=== Per-Page Details ===');
            if (result.pageConfidences && Array.isArray(result.pageConfidences)) {
                result.pageConfidences.forEach(page => {
                    if (page && typeof page === 'object') {
                        const pageConfidence = typeof page.averageConfidence === 'number' 
                            ? page.averageConfidence.toFixed(2) + '%' 
                            : 'unknown';
                        const wordCount = typeof page.wordCount === 'number' ? page.wordCount : 'unknown';
                        console.log(`Page ${page.pageNumber}: ${pageConfidence} confidence, ${wordCount} words`);
                    }
                });
            } else {
                console.log('No detailed page confidence data available');
            }
            
            console.log('\n=== Normalized Confidence Data ===');
            console.log(JSON.stringify(normalizedConfidence, null, 2));
        } else {
            console.log('❌ No confidence data returned - function returned null');
        }
        
        console.log('\n=== Debug Complete ===');
        
    } catch (error) {
        console.error('Error during debug:', error);
    }
}

debugConfidencePages();
