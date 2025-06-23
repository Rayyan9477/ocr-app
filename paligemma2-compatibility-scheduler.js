#!/usr/bin/env node
/**
 * PaliGemma2 Compatibility Check Scheduler
 * 
 * This script sets up a cron-like scheduler to periodically check for 
 * transformers.js compatibility updates. It runs in the background
 * and logs its findings.
 */

import { compatibilityMonitor } from './lib/paligemma2-compatibility-monitor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const LOG_FILE = path.join(__dirname, 'paligemma2-compatibility-check.log');
const STATUS_FILE = path.join(__dirname, 'paligemma2-compatibility-status.json');

/**
 * Log a message to the console and log file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(message);
  
  // Log to file
  fs.appendFileSync(LOG_FILE, logMessage);
}

/**
 * Check for compatibility updates
 */
async function checkCompatibility() {
  log('🔍 Checking for PaliGemma2 compatibility updates...');
  
  try {
    // Check compatibility
    const status = await compatibilityMonitor.checkCompatibility();
    
    // Save status to file
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    
    // Log status
    log(`📊 Compatibility Status:`);
    log(`• Installed Version: ${status.installedVersion}`);
    log(`• Latest Version: ${status.latestVersion}`);
    log(`• Is Compatible: ${status.isCompatible ? '✅ Yes' : '❌ No'}`);
    log(`• Processor-Only Mode: ${status.processorOnlyMode ? '⚠️ Yes' : '✅ No'}`);
    log(`• Available Upgrade: ${status.availableUpgrade ? '✅ Yes' : '❌ No'}`);
    
    if (status.availableUpgrade) {
      log(`📢 Upgrade Available: ${status.upgradeInstructions}`);
      
      // If a compatible version is available, alert
      if (!status.processorOnlyMode) {
        log(`🎉 A compatible version of transformers.js is available!`);
        log(`🔄 Run the upgrade script to get full PaliGemma2 functionality.`);
      }
    }
    
    return status;
  } catch (error) {
    log(`❌ Error checking compatibility: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  log('🚀 Starting PaliGemma2 Compatibility Check Scheduler');
  log(`⏱️  Check Interval: ${CHECK_INTERVAL / (60 * 60 * 1000)} hours`);
  
  // Initial check
  await checkCompatibility();
  
  // Schedule periodic checks
  setInterval(async () => {
    log('⏰ Running scheduled compatibility check...');
    await checkCompatibility();
  }, CHECK_INTERVAL);
  
  log('✅ Scheduler running in background');
}

// Run the scheduler
main().catch(error => {
  log(`❌ Scheduler failed: ${error.message}`);
});
