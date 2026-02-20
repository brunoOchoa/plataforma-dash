import { createContext, useContext, useState, type ReactNode } from 'react';
import type { UserInfo } from '../types/auth';

interface AuthContextType {
  user: UserInfo | null;
  login: (user: UserInfo) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* Lê o user do localStorage de forma síncrona na inicialização
   — evita o flash de tela preta / redirect prematuro para /login */
function loadUserFromStorage(): UserInfo | null {
  try {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (stored && token) {
      return JSON.parse(stored) as UserInfo;
    }
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Estado inicializado de forma síncrona — sem useEffect, sem flash
  const [user, setUser] = useState<UserInfo | null>(loadUserFromStorage);

  const login = (userData: UserInfo) => {
    setUser(userData);
    localStorage.setItem('user',  JSON.stringify(userData));
    localStorage.setItem('token', userData.token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
