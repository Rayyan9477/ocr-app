# OCR Application

## Convert PDFs to Searchable & Copyable Format

A simple, cross-platform OCR application that works on **Windows, Mac, and Linux** without any system dependencies!

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Tesseract.js](https://img.shields.io/badge/Tesseract.js-6.0.1-orange?style=flat-square)](https://tesseract.projectnaptha.com/)

---

## ⚡ Quick Start

### Prerequisites

- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))

That's it! No Python, no Tesseract CLI, no Linux packages required!

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd ocr-app

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The application will start on `http://localhost:3000`

### Usage

```bash
# Process a PDF file
curl -X POST http://localhost:3000/api/simple-ocr \
  -F "file=@document.pdf" \
  -F "language=eng"
```

---

## 🎯 Features

✅ **Cross-Platform** - Works on Windows, Mac, and Linux
✅ **No System Dependencies** - Pure JavaScript implementation
✅ **PDF Processing** - Convert scanned PDFs to searchable text
✅ **Image Processing** - Extract text from images (PNG, JPG, TIFF, etc.)
✅ **Multi-Language** - Supports 100+ languages
✅ **Image Enhancement** - Auto-deskew, contrast enhancement, noise removal
✅ **Fast Setup** - Install and run in 5 minutes
✅ **REST API** - Easy integration with any application

---

## 📖 Documentation

- **[Simple Setup Guide](./SIMPLE_SETUP.md)** - Complete setup instructions
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Migrate from legacy setup
- **[API Documentation](#api-documentation)** - API reference

---

## 🚀 API Documentation

### Endpoint

```
POST /api/simple-ocr
```

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | *required* | PDF or image file to process |
| `language` | string | `eng` | OCR language (eng, fra, deu, spa, etc.) |
| `deskew` | boolean | `true` | Auto-rotate and straighten document |
| `enhanceContrast` | boolean | `true` | Enhance image contrast |
| `removeNoise` | boolean | `true` | Remove noise from images |

### Response Example

```json
{
  "success": true,
  "inputFile": "document.pdf",
  "text": "Extracted text content...",
  "confidence": 95.8,
  "processingTime": 2341,
  "pageCount": 3,
  "outputFile": "document_ocr.pdf"
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

[See full language list](https://github.com/naptha/tesseract.js#language-data)

### Supported File Formats

- **PDF** - `.pdf`
- **Images** - `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`, `.webp`

---

## 💡 Usage Examples

### JavaScript/Fetch

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
console.log(result.text);
```

### Python

```python
import requests

with open('document.pdf', 'rb') as f:
    files = {'file': f}
    data = {'language': 'eng', 'enhanceContrast': 'true'}

    response = requests.post('http://localhost:3000/api/simple-ocr',
                            files=files, data=data)
    result = response.json()
    print(result['text'])
```

### cURL

```bash
curl -X POST http://localhost:3000/api/simple-ocr \
  -F "file=@document.pdf" \
  -F "language=eng" \
  -F "enhanceContrast=true"
```

---

## 🔧 Configuration

Edit `config/simple-ocr-config.json`:

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

## 🐳 Docker Deployment (Optional)

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

## 🆚 Why This Approach?

### Before (Complex Setup)

❌ 18 system dependencies via apt-get
❌ Python + pip installation
❌ 6 shell scripts for setup
❌ Linux/WSL only
❌ 30-60 minute setup
❌ Multiple OCR engines (complex)

### After (Simple Setup)

✅ Node.js only
✅ No system packages
✅ No shell scripts
✅ Windows/Mac/Linux support
✅ < 5 minute setup
✅ Single OCR engine (simple)

---

## 📊 Performance

Typical processing times:

| Document Type | Pages | Time |
|--------------|-------|------|
| Single page PDF | 1 | ~2-3s |
| Standard document | 10 | ~15-20s |
| Large document | 50 | ~60-90s |
| High-res image | 1 | ~3-5s |

*Times may vary based on hardware and image quality*

---

## 🛠️ Development

### Run tests

```bash
npm test
```

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

---

## 🐛 Troubleshooting

### Out of memory errors

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Slow performance

- Reduce image density in config (300 → 150 DPI)
- Process smaller page ranges
- Ensure sufficient RAM available

### Low OCR accuracy

- Enable `enhanceContrast: true`
- Enable `removeNoise: true`
- Ensure source document is good quality
- Try different language settings

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For issues and questions:

1. Check [SIMPLE_SETUP.md](./SIMPLE_SETUP.md) documentation
2. Review [Troubleshooting](#troubleshooting) section
3. Search existing GitHub issues
4. Open a new issue with details

---

## 🌟 Star History

If you find this project helpful, please consider giving it a star!

---

**Made with ❤️ using Node.js, TypeScript, and Tesseract.js**
