#!/bin/bash

# Lunara App Minimal Azure Deployment Script
# This script deploys only the essential services that work with DP-900 subscription limits
# Date: September 2025

set -e  # Exit on any error

# Configuration
RESOURCE_GROUP="lunara-app-rg"
LOCATION="eastus"
APP_NAME="lunara-app"
STORAGE_ACCOUNT="lunaraappstorage"
STATIC_WEB_APP="lunara-app-frontend"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Lunara App Minimal Azure Deployment Starting...${NC}"
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
    echo -e "${GREEN}🎉 MINIMAL DEPLOYMENT COMPLETE!${NC}"
    echo "====================================="
    echo ""
    echo -e "${BLUE}📋 DEPLOYED RESOURCES:${NC}"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• Storage Account: $STORAGE_ACCOUNT"
    echo "• Static Web App: $STATIC_WEB_APP"
    echo ""
    echo -e "${BLUE}🌐 URLs:${NC}"
    echo "• Frontend: https://$STATIC_WEB_APP.azurestaticapps.net"
    echo "• Custom Domain: lunara-app.com (configure manually)"
    echo ""
    echo -e "${BLUE}💰 Monthly Cost Estimate:${NC}"
    echo "• Storage Account: ~$2"
    echo "• Static Web App: Free"
    echo "• Total: ~$2/month"
    echo ""
    echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
    echo "1. Deploy your Django backend to a different service (like Railway, Vercel, or Heroku)"
    echo "2. Update frontend API endpoints to point to your backend"
    echo "3. Configure CORS settings on your backend"
    echo "4. Set up your Neon PostgreSQL database connection"
    echo "5. Configure custom domain lunara-app.com"
    echo "6. Test the frontend application"
    echo ""
    echo -e "${YELLOW}🔧 Backend Deployment Alternatives:${NC}"
    echo "• Railway: railway.app (Free tier available)"
    echo "• Vercel: vercel.com (Free tier available)"
    echo "• Heroku: heroku.com (Free tier discontinued, but affordable plans)"
    echo "• DigitalOcean App Platform: digitalocean.com/products/app-platform"
    echo ""
    echo -e "${GREEN}✅ Lunara App frontend is ready for production!${NC}"
}

# Function to configure Storage Account settings
configure_storage() {
    echo -e "${YELLOW}Configuring Storage Account...${NC}"

    # Get storage account key
    STORAGE_KEY=$(az storage account keys list \
        --resource-group $RESOURCE_GROUP \
        --account-name $STORAGE_ACCOUNT \
        --query '[0].value' \
        --output tsv)

    echo -e "${GREEN}✅ Storage Account configured${NC}"
    echo -e "${BLUE}Storage Account Name: $STORAGE_ACCOUNT${NC}"
    echo -e "${BLUE}Storage Account Key: [HIDDEN]${NC}"

    # Save connection info to a file for later use
    echo "AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT" > azure-storage-config.txt
    echo "AZURE_STORAGE_ACCOUNT_KEY=$STORAGE_KEY" >> azure-storage-config.txt
    echo -e "${GREEN}✅ Storage configuration saved to azure-storage-config.txt${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Starting Lunara App Minimal Azure Deployment${NC}"
    echo "=============================================="

    check_azure_login

    echo ""
    echo -e "${YELLOW}📋 Resources to be created:${NC}"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• Storage Account: $STORAGE_ACCOUNT (~$2/month)"
    echo "• Static Web App: $STATIC_WEB_APP (Free tier)"
    echo ""
    echo -e "${BLUE}💰 Total estimated monthly cost: ~$2/month${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: Backend deployment skipped due to subscription limits${NC}"
    echo -e "${YELLOW}    We'll deploy frontend and storage, backend can use alternative services${NC}"
    echo ""

    read -p "Continue with minimal deployment? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi

    # Create resources
    create_resource_group
    echo ""

    create_storage_account
    echo ""

    configure_storage
    echo ""

    create_static_web_app
    echo ""

    # Display final summary
    deployment_summary
}

# Execute main function
main "$@"