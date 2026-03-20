'use client';

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8090';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('api_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data || {},
  (error) => {
    const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unknown error';
    console.error('API Error:', errorMsg);
    const err = new Error(errorMsg);
    err.originalError = error;
    return Promise.reject(err);
  }
);

// Safe API wrapper with fallback
const safeCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    console.warn('API call failed:', error.message);
    return fallback;
  }
};

// API Methods
export const api = {
  // Health & Status
  health: async () => safeCall(() => apiClient.get('/health'), { status: 'offline' }),
  status: async () => safeCall(() => apiClient.get('/api/v1/status'), { events_ingested: 0, windows_processed: 0, anomalies_detected: 0 }),

  // Logs
  uploadLogs: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/v1/logs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getRecentLogs: (limit = 50, offset = 0) =>
    apiClient.get('/api/v1/logs/recent', { params: { limit, offset } }),
  queryLogs: (params) =>
    apiClient.get('/api/v1/logs/query', { params }),

  // Anomalies
  getAnomalies: async (limit = 100, offset = 0, threshold = 0) =>
    safeCall(() => apiClient.get('/api/v1/anomalies/query', { params: { limit, offset, threshold } }), []),
  getLatestAnomalies: async (limit = 20) =>
    safeCall(() => apiClient.get('/api/v1/anomalies/query', { params: { limit } }), []),
  getAnomaliesByService: async (service, limit = 50) =>
    safeCall(() => apiClient.get('/api/v1/anomalies/query', { params: { service, limit } }), []),
  getAnomaliesByTimeRange: async (start, end, limit = 100) =>
    safeCall(() => apiClient.get('/api/v1/anomalies/query', { params: { start_time: start, end_time: end, limit } }), []),

  // Crash Reports
  getCrashReports: async (limit = 20, offset = 0) =>
    safeCall(() => apiClient.get('/api/v1/crash-reports', { params: { limit, offset } }), []),
  getLatestCrashReport: async () =>
    safeCall(() => apiClient.get('/api/v1/crash-reports/latest'), null),
  getCrashReportDetails: async (reportId) =>
    safeCall(() => apiClient.get(`/api/v1/crash-reports/${reportId}`), null),

  // Forecasting & Enhanced Features
  getForecast: (type = 'crash', horizon = 300) =>
    apiClient.get('/api/v1/forecast', { params: { type, horizon } }),
  getEnhancedStatus: () =>
    apiClient.get('/api/v1/enhanced/status'),

  // Configuration
  getConfig: () =>
    apiClient.get('/api/v1/config'),
  updateConfig: (config) =>
    apiClient.post('/api/v1/config', config),

  // Feedback (for Phase 3 model improvement)
  submitFeedback: (anomalyId, feedback) =>
    apiClient.post('/api/v1/feedback', { anomaly_id: anomalyId, feedback }),
};

// WebSocket Stream Utility
export function createAnomalyStream(onMessage, onError, onClose) {
  try {
    const protocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = API_BASE_URL.replace(/^https?:/, '').replace(/\/$/, '');
    const wsUrl = protocol + ':' + baseUrl + '/api/v1/stream/subscribe';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Anomaly stream connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse stream message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Stream error:', error);
      onError?.(error);
    };

    ws.onclose = () => {
      console.log('Anomaly stream disconnected');
      onClose?.();
    };

    return ws;
  } catch (error) {
    console.error('WebSocket creation failed:', error);
    onError?.(error);
    return null;
  }
}

export default apiClient;
