# React API Integration Guide

## Overview

Your React components can now communicate with the Django backend using the **ReactAPI bridge**. This guide shows you how to use the API in your React components.

---

## Setup (Already Done ✅)

1. ✅ **LunaraAPI** - Core API client (`js/api.js`)
2. ✅ **ReactAPI Bridge** - React wrapper (`js/react-api-bridge.js`)
3. ✅ **Django CORS** - Allows frontend requests
4. ✅ **Scripts loaded** - Proper order in index.html

---

## API Configuration

### Automatic Environment Detection

The API automatically detects your environment:

```javascript
// Development (localhost/127.0.0.1)
baseURL: 'http://127.0.0.1:8000/api'

// Production (lunara-app.com)
baseURL: 'https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api'
```

No configuration needed!

---

## Available API Methods

### Authentication

```javascript
// Check if user is logged in
const isAuth = await window.ReactAPI.isAuthenticated();
// Returns: true or false

// Get current user data
const user = await window.ReactAPI.getCurrentUser();
// Returns: { id, email, username, first_name, last_name, user_type, profile }

// Login
const result = await window.ReactAPI.login('user@example.com', 'password123');
// Returns: { user, access, refresh }

// Register new user
const newUser = await window.ReactAPI.register({
  email: 'new@example.com',
  username: 'newuser',
  password: 'password123',
  user_type: 'freelancer'  // or 'client'
});
// Returns: { user, access, refresh }

// Logout
await window.ReactAPI.logout();
// Returns: void (clears tokens and redirects)
```

### Projects

```javascript
// Get all projects
const projects = await window.ReactAPI.getProjects();
// Returns: [{ id, title, description, total_amount, status, ... }]

// Get single project
const project = await window.ReactAPI.getProject(projectId);
// Returns: { id, title, description, milestones, ... }

// Create new project
const newProject = await window.ReactAPI.createProject({
  title: 'My New Project',
  description: 'Project description',
  total_amount: 5000.00,
  deadline: '2025-12-31T23:59:59Z',
  currency: 'USD',
  status: 'draft'
});
// Returns: { id, title, ... }

// Update project
const updated = await window.ReactAPI.updateProject(projectId, {
  title: 'Updated Title',
  status: 'active'
});
// Returns: { id, title, ... }

// Delete project
await window.ReactAPI.deleteProject(projectId);
// Returns: void
```

### Dashboard

```javascript
// Get dashboard data (stats + projects)
const data = await window.ReactAPI.getDashboardData();
// Returns: {
//   stats: {
//     active_projects: 5,
//     completed_projects: 12,
//     total_earned: 25000.00,
//     pending_payments: 2,
//     overdue_tasks: 1,
//     ...
//   },
//   projects: [...]
// }
```

### Utilities

```javascript
// Get API base URL
const url = window.ReactAPI.getBaseURL();
// Returns: 'http://127.0.0.1:8000/api' or production URL

// Check if development mode
const isDev = window.ReactAPI.isDevelopment();
// Returns: true or false

// Handle errors consistently
const message = window.ReactAPI.handleError(error, 'Creating project');
// Returns: User-friendly error message string
```

---

## Usage Patterns

### Pattern 1: Component with Data Fetching

```jsx
const MyComponent = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const result = await window.ReactAPI.getProjects();
        setData(result);
      } catch (err) {
        setError(window.ReactAPI.handleError(err, 'Fetching projects'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []); // Empty array = run once on mount

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div>
      {data.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
};
```

### Pattern 2: Authentication Check

```jsx
const ProtectedComponent = () => {
  const [isAuth, setIsAuth] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    async function checkAuth() {
      const authenticated = await window.ReactAPI.isAuthenticated();
      setIsAuth(authenticated);
      setChecking(false);

      if (!authenticated) {
        // Redirect to signin
        window.location.href = '/signin.html';
      }
    }

    checkAuth();
  }, []);

  if (checking) return <div>Checking authentication...</div>;
  if (!isAuth) return null; // Will redirect

  return <div>Protected content here</div>;
};
```

### Pattern 3: Form Submission

```jsx
const CreateProjectForm = () => {
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    amount: ''
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const projectData = {
        title: formData.title,
        description: formData.description,
        total_amount: parseFloat(formData.amount),
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'USD',
        status: 'draft'
      };

      const newProject = await window.ReactAPI.createProject(projectData);
      setMessage(`✅ Project created: ${newProject.title}`);

      // Reset form
      setFormData({ title: '', description: '', amount: '' });
    } catch (err) {
      setMessage(`❌ ${window.ReactAPI.handleError(err, 'Creating project')}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Project title"
        disabled={submitting}
      />
      <textarea
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Description"
        disabled={submitting}
      />
      <input
        type="number"
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        placeholder="Amount"
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Project'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
};
```

### Pattern 4: Dynamic Button Behavior

```jsx
const DynamicButton = () => {
  const [isAuth, setIsAuth] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function checkAuth() {
      const auth = await window.ReactAPI.isAuthenticated();
      setIsAuth(auth);
      setLoading(false);
    }
    checkAuth();
  }, []);

  const handleClick = (e) => {
    e.preventDefault();
    if (isAuth) {
      window.location.href = '/dashboard.html';
    } else {
      window.location.href = '/signup.html';
    }
  };

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? '...' : isAuth ? 'Go to Dashboard' : 'Get Started'}
    </button>
  );
};
```

### Pattern 5: Real-time Updates

```jsx
const LiveStats = () => {
  const [stats, setStats] = React.useState(null);
  const [lastUpdate, setLastUpdate] = React.useState(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const data = await window.ReactAPI.getDashboardData();
        setStats(data.stats);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }

    // Initial fetch
    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h3>Live Stats</h3>
      <p>Active Projects: {stats.active_projects}</p>
      <p>Total Earned: ${stats.total_earned}</p>
      <small>Updated: {lastUpdate?.toLocaleTimeString()}</small>
    </div>
  );
};
```

---

## Error Handling

### Standard Error Handling Pattern

```jsx
try {
  const result = await window.ReactAPI.someMethod();
  // Handle success
  setData(result);
} catch (error) {
  // Handle error
  const errorMessage = window.ReactAPI.handleError(error, 'Operation description');
  setError(errorMessage);

  // Optionally show toast/notification
  console.error('API Error:', error);
}
```

### Common Error Types

```javascript
// Network errors
catch (error) {
  if (error.message.includes('NetworkError')) {
    // Network is down or CORS issue
  }
}

// Authentication errors
catch (error) {
  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    // Redirect to login
    window.location.href = '/signin.html';
  }
}

// Validation errors
catch (error) {
  if (error.message.includes('400') || error.message.includes('Invalid')) {
    // Show validation message to user
  }
}
```

---

## Testing API Calls

### In Browser Console

Open browser console and test:

```javascript
// Check if API is available
window.ReactAPI

// Test authentication
window.ReactAPI.isAuthenticated()

// Test fetching data
window.ReactAPI.getProjects().then(console.log)

// Test with authentication
window.ReactAPI.getCurrentUser().then(console.log)
```

### Debug Logging

The API automatically logs important events:

```
✅ React API Bridge initialized
✅ React API Bridge connected to LunaraAPI
```

---

## Real-World Examples

### Example 1: Enhanced Hero Section

See: `react-components/HeroEnhanced.jsx.example`

Features:
- Checks if user is logged in
- Shows personalized greeting
- Changes button text based on auth status
- Falls back gracefully if API unavailable

### Example 2: API Usage Reference

See: `react-components/API_USAGE_EXAMPLE.jsx`

Includes:
- Authentication examples
- Data fetching patterns
- Form submissions
- Real-time updates
- Error handling

---

## Django API Endpoints

Your backend provides these endpoints:

### Authentication Endpoints
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login user
- `POST /api/auth/logout/` - Logout user
- `POST /api/auth/refresh/` - Refresh access token
- `GET /api/auth/me/` - Get current user

### Project Endpoints
- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create project
- `GET /api/projects/{id}/` - Get project detail
- `PUT /api/projects/{id}/` - Update project
- `DELETE /api/projects/{id}/` - Delete project
- `GET /api/projects/dashboard/` - Get dashboard data

### Payment Endpoints
- `GET /api/payments/` - List transactions
- `POST /api/payments/` - Create transaction
- `GET /api/payments/{id}/` - Get transaction detail

---

## Security Notes

### Authentication

All API requests automatically include:
- JWT access token in `Authorization` header
- Automatic token refresh on 401 errors
- Secure token storage in localStorage

### CORS

Development CORS settings (in `development.py`):
```python
CORS_ALLOW_ALL_ORIGINS = True  # For development only
```

Production CORS (in `production.py`):
```python
CORS_ALLOWED_ORIGINS = [
    "https://lunara-app.com",
    "https://salmon-coast-0c72e310f.2.azurestaticapps.net"
]
```

### CSRF

CSRF protection disabled for API endpoints in development.
Enabled via JWT tokens in production.

---

## Troubleshooting

### Issue: API calls return 401 Unauthorized

**Solution:** User not logged in or token expired.
```jsx
const isAuth = await window.ReactAPI.isAuthenticated();
if (!isAuth) {
  window.location.href = '/signin.html';
}
```

### Issue: API calls return 404 Not Found

**Solution:** Check endpoint URL or Django server not running.
```javascript
// Check if server is running
console.log('API Base URL:', window.ReactAPI.getBaseURL());
```

### Issue: CORS errors in console

**Solution:** Check Django CORS settings.
```python
# In development.py
CORS_ALLOW_ALL_ORIGINS = True
```

### Issue: ReactAPI not available

**Solution:** React API bridge not loaded.
```html
<!-- Ensure this is in index.html before React components -->
<script src="/js/react-api-bridge.js"></script>
```

---

## Best Practices

### 1. Always Handle Errors

```jsx
try {
  const data = await window.ReactAPI.getProjects();
  setData(data);
} catch (error) {
  setError(window.ReactAPI.handleError(error, 'Fetching projects'));
}
```

### 2. Show Loading States

```jsx
const [loading, setLoading] = React.useState(true);

// ... fetch data ...

if (loading) return <div>Loading...</div>;
```

### 3. Check Authentication First

```jsx
React.useEffect(() => {
  async function init() {
    const isAuth = await window.ReactAPI.isAuthenticated();
    if (!isAuth) {
      window.location.href = '/signin.html';
      return;
    }
    // Continue with protected actions...
  }
  init();
}, []);
```

### 4. Use useEffect for Data Fetching

```jsx
React.useEffect(() => {
  async function fetchData() {
    const data = await window.ReactAPI.getProjects();
    setProjects(data);
  }
  fetchData();
}, []); // Empty deps = run once
```

### 5. Clean Up Intervals

```jsx
React.useEffect(() => {
  const interval = setInterval(fetchData, 30000);
  return () => clearInterval(interval); // Cleanup
}, []);
```

---

## Next Steps

1. ✅ API bridge is loaded and working
2. ✅ Try examples in `API_USAGE_EXAMPLE.jsx`
3. ✅ Test enhanced Hero: `HeroEnhanced.jsx.example`
4. ✅ Build your own API-driven components
5. ✅ Add real-time features (live updates, notifications)

---

## Summary

You now have:
- ✅ Full API access from React components
- ✅ Automatic authentication handling
- ✅ Error handling utilities
- ✅ Working examples and patterns
- ✅ Development and production support

Start building interactive, data-driven React components! 🚀