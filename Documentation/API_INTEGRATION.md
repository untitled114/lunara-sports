# API Integration Guide

## Overview

This document describes the API integration architecture for Lunara.io, including authentication, error handling, retry logic, and best practices.

---

## Architecture

### API Service Layer (`/frontend/src/services/api.js`)

Centralized API client with the following features:
- ✅ **Authentication**: Automatic Bearer token injection
- ✅ **Retry Logic**: Exponential backoff for failed requests (max 3 retries)
- ✅ **Error Handling**: Typed errors with client/server/network distinction
- ✅ **Type Safety**: Custom `APIError` class for better error handling
- ✅ **Environment Config**: Uses `VITE_API_URL` from environment variables

---

## Configuration

### Environment Variables

```bash
# .env file
VITE_API_URL=http://localhost:3000/api
```

### API Base URL

The API client automatically uses the environment variable:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
```

---

## Authentication

### Token Management

All API calls automatically include the auth token from localStorage:

```javascript
const token = localStorage.getItem('auth_token');
headers['Authorization'] = `Bearer ${token}`;
```

### Auth Flow

1. User logs in → Token stored in `localStorage.setItem('auth_token', token)`
2. All subsequent API calls include token automatically
3. On 401 error → Redirect to `/signin`
4. On logout → Token removed from localStorage

---

## Error Handling

### Error Types

#### 1. **Network Errors** (No internet connection)
```javascript
{
  name: 'APIError',
  status: null,
  isNetworkError: true,
  message: 'Network error - please check your connection'
}
```

#### 2. **Client Errors** (4xx - validation, auth, etc.)
```javascript
{
  name: 'APIError',
  status: 400-499,
  isClientError: true,
  message: 'Error message from server'
}
```

#### 3. **Server Errors** (5xx - server issues)
```javascript
{
  name: 'APIError',
  status: 500-599,
  isServerError: true,
  message: 'Server error'
}
```

### Error Handling Pattern

```javascript
import { projectsAPI, APIError } from '../services/api';

try {
  const project = await projectsAPI.create(data);
  showSuccess('Project created!');
} catch (error) {
  if (error instanceof APIError) {
    if (error.status === 401) {
      showError('Session expired. Please log in again.');
      navigate('/signin');
    } else if (error.status === 403) {
      showError('Permission denied.');
    } else if (error.isNetworkError) {
      showError('Network error. Please check your connection.');
    } else if (error.isServerError) {
      showError('Server error. Please try again later.');
    } else {
      showError(error.message || 'Request failed.');
    }
  } else {
    showError('An unexpected error occurred.');
  }
}
```

---

## Retry Logic

### Exponential Backoff

Failed requests are automatically retried with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: After 1 second
- **Attempt 3**: After 2 seconds
- **Attempt 4**: After 4 seconds (max)

### Retryable Errors

Only the following errors trigger retry:
- Network errors (no connection)
- Server errors (5xx)
- Rate limiting (429)

### Non-Retryable Errors

Client errors (4xx) are **not** retried:
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 422 Validation Error

---

## API Endpoints

### Projects API

```javascript
import { projectsAPI } from '../services/api';

// Get all projects with optional filters
const projects = await projectsAPI.getAll({ status: 'active', limit: 50 });

// Get project by ID
const project = await projectsAPI.getById(projectId);

// Create new project
const newProject = await projectsAPI.create({
  title: 'E-commerce Dashboard',
  client: 'TechCorp',
  description: 'Modern React dashboard',
  value: 2500,
  deadline: '2025-12-31',
  priority: 'high'
});

// Update project
const updated = await projectsAPI.update(projectId, { status: 'completed' });

// Delete project
await projectsAPI.delete(projectId);

// Update status
await projectsAPI.updateStatus(projectId, 'in-review');
```

### Messages API

```javascript
import { messagesAPI } from '../services/api';

// Get all messages
const messages = await messagesAPI.getAll({ unread: true });

// Send message
await messagesAPI.send({
  to: 'client@example.com',
  message: 'Project update...'
});

// Mark as read
await messagesAPI.markAsRead(messageId);

// Batch reply
await messagesAPI.batchReply({
  messageIds: [1, 2, 3],
  reply: 'Thanks for your patience!'
});

// Broadcast message
await messagesAPI.broadcast({
  recipients: 'all',
  message: 'System maintenance scheduled...'
});
```

### Payments API

```javascript
import { paymentsAPI } from '../services/api';

// Get all payments
const payments = await paymentsAPI.getAll({ status: 'pending' });

// Send reminder
await paymentsAPI.sendReminder(paymentId);

// Download receipt
const receipt = await paymentsAPI.downloadReceipt(paymentId);
```

### Invoices API

```javascript
import { invoicesAPI } from '../services/api';

// Create invoice
const invoice = await invoicesAPI.create({
  projectId: 123,
  amount: 2500,
  dueDate: '2025-12-31',
  items: [...]
});

// Download invoice PDF
const pdf = await invoicesAPI.download(invoiceId);
```

### Profile API

```javascript
import { profileAPI } from '../services/api';

// Get profile
const profile = await profileAPI.get();

// Update profile
await profileAPI.update({
  name: 'John Doe',
  bio: 'Full-stack developer'
});

// Upload avatar
const file = event.target.files[0];
await profileAPI.uploadAvatar(file);
```

### Auth API

```javascript
import { authAPI } from '../services/api';

// Login
const { token, user } = await authAPI.login('email@example.com', 'password');
localStorage.setItem('auth_token', token);

// Signup
const { token, user } = await authAPI.signup({
  name: 'John Doe',
  email: 'email@example.com',
  password: 'password'
});

// Logout
await authAPI.logout();
localStorage.removeItem('auth_token');

// Forgot password
await authAPI.forgotPassword('email@example.com');

// Reset password
await authAPI.resetPassword(resetToken, 'newPassword');
```

---

## Optimistic UI Updates

### Pattern

Update UI immediately, rollback on error:

```javascript
const [projects, setProjects] = useState([]);

const handleCreateProject = async (projectData) => {
  // Optimistic: Add to UI immediately
  const tempId = `temp-${Date.now()}`;
  const optimisticProject = { ...projectData, id: tempId, status: 'creating' };
  setProjects(prev => [optimisticProject, ...prev]);

  try {
    // Real API call
    const realProject = await projectsAPI.create(projectData);

    // Replace temp with real
    setProjects(prev =>
      prev.map(p => p.id === tempId ? realProject : p)
    );

    showSuccess('Project created!');
  } catch (error) {
    // Rollback on error
    setProjects(prev => prev.filter(p => p.id !== tempId));
    showError('Failed to create project');
  }
};
```

### Use Cases

Recommended for:
- ✅ Project creation
- ✅ Message sending
- ✅ Status updates
- ✅ Simple CRUD operations

Not recommended for:
- ❌ Payments
- ❌ Auth operations
- ❌ Destructive actions (delete)

---

## Offline Mode

### Detection

The `OfflineBanner` component automatically detects network status:

```jsx
import OfflineBanner from './components/OfflineBanner';

function App() {
  return (
    <>
      <OfflineBanner />
      {/* Rest of app */}
    </>
  );
}
```

### Behavior

- **Online → Offline**: Red banner appears immediately
- **Offline → Online**: Green "You're back online!" message for 3 seconds
- **API Calls**: Fail fast with network error toast

---

## Loading States

### Pattern

```javascript
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await api.call();
    showSuccess('Success!');
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
};
```

### Button States

```jsx
<button
  onClick={handleAction}
  disabled={loading}
  className="..."
>
  {loading ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" />
      Processing...
    </>
  ) : (
    'Submit'
  )}
</button>
```

---

## Rate Limiting

### Client-Side Throttling

For high-frequency actions:

```javascript
import { debounce } from 'lodash';

// Search with debounce (wait 300ms after user stops typing)
const debouncedSearch = debounce(async (query) => {
  const results = await projectsAPI.getAll({ search: query });
  setResults(results);
}, 300);
```

### Server-Side Rate Limits

- API returns `429 Too Many Requests`
- Client automatically retries with exponential backoff
- Toast notification: "Too many requests. Please wait..."

---

## Performance Optimization

### 1. Pagination

```javascript
// Fetch projects with pagination
const [page, setPage] = useState(1);
const limit = 20;

const projects = await projectsAPI.getAll({
  page,
  limit,
  sort: '-createdAt'
});
```

### 2. Caching

```javascript
// Simple in-memory cache
const cache = new Map();

const getCachedProjects = async () => {
  if (cache.has('projects')) {
    return cache.get('projects');
  }

  const projects = await projectsAPI.getAll();
  cache.set('projects', projects);
  return projects;
};
```

### 3. Request Cancellation

```javascript
const abortController = new AbortController();

const fetchData = async () => {
  try {
    const data = await api.get('/endpoint', {
      signal: abortController.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
    }
  }
};

// Cancel on unmount
useEffect(() => {
  return () => abortController.abort();
}, []);
```

---

## Security Best Practices

### 1. Never Store Sensitive Data in localStorage

❌ **Bad**:
```javascript
localStorage.setItem('password', password);
localStorage.setItem('creditCard', cardNumber);
```

✅ **Good**:
```javascript
// Only store non-sensitive tokens
localStorage.setItem('auth_token', token);
```

### 2. Token Expiration

```javascript
// Check token expiration
const isTokenExpired = () => {
  const token = localStorage.getItem('auth_token');
  if (!token) return true;

  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

if (isTokenExpired()) {
  // Redirect to login
  navigate('/signin');
}
```

### 3. HTTPS Only

```javascript
// Enforce HTTPS in production
if (import.meta.env.PROD && window.location.protocol !== 'https:') {
  window.location.protocol = 'https:';
}
```

---

## Testing

### Mock API Responses

```javascript
// __tests__/api.test.js
import { projectsAPI } from '../services/api';

// Mock successful response
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: 1, title: 'Test Project' })
  })
);

test('creates project successfully', async () => {
  const project = await projectsAPI.create({ title: 'Test' });
  expect(project.title).toBe('Test Project');
});

// Mock error response
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ message: 'Invalid data' })
  })
);

test('handles API error', async () => {
  await expect(projectsAPI.create({})).rejects.toThrow('Invalid data');
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Network error" on localhost

**Solution**: Check if backend server is running:
```bash
curl http://localhost:3000/api/health
```

#### 2. CORS errors

**Solution**: Configure backend CORS headers:
```javascript
// Backend (Express)
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
```

#### 3. 401 Unauthorized on every request

**Solution**: Check token in localStorage:
```javascript
console.log(localStorage.getItem('auth_token'));
```

If null, user needs to log in again.

#### 4. Requests timing out

**Solution**: Increase timeout or check network:
```javascript
const response = await fetch(url, {
  ...options,
  signal: AbortSignal.timeout(10000) // 10 seconds
});
```

---

## Migration Checklist

### From Mock to Real API

- [ ] Replace all `// TODO:` comments with real API calls
- [ ] Add proper error handling for each endpoint
- [ ] Test with real backend
- [ ] Add loading states
- [ ] Add optimistic UI updates where appropriate
- [ ] Test offline behavior
- [ ] Test error scenarios (401, 403, 500, network errors)
- [ ] Add analytics for API failures
- [ ] Document any backend API changes needed

---

## Next Steps

1. **Backend Development**: Implement matching REST API endpoints
2. **Testing**: Add integration tests for API calls
3. **Monitoring**: Set up Sentry for production error tracking
4. **Performance**: Add request caching and pagination
5. **Security**: Implement token refresh mechanism

---

## Support

For API-related issues:
1. Check browser console for error details
2. Verify `VITE_API_URL` is set correctly
3. Test API endpoints directly with curl/Postman
4. Check backend server logs
5. Review this documentation

---

**Last Updated**: 2025-10-02
**Version**: 1.0.0
