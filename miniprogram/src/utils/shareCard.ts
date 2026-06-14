import Taro from '@tarojs/taro';

const CARD_WIDTH = 500;
const CARD_HEIGHT = 400;
const CARD_RADIUS = 20;

function drawRoundedRect(
  ctx: Taro.CanvasContext,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

/**
 * 在 Canvas 上绘制分享卡片
 * 调用方需要先准备好 Canvas 组件（canvasId），绘制后导出临时文件路径
 */
export function drawShareCard(ctx: Taro.CanvasContext): void {
  // 1. 绘制整体圆角背景（渐变蓝色）
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  gradient.addColorStop(0, '#4A90D9');
  gradient.addColorStop(1, '#7EC8E3');
  ctx.setFillStyle(gradient);
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();

  // 2. 绘制白色半透明内框卡片，增加层次感
  const innerMargin = 24;
  const innerX = innerMargin;
  const innerY = innerMargin;
  const innerW = CARD_WIDTH - innerMargin * 2;
  const innerH = CARD_HEIGHT - innerMargin * 2;
  const innerRadius = 14;

  ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
  ctx.fill();

  // 3. 绘制装饰圆点（右上角）
  ctx.setFillStyle('rgba(255, 255, 255, 0.3)');
  ctx.beginPath();
  ctx.arc(CARD_WIDTH - 60, 60, 40, 0, 2 * Math.PI);
  ctx.fill();
  ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
  ctx.beginPath();
  ctx.arc(CARD_WIDTH - 30, 100, 25, 0, 2 * Math.PI);
  ctx.fill();

  // 4. 绘制装饰圆点（左下角）
  ctx.setFillStyle('rgba(255, 255, 255, 0.2)');
  ctx.beginPath();
  ctx.arc(50, CARD_HEIGHT - 80, 30, 0, 2 * Math.PI);
  ctx.fill();

  // 5. 绘制小程序名称「场景外语」
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(40);
  ctx.setTextAlign('center');
  ctx.fillText('场景外语', CARD_WIDTH / 2, 160);

  // 6. 绘制 Slogan
  ctx.setFontSize(18);
  ctx.setFillStyle('rgba(255, 255, 255, 0.85)');
  ctx.fillText('拍照学外语，所见即所学', CARD_WIDTH / 2, 200);

  // 7. 绘制功能引导语分隔线
  const guideY = 270;
  ctx.setStrokeStyle('rgba(255, 255, 255, 0.3)');
  ctx.setLineWidth(1);
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2 - 180, guideY - 15);
  ctx.lineTo(CARD_WIDTH / 2 + 180, guideY - 15);
  ctx.stroke();

  // 8. 绘制功能引导语
  ctx.setFontSize(16);
  ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
  ctx.fillText('📸 拍张照  →  🔍 识别物品  →  📝 学习单词', CARD_WIDTH / 2, guideY + 15);

  // 9. 绘制底部装饰 — 简化的相机图标示意
  const camCenterX = CARD_WIDTH / 2;
  const camY = 340;
  const camSize = 36;

  // 相机机身
  ctx.setFillStyle('rgba(255, 255, 255, 0.25)');
  drawRoundedRect(ctx, camCenterX - camSize / 2 - 2, camY - camSize / 2, camSize + 4, camSize * 0.8, 6);
  ctx.fill();
  // 相机顶部突起
  ctx.setFillStyle('rgba(255, 255, 255, 0.25)');
  drawRoundedRect(ctx, camCenterX - 10, camY - camSize / 2 - 6, 20, 8, 3);
  ctx.fill();
  // 镜头（圆形）
  ctx.setFillStyle('rgba(255, 255, 255, 0.35)');
  ctx.beginPath();
  ctx.arc(camCenterX, camY - 4, 10, 0, 2 * Math.PI);
  ctx.fill();
  // 镜头内部高光
  ctx.setFillStyle('rgba(255, 255, 255, 0.5)');
  ctx.beginPath();
  ctx.arc(camCenterX, camY - 4, 5, 0, 2 * Math.PI);
  ctx.fill();

  // 10. 底部提示文字
  ctx.setFontSize(13);
  ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
  ctx.fillText('点击拍照，开启你的外语学习之旅', CARD_WIDTH / 2, CARD_HEIGHT - 24);
}

/**
 * 生成分享卡片并导出为临时图片文件
 * @param canvasId Canvas 组件的 canvas-id
 * @returns 临时图片文件路径
 */
export function generateShareCardImage(canvasId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const ctx = Taro.createCanvasContext(canvasId);
    if (!ctx) {
      reject(new Error('创建画布失败'));
      return;
    }

    drawShareCard(ctx);

    ctx.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId,
        x: 0,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH * 2,
        destHeight: CARD_HEIGHT * 2,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(new Error(err.errMsg || '导出分享卡片失败')),
      });
    });
  });
}