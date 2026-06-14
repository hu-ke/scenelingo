const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8022/scenelingo-service';

export function getApiBaseUrl(): string {
  return BASE_URL;
}

function getToken(): string | null {
  return localStorage.getItem('scene_lingo_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 对于FormData，不设置Content-Type，让浏览器自动处理
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('scene_lingo_token');
    localStorage.removeItem('scene_lingo_email');
    window.location.reload();
    throw new Error('未登录或token已过期');
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error((errData as any).detail || `请求失败 (${res.status})`);
  }

  return res.json();
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

  recognize(formData: FormData) {
    return request<{ objects: any[]; actions?: any[] }>('/api/recognize', {
      method: 'POST',
      body: formData,
    });
  },

  recognizeWithHint(formData: FormData, hint: string) {
    if (hint) {
      formData.append('hint', hint);
    }
    return request<{ objects: any[]; actions?: any[] }>('/api/recognize', {
      method: 'POST',
      body: formData,
    });
  },

  uploadPhoto(formData: FormData) {
    return request<{ success: boolean; photoId: string }>('/api/photos/upload', {
      method: 'POST',
      body: formData,
    });
  },

  uploadPending(formData: FormData) {
    return request<{ photo_id: string; status: string }>('/api/photos/upload-pending', {
      method: 'POST',
      body: formData,
    });
  },

  uploadAnnotated(formData: FormData) {
    return request<{ success: boolean; photoId: string }>('/api/photos/upload-annotated', {
      method: 'POST',
      body: formData,
    });
  },

  listPhotos(startDate?: string, endDate?: string, words?: string[]) {
    // 当有 words 参数时使用 POST，避免 URL 过长
    if (words && words.length > 0) {
      return request<{ photos: any[] }>('/api/photos/list', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate, words }),
      });
    }
    let path = '/api/photos/list';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) path += '?' + params.toString();
    return request<{ photos: any[] }>(path);
  },

  deletePhoto(id: string) {
    return request<{ success: boolean }>(`/api/photos/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
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

  // 用户统计
  getUserStats() {
    return request<{ total_count: number; total_days: number; oldest_date: string | null; all_words: string[] }>('/api/user/stats');
  },
};
