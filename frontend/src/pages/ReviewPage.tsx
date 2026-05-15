import { useCallback, useEffect, useRef, useState } from 'react';
import { useReview } from '../context/ReviewContext';
import type { RecognizedObject } from '../context/ReviewContext';
import { isLoggedIn, countPhotos, savePhoto } from '../utils/indexedDB';
import { api } from '../utils/api';
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs';
import AnnotatedImage from '../components/AnnotatedImage';

async function dataURLtoBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  if (!response.ok) throw new Error(`图片加载失败: ${response.status}`);
  return response.blob();
}

function WordCard({ obj }: { obj: RecognizedObject }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)',
      padding: '0.5rem 0.75rem',
      boxShadow: 'var(--shadow-xs)',
      cursor: 'pointer',
      border: '2px solid var(--color-border)',
      minWidth: '80px',
      textAlign: 'center',
      transition: 'all 0.2s ease',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
        {obj.name}
      </div>
      {obj.chinese && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-primary-mid)', fontWeight: 500 }}>
          {obj.chinese}
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: '#888' }}>
        {obj.phonetic || ''}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const u = new SpeechSynthesisUtterance(obj.name);
          u.lang = getTtsLang(getLanguagePrefs().targetLang);
          speechSynthesis.speak(u);
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.85rem',
          padding: '0.15rem',
          minHeight: 'unset',
          marginTop: '0.25rem',
        }}
        title="发音"
      >
        🔊
      </button>
      {expanded && obj.examples && obj.examples.length > 0 && (
        <div style={{
          marginTop: '0.4rem',
          paddingTop: '0.4rem',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'left',
          fontSize: '0.78rem',
          color: 'var(--color-text-secondary)',
        }}>
          {obj.examples.map((ex, i) => (
            <div key={i} style={{ marginBottom: '0.25rem' }}>📖 {ex}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const { state, dispatch } = useReview();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipCount, setSkipCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { photos, currentIndex, currentObjects, isReviewing, nativeLang, targetLang } = state;

  const recognizeImage = useCallback(async () => {
    const photo = photos[currentIndex];
    if (!photo) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('nativeLang', nativeLang);
      formData.append('targetLang', targetLang);

      if (photo.dataUrl.startsWith('data:')) {
        const blob = await dataURLtoBlob(photo.dataUrl);
        formData.append('image', blob, 'photo.jpg');
      } else {
        formData.append('photo_url', photo.dataUrl);
      }

      const data = await api.recognize(formData);
      dispatch({ type: 'setCurrentObjects', objects: data.objects as RecognizedObject[] });
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [currentIndex, photos, dispatch, nativeLang, targetLang]);

  const lastRecognizedRef = useRef(-1);

  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length && lastRecognizedRef.current !== currentIndex) {
      lastRecognizedRef.current = currentIndex;
      const photo = photos[currentIndex];
      if (photo?.objects && photo.objects.length > 0) {
        dispatch({ type: 'setCurrentObjects', objects: photo.objects });
        return;
      }
      recognizeImage();
    }
  }, [currentIndex, photos.length, recognizeImage, photos, dispatch]);

  const handleSave = useCallback(async () => {
    if (!canvasRef.current) return;
    const annotatedDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    const loggedIn = isLoggedIn();

    if (loggedIn) {
      try {
        const annotatedBlob = await dataURLtoBlob(annotatedDataUrl);

        const formData = new FormData();
        if (currentPhoto.dataUrl.startsWith('data:')) {
          const originalBlob = await dataURLtoBlob(currentPhoto.dataUrl);
          formData.append('original', originalBlob, 'original.jpg');
        } else {
          formData.append('original_url', currentPhoto.dataUrl);
        }
        formData.append('annotated', annotatedBlob, 'annotated.jpg');
        formData.append('metadata', JSON.stringify({
          id: currentPhoto.id,
          objects: currentObjects || [],
          collectionDate: new Date().toISOString().split('T')[0],
          createdAt: Date.now(),
        }));

        await api.uploadPhoto(formData);
      } catch (err) {
        console.error('OSS上传失败:', err);
        alert('云端保存失败，请稍后重试');
        return;
      }
    } else {
      const currentCount = await countPhotos();
      if (currentCount >= 10) {
        setShowLoginPrompt(true);
        return;
      }

      await savePhoto({
        id: currentPhoto.id,
        dataUrl: currentPhoto.dataUrl,
        annotatedDataUrl,
        objects: currentObjects ?? undefined,
        // createdAt: Date.now(),
        // collectionDate: new Date().toISOString().split('T')[0],
      });
    }

    setSavedCount((c) => c + 1);
    dispatch({ type: 'nextPhoto' });
  }, [currentIndex, currentObjects, photos, dispatch, canvasRef]);

  const handleSkip = () => {
    setSkipCount((c) => c + 1);
    dispatch({ type: 'skipCurrent' });
    dispatch({ type: 'nextPhoto' });
  };

  // ===== 完成画面：所有照片处理完毕 =====
  if (!isReviewing && photos.length > 0) {
    return (
      <div className="page review-page" style={{ position: 'relative' }}>
        <button
          onClick={() => dispatch({ type: 'setPage', page: 'home' })}
          style={{
            position: 'absolute',
            top: '0.25rem',
            left: '0.25rem',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.15rem',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            padding: 0,
            minHeight: 'unset',
            zIndex: 10,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          ←
        </button>

        <div className="review-completion">
          <span className="review-completion__icon">🎉</span>
          <h1>太棒了！</h1>
          <div className="review-completion__stats">
            <div className="review-completion__stat">
              <div className="review-completion__stat-number">{savedCount}</div>
              <div className="review-completion__stat-label">已保存</div>
            </div>
            <div className="review-completion__stat">
              <div className="review-completion__stat-number">{skipCount}</div>
              <div className="review-completion__stat-label">已跳过</div>
            </div>
          </div>
          <button onClick={() => dispatch({ type: 'setPage', page: 'home' })}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // ===== 无照片时直接返回首页 =====
  if (photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  // ===== 正常复习画面 =====
  return (
    <div className="page review-page" style={{ position: 'relative' }}>
      {/* 顶部返回按钮 */}
      <button
        onClick={() => dispatch({ type: 'setPage', page: 'home' })}
        style={{
          position: 'absolute',
          top: '0.25rem',
          left: '0.25rem',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '2px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.15rem',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          padding: 0,
          minHeight: 'unset',
          zIndex: 10,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        ←
      </button>

      {/* 进度条 */}
      <div className="review-progress">
        <div className="review-progress__bar">
          <div
            className="review-progress__bar-fill"
            style={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
          />
        </div>
        <div className="review-progress__text">
          <span>{currentIndex + 1}</span>/{photos.length}
        </div>
      </div>

      {/* 图片卡片 */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="dot-loader">
              <span className="dot-loader__dot" />
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.75rem' }}>
              正在识别...
            </p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: 'var(--color-danger)', marginBottom: '0.75rem' }}>
              {error}
            </p>
            <button onClick={recognizeImage}>重试</button>
          </div>
        ) : currentObjects ? (
          <AnnotatedImage
            ref={canvasRef}
            dataUrl={currentPhoto.dataUrl}
            objects={currentObjects}
          />
        ) : null}
      </div>

      {/* 识别到的单词列表 */}
      {currentObjects && currentObjects.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          {currentObjects.map((obj, idx) => (
            <WordCard key={idx} obj={obj} />
          ))}
        </div>
      )}

      {/* 操作按钮组 */}
      <div className="review-actions">
        <button onClick={recognizeImage} disabled={loading}>
          {loading ? '识别中...' : '重新识别'}
        </button>
        <button onClick={handleSave} disabled={loading || !currentObjects}>
          保存
        </button>
        <button onClick={handleSkip} disabled={loading}>
          跳过
        </button>
      </div>

      {showLoginPrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }} onClick={() => setShowLoginPrompt(false)}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            maxWidth: '320px', width: '90%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              本地最多保存10张照片
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              登录后可无限存储，还能跨设备同步哦~
            </div>
            <button onClick={() => { dispatch({ type: 'setPage', page: 'login' }); }} style={{ width: '100%', marginBottom: '0.5rem' }}>
              去登录
            </button>
            <button className="secondary" onClick={() => setShowLoginPrompt(false)} style={{ width: '100%' }}>
              继续使用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}