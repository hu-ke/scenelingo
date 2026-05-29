import { useState, useEffect, useCallback, useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getJSONStorage } from '../../utils/storage';
import { isMastered, toggleMastered } from '../../utils/wordMastery';
import { useTheme } from '../../hooks/useTheme';
import type { PhotoItem } from '../../context/AppContext';
import './index.scss';

interface WordEntry {
  word: string;
  phonetic: string;
  examples: string[];
  photoCount: number;
  photoIds: string[];
}

export default function WordBookPage() {
  const themeStyle = useTheme();
  const { state, dispatch } = useReview();
  const { state: authState } = useAuth();
  const [activeTab, setActiveTab] = useState<'new' | 'mastered'>('new');
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadPhotos();
  }, [authState.isLoggedIn]);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      if (authState.isLoggedIn) {
        const res = await api.listPhotos();
        const cloudPhotos: PhotoItem[] = (res.photos || []).map((p: Record<string, unknown>) => ({
          id: (p.id || p._id || '') as string,
          dataUrl: (p.originalUrl || '') as string,
          annotatedDataUrl: p.annotatedUrl as string | undefined,
          objects: (p.objects || []) as PhotoItem['objects'],
        }));
        setPhotos(cloudPhotos);
      } else {
        const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
        setPhotos(localPhotos);
      }
    } catch {
      const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      setPhotos(localPhotos);
    } finally {
      setLoading(false);
    }
  }, [authState.isLoggedIn]);

  const wordEntries = useMemo(() => {
    const wordMap = new Map<string, {
      phonetic: string;
      examples: string[];
      photoIds: Set<string>;
    }>();

    for (const photo of photos) {
      if (!photo.objects) continue;
      for (const obj of photo.objects) {
        const name = (obj.name || '').toLowerCase();
        if (!name) continue;
        const existing = wordMap.get(name);
        if (existing) {
          existing.photoIds.add(photo.id);
        } else {
          wordMap.set(name, {
            phonetic: obj.phonetic || '',
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
        examples: value.examples,
        photoCount: value.photoIds.size,
        photoIds: Array.from(value.photoIds),
      });
    });

    entries.sort((a, b) => a.word.localeCompare(b.word));
    return entries;
  }, [photos, refreshKey]);

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
        </ScrollView>
      )}
    </View>
  );
}