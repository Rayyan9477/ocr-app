# nanoVLM OCR Enhancement - User Guide

## Overview

nanoVLM-222M is an advanced vision-language model integrated into our OCR system to significantly improve recognition accuracy for challenging documents:

- **Handwritten Text**: 15-25% improved accuracy for cursive and handwritten content
- **Poor Quality Images**: 10-20% better results on degraded images
- **Tabular Data**: 20-30% improved accuracy for tables and structured content
- **Mixed Content**: 15-25% better results on documents with mixed content types

## How to Use nanoVLM

### From the UI

1. **Upload your document** through the standard interface
2. In the OCR Options panel, enable **Smart OCR**
3. Select "nanoVLM" as the OCR engine (or let the system choose automatically)
4. Configure advanced options if needed:
   - **Document Type**: Select handwritten, table, or poor quality for specialized processing
   - **Enhance Resolution**: For better results with low-resolution documents
   - **Preserve Layout**: To maintain the original document structure

### Through the API

Use the `/api/ocr` endpoint with the following parameters:

```json
{
  "file": "(your file)",
  "useSmartOCR": true,
  "engine": "nanovlm",
  "documentType": "handwritten", // Options: "general", "handwritten", "table", "poor_quality"
  "enhanceResolution": true,
  "preserveLayout": true
}
```

## Feature Capabilities

### Context-Aware Text Recognition
- Understands document intent and corrects OCR errors based on semantic context
- Maintains semantic relationships between text elements

### Advanced Layout Understanding
- Preserves document structure including columns, tables, and formatting
- Retains spatial relationships between text blocks

### Image-Text Relationship Processing
- Recognizes captions and their relationship to images
- Understands diagrams with embedded text elements

## Best Practices

- **Choose the Right Document Type**: Selecting the correct document type significantly improves results
- **Use with Multi-Engine Processing**: Enable multi-engine processing for optimal results
- **Preprocess Poor Quality Documents**: Enable preprocessing for damaged or low-quality images
- **Compare Results**: Use the A/B testing framework to compare nanoVLM with other engines

## Troubleshooting

If you encounter issues with nanoVLM processing:

1. **Check if the model is available**: Use the system status page to verify nanoVLM is operational
2. **Verify input format**: Ensure your document is in a supported format (PDF, JPG, PNG, TIFF)
3. **Try preprocessing**: For very poor quality documents, try enabling preprocessing first
4. **Check logs**: Examine the processing logs for specific error messages

## Support

For additional support with nanoVLM, please contact the system administrator or refer to the technical documentation.
