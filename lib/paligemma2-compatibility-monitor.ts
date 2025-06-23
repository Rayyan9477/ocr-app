/**
 * PaliGemma2 Compatibility Monitor
 * 
 * This utility monitors for changes in transformers.js compatibility with PaliGemma2
 * and provides information about available upgrades.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import logger from './logger';

interface CompatibilityStatus {
  isCompatible: boolean;
  processorOnlyMode: boolean;
  latestVersion: string;
  installedVersion: string;
  availableUpgrade: boolean;
  upgradeInstructions: string;
  lastChecked: string;
  requiredVersionForFullSupport: string;
}

const CONFIG_FILE = path.join(process.cwd(), 'paligemma2-compatibility.json');
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@huggingface/transformers';
const GITHUB_REPO_URL = 'https://api.github.com/repos/xenova/transformers.js/releases';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * PaliGemma2 Compatibility Monitor
 */
export class PaliGemma2CompatibilityMonitor {
  private status: CompatibilityStatus;
  private lastCheckTime: Date;

  constructor() {
    this.status = this.loadStatus();
    this.lastCheckTime = new Date(this.status.lastChecked);
  }

  /**
   * Load compatibility status from file
   */
  private loadStatus(): CompatibilityStatus {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn(`Error loading compatibility status: ${error}`);
    }

    // Default status if file doesn't exist or can't be parsed
    return {
      isCompatible: false,
      processorOnlyMode: true,
      latestVersion: 'unknown',
      installedVersion: this.getInstalledVersion(),
      availableUpgrade: false,
      upgradeInstructions: 'Run npm install @huggingface/transformers@latest to upgrade',
      lastChecked: new Date().toISOString(),
      requiredVersionForFullSupport: '0.0.0' // Unknown until we check
    };
  }

  /**
   * Save compatibility status to file
   */
  private saveStatus(): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.status, null, 2));
    } catch (error) {
      logger.error(`Error saving compatibility status: ${error}`);
    }
  }

  /**
   * Get installed version of transformers.js
   */
  private getInstalledVersion(): string {
    try {
      const packageJsonPath = path.join(process.cwd(), 'node_modules', '@huggingface', 'transformers', 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version || 'unknown';
      }
    } catch (error) {
      logger.warn(`Error getting installed version: ${error}`);
    }
    return 'unknown';
  }

  /**
   * Check for new versions of transformers.js
   */
  private async checkForNewVersions(): Promise<void> {
    try {
      // Only check once per interval
      const now = new Date();
      if (now.getTime() - this.lastCheckTime.getTime() < CHECK_INTERVAL) {
        return;
      }

      this.lastCheckTime = now;
      this.status.lastChecked = now.toISOString();

      // Get latest version from NPM
      const latestVersion = await this.getLatestVersionFromNpm();
      if (latestVersion) {
        this.status.latestVersion = latestVersion;
        this.status.availableUpgrade = this.compareVersions(latestVersion, this.status.installedVersion) > 0;
      }

      // Check GitHub releases for paligemma model type support
      await this.checkGithubForPaligemmaSupport();

      // Update status
      this.saveStatus();
    } catch (error) {
      logger.error(`Error checking for new versions: ${error}`);
    }
  }

  /**
   * Get latest version from NPM registry
   */
  private getLatestVersionFromNpm(): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(NPM_REGISTRY_URL, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json['dist-tags']?.latest || 'unknown');
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check GitHub releases for paligemma model type support
   */
  private async checkGithubForPaligemmaSupport(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'PaliGemma2-Compatibility-Monitor'
        }
      };

      https.get(GITHUB_REPO_URL, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            
            // Check release notes for mentions of paligemma
            for (const release of releases) {
              const body = release.body?.toLowerCase() || '';
              if (
                body.includes('paligemma') || 
                body.includes('paligemma2') ||
                body.includes('model type') ||
                body.includes('vision2seq')
              ) {
                this.status.requiredVersionForFullSupport = release.tag_name.replace('v', '');
                this.status.isCompatible = 
                  this.compareVersions(this.status.installedVersion, this.status.requiredVersionForFullSupport) >= 0;
                
                // Update processor-only mode based on compatibility
                this.status.processorOnlyMode = !this.status.isCompatible;
                
                this.status.upgradeInstructions = this.status.isCompatible
                  ? 'Your version supports PaliGemma2. Restart the server to use full functionality.'
                  : `Upgrade to version ${this.status.requiredVersionForFullSupport} or later for PaliGemma2 support.`;
                
                break;
              }
            }
            
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Compare version strings
   * @returns Positive if v1 > v2, negative if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    if (v1 === 'unknown' || v2 === 'unknown') return 0;
    
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }
    
    return 0;
  }

  /**
   * Check if transformers.js supports PaliGemma2
   */
  public async checkCompatibility(): Promise<CompatibilityStatus> {
    // Update installed version
    this.status.installedVersion = this.getInstalledVersion();
    
    // Check for new versions
    await this.checkForNewVersions();
    
    return this.status;
  }

  /**
   * Get compatibility status
   */
  public getStatus(): CompatibilityStatus {
    return this.status;
  }

  /**
   * Upgrade transformers.js to the latest version
   */
  public async upgradeTransformers(): Promise<boolean> {
    try {
      logger.info('Upgrading transformers.js...');
      execSync('npm install @huggingface/transformers@latest', { stdio: 'inherit' });
      
      // Update status
      this.status.installedVersion = this.getInstalledVersion();
      this.status.availableUpgrade = false;
      this.saveStatus();
      
      return true;
    } catch (error) {
      logger.error(`Error upgrading transformers.js: ${error}`);
      return false;
    }
  }
}

// Create singleton instance
export const compatibilityMonitor = new PaliGemma2CompatibilityMonitor();
export default compatibilityMonitor;
