/**
 * Extended PaliGemma2 Adapter
 * 
 * Extends the original PaliGemma2Adapter with additional functionality
 * to support the OCR integration workflow
 */

import { PaliGemma2Adapter } from './vlm/models/paligemma2-adapter';
import { VLMResponse, TextExtractionResponse } from './vlm/core/vlm-response-types';
import { VLMOptions, VLMInterface } from './vlm/core/vlm-interface';
import { VlmError, VlmErrorType } from './vlm/core/vlm-error-types';
import { PromptCategory, getPrompt } from './vlm/models/paligemma2-prompts';
import logger from './logger';

/**
 * Process options for the OCR integration
 */
export interface ProcessOptions {
  imagePath: string;
  prompt: string;
  options?: VLMOptions;
}

/**
 * Extended PaliGemma2 adapter with prompt category support
 */
export class ExtendedPaliGemma2Adapter extends PaliGemma2Adapter implements VLMInterface {
  /**
   * Process with prompt category and values
   * 
   * @param imagePath Path to document image
   * @param promptCategory Prompt category or prompt string
   * @param values Values to apply to the prompt template
   * @param options Processing options
   */
  /**
   * Process an image with a prompt
   * 
   * @param params Process options
   * @returns Text extraction response
   */
  async process(params: ProcessOptions): Promise<TextExtractionResponse> {
    try {
      const { imagePath, prompt, options } = params;
      
      // Call the extractText method which is already implemented in the parent class
      const response = await this.extractText(imagePath, options);
      
      return response;
    } catch (error) {
      // Create a proper VLM error
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      const vlmError = new VlmError(
        VlmErrorType.PROCESSING_FAILED,
        errorMessage,
        { 
          originalError: error,
          context: 'ExtendedPaliGemma2Adapter.process',
          imagePath: params?.imagePath,
          recoverable: true,
          recoveryActions: ['retry', 'check_input', 'contact_support']
        }
      );
      
      logger.error(`ExtendedPaliGemma2Adapter process failed: ${vlmError.message}`, {
        imagePath: params?.imagePath,
        error: vlmError
      });
      
      // Create a valid TextExtractionResponse with error information
      return {
        success: false,
        text: '',
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        }
      };
    }
  }
  
  /**
   * Process with prompt category and values
   * 
   * @param imagePath Path to document image
   * @param promptCategory Prompt category or prompt string
   * @param values Values to apply to the prompt template
   * @param options Processing options
   */
  async processWithPrompt(
    imagePath: string, 
    promptCategory: string | PromptCategory, 
    values: Record<string, string> = {},
    options?: VLMOptions
  ): Promise<VLMResponse> {
    try {
      // Check if promptCategory is a valid PromptCategory enum value
      const isPromptCategory = Object.values(PromptCategory).includes(promptCategory as PromptCategory);
      
      // Get prompt from category or use promptCategory as raw prompt
      let prompt: string;
      if (isPromptCategory) {
        // Get prompt from category
        prompt = getPrompt(promptCategory as PromptCategory, values);
      } else {
        // Use promptCategory as raw prompt
        prompt = promptCategory as string;
      }
      
      // Call the original processWithPrompt method
      const response = await super.processWithPrompt(imagePath, prompt, options);
      
      // Ensure the response has all required VLMResponse properties
      return {
        success: response.success,
        confidence: response.confidence ?? 1.0,
        processingTimeMs: response.processingTimeMs ?? 0,
        timestamp: response.timestamp ?? new Date().toISOString(),
        model: response.model || {
          id: this.id,
          name: this.name
        },
        ...(response.error ? { error: response.error } : {}),
        ...(response as any) // Keep any additional properties
      };
    } catch (error) {
      // Create a proper VLM error
      const errorMessage = error instanceof Error ? error.message : 'Processing with prompt failed';
      const vlmError = new VlmError(
        VlmErrorType.PROCESSING_FAILED,
        errorMessage,
        { 
          originalError: error,
          context: 'ExtendedPaliGemma2Adapter.processWithPrompt',
          promptCategory,
          values,
          recoverable: true,
          recoveryActions: ['retry', 'check_input', 'contact_support']
        }
      );
      
      logger.error(`ExtendedPaliGemma2Adapter processing failed: ${vlmError.message}`, {
        promptCategory,
        values,
        error: vlmError
      });
      
      // Return failed response with all required VLMResponse properties
      return {
        success: false,
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        }
      };
    }
  }
}
