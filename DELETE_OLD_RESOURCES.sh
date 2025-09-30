#!/bin/bash

echo "🚨 DELETING ALL EXISTING AZURE RESOURCES"
echo "========================================"

echo "This will delete:"
echo "  - Static Web App: Lunara"
echo "  - Container Instance: lunara-app-backend"
echo "  - Container Apps: lunara-backend"
echo "  - Container Environment: lunara-env"
echo "  - Container Registry: lunaraappregistry"
echo "  - Resource Group: lunara-app-rg"

echo ""
read -p "🗑️  CONFIRM: Delete ALL existing resources? This cannot be undone! (yes/NO): " confirm

if [[ $confirm == "yes" ]]; then
    echo ""
    echo "🗑️  Deleting resource group and all contained resources..."

    # Delete the entire resource group (this removes everything)
    az group delete \
        --name lunara-app-rg \
        --yes \
        --no-wait

    echo "✅ Resource group deletion initiated (may take 5-10 minutes)"
    echo ""
    echo "📋 Monitoring deletion progress..."

    # Monitor deletion
    while az group show --name lunara-app-rg &>/dev/null; do
        echo "⏳ Still deleting resources..."
        sleep 30
    done

    echo "✅ All existing resources deleted successfully!"

else
    echo "❌ Deletion cancelled."
    exit 1
fi