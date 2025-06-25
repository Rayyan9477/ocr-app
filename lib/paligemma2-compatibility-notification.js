import { compatibilityMonitor } from './paligemma2-compatibility-monitor.js';
import logger from './logger.mjs';
import fs from 'fs';
import path from 'path';

// Notification flags file
const NOTIFICATION_FLAGS_FILE = path.join(process.cwd(), 'paligemma2-notification-flags.json');

class PaliGemma2CompatibilityNotification {
  constructor() {
    this.flags = this.loadFlags();
  }

  loadFlags() {
    try {
      if (fs.existsSync(NOTIFICATION_FLAGS_FILE)) {
        const data = fs.readFileSync(NOTIFICATION_FLAGS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn(`Error loading notification flags: ${error}`);
    }
    // Default flags if file doesn't exist
    return {
      lastNotifiedVersion: '0.0.0',
      suppressNotifications: false,
      lastNotificationTime: new Date(0).toISOString(),
      notificationCount: 0
    };
  }

  saveFlags() {
    try {
      fs.writeFileSync(NOTIFICATION_FLAGS_FILE, JSON.stringify(this.flags, null, 2));
    } catch (error) {
      logger.error(`Error saving notification flags: ${error}`);
    }
  }

  async shouldShowNotification() {
    if (this.flags.suppressNotifications) {
      return false;
    }
    const status = await compatibilityMonitor.checkCompatibility();
    const shouldNotify =
      (status.isCompatible && !this.flags.suppressNotifications) ||
      (status.availableUpgrade && status.latestVersion !== this.flags.lastNotifiedVersion);
    if (shouldNotify) {
      this.flags.lastNotifiedVersion = status.latestVersion;
      this.flags.lastNotificationTime = new Date().toISOString();
      this.flags.notificationCount++;
      this.saveFlags();
    }
    return shouldNotify;
  }

  async getNotificationMessage() {
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

  suppressNotifications(suppress = true) {
    this.flags.suppressNotifications = suppress;
    this.saveFlags();
  }

  resetNotifications() {
    this.flags = {
      lastNotifiedVersion: '0.0.0',
      suppressNotifications: false,
      lastNotificationTime: new Date(0).toISOString(),
      notificationCount: 0
    };
    this.saveFlags();
  }
}

export const compatibilityNotification = new PaliGemma2CompatibilityNotification();
export default compatibilityNotification;
