/**
 * Specialized handling for empty pages in medical documents
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Check if a PDF page is likely empty
 * @param pdfPath Path to the PDF file
 * @param pageNum Page number to check (1-based)
 */
export async function isPageEmpty(pdfPath: string, pageNum: number): Promise<boolean> {
  try {
    // Extract the page to analyze
    const tmpDir = join(process.cwd(), 'tmp');
    const tmpImagePath = join(tmpDir, `page_${pageNum}_check.png`);
    
    // Create tmp dir if it doesn't exist
    if (!existsSync(tmpDir)) {
      await execAsync(`mkdir -p ${tmpDir}`);
    }
    
    // Convert the specific page to an image for analysis
    await execAsync(`pdftoppm -png -f ${pageNum} -l ${pageNum} -r 150 ${pdfPath} ${join(tmpDir, `page_${pageNum}`)}`);
    
    if (!existsSync(tmpImagePath)) {
      console.warn(`Could not extract page ${pageNum} from ${pdfPath}`);
      return false;
    }
    
    // Use ImageMagick to analyze the image content
    const { stdout } = await execAsync(`identify -format "%[mean]" ${tmpImagePath}`);
    const meanValue = parseFloat(stdout.trim());
    
    // Clean up
    await execAsync(`rm ${tmpImagePath}`);
    
    // Determine emptiness based on mean pixel value
    // Pages that are mostly white will have high mean values
    const isEmptyThreshold = 250; // closer to 255 = whiter
    return meanValue > isEmptyThreshold;
  } catch (error) {
    console.error(`Error checking if page ${pageNum} is empty:`, error);
    return false; // Default to not empty if we can't check
  }
}

/**
 * Identify empty pages in a PDF document
 * @param pdfPath Path to the PDF file
 * @returns Array of page numbers that are empty (1-based)
 */
export async function findEmptyPages(pdfPath: string): Promise<number[]> {
  try {
    // Get the total number of pages
    const { stdout } = await execAsync(`pdfinfo ${pdfPath} | grep Pages: | awk '{print $2}'`);
    const totalPages = parseInt(stdout.trim(), 10);
    
    const emptyPages: number[] = [];
    
    // Check each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (await isPageEmpty(pdfPath, pageNum)) {
        emptyPages.push(pageNum);
      }
    }
    
    return emptyPages;
  } catch (error) {
    console.error(`Error finding empty pages in ${pdfPath}:`, error);
    return [];
  }
}

/**
 * Annotate a PDF with markers for empty pages to improve OCR processing
 * @param pdfPath Path to the PDF file
 * @returns Path to the annotated PDF
 */
export async function markEmptyPages(pdfPath: string): Promise<string> {
  const emptyPages = await findEmptyPages(pdfPath);
  
  if (emptyPages.length === 0) {
    console.log(`No empty pages found in ${pdfPath}`);
    return pdfPath;
  }
  
  console.log(`Found ${emptyPages.length} empty pages in ${pdfPath}: ${emptyPages.join(', ')}`);
  
  // Generate a new annotated PDF
  const annotatedPath = pdfPath.replace('.pdf', '_marked.pdf');
  
  try {
    // Copy the original file first
    await execAsync(`cp ${pdfPath} ${annotatedPath}`);
    
    // Use pdftk to add annotations
    for (const pageNum of emptyPages) {
      // Add a small non-visible text annotation to help Tesseract recognize the page
      const annotationCmd = `pdftk ${annotatedPath} update_info_utf8 "InfoKey: Empty page ${pageNum}" output ${annotatedPath}.tmp && mv ${annotatedPath}.tmp ${annotatedPath}`;
      await execAsync(annotationCmd);
    }
    
    return annotatedPath;
  } catch (error) {
    console.error(`Error marking empty pages in ${pdfPath}:`, error);
    return pdfPath; // Return original path if marking fails
  }
}

/**
 * Remove empty pages from a PDF to improve processing efficiency
 * @param pdfPath Path to the PDF file
 * @returns Path to the cleaned PDF
 */
export async function removeEmptyPages(pdfPath: string): Promise<string> {
  const emptyPages = await findEmptyPages(pdfPath);
  
  if (emptyPages.length === 0) {
    console.log(`No empty pages found in ${pdfPath}`);
    return pdfPath;
  }
  
  console.log(`Found ${emptyPages.length} empty pages to remove from ${pdfPath}: ${emptyPages.join(', ')}`);
  
  // Generate cleaned PDF
  const cleanedPath = pdfPath.replace('.pdf', '_cleaned.pdf');
  
  try {
    // Get total page count
    const { stdout } = await execAsync(`pdfinfo ${pdfPath} | grep Pages: | awk '{print $2}'`);
    const totalPages = parseInt(stdout.trim(), 10);
    
    // Create page range string excluding empty pages
    const pageRanges: string[] = [];
    let currentRange = '';
    
    for (let i = 1; i <= totalPages; i++) {
      if (!emptyPages.includes(i)) {
        if (currentRange === '') {
          currentRange = i.toString();
        } else {
          // Check if this is a consecutive page
          const lastPage = parseInt(currentRange.split('-').pop() || currentRange, 10);
          if (i === lastPage + 1) {
            // Extend the range
            if (currentRange.includes('-')) {
              currentRange = currentRange.split('-')[0] + '-' + i;
            } else {
              currentRange = currentRange + '-' + i;
            }
          } else {
            // Start a new range
            pageRanges.push(currentRange);
            currentRange = i.toString();
          }
        }
      }
    }
    
    if (currentRange !== '') {
      pageRanges.push(currentRange);
    }
    
    if (pageRanges.length === 0) {
      console.warn(`All pages (${totalPages}) were detected as empty in ${pdfPath}`);
      return pdfPath; // Return original if all pages are empty
    }
    
    // Use pdftk to extract only non-empty pages
    const pageRangeStr = pageRanges.join(' ');
    await execAsync(`pdftk ${pdfPath} cat ${pageRangeStr} output ${cleanedPath}`);
    
    return cleanedPath;
  } catch (error) {
    console.error(`Error removing empty pages from ${pdfPath}:`, error);
    return pdfPath; // Return original path if cleaning fails
  }
}
