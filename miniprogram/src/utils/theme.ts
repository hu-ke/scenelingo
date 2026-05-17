export interface Theme {
  id: string;
  name: string;
  colors: Record<string, string>;
}

const warmOrange: Theme = {
  id: 'warm-orange',
  name: '暖橙',
  colors: {
    '--color-primary-start': '#FF6B6B',
    '--color-primary-mid': '#FF8E53',
    '--color-primary-end': '#FFA94D',
    '--color-primary': '#FF6B6B',
    '--color-accent-purple': '#A29BFE',
    '--color-accent-green': '#2ED573',
    '--color-accent-blue': '#54A0FF',
    '--color-bg': '#FFF5F0',
    '--color-surface': '#FFFFFF',
    '--color-card-bg': '#FFFFFF',
    '--color-text': '#2D3436',
    '--color-text-secondary': '#636E72',
    '--color-text-muted': '#B2BEC3',
    '--color-border': '#F0E6E0',
    '--color-success': '#2ED573',
    '--color-warning': '#FFA94D',
    '--color-danger': '#FF6B6B',
    '--shadow-xs': '0 1px 3px rgba(255,107,107,0.06)',
    '--shadow-sm': '0 2px 8px rgba(255,107,107,0.08)',
    '--shadow-md': '0 4px 16px rgba(255,107,107,0.10)',
    '--shadow-lg': '0 8px 28px rgba(255,107,107,0.12)',
    '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
  },
};

const oceanBlue: Theme = {
  id: 'ocean-blue',
  name: '海蓝',
  colors: {
    '--color-primary-start': '#4A90D9',
    '--color-primary-mid': '#5BA0E8',
    '--color-primary-end': '#6DB5F5',
    '--color-primary': '#4A90D9',
    '--color-accent-purple': '#8B9CF7',
    '--color-accent-green': '#2ECC71',
    '--color-accent-blue': '#4A90D9',
    '--color-bg': '#F0F5FA',
    '--color-surface': '#FFFFFF',
    '--color-card-bg': '#FFFFFF',
    '--color-text': '#2C3E50',
    '--color-text-secondary': '#5D6D7E',
    '--color-text-muted': '#A0AFBF',
    '--color-border': '#E0EAF3',
    '--color-success': '#2ECC71',
    '--color-warning': '#F39C12',
    '--color-danger': '#E74C3C',
    '--shadow-xs': '0 1px 3px rgba(74,144,217,0.06)',
    '--shadow-sm': '0 2px 8px rgba(74,144,217,0.08)',
    '--shadow-md': '0 4px 16px rgba(74,144,217,0.10)',
    '--shadow-lg': '0 8px 28px rgba(74,144,217,0.12)',
    '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
  },
};

const forestGreen: Theme = {
  id: 'forest-green',
  name: '森绿',
  colors: {
    '--color-primary-start': '#27AE60',
    '--color-primary-mid': '#2ECC71',
    '--color-primary-end': '#58D68D',
    '--color-primary': '#27AE60',
    '--color-accent-purple': '#A29BFE',
    '--color-accent-green': '#27AE60',
    '--color-accent-blue': '#54A0FF',
    '--color-bg': '#F0F8F0',
    '--color-surface': '#FFFFFF',
    '--color-card-bg': '#FFFFFF',
    '--color-text': '#2C3E2D',
    '--color-text-secondary': '#5D6E5E',
    '--color-text-muted': '#A0BFA1',
    '--color-border': '#E0F0E0',
    '--color-success': '#27AE60',
    '--color-warning': '#F39C12',
    '--color-danger': '#E74C3C',
    '--shadow-xs': '0 1px 3px rgba(39,174,96,0.06)',
    '--shadow-sm': '0 2px 8px rgba(39,174,96,0.08)',
    '--shadow-md': '0 4px 16px rgba(39,174,96,0.10)',
    '--shadow-lg': '0 8px 28px rgba(39,174,96,0.12)',
    '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
  },
};

const royalPurple: Theme = {
  id: 'royal-purple',
  name: '雅紫',
  colors: {
    '--color-primary-start': '#8E44AD',
    '--color-primary-mid': '#A569BD',
    '--color-primary-end': '#BB8FCE',
    '--color-primary': '#8E44AD',
    '--color-accent-purple': '#8E44AD',
    '--color-accent-green': '#2ECC71',
    '--color-accent-blue': '#5DADE2',
    '--color-bg': '#F8F0FA',
    '--color-surface': '#FFFFFF',
    '--color-card-bg': '#FFFFFF',
    '--color-text': '#2D2C3E',
    '--color-text-secondary': '#5D5C6E',
    '--color-text-muted': '#A09FBF',
    '--color-border': '#ECE0F0',
    '--color-success': '#2ECC71',
    '--color-warning': '#F39C12',
    '--color-danger': '#E74C3C',
    '--shadow-xs': '0 1px 3px rgba(142,68,173,0.06)',
    '--shadow-sm': '0 2px 8px rgba(142,68,173,0.08)',
    '--shadow-md': '0 4px 16px rgba(142,68,173,0.10)',
    '--shadow-lg': '0 8px 28px rgba(142,68,173,0.12)',
    '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
  },
};

const midnightDark: Theme = {
  id: 'midnight-dark',
  name: '暗夜',
  colors: {
    '--color-primary-start': '#6C8CFF',
    '--color-primary-mid': '#8BA4FF',
    '--color-primary-end': '#A0B5FF',
    '--color-primary': '#6C8CFF',
    '--color-accent-purple': '#A29BFE',
    '--color-accent-green': '#4ADE80',
    '--color-accent-blue': '#6C8CFF',
    '--color-bg': '#1A1D23',
    '--color-surface': '#252830',
    '--color-card-bg': '#252830',
    '--color-text': '#E8E8ED',
    '--color-text-secondary': '#A0A5B0',
    '--color-text-muted': '#5C6068',
    '--color-border': '#353840',
    '--color-success': '#4ADE80',
    '--color-warning': '#F59E0B',
    '--color-danger': '#EF4444',
    '--shadow-xs': '0 1px 3px rgba(0,0,0,0.06)',
    '--shadow-sm': '0 2px 8px rgba(0,0,0,0.08)',
    '--shadow-md': '0 4px 16px rgba(0,0,0,0.10)',
    '--shadow-lg': '0 8px 28px rgba(0,0,0,0.12)',
    '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
  },
};

export const THEMES: Theme[] = [
  warmOrange,
  oceanBlue,
  forestGreen,
  royalPurple,
  midnightDark,
];

export const DEFAULT_THEME = 'ocean-blue';

const THEME_MAP = new Map<string, Theme>(THEMES.map((t) => [t.id, t]));

export function getTheme(): string {
  return Taro.getStorageSync('scene_lingo_theme') || DEFAULT_THEME;
}

export function setTheme(themeId: string): void {
  Taro.setStorageSync('scene_lingo_theme', themeId);
  applyTheme(themeId);
}

export function applyTheme(themeId: string): void {
  const theme = THEME_MAP.get(themeId);
  if (!theme) return;
  console.log('Theme applied:', themeId, theme.colors);
  // Theme colors will be consumed by components via the AppContext
}

export function getThemeColors(themeId: string): Record<string, string> {
  const theme = THEME_MAP.get(themeId);
  return theme?.colors || THEME_MAP.get(DEFAULT_THEME)!.colors;
}

import Taro from '@tarojs/taro';