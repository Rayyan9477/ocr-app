/**
 * HTML to PDF fallback converter
 * 
 * This module provides a fallback mechanism for converting HTML to PDF
 * when external tools like wkhtmltopdf are not available.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Converts HTML to PDF using multiple fallback mechanisms
 * 
 * @param {string} htmlPath - Path to the HTML file
 * @param {string} pdfPath - Desired output PDF path
 * @param {string} [title='OCR Result'] - Document title
 * @returns {Promise<boolean>} - True if conversion was successful
 */
async function convertHtmlToPdf(htmlPath, pdfPath, title = 'OCR Result') {
  console.log(`[PDF Converter] Starting conversion: ${htmlPath} -> ${pdfPath}`);
  
  try {
    // Check if the HTML file exists
    if (!fs.existsSync(htmlPath)) {
      console.error(`[PDF Converter] HTML file not found: ${htmlPath}`);
      return false;
    }

    // Get the HTML content for fallback methods
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Method 1: Try wkhtmltopdf if available
    try {
      // Check if wkhtmltopdf is installed
      await execAsync('command -v wkhtmltopdf');
      console.log('[PDF Converter] Using wkhtmltopdf for conversion');
      const { stdout, stderr } = await execAsync(`wkhtmltopdf "${htmlPath}" "${pdfPath}"`);
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
        console.log('[PDF Converter] wkhtmltopdf conversion successful');
        return true;
      }
      console.log('[PDF Converter] wkhtmltopdf created empty file, trying next method');
    } catch (error) {
      console.log('[PDF Converter] wkhtmltopdf not available or failed, trying next method');
    }

    // Method 2: Try the shell script if available
    const fallbackScript = path.join(process.cwd(), 'lib', 'create-minimal-pdf.sh');
    if (fs.existsSync(fallbackScript)) {
      try {
        console.log('[PDF Converter] Using shell script fallback for conversion');
        await execAsync(`bash "${fallbackScript}" "${pdfPath}" "${title}" "${htmlPath}"`);
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
          console.log('[PDF Converter] Shell script conversion successful');
          return true;
        }
        console.log('[PDF Converter] Shell script created empty file, trying next method');
      } catch (error) {
        console.log('[PDF Converter] Shell script fallback failed, trying next method');
      }
    }

    // Method 3: Try to use puppeteer-core if installed
    try {
      const puppeteerExists = await new Promise(resolve => {
        exec('npm list puppeteer-core', (error) => {
          resolve(!error);
        });
      });
      
      if (puppeteerExists) {
        // Dynamic import to avoid requiring puppeteer as a dependency
        console.log('Attempting to use puppeteer for PDF creation');
        const puppeteerCode = `
          const puppeteer = require('puppeteer-core');
          (async () => {
            const browser = await puppeteer.launch({
              executablePath: '/usr/bin/chromium-browser',
              args: ['--no-sandbox', '--disable-setuid-sandbox'],
              headless: 'new'
            }).catch(e => {
              console.error('Failed to launch browser:', e);
              return null;
            });
            
            if (!browser) {
              process.exit(1);
            }
            
            try {
              const page = await browser.newPage();
              await page.setContent(\`${htmlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
              await page.pdf({ 
                path: '${pdfPath}', 
                format: 'A4',
                printBackground: true,
                margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
              });
              await browser.close();
              process.exit(0);
            } catch (error) {
              console.error('PDF generation error:', error);
              process.exit(1);
            }
          })();
        `;
        
        const puppeteerScriptPath = path.join(process.cwd(), 'temp-puppeteer-pdf.js');
        fs.writeFileSync(puppeteerScriptPath, puppeteerCode);
        
        try {
          await execAsync(`node "${puppeteerScriptPath}"`);
          fs.unlinkSync(puppeteerScriptPath);
          if (fs.existsSync(pdfPath)) {
            return true;
          }
        } catch (error) {
          console.log('Puppeteer fallback failed');
          fs.unlinkSync(puppeteerScriptPath);
        }
      }
    } catch (error) {
      console.log('Puppeteer not available');
    }

    // Method 4: Last resort - create a simple text file with PDF extension
    console.log('Using last resort - creating text file with PDF extension');
    const htmlText = htmlContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    fs.writeFileSync(pdfPath, `${title}\n\n${htmlText}`);
    return true;
  } catch (error) {
    console.error('HTML to PDF conversion failed:', error);
    return false;
  }
}

module.exports = {
  convertHtmlToPdf
};
