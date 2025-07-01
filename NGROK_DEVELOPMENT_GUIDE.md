# Quick Development Testing with ngrok

## Setup for Development Testing

### 1. Install ngrok
```bash
# Install globally
npm install -g ngrok

# Or download from https://ngrok.com/download
```

### 2. Create ngrok account (optional but recommended)
```bash
# Sign up at https://dashboard.ngrok.com/signup
# Get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 3. Test your OCR app locally
```bash
# Start your application
npm run dev
# or
npm start

# Your app should be running on http://localhost:3000
```

### 4. Expose with ngrok
```bash
# In a new terminal
ngrok http 3000

# You'll get output like:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

### 5. Test the public URL
- Share the ngrok URL for testing
- Test file uploads and OCR processing
- Verify all functionality works

## Configuration Options

### Basic tunnel
```bash
ngrok http 3000
```

### Custom subdomain (requires paid plan)
```bash
ngrok http --subdomain=myocr 3000
```

### With basic auth
```bash
ngrok http --basic-auth="username:password" 3000
```

### HTTPS only
```bash
ngrok http --bind-tls=true 3000
```

## Development Workflow

1. **Code locally** on your machine
2. **Test with ngrok** for external access
3. **Share with stakeholders** for feedback
4. **Deploy to production** on compliant platform

## Limitations for Production

- ❌ No HIPAA compliance on free/basic plans
- ❌ URLs change on each restart (free plan)
- ❌ Limited bandwidth
- ❌ Not suitable for sensitive data
- ❌ Dependent on ngrok service availability

## Next Steps

For development: Use ngrok freely
For production: Choose Azure, AWS, or GCP for HIPAA compliance
