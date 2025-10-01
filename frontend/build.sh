#!/bin/bash

# Lunara Production Build Script
# This script builds the optimized Vite bundle for production deployment

set -e  # Exit on error

echo "🚀 Starting Lunara production build..."

# Step 1: Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Step 3: Run Vite build
echo "⚙️  Building with Vite..."
npm run build

# Step 4: Show build output
echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build Summary:"
ls -lh dist/js/

echo ""
echo "📁 Build output is in: dist/"
echo "   - Main bundle: dist/js/main.*.js"
echo "   - React vendor: dist/js/react-vendor.*.js"
echo "   - Source maps: dist/js/*.map"
echo ""
echo "🎯 Next steps:"
echo "   1. Test locally: Open index.html in browser"
echo "   2. Deploy: Copy dist/ contents to your static server"
echo "   3. Django: Ensure dist/ is in STATICFILES_DIRS"
echo ""
