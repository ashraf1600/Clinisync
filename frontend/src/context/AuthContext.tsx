import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, registerAuthHandlers, clearAuthStorage } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  phone?: string;
  timezone: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'patient' | 'doctor' | 'admin';
    specialization?: string;
    bmdcNumber?: string;
  }) => Promise<void>;
  logout: () => void;
  updateUserData: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('user_data');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { user: userData, tokens } = res.data;
    setUser(userData);
    setToken(tokens.accessToken);
    localStorage.setItem('access_token', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('refresh_token', tokens.refreshToken);
    localStorage.setItem('user_data', JSON.stringify(userData));
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'patient' | 'doctor' | 'admin';
    specialization?: string;
    bmdcNumber?: string;
  }) => {
    const res = await apiClient.post('/auth/register', data);
    const { user: userData, tokens } = res.data;
    setUser(userData);
    setToken(tokens.accessToken);
    localStorage.setItem('access_token', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('refresh_token', tokens.refreshToken);
    localStorage.setItem('user_data', JSON.stringify(userData));
  };

  const updateUserData = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('user_data', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearAuthStorage();
  };

  // Let the API layer renew an expired 15-min access token via the 7-day
  // refresh token, and force a real logout when renewal is impossible.
  useEffect(() => {
    registerAuthHandlers({
      getRefreshToken: () => localStorage.getItem('refresh_token'),
      applyNewToken: (t) => setToken(t),
      onAuthFailure: () => {
        setUser(null);
        setToken(null);
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, register, logout, updateUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
