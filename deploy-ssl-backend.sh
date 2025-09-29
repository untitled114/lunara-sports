#!/bin/bash

# Deploy Lunara Backend with NGINX SSL Termination
# This creates a container group with Django backend + NGINX proxy

echo "🚀 Deploying Lunara Backend with SSL Termination"
echo "=================================================="

# Variables
RESOURCE_GROUP="lunara-app-rg"
CONTAINER_GROUP_NAME="lunara-backend-ssl"
LOCATION="eastus"
REGISTRY_NAME="lunaraappregistry"
DNS_LABEL="lunara-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking Azure CLI login...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
else
    SUBSCRIPTION=$(az account show --query name -o tsv)
    echo -e "${GREEN}✅ Logged in: $SUBSCRIPTION${NC}"
fi

echo -e "${YELLOW}Building and pushing NGINX image...${NC}"

# Build NGINX image locally
cd nginx
docker build -t lunara-nginx:latest .

# Tag for registry
docker tag lunara-nginx:latest ${REGISTRY_NAME}.azurecr.io/lunara-nginx:latest

# Push to registry
echo -e "${YELLOW}Pushing NGINX image to registry...${NC}"
az acr login --name $REGISTRY_NAME
docker push ${REGISTRY_NAME}.azurecr.io/lunara-nginx:latest

cd ..

echo -e "${YELLOW}Deploying container group with SSL termination...${NC}"

# Create container group with both containers
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_GROUP_NAME \
  --location $LOCATION \
  --dns-name-label $DNS_LABEL \
  --ports 80 443 \
  --cpu 1.5 \
  --memory 2 \
  --registry-login-server ${REGISTRY_NAME}.azurecr.io \
  --registry-username $REGISTRY_NAME \
  --registry-password $(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv) \
  --image ${REGISTRY_NAME}.azurecr.io/lunara-nginx:latest \
  --environment-variables \
    BACKEND_HOST=localhost \
    BACKEND_PORT=8000 \
  --yaml <<EOF
apiVersion: 2019-12-01
location: $LOCATION
name: $CONTAINER_GROUP_NAME
properties:
  containers:
  - name: nginx-ssl
    properties:
      image: ${REGISTRY_NAME}.azurecr.io/lunara-nginx:latest
      ports:
      - port: 80
        protocol: TCP
      - port: 443
        protocol: TCP
      resources:
        requests:
          cpu: 0.5
          memoryInGb: 0.5
  - name: django-backend
    properties:
      image: ${REGISTRY_NAME}.azurecr.io/lunara-backend:latest
      ports:
      - port: 8000
        protocol: TCP
      environmentVariables:
      - name: SECRET_KEY
        value: "RglSPABALP5hJ%w5CsM(E)a%nU)@7shorZ%9yxUSdugqD\\MRKP"
      - name: DEBUG
        value: "False"
      - name: DB_NAME
        value: "neondb"
      - name: DB_USER
        value: "neondb_owner"
      - name: DB_PASSWORD
        value: "npg_i8Po2sLuDUJl"
      - name: DB_HOST
        value: "ep-cold-night-a8z0ndqj-pooler.eastus2.azure.neon.tech"
      - name: DB_PORT
        value: "5432"
      - name: DJANGO_SETTINGS_MODULE
        value: "safesend.settings.production"
      resources:
        requests:
          cpu: 1.0
          memoryInGb: 1.5
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
    dnsNameLabel: $DNS_LABEL
tags: {}
type: Microsoft.ContainerInstance/containerGroups
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container group deployed successfully!${NC}"
    echo -e "${BLUE}🌐 Backend will be available at:${NC}"
    echo -e "   HTTP:  http://${DNS_LABEL}.${LOCATION}.azurecontainer.io"
    echo -e "   HTTPS: https://${DNS_LABEL}.${LOCATION}.azurecontainer.io"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "1. Wait 2-3 minutes for containers to start"
    echo "2. Update frontend API URL to use HTTPS endpoint"
    echo "3. Test SSL connection"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Checking deployment status...${NC}"
az container show \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_GROUP_NAME \
  --query "{name: name, state: instanceView.state, ip: ipAddress.ip, fqdn: ipAddress.fqdn}" \
  --output table