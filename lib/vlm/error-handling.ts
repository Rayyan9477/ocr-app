import { createLogger, format, transports } from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Create logger instance
export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'paligemma2-ocr' },
  transports: [
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  }));
}

export class VLMError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'VLMError';
  }
}

export const errorCodes = {
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MODEL_ERROR: 'MODEL_ERROR',
  IO_ERROR: 'IO_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
} as const;

export type ErrorCode = keyof typeof errorCodes;

export function handleVLMError(error: any): VLMError {
  if (error instanceof VLMError) {
    return error;
  }

  if (error.code === 'ENOENT') {
    return new VLMError('IO_ERROR', 'File not found', error);
  }

  if (error.message?.includes('timeout')) {
    return new VLMError('TIMEOUT_ERROR', 'Operation timed out', error);
  }

  return new VLMError('PROCESSING_ERROR', error.message || 'Unknown error occurred', error);
}
