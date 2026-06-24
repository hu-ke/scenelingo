import { useState, useCallback, useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image, Input } from '@tarojs/components';
import './folder.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

interface SubFolder {
  folder_id: string;
  name: string;
  parent_id: string;
  created_at: string;
}

interface FolderPhoto {
  photo_id: string;
  original_url: string;
  annotated_url: string;
  collection_date: string;
  created_at: string;
  objects_count: number;
}

function getToken(): string {
  return Taro.getStorageSync('scene_lingo_token') || '';
}

async function apiRequest<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.header as Record<string, string> || {}),
  };

  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  const res = await Taro.request({
    url: `${BASE_URL}${path}`,
    method: (options.method as 'GET' | 'POST' | 'PUT' | 'DELETE') || 'GET',
    header,
    data: options.body,
    ...options,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const errData = res.data as Record<string, unknown> || {};
    throw new Error((errData.detail as string) || `请求失败 (${res.statusCode})`);
  }

  return res.data as T;
}

export default function FolderDetailPage() {
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [subFolders, setSubFolders] = useState<SubFolder[]>([]);
  const [photos, setPhotos] = useState<FolderPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameTargetId, setRenameTargetId] = useState('');
  const initialLoadDone = useRef(false);

  const loadData = useCallback(async () => {
    if (!folderId) return;

    try {
      const [foldersRes, itemsRes] = await Promise.all([
        apiRequest<{ folders: SubFolder[] }>(`/api/favorites/folders?parent_id=${encodeURIComponent(folderId)}`),
        apiRequest<{ photos: FolderPhoto[] }>(`/api/favorites/items?folder_id=${encodeURIComponent(folderId)}`),
      ]);
      setSubFolders(foldersRes.folders || []);
      setPhotos(itemsRes.photos || []);
    } catch (err) {
      console.error('加载文件夹数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    const pages = Taro.getCurrentPages();
    const current = pages[pages.length - 1];
    const params = (current as { options?: Record<string, string> }).options || {};
    const id = params.folder_id || '';
    const name = decodeURIComponent(params.folder_name || '文件夹');
    setFolderId(id);
    setFolderName(name);

    if (id && !initialLoadDone.current) {
      initialLoadDone.current = true;
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (folderId && loading) {
      loadData();
    }
  }, [folderId, loading, loadData]);

  const handleSubFolderTap = useCallback((folder: SubFolder) => {
    Taro.navigateTo({
      url: `/pages/favorites/folder?folder_id=${folder.folder_id}&folder_name=${encodeURIComponent(folder.name)}`,
    });
  }, []);

  const handleFolderLongPress = useCallback((folder: SubFolder) => {
    Taro.showActionSheet({
      itemList: ['重命名', '删除'],
      success: (res) => {
        const index = res.tapIndex;
        if (index === 0) {
          // 重命名
          setRenameTargetId(folder.folder_id);
          setRenameFolderName(folder.name);
          setShowRenameDialog(true);
        } else if (index === 1) {
          // 删除
          Taro.showModal({
            title: '确认删除',
            content: `确定要删除文件夹「${folder.name}」吗？子文件夹和其中的图片也会被删除。`,
            success: async (modalRes) => {
              if (!modalRes.confirm) return;
              try {
                await apiRequest(`/api/favorites/folders/${folder.folder_id}`, {
                  method: 'DELETE',
                });
                Taro.showToast({ title: '已删除', icon: 'success' });
                setSubFolders((prev) => prev.filter((f) => f.folder_id !== folder.folder_id));
              } catch {
                Taro.showToast({ title: '删除失败', icon: 'error' });
              }
            },
          });
        }
      },
    });
  }, []);

  const handleCreateSubFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      Taro.showToast({ title: '请输入文件夹名称', icon: 'none' });
      return;
    }

    try {
      const newFolder = await apiRequest<SubFolder>('/api/favorites/folders', {
        method: 'POST',
        body: { name, parent_id: folderId },
      });
      setSubFolders((prev) => [...prev, newFolder]);
      setShowCreateDialog(false);
      setNewFolderName('');
      Taro.showToast({ title: '创建成功', icon: 'success' });
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'error' });
    }
  }, [newFolderName, folderId]);

  const handleRenameFolder = useCallback(async () => {
    const name = renameFolderName.trim();
    if (!name) {
      Taro.showToast({ title: '请输入文件夹名称', icon: 'none' });
      return;
    }

    try {
      await apiRequest(`/api/favorites/folders/${renameTargetId}`, {
        method: 'PUT',
        body: { name },
      });
      setSubFolders((prev) =>
        prev.map((f) => (f.folder_id === renameTargetId ? { ...f, name } : f)),
      );
      setShowRenameDialog(false);
      Taro.showToast({ title: '重命名成功', icon: 'success' });
    } catch {
      Taro.showToast({ title: '重命名失败', icon: 'error' });
    }
  }, [renameFolderName, renameTargetId]);

  const handlePhotoTap = useCallback((photo: FolderPhoto) => {
    Taro.previewImage({
      urls: [photo.annotated_url || photo.original_url],
    });
  }, []);

  const handlePhotoLongPress = useCallback((photo: FolderPhoto) => {
    Taro.showActionSheet({
      itemList: ['取消收藏'],
      success: (res) => {
        if (res.tapIndex === 0) {
          Taro.showModal({
            title: '确认取消收藏',
            content: '确定要从收藏夹中移除这张图片吗？',
            success: async (modalRes) => {
              if (!modalRes.confirm) return;
              try {
                await apiRequest('/api/favorites/items', {
                  method: 'DELETE',
                  body: { folder_id: folderId, photo_id: photo.photo_id },
                });
                Taro.showToast({ title: '已移除', icon: 'success' });
                setPhotos((prev) => prev.filter((p) => p.photo_id !== photo.photo_id));
              } catch {
                Taro.showToast({ title: '移除失败', icon: 'error' });
              }
            },
          });
        }
      },
    });
  }, [folderId]);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return (
    <View className="folder-page">
      <View className="folder-header">
        <View className="breadcrumb" onClick={handleBack}>
          <Text className="breadcrumb-text">← 返回</Text>
        </View>
        <Text className="current-folder-name">{folderName}</Text>
      </View>

      <View className="section-header">
        <Text className="section-title">子文件夹</Text>
        <Text className="create-btn" onClick={() => setShowCreateDialog(true)}>
          + 新建
        </Text>
      </View>

      {loading && subFolders.length === 0 && (
        <View className="empty-hint">加载中...</View>
      )}

      {!loading && subFolders.length === 0 && (
        <View className="empty-hint">暂无子文件夹</View>
      )}

      {subFolders.map((f) => (
        <View
          className="folder-item"
          key={f.folder_id}
          onClick={() => handleSubFolderTap(f)}
          onLongPress={() => handleFolderLongPress(f)}
        >
          <Text className="folder-icon">📁</Text>
          <Text className="folder-name">{f.name}</Text>
          <Text className="folder-arrow">›</Text>
        </View>
      ))}

      <View className="section-header">
        <Text className="section-title">收藏图片</Text>
      </View>

      {loading && photos.length === 0 && (
        <View className="empty-state">加载中...</View>
      )}

      {!loading && photos.length === 0 && (
        <View className="empty-state">暂无收藏图片</View>
      )}

      <View className="photo-grid">
        {photos.map((p) => (
          <View
            className="photo-item"
            key={p.photo_id}
            onClick={() => handlePhotoTap(p)}
            onLongPress={() => handlePhotoLongPress(p)}
          >
            <Image src={p.annotated_url || p.original_url} mode="aspectFill" />
          </View>
        ))}
      </View>

      {/* Create folder dialog */}
      {showCreateDialog && (
        <View className="dialog-overlay" onClick={() => setShowCreateDialog(false)}>
          <View className="dialog" onClick={(e) => e.stopPropagation()}>
            <Text className="dialog-title">新建子文件夹</Text>
            <Input
              className="dialog-input"
              value={newFolderName}
              onInput={(e) => setNewFolderName((e as unknown as { detail: { value: string } }).detail.value)}
              placeholder="请输入文件夹名称"
              focus
            />
            <View className="dialog-buttons">
              <View
                className="dialog-btn dialog-btn-cancel"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewFolderName('');
                }}
              >
                取消
              </View>
              <View className="dialog-btn dialog-btn-confirm" onClick={handleCreateSubFolder}>
                确定
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Rename folder dialog */}
      {showRenameDialog && (
        <View className="dialog-overlay" onClick={() => setShowRenameDialog(false)}>
          <View className="dialog" onClick={(e) => e.stopPropagation()}>
            <Text className="dialog-title">重命名文件夹</Text>
            <Input
              className="dialog-input"
              value={renameFolderName}
              onInput={(e) =>
                setRenameFolderName((e as unknown as { detail: { value: string } }).detail.value)
              }
              placeholder="请输入新名称"
              focus
            />
            <View className="dialog-buttons">
              <View
                className="dialog-btn dialog-btn-cancel"
                onClick={() => setShowRenameDialog(false)}
              >
                取消
              </View>
              <View className="dialog-btn dialog-btn-confirm" onClick={handleRenameFolder}>
                确定
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
