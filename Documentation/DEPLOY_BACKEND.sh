#!/bin/bash

echo "🚀 DEPLOYING LUNARA BACKEND TO CONTAINER APPS"
echo "============================================="

# Variables
RESOURCE_GROUP="lunara-production-rg"
REGISTRY_NAME="lunararegistry"
CONTAINER_APP="lunara-api"
CONTAINER_ENV="lunara-container-env"

echo "Creating Container App with placeholder image..."

# Create Container App with a basic nginx image first, then we'll update it
az containerapp create \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_APP \
    --environment $CONTAINER_ENV \
    --image nginx:latest \
    --target-port 80 \
    --ingress external \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 1.0 \
    --memory 2Gi

echo ""
echo "✅ Container App created with placeholder image"
echo ""

# Get the URL
CONTAINER_APP_URL=$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)

echo "📋 Container App URL: https://$CONTAINER_APP_URL"

echo ""
echo "📋 Next steps:"
echo "  1. Build Docker image locally or in GitHub Actions"
echo "  2. Push to registry: lunararegistry.azurecr.io"
echo "  3. Update Container App with Django image"
echo "  4. Configure environment variables"

echo ""
echo "🔧 To update with Django image later:"
echo "  az containerapp update --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --image lunararegistry.azurecr.io/lunara-backend:latest"