/**
 * Error handler for OCR processing
 */
class OcrErrorHandler {
  constructor() {
    this.errors = [];
  }
  
  /**
   * Handle error that occurred during OCR processing
   */
  handleError(filename, error) {
    const errorDetails = {
      file: filename,
      message: error.message,
      timestamp: new Date().toISOString(),
      retryable: this.isRetryableError(error)
    };
    
    this.errors.push(errorDetails);
    
    console.error(`❌ Error processing ${filename}: ${error.message}`);
    return errorDetails;
  }
  
  /**
   * Determine if an error can be retried
   */
  isRetryableError(error) {
    // Server errors (500) are typically temporary and can be retried
    if (error.message.includes('500')) return true;
    
    // Some server timeouts or connection issues can be retried
    if (error.message.includes('timeout') || 
        error.message.includes('connection')) return true;
        
    return false;
  }
  
  /**
   * Get all errors that occurred
   */
  getErrors() {
    return this.errors;
  }
  
  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = [];
  }
}

module.exports = new OcrErrorHandler();
