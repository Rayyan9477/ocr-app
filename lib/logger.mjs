// Basic logger implementation
const logger = {
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
        if (process.env.DEBUG) {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
        }
    }
};
export default logger;
