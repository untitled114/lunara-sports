#!/bin/bash

# Azure Container Instance Deployment for Lunara Backend
# This deploys Django backend using Azure Container Instances
# Date: September 2025

set -e

# Configuration
RESOURCE_GROUP="lunara-app-rg"
LOCATION="eastus"
CONTAINER_NAME="lunara-app-backend"
ACR_NAME="lunaraappregistry"
IMAGE_NAME="lunara-backend"
TAG="latest"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Lunara Backend Container Deployment${NC}"
echo "======================================"

# Check Azure login
check_azure_login() {
    echo -e "${YELLOW}Checking Azure CLI login...${NC}"
    if ! az account show > /dev/null 2>&1; then
        echo -e "${RED}❌ Not logged into Azure CLI${NC}"
        exit 1
    fi
    SUBSCRIPTION=$(az account show --query name --output tsv)
    echo -e "${GREEN}✅ Logged in: $SUBSCRIPTION${NC}"
}

# Create Azure Container Registry
create_acr() {
    echo -e "${YELLOW}Creating Azure Container Registry...${NC}"

    # Check if ACR exists
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ACR already exists: $ACR_NAME${NC}"
    else
        az acr create \
            --resource-group $RESOURCE_GROUP \
            --name $ACR_NAME \
            --sku Basic \
            --location $LOCATION \
            --admin-enabled true \
            --output table
        echo -e "${GREEN}✅ ACR created: $ACR_NAME${NC}"
    fi
}

# Build and push Docker image
build_and_push() {
    echo -e "${YELLOW}Building and pushing Docker image...${NC}"

    # Login to ACR
    az acr login --name $ACR_NAME

    # Get ACR login server
    ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

    # Build image
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t $ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG ./backend/

    # Push image
    echo -e "${YELLOW}Pushing to registry...${NC}"
    docker push $ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG

    echo -e "${GREEN}✅ Image pushed: $ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG${NC}"
}

# Deploy Container Instance
deploy_container() {
    echo -e "${YELLOW}Deploying container instance...${NC}"

    # Get ACR credentials
    ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)
    ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

    # Read environment variables
    source backend/.env

    az container create \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_NAME \
        --image $ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG \
        --cpu 1 \
        --memory 1 \
        --registry-login-server $ACR_LOGIN_SERVER \
        --registry-username $ACR_USERNAME \
        --registry-password $ACR_PASSWORD \
        --dns-name-label $CONTAINER_NAME \
        --ports 8000 \
        --environment-variables \
            SECRET_KEY="$SECRET_KEY" \
            DEBUG="False" \
            DB_NAME="$DB_NAME" \
            DB_USER="$DB_USER" \
            DB_PASSWORD="$DB_PASSWORD" \
            DB_HOST="$DB_HOST" \
            DB_PORT="$DB_PORT" \
            DJANGO_SETTINGS_MODULE="safesend.settings.production" \
        --location $LOCATION \
        --output table

    echo -e "${GREEN}✅ Container deployed: $CONTAINER_NAME${NC}"
}

# Get container status and URL
get_container_info() {
    echo -e "${YELLOW}Getting container information...${NC}"

    CONTAINER_IP=$(az container show \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_NAME \
        --query ipAddress.ip \
        --output tsv)

    CONTAINER_FQDN=$(az container show \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_NAME \
        --query ipAddress.fqdn \
        --output tsv)

    echo -e "${GREEN}✅ Container Info:${NC}"
    echo "• IP Address: $CONTAINER_IP"
    echo "• FQDN: $CONTAINER_FQDN"
    echo "• Backend URL: https://$CONTAINER_FQDN:8000"
}

# Update frontend API endpoint
update_frontend_api() {
    echo -e "${YELLOW}Updating frontend API endpoint...${NC}"

    CONTAINER_FQDN=$(az container show \
        --resource-group $RESOURCE_GROUP \
        --name $CONTAINER_NAME \
        --query ipAddress.fqdn \
        --output tsv)

    # Update api.js with actual container URL
    sed -i "s|https://lunara-app-backend.azurecontainer.io|https://$CONTAINER_FQDN:8000|g" frontend/js/api.js

    echo -e "${GREEN}✅ Frontend API endpoint updated${NC}"
}

# Deployment summary
deployment_summary() {
    echo -e "${GREEN}🎉 BACKEND DEPLOYMENT COMPLETE!${NC}"
    echo "================================="
    echo ""
    echo -e "${BLUE}📋 DEPLOYED RESOURCES:${NC}"
    echo "• Container Registry: $ACR_NAME"
    echo "• Container Instance: $CONTAINER_NAME"
    echo "• Backend API: https://$CONTAINER_FQDN:8000"
    echo ""
    echo -e "${BLUE}💰 Monthly Cost Estimate:${NC}"
    echo "• Container Registry: ~$5"
    echo "• Container Instance: ~$15"
    echo "• Storage Account: ~$2"
    echo "• Total: ~$22/month"
    echo ""
    echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
    echo "1. Test backend API endpoints"
    echo "2. Push frontend changes to trigger Static Web App deployment"
    echo "3. Configure CORS settings if needed"
    echo "4. Set up SSL certificate for custom domain"
    echo ""
    echo -e "${GREEN}✅ Lunara App is now fully deployed on Azure!${NC}"
}

# Main execution
main() {
    check_azure_login
    echo ""

    read -p "Continue with backend container deployment? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi

    create_acr
    echo ""

    build_and_push
    echo ""

    deploy_container
    echo ""

    get_container_info
    echo ""

    update_frontend_api
    echo ""

    deployment_summary
}

# Execute main function
main "$@"