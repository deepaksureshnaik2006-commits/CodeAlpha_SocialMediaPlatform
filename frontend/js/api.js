/**
 * ZYNTRA - Universal API Client
 * Automatic JWT bearer injection, error handling, file uploads.
 */

const API = {
  async request(endpoint, options = {}) {
    const token = await window.ZyntraSupabase.getToken();

    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !window.location.pathname.includes('login') && !window.location.pathname.includes('register') && window.location.pathname !== '/') {
          // Token expired or invalid session on a protected page
          console.warn('Session expired. Redirecting to login.');
          localStorage.removeItem('zyntra_user_cached');
          window.location.href = '/login?msg=session_expired';
        }
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.data = data;
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  }
};

window.API = API;

