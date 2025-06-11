# OCR Application - Next.js Implementation

This application provides OCR (Optical Character Recognition) capabilities for processing PDF files and extracting text.

## Installation

```bash
# Install dependencies
npm install

# Setup required dependencies
npm run setup-deps
```

## Running the Application

```bash
# Run the development server with API support
npm run dev:all

# Or run separately:
# Frontend only
npm run dev

# API server only
npm run api:dev
```

## Architecture

This application uses a hybrid architecture:

1. **Next.js Frontend**: Handles the user interface and client-side logic
2. **API Routes**: Server-side processing for OCR operations that require Node.js modules

## Key Components

- **Client API Utilities**: Located in `/lib/client-api.js`, these functions allow client components to interact with server-side functionality
- **Server Actions**: Located in `/app/api/_utils/server-actions.js`, these functions handle Node.js operations safely on the server
- **API Routes**: Located in `/app/api/`, these endpoints expose server functionality to the client

## File Structure

```
/app                  # Next.js App Router
  /api                # API Routes for server-side operations
    /_utils           # Utilities for API routes
  /...                # Other app routes
/components           # UI Components
/lib                  # Shared utilities and functions
  /client-api.js      # Client-side API wrapper for server operations
  /server-utils.ts    # Server-side utilities (use only in server components)
```

## Best Practices

### Working with Node.js Modules

Node.js built-in modules like `child_process`, `fs`, and `util` can only be used in:
- API Routes (`/app/api/*`)
- Server Components (not marked with 'use client')
- Server Actions (marked with 'use server')

Never import these modules in client components.

### Example: Running a Command

```typescript
// Client component
import { executeCommand } from '@/lib/client-api';

async function runLsCommand() {
  const result = await executeCommand('ls -la');
  console.log(result.stdout);
}
```

### Example: Processing an Image

```typescript
// Client component
import { processImageClient } from '@/lib/client-api';

async function getImageDimensions(filePath) {
  const result = await processImageClient(filePath);
  console.log(`Image dimensions: ${result.width}x${result.height}`);
}
```

## Troubleshooting

If you encounter errors about "Module not found: Can't resolve 'child_process'", it likely means:
1. You're importing a Node.js module in a client component
2. You need to move that functionality to an API route

See the `SERVER_OPERATIONS_GUIDE.md` for more detailed instructions on fixing these errors.
