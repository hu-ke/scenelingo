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
  chinese: string;
  examples: string[];
  photoCount: number;
  photoIds: string[];
}

export default function WordBookPage() {
  const themeStyle = useTheme();
  const { dispatch } = useReview();
  const [activeTab, setActiveTab] = useState<'new' | 'mastered'>('new');
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [wordbookWordList, setWordbookWordList] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAllPhotos = useCallback(async () => {
    setLoading(true);
    try {
      // 从服务端获取生词本列表
      const words = await getWordbookWords();
      setWordbookWordList(words);

      // 只请求与生词本单词有关的照片
      if (words.length > 0) {
        const res = await api.listPhotos(undefined, undefined, words);
        const cloudPhotos = (res.photos || []).map((p: Record<string, unknown>) => ({
          id: (p.id || p._id || '') as string,
          dataUrl: (p.originalUrl || '') as string,
          annotatedDataUrl: p.annotatedUrl as string | undefined,
          objects: (p.objects || []) as PhotoItem['objects'],
        }));
        setPhotos(cloudPhotos);
        console.log('[WordBook] 加载关联照片数:', cloudPhotos.length);
      } else {
        setPhotos([]);
      }
    } catch {
      const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      setPhotos(localPhotos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllPhotos();
  }, []);

  useDidShow(() => {
    loadAllPhotos();
    setRefreshKey((k) => k + 1);
  });

  const wordEntries = useMemo(() => {
    const wordbookWordsSet = new Set(wordbookWordList);
    const wordMap = new Map<string, {
      phonetic: string;
      romaji: string;
      chinese: string;
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
            chinese: obj.chinese || '',
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
        chinese: value.chinese,
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

  const handleExport = useCallback(async () => {
    try {
      const BOM = '\uFEFF';
      const header = '单词,音标,罗马音,中文翻译,例句,关联照片数,掌握状态\n';
      const rows = wordEntries.map((w) => {
        const mastered = isMastered(w.word) ? '已掌握' : '生词';
        const examples = w.examples.length > 0 ? w.examples.join('；') : '';
        const escapedWord = w.word.includes(',') ? `"${w.word}"` : w.word;
        const escapedPhonetic = w.phonetic.includes(',') ? `"${w.phonetic}"` : w.phonetic;
        const escapedRomaji = w.romaji.includes(',') ? `"${w.romaji}"` : w.romaji;
        const escapedChinese = w.chinese.includes(',') ? `"${w.chinese}"` : w.chinese;
        const escapedExamples = examples.includes(',') ? `"${examples}"` : examples;
        return `${escapedWord},${escapedPhonetic},${escapedRomaji},${escapedChinese},${escapedExamples},${w.photoCount},${mastered}`;
      }).join('\n');

      const csv = BOM + header + rows;
      await Taro.setClipboardData({ data: csv });
      Taro.showToast({ title: '已复制到剪贴板，可粘贴到 Excel', icon: 'success', duration: 2000 });
    } catch (err) {
      console.error('[WordBook] 导出失败:', err);
      Taro.showToast({ title: '导出失败，请重试', icon: 'none' });
    }
  }, [wordEntries]);

  const handleWordClick = useCallback((word: string) => {
    dispatch({ type: 'setWordDetail', word });
    Taro.navigateTo({ url: '/pages/worddetail/index' });
  }, [dispatch]);

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
          <Text className="wordbook-header-title">我的单词本</Text>
          {!loading && wordEntries.length > 0 ? (
            <View className="wordbook-export-btn" onClick={handleExport}>
              <Text className="wordbook-export-text">导出</Text>
            </View>
          ) : (
            <View className="wordbook-back-btn" />
          )}
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
        </ScrollView>
      )}
    </View>
  );
}
