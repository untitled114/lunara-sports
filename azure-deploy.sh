#!/bin/bash

# SafeSend Azure Deployment Script
# Project: lunara.io (SafeSend)
# Target: Production deployment to Azure East US
# Date: September 2025

set -e  # Exit on any error

# Configuration
RESOURCE_GROUP="lunara-app-rg"
LOCATION="eastus"
APP_NAME="lunara-app"
APP_SERVICE_PLAN="lunara-app-plan"
APP_SERVICE_BACKEND="lunara-app-backend"
STORAGE_ACCOUNT="lunaraappstorage"  # Note: Storage accounts cannot have hyphens
STATIC_WEB_APP="lunara-app-frontend"
REDIS_CACHE="lunara-app-redis"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Lunara App Azure Deployment Starting...${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "App Name: $APP_NAME"
echo ""

# Function to check if Azure CLI is logged in
check_azure_login() {
    echo -e "${YELLOW}Checking Azure CLI login status...${NC}"
    if ! az account show > /dev/null 2>&1; then
        echo -e "${RED}❌ Not logged into Azure CLI. Please run 'az login' first.${NC}"
        exit 1
    fi

    SUBSCRIPTION=$(az account show --query name --output tsv)
    echo -e "${GREEN}✅ Logged in to Azure subscription: $SUBSCRIPTION${NC}"
}

# Function to create resource group
create_resource_group() {
    echo -e "${YELLOW}Creating resource group...${NC}"
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION \
        --output table
    echo -e "${GREEN}✅ Resource group created: $RESOURCE_GROUP${NC}"
}

# Function to create App Service Plan
create_app_service_plan() {
    echo -e "${YELLOW}Creating App Service Plan (Free F1)...${NC}"
    az appservice plan create \
        --name $APP_SERVICE_PLAN \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku F1 \
        --is-linux \
        --output table
    echo -e "${GREEN}✅ App Service Plan created: $APP_SERVICE_PLAN${NC}"
    echo -e "${BLUE}💰 Estimated cost: FREE${NC}"
}

# Function to create App Service
create_app_service() {
    echo -e "${YELLOW}Creating App Service for Django backend...${NC}"
    az webapp create \
        --name $APP_SERVICE_BACKEND \
        --resource-group $RESOURCE_GROUP \
        --plan $APP_SERVICE_PLAN \
        --runtime "PYTHON:3.10" \
        --output table

    echo -e "${GREEN}✅ App Service created: $APP_SERVICE_BACKEND${NC}"
    echo -e "${BLUE}Backend URL: https://$APP_SERVICE_BACKEND.azurewebsites.net${NC}"
}

# Function to create Storage Account
create_storage_account() {
    echo -e "${YELLOW}Creating Storage Account for file uploads...${NC}"
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --kind StorageV2 \
        --access-tier Hot \
        --output table

    # Create blob container for media files
    echo -e "${YELLOW}Creating blob container 'media'...${NC}"
    az storage container create \
        --name media \
        --account-name $STORAGE_ACCOUNT \
        --public-access off \
        --output table

    echo -e "${GREEN}✅ Storage Account created: $STORAGE_ACCOUNT${NC}"
    echo -e "${BLUE}💰 Estimated cost: ~$2/month${NC}"
}

# Function to create Static Web App
create_static_web_app() {
    echo -e "${YELLOW}Creating Static Web App for frontend...${NC}"
    echo -e "${BLUE}Note: This requires GitHub repository for automatic deployment${NC}"

    # Get current git remote URL
    if git remote get-url origin > /dev/null 2>&1; then
        REPO_URL=$(git remote get-url origin)
        echo "Detected repository: $REPO_URL"

        az staticwebapp create \
            --name $STATIC_WEB_APP \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --source "$REPO_URL" \
            --branch "master" \
            --app-location "/frontend" \
            --output table

        echo -e "${GREEN}✅ Static Web App created: $STATIC_WEB_APP${NC}"
        echo -e "${BLUE}Frontend URL: https://${STATIC_WEB_APP}.azurestaticapps.net${NC}"
    else
        echo -e "${RED}❌ No git remote found. Static Web App creation skipped.${NC}"
        echo -e "${YELLOW}You can create it manually later with your GitHub repository.${NC}"
    fi
}

# Function to display final deployment summary
deployment_summary() {
    echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
    echo "======================="
    echo ""
    echo -e "${BLUE}📋 DEPLOYED RESOURCES:${NC}"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• App Service Plan: $APP_SERVICE_PLAN"
    echo "• App Service Backend: $APP_SERVICE_BACKEND"
    echo "• Storage Account: $STORAGE_ACCOUNT"
    echo "• Redis Cache: $REDIS_CACHE"
    echo "• Static Web App: $STATIC_WEB_APP"
    echo ""
    echo -e "${BLUE}🌐 URLs:${NC}"
    echo "• Backend API: https://$APP_SERVICE_BACKEND.azurewebsites.net"
    echo "• Frontend: https://$STATIC_WEB_APP.azurestaticapps.net"
    echo "• Custom Domain: lunara-app.com (configure manually)"
    echo ""
    echo -e "${BLUE}💰 Monthly Cost Estimate:${NC}"
    echo "• App Service Plan (F1): FREE"
    echo "• Storage Account: ~$2"
    echo "• Redis Cache (C0): ~$16"
    echo "• Static Web App: Free"
    echo "• Total: ~$18/month"
    echo ""
    echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
    echo "1. Add missing environment variables (see azure-env-template.txt)"
    echo "2. Generate strong SECRET_KEY for Django"
    echo "3. Add your Neon PostgreSQL credentials"
    echo "4. Set up SendGrid for email"
    echo "5. Deploy your Django code"
    echo "6. Configure custom domain lunara-app.com"
    echo "7. Test the full application"
    echo ""
    echo -e "${GREEN}✅ Lunara App is ready for production deployment!${NC}"
}

# Function to configure App Service settings
configure_app_service() {
    echo -e "${YELLOW}Configuring App Service environment variables...${NC}"

    # Get storage account key
    STORAGE_KEY=$(az storage account keys list \
        --resource-group $RESOURCE_GROUP \
        --account-name $STORAGE_ACCOUNT \
        --query '[0].value' \
        --output tsv)

    # Configure basic app settings first
    az webapp config appsettings set \
        --name $APP_SERVICE_BACKEND \
        --resource-group $RESOURCE_GROUP \
        --settings \
            WEBSITE_HOSTNAME="$APP_SERVICE_BACKEND.azurewebsites.net" \
            AZURE_STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT" \
            AZURE_STORAGE_ACCOUNT_KEY="$STORAGE_KEY" \
            DJANGO_SETTINGS_MODULE="safesend.settings.production" \
            SCM_DO_BUILD_DURING_DEPLOYMENT="true" \
        --output table

    echo -e "${GREEN}✅ App Service configured with basic settings${NC}"
}

# Redis pricing evaluation function
evaluate_redis_pricing() {
    echo -e "${YELLOW}📊 Redis Cache Pricing Evaluation:${NC}"
    echo "=================================="
    echo "Basic C0 (250MB): ~$16/month"
    echo "Basic C1 (1GB):   ~$31/month"
    echo "Basic C2 (2.5GB): ~$61/month"
    echo ""
    echo -e "${BLUE}Recommendation: Start with Basic C0 for development/testing${NC}"
    echo -e "${YELLOW}Would you like to create Redis cache? (y/n)${NC}"
}

# Function to create Redis Cache
create_redis_cache() {
    echo -e "${YELLOW}Creating Redis Cache (Basic C0)...${NC}"
    az redis create \
        --name $REDIS_CACHE \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Basic \
        --vm-size C0 \
        --output table

    echo -e "${GREEN}✅ Redis Cache created: $REDIS_CACHE${NC}"
    echo -e "${BLUE}💰 Estimated cost: ~$16/month${NC}"

    # Wait for Redis to be fully provisioned before getting keys
    echo -e "${YELLOW}Waiting for Redis provisioning to complete...${NC}"
    az redis wait \
        --name $REDIS_CACHE \
        --resource-group $RESOURCE_GROUP \
        --created

    # Get Redis connection string
    echo -e "${YELLOW}Retrieving Redis connection string...${NC}"
    REDIS_KEY=$(az redis list-keys \
        --name $REDIS_CACHE \
        --resource-group $RESOURCE_GROUP \
        --query primaryKey \
        --output tsv)

    REDIS_HOSTNAME=$(az redis show \
        --name $REDIS_CACHE \
        --resource-group $RESOURCE_GROUP \
        --query hostName \
        --output tsv)

    echo -e "${GREEN}✅ Redis connection information retrieved${NC}"

    # Store Redis connection string globally for later use
    AZURE_REDIS_URL="redis://:$REDIS_KEY@$REDIS_HOSTNAME:6380/0?ssl=True"
    echo "AZURE_REDIS_URL=$AZURE_REDIS_URL"
}

# Function to configure Redis settings in App Service
configure_redis_settings() {
    echo -e "${YELLOW}Adding Redis configuration to App Service...${NC}"

    az webapp config appsettings set \
        --name $APP_SERVICE_BACKEND \
        --resource-group $RESOURCE_GROUP \
        --settings \
            AZURE_REDIS_URL="$AZURE_REDIS_URL" \
        --output table

    echo -e "${GREEN}✅ Redis configuration added to App Service${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Starting Lunara App Azure Deployment${NC}"
    echo "======================================"

    check_azure_login

    echo ""
    echo -e "${YELLOW}📋 Resources to be created:${NC}"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• App Service Plan: $APP_SERVICE_PLAN (Free F1 - FREE)"
    echo "• App Service Backend: $APP_SERVICE_BACKEND"
    echo "• Storage Account: $STORAGE_ACCOUNT (~$2/month)"
    echo "• Static Web App: $STATIC_WEB_APP (Free tier)"
    echo "• Redis Cache: $REDIS_CACHE (Basic C0 - ~$16/month)"
    echo ""
    echo -e "${BLUE}💰 Total estimated monthly cost: ~$18/month${NC}"
    echo ""

    read -p "Continue with deployment? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi

    # Create resources
    create_resource_group
    echo ""

    create_app_service_plan
    echo ""

    create_app_service
    echo ""

    create_storage_account
    echo ""

    create_static_web_app
    echo ""

    configure_app_service
    echo ""

    # Create Redis Cache (included automatically)
    create_redis_cache
    echo ""

    # Configure Redis in App Service
    configure_redis_settings
    echo ""

    # Display final summary
    deployment_summary
}

# Execute main function
main "$@"