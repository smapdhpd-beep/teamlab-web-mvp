/* ===== bloom.js — Bloom 后处理辉光（Step 10：屏幕空间弥散） ===== */

class Bloom {
  constructor() {
    // 检测 ctx.filter 支持性（异议 5）
    let testCanvas = document.createElement('canvas');
    let testCtx = testCanvas.getContext('2d');
    this.filterSupported = typeof testCtx.filter !== 'undefined';

    if (!this.filterSupported) {
      this.enabled = false;
      console.warn('[Bloom] Disabled: ctx.filter not supported by this browser');
      return;
    }

    this.enabled = BLOOM_CONFIG.enabled;
    this.scale = BLOOM_CONFIG.scale;
    this.radius = BLOOM_CONFIG.radius;

    this.initGraphics();
  }

  initGraphics() {
    this.offscreen = createGraphics(width / this.scale, height / this.scale);
  }

  onResize() {
    if (!this.filterSupported) return;
    this.initGraphics();
  }

  render(particles) {
    if (!this.enabled || !this.offscreen) return;

    // 异议 2：纯黑背景，禁止 clear() 导致的透明脏雾
    this.offscreen.background(0);
    this.offscreen.blendMode(ADD);

    for (let p of particles) {
      // 异议 7：坐标按 scale 缩放
      let x = p.pos.x / this.scale;
      let y = p.pos.y / this.scale;
      let size = p.size * 3 / this.scale;

      // 异议 4：无硬阈值，按 lifeAlpha 平滑衰减
      this.offscreen.noStroke();
      this.offscreen.fill(
        red(p.col),
        green(p.col),
        blue(p.col),
        150 * p.lifeAlpha
      );
      this.offscreen.circle(x, y, size);
    }

    this.offscreen.blendMode(BLEND);

    // 在降采样画布上模糊，半径按比例缩小
    let blurRadius = this.radius / this.scale;
    this.offscreen.filter(BLUR, blurRadius);
  }

  display() {
    if (!this.enabled || !this.offscreen) return;

    // 通过 tint 控制叠加强度
    tint(255, 255 * BLOOM_CONFIG.strength);
    image(this.offscreen, 0, 0, width, height);
    noTint();
  }
}
