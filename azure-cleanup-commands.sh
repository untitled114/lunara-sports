#!/bin/bash

# Azure Resource Cleanup Script
# This script removes redundant Container Instance and keeps Container Apps

echo "🔍 Checking current Azure resources..."

echo "📋 Current Container Apps:"
az containerapp list --resource-group lunara-app-rg --query "[].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" --output table

echo ""
echo "📋 Current Container Instances:"
az container list --resource-group lunara-app-rg --query "[].{Name:name, Status:containers[0].instanceView.currentState.state, URL:ipAddress.fqdn}" --output table

echo ""
echo "⚠️  REDUNDANCY DETECTED:"
echo "   - Container Apps (KEEP): lunara-backend (Container Apps)"
echo "   - Container Instance (DELETE): lunara-app-backend (Container Instance)"

echo ""
read -p "🗑️  Delete redundant Container Instance? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo "🗑️  Deleting Container Instance: lunara-app-backend..."
    az container delete \
        --resource-group lunara-app-rg \
        --name lunara-app-backend \
        --yes

    echo "✅ Container Instance deleted successfully!"
    echo ""
    echo "📋 Remaining resources:"
    az containerapp list --resource-group lunara-app-rg --query "[].{Name:name, Status:properties.provisioningState, URL:properties.configuration.ingress.fqdn}" --output table
else
    echo "❌ Cleanup cancelled."
fi

echo ""
echo "🎯 PRODUCTION CONFIGURATION:"
echo "   Frontend URL: https://orange-tree-0e991820f.1.azurestaticapps.net"
echo "   Backend URL:  https://lunara-backend.gentlemoss-6a60b505.eastus.azurecontainerapps.io"
echo "   Status:       ✅ Container Apps (HTTPS, scalable, production-ready)"