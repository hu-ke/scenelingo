import { createContext, useContext, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';

export interface PhotoItem {
  id: string;
  dataUrl: string;
  annotatedDataUrl?: string;
  objects?: RecognizedObject[];
}

export interface RecognizedObject {
  name: string;
  bbox: [number, number, number, number];
  phonetic: string;
  chinese: string;
  examples: string[];
}

export type AppPage = 'home' | 'review' | 'merge' | 'wordbook' | 'worddetail' | 'login';

export interface ReviewState {
  photos: PhotoItem[];
  currentIndex: number;
  currentObjects: RecognizedObject[] | null;
  isReviewing: boolean;
  savedPhotos: PhotoItem[];
  page: AppPage;
  selectedPhotoIds: string[];
  wordDetailWord: string | null;
}

export type ReviewAction =
  | { type: 'setPhotos'; photos: PhotoItem[] }
  | { type: 'setCurrentObjects'; objects: RecognizedObject[] }
  | { type: 'nextPhoto' }
  | { type: 'saveCurrent'; annotatedDataUrl: string }
  | { type: 'skipCurrent' }
  | { type: 'setSavedPhotos'; photos: PhotoItem[] }
  | { type: 'removeSaved'; id: string }
  | { type: 'setPage'; page: AppPage }
  | { type: 'toggleSelectPhoto'; id: string }
  | { type: 'clearSelection' }
  | { type: 'resetReview' }
  | { type: 'setWordDetail'; word: string | null };

const initialState: ReviewState = {
  photos: [],
  currentIndex: 0,
  currentObjects: null,
  isReviewing: false,
  savedPhotos: [],
  page: 'home',
  selectedPhotoIds: [],
  wordDetailWord: null,
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
      };

    case 'setCurrentObjects':
      return {
        ...state,
        currentObjects: action.objects,
      };

    case 'nextPhoto': {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.photos.length) {
        return {
          ...state,
          isReviewing: false,
          currentObjects: null,
        };
      }
      return {
        ...state,
        currentIndex: nextIndex,
        currentObjects: null,
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

    case 'resetReview':
      return {
        ...state,
        photos: [],
        currentIndex: 0,
        currentObjects: null,
        isReviewing: false,
      };

    case 'setWordDetail':
      return { ...state, wordDetailWord: action.word };

    default:
      return state;
  }
}

interface ReviewContextValue {
  state: ReviewState;
  dispatch: Dispatch<ReviewAction>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
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
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}