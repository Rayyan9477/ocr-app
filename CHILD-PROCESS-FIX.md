# Next.js Child Process Module Fix

## Problem

The error `Module not found: Can't resolve 'child_process'` occurs because Next.js is a hybrid framework that runs both on the client (browser) and server. Node.js modules like `child_process`, `fs`, and `util` are only available on the server side.

## Solution

We've implemented a proper architecture to handle Node.js operations in a Next.js application:

1. **Server-Side Only**: Node.js modules are now only used in server components and API routes
2. **Client API Wrapper**: Client components use a wrapper API to communicate with server functions
3. **API Routes**: Server-side operations are exposed through API endpoints

## Implementation Details

### 1. Server-Side Utils (`/app/api/_utils/server-actions.js`)

```javascript
'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

// Promisified exec function
export const execAsync = promisify(exec);

// Server-side functions
export async function runCommand(command) {
  // Implementation...
}
```

### 2. Client API Wrapper (`/lib/client-api.js`)

```javascript
'use client';

// Client-side API wrapper
export async function executeCommand(command) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  
  return await response.json();
}
```

### 3. API Routes (`/app/api/command/route.js`)

```javascript
import { runCommand } from '../_utils/server-actions';

export async function POST(request) {
  const { command } = await request.json();
  const result = await runCommand(command);
  return Response.json({ success: true, ...result });
}
```

## How to Use

If you need to use Node.js modules in your application:

1. **Don't** import them directly in client components
2. Use the client API wrapper functions instead:

```javascript
// Client component
import { executeCommand } from '@/lib/client-api';

// Use this
async function doSomething() {
  const result = await executeCommand('ls -la');
  console.log(result.stdout);
}

// NOT this
// import { exec } from 'child_process'; // This will cause errors
```

## Configuration Changes

We've also:

1. Removed `"type": "module"` from package.json
2. Updated postcss.config.js to use CommonJS format
3. Added proper webpack fallbacks for Node.js modules
4. Fixed CSS processing configuration

## Testing Your Changes

Run the application with:

```bash
npm run dev:all
```

This will start both the Next.js application and the API server that handles Node.js operations.
