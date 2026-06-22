/* ===== flowfield.js — 流动场（Step 9：Perlin 噪声驱动有机漂移） ===== */

class FlowField {
  constructor() {
    this.initDimensions();
    window.addEventListener('resize', () => this.onResize());
  }

  initDimensions() {
    this.cols = floor(width / FLOW_CONFIG.resolution) + 1;
    this.rows = floor(height / FLOW_CONFIG.resolution) + 1;
    this.field = new Float32Array(this.cols * this.rows);
    this.zoff = 0;
  }

  onResize() {
    this.initDimensions();
  }

  update() {
    let yoff = 0;
    for (let y = 0; y < this.rows; y++) {
      let xoff = 0;
      for (let x = 0; x < this.cols; x++) {
        let angle = noise(xoff, yoff, this.zoff) * TWO_PI * 2;
        let idx = y * this.cols + x;
        this.field[idx] = angle;
        xoff += FLOW_CONFIG.noiseScale;
      }
      yoff += FLOW_CONFIG.noiseScale;
    }

    // 扰动：交互点附近角度偏移（在场更新层做，保持 getForce 只读）
    if (window.interactPos) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          let px = x * FLOW_CONFIG.resolution + FLOW_CONFIG.resolution * 0.5;
          let py = y * FLOW_CONFIG.resolution + FLOW_CONFIG.resolution * 0.5;
          let d = dist(px, py, window.interactPos.x, window.interactPos.y);
          if (d < 100) {
            let idx = y * this.cols + x;
            let perturb = map(d, 0, 100, HALF_PI, 0, true);
            this.field[idx] += perturb;
          }
        }
      }
    }

    this.zoff += FLOW_CONFIG.timeSpeed;
  }

  getForce(x, y) {
    let col = x / FLOW_CONFIG.resolution;
    let row = y / FLOW_CONFIG.resolution;

    let c0 = floor(col);
    let c1 = min(c0 + 1, this.cols - 1);
    let r0 = floor(row);
    let r1 = min(r0 + 1, this.rows - 1);

    let tCol = col - c0;
    let tRow = row - r0;

    let a00 = this.field[r0 * this.cols + c0];
    let a01 = this.field[r0 * this.cols + c1];
    let a10 = this.field[r1 * this.cols + c0];
    let a11 = this.field[r1 * this.cols + c1];

    let a0 = a00 + (a01 - a00) * tCol;
    let a1 = a10 + (a11 - a10) * tCol;
    let angle = a0 + (a1 - a0) * tRow;

    return p5.Vector.fromAngle(angle).mult(0.3);
  }

  display() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        let idx = y * this.cols + x;
        let angle = this.field[idx];
        let px = x * FLOW_CONFIG.resolution;
        let py = y * FLOW_CONFIG.resolution;
        let v = p5.Vector.fromAngle(angle).mult(FLOW_CONFIG.resolution * 0.4);
        stroke(100, 100, 100, 30);
        strokeWeight(1);
        line(px, py, px + v.x, py + v.y);
      }
    }
  }
}
