#!/bin/bash

echo "🚀 CREATING NEW AZURE RESOURCES FOR LUNARA"
echo "=========================================="

# Variables
RESOURCE_GROUP="lunara-production-rg"
LOCATION="eastus"
REGISTRY_NAME="lunararegistry"
CONTAINER_ENV="lunara-container-env"
CONTAINER_APP="lunara-api"
STATIC_APP="lunara-frontend"

echo "Creating resources with the following configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Container Registry: $REGISTRY_NAME"
echo "  Container Environment: $CONTAINER_ENV"
echo "  Container App: $CONTAINER_APP"
echo "  Static Web App: $STATIC_APP"

echo ""
read -p "✅ Proceed with resource creation? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then

    echo ""
    echo "📋 Step 1: Creating Resource Group..."
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION \
        --tags environment=production project=lunara

    echo ""
    echo "📋 Step 2: Creating Container Registry..."
    az acr create \
        --resource-group $RESOURCE_GROUP \
        --name $REGISTRY_NAME \
        --sku Basic \
        --admin-enabled true \
        --location $LOCATION

    echo ""
    echo "📋 Step 3: Creating Container Apps Environment..."
    az containerapp env create \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_ENV \
        --location $LOCATION

    echo ""
    echo "📋 Step 4: Building and pushing Docker image..."
    ACR_LOGIN_SERVER=$(az acr show --name $REGISTRY_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

    # Login to ACR
    az acr login --name $REGISTRY_NAME

    # Build and push image
    docker build -t $ACR_LOGIN_SERVER/lunara-backend:latest ./backend/
    docker push $ACR_LOGIN_SERVER/lunara-backend:latest

    echo ""
    echo "📋 Step 5: Creating Container App..."
    az containerapp create \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_APP \
        --environment $CONTAINER_ENV \
        --image $ACR_LOGIN_SERVER/lunara-backend:latest \
        --target-port 8000 \
        --ingress external \
        --min-replicas 1 \
        --max-replicas 3 \
        --cpu 1.0 \
        --memory 2Gi \
        --env-vars \
            SECRET_KEY=secretref:secret-key \
            DEBUG=False \
            DB_NAME=neondb \
            DB_USER=neondb_owner \
            DB_PASSWORD=secretref:db-password \
            DB_HOST=ep-cold-night-a8z0ndqj-pooler.eastus2.azure.neon.tech \
            DB_PORT=5432 \
            DJANGO_SETTINGS_MODULE=safesend.settings.production \
        --secrets \
            secret-key="RglSPABALP5hJ%w5CsM(E)a%nU)@7shorZ%9yxUSdugqD\MRKP" \
            db-password="npg_i8Po2sLuDUJl"

    echo ""
    echo "📋 Step 6: Creating Static Web App..."
    az staticwebapp create \
        --resource-group $RESOURCE_GROUP \
        --name $STATIC_APP \
        --location $LOCATION \
        --source https://github.com/untitled114/lunaro.io \
        --branch master \
        --app-location "./frontend" \
        --api-location "" \
        --output-location ""

    echo ""
    echo "✅ NEW RESOURCES CREATED SUCCESSFULLY!"
    echo ""
    echo "📋 Resource URLs:"

    # Get URLs
    CONTAINER_APP_URL=$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
    STATIC_APP_URL=$(az staticwebapp show --name $STATIC_APP --resource-group $RESOURCE_GROUP --query defaultHostname -o tsv)

    echo "  🌐 Frontend: https://$STATIC_APP_URL"
    echo "  🔧 Backend API: https://$CONTAINER_APP_URL"
    echo "  ⚡ Health Check: https://$CONTAINER_APP_URL/health/"

    echo ""
    echo "📋 Next Steps:"
    echo "  1. Update project configurations with new URLs"
    echo "  2. Configure custom domain: lunara-app.com"
    echo "  3. Set up DNS records in GoDaddy"
    echo "  4. Test deployment"

else
    echo "❌ Resource creation cancelled."
fi