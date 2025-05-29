const sample = "title='bbox 158 232 317 260; x_wconf 89'";
console.log('Sample title:', sample);

// Test different patterns
const patterns = [
  /title="[^"]*x_wconf\s+(\d+)[^"]*"/,
  /title='[^']*x_wconf\s+(\d+)[^']*/,
  /x_wconf\s+(\d+)/
];

patterns.forEach((pattern, i) => {
  const match = sample.match(pattern);
  console.log(`Pattern ${i+1}:`, pattern.toString(), '-> Match:', match ? match[1] : 'null');
});

// Test the actual word match from hOCR
const wordMatch = "<span class='ocrx_word' id='word_1_1' title='bbox 158 232 317 260; x_wconf 89'>rayyan9477/todo-backend</span>";
console.log('\nActual word match:', wordMatch);

const titleMatch = wordMatch.match(/title='[^']*x_wconf\s+(\d+)[^']*/);
console.log('Title match result:', titleMatch);
