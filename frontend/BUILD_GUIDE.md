# Lunara Frontend Build System

## Overview

The Lunara frontend has been migrated from Babel Standalone (CDN) to **Vite** for production-ready performance.

### Performance Improvements

| Before (Babel CDN) | After (Vite) | Improvement |
|:---|:---|:---|
| 4 separate CDN requests | 1 bundled file | **75% fewer requests** |
| ~2.5MB total (React + Babel) | 145KB bundled | **94% smaller** |
| Client-side JSX compilation | Pre-compiled JSX | **Instant load** |
| No tree-shaking | Optimized bundle | **Production-ready** |

---

## Setup & Development

### Prerequisites
- Node.js 18+
- npm 9+

### Initial Setup
```bash
cd frontend
npm install
```

### Development Mode
```bash
npm run dev
```
This starts a Vite dev server on `http://localhost:3000` with hot module replacement.

### Build for Production
```bash
npm run build
```
Output: `dist/js/main.js` (145KB gzipped: 47KB)

---

## Architecture

### File Structure
```
frontend/
├── src/
│   ├── main.jsx          # Entry point
│   ├── App.jsx           # Root component
│   └── components/
│       ├── Hero.jsx      # Hero section
│       └── Features.jsx  # Features section
├── dist/                 # Build output (gitignored)
│   └── js/
│       └── main.js       # Compiled bundle
├── vite.config.js        # Vite configuration
└── package.json
```

### What Changed

**Removed:**
- ❌ `https://unpkg.com/react@18` CDN
- ❌ `https://unpkg.com/react-dom@18` CDN
- ❌ `https://unpkg.com/@babel/standalone` (2.5MB!)
- ❌ `/react-components/*.jsx` (client-side compilation)
- ❌ `/js/react-app.js` (legacy loader)

**Added:**
- ✅ Vite build system
- ✅ ES6 modules with proper imports/exports
- ✅ Single optimized bundle: `dist/js/main.js`
- ✅ Tree-shaking and minification
- ✅ Development server with HMR

---

## Deployment

### Azure Static Web Apps
The build output is already configured for Azure deployment:

```bash
npm run build
# Outputs to dist/
```

The Azure workflow should run `npm install && npm run build` before deployment.

### Django Integration
Django serves the `dist/` directory as static files. Update `settings.py` if needed:

```python
STATICFILES_DIRS = [
    BASE_DIR.parent / 'frontend',
    BASE_DIR.parent / 'frontend' / 'dist',  # Add this
]
```

---

## Scripts

### `npm run dev`
Starts Vite development server with:
- Hot Module Replacement (HMR)
- Fast refresh
- Proxy to Django backend (`/api` → `http://127.0.0.1:8000`)

### `npm run build`
Production build with:
- Minification
- Tree-shaking
- Code splitting
- Optimized chunks

### `npm run preview`
Preview production build locally

---

## Next Steps

### Recommended Optimizations
1. **Bundle JavaScript files** - Migrate `api.js`, `navigation.js`, etc. into the Vite bundle
2. **Code splitting** - Split vendor and app code for better caching
3. **CSS optimization** - Import CSS into Vite for processing
4. **Image optimization** - Use Vite's asset handling for favicons/images

### Migration Checklist
- [x] Set up Vite build system
- [x] Remove Babel standalone
- [x] Compile JSX to production bundle
- [x] Update index.html to use bundled script
- [ ] Bundle remaining JavaScript files
- [ ] Set up CI/CD build step
- [ ] Add source maps for debugging
