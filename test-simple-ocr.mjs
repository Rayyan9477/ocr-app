/**
 * Simple test to verify OCR service can be loaded
 */

import { createWorker } from 'tesseract.js';

console.log('Testing Simple OCR Service...\n');

try {
  console.log('✓ tesseract.js module loaded successfully');

  // Test worker creation
  console.log('\nCreating Tesseract worker...');
  const worker = await createWorker('eng');
  console.log('✓ Tesseract worker created successfully');

  await worker.terminate();
  console.log('✓ Worker terminated successfully');

  console.log('\n=== All checks passed ===');
  console.log('✓ Simple OCR service is ready to use!');
  process.exit(0);

} catch (error) {
  console.error('\n✗ Test failed:', error.message);
  process.exit(1);
}
