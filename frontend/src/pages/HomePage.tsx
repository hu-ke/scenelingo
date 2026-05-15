import { useEffect, useRef, useState, useCallback } from 'react';
import { useReview } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import type { PhotoItem } from '../context/ReviewContext';
import { getPhotosGroupedByDate, deletePhoto, getAllPhotos, countPhotos, isLoggedIn } from '../utils/indexedDB';
import { api } from '../utils/api';
import { generateUUID } from '../utils/uuid';
import { resizeImage } from '../utils/resizeImage';

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function formatDateLabel(dateStr: string): string {
  if (dateStr === 'earlier') return '更早的照片';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${m}月${d}日 ${weekDays[date.getDay()]}`;
}

export default function HomePage() {
  const { state, dispatch } = useReview();
  const { state: authState, logout } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupedPhotos, setGroupedPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  );

  const loadLocalData = async () => {
    const photos = await getAllPhotos();
    const total = photos.length;

    const grouped = await getPhotosGroupedByDate();

    const wordSet = new Set<string>();
    for (const photo of photos) {
      if (photo.objects) {
        for (const obj of photo.objects) {
          if (obj?.name) wordSet.add(obj.name.toLowerCase());
        }
      }
    }

    setGroupedPhotos(grouped);
    setTotalCount(total);
    setWordCount(wordSet.size);
    dispatch({ type: 'setSavedPhotos', photos });
  };

  const loadData = useCallback(async () => {
    const loggedIn = isLoggedIn();

    if (loggedIn) {
      try {
        const result = await api.listPhotos();
        const cloudPhotos: PhotoItem[] = (result.photos || []).map((p: any) => ({
          id: p.id,
          dataUrl: p.originalUrl,
          annotatedDataUrl: p.annotatedUrl,
          objects: p.objects,
        }));

        const grouped: Record<string, PhotoItem[]> = {};
        for (const photo of cloudPhotos) {
          const date = (photo as any).collectionDate || new Date().toISOString().split('T')[0];
          if (!grouped[date]) grouped[date] = [];
          grouped[date].push(photo);
        }

        const totalCount = cloudPhotos.length;
        const wordSet = new Set<string>();
        for (const photo of cloudPhotos) {
          if (photo.objects) {
            for (const obj of photo.objects) {
              if (obj?.name) wordSet.add(obj.name.toLowerCase());
            }
          }
        }

        setGroupedPhotos(grouped);
        setTotalCount(totalCount);
        setWordCount(wordSet.size);
        dispatch({ type: 'setSavedPhotos', photos: cloudPhotos });
      } catch (err) {
        console.error('云端加载失败，尝试本地:', err);
        await loadLocalData();
      }
    } else {
      await loadLocalData();
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const learningDays = Object.keys(groupedPhotos).length;

  const toggleCollection = (dateKey: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      alert('请选择照片');
      return;
    }

    let imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) {
      alert('请选择照片');
      return;
    }

    if (imageFiles.length > 10) {
      alert('一次最多选择10张照片');
      imageFiles = imageFiles.slice(0, 10);
    }

    const loggedIn = isLoggedIn();
    if (!loggedIn) {
      const currentCount = await countPhotos();
      if (currentCount >= 10) {
        setShowLoginPrompt(true);
        return;
      }
      if (currentCount + imageFiles.length > 10) {
        setShowLoginPrompt(true);
        return;
      }
    }

    const photoItems: PhotoItem[] = [];
    for (const file of imageFiles) {
      const resizedBlob = await resizeImage(file, 1500);
      const dataUrl = await blobToDataURL(resizedBlob);
      photoItems.push({
        id: generateUUID(),
        dataUrl,
      });
    }

    dispatch({ type: 'setPhotos', photos: photoItems });
    dispatch({ type: 'setPage', page: 'review' });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除这张照片吗？')) return;

    const loggedIn = isLoggedIn();
    if (loggedIn) {
      try {
        await api.deletePhoto(id);
      } catch (err) {
        console.error('云端删除失败:', err);
        alert('删除失败，请重试');
        return;
      }
    } else {
      await deletePhoto(id);
    }

    dispatch({ type: 'toggleSelectPhoto', id });
    await loadData();
  };

  const handleToggleSelect = (id: string) => {
    dispatch({ type: 'toggleSelectPhoto', id });
  };

  const handleReProcess = (photo: PhotoItem) => {
    dispatch({ type: 'setPhotos', photos: [photo] });
    dispatch({ type: 'setPage', page: 'review' });
  };

  const handleMerge = () => {
    if (state.selectedPhotoIds.length < 2) return;
    dispatch({ type: 'setPage', page: 'merge' });
  };

  const hasAnyPhotos = totalCount > 0;
  const collectionEntries = Object.entries(groupedPhotos);

  return (
    <div className="page home-page">
      {/* ===== 顶部渐变 Header ===== */}
      <div className="home-header" style={{ position: 'relative' }}>
        <h1>场景英语</h1>
        <p>用照片探索身边的事物，轻松学习英语单词</p>
        {authState.isLoggedIn ? (
          <div
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              {authState.email}
            </span>
            <button
              onClick={() => dispatch({ type: 'setPage', page: 'settings' })}
              title="设置"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 'var(--radius-full)',
                color: '#fff',
                fontSize: '1rem',
                padding: '0.25rem 0.5rem',
                minHeight: 'unset',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ⚙️
            </button>
            <button
              onClick={() => {
                logout();
                dispatch({ type: 'setPage', page: 'home' });
              }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 'var(--radius-full)',
                color: '#fff',
                fontSize: '0.75rem',
                padding: '0.3rem 0.75rem',
                minHeight: 'unset',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              退出登录
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              dispatch({ type: 'setPage', page: 'login' });
            }}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              background: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 'var(--radius-full)',
              color: '#fff',
              fontSize: '0.75rem',
              padding: '0.3rem 0.75rem',
              minHeight: 'unset',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            登录
          </button>
        )}
      </div>

      {/* ===== 统计卡片行 ===== */}
      {hasAnyPhotos && (
        <div className="stats-row">
          <div className="card">
            <div className="card__icon">📅</div>
            <div className="card__number">{learningDays}</div>
            <div className="card__label">学习天数</div>
          </div>
          <div className="card">
            <div className="card__icon">📸</div>
            <div className="card__number">{totalCount}</div>
            <div className="card__label">照片总数</div>
          </div>
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }}
            onClick={() => dispatch({ type: 'setPage', page: 'wordbook' })}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
              (e.currentTarget as HTMLDivElement).style.transform = '';
            }}
          >
            <div className="card__icon">📝</div>
            <div className="card__number">{wordCount}</div>
            <div className="card__label">单词累计</div>
          </div>
        </div>
      )}

      {/* ===== 主体内容 ===== */}
      {loading ? (
        <p className="home-section__loading">加载中...</p>
      ) : !hasAnyPhotos ? (
        /* 空状态 */
        <div className="empty-state">
          <span className="empty-state__icon">🎒📸</span>
          <p className="empty-state__text">开始你的第一次探索吧！</p>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              marginTop: '0.5rem',
            }}
          >
            点击右下角按钮上传照片，识别物体，学习英语单词
          </p>
        </div>
      ) : (
        /* 按日期分组的集合卡片列表 */
        <div>
          {collectionEntries.map(([dateKey, photos]) => {
            const isExpanded = expandedCollections.has(dateKey);
            return (
              <div
                key={dateKey}
                className={`collection-card${isExpanded ? ' collection-card--expanded' : ''}`}
              >
                <div
                  className="collection-card__header"
                  onClick={() => toggleCollection(dateKey)}
                >
                  <div className="collection-card__date">
                    {formatDateLabel(dateKey)}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="collection-card__badge">
                      {photos.length} 张
                    </span>
                    <span className="collection-card__arrow">▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="collection-grid">
                    {photos.map((photo) => (
                      <div
                      key={photo.id}
                      style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={() => handleReProcess(photo)}
                    >
                        <img
                          src={photo.annotatedDataUrl || photo.dataUrl}
                          alt=""
                          className="collection-grid__thumb"
                        />
                        <label
                          className="photo-card__check"
                          style={{
                            top: '4px',
                            left: '4px',
                            width: '26px',
                            height: '26px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={state.selectedPhotoIds.includes(photo.id)}
                            onChange={() => handleToggleSelect(photo.id)}
                          />
                        </label>
                        <button
                          className="photo-card__delete"
                          style={{
                            top: '4px',
                            right: '4px',
                            width: '24px',
                            height: '24px',
                            minHeight: '24px',
                            fontSize: '0.85rem',
                          }}
                          onClick={(e) => handleDelete(photo.id, e)}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== FAB 浮动按钮 ===== */}
      <button
        className={`fab${!hasAnyPhotos ? ' fab--breathe' : ''}`}
        onClick={handleUploadClick}
        title="上传照片"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>

      {/* ===== 隐藏文件上传 input ===== */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ===== 底部合并栏 ===== */}
      <div
        className={`merge-bar${state.selectedPhotoIds.length >= 2 ? ' merge-bar--active' : ''}`}
      >
        <button
          className="merge-bar__btn"
          disabled={state.selectedPhotoIds.length < 2}
          onClick={handleMerge}
        >
          合并导出 (
          {state.selectedPhotoIds.length >= 2
            ? state.selectedPhotoIds.length
            : 0}
          /2+)
        </button>
      </div>

      {/* ===== 底部联系方式 ===== */}
      <div style={{
        textAlign: 'center',
        padding: '1rem 1rem 2rem',
        fontSize: '0.8rem',
        color: 'var(--color-text-muted)',
      }}>
        <span>联系作者：</span>
        <a
          href="mailto:403392669@qq.com"
          style={{
            color: 'var(--color-primary-mid)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          📧 403392669@qq.com
        </a>
      </div>

      {showLoginPrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setShowLoginPrompt(false)}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            maxWidth: '320px',
            width: '90%',
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
            <button
              onClick={() => { dispatch({ type: 'setPage', page: 'login' }); setShowLoginPrompt(false); }}
              style={{
                width: '100%',
                marginBottom: '0.5rem',
              }}
            >
              去登录
            </button>
            <button
              className="secondary"
              onClick={() => setShowLoginPrompt(false)}
              style={{ width: '100%' }}
            >
              暂不登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}