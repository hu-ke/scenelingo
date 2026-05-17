import { useState, useCallback, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Image, Button } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getJSONStorage, setJSONStorage } from '../../utils/storage';
import { generateUUID } from '../../utils/uuid';
import type { PhotoItem, RecognizedObject } from '../../context/AppContext';
import './index.scss';

function formatDateLabel(dateStr: string): string {
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

function groupByDate(photos: PhotoItem[]): Record<string, PhotoItem[]> {
  const grouped: Record<string, PhotoItem[]> = {};
  const sorted = [...photos].sort((a, b) => {
    const da = a.collectionDate || '';
    const db = b.collectionDate || '';
    return db.localeCompare(da);
  });
  for (const photo of sorted) {
    const date = photo.collectionDate || getTodayStr();
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(photo);
  }
  return grouped;
}

function countUniqueWords(photos: PhotoItem[]): number {
  const wordSet = new Set<string>();
  for (const photo of photos) {
    if (photo.objects) {
      for (const obj of photo.objects) {
        wordSet.add(obj.name.toLowerCase());
      }
    }
  }
  return wordSet.size;
}

function countUniqueDates(photos: PhotoItem[]): number {
  const dateSet = new Set<string>();
  for (const photo of photos) {
    dateSet.add(photo.collectionDate || getTodayStr());
  }
  return dateSet.size;
}

function mapApiPhoto(p: Record<string, unknown>): PhotoItem {
  return {
    id: p.id as string,
    dataUrl: (p.dataUrl as string) || (p.annotatedDataUrl as string) || '',
    annotatedDataUrl: p.annotatedDataUrl as string | undefined,
    objects: p.objects as RecognizedObject[] | undefined,
    collectionDate: p.collectionDate as string | undefined,
    status: (p.status as PhotoItem['status']) || 'completed',
  };
}

export default function HomePage() {
  const { state, dispatch } = useReview();
  const { nativeLang, targetLang } = state;
  const { state: authState, logout: doLogout } = useAuth();

  const [groupedPhotos, setGroupedPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [dayCount, setDayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const loadPhotos = useCallback(async () => {
    let photos: PhotoItem[] = [];

    if (authState.isLoggedIn) {
      try {
        const res = await api.listPhotos();
        photos = res.photos.map(mapApiPhoto);
      } catch {
        photos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      }
    } else {
      photos = getJSONStorage<PhotoItem[]>('saved_photos', []);
    }

    const grouped = groupByDate(photos);
    setGroupedPhotos(grouped);
    setTotalCount(photos.length);
    setWordCount(countUniqueWords(photos));
    setDayCount(countUniqueDates(photos));

    dispatch({ type: 'setSavedPhotos', photos });
    setLoading(false);
  }, [authState.isLoggedIn, dispatch]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useDidShow(() => {
    loadPhotos();
  });

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

      Taro.showToast({ title: `正在提交 ${res.tempFiles.length} 张照片...`, icon: 'loading', duration: 30000 });

      const todayStr = getTodayStr();
      const newPhotos: PhotoItem[] = [];

      for (const file of res.tempFiles) {
        try {
          const result = await api.recognizeAsync([file.tempFilePath], nativeLang, targetLang);
          const taskResult = result[0];
          newPhotos.push({
            id: generateUUID(),
            dataUrl: file.tempFilePath,
            collectionDate: todayStr,
            status: taskResult.status as PhotoItem['status'],
            taskId: taskResult.task_id,
          });
        } catch {
          newPhotos.push({
            id: generateUUID(),
            dataUrl: file.tempFilePath,
            collectionDate: todayStr,
            status: 'failed',
            taskId: undefined,
            errorMessage: '提交失败，请重试',
          });
        }
      }

      Taro.hideToast();

      if (!authState.isLoggedIn && totalCount + newPhotos.length > 10) {
        setShowLoginPrompt(true);
        return;
      }

      dispatch({ type: 'clearSelection' });
      dispatch({ type: 'setPhotos', photos: newPhotos });
      Taro.navigateTo({ url: '/pages/review/index' });
    } catch (err: unknown) {
      const msg = (err as { errMsg?: string })?.errMsg || '';
      if (msg.includes('cancel')) return;
      Taro.showToast({ title: '选择图片失败', icon: 'error' });
    }
  }, [nativeLang, targetLang, authState.isLoggedIn, totalCount, dispatch]);

  const handleMergeClick = useCallback(() => {
    Taro.navigateTo({ url: '/pages/merge/index' });
  }, []);

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
      <Text className="home-header-logo">🔍 场景英语</Text>
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
        <Text className="home-stat-label">单词累计</Text>
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
                  return (
                    <View
                      key={photo.id}
                      className="home-photo-item"
                      onClick={() => handlePhotoClick(photo)}
                    >
                      <Image
                        className="home-photo-thumb"
                        src={photo.dataUrl}
                        mode="aspectFill"
                      />
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

  const mergeBarNode =
    selectedCount >= 2 ? (
      <View className="home-merge-bar">
        <Button className="home-merge-btn" onClick={handleMergeClick}>
          合并导出 ({selectedCount}/2+)
        </Button>
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
    <View className="home-page">
      {headerNode}
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
      {mergeBarNode}
      <View className="home-footer">
        <Text className="home-footer-text">联系作者：📧 403392669@qq.com</Text>
      </View>
      {loginPromptNode}
    </View>
  );
}