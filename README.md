# Lunara.io

**Modern Project Management & Secure Communication Platform**

Lunara.io is a full-stack web application combining project management, secure messaging, and payment processing capabilities. Built with React, Django, and modern web technologies.

---

## 🌟 Features

- **Project Management**: Create, track, and manage projects with client information, deadlines, and priorities
- **Secure Messaging**: Real-time communication with end-to-end encryption
- **Payment Processing**: Integrated payment tracking and invoicing
- **User Authentication**: JWT-based authentication with secure session management
- **Responsive Design**: Mobile-first design with Power BI-style dashboard
- **Real-time Updates**: Live data synchronization across clients

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Testing**: Vitest + Playwright
- **Build Tool**: Vite

### Backend
- **Framework**: Django 5.0 + Django REST Framework
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT (djangorestframework-simplejwt)
- **API**: RESTful API architecture
- **Deployment**: Azure Container Apps

---

## 📋 Prerequisites

- **Node.js**: 20.x or higher
- **Python**: 3.10 or higher
- **PostgreSQL**: 14.x or higher (or Neon PostgreSQL)
- **npm**: 9.x or higher
- **pip**: Latest version

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/untitled114/lunaro.io.git
cd lunara.io
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Edit .env with your database credentials
# Required variables:
# - SECRET_KEY
# - DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

The backend API will be available at `http://localhost:8000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env with your configuration
# VITE_API_URL should point to your backend (http://localhost:8000/api for local dev)

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

---

## 📚 Documentation

Comprehensive documentation is available in the `/Documentation` directory:

- **[QA Master Report](Documentation/QA_MASTER_REPORT_2025-10-03.md)**: Complete QA documentation and test results
- **[API Integration Guide](Documentation/API_INTEGRATION.md)**: API endpoints and integration details
- **[Testing Guide](Documentation/TESTING_GUIDE.md)**: How to run tests and contribute
- **[Deployment Guides](Documentation/)**: Azure deployment and configuration

---

## 🧪 Testing

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run tests in UI mode
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
python manage.py test

# Run specific test module
python manage.py test apps.accounts.tests
```

---

## 🏗️ Project Structure

```
lunara.io/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services and utilities
│   │   ├── assets/          # Static assets
│   │   └── config/          # Configuration files
│   ├── e2e/                 # Playwright E2E tests
│   ├── public/              # Public static files
│   └── vite.config.js       # Vite configuration
│
├── backend/                  # Django backend application
│   ├── apps/
│   │   ├── accounts/        # User authentication
│   │   ├── projects/        # Project management
│   │   ├── messages/        # Messaging system
│   │   └── payments/        # Payment processing
│   ├── Lunara/              # Main Django project
│   └── manage.py
│
├── Documentation/            # Project documentation
│   ├── QA_MASTER_REPORT_2025-10-03.md
│   ├── API_INTEGRATION.md
│   ├── TESTING_GUIDE.md
│   └── deployment guides
│
└── .github/                 # GitHub workflows and CI/CD
```

---

## 🔒 Security

This project implements multiple security measures:

- **JWT Authentication**: Secure token-based authentication
- **Content Security Policy (CSP)**: Prevents XSS and injection attacks
- **CORS Protection**: Configured CORS headers for API security
- **Environment Variables**: Sensitive data stored in .env files (not in version control)
- **Input Validation**: All user inputs validated on backend
- **HTTPS**: Production deployment uses HTTPS only

**IMPORTANT**: Never commit `.env` files containing real credentials to version control.

---

## 📦 Deployment

### Frontend (Azure Static Web Apps)

The frontend is deployed to Azure Static Web Apps with automatic deployments via GitHub Actions.

```bash
# Build for production
cd frontend
npm run build

# The build output will be in frontend/dist/
```

### Backend (Azure Container Apps)

The backend is deployed as a Docker container to Azure Container Apps.

```bash
# Build Docker image
cd backend
docker build -t lunara-api .

# See Documentation/AZURE_DEPLOYMENT_FIX.md for complete deployment guide
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`npm run test` and `python manage.py test`)
- Code follows existing style conventions
- Documentation is updated if needed

---

## 📊 Current Status

**Version**: 1.0.0 Beta
**QA Status**: 90% Complete
**Test Coverage**:
- E2E Tests: 100% passing (Chromium)
- Unit Tests: 82% passing
- Security Grade: B+

See [QA Master Report](Documentation/QA_MASTER_REPORT_2025-10-03.md) for detailed metrics.

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Team

Developed by the Lunara.io team.

---

## 📞 Support

For issues, questions, or contributions:
- **Issues**: [GitHub Issues](https://github.com/untitled114/lunaro.io/issues)
- **Documentation**: See `/Documentation` directory
- **Email**: [Your contact email]

---

## 🗺️ Roadmap

- [ ] Complete production security audit
- [ ] Implement real-time notifications
- [ ] Add advanced project analytics
- [ ] Mobile app development
- [ ] API v2 with GraphQL support
- [ ] Enhanced payment gateway integrations

---

**Built with ❤️ by the Lunara.io team**
