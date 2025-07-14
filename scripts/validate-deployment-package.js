#!/usr/bin/env node
/**
 * validate-deployment-package.js
 * 
 * This script validates the deployment package structure to ensure it meets 
 * the requirements for Azure App Service deployment.
 * 
 * Usage: node validate-deployment-package.js <deployment-directory>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if a directory path was provided
const deploymentDir = process.argv[2];
if (!deploymentDir) {
  console.error('❌ Error: No deployment directory specified');
  console.error('Usage: node validate-deployment-package.js <deployment-directory>');
  process.exit(1);
}

// Ensure the deployment directory exists
if (!fs.existsSync(deploymentDir)) {
  console.error(`❌ Error: Directory ${deploymentDir} does not exist`);
  process.exit(1);
}

console.log(`🔍 Validating deployment package: ${deploymentDir}\n`);

// Essential files that must exist in the deployment package
const essentialFiles = [
  'server.js',
  'web.config',
  'package.json'
];

// Important files that should exist but are not critical
const importantFiles = [
  'iisnode.yml',
  'startup.sh',
  '.env.production'
];

// Directories that should exist
const expectedDirs = [
  'public',
  'logs',
  'uploads',
  'processed',
  'output',
  'tmp',
  'audit_logs',
  'secure_storage'
];

// Files that should not be in the deployment package
const unwantedFiles = [
  '.git',
  '.github',
  '.vscode',
  '__tests__',
  'test',
  'tests',
  'docs',
  'Dockerfile',
  'docker-compose.yml',
  'tsconfig.json',
  'jest.config.js',
  'cypress.json'
];

// Check essential files
console.log('=== Essential Files ===');
let missingEssentialFiles = false;
essentialFiles.forEach(file => {
  const filePath = path.join(deploymentDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING!`);
    missingEssentialFiles = true;
  }
});

if (missingEssentialFiles) {
  console.error('\n⚠️ Warning: Missing essential files. Deployment may fail!');
} else {
  console.log('\n✅ All essential files present');
}

// Check important files
console.log('\n=== Important Files ===');
importantFiles.forEach(file => {
  const filePath = path.join(deploymentDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️ ${file} - missing, but not critical`);
  }
});

// Check expected directories
console.log('\n=== Expected Directories ===');
expectedDirs.forEach(dir => {
  const dirPath = path.join(deploymentDir, dir);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`⚠️ ${dir}/ - missing, will create at runtime`);
  }
});

// Check for unwanted files
console.log('\n=== Unwanted Files Check ===');
let hasUnwantedFiles = false;
unwantedFiles.forEach(file => {
  const filePath = path.join(deploymentDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`❌ ${file} - should be removed`);
    hasUnwantedFiles = true;
  } else {
    console.log(`✅ ${file} - not present (good)`);
  }
});

if (hasUnwantedFiles) {
  console.log('\n⚠️ Some unwanted files are present. Consider removing them to optimize the deployment.');
} else {
  console.log('\n✅ No unwanted files detected');
}

// Check web.config
console.log('\n=== Web.config Validation ===');
const webConfigPath = path.join(deploymentDir, 'web.config');
if (fs.existsSync(webConfigPath)) {
  try {
    const webConfigContent = fs.readFileSync(webConfigPath, 'utf8');
    // Check for common issues in web.config
    const issues = [];
    
    if (!webConfigContent.includes('<add name="iisnode" path="server.js"')) {
      issues.push('- No handler for server.js found');
    }
    
    if (!webConfigContent.includes('<action type="Rewrite" url="server.js"')) {
      issues.push('- No rewrite rule for server.js found');
    }
    
    if (webConfigContent.includes('enableXFF="true"') && webConfigContent.includes('enableForwardedFor="true"')) {
      issues.push('- Duplicate XFF configuration found');
    }
    
    if (issues.length > 0) {
      console.log(`⚠️ web.config has potential issues:`);
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ web.config appears to be correctly configured');
    }
  } catch (error) {
    console.error(`❌ Error reading web.config: ${error.message}`);
  }
}

// Check package size
console.log('\n=== Package Size Analysis ===');
try {
  // Calculate the total size of the deployment package
  const totalSize = execSync(`du -sh "${deploymentDir}" | cut -f1`).toString().trim();
  console.log(`Total package size: ${totalSize}`);
  
  // Check specific subdirectories
  const dirs = ['.next', 'node_modules', 'public'];
  dirs.forEach(dir => {
    const dirPath = path.join(deploymentDir, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      try {
        const dirSize = execSync(`du -sh "${dirPath}" | cut -f1`).toString().trim();
        console.log(`${dir}/ size: ${dirSize}`);
      } catch (error) {
        console.log(`Unable to calculate size for ${dir}/`);
      }
    }
  });
} catch (error) {
  console.log('Unable to calculate package size');
}

// Final assessment
console.log('\n=== Final Assessment ===');
if (missingEssentialFiles) {
  console.log('❌ CRITICAL ISSUES FOUND: Missing essential files. Deployment will likely fail!');
  process.exit(1);
} else if (hasUnwantedFiles) {
  console.log('⚠️ WARNINGS: Package contains unnecessary files but should deploy successfully.');
  process.exit(0);
} else {
  console.log('✅ SUCCESS: Deployment package appears to be correctly configured.');
  process.exit(0);
}
