import { getWaypoints, getCategories, getMapState, saveMapState, getSettings } from './store.js';

let _openWaypointModal = () => {};
export function setWaypointModalOpener(fn) { _openWaypointModal = fn; }

let canvas, ctx;
let state = { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }; // rotation: 0,1,2,3 (×90deg)
let drag = { active: false, startX: 0, startY: 0, origOX: 0, origOY: 0 };
let pinch = { active: false, lastDist: 0 };

const GRID_BASE = 16;
const PIN_R = 7;

export function initMap(canvasEl) {
  canvas = canvasEl;
  ctx    = canvas.getContext('2d');
  const saved = getMapState();
  state  = { ...state, ...saved };
  resizeCanvas();
  bindEvents();
  render();
}

export function refreshMap() { render(); }

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width  || window.innerWidth;
  const h = rect.height || window.innerHeight - 60;
  // CSS 表示サイズと Canvas 解像度を分離して維持する
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width  = w;
  canvas.height = h;
}

// ---- coordinate helpers ----
function worldToScreen(wx, wz) {
  const rad  = (state.rotation * 90 * Math.PI) / 180;
  const cos  = Math.cos(rad), sin = Math.sin(rad);
  const rx   = wx * cos - wz * sin;
  const rz   = wx * sin + wz * cos;
  return {
    x: canvas.width  / 2 + rx * state.scale + state.offsetX,
    y: canvas.height / 2 + rz * state.scale + state.offsetY,
  };
}

function screenToWorld(sx, sy) {
  const rx   = (sx - canvas.width  / 2 - state.offsetX) / state.scale;
  const rz   = (sy - canvas.height / 2 - state.offsetY) / state.scale;
  const rad  = -(state.rotation * 90 * Math.PI) / 180;
  const cos  = Math.cos(rad), sin = Math.sin(rad);
  return {
    x: Math.round(rx * cos - rz * sin),
    z: Math.round(rx * sin + rz * cos),
  };
}

// ---- center coord ----
function getCenterWorld() { return screenToWorld(canvas.width / 2, canvas.height / 2); }

function updateCenterDisplay() {
  const c   = getCenterWorld();
  const el  = document.getElementById('center-coords');
  if (el) el.textContent = `X: ${c.x}  Z: ${c.z}`;
}

// ---- テーマ色定義 ----
const THEMES = {
  dark: {
    bg:          '#0a120a',
    grid:        'rgba(100,120,100,0.12)',
    gridChunk:   'rgba(100,120,100,0.28)',
    origin:      'rgba(255,215,0,0.8)',
    pinStroke:   '#fff',
    labelFill:   '#fff',
    labelStroke: 'rgba(0,0,0,0.7)',
  },
  light: {
    bg:          '#f5f5f0',
    grid:        'rgba(120,130,120,0.25)',
    gridChunk:   'rgba(80,100,80,0.55)',
    origin:      'rgba(200,140,0,0.9)',
    pinStroke:   '#fff',
    labelFill:   '#1a1a1a',
    labelStroke: 'rgba(255,255,255,0.85)',
  },
};

function getTheme() {
  const t = getSettings().mapTheme;
  return THEMES[t] || THEMES.dark;
}

// ---- render ----
function render() {
  const theme = getTheme();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(theme);
  drawOrigin(theme);
  drawWaypoints(theme);
  drawCenterMarker(theme);
  updateCenterDisplay();
  // map-area 背景も CSS クラスで切り替え
  const isLight = (getSettings().mapTheme === 'light');
  canvas.parentElement.classList.toggle('map-light', isLight);
  saveMapState({ ...state });
}

function drawGrid(theme) {
  const settings = getSettings();
  if (!settings.showGrid) return;

  const step = GRID_BASE * state.scale;
  if (step < 4) return;

  ctx.save();
  ctx.lineWidth = 0.5;

  const cw = canvas.width, ch = canvas.height;
  const extra = Math.max(cw, ch);

  // draw unrotated grid lines, then rotate canvas
  ctx.translate(cw / 2 + state.offsetX, ch / 2 + state.offsetY);
  ctx.rotate((state.rotation * 90 * Math.PI) / 180);

  const span = extra * 2;
  const startI = Math.floor(-span / step);
  const endI   = Math.ceil(span / step);

  for (let i = startI; i <= endI; i++) {
    const pos = i * step;
    // chunk border emphasis (every 16 blocks = 1 chunk, only when showChunks is enabled)
    const isChunkBorder = settings.showChunks && (i % 16 === 0);
    ctx.strokeStyle = isChunkBorder ? theme.gridChunk : theme.grid;
    ctx.beginPath(); ctx.moveTo(pos, -span); ctx.lineTo(pos, span); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-span, pos); ctx.lineTo(span, pos); ctx.stroke();
  }
  ctx.restore();
}

function drawOrigin(theme) {
  const p = worldToScreen(0, 0);
  ctx.save();
  ctx.strokeStyle = theme.origin;
  ctx.lineWidth   = 1.5;
  const s = 10;
  ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
  ctx.restore();
}

function drawCenterMarker(theme) {
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const arm = 10;
  const gap = 3;
  const r   = 2.5;
  const color = theme.origin;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  // 横線（中央ギャップあり）
  ctx.beginPath(); ctx.moveTo(cx - arm, cy); ctx.lineTo(cx - gap, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + arm, cy); ctx.stroke();
  // 縦線（中央ギャップあり）
  ctx.beginPath(); ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy - gap); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + arm); ctx.stroke();
  // 中心の小円
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawWaypoints(theme) {
  const waypoints  = getWaypoints();
  const categories = getCategories();
  const settings   = getSettings();
  const catMap     = Object.fromEntries(categories.map(c => [c.id, c]));

  for (const wp of waypoints) {
    const cat  = catMap[wp.categoryId] || { color: '#90A4AE', icon: '📍' };
    const pos  = worldToScreen(wp.x, wp.z);
    const r    = PIN_R;

    // pin circle
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 4;
    ctx.fillStyle     = cat.color;
    ctx.strokeStyle   = theme.pinStroke;
    ctx.lineWidth     = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // label
    if (settings.showLabels && state.scale > 0.4) {
      ctx.save();
      ctx.font         = `bold ${Math.min(12, 10 + state.scale)}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle    = theme.labelFill;
      ctx.strokeStyle  = theme.labelStroke;
      ctx.lineWidth    = 3;
      ctx.strokeText(wp.name, pos.x, pos.y - r - 2);
      ctx.fillText(wp.name,   pos.x, pos.y - r - 2);
      ctx.restore();
    }
  }
}

// ---- event binding ----
function bindEvents() {
  // mouse
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel',      onWheel, { passive: false });
  canvas.addEventListener('dblclick',   onDblClick);

  // touch
  canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',    onTouchEnd);

  // resize: windowリサイズとサイドバーアニメーションの両方に対応
  window.addEventListener('resize', () => { resizeCanvas(); render(); });

  // ResizeObserver でサイドバー開閉の CSS transition 中も逃さずリサイズ
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { resizeCanvas(); render(); });
    ro.observe(canvas.parentElement);
  }
}

function onMouseDown(e) {
  drag = { active: true, startX: e.clientX, startY: e.clientY, origOX: state.offsetX, origOY: state.offsetY };
}
function onMouseMove(e) {
  if (!drag.active) return;
  state.offsetX = drag.origOX + (e.clientX - drag.startX);
  state.offsetY = drag.origOY + (e.clientY - drag.startY);
  render();
}
function onMouseUp(e) {
  drag.active = false;
}

function onWheel(e) {
  e.preventDefault();
  const factor   = e.deltaY < 0 ? 1.1 : 0.9;
  const newScale = Math.min(20, Math.max(0.05, state.scale * factor));
  const actual   = newScale / state.scale; // クランプ考慮の実際倍率
  // offsetX/Y を同じ刀率で調整することで画面中心のワールド座標が不変になる
  state.offsetX *= actual;
  state.offsetY *= actual;
  state.scale    = newScale;
  render();
}

function onDblClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  // check if near a pin
  const waypoints = getWaypoints();
  for (const wp of waypoints) {
    const pos = worldToScreen(wp.x, wp.z);
    const dx  = mx - pos.x, dy = my - pos.y;
    if (dx * dx + dy * dy < (PIN_R + 6) ** 2) {
      _openWaypointModal(wp);
      return;
    }
  }
  // new waypoint at that world coord
  const w = screenToWorld(mx, my);
  _openWaypointModal(null, { x: w.x, y: 64, z: w.z });
}

// touch helpers
function getTouchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    drag = { active: true, startX: t.clientX, startY: t.clientY, origOX: state.offsetX, origOY: state.offsetY };
    pinch.active = false;
  } else if (e.touches.length === 2) {
    drag.active  = false;
    pinch = { active: true, lastDist: getTouchDist(e.touches[0], e.touches[1]) };
  }
}
function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1 && drag.active) {
    const t = e.touches[0];
    state.offsetX = drag.origOX + (t.clientX - drag.startX);
    state.offsetY = drag.origOY + (t.clientY - drag.startY);
    render();
  } else if (e.touches.length === 2 && pinch.active) {
    const dist     = getTouchDist(e.touches[0], e.touches[1]);
    const factor   = dist / pinch.lastDist;
    const newScale = Math.min(20, Math.max(0.05, state.scale * factor));
    const actual   = newScale / state.scale;
    state.offsetX *= actual;
    state.offsetY *= actual;
    state.scale    = newScale;
    pinch.lastDist = dist;
    render();
  }
}
function onTouchEnd(e) {
  if (e.touches.length === 0) {
    drag.active  = false;
    pinch.active = false;
    // tap detection for pin
    if (e.changedTouches.length === 1) {
      const t    = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const mx   = t.clientX - rect.left, my = t.clientY - rect.top;
      const waypoints = getWaypoints();
      for (const wp of waypoints) {
        const pos = worldToScreen(wp.x, wp.z);
        const dx  = mx - pos.x, dy = my - pos.y;
        if (dx * dx + dy * dy < (PIN_R + 10) ** 2) {
          _openWaypointModal(wp);
          return;
        }
      }
    }
  }
}

// ---- public controls ----
export function rotateMap() {
  state.rotation = (state.rotation + 1) % 4;
  render();
}

export function resetMapView() {
  state.offsetX = 0; state.offsetY = 0; state.scale = 1; state.rotation = 0;
  render();
}

export function jumpToWaypoint(wp) {
  state.offsetX = 0; state.offsetY = 0;
  const p = worldToScreen(wp.x, wp.z);
  state.offsetX = canvas.width  / 2 - p.x;
  state.offsetY = canvas.height / 2 - p.y;
  render();
}
