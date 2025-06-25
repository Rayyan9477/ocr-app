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

    /**
     * Process OCR with timeout protection to prevent server crashes
     */
    async safeProcessWithTimeout(engineName, inputPath, outputDir, documentType) {
        return new Promise((resolve, reject) => {
            // Set a timeout for each engine to prevent hanging processes
            const timeoutMs = 120000; // 2 minutes max per engine
            const timeoutId = setTimeout(() => {
                this.logger.error(`Engine ${engineName} timed out after ${timeoutMs/1000} seconds`);
                resolve({
                    success: false,
                    engine: engineName,
                    error: `Processing timed out after ${timeoutMs/1000} seconds`,
                    text: '',
                    confidence: 0
                });
            }, timeoutMs);

            // Execute the engine with additional error boundary
            this.engines[engineName](inputPath, outputDir, documentType)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    this.logger.error(`Engine ${engineName} failed with error: ${error.message}`);
                    resolve({
                        success: false,
                        engine: engineName,
                        error: `Processing error: ${error.message}`,
                        text: '',
                        confidence: 0
                    });
                });
        });
    }

    async processDocument(inputPath, outputDir = null, options = {}) {
        try {
            await this.initialize();
            
            // Add input validation
            if (!inputPath || typeof inputPath !== 'string') {
                throw new Error('Invalid input path');
            }
            
            // Normalize the inputPath
            const normalizedInputPath = path.resolve(inputPath);
            
            this.logger.info('Processing document with multi-engine OCR:', normalizedInputPath);
            const startTime = Date.now();
            
            // Set default output directory
            if (!outputDir) {
                outputDir = path.join(process.cwd(), 'processed');
            }
            
            // Make sure output directory and its parent directories exist
            try {
                // Create the output directory (and parents) if it doesn't exist
                fs.mkdirSync(outputDir, { recursive: true });
                this.logger.info(`Created or verified output directory: ${outputDir}`);
                
                // Also create a "processed" subdirectory if the path includes it
                if (outputDir.includes('uploads') && !outputDir.endsWith('processed')) {
                    const processedDir = path.join(outputDir, 'processed');
                    fs.mkdirSync(processedDir, { recursive: true });
                    this.logger.info(`Created or verified processed subdirectory: ${processedDir}`);
                }
            } catch (mkdirError) {
                this.logger.error(`Failed to create output directory: ${mkdirError.message}`);
                throw new Error(`Cannot create output directory: ${mkdirError.message}`);
            }
            
            // Check file existence and read access
            if (!fs.existsSync(normalizedInputPath)) {
                throw new Error(`Input file does not exist: ${normalizedInputPath}`);
            }
            
            try {
                fs.accessSync(normalizedInputPath, fs.constants.R_OK);
            } catch (accessError) {
                throw new Error(`Cannot read input file: ${accessError.message}`);
            }
            
            // Verify file size
            const stats = fs.statSync(normalizedInputPath);
            if (stats.size > 20 * 1024 * 1024) { // 20MB limit
                throw new Error('Input file is too large (max 20MB)');
            }
            
            // Check if output directory is writable (more safely)
            try {
                // First make sure we have a valid directory
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                // Then test write access
                const testFile = path.join(outputDir, '.write-test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                this.logger.info('Verified output directory is writable');
            } catch (writeError) {
                this.logger.error(`Output directory write test failed: ${writeError.message}`);
                
                // Try to create the directory once more as a last resort
                try {
                    fs.mkdirSync(outputDir, { recursive: true });
                    this.logger.info(`Created output directory after failed write test: ${outputDir}`);
                } catch (finalMkdirError) {
                    throw new Error(`Output directory is not writable and cannot be created: ${writeError.message}`);
                }
            }
            
            // Use ensemble processing for best results, with timeout protection
            const processingPromise = this.processWithEnsemble(normalizedInputPath, outputDir, options);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('OCR processing timed out (5 minutes)')), 300000) // 5 min timeout
            );
            
            let result;
            try {
                result = await Promise.race([processingPromise, timeoutPromise]);
            } catch (error) {
                this.logger.error('OCR processing failed:', error);
                return {
                    success: false,
                    error: `OCR processing error: ${this.sanitizeText(error.message)}`,
                    processingTime: Date.now() - startTime
                };
            }
            
            // Processing finished, calculate total time
            const processingTime = Date.now() - startTime;
            
            if (!result || !result.success) {
                return {
                    success: false,
                    error: result?.error || 'OCR processing failed with unknown error',
                    processingTime,
                    // Always include an output filename, even for errors
                    outputFile: this.generateSafeOutputFilename(inputPath)
                };
            }
            
            // Generate a standard output file name if none was provided
            if (!result.outputPath && !result.outputFile) {
                const safeOutputFilename = this.generateSafeOutputFilename(inputPath);
                result.outputFile = safeOutputFilename;
                this.logger.info(`Generated safe output filename: ${safeOutputFilename}`);
            } else if (result.outputPath && !result.outputFile) {
                // Make sure we always have outputFile (just the filename) based on outputPath (full path)
                result.outputFile = path.basename(result.outputPath);
            }
            
            // Truncate text to reasonable size for API responses
            const enhancedText = this.enhanceText(result.text || '');
            const maxTextSize = 30000; // Reduce to 30KB for safer API responses
            
            let finalText = enhancedText;
            let truncated = false;
            
            if (enhancedText.length > maxTextSize) {
                this.logger.warn(`Text is very large (${enhancedText.length} chars), truncating to ${maxTextSize}`);
                finalText = enhancedText.substring(0, maxTextSize) + '... [truncated due to size]';
                truncated = true;
            }
            
            // Always remove allResults from API response to reduce size
            if (result.allResults) {
                delete result.allResults;
            }
            
            // Final safety check
            try {
                // Create a simplified result object with fewer fields to reduce risk of JSON issues
                const simplifiedResult = {
                    success: true,
                    engine: result.engine || 'ensemble',
                    processingTime,
                    text: finalText,
                    textEncoded: Buffer.from(finalText || '').toString('base64'),
                    encoding: 'base64',
                    outputFile: result.outputFile || path.basename(result.outputPath || this.generateSafeOutputFilename(inputPath)),
                    confidence: result.confidence || 0.8,
                    totalProcessingTime: processingTime,
                    textTruncated: truncated
                };
                
                // Apply final JSON safety checks
                const finalResult = this.ensureJsonSafety(simplifiedResult);
                
                // Validate serialization and perform double-check
                try {
                    const serialized = JSON.stringify(finalResult);
                    const reparsed = JSON.parse(serialized);  // Verify we can parse it back
                    
                    // Check if serialization maintains integrity
                    if (reparsed.success !== finalResult.success || 
                        !reparsed.textEncoded || 
                        reparsed.textEncoded !== finalResult.textEncoded) {
                        throw new Error('JSON integrity check failed');
                    }
                    
                    return finalResult;
                } catch (jsonError) {
                    this.logger.error('JSON safety validation failed:', jsonError);
                    throw jsonError; // Let the outer catch handle this
                }
            } catch (jsonError) {
                this.logger.error('JSON safety failed:', jsonError);
                
                // Return minimal guaranteed-safe result with base64 text
                const safeOutputFilename = this.generateSafeOutputFilename(inputPath);
                return {
                    success: true,
                    engine: result.engine || 'ensemble',
                    processingTime,
                    outputFile: result.outputFile || safeOutputFilename,
                    textEncoded: Buffer.from(finalText || '').toString('base64'),
                    encoding: 'base64'
                };
            }
        } catch (error) {
            // Global error handler - never let an exception escape
            this.logger.error('Critical error in processDocument:', error);
            return {
                success: false,
                error: `OCR processing failed: ${this.sanitizeText(error.message || 'Unknown error')}`,
                processingTime: 0,
                // Always include an output filename, even for errors
                outputFile: this.generateSafeOutputFilename(inputPath)
            };
        }
    }

    /**
     * Generate a safe output filename based on input filename
     */
    generateSafeOutputFilename(inputPath) {
        if (!inputPath) return `ocr_result_${Date.now()}.pdf`;
        
        try {
            const baseName = path.basename(inputPath, path.extname(inputPath));
            // Remove any problematic characters and add timestamp to ensure uniqueness
            const safeName = baseName
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .substring(0, 50); // Limit length
                
            return `${safeName}_ocr.pdf`;
        } catch (error) {
            this.logger.error('Error generating safe filename:', error);
            return `ocr_result_${Date.now()}.pdf`;
        }
    }

    /**
     * Process with ensemble of all available engines for optimal results
     */
    async processWithEnsemble(inputPath, outputDir, options = {}) {
        try {
            await this.initialize();
            const {
                useVlmEnhancement = true,
                confidenceThreshold = 0.75,
                documentType = 'general',
                useAllEngines = true,
                preprocessingRecommendations = null
            } = options;

            // Verify input file exists and is accessible
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }
            
            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                try {
                    fs.mkdirSync(outputDir, { recursive: true });
                    this.logger.info(`Created output directory in ensemble process: ${outputDir}`);
                } catch (mkdirError) {
                    throw new Error(`Failed to create output directory: ${mkdirError.message}`);
                }
            }
            
            // Check file size and enforce limits
            const fileStats = fs.statSync(inputPath);
            const fileSizeMB = fileStats.size / (1024 * 1024);
            const maxFileSizeMB = 20; // 20MB limit
            
            if (fileSizeMB > maxFileSizeMB) {
                throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size of ${maxFileSizeMB}MB`);
            }

            this.logger.info(`Processing with ensemble: ${inputPath} (${fileSizeMB.toFixed(2)}MB)`);
            this.logger.info(`Options: VLM=${useVlmEnhancement}, type=${documentType}, useAll=${useAllEngines}`);
            
            const results = [];
            const errors = [];
            
            // Define processing order based on document type and availability
            const processingOrder = this.getOptimalProcessingOrder(documentType, useAllEngines);
            this.logger.info(`Using engines in order: ${processingOrder.join(', ')}`);
            
            // Process with each engine in parallel for speed, but with timeout protection
            const enginePromises = processingOrder.map(async (engineName) => {
                try {
                    this.logger.info(`Starting ${engineName} processing`);
                    const startTime = Date.now();
                    
                    // Use the safe processing wrapper with timeout
                    const result = await this.safeProcessWithTimeout(engineName, inputPath, outputDir, documentType);
                    const processingTime = Date.now() - startTime;
                    
                    return { 
                        ...result, 
                        engine: engineName,
                        engineProcessingTime: processingTime
                    };
                } catch (error) {
                    this.logger.warn(`Engine ${engineName} failed: ${error.message}`);
                    errors.push({ 
                        engine: engineName, 
                        error: this.sanitizeText(error.message || 'Unknown error')
                    });
                    return null;
                }
            });
            
            // Use Promise.allSettled to ensure all promises complete or fail gracefully
            const engineResults = await Promise.allSettled(enginePromises);
            
            // Collect successful results
            engineResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value && result.value.success !== false) {
                    // Ensure individual results are JSON safe
                    results.push(this.ensureJsonSafety(result.value));
                } else if (result.status === 'fulfilled' && result.value) {
                    // Failed with safe error
                    errors.push({
                        engine: result.value.engine,
                        error: result.value.error || 'Processing failed'
                    });
                } else if (result.status === 'rejected') {
                    // Completely failed promise
                    errors.push({
                        engine: processingOrder[index] || 'unknown',
                        error: this.sanitizeText(result.reason?.message || 'Promise rejected')
                    });
                }
            });

            // If all engines failed, return a clean error
            if (results.length === 0) {
                return {
                    success: false,
                    error: `All OCR engines failed`,
                    errorDetails: this.deepSanitizeForJson(errors),
                    text: '',
                    confidence: 0
                };
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
            
            // Ensure all individual results are fully sanitized
            for (let i = 0; i < results.length; i++) {
                if (results[i].text && results[i].text.length > 50000) {
                    this.logger.warn(`Result from ${results[i].engine} has very large text (${results[i].text.length} chars), truncating`);
                    results[i].text = results[i].text.substring(0, 50000) + '... [truncated due to size]';
                    results[i].truncated = true;
                }
            }

            // Handle nested arrays and objects for JSON safety
            const safeResults = this.deepSanitizeForJson(results);
            const safeErrors = this.deepSanitizeForJson(errors);

            // Include the outputFile in the final result if available
            let outputFilename = '';
            if (bestResult && bestResult.outputPath) {
                outputFilename = path.basename(bestResult.outputPath);
            } else {
                outputFilename = this.generateSafeOutputFilename(inputPath);
            }

            // Ensure final result is JSON safe with all nested objects sanitized
            return this.ensureJsonSafety({
                ...bestResult,
                allResults: this.deepSanitizeForJson(results.slice(0, 2)), // Limit to prevent response size issues
                successfulEngines: results.length,
                failedEngines: errors.length,
                errors: this.deepSanitizeForJson(errors),
                enginesUsed: results.map(r => r.engine),
                processingStrategy: 'multi-engine-ensemble',
                outputFile: outputFilename
            });
        } catch (error) {
            // Top-level error handler to ensure we never crash the server
            this.logger.error(`Critical error in processWithEnsemble: ${error.message}`, error);
            return {
                success: false,
                error: `Critical OCR processing error: ${this.sanitizeText(error.message)}`,
                text: '',
                confidence: 0
            };
        }
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
            
            // Sanitize text before saving
            const sanitizedText = this.sanitizeText(data.text);
            
            // Save text to file
            fs.writeFileSync(outputTextPath, sanitizedText);
            
            return {
                success: true,
                text: sanitizedText,
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
                cmd = `ocrmypdf --language eng --deskew --rotate-pages --force-ocr --optimize 3 --output-type pdf "${inputPath}" "${outputPdfPath}"`;
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
                
                // OCRmyPDF with optimized settings and additional safety
                const cmd = `ocrmypdf --language eng --deskew --rotate-pages --force-ocr --optimize 3 --output-type pdf --max-image-mpixels 0 --skip-big 100 "${inputPath}" "${outputPdfPath}"`;
                
                try {
                    // Use execAsync with timeout control
                    const { stdout, stderr } = await execAsync(cmd, { 
                        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                        timeout: 180000 // 3 minute timeout
                    });
                    
                    if (stderr && stderr.length > 0) {
                        this.logger.warn(`OCRmyPDF warnings: ${stderr}`);
                    }
                } catch (execError) {
                    // More detailed error handling
                    this.logger.error(`OCRmyPDF execution failed: ${execError.message}`);
                    
                    // If output file exists despite error, continue
                    if (!fs.existsSync(outputPdfPath)) {
                        throw new Error(`OCRmyPDF failed: ${execError.message}`);
                    }
                    
                    this.logger.info('Output file exists despite error, continuing');
                }
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
            
            // Extract text from the PDF with better error handling
            let extractedText = '';
            try {
                extractedText = execSync(`pdftotext "${outputPdfPath}" -`, { 
                    maxBuffer: 10 * 1024 * 1024, // 10MB
                    timeout: 30000 // 30 second timeout
                }).toString();
                
                // Sanitize text right after extraction
                extractedText = this.sanitizeText(extractedText);
                
                // Verify JSON compatibility immediately
                if (!this.isJsonSafe(extractedText)) {
                    this.logger.warn('Extracted text is not JSON-safe, applying additional sanitization');
                    extractedText = extractedText.replace(/[^\x20-\x7E\n]/g, '');
                }
            } catch (textExtractionError) {
                this.logger.error(`Error extracting text from PDF: ${textExtractionError.message}`);
                
                // Try fallback text extraction if primary fails
                try {
                    this.logger.info('Trying alternative text extraction');
                    extractedText = execSync(`strings "${outputPdfPath}" | grep -v "^$"`, {
                        maxBuffer: 5 * 1024 * 1024,
                        timeout: 10000
                    }).toString();
                    extractedText = this.sanitizeText(extractedText);
                } catch (fallbackError) {
                    extractedText = 'Error extracting text from document';
                }
            }
            
            // If output file exists, return a positive result
            if (fs.existsSync(outputPdfPath)) {
                const result = {
                    success: true,
                    text: extractedText,
                    confidence: 0.95,
                    outputPath: outputPdfPath,
                    engine: 'ocrmypdf'
                };
                
                return this.ensureJsonSafety(result);
            } else {
                throw new Error('Failed to generate output PDF');
            }
            
        } catch (error) {
            this.logger.error(`OCRmyPDF error: ${error.message}`);
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
            
            // Sanitize text before saving
            const sanitizedText = this.sanitizeText(result.text);
            
            // Save result to file
            const outputBaseName = path.basename(inputPath, path.extname(inputPath));
            const outputTextPath = path.join(outputDir, `${outputBaseName}_paligemma2.txt`);
            fs.writeFileSync(outputTextPath, sanitizedText);
            
            this.logger.info(`PaliGemma2 extracted ${sanitizedText.length} characters`);
            
            return {
                success: true,
                text: sanitizedText,
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
     * Sanitize text to prevent JSON parsing errors
     */
    sanitizeText(text) {
        if (!text) return '';
        
        try {
            // First pass: Handle basic sanitization with more aggressive character filtering
            let sanitized = text
                // Remove control characters
                .replace(/[\u0000-\u001F\u007F-\u00A0]/g, '')
                // Normalize line endings
                .replace(/\r\n/g, '\n')
                // Replace problematic backslashes that break JSON - more aggressive escaping
                .replace(/\\/g, '/')
                // Replace quotes that might break JSON - replace with safe alternatives
                .replace(/"/g, "'")
                // Handle tab characters
                .replace(/\t/g, ' ')
                // Replace other JSON-breaking characters
                .replace(/[\f\v\u2028\u2029]/g, '')
                // Remove any other potentially harmful Unicode characters
                .replace(/[\u0080-\u009F\u200B-\u200F\uFEFF]/g, '')
                // Replace multiple spaces with single spaces
                .replace(/  +/g, ' ')
                .trim();
            
            // Additional pass: Verify JSON compatibility by testing serialization
            const testObj = { text: sanitized };
            JSON.stringify(testObj);
            
            return sanitized;
        } catch (error) {
            this.logger.error('Error sanitizing text, using strict fallback method:', error);
            // Stricter fallback sanitization - only allow basic ASCII
            return text.replace(/[^\x20-\x7E\n]/g, '')  // Keep only ASCII printable chars and newlines
                .replace(/\\/g, '/')  // Replace all backslashes with forward slashes
                .replace(/"/g, "'")   // Replace all double quotes with single quotes
                .trim();
        }
    }

    /**
     * Ensure JSON safety of results before returning
     */
    ensureJsonSafety(result) {
        if (!result) return result;
        
        // Always include outputFile
        if (!result.outputFile && result.outputPath) {
            result.outputFile = path.basename(result.outputPath);
        } else if (!result.outputFile && !result.outputPath) {
            result.outputFile = `ocr_result_${Date.now()}.pdf`;
        }
        
        // Text size limit enforcement - prevent excessively large responses
        const maxTextLength = 25000; // Cap at 25KB for safer responses
        if (result.text && result.text.length > maxTextLength) {
            this.logger.warn(`Text exceeds safe size (${result.text.length} chars), applying limit of ${maxTextLength}`);
            result.text = result.text.substring(0, maxTextLength) + '... [truncated for safety]';
            result.truncated = true;
        }
        
        // Always use base64 encoding as primary text format for consistent parsing
        if (result.text) {
            result.textEncoded = Buffer.from(result.text).toString('base64');
            result.encoding = 'base64';
            
            // For backward compatibility, still include plain text after sanitizing
            const isTextSafe = this.isJsonSafe(result.text);
            if (!isTextSafe) {
                this.logger.warn('Text is not JSON-safe, applying additional sanitization');
                result.text = this.sanitizeText(result.text);
                
                // If still not safe, remove from plain text response altogether
                if (!this.isJsonSafe(result.text)) {
                    this.logger.warn('Text remains unsafe for JSON, removing from plain text response');
                    result.text = 'Text only available in base64 encoded format due to JSON compatibility issues';
                }
            }
        }
        
        // Handle nested objects recursively
        for (const key in result) {
            if (typeof result[key] === 'string' && key !== 'text' && key !== 'textEncoded') {
                // For other string fields, just sanitize
                result[key] = this.sanitizeText(result[key]);
            } else if (typeof result[key] === 'object' && result[key] !== null) {
                // Recursively sanitize nested objects
                result[key] = this.deepSanitizeForJson(result[key]);
            }
        }
        
        // Final verification with size limits - if still not JSON safe, create a clean sanitized version
        try {
            const serialized = JSON.stringify(result);
            
            // Implement max JSON size limit
            if (serialized.length > 2 * 1024 * 1024) { // > 2MB response is too large
                throw new Error(`JSON response exceeds maximum safe size (${serialized.length} bytes)`);
            }
            
            // Final validation - can the JSON be parsed back?
            JSON.parse(serialized);
        } catch (error) {
            this.logger.error('Final result still not JSON-safe, performing emergency sanitization:', error);
            
            // Create a simplified, guaranteed-safe version of the result - only keep essential fields
            const safeResult = {
                success: result.success || false,
                engine: result.engine || 'unknown',
                confidence: result.confidence || 0,
                error: 'Original result contained JSON-unsafe data and was sanitized',
                textEncoded: result.textEncoded || (result.text ? Buffer.from(result.text).toString('base64') : ''),
                encoding: 'base64',
                outputFile: result.outputFile || `ocr_result_${Date.now()}.pdf`,
            };
            
            // Include minimal safe metadata
            if (result.processingTime) safeResult.processingTime = result.processingTime;
            if (result.engineProcessingTime) safeResult.engineProcessingTime = result.engineProcessingTime;
            
            return safeResult;
        }
        
        return result;
    }

    /**
     * Enhanced text processing
     */
    enhanceText(text) {
        if (!text) return '';
        
        try {
            return this.sanitizeText(text)
                .replace(/\s+/g, ' ')  // normalize whitespace
                .replace(/[^\S\n]+/g, ' ')  // normalize spaces but keep newlines
                .replace(/([.!?])\s*(?=\S)/g, '$1 ')  // ensure space after punctuation
                .replace(/([a-z])([A-Z])/g, '$1 $2')  // add space between camelCase
                .trim();
        } catch (error) {
            this.logger.error('Error enhancing text:', error);
            return text; // Return original text if enhancement fails
        }
    }

    /**
     * Select best result from available engines
     */
    selectBestResult(results) {
        if (results.length === 0) {
            return { success: false, error: 'No successful OCR results available' };
        }
        if (results.length === 1) {
            // Ensure JSON safety for single result
            return this.ensureJsonSafety(results[0]);
        }
        
        // Score each result based on confidence and text length
        const scoredResults = results.map(result => {
            const confidence = result.confidence || 0.5;
            const textLength = result.text ? result.text.length : 0;
            const score = confidence * 0.6 + (textLength > 50 ? 0.4 : textLength / 125);
            return { ...result, score };
        });
        
        // Sort by score descending
        scoredResults.sort((a, b) => b.score - a.score);
        
        // Return best result with JSON safety check
        return this.ensureJsonSafety(scoredResults[0]);
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
