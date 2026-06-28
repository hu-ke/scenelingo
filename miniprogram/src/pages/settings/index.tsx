import { useState, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Picker } from '@tarojs/components';
import { useReview } from '../../context/AppContext';
import { LANGUAGES, setLanguagePrefs } from '../../utils/languagePrefs';
import { api } from '../../utils/api';
import './index.scss';

export default function SettingsPage() {
  const { state, dispatch } = useReview();
  const [selectedLang, setSelectedLang] = useState(state.targetLang);

  const targetLanguages = LANGUAGES.filter((l) => l.code !== 'zh');

  const handleLangChange = useCallback(
    (e: { detail: { value: number } }) => {
      const lang = targetLanguages[e.detail.value];
      if (!lang) return;
      setSelectedLang(lang.code);
      setLanguagePrefs({ nativeLang: 'zh', targetLang: lang.code });
      dispatch({ type: 'setLanguage', nativeLang: 'zh', targetLang: lang.code });
      api.updateLanguage('zh', lang.code).catch(() => {});
    },
    [targetLanguages, dispatch],
  );

  const currentLangIndex = targetLanguages.findIndex((l) => l.code === selectedLang);

  return (
    <View className="settings-page">
      <View className="settings-card">
        <View className="settings-section">
          <Text className="settings-label">母语</Text>
          <View className="settings-readonly">中文</View>
        </View>

        <View className="settings-section">
          <Text className="settings-label">学习语言</Text>
          <Picker
            mode="selector"
            range={targetLanguages}
            rangeKey="name"
            value={currentLangIndex >= 0 ? currentLangIndex : 0}
            // @ts-ignore
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
      </View>
    </View>
  );
}
