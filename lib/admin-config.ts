/**
 * Secure Admin Configuration
 * 
 * This module manages admin credentials securely without exposing them in the UI.
 * Admin credentials are stored in environment variables and never displayed to users.
 */

interface AdminConfig {
  email: string | undefined;
  password: string | undefined;
  isConfigured: boolean;
}

/**
 * Get admin configuration from environment variables
 * @returns Admin configuration object
 */
export function getAdminConfig(): AdminConfig {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  
  return {
    email,
    password,
    isConfigured: !!(email && password)
  };
}

/**
 * Check if the provided credentials match the admin credentials
 * @param email - Email to check
 * @param password - Password to check
 * @returns True if credentials match admin
 */
export function isAdminCredentials(email: string, password: string): boolean {
  const config = getAdminConfig();
  
  if (!config.isConfigured) {
    console.warn('Admin credentials not configured in environment variables');
    return false;
  }
  
  return email === config.email && password === config.password;
}

/**
 * Check if the email belongs to admin (without password validation)
 * @param email - Email to check
 * @returns True if email is admin email
 */
export function isAdminEmail(email: string): boolean {
  const config = getAdminConfig();
  return config.isConfigured && email === config.email;
}

/**
 * Validate that admin credentials are properly configured
 * @returns Object with validation results
 */
export function validateAdminConfig(): { 
  isValid: boolean; 
  errors: string[] 
} {
  const config = getAdminConfig();
  const errors: string[] = [];
  
  if (!config.email) {
    errors.push('ADMIN_EMAIL environment variable is not set');
  }
  
  if (!config.password) {
    errors.push('ADMIN_PASSWORD environment variable is not set');
  }
  
  if (config.email && !config.email.includes('@')) {
    errors.push('ADMIN_EMAIL must be a valid email address');
  }
  
  if (config.password && config.password.length < 8) {
    errors.push('ADMIN_PASSWORD must be at least 8 characters long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get admin status without exposing credentials
 * @returns Admin status information (safe for UI display)
 */
export function getAdminStatus(): {
  isConfigured: boolean;
  hasValidEmail: boolean;
  hasValidPassword: boolean;
} {
  const config = getAdminConfig();
  
  return {
    isConfigured: config.isConfigured,
    hasValidEmail: !!(config.email && config.email.includes('@')),
    hasValidPassword: !!(config.password && config.password.length >= 8)
  };
}
