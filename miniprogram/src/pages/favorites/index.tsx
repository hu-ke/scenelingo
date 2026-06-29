import { useState, useCallback, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Input, Image } from '@tarojs/components';
import { useTheme } from '../../hooks/useTheme';
import FolderPicker from '../../components/FolderPicker';
import './index.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';
const CDN_FAVORITE = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets/favorite';

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
  const [moveTarget, setMoveTarget] = useState<Folder | null>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const firstLoad = useRef(true);

  const loadFolders = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const data = await request<{ folders: Folder[] }>('/api/favorites/folders');
      setFolders(data.folders || []);
    } catch (err) {
      console.error('加载收藏夹失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      loadFolders(true);
    } else {
      loadFolders(false);
    }
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
      itemList: ['重命名', '移动', '删除'],
    }).then((res) => {
      if (res.tapIndex === 0) {
        setRenameTarget(folder);
        setRenameFolderName(folder.name);
        setShowRenameDialog(true);
      } else if (res.tapIndex === 1) {
        setMoveTarget(folder);
        setShowMovePicker(true);
      } else if (res.tapIndex === 2) {
        handleDeleteFolder(folder);
      }
    }).catch(() => {
      // 用户取消
    });
  }, [handleDeleteFolder]);

  const handleMoveFolder = useCallback(async (dest: { folder_id: string; name: string }) => {
    if (!moveTarget) return;
    try {
      await request(`/api/favorites/folders/${moveTarget.folder_id}`, {
        method: 'PUT',
        body: JSON.stringify({ parent_id: dest.folder_id }),
      });
      setShowMovePicker(false);
      setMoveTarget(null);
      Taro.showToast({ title: '移动成功', icon: 'success' });
      await loadFolders();
    } catch {
      Taro.showToast({ title: '移动失败', icon: 'error' });
    }
  }, [moveTarget, loadFolders]);

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
      {/* 顶部 Banner */}
      <View className="favorites-banner">
        <Image
          className="favorites-banner-img"
          src={`${CDN_FAVORITE}/banner.png`}
          mode="aspectFill"
        />
      </View>

      {/* 标题与新建按钮 */}
      <View className="favorites-header">
        <Text className="favorites-title">我的收藏夹</Text>
        <View className="favorites-create-btn" onClick={() => setShowCreateDialog(true)}>
          <Text className="favorites-create-icon">+</Text>
          <Text className="favorites-create-text">新建文件夹</Text>
        </View>
      </View>

      {/* 加载状态 */}
      {loading && (
        <View className="favorites-loading">加载中...</View>
      )}

      {/* 空状态 */}
      {!loading && folders.length === 0 && (
        <View className="favorites-empty">
          <Image
            className="favorites-empty-icon"
            src={`${CDN_FAVORITE}/folder.png`}
            mode="aspectFit"
          />
          <Text className="favorites-empty-text">暂无收藏夹</Text>
          <Text className="favorites-empty-sub">点击上方按钮创建你的第一个收藏夹吧</Text>
        </View>
      )}

      {/* 文件夹列表 */}
      <View className="favorites-list">
        {folders.map((folder) => (
          <View
            className="favorites-item"
            key={folder.folder_id}
            onClick={() => handleFolderTap(folder)}
            onLongPress={() => handleLongPress(folder)}
          >
            <Image
              className="favorites-item-icon"
              src={`${CDN_FAVORITE}/folder.png`}
              mode="aspectFit"
            />
            <Text className="favorites-item-name">{folder.name}</Text>
            <Text className="favorites-item-arrow">›</Text>
          </View>
        ))}
      </View>

      {/* 新建文件夹弹框 */}
      {showCreateDialog && (
        <View className="favorites-dialog-overlay" onClick={handleCancelCreate}>
          <View className="favorites-dialog" onClick={(e) => e.stopPropagation()}>
            {/* 装饰图标 */}
            <View className="favorites-dialog-decor">
              <Image
                className="favorites-dialog-decor-left"
                src={`${CDN_FAVORITE}/branch.png`}
                mode="aspectFit"
              />
              <Image
                className="favorites-dialog-decor-right"
                src={`${CDN_FAVORITE}/grassflower.png`}
                mode="aspectFit"
              />
            </View>

            <Text className="favorites-dialog-title">新建文件夹</Text>

            <Input
              className="favorites-dialog-input"
              value={newFolderName}
              onInput={(e) => setNewFolderName(e.detail.value)}
              placeholder="输入文件夹名称"
              maxlength={20}
              autoFocus
            />

            <View className="favorites-dialog-buttons">
              <View className="favorites-dialog-btn-cancel" onClick={handleCancelCreate}>
                <Text>取消</Text>
              </View>
              <View
                className={`favorites-dialog-btn-confirm ${!newFolderName.trim() ? 'favorites-dialog-btn-disabled' : ''}`}
                onClick={handleCreateFolder}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 重命名弹框 */}
      {showRenameDialog && (
        <View className="favorites-dialog-overlay" onClick={handleCancelRename}>
          <View className="favorites-dialog" onClick={(e) => e.stopPropagation()}>
            <View className="favorites-dialog-decor">
              <Image
                className="favorites-dialog-decor-left"
                src={`${CDN_FAVORITE}/branch.png`}
                mode="aspectFit"
              />
              <Image
                className="favorites-dialog-decor-right"
                src={`${CDN_FAVORITE}/grassflower.png`}
                mode="aspectFit"
              />
            </View>

            <Text className="favorites-dialog-title">重命名文件夹</Text>

            <Input
              className="favorites-dialog-input"
              value={renameFolderName}
              onInput={(e) => setRenameFolderName(e.detail.value)}
              placeholder="输入新名称"
              maxlength={20}
              autoFocus
            />

            <View className="favorites-dialog-buttons">
              <View className="favorites-dialog-btn-cancel" onClick={handleCancelRename}>
                <Text>取消</Text>
              </View>
              <View
                className={`favorites-dialog-btn-confirm ${!renameFolderName.trim() ? 'favorites-dialog-btn-disabled' : ''}`}
                onClick={handleRenameFolder}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 移动文件夹选择器 */}
      <FolderPicker
        visible={showMovePicker}
        title="移动到"
        onClose={() => { setShowMovePicker(false); setMoveTarget(null); }}
        onSelect={handleMoveFolder}
      />
    </View>
  );
}
