import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useReview } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../utils/api'
import { getJSONStorage, setJSONStorage } from '../../utils/storage'
import AnnotatedImage from '../../components/AnnotatedImage'
import WordCard from '../../components/WordCard'
import type { RecognizedObject, PhotoItem } from '../../context/AppContext'
import './index.scss'

const LOCAL_PHOTOS_KEY = 'local_photos'
const MAX_LOCAL_PHOTOS = 10

function mapObjects(raw: Record<string, unknown>[]): RecognizedObject[] {
  return (raw || []).map((obj: Record<string, unknown>) => ({
    name: (obj.name as string) || '',
    bbox: (obj.bbox as [number, number, number, number]) || [0, 0, 0, 0],
    phonetic: (obj.phonetic as string) || '',
    chinese: (obj.native as string) || (obj.chinese as string) || '',
    examples: (obj.examples as string[]) || [],
  }))
}

export default function ReviewPage() {
  const { state, dispatch } = useReview()
  const { state: authState } = useAuth()
  const { photos, isReviewing, nativeLang, targetLang } = state

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const savingRef = useRef(false)
  const savedPhotoIdsRef = useRef<Set<string>>(new Set())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedPhoto = selectedPhotoId
    ? photos.find((p) => p.id === selectedPhotoId) || null
    : null

  const isAllDone = photos.length > 0 && photos.every(
    (p) => p.status === 'completed' || p.status === 'failed'
  )

  const completedCount = photos.filter((p) => p.status === 'completed').length
  const failedCount = photos.filter((p) => p.status === 'failed').length

  const getCanvasTempPath = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      Taro.canvasToTempFilePath({
        canvasId: 'annotated-canvas',
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err),
      })
    })
  }, [])

  const autoSave = useCallback(async (photo: PhotoItem) => {
    if (savingRef.current) return
    savingRef.current = true

    try {
      let annotatedPath = photo.dataUrl
      try {
        annotatedPath = await getCanvasTempPath()
      } catch {
        // use original image if canvas export fails
      }

      if (authState.isLoggedIn) {
        await api.uploadPhoto(photo.dataUrl, annotatedPath, {
          objects: photo.objects,
          nativeLang,
          targetLang,
          photoId: photo.id,
        })
      } else {
        const localPhotos = getJSONStorage<PhotoItem[]>(LOCAL_PHOTOS_KEY, [])
        if (localPhotos.length >= MAX_LOCAL_PHOTOS) {
          Taro.showToast({ title: `本地最多保存${MAX_LOCAL_PHOTOS}张照片`, icon: 'none' })
          savingRef.current = false
          return
        }
        const savedPhoto: PhotoItem = {
          ...photo,
          annotatedDataUrl: annotatedPath,
          collectionDate: new Date().toISOString(),
        }
        localPhotos.push(savedPhoto)
        setJSONStorage(LOCAL_PHOTOS_KEY, localPhotos)
      }

      setSavedCount((prev) => prev + 1)
    } catch {
      // silent fail for auto-save
    } finally {
      savingRef.current = false
    }
  }, [authState.isLoggedIn, nativeLang, targetLang, getCanvasTempPath])

  // Auto-save when photos become completed
  useEffect(() => {
    const newlyCompleted = photos.filter(
      (p) => p.status === 'completed' && p.objects && !savedPhotoIdsRef.current.has(p.id)
    )
    for (const photo of newlyCompleted) {
      savedPhotoIdsRef.current.add(photo.id)
      autoSave(photo)
    }
  }, [photos, autoSave])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()

    const pendingOrProcessing = photos.filter(
      (p) => p.status === 'pending' || p.status === 'processing'
    )
    if (pendingOrProcessing.length === 0) return

    pollingRef.current = setInterval(async () => {
      try {
        const currentPhotos = photos.filter(
          (p) => p.status === 'pending' || p.status === 'processing'
        )
        if (currentPhotos.length === 0) {
          stopPolling()
          return
        }

        const taskIds = currentPhotos.map((p) => p.taskId!).filter(Boolean)
        if (taskIds.length === 0) {
          stopPolling()
          return
        }

        const results = await api.getRecognitionStatusBatch(taskIds)

        for (const r of results) {
          const taskId = r.task_id
          const status = r.status as PhotoItem['status']

          if (status === 'completed' && r.objects) {
            const objects = mapObjects(r.objects)
            dispatch({ type: 'updatePhotoStatus', taskId, status: 'completed', objects })
          } else if (status === 'failed') {
            dispatch({
              type: 'updatePhotoStatus',
              taskId,
              status: 'failed',
              errorMessage: r.error || '识别失败',
            })
          } else {
            dispatch({ type: 'updatePhotoStatus', taskId, status })
          }
        }
      } catch {
        // polling error — keep trying
      }
    }, 5000)
  }, [photos, dispatch, stopPolling])

  // Start/stop polling based on photos status
  useEffect(() => {
    startPolling()
    return () => {
      stopPolling()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart polling when photos change
  useEffect(() => {
    const hasPending = photos.some(
      (p) => p.status === 'pending' || p.status === 'processing'
    )
    if (hasPending) {
      startPolling()
    } else {
      stopPolling()
    }
  }, [photos, startPolling, stopPolling])

  // Navigate back if no photos
  useEffect(() => {
    if (photos.length === 0) {
      Taro.navigateBack()
    }
  }, [photos.length])

  const handleDeletePhoto = useCallback(async (photoId: string, e?: unknown) => {
    (e as { stopPropagation?: () => void })?.stopPropagation?.()

    const confirmRes = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
    })
    if (!confirmRes.confirm) return

    dispatch({ type: 'removePhoto', id: photoId })
  }, [dispatch])

  const handleRetryPhoto = useCallback(async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId)
    if (!photo) return

    try {
      const result = await api.recognizeAsync([photo.dataUrl], nativeLang, targetLang)
      const taskResult = result[0]
      dispatch({
        type: 'updatePhotoStatus',
        taskId: photo.taskId || '',
        status: taskResult.status as PhotoItem['status'],
        newTaskId: taskResult.task_id,
        errorMessage: undefined,
      })
    } catch {
      Taro.showToast({ title: '重新提交失败', icon: 'error' })
    }
  }, [photos, nativeLang, targetLang, dispatch])

  const handlePhotoClick = useCallback((photoId: string) => {
    const photo = photos.find((p) => p.id === photoId)
    if (!photo) return

    if (photo.status === 'completed') {
      setSelectedPhotoId(photoId)
    } else if (photo.status === 'pending' || photo.status === 'processing') {
      Taro.showToast({ title: '正在识别中，请稍候', icon: 'none' })
    } else if (photo.status === 'failed') {
      handleRetryPhoto(photoId)
    }
  }, [photos, handleRetryPhoto])

  const handleViewBack = useCallback(() => {
    setSelectedPhotoId(null)
  }, [])

  const handleViewSkip = useCallback(() => {
    if (!selectedPhoto) return
    dispatch({ type: 'removePhoto', id: selectedPhoto.id })
    setSelectedPhotoId(null)
  }, [selectedPhoto, dispatch])

  const handleViewRetry = useCallback(() => {
    if (!selectedPhoto) return
    handleRetryPhoto(selectedPhoto.id)
    setSelectedPhotoId(null)
  }, [selectedPhoto, handleRetryPhoto])

  const handleBack = useCallback(() => {
    Taro.reLaunch({ url: '/pages/home/index' })
  }, [])

  const handleGoHome = useCallback(() => {
    dispatch({ type: 'resetReview' })
    Taro.reLaunch({ url: '/pages/home/index' })
  }, [dispatch])

  // ---------- Completion View ----------
  if (isAllDone && !isReviewing) {
    return (
      <View className="review-completion">
        <View className="review-completion-card">
          <Text className="review-completion-emoji">🎉</Text>
          <Text className="review-completion-title">全部完成！</Text>

          <View className="review-completion-stats">
            <View className="review-completion-stat">
              <Text className="review-completion-stat-num">{savedCount}</Text>
              <Text className="review-completion-stat-label">已保存</Text>
            </View>
            <View className="review-completion-stat">
              <Text className="review-completion-stat-num">{failedCount}</Text>
              <Text className="review-completion-stat-label">失败</Text>
            </View>
          </View>

          <Button className="review-completion-home-btn" onClick={handleGoHome}>
            返回首页
          </Button>
        </View>
      </View>
    )
  }

  // If all processed but isReviewing is still true, also show completion
  if (isAllDone) {
    return (
      <View className="review-completion">
        <View className="review-completion-card">
          <Text className="review-completion-emoji">🎉</Text>
          <Text className="review-completion-title">全部完成！</Text>

          <View className="review-completion-stats">
            <View className="review-completion-stat">
              <Text className="review-completion-stat-num">{savedCount}</Text>
              <Text className="review-completion-stat-label">已保存</Text>
            </View>
            <View className="review-completion-stat">
              <Text className="review-completion-stat-num">{failedCount}</Text>
              <Text className="review-completion-stat-label">失败</Text>
            </View>
          </View>

          <Button className="review-completion-home-btn" onClick={handleGoHome}>
            返回首页
          </Button>
        </View>
      </View>
    )
  }

  if (photos.length === 0) {
    return null
  }

  // ---------- Detail View ----------
  if (selectedPhoto) {
    return (
      <View className="review-page">
        <View className="review-detail-back">
          <View className="review-detail-back-btn" onClick={handleViewBack}>
            <Text>←</Text>
          </View>
        </View>

        <View className="review-image-area">
          <AnnotatedImage
            dataUrl={selectedPhoto.dataUrl}
            objects={selectedPhoto.objects || []}
          />
        </View>

        {selectedPhoto.objects && selectedPhoto.objects.length > 0 && (
          <View className="review-word-cards">
            {selectedPhoto.objects.map((obj, index) => (
              <View key={index} className="review-word-card-item">
                <WordCard obj={obj} />
              </View>
            ))}
          </View>
        )}

        <View className="review-detail-actions">
          <Button
            className="review-action-btn review-action-btn-retry"
            onClick={handleViewRetry}
          >
            重新识别
          </Button>
          <Button
            className="review-action-btn review-action-btn-skip"
            onClick={handleViewSkip}
          >
            跳过
          </Button>
        </View>
      </View>
    )
  }

  // ---------- Grid View ----------
  const progressText = `${completedCount}/${photos.length} 已完成`
  const progressPercent = photos.length > 0
    ? (completedCount / photos.length) * 100
    : 0

  return (
    <View className="review-page">
      <View className="review-header">
        <View className="review-back-btn" onClick={handleBack}>
          <Text>←</Text>
        </View>

        <View className="review-progress-wrap">
          <Text className="review-progress-text">{progressText}</Text>
          <View className="review-progress-bar">
            <View
              className="review-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>
      </View>

      <View className="review-photo-grid">
        {photos.map((photo) => (
          <View
            key={photo.id}
            className="review-photo-item"
            onClick={() => handlePhotoClick(photo.id)}
          >
            <Image
              className="review-photo-thumb"
              src={photo.dataUrl}
              mode="aspectFill"
            />

            {photo.status === 'pending' && (
              <View className="review-photo-status review-status-pending">
                <View className="review-status-spinner" />
                <Text className="review-status-text">等待中</Text>
              </View>
            )}

            {photo.status === 'processing' && (
              <View className="review-photo-status review-status-processing">
                <View className="review-status-pulse" />
                <Text className="review-status-text">识别中</Text>
              </View>
            )}

            {photo.status === 'completed' && (
              <View className="review-photo-status review-status-completed">
                <View className="review-status-check">
                  <Text style={{ color: '#fff', fontSize: '32rpx' }}>✓</Text>
                </View>
                <Text className="review-status-text">已完成</Text>
              </View>
            )}

            {photo.status === 'failed' && (
              <View
                className="review-photo-status review-status-failed"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRetryPhoto(photo.id)
                }}
              >
                <View className="review-status-cross">
                  <Text style={{ color: '#fff', fontSize: '32rpx' }}>✕</Text>
                </View>
                <Text className="review-status-text">识别失败</Text>
                {photo.errorMessage && (
                  <Text className="review-status-error-text">{photo.errorMessage}</Text>
                )}
                <View className="review-photo-retry">
                  <Text style={{ color: '#e74c3c', fontSize: '22rpx' }}>点击重试</Text>
                </View>
              </View>
            )}

            {(photo.status === 'completed' || photo.status === 'failed') && (
              <View
                className="review-photo-delete"
                onClick={(e) => handleDeletePhoto(photo.id, e)}
              >
                <Text className="review-photo-delete-text">×</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}