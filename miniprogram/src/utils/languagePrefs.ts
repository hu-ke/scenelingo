import Taro from '@tarojs/taro';

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
  { code: 'th', name: 'ไทย' },
  { code: 'fa', name: 'فارسی' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'my', name: 'ဗမာစာ' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'sv', name: 'Svenska' },
  { code: 'uk', name: 'Українська' },
  { code: 'he', name: 'עברית' },
  { code: 'cs', name: 'Čeština' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'ro', name: 'Română' },
  { code: 'hu', name: 'Magyar' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
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
  th: 'th-TH',
  fa: 'fa-IR',
  vi: 'vi-VN',
  my: 'my-MM',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  hi: 'hi-IN',
  id: 'id-ID',
  ms: 'ms-MY',
  sv: 'sv-SE',
  uk: 'uk-UA',
  he: 'he-IL',
  cs: 'cs-CZ',
  el: 'el-GR',
  ro: 'ro-RO',
  hu: 'hu-HU',
  da: 'da-DK',
  fi: 'fi-FI',
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
  th: 'Thai',
  fa: 'Persian',
  vi: 'Vietnamese',
  my: 'Burmese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  hi: 'Hindi',
  id: 'Indonesian',
  ms: 'Malay',
  sv: 'Swedish',
  uk: 'Ukrainian',
  he: 'Hebrew',
  cs: 'Czech',
  el: 'Greek',
  ro: 'Romanian',
  hu: 'Hungarian',
  da: 'Danish',
  fi: 'Finnish',
};

const AI_PHONETIC_DESC: Record<string, string> = {
  zh: 'the Pinyin of the word',
  en: 'the English phonetic transcription of the word, e.g. "/ˈæp.l/"',
  ja: 'the Hiragana reading of the word',
  ko: 'the Romanized reading of the word',
  fr: 'the IPA phonetic transcription of the word',
  de: 'the IPA phonetic transcription of the word',
  es: 'the IPA phonetic transcription of the word',
  pt: 'the IPA phonetic transcription of the word',
  ru: 'the Cyrillic pronunciation with stress mark',
  ar: 'the Romanized transliteration of the word',
  th: 'the Romanized transcription (Paiboon system) of the word',
  fa: 'the Romanized transliteration of the word',
  vi: 'the IPA phonetic transcription with tone marks of the word',
  my: 'the Romanized transliteration of the word',
  it: 'the IPA phonetic transcription of the word',
  nl: 'the IPA phonetic transcription of the word',
  pl: 'the IPA phonetic transcription of the word',
  tr: 'the IPA phonetic transcription of the word',
  hi: 'the Romanized transliteration (IAST) of the word',
  id: 'the IPA phonetic transcription of the word',
  ms: 'the IPA phonetic transcription of the word',
  sv: 'the IPA phonetic transcription of the word',
  uk: 'the IPA phonetic transcription of the word',
  he: 'the Romanized transliteration of the word',
  cs: 'the IPA phonetic transcription of the word',
  el: 'the IPA phonetic transcription of the word',
  ro: 'the IPA phonetic transcription of the word',
  hu: 'the IPA phonetic transcription of the word',
  da: 'the IPA phonetic transcription of the word',
  fi: 'the IPA phonetic transcription of the word',
};

const STORAGE_KEY = 'scene_lingo_language_prefs';
const DEFAULT_PREFS: LanguagePrefs = { nativeLang: 'zh', targetLang: 'en' };

export function getLanguagePrefs(): LanguagePrefs {
  let nativeLang = DEFAULT_PREFS.nativeLang;
  let targetLang = DEFAULT_PREFS.targetLang;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.nativeLang) {
        nativeLang = parsed.nativeLang;
      }
      if (parsed.targetLang) {
        targetLang = parsed.targetLang;
      }
    }
  } catch {
  }
  return { nativeLang, targetLang };
}

export function setLanguagePrefs(prefs: LanguagePrefs): void {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify({ nativeLang: prefs.nativeLang, targetLang: prefs.targetLang }));
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
  return AI_PHONETIC_DESC[code] || 'the phonetic transcription of the word';
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