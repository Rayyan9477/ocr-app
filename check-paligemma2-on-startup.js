/**
 * Check PaliGemma2 compatibility on server startup
 * This script runs when the server starts to check for compatibility updates
 */

import { compatibilityMonitor } from './lib/paligemma2-compatibility-monitor.js';
import { compatibilityNotification } from './lib/paligemma2-compatibility-notification.js';
import logger from './lib/logger.mjs';
import fs from 'fs';
import path from 'path';

// Constants
const STATUS_FILE = path.join(process.cwd(), 'paligemma2-compatibility-status.json');
const NOTIFICATION_FILE = path.join(process.cwd(), 'paligemma2-startup-notification.txt');

export async function checkPaliGemma2Compatibility() {
  try {
    logger.info('Checking PaliGemma2 compatibility...');
    
    // Check compatibility
    const status = await compatibilityMonitor.checkCompatibility();
    
    // Log status
    logger.info(`PaliGemma2 compatibility status: ${status.isCompatible ? 'Compatible' : 'Incompatible'}`);
    logger.info(`Running in ${status.processorOnlyMode ? 'processor-only' : 'full'} mode`);
    
    // Save status to file for other tools to use
    try {
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    } catch (writeError) {
      logger.warn(`Could not write compatibility status file: ${writeError.message}`);
    }
    
    if (status.availableUpgrade) {
      logger.info(`New version available: ${status.latestVersion} (current: ${status.installedVersion})`);
      
      // Create a notification file if in processor-only mode or if an upgrade is available
      if (status.processorOnlyMode || status.availableUpgrade) {
        let notification = '';
        
        if (status.processorOnlyMode && !status.isCompatible) {
          notification = `
╔════════════════════════════════════════════════════════════════════╗
║                      🚨 IMPORTANT NOTICE 🚨                         ║
╠════════════════════════════════════════════════════════════════════╣
║ PaliGemma2 is running in processor-only mode due to                 ║
║ transformers.js compatibility limitations.                          ║
║                                                                     ║
║ Current Version: ${status.installedVersion.padEnd(10)}                                   ║
║ Latest Version: ${status.latestVersion.padEnd(10)}                                    ║
║                                                                     ║
║ To upgrade and check compatibility:                                 ║
║ Run: ./check-and-upgrade-paligemma2.sh                              ║
╚════════════════════════════════════════════════════════════════════╝
`;
        } else if (status.availableUpgrade) {
          notification = `
╔════════════════════════════════════════════════════════════════════╗
║                     📢 UPGRADE AVAILABLE 📢                         ║
╠════════════════════════════════════════════════════════════════════╣
║ A newer version of transformers.js is available.                    ║
║                                                                     ║
║ Current Version: ${status.installedVersion.padEnd(10)}                                   ║
║ Latest Version: ${status.latestVersion.padEnd(10)}                                    ║
║                                                                     ║
║ To upgrade:                                                         ║
║ Run: ./check-and-upgrade-paligemma2.sh                              ║
╚════════════════════════════════════════════════════════════════════╝
`;
        }
        
        if (notification) {
          try {
            fs.writeFileSync(NOTIFICATION_FILE, notification);
            logger.info('Created PaliGemma2 notification file for system notification');
          } catch (notifyError) {
            logger.warn(`Could not write notification file: ${notifyError.message}`);
          }
        }
      }
    }
    
    // Check if notification should be shown
    const shouldNotify = await compatibilityNotification.shouldShowNotification();
    if (shouldNotify) {
      const message = await compatibilityNotification.getNotificationMessage();
      logger.info(`PaliGemma2 Notification: ${message}`);
      
      // You could also display this in the UI, send an email, etc.
    }
    
    return status;
  } catch (error) {
    logger.error(`Error checking PaliGemma2 compatibility: ${error}`);
    return null;
  }
}

// If this file is run directly (not imported), check compatibility
if (typeof require !== 'undefined' && require.main === module) {
  checkPaliGemma2Compatibility()
    .then(() => {
      logger.info('PaliGemma2 compatibility check complete');
    })
    .catch((error) => {
      logger.error(`Error: ${error}`);
    });
}

export default checkPaliGemma2Compatibility;
