import Taro from '@tarojs/taro';

const STORAGE_PREFIX = 'scene_lingo_';

export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const value = Taro.getStorageSync(STORAGE_PREFIX + key);
    if (value === '' || value === undefined || value === null) {
      return defaultValue;
    }
    return value as T;
  } catch {
    return defaultValue;
  }
}

export function setStorage(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(STORAGE_PREFIX + key, value);
  } catch (e) {
    console.error('Storage set failed:', e);
  }
}

export function removeStorage(key: string): void {
  try {
    Taro.removeStorageSync(STORAGE_PREFIX + key);
  } catch (e) {
    console.error('Storage remove failed:', e);
  }
}

export function getJSONStorage<T>(key: string, defaultValue: T): T {
  try {
    const value = Taro.getStorageSync(STORAGE_PREFIX + key);
    if (!value) return defaultValue;
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

export function setJSONStorage(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage setJSON failed:', e);
  }
}

export { Taro };