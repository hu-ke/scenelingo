import { useState, useCallback, useEffect, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Image, Button, Canvas } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getJSONStorage, setJSONStorage } from '../../utils/storage';
import { generateUUID } from '../../utils/uuid';
import { renderAnnotatedImageToTempFile } from '../../utils/annotateImage';
import { getWordbookWords, migrateLocalWordbook } from '../../utils/wordMastery';
import { useTheme } from '../../hooks/useTheme';
import type { PhotoItem, RecognizedObject } from '../../context/AppContext';
import './index.scss';

function formatDateLabel(dateStr: string): string {
  if (dateStr === 'earlier') return '更早的照片';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${m}月${d}日 ${weekDays[date.getDay()]}`;
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countWordbookWords(photos: PhotoItem[], wordbookWords: string[]): number {
  const photoWordSet = new Set<string>();
  for (const photo of photos) {
    if (photo.objects) {
      for (const obj of photo.objects) {
        if (obj?.name) photoWordSet.add(obj.name.toLowerCase());
      }
    }
  }
  return wordbookWords.filter(w => photoWordSet.has(w)).length;
}

async function compressImage(filePath: string, maxSize = 1500): Promise<string> {
  try {
    const info = await Taro.getImageInfo({ src: filePath });
    const { width, height } = info;

    if (width <= maxSize && height <= maxSize) {
      return filePath;
    }

    let quality = 80;
    if (Math.max(width, height) > 3000) {
      quality = 50;
    } else if (Math.max(width, height) > 2000) {
      quality = 60;
    }

    const compressed = await Taro.compressImage({ src: filePath, quality });
    return compressed.tempFilePath;
  } catch {
    try {
      const fallback = await Taro.compressImage({ src: filePath, quality: 40 });
      return fallback.tempFilePath;
    } catch {
      return filePath;
    }
  }
}

export default function HomePage() {
  const themeStyle = useTheme();
  const { state, dispatch } = useReview();
  const { state: authState, logout: doLogout } = useAuth();

  const [groupedPhotos, setGroupedPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [dayCount, setDayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const initialLoadDone = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);

  const loadPhotos = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    let photos: PhotoItem[] = [];
    let dateMap: Record<string, string> = {};
    let wordbookWords: string[] = [];

    if (authState.isLoggedIn) {
      // 迁移本地残留的生词本数据到服务端
      migrateLocalWordbook();
      // 从服务端获取生词本列表
      wordbookWords = await getWordbookWords();
      try {
        const res = await api.listPhotos();
        const rawPhotos = res.photos || [];
        photos = rawPhotos.map((p: Record<string, unknown>) => {
          const id = (p.id as string) || '';
          const dateKey = (p.collectionDate as string) || getTodayStr();
          dateMap[id] = dateKey;
          return {
            id,
            dataUrl: (p.originalUrl as string) || '',
            annotatedDataUrl: p.annotatedUrl as string | undefined,
            objects: p.objects as RecognizedObject[] | undefined,
            status: (p.status as PhotoItem['status']) || 'completed',
          } as PhotoItem;
        });

        const photosNeedAnnotated = photos.filter(
          (photo) =>
            photo.status === 'completed' &&
            !photo.annotatedDataUrl &&
            photo.objects &&
            photo.objects.length > 0
        );

        if (photosNeedAnnotated.length > 0) {
          (async () => {
            for (const photo of photosNeedAnnotated) {
              try {
                const tempFilePath = await renderAnnotatedImageToTempFile(
                  photo.dataUrl,
                  photo.objects!,
                  'annotate-render-canvas',
                );
                await api.uploadAnnotated(tempFilePath, photo.id);
              } catch (err) {
                console.error('标注上传失败:', err);
              }
            }
            try {
              const reloadRes = await api.listPhotos();
              const reloadRaw = reloadRes.photos || [];
              const newPhotos = reloadRaw.map((p: Record<string, unknown>) => ({
                id: (p.id as string) || '',
                dataUrl: (p.originalUrl as string) || '',
                annotatedDataUrl: p.annotatedUrl as string | undefined,
                objects: p.objects as RecognizedObject[] | undefined,
                status: (p.status as PhotoItem['status']) || 'completed',
              } as PhotoItem));

              const newDateMap: Record<string, string> = {};
              for (const p of reloadRaw) {
                const id = (p.id as string) || '';
                newDateMap[id] = (p.collectionDate as string) || getTodayStr();
              }

              const grouped: Record<string, PhotoItem[]> = {};
              const sorted = [...newPhotos].sort((a, b) => {
                const da = newDateMap[a.id] || '';
                const db = newDateMap[b.id] || '';
                return db.localeCompare(da);
              });
              for (const p of sorted) {
                const date = newDateMap[p.id] || getTodayStr();
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(p);
              }

              setGroupedPhotos(grouped);
              setTotalCount(newPhotos.length);
              setWordCount(countWordbookWords(newPhotos, wordbookWords));
              setDayCount(Object.keys(grouped).length);

              dispatch({ type: 'setSavedPhotos', photos: newPhotos });
              dispatch({ type: 'cleanSelection', ids: newPhotos.map(p => p.id) });
            } catch {
              // reload fails, keep existing
            }
          })();
        }
      } catch {
        photos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        for (const p of photos) {
          dateMap[p.id] = getTodayStr();
        }
      }
    } else {
      photos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      for (const p of photos) {
        dateMap[p.id] = getTodayStr();
      }
    }

    const grouped: Record<string, PhotoItem[]> = {};
    const sorted = [...photos].sort((a, b) => {
      const da = dateMap[a.id] || '';
      const db = dateMap[b.id] || '';
      return db.localeCompare(da);
    });
    for (const photo of sorted) {
      const date = dateMap[photo.id] || getTodayStr();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(photo);
    }

    setGroupedPhotos(grouped);
    setTotalCount(photos.length);
    setWordCount(countWordbookWords(photos, wordbookWords));
    setDayCount(Object.keys(grouped).length);

    dispatch({ type: 'setSavedPhotos', photos });
    dispatch({ type: 'cleanSelection', ids: photos.map(p => p.id) });

    const today = getTodayStr();
    if (grouped[today]) {
      setExpandedCollections((prev) => {
        if (prev.has(today)) return prev;
        const next = new Set(prev);
        next.add(today);
        return next;
      });
    }

    setLoading(false);
    loadingRef.current = false;
  }, [authState.isLoggedIn, dispatch]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadPhotos();
    }
  }, [loadPhotos]);

  useDidShow(() => {
    if (initialLoadDone.current) {
      loadPhotos();
    }
  });

  useEffect(() => {
    if (!authState.isLoggedIn) return;
    const hasNonCompleted = Object.values(groupedPhotos).some(photos =>
      photos.some(p => p.status && p.status !== 'completed')
    );
    const hasMissingAnnotation = Object.values(groupedPhotos).some(photos =>
      photos.some(p =>
        p.status === 'completed' &&
        !p.annotatedDataUrl &&
        p.objects &&
        p.objects.length > 0
      )
    );
    if (!hasNonCompleted && !hasMissingAnnotation) return;

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      loadPhotos();
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [groupedPhotos, authState.isLoggedIn, loadPhotos]);

  const handleToggleCollection = useCallback((date: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const handlePhotoClick = useCallback(
    (photo: PhotoItem) => {
      dispatch({ type: 'setPhotos', photos: [photo] });
      Taro.navigateTo({ url: '/pages/review/index' });
    },
    [dispatch],
  );

  const handleDeletePhoto = useCallback(
    async (photo: PhotoItem, e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();

      const confirmRes = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这张照片吗？',
      });
      if (!confirmRes.confirm) return;

      try {
        if (authState.isLoggedIn) {
          await api.deletePhoto(photo.id);
        }

        const currentPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        const updatedPhotos = currentPhotos.filter((p) => p.id !== photo.id);
        setJSONStorage('saved_photos', updatedPhotos);

        await loadPhotos();

        Taro.showToast({ title: '已删除', icon: 'success', duration: 1500 });
      } catch (err: unknown) {
        Taro.showToast({
          title: (err as Error).message || '删除失败',
          icon: 'error',
        });
      }
    },
    [authState.isLoggedIn, loadPhotos],
  );

  const handleToggleSelect = useCallback(
    (id: string, e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      dispatch({ type: 'toggleSelectPhoto', id });
    },
    [dispatch],
  );

  const handleFabClick = useCallback(async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });

      if (authState.isLoggedIn) {
        setUploading(true);
        setUploadProgress({ current: 0, total: res.tempFiles.length });

        for (let i = 0; i < res.tempFiles.length; i++) {
          const file = res.tempFiles[i];
          try {
            const compressedPath = await compressImage(file.tempFilePath);
            if (!compressedPath) {
              throw new Error('图片压缩后路径为空');
            }
            await api.uploadPending(compressedPath);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error('上传失败:', errMsg);
            if (errMsg.includes('压缩')) {
              Taro.showToast({ title: `第${i + 1}张图片处理失败，请重试`, icon: 'none' });
            } else {
              Taro.showToast({ title: `第${i + 1}张上传失败，请重试`, icon: 'none' });
            }
          }
          setUploadProgress({ current: i + 1, total: res.tempFiles.length });
        }

        setUploading(false);
        await loadPhotos();
      } else {
        const currentPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        if (currentPhotos.length + res.tempFiles.length > 10) {
          setShowLoginPrompt(true);
          return;
        }

        const newPhotos: PhotoItem[] = res.tempFiles.map((file) => ({
          id: generateUUID(),
          dataUrl: file.tempFilePath,
        }));

        dispatch({ type: 'setPhotos', photos: newPhotos });
        Taro.navigateTo({ url: '/pages/review/index' });
      }
    } catch (err: unknown) {
      const msg = (err as { errMsg?: string })?.errMsg || '';
      if (msg.includes('cancel')) return;
      Taro.showToast({ title: '选择图片失败', icon: 'error' });
    }
  }, [authState.isLoggedIn, dispatch, loadPhotos]);

  const handleBatchDelete = useCallback(async () => {
    const ids = [...state.selectedPhotoIds];
    if (ids.length === 0) return;

    const confirmRes = await Taro.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${ids.length} 张照片吗？此操作不可恢复。`,
    });
    if (!confirmRes.confirm) return;

    for (const id of ids) {
      try {
        if (authState.isLoggedIn) {
          await api.deletePhoto(id);
        }
        const currentPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        const updatedPhotos = currentPhotos.filter((p) => p.id !== id);
        setJSONStorage('saved_photos', updatedPhotos);
      } catch (err) {
        console.error('删除失败:', err);
      }
    }

    dispatch({ type: 'clearSelection' });
    await loadPhotos();
  }, [state.selectedPhotoIds, authState.isLoggedIn, dispatch, loadPhotos]);

  const handleLoginClick = useCallback(() => {
    Taro.navigateTo({ url: '/pages/login/index' });
  }, []);

  const handleSettingsClick = useCallback(() => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  }, []);

  const handleLogout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  const handleWordbookClick = useCallback(() => {
    Taro.navigateTo({ url: '/pages/wordbook/index' });
  }, []);

  const handleLoginPromptGo = useCallback(() => {
    setShowLoginPrompt(false);
    Taro.navigateTo({ url: '/pages/login/index' });
  }, []);

  const handleLoginPromptCancel = useCallback(() => {
    setShowLoginPrompt(false);
  }, []);

  const hasPhotos = totalCount > 0;
  const dates = Object.keys(groupedPhotos);
  const selectedCount = state.selectedPhotoIds.length;

  const headerNode = (
    <View className="home-header">
      <Text className="home-header-subtitle">用照片探索身边的事物，轻松学习英语单词</Text>
      <View className="home-header-auth">
        {authState.isLoggedIn ? (
          <>
            <Text className="home-header-email">{authState.email}</Text>
            <Button className="home-header-settings-btn" onClick={handleSettingsClick}>
              ⚙️
            </Button>
            <Button className="home-header-logout-btn" onClick={handleLogout}>
              退出
            </Button>
          </>
        ) : (
          <Button className="home-header-login-btn" onClick={handleLoginClick}>
            登录
          </Button>
        )}
      </View>
    </View>
  );

  const hintBarNode = !loading ? (
    <View className="home-hint-bar">
      <Text className="home-hint-icon">⏳</Text>
      <Text className="home-hint-text">
        每张图片识别大约需要5-10秒。
        {authState.isLoggedIn
          ? '上传后自动后台处理，您可继续浏览。'
          : '登录后可后台处理，无需等待。'}
      </Text>
    </View>
  ) : null;

  const statsRowNode = hasPhotos ? (
    <View className="home-stats-row">
      <View className="home-stat-card">
        <Text className="home-stat-icon">📅</Text>
        <Text className="home-stat-value">{dayCount}</Text>
        <Text className="home-stat-label">学习天数</Text>
      </View>
      <View className="home-stat-card">
        <Text className="home-stat-icon">📸</Text>
        <Text className="home-stat-value">{totalCount}</Text>
        <Text className="home-stat-label">照片总数</Text>
      </View>
      <View className="home-stat-card home-stat-clickable" onClick={handleWordbookClick}>
        <Text className="home-stat-icon">📝</Text>
        <Text className="home-stat-value">{wordCount}</Text>
        <Text className="home-stat-label">生词累计</Text>
      </View>
    </View>
  ) : null;

  const emptyNode = !hasPhotos ? (
    <View className="home-empty">
      <Text className="home-empty-icon">🎒📸</Text>
      <Text className="home-empty-title">开始你的第一次探索吧！</Text>
      <Text className="home-empty-desc">
        点击右下角按钮上传照片，识别物体，学习英语单词
      </Text>
    </View>
  ) : null;

  const collectionsNode = hasPhotos ? (
    <View className="home-collections">
      {dates.map((date) => {
        const isExpanded = expandedCollections.has(date);
        return (
          <View key={date} className="home-collection-group">
            <View
              className="home-collection-header"
              onClick={() => handleToggleCollection(date)}
            >
              <View className="home-collection-date">
                <Text className="home-collection-date-text">
                  {formatDateLabel(date)}
                </Text>
                <Text
                  className={`home-collection-arrow ${isExpanded ? 'home-collection-arrow-expanded' : ''}`}
                >
                  ▼
                </Text>
              </View>
              <Text className="home-collection-badge">
                {groupedPhotos[date].length} 张
              </Text>
            </View>
            {isExpanded && (
              <View className="home-photo-grid">
                {groupedPhotos[date].map((photo) => {
                  const isSelected = state.selectedPhotoIds.includes(photo.id);
                  const isProcessing = photo.status && photo.status !== 'completed';
                  return (
                    <View
                      key={photo.id}
                      className="home-photo-item"
                      onClick={() => handlePhotoClick(photo)}
                    >
                      <Image
                        className="home-photo-thumb"
                        src={photo.annotatedDataUrl || photo.dataUrl}
                        mode="aspectFill"
                      />
                      {isProcessing && (
                        <View className="home-photo-processing">
                          <View className="home-photo-spinner" />
                        </View>
                      )}
                      <View
                        className={`home-photo-checkbox ${isSelected ? 'home-photo-checkbox-selected' : ''}`}
                        onClick={(e) => handleToggleSelect(photo.id, e)}
                      >
                        <Text>{isSelected ? '✓' : '○'}</Text>
                      </View>
                      <View
                        className="home-photo-delete"
                        onClick={(e) => handleDeletePhoto(photo, e)}
                      >
                        <Text>×</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  ) : null;

  const deleteBarNode = selectedCount >= 1 ? (
    <View className="home-merge-bar">
      <Button className="home-merge-btn" onClick={handleBatchDelete}>
        删除选中 ({selectedCount})
      </Button>
    </View>
  ) : null;

  const uploadDialogNode = uploading ? (
    <View className="home-upload-mask">
      <View className="home-upload-card">
        <View className="home-upload-spinner" />
        <Text className="home-upload-title">正在上传...</Text>
        <Text className="home-upload-progress">
          {uploadProgress.current} / {uploadProgress.total}
        </Text>
      </View>
    </View>
  ) : null;

  const loginPromptNode = showLoginPrompt ? (
    <View className="home-login-prompt-mask" onClick={handleLoginPromptCancel}>
      <View
        className="home-login-prompt-card"
        onClick={(e: unknown) =>
          (e as { stopPropagation?: () => void })?.stopPropagation?.()
        }
      >
        <Text className="home-login-prompt-icon">🔐</Text>
        <Text className="home-login-prompt-title">登录解锁更多</Text>
        <Text className="home-login-prompt-desc">
          未登录用户最多保存10张照片，登录后可无限制保存并同步到云端
        </Text>
        <View className="home-login-prompt-btns">
          <Button className="home-login-prompt-cancel" onClick={handleLoginPromptCancel}>
            暂不登录
          </Button>
          <Button className="home-login-prompt-go" onClick={handleLoginPromptGo}>
            去登录
          </Button>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View className="home-page" style={themeStyle}>
      {headerNode}
      {hintBarNode}
      {loading ? (
        <View className="home-loading">
          <Text className="home-loading-text">加载中...</Text>
        </View>
      ) : (
        <>
          {statsRowNode}
          {collectionsNode}
          {emptyNode}
        </>
      )}
      <View className="home-fab" onClick={handleFabClick}>
        <Text className="home-fab-icon">📷</Text>
      </View>
      {deleteBarNode}
      <View className="home-footer">
        <Text className="home-footer-text">联系作者：📧 403392669@qq.com</Text>
      </View>
      {loginPromptNode}
      {uploadDialogNode}
      <Canvas
        canvasId="annotate-render-canvas"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '2000px',
          height: '2000px',
        }}
      />
    </View>
  );
}
