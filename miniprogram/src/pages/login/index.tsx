import { useState, useCallback, useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Input, Button } from '@tarojs/components';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useReview } from '../../context/AppContext';
import { setLanguagePrefs } from '../../utils/languagePrefs';
import { setTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import './index.scss';

export default function LoginPage() {
  const themeStyle = useTheme();
  const { login } = useAuth();
  const { dispatch } = useReview();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = useCallback(async () => {
    setError('');
    if (!email.includes('@') || !email.includes('.')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setSending(true);
    try {
      await api.sendCode(email);
      startCountdown();
    } catch (e: unknown) {
      setError((e as Error).message || '发送失败，请稍后再试');
    } finally {
      setSending(false);
    }
  }, [email, startCountdown]);

  const handleLogin = useCallback(async () => {
    setError('');
    if (!agreed) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (!code || code.length < 6) {
      setError('请输入验证码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verify(email, code);
      login(res.token, res.email);
      const nativeLang = res.nativeLang || 'zh';
      const targetLang = res.targetLang || 'en';
      setLanguagePrefs({ nativeLang, targetLang });
      dispatch({ type: 'setLanguage', nativeLang, targetLang });
      if (res.theme) {
        setTheme(res.theme);
        dispatch({ type: 'setTheme', theme: res.theme });
      }
      Taro.reLaunch({ url: '/pages/home/index' });
    } catch (e: unknown) {
      setError((e as Error).message || '登录失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [email, code, login, agreed]);

  const handleSkip = useCallback(() => {
    Taro.reLaunch({ url: '/pages/home/index' });
  }, []);

  const openUserAgreement = useCallback(() => {
    Taro.navigateTo({ url: '/pages/user-agreement/index' });
  }, []);

  const openPrivacyPolicy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/privacy-policy/index' });
  }, []);

  return (
    <View className="login-page" style={themeStyle}>
      <View className="login-card">
        <View className="login-logo">
          <Text className="login-logo-text">🔍场景外语</Text>
        </View>

        <Text className="login-subtitle">邮箱登录，同步你的学习记录</Text>

        <Input
          className="login-input"
          type="text"
          placeholder="请输入邮箱地址"
          value={email}
          onInput={(e) => setEmail(e.detail.value)}
        />

        <View className="login-code-row">
          <Input
            className="login-code-input"
            type="number"
            maxLength={6}
            placeholder="验证码"
            value={code}
            onInput={(e) => setCode(e.detail.value.replace(/\D/g, ''))}
          />
          <Button
            className="login-code-btn"
            disabled={countdown > 0 || sending}
            onClick={handleSendCode}
          >
            {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
          </Button>
        </View>

        {error ? <Text className="login-error">{error}</Text> : null}

        <Button
          className="login-submit-btn"
          loading={loading}
          disabled={loading}
          onClick={handleLogin}
        >
          登录 / 注册
        </Button>

        <View className="login-agreement">
          <View 
            className={`login-checkbox ${agreed ? 'checked' : ''}`}
            onClick={() => setAgreed(!agreed)}
          >
            {agreed && <Text className="login-checkbox-icon">✓</Text>}
          </View>
          <Text className="login-agreement-text">
            我已阅读并同意
            <Text className="login-agreement-link" onClick={openUserAgreement}>《用户服务协议》</Text>
            和
            <Text className="login-agreement-link" onClick={openPrivacyPolicy}>《隐私政策》</Text>
          </Text>
        </View>

        <Text className="login-skip" onClick={handleSkip}>
          暂不登录，先体验
        </Text>
      </View>
    </View>
  );
}