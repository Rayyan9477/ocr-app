import { createLogger, format, transports } from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Create logger instance with minimal error reporting
export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'paligemma2-ocr' },
  transports: [
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Add console transport in development for debugging only
if (process.env.NODE_ENV === 'development') {
  logger.add(new transports.Console({
    format: format.simple()
  }));
}

// Status codes instead of errors
export const statusCodes = {
  SUCCESS: 'SUCCESS',
  INIT_INCOMPLETE: 'INIT_INCOMPLETE',
  PROCESS_INCOMPLETE: 'PROCESS_INCOMPLETE',
  INVALID_INPUT: 'INVALID_INPUT',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  FILE_UNAVAILABLE: 'FILE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT'
} as const;

export type StatusCode = keyof typeof statusCodes;

// Response wrapper instead of error throwing
export interface OperationResult<T> {
  status: StatusCode;
  data?: T;
  message?: string;
}

export function createResponse<T>(
  status: StatusCode = 'SUCCESS',
  data?: T,
  message?: string
): OperationResult<T> {
  return { status, data, message };
}

// Handler for operational issues
export function handleOperationStatus(result: any): OperationResult<any> {
  if (result?.status && Object.keys(statusCodes).includes(result.status)) {
    return result;
  }

  if (!result) {
    return createResponse('PROCESS_INCOMPLETE', null, 'Operation could not complete');
  }

  return createResponse('SUCCESS', result);
}
