import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // If CloudFront/S3 returned the SPA fallback index.html for an API request, treat as backend unavailable
    if (typeof response.data === 'string' && (response.data.includes('<!doctype') || response.data.includes('<html'))) {
      return Promise.reject(new Error('Backend API endpoint is not reachable or still starting.'));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on 401
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
    }
    return Promise.reject(error);
  }
);
