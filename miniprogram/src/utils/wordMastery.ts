import { getStorage, setJSONStorage, removeStorage } from './storage';
import { api } from './api';

const STORAGE_KEY = 'scene_lingo_mastered_words';
const WORDBOOK_LOCAL_KEY = 'wordbook_words'; // 旧本地生词本 key（不含前缀，storage.ts 会自动加 scene_lingo_）

// ─── 已掌握：服务端读写 ───

/** 从服务端获取已掌握列表 */
export async function getMasteredWords(): Promise<string[]> {
  try {
    const res = await api.listMastered();
    return (res.words || []).map((w: string) => w.toLowerCase());
  } catch {
    return [];
  }
}

/** 检查单词是否已掌握（需要传入已加载的列表） */
export function isInMasteredList(word: string, masteredWords: string[]): boolean {
  return masteredWords.includes(word.toLowerCase());
}

/** 添加单词到已掌握（服务端） */
export async function addToMastered(word: string): Promise<void> {
  await api.addMasteredWord(word);
}

/** 从已掌握移除单词（服务端） */
export async function removeFromMastered(word: string): Promise<void> {
  await api.removeMasteredWord(word);
}

/** 切换单词的已掌握状态（服务端），返回切换后是否已掌握 */
export async function toggleMastered(word: string, currentInMastered: boolean): Promise<boolean> {
  if (currentInMastered) {
    await removeFromMastered(word);
    return false;
  } else {
    await addToMastered(word);
    return true;
  }
}

/** 便捷同步方法：检查单词是否已掌握（先加载列表） */
export function isMastered(word: string): boolean {
  const words = getLocalMasteredFallback();
  return words.includes(word.toLowerCase());
}

/** 本地存储兜底读取（仅在未登录或 API 失败时使用） */
function getLocalMasteredFallback(): string[] {
  try {
    const raw = getStorage<string>(STORAGE_KEY, '[]');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((w: unknown) => String(w).toLowerCase());
  } catch {
    return [];
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

// ─── 迁移：将本地残留的已掌握数据同步到服务端，成功后清除本地 ───

/** 登录后调用：将本地已掌握数据迁移到服务端，成功后清除本地 */
export async function migrateLocalMastered(): Promise<void> {
  const localWords = getLocalMasteredFallback();
  if (localWords.length === 0) return;

  try {
    for (const word of localWords) {
      await api.addMasteredWord(word);
    }
    removeStorage(STORAGE_KEY);
    console.log(`[migrateLocalMastered] 已迁移 ${localWords.length} 个已掌握单词到服务端`);
  } catch (err) {
    console.error('[migrateLocalMastered] 迁移失败，保留本地数据:', err);
  }
}
