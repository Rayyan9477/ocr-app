# Node.js Module Usage in Next.js

When developing a Next.js application, it's important to understand the distinction between client-side and server-side code. Next.js uses a hybrid approach where some code runs on the server and some on the client.

## Key Guidelines

1. **Node.js Built-in Modules**: Modules like `fs`, `path`, `child_process`, and `util` only work on the server side.

2. **Server Components vs. Client Components**:
   - Server Components: Can use Node.js APIs directly
   - Client Components: Cannot use Node.js APIs (marked with `"use client"` directive)

3. **Where to Use Node.js Modules**:
   - API Routes (`/app/api/*`)
   - Server Components (any component without `"use client"`)
   - Server Actions (functions with `"use server"` directive)

4. **Server Utilities**:
   - All Node.js operations should be in `/lib/server-utils.ts`
   - Import server utilities only in server-side code

## Example - Correct Usage

```typescript
// In API route or server component
import { runCommand } from '@/lib/server-utils';

export async function GET() {
  const result = await runCommand('ls -la');
  return Response.json({ result });
}
```

## Common Errors

- "Module not found: Can't resolve 'child_process'" - You're trying to import a Node.js module in client-side code
- Fix: Move the functionality to a server component or API route

## Development Tips

1. Use the webpack config in next.config.mjs to handle Node.js module fallbacks
2. For operations requiring Node.js modules, create API endpoints and call them from client components
3. Consider using the App Router's Server Actions for seamless client-server integration
