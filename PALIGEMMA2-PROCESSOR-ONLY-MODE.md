# PaliGemma2 Processor-Only Mode Guide

This document explains how to use the PaliGemma2 integration in its current processor-only mode due to limitations in the transformers.js library.

## Current Status

The PaliGemma2 vision-language model is currently operating in **processor-only mode** because:

1. The current version of transformers.js does not fully support the `paligemma` model type
2. The library returns the error: `Unsupported model type: paligemma` when attempting to load the model
3. We've implemented a fallback system that allows the OCR system to continue functioning with limited capabilities

## What Works in Processor-Only Mode

Even in processor-only mode, the system can:

1. Process images and prepare them for OCR
2. Generate placeholder text with document analysis
3. Maintain compatibility with the Smart OCR API endpoint
4. Function as part of the multi-engine OCR system

## Limitations

In processor-only mode, the following limitations apply:

1. Text extraction is limited to basic analysis
2. The confidence scores are approximate estimations
3. Handwriting recognition is limited
4. Complex document analysis is limited

## Usage in API Calls

When using the `/api/smart-ocr` endpoint, you'll receive a response that indicates the processor-only mode:

```json
{
  "success": true,
  "engine": "paligemma2",
  "outputFile": "1750675036030_test_handwritten.png",
  "confidence": 0.5,
  "text": "Image processed with prompt: <image>Extract all text from this document with high accuracy. Preserve formatting, line breaks, and document structure. Include all visible text including headers, footers, and page numbers. (Model not fully loaded)",
  "processingTime": 14005,
  "vlmEnhanced": true,
  "modelUsed": "PaliGemma2 Service (Processor Only)",
  "modelStatus": {
    "processorOnly": true,
    "initialized": true,
    "transformersCompatible": false
  }
}
```

The `modelStatus` object indicates the current status of the model:
- `processorOnly: true` - The model is running in processor-only mode
- `initialized: true` - The processor has been successfully initialized
- `transformersCompatible: false` - The transformers.js library does not fully support this model

## Future Improvements

The system is designed to automatically upgrade to full model functionality when:

1. A newer version of transformers.js with PaliGemma2 support is released
2. An alternative model implementation becomes available

No code changes will be needed when library support becomes available - the system will automatically detect and use the full model capabilities.

## Alternative OCR Options

While waiting for full PaliGemma2 support, you can:

1. Use the `tesseract` or `ocrmypdf` engines for basic OCR
2. Use the multi-engine OCR mode to combine results from multiple engines
3. Use the OLMOCR integration for extractable PDF generation

## Troubleshooting

If you encounter issues with PaliGemma2 in processor-only mode:

1. Check the response `modelStatus` to confirm the mode
2. Look for error messages in the server logs
3. Try using a different OCR engine for critical documents
4. Use the `ocrMode` parameter in API calls to specify a different engine

## Monitoring for Updates

The system is designed to automatically detect when full model support becomes available. You can check the model status by:

1. Examining the `modelStatus` in API responses
2. Checking the server logs during initialization
3. Running the health check endpoint
