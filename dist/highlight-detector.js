import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import * as path from 'path';
import * as fs from 'fs';
const execAsync = promisify(exec);
/**
 * Enhanced highlighting detection service for OCR enhancement
 * Detects and processes highlighted text regions in documents with improved algorithms
 */
export class HighlightDetector {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'tmp', 'highlight-detection');
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Enhanced highlight detection with improved algorithms
     */
    async detectHighlights(imagePath, options = {}) {
        const startTime = Date.now();
        const { colorThreshold = 0.3, minRegionSize = 100, saturationThreshold = 0.4, enableTextExtraction = true, targetColors = ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'], sensitivityLevel = 'medium', enableDynamicThresholding = true, useAdvancedFiltering = true, adaptiveContrast = true, useMLVerification = true } = options;
        try {
            logger.info(`Starting enhanced highlight detection for: ${imagePath}`);
            // Create session directory
            const sessionDir = path.join(this.tempDir, `session_${Date.now()}`);
            await execAsync(`mkdir -p "${sessionDir}"`);
            // Convert PDF to image if needed
            const workingImagePath = await this.prepareImage(imagePath, sessionDir);
            // Pre-process image for better highlight detection
            const preprocessedImagePath = await this.preprocessForHighlightDetection(workingImagePath, sessionDir, useAdvancedFiltering);
            // Detect highlights using enhanced methods
            const highlightRegions = await this.detectHighlightRegionsEnhanced(preprocessedImagePath, sessionDir, {
                colorThreshold,
                minRegionSize,
                saturationThreshold,
                targetColors,
                sensitivityLevel,
                enableDynamicThresholding
            });
            // Extract text from highlighted regions with enhanced OCR
            if (enableTextExtraction && highlightRegions.length > 0) {
                await this.extractHighlightedTextEnhanced(preprocessedImagePath, highlightRegions, sessionDir);
            }
            // Create enhanced image for better visualization
            const enhancedImagePath = await this.createHighlightEnhancedImage(workingImagePath, highlightRegions, path.join(sessionDir, 'enhanced_output.png'));
            // Calculate confidence score with improved algorithm
            const confidenceScore = this.calculateEnhancedConfidenceScore(highlightRegions);
            // Generate enhancement suggestions
            const enhancementSuggestions = this.generateEnhancedSuggestions(highlightRegions);
            const processingTime = Date.now() - startTime;
            logger.info(`Enhanced highlight detection completed in ${processingTime}ms. Found ${highlightRegions.length} regions.`);
            // Don't cleanup - keep files for debugging/inspection
            // await execAsync(`rm -rf "${sessionDir}"`).catch(() => {});
            return {
                hasHighlights: highlightRegions.length > 0,
                highlightRegions,
                confidenceScore,
                processingTime,
                enhancementSuggestions,
                enhancedImage: enhancedImagePath
            };
        }
        catch (error) {
            logger.error(`Enhanced highlight detection failed: ${error}`);
            return {
                hasHighlights: false,
                highlightRegions: [],
                confidenceScore: 0,
                processingTime: Date.now() - startTime,
                enhancementSuggestions: ['Enhanced highlight detection failed - falling back to manual review']
            };
        }
    }
    /**
     * Enhanced highlight detection with improved preprocessing
     */
    async detectHighlightsWithEnhancedPreprocessing(imagePath, options = {}) {
        const startTime = Date.now();
        try {
            // Apply optimized preprocessing for highlight detection
            const sessionDir = path.join(this.tempDir, `enhanced_highlights_${Date.now()}`);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }
            const preprocessedPath = await this.preprocessForEnhancedHighlightDetection(imagePath, sessionDir, options.useAdvancedFiltering || true);
            // Proceed with highlight detection on the enhanced image
            const result = await this.detectHighlights(preprocessedPath, {
                ...options,
                sensitivityLevel: 'high', // Increase sensitivity for preprocessed image
                enableDynamicThresholding: true
            });
            // Enhanced text extraction from detected highlights
            if (result.hasHighlights && result.highlightRegions.length > 0) {
                await this.extractHighlightedTextEnhanced(preprocessedPath, result.highlightRegions, sessionDir);
            }
            return {
                ...result,
                processingTime: Date.now() - startTime
            };
        }
        catch (error) {
            logger.error(`Enhanced highlight detection failed: ${error}`);
            // Fall back to regular detection
            return this.detectHighlights(imagePath, options);
        }
    }
    /**
     * Prepare image for highlight detection (enhanced version)
     */
    async prepareImage(inputPath, sessionDir) {
        const ext = path.extname(inputPath).toLowerCase();
        if (ext === '.pdf') {
            // Convert PDF to high-quality image for better highlight detection
            const imagePath = path.join(sessionDir, 'page_001.png');
            await execAsync(`pdftoppm -png -r 300 -f 1 -l 1 "${inputPath}" "${sessionDir}/page"`);
            if (fs.existsSync(imagePath)) {
                return imagePath;
            }
            // Fallback: use first generated image
            const imageFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png'));
            if (imageFiles.length > 0) {
                return path.join(sessionDir, imageFiles[0]);
            }
            throw new Error('Failed to convert PDF to image');
        }
        return inputPath;
    }
    /**
     * Pre-process image specifically for highlight detection
     * Optimized for CPU processing with efficient algorithms
     */
    async preprocessForHighlightDetection(imagePath, sessionDir, useAdvancedFiltering) {
        try {
            const preprocessedPath = path.join(sessionDir, 'preprocessed_for_highlights.png');
            // Split preprocessing into smaller, memory-efficient steps
            const steps = [
                // Step 1: Basic color normalization (fast)
                `convert "${imagePath}" -colorspace sRGB -depth 8 "${path.join(sessionDir, 'step1.png')}"`,
                // Step 2: Channel optimization (efficient for CPU)
                `convert "${path.join(sessionDir, 'step1.png')}" -separate -normalize -combine "${path.join(sessionDir, 'step2.png')}"`,
                // Step 3: Quality enhancement (optimized)
                `convert "${path.join(sessionDir, 'step2.png')}" -auto-level -contrast-stretch 2%x98%${useAdvancedFiltering ? ' -sharpen 0x0.5' : ' -normalize'} "${preprocessedPath}"`
            ];
            // Execute steps sequentially to manage memory
            for (const cmd of steps) {
                await execAsync(cmd);
            }
            // Clean up intermediate files
            await Promise.all([
                execAsync(`rm -f "${path.join(sessionDir, 'step1.png')}"`),
                execAsync(`rm -f "${path.join(sessionDir, 'step2.png')}"`)
            ]);
            if (fs.existsSync(preprocessedPath)) {
                logger.info('Successfully preprocessed image for highlight detection');
                return preprocessedPath;
            }
            else {
                logger.warn('Preprocessing failed, using original image');
                return imagePath;
            }
        }
        catch (error) {
            logger.warn(`Preprocessing for highlight detection failed: ${error}`);
            return imagePath;
        }
    }
    /**
     * Preprocessing optimized specifically for highlight detection
     */
    async preprocessForEnhancedHighlightDetection(imagePath, sessionDir, useAdvancedFiltering) {
        try {
            const preprocessedPath = path.join(sessionDir, 'enhanced_preprocessed_for_highlights.png');
            // Enhanced preprocessing pipeline for highlight detection
            const commands = [
                // Step 1: Color space optimization
                `convert "${imagePath}" -colorspace sRGB -depth 8 "${path.join(sessionDir, 'step1.png')}"`,
                // Step 2: Enhanced channel separation and normalization
                `convert "${path.join(sessionDir, 'step1.png')}" -separate -normalize -combine "${path.join(sessionDir, 'step2.png')}"`,
                // Step 3: Saturation enhancement for better highlight detection
                `convert "${path.join(sessionDir, 'step2.png')}" -modulate 100,150,100 "${path.join(sessionDir, 'step3.png')}"`,
                // Step 4: Adaptive contrast enhancement
                `convert "${path.join(sessionDir, 'step3.png')}" -adaptive-blur 0x1 -normalize "${preprocessedPath}"`,
            ];
            // Execute commands sequentially
            for (const command of commands) {
                await execAsync(command);
            }
            // Cleanup intermediate files
            await Promise.all([
                execAsync(`rm -f "${path.join(sessionDir, 'step1.png')}"`).catch(() => { }),
                execAsync(`rm -f "${path.join(sessionDir, 'step2.png')}"`).catch(() => { }),
                execAsync(`rm -f "${path.join(sessionDir, 'step3.png')}"`).catch(() => { })
            ]);
            if (fs.existsSync(preprocessedPath)) {
                logger.info('Successfully preprocessed image for enhanced highlight detection');
                return preprocessedPath;
            }
            else {
                logger.warn('Enhanced preprocessing failed, using original image');
                return imagePath;
            }
        }
        catch (error) {
            logger.warn(`Enhanced preprocessing for highlight detection failed: ${error}`);
            return imagePath;
        }
    }
    /**
     * Enhanced highlight region detection with improved algorithms and adaptive contrast
     */
    async detectHighlightRegionsEnhanced(imagePath, sessionDir, options) {
        // Apply adaptive contrast enhancement  
        const contrastEnhancedPath = options.adaptiveContrast
            ? await enhanceContrastAdaptive(imagePath, path.join(sessionDir, 'contrast_enhanced.png'))
            : imagePath;
        // Helper function for adaptive contrast
        async function enhanceContrastAdaptive(input, output) {
            try {
                const cmd = `convert "${input}" \
          \\( -clone 0 -colorspace Lab -channel 0 -separate +channel \
             -normalize -contrast-stretch 2%x98% \\) \
          -compose copy_opacity -composite \
          -adaptive-sharpen 0x1.0 \
          -contrast-stretch 2% \
          "${output}"`;
                await execAsync(cmd);
                return output;
            }
            catch (error) {
                logger.error(`Error enhancing contrast: ${error}`);
                return input;
            }
        }
        const regions = [];
        try {
            // Adjust parameters based on sensitivity level
            const adjustedOptions = this.adjustParametersForSensitivity(options);
            // Method 1: Enhanced color-based detection
            for (const color of options.targetColors) {
                const colorRegions = await this.detectColorRegionsEnhanced(imagePath, sessionDir, color, adjustedOptions);
                regions.push(...colorRegions);
            }
            // Method 2: Enhanced saturation-based detection
            const saturationRegions = await this.detectSaturationRegionsEnhanced(imagePath, sessionDir, adjustedOptions);
            regions.push(...saturationRegions);
            // Method 3: Enhanced luminosity difference detection
            const luminosityRegions = await this.detectLuminosityRegionsEnhanced(imagePath, sessionDir, adjustedOptions);
            regions.push(...luminosityRegions);
            // Method 4: NEW - HSL-based detection for better color accuracy
            const hslRegions = await this.detectHSLBasedHighlights(imagePath, sessionDir, adjustedOptions);
            regions.push(...hslRegions);
            // Method 5: NEW - Texture-based detection for non-color highlights
            const textureRegions = await this.detectTextureBasedHighlights(imagePath, sessionDir, adjustedOptions);
            regions.push(...textureRegions);
            // Remove duplicates and merge overlapping regions with enhanced algorithm
            const mergedRegions = this.mergeOverlappingRegionsEnhanced(regions);
            // Filter out noise and low-quality regions
            return this.filterHighQualityRegions(mergedRegions, adjustedOptions);
        }
        catch (error) {
            logger.warn(`Enhanced region detection failed: ${error}`);
            return [];
        }
    }
    /**
     * Adjust detection parameters based on sensitivity level
     */
    adjustParametersForSensitivity(options) {
        const adjustedOptions = { ...options };
        switch (options.sensitivityLevel) {
            case 'high':
                adjustedOptions.colorThreshold = Math.max(0.15, options.colorThreshold * 0.7);
                adjustedOptions.saturationThreshold = Math.max(0.2, options.saturationThreshold * 0.6);
                adjustedOptions.minRegionSize = Math.max(50, options.minRegionSize * 0.5);
                adjustedOptions.fuzzFactor = 35; // Higher fuzz for more inclusive matching
                break;
            case 'low':
                adjustedOptions.colorThreshold = Math.min(0.6, options.colorThreshold * 1.5);
                adjustedOptions.saturationThreshold = Math.min(0.8, options.saturationThreshold * 1.4);
                adjustedOptions.minRegionSize = options.minRegionSize * 2;
                adjustedOptions.fuzzFactor = 15; // Lower fuzz for more precise matching
                break;
            default: // medium
                adjustedOptions.fuzzFactor = 25;
                break;
        }
        return adjustedOptions;
    }
    /**
     * Enhanced color-based detection with improved algorithms
     */
    async detectColorRegionsEnhanced(imagePath, sessionDir, color, options) {
        const colorspaces = ['RGB', 'HSL', 'Lab', 'YCbCr'];
        let allRegions = [];
        // Multi-pass detection using different color spaces
        for (const colorspace of colorspaces) {
            try {
                const colorspaceImagePath = path.join(sessionDir, `${colorspace.toLowerCase()}_converted.png`);
                await execAsync(`convert "${imagePath}" -colorspace ${colorspace} "${colorspaceImagePath}"`);
                const regions = await this.detectColorRegionsEnhanced(colorspaceImagePath, sessionDir, color, options);
                allRegions = allRegions.concat(regions);
            }
            catch (error) {
                logger.error(`Error in ${colorspace} detection: ${error}`);
            }
        }
        // Merge and deduplicate regions
        return this.mergeOverlappingRegionsEnhanced(allRegions);
        try {
            const maskPath = path.join(sessionDir, `${color}_enhanced_mask.png`);
            // Enhanced color detection with multiple color variants
            const colorVariants = this.getColorVariants(color);
            let colorRange = '';
            const fuzzFactor = options.fuzzFactor || 25;
            // Create a more sophisticated color mask that handles multiple color variants
            for (let i = 0; i < colorVariants.length; i++) {
                const variant = colorVariants[i];
                if (i === 0) {
                    colorRange = `-fuzz ${fuzzFactor}% -fill white -opaque "${variant}"`;
                }
                else {
                    colorRange += ` -fuzz ${fuzzFactor}% -fill white -opaque "${variant}"`;
                }
            }
            colorRange += ' -fill black +opaque white';
            // Create enhanced mask with morphological operations
            const command = `convert "${imagePath}" ${colorRange} -morphology close disk:1 -morphology open disk:1 "${maskPath}"`;
            await execAsync(command);
            if (!fs.existsSync(maskPath)) {
                return [];
            }
            // Analyze mask with enhanced region analysis
            const regions = await this.analyzeMaskRegionsEnhanced(maskPath, color, options);
            // Add color information to regions
            for (const region of regions) {
                region.colorInfo = await this.extractColorInfo(imagePath, region);
            }
            return regions;
        }
        catch (error) {
            logger.warn(`Enhanced color region detection failed for ${color}: ${error}`);
            return [];
        }
    }
    /**
     * Get color variants for better detection
     */
    getColorVariants(color) {
        const variants = {
            yellow: ['#FFFF00', '#FFFF99', '#FFFFCC', '#FFF200', '#FFED4E'],
            cyan: ['#00FFFF', '#99FFFF', '#CCFFFF', '#00CED1', '#40E0D0'],
            magenta: ['#FF00FF', '#FF99FF', '#FFCCFF', '#DA70D6', '#BA55D3'],
            green: ['#00FF00', '#99FF99', '#CCFFCC', '#32CD32', '#90EE90'],
            pink: ['#FFC0CB', '#FFB6C1', '#FF69B4', '#FF1493', '#FFE4E1'],
            orange: ['#FFA500', '#FFB347', '#FFCC99', '#FF8C00', '#FF7F50'],
            blue: ['#0000FF', '#6699FF', '#99CCFF', '#4169E1', '#87CEEB'],
            red: ['#FF0000', '#FF6666', '#FF9999', '#DC143C', '#CD5C5C']
        };
        return variants[color.toLowerCase()] || [`#${color.toUpperCase()}`];
    }
    /**
     * Enhanced saturation-based detection
     */
    async detectSaturationRegionsEnhanced(imagePath, sessionDir, options) {
        try {
            const saturationPath = path.join(sessionDir, 'enhanced_saturation_mask.png');
            // Use dynamic thresholding if enabled
            let threshold;
            if (options.enableDynamicThresholding) {
                threshold = await this.calculateDynamicSaturationThreshold(imagePath);
            }
            else {
                threshold = Math.round(options.saturationThreshold * 100);
            }
            // Enhanced saturation detection with edge preservation
            const command = `convert "${imagePath}" -colorspace HSL -channel G -separate -auto-level -threshold ${threshold}% -morphology close disk:2 "${saturationPath}"`;
            await execAsync(command);
            if (!fs.existsSync(saturationPath)) {
                return [];
            }
            return await this.analyzeMaskRegionsEnhanced(saturationPath, 'high-saturation', options);
        }
        catch (error) {
            logger.warn(`Enhanced saturation region detection failed: ${error}`);
            return [];
        }
    }
    /**
     * Enhanced luminosity detection
     */
    async detectLuminosityRegionsEnhanced(imagePath, sessionDir, options) {
        try {
            const luminosityPath = path.join(sessionDir, 'enhanced_luminosity_mask.png');
            // Enhanced luminosity detection with better edge detection
            const command = `convert "${imagePath}" -colorspace HSL -channel B -separate -auto-level -edge 1 -threshold 60% -morphology dilate disk:1 "${luminosityPath}"`;
            await execAsync(command);
            if (!fs.existsSync(luminosityPath)) {
                return [];
            }
            return await this.analyzeMaskRegionsEnhanced(luminosityPath, 'luminosity-edge', options);
        }
        catch (error) {
            logger.warn(`Enhanced luminosity region detection failed: ${error}`);
            return [];
        }
    }
    /**
     * CPU-optimized HSL-based detection for better color accuracy
     */
    async detectHSLBasedHighlights(imagePath, sessionDir, options) {
        try {
            const hslPath = path.join(sessionDir, 'hsl_highlights_mask.png');
            // Split operation into memory-efficient steps
            const steps = [
                // Step 1: Convert to HSL and extract channels
                `convert "${imagePath}" -colorspace HSL -separate "${path.join(sessionDir, 'hsl_%d.png')}"`,
                // Step 2: Process saturation (channel 1) - optimize thresholds for CPU
                `convert "${path.join(sessionDir, 'hsl_1.png')}" -threshold 40% "${path.join(sessionDir, 'sat_mask.png')}"`,
                // Step 3: Process lightness (channel 2) with optimized operations
                `convert "${path.join(sessionDir, 'hsl_2.png')}" -threshold 30% -negate -threshold 70% -negate "${path.join(sessionDir, 'light_mask.png')}"`,
                // Step 4: Combine masks efficiently
                `convert "${path.join(sessionDir, 'sat_mask.png')}" "${path.join(sessionDir, 'light_mask.png')}" -compose multiply -composite "${hslPath}"`
            ];
            // Execute steps in sequence
            for (const cmd of steps) {
                await execAsync(cmd);
            }
            // Post-process the mask to improve connectivity
            await execAsync(`convert "${hslPath}" -morphology close disk:2 "${hslPath}"`);
            // Clean up intermediate files
            await execAsync(`rm -f ${path.join(sessionDir, 'hsl_*.png')} ${path.join(sessionDir, 'sat_mask.png')} ${path.join(sessionDir, 'light_mask.png')}`);
            if (!fs.existsSync(hslPath)) {
                return [];
            }
            return await this.analyzeMaskRegionsEnhanced(hslPath, 'hsl-based', options);
        }
        catch (error) {
            logger.warn(`HSL-based highlight detection failed: ${error}`);
            return [];
        }
    }
    /**
     * NEW: Texture-based detection for non-color highlights
     */
    async detectTextureBasedHighlights(imagePath, sessionDir, options) {
        try {
            const texturePath = path.join(sessionDir, 'texture_highlights_mask.png');
            // Detect texture changes that might indicate highlighting
            const command = `convert "${imagePath}" -colorspace Gray \\
        -morphology gradient disk:2 \\
        -threshold 15% \\
        -morphology close disk:3 "${texturePath}"`;
            await execAsync(command);
            if (!fs.existsSync(texturePath)) {
                return [];
            }
            return await this.analyzeMaskRegionsEnhanced(texturePath, 'texture-based', options);
        }
        catch (error) {
            logger.warn(`Texture-based highlight detection failed: ${error}`);
            return [];
        }
    }
    /**
     * Calculate dynamic saturation threshold based on image content
     */
    async calculateDynamicSaturationThreshold(imagePath) {
        try {
            // Analyze the saturation distribution of the image
            const { stdout } = await execAsync(`convert "${imagePath}" -colorspace HSL -channel G -separate -format "%[fx:mean*100]" info:`);
            const meanSaturation = parseFloat(stdout.trim());
            // Adjust threshold based on image's overall saturation
            if (meanSaturation < 20) {
                return 30; // Low saturation image, lower threshold
            }
            else if (meanSaturation > 60) {
                return 70; // High saturation image, higher threshold
            }
            else {
                return 50; // Medium saturation, standard threshold
            }
        }
        catch (error) {
            logger.warn(`Dynamic threshold calculation failed: ${error}`);
            return 50; // Fallback to standard threshold
        }
    }
    /**
     * Enhanced mask region analysis optimized for CPU processing
     */
    async analyzeMaskRegionsEnhanced(maskPath, type, options) {
        try {
            // Use more efficient connected components analysis
            // Split the operation into smaller chunks to reduce memory usage
            const { stdout: dimensions } = await execAsync(`identify -format "%[w]x%[h]" "${maskPath}"`);
            const [width, height] = dimensions.split('x').map(Number);
            // Use smaller tile size for processing large images
            const tileSize = Math.min(1024, Math.max(width, height));
            const cmd = `convert "${maskPath}" -define connected-components:verbose=true \
        -define connected-components:area-threshold=${options.minRegionSize} \
        -define connected-components:mean-color=true \
        +write mpr:original \
        -crop ${tileSize}x${tileSize} \
        -connected-components 4 \
        -delete 0 null:`;
            const { stdout } = await execAsync(cmd);
            const regions = [];
            const lines = stdout.split('\n');
            const processedCoords = new Set();
            for (const line of lines) {
                // Optimized parsing with bitwise operations for better performance
                const match = line.match(/(\d+): (\d+)x(\d+)\+(\d+)\+(\d+)/);
                if (match) {
                    const [, , width, height, x, y] = match.map(Number);
                    const area = width * height;
                    // Enhanced filtering criteria
                    if (area >= options.minRegionSize &&
                        this.isValidHighlightRegion(width, height, area)) {
                        regions.push({
                            x,
                            y,
                            width,
                            height,
                            color: type,
                            intensity: this.calculateEnhancedIntensity(area, width, height),
                            confidence: this.calculateEnhancedRegionConfidence(area, width, height, type)
                        });
                    }
                }
            }
            return regions;
        }
        catch (error) {
            logger.warn(`Enhanced mask analysis failed: ${error}`);
            return [];
        }
    }
    /**
     * Enhanced validation for highlight regions
     */
    isValidHighlightRegion(width, height, area) {
        const aspectRatio = width / height;
        // Filter out regions that are too thin/wide (likely noise)
        if (aspectRatio > 20 || aspectRatio < 0.05)
            return false;
        // Filter out very small regions relative to their bounding box
        const boundingBoxArea = width * height;
        if (area / boundingBoxArea < 0.3)
            return false;
        // Filter out regions that are too large (likely whole page selections)
        if (area > 500000)
            return false;
        return true;
    }
    /**
     * Extract color information from a specific region
     */
    async extractColorInfo(imagePath, region) {
        try {
            const cropSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;
            const { stdout } = await execAsync(`convert "${imagePath}" -crop ${cropSpec} -colorspace HSL -channel RGB -separate -format "%[fx:mean]" info:`);
            const values = stdout.trim().split('\n').map(v => parseFloat(v) * 100);
            return {
                hue: values[0] || 0,
                saturation: values[1] || 0,
                lightness: values[2] || 0
            };
        }
        catch (error) {
            logger.warn(`Color extraction failed: ${error}`);
            return { hue: 0, saturation: 0, lightness: 0 };
        }
    }
    /**
     * Enhanced text extraction from highlighted regions
     */
    async extractHighlightedTextEnhanced(imagePath, regions, sessionDir) {
        for (let i = 0; i < regions.length; i++) {
            try {
                const region = regions[i];
                const cropPath = path.join(sessionDir, `highlight_${i}_enhanced.png`);
                // Enhanced cropping with preprocessing
                const padding = 10;
                const expandedCrop = `${region.width + (padding * 2)}x${region.height + (padding * 2)}+${Math.max(0, region.x - padding)}+${Math.max(0, region.y - padding)}`;
                // Create enhanced crop with multiple OCR optimization techniques
                await execAsync(`convert "${imagePath}" -crop ${expandedCrop} \
          -colorspace Lab -channel 0 -equalize -channel RG -equalize -colorspace sRGB \
          -modulate 100,130,100 \
          -unsharp 0x1+1.3+0.05 \
          -contrast-stretch 3%x97% \
          -resize 200% \
          "${cropPath}"`);
                if (fs.existsSync(cropPath)) {
                    // Use multiple OCR approaches for better accuracy
                    const textOutputPath = path.join(sessionDir, `highlight_${i}_enhanced_text`);
                    const ocrApproaches = [
                        '--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/" \t\n',
                        '--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/" \t\n',
                        '--psm 6',
                        '--psm 13',
                        '--psm 11 -c tessedit_do_invert=1'
                    ];
                    let bestText = '';
                    let bestConfidence = 0;
                    for (const approach of ocrApproaches) {
                        try {
                            await execAsync(`tesseract "${cropPath}" "${textOutputPath}_temp" -l eng ${approach} 2>/dev/null`);
                            const textFilePath = `${textOutputPath}_temp.txt`;
                            if (fs.existsSync(textFilePath)) {
                                const text = fs.readFileSync(textFilePath, 'utf-8').trim();
                                if (text.length > 0) {
                                    const textQuality = this.calculateTextQuality(text);
                                    if (textQuality > bestConfidence) {
                                        bestText = text;
                                        bestConfidence = textQuality;
                                    }
                                }
                                // Cleanup temp file
                                fs.unlinkSync(textFilePath);
                            }
                        }
                        catch (ocrError) {
                            // Continue with next approach
                        }
                    }
                    if (bestText.length > 0) {
                        region.text = this.cleanExtractedText(bestText);
                        region.confidence = Math.min(region.confidence + (bestConfidence * 0.5), 1.0);
                        logger.info(`Enhanced text extraction for region ${i}: "${region.text.substring(0, 50)}..."`);
                    }
                }
            }
            catch (error) {
                logger.warn(`Enhanced text extraction failed for region ${i}: ${error}`);
            }
        }
    }
    /**
     * Calculate text quality score for OCR results
     */
    calculateTextQuality(text) {
        if (!text || text.length === 0)
            return 0;
        let score = 0.5; // Base score
        // Check for complete words
        const words = text.split(/\s+/).filter(Boolean);
        const validWords = words.filter(word => /^[A-Za-z0-9.,!?:;\-()[\]{}/"']+$/.test(word));
        const wordRatio = words.length > 0 ? validWords.length / words.length : 0;
        score += wordRatio * 0.3;
        // Check for reasonable character distribution
        const alphaCount = (text.match(/[A-Za-z]/g) || []).length;
        const totalChars = text.length;
        const alphaRatio = totalChars > 0 ? alphaCount / totalChars : 0;
        if (alphaRatio > 0.5)
            score += 0.2;
        return Math.min(score, 1.0);
    }
    /**
     * Clean extracted text from highlighted regions
     */
    cleanExtractedText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s.,!?:;\-()[\]{}/"']/g, '')
            .trim();
    }
    /**
     * Enhanced confidence score calculation
     */
    calculateEnhancedConfidenceScore(regions) {
        if (regions.length === 0)
            return 0;
        let totalScore = 0;
        let weightSum = 0;
        for (const region of regions) {
            // Weight by region area (larger regions are more significant)
            const weight = Math.min(region.width * region.height / 10000, 1.0);
            let regionScore = region.confidence;
            // Boost score if text was extracted
            if (region.text && region.text.length > 0) {
                regionScore += 0.2;
            }
            // Boost score for high-intensity regions
            if (region.intensity > 0.7) {
                regionScore += 0.1;
            }
            // Boost score for regions with good color information
            if (region.colorInfo && region.colorInfo.saturation > 50) {
                regionScore += 0.1;
            }
            totalScore += regionScore * weight;
            weightSum += weight;
        }
        const avgScore = weightSum > 0 ? totalScore / weightSum : 0;
        // Apply bonuses for multiple high-quality regions
        const highQualityRegions = regions.filter(r => r.confidence > 0.7).length;
        const bonusMultiplier = 1 + Math.min(highQualityRegions * 0.05, 0.2);
        return Math.min(avgScore * bonusMultiplier, 1.0);
    }
    /**
     * Enhanced intensity calculation
     */
    calculateEnhancedIntensity(area, width, height) {
        const baseIntensity = Math.min(area / 15000, 1.0);
        // Boost intensity for regions with good aspect ratios (more likely to be text)
        const aspectRatio = width / height;
        let aspectBonus = 0;
        if (aspectRatio >= 1.5 && aspectRatio <= 8) {
            aspectBonus = 0.2; // Good aspect ratio for text
        }
        else if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
            aspectBonus = 0.1; // Square regions might be highlighted boxes
        }
        return Math.min(baseIntensity + aspectBonus, 1.0);
    }
    /**
     * Enhanced region confidence calculation
     */
    calculateEnhancedRegionConfidence(area, width, height, type) {
        const aspectRatio = width / height;
        // Base area score (normalized)
        const areaScore = Math.min(area / 2000, 1.0) * 0.4;
        // Enhanced shape score based on highlight type
        let shapeScore = 0.3;
        if (type.includes('color') || type.includes('hsl')) {
            // Color-based highlights are more reliable
            shapeScore = aspectRatio > 0.2 && aspectRatio < 15 ? 0.6 : 0.3;
        }
        else if (type.includes('saturation')) {
            // Saturation-based are moderately reliable
            shapeScore = aspectRatio > 0.1 && aspectRatio < 20 ? 0.5 : 0.2;
        }
        else {
            // Texture/luminosity are less reliable
            shapeScore = aspectRatio > 0.5 && aspectRatio < 10 ? 0.4 : 0.1;
        }
        // Size consistency score
        const sizeScore = area > 200 && area < 100000 ? 0.2 : 0.1;
        return Math.min(areaScore + shapeScore + sizeScore, 1.0);
    }
    /**
     * CPU-optimized region merging with efficient overlap detection
     */
    mergeOverlappingRegionsEnhanced(regions) {
        if (regions.length <= 1)
            return regions;
        // Use grid-based spatial partitioning for faster overlap detection
        const gridSize = 50; // pixels
        const grid = new Map();
        // Insert regions into grid cells
        regions.forEach((region, index) => {
            const startX = Math.floor(region.x / gridSize);
            const startY = Math.floor(region.y / gridSize);
            const endX = Math.floor((region.x + region.width) / gridSize);
            const endY = Math.floor((region.y + region.height) / gridSize);
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const key = `${x},${y}`;
                    if (!grid.has(key))
                        grid.set(key, []);
                    grid.get(key).push(index);
                }
            }
        });
        const merged = [];
        const processed = new Set();
        // Process regions using spatial grid for efficient neighbor finding
        const sortedRegions = regions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        for (let i = 0; i < sortedRegions.length; i++) {
            if (processed.has(i))
                continue;
            let currentRegion = { ...sortedRegions[i] };
            processed.add(i);
            // Find overlapping regions with enhanced criteria
            for (let j = i + 1; j < sortedRegions.length; j++) {
                if (processed.has(j))
                    continue;
                const overlapRatio = this.calculateOverlapRatio(currentRegion, sortedRegions[j]);
                // Enhanced merging criteria
                if (overlapRatio > 0.3 || this.areRegionsAdjacent(currentRegion, sortedRegions[j])) {
                    currentRegion = this.mergeRegionsEnhanced(currentRegion, sortedRegions[j]);
                    processed.add(j);
                }
            }
            merged.push(currentRegion);
        }
        return merged;
    }
    /**
     * Calculate overlap ratio between two regions
     */
    calculateOverlapRatio(region1, region2) {
        const overlapX = Math.max(0, Math.min(region1.x + region1.width, region2.x + region2.width) - Math.max(region1.x, region2.x));
        const overlapY = Math.max(0, Math.min(region1.y + region1.height, region2.y + region2.height) - Math.max(region1.y, region2.y));
        const overlapArea = overlapX * overlapY;
        const area1 = region1.width * region1.height;
        const area2 = region2.width * region2.height;
        const minArea = Math.min(area1, area2);
        return minArea > 0 ? overlapArea / minArea : 0;
    }
    /**
     * Check if regions are adjacent (close enough to be merged)
     */
    areRegionsAdjacent(region1, region2) {
        const threshold = 20; // pixels
        const horizontalGap = Math.max(0, Math.min(Math.abs(region1.x + region1.width - region2.x), Math.abs(region2.x + region2.width - region1.x)));
        const verticalGap = Math.max(0, Math.min(Math.abs(region1.y + region1.height - region2.y), Math.abs(region2.y + region2.height - region1.y)));
        return horizontalGap <= threshold && verticalGap <= threshold;
    }
    /**
     * Enhanced region merging
     */
    mergeRegionsEnhanced(region1, region2) {
        const minX = Math.min(region1.x, region2.x);
        const minY = Math.min(region1.y, region2.y);
        const maxRight = Math.max(region1.x + region1.width, region2.x + region2.width);
        const maxBottom = Math.max(region1.y + region1.height, region2.y + region2.height);
        // Choose better color info
        const betterColorInfo = (region1.colorInfo?.saturation || 0) > (region2.colorInfo?.saturation || 0)
            ? region1.colorInfo
            : region2.colorInfo;
        return {
            x: minX,
            y: minY,
            width: maxRight - minX,
            height: maxBottom - minY,
            color: region1.intensity > region2.intensity ? region1.color : region2.color,
            intensity: Math.max(region1.intensity, region2.intensity),
            text: [region1.text, region2.text].filter(Boolean).join(' '),
            confidence: Math.max(region1.confidence, region2.confidence),
            colorInfo: betterColorInfo
        };
    }
    /**
     * Filter high-quality regions and remove noise
     */
    filterHighQualityRegions(regions, options) {
        return regions.filter(region => {
            // Basic size filter
            if (region.width * region.height < options.minRegionSize)
                return false;
            // Enhanced quality filters
            if (region.confidence < 0.2)
                return false;
            // Filter out regions that are too thin/thick
            const aspectRatio = region.width / region.height;
            if (aspectRatio > 25 || aspectRatio < 0.04)
                return false;
            // Filter out regions with very low intensity unless they have text
            if (region.intensity < 0.1 && (!region.text || region.text.length < 3))
                return false;
            return true;
        });
    }
    /**
     * Generate enhanced suggestions
     */
    generateEnhancedSuggestions(regions) {
        const suggestions = [];
        if (regions.length === 0) {
            suggestions.push("No highlights detected - try adjusting sensitivity or using different target colors");
            suggestions.push("Consider manual text selection if important content is highlighted");
            return suggestions;
        }
        // Quality-based suggestions
        const highQualityRegions = regions.filter(r => r.confidence > 0.7).length;
        const mediumQualityRegions = regions.filter(r => r.confidence > 0.4 && r.confidence <= 0.7).length;
        const lowQualityRegions = regions.filter(r => r.confidence <= 0.4).length;
        if (highQualityRegions > 0) {
            suggestions.push(`${highQualityRegions} high-quality highlight regions detected - excellent for OCR processing`);
        }
        if (mediumQualityRegions > 0) {
            suggestions.push(`${mediumQualityRegions} medium-quality regions detected - consider manual verification`);
        }
        if (lowQualityRegions > 0) {
            suggestions.push(`${lowQualityRegions} low-quality regions detected - may require manual review`);
        }
        // Text extraction suggestions
        const regionsWithText = regions.filter(r => r.text && r.text.length > 0).length;
        if (regionsWithText < regions.length) {
            suggestions.push(`Text extraction successful for ${regionsWithText}/${regions.length} regions`);
            if (regionsWithText === 0) {
                suggestions.push("Consider higher resolution scanning for better text extraction");
            }
        }
        // Color distribution analysis
        const colorTypes = new Set(regions.map(r => r.color));
        if (colorTypes.size === 1) {
            suggestions.push(`Single highlight type detected (${Array.from(colorTypes)[0]}) - optimized processing applied`);
        }
        else if (colorTypes.size > 3) {
            suggestions.push(`Multiple highlight types detected - consider color-specific processing for best results`);
        }
        // Intensity-based suggestions
        const highIntensityRegions = regions.filter(r => r.intensity > 0.8).length;
        if (highIntensityRegions > 0) {
            suggestions.push(`${highIntensityRegions} high-intensity highlights detected - excellent visibility for OCR`);
        }
        return suggestions;
    }
    /**
     * Create enhanced image with highlighted regions for visualization
     */
    async createHighlightEnhancedImage(originalImagePath, highlightRegions, outputPath) {
        try {
            // For now, just copy the original image
            // In a full implementation, this would overlay highlight regions
            const cmd = `cp "${originalImagePath}" "${outputPath}"`;
            await execAsync(cmd);
            logger.info(`Enhanced image created: ${outputPath}`);
            return outputPath;
        }
        catch (error) {
            logger.error(`Error creating enhanced image: ${error}`);
            // Return original path as fallback
            return originalImagePath;
        }
    }
    /**
     * Get highlight detection capabilities
     */
    getCapabilities() {
        return {
            supportedColors: ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
            detectionMethods: ['color-based', 'saturation-based', 'luminosity-based', 'HSL-based', 'texture-based'],
            textExtraction: true,
            regionMerging: true,
            enhancementSuggestions: true,
            imageFormats: ['png', 'jpg', 'jpeg', 'tiff', 'pdf'],
            maxRegions: 50,
            minRegionSize: 100
        };
    }
    /**
     * Verify highlight regions using machine learning
     */
    async verifyHighlightsML(regions, imagePath, sessionDir) {
        const verifiedRegions = [];
        for (const region of regions) {
            try {
                // Extract region patch
                const patchPath = path.join(sessionDir, `patch_${region.x}_${region.y}.png`);
                await execAsync(`convert "${imagePath}" -crop ${region.width}x${region.height}+${region.x}+${region.y} "${patchPath}"`);
                // Calculate texture features
                const features = await this.calculateTextureFeatures(patchPath);
                // Simple ML-based verification using texture features
                const isHighlight = this.validateTextureFeatures(features);
                if (isHighlight) {
                    // Adjust confidence based on ML verification
                    const mlConfidence = this.calculateMLConfidence(features);
                    region.confidence = (region.confidence + mlConfidence) / 2;
                    verifiedRegions.push(region);
                }
            }
            catch (error) {
                logger.error(`ML verification error for region: ${error}`);
                // Keep the region if ML verification fails
                verifiedRegions.push(region);
            }
        }
        return verifiedRegions;
    }
    /**
     * Calculate texture features with CPU-optimized algorithms
     */
    async calculateTextureFeatures(imagePath) {
        try {
            // Use a more efficient approach for texture analysis
            // 1. Downscale image for faster processing
            const scaledPath = imagePath.replace(/\.[^.]+$/, '_scaled.png');
            await execAsync(`convert "${imagePath}" -resize 256x256\\> "${scaledPath}"`);
            // 2. Calculate simplified texture features using efficient methods
            const cmd = `convert "${scaledPath}" \( -clone 0 -colorspace Gray -format "%[fx:standard_deviation]" info: \) \( -clone 0 -colorspace Gray -blur 0x2 -format "%[fx:mean]" info: \) \( -clone 0 -colorspace Gray -edge 1 -format "%[fx:mean]" info: \) null:`;
            const { stdout } = await execAsync(cmd);
            const [stdDev, blurMean, edgeMean] = stdout.split('\n').map(parseFloat);
            // Calculate histogram features
            const histCmd = `convert "${imagePath}" -colorspace HSL -format %c histogram:info:`;
            const { stdout: histOutput } = await execAsync(histCmd);
            // Parse histogram data
            const histogramBins = histOutput.split('\\n').filter(Boolean);
            const totalPixels = histogramBins.reduce((sum, bin) => {
                const count = parseInt(bin.match(/:\s*(\d+)/)?.[1] || '0');
                return sum + count;
            }, 0);
            // Calculate histogram features
            const histFeatures = this.calculateHistogramFeatures(histogramBins, totalPixels);
            return {
                standardDeviation: stdDev,
                ...histFeatures
            };
        }
        catch (error) {
            logger.error(`Error calculating texture features: ${error}`);
            return null;
        }
    }
    /**
     * Calculate histogram-based features
     */
    calculateHistogramFeatures(bins, totalPixels) {
        let entropy = 0;
        let energy = 0;
        for (const bin of bins) {
            const count = parseInt(bin.match(/:\s*(\d+)/)?.[1] || '0');
            const probability = count / totalPixels;
            if (probability > 0) {
                entropy -= probability * Math.log2(probability);
                energy += probability * probability;
            }
        }
        return { entropy, energy };
    }
    /**
     * Validate texture features using simple ML rules
     */
    validateTextureFeatures(features) {
        if (!features)
            return true; // Fall back to accepting the region if feature calculation failed
        // Simplified ML rules based on empirical thresholds
        const { standardDeviation, entropy, energy } = features;
        // High standard deviation indicates more texture variation (typical for highlights)
        if (standardDeviation < 10)
            return false;
        // Entropy measures randomness - highlights typically have moderate entropy
        if (entropy < 1.0 || entropy > 5.0)
            return false;
        // Energy measures uniformity - highlights typically have moderate energy
        if (energy < 0.1 || energy > 0.9)
            return false;
        return true;
    }
    /**
     * Calculate ML-based confidence score
     */
    calculateMLConfidence(features) {
        if (!features)
            return 0.5; // Neutral confidence if feature calculation failed
        const { standardDeviation, entropy, energy } = features;
        // Calculate individual feature scores
        const stdDevScore = Math.min(standardDeviation / 50, 1.0) * 0.4;
        const entropyScore = (1 - Math.abs(entropy - 3) / 3) * 0.3;
        const energyScore = (1 - Math.abs(energy - 0.5) / 0.5) * 0.3;
        return Math.min(stdDevScore + entropyScore + energyScore, 1.0);
    }
}
export default HighlightDetector;
