import { useState } from 'react';
import { useReview } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import { getLanguagePrefs, setLanguagePrefs, LANGUAGES, getNativeName } from '../utils/languagePrefs';
import type { LanguagePrefs } from '../utils/languagePrefs';
import { api } from '../utils/api';

const NATIVE_LANG = 'zh';

export default function SettingsPage() {
  const { dispatch } = useReview();
  const { state: authState } = useAuth();

  const initialPrefs = getLanguagePrefs();
  const [targetLang, setTargetLang] = useState(initialPrefs.targetLang);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
          <span
            style={{
              fontSize: '3.5rem',
              display: 'block',
              marginBottom: '0.5rem',
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
