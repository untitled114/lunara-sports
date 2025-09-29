#!/bin/bash

# PRODUCTION CLEANUP - Remove redundant Azure resources
# This will delete the unused Container Instance and keep only Container Apps

echo "🚨 PRODUCTION CLEANUP - Azure Resource Optimization"
echo "================================================="

echo ""
echo "📋 RESOURCES TO CLEAN UP:"
echo "  ❌ Container Instance: lunara-app-backend (REDUNDANT)"
echo "  ✅ Keep Container Apps: lunara-backend (ACTIVE)"
echo "  ✅ Keep Static Web App: Lunara (ACTIVE)"
echo "  ✅ Keep Container Registry: lunaraappregistry (NEEDED)"
echo "  ✅ Keep Container Environment: lunara-env (NEEDED)"

echo ""
echo "💰 COST SAVINGS: ~$15-25/month (30-45% reduction)"

echo ""
read -p "🗑️  DELETE redundant Container Instance? This cannot be undone! (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "🗑️  Deleting redundant Container Instance..."

    # Delete Container Instance
    echo "Removing: lunara-app-backend (Container Instance)"
    az container delete \
        --resource-group lunara-app-rg \
        --name lunara-app-backend \
        --yes \
        && echo "✅ Container Instance deleted successfully!" \
        || echo "❌ Failed to delete Container Instance (may not exist)"

    echo ""
    echo "🎯 CLEANUP COMPLETE!"
    echo ""
    echo "📋 REMAINING PRODUCTION RESOURCES:"
    echo "  ✅ Static Web App: orange-tree-0e991820f.1.azurestaticapps.net"
    echo "  ✅ Container Apps: lunara-backend.gentlemoss-6a60b505.eastus.azurecontainerapps.io"
    echo "  ✅ Container Registry: lunaraappregistry.azurecr.io"
    echo "  ✅ Container Environment: lunara-env"

    echo ""
    echo "💡 PRODUCTION STATUS:"
    echo "  Frontend: https://orange-tree-0e991820f.1.azurestaticapps.net"
    echo "  Backend:  https://lunara-backend.gentlemoss-6a60b505.eastus.azurecontainerapps.io"
    echo "  Health:   https://lunara-backend.gentlemoss-6a60b505.eastus.azurecontainerapps.io/health/"

else
    echo ""
    echo "❌ Cleanup cancelled. Redundant resources remain."
    echo ""
    echo "📊 CURRENT RESOURCES (including redundant):"
    echo "  - Static Web App: Lunara"
    echo "  - Container Instance: lunara-app-backend (UNUSED, costing money)"
    echo "  - Container Apps: lunara-backend (ACTIVE)"
    echo "  - Container Registry: lunaraappregistry"
    echo "  - Container Environment: lunara-env"
fi

echo ""
echo "🎉 Setup complete! Run this script again to clean up resources."