/**
 * PostCSS Configuration
 * Modular configuration for PostCSS with ES module compatibility
 */

/** @type {import('postcss-load-config').Config} */
const postcssConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default postcssConfig
