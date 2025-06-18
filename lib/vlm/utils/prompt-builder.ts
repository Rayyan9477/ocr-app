/**
 * Utility for building prompts for VLM models
 * Handles template substitution and prompt formatting
 */

import logger from '../../logger';

/**
 * Prompt template with optional placeholders
 */
export interface PromptTemplate {
  /** System message template */
  system?: string;
  /** User message template */
  user: string;
  /** Format instructions for the model */
  format?: string;
}

/**
 * Context values to substitute in templates
 */
export interface PromptContext {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Builds a formatted prompt by substituting variables in a template
 * 
 * @param template - The prompt template
 * @param context - The context values to substitute
 * @returns The formatted prompt
 */
export function buildPrompt(
  template: PromptTemplate,
  context: PromptContext = {}
): { system?: string; user: string; format?: string } {
  try {
    // Process each template part
    const result: { system?: string; user: string; format?: string } = {
      user: replaceVariables(template.user, context)
    };
    
    // Add system message if present
    if (template.system) {
      result.system = replaceVariables(template.system, context);
    }
    
    // Add format instructions if present
    if (template.format) {
      result.format = replaceVariables(template.format, context);
    }
    
    return result;
  } catch (error) {
    logger.error(`Error building prompt: ${error instanceof Error ? error.message : String(error)}`);
    // Return a simplified prompt as fallback
    return {
      user: template.user
    };
  }
}

/**
 * Replaces variables in a template string with values from context
 * 
 * @param template - Template string with {{variable}} placeholders
 * @param context - Context object with variable values
 * @returns Formatted string
 */
function replaceVariables(template: string, context: PromptContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmedVar = variable.trim();
    const value = context[trimmedVar];
    
    // Return empty string for undefined/null values
    if (value === undefined || value === null) {
      return '';
    }
    
    return String(value);
  });
}

/**
 * Combines multiple prompt parts into a single string
 * 
 * @param parts - Array of prompt parts
 * @param separator - Separator between parts (default: newline)
 * @returns Combined prompt string
 */
export function combinePromptParts(parts: string[], separator = '\n'): string {
  return parts
    .filter(part => part && part.trim().length > 0)
    .join(separator);
}
