# 🏗️ NEW AZURE ARCHITECTURE PLAN

**Custom Domain**: `lunara-app.com`
**Region**: East US
**Architecture**: Clean, optimized, production-ready

---

## 📋 **CURRENT PROJECT SPECIFICATIONS**

### **Frontend**
- **Type**: Static Web App (SPA)
- **Files**: 11 HTML pages + CSS/JS assets
- **Framework**: Vanilla JavaScript with API integration
- **Security**: CSP headers, CORS protection
- **Features**: Authentication, dashboard, projects, payments

### **Backend**
- **Framework**: Django 4.2.7 + DRF 3.14.0
- **Authentication**: JWT tokens with refresh
- **Database**: PostgreSQL (Neon cloud)
- **Storage**: Azure Blob (media files)
- **Cache**: Redis (Azure Cache)
- **Server**: Gunicorn with 2 workers

### **Database Configuration**
```
Engine: PostgreSQL
Host: ep-cold-night-a8z0ndqj-pooler.eastus2.azure.neon.tech
Port: 5432
SSL: Required
```

---

## 🎯 **NEW ARCHITECTURE DESIGN**

### **1. RESOURCE GROUP**
```
Name: lunara-production-rg
Location: East US
Purpose: Clean slate for all Lunara resources
```

### **2. FRONTEND - Azure Static Web Apps**
```
Name: lunara-frontend
Custom Domain: lunara-app.com (primary)
Alternate: www.lunara-app.com
Source: GitHub repository
Build:
  - App location: ./frontend
  - API location: "" (no integrated API)
  - Output location: ""
Features:
  - HTTPS enforced
  - Custom domain support
  - GitHub Actions CI/CD
  - Global CDN distribution
```

### **3. BACKEND - Azure Container Apps**
```
Name: lunara-api
Environment: lunara-container-env
Image: Django application
Ingress: External, HTTPS only
Custom Domain: api.lunara-app.com
Port: 8000
Scaling:
  - Min replicas: 1
  - Max replicas: 10
  - CPU: 1.0 cores
  - Memory: 2Gi
Health Check: /health/
```

### **4. CONTAINER REGISTRY**
```
Name: lunararegistry
SKU: Basic
Admin Enabled: Yes
Location: East US
Purpose: Store Django container images
```

### **5. ENVIRONMENT VARIABLES (Container Apps)**
```
SECRET_KEY: [Django secret key]
DEBUG: False
DB_NAME: neondb
DB_USER: neondb_owner
DB_PASSWORD: [from secrets]
DB_HOST: ep-cold-night-a8z0ndqj-pooler.eastus2.azure.neon.tech
DB_PORT: 5432
DJANGO_SETTINGS_MODULE: safesend.settings.production
ALLOWED_HOSTS: api.lunara-app.com,lunara-app.com,localhost
```

---

## 🌐 **DOMAIN CONFIGURATION**

### **DNS Records (GoDaddy)**
```
Type    Name    Value                           TTL
A       @       [Static Web App IP]             600
CNAME   www     [Static Web App hostname]       600
CNAME   api     [Container Apps hostname]       600
TXT     @       [Domain verification]           600
```

### **SSL Certificates**
- **Frontend**: Automatic (Azure Static Web Apps)
- **Backend**: Automatic (Azure Container Apps)
- **Validation**: Domain ownership via TXT record

---

## 🔧 **DEPLOYMENT PIPELINE**

### **GitHub Actions Workflow**
```yaml
# .github/workflows/deploy-production.yml
Frontend: Azure Static Web Apps deployment
Backend: Container Apps deployment with ACR
Triggers: Push to main branch
Environment: Production secrets
```

### **Build Process**
1. **Frontend**: Direct deployment (no build step)
2. **Backend**: Docker build → ACR → Container Apps
3. **Database**: External Neon PostgreSQL (no changes)

---

## 📊 **ESTIMATED COSTS**

| Resource | Monthly Cost |
|----------|-------------|
| Static Web Apps (Free tier) | $0 |
| Container Apps (1-2 replicas) | $15-30 |
| Container Registry (Basic) | $5 |
| Custom Domain SSL | $0 |
| **Total** | **$20-35** |

**Savings**: ~$20-30/month vs current redundant setup

---

## 🎯 **ADVANTAGES OF NEW SETUP**

### **Performance**
✅ Global CDN for frontend
✅ Container Apps auto-scaling
✅ Optimized container images
✅ Reduced latency with custom domains

### **Reliability**
✅ No resource conflicts
✅ Clean architecture
✅ Proper health checks
✅ Automatic SSL renewal

### **Maintainability**
✅ Single resource group
✅ Clear naming convention
✅ Simplified deployment
✅ Better monitoring

### **Security**
✅ HTTPS everywhere
✅ Custom domains
✅ Proper CORS configuration
✅ Environment variable secrets

---

## ⚠️ **CRITICAL VERIFICATION CHECKLIST**

Before I proceed, please confirm these specifications are accurate:

### **Domains**
- [ ] **Primary**: `lunara-app.com` (correct?)
- [ ] **API**: `api.lunara-app.com` (acceptable?)
- [ ] **WWW**: `www.lunara-app.com` (redirect to primary?)

### **Database**
- [ ] **Keep current Neon PostgreSQL** (no changes?)
- [ ] **Host**: `ep-cold-night-a8z0ndqj-pooler.eastus2.azure.neon.tech`
- [ ] **Database**: `neondb`

### **Region**
- [ ] **East US** (optimal for your users?)

### **Naming Convention**
- [ ] **Resource Group**: `lunara-production-rg`
- [ ] **Frontend**: `lunara-frontend`
- [ ] **Backend**: `lunara-api`
- [ ] **Registry**: `lunararegistry`

---

**🚨 PLEASE CONFIRM ALL SPECIFICATIONS ARE CORRECT BEFORE I PROCEED!**

I will not create any resources until you verify this plan is accurate.