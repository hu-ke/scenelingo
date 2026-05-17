import type { PhotoItem, RecognizedObject } from '../context/ReviewContext';

const DB_NAME = 'ImageWordsDB';
const DB_VERSION = 3;
const STORE_NAME = 'photos';

interface PhotoRecord {
  id: string;
  dataUrl: string;
  annotatedDataUrl?: string;
  objects?: RecognizedObject[];
  createdAt: number;
  collectionDate: string;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      }

      if (oldVersion < 2) {
        const store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);

        if (!store.indexNames.contains('collectionDate')) {
          store.createIndex('collectionDate', 'collectionDate', { unique: false });
        }

        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const record = cursor.value;
            if (!record.collectionDate) {
              record.collectionDate = 'earlier';
              cursor.update(record);
            }
            cursor.continue();
          }
        };
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      reject(new Error('Database upgrade blocked'));
    };
  });
}

export function savePhoto(photo: PhotoItem): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: PhotoRecord = {
        id: photo.id,
        dataUrl: photo.dataUrl,
        annotatedDataUrl: photo.annotatedDataUrl,
        objects: photo.objects,
        createdAt: Date.now(),
        collectionDate: formatDate(new Date()),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function getAllPhotos(): Promise<PhotoItem[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as PhotoRecord[];
        records.sort((a, b) => b.createdAt - a.createdAt);
        const photos: PhotoItem[] = records.map((r) => ({
          id: r.id,
          dataUrl: r.dataUrl,
          annotatedDataUrl: r.annotatedDataUrl,
          objects: r.objects,
        }));
        resolve(photos);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function deletePhoto(id: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function clearAllPhotos(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function getPhotosGroupedByDate(): Promise<Record<string, PhotoItem[]>> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as PhotoRecord[];
        const grouped: Record<string, PhotoItem[]> = {};

        for (const record of records) {
          const dateKey = record.collectionDate || 'earlier';
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push({
            id: record.id,
            dataUrl: record.dataUrl,
            annotatedDataUrl: record.annotatedDataUrl,
            objects: record.objects,
          });
        }

        const sortedKeys = Object.keys(grouped)
          .filter(k => k !== 'earlier')
          .sort((a, b) => b.localeCompare(a));

        if (grouped['earlier']) {
          sortedKeys.push('earlier');
        }

        const result: Record<string, PhotoItem[]> = {};
        for (const key of sortedKeys) {
          result[key] = grouped[key];
        }

        resolve(result);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function countPhotos(): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function isLoggedIn(): boolean {
  const token = localStorage.getItem('scene_lingo_token');
  return token !== null && token !== '';
}