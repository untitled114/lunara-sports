# CSP Fix - Restart Dev Server Required

## Issue
The CSP middleware in vite.config.js requires the dev server to be restarted.

## Solution

### If using Vite dev server:
```bash
# Stop current server (Ctrl+C if running)
cd frontend
npm run dev
```

The dev server will now apply the CSP that allows `http://localhost:8000`.

### If using production build:
The issue is that `staticwebapp.config.json` CSP is being applied.
You need to either:

1. Use the dev server instead: `npm run dev`
2. Or temporarily comment out CSP in `staticwebapp.config.json` for local testing

### Verify It's Working
After restarting:
1. Open browser console
2. Try to sign in
3. Should see NO CSP errors for localhost:8000

## Why This Happened
- vite.config.js changes require server restart
- The CSP middleware only applies during `npm run dev`
- Production builds use staticwebapp.config.json CSP
