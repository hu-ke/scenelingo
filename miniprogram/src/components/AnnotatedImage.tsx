import { useEffect, useRef, useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Canvas, Text } from '@tarojs/components'
import type { RecognizedObject, RecognizedAction } from '../context/AppContext'
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs'
import { getApiBaseUrl } from '../utils/api'

const COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B']

interface Props {
  dataUrl: string
  objects: RecognizedObject[]
  actions?: RecognizedAction[]
  style?: Record<string, string>
}

interface BubbleLayout {
  x: number; y: number; w: number; h: number
  word: string
  speakerArea: { x: number; y: number; w: number; h: number }
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function drawRoundedRect(
  ctx: Taro.CanvasContext,
  x: number, y: number, w: number, h: number, r: number
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
  x: number, y: number, size: number, color: string
) {
  const s = size
  ctx.setFillStyle(color)
  ctx.setStrokeStyle(color)

  const bodyW = s * 0.28
  const bodyH = s * 0.5
  const bodyX = x
  const bodyY = y + (s - bodyH) / 2
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH)

  const coneX = bodyX + bodyW
  ctx.beginPath()
  ctx.moveTo(coneX, bodyY)
  ctx.lineTo(coneX + s * 0.22, y + s * 0.15)
  ctx.lineTo(coneX + s * 0.22, y + s * 0.85)
  ctx.lineTo(coneX, bodyY + bodyH)
  ctx.closePath()
  ctx.fill()

  ctx.setLineWidth(1)
  const waveCX = coneX + s * 0.3
  const waveCY = y + s / 2
  ctx.beginPath()
  ctx.arc(waveCX, waveCY, s * 0.12, -0.65, 0.65)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(waveCX, waveCY, s * 0.22, -0.65, 0.65)
  ctx.stroke()
}

function drawBubbleTail(
  ctx: Taro.CanvasContext,
  centerX: number, attachY: number,
  tailWidth: number, tailHeight: number,
  pointingUp: boolean
) {
  const halfW = tailWidth / 2
  ctx.setFillStyle('#FFFFFF')
  ctx.beginPath()
  if (pointingUp) {
    ctx.moveTo(centerX - halfW, attachY)
    ctx.lineTo(centerX, attachY - tailHeight)
    ctx.lineTo(centerX + halfW, attachY)
  } else {
    ctx.moveTo(centerX - halfW, attachY)
    ctx.lineTo(centerX, attachY + tailHeight)
    ctx.lineTo(centerX + halfW, attachY)
  }
  ctx.closePath()
  ctx.fill()
}

function drawTailStroke(
  ctx: Taro.CanvasContext,
  centerX: number, attachY: number,
  tailWidth: number, tailHeight: number,
  pointingUp: boolean, color: string
) {
  const halfW = tailWidth / 2
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(1)
  if (pointingUp) {
    ctx.beginPath()
    ctx.moveTo(centerX - halfW, attachY)
    ctx.lineTo(centerX, attachY - tailHeight)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centerX + halfW, attachY)
    ctx.lineTo(centerX, attachY - tailHeight)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(centerX - halfW, attachY)
    ctx.lineTo(centerX, attachY + tailHeight)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centerX + halfW, attachY)
    ctx.lineTo(centerX, attachY + tailHeight)
    ctx.stroke()
  }
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.65
}

function AnnotatedImage({ dataUrl, objects, actions, style }: Props) {
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null)
  const [localPath, setLocalPath] = useState<string | null>(null)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleLayoutsRef = useRef<BubbleLayout[]>([])

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
          if (res.statusCode === 200) setLocalPath(res.tempFilePath)
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
      .catch(() => setImageInfo(null))
  }, [localPath])

  useEffect(() => {
    if (!imageInfo || !localPath) return
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current)

    drawTimerRef.current = setTimeout(() => {
      const ctx = Taro.createCanvasContext(canvasId)
      if (!ctx) return

      const { width: canvasW, height: canvasH } = imageInfo
      ctx.drawImage(localPath, 0, 0, canvasW, canvasH)

      if (objects.length === 0) {
        bubbleLayoutsRef.current = []
        ctx.draw()
        return
      }

      const scaleX = canvasW / 1000
      const scaleY = canvasH / 1000

      const fontSize = Math.max(10, Math.min(13, Math.round(canvasW / 70)))
      const phoneticFontSize = Math.max(8, Math.min(10, Math.round(fontSize * 0.7)))
      const romajiFontSize = Math.max(7, Math.min(9, Math.round(fontSize * 0.6)))
      const lineHeight = fontSize + 3
      const phoneticLineHeight = phoneticFontSize + 1
      const romajiLineHeight = romajiFontSize + 1

      const bubblePaddingX = 5
      const bubblePaddingY = 3
      const bubbleRadius = 5
      const speakerSize = 12
      const speakerGap = 3
      const tailWidth = 8
      const tailHeight = 5
      const bubbleGap = 3

      const layouts: BubbleLayout[] = []

      // 去重：相同单词只保留第一个
      const seenNames = new Set<string>()
      const uniqueObjects = objects.filter(obj => {
        const name = obj.name.toLowerCase()
        if (seenNames.has(name)) return false
        seenNames.add(name)
        return true
      })

      for (let i = 0; i < uniqueObjects.length; i++) {
        const obj = uniqueObjects[i]
        const color = COLORS[i % COLORS.length]

        const [bx1, by1, bx2, by2] = obj.bbox
        const px = bx1 * scaleX
        const py = by1 * scaleY
        const pw = (bx2 - bx1) * scaleX
        const ph = (by2 - by1) * scaleY
        const bboxCenterX = px + pw / 2

        const wordWidth = estimateTextWidth(obj.name, fontSize)
        const phoneticWidth = estimateTextWidth(obj.phonetic || '', phoneticFontSize)
        const romajiWidth = estimateTextWidth(obj.romaji || '', romajiFontSize)

        const textWidth = Math.max(wordWidth, phoneticWidth, romajiWidth)
        const hasRomaji = !!(obj.romaji)
        const bubbleW = Math.max(60, Math.min(120, textWidth + speakerSize + speakerGap + bubblePaddingX * 2))
        const bubbleH = bubblePaddingY * 2 + lineHeight + phoneticLineHeight + (hasRomaji ? romajiLineHeight : 0)

        let bubbleX = bboxCenterX - bubbleW / 2
        let bubbleY = py - bubbleH - tailHeight - bubbleGap
        let tailUp = false

        if (bubbleX < 2) bubbleX = 2
        if (bubbleX + bubbleW > canvasW - 2) bubbleX = canvasW - bubbleW - 2

        if (bubbleY < 0) {
          bubbleY = py + ph + bubbleGap
          tailUp = true
        }

        const speakerX = bubbleX + bubbleW - bubblePaddingX - speakerSize
        const speakerY = bubbleY + (bubbleH - speakerSize) / 2

        ctx.setFillStyle('#FFFFFF')
        ctx.setStrokeStyle(color)
        ctx.setLineWidth(1)
        drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleRadius)
        ctx.fill()
        ctx.stroke()

        const attachY = tailUp ? bubbleY : bubbleY + bubbleH
        drawBubbleTail(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp)
        drawTailStroke(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp, color)

        ctx.setFillStyle('#333333')
        ctx.setFontSize(fontSize)
        ctx.setTextAlign('left')
        ctx.fillText(obj.name, bubbleX + bubblePaddingX, bubbleY + bubblePaddingY + fontSize)

        if (obj.phonetic) {
          ctx.setFillStyle('#888888')
          ctx.setFontSize(phoneticFontSize)
          ctx.fillText(obj.phonetic, bubbleX + bubblePaddingX, bubbleY + bubblePaddingY + fontSize + lineHeight)
        }

        if (obj.romaji) {
          ctx.setFillStyle('#AAAAAA')
          ctx.setFontSize(romajiFontSize)
          ctx.fillText(obj.romaji, bubbleX + bubblePaddingX, bubbleY + bubblePaddingY + fontSize + lineHeight + phoneticLineHeight)
        }

        drawSpeakerIcon(ctx, speakerX, speakerY, speakerSize, color)

        layouts.push({
          x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH,
          word: obj.name,
          speakerArea: { x: speakerX, y: speakerY, w: speakerSize, h: speakerSize },
        })
      }

      // 绘制动作标签（底部居中排列）
      if (actions && actions.length > 0) {
        const actionFontSize = fontSize
        const actionPaddingX = 6
        const actionPaddingY = 3
        const actionRadius = 8
        const actionGap = 4
        const actionTopMargin = 6

        const actionWidths = actions.map(a => estimateTextWidth(a.name, actionFontSize))
        const totalActionW = actionWidths.reduce((sum, w, i) =>
          sum + w + actionPaddingX * 2 + (i > 0 ? actionGap : 0), 0)
        const actionStartX = (canvasW - totalActionW) / 2
        const actionY = canvasH - actionFontSize - actionPaddingY * 2 - actionTopMargin

        let curX = actionStartX
        for (let i = 0; i < actions.length; i++) {
          const act = actions[i]
          const aw = actionWidths[i] + actionPaddingX * 2
          const ah = actionFontSize + actionPaddingY * 2

          ctx.setFillStyle('rgba(255, 152, 0, 0.85)')
          ctx.setStrokeStyle('#E65100')
          ctx.setLineWidth(1)
          drawRoundedRect(ctx, curX, actionY, aw, ah, actionRadius)
          ctx.fill()
          ctx.stroke()

          ctx.setFillStyle('#FFFFFF')
          ctx.setFontSize(actionFontSize)
          ctx.setTextAlign('left')
          ctx.fillText(act.name, curX + actionPaddingX, actionY + ah / 2 + actionFontSize / 2)

          curX += aw + actionGap
        }
      }

      bubbleLayoutsRef.current = layouts
      ctx.draw()
    }, 200)

    return () => {
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current)
    }
  }, [localPath, imageInfo, objects, actions])

  const handleCanvasTap = useCallback((e: any) => {
    for (const layout of bubbleLayoutsRef.current) {
      const sa = layout.speakerArea
      if (
        e.detail.x >= sa.x && e.detail.x <= sa.x + sa.w &&
        e.detail.y >= sa.y && e.detail.y <= sa.y + sa.h
      ) {
        try {
          const audioCtx = Taro.createInnerAudioContext()
          const ttsLang = getTtsLang(getLanguagePrefs().targetLang)
          const baseUrl = getApiBaseUrl()
          audioCtx.src = `${baseUrl}/api/tts?text=${encodeURIComponent(layout.word)}&lang=${ttsLang}`
          audioCtx.play()
          audioCtx.onEnded(() => audioCtx.destroy())
          audioCtx.onError(() => audioCtx.destroy())
        } catch {}
        return
      }
    }
  }, [])

  const hasImage = imageInfo !== null
  const isEmpty = objects.length === 0

  return (
    <View style={{ textAlign: 'center', ...style }}>
      <Canvas
        canvasId={canvasId}
        onTap={handleCanvasTap}
        style={{
          width: hasImage ? imageInfo.width + 'px' : '100%',
          height: hasImage ? imageInfo.height + 'px' : 'auto',
          maxWidth: '100%',
          borderRadius: '12px',
          display: 'block',
          margin: '0 auto',
        }}
      />
      {isEmpty && (
        <View style={{ marginTop: '8px', fontSize: '14px' }}>
          <Text style={{ color: '#888' }}>未识别到物体</Text>
        </View>
      )}
    </View>
  )
}

export default AnnotatedImage
