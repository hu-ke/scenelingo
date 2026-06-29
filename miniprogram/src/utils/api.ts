import Taro from '@tarojs/taro';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

// 防止多个并行的 401 响应各自触发页面跳转
let _redirectingAfter401 = false;

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
    if (!_redirectingAfter401) {
      _redirectingAfter401 = true;
      Taro.removeStorageSync('scene_lingo_token');
      Taro.removeStorageSync('scene_lingo_user_id');
      Taro.reLaunch({ url: '/pages/home/index' });
    }
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

  wechatLogin(code: string, email?: string) {
    return request<{ token: string; user_id: string; email: string; nativeLang: string; targetLang: string; theme: string }>('/api/auth/wechat-login', {
      method: 'POST',
      body: JSON.stringify({ code, email: email || '' }),
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

  async recognize(nativeLang: string, targetLang: string, imagePath: string, hint?: string, previousObjects?: Record<string, unknown>[], previousActions?: Record<string, unknown>[]) {
    const token = getToken();
    const formData: Record<string, string> = { nativeLang, targetLang };
    if (hint && hint.trim()) {
      formData.hint = hint.trim();
    }
    if (previousObjects && previousObjects.length > 0) {
      formData.previous_objects = JSON.stringify(previousObjects);
    }
    if (previousActions && previousActions.length > 0) {
      formData.previous_actions = JSON.stringify(previousActions);
    }

    // Taro.uploadFile 只接受本地文件路径，如果传入的是远程 URL，需要先下载到本地
    let filePath = imagePath;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      const downloadRes = await Taro.downloadFile({ url: imagePath });
      if (downloadRes.statusCode !== 200) {
        throw new Error(`下载图片失败 (${downloadRes.statusCode})`);
      }
      filePath = downloadRes.tempFilePath;
    }

    return new Promise<{ objects: Record<string, unknown>[] }>((resolve, reject) => {
      Taro.uploadFile({
        url: `${BASE_URL}/api/recognize`,
        filePath,
        name: 'image',
        formData,
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

  listPhotos(startDate?: string, endDate?: string, words?: string[]) {
    // 当有 words 参数时使用 POST，避免 URL 过长
    if (words && words.length > 0) {
      return request<{ photos: Record<string, unknown>[]; oldest_date?: string }>('/api/photos/list', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate, words }),
      });
    }
    let path = '/api/photos/list';
    const params: string[] = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length > 0) path += '?' + params.join('&');
    return request<{ photos: Record<string, unknown>[]; oldest_date?: string }>(path);
  },

  deletePhoto(id: string) {
    return request<{ success: boolean }>(`/api/photos/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  reRecognize(photoId: string, objects: Record<string, unknown>[], actions?: Record<string, unknown>[]) {
    return request<{ success: boolean; photo_id: string }>('/api/photos/re-recognize', {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId, objects, actions: actions || [] }),
    });
  },

  imageProxy(url: string): string {
    return `${BASE_URL}/api/image/proxy?url=${encodeURIComponent(url)}`;
  },

  // 生词本
  listWordbook() {
    return request<{ words: string[] }>('/api/wordbook/list');
  },

  addWordbookWord(word: string) {
    return request<{ success: boolean }>('/api/wordbook/add', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  removeWordbookWord(word: string) {
    return request<{ success: boolean }>('/api/wordbook/remove', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  syncWordbook(words: string[]) {
    return request<{ success: boolean }>('/api/wordbook/sync', {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
  },

  // 已掌握
  listMastered() {
    return request<{ words: string[] }>('/api/mastered/list');
  },

  addMasteredWord(word: string) {
    return request<{ success: boolean }>('/api/mastered/add', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  removeMasteredWord(word: string) {
    return request<{ success: boolean }>('/api/mastered/remove', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  syncMastered(words: string[]) {
    return request<{ success: boolean }>('/api/mastered/sync', {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
  },

  // 用户统计
  getUserStats() {
    return request<{ total_count: number; total_days: number; oldest_date: string | null; all_words: string[] }>('/api/user/stats');
  },

  // 配额相关
  getUserQuota() {
    return request<{ quota: number }>('/api/user/quota');
  },

  shareReward(inviterUserId: string) {
    return request<{ success: boolean; reason?: string; quota_added?: number }>('/api/share/reward', {
      method: 'POST',
      body: JSON.stringify({ inviter_user_id: inviterUserId }),
    });
  },

  getShareRewardInfo() {
    return request<{ reward_quota: number }>('/api/share/reward-info');
  },
};

export function getApiBaseUrl(): string {
  return BASE_URL;
}
