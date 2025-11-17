/**
 * Create comprehensive test images for OCR testing
 */

import sharp from 'sharp';

console.log('Creating test images for OCR testing...\n');

// Test 1: Simple text document
const test1 = Buffer.from(`
<svg width='800' height='600' xmlns='http://www.w3.org/2000/svg'>
  <rect width='800' height='600' fill='white'/>
  <text x='50' y='100' font-family='Arial, sans-serif' font-size='48' fill='black' font-weight='bold'>Invoice #12345</text>
  <text x='50' y='180' font-family='Arial, sans-serif' font-size='24' fill='black'>Date: November 14, 2025</text>
  <text x='50' y='230' font-family='Arial, sans-serif' font-size='24' fill='black'>Customer: John Doe</text>
  <text x='50' y='330' font-family='Arial, sans-serif' font-size='20' fill='black' font-weight='bold'>Items:</text>
  <text x='70' y='370' font-family='Arial, sans-serif' font-size='18' fill='black'>1. Product A - $100.00</text>
  <text x='70' y='400' font-family='Arial, sans-serif' font-size='18' fill='black'>2. Product B - $250.00</text>
  <text x='70' y='430' font-family='Arial, sans-serif' font-size='18' fill='black'>3. Product C - $75.50</text>
  <text x='50' y='500' font-family='Arial, sans-serif' font-size='24' fill='black' font-weight='bold'>Total: $425.50</text>
</svg>
`);

await sharp(test1).png().toFile('test-invoice.png');
console.log('✓ Created test-invoice.png');

// Test 2: Multi-line paragraph
const test2 = Buffer.from(`
<svg width='800' height='600' xmlns='http://www.w3.org/2000/svg'>
  <rect width='800' height='600' fill='white'/>
  <text x='50' y='80' font-family='Arial, sans-serif' font-size='32' fill='black' font-weight='bold'>Sample Document</text>
  <text x='50' y='150' font-family='Arial, sans-serif' font-size='18' fill='black'>This is a test document for optical character recognition.</text>
  <text x='50' y='185' font-family='Arial, sans-serif' font-size='18' fill='black'>The OCR service should be able to extract all text from</text>
  <text x='50' y='220' font-family='Arial, sans-serif' font-size='18' fill='black'>this image accurately and efficiently.</text>
  <text x='50' y='290' font-family='Arial, sans-serif' font-size='18' fill='black'>Key features to test:</text>
  <text x='70' y='330' font-family='Arial, sans-serif' font-size='16' fill='black'>- Multi-line text extraction</text>
  <text x='70' y='360' font-family='Arial, sans-serif' font-size='16' fill='black'>- Different font sizes</text>
  <text x='70' y='390' font-family='Arial, sans-serif' font-size='16' fill='black'>- Punctuation and special characters</text>
  <text x='70' y='420' font-family='Arial, sans-serif' font-size='16' fill='black'>- Numbers: 1234567890</text>
</svg>
`);

await sharp(test2).png().toFile('test-document.png');
console.log('✓ Created test-document.png');

// Test 3: Receipt-style
const test3 = Buffer.from(`
<svg width='600' height='800' xmlns='http://www.w3.org/2000/svg'>
  <rect width='600' height='800' fill='white'/>
  <text x='300' y='60' font-family='Arial, sans-serif' font-size='28' fill='black' font-weight='bold' text-anchor='middle'>RECEIPT</text>
  <text x='50' y='120' font-family='Arial, sans-serif' font-size='16' fill='black'>Store Name: Tech Shop</text>
  <text x='50' y='150' font-family='Arial, sans-serif' font-size='16' fill='black'>Location: 123 Main Street</text>
  <text x='50' y='180' font-family='Arial, sans-serif' font-size='16' fill='black'>Date: 2025-11-14 10:30 AM</text>
  <line x1='50' y1='200' x2='550' y2='200' stroke='black' stroke-width='2'/>
  <text x='50' y='240' font-family='Arial, sans-serif' font-size='16' fill='black' font-weight='bold'>ITEMS</text>
  <text x='50' y='280' font-family='Arial, sans-serif' font-size='14' fill='black'>Laptop Computer    $1,299.99</text>
  <text x='50' y='310' font-family='Arial, sans-serif' font-size='14' fill='black'>Wireless Mouse     $29.99</text>
  <text x='50' y='340' font-family='Arial, sans-serif' font-size='14' fill='black'>USB Cable          $12.50</text>
  <line x1='50' y1='360' x2='550' y2='360' stroke='black' stroke-width='1'/>
  <text x='50' y='400' font-family='Arial, sans-serif' font-size='16' fill='black' font-weight='bold'>Subtotal: $1,342.48</text>
  <text x='50' y='430' font-family='Arial, sans-serif' font-size='16' fill='black'>Tax (8%): $107.40</text>
  <text x='50' y='470' font-family='Arial, sans-serif' font-size='20' fill='black' font-weight='bold'>TOTAL: $1,449.88</text>
  <text x='300' y='550' font-family='Arial, sans-serif' font-size='14' fill='gray' text-anchor='middle'>Thank you for your purchase!</text>
</svg>
`);

await sharp(test3).png().toFile('test-receipt.png');
console.log('✓ Created test-receipt.png');

console.log('\n✓ All test images created successfully!');
console.log('Ready for OCR processing tests.\n');
