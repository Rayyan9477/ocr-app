/**
 * Extended PaliGemma2 Adapter
 * 
 * Extends the original PaliGemma2Adapter with additional functionality
 * to support the OCR integration workflow
 */

import { PaliGemma2Adapter } from './vlm/models/paligemma2-adapter';
import { VLMResponse } from './vlm/core/vlm-response-types';
import { VLMOptions } from './vlm/core/vlm-interface';
import { VlmError, VlmErrorType, createVlmError } from './vlm/core/vlm-error-types';
import { PromptCategory, getPrompt } from './vlm/models/paligemma2-prompts';
import logger from './logger';

/**
 * Extended PaliGemma2 adapter with prompt category support
 */
export class ExtendedPaliGemma2Adapter extends PaliGemma2Adapter {
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
      return await super.processWithPrompt(imagePath, prompt, options);
    } catch (error) {
      const vlmError = createVlmError(
        error, 
        VlmErrorType.PROCESSING_FAILED,
        { promptCategory, values }
      );
      
      logger.error(`ExtendedPaliGemma2Adapter processing failed: ${vlmError.message}`);
      
      // Return failed response
      return {
        success: false,
        error: vlmError,
        result: null
      };
    }
  }
}
