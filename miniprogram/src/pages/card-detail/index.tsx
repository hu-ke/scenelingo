import { useState, useEffect, useCallback, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import AnnotatedImage from '../../components/AnnotatedImage'
import WordCard from '../../components/WordCard'
import type { RecognizedObject } from '../../context/AppContext'
import { getWordbookWords } from '../../utils/wordMastery'
import './index.scss'

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service'

interface WordDetail {
  word: string
  row?: number
  col?: number
  bbox?: [number, number, number, number]
  chinese?: string
  phonetic?: string
  examples?: string[]
}

interface DetailData {
  _id: string
  image_url: string
  annotated_url?: string
  oss_key: string
  words: WordDetail[]
  category_path?: string[]
  scene_path?: string[]
  grid_index?: number
}

function wordsToRecognizedObjects(words: WordDetail[]): RecognizedObject[] {
  return words.map((w) => ({
    name: w.word,
    bbox: w.bbox || [0, 0, 0, 0],
    phonetic: w.phonetic || '',
    chinese: w.chinese || '',
    examples: w.examples || [],
  }))
}

function hasBbox(words: WordDetail[]): boolean {
  if (!words || words.length === 0) return false
  return words.some((w) => w.bbox && w.bbox.some((v) => v > 0))
}

export default function CardDetailPage() {
  const router = useRouter()
  const { type, category_path: categoryPathStr, scene_path: scenePathStr, grid_index: gridIndexStr } = router.params
  const isScene = type === 'scene'

  const categoryPath: string[] = categoryPathStr ? decodeURIComponent(categoryPathStr).split(',') : []
  const scenePath: string[] = scenePathStr ? decodeURIComponent(scenePathStr).split(',') : []
  const scenePathDecoded = scenePathStr ? decodeURIComponent(scenePathStr) : ''
  const gridIndex = parseInt(gridIndexStr || '1', 10)

  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [annotating, setAnnotating] = useState(false)
  const [annotated, setAnnotated] = useState(false)
  const [wordbookWords, setWordbookWords] = useState<string[]>([])
  const [canvasKey, setCanvasKey] = useState(0)
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getWordbookWords().then(setWordbookWords)
  }, [])

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true)
      if (isScene) {
        const res = await Taro.request({
          url: `${BASE_URL}/api/scene-grids/detail`,
          method: 'GET',
          data: { scene_path: scenePathDecoded },
        })
        if (res.statusCode === 200) {
          const data = (res.data as { scene: DetailData }).scene
          setDetail(data)
          if (data.annotated_url) setAnnotated(true)
        }
      } else {
        const res = await Taro.request({
          url: `${BASE_URL}/api/category-grids/detail`,
          method: 'GET',
          data: { category_path: categoryPathStr, grid_index: gridIndex },
        })
        if (res.statusCode === 200) {
          const data = (res.data as { grid: DetailData }).grid
          setDetail(data)
          if (data.annotated_url) setAnnotated(true)
        }
      }
    } catch (err) {
      console.error('Failed to fetch detail:', err)
    } finally {
      setLoading(false)
    }
  }, [isScene, categoryPathStr, scenePathDecoded, gridIndex])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  // Auto-annotate if no bbox data
  useEffect(() => {
    if (!detail || loading || annotating || annotated) return
    if (hasBbox(detail.words)) return

    const doAnnotate = async () => {
      setAnnotating(true)
      try {
        if (isScene) {
          const res = await Taro.request({
            url: `${BASE_URL}/api/scene-grids/re-annotate`,
            method: 'POST',
            data: { scene_path: scenePathDecoded },
          })
          if (res.statusCode === 200) {
            setDetail((res.data as { scene: DetailData }).scene)
            setCanvasKey((k) => k + 1)
          }
        } else {
          const res = await Taro.request({
            url: `${BASE_URL}/api/category-grids/re-annotate`,
            method: 'POST',
            data: { category_path: categoryPathStr, grid_index: gridIndex },
          })
          if (res.statusCode === 200) {
            setDetail((res.data as { grid: DetailData }).grid)
            setCanvasKey((k) => k + 1)
          }
        }
      } catch (err) {
        console.error('Re-annotate failed:', err)
      } finally {
        setAnnotating(false)
      }
    }
    doAnnotate()
  }, [detail, loading, annotating, annotated, isScene, categoryPathStr, scenePathDecoded, gridIndex])

  // Upload annotated image after rendering
  const uploadAnnotated = useCallback(async () => {
    if (!detail || annotated) return
    try {
      const tempPath = await new Promise<string>((resolve, reject) => {
        Taro.canvasToTempFilePath({
          canvasId: 'annotated-canvas',
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err),
        })
      })

      if (isScene) {
        await Taro.uploadFile({
          url: `${BASE_URL}/api/scene-grids/upload-annotated?scene_path=${encodeURIComponent(scenePathDecoded)}`,
          filePath: tempPath,
          name: 'file',
          timeout: 30000,
        })
      } else {
        await Taro.uploadFile({
          url: `${BASE_URL}/api/category-grids/upload-annotated?category_path=${encodeURIComponent(categoryPathStr || '')}&grid_index=${gridIndex}`,
          filePath: tempPath,
          name: 'file',
          timeout: 30000,
        })
      }
      setAnnotated(true)
    } catch (err) {
      console.error('Upload annotated failed:', err)
    }
  }, [detail, annotated, isScene, categoryPathStr, scenePathDecoded, gridIndex])

  // Upload annotated image after canvas renders
  useEffect(() => {
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current)
    if (!detail || annotated || !hasBbox(detail.words)) return
    uploadTimerRef.current = setTimeout(() => {
      uploadAnnotated()
    }, 1500)
    return () => {
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current)
    }
  }, [detail, annotated, uploadAnnotated, canvasKey])

  if (loading) {
    return (
      <View className="card-detail-page">
        <View className="card-detail-loading">加载中...</View>
      </View>
    )
  }

  if (!detail) {
    return (
      <View className="card-detail-page">
        <View className="card-detail-empty">暂无数据</View>
      </View>
    )
  }

  const recognizedObjects = wordsToRecognizedObjects(detail.words || [])
  const title = isScene
    ? (detail.scene_path || []).join(' / ')
    : (detail.category_path || []).join(' / ')

  return (
    <View className="card-detail-page">
      <View className="card-detail-header">
        <Text className="card-detail-title">{title}</Text>
      </View>

      {/* Annotated image with bbox markers */}
      <View className="card-detail-image-wrap">
        {annotating ? (
          <View className="card-detail-annotating">
            <View className="card-detail-spinner" />
            <Text className="card-detail-annotating-text">正在标注...</Text>
          </View>
        ) : (
          <AnnotatedImage
            key={canvasKey}
            dataUrl={detail.image_url}
            objects={recognizedObjects}
          />
        )}
      </View>

      {/* Word cards */}
      {recognizedObjects.length > 0 && (
        <View className="card-detail-word-cards">
          {recognizedObjects.map((obj, idx) => (
            <View key={idx} className="card-detail-word-card-item">
              <WordCard
                obj={obj}
                wordbookWords={wordbookWords}
                onWordbookChange={(word, inWb) => {
                  setWordbookWords((prev) =>
                    inWb
                      ? [...prev, word.toLowerCase()]
                      : prev.filter((w) => w !== word.toLowerCase())
                  )
                }}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}