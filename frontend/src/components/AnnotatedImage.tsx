import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { RecognizedObject, RecognizedAction } from '../context/ReviewContext';
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs';
import { getApiBaseUrl } from '../utils/api';

interface Props {
  dataUrl: string;
  objects: RecognizedObject[];
  actions?: RecognizedAction[];
}

const COLORS = ['#A29BFE', '#54A0FF', '#2ED573', '#FFA94D', '#FF6B6B'];

interface BubbleLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  word: string;
  tailUp: boolean;
  speakerArea: { x: number; y: number; w: number; h: number };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSpeakerIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const s = size;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Speaker body (small rectangle)
  const bodyW = s * 0.28;
  const bodyH = s * 0.5;
  const bodyX = x;
  const bodyY = y + (s - bodyH) / 2;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Cone (triangle)
  const coneX = bodyX + bodyW;
  ctx.beginPath();
  ctx.moveTo(coneX, bodyY);
  ctx.lineTo(coneX + s * 0.22, y + s * 0.15);
  ctx.lineTo(coneX + s * 0.22, y + s * 0.85);
  ctx.lineTo(coneX, bodyY + bodyH);
  ctx.closePath();
  ctx.fill();

  // Sound waves (two arcs)
  ctx.lineWidth = 1.5;
  const waveCX = coneX + s * 0.3;
  const waveCY = y + s / 2;

  ctx.beginPath();
  ctx.arc(waveCX, waveCY, s * 0.12, -0.65, 0.65);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(waveCX, waveCY, s * 0.22, -0.65, 0.65);
  ctx.stroke();
}

function drawBubbleTail(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  attachY: number,
  tailWidth: number,
  tailHeight: number,
  pointingUp: boolean
) {
  const halfW = tailWidth / 2;

  ctx.beginPath();
  if (pointingUp) {
    // Apex at top, base attached to bubble top edge
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.lineTo(centerX + halfW, attachY);
  } else {
    // Apex at bottom, base attached to bubble bottom edge
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.lineTo(centerX + halfW, attachY);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

function drawTailStroke(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  attachY: number,
  tailWidth: number,
  tailHeight: number,
  pointingUp: boolean,
  color: string
) {
  const halfW = tailWidth / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  if (pointingUp) {
    // Left edge and right edge, no base
    ctx.beginPath();
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + halfW, attachY);
    ctx.lineTo(centerX, attachY - tailHeight);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(centerX - halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + halfW, attachY);
    ctx.lineTo(centerX, attachY + tailHeight);
    ctx.stroke();
  }
}

const AnnotatedImage = forwardRef<HTMLCanvasElement, Props>(
  ({ dataUrl, objects, actions }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bubbleLayoutsRef = useRef<BubbleLayout[]>([]);

    useImperativeHandle(ref, () => canvasRef.current!);

    const handleCanvasClick = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        for (const layout of bubbleLayoutsRef.current) {
          const sa = layout.speakerArea;
          if (
            clickX >= sa.x &&
            clickX <= sa.x + sa.w &&
            clickY >= sa.y &&
            clickY <= sa.y + sa.h
          ) {
            if (typeof speechSynthesis !== 'undefined') {
              const utterance = new SpeechSynthesisUtterance(layout.word);
              utterance.lang = getTtsLang(getLanguagePrefs().targetLang);
              speechSynthesis.speak(utterance);
            }
            break;
          }
        }
      },
      []
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const img = new Image();
      let src = dataUrl;
      if (dataUrl.startsWith('http')) {
        img.crossOrigin = 'anonymous';
        src = `${getApiBaseUrl()}/api/image/proxy?url=${encodeURIComponent(dataUrl)}`;
      }
      img.onload = () => {
        const MAX_SIZE = 1200;
        const canvasScale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.round(img.naturalWidth * canvasScale);
        canvas.height = Math.round(img.naturalHeight * canvasScale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (objects.length === 0) {
          bubbleLayoutsRef.current = [];
          return;
        }

        const scaleX = canvas.width / 1000;
        const scaleY = canvas.height / 1000;
        const fontSize = Math.max(14, Math.min(22, canvas.width / 35));
        const phoneticFontSize = Math.max(10, Math.min(15, fontSize * 0.7));
        const romajiFontSize = Math.max(9, Math.min(12, fontSize * 0.55));
        const lineHeight = fontSize + 4;
        const phoneticLineHeight = phoneticFontSize + 2;
        const romajiLineHeight = romajiFontSize + 2;

        const bubblePaddingX = 14;
        const bubblePaddingY = 10;
        const bubbleRadius = 12;
        const speakerSize = 22;
        const speakerGap = 8;
        const tailWidth = 16;
        const tailHeight = 10;
        const bubbleGap = 8;

        const layouts: BubbleLayout[] = [];

        // 去重：相同单词只保留第一个
        const seenNames = new Set<string>();
        const uniqueObjects = objects.filter(obj => {
          const name = obj.name.toLowerCase();
          if (seenNames.has(name)) return false;
          seenNames.add(name);
          return true;
        });

        for (let i = 0; i < uniqueObjects.length; i++) {
          const obj = uniqueObjects[i];
          const color = COLORS[i % COLORS.length];

          // Bounding box in image coordinates
          const [bx1, by1, bx2, by2] = obj.bbox;
          const px = bx1 * scaleX;
          const py = by1 * scaleY;
          const pw = (bx2 - bx1) * scaleX;
          const ph = (by2 - by1) * scaleY;

          const bboxCenterX = px + pw / 2;

          // Measure text widths
          ctx.font = `bold ${fontSize}px sans-serif`;
          const wordMetrics = ctx.measureText(obj.name);
          const wordWidth = wordMetrics.width;

          ctx.font = `${phoneticFontSize}px sans-serif`;
          const phoneticMetrics = ctx.measureText(obj.phonetic || '');
          const phoneticWidth = phoneticMetrics.width;

          ctx.font = `${romajiFontSize}px sans-serif`;
          const romajiMetrics = ctx.measureText(obj.romaji || '');
          const romajiWidth = romajiMetrics.width;

          const hasRomaji = !!(obj.romaji);
          const textWidth = Math.max(wordWidth, phoneticWidth, romajiWidth);
          const bubbleW = Math.max(140, Math.min(240, textWidth + speakerSize + speakerGap + bubblePaddingX * 2));
          const bubbleH = bubblePaddingY * 2 + lineHeight + phoneticLineHeight + (hasRomaji ? romajiLineHeight : 0);

          // Decide position: try above first
          let bubbleX = bboxCenterX - bubbleW / 2;
          let bubbleY = py - bubbleH - tailHeight - bubbleGap;
          let tailUp = false;

          // Clamp horizontally
          if (bubbleX < 0) bubbleX = 2;
          if (bubbleX + bubbleW > img.naturalWidth) bubbleX = img.naturalWidth - bubbleW - 2;

          // If bubble goes above the image, place below
          if (bubbleY < 0) {
            bubbleY = py + ph + bubbleGap;
            tailUp = true;
          }

          // Speaker icon area (inside bubble, right side)
          const speakerX = bubbleX + bubbleW - bubblePaddingX - speakerSize;
          const speakerY = bubbleY + (bubbleH - speakerSize) / 2;

          // Draw bubble body
          roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleRadius);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw tail
          const attachY = tailUp ? bubbleY : bubbleY + bubbleH;
          drawBubbleTail(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp);
          drawTailStroke(ctx, bboxCenterX, attachY, tailWidth, tailHeight, tailUp, color);

          // Draw word text (bold, centered-ish, left-aligned with padding)
          ctx.fillStyle = '#333333';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(obj.name, bubbleX + bubblePaddingX, bubbleY + bubblePaddingY);

          // Draw phonetic text
          if (obj.phonetic) {
            ctx.fillStyle = '#888888';
            ctx.font = `${phoneticFontSize}px sans-serif`;
            ctx.fillText(
              obj.phonetic,
              bubbleX + bubblePaddingX,
              bubbleY + bubblePaddingY + lineHeight
            );
          }

          // Draw romaji text
          if (obj.romaji) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = `${romajiFontSize}px sans-serif`;
            ctx.fillText(
              obj.romaji,
              bubbleX + bubblePaddingX,
              bubbleY + bubblePaddingY + lineHeight + phoneticLineHeight
            );
          }

          // Draw speaker icon
          drawSpeakerIcon(ctx, speakerX, speakerY, speakerSize, color);

          // Store layout for click detection
          layouts.push({
            x: bubbleX,
            y: bubbleY,
            w: bubbleW,
            h: bubbleH,
            word: obj.name,
            tailUp,
            speakerArea: {
              x: speakerX,
              y: speakerY,
              w: speakerSize,
              h: speakerSize,
            },
          });
        }

        // 绘制动作标签（底部居中排列）
        if (actions && actions.length > 0) {
          const actionFontSize = fontSize;
          const actionPaddingX = 12;
          const actionPaddingY = 6;
          const actionRadius = 16;
          const actionGap = 8;
          const actionTopMargin = 10;

          // Calculate total width of all action labels
          ctx.font = `bold ${actionFontSize}px sans-serif`;
          const actionWidths = actions.map(a => ctx.measureText(a.name).width);
          const totalActionW = actionWidths.reduce((sum, w, i) =>
            sum + w + actionPaddingX * 2 + (i > 0 ? actionGap : 0), 0);
          const actionStartX = (canvas.width - totalActionW) / 2;
          const actionY = canvas.height - actionFontSize - actionPaddingY * 2 - actionTopMargin;

          let curX = actionStartX;
          for (let i = 0; i < actions.length; i++) {
            const act = actions[i];
            const aw = actionWidths[i] + actionPaddingX * 2;
            const ah = actionFontSize + actionPaddingY * 2;

            // Pill background
            roundRect(ctx, curX, actionY, aw, ah, actionRadius);
            ctx.fillStyle = 'rgba(255, 152, 0, 0.85)';
            ctx.fill();
            ctx.strokeStyle = '#E65100';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${actionFontSize}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(act.name, curX + actionPaddingX, actionY + ah / 2);

            // Speaker area for click detection
            layouts.push({
              x: curX,
              y: actionY,
              w: aw,
              h: ah,
              word: act.name,
              tailUp: false,
              speakerArea: { x: curX, y: actionY, w: aw, h: ah },
            });

            curX += aw + actionGap;
          }
        }

        bubbleLayoutsRef.current = layouts;
      };
      img.src = src;
    }, [dataUrl, objects, actions]);

    return (
      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '12px',
            display: 'block',
            margin: '0 auto',
            cursor: objects.length > 0 ? 'pointer' : 'default',
          }}
        />
        {objects.length === 0 && (
          <p
            style={{
              marginTop: '0.5rem',
              fontSize: '0.9rem',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>未识别到物体</span>
          </p>
        )}
      </div>
    );
  }
);

AnnotatedImage.displayName = 'AnnotatedImage';

export default AnnotatedImage;