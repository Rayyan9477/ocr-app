import { OCREngineFactory } from '../lib/models/ocr-engine-factory';
import { NanoVLMService } from '../lib/models/nanovlm-service';
import fs from 'fs';
import path from 'path';

describe('NanoVLM Integration Tests', () => {
  let factory: OCREngineFactory;
  let engine: NanoVLMService;

  beforeAll(async () => {
    factory = OCREngineFactory.getInstance();
    engine = await factory.getPreferredEngine('nanovlm') as NanoVLMService;
  });

  describe('Basic Functionality', () => {
    it('should initialize the NanoVLM engine', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(NanoVLMService);
    });

    it('should have required configuration', () => {
      expect(engine.modelPath).toBeDefined();
      expect(engine.isAvailable()).resolves.toBe(true);
    });
  });

  describe('Document Processing', () => {
    const testImagesDir = path.join(process.cwd(), 'test-images');
    
    beforeAll(() => {
      // Ensure test images directory exists
      if (!fs.existsSync(testImagesDir)) {
        fs.mkdirSync(testImagesDir, { recursive: true });
      }
    });

    it('should process handwritten text', async () => {
      const testImage = path.join(testImagesDir, 'test_handwritten.png');
      const result = await engine.processImage(testImage);
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });

    it('should handle complex layouts', async () => {
      const testImage = path.join(testImagesDir, 'test_vlm_input.png');
      const result = await engine.processImage(testImage);
      expect(result).toBeDefined();
      expect(result.layout).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      await expect(engine.processImage('nonexistent.png'))
        .rejects.toThrow();
    });

    it('should handle unsupported file types', async () => {
      const testFile = path.join(process.cwd(), 'test-images', 'test_text.txt');
      await expect(engine.processImage(testFile))
        .rejects.toThrow(/Unsupported file type/);
    });
  });
});
