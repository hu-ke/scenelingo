import { useState, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Picker } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { LANGUAGES, setLanguagePrefs } from '../../utils/languagePrefs';
import { THEMES, setTheme } from '../../utils/theme';
import { api } from '../../utils/api';
import { useTheme } from '../../hooks/useTheme';
import './index.scss';

const GRADIENTS: Record<string, string> = {
  'warm-orange': 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
  'ocean-blue': 'linear-gradient(135deg, #4A90D9, #6DB5F5)',
  'forest-green': 'linear-gradient(135deg, #27AE60, #58D68D)',
  'royal-purple': 'linear-gradient(135deg, #8E44AD, #BB8FCE)',
  'midnight-dark': 'linear-gradient(135deg, #1A1D23, #6C8CFF)',
};

export default function SettingsPage() {
  const themeStyle = useTheme();
  const { state, dispatch } = useReview();
  const { state: authState } = useAuth();
  const [selectedLang, setSelectedLang] = useState(state.targetLang);
  const [selectedTheme, setSelectedTheme] = useState(state.theme);

  const targetLanguages = LANGUAGES.filter((l) => l.code !== 'zh');

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleLangChange = useCallback(
    (e: { detail: { value: number } }) => {
      const lang = targetLanguages[e.detail.value];
      if (!lang) return;
      setSelectedLang(lang.code);
      setLanguagePrefs({ nativeLang: 'zh', targetLang: lang.code });
      dispatch({ type: 'setLanguage', nativeLang: 'zh', targetLang: lang.code });
      if (authState.isLoggedIn) {
        api.updateLanguage('zh', lang.code).catch(() => {});
      }
    },
    [targetLanguages, dispatch, authState.isLoggedIn],
  );

  const handleThemeChange = useCallback((themeId: string) => {
    setSelectedTheme(themeId);
    setTheme(themeId);
    dispatch({ type: 'setTheme', theme: themeId });
    if (authState.isLoggedIn) {
      api.updateTheme(themeId).catch(() => {});
    }
  }, [dispatch, authState.isLoggedIn]);

  const currentLangIndex = targetLanguages.findIndex((l) => l.code === selectedLang);

  return (
    <View className="settings-page" style={themeStyle}>
      <View className="settings-card">
        <View className="settings-header">
          <Text className="settings-logo">🔍</Text>
          <Text className="settings-title">设置</Text>
        </View>

        <View className="settings-section">
          <Text className="settings-label">母语 (Native Language)</Text>
          <View className="settings-readonly">中文</View>
        </View>

        <View className="settings-section">
          <Text className="settings-label">目标语言 (Target Language)</Text>
          <Picker
            mode="selector"
            range={targetLanguages}
            rangeKey="name"
            value={currentLangIndex >= 0 ? currentLangIndex : 0}
            onChange={handleLangChange}
          >
            <View className="settings-picker">
              <Text>
                {targetLanguages[currentLangIndex >= 0 ? currentLangIndex : 0]?.name || ''}
              </Text>
              <Text className="settings-picker-arrow">▼</Text>
            </View>
          </Picker>
        </View>

        <View className="settings-section">
          <Text className="settings-label">主题风格</Text>
          <View className="settings-theme-row">
            {THEMES.map((theme) => (
              <View
                key={theme.id}
                className={`settings-theme-circle ${selectedTheme === theme.id ? 'settings-theme-selected' : ''}`}
                style={{ background: GRADIENTS[theme.id] }}
                onClick={() => handleThemeChange(theme.id)}
              >
                {selectedTheme === theme.id && (
                  <Text className="settings-theme-check">✓</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <Button className="settings-back-btn" onClick={handleBack}>
          返回
        </Button>
      </View>
    </View>
  );
}