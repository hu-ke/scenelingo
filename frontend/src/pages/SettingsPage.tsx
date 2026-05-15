import { useState } from 'react';
import { useReview } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import { getLanguagePrefs, setLanguagePrefs, LANGUAGES, getNativeName } from '../utils/languagePrefs';
import type { LanguagePrefs } from '../utils/languagePrefs';
import { api } from '../utils/api';
import { getTheme, setTheme, THEMES } from '../utils/theme';
import AppLogo from '../components/AppLogo';

const NATIVE_LANG = 'zh';

export default function SettingsPage() {
  const { dispatch } = useReview();
  const { state: authState } = useAuth();

  const initialPrefs = getLanguagePrefs();
  const [targetLang, setTargetLang] = useState(initialPrefs.targetLang);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getTheme());

  const themeGradients: Record<string, string> = {
    'warm-orange': 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
    'ocean-blue': 'linear-gradient(135deg, #4A90D9, #5BA0E8)',
    'forest-green': 'linear-gradient(135deg, #27AE60, #2ECC71)',
    'royal-purple': 'linear-gradient(135deg, #8E44AD, #A569BD)',
    'midnight-dark': 'linear-gradient(135deg, #6C8CFF, #8BA4FF)',
  };

  const handleSave = async () => {
    setSaving(true);
    const prefs: LanguagePrefs = { nativeLang: NATIVE_LANG, targetLang };
    setLanguagePrefs(prefs);
    dispatch({ type: 'setLanguage', nativeLang: NATIVE_LANG, targetLang });

    if (authState.isLoggedIn) {
      try {
        await api.updateLanguage(NATIVE_LANG, targetLang);
      } catch (err) {
        console.error('云端同步语言设置失败:', err);
      }
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => {
      setSaved(false);
      dispatch({ type: 'setPage', page: 'home' });
    }, 2000);
  };

  const handleBack = () => {
    dispatch({ type: 'setPage', page: 'home' });
  };

  const targetOptions = LANGUAGES.filter((l) => l.code !== NATIVE_LANG);

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--color-primary-mid) 0%, var(--color-primary-end) 100%)',
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
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <AppLogo size={56} animated />
          </div>
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
            设置
          </h1>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '0.4rem',
            }}
          >
            母语 (Native Language)
          </label>
          <div
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              fontSize: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'rgba(0,0,0,0.04)',
              color: 'var(--color-text-muted)',
              cursor: 'not-allowed',
            }}
          >
            中文
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '0.4rem',
            }}
          >
            目标语言 (Target Language)
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              fontSize: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              appearance: 'auto',
            }}
          >
            {targetOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '0.4rem',
            }}
          >
            主题风格
          </label>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            {THEMES.map((theme) => {
              const selected = currentTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    setCurrentTheme(theme.id);
                    dispatch({ type: 'setTheme', theme: theme.id });
                    if (authState.isLoggedIn) {
                      api.updateTheme(theme.id).catch((err) => {
                        console.error('云端同步主题失败:', err);
                      });
                    }
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: themeGradients[theme.id],
                    border: selected ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'border 0.2s ease',
                  }}
                >
                  {selected && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.8em 1em',
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            marginBottom: '0.75rem',
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>

        {saved && (
          <div
            style={{
              color: '#22c55e',
              fontSize: '0.95rem',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: '0.75rem',
            }}
          >
            ✓ 已保存
          </div>
        )}

        <button
          onClick={handleBack}
          className="secondary"
          style={{
            width: '100%',
            marginBottom: '1.25rem',
          }}
        >
          返回
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          母语: {getNativeName(NATIVE_LANG)} → 目标语言: {getNativeName(targetLang)}
        </div>
      </div>
    </div>
  );
}
