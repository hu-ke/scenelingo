import { useState, useEffect, useCallback, useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api, getApiBaseUrl } from '../../utils/api';
import { getJSONStorage } from '../../utils/storage';
import { isMastered, toggleMastered, isInWordbook, toggleWordbook } from '../../utils/wordMastery';
import { getTtsLang, getLanguagePrefs } from '../../utils/languagePrefs';
import { useTheme } from '../../hooks/useTheme';
import type { PhotoItem, RecognizedObject } from '../../context/AppContext';
import './index.scss';

export default function WordDetailPage() {
  const themeStyle = useTheme();
  const { state, dispatch } = useReview();
  const { state: authState } = useAuth();
  const word = state.wordDetailWord;
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [mastered, setMastered] = useState(false);
  const [inWordbook, setInWordbook] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [authState.isLoggedIn]);

  useEffect(() => {
    if (word) {
      setMastered(isMastered(word));
      setInWordbook(isInWordbook(word));
    }
  }, [word]);

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

    if (matchedObjects.length === 0) return null;

    return {
      phonetic: matchedObjects[0].phonetic || '',
      romaji: matchedObjects[0].romaji || '',
      chinese: matchedObjects[0].chinese || '',
      examples: matchedObjects.flatMap((obj) => obj.examples || []),
      relatedPhotos,
    };
  }, [word, photos]);

  const handleToggleMastered = useCallback(() => {
    if (!word) return;
    const nowMastered = toggleMastered(word);
    setMastered(nowMastered);
  }, [word]);

  const handleToggleWordbook = useCallback(() => {
    if (!word) return;
    const nowIn = toggleWordbook(word);
    setInWordbook(nowIn);
    if (nowIn) {
      Taro.showToast({ title: '已加入生词本', icon: 'success', duration: 1500 });
    } else {
      Taro.showToast({ title: '已移出生词本', icon: 'none', duration: 1500 });
    }
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
            <Button
              className={`worddetail-wordbook-btn ${inWordbook ? 'worddetail-wordbook-btn-active' : ''}`}
              onClick={handleToggleWordbook}
            >
              {inWordbook ? '📖 已加入生词本' : '+ 加入生词本'}
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