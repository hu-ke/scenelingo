import { useEffect, useRef, useState, useCallback } from 'react';
import { useReview } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import type { PhotoItem } from '../context/ReviewContext';
import { getPhotosGroupedByDate, deletePhoto, getAllPhotos, countPhotos, isLoggedIn } from '../utils/indexedDB';
import { api } from '../utils/api';
import { getApiBaseUrl } from '../utils/api';
import { generateUUID } from '../utils/uuid';
import { resizeImage } from '../utils/resizeImage';
import { getWordbookWords, migrateLocalWordbook } from '../utils/wordMastery';
import AppLogo from '../components/AppLogo';

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

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateString(date);
}

const ANNOTATION_COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B'];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSpeakerIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string
) {
  const s = size;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  const bodyW = s * 0.28;
  const bodyH = s * 0.5;
  const bodyX = x;
  const bodyY = y + (s - bodyH) / 2;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  const coneX = bodyX + bodyW;
  ctx.beginPath();
  ctx.moveTo(coneX, bodyY);
  ctx.lineTo(coneX + s * 0.22, y + s * 0.15);
  ctx.lineTo(coneX + s * 0.22, y + s * 0.85);
  ctx.lineTo(coneX, bodyY + bodyH);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 1.5;
  const waveCX = coneX + s * 0.3;
  const waveCY = y + s / 2;
  ctx.beginPath();
  ctx.arc(waveCX, waveCY, s * 0.12, -0.65, 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(waveCX, waveCY, s * 0.22, -0.65, 0.65);
  ctx.stroke();
}

function drawBubbleTail(
  ctx: CanvasRenderingContext2D,
  centerX: number, attachY: number,
  tailWidth: number, tailHeight: number, pointingUp: boolean
) {
  const halfW = tailWidth / 2;
  ctx.beginPath();
  if (pointingUp) {
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.lineTo(centerX + halfW, attachY);
  } else {
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.lineTo(centerX + halfW, attachY);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

function drawTailStroke(
  ctx: CanvasRenderingContext2D,
  centerX: number, attachY: number,
  tailWidth: number, tailHeight: number, pointingUp: boolean, color: string
) {
  const halfW = tailWidth / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (pointingUp) {
    ctx.beginPath();
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.stroke();
  }
}

function renderAnnotatedImage(dataUrl: string, objects: any[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no context')); return; }

      ctx.drawImage(img, 0, 0);

      if (objects.length === 0) {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('blob failed'));
        }, 'image/jpeg', 0.9);
        return;
      }

      const scaleX = canvas.width / 1000;
      const scaleY = canvas.height / 1000;
      const fontSize = Math.max(14, Math.min(22, canvas.width / 35));
      const phoneticFontSize = Math.max(10, Math.min(15, fontSize * 0.7));
      const romajiFontSize = Math.max(9, Math.min(12, fontSize * 0.55));
      const lineHeight = fontSize + 4;
      const phoneticLineHeight = phoneticFontSize + 2;
      const romajiLineHeight = romajiFontSize + 2;

      const bubblePaddingX = 14;
      const bubblePaddingY = 10;
      const bubbleRadius = 12;
      const speakerSize = 22;
      const speakerGap = 8;
      const tailWidth = 16;
      const tailHeight = 10;
      const bubbleGap = 8;

      // 去重：相同单词只保留第一个
      const seenNames = new Set<string>();
      const uniqueObjects = objects.filter(obj => {
        const name = (obj.name || '').toLowerCase();
        if (seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
      });

      for (let i = 0; i < uniqueObjects.length; i++) {
        const obj = uniqueObjects[i];
        const color = ANNOTATION_COLORS[i % ANNOTATION_COLORS.length];

        const [bx1, by1, bx2, by2] = obj.bbox || [0, 0, 0, 0];
        const px = bx1 * scaleX;
        const py = by1 * scaleY;
        const pw = (bx2 - bx1) * scaleX;
        const ph = (by2 - by1) * scaleY;

        const bboxCenterX = px + pw / 2;

        ctx.font = `bold ${fontSize}px sans-serif`;
        const wordWidth = ctx.measureText(obj.name || '').width;

        ctx.font = `${phoneticFontSize}px sans-serif`;
        const phoneticWidth = ctx.measureText(obj.phonetic || '').width;

        ctx.font = `${romajiFontSize}px sans-serif`;
        const romajiWidth = ctx.measureText(obj.romaji || '').width;

        const hasRomaji = !!(obj.romaji);
        const textWidth = Math.max(wordWidth, phoneticWidth, romajiWidth);
        const bubbleW = Math.max(140, Math.min(240, textWidth + speakerSize + speakerGap + bubblePaddingX * 2));
        const bubbleH = bubblePaddingY * 2 + lineHeight + phoneticLineHeight + (hasRomaji ? romajiLineHeight : 0);

        let bubbleX = bboxCenterX - bubbleW / 2;
        let bubbleY = py - bubbleH - tailHeight - bubbleGap;
        let tailUp = false;

        if (bubbleX < 0) bubbleX = 2;
        if (bubbleX + bubbleW > canvas.width) bubbleX = canvas.width - bubbleW - 2;

        if (bubbleY < 0) {
          bubbleY = py + ph + bubbleGap;
          tailUp = true;
        }

        const speakerX = bubbleX + bubbleW - bubblePaddingX - speakerSize;
        const speakerY = bubbleY + (bubbleH - speakerSize) / 2;

        roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleRadius);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const attachY = tailUp ? bubbleY : bubbleY + bubbleH;
        drawBubbleTail(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp);
        drawTailStroke(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp, color);

        ctx.fillStyle = '#333333';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(obj.name || '', bubbleX + bubblePaddingX, bubbleY + bubblePaddingY);

        if (obj.phonetic) {
          ctx.fillStyle = '#888888';
          ctx.font = `${phoneticFontSize}px sans-serif`;
          ctx.fillText(
            obj.phonetic,
            bubbleX + bubblePaddingX,
            bubbleY + bubblePaddingY + lineHeight
          );
        }

        if (obj.romaji) {
          ctx.fillStyle = '#aaaaaa';
          ctx.font = `${romajiFontSize}px sans-serif`;
          ctx.fillText(
            obj.romaji,
            bubbleX + bubblePaddingX,
            bubbleY + bubblePaddingY + lineHeight + phoneticLineHeight
          );
        }

        drawSpeakerIcon(ctx, speakerX, speakerY, speakerSize, color);
      }

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('blob failed'));
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => reject(new Error('image load failed'));

    if (dataUrl.startsWith('http')) {
      img.src = `${getApiBaseUrl()}/api/image/proxy?url=${encodeURIComponent(dataUrl)}`;
    } else {
      img.src = dataUrl;
    }
  });
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedChunks, setLoadedChunks] = useState(0); // 已加载的2周块数
  const [oldestDate, setOldestDate] = useState<string>(''); // 用户最早照片日期
  const initialLoadDone = useRef(false);

  const countWordbookWords = (photos: PhotoItem[], wordbookWords: string[]): number => {
    const photoWordSet = new Set<string>();
    for (const photo of photos) {
      if (photo.objects) {
        for (const obj of photo.objects) {
          if (obj?.name) photoWordSet.add(obj.name.toLowerCase());
        }
      }
    }
    return wordbookWords.filter(w => photoWordSet.has(w)).length;
  };

  const loadLocalData = async () => {
    const photos = await getAllPhotos();
    const total = photos.length;

    const grouped = await getPhotosGroupedByDate();

    setGroupedPhotos(grouped);
    setTotalCount(total);
    // 未登录时生词本列表为空
    setWordCount(0);
    dispatch({ type: 'setSavedPhotos', photos });

    const today = new Date().toISOString().split('T')[0];
    if (grouped[today]) {
      setExpandedCollections((prev) => {
        if (prev.has(today)) return prev;
        const next = new Set(prev);
        next.add(today);
        return next;
      });
    }
  };

  const loadData = useCallback(async (startDate?: string, endDate?: string) => {
    const loggedIn = isLoggedIn();

    if (loggedIn) {
      try {
        // 迁移本地残留的生词本数据到服务端
        migrateLocalWordbook();
        // 从服务端获取生词本列表
        const wordbookWords = await getWordbookWords();

        const result: any = await api.listPhotos(startDate, endDate);

        // 记录用户最早照片日期
        if (result.oldest_date) {
          setOldestDate(result.oldest_date);
        }

        const cloudPhotos: PhotoItem[] = (result.photos || []).map((p: any) => ({
          id: p.id,
          dataUrl: p.originalUrl,
          annotatedDataUrl: p.annotatedUrl,
          objects: p.objects,
          status: p.status || 'completed',
          collectionDate: p.collectionDate,
        }));

        const annotationTasks: Promise<void>[] = [];
        for (const photo of cloudPhotos) {
          if (
            photo.status === 'completed' &&
            !photo.annotatedDataUrl &&
            photo.objects &&
            photo.objects.length > 0
          ) {
            annotationTasks.push(
              (async () => {
                try {
                  const blob = await renderAnnotatedImage(photo.dataUrl, photo.objects!);
                  const formData = new FormData();
                  formData.append('annotated', blob, 'annotated.jpg');
                  formData.append('photo_id', photo.id);
                  await api.uploadAnnotated(formData);
                } catch (err) {
                  console.error(`标注上传失败 ${photo.id}:`, err);
                }
              })()
            );
          }
        }
        await Promise.allSettled(annotationTasks);

        const grouped: Record<string, PhotoItem[]> = {};
        for (const photo of cloudPhotos) {
          const date = (photo as any).collectionDate || new Date().toISOString().split('T')[0];
          if (!grouped[date]) grouped[date] = [];
          grouped[date].push(photo);
        }

        const totalCount = cloudPhotos.length;

        setGroupedPhotos(grouped);
        setTotalCount(totalCount);
        setWordCount(countWordbookWords(cloudPhotos, wordbookWords));
        dispatch({ type: 'setSavedPhotos', photos: cloudPhotos });

        const today = new Date().toISOString().split('T')[0];
        if (grouped[today]) {
          setExpandedCollections((prev) => {
            if (prev.has(today)) return prev;
            const next = new Set(prev);
            next.add(today);
            return next;
          });
        }
      } catch (err) {
        console.error('云端加载失败，尝试本地:', err);
        await loadLocalData();
      }
    } else {
      await loadLocalData();
    }

    setLoading(false);
  }, []);

  // 加载下一个2周块，与已有数据合并
  const loadMorePhotos = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextChunk = loadedChunks + 1;
      const endDate = getDateBefore((nextChunk - 1) * 14);
      const startDate = getDateBefore(nextChunk * 14 - 1);

      const result: any = await api.listPhotos(startDate, endDate);
      if (result.oldest_date) {
        setOldestDate(result.oldest_date);
      }

      const newPhotos: PhotoItem[] = (result.photos || []).map((p: any) => ({
        id: p.id,
        dataUrl: p.originalUrl,
        annotatedDataUrl: p.annotatedUrl,
        objects: p.objects,
        status: p.status || 'completed',
        collectionDate: p.collectionDate,
      }));

      // 合并到现有分组
      const merged = { ...groupedPhotos };
      for (const photo of newPhotos) {
        const date = (photo as any).collectionDate || new Date().toISOString().split('T')[0];
        if (!merged[date]) merged[date] = [];
        // 避免重复
        if (!merged[date].some(p => p.id === photo.id)) {
          merged[date].push(photo);
        }
      }

      // 重新计算总数和生词
      const wordbookWords = await getWordbookWords();
      const allPhotos = Object.values(merged).flat();
      setGroupedPhotos(merged);
      setTotalCount(allPhotos.length);
      setWordCount(countWordbookWords(allPhotos, wordbookWords));
      dispatch({ type: 'setSavedPhotos', photos: allPhotos });

      setLoadedChunks(nextChunk);
    } catch (err) {
      console.error('加载更早照片失败:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadedChunks, groupedPhotos]);

  // 是否还有更多可加载：下一块起始日期 > 最早照片日期
  const hasMore = oldestDate
    ? getDateBefore((loadedChunks + 1) * 14 - 1) > oldestDate
    : true;

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      const today = getDateString(new Date());
      const twoWeeksAgo = getDateBefore(13);
      loadData(twoWeeksAgo, today);
      setLoadedChunks(1);
    }
  }, [loadData]);

  useEffect(() => {
    if (!initialLoadDone.current) return;

    const hasNonCompleted = Object.values(groupedPhotos).some(photos =>
      photos.some(p => p.status && p.status !== 'completed')
    );

    if (!hasNonCompleted) return;

    const interval = setInterval(() => {
      const today = getDateString(new Date());
      const startDate = getDateBefore(loadedChunks * 14 - 1);
      loadData(startDate, today);
    }, 2000);

    return () => clearInterval(interval);
  }, [groupedPhotos, loadedChunks, loadData]);

  useEffect(() => {
    const allIds = Object.values(groupedPhotos).flat().map(p => p.id);
    dispatch({ type: 'cleanSelection', ids: allIds });
  }, [groupedPhotos, dispatch]);

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

    if (loggedIn) {
      setUploading(true);
      setUploadProgress({ current: 0, total: imageFiles.length });

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const resizedBlob = await resizeImage(file, 1500);
          const formData = new FormData();
          formData.append('original', resizedBlob, file.name || 'original.jpg');
          await api.uploadPending(formData);
        } catch (err) {
          console.error('上传失败:', err);
        }
        setUploadProgress({ current: i + 1, total: imageFiles.length });
      }

      setUploading(false);
      await loadData();
    } else {
      const currentCount = await countPhotos();
      if (currentCount >= 10) {
        setShowLoginPrompt(true);
        return;
      }
      if (currentCount + imageFiles.length > 10) {
        setShowLoginPrompt(true);
        return;
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
    }

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

    dispatch({ type: 'removeSelected', id });
    await loadData();
  };

  const handleToggleSelect = (id: string) => {
    dispatch({ type: 'toggleSelectPhoto', id });
  };

  const handleReProcess = (photo: PhotoItem) => {
    dispatch({ type: 'setPhotos', photos: [photo] });
    dispatch({ type: 'setPage', page: 'review' });
  };

  const handleBatchDelete = async () => {
    const ids = [...state.selectedPhotoIds];
    if (ids.length === 0) return;
    if (!confirm(`确定删除选中的 ${ids.length} 张照片吗？此操作不可恢复。`)) return;

    const loggedIn = isLoggedIn();
    for (const id of ids) {
      try {
        if (loggedIn) {
          await api.deletePhoto(id);
        } else {
          await deletePhoto(id);
        }
      } catch (err) {
        console.error('删除失败:', err);
      }
    }
    dispatch({ type: 'clearSelection' });
    await loadData();
  };

  const hasAnyPhotos = totalCount > 0;
  const collectionEntries = Object.entries(groupedPhotos);

  return (
    <div className="page home-page">
      {/* ===== 顶部渐变 Header ===== */}
      <div className="home-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AppLogo size={40} />
          <h1>场景外语</h1>
        </div>
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

      {!loading && (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '0.7rem 1rem',
          margin: '0.75rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.82rem',
          color: 'var(--color-text-secondary)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span>
            每张图片识别大约需要5-10秒。
            {authState.isLoggedIn
              ? '上传后将自动后台处理，您可继续浏览。'
              : (
                <span>
                  {' '}
                  <span
                    onClick={() => dispatch({ type: 'setPage', page: 'login' })}
                    style={{ color: 'var(--color-primary-mid)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    登录
                  </span>
                  后可异步批量处理，无需等待。
                </span>
              )}
          </span>
        </div>
      )}

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
            <div className="card__label">生词累计</div>
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
                    {photos.map((photo) => {
                      const isPending = photo.status === 'pending';
                      const isProcessing = photo.status === 'processing';
                      const isCompleted = !photo.status || photo.status === 'completed';

                      return (
                      <div
                      key={photo.id}
                      style={{ position: 'relative', cursor: isCompleted ? 'pointer' : 'default' }}
                      onClick={() => isCompleted && handleReProcess(photo)}
                    >
                        <img
                          src={photo.annotatedDataUrl || photo.dataUrl}
                          alt=""
                          loading="lazy"
                          className="collection-grid__thumb"
                          style={isPending || isProcessing ? { filter: 'brightness(0.5)' } : undefined}
                        />
                        {(isPending || isProcessing) && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.35)',
                            borderRadius: 'var(--radius-md)',
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            gap: '0.3rem',
                          }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              border: '2px solid rgba(255,255,255,0.3)',
                              borderTopColor: '#fff',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                            }} />
                            <span>{isPending ? '等待识别' : '识别中...'}</span>
                          </div>
                        )}
                        {isCompleted && (
                          <>
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
                          </>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* 加载更早的照片按钮 */}
          {hasMore && isLoggedIn() && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <button
                onClick={loadMorePhotos}
                disabled={loadingMore}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: loadingMore
                    ? 'var(--color-border)'
                    : 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
                  color: '#FFFFFF',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: loadingMore ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loadingMore) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = '';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                }}
              >
                {loadingMore ? '加载中...' : '加载更早的照片'}
              </button>
            </div>
          )}
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

      {/* ===== 底部批量删除栏 ===== */}
      <div
        className={`merge-bar${state.selectedPhotoIds.length >= 1 ? ' merge-bar--active' : ''}`}
      >
        <button
          className="merge-bar__btn"
          disabled={state.selectedPhotoIds.length === 0}
          onClick={handleBatchDelete}
        >
          删除选中 (
          {state.selectedPhotoIds.length})
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

      {uploading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            maxWidth: '280px',
            width: '90%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-primary-mid)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
              正在上传...
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>
              {uploadProgress.current} / {uploadProgress.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}