# OCR Application - Server-Side Operations Guide

## Overview

This document explains how to properly handle server-side operations in the OCR application, especially when dealing with Node.js built-in modules like `child_process`, `fs`, and `util`.

## Architecture

The application uses a hybrid approach:

1. **Next.js Frontend**: Handles UI and client-side logic
2. **Express API Server**: Handles Node.js operations that can't be performed in client components

## Running the Application

```bash
# Start both Next.js and the API server
npm run dev:all

# Or start them separately
npm run dev        # Next.js frontend
npm run api:dev    # API server
```

## Using Node.js Built-in Modules

### ❌ DON'T: Import Node.js modules in client components

```typescript
// This will cause build errors!
import { exec } from 'child_process';  // Error: Module not found
```

### ✅ DO: Use the server utilities in API routes

```typescript
// In app/api/some-route/route.ts
import { execAsync, serverLogger } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const { command } = await request.json();
    const result = await execAsync(command);
    return Response.json({ success: true, data: result });
  } catch (error) {
    serverLogger.error('Error executing command:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### ✅ DO: Call the API endpoints from client components

```typescript
// In a client component
"use client";

import { useState } from 'react';

export function CommandExecutor() {
  const [result, setResult] = useState('');
  
  async function runCommand(command: string) {
    try {
      const response = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      const data = await response.json();
      if (data.success) {
        setResult(data.stdout);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`Failed to execute: ${error.message}`);
    }
  }
  
  return (
    <div>
      <button onClick={() => runCommand('ls -la')}>Run Command</button>
      <pre>{result}</pre>
    </div>
  );
}
```

## Troubleshooting

If you encounter build errors related to Node.js modules:

1. Check if the module is being imported in a client component
2. Move the functionality to an API route
3. Call the API route from your client component

## Development Tips

- Use the `serverLogger` from `lib/server-utils.ts` for server-side logging
- All server-side utilities are in `lib/server-utils.ts` - import only in server components
- The webpack config in `next.config.mjs` has fallbacks for Node.js modules
