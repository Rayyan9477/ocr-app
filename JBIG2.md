# JBIG2 Optimization Guide

## Overview

JBIG2 is an image compression standard designed for bi-level (black and white) images, making it perfect for scanned documents. When used with OCRmyPDF, it can significantly reduce the size of PDF files without sacrificing quality.

This guide explains how the OCR app uses JBIG2 optimization and how to ensure it's properly configured.

## Benefits of JBIG2

- **Smaller File Sizes**: JBIG2 can reduce PDF sizes by 30-80% compared to other compression methods
- **Text Sharpness**: Maintains sharp text in scanned documents
- **Optimization Quality**: Works well with OCRmyPDF's optimization pipeline

## Status in This Application

The OCR app automatically detects and uses JBIG2 when available. Here's how it works:

1. **Detection**: At startup, the app looks for jbig2 in the following locations:
   - The path specified in environment variable `JBIG2_PATH`
   - Local build in the workspace: `/workspaces/ocr-app/jbig2enc/src/jbig2`
   - Standard locations: `/usr/local/bin/jbig2` and `/usr/bin/jbig2`
   - System PATH

2. **Fallback**: If jbig2 is not found, the app will disable optimization to ensure processing still works, but file sizes may be larger.

3. **Reporting**: The app reports whether jbig2 was used in processing results and shows optimization metrics.

## Installation Options

If you see warnings about jbig2 not being found, you have several options:

### Option 1: Use the Included Build Script

```bash
cd /workspaces/ocr-app
./build-jbig2.sh
```

This script:
- Checks if jbig2 is already installed
- Verifies build dependencies
- Builds jbig2enc from the included source code
- Sets up the binary for use by the application

### Option 2: Install via Package Manager

On Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y jbig2enc
```

On CentOS/RHEL:
```bash
sudo yum install jbig2enc
```

### Option 3: Set Path to Existing Installation

If jbig2 is installed but not being detected, set the environment variable:

```bash
export JBIG2_PATH=/path/to/your/jbig2
```

Or update the configuration in `/workspaces/ocr-app/lib/config.ts`.

## Verifying JBIG2 Integration

To verify that JBIG2 is properly integrated and being used by the OCR application:

1. Check the terminal output during processing for JBIG2-related messages
2. Look for optimization metrics in the processing results
3. Compare file sizes of original vs. processed PDFs

## Troubleshooting

If you're having issues with JBIG2 optimization:

1. Run the check script to diagnose the problem:
   ```bash
   ./check-jbig2.sh
   ```

2. Check build dependencies if you're building from source:
   ```bash
   apt-get install -y build-essential libtool automake autoconf pkg-config libleptonica-dev
   ```

3. Verify the jbig2 binary works directly:
   ```bash
   /workspaces/ocr-app/jbig2enc/src/jbig2 --version
   ```

## Technical Details

The JBIG2 integration works by:

1. Dynamic path detection during app startup
2. Setting environment variables for OCRmyPDF to find the jbig2 executable
3. Fallback mechanisms to ensure processing works even if optimization is disabled

When properly configured, this results in significantly smaller output files while maintaining text quality.
