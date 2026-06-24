import { useState, useCallback } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Input, Button } from '@tarojs/components';
import { useTheme } from '../../hooks/useTheme';
import './index.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

function getToken(): string {
  return Taro.getStorageSync('scene_lingo_token') || '';
}

interface Folder {
  folder_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
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
    method: (options.method as 'GET' | 'POST' | 'PUT' | 'DELETE') || 'GET',
    header,
    data: options.body,
  });

  if (res.statusCode === 401) {
    Taro.removeStorageSync('scene_lingo_token');
    Taro.removeStorageSync('scene_lingo_user_id');
    Taro.reLaunch({ url: '/pages/home/index' });
    throw new Error('未登录或token已过期');
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const errData = res.data as Record<string, unknown> || {};
    throw new Error((errData.detail as string) || `请求失败 (${res.statusCode})`);
  }

  return res.data as T;
}

export default function FavoritesPage() {
  const themeStyle = useTheme();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await request<{ folders: Folder[] }>('/api/favorites/folders');
      setFolders(data.folders || []);
    } catch (err) {
      console.error('加载收藏夹失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    loadFolders();
  });

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      await request('/api/favorites/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parent_id: null }),
      });
      setShowCreateDialog(false);
      setNewFolderName('');
      await loadFolders();
    } catch (err) {
      Taro.showToast({ title: '创建失败', icon: 'error' });
    }
  }, [newFolderName, loadFolders]);

  const handleRenameFolder = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameFolderName.trim();
    if (!name) return;

    try {
      await request(`/api/favorites/folders/${renameTarget.folder_id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      setShowRenameDialog(false);
      setRenameTarget(null);
      setRenameFolderName('');
      await loadFolders();
    } catch (err) {
      Taro.showToast({ title: '重命名失败', icon: 'error' });
    }
  }, [renameTarget, renameFolderName, loadFolders]);

  const handleDeleteFolder = useCallback(async (folder: Folder) => {
    const confirmRes = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除文件夹「${folder.name}」吗？文件夹内的所有收藏也将被删除。`,
    });
    if (!confirmRes.confirm) return;

    try {
      await request(`/api/favorites/folders/${folder.folder_id}`, {
        method: 'DELETE',
      });
      await loadFolders();
      Taro.showToast({ title: '已删除', icon: 'success' });
    } catch (err) {
      Taro.showToast({ title: '删除失败', icon: 'error' });
    }
  }, [loadFolders]);

  const handleFolderTap = useCallback((folder: Folder) => {
    Taro.navigateTo({
      url: `/pages/favorites/folder?folder_id=${folder.folder_id}&folder_name=${encodeURIComponent(folder.name)}`,
    });
  }, []);

  const handleLongPress = useCallback((folder: Folder) => {
    Taro.showActionSheet({
      itemList: ['重命名', '删除'],
    }).then((res) => {
      if (res.tapIndex === 0) {
        setRenameTarget(folder);
        setRenameFolderName(folder.name);
        setShowRenameDialog(true);
      } else if (res.tapIndex === 1) {
        handleDeleteFolder(folder);
      }
    }).catch(() => {
      // 用户取消
    });
  }, [handleDeleteFolder]);

  const handleCancelCreate = useCallback(() => {
    setShowCreateDialog(false);
    setNewFolderName('');
  }, []);

  const handleCancelRename = useCallback(() => {
    setShowRenameDialog(false);
    setRenameTarget(null);
    setRenameFolderName('');
  }, []);

  return (
    <View className="favorites-page" style={themeStyle}>
      <View className="favorites-header">
        <Text>我的收藏夹</Text>
        <View className="create-btn" onClick={() => setShowCreateDialog(true)}>
          <Text>+ 新建文件夹</Text>
        </View>
      </View>

      {loading && (
        <View className="loading-state">加载中...</View>
      )}

      {!loading && folders.length === 0 && (
        <View className="empty-state">暂无收藏夹，点击上方按钮创建一个吧</View>
      )}

      <View className="folder-list">
        {folders.map((folder) => (
          <View
            className="folder-item"
            key={folder.folder_id}
            onClick={() => handleFolderTap(folder)}
            onLongPress={() => handleLongPress(folder)}
          >
            <Text className="folder-icon">📁</Text>
            <Text className="folder-name">{folder.name}</Text>
            <Text className="folder-arrow">›</Text>
          </View>
        ))}
      </View>

      {showCreateDialog && (
        <View className="dialog-overlay" onClick={handleCancelCreate}>
          <View className="dialog" onClick={(e) => e.stopPropagation()}>
            <Text className="dialog-title">新建文件夹</Text>
            <Input
              className="dialog-input"
              value={newFolderName}
              onInput={(e) => setNewFolderName(e.detail.value)}
              placeholder="输入文件夹名称"
              autoFocus
            />
            <View className="dialog-buttons">
              <Button className="dialog-btn" onClick={handleCancelCreate}>取消</Button>
              <Button
                className="dialog-btn dialog-btn-primary"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                确定
              </Button>
            </View>
          </View>
        </View>
      )}

      {showRenameDialog && (
        <View className="dialog-overlay" onClick={handleCancelRename}>
          <View className="dialog" onClick={(e) => e.stopPropagation()}>
            <Text className="dialog-title">重命名文件夹</Text>
            <Input
              className="dialog-input"
              value={renameFolderName}
              onInput={(e) => setRenameFolderName(e.detail.value)}
              placeholder="输入新名称"
              autoFocus
            />
            <View className="dialog-buttons">
              <Button className="dialog-btn" onClick={handleCancelRename}>取消</Button>
              <Button
                className="dialog-btn dialog-btn-primary"
                onClick={handleRenameFolder}
                disabled={!renameFolderName.trim()}
              >
                确定
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
