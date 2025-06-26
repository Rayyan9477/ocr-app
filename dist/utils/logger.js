/**
 * Logger utility for the enhanced OCR pipeline
 */
export const logger = {
    info: (message) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    },
    error: (message) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    },
    warn: (message) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    },
    debug: (message) => {
        if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
        }
    }
};
export default logger;
