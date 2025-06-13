// Log levels in order of priority
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Default log level is 'info' in production, 'debug' in development
const defaultLogLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'warn';
const logLevel = (process.env.LOG_LEVEL || defaultLogLevel) as LogLevel;

// Logger implementation
const logger = {
  log(level: LogLevel, message: string, ...args: any[]) {
    if (LOG_LEVELS[level] <= LOG_LEVELS[logLevel as LogLevel]) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${level.toUpperCase()}] ${timestamp} - ${message}`;
      
      // Use appropriate console method based on log level
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else if (level === 'info') {
        console.log(logMessage, ...args);
      } else {
        // debug and any other levels
        console.debug(logMessage, ...args);
      }
    }
  },
  
  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  },
  
  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  },
  
  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  },
  
  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  },
  
  // Utility to check if a level is enabled
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[logLevel as LogLevel];
  }
};

export default logger;
