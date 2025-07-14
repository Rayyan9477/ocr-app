# Optimized Azure Deployment

This document explains the optimized deployment approach for our Next.js application to Azure App Service.

## Deployment Strategy

We've implemented a highly optimized deployment strategy that:

1. Uses Next.js "standalone" output mode
2. Minimizes deployment package size
3. Avoids unnecessary files and dependencies
4. Speeds up the deployment process
5. Reduces costs by minimizing bandwidth usage

## How It Works

The deployment process works as follows:

1. Next.js builds the application with `output: 'standalone'`
2. The build creates a `.next/standalone` directory containing a minimal production version of the app
3. We add the required static files and configuration to this standalone build
4. The standalone build is deployed directly to Azure App Service
5. This approach avoids creating a separate deployment directory, saving disk space and deployment time

## Why This Is Better

Compared to our previous approach:

- **Smaller Package**: The standalone build is much smaller than the full project (typically <100MB vs >1GB)
- **Faster Deployments**: Smaller packages upload faster to Azure
- **Less Bandwidth**: Reduces costs associated with deployments
- **Fewer Issues**: Avoids problems with large deployments timing out

## Key Files

These files are essential for the deployment:

- `server.js` - The main entry point for the application
- `web.config` - Configuration for Azure's IIS web server
- `iisnode.yml` - Additional configuration for Node.js running on IIS
- `startup.sh` - Optional startup script for additional setup

## Configuration Files

The deployment automatically includes:

1. A production-optimized `web.config` (with fallback if missing)
2. Static assets in the proper directory structure
3. Minimal required directories for the application to function

## Required Next.js Configuration

For this to work properly, make sure your `next.config.mjs` includes:

```javascript
module.exports = {
  output: 'standalone',
  // ... other configuration
}
```

## Troubleshooting

If deployment fails:

1. Check that Next.js is configured for standalone output
2. Verify the `web.config` file is correctly formatted
3. Make sure static files are properly included
4. Check Azure App Service logs for detailed error messages
