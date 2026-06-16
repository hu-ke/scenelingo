import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Button, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useReview } from '../../context/AppContext'
import { api } from '../../utils/api'
import AnnotatedImage from '../../components/AnnotatedImage'
import WordCard from '../../components/WordCard'
import { getWordbookWords } from '../../utils/wordMastery'
import { useTheme } from '../../hooks/useTheme'
import type { RecognizedObject, RecognizedAction } from '../../context/AppContext'
import './index.scss'

function mapObjects(raw: Record<string, unknown>[]): RecognizedObject[] {
  return (raw || []).map((obj: Record<string, unknown>) => ({
    name: (obj.name as string) || '',
    bbox: (obj.bbox as [number, number, number, number]) || [0, 0, 0, 0],
    phonetic: (obj.phonetic as string) || '',
    chinese: (obj.native as string) || (obj.chinese as string) || '',
    examples: (obj.examples as string[]) || [],
    romaji: obj.romaji as string | undefined,
  }))
}

function mapActions(raw: Record<string, unknown>[]): RecognizedAction[] {
  return (raw || []).map((act: Record<string, unknown>) => ({
    name: (act.name as string) || '',
    phonetic: (act.phonetic as string) || '',
    chinese: (act.native as string) || (act.chinese as string) || '',
    examples: (act.examples as string[]) || [],
    romaji: act.romaji as string | undefined,
  }))
}

export default function ReviewPage() {
  const themeStyle = useTheme()
  const { state, dispatch } = useReview()
  const { photos, currentIndex, currentObjects, currentActions, isReviewing, nativeLang, targetLang } = state

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReRecognizeDialog, setShowReRecognizeDialog] = useState(false)
  const [reRecognizeHint, setReRecognizeHint] = useState('')
  const [wordbookWords, setWordbookWords] = useState<string[]>([])
  const [canvasKey, setCanvasKey] = useState(0)
  const lastRecognizedRef = useRef(-1)
  const currentObjectsRef = useRef(currentObjects)
  const currentActionsRef = useRef(currentActions)

  // 同步 ref，避免 recognizeImage 的依赖变化导致 useEffect 重复触发
  useEffect(() => {
    currentObjectsRef.current = currentObjects
    currentActionsRef.current = currentActions
  }, [currentObjects, currentActions])

  const currentPhoto = photos[currentIndex]

  // 加载生词本列表
  useEffect(() => {
    getWordbookWords().then(setWordbookWords)
  }, [])

  const recognizeImage = useCallback(async (hint?: string) => {
    if (!currentPhoto) return

    setLoading(true)
    setError(null)

    try {
      // 如果有 hint 且已有识别结果，把当前结果作为上下文传给 AI
      const prevObjects = hint ? (currentObjectsRef.current || undefined) : undefined
      const prevActions = hint ? (currentActionsRef.current || undefined) : undefined
      const data = await api.recognize(nativeLang, targetLang, currentPhoto.dataUrl, hint, prevObjects, prevActions)
      const objects = mapObjects(data.objects)
      const actions = data.actions && data.actions.length > 0 ? mapActions(data.actions) : undefined

      dispatch({ type: 'setCurrentObjects', objects })
      if (actions) {
        dispatch({ type: 'setCurrentActions', actions })
      }

      // 持久化到数据库，同时更新本地 photos 数组
      if (currentPhoto.id) {
        const rawObjects = data.objects as Record<string, unknown>[]
        const rawActions = data.actions as Record<string, unknown>[] | undefined
        api.reRecognize(currentPhoto.id, rawObjects, rawActions).catch((err) => {
          console.error('reRecognize 持久化失败:', err)
        })
        dispatch({
          type: 'updatePhotoObjects',
          index: currentIndex,
          objects,
          actions,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setLoading(false)
    }
  }, [currentPhoto, currentIndex, dispatch, nativeLang, targetLang])

  const handleReRecognize = useCallback(() => {
    setShowReRecognizeDialog(true)
  }, [])

  const handleReRecognizeConfirm = useCallback(() => {
    setShowReRecognizeDialog(false)
    setCanvasKey(k => k + 1)
    recognizeImage(reRecognizeHint.trim() || undefined)
    setReRecognizeHint('')
  }, [recognizeImage, reRecognizeHint])

  const handleReRecognizeSkip = useCallback(() => {
    setShowReRecognizeDialog(false)
    setCanvasKey(k => k + 1)
    recognizeImage()
    setReRecognizeHint('')
  }, [recognizeImage])

  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length && lastRecognizedRef.current !== currentIndex) {
      lastRecognizedRef.current = currentIndex
      if (currentPhoto?.objects && currentPhoto.objects.length > 0) {
        dispatch({ type: 'setCurrentObjects', objects: currentPhoto.objects })
        if (currentPhoto.actions && currentPhoto.actions.length > 0) {
          dispatch({ type: 'setCurrentActions', actions: currentPhoto.actions })
        }
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

    try {
      await api.uploadPending(currentPhoto.dataUrl)
      await api.uploadPhoto(annotatedPath, {
        objects: currentObjects,
        nativeLang,
        targetLang,
        id: currentPhoto.id,
        collectionDate: (() => {
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const h = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          const s = String(d.getSeconds()).padStart(2, '0');
          return `${y}-${m}-${day} ${h}:${min}:${s}`;
        })(),
        createdAt: Date.now(),
      })
    } catch {
      if (saveToAlbumSuccess) {
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
      }
    }

    dispatch({ type: 'nextPhoto' })
  }, [currentPhoto, currentObjects, dispatch, nativeLang, targetLang])

  const handleRemoveObject = useCallback((index: number) => {
    if (!currentObjects) return
    const updated = currentObjects.filter((_, i) => i !== index)
    dispatch({ type: 'setCurrentObjects', objects: updated })
    dispatch({ type: 'updatePhotoObjects', index: currentIndex, objects: updated, actions: currentActions ?? undefined })
    // 持久化到数据库
    if (currentPhoto?.id) {
      api.reRecognize(currentPhoto.id, updated as Record<string, unknown>[], (currentActions ?? []) as Record<string, unknown>[]).catch((err) => {
        console.error('reRecognize 持久化失败:', err)
      })
    }
  }, [currentObjects, currentActions, currentIndex, currentPhoto, dispatch])

  const handleRemoveAction = useCallback((index: number) => {
    if (!currentActions) return
    const updated = currentActions.filter((_, i) => i !== index)
    dispatch({ type: 'setCurrentActions', actions: updated })
    dispatch({ type: 'updatePhotoObjects', index: currentIndex, objects: currentObjects ?? [], actions: updated })
    if (currentPhoto?.id) {
      api.reRecognize(currentPhoto.id, (currentObjects ?? []) as Record<string, unknown>[], updated as Record<string, unknown>[]).catch((err) => {
        console.error('reRecognize 持久化失败:', err)
      })
    }
  }, [currentObjects, currentActions, currentIndex, currentPhoto, dispatch])

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
          !showReRecognizeDialog && (
            <AnnotatedImage
              key={canvasKey}
              dataUrl={currentPhoto.dataUrl}
              objects={currentObjects}
              actions={currentActions ?? undefined}
            />
          )
        ) : null}
      </View>

      {currentObjects && currentObjects.length > 0 && (
        <View className="review-word-cards">
          {currentObjects.map((obj, idx) => (
            <View key={idx} className="review-word-card-item">
              <View
                className="review-word-card-remove"
                onClick={(e) => { e.stopPropagation(); handleRemoveObject(idx); }}
              >
                <Text>×</Text>
              </View>
              <WordCard obj={obj} wordbookWords={wordbookWords} onWordbookChange={(word, inWb) => {
                setWordbookWords(prev => inWb ? [...prev, word.toLowerCase()] : prev.filter(w => w !== word.toLowerCase()))
              }} />
            </View>
          ))}
        </View>
      )}

      {/* 动作单词 */}
      {currentActions && currentActions.length > 0 && (
        <View className="review-word-cards">
          <View style={{ width: '100%', textAlign: 'center', marginBottom: '4px' }}>
            <Text style={{ fontSize: '12px', color: '#E65100', fontWeight: 'bold' }}>🏃 动作</Text>
          </View>
          {currentActions.map((action, idx) => (
            <View key={idx} className="review-word-card-item" style={{ borderColor: '#FF9800' }}>
              <View
                className="review-word-card-remove"
                onClick={(e) => { e.stopPropagation(); handleRemoveAction(idx); }}
              >
                <Text>×</Text>
              </View>
              <WordCard obj={action} wordbookWords={wordbookWords} onWordbookChange={(word, inWb) => {
                setWordbookWords(prev => inWb ? [...prev, word.toLowerCase()] : prev.filter(w => w !== word.toLowerCase()))
              }} />
            </View>
          ))}
        </View>
      )}

      <View className="review-actions">
        <Button onClick={handleReRecognize} disabled={loading}>
          {loading ? '识别中...' : '重新识别'}
        </Button>
        <Button onClick={handleDownload} disabled={loading || !currentObjects}>
          下载
        </Button>
      </View>

      {/* 重新识别弹框 */}
      {showReRecognizeDialog && (
        <View className="review-rerecognize-mask" onClick={() => { setShowReRecognizeDialog(false); setReRecognizeHint(''); setCanvasKey(k => k + 1); }}>
          <View className="review-rerecognize-card" onClick={(e: unknown) => (e as { stopPropagation?: () => void })?.stopPropagation?.()}>
            <Text className="review-rerecognize-title">重新识别</Text>
            <Text className="review-rerecognize-desc">描述你希望调整的内容，AI会根据你的提示重新识别</Text>
            <Textarea
              className="review-rerecognize-input"
              value={reRecognizeHint}
              onInput={(e) => setReRecognizeHint(e.detail.value)}
              placeholder="例如：请识别右下角的物体 / 漏掉了桌子上的杯子"
              maxlength={200}
              autoFocus
            />
            <View className="review-rerecognize-actions">
              <Button className="review-rerecognize-btn-skip" onClick={handleReRecognizeSkip}>
                直接重新识别
              </Button>
              <Button className="review-rerecognize-btn-confirm" onClick={handleReRecognizeConfirm}>
                带提示重新识别
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
