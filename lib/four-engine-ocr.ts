import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import logger from './logger';
import { preprocessingService } from './preprocessing-service';

const execAsync = promisify(exec);

export interface FourEngineOCREngine {
  name: string;
  command: (inputPath: string, outputPath: string, language: string, options?: MedicalOCROptions) => string;
  confidence?: boolean;
  available?: boolean;
  medicalOptimized?: boolean;
  handwritingSupport?: boolean;
  specialization?: string[];
}

export interface MedicalOCROptions {
  focusAreas?: string[];
  enhanceHandwriting?: boolean;
  extractCodes?: boolean;
  preserveLayout?: boolean;
  confidenceThreshold?: number;
  medicalTerminology?: boolean;
}

export interface MedicalFieldExtraction {
  patientName?: string;
  dates?: string[];
  addresses?: string[];
  cptCodes?: string[];
  dxCodes?: string[];
  locationAddress?: string;
  procedures?: string[];
  insuranceProvider?: string;
  confidence?: number;
  source?: string;
}

export interface FourEngineOCRResult {
  engine: string;
  success: boolean;
  outputPath?: string;
  confidence?: number;
  text?: string;
  error?: string;
  processingTime?: number;
  medicalFields?: MedicalFieldExtraction;
  specialFeatures?: string[];
}

export interface FourEngineEnsembleResult {
  bestResult: FourEngineOCRResult;
  allResults: FourEngineOCRResult[];
  consensusText?: string;
  averageConfidence?: number;
  hasSuccessfulResults: boolean;
  successCount: number;
  medicalDataExtracted?: MedicalFieldExtraction;
  enginePerformance?: Map<string, number>;
  recommendedEngine?: string;
}

/**
 * Four-Engine OCR Service optimized for medical documents
 * Integrates OCRmyPDF, Tesseract, and EnhancedTesseract for optimal results
 */
export class FourEngineOCRService {
  private engines: FourEngineOCREngine[] = [
    {
      name: 'ocrmypdf',
      command: (input, output, lang, options) => {
        let cmd = `ocrmypdf --language ${lang} --deskew --rotate-pages --force-ocr`;
        if (options?.preserveLayout) cmd += ' --pdf-renderer hocr';
        if (options?.medicalTerminology) cmd += ' --tesseract-config medical_config.cfg';
        cmd += ` "${input}" "${output}"`;
        return cmd;
      },
      confidence: false,
      available: true,
      medicalOptimized: true,
      specialization: ['structured_documents', 'medical_bills', 'insurance_forms']
    },
    {
      name: 'tesseract',
      command: (input, output, lang, options) => {
        let cmd = `tesseract "${input}" "${output.replace('.pdf', '')}" -l ${lang}`;
        if (options?.medicalTerminology) {
          cmd += ' --psm 6 --oem 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-/$()';
        } else {
          cmd += ' --psm 1 --oem 3';
        }
        cmd += ' pdf';
        return cmd;
      },
      confidence: true,
      available: true,
      medicalOptimized: true,
      specialization: ['general_text', 'medical_codes', 'structured_data']
    },
    {
      name: 'enhanced-tesseract',
      command: (input, output, lang, options) => {
        let enhancement = 'medical_bills'; // Default to medical bills processing
        if (options?.enhanceHandwriting) enhancement = 'medical_handwritten';
        if (options?.medicalTerminology) enhancement = 'medical_structured';
        if (options?.preserveLayout) enhancement = 'medical_layout';
        return `node ./lib/cli/enhanced-tesseract-cli.js --input "${input}" --output "${output}" --mode ${enhancement} --language ${lang} --extract-fields`;
      },
      confidence: true,
      available: true, // Enhanced Tesseract is bundled with the app
      medicalOptimized: true,
      handwritingSupport: true,
      specialization: ['medical_bills', 'insurance_forms', 'handwriting', 'historical_documents', 'degraded_text', 'dates', 'addresses', 'medical_notes']
    }
  ];

  constructor() {
    this.checkEngineAvailability();
  }

  /**
   * Check which OCR engines are available on the system
   */
  private async checkEngineAvailability(): Promise<void> {
    for (const engine of this.engines) {
      try {
        if (engine.name === 'ocrmypdf') {
          await execAsync('ocrmypdf --version');
        } else if (engine.name === 'tesseract') {
          await execAsync('tesseract --version');
        } else if (engine.name === 'enhanced-tesseract') {
          // EnhancedTesseract is built-in, so it's always available
          engine.available = true;
        }
        
        // All engines are now built-in, so they're always available
        engine.available = true;
        
        logger.info(`OCR engine ${engine.name} is available`);
      } catch (error) {
        engine.available = false;
        logger.warn(`OCR engine ${engine.name} is not available: ${error}`);
      }
    }
  }

  /**
   * Process document with all four OCR engines optimized for medical documents
   */
  async processWithFourEngines(
    inputPath: string,
    outputDir: string,
    language: string = 'eng',
    medicalOptions: MedicalOCROptions = {}
  ): Promise<FourEngineEnsembleResult> {
    const results: FourEngineOCRResult[] = [];
    let processedInputPath = inputPath;

    try {
      // Apply medical-optimized preprocessing
      if (medicalOptions.enhanceHandwriting) {
        logger.info('Applying medical document preprocessing');
        processedInputPath = await preprocessingService.medicalOptimize(inputPath);
      }

      // Run each available engine in parallel for efficiency
      const availableEngines = this.engines.filter(e => e.available);
      const enginePromises = availableEngines.map(engine => 
        this.processWithSingleEngine(engine, processedInputPath, outputDir, language, medicalOptions)
      );

      const engineResults = await Promise.allSettled(enginePromises);
      
      // Process results and handle any rejections
      engineResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            engine: availableEngines[index].name,
            success: false,
            error: result.reason?.message || 'Engine processing failed',
            processingTime: 0
          });
        }
      });

      // Analyze results and extract medical information
      const successfulResults = results.filter(r => r.success);
      const hasSuccessfulResults = successfulResults.length > 0;
      const successCount = successfulResults.length;

      // Determine best result with medical optimization
      const bestResult = this.selectBestMedicalResult(results, medicalOptions);
      
      // Extract consolidated medical data
      const medicalDataExtracted = this.extractConsolidatedMedicalData(results);
      
      // Generate consensus text
      const consensusText = this.generateMedicalConsensusText(results);
      
      // Calculate performance metrics
      const enginePerformance = this.calculateEnginePerformance(results);
      const recommendedEngine = this.recommendEngineForDocument(results, medicalOptions);
      
      // Calculate average confidence
      const confidenceResults = results.filter(r => r.success && r.confidence !== undefined);
      const averageConfidence = confidenceResults.length > 0 
        ? confidenceResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / confidenceResults.length
        : undefined;

      const ensembleResult: FourEngineEnsembleResult = {
        bestResult,
        allResults: results,
        consensusText,
        averageConfidence,
        hasSuccessfulResults,
        successCount,
        medicalDataExtracted,
        enginePerformance,
        recommendedEngine
      };

      logger.info(`Four-engine OCR completed: ${successCount}/${results.length} engines successful`);
      return ensembleResult;

    } catch (error) {
      logger.error(`Four-engine OCR failed: ${error}`);
      
      return {
        bestResult: {
          engine: 'unknown',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        allResults: [],
        hasSuccessfulResults: false,
        successCount: 0
      };
    } finally {
      // Cleanup preprocessing files if used
      if (processedInputPath !== inputPath) {
        try {
          await preprocessingService.cleanup();
        } catch (cleanupError) {
          logger.warn(`Cleanup failed: ${cleanupError}`);
        }
      }
    }
  }

  /**
   * Process document with a single engine
   */
  private async processWithSingleEngine(
    engine: FourEngineOCREngine,
    inputPath: string,
    outputDir: string,
    language: string,
    options: MedicalOCROptions
  ): Promise<FourEngineOCRResult> {
    const startTime = Date.now();
    const outputPath = join(outputDir, `${engine.name}_medical_output.pdf`);
    
    try {
      logger.info(`Running medical OCR with ${engine.name}`);
      
      if (engine.name === 'enhanced-tesseract') {
        // Handle enhanced-tesseract engine
        await this.processWithEnhancedTesseract(engine, inputPath, outputPath, language, options);
      } else {
        // Handle command-line engines (Tesseract, OCRmyPDF)
        const command = engine.command(inputPath, outputPath, language, options);
        await execAsync(command);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Validate output
      if (!this.validateOCROutput(outputPath)) {
        throw new Error('Output validation failed');
      }

      // Extract text and medical fields
      const { extractedText, confidence } = await this.extractTextAndConfidence(engine, outputPath, inputPath);
      const medicalFields = await this.extractMedicalFields(extractedText, engine.name);
      
      // Determine special features this engine provided
      const specialFeatures = this.determineSpecialFeatures(engine, medicalFields, confidence);

      return {
        engine: engine.name,
        success: true,
        outputPath,
        confidence,
        text: extractedText,
        processingTime,
        medicalFields,
        specialFeatures
      };

    } catch (error) {
      return {
        engine: engine.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process document with service-based engines (Enhanced Tesseract)
   */
  private async processWithService(
    engine: FourEngineOCREngine,
    inputPath: string,
    outputPath: string,
    language: string,
    options: MedicalOCROptions
  ): Promise<void> {
    const { readFile: readFileAsync, writeFile: writeFileAsync } = await import('fs/promises');
    
    // Service-based processing has been replaced with Enhanced Tesseract
    // Legacy code was removed during Python dependency cleanup
    throw new Error('This method is deprecated. Use processWithEnhancedTesseract instead.');
  }
  
  /**
   * Process document with Enhanced Tesseract
   */
  private async processWithEnhancedTesseract(
    engine: FourEngineOCREngine,
    inputPath: string,
    outputPath: string,
    language: string,
    options: MedicalOCROptions
  ): Promise<void> {
    const { readFile: readFileAsync, writeFile: writeFileAsync } = await import('fs/promises');
    
    // Enhanced Tesseract processing using internal module
    let enhancement = 'medical_bills'; // Default to medical bills
    if (options.enhanceHandwriting) enhancement = 'medical_handwritten';
    if (options.medicalTerminology) enhancement = 'medical_structured';
    if (options.preserveLayout) enhancement = 'medical_layout';
    
    // Import the EnhancedTesseractEngine directly
    const { EnhancedTesseractEngine } = require('../lib/enhanced-tesseract-engine');
    const enhancedEngine = new EnhancedTesseractEngine({
      enableHandwritingOptimization: options.enhanceHandwriting,
      enhancementMode: enhancement,
      preserveLayout: options.preserveLayout,
      extractMedicalFields: true,
      language
    });
    
    // Process the document
    const result = await enhancedEngine.processDocument(inputPath, {
      outputPath,
      extractDates: true,
      extractAddresses: true,
      extractCodes: true,
      medicalContext: true
    });
    
    if (!result || !result.text) {
      throw new Error('Enhanced Tesseract processing failed');
    }
    
    // Extract medical data from the result
    const enhancedResult = {
      ...result,
      medical_optimization: true,
      extraction_targets: ['dates', 'addresses', 'codes', 'patient_info'],
      processing_mode: enhancement,
      handwriting_support: engine.handwritingSupport
    };
    await writeFileAsync(outputPath, JSON.stringify(enhancedResult, null, 2));
  }

  /**
   * Extract text and confidence from engine output
   */
  private async extractTextAndConfidence(
    engine: FourEngineOCREngine,
    outputPath: string,
    inputPath: string
  ): Promise<{ extractedText: string; confidence: number }> {
    let extractedText = '';
    let confidence = 0;

    try {
      if (engine.name === 'enhanced-tesseract') {
        try {
          // Enhanced Tesseract returns a more structured output
          const jsonContent = await readFile(outputPath, 'utf-8');
          const enhancedResult = JSON.parse(jsonContent);
          extractedText = enhancedResult.text || '';
          confidence = enhancedResult.confidence || 0;
          
          // Extract additional metadata if available
          if (enhancedResult.metadata) {
            this.lastProcessedResult.metadata = {
              ...this.lastProcessedResult.metadata,
              ...enhancedResult.metadata
            };
          }
        } catch (jsonError) {
          logger.warn(`Failed to parse enhanced-tesseract JSON output: ${jsonError}`);
          // Fallback to reading file directly
          const fileContent = await readFile(outputPath, 'utf-8');
          extractedText = fileContent.slice(0, 5000); // Limit size
          confidence = 70; // Default confidence when parsing fails
        }
      } else {
        // OCRmyPDF and Tesseract - extract from PDF
        try {
          const { stdout } = await execAsync(`pdftotext "${outputPath}" -`);
          // Clean up and sanitize text
          extractedText = stdout
            .trim()
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/\\(?![\"\\\/bfnrt])/g, '\\\\'); // Escape backslashes
          
          if (engine.confidence && engine.name === 'tesseract') {
            confidence = await this.extractTesseractConfidence(inputPath);
          } else {
            confidence = 90; // Default for OCRmyPDF
          }
        } catch (pdfError) {
          logger.warn(`Failed to extract text from PDF: ${pdfError}`);
          extractedText = '[PDF text extraction failed]';
          confidence = 50; // Lower confidence when extraction fails
        }
      }
    } catch (textError) {
      logger.warn(`Failed to extract text from ${engine.name} output: ${textError}`);
      extractedText = '[Text extraction failed]';
      confidence = 50; // Lower confidence when extraction fails
    }

    // Ensure text is safe for JSON serialization
    extractedText = this.sanitizeTextForJson(extractedText);
    
    return { extractedText, confidence };
  }
  
  /**
   * Sanitize text to ensure it can be safely included in JSON responses
   */
  private sanitizeTextForJson(text: string): string {
    if (!text) return '';
    
    return text
      // Remove control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      // Replace any sequence of whitespace with a single space
      .replace(/\s+/g, ' ')
      // Properly escape special characters for JSON
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // Limit size
      .slice(0, 5000);
  }

  /**
   * Extract medical fields from OCR text - Enhanced for comprehensive medical data extraction
   */
  private async extractMedicalFields(text: string, engineName: string): Promise<MedicalFieldExtraction> {
    const medicalFields: MedicalFieldExtraction = {
      source: engineName
    };

    try {
      // Enhanced patient name extraction with more patterns
      const namePatterns = [
        /patient\s*name[:\s]*([A-Za-z\s,.']+)/i,
        /name[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
        /(?:mr|mrs|ms|dr|patient)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        /([A-Z][a-z]+,\s*[A-Z][a-z]+)/g, // Last, First format
        /member[:\s]*([A-Za-z\s,.']+)/i
      ];
      
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[1].trim().length > 3) {
          medicalFields.patientName = match[1].trim().replace(/[,.]$/, '');
          break;
        }
      }

      // Enhanced date extraction with comprehensive medical bill date formats
      const datePatterns = [
        // Standard date formats
        /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
        /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
        // Month name formats
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}\b/gi,
        /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b/gi,
        // Medical bill specific date contexts
        /(?:date(?:\s+of)?(?:\s+service)?|visit|service|dos|treatment|appointment|admission|discharge)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:from|to|between)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:statement|bill|invoice)\s+date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        // Insurance claim dates
        /(?:claim|received|processed|paid)[:\s+date]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        // Date ranges common in medical bills
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        // Birth date patterns
        /(?:birth|dob|date\s+of\s+birth)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi
      ];
      
      medicalFields.dates = [];
      for (const pattern of datePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Extract just the date part if it's a labeled match
            const dateMatch = match.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/);
            if (dateMatch) {
              medicalFields.dates!.push(dateMatch[0]);
            } else {
              medicalFields.dates!.push(match);
            }
          });
        }
      }
      medicalFields.dates = [...new Set(medicalFields.dates)]; // Remove duplicates

      // Enhanced CPT code extraction
      const cptPatterns = [
        /\b(?:CPT|cpt)[:\s#]*(\d{5})\b/gi,
        /\b(\d{5})\s*(?:cpt|procedure code)/gi,
        /(?:procedure|service)[:\s]*(\d{5})/gi,
        /\b9\d{4}\b/g, // CPT codes starting with 9
        /\b[0-9]{5}\b/g // Any 5-digit code (filter later)
      ];
      
      medicalFields.cptCodes = [];
      for (const pattern of cptPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const code = match.match(/\d{5}/);
            if (code && parseInt(code[0]) >= 10000) { // Valid CPT range
              medicalFields.cptCodes!.push(code[0]);
            }
          });
        }
      }
      medicalFields.cptCodes = [...new Set(medicalFields.cptCodes)];

      // Enhanced DX/ICD code extraction
      const dxPatterns = [
        /\b(?:DX|dx|ICD|icd)[:\s#]*([A-Z]\d{2}(?:\.\d{1,2})?)\b/gi,
        /\b([A-Z]\d{2}\.\d{1,2})\b/g,
        /(?:diagnosis|condition)[:\s]*([A-Z]\d{2}(?:\.\d{1,2})?)/gi,
        /\b[A-Z]\d{2,3}(?:\.\d{1,3})?\b/g // ICD-10 format
      ];
      
      medicalFields.dxCodes = [];
      for (const pattern of dxPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const cleanCode = match.replace(/^(?:DX|dx|ICD|icd)[:\s#]*/, '').trim();
            if (/^[A-Z]\d{2}/.test(cleanCode)) {
              medicalFields.dxCodes!.push(cleanCode);
            }
          });
        }
      }
      medicalFields.dxCodes = [...new Set(medicalFields.dxCodes)];

      // Enhanced address extraction for medical facilities and patient addresses
      const addressPatterns = [
        // Standard street addresses with state and ZIP
        /\d+\s+[A-Za-z0-9\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court|Pkwy|Parkway|Pl|Place)[.,\s]*[A-Za-z\s]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi,
        // Medical facility specific patterns
        /(?:facility|provider|clinic|hospital|medical\s+center)\s+(?:address|location)[:\s]*(\d+[^,\n]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive)[^,\n]*)/gi,
        /(?:billing|mailing|service)\s+address[:\s]*(\d+[^,\n]+)/gi,
        // Suite/Unit patterns common in medical offices
        /\d+\s+[A-Za-z0-9\s]+(?:Suite|Ste|Unit|Apt|Floor|Fl|Building|Bldg)[^,\n]*,?\s*[A-Za-z\s]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi,
        // PO Box patterns
        /(?:PO|P\.O\.)\s*Box\s+\d+[^,\n]*,?\s*[A-Za-z\s]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi,
        // City, State ZIP patterns
        /[A-Za-z\s]{3,},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/g,
        // Patient address contexts
        /(?:patient|member|insured)\s+address[:\s]*(\d+[^,\n]+)/gi,
        // Address labels in medical forms
        /(?:home|residence|primary)\s+address[:\s]*(\d+[^,\n]+)/gi,
        // Multi-line address patterns
        /\d+\s+[A-Za-z0-9\s#-]+\n[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/gi
      ];
      
      medicalFields.addresses = [];
      for (const pattern of addressPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(addr => {
            let cleanAddr = addr.replace(/^(?:facility|provider|clinic|hospital|medical\s+center|billing|mailing|service|patient|member|insured|home|residence|primary)\s+(?:address|location)[:\s]*/i, '').trim();
            // Clean up any leading labels
            cleanAddr = cleanAddr.replace(/^(?:address|location)[:\s]*/i, '').trim();
            // Ensure minimum length for valid address
            if (cleanAddr.length > 10 && /\d/.test(cleanAddr)) {
              medicalFields.addresses!.push(cleanAddr);
            }
          });
        }
      }
      medicalFields.addresses = [...new Set(medicalFields.addresses)];
      if (medicalFields.addresses.length > 0) {
        medicalFields.locationAddress = medicalFields.addresses[0]; // First address as primary location
      }

      // Enhanced procedure extraction
      const procedurePatterns = [
        /(?:procedure|treatment|surgery|service)[:\s]*([A-Za-z\s,.-]+)/gi,
        /\b(?:MRI|CT|X-ray|ultrasound|endoscopy|biopsy|surgery|consultation|exam|evaluation|therapy|injection|removal)\b/gi,
        /(?:performed|rendered)[:\s]*([A-Za-z\s,.-]+)/gi,
        /\b(?:vaccination|immunization|screening|diagnostic|therapeutic)\b[^.\n]*/gi
      ];
      
      medicalFields.procedures = [];
      for (const pattern of procedurePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          medicalFields.procedures!.push(...matches.map(proc => proc.replace(/^(?:procedure|treatment|surgery|service|performed|rendered)[:\s]*/i, '').trim()));
        }
      }
      medicalFields.procedures = [...new Set(medicalFields.procedures)];

      // Enhanced insurance provider extraction
      const insurancePatterns = [
        /(?:insurance|carrier|payer)[:\s]*([A-Za-z\s&]+)/i,
        /\b(?:Aetna|Blue Cross|Blue Shield|Cigna|Humana|United|UnitedHealth|Medicare|Medicaid|Kaiser|Anthem|Molina|WellCare|Centene)\b[^.\n]*/gi,
        /(?:primary|secondary)\s+insurance[:\s]*([A-Za-z\s&]+)/gi,
        /member\s+id[:\s]*[\w-]+.*?([A-Za-z\s&]+(?:insurance|health|care))/gi
      ];
      
      for (const pattern of insurancePatterns) {
        const match = text.match(pattern);
        if (match) {
          const provider = match[0].replace(/^(?:insurance|carrier|payer|primary|secondary)[:\s]*/i, '').trim();
          if (provider.length > 3) {
            medicalFields.insuranceProvider = provider;
            break;
          }
        }
      }

      // Calculate enhanced confidence based on fields found and quality indicators
      const fieldsFound = Object.values(medicalFields).filter(v => 
        v && (Array.isArray(v) ? v.length > 0 : v.length > 0)
      ).length;
      
      let baseConfidence = fieldsFound * 12; // Base scoring
      
      // Bonus for specific high-value fields
      if (medicalFields.cptCodes && medicalFields.cptCodes.length > 0) baseConfidence += 20;
      if (medicalFields.dxCodes && medicalFields.dxCodes.length > 0) baseConfidence += 15;
      if (medicalFields.patientName) baseConfidence += 10;
      if (medicalFields.insuranceProvider) baseConfidence += 10;
      
      // Penalty for common OCR errors in medical text
      const errorIndicators = ['|', '~', '@#', '$$', '??'];
      const errorCount = errorIndicators.reduce((count, indicator) => count + (text.includes(indicator) ? 1 : 0), 0);
      baseConfidence -= errorCount * 5;
      
      medicalFields.confidence = Math.min(95, Math.max(0, baseConfidence));

    } catch (error) {
      logger.warn(`Enhanced medical field extraction failed for ${engineName}: ${error}`);
      medicalFields.confidence = 0;
    }

    return medicalFields;
  }

  /**
   * Select best result optimized for medical documents
   */
  private selectBestMedicalResult(results: FourEngineOCRResult[], options: MedicalOCROptions): FourEngineOCRResult {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return results[0]; // Return first result even if failed
    }

    if (successfulResults.length === 1) {
      return successfulResults[0];
    }

    // Score results based on medical criteria
    const scoredResults = successfulResults.map(result => {
      let score = 0;
      
      // Confidence score
      if (result.confidence !== undefined) {
        score += result.confidence * 0.3;
      }
      
      // Medical fields extracted
      if (result.medicalFields) {
        const fieldsCount = Object.values(result.medicalFields).filter(v => 
          v && (Array.isArray(v) ? v.length > 0 : true)
        ).length;
        score += fieldsCount * 10;
      }
      
      // Engine specialization bonus
      const engine = this.engines.find(e => e.name === result.engine);
      if (engine?.medicalOptimized) score += 15;
      if (engine?.handwritingSupport && options.enhanceHandwriting) score += 10;
      
      // Text length (more comprehensive extraction)
      if (result.text) {
        score += Math.min(result.text.length / 100, 20);
      }
      
      // Processing time penalty (faster is better for user experience)
      if (result.processingTime) {
        score += Math.max(0, 30 - (result.processingTime / 1000));
      }

      return { result, score };
    });

    // Return the highest scoring result
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults[0].result;
  }

  /**
   * Extract consolidated medical data from all engines
   */
  private extractConsolidatedMedicalData(results: FourEngineOCRResult[]): MedicalFieldExtraction {
    const consolidated: MedicalFieldExtraction = {
      dates: [],
      addresses: [],
      cptCodes: [],
      dxCodes: [],
      procedures: [],
      confidence: 0,
      source: 'consolidated'
    };

    const successful = results.filter(r => r.success && r.medicalFields);
    if (successful.length === 0) return consolidated;

    // Consolidate all unique values
    const allFields = successful.map(r => r.medicalFields!);
    
    // Patient name (use highest confidence)
    const namesWithConfidence = allFields
      .filter(f => f.patientName)
      .map(f => ({ name: f.patientName!, confidence: f.confidence || 0 }))
      .sort((a, b) => b.confidence - a.confidence);
    if (namesWithConfidence.length > 0) {
      consolidated.patientName = namesWithConfidence[0].name;
    }

    // Consolidate arrays (unique values)
    consolidated.dates = [...new Set(allFields.flatMap(f => f.dates || []))];
    consolidated.addresses = [...new Set(allFields.flatMap(f => f.addresses || []))];
    consolidated.cptCodes = [...new Set(allFields.flatMap(f => f.cptCodes || []))];
    consolidated.dxCodes = [...new Set(allFields.flatMap(f => f.dxCodes || []))];
    consolidated.procedures = [...new Set(allFields.flatMap(f => f.procedures || []))];

    // Location address (most common or first found)
    const locations = allFields.filter(f => f.locationAddress).map(f => f.locationAddress!);
    if (locations.length > 0) {
      consolidated.locationAddress = locations[0];
    }

    // Insurance provider (most confident)
    const insurers = allFields
      .filter(f => f.insuranceProvider)
      .map(f => ({ provider: f.insuranceProvider!, confidence: f.confidence || 0 }))
      .sort((a, b) => b.confidence - a.confidence);
    if (insurers.length > 0) {
      consolidated.insuranceProvider = insurers[0].provider;
    }

    // Calculate overall confidence
    const avgConfidence = allFields.reduce((sum, f) => sum + (f.confidence || 0), 0) / allFields.length;
    consolidated.confidence = Math.round(avgConfidence);

    return consolidated;
  }

  /**
   * Generate consensus text optimized for medical content
   */
  private generateMedicalConsensusText(results: FourEngineOCRResult[]): string | undefined {
    const textResults = results.filter(r => r.success && r.text && r.text.length > 0);
    
    if (textResults.length === 0) return undefined;
    if (textResults.length === 1) return textResults[0].text;

    // For medical documents, prioritize:
    // 1. Most medical fields extracted
    // 2. Highest confidence
    // 3. Longest text (more complete)
    
    const rankedResults = textResults.sort((a, b) => {
      const aFields = Object.keys(a.medicalFields || {}).length;
      const bFields = Object.keys(b.medicalFields || {}).length;
      
      if (aFields !== bFields) return bFields - aFields;
      
      const aConf = a.confidence || 0;
      const bConf = b.confidence || 0;
      
      if (Math.abs(aConf - bConf) > 10) return bConf - aConf;
      
      return (b.text?.length || 0) - (a.text?.length || 0);
    });

    return rankedResults[0].text;
  }

  /**
   * Calculate engine performance metrics
   */
  private calculateEnginePerformance(results: FourEngineOCRResult[]): Map<string, number> {
    const performance = new Map<string, number>();
    
    results.forEach(result => {
      let score = 0;
      
      if (result.success) {
        score += 40; // Base success bonus
        
        if (result.confidence) score += result.confidence * 0.3;
        if (result.medicalFields) {
          const fieldsCount = Object.keys(result.medicalFields).length;
          score += fieldsCount * 5;
        }
        
        // Processing speed bonus
        if (result.processingTime && result.processingTime < 30000) {
          score += 20;
        }
      }
      
      performance.set(result.engine, Math.round(score));
    });
    
    return performance;
  }

  /**
   * Recommend best engine for this document type
   */
  private recommendEngineForDocument(results: FourEngineOCRResult[], options: MedicalOCROptions): string {
    const performance = this.calculateEnginePerformance(results);
    
    // Special considerations for medical documents
    if (options.enhanceHandwriting) {
      const handwritingEngines = ['enhanced-tesseract'];
      for (const engine of handwritingEngines) {
        const score = performance.get(engine);
        if (score && score > 60) return engine;
      }
    }
    
    if (options.extractCodes) {
      const structuredEngines = ['tesseract', 'ocrmypdf'];
      for (const engine of structuredEngines) {
        const score = performance.get(engine);
        if (score && score > 70) return engine;
      }
    }
    
    // Return highest performing engine
    let bestEngine = 'ocrmypdf';
    let bestScore = 0;
    
    performance.forEach((score, engine) => {
      if (score > bestScore) {
        bestScore = score;
        bestEngine = engine;
      }
    });
    
    return bestEngine;
  }

  /**
   * Determine special features provided by engine
   */
  private determineSpecialFeatures(
    engine: FourEngineOCREngine, 
    medicalFields?: MedicalFieldExtraction, 
    confidence?: number
  ): string[] {
    const features: string[] = [];
    
    if (engine.medicalOptimized) features.push('medical_optimized');
    if (engine.handwritingSupport) features.push('handwriting_support');
    if (confidence && confidence > 90) features.push('high_confidence');
    
    if (medicalFields) {
      if (medicalFields.cptCodes && medicalFields.cptCodes.length > 0) features.push('cpt_extraction');
      if (medicalFields.dxCodes && medicalFields.dxCodes.length > 0) features.push('dx_extraction');
      if (medicalFields.patientName) features.push('name_extraction');
      if (medicalFields.insuranceProvider) features.push('insurance_detection');
    }
    
    features.push(...(engine.specialization || []));
    
    return features;
  }

  /**
   * Validate OCR output
   */
  private validateOCROutput(outputPath: string): boolean {
    try {
      if (!existsSync(outputPath)) {
        return false;
      }

      const stats = statSync(outputPath);
      return stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract Tesseract confidence (same as before)
   */
  private async extractTesseractConfidence(inputPath: string): Promise<number> {
    try {
      const tempDir = join(process.cwd(), 'tmp', `confidence_${Date.now()}`);
      await execAsync(`mkdir -p "${tempDir}"`);
      
      const hocrPath = join(tempDir, 'output.hocr');
      await execAsync(`tesseract "${inputPath}" "${hocrPath.replace('.hocr', '')}" -l eng hocr`);
      
      if (existsSync(hocrPath)) {
        const hocrContent = await readFile(hocrPath, 'utf-8');
        
        const confidences: number[] = [];
        const titleMatches = hocrContent.match(/x_wconf (\d+)/g);
        
        if (titleMatches) {
          for (const match of titleMatches) {
            const conf = parseInt(match.split(' ')[1]);
            if (!isNaN(conf)) {
              confidences.push(conf);
            }
          }
        }
        
        await execAsync(`rm -rf "${tempDir}"`);
        
        return confidences.length > 0 
          ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
          : 0;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`Failed to extract Tesseract confidence: ${error}`);
      return 0;
    }
  }

  /**
   * Get available OCR engines
   */
  getAvailableEngines(): string[] {
    return this.engines.filter(e => e.available).map(e => e.name);
  }

  /**
   * Get medical-optimized engines
   */
  getMedicalOptimizedEngines(): string[] {
    return this.engines.filter(e => e.available && e.medicalOptimized).map(e => e.name);
  }

  /**
   * Get handwriting-capable engines
   */
  getHandwritingEngines(): string[] {
    return this.engines.filter(e => e.available && e.handwritingSupport).map(e => e.name);
  }
}

export const fourEngineOCR = new FourEngineOCRService();
