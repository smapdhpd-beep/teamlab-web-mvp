/* ===== sketch.js — p5.js global mode 主循环（Step 6 升级：双手模式） ===== */

let particles = [];
let creature = null;             // MVP-4：扫描生成的粒子角色
let ripples = [];             // Step 7：活跃波纹数组
const handStates = new Map(); // index -> { smoothed: Vector, staticFrames: number }
let handHoverTimer = 0;       // Step 7：Hand 悬停帧计数
const HAND_HOVER_THRESHOLD = 48; // 0.8s @ 60fps
let lastHoverPos = null;      // Step 7：上一帧悬停位置

// Step 8：光之网 — 空间索引网格
const grid = new Map();
const GRID_SIZE = 50;
const MAX_CONNECTIONS = 3;
const CONNECTION_MAX_DIST = 60;
const CONNECTION_MAX_ALPHA = 70;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 255);

  for (let i = 0; i < currentParticleCount; i++) {
    particles.push(new Particle());
  }

  window.flowField = new FlowField(); // Step 9：初始化流动场
  window.bloom = new Bloom();         // Step 10：初始化 Bloom
  window.scanner = new Scanner();     // MVP-4：初始化扫描器
  initHandTracking(); // Step 5：启动体感
}

function draw() {
  // MVP-4：扫描期间忽略手部输入
  if (window.isScanning) {
    window.handLandmarks = null;
  }

  // ===== 0. 手部数据处理：提取食指尖、EMA 平滑、模式判断 =====
  let interactMode = 'mouse';
  let interactPos = null;
  let interactStrength = 0;
  let interactPositions = [];

  if (window.handLandmarks && window.handLandmarks.length > 0) {
    const handPositions = []; // 平滑后的食指尖位置

    window.handLandmarks.forEach((landmarks, index) => {
      // 防御性：跳过不完整的 landmarks
      if (!landmarks || !landmarks[8] || typeof landmarks[8].x !== 'number') return;

      const tip = landmarks[8]; // INDEX_FINGER_TIP
      const raw = createVector((1 - tip.x) * width, tip.y * height);

      let state = handStates.get(index);
      if (!state) {
        state = { smoothed: raw.copy(), staticFrames: 0 };
        handStates.set(index, state);
      } else {
        const d = p5.Vector.dist(raw, state.smoothed);
        let alpha = HAND_CONFIG.smoothAlpha;
        // 快速移动直通：位移大时几乎无平滑，极跟手
        if (d > 20) {
          alpha = 0.85;
        } else if (d < HAND_CONFIG.staticThreshold) {
          state.staticFrames++;
          if (state.staticFrames > HAND_CONFIG.staticFrames) {
            alpha = HAND_CONFIG.smoothAlphaStatic;
          }
        } else {
          state.staticFrames = 0;
        }
        state.smoothed.lerp(raw, alpha);
      }

      handPositions.push(state.smoothed);
    });

    // 清理丢失的手（索引 >= 当前手数量）
    for (const key of handStates.keys()) {
      if (key >= window.handLandmarks.length) {
        handStates.delete(key);
      }
    }

    // 模式判断 + Step 7：Hand 悬停检测（主手）
    if (handPositions.length >= 1) {
      const mainHand = handPositions[0];
      let hoverDist = 999;
      if (lastHoverPos) {
        hoverDist = p5.Vector.dist(mainHand, lastHoverPos);
      }
      lastHoverPos = mainHand.copy();

      if (hoverDist < 5) {
        handHoverTimer++;
        if (handHoverTimer >= HAND_HOVER_THRESHOLD) {
          if (ripples.length < RIPPLE_CONFIG.maxRipples) {
            ripples.push(new Ripple(mainHand.x, mainHand.y));
          }
          handHoverTimer = 0;
        }
      } else {
        handHoverTimer = 0;
      }
    }

    // 模式判断
    if (handPositions.length === 1) {
      interactMode = 'repel';
      interactPositions = [handPositions[0]];
      window.mousePos = handPositions[0].copy();
    } else if (handPositions.length >= 2) {
      const p1 = handPositions[0];
      const p2 = handPositions[1];
      const d = p1.dist(p2);
      const mid = p5.Vector.add(p1, p2).mult(0.5);

      if (d < CONFIG.attractRadius) {
        interactMode = 'attract';
        interactPos = mid;
        interactStrength = map(d, 0, CONFIG.attractRadius, CONFIG.attractStrengthMax, 0, true);
        window.mousePos = mid.copy();
      } else {
        interactMode = 'repel';
        interactPositions = [p1, p2];
        window.mousePos = p1.copy();
      }
    }
  } else {
    handStates.clear();
    lastHoverPos = null;
    handHoverTimer = 0;
  }

  // Step 9：暴露主交互点给流动场扰动
  window.interactPos = interactPos || window.mousePos || null;

  // MVP-4：暴露交互状态给 Creature 物理系统
  window.interactMode = interactMode;
  window.interactStrength = interactStrength;
  window.interactPositions = interactPositions;

  // ===== 1. 正常混合模式清背景（产生拖尾） =====
  blendMode(BLEND);
  background(0, BG_ALPHA);

  // ===== 1.5 流动场更新（Step 9）=====
  if (window.flowField) {
    window.flowField.update();
  }

  // ===== 2. 波纹更新与绘制（BLEND 模式，在 ADD 粒子之前） =====
  blendMode(BLEND);
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].display();
    if (!ripples[i].active) {
      ripples.splice(i, 1);
    }
  }

  // ===== 3. 粒子连线 — 光之网（BLEND 模式，在 ADD 粒子之前） =====
  drawConnections();

  // ===== 3.5 Bloom 层生成（Step 10：在 ADD 粒子之前捕获本帧粒子状态） =====
  if (window.bloom) {
    window.bloom.render(particles);
  }

  // ===== 4. 吸引模式中间光晕（ADD + 径向渐变 + 呼吸脉动） =====
  // alpha 降半 + 正弦波动，避免恒定叠加导致长时间过曝
  if (interactMode === 'attract' && interactPos) {
    blendMode(ADD);
    noStroke();
    const ctx = drawingContext;
    const r = 280;
    // 呼吸系数：0.5 ~ 1.0 缓慢波动，让光晕有生命感
    const breathe = 0.6 + 0.4 * sin(frameCount * 0.04);
    const baseAlpha = (0.05 * breathe).toFixed(3);
    const grad = ctx.createRadialGradient(
      interactPos.x, interactPos.y, 0,
      interactPos.x, interactPos.y, r
    );
    grad.addColorStop(0, `rgba(255, 255, 255, ${baseAlpha})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(interactPos.x, interactPos.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 5. 加性混合画所有粒子 =====
  blendMode(ADD);

  for (let i = particles.length - 1; i >= 0; i--) {
    // Step 7：波纹影响粒子（在 update 之前施加推力）
    for (let r of ripples) {
      r.affect(particles[i]);
    }

    particles[i].update(interactMode, interactPos, interactStrength, interactPositions);
    particles[i].display(interactMode, interactPos);

    if (particles[i].dead) {
      particles.splice(i, 1);
    }
  }

  // ===== 4. 补充新粒子，保持总量恒定 =====
  while (particles.length < currentParticleCount) {
    let x, y;
    if (window.mousePos && random() < 0.5) {
      let angle = random(TWO_PI);
      let r = random(20, 100);
      x = constrain(window.mousePos.x + cos(angle) * r, 0, width);
      y = constrain(window.mousePos.y + sin(angle) * r, 0, height);
    } else {
      x = random(width);
      y = random(height);
    }
    particles.push(new Particle(x, y, true));
  }

  // ===== 5.5 粒子角色（MVP-4：在 ADD 层统一绘制）=====
  if (creature) {
    creature.update();
    creature.display();
  }

  // ===== 5.6 叠加 Bloom 辉光（Step 10）=====
  if (window.bloom) {
    window.bloom.display();
  }

  // ===== 6. 恢复默认混合，画 UI/FPS =====
  blendMode(BLEND);

  drawFPS();
  monitorPerformance();

  // 可选：调试显示流动场（按 D 键切换）
  if (window.showFlowField && window.flowField) {
    window.flowField.display();
  }
}

function keyPressed() {
  if (key === 'd' || key === 'D') {
    window.showFlowField = !window.showFlowField;
  }
  if (key === 'b' || key === 'B') {
    if (window.bloom) window.bloom.enabled = !window.bloom.enabled;
  }
  if (key === ' ') {
    // MVP-4：空格键扫描涂鸦
    if (!window.scanner) {
      console.log('[Scanner] Scanner not initialized');
      return;
    }
    if (!window.scanner.video) {
      console.log('[Scanner] Video not bound. Trying to bind window.handVideo...');
      if (window.handVideo) window.scanner.setVideo(window.handVideo);
    }
    if (!window.scanner.isReady()) {
      console.log('[Scanner] Camera not ready. readyState:', window.scanner.video?.readyState, 'videoWidth:', window.scanner.video?.videoWidth);
      return;
    }
    window.isScanning = true;
    window.handLandmarks = null;
    handStates.clear();
    let contour = window.scanner.capture();
    window.isScanning = false;
    if (contour.length > 10) {
      creature = new Creature(contour);
      console.log(`[Scanner] Creature created with ${contour.length} points`);
    } else {
      console.log('[Scanner] No contour found. Tips: black marker on white paper, good lighting, keep hands away.');
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (window.bloom) window.bloom.onResize();
  if (window.flowField) window.flowField.onResize();
}

/* ---- 鼠标点击产生波纹 ---- */
function mousePressed() {
  if (ripples.length < RIPPLE_CONFIG.maxRipples) {
    ripples.push(new Ripple(mouseX, mouseY));
  }
}

/* ---- 触摸点击产生波纹 ---- */
function touchStarted() {
  if (touches.length > 0 && ripples.length < RIPPLE_CONFIG.maxRipples) {
    ripples.push(new Ripple(touches[0].x, touches[0].y));
  }
  return false;
}

/* ---- 屏幕 FPS 仪表盘 ---- */
function drawFPS() {
  const fps = frameRate();
  fill(fps >= 55 ? '#00FF00' : fps >= 30 ? '#FFD700' : '#FF4444');
  noStroke();
  textAlign(RIGHT, TOP);
  textSize(14);
  const handStatus = window.handLandmarks ? `Hands: ${window.handLandmarks.length}` : 'Hands: 0';
  const rippleStatus = `Ripples: ${ripples.length}`;
  const flowStatus = window.flowField ? `Flow: ${FLOW_CONFIG.resolution.toFixed(0)}px` : 'Flow: off';
  const bloomStatus = (window.bloom && window.bloom.enabled) ? 'Bloom: on' : 'Bloom: off';
  text(`FPS: ${fps.toFixed(1)} | Particles: ${particles.length} | ${handStatus} | ${rippleStatus} | ${flowStatus} | ${bloomStatus}`, width - 10, 10);

  // Step 7：暴露悬停进度给 preview 窗口
  window.handHoverProgress = handHoverTimer / HAND_HOVER_THRESHOLD;

  // MVP-4：扫描提示
  if (window.isScanning) {
    fill(255, 255, 0);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('Scanning... Keep hands away', width / 2, height / 2);
  }

  // 按键提示
  fill(150);
  textAlign(RIGHT, TOP);
  textSize(12);
  text('[Space] Scan  [B] Bloom  [D] FlowField', width - 10, 30);
}

/* ---- 性能监控与自适应降级 ---- */
function monitorPerformance() {
  fpsHistory.push(frameRate());
  if (fpsHistory.length > 120) fpsHistory.shift();

  if (frameCount > 120 && frameCount % 60 === 0) {
    const avg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

    // Step 6：Hand 检测降频（fps < 40 优先降级）
    if (window.handLandmarks && avg < 40 && window.handDetectionInterval === 1) {
      window.handDetectionInterval = 2;
      console.warn(`[Performance] Hand detection downgraded to 1/2 (FPS ${avg.toFixed(1)})`);
    }

    // 粒子降级（既有逻辑，fps < 30）
    if (avg < MIN_ACCEPTABLE_FPS && particles.length > 300) {
      const removeCount = Math.floor(particles.length * 0.2);
      particles.splice(-removeCount);
      currentParticleCount = particles.length;
      console.warn(`[Performance] FPS ${avg.toFixed(1)} too low. Reduced particles to ${particles.length}`);
    }

    // Step 9：流动场分辨率降级
    if (avg < MIN_ACCEPTABLE_FPS && window.flowField && FLOW_CONFIG.resolution < 80) {
      FLOW_CONFIG.resolution = min(FLOW_CONFIG.resolution * 1.5, 80);
      window.flowField.onResize();
      console.warn(`[Performance] FlowField resolution degraded to ${FLOW_CONFIG.resolution}px (FPS ${avg.toFixed(1)})`);
    }

    // Step 10：Bloom 降级
    if (avg < MIN_ACCEPTABLE_FPS && window.bloom && window.bloom.enabled) {
      window.bloom.enabled = false;
      console.warn(`[Performance] Bloom disabled (FPS ${avg.toFixed(1)})`);
    }
  }
}

/* ===== Step 8：光之网 — 空间索引 + 邻近连线 ===== */

function updateGrid() {
  grid.clear();
  for (let p of particles) {
    let gx = floor(p.pos.x / GRID_SIZE);
    let gy = floor(p.pos.y / GRID_SIZE);
    let key = `${gx},${gy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
}

function getNearbyParticles(particle) {
  let gx = floor(particle.pos.x / GRID_SIZE);
  let gy = floor(particle.pos.y / GRID_SIZE);
  let nearby = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let key = `${gx + dx},${gy + dy}`;
      if (grid.has(key)) nearby.push(...grid.get(key));
    }
  }
  return nearby;
}

function drawConnections() {
  updateGrid();
  blendMode(BLEND);

  for (let p of particles) {
    if (p.lifeAlpha < 0.1) continue; // 濒死粒子不连线

    let nearby = getNearbyParticles(p);
    let candidates = [];

    for (let other of nearby) {
      if (other.index <= p.index) continue;           // 去重
      if (p.colorType !== other.colorType) continue;  // 只连同色
      if (other.lifeAlpha < 0.1) continue;            // 对方濒死跳过

      let d = p5.Vector.dist(p.pos, other.pos);
      if (d < CONNECTION_MAX_DIST) {
        candidates.push({ other, d });
      }
    }

    // 只取最近的 3 条
    candidates.sort((a, b) => a.d - b.d);
    candidates = candidates.slice(0, MAX_CONNECTIONS);

    for (let conn of candidates) {
      let other = conn.other;
      let d = conn.d;
      let lifeAlpha = min(p.lifeAlpha, other.lifeAlpha);
      let alpha = map(d, 0, CONNECTION_MAX_DIST, CONNECTION_MAX_ALPHA, 0, true) * lifeAlpha;
      if (alpha < 1) continue;

      let lineCol = lerpColor(p.col, other.col, 0.5);
      stroke(red(lineCol), green(lineCol), blue(lineCol), alpha);
      strokeWeight(0.5);
      line(p.pos.x, p.pos.y, other.pos.x, other.pos.y);
    }
  }
}
