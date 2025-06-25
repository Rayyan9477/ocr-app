/**
 * Paligemma2 Compatibility Monitor
 * Monitors and manages compatibility between the Paligemma2 VLM and the OCR system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to compatibility status file
const COMPATIBILITY_FILE = path.join(__dirname, '..', 'paligemma2-compatibility.json');

/**
 * Default compatibility configuration
 */
const DEFAULT_COMPATIBILITY = {
  lastChecked: null,
  status: 'unknown',
  compatible: false,
  modelVersion: null,
  engineVersion: null,
  processorOnly: true,
  errors: []
};

/**
 * Loads the current compatibility status
 * @returns {Object} The current compatibility status
 */
export function loadCompatibilityStatus() {
  try {
    if (fs.existsSync(COMPATIBILITY_FILE)) {
      const data = fs.readFileSync(COMPATIBILITY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading compatibility status:', error);
  }
  
  // If file doesn't exist or there's an error, return default
  return DEFAULT_COMPATIBILITY;
}

/**
 * Saves the compatibility status
 * @param {Object} status - The compatibility status to save
 */
export function saveCompatibilityStatus(status) {
  try {
    fs.writeFileSync(COMPATIBILITY_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving compatibility status:', error);
  }
}

/**
 * Updates a specific field in the compatibility status
 * @param {string} field - The field to update
 * @param {any} value - The new value
 */
export function updateCompatibilityField(field, value) {
  const status = loadCompatibilityStatus();
  status[field] = value;
  status.lastChecked = new Date().toISOString();
  saveCompatibilityStatus(status);
  return status;
}

/**
 * Sets the processor-only mode
 * @param {boolean} enabled - Whether processor-only mode is enabled
 */
export function setProcessorOnlyMode(enabled) {
  return updateCompatibilityField('processorOnly', enabled);
}

/**
 * Records an error in the compatibility status
 * @param {string} error - The error to record
 */
export function recordCompatibilityError(error) {
  const status = loadCompatibilityStatus();
  if (!status.errors) {
    status.errors = [];
  }
  status.errors.push({
    timestamp: new Date().toISOString(),
    message: error
  });
  // Keep only the last 10 errors
  if (status.errors.length > 10) {
    status.errors = status.errors.slice(-10);
  }
  status.status = 'error';
  status.compatible = false;
  status.lastChecked = new Date().toISOString();
  saveCompatibilityStatus(status);
  return status;
}

/**
 * Resets the compatibility errors
 */
export function resetCompatibilityErrors() {
  const status = loadCompatibilityStatus();
  status.errors = [];
  saveCompatibilityStatus(status);
  return status;
}

/**
 * Marks the compatibility check as successful
 * @param {string} modelVersion - The model version
 * @param {string} engineVersion - The engine version
 */
export function markCompatibilitySuccess(modelVersion, engineVersion) {
  const status = loadCompatibilityStatus();
  status.status = 'success';
  status.compatible = true;
  status.modelVersion = modelVersion;
  status.engineVersion = engineVersion;
  status.lastChecked = new Date().toISOString();
  saveCompatibilityStatus(status);
  return status;
}

// Initialize compatibility file if it doesn't exist
if (!fs.existsSync(COMPATIBILITY_FILE)) {
  saveCompatibilityStatus(DEFAULT_COMPATIBILITY);
}

const compatibilityMonitor = {
  loadCompatibilityStatus,
  saveCompatibilityStatus,
  updateCompatibilityField,
  setProcessorOnlyMode,
  recordCompatibilityError,
  resetCompatibilityErrors,
  markCompatibilitySuccess
};

export { compatibilityMonitor };
export default compatibilityMonitor;
