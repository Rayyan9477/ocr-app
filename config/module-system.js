/**
 * Module System Configuration
 * Centralizes module system compatibility settings
 */

export const moduleConfig = {
  // ES Module compatibility
  esm: true,
  
  // Node.js module resolution
  nodeModules: {
    allowES6: true,
    allowCommonJS: true,
  },
  
  // Build system configuration
  build: {
    target: 'es2020',
    moduleResolution: 'node',
  },
  
  // File extensions mapping
  extensions: {
    '.js': 'esm',
    '.mjs': 'esm', 
    '.cjs': 'commonjs',
    '.ts': 'typescript',
    '.tsx': 'typescript-jsx',
  }
}

export default moduleConfig
