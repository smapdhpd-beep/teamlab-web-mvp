/* ===== creature.js — 扫描涂鸦生成的粒子角色（MVP-4 修正：脱离-回归 + 物理接入） ===== */

class Creature {
  constructor(contourPoints) {
    this.points = contourPoints;
    this.particles = [];
    this.center = this.calculateCenter();
    this.detachTimer = 0; // 全局脱离计时器（任意粒子触发即全体脱离）

    for (let i = 0; i < this.points.length; i++) {
      let cp = this.points[i];
      let colArr = random(PALETTE);
      this.particles.push({
        pos: createVector(cp.x, cp.y),
        vel: createVector(0, 0),
        targetIndex: i,
        size: random(2, 5),
        col: color(colArr[0], colArr[1], colArr[2]),
      });
    }
  }

  calculateCenter() {
    let sum = createVector(0, 0);
    for (let p of this.particles) sum.add(p.pos);
    return p5.Vector.div(sum, max(this.particles.length, 1));
  }

  update() {
    // 更新几何中心
    this.center = this.calculateCenter();

    for (let p of this.particles) {
      let target = this.points[p.targetIndex];
      let targetPos = createVector(target.x, target.y);

      // === 1. 接入现有物理世界（内联 applyPhysics）===
      // 流动场
      if (window.flowField) {
        let flow = window.flowField.getForce(p.pos.x, p.pos.y);
        p.vel.lerp(flow, 0.03);
      }

      // 排斥（鼠标 / 手）
      if (window.mousePos) {
        let d = p5.Vector.dist(p.pos, window.mousePos);
        if (d < CONFIG.repelRadius) {
          let repel = p5.Vector.sub(p.pos, window.mousePos).normalize();
          repel.mult(CONFIG.repelStrength * map(d, 0, CONFIG.repelRadius, 1, 0, true));
          p.vel.add(repel);
        }
      }

      // 吸引（双手靠近）
      if (window.interactMode === 'attract' && window.interactPos) {
        let d = p5.Vector.dist(p.pos, window.interactPos);
        let force = p5.Vector.sub(window.interactPos, p.pos).normalize();
        force.mult(window.interactStrength * map(d, 0, 300, 1, 0, true));
        p.vel.add(force);
      }

      // 涟漪
      if (window.ripples) {
        for (let r of window.ripples) {
          let proxy = { pos: p.pos, vel: p.vel };
          r.affect(proxy);
        }
      }

      // === 2. 脱离-回归机制 ===
      if (p.vel.mag() > 1.5) {
        this.detachTimer = 60; // 60帧 ≈ 1秒
      }

      if (this.detachTimer > 0) {
        // 脱离期：只受物理力，不回归轮廓
      } else {
        // 回归期：向轮廓点缓慢回归（0.05→0.02，更松）
        let returnForce = p5.Vector.sub(targetPos, p.pos).mult(0.02);
        p.vel.add(returnForce);

        // 整体凝聚力：向中心微弱吸引，保持整体不散架
        let centerForce = p5.Vector.sub(this.center, p.pos).mult(0.005);
        p.vel.add(centerForce);

        // 到达后切换到下一个轮廓点
        if (p5.Vector.dist(p.pos, targetPos) < 3) {
          p.targetIndex = (p.targetIndex + 1) % this.points.length;
        }
      }

      p.vel.limit(4);
      p.pos.add(p.vel);
    }

    if (this.detachTimer > 0) this.detachTimer--;
  }

  // 异议 4：不切换 blendMode，由 sketch.js 统一在 ADD 层调用
  display() {
    // 骨架连线（faint）
    stroke(255, 255, 255, 20);
    strokeWeight(0.5);
    noFill();
    beginShape();
    for (let p of this.particles) {
      vertex(p.pos.x, p.pos.y);
    }
    endShape();

    // 粒子
    noStroke();
    for (let p of this.particles) {
      fill(red(p.col), green(p.col), blue(p.col), 150);
      circle(p.pos.x, p.pos.y, p.size);
    }
  }
}
