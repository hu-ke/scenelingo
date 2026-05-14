import { useEffect, useRef, useCallback } from 'react';
import { useReview } from '../context/ReviewContext';

const CANVAS_WIDTH = 1200;
const SPACING = 16;

function getColumns(count: number): number {
  if (count <= 4) return 2;
  if (count <= 8) return 3;
  return 4;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function MergePage() {
  const { state, dispatch } = useReview();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { selectedPhotoIds, savedPhotos } = state;

  const selectedPhotos = savedPhotos.filter((p) => selectedPhotoIds.includes(p.id));

  const drawMergedCanvas = useCallback(async () => {
    if (selectedPhotos.length < 2 || !canvasRef.current) return;

    const photos = selectedPhotos;
    const cols = getColumns(photos.length);
    const rows = Math.ceil(photos.length / cols);
    const cellWidth = (CANVAS_WIDTH - SPACING * (cols + 1)) / cols;

    const images = await Promise.all(
      photos.map((p) => loadImage(p.annotatedDataUrl || p.dataUrl))
    );

    const displayHeights = images.map((img) => {
      const ratio = img.height / img.width;
      return cellWidth * ratio;
    });

    const rowHeights: number[] = [];
    for (let r = 0; r < rows; r++) {
      let maxH = 0;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < displayHeights.length) {
          maxH = Math.max(maxH, displayHeights[idx]);
        }
      }
      rowHeights.push(maxH);
    }

    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + SPACING * (rows + 1);

    const canvas = canvasRef.current;
    canvas.width = CANVAS_WIDTH;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let yOffset = SPACING;
    for (let r = 0; r < rows; r++) {
      const rowHeight = rowHeights[r];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= images.length) break;

        const img = images[idx];
        const x = SPACING + c * (cellWidth + SPACING);
        const imgHeight = displayHeights[idx];
        const y = yOffset + (rowHeight - imgHeight) / 2;

        ctx.drawImage(img, x, y, cellWidth, imgHeight);
      }
      yOffset += rowHeight + SPACING;
    }
  }, [selectedPhotos]);

  useEffect(() => {
    drawMergedCanvas();
  }, [drawMergedCanvas]);

  const handleBack = () => {
    dispatch({ type: 'clearSelection' });
    dispatch({ type: 'setPage', page: 'home' });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = formatDate(new Date());
      a.href = url;
      a.download = `SceneLingos_merge_1_${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  if (selectedPhotos.length < 2) {
    return (
      <div className="page merge-page">
        <div className="merge-page__back-row">
          <button className="secondary" onClick={handleBack}>← 返回</button>
        </div>
        <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            请至少选择 2 张照片进行合并
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page merge-page">
      <div className="merge-page__back-row">
        <button className="secondary" onClick={handleBack}>← 返回</button>
        <h1 style={{
          marginBottom: 0,
          background: 'linear-gradient(135deg, var(--color-primary), #6366f1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>照片合并预览</h1>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            display: 'block',
            height: 'auto',
          }}
        />
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button className="merge-download-btn" onClick={handleDownload}>
          下载导出
        </button>
      </div>
    </div>
  );
}