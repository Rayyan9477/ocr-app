// Increase timeout for model loading tests
jest.setTimeout(30000);

// Mock environment variables if needed
process.env.MODEL_CACHE_DIR = './.model-cache';
process.env.ENABLE_GPU = 'false';

// Global test setup
beforeAll(() => {
  // Ensure model cache directory exists
  const fs = require('fs');
  if (!fs.existsSync(process.env.MODEL_CACHE_DIR)) {
    fs.mkdirSync(process.env.MODEL_CACHE_DIR, { recursive: true });
  }
});
