# Testing Guide

## Overview

Comprehensive testing strategy for Lunara.io covering unit tests, integration tests, and end-to-end tests.

---

## Testing Stack

### Unit & Integration Tests
- **Framework**: Jest
- **React Testing**: React Testing Library (RTL)
- **Coverage**: 80% target

### E2E Tests
- **Framework**: Cypress or Playwright
- **Browser Coverage**: Chrome, Firefox, Safari (mobile)

### CI/CD
- **Platform**: GitHub Actions
- **Trigger**: On PR and push to main

---

## Setup

### 1. Install Dependencies

```bash
cd frontend

# Unit tests
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom

# E2E tests
npm install --save-dev cypress
# OR
npm install --save-dev @playwright/test
```

### 2. Jest Configuration

Create `frontend/jest.config.js`:

```javascript
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/main.jsx',
    '!src/vite-env.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  }
};
```

### 3. Setup File

Create `frontend/src/setupTests.js`:

```javascript
import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_API_URL = 'http://localhost:3000/api';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

### 4. Package.json Scripts

Add to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "cypress open",
    "test:e2e:headless": "cypress run"
  }
}
```

---

## Unit Tests

### Testing API Service

`frontend/src/services/__tests__/api.test.js`:

```javascript
import { projectsAPI, APIError } from '../api';

describe('Projects API', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.setItem('auth_token', 'test-token');
  });

  test('fetches projects successfully', async () => {
    const mockProjects = [
      { id: 1, title: 'Project 1' },
      { id: 2, title: 'Project 2' }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockProjects
    });

    const projects = await projectsAPI.getAll();

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/projects',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
    expect(projects).toEqual(mockProjects);
  });

  test('creates project successfully', async () => {
    const newProject = { title: 'New Project', client: 'Client A' };
    const createdProject = { id: 1, ...newProject };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createdProject
    });

    const result = await projectsAPI.create(newProject);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newProject)
      })
    );
    expect(result).toEqual(createdProject);
  });

  test('handles 401 unauthorized error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' })
    });

    await expect(projectsAPI.getAll()).rejects.toThrow(APIError);
    await expect(projectsAPI.getAll()).rejects.toMatchObject({
      status: 401,
      isClientError: true
    });
  });

  test('retries on network error', async () => {
    fetch
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

    const result = await projectsAPI.getAll();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });
});
```

### Testing Components

`frontend/src/components/__tests__/NewProjectModal.test.jsx`:

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NewProjectModal from '../NewProjectModal';
import { ToastProvider } from '../../contexts/ToastContext';
import * as api from '../../services/api';

// Mock API
jest.mock('../../services/api');

const MockedModal = ({ isOpen, onClose }) => (
  <BrowserRouter>
    <ToastProvider>
      <NewProjectModal isOpen={isOpen} onClose={onClose} />
    </ToastProvider>
  </BrowserRouter>
);

describe('NewProjectModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders when open', () => {
    render(<MockedModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/project title/i)).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<MockedModal isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByText('Create New Project')).not.toBeInTheDocument();
  });

  test('validates required fields', async () => {
    render(<MockedModal isOpen={true} onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /create project/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
    });

    expect(api.projectsAPI.create).not.toHaveBeenCalled();
  });

  test('submits form with valid data', async () => {
    api.projectsAPI.create.mockResolvedValue({ id: 1, title: 'Test Project' });

    render(<MockedModal isOpen={true} onClose={mockOnClose} />);

    await userEvent.type(screen.getByLabelText(/project title/i), 'Test Project');
    await userEvent.type(screen.getByLabelText(/client name/i), 'Test Client');
    await userEvent.type(screen.getByLabelText(/project value/i), '1000');
    await userEvent.type(screen.getByLabelText(/deadline/i), '2025-12-31');

    const submitButton = screen.getByRole('button', { name: /create project/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.projectsAPI.create).toHaveBeenCalledWith({
        title: 'Test Project',
        client: 'Test Client',
        description: '',
        value: '1000',
        deadline: '2025-12-31',
        priority: 'medium'
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('handles API error', async () => {
    api.projectsAPI.create.mockRejectedValue(
      new api.APIError('Server error', 500)
    );

    render(<MockedModal isOpen={true} onClose={mockOnClose} />);

    await userEvent.type(screen.getByLabelText(/project title/i), 'Test Project');
    await userEvent.type(screen.getByLabelText(/client name/i), 'Test Client');
    await userEvent.type(screen.getByLabelText(/project value/i), '1000');
    await userEvent.type(screen.getByLabelText(/deadline/i), '2025-12-31');

    const submitButton = screen.getByRole('button', { name: /create project/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
```

---

## Integration Tests

### Testing Page Interactions

`frontend/src/components/dashboard/__tests__/Projects.integration.test.jsx`:

```javascript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Projects from '../Projects';
import { ToastProvider } from '../../../contexts/ToastContext';
import * as api from '../../../services/api';

jest.mock('../../../services/api');

const MockedProjects = () => (
  <BrowserRouter>
    <ToastProvider>
      <Projects />
    </ToastProvider>
  </BrowserRouter>
);

describe('Projects Page Integration', () => {
  const mockProjects = [
    {
      id: 1,
      title: 'Project A',
      client: 'Client A',
      status: 'active',
      progress: 75,
      value: '$2,500',
      deadline: '2 days',
      priority: 'high',
      description: 'Test project A'
    },
    {
      id: 2,
      title: 'Project B',
      client: 'Client B',
      status: 'review',
      progress: 90,
      value: '$3,800',
      deadline: 'Overdue',
      priority: 'critical',
      description: 'Test project B'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.projectsAPI.getAll.mockResolvedValue(mockProjects);
  });

  test('filters projects by status', async () => {
    render(<MockedProjects />);

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
      expect(screen.getByText('Project B')).toBeInTheDocument();
    });

    // Click "Active" filter
    const activeFilter = screen.getByRole('button', { name: /^active$/i });
    await userEvent.click(activeFilter);

    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.queryByText('Project B')).not.toBeInTheDocument();
  });

  test('searches projects by name', async () => {
    render(<MockedProjects />);

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search projects/i);
    await userEvent.type(searchInput, 'Project B');

    await waitFor(() => {
      expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      expect(screen.getByText('Project B')).toBeInTheDocument();
    });
  });

  test('sorts projects by priority', async () => {
    render(<MockedProjects />);

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    const sortSelect = screen.getByRole('combobox');
    await userEvent.selectOptions(sortSelect, 'priority');

    // Project B (critical) should appear before Project A (high)
    const projects = screen.getAllByText(/Project [AB]/);
    expect(projects[0]).toHaveTextContent('Project B');
    expect(projects[1]).toHaveTextContent('Project A');
  });
});
```

---

## E2E Tests (Cypress)

### Setup

```bash
npm install --save-dev cypress
npx cypress open
```

### Configuration

`cypress.config.js`:

```javascript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    API_URL: 'http://localhost:3000/api'
  }
});
```

### Test: Project Creation Flow

`cypress/e2e/projects.cy.js`:

```javascript
describe('Project Creation', () => {
  beforeEach(() => {
    // Login first
    cy.visit('/signin');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.visit('/projects');
  });

  it('creates a new project successfully', () => {
    // Click "New Project" button
    cy.contains('button', '+ New Project').click();

    // Fill form
    cy.get('input[name="title"]').type('E-commerce Dashboard');
    cy.get('input[name="client"]').type('TechCorp');
    cy.get('textarea[name="description"]').type('Modern React dashboard');
    cy.get('input[name="value"]').type('2500');
    cy.get('input[name="deadline"]').type('2025-12-31');
    cy.get('select[name="priority"]').select('high');

    // Submit form
    cy.contains('button', 'Create Project').click();

    // Verify success
    cy.contains('Project created successfully!').should('be.visible');
    cy.contains('E-commerce Dashboard').should('be.visible');
  });

  it('validates required fields', () => {
    cy.contains('button', '+ New Project').click();

    // Try to submit empty form
    cy.contains('button', 'Create Project').click();

    // Verify error message
    cy.contains('Please fill in all required fields').should('be.visible');
  });
});
```

### Test: Message Sending

`cypress/e2e/messages.cy.js`:

```javascript
describe('Message Sending', () => {
  beforeEach(() => {
    cy.login(); // Custom command
    cy.visit('/messages');
  });

  it('sends a message successfully', () => {
    cy.get('input[name="to"]').type('client@example.com');
    cy.get('textarea[name="message"]').type('Project update: Design phase completed!');

    cy.contains('button', 'Send Message').click();

    cy.contains('Message sent').should('be.visible');
    cy.get('input[name="to"]').should('have.value', '');
    cy.get('textarea[name="message"]').should('have.value', '');
  });
});
```

### Custom Commands

`cypress/support/commands.js`:

```javascript
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
  cy.session([email, password], () => {
    cy.visit('/signin');
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

---

## GitHub Actions CI

`.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run unit tests
        working-directory: ./frontend
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run E2E tests
        working-directory: ./frontend
        run: npm run test:e2e:headless

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: cypress-screenshots
          path: frontend/cypress/screenshots
```

---

## Coverage Goals

### Minimum Coverage

- **Lines**: 80%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 80%

### Priority Areas

1. **API Service** - 95% coverage
2. **Form Components** - 90% coverage
3. **Error Handling** - 85% coverage
4. **Auth Flows** - 90% coverage
5. **UI Components** - 70% coverage

---

## Testing Checklist

### Before Deployment

- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] Coverage meets minimum thresholds
- [ ] No console errors in tests
- [ ] Accessibility tests passing
- [ ] Performance tests passing
- [ ] Mobile responsive tests passing

### Regression Testing

- [ ] Project creation
- [ ] Message sending
- [ ] Search/filter/sort
- [ ] Authentication flow
- [ ] Error handling
- [ ] Offline mode
- [ ] Loading states

---

## Troubleshooting

### Tests Failing Locally

```bash
# Clear cache
npm test -- --clearCache

# Update snapshots
npm test -- -u

# Run specific test
npm test -- NewProjectModal
```

### Cypress Issues

```bash
# Clear Cypress cache
npx cypress cache clear

# Verify installation
npx cypress verify

# Debug mode
npx cypress open --browser chrome
```

---

## Next Steps

1. Write tests for remaining components
2. Add visual regression testing (Percy, Chromatic)
3. Add performance testing (Lighthouse CI)
4. Add accessibility testing (axe-core)
5. Set up test coverage reporting

---

**Last Updated**: 2025-10-02
