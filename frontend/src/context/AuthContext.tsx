import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  // 启动时从localStorage恢复token
  useEffect(() => {
    const token = localStorage.getItem('scene_lingo_token');
    const email = localStorage.getItem('scene_lingo_email');
    if (token && email) {
      setState({ token, email, isLoggedIn: true, loading: false });
    } else {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback((token: string, email: string) => {
    localStorage.setItem('scene_lingo_token', token);
    localStorage.setItem('scene_lingo_email', email);
    setState({ token, email, isLoggedIn: true, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('scene_lingo_token');
    localStorage.removeItem('scene_lingo_email');
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
