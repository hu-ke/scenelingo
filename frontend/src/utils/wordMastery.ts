import { api } from './api';

const STORAGE_KEY = 'scene_lingo_mastered_words';
const WORDBOOK_KEY = 'scene_lingo_wordbook_words';

export function getMasteredWords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    return true;
  } else {
    words.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    return false;
  }
}

// ─── 生词本：本地存储 + 服务端同步 ───

function isLoggedIn(): boolean {
  return !!localStorage.getItem('scene_lingo_token');
}

function _saveLocal(words: string[]): void {
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(words));
}

async function _syncToServer(): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    const words = getWordbookWords();
    await api.syncWordbook(words);
  } catch {
    // 静默失败
  }
}

export function getWordbookWords(): string[] {
  try {
    const raw = localStorage.getItem(WORDBOOK_KEY);
    if (!raw) return [];
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
    _saveLocal(words);
    _syncToServer();
  }
}

export function removeFromWordbook(word: string): void {
  const words = getWordbookWords();
  const key = word.toLowerCase();
  const index = words.indexOf(key);
  if (index !== -1) {
    words.splice(index, 1);
    _saveLocal(words);
    _syncToServer();
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

/** 登录后调用：从服务端拉取生词本，与本地合并，然后同步到服务端 */
export async function syncWordbookFromServer(): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    const res = await api.listWordbook();
    const serverWords = (res.words || []).map((w: string) => w.toLowerCase());
    const localWords = getWordbookWords();

    const merged = new Set([...localWords, ...serverWords]);
    const mergedList = Array.from(merged);

    _saveLocal(mergedList);

    if (mergedList.length !== serverWords.length) {
      await api.syncWordbook(mergedList);
    }
  } catch {
    // 静默失败
  }
}
