/**
 * Specialized handling for diacritics and special characters in medical documents
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * List of common medical terms that get misrecognized
 */
const MEDICAL_TERM_CORRECTIONS: Record<string, string> = {
  // Common corrections for medical terms with diacritics or special characters
  "patíent": "patient",
  "diagnōsis": "diagnosis",
  "prescription̄": "prescription",
  "medicatión": "medication",
  "labóratory": "laboratory",
  "hospitāl": "hospital",
  "phārmacy": "pharmacy",
  "physiçian": "physician",
  "surgèry": "surgery",
  "treatmént": "treatment",
  // Common billing terms
  "invoicè": "invoice",
  "insurānce": "insurance",
  "çlaim": "claim",
  "beneñt": "benefit",
  "códe": "code",
  "authorizatión": "authorization",
  "copāyment": "copayment",
  "deductíble": "deductible",
  // Medical procedures and terminology
  "radiológy": "radiology",
  "ėchocardiogram": "echocardiogram",
  "ultrasoûnd": "ultrasound",
  "éndoscopy": "endoscopy",
  "cõlonoscopy": "colonoscopy",
  "mammográphy": "mammography",
  "biópsy": "biopsy",
  // Medical specialties
  "cardiōlogy": "cardiology",
  "neurólogy": "neurology",
  "orthopædics": "orthopedics",
  "onçology": "oncology",
  "pėdiatrics": "pediatrics",
  "gynecólogy": "gynecology",
  // Billing and insurance terms
  "CPŤ": "CPT",
  "ICĎ": "ICD",
  "HCPĆS": "HCPCS",
  "EOB̄": "EOB",
  "NDĆ": "NDC",
  "preâuthorization": "preauthorization",
  "adjúdication": "adjudication",
  "claíms": "claims",
  // Additional medical document terms
  "pāyment": "payment",
  "stātement": "statement",
  "explānation": "explanation",
  "āccount": "account",
  "bălance": "balance",
  "párticipating": "participating",
  "nõn-participating": "non-participating",
  "prīmary": "primary",
  "secõndary": "secondary",
  "rėmittance": "remittance",
  "advīce": "advice",
  // Add more as needed
};

/**
 * Fix common OCR errors with diacritics in medical documents
 * @param text Text with potential diacritic issues
 * @returns Corrected text
 */
function fixDiacriticErrors(text: string): string {
  let correctedText = text;
  
  // Replace known medical term errors
  Object.entries(MEDICAL_TERM_CORRECTIONS).forEach(([error, correction]) => {
    const regex = new RegExp(error, 'gi');
    correctedText = correctedText.replace(regex, correction);
  });
  
  // General diacritic normalization
  // This uses Unicode normalization to handle composed vs decomposed characters
  correctedText = correctedText.normalize('NFKD')  // Decompose characters
    .replace(/[\u0300-\u036f]/g, '');  // Remove combining diacritical marks
  
  return correctedText;
}

/**
 * Process a text file to correct diacritic issues
 * @param filePath Path to text file
 * @returns Path to the corrected file
 */
export async function fixTextDiacritics(filePath: string): Promise<string> {
  try {
    const text = await fs.promises.readFile(filePath, 'utf8');
    const correctedText = fixDiacriticErrors(text);
    await fs.promises.writeFile(filePath, correctedText, 'utf8');
    return filePath;
  } catch (error) {
    console.error(`Error fixing diacritics in ${filePath}:`, error);
    return filePath;
  }
}

/**
 * Extract text from PDF, fix diacritics, and improve text layer
 * @param pdfPath Path to the PDF file
 * @returns Path to the improved PDF
 */
export async function fixPdfDiacritics(pdfPath: string): Promise<string> {
  try {
    const baseName = path.basename(pdfPath, '.pdf');
    const dirName = path.dirname(pdfPath);
    const textPath = path.join(dirName, `${baseName}_text.txt`);
    const improvedPdfPath = path.join(dirName, `${baseName}_improved.pdf`);
    
    // Extract text from the PDF
    await execAsync(`pdftotext -layout "${pdfPath}" "${textPath}"`);
    
    // Fix diacritics in the text file
    await fixTextDiacritics(textPath);
    
    // Check if we should proceed with updating the PDF
    const originalText = await fs.promises.readFile(textPath, 'utf8');
    const correctedText = fixDiacriticErrors(originalText);
    
    // Only rebuild the PDF if corrections were made
    if (originalText !== correctedText) {
      console.log(`Diacritic corrections needed for ${pdfPath}`);
      
      // Create a simple HTML version with the corrected text
      const htmlPath = path.join(dirName, `${baseName}_corrected.html`);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Corrected Medical Document</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            pre { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <pre>${correctedText}</pre>
        </body>
        </html>
      `;
      
      await fs.promises.writeFile(htmlPath, htmlContent, 'utf8');
      
      // Convert the HTML back to PDF
      await execAsync(`wkhtmltopdf "${htmlPath}" "${improvedPdfPath}"`);
      
      // Clean up temporary files
      await fs.promises.unlink(textPath);
      await fs.promises.unlink(htmlPath);
      
      return improvedPdfPath;
    }
    
    // No corrections needed
    console.log(`No diacritic corrections needed for ${pdfPath}`);
    await fs.promises.unlink(textPath);
    return pdfPath;
    
  } catch (error) {
    console.error(`Error fixing PDF diacritics in ${pdfPath}:`, error);
    return pdfPath;
  }
}

/**
 * Check if a PDF has diacritic issues based on OCR log output
 * @param ocrOutput OCR process output text
 * @returns True if diacritic issues are detected
 */
export function hasDiacriticIssues(ocrOutput: string): boolean {
  const diacriticKeywords = [
    'lots of diacritics',
    'diacritic',
    'possibly poor OCR',
    'non-dictionary words'
  ];
  
  return diacriticKeywords.some(keyword => 
    ocrOutput.toLowerCase().includes(keyword.toLowerCase())
  );
}
