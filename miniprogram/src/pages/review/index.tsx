import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useReview } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../utils/api'
import { getJSONStorage, setJSONStorage } from '../../utils/storage'
import AnnotatedImage from '../../components/AnnotatedImage'
import WordCard from '../../components/WordCard'
import { useTheme } from '../../hooks/useTheme'
import type { RecognizedObject, PhotoItem } from '../../context/AppContext'
import './index.scss'

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
  const themeStyle = useTheme()
  const { state, dispatch } = useReview()
  const { state: authState } = useAuth()
  const { photos, currentIndex, currentObjects, isReviewing, nativeLang, targetLang } = state

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const lastRecognizedRef = useRef(-1)

  const currentPhoto = photos[currentIndex]

  const recognizeImage = useCallback(async () => {
    if (!currentPhoto) return

    setLoading(true)
    setError(null)

    try {
      const data = await api.recognize(nativeLang, targetLang, currentPhoto.dataUrl)
      const objects = mapObjects(data.objects)
      dispatch({ type: 'setCurrentObjects', objects })
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setLoading(false)
    }
  }, [currentPhoto, dispatch, nativeLang, targetLang])

  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length && lastRecognizedRef.current !== currentIndex) {
      lastRecognizedRef.current = currentIndex
      if (currentPhoto?.objects && currentPhoto.objects.length > 0) {
        dispatch({ type: 'setCurrentObjects', objects: currentPhoto.objects })
        return
      }
      recognizeImage()
    }
  }, [currentIndex, photos.length, recognizeImage, photos, dispatch])

  const handleDownload = useCallback(async () => {
    if (!currentPhoto) return

    let annotatedPath = currentPhoto.dataUrl
    try {
      annotatedPath = await new Promise<string>((resolve, reject) => {
        Taro.canvasToTempFilePath({
          canvasId: 'annotated-canvas',
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err),
        })
      })
    } catch {
    }

    let saveToAlbumSuccess = false
    try {
      const authResult = await Taro.getSetting()
      if (!authResult.authSetting['scope.writePhotosAlbum']) {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' })
      }
      await Taro.saveImageToPhotosAlbum({ filePath: annotatedPath })
      saveToAlbumSuccess = true
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e: unknown) {
      const errMsg = (e as { errMsg?: string })?.errMsg || ''
      if (errMsg.includes('auth deny')) {
        Taro.showModal({
          title: '提示',
          content: '需要相册权限才能保存图片，请在小程序设置中开启',
          showCancel: false,
        })
      } else {
        Taro.showToast({ title: '保存到相册失败', icon: 'none' })
      }
    }

    if (!authState.isLoggedIn) {
      const localPhotos = getJSONStorage<PhotoItem[]>('saved_photos', [])
      if (localPhotos.length >= MAX_LOCAL_PHOTOS) {
        setShowLoginPrompt(true)
        dispatch({ type: 'nextPhoto' })
        return
      }
      const savedPhoto: PhotoItem = {
        ...currentPhoto,
        annotatedDataUrl: currentPhoto.annotatedDataUrl,
        objects: currentObjects ?? undefined,
      }
      localPhotos.push(savedPhoto)
      setJSONStorage('saved_photos', localPhotos)
    } else {
      try {
        await api.uploadPending(currentPhoto.dataUrl)
        await api.uploadPhoto(annotatedPath, {
          objects: currentObjects,
          nativeLang,
          targetLang,
          id: currentPhoto.id,
          collectionDate: new Date().toISOString().split('T')[0],
          createdAt: Date.now(),
        })
      } catch {
        if (saveToAlbumSuccess) {
          Taro.showToast({ title: '已保存到相册', icon: 'success' })
        }
      }
    }

    dispatch({ type: 'nextPhoto' })
  }, [currentPhoto, currentObjects, authState.isLoggedIn, dispatch, nativeLang, targetLang])

  const handleBack = useCallback(() => {
    dispatch({ type: 'resetReview' })
    Taro.reLaunch({ url: '/pages/home/index' })
  }, [dispatch])

  if (!isReviewing && photos.length > 0) {
    return (
      <View className="review-page">
        <View className="review-back-btn" onClick={handleBack}>
          <Text>←</Text>
        </View>
        <View className="review-completion">
          <Text className="review-completion-emoji">🎉</Text>
          <Text className="review-completion-title">全部完成！</Text>
          <Button className="review-completion-home-btn" onClick={handleBack}>
            返回首页
          </Button>
        </View>
      </View>
    )
  }

  if (photos.length === 0) {
    return null
  }

  return (
    <View className="review-page" style={themeStyle}>
      <View className="review-back-btn" onClick={handleBack}>
        <Text>←</Text>
      </View>

      <View className="review-progress">
        <View className="review-progress-bar">
          <View
            className="review-progress-fill"
            style={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
          />
        </View>
        <Text className="review-progress-text">
          {currentIndex + 1}/{photos.length}
        </Text>
      </View>

      <View className="review-card">
        {loading ? (
          <View className="review-loading">
            <View className="review-spinner" />
            <Text className="review-loading-text">正在识别...</Text>
          </View>
        ) : error ? (
          <View className="review-error">
            <Text className="review-error-text">{error}</Text>
            <Button className="review-retry-btn" onClick={recognizeImage}>
              重试
            </Button>
          </View>
        ) : currentObjects ? (
          <AnnotatedImage
            dataUrl={currentPhoto.dataUrl}
            objects={currentObjects}
          />
        ) : null}
      </View>

      {currentObjects && currentObjects.length > 0 && (
        <View className="review-word-cards">
          {currentObjects.map((obj, idx) => (
            <View key={idx} className="review-word-card-item">
              <WordCard obj={obj} />
            </View>
          ))}
        </View>
      )}

      <View className="review-actions">
        <Button onClick={recognizeImage} disabled={loading}>
          {loading ? '识别中...' : '重新识别'}
        </Button>
        <Button onClick={handleDownload} disabled={loading || !currentObjects}>
          下载
        </Button>
      </View>

      {showLoginPrompt && (
        <View className="review-login-prompt-mask" onClick={() => setShowLoginPrompt(false)}>
          <View className="review-login-prompt-card" onClick={(e: unknown) => (e as { stopPropagation?: () => void })?.stopPropagation?.()}>
            <Text className="review-login-prompt-icon">🔒</Text>
            <Text className="review-login-prompt-title">本地最多保存10张照片</Text>
            <Text className="review-login-prompt-desc">登录后可无限存储，还能跨设备同步哦~</Text>
            <Button onClick={() => { Taro.navigateTo({ url: '/pages/login/index' }); setShowLoginPrompt(false); }}>
              去登录
            </Button>
            <Button onClick={() => setShowLoginPrompt(false)}>暂不登录</Button>
          </View>
        </View>
      )}
    </View>
  )
}
