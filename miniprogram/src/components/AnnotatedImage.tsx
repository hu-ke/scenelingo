import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Canvas, Text } from '@tarojs/components'
import type { RecognizedObject } from '../context/AppContext'

const MAX_SIZE = 1200
const BUBBLE_PADDING_X = 14
const BUBBLE_PADDING_Y = 10
const BUBBLE_RADIUS = 12
const TAIL_WIDTH = 16
const TAIL_HEIGHT = 10
const SPEAKER_SIZE = 22
const COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B']

interface Props {
  dataUrl: string
  objects: RecognizedObject[]
  style?: Record<string, string>
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
  ctx.moveTo(spkBodyX + spkBodyW, y + 4)
  ctx.lineTo(x + size * 0.65, y)
  ctx.lineTo(x + size * 0.65, y + size)
  ctx.closePath()
  ctx.fill()

  const arcCenterX = x + size * 0.65
  const midY = y + size / 2
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(2)

  ctx.beginPath()
  ctx.arc(arcCenterX, midY, size * 0.22, -Math.PI / 3, Math.PI / 3)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(arcCenterX, midY, size * 0.4, -Math.PI / 3, Math.PI / 3)
  ctx.stroke()
}

function AnnotatedImage({ dataUrl, objects, style }: Props) {
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canvasId = 'annotated-canvas'

  useEffect(() => {
    if (!dataUrl) {
      setImageInfo(null)
      return
    }
    console.log('get image info', dataUrl)
    Taro.getImageInfo({ src: dataUrl })
      .then((info) => {
        const scale = Math.min(MAX_SIZE / info.width, MAX_SIZE / info.height, 1)
        setImageInfo({
          width: Math.round(info.width * scale),
          height: Math.round(info.height * scale),
        })
      })
      .catch((err) => {
        console.error('Failed to get image info:', err)
        setImageInfo(null)
      })
  }, [dataUrl])

  useEffect(() => {
    if (!imageInfo || !dataUrl) return

    if (drawTimerRef.current) {
      clearTimeout(drawTimerRef.current)
    }

    drawTimerRef.current = setTimeout(() => {
      const ctx = Taro.createCanvasContext(canvasId)
      if (!ctx) return

      const { width: canvasW, height: canvasH } = imageInfo

      ctx.drawImage(dataUrl, 0, 0, canvasW, canvasH)

      if (objects.length === 0) {
        ctx.draw()
        return
      }

      const wordFontSize = Math.max(14, Math.min(22, Math.round(canvasW / 55)))
      const phoneticFontSize = Math.max(10, Math.min(15, Math.round(canvasW / 80)))
      const lineHeight = wordFontSize + 4

      objects.forEach((obj, index) => {
        const [x0, y0, x1, y1] = obj.bbox
        const scaleX = canvasW / 1000
        const scaleY = canvasH / 1000
        const drawX = x0 * scaleX
        const drawY = y0 * scaleY
        const drawW = (x1 - x0) * scaleX
        const drawH = (y1 - y0) * scaleY
        const centerX = drawX + drawW / 2

        const color = COLORS[index % COLORS.length]

        const wordEstimateW = obj.name.length * wordFontSize * 0.7
        const phoneticEstimateW = obj.phonetic
          ? obj.phonetic.length * phoneticFontSize * 0.6
          : 0
        const textW = Math.max(wordEstimateW, phoneticEstimateW)
        const bubbleW = textW + BUBBLE_PADDING_X * 2 + SPEAKER_SIZE + 12
        const bubbleH = lineHeight * 2 + BUBBLE_PADDING_Y * 2

        const bubbleAbove = drawY > bubbleH + TAIL_HEIGHT + 8
        const bubbleY = bubbleAbove
          ? drawY - bubbleH - TAIL_HEIGHT - 4
          : drawY + drawH + TAIL_HEIGHT + 4

        let bubbleX = centerX - bubbleW / 2
        bubbleX = Math.max(4, Math.min(bubbleX, canvasW - bubbleW - 4))

        const tailX = centerX - TAIL_WIDTH / 2
        const tailY = bubbleAbove ? drawY - 4 : drawY + drawH + 4
        const tailTipY = bubbleAbove ? tailY - TAIL_HEIGHT : tailY + TAIL_HEIGHT

        ctx.setFillStyle('#FFFFFF')
        ctx.setStrokeStyle(color)
        ctx.setLineWidth(2)
        drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, BUBBLE_RADIUS)
        ctx.fill()
        ctx.stroke()

        ctx.setFillStyle('#FFFFFF')
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(tailX + TAIL_WIDTH, tailY)
        ctx.lineTo(centerX, tailTipY)
        ctx.closePath()
        ctx.fill()

        ctx.setStrokeStyle(color)
        ctx.setLineWidth(2)
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(tailX + TAIL_WIDTH, tailY)
        ctx.stroke()

        ctx.setFillStyle('#000000')
        ctx.setFontSize(wordFontSize)
        ctx.setTextAlign('left')
        ctx.fillText(
          obj.name,
          bubbleX + BUBBLE_PADDING_X,
          bubbleY + BUBBLE_PADDING_Y + wordFontSize
        )

        if (obj.phonetic) {
          ctx.setFillStyle('#888888')
          ctx.setFontSize(phoneticFontSize)
          ctx.fillText(
            obj.phonetic,
            bubbleX + BUBBLE_PADDING_X,
            bubbleY + BUBBLE_PADDING_Y + wordFontSize + lineHeight
          )
        }

        const speakerX = bubbleX + bubbleW - BUBBLE_PADDING_X - SPEAKER_SIZE
        const speakerY = bubbleY + (bubbleH - SPEAKER_SIZE) / 2
        drawSpeakerIcon(ctx, speakerX, speakerY, SPEAKER_SIZE, color)
      })

      ctx.draw()
    }, 150)

    return () => {
      if (drawTimerRef.current) {
        clearTimeout(drawTimerRef.current)
      }
    }
  }, [dataUrl, imageInfo, objects])

  const hasImage = imageInfo !== null
  const isEmpty = objects.length === 0

  return (
    <View style={style}>
      <Canvas
        canvasId={canvasId}
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