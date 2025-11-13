# Project Structure

## Overview

This document describes the clean, organized structure of the Simple OCR application following best practices and conventions.

---

## Directory Structure

```
ocr-app/
├── app/                      # Next.js App Directory (Pages & API Routes)
│   ├── api/                  # API Routes
│   │   ├── simple-ocr/       # Main OCR endpoint
│   │   ├── auth/             # Authentication endpoints
│   │   ├── download/         # File download endpoints
│   │   ├── health/           # Health check endpoint
│   │   ├── status/           # System status endpoint
│   │   └── check-dependencies/ # Dependency verification
│   ├── auth/                 # Authentication pages
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   ├── middleware.ts         # Next.js middleware
│   └── not-found.tsx         # 404 page
│
├── components/               # React Components
│   ├── ui/                   # Radix UI components
│   └── ...                   # Custom components
│
├── lib/                      # Core Business Logic
│   ├── simple-ocr-service.ts    # ✨ Main OCR service
│   ├── simple-ocr-config.ts     # ✨ OCR configuration loader
│   ├── logger.ts                # Logging utility
│   ├── initialize-dirs.ts       # Directory initialization
│   └── utils.ts                 # General utilities
│
├── config/                   # Configuration Files
│   └── simple-ocr-config.json   # ✨ OCR settings
│
├── __tests__/                # Test Files
│   ├── simple-ocr-service.test.ts  # ✨ Service tests
│   └── api/
│       └── simple-ocr.test.ts      # ✨ API tests
│
├── .github/                  # GitHub Configuration
│   └── workflows/
│       ├── ci-cd.yml            # ✨ CI/CD pipeline
│       └── azure-deploy.yml     # (Legacy - can be removed)
│
├── docs/                     # Documentation
│   └── archive/              # Archived old documentation
│
├── infrastructure/           # Infrastructure as Code
│   └── docker/
│       ├── Dockerfile            # Docker configuration
│       └── docker-compose.yml    # Docker Compose setup
│
├── public/                   # Static Assets
│   └── ...                   # Images, fonts, etc.
│
├── styles/                   # Additional Styles
│   └── ...                   # CSS modules, etc.
│
├── uploads/                  # Uploaded Files (gitignored)
├── processed/                # Processed Files (gitignored)
│
├── .env.local                # Environment Variables (gitignored)
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore rules
├── components.json           # Shadcn UI configuration
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose file
├── jest.setup.js             # Jest setup
├── next.config.mjs           # Next.js configuration
├── package.json              # ✨ NPM dependencies
├── postcss.config.mjs        # PostCSS configuration
├── README.md                 # ✨ Main documentation
├── server.js                 # Custom server (optional)
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── SIMPLE_SETUP.md           # ✨ Setup guide
├── MIGRATION_GUIDE.md        # ✨ Migration guide
├── VERCEL_DEPLOYMENT.md      # ✨ Vercel deployment guide
└── PROJECT_STRUCTURE.md      # This file

✨ = Key files for Simple OCR functionality
```

---

## Key Files Explained

### Core OCR Files

#### `/lib/simple-ocr-service.ts`
**Purpose:** Main OCR service using tesseract.js and pdf-lib
**Features:**
- Cross-platform OCR processing
- PDF and image support
- Image preprocessing
- Confidence scoring

#### `/lib/simple-ocr-config.ts`
**Purpose:** Configuration loader
**Features:**
- Load OCR settings from JSON
- Default fallback configuration
- Type-safe configuration

#### `/app/api/simple-ocr/route.ts`
**Purpose:** Main OCR API endpoint
**Methods:**
- `POST` - Process OCR requests
- `GET` - API documentation
- `OPTIONS` - CORS support

#### `/config/simple-ocr-config.json`
**Purpose:** OCR configuration settings
**Contains:**
- Default language settings
- Processing options
- Performance tuning

---

## File Naming Conventions

### TypeScript Files
- **Services:** `kebab-case-service.ts`
  - Example: `simple-ocr-service.ts`
- **Utilities:** `kebab-case.ts`
  - Example: `logger.ts`, `utils.ts`
- **React Components:** `PascalCase.tsx`
  - Example: `HomePage.tsx`, `Button.tsx`
- **API Routes:** `route.ts` (Next.js convention)
  - Located in `app/api/[endpoint]/route.ts`

### Test Files
- **Unit Tests:** `[filename].test.ts`
  - Example: `simple-ocr-service.test.ts`
- **Integration Tests:** `[feature].integration.test.ts`
  - Example: `ocr-workflow.integration.test.ts`

### Configuration Files
- **JSON Config:** `kebab-case-config.json`
  - Example: `simple-ocr-config.json`
- **Environment:** `.env.local`, `.env.production`
- **TypeScript Config:** `tsconfig.json`
- **Build Config:** `next.config.mjs`, `tailwind.config.ts`

### Documentation
- **Markdown:** `SCREAMING_SNAKE_CASE.md` or `Title Case.md`
  - Example: `README.md`, `SIMPLE_SETUP.md`
  - User guides: `Title Case.md`

---

## Directory Organization Principles

### 1. **Separation of Concerns**
```
/app     → Pages & Routes (UI Layer)
/lib     → Business Logic (Service Layer)
/config  → Configuration (Settings)
```

### 2. **Feature-Based Structure**
```
/app/api/simple-ocr/    → OCR feature
/app/api/auth/          → Auth feature
```

### 3. **Shared Resources**
```
/components → Reusable UI components
/lib        → Reusable services/utilities
```

### 4. **Configuration Centralization**
```
/config              → App-specific configs
/.env.local          → Environment variables
/next.config.mjs     → Framework config
```

---

## Best Practices Followed

### ✅ Code Organization
- Clear separation of concerns
- Single Responsibility Principle
- DRY (Don't Repeat Yourself)
- Minimal dependencies

### ✅ Naming Conventions
- Descriptive, meaningful names
- Consistent casing (kebab-case for files, PascalCase for components)
- Clear prefixes (`simple-ocr-` for OCR-related files)

### ✅ Project Structure
- Flat structure when possible
- Nested only when necessary
- Clear feature boundaries
- Logical grouping

### ✅ Documentation
- README for quick start
- Detailed setup guides
- API documentation
- Code comments for complex logic

### ✅ Testing
- Unit tests for services
- Integration tests for APIs
- Clear test organization
- Good code coverage

### ✅ Configuration
- Environment-based settings
- Centralized configuration
- Type-safe configs
- Sensible defaults

---

## Clean Architecture Layers

```
┌─────────────────────────────────────┐
│   Presentation Layer (app/)         │
│   - Pages                           │
│   - API Routes                      │
│   - Components                      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Business Logic Layer (lib/)       │
│   - Services                        │
│   - Domain Logic                    │
│   - Utilities                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Data Layer                        │
│   - File System                     │
│   - External APIs                   │
│   - Configuration                   │
└─────────────────────────────────────┘
```

---

## Dependency Flow

```
app/page.tsx
    ↓
app/api/simple-ocr/route.ts
    ↓
lib/simple-ocr-service.ts
    ↓
lib/simple-ocr-config.ts
    ↓
config/simple-ocr-config.json
```

**Rule:** Dependencies flow downward, never upward or circular.

---

## Environment-Specific Files

### Development
```
.env.local          → Local development variables
uploads/            → Local test files
processed/          → Local output files
```

### Production
```
.env.production     → Production variables
Vercel Environment  → Cloud configuration
```

---

## Git Ignored Files

```
node_modules/       → NPM packages
.next/              → Next.js build output
.env.local          → Local environment variables
uploads/            → Uploaded files
processed/          → Processed files
coverage/           → Test coverage reports
*.log               → Log files
```

---

## Build Artifacts

```
.next/              → Next.js production build
out/                → Static export (if using next export)
dist/               → Custom build output
build/              → Alternative build directory
```

---

## Configuration Files Purpose

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `tsconfig.json` | TypeScript compiler settings |
| `next.config.mjs` | Next.js framework configuration |
| `tailwind.config.ts` | Tailwind CSS customization |
| `postcss.config.mjs` | PostCSS plugins |
| `.eslintrc.json` | Code linting rules |
| `jest.setup.js` | Test environment setup |
| `components.json` | Shadcn UI configuration |
| `docker-compose.yml` | Docker services |
| `Dockerfile` | Docker image build |
| `.gitignore` | Git exclusion rules |
| `.env.local` | Environment variables |

---

## API Route Structure

```
/app/api/
├── simple-ocr/route.ts      → POST /api/simple-ocr
├── health/route.ts          → GET /api/health
├── status/route.ts          → GET /api/status
├── auth/
│   ├── login/route.ts       → POST /api/auth/login
│   └── logout/route.ts      → POST /api/auth/logout
└── download/
    └── [filename]/route.ts  → GET /api/download/[filename]
```

---

## Code Style Guidelines

### TypeScript
```typescript
// Use explicit types
export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
}

// Use async/await
async function processFile(): Promise<OCRResult> {
  // ...
}

// Use descriptive names
const extractedText = await ocrService.process();
```

### File Organization
```typescript
// 1. Imports
import { something } from 'library';

// 2. Types/Interfaces
export interface MyInterface {}

// 3. Constants
const CONSTANT_VALUE = 'value';

// 4. Functions/Classes
export class MyClass {}

// 5. Exports
export default MyClass;
```

---

## Testing Structure

```
__tests__/
├── lib/
│   └── simple-ocr-service.test.ts    → Unit tests
├── api/
│   └── simple-ocr.test.ts            → API tests
└── integration/
    └── ocr-workflow.test.ts          → Integration tests
```

---

## Maintenance

### Regular Cleanup
- Remove unused dependencies
- Update outdated packages
- Archive old documentation
- Clean up commented code

### Performance Monitoring
- Monitor bundle size
- Track API response times
- Review error logs
- Check resource usage

### Security
- Update dependencies regularly
- Scan for vulnerabilities
- Review access controls
- Validate user inputs

---

## Future Enhancements

Potential structure additions:

```
/middleware/        → Custom middleware
/hooks/             → React hooks
/contexts/          → React contexts
/types/             → Shared TypeScript types
/constants/         → Application constants
/locales/           → i18n translations
```

---

## Summary

This structure follows:
- ✅ Next.js App Router conventions
- ✅ Clean Architecture principles
- ✅ Industry best practices
- ✅ Simplicity and maintainability

The codebase is now **clean, organized, and production-ready!**
