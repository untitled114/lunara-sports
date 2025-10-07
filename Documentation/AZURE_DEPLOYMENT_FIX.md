# Azure Deployment - API URL Configuration Fix

## Problem
Production site (lunara-app.com) is trying to call `http://localhost:8000` instead of the production API.

**Error:**
```
CSP: The page's settings blocked the loading of a resource (connect-src)
at http://localhost:8000/api/auth/login/
```

## Root Cause
The frontend build doesn't have the `VITE_API_URL` environment variable set, so it falls back to the localhost default.

## Solution

### Option 1: Using .env.production (Recommended)

The `.env.production` file has been created with the correct production API URL:
```
VITE_API_URL=https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api
```

**Deploy Steps:**
1. Commit the `.env.production` file
2. Push to GitHub
3. Azure Static Web Apps will automatically:
   - Read `.env.production` during build
   - Replace `import.meta.env.VITE_API_URL` with the production URL
   - Build with correct API endpoint

### Option 2: Azure Environment Variables (Alternative)

If you prefer not to commit the .env file, configure in Azure Portal:

1. Go to Azure Portal → Your Static Web App
2. Navigate to **Configuration** → **Application settings**
3. Add new setting:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api`
4. Click **Save**
5. Trigger a new deployment (push to GitHub)

### Option 3: GitHub Actions Secrets

Add to GitHub repository secrets for CI/CD:

1. Go to GitHub → Repository → Settings → Secrets → Actions
2. Add new secret:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api`
3. Update `.github/workflows/azure-static-web-apps-*.yml`:

```yaml
- name: Build And Deploy
  env:
    VITE_API_URL: ${{ secrets.VITE_API_URL }}
  # ... rest of config
```

## Verification

After deployment, verify in browser console:

### Before Fix:
```javascript
// In api.js
const API_BASE_URL = 'http://localhost:8000/api'; // Wrong!
```

### After Fix:
```javascript
// In api.js
const API_BASE_URL = 'https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api'; // Correct!
```

### Test:
1. Open https://lunara-app.com
2. Open browser DevTools → Console
3. Try to sign in
4. Should see API calls to `https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api/auth/login/`
5. NO CSP errors about localhost

## API Endpoints

Your production API is hosted at:
- **Azure Container Apps**: `https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io`
- **Custom Domain** (if configured): `https://api.lunara-app.com`

Choose one and set it in `VITE_API_URL`.

## Security Note

The CSP in `staticwebapp.config.json` already whitelists both production APIs:
```
connect-src 'self'
  https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io
  https://api.lunara-app.com
```

So once the API URL is set correctly, CSP will allow it.

## Quick Deploy

```bash
# 1. Commit the .env.production file
git add frontend/.env.production
git commit -m "fix: add production API URL environment variable"

# 2. Push to GitHub
git push origin master

# 3. Azure will auto-deploy
# Wait 2-3 minutes for build to complete

# 4. Test at lunara-app.com
```

## Alternative: Test Locally First

```bash
# Build with production config
cd frontend
npm run build

# Preview the production build
npm run preview

# Visit http://localhost:4173
# Should call production API (not localhost:8000)
```

## Troubleshooting

### Still seeing localhost:8000?
- Check browser cache - hard refresh (Ctrl+Shift+R)
- Verify deployment completed in Azure Portal
- Check Azure build logs for VITE_API_URL

### API calls failing with CORS?
- Verify backend CORS settings allow lunara-app.com
- Check backend is actually running on Azure

### Different error?
- Check browser Network tab
- Look at actual request URL
- Verify CSP headers in Response Headers
