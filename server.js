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

// Ensure required directories exist
const requiredDirs = ['uploads', 'processed', 'output', 'tmp', 'logs', 'audit_logs', 'secure_storage']
requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`Created directory: ${dirPath}`)
  }
})

// Create Next.js app
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
    })
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err)
  process.exit(1)
})