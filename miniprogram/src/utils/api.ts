import { useCallback } from 'react';
import Taro from '@tarojs/taro';

const BASE_URL = 'http://localhost:8022/scenelingo-service';

function getToken(): string {
  return Taro.getStorageSync('scene_lingo_token') || '';
}

async function request<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();
  const header: Record<string, string> = {
    ...(options.header as Record<string, string> || {}),
  };

  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    header['Content-Type'] = 'application/json';
  }

  const res = await Taro.request({
    url: `${BASE_URL}${path}`,
    method: (options.method as string) || 'GET',
    header,
    data: options.body instanceof FormData ? undefined : options.body,
    ...options,
  });

  if (res.statusCode === 401) {
    Taro.removeStorageSync('scene_lingo_token');
    Taro.removeStorageSync('scene_lingo_email');
    Taro.reLaunch({ url: '/pages/login/index' });
    throw new Error('未登录或token已过期');
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const errData = res.data as Record<string, unknown> || {};
    throw new Error((errData.detail as string) || `请求失败 (${res.statusCode})`);
  }

  return res.data as T;
}

export const api = {
  sendCode(email: string) {
    return request<{ success: boolean; message: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verify(email: string, code: string) {
    return request<{ token: string; email: string; nativeLang: string; targetLang: string; theme: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  updateLanguage(nativeLang: string, targetLang: string) {
    return request<{ success: boolean }>('/api/user/language', {
      method: 'POST',
      body: JSON.stringify({ nativeLang, targetLang }),
    });
  },

  updateTheme(themeId: string) {
    return request<{ success: boolean }>('/api/user/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: themeId }),
    });
  },

  recognize(nativeLang: string, targetLang: string, imagePath: string) {
    return new Promise<{ objects: Record<string, unknown>[] }>((resolve, reject) => {
      const token = getToken();
      Taro.uploadFile({
        url: `${BASE_URL}/api/recognize`,
        filePath: imagePath,
        name: 'image',
        formData: { nativeLang, targetLang },
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`识别失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(err);
        },
      });
    });
  },

  recognizeAsync(imagePaths: string[], nativeLang: string, targetLang: string) {
    const token = getToken();
    const uploadSingle = (imagePath: string) =>
      new Promise<{ task_id: string; status: string }>((resolve, reject) => {
        Taro.uploadFile({
          url: `${BASE_URL}/api/recognize/async`,
          filePath: imagePath,
          name: 'images',
          formData: { nativeLang, targetLang },
          header: token ? { 'Authorization': `Bearer ${token}` } : {},
          success(res) {
            if (res.statusCode === 200) {
              resolve(JSON.parse(res.data));
            } else {
              reject(new Error(`异步识别提交失败 (${res.statusCode})`));
            }
          },
          fail(err) {
            reject(err);
          },
        });
      });

    return Promise.all(imagePaths.map(uploadSingle));
  },

  getRecognitionStatus(taskId: string) {
    return request<{ task_id: string; status: string; objects?: Record<string, unknown>[]; error?: string }>(`/api/recognize/status/${taskId}`);
  },

  getRecognitionStatusBatch(taskIds: string[]) {
    return request<Array<{ task_id: string; status: string; objects?: Record<string, unknown>[]; error?: string }>>('/api/recognize/status/batch', {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds }),
    });
  },

  uploadPhoto(originalPath: string, annotatedPath: string, metadata: Record<string, unknown>) {
    return new Promise<{ success: boolean; photoId: string }>((resolve, reject) => {
      const token = getToken();
      Taro.uploadFile({
        url: `${BASE_URL}/api/photos/upload`,
        filePath: annotatedPath,
        name: 'annotated',
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        formData: {
          metadata: JSON.stringify(metadata),
        },
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`上传失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(err);
        },
      });
    });
  },

  listPhotos() {
    return request<{ photos: Record<string, unknown>[] }>('/api/photos/list');
  },

  deletePhoto(id: string) {
    return request<{ success: boolean }>(`/api/photos/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

export { BASE_URL, getToken, useCallback as useCallbackFn };