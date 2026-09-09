import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

interface AuthHandlers {
  getRefreshToken: () => string | null;
  applyNewToken: (token: string) => void;
  onAuthFailure: () => void;
}

let authHandlers: AuthHandlers | null = null;

/** Registered once by AuthProvider (avoids a circular import with AuthContext). */
export const registerAuthHandlers = (handlers: AuthHandlers) => {
  authHandlers = handlers;
};

export const clearAuthStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');
};

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshPromise: Promise<string | null> | null = null;

const doRefresh = (): Promise<string | null> => {
  if (!refreshPromise) {
    const refreshToken = authHandlers?.getRefreshToken() || localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return Promise.resolve(null);
    }
    // Bare axios (no interceptors) so a failing refresh can't recurse.
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const newToken: string | undefined = res.data?.accessToken;
        if (!newToken) return null;
        localStorage.setItem('access_token', newToken);
        authHandlers?.applyNewToken(newToken);
        return newToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const isAuthEndpoint = (url?: string): boolean =>
  !!url && /\/auth\/(login|register|refresh|forgot-password|reset-password)/.test(url);

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
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true;
      const newToken = await doRefresh();
      if (newToken) {
        original.headers = original.headers || ({} as never);
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      // Refresh token missing/expired: real logout so UI stops pretending.
      clearAuthStorage();
      authHandlers?.onAuthFailure();
    } else if (status === 401 && original && isAuthEndpoint(original.url)) {
      // Login/register/refresh itself rejected: don't loop, just surface the error.
    }
    return Promise.reject(error);
  }
);
