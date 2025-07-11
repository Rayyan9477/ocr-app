const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = process.env.PORT || 3000

console.log('Starting server...')
console.log('Environment:', process.env.NODE_ENV)
console.log('Port:', port)
console.log('Hostname:', hostname)

// when using middleware `hostname` and `port` must be provided below
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: process.cwd() // Ensure we're using the correct directory
})

const handle = app.getRequestHandler()

console.log('Preparing Next.js app...')
app.prepare().then(() => {
  console.log('Next.js app prepared successfully')
  createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true)
      const { pathname, query } = parsedUrl

      // Handle health check for Azure App Service
      if (pathname === '/health' || pathname === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('OK')
        return
      }

      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err)
  process.exit(1)
})
