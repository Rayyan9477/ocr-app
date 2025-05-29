"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractConfidenceScores = extractConfidenceScores;
exports.saveConfidenceData = saveConfidenceData;
exports.loadConfidenceData = loadConfidenceData;
var child_process_1 = require("child_process");
var util_1 = require("util");
var fs_1 = require("fs");
var path_1 = require("path");
var logger_1 = require("./logger");
var config_1 = require("./config");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Extract confidence scores from a PDF using Tesseract's hOCR output
 * Enhanced to handle both original files and processed OCR outputs
 */
function extractConfidenceScores(inputPath_1, outputPath_1) {
    return __awaiter(this, arguments, void 0, function (inputPath, outputPath, useProcessedFile) {
        var tempDir, analysisTarget, hocrPath, hasExistingText, extractedText, textContent, error_1, imageDir, dpi, readdir, imageFiles, pageHocrFiles, i, imagePath, pageHocrPath, tesseractOptions, pageError_1, fallbackModes, _i, fallbackModes_1, psm, fallbackOptions, fallbackError_1, _a, readFile_1, writeFile, combinedHocr, i, pageContent, pageStartMatch, startIndex, bodyEndIndex, pageDiv, tesseractCommand, error_2, imageDir, readdir, imageFiles, hocrFiles, i, imagePath, pageHocrPath, pageError_2, fallbackError_2, _b, readFile_2, writeFile, combinedHocr, i, pageContent, pageStartMatch, startIndex, bodyEndIndex, pageDiv, conversionError_1, readFile, hocrContent, confidenceData, averageConfidence, _c, warningPages, errorPages, documentConfidence, error_3;
        if (useProcessedFile === void 0) { useProcessedFile = false; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!config_1.default.confidence.enableConfidenceTracking) {
                        return [2 /*return*/, null];
                    }
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 69, , 70]);
                    logger_1.default.info("Extracting confidence scores for ".concat(inputPath));
                    tempDir = (0, path_1.join)(process.cwd(), 'tmp', 'confidence_' + Date.now());
                    return [4 /*yield*/, execAsync("mkdir -p \"".concat(tempDir, "\""))];
                case 2:
                    _d.sent();
                    analysisTarget = useProcessedFile && (0, fs_1.existsSync)(outputPath) ? outputPath : inputPath;
                    logger_1.default.info("Using ".concat(analysisTarget, " for confidence analysis"));
                    hocrPath = (0, path_1.join)(tempDir, 'output.hocr');
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 61, , 63]);
                    if (!analysisTarget.toLowerCase().endsWith('.pdf')) return [3 /*break*/, 34];
                    logger_1.default.info('Converting PDF to images for confidence analysis');
                    hasExistingText = false;
                    extractedText = '';
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, execAsync("pdftotext \"".concat(analysisTarget, "\" -"))];
                case 5:
                    textContent = (_d.sent()).stdout;
                    extractedText = textContent.trim();
                    hasExistingText = extractedText.length > 0;
                    logger_1.default.info("PDF has existing text: ".concat(hasExistingText, " (").concat(extractedText.length, " characters)"));
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _d.sent();
                    logger_1.default.warn("Could not extract text from PDF: ".concat(error_1));
                    return [3 /*break*/, 7];
                case 7:
                    // Note: For processed PDFs with existing text, we could estimate confidence,
                    // but for accuracy we'll always perform proper page-by-page analysis.
                    // This ensures accurate page counts and detailed confidence metrics.
                    if (hasExistingText && useProcessedFile && extractedText.length > 100) {
                        logger_1.default.info('PDF has substantial text content, but performing full page analysis for accuracy');
                    }
                    imageDir = (0, path_1.join)(tempDir, 'pages');
                    return [4 /*yield*/, execAsync("mkdir -p \"".concat(imageDir, "\""))];
                case 8:
                    _d.sent();
                    dpi = hasExistingText ? 150 : 300;
                    return [4 /*yield*/, execAsync("pdftoppm -png -r ".concat(dpi, " \"").concat(analysisTarget, "\" \"").concat(imageDir, "/page\""))];
                case 9:
                    _d.sent();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 10:
                    readdir = (_d.sent()).readdir;
                    return [4 /*yield*/, readdir(imageDir)];
                case 11:
                    imageFiles = (_d.sent())
                        .filter(function (f) { return f.endsWith('.png'); })
                        .sort(function (a, b) {
                        var _a, _b;
                        // Ensure proper numerical sorting (page-1.png, page-2.png, etc.)
                        var aNum = parseInt(((_a = a.match(/(\d+)\.png$/)) === null || _a === void 0 ? void 0 : _a[1]) || '0');
                        var bNum = parseInt(((_b = b.match(/(\d+)\.png$/)) === null || _b === void 0 ? void 0 : _b[1]) || '0');
                        return aNum - bNum;
                    });
                    if (!(imageFiles.length === 0)) return [3 /*break*/, 13];
                    logger_1.default.warn("No images generated from PDF ".concat(analysisTarget));
                    return [4 /*yield*/, execAsync("rm -rf \"".concat(tempDir, "\"")).catch(function () { })];
                case 12:
                    _d.sent();
                    return [2 /*return*/, null];
                case 13:
                    logger_1.default.info("Generated ".concat(imageFiles.length, " page images for analysis"));
                    pageHocrFiles = [];
                    i = 0;
                    _d.label = 14;
                case 14:
                    if (!(i < imageFiles.length)) return [3 /*break*/, 25];
                    imagePath = (0, path_1.join)(imageDir, imageFiles[i]);
                    pageHocrPath = (0, path_1.join)(tempDir, "page_".concat(i + 1, ".hocr"));
                    _d.label = 15;
                case 15:
                    _d.trys.push([15, 17, , 24]);
                    tesseractOptions = [
                        '-l eng',
                        '--psm 1', // Automatic page segmentation with OSD
                        '--oem 3', // Use both legacy and LSTM engines
                        '-c tessedit_create_hocr=1',
                        '-c hocr_font_info=1'
                    ].join(' ');
                    return [4 /*yield*/, execAsync("tesseract \"".concat(imagePath, "\" \"").concat(pageHocrPath.replace('.hocr', ''), "\" ").concat(tesseractOptions, " hocr"))];
                case 16:
                    _d.sent();
                    if ((0, fs_1.existsSync)(pageHocrPath)) {
                        pageHocrFiles.push(pageHocrPath);
                        logger_1.default.info("Successfully processed page ".concat(i + 1));
                    }
                    return [3 /*break*/, 24];
                case 17:
                    pageError_1 = _d.sent();
                    logger_1.default.warn("Failed to process page ".concat(i + 1, " with PSM 1: ").concat(pageError_1));
                    fallbackModes = [3, 6, 4];
                    _i = 0, fallbackModes_1 = fallbackModes;
                    _d.label = 18;
                case 18:
                    if (!(_i < fallbackModes_1.length)) return [3 /*break*/, 23];
                    psm = fallbackModes_1[_i];
                    _d.label = 19;
                case 19:
                    _d.trys.push([19, 21, , 22]);
                    fallbackOptions = "-l eng --psm ".concat(psm, " --oem 3");
                    return [4 /*yield*/, execAsync("tesseract \"".concat(imagePath, "\" \"").concat(pageHocrPath.replace('.hocr', ''), "\" ").concat(fallbackOptions, " hocr"))];
                case 20:
                    _d.sent();
                    if ((0, fs_1.existsSync)(pageHocrPath)) {
                        pageHocrFiles.push(pageHocrPath);
                        logger_1.default.info("Successfully processed page ".concat(i + 1, " with PSM ").concat(psm));
                        return [3 /*break*/, 23];
                    }
                    return [3 /*break*/, 22];
                case 21:
                    fallbackError_1 = _d.sent();
                    logger_1.default.warn("PSM ".concat(psm, " also failed for page ").concat(i + 1, ": ").concat(fallbackError_1));
                    return [3 /*break*/, 22];
                case 22:
                    _i++;
                    return [3 /*break*/, 18];
                case 23: return [3 /*break*/, 24];
                case 24:
                    i++;
                    return [3 /*break*/, 14];
                case 25:
                    if (!(pageHocrFiles.length === 0)) return [3 /*break*/, 27];
                    logger_1.default.warn("No hOCR files generated for ".concat(inputPath));
                    return [4 /*yield*/, execAsync("rm -rf \"".concat(tempDir, "\"")).catch(function () { })];
                case 26:
                    _d.sent();
                    return [2 /*return*/, null];
                case 27: return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 28:
                    _a = _d.sent(), readFile_1 = _a.readFile, writeFile = _a.writeFile;
                    combinedHocr = '';
                    i = 0;
                    _d.label = 29;
                case 29:
                    if (!(i < pageHocrFiles.length)) return [3 /*break*/, 32];
                    return [4 /*yield*/, readFile_1(pageHocrFiles[i], 'utf-8')];
                case 30:
                    pageContent = _d.sent();
                    if (i === 0) {
                        // For the first page, include the full hOCR structure
                        combinedHocr = pageContent;
                    }
                    else {
                        pageStartMatch = pageContent.match(/<div class='ocr_page'[^>]*>/);
                        if (pageStartMatch) {
                            startIndex = pageContent.indexOf(pageStartMatch[0]);
                            bodyEndIndex = pageContent.indexOf('</body>');
                            if (startIndex !== -1 && bodyEndIndex !== -1) {
                                pageDiv = pageContent.substring(startIndex, bodyEndIndex).trim();
                                // Replace the closing body and html tags with the new page content
                                combinedHocr = combinedHocr.replace(/<\/body>\s*<\/html>\s*$/, pageDiv + '\n</body>\n</html>');
                            }
                        }
                    }
                    _d.label = 31;
                case 31:
                    i++;
                    return [3 /*break*/, 29];
                case 32: 
                // Write the combined hOCR content
                return [4 /*yield*/, writeFile(hocrPath, combinedHocr, 'utf-8')];
                case 33:
                    // Write the combined hOCR content
                    _d.sent();
                    return [3 /*break*/, 60];
                case 34:
                    tesseractCommand = "tesseract \"".concat(inputPath, "\" \"").concat((0, path_1.join)(tempDir, 'output'), "\" -l eng --psm 1 hocr");
                    _d.label = 35;
                case 35:
                    _d.trys.push([35, 37, , 60]);
                    // First try direct PDF processing with Tesseract (may fail)
                    return [4 /*yield*/, execAsync(tesseractCommand)];
                case 36:
                    // First try direct PDF processing with Tesseract (may fail)
                    _d.sent();
                    return [3 /*break*/, 60];
                case 37:
                    error_2 = _d.sent();
                    logger_1.default.warn("Direct PDF processing failed: ".concat(error_2, ". Converting to images first."));
                    imageDir = (0, path_1.join)(tempDir, 'images');
                    return [4 /*yield*/, execAsync("mkdir -p \"".concat(imageDir, "\""))];
                case 38:
                    _d.sent();
                    return [4 /*yield*/, execAsync("pdftoppm -png -r 300 \"".concat(inputPath, "\" \"").concat(imageDir, "/page\""))];
                case 39:
                    _d.sent();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 40:
                    readdir = (_d.sent()).readdir;
                    return [4 /*yield*/, readdir(imageDir)];
                case 41:
                    imageFiles = (_d.sent())
                        .filter(function (f) { return f.endsWith('.png'); })
                        .sort(function (a, b) {
                        var _a, _b;
                        var aNum = parseInt(((_a = a.match(/(\d+)\.png$/)) === null || _a === void 0 ? void 0 : _a[1]) || '0');
                        var bNum = parseInt(((_b = b.match(/(\d+)\.png$/)) === null || _b === void 0 ? void 0 : _b[1]) || '0');
                        return aNum - bNum;
                    });
                    hocrFiles = [];
                    i = 0;
                    _d.label = 42;
                case 42:
                    if (!(i < imageFiles.length)) return [3 /*break*/, 51];
                    imagePath = (0, path_1.join)(imageDir, imageFiles[i]);
                    pageHocrPath = (0, path_1.join)(tempDir, "page_".concat(i + 1, ".hocr"));
                    _d.label = 43;
                case 43:
                    _d.trys.push([43, 45, , 50]);
                    return [4 /*yield*/, execAsync("tesseract \"".concat(imagePath, "\" \"").concat(pageHocrPath.replace('.hocr', ''), "\" -l eng --psm 1 hocr"))];
                case 44:
                    _d.sent();
                    if ((0, fs_1.existsSync)(pageHocrPath)) {
                        hocrFiles.push(pageHocrPath);
                    }
                    return [3 /*break*/, 50];
                case 45:
                    pageError_2 = _d.sent();
                    logger_1.default.warn("Failed to process page ".concat(i + 1, ": ").concat(pageError_2));
                    _d.label = 46;
                case 46:
                    _d.trys.push([46, 48, , 49]);
                    return [4 /*yield*/, execAsync("tesseract \"".concat(imagePath, "\" \"").concat(pageHocrPath.replace('.hocr', ''), "\" -l eng --psm 3 hocr"))];
                case 47:
                    _d.sent();
                    if ((0, fs_1.existsSync)(pageHocrPath)) {
                        hocrFiles.push(pageHocrPath);
                    }
                    return [3 /*break*/, 49];
                case 48:
                    fallbackError_2 = _d.sent();
                    logger_1.default.warn("Fallback processing also failed for page ".concat(i + 1, ": ").concat(fallbackError_2));
                    return [3 /*break*/, 49];
                case 49: return [3 /*break*/, 50];
                case 50:
                    i++;
                    return [3 /*break*/, 42];
                case 51:
                    if (!(hocrFiles.length > 0)) return [3 /*break*/, 58];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 52:
                    _b = _d.sent(), readFile_2 = _b.readFile, writeFile = _b.writeFile;
                    combinedHocr = '';
                    i = 0;
                    _d.label = 53;
                case 53:
                    if (!(i < hocrFiles.length)) return [3 /*break*/, 56];
                    return [4 /*yield*/, readFile_2(hocrFiles[i], 'utf-8')];
                case 54:
                    pageContent = _d.sent();
                    if (i === 0) {
                        // For the first page, include the full hOCR structure
                        combinedHocr = pageContent;
                    }
                    else {
                        pageStartMatch = pageContent.match(/<div class='ocr_page'[^>]*>/);
                        if (pageStartMatch) {
                            startIndex = pageContent.indexOf(pageStartMatch[0]);
                            bodyEndIndex = pageContent.indexOf('</body>');
                            if (startIndex !== -1 && bodyEndIndex !== -1) {
                                pageDiv = pageContent.substring(startIndex, bodyEndIndex).trim();
                                // Replace the closing body and html tags with the new page content
                                combinedHocr = combinedHocr.replace(/<\/body>\s*<\/html>\s*$/, pageDiv + '\n</body>\n</html>');
                            }
                        }
                    }
                    _d.label = 55;
                case 55:
                    i++;
                    return [3 /*break*/, 53];
                case 56: return [4 /*yield*/, writeFile(hocrPath, combinedHocr, 'utf-8')];
                case 57:
                    _d.sent();
                    return [3 /*break*/, 59];
                case 58: throw new Error('No pages could be processed with Tesseract');
                case 59: return [3 /*break*/, 60];
                case 60: return [3 /*break*/, 63];
                case 61:
                    conversionError_1 = _d.sent();
                    logger_1.default.error("Error during PDF conversion or Tesseract processing: ".concat(conversionError_1));
                    return [4 /*yield*/, execAsync("rm -rf \"".concat(tempDir, "\"")).catch(function () { })];
                case 62:
                    _d.sent();
                    return [2 /*return*/, null];
                case 63:
                    if (!!(0, fs_1.existsSync)(hocrPath)) return [3 /*break*/, 65];
                    logger_1.default.warn("hOCR file not generated for ".concat(inputPath));
                    // Cleanup
                    return [4 /*yield*/, execAsync("rm -rf \"".concat(tempDir, "\"")).catch(function () { })];
                case 64:
                    // Cleanup
                    _d.sent();
                    return [2 /*return*/, null];
                case 65: return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 66:
                    readFile = (_d.sent()).readFile;
                    return [4 /*yield*/, readFile(hocrPath, 'utf-8')];
                case 67:
                    hocrContent = _d.sent();
                    confidenceData = parseHocrConfidence(hocrContent);
                    // Cleanup temporary files
                    return [4 /*yield*/, execAsync("rm -rf \"".concat(tempDir, "\"")).catch(function () { })];
                case 68:
                    // Cleanup temporary files
                    _d.sent();
                    averageConfidence = calculateAverageConfidence(confidenceData);
                    _c = categorizePages(confidenceData), warningPages = _c.warningPages, errorPages = _c.errorPages;
                    documentConfidence = {
                        documentId: generateDocumentId(inputPath),
                        inputFile: inputPath,
                        outputFile: outputPath,
                        averageConfidence: averageConfidence,
                        pageConfidences: confidenceData,
                        processedAt: new Date(),
                        hasLowConfidencePages: warningPages.length > 0 || errorPages.length > 0,
                        warningPages: warningPages,
                        errorPages: errorPages,
                    };
                    // Log confidence information
                    logger_1.default.info("Confidence analysis for ".concat(inputPath, ": Average=").concat(averageConfidence.toFixed(2), "%, Warning pages=").concat(warningPages.length, ", Error pages=").concat(errorPages.length));
                    return [2 /*return*/, documentConfidence];
                case 69:
                    error_3 = _d.sent();
                    logger_1.default.error("Error extracting confidence scores for ".concat(inputPath, ":"), error_3);
                    return [2 /*return*/, null];
                case 70: return [2 /*return*/];
            }
        });
    });
}
/**
 * Parse hOCR content to extract confidence scores
 */
function parseHocrConfidence(hocrContent) {
    var pages = [];
    // Use a more robust method to extract pages by finding page divs and matching closing tags
    var pageRegex = /<div class='ocr_page'[^>]*>/g;
    var pageMatch;
    var pageStarts = [];
    // Find all page start positions
    while ((pageMatch = pageRegex.exec(hocrContent)) !== null) {
        pageStarts.push(pageMatch.index);
    }
    if (pageStarts.length === 0) {
        return pages;
    }
    // Process each page
    pageStarts.forEach(function (pageStart, pageIndex) {
        // Find the content for this page
        var pageContent;
        if (pageIndex < pageStarts.length - 1) {
            // Not the last page - content goes until the next page starts
            pageContent = hocrContent.substring(pageStart, pageStarts[pageIndex + 1]);
        }
        else {
            // Last page - content goes until </body>
            var bodyEndIndex = hocrContent.indexOf('</body>');
            pageContent = hocrContent.substring(pageStart, bodyEndIndex > -1 ? bodyEndIndex : hocrContent.length);
        }
        // Extract words with confidence scores from this page
        var wordMatches = pageContent.match(/<span class='ocrx_word'[^>]*>([^<]*)<\/span>/g) || [];
        var words = [];
        var totalConfidence = 0;
        var wordCount = 0;
        wordMatches.forEach(function (wordMatch) {
            // Extract confidence score from title attribute (handle both single and double quotes)
            var titleMatch = wordMatch.match(/title=['"][^'"]*x_wconf\s+(\d+)[^'"]*['"]/) ||
                wordMatch.match(/x_wconf\s+(\d+)/);
            var textMatch = wordMatch.match(/>([^<]*)</);
            var bboxMatch = wordMatch.match(/bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
            if (titleMatch && textMatch && bboxMatch) {
                var confidence = parseInt(titleMatch[1], 10);
                var word = textMatch[1].trim();
                var bbox = {
                    x0: parseInt(bboxMatch[1], 10),
                    y0: parseInt(bboxMatch[2], 10),
                    x1: parseInt(bboxMatch[3], 10),
                    y1: parseInt(bboxMatch[4], 10),
                };
                if (word && confidence >= 0) {
                    totalConfidence += confidence;
                    wordCount++;
                    // Store low confidence words (below warning threshold)
                    if (confidence < config_1.default.confidence.pageWarningThreshold) {
                        words.push({ word: word, confidence: confidence, bbox: bbox });
                    }
                }
            }
        });
        var averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
        pages.push({
            pageNumber: pageIndex + 1,
            averageConfidence: averageConfidence,
            wordCount: wordCount,
            lowConfidenceWords: words,
        });
    });
    return pages;
}
/**
 * Calculate overall document confidence
 */
function calculateAverageConfidence(pages) {
    if (pages.length === 0)
        return 0;
    var totalConfidence = 0;
    var totalWords = 0;
    pages.forEach(function (page) {
        totalConfidence += page.averageConfidence * page.wordCount;
        totalWords += page.wordCount;
    });
    return totalWords > 0 ? totalConfidence / totalWords : 0;
}
/**
 * Categorize pages by confidence levels
 */
function categorizePages(pages) {
    var warningPages = [];
    var errorPages = [];
    pages.forEach(function (page) {
        if (page.averageConfidence < config_1.default.confidence.pageErrorThreshold) {
            errorPages.push(page.pageNumber);
        }
        else if (page.averageConfidence < config_1.default.confidence.pageWarningThreshold) {
            warningPages.push(page.pageNumber);
        }
    });
    return { warningPages: warningPages, errorPages: errorPages };
}
/**
 * Estimate confidence from extracted text characteristics
 * This is used for PDFs that already have text layers
 */
function estimateConfidenceFromText(text) {
    if (!text || text.length === 0)
        return 0;
    var confidenceScore = 85; // Start with a reasonable baseline for extracted text
    // Check for text characteristics that indicate good or poor quality
    var totalCharacters = text.length;
    var words = text.split(/\s+/).filter(function (word) { return word.length > 0; });
    var totalWords = words.length;
    if (totalWords === 0)
        return 0;
    // Check for common OCR errors that might indicate poor quality
    var substitutionErrors = (text.match(/[0O][0O]/g) || []).length; // Common O/0 substitutions
    var fragmentedWords = words.filter(function (word) { return word.length === 1 && word.match(/[a-zA-Z]/); }).length;
    var specialCharacters = (text.match(/[^a-zA-Z0-9\s.,!?;:()\-'"]/g) || []).length;
    var upperCaseSequences = (text.match(/[A-Z]{4,}/g) || []).length;
    // Penalize for OCR quality indicators
    if (substitutionErrors > totalWords * 0.05)
        confidenceScore -= 15; // Too many O/0 errors
    if (fragmentedWords > totalWords * 0.1)
        confidenceScore -= 20; // Too many single letters
    if (specialCharacters > totalCharacters * 0.05)
        confidenceScore -= 10; // Too many weird characters
    if (upperCaseSequences > totalWords * 0.1)
        confidenceScore -= 10; // Too many caps sequences
    // Bonus for good characteristics
    var properSentences = (text.match(/[.!?]\s+[A-Z]/g) || []).length;
    var commonWords = words.filter(function (word) {
        return ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word.toLowerCase());
    }).length;
    if (properSentences > 0)
        confidenceScore += 5; // Good sentence structure
    if (commonWords > totalWords * 0.1)
        confidenceScore += 10; // Reasonable common word ratio
    // Average word length check (too short or too long might indicate errors)
    var averageWordLength = words.reduce(function (sum, word) { return sum + word.length; }, 0) / totalWords;
    if (averageWordLength >= 3 && averageWordLength <= 8)
        confidenceScore += 5;
    // Ensure score is within valid range
    return Math.max(0, Math.min(100, confidenceScore));
}
/**
 * Generate a unique document ID
 */
function generateDocumentId(inputPath) {
    var filename = inputPath.split('/').pop() || 'unknown';
    var timestamp = Date.now();
    return "".concat(filename, "_").concat(timestamp);
}
/**
 * Save confidence data to a JSON file alongside the processed PDF
 */
function saveConfidenceData(confidenceData, outputPath) {
    return __awaiter(this, void 0, void 0, function () {
        var writeFile, confidenceFilePath, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 1:
                    writeFile = (_a.sent()).writeFile;
                    confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
                    return [4 /*yield*/, writeFile(confidenceFilePath, JSON.stringify(confidenceData, null, 2), 'utf-8')];
                case 2:
                    _a.sent();
                    logger_1.default.info("Confidence data saved to ".concat(confidenceFilePath));
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    logger_1.default.error('Error saving confidence data:', error_4);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Load confidence data from a JSON file
 */
function loadConfidenceData(outputPath) {
    return __awaiter(this, void 0, void 0, function () {
        var readFile, confidenceFilePath, content, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 1:
                    readFile = (_a.sent()).readFile;
                    confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
                    if (!(0, fs_1.existsSync)(confidenceFilePath)) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, readFile(confidenceFilePath, 'utf-8')];
                case 2:
                    content = _a.sent();
                    return [2 /*return*/, JSON.parse(content)];
                case 3:
                    error_5 = _a.sent();
                    logger_1.default.error('Error loading confidence data:', error_5);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
