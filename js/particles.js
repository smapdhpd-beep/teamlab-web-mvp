/* ===== particles.js — 粒子系统（Step 6 升级：双手吸引 + 距离染色） ===== */

const PALETTE = [
  [255, 105, 180], // HotPink 樱花粉
  [0, 255, 255],   // Cyan 青蓝
  [255, 215, 0],   // Gold 金
];
const GOLD = [255, 215, 0];

let globalParticleIndex = 0; // Step 8：全局索引，用于连线去重

class Particle {
  constructor(x, y, isNewborn = false) {
    this.index = globalParticleIndex++; // Step 8：唯一索引
    this.pos = x !== undefined ? createVector(x, y) : createVector(random(width), random(height));
    this.baseSpeed = random(0.3, 0.7);
    this.baseVel = p5.Vector.random2D().mult(this.baseSpeed);
    this.vel = this.baseVel.copy();
    this.size = random(1.5, 4);
    this.colorType = floor(random(3)); // Step 8：0=粉, 1=青, 2=金
    this.col = color(...PALETTE[this.colorType]);
    this.isNearMouse = false;

    // 生命周期
    this.lifespan = isNewborn ? 30 : random(100, 255);
    this.lifeRate = random(0.5, 2);
    this.isNewborn = isNewborn;
    this.dead = false;
    this.lifeAlpha = 1; // Step 8：初始可见
  }

  update(mode, attractPos, attractStrength, repelPositions) {
    this.isNearMouse = false;

    if (mode === 'attract' && attractPos) {
      // ---- 吸引力：指向双手中点 ----
      let d = p5.Vector.dist(this.pos, attractPos);
      let force = p5.Vector.sub(attractPos, this.pos);
      force.normalize();
      force.mult(attractStrength * map(d, 0, 300, 1, 0, true));
      this.vel.add(force);

      this.vel.limit(CONFIG.maxVelocity);
      this.vel.lerp(this.baseVel, CONFIG.attractLerpFactor); // 回归更慢
      this.isNearMouse = d < 100;
    } else if (mode === 'repel' && repelPositions && repelPositions.length > 0) {
      // ---- 多点排斥（双手远距离 或 单手） ----
      for (const pos of repelPositions) {
        let d = p5.Vector.dist(this.pos, pos);
        if (d < CONFIG.repelRadius) {
          this.isNearMouse = true;
          let falloff = map(d, 0, CONFIG.repelRadius, 1, 0);
          falloff = constrain(falloff, 0, 1);
          let force = p5.Vector.sub(this.pos, pos);
          force.normalize();
          force.mult(CONFIG.repelStrength * falloff);
          this.vel.add(force);
        }
      }
      this.vel.limit(CONFIG.maxVelocity);
      this.vel.lerp(this.baseVel, CONFIG.lerpFactor);
    } else {
      // ---- Mouse / Touch fallback ----
      if (window.mousePos) {
        let d = p5.Vector.dist(this.pos, window.mousePos);
        if (d < CONFIG.repelRadius) {
          this.isNearMouse = true;
          let falloff = map(d, 0, CONFIG.repelRadius, 1, 0);
          falloff = constrain(falloff, 0, 1);
          let force = p5.Vector.sub(this.pos, window.mousePos);
          force.normalize();
          force.mult(CONFIG.repelStrength * falloff);
          this.vel.add(force);
        }
      }
      this.vel.limit(CONFIG.maxVelocity);
      this.vel.lerp(this.baseVel, CONFIG.lerpFactor);
    }

    // ---- 流动场驱动 baseVel（Step 9）----
    if (window.flowField) {
      let flowForce = window.flowField.getForce(this.pos.x, this.pos.y);
      this.baseVel.lerp(flowForce, 0.05);
      this.baseVel.normalize().mult(this.baseSpeed);
    }

    // ---- 位置更新 ----
    this.pos.add(this.vel);

    // ---- 边界环绕 ----
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;

    // ---- 生命周期 ----
    if (this.isNewborn) {
      this.lifespan += this.lifeRate * 2;
      if (this.lifespan >= 255) this.isNewborn = false;
    } else {
      this.lifespan -= this.lifeRate;
    }

    if (this.lifespan <= 0) {
      this.dead = true;
    }

    // Step 8：存储生命周期透明度，供连线系统读取
    this.lifeAlpha = map(this.lifespan, 0, 255, 0, 1, true);
  }

  display(mode, attractPos) {
    let displayCol = this.col;

    // ---- 吸引模式距离衰减染色 ----
    if (mode === 'attract' && attractPos) {
      const d = p5.Vector.dist(this.pos, attractPos);
      if (d < CONFIG.colorShiftRadius) {
        const goldCol = color(...GOLD);
        let lerpAmt = map(d, 100, CONFIG.colorShiftRadius, CONFIG.colorShiftMax, 0, true);
        if (d < 100) lerpAmt = CONFIG.colorShiftMax;
        displayCol = lerpColor(this.col, goldCol, lerpAmt);
      }
    }

    const r = red(displayCol);
    const g = green(displayCol);
    const b = blue(displayCol);
    let lifeAlpha = map(this.lifespan, 0, 255, 0, 1, true);

    noStroke();

    // 中层光晕
    fill(r, g, b, 40 * lifeAlpha);
    circle(this.pos.x, this.pos.y, this.size * 2.5);

    // 核心亮点（Step 10：亮度让渡给 Bloom，120→80 / 180→120）
    let coreAlpha = this.isNearMouse ? 120 : 80;
    fill(r, g, b, coreAlpha * lifeAlpha);
    circle(this.pos.x, this.pos.y, this.size);
  }
}
