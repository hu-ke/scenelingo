import { useState, useCallback, useEffect, useRef } from 'react';
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { View, Text, Image, Button, Canvas } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getJSONStorage, setJSONStorage } from '../../utils/storage';
import { generateUUID } from '../../utils/uuid';
import { renderAnnotatedImageToTempFile } from '../../utils/annotateImage';
import { generateShareCardImage } from '../../utils/shareCard';
import { getWordbookWords, getMasteredWords, migrateLocalWordbook, migrateLocalMastered } from '../../utils/wordMastery';
import { useTheme } from '../../hooks/useTheme';
import FolderPicker from '../../components/FolderPicker';
import type { PhotoItem, RecognizedObject } from '../../context/AppContext';
import './index.scss';

const CDN = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets';

function formatDateLabel(dateStr: string): string {
  if (dateStr === 'earlier') return '更早的照片';
  // 兼容 yyyy-mm-dd 和 yyyy-mm-dd hh:mm:ss 两种格式
  const datePart = dateStr.split(' ')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${m}月${d}日 ${weekDays[date.getDay()]}`;
}

// 提取日期部分 (YYYY-MM-DD)，兼容新旧格式
function getDateKey(dateStr: string): string {
  return dateStr.split(' ')[0];
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function getDateBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
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
  const { state: authState } = useAuth();

  const [favPickerVisible, setFavPickerVisible] = useState(false);
  const [favTargetPhoto, setFavTargetPhoto] = useState<PhotoItem | null>(null);

  const [groupedPhotos, setGroupedPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [dayCount, setDayCount] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedChunks, setLoadedChunks] = useState(0); // 已加载的2周块数
  const [oldestDate, setOldestDate] = useState(''); // 用户最早照片日期
  const [quota, setQuota] = useState(10);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [rewardQuota, setRewardQuota] = useState(10);
  const initialLoadDone = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);
  const shareImageRef = useRef<string>('');

  // 预生成分享卡片图片
  useEffect(() => {
    generateShareCardImage('share-card-canvas')
      .then((path) => {
        shareImageRef.current = path;
      })
      .catch((err) => {
        console.warn('分享卡片生成失败，分享时将使用默认图片:', err);
      });
    
    api.getShareRewardInfo().then((res) => {
      setRewardQuota(res.reward_quota);
    }).catch(() => {});
  }, []);

  console.log('home page mounted');
  const loadPhotos = useCallback(async (startDate?: string, endDate?: string) => {
    if (loadingRef.current) return;
    if (authState.loading) return;
    loadingRef.current = true;
    let photos: PhotoItem[] = [];
    let dateMap: Record<string, string> = {};
    let wordbookWords: string[] = [];

    migrateLocalWordbook();
    migrateLocalMastered();
    wordbookWords = await getWordbookWords();
    if (authState.isLoggedIn && authState.token) {
    try {
      const res = await api.listPhotos(startDate, endDate);
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
            const reloadRes = await api.listPhotos(startDate, endDate);
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
              const date = getDateKey(newDateMap[p.id] || getTodayStr());
              if (!grouped[date]) grouped[date] = [];
              grouped[date].push(p);
            }

            setGroupedPhotos(grouped);
            setTotalCount(newPhotos.length);
            setWordCount(wordbookWords.filter(w => {
              for (const p of newPhotos) {
                for (const o of (p.objects || [])) {
                  if ((o.name || '').toLowerCase() === w) return true;
                }
              }
              return false;
            }).length);
            setDayCount(Object.keys(grouped).length);
            setMasteredCount((await getMasteredWords()).filter(w => wordbookWords.includes(w)).length);

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

    // 获取已收藏的照片ID列表，标记对应photo
    if (authState.isLoggedIn && authState.token && photos.length > 0) {
      try {
        const favRes = await api.getFavoritedPhotoIds();
        const favIds = new Set(favRes.photo_ids || []);
        photos = photos.map(p => favIds.has(p.id) ? { ...p, favorited: true } : p);
      } catch {
        // 获取收藏状态失败，忽略
      }
    }

    const grouped: Record<string, PhotoItem[]> = {};
    const sorted = [...photos].sort((a, b) => {
      const da = dateMap[a.id] || '';
      const db = dateMap[b.id] || '';
      return db.localeCompare(da);
    });
    for (const photo of sorted) {
      const date = getDateKey(dateMap[photo.id] || getTodayStr());
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(photo);
    }

    setGroupedPhotos(grouped);
    setTotalCount(photos.length);
    setWordCount(wordbookWords.filter(w => {
      for (const p of photos) {
        for (const o of (p.objects || [])) {
          if ((o.name || '').toLowerCase() === w) return true;
        }
      }
      return false;
    }).length);
    setDayCount(Object.keys(grouped).length);
    setMasteredCount((await getMasteredWords()).filter(w => wordbookWords.includes(w)).length);

    dispatch({ type: 'setSavedPhotos', photos });
    dispatch({ type: 'cleanSelection', ids: photos.map(p => p.id) });

    const todayKey = getDateKey(getTodayStr());
    if (grouped[todayKey]) {
      setExpandedCollections((prev) => {
        if (prev.has(todayKey)) return prev;
        const next = new Set(prev);
        next.add(todayKey);
        return next;
      });
    }

    setLoading(false);
    loadingRef.current = false;
  }, [dispatch, authState.loading]);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await api.getUserQuota();
      setQuota(res.quota);
    } catch {
      // 获取配额失败，保持默认值
    }
  }, []);

  // 检测 inviter 参数并触发分享奖励（奖励给邀请者，新用户不显示提示）
  useEffect(() => {
    const launchOptions = Taro.getLaunchOptionsSync();
    const inviter = launchOptions.query?.inviter;
    if (inviter && authState.userId && inviter !== authState.userId) {
      api.shareReward(inviter).then((res) => {
        if (res.success) {
          fetchQuota();
        }
      }).catch(() => {});
    }
  }, [authState.userId]);

  // 加载下一个2周块，与已有数据合并
  const loadMorePhotos = useCallback(async () => {
    setLoadingMore(true);
    const nextChunk = loadedChunks + 1;
    const endDate = getDateBefore((nextChunk - 1) * 14);
    const startDate = getDateBefore(nextChunk * 14 - 1);

    try {
      const res = await api.listPhotos(startDate, endDate);
      const rawPhotos = res.photos || [];
      const newPhotos: PhotoItem[] = rawPhotos.map((p: Record<string, unknown>) => ({
        id: (p.id as string) || '',
        dataUrl: (p.originalUrl as string) || '',
        annotatedDataUrl: p.annotatedUrl as string | undefined,
        objects: p.objects as RecognizedObject[] | undefined,
        status: (p.status as PhotoItem['status']) || 'completed',
        collectionDate: p.collectionDate as string || getTodayStr(),
      } as PhotoItem));

      // 合并到现有分组
      const merged = { ...groupedPhotos };
      for (const photo of newPhotos) {
        const date = getDateKey(photo.collectionDate || getTodayStr());
        if (!merged[date]) merged[date] = [];
        if (!merged[date].some(p => p.id === photo.id)) {
          merged[date].push(photo);
        }
      }

      const allPhotos = Object.values(merged).flat();
      setGroupedPhotos(merged);
      setTotalCount(allPhotos.length);
      setDayCount(Object.keys(merged).length);
      dispatch({ type: 'setSavedPhotos', photos: allPhotos });
      dispatch({ type: 'cleanSelection', ids: allPhotos.map(p => p.id) });

      setLoadedChunks(nextChunk);
    } catch (err) {
      console.error('[HomePage] 加载更早照片失败:', err);
      Taro.showToast({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      setLoadingMore(false);
    }
  }, [loadedChunks, groupedPhotos]);

  // 是否还有更多可加载：已加载数据边界 > 最早照片日期
  const hasMore = oldestDate
    ? getDateBefore(loadedChunks * 14) > oldestDate
    : true;

  const fetchStats = useCallback(async () => {
    if (!authState.isLoggedIn || !authState.token) return;
    try {
      const stats = await api.getUserStats();
      setTotalCount(stats.total_count);
      setDayCount(stats.total_days);
      if (stats.oldest_date) setOldestDate(stats.oldest_date);
      const allWordsSet = new Set((stats.all_words || []).map((w: string) => w.toLowerCase()));
      const wordbookWords = await getWordbookWords();
      setWordCount(wordbookWords.filter(w => allWordsSet.has(w)).length);
      setMasteredCount((await getMasteredWords()).filter(w => wordbookWords.includes(w)).length);
    } catch (err) {
      console.error('[HomePage] 获取统计数据失败:', err);
    }
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current && !authState.loading) {
      initialLoadDone.current = true;
      loadPhotos(getDateBefore(13), getTodayStr());
      setLoadedChunks(1);
      fetchStats();
    }
  }, [loadPhotos, authState.loading, fetchStats]);

  useDidShow(() => {
    if (initialLoadDone.current) {
      const startDate = getDateBefore(loadedChunks * 14 - 1);
      loadPhotos(startDate, getTodayStr());
    }
    fetchQuota();
  });

  useEffect(() => {
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
      const startDate = getDateBefore(loadedChunks * 14 - 1);
      loadPhotos(startDate, getTodayStr());
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [groupedPhotos, loadedChunks, loadPhotos]);

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

  const handleAddToFavorites = useCallback(
    (photo: PhotoItem, e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      setFavTargetPhoto(photo);
      setFavPickerVisible(true);
    },
    [],
  );

  const handleFolderSelect = useCallback(
    async (folder: { folder_id: string; name: string }) => {
      if (!favTargetPhoto) return;
      const token = Taro.getStorageSync('scene_lingo_token');
      const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

      try {
        const res = await Taro.request({
          url: `${BASE_URL}/api/favorites/items`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: {
            folder_id: folder.folder_id,
            photo_id: favTargetPhoto.id,
          },
        });

        if (res.statusCode === 200) {
          dispatch({ type: 'setFavorited', photoId: favTargetPhoto.id, favorited: true });
          setGroupedPhotos(prev => {
            const next = { ...prev };
            for (const date of Object.keys(next)) {
              next[date] = next[date].map(p =>
                p.id === favTargetPhoto.id ? { ...p, favorited: true } : p
              );
            }
            return next;
          });
          Taro.showToast({ title: '已收藏', icon: 'success' });
        } else if (res.statusCode === 409) {
          Taro.showToast({ title: '该图片已在此文件夹中', icon: 'none' });
        } else {
          Taro.showToast({ title: '收藏失败', icon: 'none' });
        }
      } catch {
        Taro.showToast({ title: '收藏失败', icon: 'none' });
      } finally {
        setFavPickerVisible(false);
        setFavTargetPhoto(null);
      }
    },
    [favTargetPhoto],
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
        await api.deletePhoto(photo.id);

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
    [loadPhotos],
  );

  const handleToggleSelect = useCallback(
    (id: string, e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      dispatch({ type: 'toggleSelectPhoto', id });
    },
    [dispatch],
  );

  const handleFabClick = useCallback(async () => {
    // 配额检查已禁用
    // if (quota <= 0) {
    //   setShowQuotaModal(true);
    //   return;
    // }

    // 确保已登录且有有效 token
    let token = authState.token;
    if (!token) {
      Taro.showLoading({ title: '登录中...' });
      try {
        const loginRes = await Taro.login();
        if (!loginRes.code) throw new Error('wx.login 失败');
        const result = await api.wechatLogin(loginRes.code);
        Taro.setStorageSync('scene_lingo_token', result.token);
        Taro.setStorageSync('scene_lingo_user_id', result.user_id);
        token = result.token;
      } catch {
        Taro.hideLoading();
        Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        return;
      }
      Taro.hideLoading();
    }

    try {
      const res = await Taro.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });

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
          if (errMsg.includes('次数已用完') || errMsg.includes('403')) {
            Taro.showToast({ title: '识别次数已用完，请分享给好友获取更多次数', icon: 'none', duration: 2000 });
            fetchQuota();
            break;
          } else if (errMsg.includes('压缩')) {
            Taro.showToast({ title: `第${i + 1}张图片处理失败，请重试`, icon: 'none' });
          } else {
            Taro.showToast({ title: `第${i + 1}张上传失败，请重试`, icon: 'none' });
          }
        }
        setUploadProgress({ current: i + 1, total: res.tempFiles.length });
      }

      setUploading(false);
      await loadPhotos();
    } catch (err: unknown) {
      const msg = (err as { errMsg?: string })?.errMsg || '';
      if (msg.includes('cancel')) return;
      Taro.showToast({ title: '选择图片失败', icon: 'error' });
    }
  }, [quota, authState.token, dispatch, loadPhotos, fetchQuota]);

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
        await api.deletePhoto(id);
        const currentPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        const updatedPhotos = currentPhotos.filter((p) => p.id !== id);
        setJSONStorage('saved_photos', updatedPhotos);
      } catch (err) {
        console.error('删除失败:', err);
      }
    }

    dispatch({ type: 'clearSelection' });
    await loadPhotos();
  }, [state.selectedPhotoIds, dispatch, loadPhotos]);

  const hasPhotos = totalCount > 0;
  const dates = Object.keys(groupedPhotos);
  const selectedCount = state.selectedPhotoIds.length;

  const headerNode = (
    <View className="home-header">
      <Image className="home-header-banner" src={`${CDN}/banner.png`} mode="aspectFill" />
      {!loading && (
        <View className="home-header-stats">
          <Text className="home-header-stat-item">学习 {dayCount} 天</Text>
          <Text className="home-header-stat-divider">·</Text>
          <Text className="home-header-stat-item">已掌握 {masteredCount} 词</Text>
        </View>
      )}
    </View>
  );

  const hintBarNode = !loading ? (
    <View className="home-hint-bar">
      <Text className="home-hint-icon">⏳</Text>
      <Text className="home-hint-text">
        每张图片识别大约需要5-10秒。上传后自动后台处理，您可继续浏览。
      </Text>
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
                        className="home-photo-fav"
                        onClick={(e) => handleAddToFavorites(photo, e)}
                      >
                        <Image
                          src={photo.favorited ? `${CDN}/home/stared.png` : `${CDN}/home/unstared.png`}
                          className="home-photo-fav-icon"
                          mode="aspectFit"
                        />
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

      {/* 加载更早的照片按钮 */}
      {hasMore && (
        <View className="home-loadmore">
          <Button
            className="home-loadmore-btn"
            onClick={loadMorePhotos}
            disabled={loadingMore}
          >
            {loadingMore ? '加载中...' : '加载更早的照片'}
          </Button>
        </View>
      )}
    </View>
  ) : null;

  const deleteBarNode = selectedCount >= 1 ? (
    <View className="home-merge-bar" onClick={handleBatchDelete}>
      <Text className="home-merge-btn-text">删除选中 ({selectedCount})</Text>
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

  // 分享给朋友
  useShareAppMessage(() => ({
    title: '我发现一个超实用的拍照学外语小程序！拍张照就能学单词，快来试试~',
    path: `/pages/home/index?inviter=${authState.userId || ''}`,
    imageUrl: shareImageRef.current || undefined,
  }));

  // 分享到朋友圈
  useShareTimeline(() => ({
    title: '场景外语 - 拍照学外语，所见即所学',
    path: `/pages/home/index?inviter=${authState.userId || ''}`,
    imageUrl: shareImageRef.current || undefined,
  }));

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
          {collectionsNode}
          {emptyNode}
        </>
      )}
      <View className="home-fab" onClick={handleFabClick}>
        <View className="home-fab-icon-img" style={{ backgroundImage: `url(${CDN}/camera.png)` }} />
      </View>
      {deleteBarNode}
      {uploadDialogNode}
      {showQuotaModal && (
        <View className="home-upload-mask" onClick={() => setShowQuotaModal(false)}>
          <View className="home-upload-card" onClick={(e) => e.stopPropagation()}>
            <Text className="home-upload-title" style={{ marginBottom: '16px' }}>识别次数已用完</Text>
            <Text style={{ fontSize: '14px', color: '#666', textAlign: 'center', marginBottom: '20px', display: 'block' }}>
              分享给好友，即可获得 {rewardQuota} 次识别机会！
            </Text>
            <View style={{ display: 'flex', gap: '12px' }}>
              <Button
                openType="share"
                style={{ flex: 1, backgroundColor: '#4A90D9', color: '#fff', borderRadius: '8px', fontSize: '14px' }}
                onClick={() => setShowQuotaModal(false)}
              >
                分享给好友
              </Button>
            </View>
          </View>
        </View>
      )}
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
      <Canvas
        canvasId="share-card-canvas"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '500px',
          height: '400px',
        }}
      />
      <FolderPicker
        visible={favPickerVisible}
        onClose={() => setFavPickerVisible(false)}
        onSelect={handleFolderSelect}
      />
    </View>
  );
}
