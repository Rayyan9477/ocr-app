/**
 * Enhanced OCR API Route
 * Specialized endpoint for enhanced OCR processing with advanced preprocessing
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import * as path from "path";
import { enhancedOCRPipeline } from "../../../lib/enhanced-ocr-pipeline";
import { EnhancedOCROptions } from "../../../lib/enhanced-ocr-pipeline";
import { EnhancedPreprocessingOptions } from "../../../lib/enhanced-preprocessing-types";
import logger from "../../../lib/logger";

// Create response helper
const createJsonResponse = (data: any, status = 200) => {
  return NextResponse.json(data, { 
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};

// Ensure directories exist
const ensureDirectories = async () => {
  const { mkdir } = await import("fs/promises");
  const { existsSync } = await import("fs");
  
  const dirs = [
    join(process.cwd(), "uploads"),
    join(process.cwd(), "processed"),
    join(process.cwd(), "tmp", "enhanced_ocr")
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
};

// Enhanced OCR POST handler
export const POST = async (request: NextRequest) => {
  console.log("Enhanced OCR API called");
  
  let inputPath = "";
  
  await ensureDirectories();
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return createJsonResponse({
        success: false,
        error: "No file provided"
      }, 400);
    }

    // Get file data
    const fileName = file.name;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Determine upload path
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, `enhanced_${Date.now()}_${fileName}`);
    
    // Write the file to uploads directory
    await writeFile(inputPath, buffer);
    console.log(`File saved for enhanced processing: ${inputPath}`);
    
    // Process enhanced OCR options from form data
    const enableAll = formData.get("enableAll")?.toString() === "true";
    
    const preprocessingOptions: EnhancedPreprocessingOptions = {
      // CLAHE settings
      applyCLAHE: enableAll || formData.get("enableCLAHE")?.toString() === "true",
      claheClipLimit: parseFloat(formData.get("claheClipLimit")?.toString() || "2.5"),
      claheTileSize: parseInt(formData.get("claheTileSize")?.toString() || "8"),
      
      // Edge enhancement
      enhanceEdges: enableAll || formData.get("enableEdgeEnhancement")?.toString() === "true",
      edgeStrength: parseFloat(formData.get("edgeStrength")?.toString() || "1.2"),
      
      // Document correction
      deskew: enableAll || formData.get("enableDeskew")?.toString() === "true",
      perspectiveCorrection: enableAll || formData.get("enablePerspectiveCorrection")?.toString() === "true",
      normalize: enableAll || formData.get("enableNormalization")?.toString() === "true",
      
      // Highlight optimization
      optimizeHighlightedText: enableAll || formData.get("enableHighlightOptimization")?.toString() === "true",
      
      // Auto-detection
      autoDetectDocumentType: formData.get("autoDetectDocumentType")?.toString() !== "false"
    };
    
    const ocrOptions: EnhancedOCROptions = {
      outputDir: join(process.cwd(), 'processed', 'enhanced'),
      language: formData.get("language")?.toString() || "eng",
      preprocessing: preprocessingOptions,
      enhanceWithVLM: formData.get("enhanceWithVLM")?.toString() === "true",
      useVLMRecommendations: formData.get("useVLMRecommendations")?.toString() === "true"
    };

    // Log processing options for debugging
    logger.info(`Enhanced OCR processing options: fileName=${fileName}, language=${ocrOptions.language}, enableAll=${enableAll}`);

    // Process document with enhanced OCR pipeline
    const startTime = Date.now();
    const result = await enhancedOCRPipeline.processDocument(inputPath, ocrOptions);
    const totalProcessingTime = Date.now() - startTime;

    if (result.error) {
      logger.error(`Enhanced OCR processing failed: ${result.error}`);
      return createJsonResponse({ 
        success: false, 
        error: result.error,
        processingTime: totalProcessingTime
      }, 500);
    }

    // Prepare detailed response
    const response = {
      success: true,
      
      // Core results
      text: result.text,
      confidence: Math.round(result.confidence * 100) / 100, // Round to 2 decimal places
      
      // Processing metadata
      processingTime: totalProcessingTime,
      pipelineProcessingTime: result.processingTime,
      documentType: result.documentType,
      wordCount: result.wordCount,
      
      // Preprocessing information
      preprocessingOperations: result.preprocessingOperations,
      preprocessingApplied: result.preprocessingOperations.length > 0,
      
      // Highlight information
      highlightedRegionsCount: result.highlightedRegions.length,
      hasHighlights: result.highlightedRegions.length > 0,
      highlightedTexts: result.highlightedRegions
        .filter(region => region.text)
        .map(region => region.text!.substring(0, 100)) // Truncate for API response
        .slice(0, 5), // Limit to first 5 highlights
      
      // Engine information
      selectedEngine: result.error ? 'none' : 'enhanced-pipeline',
      
      // File information
      inputFile: fileName,
      enhancedImageGenerated: !!result.enhancedImagePath,
      
      // Quality metrics
      qualityScore: result.qualityScore,
      
      // Options used
      optionsUsed: {
        language: ocrOptions.language,
        preprocessing: preprocessingOptions,
        vlmEnhanced: ocrOptions.enhanceWithVLM,
        vlmRecommendations: ocrOptions.useVLMRecommendations
      }
    };

    logger.info(`Enhanced OCR completed successfully: fileName=${fileName}, confidence=${response.confidence}, processingTime=${totalProcessingTime}ms, wordCount=${response.wordCount}, highlightedRegions=${response.highlightedRegionsCount}`);

    return createJsonResponse(response);

  } catch (error) {
    logger.error(`Enhanced OCR processing error: ${error}`);
    
    // Clean up input file on error
    if (inputPath) {
      try {
        const { unlink } = await import("fs/promises");
        await unlink(inputPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup input file: ${cleanupError}`);
      }
    }
    
    return createJsonResponse({ 
      success: false, 
      error: 'Enhanced OCR processing failed',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
};

// Support OPTIONS for CORS requests
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

// Other HTTP methods not allowed
export const GET = async () => {
  return createJsonResponse({ 
    success: false, 
    error: "Method Not Allowed. Use POST to submit files for enhanced OCR processing." 
  }, 405);
};

export const PUT = async () => {
  return createJsonResponse({ 
    success: false, 
    error: "Method Not Allowed" 
  }, 405);
};

export const DELETE = async () => {
  return createJsonResponse({ 
    success: false, 
    error: "Method Not Allowed" 
  }, 405);
};
