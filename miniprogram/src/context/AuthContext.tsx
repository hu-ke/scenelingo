import Taro from '@tarojs/taro';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface AuthState {
  token: string | null;
  email: string | null;
  isLoggedIn: boolean;
  loading: boolean;
}

interface AuthContextValue {
  state: AuthState;
  login: (token: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    email: null,
    isLoggedIn: false,
    loading: true,
  });

  useEffect(() => {
    const token = Taro.getStorageSync('scene_lingo_token');
    const email = Taro.getStorageSync('scene_lingo_email');
    if (token && email) {
      setState({ token, email, isLoggedIn: true, loading: false });
    } else {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback((token: string, email: string) => {
    Taro.setStorageSync('scene_lingo_token', token);
    Taro.setStorageSync('scene_lingo_email', email);
    setState({ token, email, isLoggedIn: true, loading: false });
  }, []);

  const logout = useCallback(() => {
    Taro.removeStorageSync('scene_lingo_token');
    Taro.removeStorageSync('scene_lingo_email');
    setState({ token: null, email: null, isLoggedIn: false, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}