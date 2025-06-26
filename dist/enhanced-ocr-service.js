import { PreprocessingService } from './preprocessing-service';
import { HighlightDetector } from './highlight-detector';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from './utils/logger';
/**
 * Enhanced OCR Service that extends existing functionality
 * without breaking current implementations
 */
export class EnhancedOCRService {
    constructor() {
        this.preprocessingService = new PreprocessingService();
        this.highlightDetector = new HighlightDetector();
        this.sessionDir = path.join(os.tmpdir(), `enhanced_ocr_${Date.now()}`);
        this.ensureSessionDirectory();
    }
    ensureSessionDirectory() {
        try {
            if (!fs.existsSync(this.sessionDir)) {
                fs.mkdirSync(this.sessionDir, { recursive: true });
            }
        }
        catch (error) {
            logger.error(`Failed to create session directory: ${error}`);
            this.sessionDir = os.tmpdir();
        }
    }
    /**
     * Process document with enhanced preprocessing and OCR
     */
    async processDocument(inputPath, options = {}) {
        const startTime = Date.now();
        let preprocessingOperations = [];
        try {
            logger.info(`Starting enhanced OCR processing for: ${inputPath}`);
            // Validate input
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }
            // Step 1: Apply enhanced preprocessing
            const preprocessedPath = await this.applyEnhancedPreprocessing(inputPath, options);
            preprocessingOperations = await this.getAppliedOperations(options);
            // Step 2: Detect highlights if enabled
            let highlightRegions = [];
            if (options.optimizeHighlightedText) {
                try {
                    const highlightResult = await this.highlightDetector.detectHighlights(preprocessedPath);
                    if (highlightResult.hasHighlights) {
                        highlightRegions = highlightResult.highlightRegions;
                        preprocessingOperations.push('Highlight detection');
                    }
                }
                catch (error) {
                    logger.warn(`Highlight detection failed: ${error}`);
                }
            }
            // Step 3: Perform OCR
            const ocrResult = await this.performEnhancedOCR(preprocessedPath, highlightRegions);
            // Step 4: Calculate results
            const processingTime = Date.now() - startTime;
            const wordCount = ocrResult.text.split(/\s+/).filter(Boolean).length;
            return {
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                processingTime,
                success: true,
                enhancedImagePath: preprocessedPath,
                preprocessingOperations,
                highlightedRegions: highlightRegions,
                wordCount
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            logger.error(`Enhanced OCR processing failed: ${error}`);
            return {
                text: '',
                confidence: 0,
                processingTime,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                preprocessingOperations,
                highlightedRegions: [],
                wordCount: 0
            };
        }
    }
    /**
     * Apply enhanced preprocessing techniques
     */
    async applyEnhancedPreprocessing(inputPath, options) {
        const outputPath = path.join(this.sessionDir, 'enhanced_preprocessed.png');
        let command = `convert "${inputPath}"`;
        // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        if (options.applyCLAHE !== false) {
            command += ' -colorspace Lab -channel 0 -equalize -channel RG -equalize -colorspace sRGB';
        }
        // Apply deskewing
        if (options.deskew !== false) {
            command += ' -background white -deskew 40% -trim +repage';
        }
        // Apply edge enhancement
        if (options.enhanceEdges) {
            command += ' -unsharp 0x1+1.2+0.05';
        }
        // Apply normalization
        if (options.normalize) {
            command += ' -normalize -contrast-stretch 2%x98%';
        }
        // Apply perspective correction (simplified)
        if (options.perspectiveCorrection) {
            command += ' -auto-orient';
        }
        command += ` "${outputPath}"`;
        try {
            execSync(command, { stdio: 'pipe', timeout: 30000 });
            logger.info('Enhanced preprocessing completed successfully');
            return outputPath;
        }
        catch (error) {
            logger.warn(`Enhanced preprocessing failed, using original: ${error}`);
            // Fall back to original file if preprocessing fails
            return inputPath;
        }
    }
    /**
     * Perform enhanced OCR with optimized settings
     */
    async performEnhancedOCR(imagePath, highlightRegions = []) {
        const outputBasePath = path.join(this.sessionDir, 'enhanced_ocr_output');
        try {
            // Try multiple OCR approaches for better accuracy
            const ocrCommands = [
                `tesseract "${imagePath}" "${outputBasePath}_1" -l eng --psm 3 --oem 3`,
                `tesseract "${imagePath}" "${outputBasePath}_2" -l eng --psm 6 --oem 3`,
            ];
            let bestResult = { text: '', confidence: 0 };
            for (let i = 0; i < ocrCommands.length; i++) {
                try {
                    execSync(ocrCommands[i], { stdio: 'pipe', timeout: 30000 });
                    const textFilePath = `${outputBasePath}_${i + 1}.txt`;
                    if (fs.existsSync(textFilePath)) {
                        const text = fs.readFileSync(textFilePath, 'utf-8').trim();
                        const confidence = this.calculateTextQuality(text);
                        if (confidence > bestResult.confidence) {
                            bestResult = { text, confidence };
                        }
                        // Cleanup
                        fs.unlinkSync(textFilePath);
                    }
                }
                catch (error) {
                    logger.warn(`OCR attempt ${i + 1} failed: ${error}`);
                }
            }
            // If we have highlighted regions, try to extract their text
            if (highlightRegions.length > 0) {
                const highlightText = await this.extractHighlightedText(imagePath, highlightRegions);
                if (highlightText) {
                    bestResult.text += '\n\nHighlighted Content:\n' + highlightText;
                    bestResult.confidence = Math.min(bestResult.confidence + 5, 95);
                }
            }
            return bestResult;
        }
        catch (error) {
            logger.error(`Enhanced OCR failed: ${error}`);
            return { text: '', confidence: 0 };
        }
    }
    /**
     * Extract text from highlighted regions
     */
    async extractHighlightedText(imagePath, highlightRegions) {
        const highlightTexts = [];
        for (let i = 0; i < highlightRegions.length; i++) {
            try {
                const region = highlightRegions[i];
                const cropPath = path.join(this.sessionDir, `highlight_${i}.png`);
                const cropSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;
                // Extract and enhance the highlighted region
                const cropCommand = `convert "${imagePath}" -crop ${cropSpec} -resize 200% -unsharp 0x1+1.5+0 "${cropPath}"`;
                execSync(cropCommand, { stdio: 'pipe' });
                // OCR the highlighted region
                const outputPath = path.join(this.sessionDir, `highlight_text_${i}`);
                execSync(`tesseract "${cropPath}" "${outputPath}" -l eng --psm 8`, { stdio: 'pipe' });
                const textFilePath = `${outputPath}.txt`;
                if (fs.existsSync(textFilePath)) {
                    const text = fs.readFileSync(textFilePath, 'utf-8').trim();
                    if (text.length > 0) {
                        highlightTexts.push(text);
                    }
                    fs.unlinkSync(textFilePath);
                }
                // Cleanup crop file
                if (fs.existsSync(cropPath)) {
                    fs.unlinkSync(cropPath);
                }
            }
            catch (error) {
                logger.warn(`Failed to extract highlight ${i}: ${error}`);
            }
        }
        return highlightTexts.join('\n');
    }
    /**
     * Calculate text quality score
     */
    calculateTextQuality(text) {
        if (!text || text.length === 0)
            return 0;
        let score = 50; // Base score
        // Check for readable characters
        const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:]/g);
        if (readableChars) {
            score += (readableChars.length / text.length) * 30;
        }
        // Check for complete words
        const words = text.split(/\s+/).filter(word => word.match(/^[a-zA-Z]+$/));
        if (words.length > 0) {
            score += Math.min(words.length * 2, 20);
        }
        return Math.min(score, 95);
    }
    /**
     * Get list of applied preprocessing operations
     */
    async getAppliedOperations(options) {
        const operations = [];
        if (options.applyCLAHE !== false) {
            operations.push('CLAHE Enhancement');
        }
        if (options.deskew !== false) {
            operations.push('Deskewing');
        }
        if (options.enhanceEdges) {
            operations.push('Edge Enhancement');
        }
        if (options.normalize) {
            operations.push('Image Normalization');
        }
        if (options.perspectiveCorrection) {
            operations.push('Perspective Correction');
        }
        return operations;
    }
    /**
     * Clean up session directory
     */
    cleanup() {
        try {
            if (fs.existsSync(this.sessionDir)) {
                execSync(`rm -rf "${this.sessionDir}"`, { stdio: 'pipe' });
            }
        }
        catch (error) {
            logger.warn(`Cleanup failed: ${error}`);
        }
    }
}
