/* ===== scanner.js — 摄像头涂鸦扫描（MVP-4 修正：骨架采样，扫描顺序连接） ===== */

class Scanner {
  constructor() {
    this.video = null;
    this.scanCanvas = document.createElement('canvas');
    this.scanCanvas.width = 320;
    this.scanCanvas.height = 240;
    this.scanCtx = this.scanCanvas.getContext('2d', { willReadFrequently: true });
    // 扫描中心区域：240×180（从 320×240 正中央截取，覆盖 3/4 画面）
    this.centerX = 40;
    this.centerY = 30;
    this.cw = 240;
    this.ch = 180;
  }

  setVideo(video) { this.video = video; }

  isReady() {
    return this.video && this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  capture() {
    if (!this.isReady()) return [];
    try {
      this.scanCtx.drawImage(this.video, 0, 0, 320, 240);
    } catch (err) {
      console.warn('[Scanner] drawImage failed:', err);
      return [];
    }

    let imgData = this.scanCtx.getImageData(0, 0, 320, 240);
    let pixels = imgData.data;

    // 自适应阈值（统计扫描区域）
    let sum = 0, count = 0;
    for (let y = this.centerY; y < this.centerY + this.ch; y += 2) {
      for (let x = this.centerX; x < this.centerX + this.cw; x += 2) {
        let i = (y * 320 + x) * 4;
        sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        count++;
      }
    }
    let mean = sum / count;
    let threshold = mean * 0.6;

    // 1. 收集黑色像素（中心区域，步长 1px 保留细节）
    let rawPoints = [];
    for (let y = this.centerY; y < this.centerY + this.ch; y++) {
      for (let x = this.centerX; x < this.centerX + this.cw; x++) {
        let i = (y * 320 + x) * 4;
        let b = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (b < threshold) rawPoints.push({ x, y });
      }
    }
    if (rawPoints.length < 20) {
      console.log('[Scanner] Too few dark pixels. Try thicker black lines or better lighting.');
      return [];
    }

    // 2. 2px 网格聚类去重（保留线条细节）
    let grid = new Map();
    for (let p of rawPoints) {
      let gx = Math.floor(p.x / 2);
      let gy = Math.floor(p.y / 2);
      let key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, p);
    }
    let skeleton = Array.from(grid.values());
    if (skeleton.length < 10) return [];

    // 性能保护：超过 800 点均匀降采样
    if (skeleton.length > 800) {
      let step = skeleton.length / 800;
      let sampled = [];
      for (let i = 0; i < 800; i++) {
        sampled.push(skeleton[Math.floor(i * step)]);
      }
      skeleton = sampled;
    }

    // 3. 取消最近邻排序：直接按扫描顺序（行优先）连接
    // 这样避免了分叉结构被乱跳成斜线的问题
    // 行优先顺序对连续笔画足够好，且不会跨分叉乱连

    // 4. letterbox 映射到画布坐标
    let scale = min(width / 320, height / 240);
    let offsetX = (width - 320 * scale) / 2;
    let offsetY = (height - 240 * scale) / 2;
    return skeleton.map(p => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY
    }));
  }
}
