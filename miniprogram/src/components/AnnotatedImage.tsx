import { useEffect, useRef, useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Canvas, Text } from '@tarojs/components'
import type { RecognizedObject } from '../context/AppContext'
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs'

const BUBBLE_PADDING_X = 8
const BUBBLE_PADDING_Y = 5
const BUBBLE_RADIUS = 6
const TAIL_WIDTH = 10
const TAIL_HEIGHT = 6
const SPEAKER_SIZE = 15
const COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B']

interface Props {
  dataUrl: string
  objects: RecognizedObject[]
  style?: Record<string, string>
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function drawRoundedRect(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2)
  ctx.closePath()
}

function drawSpeakerIcon(
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const spkBodyW = size * 0.28
  const spkBodyH = size * 0.5
  const spkBodyX = x
  const spkBodyY = y + (size - spkBodyH) / 2

  ctx.setFillStyle(color)
  ctx.fillRect(spkBodyX, spkBodyY, spkBodyW, spkBodyH)

  ctx.beginPath()
  ctx.moveTo(spkBodyX + spkBodyW, y + 3)
  ctx.lineTo(x + size * 0.65, y)
  ctx.lineTo(x + size * 0.65, y + size)
  ctx.closePath()
  ctx.fill()

  const arcCenterX = x + size * 0.65
  const midY = y + size / 2
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(1.5)

  ctx.beginPath()
  ctx.arc(arcCenterX, midY, size * 0.22, -Math.PI / 3, Math.PI / 3)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(arcCenterX, midY, size * 0.4, -Math.PI / 3, Math.PI / 3)
  ctx.stroke()
}

function computeBubbleBounds(
  obj: RecognizedObject,
  canvasW: number,
  canvasH: number,
  wordFontSize: number,
  phoneticFontSize: number,
  lineHeight: number
) {
  const [x0, y0, x1, y1] = obj.bbox
  const scaleX = canvasW / 1000
  const scaleY = canvasH / 1000
  const drawX = x0 * scaleX
  const drawY = y0 * scaleY
  const drawW = (x1 - x0) * scaleX
  const drawH = (y1 - y0) * scaleY
  const centerX = drawX + drawW / 2

  const wordEstimateW = obj.name.length * wordFontSize * 0.65
  const phoneticEstimateW = obj.phonetic ? obj.phonetic.length * phoneticFontSize * 0.55 : 0
  const textW = Math.max(wordEstimateW, phoneticEstimateW)
  const bubbleW = textW + BUBBLE_PADDING_X * 2 + SPEAKER_SIZE + 8
  const bubbleH = lineHeight * 2 + BUBBLE_PADDING_Y * 2

  const bubbleAbove = drawY > bubbleH + TAIL_HEIGHT + 6
  const bubbleY = bubbleAbove ? drawY - bubbleH - TAIL_HEIGHT - 3 : drawY + drawH + TAIL_HEIGHT + 3

  let bubbleX = centerX - bubbleW / 2
  bubbleX = Math.max(3, Math.min(bubbleX, canvasW - bubbleW - 3))

  const speakerX = bubbleX + bubbleW - BUBBLE_PADDING_X - SPEAKER_SIZE
  const speakerY = bubbleY + (bubbleH - SPEAKER_SIZE) / 2

  const tailX = centerX - TAIL_WIDTH / 2
  const tailY = bubbleAbove ? drawY - 3 : drawY + drawH + 3
  const tailTipY = bubbleAbove ? tailY - TAIL_HEIGHT : tailY + TAIL_HEIGHT

  return {
    bubbleX, bubbleY, bubbleW, bubbleH,
    speakerX, speakerY,
    tailX, tailY, tailTipY, centerX,
    drawX, drawY, drawW, drawH,
  }
}

function AnnotatedImage({ dataUrl, objects, style }: Props) {
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null)
  const [localPath, setLocalPath] = useState<string | null>(null)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canvasId = 'annotated-canvas'

  useEffect(() => {
    if (!dataUrl) {
      setImageInfo(null)
      setLocalPath(null)
      return
    }

    if (isRemoteUrl(dataUrl)) {
      Taro.downloadFile({
        url: dataUrl,
        success(res) {
          if (res.statusCode === 200) {
            setLocalPath(res.tempFilePath)
          }
        },
      })
    } else {
      setLocalPath(dataUrl)
    }
  }, [dataUrl])

  useEffect(() => {
    if (!localPath) return

    const sysInfo = Taro.getSystemInfoSync()
    const containerWidth = sysInfo.windowWidth - 48

    Taro.getImageInfo({ src: localPath })
      .then((info) => {
        const scale = Math.min(containerWidth / info.width, 1)
        setImageInfo({
          width: Math.round(info.width * scale),
          height: Math.round(info.height * scale),
        })
      })
      .catch(() => {
        setImageInfo(null)
      })
  }, [localPath])

  useEffect(() => {
    if (!imageInfo || !localPath) return

    if (drawTimerRef.current) {
      clearTimeout(drawTimerRef.current)
    }

    drawTimerRef.current = setTimeout(() => {
      const ctx = Taro.createCanvasContext(canvasId)
      if (!ctx) return

      const { width: canvasW, height: canvasH } = imageInfo

      ctx.drawImage(localPath, 0, 0, canvasW, canvasH)

      if (objects.length === 0) {
        ctx.draw()
        return
      }

      const wordFontSize = Math.max(11, Math.min(16, Math.round(canvasW / 75)))
      const phoneticFontSize = Math.max(8, Math.min(12, Math.round(canvasW / 110)))
      const lineHeight = wordFontSize + 3

      objects.forEach((obj, index) => {
        const color = COLORS[index % COLORS.length]
        const b = computeBubbleBounds(obj, canvasW, canvasH, wordFontSize, phoneticFontSize, lineHeight)

        ctx.setFillStyle('#FFFFFF')
        ctx.setStrokeStyle(color)
        ctx.setLineWidth(1.5)
        drawRoundedRect(ctx, b.bubbleX, b.bubbleY, b.bubbleW, b.bubbleH, BUBBLE_RADIUS)
        ctx.fill()
        ctx.stroke()

        ctx.setFillStyle('#FFFFFF')
        ctx.beginPath()
        ctx.moveTo(b.tailX, b.tailY)
        ctx.lineTo(b.tailX + TAIL_WIDTH, b.tailY)
        ctx.lineTo(b.centerX, b.tailTipY)
        ctx.closePath()
        ctx.fill()

        ctx.setStrokeStyle(color)
        ctx.setLineWidth(1.5)
        ctx.beginPath()
        ctx.moveTo(b.tailX, b.tailY)
        ctx.lineTo(b.tailX + TAIL_WIDTH, b.tailY)
        ctx.stroke()

        ctx.setFillStyle('#000000')
        ctx.setFontSize(wordFontSize)
        ctx.setTextAlign('left')
        ctx.fillText(
          obj.name,
          b.bubbleX + BUBBLE_PADDING_X,
          b.bubbleY + BUBBLE_PADDING_Y + wordFontSize
        )

        if (obj.phonetic) {
          ctx.setFillStyle('#888888')
          ctx.setFontSize(phoneticFontSize)
          ctx.fillText(
            obj.phonetic,
            b.bubbleX + BUBBLE_PADDING_X,
            b.bubbleY + BUBBLE_PADDING_Y + wordFontSize + lineHeight
          )
        }

        drawSpeakerIcon(ctx, b.speakerX, b.speakerY, SPEAKER_SIZE, color)
      })

      ctx.draw()
    }, 200)

    return () => {
      if (drawTimerRef.current) {
        clearTimeout(drawTimerRef.current)
      }
    }
  }, [localPath, imageInfo, objects])

  const handleCanvasTap = useCallback((e: any) => {
    if (!objects.length || !imageInfo) return
    const tapX = e.detail.x
    const tapY = e.detail.y
    const { width: canvasW, height: canvasH } = imageInfo

    const wordFontSize = Math.max(11, Math.min(16, Math.round(canvasW / 75)))
    const phoneticFontSize = Math.max(8, Math.min(12, Math.round(canvasW / 110)))
    const lineHeight = wordFontSize + 3

    for (let i = 0; i < objects.length; i++) {
      const b = computeBubbleBounds(objects[i], canvasW, canvasH, wordFontSize, phoneticFontSize, lineHeight)
      if (tapX >= b.speakerX && tapX <= b.speakerX + SPEAKER_SIZE &&
          tapY >= b.speakerY && tapY <= b.speakerY + SPEAKER_SIZE) {
        try {
          const audioCtx = Taro.createInnerAudioContext()
          const ttsLang = getTtsLang(getLanguagePrefs().targetLang)
          audioCtx.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(objects[i].name)}&tl=${ttsLang}&client=tw-ob`
          audioCtx.play()
          audioCtx.onEnded(() => audioCtx.destroy())
          audioCtx.onError(() => audioCtx.destroy())
        } catch {}
        return
      }
    }
  }, [objects, imageInfo])

  const hasImage = imageInfo !== null
  const isEmpty = objects.length === 0

  return (
    <View style={style}>
      <Canvas
        canvasId={canvasId}
        onTap={handleCanvasTap}
        style={{
          width: hasImage ? imageInfo.width + 'px' : '100%',
          height: hasImage ? imageInfo.height + 'px' : 'auto',
        }}
      />
      {isEmpty && (
        <View
          style={{
            textAlign: 'center',
            padding: '16px',
            color: '#999',
            fontSize: '14px',
          }}
        >
          <Text>未识别到物体</Text>
        </View>
      )}
    </View>
  )
}

export default AnnotatedImage
