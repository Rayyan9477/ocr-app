/**
 * Configuration Manager
 * Central module for managing all configuration files and ensuring ES module compatibility
 */

import moduleConfig from './module-system.js'

export class ConfigManager {
  static async validateConfiguration() {
    const validations = []
    
    try {
      // Validate PostCSS config
      const postcssConfig = await import('../postcss.config.js')
      validations.push({ config: 'PostCSS', status: 'valid', module: postcssConfig })
    } catch (error) {
      validations.push({ config: 'PostCSS', status: 'error', error: error.message })
    }
    
    try {
      // Validate Next.js config
      const nextConfig = await import('../next.config.mjs')
      validations.push({ config: 'Next.js', status: 'valid', module: nextConfig })
    } catch (error) {
      validations.push({ config: 'Next.js', status: 'error', error: error.message })
    }
    
    try {
      // Validate Jest config
      const jestConfig = await import('../jest.config.js')
      validations.push({ config: 'Jest', status: 'valid', module: jestConfig })
    } catch (error) {
      validations.push({ config: 'Jest', status: 'error', error: error.message })
    }
    
    try {
      // Validate Tailwind config
      const tailwindConfig = await import('../tailwind.config.ts')
      validations.push({ config: 'Tailwind', status: 'valid', module: tailwindConfig })
    } catch (error) {
      validations.push({ config: 'Tailwind', status: 'error', error: error.message })
    }
    
    return validations
  }
  
  static getModuleConfig() {
    return moduleConfig
  }
  
  static async checkCompatibility() {
    const validations = await this.validateConfiguration()
    const errors = validations.filter(v => v.status === 'error')
    
    if (errors.length > 0) {
      console.error('Configuration errors found:')
      errors.forEach(error => {
        console.error(`- ${error.config}: ${error.error}`)
      })
      return false
    }
    
    console.log('All configurations are compatible with ES modules')
    return true
  }
}

export default ConfigManager
