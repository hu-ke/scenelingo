import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReview } from '../context/ReviewContext';
import { api } from '../utils/api';
import { setLanguagePrefs } from '../utils/languagePrefs';

export default function LoginPage() {
  const auth = useAuth();
  const { dispatch } = useReview();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const isValidEmail = (email: string) => {
    return email.includes('@') && email.includes('.');
  };

  const handleSendCode = async () => {
    if (!isValidEmail(email)) {
      setError('请输入正确的邮箱地址');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await api.sendCode(email);
      setCountdown(60);
      codeInputRef.current?.focus();
    } catch (err: any) {
      if (err?.name === 'TypeError' || err?.message?.includes('fetch')) {
        setError('网络连接失败，请重试');
      } else {
        setError(err?.message || '发送验证码失败，请重试');
      }
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      setError('请输入正确的邮箱地址');
      return;
    }
    if (!code || code.length < 6) {
      setError('请输入6位验证码');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await api.verify(email, code);
      auth.login(result.token, result.email);
      if (result.targetLang) {
        setLanguagePrefs({ nativeLang: 'zh', targetLang: result.targetLang });
        dispatch({ type: 'setLanguage', nativeLang: 'zh', targetLang: result.targetLang });
      }
      dispatch({ type: 'setPage', page: 'home' });
    } catch (err: any) {
      if (err?.name === 'TypeError' || err?.message?.includes('fetch')) {
        setError('网络连接失败，请重试');
      } else {
        setError(err?.message || '验证失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    console.log('handleSkip.')
    dispatch({ type: 'setPage', page: 'home' });
  };

  const sendCodeDisabled = sending || countdown > 0 || !isValidEmail(email);
  const loginDisabled = loading || !isValidEmail(email) || code.length < 6;

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FFF5F0 0%, #FFE8E0 50%, #FFD4C0 100%)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem 1.75rem',
          animation: 'fadeIn 0.5s ease',
        }}
      >
        {/* ===== Logo 区域 ===== */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span
            style={{
              fontSize: '3.5rem',
              display: 'block',
              marginBottom: '0.5rem',
              animation: 'heartbeat 2s ease-in-out infinite',
            }}
          >
            🎓
          </span>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              marginBottom: '0.35rem',
              background:
                'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            场景英语
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            邮箱登录，同步你的学习记录
          </p>
        </div>

        {/* ===== 邮箱输入 ===== */}
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="email"
            placeholder="请输入邮箱地址"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            style={{
              fontSize: '1.05rem',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}
          />
        </div>

        {/* ===== 验证码输入行 ===== */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.25rem',
          }}
        >
          <input
            ref={codeInputRef}
            type="text"
            maxLength={6}
            placeholder="验证码"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setCode(val);
              setError(null);
            }}
            style={{
              flex: 1,
              fontSize: '1.05rem',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}
          />
          <button
            onClick={handleSendCode}
            disabled={sendCodeDisabled}
            style={{
              whiteSpace: 'nowrap',
              flexShrink: 0,
              padding: '0.65em 0.75em',
              minWidth: '105px',
              fontSize: '0.88rem',
              fontWeight: 600,
              background:
                sendCodeDisabled
                  ? 'var(--color-border)'
                  : 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-mid))',
              color:
                sendCodeDisabled
                  ? 'var(--color-text-muted)'
                  : '#FFFFFF',
            }}
          >
            {sending ? '发送中...' : countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
          </button>
        </div>

        {/* ===== 登录/注册按钮 ===== */}
        <button
          onClick={handleLogin}
          disabled={loginDisabled}
          style={{
            width: '100%',
            padding: '0.8em 1em',
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {loading && (
            <span
              style={{
                width: '20px',
                height: '20px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#FFFFFF',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }}
            />
          )}
          {loading ? '验证中...' : '登录 / 注册'}
        </button>

        {/* ===== 错误信息 ===== */}
        {error && (
          <div
            style={{
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              textAlign: 'center',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              backgroundColor: 'rgba(255, 107, 107, 0.08)',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            {error}
          </div>
        )}

        {/* ===== 暂不登录链接 ===== */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '0.5em 0.25em',
              minHeight: 'unset',
              boxShadow: 'none',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            暂不登录，先体验
          </button>
        </div>
      </div>
    </div>
  );
}