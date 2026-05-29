import { useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { getTheme, onThemeChange, getThemeColors } from '../utils/theme';

export function useTheme() {
  const [themeStyle, setThemeStyle] = useState<Record<string, string>>(() => {
    return getThemeColors(getTheme());
  });

  useDidShow(() => {
    setThemeStyle(getThemeColors(getTheme()));
  });

  useEffect(() => {
    setThemeStyle(getThemeColors(getTheme()));
    const unsubscribe = onThemeChange(() => {
      setThemeStyle(getThemeColors(getTheme()));
    });
    return unsubscribe;
  }, []);

  const cssStyle: Record<string, string> = {};
  for (const [key, value] of Object.entries(themeStyle)) {
    cssStyle[key] = value;
  }

  return cssStyle;
}
