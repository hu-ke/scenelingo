const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/scenelingo-service';

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
    return request<{ token: string; email: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  recognize(formData: FormData) {
    return request<{ objects: any[] }>('/api/recognize', {
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

  listPhotos() {
    return request<{ photos: any[] }>('/api/photos/list');
  },

  deletePhoto(id: string) {
    return request<{ success: boolean }>(`/api/photos/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
