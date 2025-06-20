# Extractable PDF Processing with OLMOCR

This module integrates OLMOCR capabilities to create searchable, extractable PDFs while preserving the original visual appearance.

## Overview

The OLMOCR integration is based on the Allen AI OLMOCR project (https://github.com/allenai/olmocr), which uses Vision Language Models to extract text from documents with high accuracy, preserving natural reading order and supporting complex elements like tables, equations, and handwriting.

## Features

- Process PDFs to make text fully extractable and searchable
- Preserve the exact visual appearance of the original PDF
- Support for complex document elements (tables, equations, forms)
- High-accuracy text recognition using advanced OCR models
- Optimization to keep file sizes reasonable

## Usage

### From the Command Line

Use the `make-extractable-pdf.js` script to process a PDF file:

```bash
node make-extractable-pdf.js input.pdf [output.pdf]
```

If no output file is specified, the result will be saved as `input-extractable.pdf` in the current directory.

### From JavaScript

```javascript
import VLMModelManager from './lib/vlm-model-manager.js';

// Initialize the VLM Model Manager with OLMOCR enabled
const modelManager = new VLMModelManager({
  enableOLMOCR: true
});

// Load the OLMOCR model
await modelManager.loadModel('olmocr');

// Process a PDF to make it extractable
const extractablePdfPath = await modelManager.makeExtractablePdf('input.pdf', {
  preserveLayout: true,
  enhanceOCR: true
});

console.log(`Extractable PDF created: ${extractablePdfPath}`);
```

## Dependencies

The following system dependencies are required:

- ImageMagick
- Tesseract OCR
- PDFtk
- Poppler Utils
- GhostScript

You can install these dependencies on Ubuntu/Debian with:

```bash
apt-get update && apt-get install -y imagemagick pdftk tesseract-ocr poppler-utils ghostscript
```

## Options

The PDF processor accepts the following options:

- `preserveLayout` (boolean): Preserve the original document layout
- `enhanceOCR` (boolean): Use enhanced OCR techniques for better accuracy
- `processAllPages` (boolean): Process all pages in the PDF (if false, only processes the first page)
- `addMetadata` (boolean): Add metadata to the PDF
- `optimizeOutput` (boolean): Optimize the output PDF for size

## Technical Details

The process works by:

1. Converting PDF pages to high-resolution images
2. Using OLMOCR to extract text with precise positioning
3. Creating a new PDF with an invisible text layer that preserves the original appearance
4. Optimizing the resulting PDF for size while maintaining quality

This approach ensures that the visual appearance of the PDF remains unchanged while making the text fully extractable and searchable.
