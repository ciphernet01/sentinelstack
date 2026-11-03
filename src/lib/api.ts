import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Always read the latest Firebase ID token immediately before a request.
// Firebase can rotate ID tokens while the SPA remains open, so a token captured
// only once at module load can become stale and make protected dashboard calls
// fail even though the user is still signed in.
if (typeof window !== 'undefined') {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers) {
      delete config.headers.Authorization;
    }
    return config;
  });
}

export default api;
