/* ===== interaction.js — 交互输入（Step 6） ===== */

window.mousePos = null;

// 鼠标
document.addEventListener('mousemove', (e) => {
  window.mousePos = createVector(e.clientX, e.clientY);
});

document.addEventListener('mouseleave', () => {
  window.mousePos = null;
});

// 触摸
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  if (t) window.mousePos = createVector(t.clientX, t.clientY);
}, { passive: false });

document.addEventListener('touchend', () => {
  window.mousePos = null;
});

document.addEventListener('touchcancel', () => {
  window.mousePos = null;
});
