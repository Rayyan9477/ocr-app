# Vercel Deployment Guide

This guide will help you deploy the Simple OCR application to Vercel for free.

## Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com) (free tier available)

---

## Quick Deployment (Recommended)

### Method 1: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `ocr-app` repository
4. Vercel will auto-detect Next.js configuration
5. Click "Deploy"

That's it! Your app will be live in ~2 minutes.

---

## Automated Deployment via GitHub Actions

For automated deployments on every push, follow these steps:

### Step 1: Get Vercel Credentials

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a new token and copy it
3. Go to your project settings in Vercel
4. Copy your **Organization ID** and **Project ID** from Settings → General

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add these secrets:
   - `VERCEL_TOKEN` - Your Vercel token
   - `VERCEL_ORG_ID` - Your Vercel organization ID
   - `VERCEL_PROJECT_ID` - Your Vercel project ID

### Step 3: Trigger Deployment

Push to `main` branch or create a PR, and GitHub Actions will automatically:
- ✅ Run linting and type checks
- ✅ Run tests
- ✅ Build the application
- ✅ Deploy to Vercel
- ✅ Run health checks

---

## Environment Variables (Optional)

If you need to set environment variables:

### Via Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add variables:
   ```
   NODE_ENV=production
   MAX_FILE_SIZE=52428800
   OCR_TIMEOUT=300000
   ```

### Via Vercel CLI:
```bash
vercel env add NODE_ENV production
vercel env add MAX_FILE_SIZE 52428800
vercel env add OCR_TIMEOUT 300000
```

---

## Vercel Configuration

The project is configured via `next.config.mjs` and automatically works with Vercel.

### Build Settings (Auto-detected):
- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Development Command:** `npm run dev`

---

## Testing Your Deployment

### 1. Check API Endpoint
```bash
curl https://your-app.vercel.app/api/simple-ocr
```

Should return API information.

### 2. Test OCR Processing
```bash
curl -X POST https://your-app.vercel.app/api/simple-ocr \
  -F "file=@document.pdf" \
  -F "language=eng"
```

### 3. Check Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

---

## Deployment Branches

| Branch | Deployment Type | URL |
|--------|----------------|-----|
| `main` / `master` | Production | `your-app.vercel.app` |
| `develop` | Preview | `your-app-git-develop.vercel.app` |
| PR branches | Preview | `your-app-git-[branch].vercel.app` |

---

## Custom Domain (Optional)

### Add Custom Domain:

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions
5. Wait for DNS propagation (~24 hours)

---

## Deployment Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Build Minutes | 6,000 minutes/month |
| Serverless Function Execution | 100 GB-hours |
| Serverless Function Duration | 10 seconds |
| Deployments | Unlimited |
| Team Members | 1 (Hobby plan) |

**Note:** The Simple OCR service works within these limits for most use cases!

---

## Monitoring & Logs

### View Deployment Logs:
1. Go to your project dashboard in Vercel
2. Click on "Deployments"
3. Select a deployment to view logs

### View Runtime Logs:
1. Go to your project dashboard
2. Navigate to "Logs"
3. Filter by function, time, or status

### View Analytics:
1. Go to your project dashboard
2. Navigate to "Analytics"
3. View page views, performance metrics, etc.

---

## Troubleshooting

### Issue: Build Fails

**Solution:**
```bash
# Test build locally first
npm run build

# Check build logs in Vercel dashboard
```

### Issue: API Returns 404

**Solution:**
- Verify API routes are in `app/api/` directory
- Check Next.js API route naming conventions
- Ensure route exports are correct

### Issue: Function Timeout

**Solution:**
- Vercel free tier has 10-second timeout
- For large PDFs, consider:
  - Processing in chunks
  - Using background jobs
  - Upgrading to Pro plan ($20/month) for 60-second timeout

### Issue: Environment Variables Not Working

**Solution:**
```bash
# Redeploy after adding environment variables
vercel --prod

# Or trigger via GitHub Actions
git commit --allow-empty -m "Trigger deployment"
git push
```

---

## CI/CD Pipeline Details

Our GitHub Actions workflow (`.github/workflows/ci-cd.yml`) includes:

### Jobs:
1. **Lint** - ESLint and TypeScript checks
2. **Test** - Run Jest tests
3. **Build** - Build Next.js application
4. **Deploy Production** - Deploy to production (main branch)
5. **Deploy Preview** - Deploy preview (PR branches)
6. **Health Check** - Verify deployment health

### Workflow Triggers:
- Push to `main`, `master`, or `develop`
- Pull requests to these branches

---

## Vercel CLI (Optional)

### Install Vercel CLI:
```bash
npm install -g vercel
```

### Login:
```bash
vercel login
```

### Deploy from CLI:
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### View deployments:
```bash
vercel ls
```

### View logs:
```bash
vercel logs
```

---

## Alternative Free Platforms

If Vercel doesn't meet your needs, consider:

| Platform | Free Tier | Best For |
|----------|-----------|----------|
| **Vercel** | 100 GB bandwidth | Next.js apps (recommended) |
| **Netlify** | 100 GB bandwidth | Static sites |
| **Railway** | $5 free credit/month | Full-stack apps |
| **Render** | 750 hours/month | Web services |
| **Fly.io** | 3 shared CPUs, 256MB RAM | Docker containers |

**Recommendation:** Vercel is the best choice for this Next.js OCR application!

---

## Performance Optimization

### Enable Edge Functions:
```javascript
// app/api/simple-ocr/route.ts
export const runtime = 'edge'; // Use Edge Runtime
```

### Enable Caching:
```javascript
export const revalidate = 3600; // Cache for 1 hour
```

### Optimize Images:
- Vercel automatically optimizes images via `next/image`
- Use `sharp` for server-side image processing (already included)

---

## Monitoring & Alerts

### Setup Vercel Integration:
1. Install Vercel GitHub App
2. Enable automatic PR previews
3. Setup deployment notifications in Slack/Discord

### Custom Monitoring:
- Add Sentry for error tracking
- Use Vercel Analytics for performance monitoring
- Setup Uptime Robot for availability monitoring

---

## Security Best Practices

1. **Environment Variables:**
   - Never commit secrets to Git
   - Use Vercel environment variables
   - Rotate tokens regularly

2. **API Security:**
   - Implement rate limiting
   - Add authentication for production
   - Validate file uploads

3. **CORS:**
   - Configure allowed origins
   - Use environment-specific settings

---

## Cost Estimation

### Free Tier Usage (Monthly):
- **Small app:** 100-500 requests/day = FREE
- **Medium app:** 1,000-5,000 requests/day = FREE
- **Large app:** 10,000+ requests/day = May need Pro ($20/month)

### Pro Plan ($20/month):
- 1 TB bandwidth
- 6,000 build minutes
- 1,000 GB-hours function execution
- 60-second function timeout
- Analytics
- Password protection
- Custom deployment protection

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Vercel Community:** https://github.com/vercel/vercel/discussions
- **Vercel Support:** support@vercel.com (Pro plan only)

---

## Summary

✅ **Easiest:** Use Vercel dashboard to deploy
✅ **Automated:** Use GitHub Actions for CI/CD
✅ **Free:** Generous free tier for most use cases
✅ **Fast:** Global edge network
✅ **Simple:** Zero configuration needed

Your Simple OCR app is perfect for Vercel deployment!

---

**Happy Deploying! 🚀**
