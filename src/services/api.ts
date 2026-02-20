import axios from 'axios';
import type { LoginRequest, LoginResponse } from '../types/auth';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Só redireciona para /login em 401 se NÃO for uma rota de autenticação
    const isAuthRoute =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  loginSystem: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/system/auth/login', data);
    return response.data;
  },

  loginCustomer: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/customer/auth/login', data);
    return response.data;
  },
};

export default api;
