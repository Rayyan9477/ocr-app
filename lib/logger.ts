import config from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  context?: string;
  data?: any;
  userId?: string; // For tracking user-specific issues
  timestamp?: Date;
}

/**
 * Structured logging utility for consistent log format and filtering
 */
class Logger {
  private static instance: Logger;
  
  private constructor() {}
  
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * Log a message with specified level and options
   */
  private log(level: LogLevel, message: string, options: LogOptions = {}) {
    // Skip debug logs if debug mode is off
    if (level === 'debug' && !config.debug) return;
    
    const timestamp = options.timestamp || new Date();
    const context = options.context || 'app';
    
    const logEntry = {
      timestamp: timestamp.toISOString(),
      level,
      message,
      context,
      ...(options.data ? { data: options.data } : {}),
      ...(options.userId ? { userId: options.userId } : {})
    };
    
    // In production, we might want to send logs to a service
    // For now, just use console with appropriate log level
    switch (level) {
      case 'debug':
        console.debug(JSON.stringify(logEntry));
        break;
      case 'info':
        console.info(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'error':
        console.error(JSON.stringify(logEntry));
        break;
    }
  }
  
  public debug(message: string, options?: LogOptions) {
    this.log('debug', message, options);
  }
  
  public info(message: string, options?: LogOptions) {
    this.log('info', message, options);
  }
  
  public warn(message: string, options?: LogOptions) {
    this.log('warn', message, options);
  }
  
  public error(message: string, options?: LogOptions) {
    this.log('error', message, options);
  }
  
  /**
   * Log an error object with stack trace
   */
  public logError(error: Error, message?: string, options?: LogOptions) {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    
    this.error(
      message || `Error: ${error.message}`, 
      { ...options, data: { ...options?.data, error: errorData } }
    );
  }
}

export const logger = Logger.getInstance();
export default logger;
