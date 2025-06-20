# PaliGemma2 OCR Integration

This document outlines the implementation of a model-based PDF OCR system that uses **exclusively** the PaliGemma2 model for extractable PDF processing, without any fallback or multi-engine logic.

## Overview

The application now uses only the PaliGemma2 model for all OCR processing, including:
- Text extraction from images and PDFs
- Creating extractable PDFs with searchable text layers
- Smart OCR processing with advanced text recognition

All fallback mechanisms to other OCR engines (Tesseract, OCRmyPDF, EnhancedTesseract) have been removed to ensure consistent, high-quality results from the PaliGemma2 model.

## Implementation Details

### Core Components

- **VLM Model Manager**: Configured to use only PaliGemma2, with all fallback options disabled
- **OLMOCR Integration**: Used for extractable PDF processing, configured to use only PaliGemma2 
- **API Routes**: All routes now use PaliGemma2 exclusively:
  - `/api/ocr`: Uses PaliGemma2 for all OCR processing
  - `/api/ocr/paligemma2-only`: Dedicated PaliGemma2-only endpoint
  - `/api/ocr/multi-engine`: Now also uses only PaliGemma2 (name kept for compatibility)
  - `/api/extract-pdf`: Uses PaliGemma2 via OLMOCR integration for extractable PDFs
  - `/api/smart-ocr`: Uses PaliGemma2 with enhanced prompting for smart features

### Configuration Options

The VLM Model Manager is configured with:
```javascript
{
  enableOLMOCR: true,
  fallbackToSimple: false, // No fallback to simple version
  enableCloudFallback: false, // No cloud fallback
  useEnhancedIntegration: true
}
```

### PDF Processing

Extractable PDF processing now uses the OLMOCR integration which has been configured to use PaliGemma2 exclusively:
- No fallback to other OCR engines
- No ensemble/voting logic between multiple engines
- Only PaliGemma2 is responsible for the text layer

## Usage

To process a document with PaliGemma2:

```
POST /api/ocr
Content-Type: multipart/form-data

file: [binary file data]
```

For creating extractable PDFs:

```
POST /api/extract-pdf
Content-Type: multipart/form-data

pdf: [binary PDF file]
preserveLayout: true
```

## Benefits

- Consistent OCR quality across all document types
- Higher accuracy text extraction, especially for complex documents
- Preservation of visual appearance with high-quality text layers
- Simplified architecture with a single model approach
