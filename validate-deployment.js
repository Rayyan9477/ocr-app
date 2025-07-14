#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Validating deployment setup...\n');

const checks = [
  {
    name: 'server.js exists and is not empty',
    check: () => {
      if (!fs.existsSync('server.js')) return false;
      const content = fs.readFileSync('server.js', 'utf8');
      return content.trim().length > 0;
    }
  },
  {
    name: 'package.json has correct start script',
    check: () => {
      if (!fs.existsSync('package.json')) return false;
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.scripts && pkg.scripts.start === 'node server.js';
    }
  },
  {
    name: 'web.config exists',
    check: () => fs.existsSync('web.config')
  },
  {
    name: 'next.config.mjs has standalone output',
    check: () => {
      if (!fs.existsSync('next.config.mjs')) return false;
      const content = fs.readFileSync('next.config.mjs', 'utf8');
      return content.includes("output: 'standalone'");
    }
  },
  {
    name: '.deployment file exists',
    check: () => fs.existsSync('.deployment')
  }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
  const passed = check();
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed) allPassed = false;
});

console.log(`\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed. Please fix the issues above.'}`);

if (allPassed) {
  console.log('\n📝 Deployment recommendations:');
  console.log('1. Ensure your Azure App Service is configured for Node.js 20.x');
  console.log('2. Set the startup command to: node server.js');
  console.log('3. Configure environment variables in Azure portal');
  console.log('4. Monitor logs after deployment for any runtime errors');
}

process.exit(allPassed ? 0 : 1);
