# OCR Service Setup Guide

This guide explains how to set up and configure the OCR service for offline use.

---

## Quick Start (Requires Internet)

If you have internet access, the OCR service will work automatically:

```bash
npm install
npm run dev
```

On the **first OCR request**, Tesseract.js will automatically download language training data (~4MB) from the internet. After that, it works offline.

---

## Offline Setup (Recommended for Production)

For production environments or offline use, pre-download the language training data:

### Step 1: Download Language Data

```bash
npm run setup:tessdata
```

This downloads language training files to `public/tessdata/`:
- `eng.traineddata.gz` (~4MB) - English language data
- Add more languages as needed

### Step 2: Update OCR Service Configuration

The setup script automatically creates `lib/tessdata-config.ts`. Import and use it in your OCR service:

```typescript
// lib/simple-ocr-service.ts
import { TESSDATA_CONFIG } from './tessdata-config';

// In getWorker() method:
this.worker = await createWorker(language, 1, {
  langPath: TESSDATA_CONFIG.langPath, // Use local files
  logger: (m) => {
    if (m.status === 'recognizing text') {
      logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
    }
  }
});
```

### Step 3: Verify Offline Functionality

Test that OCR works without internet:

1. Disable internet connection
2. Start the application
3. Upload a document for OCR processing
4. Verify it works correctly

---

## Supported Languages

Currently configured: **English (eng)**

### Adding More Languages

1. Edit `scripts/setup-tessdata.mjs`:
   ```javascript
   const LANGUAGES = ['eng', 'fra', 'deu', 'spa']; // Add language codes
   ```

2. Run setup again:
   ```bash
   npm run setup:tessdata
   ```

3. Use the language in your OCR request:
   ```bash
   curl -X POST -F "file=@document.pdf" -F "language=fra" \
     http://localhost:3000/api/simple-ocr
   ```

### Available Language Codes

Common language codes:
- `eng` - English
- `fra` - French
- `deu` - German
- `spa` - Spanish
- `ita` - Italian
- `por` - Portuguese
- `rus` - Russian
- `chi_sim` - Chinese (Simplified)
- `jpn` - Japanese
- `ara` - Arabic

[Full list of supported languages](https://tesseract-ocr.github.io/tessdoc/Data-Files#data-files-for-version-400-november-29-2016)

---

## Deployment Considerations

### Vercel/Netlify (Serverless)

**Issue:** Serverless functions may not persist downloaded files between invocations.

**Solution 1 - Bundle Language Data:**
1. Run `npm run setup:tessdata` before deployment
2. Commit `public/tessdata/` to your repository
3. Configure OCR service to use local files

**Solution 2 - Use CDN (Default):**
- Accept that first request per cold start will download language data
- Subsequent requests in same container will be fast

### Docker Deployment

Add to your Dockerfile:

```dockerfile
# Download language data during build
RUN npm run setup:tessdata

# Or manually download
RUN mkdir -p public/tessdata && \
    cd public/tessdata && \
    wget https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz
```

### Traditional Hosting

Run once during deployment:

```bash
npm run setup:tessdata
```

Language files persist on disk and work offline.

---

## Configuration Options

### Environment Variables

Configure OCR behavior in `.env.local`:

```bash
# OCR processing timeout (milliseconds)
OCR_TIMEOUT=600000

# Maximum file size (bytes)
MAX_FILE_SIZE=52428800

# Enable confidence tracking
ENABLE_CONFIDENCE_TRACKING=true

# Minimum acceptable confidence (0-100)
MIN_CONFIDENCE=70
```

### Tesseract.js Options

Advanced configuration in `lib/simple-ocr-service.ts`:

```typescript
await createWorker(language, 1, {
  langPath: '/tessdata',           // Local language files
  cacheMethod: 'write',             // Cache strategy
  logger: (m) => { /* ... */ },     // Progress logging
  errorHandler: (err) => { /* */ }, // Error handling
});
```

---

## Troubleshooting

### Problem: "fetch failed" error

**Cause:** Tesseract.js trying to download language data but no internet connection.

**Solution:**
1. Run `npm run setup:tessdata` with internet
2. Configure OCR service to use local files (see Step 2 above)

### Problem: OCR is slow

**Causes:**
- Large file size
- Complex document layout
- Multiple languages

**Solutions:**
- Reduce image resolution (600 DPI max recommended)
- Pre-process images (deskew, denoise)
- Use specific language instead of auto-detect
- Enable preprocessing options:
  ```bash
  curl -X POST -F "file=@doc.pdf" \
    -F "enhanceContrast=true" \
    -F "deskew=true" \
    http://localhost:3000/api/simple-ocr
  ```

### Problem: Low accuracy

**Solutions:**
- Ensure good quality input (300+ DPI)
- Use correct language setting
- Enable image preprocessing
- Check for correct orientation
- Avoid handwritten or stylized fonts

---

## API Reference

### POST /api/simple-ocr

Process a document with OCR.

**Request:**
```bash
curl -X POST http://localhost:3000/api/simple-ocr \
  -F "file=@document.pdf" \
  -F "language=eng" \
  -F "deskew=true" \
  -F "enhanceContrast=true"
```

**Parameters:**
- `file` (required) - PDF or image file
- `language` (optional) - Language code (default: 'eng')
- `deskew` (optional) - Auto-rotate text (default: false)
- `enhanceContrast` (optional) - Enhance image contrast (default: false)
- `removeNoise` (optional) - Remove image noise (default: false)

**Response:**
```json
{
  "success": true,
  "text": "Extracted text content...",
  "confidence": 95.5,
  "processingTime": 2341,
  "pageCount": 1,
  "message": "OCR processing completed successfully"
}
```

---

## Performance Optimization

### 1. Worker Reuse
The OCR service reuses the Tesseract worker across requests for better performance.

### 2. Image Preprocessing
Enable preprocessing for better accuracy and speed:
- `deskew`: Automatically correct image rotation
- `enhanceContrast`: Improve text visibility
- `removeNoise`: Clean up scan artifacts

### 3. Language Selection
Always specify the correct language instead of using auto-detection:
```bash
-F "language=eng"  # Much faster than auto-detect
```

### 4. Input Quality
- Use 300 DPI for scanned documents
- Convert color images to grayscale
- Ensure good lighting and contrast

---

## Support & Resources

- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [Tesseract OCR Best Practices](https://tesseract-ocr.github.io/tessdoc/)
- [Language Training Data](https://github.com/tesseract-ocr/tessdata)
- [Project README](./README.md)
- [Testing Report](./OCR_TESTING_REPORT.md)

---

**Last Updated:** November 14, 2025
