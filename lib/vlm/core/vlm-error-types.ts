/**
 * VLM Error Types
 * 
 * Defines standardized error types and error handling utilities
 * for VLM operations.
 */

/**
 * Error codes for VLM operations
 */
export enum VLMErrorCode {
  // Initialization Errors
  INIT_FAILED = 'init_failed',
  MODEL_NOT_FOUND = 'model_not_found',
  INVALID_MODEL = 'invalid_model',
  INCOMPATIBLE_MODEL = 'incompatible_model',
  
  // Runtime Errors
  MODEL_NOT_INITIALIZED = 'model_not_initialized',
  PROCESSING_FAILED = 'processing_failed',
  TIMEOUT = 'timeout',
  OUT_OF_MEMORY = 'out_of_memory',
  
  // Input Errors
  INVALID_INPUT = 'invalid_input',
  FILE_NOT_FOUND = 'file_not_found',
  UNSUPPORTED_FORMAT = 'unsupported_format',
  INPUT_TOO_LARGE = 'input_too_large',
  
  // API Errors
  API_ERROR = 'api_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHENTICATION_FAILED = 'authentication_failed',
  QUOTA_EXCEEDED = 'quota_exceeded',
  
  // Capability Errors
  CAPABILITY_NOT_SUPPORTED = 'capability_not_supported',
  UNSUPPORTED_OPERATION = 'unsupported_operation',
  
  // Deployment Errors
  DEPLOYMENT_ERROR = 'deployment_error',
  NETWORK_ERROR = 'network_error',
  
  // Unknown Error
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Base VLM Error class
 */
export class VLMError extends Error {
  /**
   * Error code identifying the error type
   */
  code: VLMErrorCode;
  
  /**
   * Additional details about the error
   */
  details?: any;
  
  /**
   * Whether the error is recoverable
   */
  recoverable: boolean;
  
  /**
   * Suggested recovery actions
   */
  recoveryActions?: string[];
  
  constructor(
    code: VLMErrorCode,
    message: string,
    details?: any,
    recoverable = false,
    recoveryActions?: string[]
  ) {
    super(message);
    this.name = 'VLMError';
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
    this.recoveryActions = recoveryActions;
  }
  
  /**
   * Convert error to a JSON object
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      recoveryActions: this.recoveryActions
    };
  }
}

/**
 * Create a VLM error from an unknown error
 */
export function createVLMError(error: unknown, defaultCode = VLMErrorCode.UNKNOWN_ERROR): VLMError {
  if (error instanceof VLMError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new VLMError(
      defaultCode,
      error.message,
      { originalError: error.name, stack: error.stack },
      false
    );
  }
  
  return new VLMError(
    defaultCode,
    typeof error === 'string' ? error : 'Unknown error occurred',
    { originalError: error },
    false
  );
}

/**
 * Check if an error is a specific VLM error type
 */
export function isVLMErrorCode(error: unknown, code: VLMErrorCode): boolean {
  return error instanceof VLMError && error.code === code;
}
