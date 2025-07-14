const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')
const fs = require('fs')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = process.env.PORT || process.env.WEBSITES_PORT || 8080

console.log('Starting server...')
console.log('Environment:', process.env.NODE_ENV)
console.log('Port:', port)
console.log('Hostname:', hostname)
console.log('Working Directory:', process.cwd())

// Ensure required directories exist
const requiredDirs = ['uploads', 'processed', 'output', 'tmp', 'logs', 'audit_logs', 'secure_storage', '.next/cache']
requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir)
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`Created directory: ${dirPath}`)
    } catch (err) {
      console.warn(`Warning: Could not create directory ${dirPath}:`, err.message)
    }
  }
})

// Create health endpoint file for monitoring
try {
  const healthFilePath = path.join(process.cwd(), 'tmp', 'health.json')
  fs.writeFileSync(healthFilePath, JSON.stringify({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: port,
    hostname: hostname
  }))
  console.log(`Created health file: ${healthFilePath}`)
} catch (err) {
  console.warn('Warning: Could not create health file:', err.message)
}

// Create Next.js app with proper directory configuration
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: process.cwd()
})

const handle = app.getRequestHandler()

console.log('Preparing Next.js app...')
app.prepare().then(() => {
  console.log('Next.js app prepared successfully')
  createServer(async (req, res) => {
    try {
      // Add health check endpoint
      if (req.url === '/health' || req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }))
        return
      }

      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Health check available at http://${hostname}:${port}/health`)
    })
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err)
  process.exit(1)
})