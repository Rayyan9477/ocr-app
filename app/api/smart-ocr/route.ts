import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path, { join } from "path";
import { multiEngineOCR } from "../../../lib/multi-engine-ocr";
import { fourEngineOCR } from "../../../lib/four-engine-ocr";
import { extractConfidenceScores, saveConfidenceData } from "../../../lib/confidence-detector";
import logger from "../../../lib/logger";
import appConfig from "../../../lib/config";
import { adaptiveModeService, OCRMode } from "../../../lib/adaptive-mode-service";
import { intelligentOrchestrator } from "../../../lib/intelligent-orchestrator";

/**
 * Enhanced OCR API endpoint with smart processing
 * Uses multiple OCR engines and preprocessing when confidence is low
 */
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '128mb',
  },
};
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
    
    // Ensure uploads directory exists
    const uploadDirExists = existsSync(uploadDir);
    if (!uploadDirExists) {
      await mkdir(uploadDir, { recursive: true });
    }
    // Write the file to uploads directory
    await writeFile(inputPath, buffer);
    logger.info(`File saved: ${inputPath}`);
    
    // Process options from form data - Enhanced with adaptive mode support
    const options = {
      language: formData.get("language")?.toString() || "eng",
      usePreprocessing: formData.get("usePreprocessing") !== "false",
      useMultiEngine: formData.get("useMultiEngine") !== "false",
      useFourEngine: formData.get("useFourEngine") !== "false",
      useAutoCustomization: formData.get("useAutoCustomization") !== "false",
      confidenceThreshold: parseFloat(formData.get("confidenceThreshold")?.toString() || "70"),
      
      // Adaptive mode options
      preferredMode: formData.get("preferredMode")?.toString(),
      documentType: formData.get("documentType")?.toString(),
      priorityLevel: formData.get("priorityLevel")?.toString() as "low" | "normal" | "high" | undefined,
      qualityRequirement: formData.get("qualityRequirement")?.toString() as "fast" | "balanced" | "accuracy" | undefined,
      enableAdaptive: formData.get("enableAdaptive") !== "false", // Default to true
      
      // Legacy medical options (maintained for compatibility)
      medicalOptimization: formData.get("documentType") === "medical" || formData.get("medicalOptimization") === "true",
      enhanceHandwriting: formData.get("enhanceHandwriting") !== "false",
      extractMedicalCodes: formData.get("extractMedicalCodes") === "true",
      preserveLayout: formData.get("preserveLayout") !== "false",
      extractDates: formData.get("extractDates") === "true",
      extractAddresses: formData.get("extractAddresses") === "true"
    };
    
    // Determine output directory and ensure it exists
    const processedDir = join(process.cwd(), "processed");
    const sessionDir = join(processedDir, `smart_ocr_${Date.now()}`);
    await mkdir(processedDir, { recursive: true });
    await mkdir(sessionDir, { recursive: true });
    
    logger.info(`Starting adaptive OCR process for ${fileName} with adaptive mode: ${options.enableAdaptive}`);
    
    let processingResult;
    
    if (options.enableAdaptive) {
      // Use intelligent orchestrator for adaptive processing
      const processingRequest = {
        inputPath: inputPath,
        outputDir: sessionDir,
        options: {
          language: options.language,
          urgency: (options.priorityLevel === "high" ? "high" : "medium") as "low" | "medium" | "high" | "critical",
          qualityRequirement: (options.qualityRequirement === "accuracy" ? "high" :
                            options.qualityRequirement === "fast" ? "draft" : "standard") as "draft" | "standard" | "high" | "perfect",
          documentType: options.documentType || "general",
          forceMode: options.preferredMode as OCRMode,
          disableAdaptive: false,
          enableLearning: true
        }
      };
      
      logger.info(`Using intelligent orchestrator with preferred mode: ${options.preferredMode || 'auto'}`);
      processingResult = await intelligentOrchestrator.processDocument(processingRequest);
    } else {
      // Legacy processing path
      if (options.useFourEngine) {
        const medicalOptions = {
          enhanceHandwriting: options.enhanceHandwriting,
          extractCodes: options.extractMedicalCodes,
          medicalTerminology: options.medicalOptimization,
          preserveLayout: options.preserveLayout,
          confidenceThreshold: options.confidenceThreshold,
          extractDates: options.extractDates,
          extractAddresses: options.extractAddresses
        };
        
        logger.info('Using legacy four-engine OCR system');
        const fourEngineResult = await fourEngineOCR.processWithFourEngines(
          inputPath,
          sessionDir,
          options.language,
          medicalOptions
        );
        
        // Convert to standard format
        processingResult = {
          success: fourEngineResult.hasSuccessfulResults,
          mode: "legacy-four-engine" as OCRMode,
          outputPath: fourEngineResult.bestResult.outputPath,
          engineResults: fourEngineResult.allResults,
          consensusText: fourEngineResult.consensusText,
          confidence: fourEngineResult.averageConfidence,
          processingTime: fourEngineResult.bestResult.processingTime
        };
      } else {
        logger.info('Using legacy multi-engine OCR system');
        const ensembleResult = await multiEngineOCR.processWithEnsemble(
          inputPath,
          sessionDir,
          options.language,
          options.usePreprocessing,
          options.useAutoCustomization
        );
        
        // Convert to standard format
        processingResult = {
          success: ensembleResult.hasSuccessfulResults,
          mode: "legacy-ensemble" as OCRMode,
          outputPath: ensembleResult.bestResult.outputPath,
          engineResults: ensembleResult.allResults,
          consensusText: ensembleResult.consensusText,
          confidence: ensembleResult.averageConfidence,
          processingTime: ensembleResult.bestResult.processingTime
        };
      }
    }
    
    // Check if processing was successful
    if (!processingResult.success) {
      logger.error(`OCR processing failed for ${fileName}:`, processingResult);
      
      return NextResponse.json({
        success: false,
        error: "OCR processing failed",
        details: "Processing failed",
        mode: processingResult.mode,
        engineResults: processingResult.engineResults?.map(r => ({
          engine: r.engine,
          error: r.error,
          outputExists: r.outputPath ? existsSync(r.outputPath) : false
        }))
      }, { status: 500 });
    }
    
    // Extract confidence scores if enabled
    let confidenceData = null;
    if (appConfig.confidence.enableConfidenceTracking && processingResult.outputPath) {
      try {
        confidenceData = await extractConfidenceScores(inputPath, processingResult.outputPath, true);
        if (confidenceData) {
          await saveConfidenceData(confidenceData, processingResult.outputPath);
        }
      } catch (confidenceError) {
        logger.warn("Failed to extract confidence scores:", confidenceError);
      }
    }
    
    // Move final result to standard processed directory
    const finalOutputPath = join(processedDir, `${path.basename(fileName, '.pdf')}_${Date.now()}_smart_ocr.pdf`);
    if (processingResult.outputPath && existsSync(processingResult.outputPath)) {
      await import('fs/promises').then(fs => fs.copyFile(processingResult.outputPath!, finalOutputPath));
    }
    
    // Prepare enhanced response
    const response = {
      success: true,
      inputFile: fileName,
      outputFile: path.basename(finalOutputPath),
      mode: processingResult.mode,
      processingTime: processingResult.processingTime,
      engines: {
        used: processingResult.engineResults?.map(r => r.engine) || [],
        successful: processingResult.engineResults?.filter(r => r.success).map(r => r.engine) || [],
        successCount: processingResult.engineResults?.filter(r => r.success).length || 0,
        totalCount: processingResult.engineResults?.length || 0
      },
      confidence: confidenceData ? {
        averageConfidence: confidenceData.averageConfidence,
        hasLowConfidencePages: confidenceData.hasLowConfidencePages,
        warningPages: confidenceData.warningPages,
        errorPages: confidenceData.errorPages,
        pageCount: confidenceData.pageConfidences.length
      } : {
        averageConfidence: processingResult.confidence || 0,
        hasLowConfidencePages: false,
        warningPages: 0,
        errorPages: 0,
        pageCount: 1
      },
      // Adaptive mode specific data
      ...(options.enableAdaptive && 'adaptiveDecision' in processingResult && {
        adaptiveDecision: processingResult.adaptiveDecision,
        fallbacksUsed: processingResult.fallbacksUsed,
        qualityMetrics: processingResult.qualityMetrics,
        resourceUsage: processingResult.resourceUsage,
        recommendations: processingResult.recommendations
      })
    };
    
    logger.info(`Smart OCR completed for ${fileName}: mode=${processingResult.mode}, confidence=${processingResult.confidence || 0}%`);
    
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
  const adaptiveModes = adaptiveModeService.getAvailableModes();
  
  return NextResponse.json({
    message: "Smart OCR API - Enhanced OCR with adaptive mode switching and intelligent processing",
    availableEngines,
    adaptiveModes: adaptiveModes.map((mode: { mode: string; description: string; capabilities: string[] }) => ({
      mode: mode.mode,
      description: mode.description,
      capabilities: mode.capabilities
    })),
    features: [
      "Adaptive mode switching for optimal results",
      "Intelligent processing orchestration",
      "Multi-engine OCR processing",
      "Automatic document analysis and customization", 
      "Intelligent parameter adjustment based on content type",
      "Medical document optimization",
      "Handwritten content detection",
      "Low-quality document enhancement",
      "Automatic preprocessing for poor-quality documents", 
      "Confidence-based processing decisions",
      "Ensemble voting for best results",
      "Learning-based performance optimization"
    ],
    usage: {
      endpoint: "/api/smart-ocr",
      method: "POST",
      parameters: {
        file: "PDF or image file (required)",
        language: "OCR language (default: eng)",
        enableAdaptive: "Enable adaptive mode switching (default: true)",
        preferredMode: "Preferred OCR mode (optional)",
        documentType: "Document type for optimization (optional)",
        priorityLevel: "Processing priority: low/normal/high (default: normal)",
        qualityRequirement: "Quality requirement: fast/balanced/accuracy (default: balanced)",
        usePreprocessing: "Apply image preprocessing (default: false)",
        useMultiEngine: "Use multiple OCR engines (default: false)",
        useAutoCustomization: "Enable auto-customization based on document type (default: true)",
        confidenceThreshold: "Minimum confidence threshold (default: 70)"
      }
    },
    adaptiveProcessing: {
      availableModes: adaptiveModes.map((m: { mode: string; description: string; capabilities: string[] }) => m.mode),
      intelligentSwitching: "Automatic mode selection based on document characteristics",
      fallbackStrategies: "Multi-level fallback for failed processing attempts",
      learningSystem: "Performance-based optimization and mode recommendation",
      qualityMonitoring: "Real-time quality assessment and adjustment"
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
