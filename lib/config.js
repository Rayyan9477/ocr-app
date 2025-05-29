"use strict";
// Configuration utility to manage environment variables with defaults and validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
// Helper function to get a boolean env var
function getBoolEnv(key, defaultValue) {
    if (defaultValue === void 0) { defaultValue = false; }
    var value = process.env[key];
    if (!value)
        return defaultValue;
    // Handle various true/false string formats
    return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}
// Helper function to get a number env var
function getNumberEnv(key, defaultValue) {
    var value = process.env[key];
    if (!value)
        return defaultValue;
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
// Helper function to get a string env var
function getStringEnv(key, defaultValue) {
    return process.env[key] || defaultValue;
}
// Create the centralized config
exports.config = {
    // Server configuration
    port: getNumberEnv('PORT', 3000),
    nodeEnv: getStringEnv('NODE_ENV', 'production'),
    debug: getBoolEnv('DEBUG', false),
    // File limits
    maxUploadSize: getNumberEnv('MAX_UPLOAD_SIZE', 100),
    nodeMemory: getNumberEnv('NODE_MEMORY', 4096),
    // OCR configuration
    defaultLanguage: getStringEnv('DEFAULT_LANGUAGE', 'eng'),
    enableOptimization: getBoolEnv('ENABLE_OPTIMIZATION', true),
    ocrTimeout: getNumberEnv('OCR_TIMEOUT', 600000), // 10 minutes default
    jbig2Path: getStringEnv('JBIG2_PATH', '/usr/bin/jbig2'),
    // Storage paths
    uploadsDir: getStringEnv('UPLOADS_DIR', './uploads'),
    processedDir: getStringEnv('PROCESSED_DIR', './processed'),
    tempDir: getStringEnv('TEMP_DIR', './tmp'),
    // Cleanup configuration
    cleanupInterval: getNumberEnv('CLEANUP_INTERVAL', 3600000), // Default: 1 hour
    maxStorageAge: getNumberEnv('MAX_STORAGE_AGE', 259200000), // Default: 3 days
    // Medical OCR configuration
    enableMedicalEnhancements: getBoolEnv('ENABLE_MEDICAL_ENHANCEMENTS', true),
    medicalConfig: {
        removeDiacritics: getBoolEnv('MEDICAL_REMOVE_DIACRITICS', true),
        handleEmptyPages: getBoolEnv('MEDICAL_HANDLE_EMPTY_PAGES', true),
        enhanceHandwriting: getBoolEnv('MEDICAL_ENHANCE_HANDWRITING', true),
        retryFailedFiles: getBoolEnv('MEDICAL_RETRY_FAILED', true),
        usePdfOutput: getBoolEnv('MEDICAL_USE_PDF', true), // Default to PDF instead of PDF/A for medical docs
    },
    // Confidence detection configuration
    confidence: {
        pageWarningThreshold: getNumberEnv('CONFIDENCE_PAGE_WARNING_THRESHOLD', 85),
        pageErrorThreshold: getNumberEnv('CONFIDENCE_PAGE_ERROR_THRESHOLD', 70),
        enableConfidenceTracking: getBoolEnv('ENABLE_CONFIDENCE_TRACKING', true),
    },
};
// Validate critical configuration
function validateConfig() {
    var errors = [];
    // Basic validation checks
    if (exports.config.port <= 0 || exports.config.port > 65535) {
        errors.push("Invalid port: ".concat(exports.config.port));
    }
    if (exports.config.maxUploadSize <= 0) {
        errors.push("Invalid MAX_UPLOAD_SIZE: ".concat(exports.config.maxUploadSize));
    }
    if (exports.config.ocrTimeout <= 0) {
        errors.push("Invalid OCR_TIMEOUT: ".concat(exports.config.ocrTimeout));
    }
    return {
        valid: errors.length === 0,
        errors: errors
    };
}
exports.default = exports.config;
