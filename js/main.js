/* ===== main.js — 全局配置与设备检测 ===== */

const VERSION = '1.0.0';
const BUILD_DATE = '2026-06-22';

const isMobile = window.innerWidth < 768 ||
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0);

const particleCount = isMobile ? 500 : 1500;
const BG_ALPHA = 18;           // 残影强度：Step 3 调优，15→18 减少过曝叠加
const TARGET_FPS = 60;         // 目标帧率
const MIN_ACCEPTABLE_FPS = 30; // 最低可接受帧率

// 交互与物理参数（Step 2 暴露，方便微调）
const CONFIG = {
  repelRadius: 100,         // 排斥半径（px）
  repelStrength: 0.6,       // 排斥力度
  maxVelocity: 1.5,         // 最大速度上限
  lerpFactor: 0.08,         // 向 baseVel 回归系数
  baseAlpha: 200,           // 默认粒子透明度
  activeAlpha: 255,         // 靠近鼠标时透明度（更亮）
  // Step 6：双手吸引参数
  attractRadius: 300,       // 双手靠近触发吸引的阈值（px）
  attractStrengthMax: 2,    // 最大吸引力
  attractLerpFactor: 0.03,  // 吸引时回归更慢
  glowDiameter: 400,        // 中间光晕直径
  glowAlpha: 10,            // 中间光晕 alpha
  colorShiftRadius: 300,    // 染色影响半径
  colorShiftMax: 0.4,       // 最大染色强度
};

// 供性能自适应降级使用
let currentParticleCount = particleCount;
let fpsHistory = [];

/* ===== Hand Tracking 配置（Step 5） ===== */
const HAND_CONFIG = {
  modelComplexity: 0,        // 0=Lite
  videoWidth: 640,
  videoHeight: 480,
  maxNumHands: 1,
  detectionInterval: 1,      // 每 N 视频帧检测一次（动态降级）
  smoothAlpha: 0.5,          // 默认 EMA 系数（Step 6 调优：0.3→0.5 更跟手）
  smoothAlphaStatic: 0.08,   // 静止时 EMA 系数（更稳）
  staticThreshold: 2,        // px，静止判定阈值（更严格才算静止）
  staticFrames: 3,           // 连续几帧 < threshold 算静止
  moveThreshold: 10,         // px，移动判定切回高 α
  lostTimeout: 2000,         // ms，丢失回退 Mouse
  loadTimeout: 5000,         // ms，CDN/模型加载超时
};

/* ===== Ripple 配置（Step 7） ===== */
const RIPPLE_CONFIG = {
  maxRipples: 3,             // 同时存在上限
  maxRadius: 300,            // 扩散最大半径
  speed: 4,                  // 扩散速度
  strength: 1.5,             // 推力强度
  ringWidth: 60,             // 波前影响区域宽度
  color: [100, 220, 220],    // 淡青色
  alpha: 35,                 // 描边透明度
  strokeWeight: 1,           // 线宽
};

/* ===== FlowField 配置（Step 9） ===== */
const FLOW_CONFIG = {
  resolution: 20,            // 网格分辨率（px）
  noiseScale: 0.1,           // Perlin 噪声采样步长
  timeSpeed: 0.003,          // 时间维度演进速度
};

/* ===== Bloom 配置（Step 10） ===== */
const BLOOM_CONFIG = {
  enabled: true,             // 总开关
  scale: 4,                  // 降采样倍率（1/4 分辨率）
  radius: 20,                // 模糊半径（逻辑像素）
  strength: 0.6,             // 叠加透明度倍率
};
