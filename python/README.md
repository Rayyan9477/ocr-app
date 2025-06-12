# Enhanced NanoVLM OCR System

## Overview

This is an enhanced version of the NanoVLM OCR (Optical Character Recognition) system, featuring:

- Robust error handling for edge cases
- Multi-stage fallback strategies
- Automatic retry mechanisms
- Advanced preprocessing techniques
- Comprehensive validation and reporting

This system is designed to provide reliable OCR capabilities even in challenging scenarios, such as poor image quality, handwritten text, complex layouts, and various document types.

## Key Features

### Error Handling

- Specialized error types for better error classification
- Detailed error messages with context
- Automatic error recovery strategies
- Proper error logging and reporting

### Fallback Strategies

- Automatic fallback to alternative OCR engines
- Multi-stage processing pipeline
- Best-effort result selection
- Fallback chain customization

### Preprocessing Enhancements

- Document type-specific preprocessing
- Automatic image quality enhancement
- Denoising and deskewing capabilities
- Resolution enhancement for poor quality images

### Performance Metrics

- Success rate tracking
- Processing time measurements
- Fallback effectiveness metrics
- Quality assessment

## Architecture

The system consists of the following components:

1. **NanoVLMProcessor**: Main OCR processor with retry logic and primary OCR capabilities
2. **FallbackOCR**: Alternative OCR engine using Tesseract for fallback processing
3. **FallbackChain**: Manages and executes multiple OCR strategies
4. **Smart OCR CLI**: Command-line interface for batch processing and advanced features

## Installation

### Prerequisites

- Python 3.6+
- PIL/Pillow
- OpenCV
- Tesseract OCR (for fallback functionality)
- NumPy

### Setup

1. Install required packages:

```bash
pip install pillow opencv-python numpy pytesseract
```

2. Install Tesseract OCR (for fallback functionality):

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download and install from https://github.com/UB-Mannheim/tesseract/wiki
```

## Usage

### Command-line Interface

The system provides a comprehensive command-line interface via `smart_ocr.py`:

```bash
python3 smart_ocr.py --input <input_files> [options]
```

Options:
- `--input`: Input files, directories, or glob patterns
- `--output_dir`: Output directory for results
- `--document_type`: Document type (auto, general, handwritten, table, poor_quality)
- `--confidence_threshold`: Minimum confidence threshold (0.0-1.0)
- `--enhance_resolution`: Enable resolution enhancement
- `--preserve_layout`: Preserve document layout
- `--max_retries`: Maximum retry attempts
- `--disable_fallback`: Disable fallback OCR engine
- `--advanced`: Use advanced processing with fallback chain
- `--report_metrics`: Report processing metrics
- `--error_report`: Generate JSON error report
- `--log_level`: Logging level (DEBUG, INFO, WARNING, ERROR)

### API Usage

The system can also be used as a library:

```python
from nanovlm import NanoVLMProcessor

# Create processor
processor = NanoVLMProcessor(
    max_retries=2,
    enable_fallback=True
)

# Process a document
result = processor.process_document(
    "/path/to/document.png",
    document_type="general",
    confidence_threshold=0.7,
    enhance_resolution=True,
    preserve_layout=True
)

# Access results
if result['success']:
    print(f"Extracted text: {result['text']}")
    print(f"Confidence: {result['confidence']}")
else:
    print(f"Error: {result['error']}")
```

## Testing

The system includes test scripts to verify functionality:

```bash
# Generate test images
python3 create_test_images.py

# Run test script
./test_enhanced_ocr.sh
```

## Documentation

See the following documentation files for more details:

- `ROBUST-OCR-DOCUMENTATION.md`: Detailed explanation of the robust OCR system
- `OCR-FALLBACK-HANDLER-README.md`: Information about the fallback mechanisms

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- NanoVLM OCR core engine
- Tesseract OCR for fallback processing
- OpenCV for image preprocessing
