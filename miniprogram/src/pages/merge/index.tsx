import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Canvas, Button, ScrollView } from '@tarojs/components'
import { useReview } from '../../context/AppContext'
import { useTheme } from '../../hooks/useTheme'
import './index.scss'

const CANVAS_ID = 'merge-canvas'
const SPACING_RPX = 16

function getColumns(count: number): number {
  if (count <= 4) return 2
  if (count <= 8) return 3
  return 4
}

export default function MergePage() {
  const themeStyle = useTheme()
  const { state, dispatch } = useReview()
  const { savedPhotos, selectedPhotoIds } = state

  const [drawing, setDrawing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedPhotos = useMemo(
    () => savedPhotos.filter((p) => selectedPhotoIds.includes(p.id)),
    [savedPhotos, selectedPhotoIds],
  )

  const photoCount = selectedPhotos.length
  const columns = getColumns(photoCount)
  const rows = Math.ceil(photoCount / columns)

  const systemInfo = useMemo(() => Taro.getSystemInfoSync(), [])
  const screenWidth = systemInfo.windowWidth
  const spacing = (SPACING_RPX * screenWidth) / 750
  const cellSize = (screenWidth - (columns + 1) * spacing) / columns
  const canvasHeight = rows * (cellSize + spacing) + spacing

  const handleBack = useCallback(() => {
    dispatch({ type: 'clearSelection' })
    Taro.navigateBack()
  }, [dispatch])

  const drawCanvas = useCallback(async () => {
    if (photoCount < 2) return

    setDrawing(true)

    if (drawTimerRef.current) {
      clearTimeout(drawTimerRef.current)
    }

    drawTimerRef.current = setTimeout(async () => {
      try {
        const ctx = Taro.createCanvasContext(CANVAS_ID)
        if (!ctx) {
          setDrawing(false)
          return
        }

        ctx.setFillStyle('#FFFFFF')
        ctx.fillRect(0, 0, screenWidth, canvasHeight)

        const imageInfos: { index: number; width: number; height: number }[] = []
        for (let i = 0; i < selectedPhotos.length; i++) {
          const photo = selectedPhotos[i]
          const imagePath = photo.annotatedDataUrl || photo.dataUrl
          try {
            console.log('get image info', imagePath)
            const info = await Taro.getImageInfo({ src: imagePath })
            imageInfos.push({ index: i, width: info.width, height: info.height })
          } catch {
            imageInfos.push({ index: i, width: cellSize, height: cellSize })
          }
        }

        imageInfos.forEach(({ index, width, height }) => {
          const col = index % columns
          const row = Math.floor(index / columns)
          const cellX = spacing + col * (cellSize + spacing)
          const cellY = spacing + row * (cellSize + spacing)

          const photo = selectedPhotos[index]
          const imagePath = photo.annotatedDataUrl || photo.dataUrl

          let drawWidth = cellSize
          let drawHeight = cellSize
          if (width > 0 && height > 0) {
            const scale = Math.min(cellSize / width, cellSize / height)
            drawWidth = width * scale
            drawHeight = height * scale
          }

          const offsetX = cellX + (cellSize - drawWidth) / 2
          const offsetY = cellY + (cellSize - drawHeight) / 2

          ctx.drawImage(imagePath, offsetX, offsetY, drawWidth, drawHeight)
        })

        ctx.draw(false, () => {
          setCanvasReady(true)
          setDrawing(false)
        })
      } catch {
        setDrawing(false)
      }
    }, 200)
  }, [photoCount, selectedPhotos, screenWidth, canvasHeight, cellSize, spacing, columns])

  useEffect(() => {
    setCanvasReady(false)
    drawCanvas()

    return () => {
      if (drawTimerRef.current) {
        clearTimeout(drawTimerRef.current)
      }
    }
  }, [drawCanvas])

  const handleExport = useCallback(async () => {
    if (!canvasReady || exporting) return

    setExporting(true)
    try {
      const { tempFilePath } = await Taro.canvasToTempFilePath({
        canvasId: CANVAS_ID,
      })

      Taro.showActionSheet({
        itemList: ['保存到相册', '分享给好友'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            try {
              const authResult = await Taro.getSetting()
              if (!authResult.authSetting['scope.writePhotosAlbum']) {
                await Taro.authorize({ scope: 'scope.writePhotosAlbum' })
              }
              await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath })
              Taro.showToast({ title: '已保存到相册', icon: 'success' })
            } catch (e: unknown) {
              if ((e as { errMsg?: string }).errMsg?.includes('auth deny')) {
                Taro.showModal({
                  title: '提示',
                  content: '需要相册权限才能保存图片，请在小程序设置中开启',
                  showCancel: false,
                })
              } else {
                Taro.showToast({ title: '保存失败', icon: 'error' })
              }
            }
          } else if (res.tapIndex === 1) {
            Taro.showShareImageMenu({ path: tempFilePath })
          }
        },
      })
    } catch {
      Taro.showToast({ title: '导出失败，请重试', icon: 'error' })
    } finally {
      setExporting(false)
    }
  }, [canvasReady, exporting])

  const isEmpty = photoCount < 2

  if (isEmpty) {
    return (
      <View className="merge-page" style={themeStyle}>
        <View className="merge-topbar">
          <Text className="merge-back-btn" onClick={handleBack}>
            ← 返回
          </Text>
          <Text className="merge-title">照片合并预览</Text>
        </View>
        <View className="merge-empty">
          <Text className="merge-empty-text">请至少选择 2 张照片进行合并</Text>
          <Button className="merge-empty-back-btn" onClick={handleBack}>
            返回选择
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="merge-page" style={themeStyle}>
      <View className="merge-topbar">
        <Text className="merge-back-btn" onClick={handleBack}>
          ← 返回
        </Text>
        <Text className="merge-title">照片合并预览</Text>
      </View>

      <View className="merge-canvas-wrapper">
        <ScrollView className="merge-canvas-scroll" scrollY>
          <Text className="merge-photo-count" style={{ paddingTop: '24rpx' }}>
            {photoCount} 张照片 / {columns} 列 {rows} 行
          </Text>
          <Canvas
            canvasId={CANVAS_ID}
            style={{
              width: screenWidth + 'px',
              height: canvasHeight + 'px',
            }}
          />
        </ScrollView>
      </View>

      <View className="merge-footer">
        <Button
          className="merge-download-btn"
          loading={drawing || exporting}
          disabled={drawing || !canvasReady || exporting}
          onClick={handleExport}
        >
          {drawing ? '绘制中…' : '下载导出'}
        </Button>
      </View>
    </View>
  )
}