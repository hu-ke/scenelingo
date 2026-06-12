import { useState, useEffect, useCallback, useMemo } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { api } from '../../utils/api';
import { getJSONStorage } from '../../utils/storage';
import { isMastered, toggleMastered, getWordbookWords, removeFromWordbook } from '../../utils/wordMastery';
import { useTheme } from '../../hooks/useTheme';
import type { PhotoItem } from '../../context/AppContext';
import './index.scss';

interface WordEntry {
  word: string;
  phonetic: string;
  romaji: string;
  examples: string[];
  photoCount: number;
  photoIds: string[];
}

// 获取日期字符串 YYYY-MM-DD
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 获取前N天的日期
function getDateBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateString(date);
}

export default function WordBookPage() {
  const themeStyle = useTheme();
  const { dispatch } = useReview();
  const [activeTab, setActiveTab] = useState<'new' | 'mastered'>('new');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [wordbookWordList, setWordbookWordList] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedDays, setLoadedDays] = useState(0); // 已加载的天数
  const [hasMore, setHasMore] = useState(true); // 是否还有更多数据可加载

  // 加载指定日期范围的照片
  const loadPhotosByDateRange = useCallback(async (startDate: string, endDate: string): Promise<PhotoItem[]> => {
    try {
      const res = await api.listPhotos(startDate, endDate);
      return (res.photos || []).map((p: Record<string, unknown>) => ({
        id: (p.id || p._id || '') as string,
        dataUrl: (p.originalUrl || '') as string,
        annotatedDataUrl: p.annotatedUrl as string | undefined,
        objects: (p.objects || []) as PhotoItem['objects'],
      }));
    } catch (err) {
      console.error('[WordBook] 云端加载失败:', err);
      return [];
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadInitialPhotos();
  }, []);

  useDidShow(() => {
    loadInitialPhotos();
    setRefreshKey((k) => k + 1);
  });

  const loadInitialPhotos = useCallback(async () => {
    setLoading(true);
    try {
      // 从服务端获取生词本列表
      const words = await getWordbookWords();
      setWordbookWordList(words);
      // 先加载今天和昨天的数据
      const today = getDateString(new Date());
      const yesterday = getDateBefore(1);

      console.log('[WordBook] 加载今天和昨天的数据:', yesterday, today);

      const cloudPhotos = await loadPhotosByDateRange(yesterday, today);
      setPhotos(cloudPhotos);
      setLoadedDays(2);
      setHasMore(true);
    } catch {
      const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      setPhotos(localPhotos);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loadPhotosByDateRange]);

  // 加载更多（更早的数据）
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);

      // 计算下一个要加载的日期范围
      const nextDay = loadedDays;
      const startDate = getDateBefore(nextDay);
      const endDate = startDate;

      console.log('[WordBook] 加载更多数据:', startDate);

      const newPhotos = await loadPhotosByDateRange(startDate, endDate);

      console.log('[WordBook] 加载更多照片数:', newPhotos.length);

      if (newPhotos.length === 0) {
        setHasMore(false);
      } else {
        setPhotos(prev => [...prev, ...newPhotos]);
        setLoadedDays(prev => prev + 1);
      }
    } catch (err) {
      console.error('[WordBook] 加载更多失败:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loadedDays, loadPhotosByDateRange]);

  const wordEntries = useMemo(() => {
    const wordbookWordsSet = new Set(wordbookWordList);
    const wordMap = new Map<string, {
      phonetic: string;
      romaji: string;
      examples: string[];
      photoIds: Set<string>;
    }>();

    for (const photo of photos) {
      if (!photo.objects) continue;
      for (const obj of photo.objects) {
        const name = (obj.name || '').toLowerCase();
        if (!name) continue;
        // 只显示用户手动加入生词本的单词
        if (!wordbookWordsSet.has(name)) continue;
        const existing = wordMap.get(name);
        if (existing) {
          existing.photoIds.add(photo.id);
        } else {
          wordMap.set(name, {
            phonetic: obj.phonetic || '',
            romaji: obj.romaji || '',
            examples: obj.examples || [],
            photoIds: new Set([photo.id]),
          });
        }
      }
    }

    const entries: WordEntry[] = [];
    wordMap.forEach((value, word) => {
      entries.push({
        word,
        phonetic: value.phonetic,
        romaji: value.romaji,
        examples: value.examples,
        photoCount: value.photoIds.size,
        photoIds: Array.from(value.photoIds),
      });
    });

    entries.sort((a, b) => a.word.localeCompare(b.word));
    return entries;
  }, [photos, wordbookWordList, refreshKey]);

  const newWords = useMemo(() => {
    return wordEntries.filter((entry) => !isMastered(entry.word));
  }, [wordEntries, refreshKey]);

  const masteredWords = useMemo(() => {
    return wordEntries.filter((entry) => isMastered(entry.word));
  }, [wordEntries, refreshKey]);

  const displayWords = activeTab === 'new' ? newWords : masteredWords;

  const handleToggleMastered = useCallback((word: string) => {
    toggleMastered(word);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRemoveFromWordbook = useCallback(async (word: string) => {
    try {
      await removeFromWordbook(word);
      setWordbookWordList(prev => prev.filter(w => w !== word.toLowerCase()));
      setRefreshKey((k) => k + 1);
    } catch {
      Taro.showToast({ title: '移除失败', icon: 'none' });
    }
  }, []);

  const handleWordClick = useCallback((word: string) => {
    dispatch({ type: 'setWordDetail', word });
    Taro.navigateTo({ url: '/pages/worddetail/index' });
  }, [dispatch]);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const renderEmptyState = () => {
    if (wordEntries.length === 0) {
      return (
        <View className="wordbook-empty">
          <Text className="wordbook-empty-icon">📖</Text>
          <Text className="wordbook-empty-text">还没有学习任何单词，快去拍照探索吧！</Text>
        </View>
      );
    }
    if (activeTab === 'new' && newWords.length === 0) {
      return (
        <View className="wordbook-empty">
          <Text className="wordbook-empty-icon">🎉</Text>
          <Text className="wordbook-empty-text">太棒了，所有单词都已掌握！</Text>
        </View>
      );
    }
    if (activeTab === 'mastered' && masteredWords.length === 0) {
      return (
        <View className="wordbook-empty">
          <Text className="wordbook-empty-icon">💪</Text>
          <Text className="wordbook-empty-text">还没有已掌握的单词，继续加油</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View className="wordbook-page" style={themeStyle}>
      <View className="wordbook-header">
        <View className="wordbook-header-top">
          <View className="wordbook-back-btn" onClick={handleBack}>
            <Text className="wordbook-back-arrow">←</Text>
          </View>
          <Text className="wordbook-header-title">我的单词本</Text>
          <View className="wordbook-back-btn" />
        </View>
        <Text className="wordbook-header-subtitle">共 {wordEntries.length} 个单词</Text>
      </View>

      <View className="wordbook-tabs">
        <View
          className={`wordbook-tab ${activeTab === 'new' ? 'wordbook-tab-active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          <Text className="wordbook-tab-text">生词表 ({newWords.length})</Text>
          {activeTab === 'new' && <View className="wordbook-tab-indicator" />}
        </View>
        <View
          className={`wordbook-tab ${activeTab === 'mastered' ? 'wordbook-tab-active' : ''}`}
          onClick={() => setActiveTab('mastered')}
        >
          <Text className="wordbook-tab-text">已掌握 ({masteredWords.length})</Text>
          {activeTab === 'mastered' && <View className="wordbook-tab-indicator" />}
        </View>
      </View>

      {loading ? (
        <View className="wordbook-loading">
          <View className="spinner" />
        </View>
      ) : displayWords.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView className="wordbook-list" scrollY>
          {displayWords.map((entry) => (
            <View
              key={entry.word}
              className="wordbook-card"
              onClick={() => handleWordClick(entry.word)}
            >
              <View className="wordbook-card-main">
                <View className="wordbook-card-info">
                  <Text className="wordbook-card-word">{entry.word}</Text>
                  {entry.phonetic ? (
                    <Text className="wordbook-card-phonetic">{entry.phonetic}</Text>
                  ) : null}
                  {entry.romaji ? (
                    <Text className="wordbook-card-romaji">{entry.romaji}</Text>
                  ) : null}
                </View>
                <View className="wordbook-card-meta">
                  <Text className="wordbook-card-photo-count">{entry.photoCount} 张</Text>
                  <Button
                    className={`wordbook-card-toggle ${isMastered(entry.word) ? 'wordbook-card-toggle-remove' : 'wordbook-card-toggle-master'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMastered(entry.word);
                    }}
                  >
                    {isMastered(entry.word) ? '↩ 移回生词表' : '✓ 已掌握'}
                  </Button>
                </View>
              </View>
            </View>
          ))}

          {/* 加载更多按钮 */}
          {hasMore && (
            <View className="wordbook-loadmore">
              <Button
                className="wordbook-loadmore-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? '加载中...' : '加载更多'}
              </Button>
              <Text className="wordbook-loadmore-text">已加载 {loadedDays} 天的数据</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
