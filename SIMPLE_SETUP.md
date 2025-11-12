# Simple OCR Setup Guide

## 🚀 Quick Start (Works on Windows, Mac, and Linux!)

This is the **simplified version** of the OCR app that requires **NO system dependencies**. Everything runs in pure JavaScript!

### Prerequisites

- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **npm** or **yarn** (comes with Node.js)

That's it! No Python, no Tesseract CLI, no ImageMagick, no complex setup!

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ocr-app
```

### 2. Install dependencies

```bash
npm install
```

This will automatically download all required JavaScript libraries including:
- `tesseract.js` - Pure JavaScript OCR engine
- `pdf-lib` - PDF manipulation library
- `sharp` - Image processing library
- All other dependencies

**No manual system packages needed!**

### 3. Start the development server

```bash
npm run dev
```

The application will start on `http://localhost:3000`

---

## 🎯 Using the Simple OCR API

### API Endpoint

```
POST /api/simple-ocr
```

### Example Usage

#### Using cURL

```bash
curl -X POST http://localhost:3000/api/simple-ocr \
  -F "file=@document.pdf" \
  -F "language=eng" \
  -F "enhanceContrast=true"
```

#### Using JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('language', 'eng');
formData.append('enhanceContrast', 'true');

const response = await fetch('/api/simple-ocr', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.text); // Extracted text
```

#### Using Python

```python
import requests

with open('document.pdf', 'rb') as f:
    files = {'file': f}
    data = {
        'language': 'eng',
        'enhanceContrast': 'true'
    }

    response = requests.post('http://localhost:3000/api/simple-ocr',
                            files=files, data=data)
    result = response.json()
    print(result['text'])
```

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | *required* | PDF or image file to process |
| `language` | string | `eng` | OCR language code (eng, fra, deu, spa, etc.) |
| `deskew` | boolean | `true` | Auto-rotate and straighten document |
| `enhanceContrast` | boolean | `true` | Enhance image contrast for better OCR |
| `removeNoise` | boolean | `true` | Remove noise from scanned images |

### Response Format

```json
{
  "success": true,
  "inputFile": "document.pdf",
  "text": "Extracted text content...",
  "confidence": 95.8,
  "processingTime": 2341,
  "pageCount": 3,
  "outputFile": "document_ocr.pdf",
  "message": "OCR processing completed successfully"
}
```

### Supported Languages

- `eng` - English
- `fra` - French
- `deu` - German
- `spa` - Spanish
- `por` - Portuguese
- `ita` - Italian
- `rus` - Russian
- `chi_sim` - Chinese (Simplified)
- `jpn` - Japanese
- `kor` - Korean

And many more! See the full list at [tesseract.js languages](https://github.com/naptha/tesseract.js#language-data).

---

## 📁 Supported File Formats

- **PDF** - `.pdf`
- **Images** - `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`, `.webp`

---

## 🔧 Configuration

Edit `config/simple-ocr-config.json` to customize:

```json
{
  "ocr": {
    "defaultLanguage": "eng",
    "defaultOptions": {
      "deskew": true,
      "enhanceContrast": true,
      "removeNoise": true
    },
    "processing": {
      "timeout": 300000,
      "imageDensity": 300
    }
  }
}
```

---

## 🚀 Production Deployment

### Build for production

```bash
npm run build
```

### Start production server

```bash
npm start
```

### Environment Variables

Create a `.env.local` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# File Size Limits
MAX_FILE_SIZE=52428800  # 50MB in bytes

# Processing
OCR_TIMEOUT=300000  # 5 minutes
```

---

## 🐳 Docker (Optional)

If you prefer Docker, here's a simple Dockerfile:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t simple-ocr .
docker run -p 3000:3000 simple-ocr
```

---

## 📊 Performance Tips

1. **Image Quality**: Higher resolution = better OCR accuracy but slower processing
2. **Language Data**: First run downloads language data (~2MB per language)
3. **Worker Reuse**: The Tesseract worker is reused across requests for better performance
4. **Concurrent Jobs**: Configure `maxConcurrentJobs` in config to limit parallel processing

---

## 🆚 Comparison: Simple OCR vs Legacy OCR

| Feature | Simple OCR | Legacy OCR |
|---------|------------|------------|
| **Setup Time** | < 5 minutes | 30-60 minutes |
| **System Dependencies** | **None** | 18+ packages (apt-get) |
| **Windows Support** | ✅ Yes | ❌ No (WSL only) |
| **Mac Support** | ✅ Yes | ⚠️ Partial |
| **Linux Support** | ✅ Yes | ✅ Yes |
| **Shell Scripts** | 0 | 6+ required |
| **Python Required** | ❌ No | ✅ Yes |
| **Configuration Files** | 1 simple JSON | 15+ files |
| **OCR Engines** | 1 (tesseract.js) | 4 overlapping |
| **Installation Steps** | 2 commands | 10+ manual steps |

---

## ❓ Troubleshooting

### Issue: "Module not found" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Out of memory during large PDF processing

**Solution:** Increase Node.js memory limit:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Issue: Slow OCR performance

**Solutions:**
- Reduce image density in config (e.g., from 300 to 150 DPI)
- Process smaller page ranges at a time
- Enable worker reuse in config (default: enabled)

### Issue: Low OCR accuracy

**Solutions:**
- Enable `enhanceContrast: true`
- Enable `removeNoise: true`
- Ensure source document is good quality
- Try different language combinations

---

## 📝 Migration from Legacy OCR

If you're migrating from the old complex setup:

1. **Old endpoint:** `/api/ocr` (requires Linux + system deps)
2. **New endpoint:** `/api/simple-ocr` (works everywhere)

Simply change your API endpoint and remove any system dependency installation steps!

### API Changes

**Old (complex):**
```bash
# Required Linux packages
apt-get install tesseract-ocr ghostscript imagemagick pdftk ...
# Required Python packages
pip install ocrmypdf

curl -X POST /api/ocr -F "file=@doc.pdf"
```

**New (simple):**
```bash
# No system dependencies needed!

curl -X POST /api/simple-ocr -F "file=@doc.pdf"
```

---

## 🎉 Benefits of Simple OCR

✅ **Cross-Platform** - Works on Windows, Mac, Linux
✅ **No System Dependencies** - Pure JavaScript
✅ **Fast Setup** - Install and run in 5 minutes
✅ **Easy Maintenance** - No shell scripts or system configs
✅ **Cloud-Ready** - Deploy anywhere Node.js runs
✅ **Developer-Friendly** - TypeScript with full type safety
✅ **Well-Documented** - Clear API and examples

---

## 📚 Additional Resources

- [Tesseract.js Documentation](https://github.com/naptha/tesseract.js)
- [PDF-lib Documentation](https://pdf-lib.js.org/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 🤝 Support

If you encounter any issues:

1. Check this documentation
2. Review the troubleshooting section
3. Check GitHub issues
4. Open a new issue with details

---

## 📄 License

[Your License Here]
