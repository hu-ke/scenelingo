import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service'
const CDN_FAVORITE = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets/favorite'

interface FolderItem {
  folder_id: string
  name: string
}

interface FolderPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (folder: { folder_id: string; name: string }) => void
  title?: string
}

function getToken(): string {
  return Taro.getStorageSync('scene_lingo_token') || ''
}

async function fetchFolders(parentId?: string): Promise<FolderItem[]> {
  const token = getToken()
  const url = parentId
    ? `${BASE_URL}/api/favorites/folders?parent_id=${encodeURIComponent(parentId)}`
    : `${BASE_URL}/api/favorites/folders`

  const res = await Taro.request({
    url,
    method: 'GET',
    header: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error('获取文件夹失败')
  }

  const data = res.data as { folders?: FolderItem[] }
  return data.folders || []
}

async function createFolder(name: string, parentId?: string): Promise<FolderItem> {
  const token = getToken()
  const body: Record<string, string> = { name }
  if (parentId) {
    body.parent_id = parentId
  }

  const res = await Taro.request({
    url: `${BASE_URL}/api/favorites/folders`,
    method: 'POST',
    header: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error('创建文件夹失败')
  }

  return (res.data as { folder: FolderItem }).folder
}

export default function FolderPicker({ visible, onClose, onSelect, title }: FolderPickerProps) {
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [currentPath, setCurrentPath] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const currentParentId = currentPath.length > 0
    ? currentPath[currentPath.length - 1].folder_id
    : undefined

  const loadFolders = useCallback(async (parentId?: string) => {
    setLoading(true)
    try {
      const list = await fetchFolders(parentId)
      setFolders(list)
    } catch {
      Taro.showToast({ title: '加载文件夹失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      setCurrentPath([])
      setNewFolderName('')
      setShowNewInput(false)
      loadFolders()
    }
  }, [visible, loadFolders])

  const navigateInto = useCallback((folder: FolderItem) => {
    setCurrentPath(prev => [...prev, folder])
    loadFolders(folder.folder_id)
  }, [loadFolders])

  const goToPathIndex = useCallback((index: number) => {
    const newPath = currentPath.slice(0, index + 1)
    setCurrentPath(newPath)
    const parentId = newPath.length > 0 ? newPath[newPath.length - 1].folder_id : undefined
    loadFolders(parentId)
  }, [currentPath, loadFolders])

  const goToRoot = useCallback(() => {
    setCurrentPath([])
    loadFolders()
  }, [loadFolders])

  const handleNewFolder = useCallback(() => {
    setShowNewInput(true)
    setNewFolderName('')
  }, [])

  const handleCreateConfirm = useCallback(async () => {
    const name = newFolderName.trim()
    if (!name) {
      Taro.showToast({ title: '请输入文件夹名称', icon: 'none' })
      return
    }

    try {
      const folder = await createFolder(name, currentParentId)
      setShowNewInput(false)
      setNewFolderName('')
      loadFolders(currentParentId)
      setFolders(prev => [...prev, folder])
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' })
    }
  }, [newFolderName, currentParentId, loadFolders])

  const handleSelect = useCallback((folder: FolderItem) => {
    onSelect(folder)
  }, [onSelect])

  if (!visible) return null

  return (
    <View className="folder-picker-overlay" onClick={onClose}>
      <View className="folder-picker" onClick={(e) => e.stopPropagation()}>
        <View className="picker-header">
          <Text className="picker-cancel" onClick={onClose}>取消</Text>
          <Text className="picker-title">{title || '选择收藏夹'}</Text>
          <Text className="picker-new" onClick={handleNewFolder}>+ 新建</Text>
        </View>

        {showNewInput && (
          <View className="picker-new-input-wrap">
            <Input
              className="picker-new-input"
              value={newFolderName}
              onInput={(e) => setNewFolderName(e.detail.value)}
              placeholder="输入文件夹名称"
              focus
              maxlength={20}
            />
            <Text className="picker-new-confirm" onClick={handleCreateConfirm}>确定</Text>
            <Text className="picker-new-cancel" onClick={() => { setShowNewInput(false); setNewFolderName(''); }}>取消</Text>
          </View>
        )}

        {/* Breadcrumbs */}
        <View className="picker-breadcrumb">
          <Text className="picker-breadcrumb-item" onClick={goToRoot}>根目录</Text>
          {currentPath.map((f, i) => (
            <Text key={f.folder_id} className="picker-breadcrumb-item" onClick={() => goToPathIndex(i)}>
              {' / '}{f.name}
            </Text>
          ))}
        </View>

        {/* Folder list */}
        <ScrollView className="picker-list" scrollY>
          {loading ? (
            <View className="picker-loading">
              <Text>加载中...</Text>
            </View>
          ) : (
            <>
              {folders.map(f => (
                <View className="picker-item" key={f.folder_id}>
                  <View className="picker-item-content" onClick={() => navigateInto(f)}>
                    <Image
                      className="picker-item-icon-img"
                      src={`${CDN_FAVORITE}/folder.png`}
                      mode="aspectFit"
                    />
                    <Text className="picker-item-name">{f.name}</Text>
                    <Text className="picker-item-arrow">›</Text>
                  </View>
                  <View className="picker-select" onClick={() => handleSelect(f)}>
                    <Text>选择</Text>
                  </View>
                </View>
              ))}
              {folders.length === 0 && !loading && (
                <Text className="picker-empty">暂无文件夹，请先新建</Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  )
}
