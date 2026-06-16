import { useCallback, useEffect, useRef, useState } from 'react';
import { useReview } from '../context/ReviewContext';
import type { RecognizedObject, RecognizedAction } from '../context/ReviewContext';
import { isLoggedIn, countPhotos, savePhoto } from '../utils/indexedDB';
import { api } from '../utils/api';
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs';
import { isInWordbookList, toggleWordbook, getWordbookWords } from '../utils/wordMastery';
import AnnotatedImage from '../components/AnnotatedImage';

async function dataURLtoBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  if (!response.ok) throw new Error(`图片加载失败: ${response.status}`);
  return response.blob();
}

function WordCard({ obj, wordbookWords, onWordbookChange }: { obj: RecognizedObject; wordbookWords: string[]; onWordbookChange?: (word: string, inWordbook: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [inWordbook, setInWordbook] = useState(() => isInWordbookList(obj.name, wordbookWords));

  const handleToggleWordbook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nowIn = await toggleWordbook(obj.name, inWordbook);
      setInWordbook(nowIn);
      onWordbookChange?.(obj.name, nowIn);
    } catch {
      // 静默失败
    }
  };

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
      {obj.romaji && (
        <div style={{ fontSize: '0.7rem', color: '#aaa' }}>
          {obj.romaji}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
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
          }}
          title="发音"
        >
          🔊
        </button>
        <button
          onClick={handleToggleWordbook}
          style={{
            background: inWordbook ? '#e8f5e9' : '#f5f5f5',
            border: inWordbook ? '1px solid #4caf50' : '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '0.7rem',
            padding: '0.15rem 0.45rem',
            cursor: 'pointer',
            color: inWordbook ? '#4caf50' : '#999',
            whiteSpace: 'nowrap',
            minHeight: 'unset',
          }}
          title={inWordbook ? '移出生词本' : '加入生词本'}
        >
          {inWordbook ? '📖 已加入' : '+ 生词本'}
        </button>
      </div>
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

function ActionCard({ action, wordbookWords, onWordbookChange }: { action: RecognizedAction; wordbookWords: string[]; onWordbookChange?: (word: string, inWordbook: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [inWordbook, setInWordbook] = useState(() => isInWordbookList(action.name, wordbookWords));

  const handleToggleWordbook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nowIn = await toggleWordbook(action.name, inWordbook);
      setInWordbook(nowIn);
      onWordbookChange?.(action.name, nowIn);
    } catch {
      // 静默失败
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
      borderRadius: 'var(--radius-md)',
      padding: '0.5rem 0.75rem',
      boxShadow: 'var(--shadow-xs)',
      cursor: 'pointer',
      border: '2px solid #FF9800',
      minWidth: '80px',
      textAlign: 'center',
      transition: 'all 0.2s ease',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ fontSize: '0.65rem', color: '#E65100', fontWeight: 600, marginBottom: '0.15rem' }}>
        🏃 动作
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#E65100' }}>
        {action.name}
      </div>
      {action.chinese && (
        <div style={{ fontSize: '0.85rem', color: '#BF360C', fontWeight: 500 }}>
          {action.chinese}
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: '#888' }}>
        {action.phonetic || ''}
      </div>
      {action.romaji && (
        <div style={{ fontSize: '0.7rem', color: '#aaa' }}>
          {action.romaji}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const u = new SpeechSynthesisUtterance(action.name);
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
          }}
          title="发音"
        >
          🔊
        </button>
        <button
          onClick={handleToggleWordbook}
          style={{
            background: inWordbook ? '#e8f5e9' : 'rgba(255,255,255,0.6)',
            border: inWordbook ? '1px solid #4caf50' : '1px solid #E65100',
            borderRadius: '6px',
            fontSize: '0.7rem',
            padding: '0.15rem 0.45rem',
            cursor: 'pointer',
            color: inWordbook ? '#4caf50' : '#E65100',
            whiteSpace: 'nowrap',
            minHeight: 'unset',
          }}
          title={inWordbook ? '移出生词本' : '加入生词本'}
        >
          {inWordbook ? '📖 已加入' : '+ 生词本'}
        </button>
      </div>
      {expanded && action.examples && action.examples.length > 0 && (
        <div style={{
          marginTop: '0.4rem',
          paddingTop: '0.4rem',
          borderTop: '1px solid #FFE0B2',
          textAlign: 'left',
          fontSize: '0.78rem',
          color: 'var(--color-text-secondary)',
        }}>
          {action.examples.map((ex, i) => (
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
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showReRecognizeDialog, setShowReRecognizeDialog] = useState(false);
  const [reRecognizeHint, setReRecognizeHint] = useState('');
  const [wordbookWords, setWordbookWords] = useState<string[]>([]);

  const { photos, currentIndex, currentObjects, currentActions, isReviewing, nativeLang, targetLang } = state;

  const currentObjectsRef = useRef(currentObjects);
  const currentActionsRef = useRef(currentActions);

  // 同步 ref，避免 recognizeImage 的依赖变化导致 useEffect 重复触发
  useEffect(() => {
    currentObjectsRef.current = currentObjects;
    currentActionsRef.current = currentActions;
  }, [currentObjects, currentActions]);

  // 加载生词本列表
  useEffect(() => {
    if (isLoggedIn()) {
      getWordbookWords().then(setWordbookWords);
    }
  }, []);

  const recognizeImage = useCallback(async (hint?: string) => {
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

      // 如果有 hint 且已有识别结果，把当前结果作为上下文传给 AI
      if (hint && currentObjectsRef.current && currentObjectsRef.current.length > 0) {
        formData.append('previous_objects', JSON.stringify(currentObjectsRef.current));
        if (currentActionsRef.current && currentActionsRef.current.length > 0) {
          formData.append('previous_actions', JSON.stringify(currentActionsRef.current));
        }
      }

      const data = hint
        ? await api.recognizeWithHint(formData, hint)
        : await api.recognize(formData);
      dispatch({ type: 'setCurrentObjects', objects: data.objects as RecognizedObject[] });
      if (data.actions && data.actions.length > 0) {
        dispatch({ type: 'setCurrentActions', actions: data.actions as RecognizedAction[] });
      }

      // 持久化到数据库，同时更新本地 photos 数组
      if (photo.id) {
        api.reRecognize(photo.id, data.objects, data.actions).catch((err) => {
          console.error('reRecognize 持久化失败:', err)
        })
        dispatch({
          type: 'updatePhotoObjects',
          index: currentIndex,
          objects: data.objects as RecognizedObject[],
          actions: data.actions as RecognizedAction[] | undefined,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [currentIndex, photos, dispatch, nativeLang, targetLang]);

  const handleReRecognize = useCallback(() => {
    setShowReRecognizeDialog(true);
  }, []);

  const handleReRecognizeConfirm = useCallback(() => {
    setShowReRecognizeDialog(false);
    recognizeImage(reRecognizeHint.trim() || undefined);
    setReRecognizeHint('');
  }, [recognizeImage, reRecognizeHint]);

  const handleReRecognizeSkip = useCallback(() => {
    setShowReRecognizeDialog(false);
    recognizeImage();
    setReRecognizeHint('');
  }, [recognizeImage]);

  const lastRecognizedRef = useRef(-1);

  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length && lastRecognizedRef.current !== currentIndex) {
      lastRecognizedRef.current = currentIndex;
      const photo = photos[currentIndex];
      if (photo?.objects && photo.objects.length > 0) {
        dispatch({ type: 'setCurrentObjects', objects: photo.objects });
        if (photo.actions && photo.actions.length > 0) {
          dispatch({ type: 'setCurrentActions', actions: photo.actions });
        }
        return;
      }
      recognizeImage();
    }
  }, [currentIndex, photos.length, recognizeImage, photos, dispatch]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      a.href = url;
      a.download = `scene_lingo_${today}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [canvasRef]);

  const handleSaveLocally = useCallback(async () => {
    if (!canvasRef.current) return;
    const annotatedDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

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
    });

    dispatch({ type: 'nextPhoto' });
  }, [currentIndex, currentObjects, photos, dispatch, canvasRef]);

  const handleSkip = useCallback(() => {
    dispatch({ type: 'skipCurrent' });
    dispatch({ type: 'nextPhoto' });
  }, [dispatch]);

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
          <h1>全部完成！</h1>
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
            actions={currentActions ?? undefined}
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
            <WordCard key={idx} obj={obj} wordbookWords={wordbookWords} onWordbookChange={(word, inWb) => {
              setWordbookWords(prev => inWb ? [...prev, word.toLowerCase()] : prev.filter(w => w !== word.toLowerCase()))
            }} />
          ))}
        </div>
      )}

      {/* 动作单词 */}
      {currentActions && currentActions.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          {currentActions.map((action, idx) => (
            <ActionCard key={idx} action={action} wordbookWords={wordbookWords} onWordbookChange={(word, inWb) => {
              setWordbookWords(prev => inWb ? [...prev, word.toLowerCase()] : prev.filter(w => w !== word.toLowerCase()))
            }} />
          ))}
        </div>
      )}

      {/* 操作按钮组 */}
      <div className="review-actions">
        <button onClick={handleReRecognize} disabled={loading}>
          {loading ? '识别中...' : '重新识别'}
        </button>
        {!isLoggedIn() && (
          <button onClick={handleSaveLocally} disabled={loading || !currentObjects}>
            保存到本地
          </button>
        )}
        {!isLoggedIn() && (
          <button onClick={handleSkip} disabled={loading}>
            跳过
          </button>
        )}
        <button onClick={handleDownload} disabled={!currentObjects}>
          下载
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
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              本地最多保存10张照片
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              登录后可无限存储，还能跨设备同步哦~
            </div>
            <button onClick={() => { dispatch({ type: 'setPage', page: 'login' }); setShowLoginPrompt(false); }} style={{ width: '100%', marginBottom: '0.5rem' }}>
              去登录
            </button>
            <button className="secondary" onClick={() => setShowLoginPrompt(false)} style={{ width: '100%' }}>
              暂不登录
            </button>
          </div>
        </div>
      )}

      {/* 重新识别弹框 */}
      {showReRecognizeDialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }} onClick={() => { setShowReRecognizeDialog(false); setReRecognizeHint(''); }}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            maxWidth: '360px', width: '90%',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>
              重新识别
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
              描述你希望调整的内容，AI会根据你的提示重新识别
            </div>
            <textarea
              value={reRecognizeHint}
              onChange={(e) => setReRecognizeHint(e.target.value)}
              placeholder="例如：请识别右下角的物体 / 漏掉了桌子上的杯子 / 动作应该是"cooking"而不是"standing""
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--color-border)',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="secondary"
                onClick={handleReRecognizeSkip}
                style={{ flex: 1 }}
              >
                直接重新识别
              </button>
              <button
                onClick={handleReRecognizeConfirm}
                style={{ flex: 1 }}
              >
                带提示重新识别
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}