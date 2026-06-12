import Taro from '@tarojs/taro';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../utils/api';

export interface AuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  loading: boolean;
}

interface AuthContextValue {
  state: AuthState;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    isLoggedIn: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    
    async function autoLogin() {
      try {
        // 先尝试读取本地缓存的 token
        const cachedToken = Taro.getStorageSync('scene_lingo_token');
        const cachedUserId = Taro.getStorageSync('scene_lingo_user_id');
        if (cachedToken && cachedUserId) {
          if (!cancelled) {
            setState({ token: cachedToken, userId: cachedUserId, isLoggedIn: true, loading: false });
          }
          // 后台刷新 token
          tryRefreshToken();
          return;
        }

        // 无缓存，发起微信登录
        const loginRes = await Taro.login();
        if (!loginRes.code) {
          throw new Error('wx.login 失败');
        }

        // 读取旧版邮箱（如果有），用于绑定已有账号
        const legacyEmail = Taro.getStorageSync('scene_lingo_email') || '';
        if (legacyEmail) {
          Taro.removeStorageSync('scene_lingo_email'); // 绑定后清除旧 key
        }

        const res = await api.wechatLogin(loginRes.code, legacyEmail || undefined);
        if (!cancelled) {
          Taro.setStorageSync('scene_lingo_token', res.token);
          Taro.setStorageSync('scene_lingo_user_id', res.user_id);
          setState({ token: res.token, userId: res.user_id, isLoggedIn: true, loading: false });
        }
      } catch (e) {
        console.error('自动登录失败:', e);
        if (!cancelled) {
          // 登录失败也设置为已登录状态（降级），但无 token
          setState({ token: null, userId: null, isLoggedIn: true, loading: false });
        }
      }
    }

    async function tryRefreshToken() {
      try {
        const loginRes = await Taro.login();
        if (!loginRes.code) return;
        const res = await api.wechatLogin(loginRes.code);
        Taro.setStorageSync('scene_lingo_token', res.token);
        Taro.setStorageSync('scene_lingo_user_id', res.user_id);
        if (!cancelled) {
          setState(prev => ({ ...prev, token: res.token, userId: res.user_id }));
        }
      } catch {
        // 刷新失败，继续使用旧 token
      }
    }

    autoLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    Taro.removeStorageSync('scene_lingo_token');
    Taro.removeStorageSync('scene_lingo_user_id');
    setState({ token: null, userId: null, isLoggedIn: true, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ state, logout }}>
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
