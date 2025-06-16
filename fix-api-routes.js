const fs = require('fs');
const path = require('path');

// Find all API route files
function findApiRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findApiRoutes(filePath, fileList);
    } else if (file === 'route.js' || file === 'route.ts') {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Fix a single API route file
function fixApiRouteFile(filePath) {
  console.log(`Checking API route: ${filePath}`);
  
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Create a backup
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content);
    console.log(`Created backup: ${backupPath}`);
  }
  
  // Check if it already has the import
  if (!content.includes('safe-response-handler')) {
    // Add the import
    const importRegex = /(import[^;]*;\n)+/;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const imports = importMatch[0];
      content = content.replace(imports, imports + "import { createSafeJsonResponse } from '@/app/api/safe-response-handler';\n");
      console.log(`Added import to ${filePath}`);
    }
  }
  
  // Replace Response creation with createSafeJsonResponse
  const responseRegex = /new Response\(JSON\.stringify\(([^)]+)\)(,\s*{\s*status:\s*(\d+),\s*headers:[^}]+})?\)/g;
  let match;
  let modified = false;
  
  let newContent = content;
  while ((match = responseRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const dataArg = match[1];
    const optionsArg = match[2];
    const statusCode = match[3] || '200';
    
    // Only replace if it's a JSON response
    if (fullMatch.includes('application/json')) {
      const replacement = `createSafeJsonResponse(${dataArg}${statusCode !== '200' ? `, ${statusCode}` : ''})`;
      newContent = newContent.replace(fullMatch, replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated API route: ${filePath}`);
    return true;
  } else {
    console.log(`No changes needed for: ${filePath}`);
    return false;
  }
}

// Find and fix all API routes
const apiRoutesDir = path.join(__dirname, 'app', 'api');
if (fs.existsSync(apiRoutesDir)) {
  const apiRoutes = findApiRoutes(apiRoutesDir);
  console.log(`Found ${apiRoutes.length} API routes to check`);
  
  let fixedCount = 0;
  for (const route of apiRoutes) {
    if (fixApiRouteFile(route)) {
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} API routes`);
} else {
  console.error(`API routes directory not found: ${apiRoutesDir}`);
}
