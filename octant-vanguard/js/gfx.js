/* Octant Vanguard — procedural graphics: noise, planets, nebulae, ships, aliens, portraits */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* ---------- 3D value noise (seamless on cylinders) ---------- */
function makeNoise3(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512), vals = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = rnd() * (i + 1) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rnd();
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const s = t => t * t * (3 - 2 * t);
  const n = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi, u = s(xf), v = s(yf), w = s(zf);
    const a = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
    const b = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
    return lerp(a, b, w);
  };
  n.fbm = (x, y, z, oct = 5) => { let sum = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { sum += n(x * f, y * f, z * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return sum / norm; };
  return n;
}

/* ---------- Glow sprites ---------- */
const _glowCache = new Map();
function glowSprite(color, size = 64) {
  const key = color + size;
  let c = _glowCache.get(key);
  if (c) return c;
  c = makeCanvas(size * 2, size * 2);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size, size, 0, size, size, size);
  gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.25, rgba(color, 0.55)); gr.addColorStop(0.6, rgba(color, 0.12)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size * 2, size * 2);
  _glowCache.set(key, c);
  return c;
}
function drawGlow(ctx, color, x, y, r, a = 1) {
  if (a <= 0.01 || r <= 0.5) return;
  const s = glowSprite(color, 64);
  ctx.globalAlpha = a;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ---------- Stars & nebula ---------- */
function makeStarTile(size, count, maxR, seed, tint) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, s = Math.pow(r(), 3) * maxR + 0.4;
    const hue = r();
    const col = hue < 0.15 ? '#ffd9a8' : hue < 0.3 ? '#a8c8ff' : tint || '#ffffff';
    g.globalAlpha = 0.35 + r() * 0.65;
    if (s > 1.4) { g.drawImage(glowSprite(col, 32), x - s * 3, y - s * 3, s * 6, s * 6); }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, s * 0.6, 0, TAU); g.fill();
  }
  return c;
}
let STARS = null;
function initStars() { STARS = [makeStarTile(512, 260, 1.1, 1), makeStarTile(512, 90, 1.8, 2), makeStarTile(512, 26, 2.6, 3, '#dfe8ff')]; }
const _nebCache = new Map();
function makeNebula(cols, seed) {
  const key = cols.join() + seed;
  if (_nebCache.has(key)) return _nebCache.get(key);
  const S = 768, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = '#03040b'; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const x = r() * S, y = r() * S, rad = 60 + r() * 260, col = cols[i % cols.length];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.05 + r() * 0.12;
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // dust lanes
  const M = 160, mask = makeCanvas(M, M), mg = mask.getContext('2d'), n = makeNoise3(seed + 7);
  const img = mg.createImageData(M, M), d = img.data;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const v = n.fbm(x / 29, y / 29, 0.5, 4);
    const k = clamp(0.4 + (v - 0.42) * 2.2, 0.25, 1) * 255;
    const i = (y * M + x) * 4;
    d[i] = k; d[i + 1] = k; d[i + 2] = Math.min(255, k * 1.08); d[i + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.imageSmoothingEnabled = true;
  g.drawImage(mask, 0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  _nebCache.set(key, c);
  return c;
}

/* ---------- Planets ---------- */
function planetTexture(P) {
  if (P._tex) return P._tex;
  const W = 384, H = 192, c = makeCanvas(W, H), g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const n = makeNoise3(P.seed), n2 = makeNoise3(P.seed * 3 + 1);
  const pal = P.pal.map(hexRgb), R = 1.7;
  const rnd = mulberry32(P.seed * 13);
  for (let y = 0; y < H; y++) {
    const lat = (y / H) * 2 - 1, al = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const th = x / W * TAU, cx = Math.cos(th) * R, cy = Math.sin(th) * R, cz = (y / H) * Math.PI * R;
      const v = n.fbm(cx, cy, cz, 5);
      let col;
      switch (P.style) {
        case 'terran': case 'capital': {
          const land = v > 0.5;
          if (!land) col = mixRgb(pal[0], [40, 120, 170], clamp((v - 0.3) * 3, 0, 1) * 0.6);
          else col = mixRgb(pal[1], pal[2], clamp((v - 0.5) * 4, 0, 1));
          if (land && v > 0.66) col = mixRgb(col, pal[3], (v - 0.66) * 3);
          if (al > 0.82) col = mixRgb(col, [240, 248, 255], clamp((al - 0.82) * 8, 0, 1));
          const cl = n2.fbm(cx * 1.6, cy * 1.6, cz * 2.2, 4);
          if (cl > 0.55) col = mixRgb(col, [255, 255, 255], clamp((cl - 0.55) * 3, 0, 0.85));
          if (P.style === 'capital' && land && n2(cx * 9, cy * 9, cz * 9) > 0.72) col = mixRgb(col, [255, 220, 140], 0.7);
          break;
        }
        case 'lava': {
          const ridge = 1 - Math.abs(2 * n2.fbm(cx * 1.3, cy * 1.3, cz * 1.3, 4) - 1);
          col = mixRgb(pal[0], pal[1], v);
          if (ridge > 0.82) col = mixRgb(pal[2], pal[3], clamp((ridge - 0.82) * 6, 0, 1));
          else if (ridge > 0.74) col = mixRgb(col, pal[2], (ridge - 0.74) * 6);
          break;
        }
        case 'ocean': {
          col = mixRgb(pal[0], pal[1], clamp(v * 1.4 - 0.2, 0, 1));
          if (v > 0.66) col = mixRgb([214, 200, 150], [70, 150, 80], clamp((v - 0.66) * 6, 0, 1));
          const sw = n2.fbm(cx * 1.2 + v * 2, cy * 1.2, cz * 1.8, 4);
          if (sw > 0.52) col = mixRgb(col, pal[3], clamp((sw - 0.52) * 2.6, 0, 0.9));
          break;
        }
        case 'metal': {
          col = mixRgb(pal[0], pal[2], v * 0.8);
          const gx = (x / W * 64) % 1, gy = (y / H * 32) % 1;
          if (gx < 0.08 || gy < 0.08) col = mixRgb(col, pal[0], 0.7);
          if (n2(cx * 12, cy * 12, cz * 12) > 0.8 && gx > 0.3 && gy > 0.3) col = mixRgb(col, pal[3], 0.85);
          break;
        }
        case 'ice': {
          col = mixRgb(pal[1], pal[2], v);
          const ridge = 1 - Math.abs(2 * n2.fbm(cx * 2, cy * 2, cz * 2, 4) - 1);
          if (ridge > 0.9) col = mixRgb(col, pal[0], (ridge - 0.9) * 8);
          if (al > 0.7) col = mixRgb(col, pal[3], clamp((al - 0.7) * 4, 0, 1));
          break;
        }
        case 'dark': {
          col = mixRgb(pal[0], pal[1], v);
          const ridge = 1 - Math.abs(2 * n2.fbm(cx * 1.5, cy * 1.5, cz * 1.5, 4) - 1);
          if (ridge > 0.88) col = mixRgb(col, pal[2], (ridge - 0.88) * 7);
          break;
        }
        case 'gas': {
          const band = Math.sin(lat * 13 + v * 5) * 0.5 + 0.5;
          const t2 = clamp(band * 0.8 + (n2.fbm(cx * 3, cy * 0.5, cz * 3, 3) - 0.5), 0, 1);
          const k = t2 * 3, i0 = Math.min(2, k | 0);
          col = mixRgb(pal[i0], pal[i0 + 1], k - i0);
          // storm spot
          const dx = (x / W - 0.3) * 4, dy = (lat - 0.25) * 6, sd = dx * dx + dy * dy;
          if (sd < 1) col = mixRgb(col, [200, 80, 90], (1 - sd) * 0.6);
          break;
        }
        case 'paper': {
          // pastel paper patches with inked outlines, fold creases and tiny stars
          const grain = 0.93 + n2.fbm(cx * 3, cy * 3, cz * 3, 3) * 0.1;
          col = v > 0.6 ? pal[3] : v > 0.52 ? pal[2] : v > 0.44 ? pal[1] : pal[0];
          if (Math.min(Math.abs(v - 0.44), Math.abs(v - 0.52), Math.abs(v - 0.6)) < 0.007) col = [120, 96, 140];
          col = col.map(c => Math.min(255, c * grain));
          const f1 = (x / W * 6 + y / H * 3) % 1, f2 = ((x / W * 6 - y / H * 3) % 1 + 1) % 1;
          if (f1 < 0.012 || f2 < 0.012) col = mixRgb(col, [140, 120, 150], 0.3);
          if (n2(cx * 14, cy * 14, cz * 14) > 0.86) col = [255, 214, 90];
          break;
        }
        default: col = pal[1];
      }
      const i = (y * W + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // wrap copy so any half-width window is contiguous
  const wrap = makeCanvas(W * 1.5 | 0, H), wg = wrap.getContext('2d');
  wg.drawImage(c, 0, 0); wg.drawImage(c, W, 0);
  P._tex = wrap; P._texW = W;
  return wrap;
}
function drawRings(ctx, P, x, y, r, front) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.35); ctx.scale(1, 0.32);
  ctx.beginPath();
  if (front) ctx.rect(-r * 2.6, 0, r * 5.2, r * 2.6); else ctx.rect(-r * 2.6, -r * 2.6, r * 5.2, r * 2.6);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const rr = r * (1.4 + i * 0.17);
    ctx.strokeStyle = rgba(i % 2 ? P.pal[3] : P.pal[2], 0.22 + (i % 3) * 0.1);
    ctx.lineWidth = r * (0.08 - i * 0.008);
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
/* rot: radians of spin. strips: slice count for sphere warp. */
const TEX_BUDGET = { n: 1 };
function drawPlanet(ctx, P, x, y, r, rot, strips = 36, opts = {}) {
  if (!P._tex) {
    if (TEX_BUDGET.n > 0) { TEX_BUDGET.n--; planetTexture(P); }
    else { // placeholder until the texture is generated on a later frame
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, P.pal[2]); g.addColorStop(1, P.pal[0]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      return;
    }
  }
  const tex = P._tex, W = P._texW, H = tex.height;
  if (P.ring) drawRings(ctx, P, x, y, r, false);
  // atmosphere halo
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, P.atmo, x, y, r * 1.55, opts.dim ? 0.18 : 0.42);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  const base = ((rot / TAU) % 1 + 1) % 1 * W;
  for (let i = 0; i < strips; i++) {
    const x0 = -r + (i / strips) * 2 * r, x1 = -r + ((i + 1) / strips) * 2 * r;
    const l0 = Math.asin(clamp(x0 / r, -1, 1)), l1 = Math.asin(clamp(x1 / r, -1, 1));
    const sx = base + (l0 + Math.PI / 2) / TAU * W, sw = Math.max(0.5, (l1 - l0) / TAU * W);
    ctx.drawImage(tex, sx, 0, sw, H, x + x0, y - r, (x1 - x0) + 0.6, r * 2);
  }
  // shading: light from upper-left (Hesper)
  const lx = -0.55, ly = -0.45;
  const sh = ctx.createRadialGradient(x + lx * r * 0.6, y + ly * r * 0.6, r * 0.05, x, y, r * 1.08);
  sh.addColorStop(0, 'rgba(255,255,240,0.10)');
  sh.addColorStop(0.45, 'rgba(0,0,10,0)');
  sh.addColorStop(0.8, 'rgba(0,0,14,0.55)');
  sh.addColorStop(1, 'rgba(0,0,16,0.92)');
  ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (opts.damage) { ctx.fillStyle = `rgba(255,40,60,${opts.damage})`; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  // rim light
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(P.atmo, 0.55); ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth * 0.5, Math.PI * 0.85, Math.PI * 1.65); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  if (P.ring) drawRings(ctx, P, x, y, r, true);
}

/* ---------- Ships ---------- */
const SCHEMES = [
  { hull1: '#ffe2a0', hull2: '#a8621a', edge: '#fff3d0', inner: '#2b1f14', cockpit: '#7ff3ff', flame: '#6fd2ff', shield: '#ffd36b', name: 'Gold' },
  { hull1: '#a6fff0', hull2: '#1a7c86', edge: '#e6fffb', inner: '#10262a', cockpit: '#ffe27f', flame: '#ffb46b', shield: '#6fffe6', name: 'Teal' },
  { hull1: '#ffb3ec', hull2: '#8a2470', edge: '#ffe6f8', inner: '#2a1024', cockpit: '#b6ff8a', flame: '#ff8ad8', shield: '#ff9ae6', name: 'Rose' },
  { hull1: '#ddff9e', hull2: '#4f7c18', edge: '#f4ffe0', inner: '#1a240c', cockpit: '#ff9ef0', flame: '#c6ff6b', shield: '#d4ff8a', name: 'Lime' },
];
function octPath(ctx, r, rot = Math.PI / 8, cx = 0, cy = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
}
function drawFlame(ctx, x, y, len, w, col, t) {
  const fl = len * (0.85 + Math.sin(t * 60 + x) * 0.08 + Math.random() * 0.12);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x - fl, y);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, rgba(col, 0.8)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, y - w); ctx.quadraticCurveTo(x - fl * 0.5, y - w * 0.6, x - fl, y); ctx.quadraticCurveTo(x - fl * 0.5, y + w * 0.6, x, y + w); ctx.fill();
  drawGlow(ctx, col, x - 2, y, w * 3.2, 0.7);
  ctx.globalCompositeOperation = 'source-over';
}
function drawVanguard(ctx, x, y, ang, sc, t, thrust, boost, shieldA, hit, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale);
  const L = 8 + thrust * 16 + (boost ? 30 : 0);
  if (thrust > 0.02 || boost) {
    drawFlame(ctx, -20, -8, L, 5, boost ? '#cfe9ff' : sc.flame, t);
    drawFlame(ctx, -20, 8, L, 5, boost ? '#cfe9ff' : sc.flame, t);
  } else {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sc.flame, -21, -8, 6, 0.5); drawGlow(ctx, sc.flame, -21, 8, 6, 0.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  // wings
  ctx.fillStyle = sc.hull2; ctx.strokeStyle = sc.edge; ctx.lineWidth = 1.2;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-14, s * 14); ctx.lineTo(4, s * 18); ctx.lineTo(-4, s * 30); ctx.lineTo(-18, s * 28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sc.cockpit; ctx.globalAlpha = 0.8 + Math.sin(t * 6) * 0.2; ctx.fillRect(-12, s * 26 - 1.5, 6, 3); ctx.globalAlpha = 1; ctx.fillStyle = sc.hull2;
  }
  // cannons
  ctx.fillStyle = '#3c3a40';
  ctx.fillRect(10, -10, 16, 4); ctx.fillRect(10, 6, 16, 4);
  ctx.fillStyle = sc.edge; ctx.fillRect(24, -10, 3, 4); ctx.fillRect(24, 6, 3, 4);
  // hull
  const g = ctx.createLinearGradient(-20, -20, 20, 20);
  g.addColorStop(0, sc.hull1); g.addColorStop(1, sc.hull2);
  ctx.fillStyle = g; octPath(ctx, 21); ctx.fill();
  ctx.strokeStyle = sc.edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = sc.inner; octPath(ctx, 12.5); ctx.fill();
  ctx.strokeStyle = rgba(sc.edge, 0.5); ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12.5, Math.sin(a) * 12.5); ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); ctx.stroke(); }
  // core
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, sc.cockpit, 0, 0, 16, 0.55 + Math.sin(t * 3) * 0.15);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = sc.cockpit; octPath(ctx, 5.5, Math.PI / 8 + t); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; octPath(ctx, 2.2, Math.PI / 8 - t * 2); ctx.fill();
  if (hit > 0) { ctx.globalAlpha = hit; ctx.fillStyle = '#ffffff'; octPath(ctx, 22); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
  if (shieldA > 0.02) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(sc.shield, Math.min(0.9, shieldA)); ctx.lineWidth = 1.6;
    octPath(ctx, 36, t * 0.6); ctx.stroke();
    ctx.globalAlpha = Math.min(1, shieldA * 0.6);
    ctx.fillStyle = rgba(sc.shield, 0.06); octPath(ctx, 36, t * 0.6); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
function drawWingman(ctx, w, t) {
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.ang);
  if (w.kind === 'fighter') {
    drawFlame(ctx, -14, 0, 14 + (w.thrust || 0.5) * 12, 4, '#ffb347', t);
    const g = ctx.createLinearGradient(-14, 0, 18, 0); g.addColorStop(0, '#a85a12'); g.addColorStop(1, '#ffe08a');
    ctx.fillStyle = g; ctx.strokeStyle = '#fff2c4'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-12, -15); ctx.lineTo(-6, 0); ctx.lineTo(-12, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7ff3ff'; ctx.beginPath(); ctx.ellipse(5, 0, 5, 2.5, 0, 0, TAU); ctx.fill();
  } else if (w.kind === 'drone') {
    ctx.rotate(-w.ang);
    ctx.fillStyle = '#4a5270'; ctx.strokeStyle = '#c9d2ff'; ctx.lineWidth = 1.2;
    octPath(ctx, 9, t); ctx.fill(); ctx.stroke();
    ctx.rotate(w.aim || 0);
    ctx.fillStyle = '#8f9bd0'; ctx.fillRect(2, -2, 12, 4);
    if (w.twin) ctx.fillRect(2, -6, 10, 2.5), ctx.fillRect(2, 3.5, 10, 2.5);
    ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#7f9bff', 0, 0, 10, 0.8); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e0e8ff'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
  } else if (w.kind === 'hoppling' || w.kind === 'hopper') {
    ctx.rotate(-w.ang);
    const sd = w.seed || 0, hop = Math.abs(Math.sin(t * 5 + sd)) * 5, flip = Math.cos(t * 1.3 + sd);
    ctx.translate(0, -hop);
    ctx.scale((0.3 + 0.7 * Math.abs(flip)) * 1.3, 1.3);
    drawHoppling(ctx, t + sd, w.scarf || (w.kind === 'hopper' ? '#ffd84f' : '#8fd3ff'), flip < 0);
  } else if (w.kind === 'spore') {
    ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#c77dff', -8, 0, 22, 0.5); ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(4, 0, 2, 0, 0, 18); g.addColorStop(0, '#f0c8ff'); g.addColorStop(1, '#5a1c8a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.bezierCurveTo(8, -14, -14, -12, -16, 0); ctx.bezierCurveTo(-14, 12, 8, 14, 18, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(240,200,255,0.6)'; ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-10, s * 6); ctx.quadraticCurveTo(-22, s * (14 + Math.sin(t * 5) * 4), -30, s * 10); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(255,220,255,${0.5 + 0.5 * Math.sin(t * 4 + i)})`; ctx.beginPath(); ctx.arc(-6 + i * 6, (i % 2 ? 3 : -3), 1.6, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------- Aliens ---------- */
function drawAlien(ctx, e, t) {
  const T = ENEMY_TYPES[e.type], tt = t + (e.seed || 0);
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, T.glow, e.x, e.y, T.r * (T.boss ? 2.4 : 2.6), T.boss ? 0.55 : 0.4);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang || 0);
  const r = T.r;
  switch (e.type) {
    case 'skitter': {
      ctx.strokeStyle = '#2fbf62'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) {
        const k = Math.sin(tt * 22 + i * 2 + (s > 0 ? Math.PI : 0)) * 4;
        ctx.beginPath(); ctx.moveTo(i * 5, s * 5); ctx.quadraticCurveTo(i * 5 + k, s * 14, i * 7 - 4 + k, s * 17); ctx.stroke();
      }
      const g = ctx.createRadialGradient(4, 0, 1, 0, 0, r); g.addColorStop(0, '#d6ffe0'); g.addColorStop(0.4, '#3dcf6e'); g.addColorStop(1, '#0c3a1e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a2414'; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r - 8, -3); ctx.lineTo(-r - 8, 3); ctx.fill();
      ctx.fillStyle = '#eaff7a'; ctx.beginPath(); ctx.arc(r * 0.55, -3, 2, 0, TAU); ctx.arc(r * 0.55, 3, 2, 0, TAU); ctx.fill();
      break;
    }
    case 'spitter': {
      ctx.strokeStyle = 'rgba(190,120,255,0.75)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i - 2.5) * 0.32, w = Math.sin(tt * 6 + i) * 6;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        ctx.quadraticCurveTo(Math.cos(a) * r * 1.5 + w, Math.sin(a) * r * 1.5 - w, Math.cos(a) * r * 2.1, Math.sin(a) * r * 2.1 + w); ctx.stroke();
      }
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, r); g.addColorStop(0, '#f2d8ff'); g.addColorStop(0.45, '#9a4dff'); g.addColorStop(1, '#2a0a52');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1 + Math.sin(tt * 4) * 0.05), 0, TAU); ctx.fill();
      const open = 0.25 + (e.charge || 0) * 0.5;
      ctx.fillStyle = '#12021f'; ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.arc(r * 0.3, 0, r * 0.7, -open, open); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#c6ff5c', r * 0.6, 0, 6 + (e.charge || 0) * 10, 0.9); ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'brute': {
      ctx.fillStyle = '#3a0618';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.15) * r, Math.sin(a - 0.15) * r); ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.lineTo(Math.cos(a + 0.15) * r, Math.sin(a + 0.15) * r); ctx.fill(); }
      for (let i = 3; i >= 0; i--) {
        const rr = r * (1 - i * 0.18), g = ctx.createRadialGradient(-rr * 0.2, -rr * 0.3, 1, 0, 0, rr);
        g.addColorStop(0, i === 0 ? '#ffb0c8' : '#e0457a'); g.addColorStop(1, '#4a0820');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-i * 5, 0, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,160,200,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ff2a2a', r * 0.6, -7, 9, 1); drawGlow(ctx, '#ff2a2a', r * 0.6, 7, 9, 1);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'leech': {
      for (let i = 5; i >= 0; i--) {
        const off = Math.sin(tt * 9 - i * 0.9) * 5 * (i / 5);
        const rr = r * (1 - i * 0.12);
        const g = ctx.createRadialGradient(-i * 9, off - 2, 1, -i * 9, off, rr);
        g.addColorStop(0, '#d8fffb'); g.addColorStop(0.5, '#28c8c0'); g.addColorStop(1, '#063a3a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-i * 9, off, rr, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#d8fffb'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(r * 0.7 + Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
      break;
    }
    case 'weaver': {
      ctx.strokeStyle = 'rgba(255,150,230,0.6)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const y0 = (i - 3.5) * 4.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, y0);
        for (let k = 1; k <= 4; k++) ctx.lineTo(-r * 0.6 - k * 12, y0 + Math.sin(tt * 4 + k + i) * 5);
        ctx.stroke();
      }
      const pul = 1 + Math.sin(tt * 3) * 0.08;
      const g = ctx.createRadialGradient(4, 0, 2, 0, 0, r * pul); g.addColorStop(0, '#fff0fb'); g.addColorStop(0.5, '#ff6fd4'); g.addColorStop(1, 'rgba(90,10,70,0.9)');
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = r * pul * (1 + Math.sin(a * 6 + tt * 5) * 0.06); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(5, 0, 4, 0, TAU); ctx.fill();
      break;
    }
    case 'hivemother': {
      ctx.strokeStyle = 'rgba(120,255,90,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, w = Math.sin(tt * 2 + i) * 18;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        ctx.quadraticCurveTo(Math.cos(a + 0.2) * r * 1.4 + w, Math.sin(a + 0.2) * r * 1.4, Math.cos(a + 0.35) * r * 1.85, Math.sin(a + 0.35) * r * 1.85 + w); ctx.stroke();
      }
      const pul = 1 + Math.sin(tt * 2.2) * 0.04;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + 0.3, g = ctx.createRadialGradient(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 2, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.55);
        g.addColorStop(0, '#e8ffd0'); g.addColorStop(1, '#2a5a10');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.55 * pul, 0, TAU); ctx.fill();
      }
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 0.6); g.addColorStop(0, '#fbffb0'); g.addColorStop(1, '#3c8a1a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.6 * pul, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; drawGlow(ctx, '#d4ff4a', Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 16 + Math.sin(tt * 5 + i) * 5, 0.8); }
      drawGlow(ctx, '#ffffff', 0, 0, 20, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'maw': {
      ctx.rotate(tt * 0.6);
      ctx.fillStyle = '#2a0604';
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r); ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); ctx.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); ctx.fill(); }
      const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r); g.addColorStop(0, '#120000'); g.addColorStop(0.55, '#7a1408'); g.addColorStop(0.9, '#ff6a3a'); g.addColorStop(1, '#3a0804');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.rotate(-tt * 1.4);
      ctx.fillStyle = '#ffe2c8';
      for (let ring = 0; ring < 2; ring++) {
        const rr = r * (0.62 - ring * 0.2), n = 14 - ring * 4;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + ring * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.15) * rr, Math.sin(a - 0.15) * rr); ctx.lineTo(Math.cos(a) * rr * 0.72, Math.sin(a) * rr * 0.72); ctx.lineTo(Math.cos(a + 0.15) * rr, Math.sin(a + 0.15) * rr); ctx.fill(); }
      }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
      break;
    }
    case 'blotling': {
      ctx.rotate(-(e.ang || 0));
      ctx.fillStyle = '#2a1840';
      for (let i = 0; i < 3; i++) { const dd = (tt * 26 + i * 9) % 26; ctx.globalAlpha = 1 - dd / 26; ctx.beginPath(); ctx.arc((i - 1) * r * 0.5, r * 0.8 + dd * 0.6, Math.max(0.5, 2.8 - dd / 10), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, rr = r * (1 + Math.sin(a * 3 + tt * 6) * 0.1 + Math.sin(a * 5 - tt * 4) * 0.06); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.92); }
      const gb = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.1); gb.addColorStop(0, '#6a4a9a'); gb.addColorStop(0.5, '#2a1840'); gb.addColorStop(1, '#120a20');
      ctx.fillStyle = gb; ctx.fill(); ctx.strokeStyle = 'rgba(176,107,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.12, -0.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#d08bff', -r * 0.32, 0, 6, 0.9); drawGlow(ctx, '#d08bff', r * 0.32, 0, 6, 0.9); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffe6ff';
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -3); ctx.lineTo(-r * 0.12, 0); ctx.lineTo(-r * 0.5, 2.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.55, -3); ctx.lineTo(r * 0.12, 0); ctx.lineTo(r * 0.5, 2.5); ctx.fill();
      break;
    }
    case 'scrawl': {
      ctx.rotate(-(e.ang || 0));
      const rs = mulberry32(((e.id || 1) * 97) | 0);
      ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 26; i++) { const a = rs() * TAU + tt * (rs() - 0.5) * 2, rr = r * (0.3 + rs() * 0.9); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.strokeStyle = '#3d2a5a'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(176,107,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      const ea = e.ang || 0;
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 5 + (e.charge || 0) * 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1840'; ctx.beginPath(); ctx.arc(Math.cos(ea) * 3, Math.sin(ea) * 2.5, 2.7, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#fff3b0', 0, 0, 10 + (e.charge || 0) * 8, 0.45); ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'inkwraith': {
      ctx.rotate(-(e.ang || 0));
      ctx.globalAlpha = e.ghost > 0 ? 0.28 : 1;
      for (let i = 0; i < 5; i++) { const a = tt * 1.2 + i / 5 * TAU; ctx.fillStyle = '#2a1840'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r - r * 0.1, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-r * 0.8, 0);
      ctx.bezierCurveTo(-r * 0.9, -r * 1.25, r * 0.9, -r * 1.25, r * 0.8, 0);
      for (let i = 0; i <= 8; i++) { const x = r * 0.8 - (i / 8) * r * 1.6; ctx.lineTo(x * (1 + Math.sin(tt * 2 + i) * 0.06), r * 0.9 + Math.sin(tt * 3 + i * 1.3) * r * 0.14 + (i % 2 ? -r * 0.24 : 0)); }
      ctx.closePath();
      const gw = ctx.createLinearGradient(0, -r, 0, r); gw.addColorStop(0, '#2e1d52'); gw.addColorStop(0.7, '#120a22'); gw.addColorStop(1, 'rgba(18,10,34,0.65)');
      ctx.fillStyle = gw; ctx.fill(); ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#120a22';
      for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.3 - 7, -r * 0.84); ctx.lineTo(s * r * 0.3, -r * (s ? 1.22 : 1.42)); ctx.lineTo(s * r * 0.3 + 7, -r * 0.84); ctx.fill(); }
      const ey = e.eye || 0, lx = Math.cos(ey) * 6, ly = Math.sin(ey) * 4;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ff7ad8', -r * 0.28 + lx, -r * 0.35 + ly, 16, 0.9); drawGlow(ctx, '#ff7ad8', r * 0.28 + lx, -r * 0.35 + ly, 16, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffe6fa';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.28 + lx, -r * 0.35 + ly, 8, 3.5, s * 0.25, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#ff7ad8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, -r * 0.05 + ly, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'nullheart': {
      ctx.rotate(-(e.ang || 0));
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ff2a6a', 0, 0, r * 2.6, 0.5 + Math.sin(tt * 3) * 0.1);
      drawGlow(ctx, '#8a4dff', 0, 0, r * 1.8, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) {
        const a = tt * 0.8 + i / 6 * TAU, d = r * 1.45;
        ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(a + tt);
        ctx.fillStyle = '#05000a'; ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,140,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,100,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * (0.85 + Math.sin(tt * 4) * 0.04), 0, TAU); ctx.stroke();
      const ea = e.eye || 0;
      ctx.fillStyle = '#ff2a6a'; ctx.beginPath(); ctx.ellipse(Math.cos(ea) * r * 0.35, Math.sin(ea) * r * 0.35, r * 0.2, r * 0.08 + Math.abs(Math.sin(tt * 0.7)) * r * 0.1, ea, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#ff4a8a', Math.cos(ea) * r * 0.35, Math.sin(ea) * r * 0.35, r * 0.4, 0.9); ctx.globalCompositeOperation = 'source-over';
      break;
    }
  }
  ctx.restore();
  if (e.hit > 0) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#ffffff', e.x, e.y, r * 1.5, e.hit * 0.9); ctx.globalCompositeOperation = 'source-over'; }
  if (e.slow > 0) {
    ctx.fillStyle = 'rgba(210,140,255,0.7)';
    for (let i = 0; i < 4; i++) { const a = tt * 3 + i * 1.57; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r * 1.1, e.y + Math.sin(a) * r * 1.1, 2.2, 0, TAU); ctx.fill(); }
  }
}

/* ---------- Asteroids ---------- */
function makeRockShape(seed, r) {
  const rnd = mulberry32(seed), pts = [];
  const n = 9 + (rnd() * 5 | 0);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; const rr = r * (0.72 + rnd() * 0.35); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return pts;
}
function drawRock(ctx, a, tint) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
  const g = ctx.createLinearGradient(-a.r, -a.r, a.r, a.r);
  g.addColorStop(0, tint[0]); g.addColorStop(1, tint[1]);
  ctx.fillStyle = g; ctx.beginPath(); a.pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(a.r * 0.2, a.r * 0.15, a.r * 0.22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-a.r * 0.3, -a.r * 0.25, a.r * 0.13, 0, TAU); ctx.fill();
  if (a.fuel) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#ff9a3c', 0, 0, a.r * 0.7, 0.35 + Math.sin(a.rot * 8) * 0.1); ctx.globalCompositeOperation = 'source-over'; }
  if (a.hit > 0) { ctx.globalAlpha = a.hit * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); a.pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

/* ---------- Portraits (holographic comm feed) ---------- */
function drawPortrait(ctx, who, W, H, t, talking) {
  const ch = CHARACTERS[who] || CHARACTERS.sys, col = ch.color;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  octPath(ctx, W * 0.53, Math.PI / 8, W / 2, H / 2); ctx.clip();
  const bg = ctx.createRadialGradient(W / 2, H * 0.4, 4, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, rgba(col, 0.35)); bg.addColorStop(1, '#05060f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, s = W / 120, bob = Math.sin(t * 1.5) * 1.2 * s;
  ctx.translate(cx, H * 0.5 + bob); ctx.scale(s, s);
  const fill = rgba(col, 0.55), line = rgba(col, 1), dark = 'rgba(5,6,15,0.85)';
  ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.fillStyle = fill;
  const mouth = talking ? Math.abs(Math.sin(t * 18)) * 3 + 0.5 : 0.6;
  const shoulders = (w = 44) => { ctx.beginPath(); ctx.moveTo(-w, 60); ctx.quadraticCurveTo(-w, 22, -12, 18); ctx.lineTo(12, 18); ctx.quadraticCurveTo(w, 22, w, 60); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const head = (rx = 17, ry = 21, y = -6) => { ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke(); };
  const eyes = (y = -8, c = '#ffffff', sp = 7) => { ctx.fillStyle = c; ctx.fillRect(-sp - 3, y, 6, 2.5); ctx.fillRect(sp - 3, y, 6, 2.5); ctx.fillStyle = fill; };
  const mouthLine = (y = 6) => { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, y, 5, mouth, 0, 0, TAU); ctx.fill(); ctx.fillStyle = fill; };
  switch (who) {
    case 'hale':
      shoulders(46); ctx.fillStyle = '#ffcf6b'; ctx.fillRect(-40, 24, 18, 5); ctx.fillRect(22, 24, 18, 5); ctx.fillStyle = fill;
      head(16, 20); ctx.fillStyle = 'rgba(230,230,240,0.85)'; ctx.beginPath(); ctx.ellipse(0, -18, 18, 11, 0, Math.PI, TAU); ctx.fill();
      ctx.fillRect(-18, -20, 6, 16); ctx.fillStyle = fill; eyes(-8); mouthLine(7);
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(-5, 0); ctx.stroke(); break;
    case 'kira':
      shoulders(40); head(16, 20);
      ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-14, -30); ctx.lineTo(-4, -22); ctx.lineTo(2, -34); ctx.lineTo(8, -22); ctx.lineTo(18, -30); ctx.lineTo(18, -6); ctx.quadraticCurveTo(0, -20, -18, -8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(16, -10); ctx.quadraticCurveTo(34, 0, 26, 22); ctx.lineTo(20, 18); ctx.quadraticCurveTo(26, 4, 14, -4); ctx.fill();
      ctx.fillStyle = 'rgba(127,243,255,0.8)'; ctx.fillRect(-15, -22, 12, 6); ctx.fillRect(3, -22, 12, 6); ctx.fillStyle = fill;
      eyes(-7); mouthLine(7); break;
    case 'wrench':
      shoulders(52); head(19, 21);
      ctx.fillStyle = 'rgba(40,50,70,0.95)'; ctx.beginPath(); ctx.ellipse(0, -20, 20, 10, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-4, -22, 30, 5);
      ctx.fillStyle = 'rgba(30,30,40,0.9)'; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(0, 30, 17, 0); ctx.quadraticCurveTo(0, 12, -17, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,90,0.9)'; ctx.beginPath(); ctx.arc(-8, -16, 5, 0, TAU); ctx.arc(8, -16, 5, 0, TAU); ctx.fill(); ctx.fillStyle = fill;
      eyes(-7); ctx.fillStyle = dark; ctx.fillRect(-5, 8, 10, mouth * 0.8 + 0.5); break;
    case 'lys':
      ctx.fillStyle = 'rgba(30,140,120,0.85)'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 32, 0, 0, TAU); ctx.fill(); ctx.fillStyle = fill;
      shoulders(38); head(15, 19);
      ctx.fillStyle = 'rgba(30,140,120,0.95)'; ctx.beginPath(); ctx.ellipse(-2, -18, 18, 9, -0.2, Math.PI, TAU); ctx.fill(); ctx.fillStyle = fill;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(-13, -11, 10, 7); ctx.strokeRect(3, -11, 10, 7); ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.stroke(); ctx.strokeStyle = line;
      eyes(-9, '#ffffff', 8); mouthLine(7); break;
    case 'tak':
      shoulders(42);
      ctx.fillStyle = 'rgba(80,90,130,0.9)'; ctx.fillRect(-22, -30, 44, 46); ctx.strokeRect(-22, -30, 44, 46);
      ctx.beginPath(); ctx.moveTo(10, -30); ctx.lineTo(16, -44); ctx.stroke(); ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(16, -45, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0c18'; ctx.fillRect(-18, -16, 36, 10);
      const ex = Math.sin(t * 2) * 10; ctx.fillStyle = '#9fb4ff'; ctx.fillRect(-6 + ex, -14, 12, 6);
      ctx.fillStyle = '#9fb4ff'; for (let i = 0; i < 5; i++) { const hh = talking ? 1 + Math.abs(Math.sin(t * 20 + i)) * 5 : 1; ctx.fillRect(-12 + i * 5.5, 6 - hh / 2, 3, hh); }
      break;
    case 'ssiv':
      ctx.fillStyle = 'rgba(120,50,170,0.8)';
      for (let i = 0; i < 4; i++) { const sx = (i - 1.5) * 9; ctx.beginPath(); ctx.moveTo(sx, 8); ctx.quadraticCurveTo(sx + Math.sin(t * 3 + i) * 6, 30, sx + Math.sin(t * 2 + i) * 4, 52); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(200,120,255,0.7)'; ctx.stroke(); }
      ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(0, -42); ctx.quadraticCurveTo(26, -20, 14, 12); ctx.quadraticCurveTo(0, 22, -14, 12); ctx.quadraticCurveTo(-26, -20, 0, -42); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f6e0ff'; [[-8, -14], [8, -14], [-5, -4], [5, -4]].forEach(([x, y], i) => { ctx.beginPath(); ctx.ellipse(x, y, i < 2 ? 3.5 : 2.4, (i < 2 ? 2.4 : 1.6) * (0.4 + Math.abs(Math.sin(t * 0.9 + i)) * 0.6), 0, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = '#f6e0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-3, 8 + mouth); ctx.moveTo(6, 8); ctx.lineTo(3, 8 + mouth); ctx.stroke();
      break;
    case 'cmd':
      shoulders(46); ctx.fillStyle = 'rgba(255,200,110,0.7)'; ctx.beginPath(); ctx.arc(0, -6, 24, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(10,20,40,0.9)'; octPath(ctx, 15, Math.PI / 8, 0, -6); ctx.fill();
      ctx.fillStyle = 'rgba(127,243,255,0.6)'; ctx.fillRect(-12, -14, 24, 4 + (talking ? Math.abs(Math.sin(t * 16)) * 2 : 0)); break;
    case 'null':
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff3d71'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40 + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke();
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t * 0.3; ctx.fillStyle = '#ff3d71'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 24, Math.sin(a) * 24, 4, 1 + Math.abs(Math.sin(t + i)) * 2.5, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd0dc'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 2 + mouth, 0, 0, TAU); ctx.fill(); break;
    case 'pip': case 'elder': {
      const old = who === 'elder', fur = 'rgba(255,244,250,0.96)';
      ctx.fillStyle = fur;
      const ear = (x, y, rot) => { ctx.beginPath(); ctx.ellipse(x, y, 7, 23, rot, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,179,217,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 16, rot, 0, TAU); ctx.fill(); ctx.fillStyle = fur; };
      if (old) { ear(-24, -26, -1.05); ear(24, -26, 1.05); } else { ear(-11, -44, -0.15 + Math.sin(t * 2) * 0.05); ear(11, -44, 0.15 - Math.sin(t * 2.3) * 0.05); }
      ctx.fillStyle = old ? 'rgba(154,122,216,0.95)' : 'rgba(255,216,79,0.95)'; shoulders(36);
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -4, 24, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a1840';
      if (old) { ctx.beginPath(); ctx.ellipse(-9, -7, 2.6, 2.2, 0, 0, TAU); ctx.ellipse(9, -7, 2.6, 2.2, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6a5a8a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-9, -7, 6, 0, TAU); ctx.moveTo(15, -7); ctx.arc(9, -7, 6, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-15, -16, 10, 2.5); ctx.fillRect(5, -16, 10, 2.5); }
      else { ctx.beginPath(); ctx.ellipse(-8, -6, 4, 5.5, 0, 0, TAU); ctx.ellipse(8, -6, 4, 5.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-6.8, -8, 1.6, 0, TAU); ctx.arc(9.2, -8, 1.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,150,200,0.7)'; ctx.beginPath(); ctx.arc(-15, 3, 3.5, 0, TAU); ctx.arc(15, 3, 3.5, 0, TAU); ctx.fill();
      if (talking) { ctx.fillStyle = '#5a2a4a'; ctx.beginPath(); ctx.ellipse(0, 7, 3.5, mouth, 0, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = '#5a2a4a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 4, 4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      if (old) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.moveTo(-7, 9); ctx.quadraticCurveTo(0, 26, 7, 9); ctx.fill(); }
      break;
    }
    case 'ink':
      ctx.fillStyle = 'rgba(18,10,34,0.95)';
      ctx.beginPath(); ctx.moveTo(-34, 60); ctx.bezierCurveTo(-44, -60, 44, -60, 34, 60); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 4; i++) { const dd = (t * 20 + i * 15) % 40; ctx.fillStyle = 'rgba(18,10,34,0.9)'; ctx.beginPath(); ctx.arc(-24 + i * 16, 30 + dd, 3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffe6fa';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 12, -12, 9, 3 + Math.abs(Math.sin(t)) * 1.5, s * 0.25, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#ff7ad8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 4, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (talking) { ctx.fillStyle = '#ff7ad8'; ctx.beginPath(); ctx.ellipse(0, 12, 6, mouth, 0, 0, TAU); ctx.fill(); }
      break;
    default: // sys
      ctx.strokeStyle = line; ctx.lineWidth = 2.5; octPath(ctx, 30, t * 0.3); ctx.stroke(); octPath(ctx, 18, -t * 0.5); ctx.stroke();
      ctx.fillStyle = line; octPath(ctx, 7 + (talking ? Math.abs(Math.sin(t * 14)) * 3 : 0), Math.PI / 8); ctx.fill();
  }
  ctx.restore();
  // scanlines + flicker
  ctx.save(); octPath(ctx, W * 0.53, Math.PI / 8, W / 2, H / 2); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = (t * 30) % 3; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = rgba(col, 0.06 + Math.random() * 0.03); ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 2; octPath(ctx, W * 0.5, Math.PI / 8, W / 2, H / 2); ctx.stroke();
}

/* ---------- Papyra: Hopplings and paper stars ---------- */
function drawHoppling(ctx, t, scarf, back) {
  const parts = () => {
    ctx.beginPath(); ctx.ellipse(-5, -14, 3.6, 10, -0.18, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -14, 3.6, 10, 0.18, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 4, 11, 10, 0, 0, TAU); ctx.fill();
  };
  ctx.save(); ctx.translate(3, 3); ctx.fillStyle = 'rgba(20,10,40,0.35)'; parts(); ctx.restore();
  ctx.save(); ctx.scale(1.2, 1.12); ctx.fillStyle = '#ffffff'; parts(); ctx.restore();
  ctx.fillStyle = back ? '#e8d8ee' : '#fff4fa'; parts();
  if (!back) {
    ctx.fillStyle = '#ffb3d9';
    ctx.beginPath(); ctx.ellipse(-5, -14, 1.6, 7, -0.18, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -14, 1.6, 7, 0.18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1840';
    ctx.beginPath(); ctx.ellipse(-4, 2, 2.2, 3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, 2, 2.2, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3.6, 0.2, 1.2, 1.2); ctx.fillRect(4.4, 0.2, 1.2, 1.2);
    ctx.fillStyle = 'rgba(255,150,200,0.75)'; ctx.beginPath(); ctx.arc(-7.5, 6, 1.8, 0, TAU); ctx.arc(7.5, 6, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a2a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 5.5, 2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else {
    ctx.strokeStyle = '#cdb8d8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 13); ctx.stroke();
  }
  ctx.fillStyle = scarf; ctx.fillRect(-9, 11, 18, 3.5); ctx.fillRect(4, 12, 3.5, 7 + Math.sin(t * 8) * 1.5);
}
function drawPaperStar(ctx, x, y, r, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * 0.28); ctx.stroke();
  ctx.restore();
}
