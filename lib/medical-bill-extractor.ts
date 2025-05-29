/**
 * Medical Bill Data Extractor
 * Specialized module for extracting structured data from medical bills
 */

export interface MedicalBillData {
  patientInfo: {
    name?: string;
    id?: string;
    dateOfBirth?: string;
    address?: string;
  };
  providerInfo: {
    name?: string;
    address?: string;
    phone?: string;
    npi?: string;
  };
  billInfo: {
    billNumber?: string;
    billDate?: string;
    serviceDate?: string;
    dueDate?: string;
  };
  charges: {
    procedures: Array<{
      code?: string;
      description?: string;
      date?: string;
      amount?: number;
    }>;
    totalCharges?: number;
    totalPayments?: number;
    totalAdjustments?: number;
    patientBalance?: number;
  };
  insurance: {
    primaryInsurance?: string;
    policyNumber?: string;
    groupNumber?: string;
    claimNumber?: string;
  };
  medications: Array<{
    name?: string;
    dosage?: string;
    frequency?: string;
    quantity?: string;
  }>;
  confidence: {
    overall: number;
    patientInfo: number;
    charges: number;
    dates: number;
  };
}

export class MedicalBillExtractor {
  private static readonly PATTERNS = {
    // Patient identification patterns
    patientName: [
      /patient\s*name\s*:?\s*([a-zA-Z\s,.'-]+)/i,
      /name\s*:?\s*([a-zA-Z\s,.'-]+)/i,
      /patient\s*:?\s*([a-zA-Z\s,.'-]+)/i
    ],
    
    patientId: [
      /patient\s*id\s*:?\s*([a-zA-Z0-9\-]+)/i,
      /member\s*id\s*:?\s*([a-zA-Z0-9\-]+)/i,
      /account\s*#?\s*:?\s*([a-zA-Z0-9\-]+)/i
    ],
    
    dateOfBirth: [
      /d\.?o\.?b\.?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /birth\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /born\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ],
    
    // Date patterns
    billDate: [
      /bill\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /statement\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ],
    
    serviceDate: [
      /service\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /date\s*of\s*service\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /dos\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ],
    
    dueDate: [
      /due\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /payment\s*due\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ],
    
    // Financial patterns
    totalCharges: [
      /total\s*charges?\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /total\s*amount\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /charges?\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i
    ],
    
    patientBalance: [
      /patient\s*balance\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /balance\s*due\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /amount\s*due\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i
    ],
    
    totalPayments: [
      /total\s*payments?\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /payments?\s*:?\s*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i
    ],
    
    // Insurance patterns
    primaryInsurance: [
      /primary\s*insurance\s*:?\s*([a-zA-Z\s&.,-]+)/i,
      /insurance\s*:?\s*([a-zA-Z\s&.,-]+)/i,
      /payer\s*:?\s*([a-zA-Z\s&.,-]+)/i
    ],
    
    policyNumber: [
      /policy\s*#?\s*:?\s*([a-zA-Z0-9\-]+)/i,
      /member\s*#?\s*:?\s*([a-zA-Z0-9\-]+)/i
    ],
    
    // Medical codes and procedures
    cptCode: [
      /(\d{5})\s+([a-zA-Z\s,.-]+)\s+\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/g,
      /cpt\s*:?\s*(\d{5})/i
    ],
    
    icdCode: [
      /icd\s*:?\s*([a-zA-Z]\d{2}(?:\.\d{1,3})?)/i,
      /diagnosis\s*:?\s*([a-zA-Z]\d{2}(?:\.\d{1,3})?)/i
    ],
    
    // Medication patterns
    medication: [
      /(\w+)\s+(\d+(?:\.\d+)?\s*mg)\s+(\w+)/g,
      /rx\s*:?\s*([a-zA-Z\s]+)\s+(\d+(?:\.\d+)?\s*mg)/i
    ],
    
    // Provider information
    providerName: [
      /provider\s*:?\s*([a-zA-Z\s,.'-]+(?:md|do|np|pa))/i,
      /physician\s*:?\s*([a-zA-Z\s,.'-]+)/i,
      /doctor\s*:?\s*([a-zA-Z\s,.'-]+)/i
    ],
    
    npi: [
      /npi\s*:?\s*(\d{10})/i,
      /national\s*provider\s*identifier\s*:?\s*(\d{10})/i
    ]
  };

  /**
   * Extract medical bill data from OCR text with confidence scoring
   */
  static extractMedicalData(text: string, confidence: number = 70): MedicalBillData {
    const data: MedicalBillData = {
      patientInfo: {},
      providerInfo: {},
      billInfo: {},
      charges: {
        procedures: [],
        totalCharges: undefined,
        totalPayments: undefined,
        totalAdjustments: undefined,
        patientBalance: undefined
      },
      insurance: {},
      medications: [],
      confidence: {
        overall: confidence,
        patientInfo: 0,
        charges: 0,
        dates: 0
      }
    };

    // Clean and normalize text
    const cleanText = this.cleanText(text);
    
    // Extract patient information
    data.patientInfo = this.extractPatientInfo(cleanText);
    
    // Extract provider information
    data.providerInfo = this.extractProviderInfo(cleanText);
    
    // Extract bill information
    data.billInfo = this.extractBillInfo(cleanText);
    
    // Extract charges and procedures
    data.charges = this.extractCharges(cleanText);
    
    // Extract insurance information
    data.insurance = this.extractInsuranceInfo(cleanText);
    
    // Extract medications
    data.medications = this.extractMedications(cleanText);
    
    // Calculate confidence scores
    data.confidence = this.calculateConfidenceScores(data, confidence);
    
    return data;
  }

  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\/.,:$()]/g, ' ')
      .trim();
  }

  private static extractPatientInfo(text: string): MedicalBillData['patientInfo'] {
    const patientInfo: MedicalBillData['patientInfo'] = {};
    
    // Extract patient name
    for (const pattern of this.PATTERNS.patientName) {
      const match = text.match(pattern);
      if (match && match[1]) {
        patientInfo.name = this.cleanName(match[1]);
        break;
      }
    }
    
    // Extract patient ID
    for (const pattern of this.PATTERNS.patientId) {
      const match = text.match(pattern);
      if (match && match[1]) {
        patientInfo.id = match[1].trim();
        break;
      }
    }
    
    // Extract date of birth
    for (const pattern of this.PATTERNS.dateOfBirth) {
      const match = text.match(pattern);
      if (match && match[1]) {
        patientInfo.dateOfBirth = this.standardizeDate(match[1]);
        break;
      }
    }
    
    return patientInfo;
  }

  private static extractProviderInfo(text: string): MedicalBillData['providerInfo'] {
    const providerInfo: MedicalBillData['providerInfo'] = {};
    
    // Extract provider name
    for (const pattern of this.PATTERNS.providerName) {
      const match = text.match(pattern);
      if (match && match[1]) {
        providerInfo.name = this.cleanName(match[1]);
        break;
      }
    }
    
    // Extract NPI
    for (const pattern of this.PATTERNS.npi) {
      const match = text.match(pattern);
      if (match && match[1]) {
        providerInfo.npi = match[1];
        break;
      }
    }
    
    return providerInfo;
  }

  private static extractBillInfo(text: string): MedicalBillData['billInfo'] {
    const billInfo: MedicalBillData['billInfo'] = {};
    
    // Extract bill date
    for (const pattern of this.PATTERNS.billDate) {
      const match = text.match(pattern);
      if (match && match[1]) {
        billInfo.billDate = this.standardizeDate(match[1]);
        break;
      }
    }
    
    // Extract service date
    for (const pattern of this.PATTERNS.serviceDate) {
      const match = text.match(pattern);
      if (match && match[1]) {
        billInfo.serviceDate = this.standardizeDate(match[1]);
        break;
      }
    }
    
    // Extract due date
    for (const pattern of this.PATTERNS.dueDate) {
      const match = text.match(pattern);
      if (match && match[1]) {
        billInfo.dueDate = this.standardizeDate(match[1]);
        break;
      }
    }
    
    return billInfo;
  }

  private static extractCharges(text: string): MedicalBillData['charges'] {
    const charges: MedicalBillData['charges'] = {
      procedures: [],
      totalCharges: undefined,
      totalPayments: undefined,
      totalAdjustments: undefined,
      patientBalance: undefined
    };
    
    // Extract total charges
    for (const pattern of this.PATTERNS.totalCharges) {
      const match = text.match(pattern);
      if (match && match[1]) {
        charges.totalCharges = this.parseAmount(match[1]);
        break;
      }
    }
    
    // Extract patient balance
    for (const pattern of this.PATTERNS.patientBalance) {
      const match = text.match(pattern);
      if (match && match[1]) {
        charges.patientBalance = this.parseAmount(match[1]);
        break;
      }
    }
    
    // Extract total payments
    for (const pattern of this.PATTERNS.totalPayments) {
      const match = text.match(pattern);
      if (match && match[1]) {
        charges.totalPayments = this.parseAmount(match[1]);
        break;
      }
    }
    
    // Extract individual procedures with CPT codes
    const cptMatches = text.matchAll(this.PATTERNS.cptCode[0]);
    for (const match of cptMatches) {
      if (match[1] && match[2] && match[3]) {
        charges.procedures.push({
          code: match[1],
          description: match[2].trim(),
          amount: this.parseAmount(match[3])
        });
      }
    }
    
    return charges;
  }

  private static extractInsuranceInfo(text: string): MedicalBillData['insurance'] {
    const insurance: MedicalBillData['insurance'] = {};
    
    // Extract primary insurance
    for (const pattern of this.PATTERNS.primaryInsurance) {
      const match = text.match(pattern);
      if (match && match[1]) {
        insurance.primaryInsurance = match[1].trim();
        break;
      }
    }
    
    // Extract policy number
    for (const pattern of this.PATTERNS.policyNumber) {
      const match = text.match(pattern);
      if (match && match[1]) {
        insurance.policyNumber = match[1];
        break;
      }
    }
    
    return insurance;
  }

  private static extractMedications(text: string): MedicalBillData['medications'] {
    const medications: MedicalBillData['medications'] = [];
    
    const medMatches = text.matchAll(this.PATTERNS.medication[0]);
    for (const match of medMatches) {
      if (match[1] && match[2] && match[3]) {
        medications.push({
          name: match[1],
          dosage: match[2],
          frequency: match[3]
        });
      }
    }
    
    return medications;
  }

  private static calculateConfidenceScores(data: MedicalBillData, baseConfidence: number): MedicalBillData['confidence'] {
    let patientInfoScore = 0;
    let chargesScore = 0;
    let datesScore = 0;
    
    // Calculate patient info confidence
    if (data.patientInfo.name) patientInfoScore += 40;
    if (data.patientInfo.id) patientInfoScore += 30;
    if (data.patientInfo.dateOfBirth) patientInfoScore += 30;
    
    // Calculate charges confidence
    if (data.charges.totalCharges !== undefined) chargesScore += 30;
    if (data.charges.patientBalance !== undefined) chargesScore += 30;
    if (data.charges.procedures.length > 0) chargesScore += 40;
    
    // Calculate dates confidence
    if (data.billInfo.billDate) datesScore += 35;
    if (data.billInfo.serviceDate) datesScore += 35;
    if (data.billInfo.dueDate) datesScore += 30;
    
    // Overall confidence is weighted average
    const overall = (baseConfidence * 0.4) + (patientInfoScore * 0.25) + (chargesScore * 0.25) + (datesScore * 0.1);
    
    return {
      overall: Math.round(overall),
      patientInfo: patientInfoScore,
      charges: chargesScore,
      dates: datesScore
    };
  }

  private static cleanName(name: string): string {
    return name
      .replace(/[^\w\s\-',.]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private static standardizeDate(date: string): string {
    // Convert various date formats to MM/DD/YYYY
    const cleaned = date.replace(/[^\d\/\-]/g, '');
    const parts = cleaned.split(/[\/\-]/);
    
    if (parts.length === 3) {
      let [month, day, year] = parts;
      
      // Handle 2-digit years
      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        year = String(currentCentury + parseInt(year));
      }
      
      // Ensure MM/DD format
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');
      
      return `${month}/${day}/${year}`;
    }
    
    return date; // Return original if can't parse
  }

  private static parseAmount(amount: string): number {
    const cleaned = amount.replace(/[^\d.,]/g, '');
    return parseFloat(cleaned.replace(/,/g, '')) || 0;
  }

  /**
   * Validate extracted data quality
   */
  static validateMedicalData(data: MedicalBillData): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check required fields
    if (!data.patientInfo.name) {
      issues.push('Patient name not found');
    }
    
    if (!data.charges.totalCharges && !data.charges.patientBalance) {
      issues.push('No financial information found');
    }
    
    if (!data.billInfo.billDate && !data.billInfo.serviceDate) {
      issues.push('No date information found');
    }
    
    // Check data consistency
    if (data.charges.totalCharges && data.charges.patientBalance && 
        data.charges.patientBalance > data.charges.totalCharges) {
      issues.push('Patient balance exceeds total charges');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate confidence scores for extracted data
   */
  static validateConfidence(data: MedicalBillData): {
    isReliable: boolean;
    confidenceIssues: string[];
    recommendedActions: string[];
  } {
    const issues: string[] = [];
    const actions: string[] = [];
    
    // Check overall confidence threshold
    if (data.confidence.overall < 0.7) {
      issues.push(`Overall confidence too low: ${Math.round(data.confidence.overall * 100)}%`);
      actions.push('Consider reprocessing with different OCR engine');
    }
    
    // Check individual section confidence
    if (data.confidence.patientInfo < 0.6) {
      issues.push(`Patient information confidence low: ${Math.round(data.confidence.patientInfo * 100)}%`);
      actions.push('Manually verify patient details');
    }
    
    if (data.confidence.charges < 0.8) {
      issues.push(`Financial data confidence low: ${Math.round(data.confidence.charges * 100)}%`);
      actions.push('Double-check monetary amounts');
    }
    
    if (data.confidence.dates < 0.7) {
      issues.push(`Date information confidence low: ${Math.round(data.confidence.dates * 100)}%`);
      actions.push('Verify all dates manually');
    }
    
    return {
      isReliable: issues.length === 0 && data.confidence.overall >= 0.7,
      confidenceIssues: issues,
      recommendedActions: actions
    };
  }

  /**
   * Calculate confidence metrics for validation
   */
  static calculateConfidenceMetrics(text: string, extractedData: MedicalBillData): {
    completeness: number;
    consistency: number;
    reliability: number;
  } {
    const totalFields = 15; // Total expected fields in a medical bill
    let extractedFields = 0;
    
    // Count extracted fields
    if (extractedData.patientInfo.name) extractedFields++;
    if (extractedData.patientInfo.id) extractedFields++;
    if (extractedData.patientInfo.dateOfBirth) extractedFields++;
    if (extractedData.billInfo.billDate) extractedFields++;
    if (extractedData.billInfo.serviceDate) extractedFields++;
    if (extractedData.charges.totalCharges) extractedFields++;
    if (extractedData.charges.patientBalance) extractedFields++;
    if (extractedData.providerInfo.name) extractedFields++;
    
    const completeness = extractedFields / totalFields;
    
    // Calculate consistency (check for contradictions)
    let consistencyScore = 1.0;
    if (extractedData.charges.totalCharges && extractedData.charges.patientBalance &&
        extractedData.charges.patientBalance > extractedData.charges.totalCharges) {
      consistencyScore -= 0.3;
    }
    
    // Calculate reliability based on pattern matching quality
    const reliabilityScore = (extractedData.confidence.overall + completeness) / 2;
    
    return {
      completeness,
      consistency: Math.max(0, consistencyScore),
      reliability: reliabilityScore
    };
  }
}
