import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  api,
  APIError,
  projectsAPI,
  messagesAPI,
  paymentsAPI,
  invoicesAPI,
  profileAPI,
  payoutsAPI,
  authAPI,
} from './api';

describe('APIError', () => {
  it('should create an APIError with correct properties', () => {
    const error = new APIError('Test error', 404, { detail: 'Not found' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('APIError');
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(404);
    expect(error.data).toEqual({ detail: 'Not found' });
  });

  it('should identify client errors (4xx)', () => {
    const error400 = new APIError('Bad request', 400);
    const error404 = new APIError('Not found', 404);
    const error422 = new APIError('Validation error', 422);

    expect(error400.isClientError).toBe(true);
    expect(error400.isServerError).toBe(false);
    expect(error400.isNetworkError).toBe(false);

    expect(error404.isClientError).toBe(true);
    expect(error422.isClientError).toBe(true);
  });

  it('should identify server errors (5xx)', () => {
    const error500 = new APIError('Internal server error', 500);
    const error503 = new APIError('Service unavailable', 503);

    expect(error500.isServerError).toBe(true);
    expect(error500.isClientError).toBe(false);
    expect(error500.isNetworkError).toBe(false);

    expect(error503.isServerError).toBe(true);
  });

  it('should identify network errors (no status)', () => {
    const error = new APIError('Network error', null);

    expect(error.isNetworkError).toBe(true);
    expect(error.isClientError).toBe(false);
    expect(error.isServerError).toBe(false);
  });
});

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch.mockReset();
  });

  describe('Authentication', () => {
    it('should include Bearer token when authenticated', async () => {
      localStorage.setItem('auth_token', 'test-token-123');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      });

      await api.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should work without token when not authenticated', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      });

      await api.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      });

      const result = await api.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should make POST requests with body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'created' }),
      });

      const payload = { name: 'Test' };
      const result = await api.post('/test', payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual({ data: 'created' });
    });

    it('should make PATCH requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'updated' }),
      });

      const payload = { name: 'Updated' };
      await api.patch('/test/1', payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      );
    });

    it('should make PUT requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'replaced' }),
      });

      const payload = { name: 'Replaced' };
      await api.put('/test/1', payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      );
    });

    it('should make DELETE requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await api.delete('/test/1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw APIError for 4xx client errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(api.get('/test')).rejects.toThrow(APIError);

      // Reset for second assertion
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(api.get('/test')).rejects.toMatchObject({
        status: 400,
        message: 'Bad request',
        isClientError: true,
      });
    });

    it('should throw APIError for 5xx server errors', async () => {
      vi.useFakeTimers();

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal server error' }),
      });

      const promise = api.get('/test');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toMatchObject({
        status: 500,
        isServerError: true,
      });

      vi.useRealTimers();
    });

    it('should throw APIError for network errors', async () => {
      vi.useFakeTimers();

      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const promise = api.get('/test');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toMatchObject({
        isNetworkError: true,
        message: expect.stringContaining('Network error'),
      });

      vi.useRealTimers();
    });

    it('should handle 401 unauthorized errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(api.get('/test')).rejects.toMatchObject({
        status: 401,
        isClientError: true,
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on server errors (5xx)', async () => {
      vi.useFakeTimers();

      // First 2 attempts fail with 500, third succeeds
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: 'success' }),
        });

      const promise = api.get('/test');

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });

      vi.useRealTimers();
    });

    it('should retry on network errors', async () => {
      vi.useFakeTimers();

      // First attempt fails with network error, second succeeds
      global.fetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: 'success' }),
        });

      const promise = api.get('/test');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });

      vi.useRealTimers();
    });

    it('should NOT retry on client errors (4xx)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(api.get('/test')).rejects.toThrow();

      // Should only be called once (no retry)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry up to MAX_RETRIES times', async () => {
      vi.useFakeTimers();

      // All 4 attempts fail (1 initial + 3 retries)
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server error' }),
      });

      const promise = api.get('/test');
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow();

      // Should be called 4 times total (1 + 3 retries)
      expect(global.fetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it('should retry on 429 rate limit errors', async () => {
      vi.useFakeTimers();

      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Too many requests' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: 'success' }),
        });

      const promise = api.get('/test');

      // Wait for initial request to complete and retry to be scheduled
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });

      vi.useRealTimers();
    });
  });

  describe('Content Type Handling', () => {
    it('should parse JSON responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      });

      const result = await api.get('/test');
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle text responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'plain text response',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const result = await api.get('/test');
      expect(result).toBe('plain text response');
    });
  });
});

describe('Projects API', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('should get all projects', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [{ id: 1, title: 'Project 1' }] }),
    });

    await projectsAPI.getAll();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.any(Object)
    );
  });

  it('should get all projects with query params', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [] }),
    });

    await projectsAPI.getAll({ status: 'active', limit: 50 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/?status=active&limit=50'),
      expect.any(Object)
    );
  });

  it('should get project by ID', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, title: 'Project 1' } }),
    });

    await projectsAPI.getById(1);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1'),
      expect.any(Object)
    );
  });

  it('should create a project', async () => {
    const projectData = {
      title: 'New Project',
      client: 'Test Client',
      value: 1000,
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, ...projectData } }),
    });

    await projectsAPI.create(projectData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(projectData),
      })
    );
  });

  it('should update a project', async () => {
    const updateData = { title: 'Updated Project' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, ...updateData } }),
    });

    await projectsAPI.update(1, updateData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })
    );
  });

  it('should delete a project', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });

    await projectsAPI.delete(1);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('should update project status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, status: 'completed' } }),
    });

    await projectsAPI.updateStatus(1, 'completed');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1/status'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      })
    );
  });
});

describe('Messages API', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('should get all messages', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [] }),
    });

    await messagesAPI.getAll();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages'),
      expect.any(Object)
    );
  });

  it('should send a message', async () => {
    const messageData = { to: 'client@example.com', message: 'Hello' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, ...messageData } }),
    });

    await messagesAPI.send(messageData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(messageData),
      })
    );
  });

  it('should mark message as read', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 1, read: true } }),
    });

    await messagesAPI.markAsRead(1);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/1/read'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('should batch reply to messages', async () => {
    const batchData = { messageIds: [1, 2, 3], reply: 'Thanks!' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { success: true } }),
    });

    await messagesAPI.batchReply(batchData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/batch-reply'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(batchData),
      })
    );
  });

  it('should broadcast a message', async () => {
    const broadcastData = { recipients: 'all', message: 'Announcement' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { success: true } }),
    });

    await messagesAPI.broadcast(broadcastData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/broadcast'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(broadcastData),
      })
    );
  });
});

describe('Auth API', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('should login with email and password', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { token: 'jwt-token', user: {} } }),
    });

    await authAPI.login('test@example.com', 'password123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
    );
  });

  it('should signup with user data', async () => {
    const signupData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { token: 'jwt-token', user: signupData } }),
    });

    await authAPI.signup(signupData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(signupData),
      })
    );
  });

  it('should logout', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { success: true } }),
    });

    await authAPI.logout();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should refresh token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { token: 'new-jwt-token' } }),
    });

    await authAPI.refreshToken();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('Profile API', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('should get user profile', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { name: 'Test User', email: 'test@example.com' } }),
    });

    await profileAPI.get();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should update user profile', async () => {
    const updateData = { name: 'Updated Name', bio: 'New bio' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: updateData }),
    });

    await profileAPI.update(updateData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })
    );
  });
});
