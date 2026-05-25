import Taro from '@tarojs/taro';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

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

  header['Content-Type'] = 'application/json';

  const res = await Taro.request({
    url: `${BASE_URL}${path}`,
    method: (options.method as HttpMethod) || 'GET',
    header,
    data: options.body,
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
        timeout: 60000,
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`识别失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '网络请求失败'));
        },
      });
    });
  },

  uploadPending(imagePath: string) {
    return new Promise<{ photo_id: string; status: string }>((resolve, reject) => {
      const token = getToken();
      Taro.uploadFile({
        url: `${BASE_URL}/api/photos/upload-pending`,
        filePath: imagePath,
        name: 'original',
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        timeout: 30000,
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`上传失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '网络请求失败'));
        },
      });
    });
  },

  uploadAnnotated(imagePath: string, photoId: string) {
    return new Promise<{ success: boolean; photoId: string }>((resolve, reject) => {
      const token = getToken();
      Taro.uploadFile({
        url: `${BASE_URL}/api/photos/upload-annotated`,
        filePath: imagePath,
        name: 'annotated',
        formData: { photo_id: photoId },
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        timeout: 30000,
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`上传标注图失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '网络请求失败'));
        },
      });
    });
  },

  uploadPhoto(annotatedPath: string, metadata: Record<string, unknown>, originalUrl?: string) {
    return new Promise<{ success: boolean; photoId: string }>((resolve, reject) => {
      const token = getToken();
      const formData: Record<string, string> = {
        metadata: JSON.stringify(metadata),
      };
      if (originalUrl) {
        formData.original_url = originalUrl;
      }
      Taro.uploadFile({
        url: `${BASE_URL}/api/photos/upload`,
        filePath: annotatedPath,
        name: 'annotated',
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        formData,
        timeout: 30000,
        success(res) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data));
          } else {
            reject(new Error(`上传失败 (${res.statusCode})`));
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '网络请求失败'));
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

  imageProxy(url: string): string {
    return `${BASE_URL}/api/image/proxy?url=${encodeURIComponent(url)}`;
  },
};

export function getApiBaseUrl(): string {
  return BASE_URL;
}
