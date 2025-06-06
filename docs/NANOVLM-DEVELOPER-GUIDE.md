# NanoVLM OCR Integration - Developer Guide

## Overview

The NanoVLM OCR integration provides enhanced OCR capabilities with specialized handling for:
- Handwritten text
- Tables and structured documents
- Poor quality images
- Layout preservation

## Setup

1. **Install Dependencies**:
```bash
# Install Python dependencies
pip install -r python/requirements.txt

# Install Node.js dependencies
npm install
```

2. **Build the Project**:
```bash
npm run build:nanovlm
```

3. **Verify Installation**:
```bash
npm run verify:nanovlm
```

## Usage

### TypeScript/JavaScript

```typescript
import { NanoVLMService } from './lib/nano-vlm-service';

const nanovlm = new NanoVLMService();

// Process a document
const result = await nanovlm.processImage(
  'path/to/image.png',
  'output/directory',
  {
    documentType: 'handwritten',
    confidenceThreshold: 0.7,
    enhanceResolution: true,
    preserveLayout: true
  }
);

console.log(result.text);
console.log(`Confidence: ${result.confidence}`);
```

### Python

```python
from nanovlm.processor import NanoVLMProcessor

processor = NanoVLMProcessor('path/to/model')

# Process a document
result = processor.process_document(
    'path/to/image.png',
    document_type='handwritten',
    confidence_threshold=0.7,
    enhance_resolution=True,
    preserve_layout=True
)

print(result['text'])
print(f"Confidence: {result['confidence']}")
```

## Document Types

- **general**: Standard document processing
- **handwritten**: Optimized for handwritten text
- **table**: Enhanced table structure recognition
- **poor_quality**: Additional preprocessing for low-quality images

## Options

- **confidenceThreshold**: Minimum confidence level (0.0-1.0)
- **enhanceResolution**: Enable resolution enhancement
- **preserveLayout**: Maintain document layout structure

## Testing

Run the test suite:
```bash
# Run basic tests
npm run test:nanovlm

# Run comprehensive tests
npm run test:nanovlm:comprehensive
```

## Troubleshooting

1. **Model Not Found**
   - Ensure the model is downloaded: `npm run setup:nanovlm`
   - Check model directory permissions

2. **Low Confidence Scores**
   - Try increasing resolution enhancement
   - Adjust confidence threshold
   - Check input image quality

3. **Processing Errors**
   - Check logs in `python/nanovlm/logs/`
   - Verify Python environment
   - Ensure all dependencies are installed

## Logging

Logs are stored in `python/nanovlm/logs/` with the format `nanovlm_YYYYMMDD.log`.

Debug level logging can be enabled by setting the environment variable:
```bash
export NANOVLM_LOG_LEVEL=DEBUG
```

## Support

For issues and support:
1. Check the logs
2. Run verification: `npm run verify:nanovlm`
3. File an issue with:
   - Log output
   - Input document type
   - Processing options used
   - Expected vs actual results
