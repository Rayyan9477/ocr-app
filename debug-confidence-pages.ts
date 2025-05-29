import { extractConfidenceScores } from './lib/confidence-detector';

async function debugConfidencePages() {
    try {
        const inputFile = './uploads/test_3page.pdf';
        const outputFile = './processed/debug_output.pdf'; // Temporary output path
        console.log(`\n=== Debugging Confidence Page Detection ===`);
        console.log(`Testing file: ${inputFile}`);
        
        // Call the confidence extraction function
        const result = await extractConfidenceScores(inputFile, outputFile, false);
        
        if (result) {
            console.log('\n=== Results ===');
            console.log('Page Count:', result.pageConfidences.length);
            console.log('Average Confidence:', result.averageConfidence);
            console.log('Has Low Confidence Pages:', result.hasLowConfidencePages);
            console.log('Warning Pages:', result.warningPages);
            console.log('Error Pages:', result.errorPages);
            
            console.log('\n=== Per-Page Details ===');
            result.pageConfidences.forEach(page => {
                console.log(`Page ${page.pageNumber}: ${page.averageConfidence.toFixed(2)}% confidence, ${page.wordCount} words`);
            });
        } else {
            console.log('❌ No confidence data returned - function returned null');
        }
        
        console.log('\n=== Debug Complete ===');
        
    } catch (error) {
        console.error('Error during debug:', error);
    }
}

debugConfidencePages();
