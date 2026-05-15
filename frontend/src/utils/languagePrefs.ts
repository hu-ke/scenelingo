export interface LanguagePrefs {
  nativeLang: string;
  targetLang: string;
}

export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
];

export const TTS_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  ru: 'ru-RU',
  ar: 'ar-SA',
};

const AI_LANG_NAMES: Record<string, string> = {
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
};

const AI_PHONETIC_DESC: Record<string, string> = {
  zh: 'the Pinyin of the word',
  en: 'the English phonetic transcription of the word, e.g. "/ˈæp.l/"',
  ja: 'the Romaji reading of the word',
  ko: 'the Romanized reading of the word',
  fr: 'the IPA phonetic transcription of the word',
  de: 'the IPA phonetic transcription of the word',
  es: 'the IPA phonetic transcription of the word',
  pt: 'the IPA phonetic transcription of the word',
  ru: 'the Cyrillic pronunciation with stress mark',
  ar: 'the Romanized transliteration of the word',
};

const STORAGE_KEY = 'scene_lingo_language_prefs';

const DEFAULT_PREFS: LanguagePrefs = {
  nativeLang: 'zh',
  targetLang: 'en',
};

export function getLanguagePrefs(): LanguagePrefs {
  let targetLang = DEFAULT_PREFS.targetLang;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.targetLang) {
        targetLang = parsed.targetLang;
      }
    }
  } catch {
  }
  return { nativeLang: DEFAULT_PREFS.nativeLang, targetLang };
}

export function setLanguagePrefs(prefs: LanguagePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ targetLang: prefs.targetLang }));
}

export function getTtsLang(targetLang: string): string {
  return TTS_LANG_MAP[targetLang] || 'en-US';
}

export function getNativeName(code: string): string {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang?.name || code;
}

export function getAiLangName(code: string): string {
  return AI_LANG_NAMES[code] || code;
}

export function getAiPhoneticDesc(code: string): string {
  return AI_PHONETIC_DESC[code] || `the phonetic transcription of the word`;
}

export function getPromptDescription(nativeLang: string, targetLang: string): string {
  const targetName = getAiLangName(targetLang);
  const nativeName = getAiLangName(nativeLang);
  const phoneticDesc = getAiPhoneticDesc(targetLang);

  return (
    `Please identify only the obvious and prominent objects in the image. ` +
    `Each object should contain name (object name in ${targetName}), ` +
    `phonetic (${phoneticDesc}), ` +
    `native (the ${nativeName} translation of the word, e.g. if native is Chinese then "苹果"), ` +
    `bbox (bounding box coordinates), and ` +
    `examples (an array of 2 simple ${targetName} example sentences using the word). ` +
    `The bbox format is [x1, y1, x2, y2], with coordinate values normalized to the 0-1000 range. ` +
    `Return only a JSON array with no other text.`
  );
}
