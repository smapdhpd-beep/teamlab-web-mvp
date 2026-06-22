/* ===== hand-tracking.js — MediaPipe Hands 体感输入（Step 6 升级：双手） ===== */

window.handLandmarks = null;  // 原始 MediaPipe 结果（每只手 21 个点的数组）
window.handDetectionInterval = 1;

let _skipCounter = 0;

function initHandTracking() {
  if (typeof isMobile !== 'undefined' && isMobile) {
    console.log('[Hand] Mobile detected, skip hand tracking.');
    return;
  }

  // 5 秒超时静默降级
  const timeoutId = setTimeout(() => {
    if (!window.handLandmarks) {
      console.warn('[Hand] MediaPipe load timeout. Fallback to mouse.');
    }
  }, HAND_CONFIG.loadTimeout);

  // 隐藏视频元素（只取数据，不渲染）
  const video = document.createElement('video');
  // MVP-4 修复：不用 display:none，某些浏览器禁止对 display:none 视频 drawImage
  video.style.cssText = 'opacity:0;position:fixed;pointer-events:none;width:1px;height:1px;left:-9999px;top:-9999px;';
  video.width = HAND_CONFIG.videoWidth;
  video.height = HAND_CONFIG.videoHeight;
  document.body.appendChild(video);
  window.handVideo = video; // MVP-4：暴露给扫描器
  if (window.scanner) window.scanner.setVideo(video);

  const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});

  hands.setOptions({
    maxNumHands: 2,  // Step 6：双手
    modelComplexity: HAND_CONFIG.modelComplexity,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    clearTimeout(timeoutId);

    // 防御性过滤：只保留至少有 21 个点且食指尖存在的 landmarks
    const validLandmarks = (results.multiHandLandmarks || []).filter(
      (lm) => lm && lm.length >= 21 && lm[8] && typeof lm[8].x === 'number'
    );

    window.handLandmarks = validLandmarks.length > 0 ? validLandmarks : null;

    try {
      drawPreview(results, validLandmarks);
    } catch (err) {
      console.warn('[Hand] Preview draw error:', err);
    }
  });

  let isProcessing = false;
  const camera = new Camera(video, {
    onFrame: async () => {
      if (isProcessing) return;
      _skipCounter++;
      if (_skipCounter % window.handDetectionInterval !== 0) return;

      isProcessing = true;
      try {
        await hands.send({image: video});
      } catch (err) {
        console.warn('[Hand] Send error:', err);
      }
      isProcessing = false;
    },
    width: HAND_CONFIG.videoWidth,
    height: HAND_CONFIG.videoHeight,
  });

  camera.start().catch((err) => {
    clearTimeout(timeoutId);
    console.warn('[Hand] Camera failed:', err);
    window.handLandmarks = null;
  });
}

/* ---- 预览窗口绘制（160×120，手骨架 + 食指尖红圈） ---- */
function drawPreview(results, validLandmarks) {
  const canvas = document.getElementById('previewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  // 镜像绘制（像照镜子）
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);

  // 视频帧背景
  if (results.image) {
    ctx.drawImage(results.image, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  }

  // 手骨架（只画已过滤的有效 landmarks）
  if (validLandmarks && validLandmarks.length > 0) {
    for (const landmarks of validLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS,
        {color: '#00FF00', lineWidth: 1});
      drawLandmarks(ctx, landmarks,
        {color: '#00FF00', lineWidth: 0.5, radius: 2});

      // 红圈高亮食指尖（已确认 lm[8] 存在）
      const tip = landmarks[8];
      const tx = tip.x * w;
      const ty = tip.y * h;
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // Step 7：悬停倒计时指示器（右下角小圆，逐渐变大变亮）
  const progress = window.handHoverProgress || 0;
  if (progress > 0) {
    const cx = w - 12;
    const cy = h - 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + progress * 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100, 220, 220, ${0.2 + progress * 0.6})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(100, 220, 220, ${0.4 + progress * 0.6})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
