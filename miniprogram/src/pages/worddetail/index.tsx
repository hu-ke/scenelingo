import { useState, useEffect, useCallback, useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { api, getApiBaseUrl } from '../../utils/api';
import { getJSONStorage } from '../../utils/storage';
import { isMastered, toggleMastered } from '../../utils/wordMastery';
import { getTtsLang, getLanguagePrefs } from '../../utils/languagePrefs';
import { useTheme } from '../../hooks/useTheme';
import type { PhotoItem, RecognizedObject } from '../../context/AppContext';
import './index.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

interface GridImageItem {
  id: string;
  dataUrl: string;
  annotatedDataUrl?: string;
  objects?: RecognizedObject[];
}

interface GridResult {
  _id: string;
  category_path: string[];
  grid_index: number;
  image_url: string;
  annotated_url?: string;
  thumbnail_url?: string;
  words: Array<{
    word: string;
    row: number;
    col: number;
    bbox?: [number, number, number, number];
    chinese?: string;
    phonetic?: string;
    examples?: string[];
  }>;
}

export default function WordDetailPage() {
  const themeStyle = useTheme();
  const { state, dispatch } = useReview();
  const word = state.wordDetailWord;
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [gridImages, setGridImages] = useState<GridImageItem[]>([]);
  const [mastered, setMastered] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  useEffect(() => {
    if (word) {
      setMastered(isMastered(word));
      loadGridImages();
    }
  }, [word]);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listPhotos();
      const cloudPhotos: PhotoItem[] = (res.photos || []).map((p: Record<string, unknown>) => ({
        id: (p.id || p._id || '') as string,
        dataUrl: (p.originalUrl || '') as string,
        annotatedDataUrl: p.annotatedUrl as string | undefined,
        objects: (p.objects || []) as PhotoItem['objects'],
      }));
      setPhotos(cloudPhotos);
    } catch {
      const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', []);
      setPhotos(localPhotos);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGridImages = useCallback(async () => {
    if (!word) return;
    try {
      const res = await Taro.request({
        url: `${BASE_URL}/api/category-grids/search`,
        method: 'GET',
        data: { word },
      });
      if (res.statusCode === 200) {
        const grids = (res.data as { grids: GridResult[] }).grids || [];
        const items: GridImageItem[] = grids.map((g) => ({
          id: g._id || `${g.category_path.join('/')}_${g.grid_index}`,
          dataUrl: g.image_url || '',
          annotatedDataUrl: g.annotated_url || g.image_url || '',
          objects: g.words.map((w) => ({
            name: w.word,
            bbox: w.bbox || [0, 0, 0, 0],
            chinese: w.chinese || '',
            phonetic: w.phonetic || '',
            examples: w.examples || [],
          })),
        }));
        setGridImages(items);
      }
    } catch {
      // ignore
    }
  }, [word]);

  const wordData = useMemo(() => {
    if (!word) return null;
    const matchedObjects: RecognizedObject[] = [];
    const relatedPhotos: PhotoItem[] = [];

    for (const photo of photos) {
      if (!photo.objects) continue;
      for (const obj of photo.objects) {
        if (obj.name && obj.name.toLowerCase() === word.toLowerCase()) {
          matchedObjects.push(obj);
          if (!relatedPhotos.find((p) => p.id === photo.id)) {
            relatedPhotos.push(photo);
          }
        }
      }
    }

    // Also search category_grid images for the word
    for (const grid of gridImages) {
      if (!grid.objects) continue;
      const matched = grid.objects.filter(
        (obj) => obj.name.toLowerCase() === word.toLowerCase()
      );
      if (matched.length > 0) {
        matchedObjects.push(...matched);
        if (!relatedPhotos.find((p) => p.id === grid.id)) {
          relatedPhotos.push({
            id: grid.id,
            dataUrl: grid.dataUrl,
            annotatedDataUrl: grid.annotatedDataUrl,
            objects: grid.objects,
          });
        }
      }
    }

    if (matchedObjects.length === 0) return null;

    return {
      phonetic: matchedObjects[0].phonetic || '',
      romaji: matchedObjects[0].romaji || '',
      chinese: matchedObjects[0].chinese || '',
      examples: matchedObjects.flatMap((obj) => obj.examples || []),
      relatedPhotos,
    };
  }, [word, photos, gridImages]);

  const handleToggleMastered = useCallback(() => {
    if (!word) return;
    const nowMastered = toggleMastered(word);
    setMastered(nowMastered);
  }, [word]);

  const handleSpeak = useCallback(() => {
    if (!word) return;
    try {
      const audioCtx = Taro.createInnerAudioContext();
      const ttsLang = getTtsLang(getLanguagePrefs().targetLang);
      const baseUrl = getApiBaseUrl();
      audioCtx.src = `${baseUrl}/api/tts?text=${encodeURIComponent(word)}&lang=${ttsLang}`;
      audioCtx.play();
      audioCtx.onEnded(() => {
        audioCtx.destroy();
      });
      audioCtx.onError(() => {
        audioCtx.destroy();
      });
    } catch {
      // ignore
    }
  }, [word]);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  if (loading) {
    return (
      <View className="worddetail-page" style={themeStyle}>
        <View className="worddetail-header">
          <View className="worddetail-header-top">
            <View className="worddetail-back-btn" onClick={handleBack}>
              <Text className="worddetail-back-arrow">←</Text>
            </View>
            <Text className="worddetail-header-title">单词详情</Text>
            <View className="worddetail-back-btn" />
          </View>
        </View>
        <View className="worddetail-loading">
          <View className="spinner" />
        </View>
      </View>
    );
  }

  if (!word) {
    return (
      <View className="worddetail-page" style={themeStyle}>
        <View className="worddetail-header">
          <View className="worddetail-header-top">
            <View className="worddetail-back-btn" onClick={handleBack}>
              <Text className="worddetail-back-arrow">←</Text>
            </View>
            <Text className="worddetail-header-title">单词详情</Text>
            <View className="worddetail-back-btn" />
          </View>
        </View>
        <View className="worddetail-empty">
          <Text className="worddetail-empty-icon">📖</Text>
          <Text className="worddetail-empty-text">未选择单词，请从单词本中选择一个单词查看</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="worddetail-page" style={themeStyle}>
      <View className="worddetail-header">
        <View className="worddetail-header-top">
          <View className="worddetail-back-btn" onClick={handleBack}>
            <Text className="worddetail-back-arrow">←</Text>
          </View>
          <Text className="worddetail-header-title">单词详情</Text>
          <View className="worddetail-back-btn" />
        </View>
        <Text className="worddetail-header-subtitle">{word}</Text>
      </View>

      <ScrollView className="worddetail-content" scrollY>
        <View className="worddetail-info-card">
          <Text className="worddetail-word">{word}</Text>
          {wordData?.chinese ? (
            <Text className="worddetail-chinese">{wordData.chinese}</Text>
          ) : null}
          {wordData?.phonetic ? (
            <Text className="worddetail-phonetic">{wordData.phonetic}</Text>
          ) : null}
          {wordData?.romaji ? (
            <Text className="worddetail-romaji">{wordData.romaji}</Text>
          ) : null}

          <View className="worddetail-actions">
            <Button className="worddetail-speak-btn" onClick={handleSpeak}>
              🔊 发音
            </Button>
            <Button
              className={`worddetail-mastery-btn ${mastered ? 'worddetail-mastery-btn-active' : ''}`}
              onClick={handleToggleMastered}
            >
              {mastered ? '✅ 该单词已掌握' : '标记为已掌握'}
            </Button>
          </View>
        </View>

        <View className="worddetail-section">
          <Text className="worddetail-section-title">📸 学习照片</Text>
          {wordData && wordData.relatedPhotos.length > 0 ? (
            <View className="worddetail-photo-grid">
              {wordData.relatedPhotos.slice(0, 3).map((photo) => (
                <Image
                  key={photo.id}
                  className="worddetail-photo-thumb"
                  src={photo.annotatedDataUrl || photo.dataUrl}
                  mode="aspectFill"
                />
              ))}
            </View>
          ) : (
            <Text className="worddetail-section-empty">暂无关联照片</Text>
          )}
        </View>

        <View className="worddetail-section">
          <Text className="worddetail-section-title">📖 例句</Text>
          {wordData && wordData.examples.length > 0 ? (
            <View className="worddetail-examples">
              {wordData.examples.map((example, index) => (
                <View key={index} className="worddetail-example-card">
                  <Text className="worddetail-example-icon">📖</Text>
                  <Text className="worddetail-example-text">{example}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="worddetail-section-empty">暂无例句</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}