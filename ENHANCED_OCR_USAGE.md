# Enhanced OCR Pipeline - Usage Documentation

This document provides comprehensive usage instructions for the enhanced OCR pipeline with advanced preprocessing, highlight detection, and intelligent text extraction.

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [CLI Usage](#cli-usage)
4. [API Usage](#api-usage)
5. [Service Usage](#service-usage)
6. [Configuration Options](#configuration-options)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Overview

The Enhanced OCR Pipeline provides:

- **Advanced Preprocessing**: CLAHE, edge enhancement, normalization, perspective correction, deskewing
- **Intelligent Highlight Detection**: Multi-method detection with ML validation
- **Document Type Detection**: Handwritten/printed/mixed classification
- **Multi-PSM OCR**: Adaptive PSM mode selection based on document characteristics
- **Quality Assessment**: Confidence scoring and recommendations
- **Comprehensive API**: RESTful endpoints with full configuration
- **CLI Tool**: Command-line interface for batch processing
- **Test Suite**: Automated testing and validation

## Installation & Setup

### Prerequisites

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install imagemagick tesseract-ocr tesseract-ocr-eng

# Optional: Additional language packs
sudo apt-get install tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-spa
```

### Project Setup

```bash
# Clone and install dependencies
git clone <repository>
cd ocr-app
npm install

# Make CLI scripts executable
chmod +x bin/enhanced-ocr-cli.ts

# Run setup script
./setup-enhanced-ocr-complete.sh
```

### Verification

```bash
# Test installation
npm test
npm run test:enhanced-ocr

# Build project
npm run build

# Start development server
npm run dev
```

## CLI Usage

### Basic Usage

```bash
# Basic OCR processing
node bin/enhanced-ocr-cli.ts document.pdf

# With output file
node bin/enhanced-ocr-cli.ts -i document.png -o extracted_text.txt

# Show help
node bin/enhanced-ocr-cli.ts --help
```

### Advanced Options

```bash
# Full preprocessing pipeline
node bin/enhanced-ocr-cli.ts --clahe --edges --normalize --perspective --highlight --handwriting document.pdf

# Language-specific processing
node bin/enhanced-ocr-cli.ts -l fra --handwriting french_document.png

# Custom preprocessing parameters
node bin/enhanced-ocr-cli.ts --clahe-limit 3.0 --edge-strength 1.5 --verbose document.jpg

# Show capabilities
node bin/enhanced-ocr-cli.ts --capabilities
```

### CLI Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input` | Input file path | Required |
| `-o, --output` | Output text file | Optional |
| `-l, --language` | OCR language | `eng` |
| `--clahe` | Enable CLAHE enhancement | `true` |
| `--no-clahe` | Disable CLAHE | - |
| `--clahe-limit` | CLAHE clip limit | `2.0` |
| `--deskew` | Enable deskewing | `true` |
| `--no-deskew` | Disable deskewing | - |
| `--edges` | Enable edge enhancement | `false` |
| `--edge-strength` | Edge enhancement strength | `1.0` |
| `--normalize` | Enable normalization | `false` |
| `--perspective` | Enable perspective correction | `false` |
| `--highlight` | Enable highlight optimization | `false` |
| `--handwriting` | Enable handwriting detection | `false` |
| `-v, --verbose` | Verbose output | `false` |
| `-h, --help` | Show help | - |

## API Usage

### Enhanced OCR Endpoint

**POST** `/api/enhanced-ocr-complete`

#### Request

```bash
curl -X POST http://localhost:3000/api/enhanced-ocr-complete \
  -F "file=@document.pdf" \
  -F "applyCLAHE=true" \
  -F "enhanceEdges=true" \
  -F "optimizeHighlightedText=true" \
  -F "enableHandwritingDetection=true" \
  -F "language=eng"
```

#### Request Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `file` | File | Document to process | Required |
| `applyCLAHE` | boolean | Enable CLAHE enhancement | `false` |
| `deskew` | boolean | Enable deskewing | `true` |
| `enhanceEdges` | boolean | Enable edge enhancement | `false` |
| `normalize` | boolean | Enable normalization | `false` |
| `perspectiveCorrection` | boolean | Enable perspective correction | `false` |
| `optimizeHighlightedText` | boolean | Enable highlight optimization | `false` |
| `enableHandwritingDetection` | boolean | Enable handwriting detection | `false` |
| `language` | string | OCR language | `eng` |
| `edgeStrength` | number | Edge enhancement strength | `1.0` |
| `claheClipLimit` | number | CLAHE clip limit | `2.0` |

#### Response

```json
{
  "success": true,
  "text": "Extracted text content...",
  "confidence": 87.5,
  "processingTime": 1250,
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "fileType": "application/pdf",
  "preprocessingOperations": [
    "CLAHE Enhancement",
    "Document Deskewing",
    "Edge Enhancement",
    "Highlight detection"
  ],
  "documentType": "printed",
  "qualityScore": 89,
  "wordCount": 245,
  "charCount": 1534,
  "lineCount": 12,
  "highlightedRegionsCount": 3,
  "highlightedRegions": [
    {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 30,
      "confidence": 0.85,
      "text": "Important highlighted text"
    }
  ],
  "recommendationsApplied": [
    "Edge enhancement applied for better text clarity",
    "Highlight optimization improved text extraction"
  ],
  "optionsUsed": {
    "applyCLAHE": true,
    "enhanceEdges": true,
    "optimizeHighlightedText": true
  }
}
```

### API Capabilities

**GET** `/api/enhanced-ocr-complete`

```bash
curl http://localhost:3000/api/enhanced-ocr-complete
```

Returns API capabilities, supported formats, and configuration options.

## Service Usage

### Direct Service Integration

```typescript
import { EnhancedOCRService } from './lib/enhanced-ocr-service';

const service = new EnhancedOCRService();

// Basic processing
const result = await service.processDocument('document.pdf');

// Advanced processing
const result = await service.processDocument('document.pdf', {
  applyCLAHE: true,
  enhanceEdges: true,
  optimizeHighlightedText: true,
  enableHandwritingDetection: true,
  language: 'eng',
  edgeStrength: 1.5,
  claheClipLimit: 3.0
});

// Cleanup
service.cleanup();
```

### Component Services

```typescript
// Preprocessing only
import { PreprocessingService } from './lib/preprocessing-service';

const preprocessor = new PreprocessingService();
const result = await preprocessor.preprocessDocument('document.pdf', {
  enhanceContrast: true,
  detectHighlights: true,
  enhanceHighlights: true
});

// Highlight detection only
import { HighlightDetector } from './lib/highlight-detector';

const detector = new HighlightDetector();
const highlights = await detector.detectHighlights('image.png', {
  enableTextExtraction: true,
  targetColors: ['yellow', 'green', 'pink'],
  sensitivityLevel: 'high'
});
```

## Configuration Options

### Preprocessing Options

| Option | Description | Use Case |
|--------|-------------|----------|
| `applyCLAHE` | Contrast Limited Adaptive Histogram Equalization | Low contrast documents |
| `deskew` | Automatic skew correction | Scanned documents |
| `enhanceEdges` | Unsharp mask edge enhancement | Blurry or low-quality text |
| `normalize` | Histogram normalization | Inconsistent lighting |
| `perspectiveCorrection` | Basic perspective correction | Angled photos |

### Highlight Detection Options

| Option | Description | Values |
|--------|-------------|--------|
| `sensitivityLevel` | Detection sensitivity | `low`, `medium`, `high` |
| `targetColors` | Colors to detect | Array of color names |
| `enableTextExtraction` | Extract text from highlights | `true`/`false` |
| `useMLVerification` | ML-based region validation | `true`/`false` |

### OCR Options

| Option | Description | Values |
|--------|-------------|--------|
| `language` | Tesseract language | `eng`, `fra`, `deu`, etc. |
| `enableHandwritingDetection` | Handwriting analysis | `true`/`false` |

## Examples

### Example 1: Processing Highlighted Study Notes

```bash
# CLI
node bin/enhanced-ocr-cli.ts --highlight --edges --verbose study_notes.pdf

# API
curl -X POST http://localhost:3000/api/enhanced-ocr-complete \
  -F "file=@study_notes.pdf" \
  -F "optimizeHighlightedText=true" \
  -F "enhanceEdges=true"
```

### Example 2: Handwritten Documents

```bash
# CLI
node bin/enhanced-ocr-cli.ts --handwriting --normalize --clahe handwritten.jpg

# API
curl -X POST http://localhost:3000/api/enhanced-ocr-complete \
  -F "file=@handwritten.jpg" \
  -F "enableHandwritingDetection=true" \
  -F "normalize=true" \
  -F "applyCLAHE=true"
```

### Example 3: Low-Quality Scans

```bash
# CLI
node bin/enhanced-ocr-cli.ts --clahe --edges --normalize --perspective scan.tiff

# API
curl -X POST http://localhost:3000/api/enhanced-ocr-complete \
  -F "file=@scan.tiff" \
  -F "applyCLAHE=true" \
  -F "enhanceEdges=true" \
  -F "normalize=true" \
  -F "perspectiveCorrection=true"
```

### Example 4: Batch Processing Script

```bash
#!/bin/bash
for file in documents/*.pdf; do
  echo "Processing $file..."
  node bin/enhanced-ocr-cli.ts \
    --clahe --highlight --verbose \
    -i "$file" \
    -o "output/$(basename "$file" .pdf).txt"
done
```

### Example 5: TypeScript Service Integration

```typescript
import { EnhancedOCRService } from './lib/enhanced-ocr-service';

async function processDocuments(files: string[]) {
  const service = new EnhancedOCRService();
  const results = [];

  for (const file of files) {
    try {
      const result = await service.processDocument(file, {
        applyCLAHE: true,
        enhanceEdges: true,
        optimizeHighlightedText: true,
        enableHandwritingDetection: true
      });

      if (result.success) {
        console.log(`✅ ${file}: ${result.confidence}% confidence`);
        results.push({
          file,
          text: result.text,
          confidence: result.confidence,
          highlights: result.highlightedRegions?.length || 0
        });
      } else {
        console.error(`❌ ${file}: ${result.error}`);
      }
    } catch (error) {
      console.error(`💥 ${file}: ${error}`);
    }
  }

  service.cleanup();
  return results;
}
```

## Troubleshooting

### Common Issues

**1. "ImageMagick not found"**
```bash
sudo apt-get install imagemagick
# or on macOS:
brew install imagemagick
```

**2. "Tesseract not found"**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-eng
# or on macOS:
brew install tesseract
```

**3. "Permission denied" for CLI**
```bash
chmod +x bin/enhanced-ocr-cli.ts
```

**4. "File too large" error**
- Maximum file size is 50MB
- Compress images or split large PDFs

**5. Low OCR confidence scores**
- Try different preprocessing options
- Check image quality and resolution
- Ensure proper language setting
- Use highlight detection for emphasized text

### Performance Optimization

**1. For large files:**
- Enable only necessary preprocessing
- Use appropriate PSM modes
- Consider splitting into smaller chunks

**2. For batch processing:**
- Reuse service instances
- Process files in parallel (with caution)
- Monitor memory usage

**3. For real-time processing:**
- Disable expensive operations like perspective correction
- Use faster preprocessing options
- Cache preprocessing results

### Debugging

**Enable verbose logging:**
```bash
# CLI
node bin/enhanced-ocr-cli.ts --verbose document.pdf

# Set environment variable
DEBUG=enhanced-ocr npm start
```

**Check preprocessing results:**
- Enhanced images are saved in temporary directories
- Use `--verbose` to see intermediate file paths
- Examine preprocessing operations in response

**Validate dependencies:**
```bash
# Test ImageMagick
convert -version

# Test Tesseract
tesseract --version

# Test Node.js
node --version
```

## Support and Contributing

For issues, feature requests, or contributions:

1. Check existing documentation
2. Review test cases in `/tests`
3. Run diagnostic scripts
4. Submit detailed bug reports with:
   - Input file examples
   - Configuration used
   - Expected vs actual results
   - System information

## Performance Metrics

Typical processing times (on modern hardware):

- **Single page PDF**: 1-3 seconds
- **High-res image**: 2-5 seconds  
- **With highlight detection**: +1-2 seconds
- **With handwriting detection**: +2-4 seconds
- **Full preprocessing**: +1-3 seconds

Memory usage:
- **Base processing**: 50-100MB
- **Large images**: 200-500MB
- **Batch processing**: Scales with file count

## Version History

- **v1.0.0**: Initial enhanced OCR implementation
- Comprehensive preprocessing pipeline
- Multi-method highlight detection
- Intelligent PSM selection
- Complete API and CLI interfaces
- Full test coverage
