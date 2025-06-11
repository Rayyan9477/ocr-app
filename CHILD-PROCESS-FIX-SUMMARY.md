# OCR Application Fix for Child Process Module

## Problem Summary

The Next.js application was encountering errors with `child_process` imports:

```
Module not found: Can't resolve 'child_process'
```

## Root Causes

1. **Architecture Issue**: Node.js modules being imported in client components
2. **Autoprefixer Resolution**: Issues with CSS processing dependencies

## Implemented Solution

### 1. Server-Side Only APIs

We've created a proper separation of concerns:

- **Server-Side Code**: Handles Node.js operations in API routes
- **Client-Side Code**: Uses API endpoints to access server functionality

### 2. API Routes for Node.js Operations

New API routes handle all operations requiring Node.js modules:

- `/api/command`: Execute shell commands
- `/api/process-image`: Process images with imagemagick
- `/api/run-ocr`: Run OCR-specific commands

### 3. Client API Wrapper

A client API wrapper provides a clean interface for components:

```javascript
// Instead of:
import { exec } from 'child_process'; // ERROR

// Use:
import { executeCommand } from '@/lib/client-api';
```

## Usage Instructions

1. **Add Node.js Operations to Server Utils**:
   - Edit `/app/api/_utils/server-actions.js`
   
2. **Create API Endpoints**:
   - Add routes in `/app/api/`
   
3. **Use the Client API Wrapper**:
   - Import from `/lib/client-api.js`

## Testing

Test your changes by:

```bash
# Start both Next.js and API server
npm run dev:all
```

## Known Issues

If you're still seeing CSS processing errors:

1. Try using simplified CSS instead of Tailwind
2. Check that all required dependencies are properly installed
3. Make sure the PostCSS configuration is correct

## Questions?

Refer to the more detailed guides:
- `SERVER_OPERATIONS_GUIDE.md`
- `OCR-NEXT-IMPLEMENTATION.md`
