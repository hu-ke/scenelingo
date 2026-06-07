import { createContext, useContext, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { getLanguagePrefs } from '../utils/languagePrefs';
import { getTheme } from '../utils/theme';

export interface PhotoItem {
  id: string;
  dataUrl: string;
  annotatedDataUrl?: string;
  objects?: RecognizedObject[];
  actions?: RecognizedAction[];
  status?: 'pending' | 'processing' | 'completed';
}

export interface RecognizedObject {
  name: string;
  bbox: [number, number, number, number];
  phonetic: string;
  chinese: string;
  examples: string[];
  romaji?: string;
}

export interface RecognizedAction {
  name: string;
  phonetic: string;
  chinese: string;
  examples: string[];
  romaji?: string;
}

export type AppPage = 'home' | 'review' | 'merge' | 'wordbook' | 'worddetail' | 'login' | 'settings';

export interface ReviewState {
  photos: PhotoItem[];
  currentIndex: number;
  currentObjects: RecognizedObject[] | null;
  currentActions: RecognizedAction[] | null;
  isReviewing: boolean;
  savedPhotos: PhotoItem[];
  page: AppPage;
  selectedPhotoIds: string[];
  wordDetailWord: string | null;
  nativeLang: string;
  targetLang: string;
  theme: string;
}

export type ReviewAction =
  | { type: 'setPhotos'; photos: PhotoItem[] }
  | { type: 'setCurrentObjects'; objects: RecognizedObject[] }
  | { type: 'setCurrentActions'; actions: RecognizedAction[] }
  | { type: 'nextPhoto' }
  | { type: 'saveCurrent'; annotatedDataUrl: string }
  | { type: 'skipCurrent' }
  | { type: 'setSavedPhotos'; photos: PhotoItem[] }
  | { type: 'removeSaved'; id: string }
  | { type: 'setPage'; page: AppPage }
  | { type: 'toggleSelectPhoto'; id: string }
  | { type: 'removeSelected'; id: string }
  | { type: 'cleanSelection'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'resetReview' }
  | { type: 'setWordDetail'; word: string | null }
  | { type: 'setLanguage'; nativeLang: string; targetLang: string }
  | { type: 'setTheme'; theme: string };

const initialState: ReviewState = {
  photos: [],
  currentIndex: 0,
  currentObjects: null,
  currentActions: null,
  isReviewing: false,
  savedPhotos: [],
  page: 'home',
  selectedPhotoIds: [],
  wordDetailWord: null,
  nativeLang: getLanguagePrefs().nativeLang,
  targetLang: getLanguagePrefs().targetLang,
  theme: getTheme(),
};

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'setPhotos':
      return {
        ...state,
        photos: action.photos,
        currentIndex: 0,
        isReviewing: action.photos.length > 0,
        currentObjects: null,
        currentActions: null,
      };

    case 'setCurrentObjects':
      return {
        ...state,
        currentObjects: action.objects,
      };

    case 'setCurrentActions':
      return {
        ...state,
        currentActions: action.actions,
      };

    case 'nextPhoto': {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.photos.length) {
        return {
          ...state,
          isReviewing: false,
          currentObjects: null,
          currentActions: null,
        };
      }
      return {
        ...state,
        currentIndex: nextIndex,
        currentObjects: null,
        currentActions: null,
      };
    }

    case 'saveCurrent': {
      const currentPhoto = state.photos[state.currentIndex];
      if (!currentPhoto) return state;

      const savedPhoto: PhotoItem = {
        ...currentPhoto,
        annotatedDataUrl: action.annotatedDataUrl,
        objects: state.currentObjects ?? undefined,
      };

      return {
        ...state,
        savedPhotos: [...state.savedPhotos, savedPhoto],
      };
    }

    case 'skipCurrent':
      return state;

    case 'setSavedPhotos':
      return {
        ...state,
        savedPhotos: action.photos,
      };

    case 'removeSaved':
      return {
        ...state,
        savedPhotos: state.savedPhotos.filter((p) => p.id !== action.id),
      };

    case 'setPage':
      return {
        ...state,
        page: action.page,
      };

    case 'toggleSelectPhoto': {
      const isSelected = state.selectedPhotoIds.includes(action.id);
      return {
        ...state,
        selectedPhotoIds: isSelected
          ? state.selectedPhotoIds.filter((sid) => sid !== action.id)
          : [...state.selectedPhotoIds, action.id],
      };
    }

    case 'clearSelection':
      return {
        ...state,
        selectedPhotoIds: [],
      };

    case 'removeSelected':
      return {
        ...state,
        selectedPhotoIds: state.selectedPhotoIds.filter((sid) => sid !== action.id),
      };

    case 'cleanSelection': {
      const validIds = new Set(action.ids);
      return {
        ...state,
        selectedPhotoIds: state.selectedPhotoIds.filter((sid) => validIds.has(sid)),
      };
    }

    case 'resetReview':
      return {
        ...state,
        photos: [],
        currentIndex: 0,
        currentObjects: null,
        currentActions: null,
        isReviewing: false,
      };

    case 'setWordDetail':
      return { ...state, wordDetailWord: action.word };

    case 'setLanguage':
      return { ...state, nativeLang: action.nativeLang, targetLang: action.targetLang };

    case 'setTheme':
      return { ...state, theme: action.theme };

    default:
      return state;
  }
}

interface ReviewContextValue {
  state: ReviewState;
  dispatch: Dispatch<ReviewAction>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reviewReducer, initialState);

  return (
    <ReviewContext.Provider value={{ state, dispatch }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within an AppProvider');
  }
  return context;
}