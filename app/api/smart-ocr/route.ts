import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { existsSync } from "fs";
import path, { join } from "path";
import { multiEngineOCR } from "../../../lib/multi-engine-ocr";
import { extractConfidenceScores, saveConfidenceData } from "../../../lib/confidence-detector";
import logger from "../../../lib/logger";
import appConfig from "../../../lib/config";

/**
 * Enhanced OCR API endpoint with smart processing
 * Uses multiple OCR engines and preprocessing when confidence is low
 */
export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: "No file provided"
      }, { status: 400 });
    }
    
    // Get file data
    const fileName = file.name;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Determine upload path
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, fileName);
    
    // Write the file to uploads directory
    await writeFile(inputPath, buffer);
    logger.info(`File saved: ${inputPath}`);
    
    // Process options from form data
    const options = {
      language: formData.get("language")?.toString() || "eng",
      usePreprocessing: formData.get("usePreprocessing") === "true",
      useMultiEngine: formData.get("useMultiEngine") === "true",
      useAutoCustomization: formData.get("useAutoCustomization") !== "false", // Default to true
      confidenceThreshold: parseFloat(formData.get("confidenceThreshold")?.toString() || "70")
    };
    
    // Determine output directory
    const processedDir = join(process.cwd(), "processed");
    const sessionDir = join(processedDir, `smart_ocr_${Date.now()}`);
    
    logger.info(`Starting smart OCR process for ${fileName}`);
    
    // First attempt with multi-engine OCR and auto-customization
    const ensembleResult = await multiEngineOCR.processWithEnsemble(
      inputPath,
      sessionDir,
      options.language,
      options.usePreprocessing,
      options.useAutoCustomization
    );
    
    // Improved success detection - check if ANY engine succeeded OR if valid files exist
    const hasValidResults = ensembleResult.hasSuccessfulResults || 
      ensembleResult.allResults.some(r => r.outputPath && existsSync(r.outputPath));
    
    if (!hasValidResults) {
      logger.error(`All OCR engines failed for ${fileName}:`, ensembleResult.allResults.map(r => ({
        engine: r.engine,
        error: r.error,
        outputExists: r.outputPath ? existsSync(r.outputPath) : false
      })));
      
      return NextResponse.json({
        success: false,
        error: "All OCR engines failed",
        details: ensembleResult.allResults.map(r => ({
          engine: r.engine,
          error: r.error,
          outputExists: r.outputPath ? existsSync(r.outputPath) : false
        })),
        engineCount: ensembleResult.allResults.length,
        successCount: ensembleResult.successCount
      }, { status: 500 });
    }

    // Find the best available result (prioritize successful ones, but accept any with valid output)
    let bestResult = ensembleResult.bestResult;
    if (!bestResult.success || !bestResult.outputPath || !existsSync(bestResult.outputPath!)) {
      const validResult = ensembleResult.allResults.find(r => 
        r.outputPath && existsSync(r.outputPath)
      );
      
      if (validResult) {
        bestResult = validResult;
        // Mark it as successful since we have a valid output file
        bestResult.success = true;
        if (!bestResult.error) {
          bestResult.error = undefined;
        }
        logger.info(`Using valid result from ${bestResult.engine} despite validation issues`);
      }
    }

    // At this point, we have at least one valid result
    const outputPath = bestResult.outputPath!;
    logger.info(`OCR processing completed for ${fileName}: using ${bestResult.engine} engine, ${ensembleResult.successCount}/${ensembleResult.allResults.length} engines reported success`);
    
    // Validate the best result output file exists
    if (!outputPath || !existsSync(outputPath)) {
      logger.error(`Best result output file missing: ${outputPath}`);
      
      // Try to find any result with valid output (including ones marked as failed)
      const validResult = ensembleResult.allResults.find(r => 
        r.outputPath && existsSync(r.outputPath)
      );
      
      if (!validResult) {
        return NextResponse.json({
          success: false,
          error: "No valid output files generated despite processing completion",
          details: "OCR engines completed but output files are missing or invalid",
          engineResults: ensembleResult.allResults.map(r => ({
            engine: r.engine,
            success: r.success,
            outputPath: r.outputPath,
            outputExists: r.outputPath ? existsSync(r.outputPath) : false,
            error: r.error
          }))
        }, { status: 500 });
      }
      
      // Use the valid result instead and update ensemble
      ensembleResult.bestResult = validResult;
      validResult.success = true; // Mark as successful since we have valid output
      logger.info(`Using valid output from ${validResult.engine} engine despite validation issues`);
    }
    
    // Extract confidence scores if enabled
    let confidenceData = null;
    if (appConfig.confidence.enableConfidenceTracking) {
      try {
        confidenceData = await extractConfidenceScores(inputPath, outputPath, true);
        if (confidenceData) {
          await saveConfidenceData(confidenceData, outputPath);
        }
      } catch (confidenceError) {
        logger.warn("Failed to extract confidence scores:", confidenceError);
      }
    }
    
    // Determine if we need to retry with more aggressive processing
    const avgConfidence = confidenceData?.averageConfidence || ensembleResult.averageConfidence || 0;
    let finalResult = ensembleResult.bestResult;
    let processingNotes: string[] = [];
    
    if (avgConfidence < options.confidenceThreshold && options.useMultiEngine) {
      logger.info(`Low confidence detected (${avgConfidence}%), attempting aggressive processing`);
      
      try {
        // Retry with aggressive preprocessing (auto-customization handles this better now)
        const aggressiveResult = await multiEngineOCR.processWithEnsemble(
          inputPath,
          sessionDir,
          options.language,
          true, // Force preprocessing
          true  // Keep auto-customization
        );
        
        if (aggressiveResult.hasSuccessfulResults && aggressiveResult.bestResult.outputPath) {
          const aggressiveConfidence = await extractConfidenceScores(
            inputPath, 
            aggressiveResult.bestResult.outputPath!, 
            true
          );
          
          // Use aggressive result if confidence improved
          if (aggressiveConfidence && aggressiveConfidence.averageConfidence > avgConfidence) {
            finalResult = aggressiveResult.bestResult;
            confidenceData = aggressiveConfidence;
            await saveConfidenceData(aggressiveConfidence, aggressiveResult.bestResult.outputPath!);
            processingNotes.push("Applied aggressive preprocessing due to low initial confidence");
          }
        }
      } catch (aggressiveError) {
        logger.warn("Aggressive processing failed:", aggressiveError);
        processingNotes.push("Attempted aggressive processing but it failed");
      }
    }
    
    // Move final result to standard processed directory
    const finalOutputPath = join(processedDir, `${path.basename(fileName, '.pdf')}_${Date.now()}_smart_ocr.pdf`);
    if (finalResult.outputPath && existsSync(finalResult.outputPath)) {
      await import('fs/promises').then(fs => fs.copyFile(finalResult.outputPath!, finalOutputPath));
    }
    
    // Prepare response
    const response = {
      success: true,
      inputFile: fileName,
      outputFile: path.basename(finalOutputPath),
      engine: finalResult.engine,
      processingTime: finalResult.processingTime,
      details: processingNotes.length > 0 ? processingNotes.join("; ") : undefined,
      engines: {
        used: ensembleResult.allResults.map(r => r.engine),
        successful: ensembleResult.allResults.filter(r => r.success).map(r => r.engine),
        best: finalResult.engine,
        successCount: ensembleResult.successCount,
        totalCount: ensembleResult.allResults.length
      },
      customization: {
        applied: ensembleResult.customizationApplied,
        autoSettingsUsed: options.useAutoCustomization
      },
      confidence: confidenceData ? {
        averageConfidence: confidenceData.averageConfidence,
        hasLowConfidencePages: confidenceData.hasLowConfidencePages,
        warningPages: confidenceData.warningPages,
        errorPages: confidenceData.errorPages,
        pageCount: confidenceData.pageConfidences.length
      } : undefined,
      consensus: {
        textLength: ensembleResult.consensusText?.length || 0,
        averageConfidence: ensembleResult.averageConfidence
      }
    };
    
    logger.info(`Smart OCR completed for ${fileName}: ${finalResult.engine} engine, ${ensembleResult.successCount}/${ensembleResult.allResults.length} engines successful, ${confidenceData?.averageConfidence || 0}% confidence, customization: ${ensembleResult.customizationApplied}`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Smart OCR API error: ${errorMessage}`);
    
    return NextResponse.json({
      success: false,
      error: "Internal server error during smart OCR processing",
      details: errorMessage
    }, { status: 500 });
  } finally {
    // Cleanup uploaded file
    if (inputPath && existsSync(inputPath)) {
      try {
        await import('fs/promises').then(fs => fs.unlink(inputPath));
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup uploaded file: ${cleanupError}`);
      }
    }
  }
}

export async function GET() {
  const availableEngines = multiEngineOCR.getAvailableEngines();
  
  return NextResponse.json({
    message: "Smart OCR API - Enhanced OCR with multiple engines, auto-customization and preprocessing",
    availableEngines,
    features: [
      "Multi-engine OCR processing",
      "Automatic document analysis and customization", 
      "Intelligent parameter adjustment based on content type",
      "Medical document optimization",
      "Handwritten content detection",
      "Low-quality document enhancement",
      "Automatic preprocessing for poor-quality documents", 
      "Confidence-based processing decisions",
      "Ensemble voting for best results"
    ],
    usage: {
      endpoint: "/api/smart-ocr",
      method: "POST",
      parameters: {
        file: "PDF or image file (required)",
        language: "OCR language (default: eng)",
        usePreprocessing: "Apply image preprocessing (default: false)",
        useMultiEngine: "Use multiple OCR engines (default: false)",
        useAutoCustomization: "Enable auto-customization based on document type (default: true)",
        confidenceThreshold: "Minimum confidence threshold (default: 70)"
      }
    },
    autoCustomization: {
      supportedDocumentTypes: [
        "Medical documents and bills",
        "Handwritten content",
        "Low-quality scans",
        "Multi-column layouts",
        "Structured data forms",
        "Image-heavy documents"
      ],
      optimizations: [
        "Automatic OCR engine selection",
        "Dynamic parameter tuning",
        "Content-aware preprocessing",
        "Confidence threshold adjustment",
        "Language-specific enhancements"
      ]
    }
  });
}
