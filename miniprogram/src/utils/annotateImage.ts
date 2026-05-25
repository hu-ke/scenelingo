import Taro from '@tarojs/taro';
import type { RecognizedObject } from '../context/AppContext';

const COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B'];

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
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

async function downloadImage(url: string): Promise<string> {
  if (!isRemoteUrl(url)) return url

  const res = await Taro.downloadFile({ url })
  if (res.statusCode === 200) return res.tempFilePath
  throw new Error(`下载图片失败 (${res.statusCode})`)
}

async function getImageInfo(src: string): Promise<{ width: number; height: number }> {
  const info = await Taro.getImageInfo({ src })
  return { width: info.width, height: info.height }
}

export async function renderAnnotatedImageToTempFile(
  dataUrl: string,
  objects: RecognizedObject[],
  canvasId: string
): Promise<string> {
  const localPath = await downloadImage(dataUrl)
  const imgInfo = await getImageInfo(localPath)

  const sysInfo = Taro.getSystemInfoSync()
  const containerWidth = sysInfo.windowWidth - 48
  const scale = Math.min(containerWidth / imgInfo.width, 1)
  const canvasW = Math.round(imgInfo.width * scale)
  const canvasH = Math.round(imgInfo.height * scale)

  const ctx = Taro.createCanvasContext(canvasId)
  if (!ctx) {
    throw new Error('创建画布失败')
  }

  ctx.drawImage(localPath, 0, 0, canvasW, canvasH)

  if (objects.length > 0) {
    const scaleX = canvasW / 1000
    const scaleY = canvasH / 1000

    const fontSize = Math.max(10, Math.min(13, Math.round(canvasW / 70)))
    const phoneticFontSize = Math.max(8, Math.min(10, Math.round(fontSize * 0.7)))
    const lineHeight = fontSize + 3
    const phoneticLineHeight = phoneticFontSize + 1

    const bubblePaddingX = 5
    const bubblePaddingY = 3
    const bubbleRadius = 5
    const speakerSize = 12
    const speakerGap = 3
    const tailWidth = 8
    const tailHeight = 5
    const bubbleGap = 3

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i]
      const color = COLORS[i % COLORS.length]

      const [bx1, by1, bx2, by2] = obj.bbox
      const px = bx1 * scaleX
      const py = by1 * scaleY
      const pw = (bx2 - bx1) * scaleX
      const ph = (by2 - by1) * scaleY
      const bboxCenterX = px + pw / 2

      const wordWidth = estimateTextWidth(obj.name, fontSize)
      const phoneticWidth = estimateTextWidth(obj.phonetic || '', phoneticFontSize)

      const textWidth = Math.max(wordWidth, phoneticWidth)
      const bubbleW = Math.max(60, Math.min(120, textWidth + speakerSize + speakerGap + bubblePaddingX * 2))
      const bubbleH = bubblePaddingY * 2 + lineHeight + phoneticLineHeight

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

      drawSpeakerIcon(ctx, speakerX, speakerY, speakerSize, color)
    }
  }

  return new Promise<string>((resolve, reject) => {
    ctx.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId,
        x: 0,
        y: 0,
        width: canvasW,
        height: canvasH,
        destWidth: canvasW,
        destHeight: canvasH,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(new Error(err.errMsg || '导出图片失败')),
      })
    })
  })
}
