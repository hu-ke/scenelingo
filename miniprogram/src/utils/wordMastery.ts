import { getStorage, setJSONStorage, removeStorage } from './storage';
import { api } from './api';

const STORAGE_KEY = 'scene_lingo_mastered_words';
const WORDBOOK_LOCAL_KEY = 'wordbook_words'; // 旧本地生词本 key（不含前缀，storage.ts 会自动加 scene_lingo_）

// ─── 已掌握：仅本地存储（不同步到服务端） ───

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

// ─── 生词本：纯服务端读写 ───

/** 从服务端获取生词本列表 */
export async function getWordbookWords(): Promise<string[]> {
  try {
    const res = await api.listWordbook();
    return (res.words || []).map((w: string) => w.toLowerCase());
  } catch {
    return [];
  }
}

/** 检查单词是否在生词本中（需要传入已加载的列表） */
export function isInWordbookList(word: string, wordbookWords: string[]): boolean {
  return wordbookWords.includes(word.toLowerCase());
}

/** 添加单词到生词本（服务端） */
export async function addToWordbook(word: string): Promise<void> {
  await api.addWordbookWord(word);
}

/** 从生词本移除单词（服务端） */
export async function removeFromWordbook(word: string): Promise<void> {
  await api.removeWordbookWord(word);
}

/** 切换单词在生词本中的状态（服务端），返回切换后是否在生词本中 */
export async function toggleWordbook(word: string, currentInWordbook: boolean): Promise<boolean> {
  if (currentInWordbook) {
    await removeFromWordbook(word);
    return false;
  } else {
    await addToWordbook(word);
    return true;
  }
}

// ─── 迁移：将本地残留的生词本数据同步到服务端，成功后清除本地 ───

/** 读取本地残留的生词本列表 */
function getLocalWordbookWords(): string[] {
  try {
    const raw = getStorage<string>(WORDBOOK_LOCAL_KEY, '[]');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((w: unknown) => String(w).toLowerCase());
  } catch {
    return [];
  }
}

/** 登录后调用：将本地生词本数据迁移到服务端，成功后清除本地 */
export async function migrateLocalWordbook(): Promise<void> {
  const localWords = getLocalWordbookWords();
  if (localWords.length === 0) return;

  try {
    // 逐个添加到服务端（服务端会自动去重）
    for (const word of localWords) {
      await api.addWordbookWord(word);
    }
    // 全部同步成功，清除本地数据
    removeStorage(WORDBOOK_LOCAL_KEY);
    console.log(`[migrateLocalWordbook] 已迁移 ${localWords.length} 个生词到服务端`);
  } catch (err) {
    console.error('[migrateLocalWordbook] 迁移失败，保留本地数据:', err);
  }
}
