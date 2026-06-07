import { getStorage, setJSONStorage } from './storage';

const STORAGE_KEY = 'scene_lingo_mastered_words';
const WORDBOOK_KEY = 'scene_lingo_wordbook_words';

export function getMasteredWords(): string[] {
  try {
    const raw = getStorage<string>(STORAGE_KEY, '[]');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((w: unknown) => String(w).toLowerCase());
  } catch {
    return [];
  }
}

export function isMastered(word: string): boolean {
  const words = getMasteredWords();
  return words.includes(word.toLowerCase());
}

export function toggleMastered(word: string): boolean {
  const words = getMasteredWords();
  const key = word.toLowerCase();
  const index = words.indexOf(key);
  if (index === -1) {
    words.push(key);
    setJSONStorage(STORAGE_KEY, words);
    return true;
  } else {
    words.splice(index, 1);
    setJSONStorage(STORAGE_KEY, words);
    return false;
  }
}

// 生词本：用户手动添加的单词列表
export function getWordbookWords(): string[] {
  try {
    const raw = getStorage<string>(WORDBOOK_KEY, '[]');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((w: unknown) => String(w).toLowerCase());
  } catch {
    return [];
  }
}

export function isInWordbook(word: string): boolean {
  const words = getWordbookWords();
  return words.includes(word.toLowerCase());
}

export function addToWordbook(word: string): void {
  const words = getWordbookWords();
  const key = word.toLowerCase();
  if (!words.includes(key)) {
    words.push(key);
    setJSONStorage(WORDBOOK_KEY, words);
  }
}

export function removeFromWordbook(word: string): void {
  const words = getWordbookWords();
  const key = word.toLowerCase();
  const index = words.indexOf(key);
  if (index !== -1) {
    words.splice(index, 1);
    setJSONStorage(WORDBOOK_KEY, words);
  }
}

export function toggleWordbook(word: string): boolean {
  if (isInWordbook(word)) {
    removeFromWordbook(word);
    return false;
  } else {
    addToWordbook(word);
    return true;
  }
}