/**
 * PaliGemma2 Compatibility Notification System
 * 
 * This module checks for compatibility updates and notifies when a compatible version is available.
 */

import { compatibilityMonitor } from './paligemma2-compatibility-monitor';
import logger from './logger';
import fs from 'fs';
import path from 'path';

// Notification flags file
const NOTIFICATION_FLAGS_FILE = path.join(process.cwd(), 'paligemma2-notification-flags.json');

interface NotificationFlags {
  lastNotifiedVersion: string;
  suppressNotifications: boolean;
  lastNotificationTime: string;
  notificationCount: number;
}

/**
 * PaliGemma2 Compatibility Notification System
 */
export class PaliGemma2CompatibilityNotification {
  private flags: NotificationFlags;
  
  constructor() {
    this.flags = this.loadFlags();
  }
  
  /**
   * Load notification flags from file
   */
  private loadFlags(): NotificationFlags {
    try {
      if (fs.existsSync(NOTIFICATION_FLAGS_FILE)) {
        const data = fs.readFileSync(NOTIFICATION_FLAGS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn(`Error loading notification flags: ${error}`);
    }
    
    // Default flags if file doesn't exist or can't be parsed
    return {
      lastNotifiedVersion: '0.0.0',
      suppressNotifications: false,
      lastNotificationTime: new Date(0).toISOString(),
      notificationCount: 0
    };
  }
  
  /**
   * Save notification flags to file
   */
  private saveFlags(): void {
    try {
      fs.writeFileSync(NOTIFICATION_FLAGS_FILE, JSON.stringify(this.flags, null, 2));
    } catch (error) {
      logger.error(`Error saving notification flags: ${error}`);
    }
  }
  
  /**
   * Check if a notification should be shown
   */
  async shouldShowNotification(): Promise<boolean> {
    // Don't show notifications if suppressed
    if (this.flags.suppressNotifications) {
      return false;
    }
    
    // Check compatibility status
    const status = await compatibilityMonitor.checkCompatibility();
    
    // Show notification if:
    // 1. A compatible version is available, or
    // 2. An upgrade is available and we haven't notified about this version yet
    const shouldNotify = 
      (status.isCompatible && !this.flags.suppressNotifications) ||
      (status.availableUpgrade && status.latestVersion !== this.flags.lastNotifiedVersion);
    
    if (shouldNotify) {
      // Update notification flags
      this.flags.lastNotifiedVersion = status.latestVersion;
      this.flags.lastNotificationTime = new Date().toISOString();
      this.flags.notificationCount++;
      this.saveFlags();
    }
    
    return shouldNotify;
  }
  
  /**
   * Get notification message
   */
  async getNotificationMessage(): Promise<string> {
    const status = await compatibilityMonitor.checkCompatibility();
    
    if (status.isCompatible) {
      return `🎉 Good news! Transformers.js version ${status.installedVersion} supports PaliGemma2. ` +
        `Restart the server to use full functionality.`;
    } else if (status.availableUpgrade) {
      return `📦 A new version of transformers.js is available (${status.latestVersion}). ` +
        `This version may include improved PaliGemma2 support. ` +
        `Use the /api/paligemma2-compatibility endpoint to upgrade.`;
    } else {
      return `⚠️ PaliGemma2 is running in processor-only mode. ` +
        `Check /api/paligemma2-compatibility for more information.`;
    }
  }
  
  /**
   * Suppress notifications
   */
  suppressNotifications(suppress: boolean = true): void {
    this.flags.suppressNotifications = suppress;
    this.saveFlags();
  }
  
  /**
   * Reset notification flags
   */
  resetNotifications(): void {
    this.flags = {
      lastNotifiedVersion: '0.0.0',
      suppressNotifications: false,
      lastNotificationTime: new Date(0).toISOString(),
      notificationCount: 0
    };
    this.saveFlags();
  }
}

// Create singleton instance
export const compatibilityNotification = new PaliGemma2CompatibilityNotification();
export default compatibilityNotification;
