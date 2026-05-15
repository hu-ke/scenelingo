import { useEffect, useState } from 'react';
import { useReview } from '../context/ReviewContext';
import type { PhotoItem } from '../context/ReviewContext';
import { getAllPhotos, isLoggedIn } from '../utils/indexedDB';
import { api } from '../utils/api';
import { isMastered, toggleMastered } from '../utils/wordMastery';
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs';

export default function WordDetailPage() {
  const { state, dispatch } = useReview();
  const word = state.wordDetailWord;
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [phonetic, setPhonetic] = useState<string>('');
  const [chinese, setChinese] = useState<string>('');
  const [examples, setExamples] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mastered, setMastered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!word) {
        setLoading(false);
        return;
      }

      try {
        let allPhotos: PhotoItem[] = [];

        if (isLoggedIn()) {
          try {
            const result = await api.listPhotos();
            allPhotos = result.photos.map((p: any) => ({
              id: p.id,
              dataUrl: p.originalUrl,
              annotatedDataUrl: p.annotatedUrl,
              objects: p.objects,
            }));
          } catch (err) {
            console.error('[WordDetail] 云端加载失败，尝试本地:', err);
            allPhotos = await getAllPhotos();
          }
        } else {
          allPhotos = await getAllPhotos();
        }
        if (cancelled) return;
        setMastered(isMastered(word));

        // Filter photos whose objects array contains the current word (case-insensitive)
        const matchingPhotos = allPhotos.filter((photo) =>
          photo.objects?.some(
            (obj) => obj.name.toLowerCase() === word.toLowerCase()
          )
        );

        // Extract phonetic and examples from the first matching object that has them
        let foundPhonetic = '';
        let foundChinese = '';
        let foundExamples: string[] = [];

        for (const photo of matchingPhotos) {
          const matchedObj = photo.objects?.find(
            (obj) => obj.name.toLowerCase() === word.toLowerCase()
          );
          if (matchedObj) {
            if (!foundPhonetic && matchedObj.phonetic) {
              foundPhonetic = matchedObj.phonetic;
            }
            if (!foundChinese && matchedObj.chinese) {
              foundChinese = matchedObj.chinese;
            }
            if (foundExamples.length === 0 && matchedObj.examples?.length > 0) {
              foundExamples = matchedObj.examples;
            }
            if (foundPhonetic && foundChinese && foundExamples.length > 0) break;
          }
        }

        setPhotos(matchingPhotos);
        setPhonetic(foundPhonetic);
        setChinese(foundChinese);
        setExamples(foundExamples);
      } catch {
        setPhotos([]);
        setPhonetic('');
        setChinese('');
        setExamples([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [word]);

  const handleSpeak = () => {
    if (!word) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = getTtsLang(getLanguagePrefs().targetLang);
    speechSynthesis.speak(utterance);
  };

  const handleBack = () => {
    dispatch({ type: 'setPage', page: 'wordbook' });
  };

  // ===== Empty state: no word selected =====
  if (!word) {
    return (
      <div className="page" style={{ animation: 'fadeIn 0.4s ease' }}>
        <div className="home-header" style={{ position: 'relative' }}>
          <button
            onClick={handleBack}
            style={{
              position: 'absolute',
              top: '50%',
              left: 'var(--space-md)',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '50%',
              width: 36,
              height: 36,
              minHeight: 36,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              backdropFilter: 'blur(4px)',
            }}
            title="返回单词本"
          >
            ←
          </button>
          <h1>单词详情</h1>
          <p>未选择单词</p>
        </div>
        <div className="empty-state">
          <span className="empty-state__icon">📖</span>
          <p className="empty-state__text">
            未选择单词，请从单词本中选择一个单词查看。
          </p>
        </div>
      </div>
    );
  }

  // ===== Loading state =====
  if (loading) {
    return (
      <div className="page" style={{ animation: 'fadeIn 0.4s ease' }}>
        <div className="home-header" style={{ position: 'relative' }}>
          <button
            onClick={handleBack}
            style={{
              position: 'absolute',
              top: '50%',
              left: 'var(--space-md)',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '50%',
              width: 36,
              height: 36,
              minHeight: 36,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              backdropFilter: 'blur(4px)',
            }}
            title="返回单词本"
          >
            ←
          </button>
          <h1>单词详情</h1>
          <p>加载中...</p>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // ===== Normal state: word loaded =====
  return (
    <div className="page" style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* ---- Header ---- */}
      <div className="home-header" style={{ position: 'relative' }}>
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: '50%',
            left: 'var(--space-md)',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '1.25rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '50%',
            width: 36,
            height: 36,
            minHeight: 36,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            backdropFilter: 'blur(4px)',
          }}
          title="返回单词本"
        >
          ←
        </button>
        <h1>单词详情</h1>
        <p>
          {photos.length > 0
            ? `在 ${photos.length} 张照片中学到`
            : '暂无关联照片'}
        </p>
      </div>

      {/* ---- Word display card ---- */}
      <div
        className="card"
        style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}
      >
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background:
              'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.25rem',
          }}
        >
          {word}
        </div>

        {chinese && (
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--color-primary-mid)',
              marginBottom: '0.2rem',
            }}
          >
            {chinese}
          </div>
        )}

        {phonetic && (
          <div
            style={{
              fontSize: '1rem',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic',
              marginBottom: 'var(--space-md)',
            }}
          >
            {phonetic}
          </div>
        )}

        <button
          onClick={handleSpeak}
          style={{
            background:
              'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-mid))',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '1.1rem',
            borderRadius: 'var(--radius-full)',
            padding: '0.5em 1.8em',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          🔊 发音
        </button>

        {mastered ? (
          <div
            onClick={() => {
              toggleMastered(word);
              setMastered(false);
            }}
            style={{
              marginTop: 'var(--space-sm)',
              padding: '0.35em 1.2em',
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              background: 'rgba(128,128,128,0.08)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'inline-block',
              userSelect: 'none',
            }}
          >
            ✅ 该单词已掌握
          </div>
        ) : (
          <button
            onClick={() => {
              toggleMastered(word);
              setMastered(true);
            }}
            style={{
              background:
                'linear-gradient(135deg, #43e97b, #38f9d7)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1rem',
              borderRadius: 'var(--radius-full)',
              padding: '0.45em 1.6em',
              cursor: 'pointer',
              fontWeight: 600,
              marginTop: 'var(--space-sm)',
            }}
          >
            标记为已掌握
          </button>
        )}
      </div>

      {/* ---- Photos section ---- */}
      <div className="home-section">
        <div className="home-section__title">📸 学习照片</div>
        {photos.length === 0 ? (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              textAlign: 'center',
              padding: '1rem 0',
            }}
          >
            暂无关联照片
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-sm)',
            }}
          >
            {photos.slice(0, 3).map((photo, i) => (
              <div
                key={photo.id}
                className="photo-card"
                style={{
                  animation: `scaleIn 0.3s ease ${i * 0.1}s both`,
                }}
              >
                <img
                  src={photo.annotatedDataUrl || photo.dataUrl}
                  alt=""
                  className="photo-card__img"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Examples section ---- */}
      <div className="home-section">
        <div className="home-section__title">📖 例句</div>
        {examples.length === 0 ? (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              textAlign: 'center',
              padding: '1rem 0',
            }}
          >
            暂无例句
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            {examples.slice(0, 2).map((example, i) => (
              <div
                key={i}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-sm)',
                  animation: `fadeIn 0.3s ease ${i * 0.15}s both`,
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>📖</span>
                <span
                  style={{
                    fontSize: '0.95rem',
                    color: 'var(--color-text)',
                    lineHeight: 1.6,
                  }}
                >
                  {example}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}