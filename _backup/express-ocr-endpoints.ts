import express from 'express';
import path from 'path';
import multer from 'multer';
import { DocumentAnalyzer } from '../lib/document-analyzer';
import { IntelligentOrchestrator } from '../lib/intelligent-orchestrator';
import { MultiEngineOCR } from '../lib/multi-engine-ocr';
import { ResultMerger } from '../lib/result-merger';
import { ParameterOptimizer } from '../lib/parameter-optimizer';
import logger from '../lib/logger';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize services
const documentAnalyzer = new DocumentAnalyzer();
const multiEngineOCR = new MultiEngineOCR();
const resultMerger = new ResultMerger();
const orchestrator = new IntelligentOrchestrator(multiEngineOCR, resultMerger);
const parameterOptimizer = new ParameterOptimizer();

// Standard OCR endpoint
router.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const documentAnalysis = await documentAnalyzer.analyzeDocument(filePath);
    
    const result = await orchestrator.processDocument(filePath, documentAnalysis);
    res.json(result);
  } catch (error) {
    logger.error(`OCR API error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Specialized endpoint for handwritten documents
router.post('/ocr/handwritten', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const documentAnalysis = await documentAnalyzer.analyzeDocument(filePath);
    
    // Force handwriting mode
    documentAnalysis.hasHandwriting = true;
    
    const result = await orchestrator.processDocument(filePath, documentAnalysis);
    res.json(result);
  } catch (error) {
    logger.error(`Handwritten OCR API error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Specialized endpoint for tabular documents
router.post('/ocr/table', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const documentAnalysis = await documentAnalyzer.analyzeDocument(filePath);
    
    // Force table mode
    documentAnalysis.hasTables = true;
    
    const result = await orchestrator.processDocument(filePath, documentAnalysis);
    res.json(result);
  } catch (error) {
    logger.error(`Table OCR API error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Specialized endpoint for poor quality documents
router.post('/ocr/poor-quality', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const documentAnalysis = await documentAnalyzer.analyzeDocument(filePath);
    
    // Force poor quality mode
    documentAnalysis.poorQuality = true;
    
    const result = await orchestrator.processDocument(filePath, documentAnalysis);
    res.json(result);
  } catch (error) {
    logger.error(`Poor quality OCR API error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Engine selection endpoint
router.post('/ocr/engine/:engineName', upload.single('image'), async (req, res) => {
  try {
    const { engineName } = req.params;
    const filePath = req.file.path;
    
    const result = await multiEngineOCR.processWithEngine(
      engineName,
      filePath,
      path.join(process.cwd(), 'output'),
      req.body.documentType
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Engine-specific OCR API error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
