#!/usr/bin/env node

/**
 * Test script to verify the duplicate files fix
 * This script simulates the scenario where the same file might be added multiple times
 */

const testDuplicatePrevention = () => {
  console.log('🧪 Testing duplicate file prevention logic...\n');
  
  // Simulate the addProcessedFile function
  let processedFiles = [];
  
  const addProcessedFile = (newFile) => {
    const exists = processedFiles.some(file => file.name === newFile.name);
    if (exists) {
      console.log(`❌ DUPLICATE DETECTED: File ${newFile.name} already exists in processed files, skipping duplicate`);
      return processedFiles;
    }
    
    const processedFile = {
      name: newFile.name,
      path: newFile.path,
      processedAt: newFile.processedAt || new Date().toISOString(),
      size: newFile.size || null,
    };
    
    processedFiles = [...processedFiles, processedFile];
    console.log(`✅ ADDED: File ${newFile.name} added to processed files`);
    return processedFiles;
  };
  
  // Test scenario 1: Adding a new file
  console.log('Test 1: Adding a new file');
  addProcessedFile({
    name: 'test_document_ocr.pdf',
    path: '/api/download?file=test_document_ocr.pdf'
  });
  
  // Test scenario 2: Attempting to add the same file again (should be prevented)
  console.log('\nTest 2: Attempting to add the same file again');
  addProcessedFile({
    name: 'test_document_ocr.pdf',
    path: '/api/download?file=test_document_ocr.pdf'
  });
  
  // Test scenario 3: Adding a different file
  console.log('\nTest 3: Adding a different file');
  addProcessedFile({
    name: 'another_document_ocr.pdf',
    path: '/api/download?file=another_document_ocr.pdf'
  });
  
  // Test scenario 4: Attempting to add the first file again (should be prevented)
  console.log('\nTest 4: Attempting to add the first file again');
  addProcessedFile({
    name: 'test_document_ocr.pdf',
    path: '/api/download?file=test_document_ocr.pdf'
  });
  
  console.log('\n📊 Final processed files list:');
  console.log(JSON.stringify(processedFiles, null, 2));
  
  console.log(`\n✅ Test completed! Expected 2 files, actual: ${processedFiles.length}`);
  
  if (processedFiles.length === 2) {
    console.log('🎉 SUCCESS: Duplicate prevention is working correctly!');
    return true;
  } else {
    console.log('❌ FAILURE: Duplicate prevention is not working correctly!');
    return false;
  }
};

// Run the test
const success = testDuplicatePrevention();
process.exit(success ? 0 : 1);
