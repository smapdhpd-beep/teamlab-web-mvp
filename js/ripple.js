/* ===== ripple.js — 涟漪/波动场（Step 7） ===== */

class Ripple {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.radius = 0;
    this.maxRadius = RIPPLE_CONFIG.maxRadius;
    this.speed = RIPPLE_CONFIG.speed;
    this.strength = RIPPLE_CONFIG.strength;
    this.active = true;
  }

  update() {
    this.radius += this.speed;
    if (this.radius > this.maxRadius) {
      this.active = false;
    }
  }

  /* ---- 波纹影响粒子 ----
     AABB 预筛选：轴对齐包围盒外直接跳过，避免 dist() 开销
  ---- */
  affect(particle) {
    if (!this.active) return;

    const maxReach = this.radius + RIPPLE_CONFIG.ringWidth;
    const dx = abs(particle.pos.x - this.pos.x);
    const dy = abs(particle.pos.y - this.pos.y);
    if (dx > maxReach || dy > maxReach) return;

    const d = p5.Vector.dist(this.pos, particle.pos);
    const diff = abs(d - this.radius);

    if (diff < RIPPLE_CONFIG.ringWidth) {
      const falloff = map(diff, 0, RIPPLE_CONFIG.ringWidth, 1, 0, true);
      const ageDecay = 1 - this.radius / this.maxRadius;
      let force = p5.Vector.sub(particle.pos, this.pos);
      force.normalize();
      force.mult(this.strength * falloff * ageDecay);
      particle.vel.add(force);
    }
  }

  /* ---- 波纹视觉：BLEND 模式，淡青色细环 ---- */
  display() {
    if (!this.active) return;
    noFill();
    const [rc, gc, bc] = RIPPLE_CONFIG.color;
    stroke(rc, gc, bc, RIPPLE_CONFIG.alpha);
    strokeWeight(RIPPLE_CONFIG.strokeWeight);
    circle(this.pos.x, this.pos.y, this.radius * 2);
  }
}
