const STORAGE_KEY = 'scene_lingo_mastered_words';

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