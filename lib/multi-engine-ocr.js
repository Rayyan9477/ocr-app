/**
 * Multi-engine OCR implementation with VLM enhancement
 * Integrates OCRmyPDF, Tesseract, Enhanced Tesseract, and PaliGemma2 VLM
 */

import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import createTesseractWorker from './tesseract-worker.js';
import { PaliGemma2Simple } from './paligemma2-simple.js';

const execAsync = promisify(exec);

// Simple logger implementation
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

class MultiEngineOCR {
    constructor(options = {}) {
        this.confidence = options.confidence || 0.85;
        this.worker = null;
        this.paligemma2 = null;
        this.engines = {
            tesseract: this.processTesseract.bind(this),
            'enhanced-tesseract': this.processEnhancedTesseract.bind(this),
            ocrmypdf: this.processOcrMyPdf.bind(this),
            paligemma2: this.processPaliGemma2.bind(this),
            ensemble: this.processWithEnsemble.bind(this)
        };
        this.logger = logger;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.logger.info('Initializing MultiEngineOCR with all engines');
            
            // Initialize PaliGemma2 VLM (optional)
            try {
                this.paligemma2 = new PaliGemma2Simple();
                const vlmInitialized = await this.paligemma2.initialize();
                if (vlmInitialized) {
                    this.logger.info('PaliGemma2 VLM initialized successfully');
                } else {
                    this.logger.warn('PaliGemma2 VLM partially initialized (processor only)');
                }
            } catch (error) {
                this.logger.warn('PaliGemma2 VLM initialization failed, continuing without VLM:', error.message);
                this.paligemma2 = null;
            }

            // Initialize Tesseract worker (optional) with robust error handling
            try {
                this.logger.info('Attempting to initialize Tesseract worker...');
                
                // Skip Tesseract worker initialization in server environments
                const isServerEnvironment = typeof window === 'undefined' || 
                    process.env.NEXT_RUNTIME === 'nodejs' || 
                    process.env.NEXT_RUNTIME === 'edge';
                
                if (isServerEnvironment) {
                    this.logger.warn('Skipping Tesseract worker in server environment - will use command-line fallback');
                    throw new Error('Server environment detected - skipping Tesseract worker');
                }
                
                // Wrap in additional error handling to prevent uncaught exceptions
                try {
                    const workerPromise = createTesseractWorker();
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Tesseract initialization timeout')), 5000)
                    );
                    
                    this.worker = await Promise.race([workerPromise, timeoutPromise]);
                    this.logger.info('Tesseract worker initialized successfully');
                } catch (workerError) {
                    throw new Error(`Worker creation failed: ${workerError.message}`);
                }
            } catch (error) {
                this.logger.warn('Tesseract worker initialization failed, will use command-line fallback:', error.message);
                this.worker = null;
                // Ensure any orphaned workers are cleaned up
                try {
                    if (this.worker && this.worker.terminate) {
                        await this.worker.terminate();
                    }
                } catch (cleanupError) {
                    this.logger.warn('Failed to cleanup failed Tesseract worker:', cleanupError.message);
                }
                this.worker = null;
            }

            this.isInitialized = true;
            const availableEngines = this.getAvailableEngines();
            this.logger.info(`MultiEngineOCR initialized successfully with engines: ${availableEngines.join(', ')}`);
        } catch (error) {
            this.logger.error('Failed to initialize MultiEngineOCR:', error);
            // Don't throw - allow partial initialization
            this.isInitialized = true;
        }
    }

    async processDocument(inputPath, outputDir = null, options = {}) {
        await this.initialize();
        this.logger.info('Processing document with multi-engine OCR:', inputPath);
        const startTime = Date.now();
        // Set default output directory
        if (!outputDir) {
            outputDir = path.join(process.cwd(), 'processed');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
        }
        try {
            // Use ensemble processing for best results
            const result = await this.processWithEnsemble(inputPath, outputDir, options);
            const processingTime = Date.now() - startTime;
            return {
                ...result,
                totalProcessingTime: processingTime,
                enhancedText: this.enhanceText(result.text || '')
            };
        } catch (error) {
            this.logger.error('Error processing document:', error);
            throw error;
        }
    }

    /**
     * Process with ensemble of all available engines for optimal results
     */
    async processWithEnsemble(inputPath, outputDir, options = {}) {
        await this.initialize();
        const {
            useVlmEnhancement = true,
            confidenceThreshold = 0.75,
            documentType = 'general',
            useAllEngines = true,
            preprocessingRecommendations = null
        } = options;
        this.logger.info(`Processing with ensemble: ${inputPath}`);
        this.logger.info(`Options: VLM=${useVlmEnhancement}, type=${documentType}, useAll=${useAllEngines}`);
        const results = [];
        const errors = [];
        // Define processing order based on document type and availability
        const processingOrder = this.getOptimalProcessingOrder(documentType, useAllEngines);
        this.logger.info(`Using engines in order: ${processingOrder.join(', ')}`);
        // Process with each engine in parallel for speed
        const enginePromises = processingOrder.map(async (engineName) => {
            try {
                this.logger.info(`Starting ${engineName} processing`);
                const startTime = Date.now();
                const result = await this.engines[engineName](inputPath, outputDir, documentType);
                const processingTime = Date.now() - startTime;
                return { 
                    ...result, 
                    engine: engineName,
                    engineProcessingTime: processingTime
                };
            } catch (error) {
                this.logger.warn(`Engine ${engineName} failed: ${error.message}`);
                errors.push({ engine: engineName, error: error.message });
                return null;
            }
        });
        // Wait for all engines to complete (or fail)
        const engineResults = await Promise.allSettled(enginePromises);
        // Collect successful results
        engineResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                results.push(result.value);
            }
        });
        if (results.length === 0) {
            throw new Error(`All OCR engines failed. Errors: ${JSON.stringify(errors)}`);
        }
        // Select best result using confidence and text length
        const bestResult = this.selectBestResult(results);
        // Enhance with VLM if available and requested (only if not already processed by PaliGemma2)
        if (useVlmEnhancement && this.paligemma2 && bestResult.success && !bestResult.vlmEnhanced) {
            try {
                this.logger.info('Enhancing result with PaliGemma2 VLM');
                const vlmResult = await this.paligemma2.processImage(
                    inputPath, 
                    `<image>This text was extracted via OCR: "${bestResult.text}". Please correct any errors and improve accuracy.`
                );
                if (vlmResult && vlmResult.text && vlmResult.text.length > 10) {
                    // Compare quality and length to decide whether to use enhancement
                    const originalLength = bestResult.text?.length || 0;
                    const enhancedLength = vlmResult.text.length;
                    // Use enhancement if it seems reasonable
                    if (enhancedLength > originalLength * 0.5 && enhancedLength < originalLength * 3) {
                        bestResult.text = vlmResult.text;
                        bestResult.vlmEnhanced = true;
                        bestResult.vlmConfidence = vlmResult.confidence;
                        this.logger.info('VLM enhancement applied successfully');
                    } else {
                        this.logger.warn('VLM enhancement result seems unreasonable, keeping best OCR result');
                    }
                }
            } catch (vlmError) {
                this.logger.warn('VLM enhancement failed:', vlmError.message);
            }
        }
        return {
            ...bestResult,
            allResults: results,
            successfulEngines: results.length,
            failedEngines: errors.length,
            errors: errors,
            enginesUsed: results.map(r => r.engine),
            processingStrategy: 'multi-engine-ensemble'
        };
    }

    /**
     * Determine optimal processing order based on document type
     */
    getOptimalProcessingOrder(documentType, useAllEngines = true) {
        // Always try to use all available engines for best results
        const availableEngines = [];
        
        // Add engines based on availability and suitability
        if (this.paligemma2) {
            availableEngines.push('paligemma2');
        }
        
        // Always try traditional OCR engines
        availableEngines.push('ocrmypdf', 'enhanced-tesseract');
        
        if (this.worker) {
            availableEngines.push('tesseract');
        }

        // Adjust order based on document type but keep all engines
        switch (documentType) {
            case 'handwriting':
                return this.paligemma2 ? 
                    ['paligemma2', 'enhanced-tesseract', 'tesseract', 'ocrmypdf'] : 
                    ['enhanced-tesseract', 'tesseract', 'ocrmypdf'];
            case 'medical':
            case 'form':
                return this.paligemma2 ? 
                    ['paligemma2', 'ocrmypdf', 'enhanced-tesseract', 'tesseract'] : 
                    ['ocrmypdf', 'enhanced-tesseract', 'tesseract'];
            default:
                return availableEngines;
        }
    }

    async processWithEngine(engineName, inputPath, outputDir, documentType = 'general') {
        if (!this.engines[engineName]) {
            throw new Error(`Engine ${engineName} not supported`);
        }

        try {
            const startTime = Date.now();
            const result = await this.engines[engineName](inputPath, outputDir, documentType);
            const processingTime = Date.now() - startTime;

            return {
                ...result,
                engine: engineName,
                processingTime,
                success: true
            };
        } catch (error) {
            this.logger.error(`Error processing with engine ${engineName}:`, error);
            throw error;
        }
    }

    async processTesseract(inputPath, outputDir, documentType) {
        try {
            // Initialize worker if not already done
            if (!this.worker) {
                this.worker = await createTesseractWorker();
            }
            
            const { data } = await this.worker.recognize(inputPath);
            
            // Prepare output path
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            const outputTextPath = path.join(outputDir, `${outputBaseName}_tesseract.txt`);
            
            // Save text to file
            fs.writeFileSync(outputTextPath, data.text);
            
            return {
                success: true,
                text: data.text,
                confidence: data.confidence / 100, // Normalize to 0-1 range
                outputPath: outputTextPath,
                engine: 'tesseract'
            };
        } catch (error) {
            this.logger.error(`Tesseract OCR error: ${error}`);
            
            // Fallback to command line tesseract for PDFs
            if (inputPath.toLowerCase().endsWith('.pdf')) {
                try {
                    this.logger.info('Trying command-line Tesseract for PDF');
                    const outputBaseName = path.basename(inputPath, '.pdf');
                    const outputPdfPath = path.join(outputDir, `${outputBaseName}_tesseract.pdf`);
                    
                    // Convert PDF to images first, then OCR
                    const tempDir = path.join(outputDir, 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }
                    
                    // Extract images from PDF
                    const imagePattern = path.join(tempDir, 'page_%03d.png');
                    execSync(`pdftoppm -png "${inputPath}" "${path.join(tempDir, 'page')}"`);
                    
                    // Find generated images
                    const imageFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
                    let allText = '';
                    
                    // Process each page
                    for (const imageFile of imageFiles) {
                        const imagePath = path.join(tempDir, imageFile);
                        const tempOutput = path.join(tempDir, `${path.parse(imageFile).name}_out`);
                        execSync(`tesseract "${imagePath}" "${tempOutput}" -l eng`);
                        const pageText = fs.readFileSync(`${tempOutput}.txt`, 'utf8');
                        allText += pageText + '\n';
                    }
                    
                    // Cleanup temp directory
                    execSync(`rm -rf "${tempDir}"`);
                    
                    // Save combined text
                    const outputTextPath = path.join(outputDir, `${outputBaseName}_tesseract.txt`);
                    fs.writeFileSync(outputTextPath, allText);
                    
                    return {
                        success: true,
                        text: allText,
                        confidence: 0.8, // Default confidence for command line
                        outputPath: outputTextPath,
                        engine: 'tesseract',
                        usedFallback: true
                    };
                } catch (fallbackError) {
                    this.logger.error(`Tesseract fallback also failed: ${fallbackError}`);
                }
            }
            
            throw error;
        }
    }

    async processEnhancedTesseract(inputPath, outputDir, documentType) {
        try {
            this.logger.info('Processing with Enhanced Tesseract');
            
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            const outputPdfPath = path.join(outputDir, `${outputBaseName}_enhanced_tesseract.pdf`);
            
            // Enhanced Tesseract with preprocessing and optimization
            let cmd;
            
            if (inputPath.toLowerCase().endsWith('.pdf')) {
                // For PDFs, use OCRmyPDF with Tesseract backend and enhancements
                cmd = `ocrmypdf --language eng --deskew --rotate-pages --remove-background --force-ocr --optimize 3 --output-type pdf "${inputPath}" "${outputPdfPath}"`;
            } else {
                // For images, use direct Tesseract with enhancements
                const preprocessedImage = await this.preprocessImage(inputPath, outputDir);
                const tempOutput = outputPdfPath.replace('.pdf', '');
                cmd = `tesseract "${preprocessedImage}" "${tempOutput}" -l eng --psm 1 --oem 3 -c tessedit_create_pdf=1`;
            }
            
            execSync(cmd);
            
            // Extract text from the processed PDF
            const extractedText = execSync(`pdftotext "${outputPdfPath}" -`).toString();
            
            return {
                success: true,
                text: extractedText,
                confidence: 0.9, // Enhanced processing typically has higher confidence
                outputPath: outputPdfPath,
                engine: 'enhanced-tesseract'
            };
        } catch (error) {
            this.logger.error(`Enhanced Tesseract error: ${error}`);
            throw error;
        }
    }

    async processOcrMyPdf(inputPath, outputDir, documentType) {
        try {
            this.logger.info('Processing with OCRmyPDF');
            
            // Prepare output path
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            let outputPdfPath;
            
            if (inputPath.toLowerCase().endsWith('.pdf')) {
                // PDF input
                outputPdfPath = path.join(outputDir, `${outputBaseName}_ocrmypdf.pdf`);
                
                // OCRmyPDF with optimized settings
                const cmd = `ocrmypdf --language eng --deskew --rotate-pages --force-ocr --optimize 3 --output-type pdf --max-image-mpixels 0 "${inputPath}" "${outputPdfPath}"`;
                execSync(cmd, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
            } else {
                // Image input - convert to PDF first
                const tempPdfPath = path.join(outputDir, `${outputBaseName}_temp.pdf`);
                outputPdfPath = path.join(outputDir, `${outputBaseName}_ocrmypdf.pdf`);
                
                // Convert image to PDF using ImageMagick
                execSync(`convert "${inputPath}" "${tempPdfPath}"`);
                
                // Then process with OCRmyPDF
                const cmd = `ocrmypdf --language eng --deskew --rotate-pages --force-ocr --optimize 3 --output-type pdf "${tempPdfPath}" "${outputPdfPath}"`;
                execSync(cmd, { maxBuffer: 1024 * 1024 * 10 });
                
                // Clean up temp file
                if (fs.existsSync(tempPdfPath)) {
                    fs.unlinkSync(tempPdfPath);
                }
            }
            
            // Extract text from the PDF
            const extractedText = execSync(`pdftotext "${outputPdfPath}" -`).toString();
            
            return {
                success: true,
                text: extractedText,
                confidence: 0.95, // OCRmyPDF typically has high accuracy
                outputPath: outputPdfPath,
                engine: 'ocrmypdf'
            };
        } catch (error) {
            this.logger.error(`OCRmyPDF error: ${error}`);
            throw error;
        }
    }

    async processPaliGemma2(inputPath, outputDir, documentType) {
        try {
            if (!this.paligemma2) {
                throw new Error('PaliGemma2 not initialized');
            }
            
            this.logger.info('Processing with PaliGemma2 VLM');
            
            // Check if PaliGemma2 is properly initialized
            const status = this.paligemma2.getStatus();
            if (!status.initialized) {
                throw new Error('PaliGemma2 not properly initialized');
            }
            
            // Use VLM for text extraction with a more specific prompt
            const extractionPrompt = '<image>extract all text from this document accurately, preserving formatting and structure';
            const result = await this.paligemma2.processImage(inputPath, extractionPrompt);
            
            if (!result || !result.text) {
                throw new Error('PaliGemma2 did not return valid text result');
            }
            
            // Save result to file
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            const outputTextPath = path.join(outputDir, `${outputBaseName}_paligemma2.txt`);
            fs.writeFileSync(outputTextPath, result.text);
            
            this.logger.info(`PaliGemma2 extracted ${result.text.length} characters`);
            
            return {
                success: true,
                text: result.text,
                confidence: result.confidence || 0.85,
                outputPath: outputTextPath,
                engine: 'paligemma2',
                vlmEnhanced: true,
                modelType: result.modelType || 'PaliGemma2-Simple'
            };
        } catch (error) {
            this.logger.error(`PaliGemma2 error: ${error.message}`);
            // Don't throw, let other engines handle it
            throw error;
        }
    }

    /**
     * Preprocess image for better OCR results
     */
    async preprocessImage(inputPath, outputDir) {
        try {
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            const preprocessedPath = path.join(outputDir, `${outputBaseName}_preprocessed.png`);
            
            // Apply image preprocessing using ImageMagick
            const preprocessCmd = `convert "${inputPath}" -density 300 -quality 100 -contrast-stretch 0.1x0.1% -normalize "${preprocessedPath}"`;
            execSync(preprocessCmd);
            
            return preprocessedPath;
        } catch (error) {
            this.logger.warn('Image preprocessing failed, using original:', error.message);
            return inputPath;
        }
    }

    /**
     * Select the best result from multiple engine results
     */
    selectBestResult(results) {
        if (results.length === 0) {
            return { success: false, error: 'No results available' };
        }

        if (results.length === 1) {
            return results[0];
        }

        // Score results based on multiple factors
        const scoredResults = results.map(result => {
            let score = 0;
            
            // Confidence score weight: 40%
            if (result.confidence !== undefined) {
                score += result.confidence * 0.4;
            }
            
            // Text length weight: 30% (longer text often indicates better OCR)
            if (result.text) {
                const normalizedLength = Math.min(result.text.length / 1000, 1);
                score += normalizedLength * 0.3;
            }
            
            // Engine preference weight: 30%
            const engineScores = {
                'paligemma2': 0.3,
                'ocrmypdf': 0.25,
                'enhanced-tesseract': 0.2,
                'tesseract': 0.15
            };
            score += (engineScores[result.engine] || 0.1) * 0.3;
            
            return { result, score };
        });

        // Return the highest scoring result
        scoredResults.sort((a, b) => b.score - a.score);
        
        this.logger.info(`Selected best result from ${results.length} engines: ${scoredResults[0].result.engine} (score: ${scoredResults[0].score.toFixed(3)})`);
        
        return scoredResults[0].result;
    }

    /**
     * Enhanced text processing
     */
    enhanceText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ')  // normalize whitespace
            .replace(/[^\S\n]+/g, ' ')  // normalize spaces but keep newlines
            .replace(/([.!?])\s*(?=\S)/g, '$1 ')  // ensure space after punctuation
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // add space between camelCase
            .trim();
    }

    /**
     * Get available engines
     */
    getAvailableEngines() {
        const available = [];
        
        // Check command-line OCRmyPDF
        try {
            const { execSync } = require('child_process');
            execSync('which ocrmypdf', { stdio: 'ignore' });
            available.push('ocrmypdf');
        } catch (e) {
            // OCRmyPDF not available
        }
        
        // Check enhanced-tesseract (same as ocrmypdf requirement)
        if (available.includes('ocrmypdf')) {
            available.push('enhanced-tesseract');
        }
        
        // Check Tesseract worker
        if (this.worker) {
            available.push('tesseract');
        } else {
            // Check command-line Tesseract
            try {
                const { execSync } = require('child_process');
                execSync('which tesseract', { stdio: 'ignore' });
                available.push('tesseract');
            } catch (e) {
                // Tesseract not available
            }
        }
        
        // Check PaliGemma2 VLM
        if (this.paligemma2) {
            const status = this.paligemma2.getStatus();
            if (status.initialized) {
                available.push('paligemma2');
            }
        }
        
        return available;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
            this.logger.info('Cleanup completed successfully');
        } catch (error) {
            this.logger.error('Error during cleanup:', error);
        }
    }
}

// Export the class and create a singleton instance
export { MultiEngineOCR };
export const multiEngineOCR = new MultiEngineOCR();
export default multiEngineOCR;
// Sanity check update
