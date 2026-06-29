import { useState, useCallback, useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image, Input } from '@tarojs/components';
import FolderPicker from '../../components/FolderPicker';
import './folder.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';
const CDN_FAVORITE = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets/favorite';

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
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState(''); // folder_id 
  const [movePhotoId, setMovePhotoId] = useState(''); // photo_id
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
      itemList: ['重命名', '移动', '删除'],
      success: (res) => {
        const index = res.tapIndex;
        if (index === 0) {
          setRenameTargetId(folder.folder_id);
          setRenameFolderName(folder.name);
          setShowRenameDialog(true);
        } else if (index === 1) {
          setMoveTargetId(folder.folder_id);
          setMovePhotoId('');
          setShowMovePicker(true);
        } else if (index === 2) {
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
      itemList: ['移动', '取消收藏'],
      success: (res) => {
        if (res.tapIndex === 0) {
          setMovePhotoId(photo.photo_id);
          setMoveTargetId('');
          setShowMovePicker(true);
        } else if (res.tapIndex === 1) {
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

  const handleMove = useCallback(async (dest: { folder_id: string; name: string }) => {
    try {
      if (moveTargetId) {
        // 移动文件夹
        await apiRequest(`/api/favorites/folders/${moveTargetId}`, {
          method: 'PUT',
          body: { parent_id: dest.folder_id },
        });
        setSubFolders(prev => prev.filter(f => f.folder_id !== moveTargetId));
      } else if (movePhotoId) {
        // 移动照片
        await apiRequest(`/api/favorites/items/${movePhotoId}`, {
          method: 'PUT',
          body: { target_folder_id: dest.folder_id },
        });
        setPhotos(prev => prev.filter(p => p.photo_id !== movePhotoId));
      }
      setShowMovePicker(false);
      setMoveTargetId('');
      setMovePhotoId('');
      Taro.showToast({ title: '移动成功', icon: 'success' });
    } catch {
      Taro.showToast({ title: '移动失败', icon: 'error' });
    }
  }, [moveTargetId, movePhotoId]);

  return (
    <View className="folder-page">
      <View className="folder-header">
        <View className="folder-back" onClick={handleBack}>
          <Text className="folder-back-text">← 返回</Text>
        </View>
        <Text className="folder-current-name">{folderName}</Text>
      </View>

      <View className="folder-section">
        <View className="folder-section-header">
          <Text className="folder-section-title">子文件夹</Text>
          <View className="folder-section-create" onClick={() => setShowCreateDialog(true)}>
            <Text className="folder-section-create-icon">+</Text>
            <Text className="folder-section-create-text">新建</Text>
          </View>
        </View>

        {loading && subFolders.length === 0 && (
          <View className="folder-empty-hint">加载中...</View>
        )}

        {!loading && subFolders.length === 0 && (
          <View className="folder-empty-hint">暂无子文件夹</View>
        )}

        {subFolders.map((f) => (
          <View
            className="folder-item"
            key={f.folder_id}
            onClick={() => handleSubFolderTap(f)}
            onLongPress={() => handleFolderLongPress(f)}
          >
            <Image
              className="folder-item-icon"
              src={`${CDN_FAVORITE}/folder.png`}
              mode="aspectFit"
            />
            <Text className="folder-item-name">{f.name}</Text>
            <Text className="folder-item-arrow">›</Text>
          </View>
        ))}
      </View>

      <View className="folder-section">
        <View className="folder-section-header">
          <Text className="folder-section-title">收藏图片</Text>
        </View>

        {loading && photos.length === 0 && (
          <View className="folder-empty-state">加载中...</View>
        )}

        {!loading && photos.length === 0 && (
          <View className="folder-empty-state">暂无收藏图片</View>
        )}

        <View className="folder-photo-grid">
          {photos.map((p) => (
            <View
              className="folder-photo-item"
              key={p.photo_id}
              onClick={() => handlePhotoTap(p)}
              onLongPress={() => handlePhotoLongPress(p)}
            >
              <Image src={p.annotated_url || p.original_url} mode="aspectFill" />
            </View>
          ))}
        </View>
      </View>

      {/* 新建子文件夹弹框 */}
      {showCreateDialog && (
        <View className="folder-dialog-overlay" onClick={() => { setShowCreateDialog(false); setNewFolderName(''); }}>
          <View className="folder-dialog" onClick={(e) => e.stopPropagation()}>
            <View className="folder-dialog-decor">
              <Image
                className="folder-dialog-decor-left"
                src={`${CDN_FAVORITE}/branch.png`}
                mode="aspectFit"
              />
              <Image
                className="folder-dialog-decor-right"
                src={`${CDN_FAVORITE}/grassflower.png`}
                mode="aspectFit"
              />
            </View>

            <Text className="folder-dialog-title">新建子文件夹</Text>

            <Input
              className="folder-dialog-input"
              value={newFolderName}
              onInput={(e) => setNewFolderName((e as unknown as { detail: { value: string } }).detail.value)}
              placeholder="请输入文件夹名称"
              maxlength={20}
              focus
            />

            <View className="folder-dialog-buttons">
              <View
                className="folder-dialog-btn-cancel"
                onClick={() => { setShowCreateDialog(false); setNewFolderName(''); }}
              >
                <Text>取消</Text>
              </View>
              <View
                className={`folder-dialog-btn-confirm ${!newFolderName.trim() ? 'folder-dialog-btn-disabled' : ''}`}
                onClick={handleCreateSubFolder}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 重命名弹框 */}
      {showRenameDialog && (
        <View className="folder-dialog-overlay" onClick={() => setShowRenameDialog(false)}>
          <View className="folder-dialog" onClick={(e) => e.stopPropagation()}>
            <View className="folder-dialog-decor">
              <Image
                className="folder-dialog-decor-left"
                src={`${CDN_FAVORITE}/branch.png`}
                mode="aspectFit"
              />
              <Image
                className="folder-dialog-decor-right"
                src={`${CDN_FAVORITE}/grassflower.png`}
                mode="aspectFit"
              />
            </View>

            <Text className="folder-dialog-title">重命名文件夹</Text>

            <Input
              className="folder-dialog-input"
              value={renameFolderName}
              onInput={(e) =>
                setRenameFolderName((e as unknown as { detail: { value: string } }).detail.value)
              }
              placeholder="请输入新名称"
              maxlength={20}
              focus
            />

            <View className="folder-dialog-buttons">
              <View
                className="folder-dialog-btn-cancel"
                onClick={() => setShowRenameDialog(false)}
              >
                <Text>取消</Text>
              </View>
              <View
                className={`folder-dialog-btn-confirm ${!renameFolderName.trim() ? 'folder-dialog-btn-disabled' : ''}`}
                onClick={handleRenameFolder}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 移动选择器 */}
      <FolderPicker
        visible={showMovePicker}
        title="移动到"
        onClose={() => { setShowMovePicker(false); setMoveTargetId(''); setMovePhotoId(''); }}
        onSelect={handleMove}
      />
    </View>
  );
}
