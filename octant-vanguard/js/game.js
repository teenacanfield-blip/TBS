/* Octant Vanguard — core engine: save, input, world simulation, rendering, main loop */
'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const ov = document.getElementById('overlay');
const octx = ov.getContext('2d');
const PIXEL_FONT = '"Pixelify Sans", "Courier New", monospace';
/* Pixel art: the world canvas renders at 1/PX of the screen and the browser scales it up with hard edges.
   DPR maps CSS pixels to those chunky internal pixels. The overlay canvas stays sharp for text. */
let VW = 0, VH = 0, DPR = 1, PX = 3, ODPR = 1, VIGNETTE = null;
function resize() {
  VW = window.innerWidth; VH = window.innerHeight;
  PX = VW < 700 ? 2 : VW < 1500 ? 3 : 4;
  DPR = 1 / PX;
  cv.width = Math.ceil(VW / PX); cv.height = Math.ceil(VH / PX);
  ODPR = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = Math.round(VW * ODPR); ov.height = Math.round(VH * ODPR);
  VIGNETTE = makeCanvas(256, 256);
  const g = VIGNETTE.getContext('2d'), gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,8,0.6)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
}
addEventListener('resize', resize);
resize();

/* ================= SAVE ================= */
function deepMerge(a, b) {
  for (const k in b) {
    if (!(k in a)) continue;
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
    else if (typeof b[k] === typeof a[k]) a[k] = b[k];
  }
  return a;
}
const Save = {
  KEY: 'octant-vanguard-save-v1', d: null, has: false,
  fresh() {
    return {
      v: 1, cs: 'NOVA', progress: 0, credits: 0, prologue: false, ended: false, wins: 0,
      upg: { hull: 0, shield: 0, dmg: 0, rate: 0, spread: 0, fuel: 0, engine: 0, nova: 0 },
      crew: { kira: 0, wrench: 0, lys: 0, tak: 0, ssiv: 0, pip: 0 },
      side: { papyra: false },
      settings: { sfx: 0.7, mus: 0.45, voice: 'auto', shake: true, speed: 1 },
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; }
    this.has = !!(d && d.v === 1 && (d.prologue || d.progress > 0));
    this.d = d && d.v === 1 ? deepMerge(this.fresh(), d) : this.fresh();
  },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* storage unavailable */ } },
  reset(cs) { const s = this.d ? this.d.settings : null; this.d = this.fresh(); if (s) this.d.settings = s; if (cs) this.d.cs = cs; this.write(); },
};
Save.load();

function shipStats(sv = Save.d) {
  const u = sv.upg, c = sv.crew;
  return {
    hullMax: 100 + 30 * u.hull, shieldMax: 50 + 22 * u.shield,
    dmg: 10 * (1 + 0.22 * u.dmg), rate: 6 * (1 + 0.13 * u.rate), spread: u.spread,
    fuelMax: 100 + 30 * u.fuel, speed: 330 * (1 + 0.09 * u.engine), accel: 1500 * (1 + 0.09 * u.engine),
    novaDmg: 70 + 30 * u.nova, novaCd: 20 - 2.5 * u.nova, novaR: 280 + 22 * u.nova,
    fuelUse: 1 - 0.09 * c.wrench, hullRegen: 0.7 * c.wrench, crit: 0.05 * c.lys,
    shieldRegen: 7 * (1 + 0.25 * c.lys), fuelDrop: 0.16 + 0.03 * c.wrench,
  };
}

/* Story worlds unlock in order; side worlds open once Verdance is saved */
function planetStatus(i) {
  const P = PLANETS[i], prog = Save.d.progress;
  if (P.side) { const saved = !!(Save.d.side && Save.d.side[P.id]); return { saved, cur: !saved && prog >= 1, locked: prog < 1 }; }
  return { saved: i < prog, cur: i === prog, locked: i > prog };
}

/* ================= INPUT ================= */
const Input = {
  keys: Object.create(null), pressed: Object.create(null),
  mouse: { x: 0, y: 0, down: false, rdown: false, seen: false },
  touch: { used: false, move: null, aim: null, boost: false, nova: false },
};
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Slash', 'Quote'];
addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!Input.keys[e.code]) Input.pressed[e.code] = true;
  Input.keys[e.code] = true;
  if ((G.state === 'mission' || G.state === 'guest') && GAME_KEYS.includes(e.code)) e.preventDefault();
  if (UI.onKey(e)) { delete Input.pressed[e.code]; }
});
addEventListener('keyup', e => { Input.keys[e.code] = false; });
addEventListener('blur', () => { Input.keys = Object.create(null); Input.mouse.down = Input.mouse.rdown = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  Sound.init();
  if (e.pointerType === 'touch') {
    Input.touch.used = true; UI.showTouch(true);
    const st = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    if (G.state === 'mission' || G.state === 'guest') {
      if (e.clientX < VW * 0.5) { if (!Input.touch.move) Input.touch.move = st; }
      else if (!Input.touch.aim) Input.touch.aim = st;
    }
  } else {
    Input.mouse.seen = true;
    if (e.button === 0) Input.mouse.down = true;
    if (e.button === 2) { Input.mouse.rdown = true; Input.pressed.Mouse2 = true; }
  }
  Input.mouse.x = e.clientX; Input.mouse.y = e.clientY;
  if (G.state === 'map' || G.state === 'title') MapView.click(e.clientX, e.clientY);
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') {
    const t = Input.touch;
    if (t.move && t.move.id === e.pointerId) { t.move.x = e.clientX; t.move.y = e.clientY; }
    if (t.aim && t.aim.id === e.pointerId) { t.aim.x = e.clientX; t.aim.y = e.clientY; }
  } else { Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; Input.mouse.seen = true; }
  if (G.state === 'map' || G.state === 'title') MapView.hover(e.clientX, e.clientY);
});
const endPointer = e => {
  if (e.pointerType === 'touch') {
    const t = Input.touch;
    if (t.move && t.move.id === e.pointerId) t.move = null;
    if (t.aim && t.aim.id === e.pointerId) t.aim = null;
  } else {
    if (e.button === 0) Input.mouse.down = false;
    if (e.button === 2) Input.mouse.rdown = false;
  }
};
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', e => { if (G.state === 'map') e.preventDefault(); }, { passive: false });

function readPads() {
  const out = [];
  try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.connected) out.push(p); } catch (e) { /* no pads */ }
  return out;
}
const dz = v => Math.abs(v) < 0.18 ? 0 : v;

/* ================= GLOBAL STATE ================= */
const G = { state: 'title', paused: false, dialog: false, world: null, coopLocal: false, t: 0, lastPadBtn: [] };
const ARENA = 1700;
const OCT_N = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
function octConfine(o, A, bounce = 0.4) {
  for (const [nx, ny] of OCT_N) {
    const d = o.x * nx + o.y * ny;
    if (d > A) { o.x -= (d - A) * nx; o.y -= (d - A) * ny; const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= vn * (1 + bounce) * nx; o.vy -= vn * (1 + bounce) * ny; } }
  }
}

/* ================= WORLD ================= */
function newWorld(idx, opts = {}) {
  const P = PLANETS[idx];
  const w = {
    idx, P, patrol: !!opts.patrol, t: 0, phase: 'brief', endT: 0,
    players: [], wingmen: [], enemies: [], bullets: [], pickups: [], parts: [], rocks: [], portals: [], texts: [], beams: [],
    planet: { x: 0, y: 0, r: Math.round(P.size * 1.3), hp: 1000, maxHp: 1000, rot: Math.random() * TAU, flash: 0 },
    wave: -1, queue: [], spawnT: 0, betweenT: 0, survive: null, boss: null, bossSeen: false,
    pods: 2, kills: 0, earned: 0, fuelUsed: 0, shake: 0, hpMul: 1, nextId: 1,
    cam: { x: 0, y: 250, zoom: 1 }, neb: makeNebula(P.neb, P.seed), barkCd: {}, barkT: 0, fx: [], fxSeq: 0,
  };
  w.planet.hp = w.planet.maxHp = 1000 + P.threat * 150;
  if (P.mission.kind === 'survive') w.survive = { t: 0, dur: P.mission.duration, spawnT: 2 };
  if (P.mission.hazard === 'asteroids') for (let i = 0; i < 11; i++) spawnRock(w);
  // players
  w.players.push(makePlayer(0, 'local', 0, -w.planet.r - 140));
  if (G.coopLocal) w.players.push(makePlayer(1, 'local', 60, -w.planet.r - 160));
  // wingmen
  const c = Save.d.crew;
  if (c.kira) w.wingmen.push({ kind: 'fighter', who: 'kira', lv: c.kira, x: -80, y: -w.planet.r - 160, vx: 0, vy: 0, ang: -Math.PI / 2, cd: 0, orbit: Math.random() * TAU, thrust: 0.5 });
  if (c.tak) w.wingmen.push({ kind: 'drone', who: 'tak', lv: c.tak, x: 0, y: 0, vx: 0, vy: 0, ang: 0, cd: 0, orbit: 0, aim: 0, twin: c.tak >= 3 });
  const ssLv = c.ssiv || (P.mission.ally === 'ssiv' ? 2 : 0);
  if (ssLv) w.wingmen.push({ kind: 'spore', who: 'ssiv', lv: ssLv, x: 120, y: w.planet.r + 160, vx: 0, vy: 0, ang: 0, cd: 0, orbit: Math.random() * TAU });
  const pipLv = c.pip || (P.mission.ally === 'hopplings' ? 2 : 0);
  if (pipLv) w.wingmen.push({ kind: 'hopper', who: 'pip', lv: pipLv, x: 60, y: -w.planet.r - 120, vx: 0, vy: 0, ang: 0, cd: 0, orbit: Math.random() * TAU, seed: 1.3, scarf: '#ffd84f' });
  if (P.mission.ally === 'hopplings') ['#8fd3ff', '#caffbf', '#ffb3d9', '#c9b6ff'].forEach((scarf, i) => { const a = i / 4 * TAU; w.wingmen.push({ kind: 'hoppling', who: 'hoppling', lv: 2, x: Math.cos(a) * (w.planet.r + 120), y: Math.sin(a) * (w.planet.r + 120), vx: 0, vy: 0, ang: 0, cd: Math.random(), orbit: a, seed: i * 2.1, scarf }); });
  recalcPlayers(w);
  return w;
}
function makePlayer(idx, kind, x, y, stats) {
  const st = stats || shipStats();
  return {
    idx, kind, peer: null, scheme: SCHEMES[idx] || SCHEMES[0], x, y, vx: 0, vy: 0, ang: -Math.PI / 2, aim: -Math.PI / 2,
    st, hull: st.hullMax, shield: st.shieldMax, fuel: st.fuelMax, fireCd: 0, novaCd: 3, lastHit: -10,
    hit: 0, shieldHit: 0, dead: false, respawnT: 0, inv: 2, thrust: 0, boost: false, rockCd: 0, refuel: false,
    inp: { mx: 0, my: 0, fire: false, boost: false, nova: false, aim: null }, cs: Save.d.cs, lowFuelWarned: false,
  };
}
function recalcPlayers(w) {
  const n = w.players.length;
  w.hpMul = 1 + 0.55 * (n - 1);
}
function spawnRock(w, x, y, r) {
  const a = Math.random() * TAU, d = x === undefined ? 380 + Math.random() * 1150 : 0;
  r = r || 22 + Math.random() * 28;
  const rock = { id: w.nextId++, x: x !== undefined ? x : Math.cos(a) * d, y: y !== undefined ? y : Math.sin(a) * d, vx: 0, vy: 0, r, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 0.8, hp: r * 3, pts: makeRockShape(Math.random() * 1e6 | 0, r), fuel: Math.random() < 0.6, hit: 0, orbit: 0.03 + Math.random() * 0.04 };
  w.rocks.push(rock);
  return rock;
}

/* ---------- particles & text ---------- */
const MAX_PARTS = 1100;
function part(w, x, y, vx, vy, life, size, color, type = 1) {
  if (w.parts.length >= MAX_PARTS) w.parts.shift();
  w.parts.push({ x, y, vx, vy, life, max: life, size, color, type, rot: Math.random() * TAU });
}
function burst(w, x, y, n, color, speed = 260, life = 0.6, size = 3, type = 0) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.8); part(w, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, type); }
}
function explode(w, x, y, size, color, net = true) {
  burst(w, x, y, 10 + size * 10, color, 220 + size * 140, 0.7, 2.5, 0);
  burst(w, x, y, 6 + size * 5, '#ffffff', 120 + size * 60, 0.35, 5, 1);
  burst(w, x, y, 4 + size * 4, color, 70, 1.0, 14 * size, 1);
  for (let i = 0; i < 3 + size * 3; i++) part(w, x, y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 1.4 + Math.random(), 10 + size * 10, '#1a1420', 3);
  for (let i = 0; i < 2 + size * 2; i++) part(w, x, y, (Math.random() - 0.5) * 320, (Math.random() - 0.5) * 320, 1.2, 3 + size, color, 4);
  part(w, x, y, 0, 0, 0.45 + size * 0.12, 20 + size * 55, color, 2);
  Sound.sfx(size > 2.5 ? 'bigboom' : 'boom', { size });
  w.shake = Math.max(w.shake, size * 5);
  if (net) pushFx(w, 1, x, y, size, color);
}
function pushFx(w, kind, x, y, a, color) {
  w.fx.push({ s: ++w.fxSeq, k: kind, x: Math.round(x), y: Math.round(y), a: Math.round(a * 10) / 10, c: color, t: w.t });
  if (w.fx.length > 10) w.fx.shift();
}
function floatText(w, x, y, text, color, size = 14) { w.texts.push({ x, y, text, color, life: 0.9, max: 0.9, size }); if (w.texts.length > 60) w.texts.shift(); }

/* ---------- barks (mid-mission radio) ---------- */
function speakerAvailable(who, w) {
  if (['sys', 'hale', 'null', 'cmd'].includes(who)) return true;
  const onPapyra = !!(w && w.P && w.P.id === 'papyra');
  if (who === 'elder' || who === 'ink') return onPapyra;
  if (who === 'pip') return Save.d.crew.pip > 0 || onPapyra;
  return Save.d.crew[who] > 0;
}
function bark(w, key, force = false) {
  const list = BARKS[key]; if (!list) return;
  if (!force && (w.barkCd[key] > w.t || w.barkT > w.t)) return;
  const avail = list.filter(([who]) => speakerAvailable(who, w));
  const crewAvail = avail.filter(([who]) => who !== 'sys');
  const pool = crewAvail.length ? crewAvail : avail;
  const pick = pool[Math.random() * pool.length | 0];
  if (!pick) return;
  w.barkCd[key] = w.t + 25; w.barkT = w.t + 5;
  const text = pick[1].replace(/\{cs\}/g, Save.d.cs);
  UI.showBark(pick[0], text);
  Voice.speak(pick[0], text);
  w.lastBark = { s: (w.lastBark ? w.lastBark.s : 0) + 1, who: pick[0], text, t: w.t };
}

/* ---------- player helpers ---------- */
function nearestEnemy(w, x, y, range, filter) {
  let best = null, bd = range * range;
  for (const e of w.enemies) { if (filter && !filter(e)) continue; const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } }
  return best;
}
function screenToWorld(w, sx, sy) { return { x: (sx - VW / 2) / w.cam.zoom + w.cam.x, y: (sy - VH / 2) / w.cam.zoom + w.cam.y }; }

function readLocalInput(w, p, pads) {
  const inp = p.inp, k = Input.keys;
  inp.mx = 0; inp.my = 0; inp.fire = false; inp.boost = false; inp.nova = false; inp.aim = null;
  const pad = p.idx === 0 ? (G.coopLocal ? null : pads[0]) : pads[0];
  if (p.idx === 0) {
    inp.mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    inp.my = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (!G.coopLocal) { inp.mx += (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0); inp.my += (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0); }
    inp.fire = Input.mouse.down;
    inp.boost = !!(k.ShiftLeft || (!G.coopLocal && k.ShiftRight));
    inp.nova = !!(Input.pressed.Space || Input.pressed.Mouse2 || Input.pressed.KeyE);
    if (Input.mouse.seen) { const m = screenToWorld(w, Input.mouse.x, Input.mouse.y); inp.aim = Math.atan2(m.y - p.y, m.x - p.x); }
    const t = Input.touch;
    if (t.move) { const dx = t.move.x - t.move.ox, dy = t.move.y - t.move.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / 60); if (d > 6) { inp.mx = dx / d * m; inp.my = dy / d * m; } }
    if (t.aim) { const dx = t.aim.x - t.aim.ox, dy = t.aim.y - t.aim.oy; if (Math.hypot(dx, dy) > 12) { inp.aim = Math.atan2(dy, dx); inp.fire = true; } else { const ne = nearestEnemy(w, p.x, p.y, 520); if (ne) { inp.aim = Math.atan2(ne.y - p.y, ne.x - p.x); inp.fire = true; } } }
    if (t.boost) inp.boost = true;
    if (t.nova) { inp.nova = true; t.nova = false; }
  } else {
    inp.mx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
    inp.my = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
    inp.boost = !!(k.ShiftRight || k.Period || k.Numpad1);
    inp.nova = !!(Input.pressed.Enter || Input.pressed.Slash || Input.pressed.Numpad0 || Input.pressed.NumpadEnter);
    const ne = nearestEnemy(w, p.x, p.y, 560);
    if (ne) { inp.aim = Math.atan2(ne.y - p.y, ne.x - p.x); inp.fire = true; }
  }
  if (pad) {
    const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
    if (lx || ly) { inp.mx = lx; inp.my = ly; }
    if (rx || ry) { inp.aim = Math.atan2(ry, rx); inp.fire = true; }
    const b = i => pad.buttons[i] && pad.buttons[i].pressed;
    if (b(7) || b(5)) inp.fire = true;
    if (b(6) || b(4) || b(0)) inp.boost = true;
    const prev = G.lastPadBtn[p.idx] || false, now = !!(b(1) || b(3));
    if (now && !prev) inp.nova = true;
    G.lastPadBtn[p.idx] = now;
  }
  const ml = Math.hypot(inp.mx, inp.my); if (ml > 1) { inp.mx /= ml; inp.my /= ml; }
}

function firePlayer(w, p) {
  const st = p.st, sp = st.spread, a = p.aim, ca = Math.cos(a), sa = Math.sin(a);
  const shots = [];
  const lat = (o) => [p.x + ca * 26 - sa * o, p.y + sa * 26 + ca * o];
  if (sp === 0) { p.alt = !p.alt; shots.push([...lat(p.alt ? 8 : -8), a]); }
  else if (sp === 1) { shots.push([...lat(8), a], [...lat(-8), a]); }
  else if (sp === 2) { shots.push([...lat(0), a - 0.11], [...lat(0), a], [...lat(0), a + 0.11]); }
  else if (sp === 3) { shots.push([...lat(0), a - 0.11], [...lat(0), a], [...lat(0), a + 0.11], [...lat(16), a], [...lat(-16), a]); }
  else { shots.push(...[-0.24, -0.12, 0, 0.12, 0.24].map(o => [...lat(0), a + o])); }
  const dmg = st.dmg * (sp >= 2 ? 0.82 : 1);
  const col = p.scheme.flame, core = p.scheme.edge;
  for (const [x, y, ang] of shots) {
    w.bullets.push({ x, y, vx: Math.cos(ang) * 950 + p.vx * 0.3, vy: Math.sin(ang) * 950 + p.vy * 0.3, life: 0.85, dmg, team: 0, r: 4, color: col, core, owner: p, pierce: sp >= 5 ? 2 : 0, kind: 0 });
  }
  part(w, p.x + ca * 30, p.y + sa * 30, ca * 60, sa * 60, 0.08, 18, col, 1);
  Sound.sfx(p.kind === 'local' ? 'laser' : 'laser2');
}

function triggerNova(w, p) {
  p.novaCd = p.st.novaCd;
  part(w, p.x, p.y, 0, 0, 0.55, p.st.novaR, p.scheme.shield, 2);
  part(w, p.x, p.y, 0, 0, 0.4, p.st.novaR * 0.7, '#ffffff', 2);
  burst(w, p.x, p.y, 50, p.scheme.shield, 600, 0.5, 3, 0);
  Sound.sfx('nova'); w.shake = Math.max(w.shake, 14);
  const R2 = p.st.novaR * p.st.novaR;
  for (const e of [...w.enemies]) { const dx = e.x - p.x, dy = e.y - p.y; if (dx * dx + dy * dy < (p.st.novaR + ENEMY_TYPES[e.type].r) ** 2) { damageEnemy(w, e, p.st.novaDmg * (ENEMY_TYPES[e.type].boss ? 0.6 : 1), p); const d = Math.hypot(dx, dy) || 1; e.vx += dx / d * 400; e.vy += dy / d * 400; } }
  w.bullets = w.bullets.filter(b => !(b.team === 1 && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < R2));
  pushFx(w, 2, p.x, p.y, p.st.novaR, p.scheme.shield);
}

function damagePlayer(w, p, amt) {
  if (p.dead || p.inv > 0 || w.phase !== 'play') return;
  if (p.kind === 'remote') { Net.guestEvent(p.peer, 'dmg', amt); p.hit = 1; return; }
  p.lastHit = w.t;
  if (p.shield > 0) { const s = Math.min(p.shield, amt); p.shield -= s; amt -= s; p.shieldHit = 1; Sound.sfx('shieldhit'); }
  if (amt > 0) { p.hull -= amt; p.hit = 1; Sound.sfx('hurt'); if (Save.d.settings.shake) w.shake = Math.max(w.shake, 5 + amt * 0.3); }
  if (p.hull <= 0) killPlayer(w, p);
  else if (p.hull < p.st.hullMax * 0.3) bark(w, 'hullLow');
}
function killPlayer(w, p) {
  p.dead = true; p.hull = 0; explode(w, p.x, p.y, 2.2, p.scheme.flame);
  if (w.pods > 0) { w.pods--; p.respawnT = 3.2; }
  else if (w.players.every(q => q.kind !== 'local' || (q.dead && q.respawnT <= 0))) endMission(w, false, 'ship');
}
function respawnPlayer(w, p) {
  p.dead = false; p.hull = p.st.hullMax; p.shield = p.st.shieldMax; p.fuel = Math.max(p.fuel, p.st.fuelMax * 0.6);
  const a = Math.random() * TAU; p.x = Math.cos(a) * (w.planet.r + 90); p.y = Math.sin(a) * (w.planet.r + 90); p.vx = p.vy = 0; p.inv = 2.5;
  part(w, p.x, p.y, 0, 0, 0.5, 80, p.scheme.shield, 2);
  bark(w, 'respawn', true);
}
function damagePlanet(w, amt) {
  if (w.phase !== 'play') return;
  const pl = w.planet; pl.hp -= amt; pl.flash = Math.min(1, pl.flash + 0.25);
  if (pl.hp < pl.maxHp * 0.3) bark(w, 'planetLow');
  if (pl.hp <= 0) { pl.hp = 0; endMission(w, false, 'planet'); }
}
function damageEnemy(w, e, amt, src) {
  if (e.dead || e.ghost > 0) return;
  let crit = false;
  if (src && src.kind === 'local' && Math.random() < src.st.crit) { amt *= 2; crit = true; }
  e.hp -= amt; e.hit = 1;
  if (crit) { floatText(w, e.x, e.y - 12, Math.round(amt) + '!', '#ffe14a', 16); Sound.sfx('crit'); }
  else if (amt >= 1) floatText(w, e.x + (Math.random() - 0.5) * 10, e.y - 10, Math.round(amt), '#ffffff', 12);
  if (e.hp <= 0) killEnemy(w, e, src);
}
function killEnemy(w, e, src) {
  e.dead = true;
  const T = ENEMY_TYPES[e.type];
  w.enemies.splice(w.enemies.indexOf(e), 1);
  w.kills++;
  explode(w, e.x, e.y, T.boss ? 4 : T.r / 14, T.glow);
  if (T.boss) {
    for (let i = 0; i < 6; i++) setTimeout(() => { if (G.world === w) explode(w, e.x + (Math.random() - 0.5) * 140, e.y + (Math.random() - 0.5) * 140, 2, T.glow); }, 120 * i);
    w.boss = null; UI.bossBar(null);
  }
  // drops
  const cr = T.reward;
  const nCoins = Math.min(8, 1 + (cr / 8 | 0));
  for (let i = 0; i < nCoins; i++) w.pickups.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, type: 'credit', val: cr / nCoins, life: 14, t: 0 });
  const fd = (w.players[0] && w.players[0].st.fuelDrop) || 0.16;
  if (Math.random() < (T.boss ? 1 : fd)) w.pickups.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, type: 'fuel', val: 30, life: 16, t: 0 });
  if (Math.random() < (T.boss ? 1 : 0.06)) w.pickups.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, type: 'repair', val: 30, life: 16, t: 0 });
  if (src && src.kind === 'remote') Net.guestEvent(src.peer, 'kill', 1);
  // leech unlatch handled by removal
}

function spawnEnemy(w, type, x, y) {
  const T = ENEMY_TYPES[type];
  const hp = T.hp * (1 + 0.1 * (w.P.threat - 1)) * w.hpMul * (w.patrol ? 1.15 : 1);
  const e = { id: w.nextId++, type, x, y, vx: 0, vy: 0, ang: Math.atan2(-y, -x), hp, maxHp: hp, t: 0, seed: Math.random() * 100, hit: 0, slow: 0, slowAmt: 0, target: null, retarget: 0, cd: 1 + Math.random() * 1.5, cd2: 3, cd3: 5, state: 0, st: 0, charge: 0, latch: null, kids: 0, eye: 0, beam: null, ghost: 0, fade: 8 };
  w.enemies.push(e);
  if (T.boss) {
    w.boss = e; UI.bossBar(T.name, 1);
    bark(w, 'boss_' + type, true);
    if (Save.d.settings.shake) w.shake = 20;
  }
  return e;
}
function spawnPortal(w, type, near) {
  let x, y;
  if (near) { x = near.x + (Math.random() - 0.5) * 160; y = near.y + (Math.random() - 0.5) * 160; }
  else {
    const a = Math.random() * TAU, d = ENEMY_TYPES[type].boss ? 1100 : 1350 + Math.random() * 280;
    x = Math.cos(a) * d; y = Math.sin(a) * d;
  }
  w.portals.push({ x, y, t: 0, dur: ENEMY_TYPES[type].boss ? 2.2 : 0.9, type, r: ENEMY_TYPES[type].r });
  Sound.sfx('spawn');
}
function startWave(w, i) {
  const waves = w.P.mission.waves;
  w.wave = i; w.queue = [];
  for (const [type, n] of waves[i]) for (let k = 0; k < n; k++) w.queue.push(type);
  for (let k = w.queue.length - 1; k > 0; k--) { const j = Math.random() * (k + 1) | 0; [w.queue[k], w.queue[j]] = [w.queue[j], w.queue[k]]; }
  const bi = w.queue.findIndex(t => ENEMY_TYPES[t].boss);
  if (bi >= 0) { const b = w.queue.splice(bi, 1)[0]; w.queue.unshift(b); }
  w.spawnT = 0.5;
  UI.banner(i === waves.length - 1 ? 'Final wave' : `Wave ${i + 1} of ${waves.length}`, w.P.name);
  Sound.setMusic(w.queue.some(t => ENEMY_TYPES[t].boss) ? 'boss' : 'combat', 1);
}
function beginPlay(w) {
  w.phase = 'play';
  if (w.survive) { UI.banner('Hold the line', 'Seal resonators charging'); Sound.setMusic('combat', 1); bark(w, 'survive', true); }
  else startWave(w, 0);
  if (BARKS[w.P.id + 'Go']) setTimeout(() => { if (G.world === w) bark(w, w.P.id + 'Go', true); }, 2200);
  if (Net.isHosting() && Net.remoteCount() > 0) bark(w, 'coop', true);
}
function endMission(w, win, reason) {
  if (w.phase !== 'play') return;
  w.phase = win ? 'win' : 'lose'; w.endT = 0; w.endReason = reason;
  UI.bossBar(null);
  if (win) {
    Sound.sfx('victory');
    for (const e of [...w.enemies]) { explode(w, e.x, e.y, 1, ENEMY_TYPES[e.type].glow); }
    w.enemies.length = 0; w.bullets = w.bullets.filter(b => b.team === 0);
    part(w, 0, 0, 0, 0, 1.2, 1800, w.P.atmo, 2);
    UI.banner(w.P.name + ' is safe', 'Mission complete');
  } else {
    Sound.sfx('defeat');
    if (reason === 'planet') { explode(w, w.planet.x, w.planet.y, 5, '#ff6a3a'); UI.banner(w.P.name + ' has fallen', 'Mission failed'); }
    else UI.banner('Vanguard lost', 'No escape pods left');
  }
  Sound.setMusic('calm', 0);
}

/* ================= UPDATE ================= */
function updateWorld(w, dt) {
  w.t += dt;
  const pads = readPads();
  const pl = w.planet;
  pl.rot += dt * 0.05; pl.flash = Math.max(0, pl.flash - dt * 2);
  w.shake = Math.max(0, w.shake - dt * 30);

  if (w.phase === 'win' || w.phase === 'lose') {
    w.endT += dt;
    if (w.endT > 2.6 && !w.endHandled) { w.endHandled = true; UI.missionOver(w); }
  }

  /* ---- waves / spawning ---- */
  if (w.phase === 'play') {
    if (w.survive) {
      const s = w.survive; s.t += dt;
      s.spawnT -= dt;
      if (s.spawnT <= 0 && w.enemies.length + w.portals.length < 34) {
        const mix = w.P.mission.mix; const n = 1 + (s.t > 60 ? 1 : 0) + (s.t > 95 ? 1 : 0);
        for (let i = 0; i < n; i++) spawnPortal(w, mix[Math.random() * mix.length | 0]);
        s.spawnT = Math.max(0.55, 2.2 - s.t / 60);
      }
      if (s.t >= s.dur) endMission(w, true);
    } else {
      if (w.queue.length) {
        w.spawnT -= dt;
        if (w.spawnT <= 0) { spawnPortal(w, w.queue.shift()); w.spawnT = 0.42 + Math.random() * 0.3; }
      } else if (w.betweenT > 0) {
        w.betweenT -= dt;
        if (w.betweenT <= 0) startWave(w, w.wave + 1);
      } else if (w.portals.length === 0 && w.enemies.length === 0 && w.wave >= 0) {
        if (w.wave >= w.P.mission.waves.length - 1) endMission(w, true);
        else { w.betweenT = 3.5; bark(w, 'waveClear'); Sound.setMusic('calm', 0.5); }
      }
    }
  }

  /* ---- portals ---- */
  for (let i = w.portals.length - 1; i >= 0; i--) {
    const p = w.portals[i]; p.t += dt;
    if (Math.random() < 0.5) part(w, p.x + (Math.random() - 0.5) * p.r * 3, p.y + (Math.random() - 0.5) * p.r * 3, 0, 0, 0.4, 6, '#b25cff', 1);
    if (p.t >= p.dur) { w.portals.splice(i, 1); if (w.phase === 'play' || w.phase === 'brief') spawnEnemy(w, p.type, p.x, p.y); burst(w, p.x, p.y, 14, '#c78bff', 200, 0.5, 2, 0); }
  }

  /* ---- players ---- */
  for (const p of w.players) {
    p.hit = Math.max(0, p.hit - dt * 4); p.shieldHit = Math.max(0, p.shieldHit - dt * 3); p.inv = Math.max(0, p.inv - dt);
    if (p.kind === 'remote') { updateRemotePlayer(w, p, dt); continue; }
    if (p.dead) {
      if (p.respawnT > 0) { p.respawnT -= dt; if (p.respawnT <= 0) respawnPlayer(w, p); }
      continue;
    }
    stepLocalPlayer(w, p, dt, pads);
  }

  /* ---- wingmen ---- */
  const lead = w.players.find(p => p.kind === 'local' && !p.dead) || w.players[0];
  for (const m of w.wingmen) updateWingman(w, m, lead, dt);

  /* ---- enemies ---- */
  const alivePlayers = w.players.filter(p => !p.dead);
  for (const e of [...w.enemies]) { if (!e.dead) updateEnemy(w, e, dt, alivePlayers); }
  // separation
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j], dx = b.x - a.x, dy = b.y - a.y, rr = ENEMY_TYPES[a.type].r + ENEMY_TYPES[b.type].r;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), push = (rr - d) * 0.5, nx = dx / d, ny = dy / d; const ab = ENEMY_TYPES[a.type].boss, bb = ENEMY_TYPES[b.type].boss; if (!ab) { a.x -= nx * push; a.y -= ny * push; } if (!bb) { b.x += nx * push; b.y += ny * push; } }
  }

  /* ---- rocks ---- */
  for (let i = w.rocks.length - 1; i >= 0; i--) {
    const r = w.rocks[i];
    r.rot += r.spin * dt; r.hit = Math.max(0, r.hit - dt * 5);
    const d = Math.hypot(r.x, r.y) || 1, tx = -r.y / d, ty = r.x / d;
    r.x += (tx * r.orbit * d * 0.5 + r.vx) * dt; r.y += (ty * r.orbit * d * 0.5 + r.vy) * dt;
    r.vx *= Math.exp(-dt); r.vy *= Math.exp(-dt);
    if (d < pl.r + r.r + 40) { r.x = r.x / d * (pl.r + r.r + 40); r.y = r.y / d * (pl.r + r.r + 40); }
    for (const p of w.players) {
      if (p.dead || p.kind !== 'local') continue;
      const dx = p.x - r.x, dy = p.y - r.y, dd = Math.hypot(dx, dy);
      if (dd < r.r + 20) { const nx = dx / dd, ny = dy / dd; p.x = r.x + nx * (r.r + 20); p.y = r.y + ny * (r.r + 20); const vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= vn * 1.6 * nx; p.vy -= vn * 1.6 * ny; if (-vn > 180 && p.rockCd <= 0) { damagePlayer(w, p, 6); p.rockCd = 0.6; } } }
    }
  }
  if (w.P.mission.hazard === 'asteroids' && w.rocks.length < 7 && Math.random() < dt * 0.3) spawnRock(w);

  /* ---- bullets ---- */
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i];
    b.life -= dt;
    if (b.homing && b.team === 1) {
      const tp = nearestPlayer(w, b.x, b.y, 900);
      if (tp) { const a = Math.atan2(tp.y - b.y, tp.x - b.x), ba = Math.atan2(b.vy, b.vx); let d = a - ba; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = ba + clamp(d, -dt * 1.6, dt * 1.6), s = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s; }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead) {
      // rocks block everything
      for (const r of w.rocks) {
        const dx = b.x - r.x, dy = b.y - r.y;
        if (dx * dx + dy * dy < (r.r + b.r) ** 2) {
          dead = true; burst(w, b.x, b.y, 4, '#d8c8b0', 120, 0.3, 2, 0);
          if (b.team === 0 || b.team === 2) { r.hp -= b.dmg; r.hit = 1; if (r.hp <= 0) breakRock(w, r); }
          break;
        }
      }
    }
    if (!dead && (b.team === 0 || b.team === 2)) {
      for (const e of w.enemies) {
        if (e.ghost > 0) continue;
        const T = ENEMY_TYPES[e.type], dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (T.r + b.r) ** 2) {
          if (b.slow) { e.slow = 2; e.slowAmt = b.slow; }
          burst(w, b.x, b.y, 3, b.color, 160, 0.25, 2, 0);
          Sound.sfx('hit');
          damageEnemy(w, e, b.dmg, b.owner);
          if (b.pierce > 0) { b.pierce--; b.x += b.vx * 0.03; b.y += b.vy * 0.03; }
          else dead = true;
          break;
        }
      }
    } else if (!dead && b.team === 1) {
      for (const p of w.players) {
        if (p.dead) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < (b.r + 20) ** 2) { damagePlayer(w, p, b.dmg); burst(w, b.x, b.y, 6, b.color, 160, 0.3, 2, 0); dead = true; break; }
      }
      if (!dead) { const dx = b.x - pl.x, dy = b.y - pl.y; if (dx * dx + dy * dy < (pl.r + b.r) ** 2) { damagePlanet(w, b.dmg); burst(w, b.x, b.y, 8, b.color, 140, 0.4, 3, 0); dead = true; } }
    }
    if (dead) w.bullets.splice(i, 1);
  }
  for (const bm of w.beams) updateBeam(w, bm, dt);
  w.beams = w.beams.filter(b => b.t < b.dur);

  /* ---- pickups ---- */
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const k = w.pickups[i]; k.t += dt; k.life -= dt;
    k.vx *= Math.exp(-dt * 2.5); k.vy *= Math.exp(-dt * 2.5);
    let taken = false;
    for (const p of w.players) {
      if (p.dead) continue;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
      const mag = k.type === 'credit' ? 200 : 110;
      if (d < mag && k.t > 0.3) { const pull = (1 - d / mag) * 1800 * dt; k.vx += dx / d * pull; k.vy += dy / d * pull; }
      if (d < 28 && k.t > 0.25) { collect(w, p, k); taken = true; break; }
    }
    k.x += k.vx * dt; k.y += k.vy * dt;
    if (taken || k.life <= 0) w.pickups.splice(i, 1);
  }

  /* ---- particles & text ---- */
  for (let i = w.parts.length - 1; i >= 0; i--) {
    const p = w.parts[i]; p.life -= dt;
    if (p.life <= 0) { w.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const dr = p.type === 3 ? 1.2 : p.type === 0 ? 2.6 : 1.8;
    p.vx *= Math.exp(-dr * dt); p.vy *= Math.exp(-dr * dt); p.rot += dt * 6;
  }
  for (let i = w.texts.length - 1; i >= 0; i--) { const t = w.texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) w.texts.splice(i, 1); }
  for (const e of w.enemies) { e.hit = Math.max(0, e.hit - dt * 6); }
  for (const p of w.players) p.hit = Math.max(0, p.hit);

  if (w.boss) UI.bossBar(ENEMY_TYPES[w.boss.type].name, w.boss.hp / w.boss.maxHp);
  updateCamera(w, dt);
}

function stepLocalPlayer(w, p, dt, pads) {
  const pl = w.planet;
  readLocalInput(w, p, pads);
  if (w.phase === 'brief') { p.inp.fire = false; p.inp.nova = false; }
  const inp = p.inp, st = p.st;
  const mag = Math.hypot(inp.mx, inp.my);
  const hasFuel = p.fuel > 0;
  const boosting = inp.boost && hasFuel && mag > 0.1;
  let accel = st.accel, maxSp = st.speed;
  if (!hasFuel) { accel *= 0.35; maxSp *= 0.42; }
  if (boosting) { accel *= 1.9; maxSp *= 1.75; }
  if (mag > 0.05) {
    p.vx += inp.mx * accel * dt; p.vy += inp.my * accel * dt;
    const use = st.fuelUse * (2.4 * mag + (boosting ? 15 : 0)) * dt;
    if (hasFuel) { p.fuel = Math.max(0, p.fuel - use); w.fuelUsed += use; }
    if (boosting) { Sound.sfx('boost'); }
  }
  p.thrust = lerp(p.thrust, mag, dt * 10); p.boost = boosting;
  const drag = mag > 0.05 ? 1.2 : 2.4;
  p.vx *= Math.exp(-drag * dt); p.vy *= Math.exp(-drag * dt);
  const sp = Math.hypot(p.vx, p.vy); if (sp > maxSp) { p.vx *= maxSp / sp; p.vy *= maxSp / sp; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  octConfine(p, ARENA - 30);
  // planet collision
  const pdx = p.x - pl.x, pdy = p.y - pl.y, pd = Math.hypot(pdx, pdy);
  if (pd < pl.r + 24) { const nx = pdx / pd, ny = pdy / pd; p.x = pl.x + nx * (pl.r + 24); p.y = pl.y + ny * (pl.r + 24); const vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= vn * 1.4 * nx; p.vy -= vn * 1.4 * ny; } }
  // refuel orbit
  p.refuel = pd < pl.r + 190 && p.fuel < st.fuelMax;
  if (p.refuel) { p.fuel = Math.min(st.fuelMax, p.fuel + 16 * dt); if (Math.random() < 0.4) { const a = Math.atan2(pdy, pdx); part(w, pl.x + Math.cos(a) * pl.r, pl.y + Math.sin(a) * pl.r, pdx / pd * 260 + (Math.random() - 0.5) * 60, pdy / pd * 260 + (Math.random() - 0.5) * 60, (pd - pl.r) / 260, 4, '#ff9a3c', 1); } }
  // fuel barks
  if (p.fuel < st.fuelMax * 0.2 && p.fuel > 0 && !p.lowFuelWarned) { p.lowFuelWarned = true; bark(w, 'lowFuel'); Sound.sfx('alarm'); }
  if (p.fuel > st.fuelMax * 0.35) p.lowFuelWarned = false;
  if (p.fuel <= 0 && mag > 0.1) { bark(w, 'noFuel'); if (Math.random() < 0.08) part(w, p.x, p.y, -p.vx * 0.2 + (Math.random() - 0.5) * 40, -p.vy * 0.2 + (Math.random() - 0.5) * 40, 0.8, 8, '#55505a', 3); }
  // aim / facing
  if (inp.aim !== null) p.aim = inp.aim;
  else if (mag > 0.1) p.aim = Math.atan2(inp.my, inp.mx);
  let da = p.aim - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); p.ang += da * Math.min(1, dt * 16);
  // weapons
  p.fireCd -= dt; p.novaCd = Math.max(0, p.novaCd - dt);
  if (inp.fire && p.fireCd <= 0 && w.phase === 'play') { p.fireCd = 1 / st.rate; if (w.isGuest) Net.guestFired(w, p); else firePlayer(w, p); }
  if (inp.nova && p.novaCd <= 0 && w.phase === 'play') { if (w.isGuest) Net.guestNova(w, p); else triggerNova(w, p); }
  // regen
  if (w.t - p.lastHit > 2.5) p.shield = Math.min(st.shieldMax, p.shield + st.shieldRegen * dt);
  if (st.hullRegen > 0) p.hull = Math.min(st.hullMax, p.hull + st.hullRegen * dt);
  // engine trail
  if (p.thrust > 0.2 && Math.random() < (boosting ? 1 : 0.5)) {
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    for (const s of [-1, 1]) part(w, p.x - ca * 22 - sa * 8 * s, p.y - sa * 22 + ca * 8 * s, -ca * 120 + (Math.random() - 0.5) * 30 + p.vx * 0.3, -sa * 120 + (Math.random() - 0.5) * 30 + p.vy * 0.3, boosting ? 0.45 : 0.3, boosting ? 7 : 4, boosting ? '#bfe6ff' : p.scheme.flame, 1);
  }
  p.rockCd = Math.max(0, p.rockCd - dt);
}

function nearestPlayer(w, x, y, range) {
  let best = null, bd = range * range;
  for (const p of w.players) { if (p.dead) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
function collect(w, p, k) {
  if (p.kind === 'remote') {
    if (k.type === 'credit') { Net.guestEvent(p.peer, 'cr', k.val); Sound.sfx('coin'); }
    else { Net.guestEvent(p.peer, k.type, k.val); Sound.sfx(k.type === 'fuel' ? 'fuel' : 'pickup'); }
    return;
  }
  if (k.type === 'credit') { w.earned += k.val; Sound.sfx('coin'); }
  else if (k.type === 'fuel') { p.fuel = Math.min(p.st.fuelMax, p.fuel + k.val); floatText(w, p.x, p.y - 30, '+' + k.val + ' FUEL', '#ffb366', 14); Sound.sfx('fuel'); }
  else if (k.type === 'repair') { p.hull = Math.min(p.st.hullMax, p.hull + k.val); floatText(w, p.x, p.y - 30, '+' + k.val + ' HULL', '#7dffc9', 14); Sound.sfx('pickup'); }
}
function breakRock(w, r) {
  w.rocks.splice(w.rocks.indexOf(r), 1);
  explode(w, r.x, r.y, r.r / 30, '#c8a07a');
  if (r.r > 30) for (let i = 0; i < 2; i++) { const n = spawnRock(w, r.x + (Math.random() - 0.5) * 20, r.y + (Math.random() - 0.5) * 20, r.r * 0.55); n.vx = (Math.random() - 0.5) * 160; n.vy = (Math.random() - 0.5) * 160; }
  if (r.fuel) w.pickups.push({ x: r.x, y: r.y, vx: 0, vy: 0, type: 'fuel', val: 25, life: 16, t: 0 });
  w.pickups.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, type: 'credit', val: 4, life: 14, t: 0 });
}

/* ---------- wingmen AI ---------- */
function updateWingman(w, m, lead, dt) {
  const play = w.phase === 'play';
  m.cd -= dt;
  if (m.kind === 'drone') {
    m.orbit += dt * 2.2;
    const tx = lead.x + Math.cos(m.orbit) * 62, ty = lead.y + Math.sin(m.orbit) * 62;
    m.x = lerp(m.x, tx, Math.min(1, dt * 12)); m.y = lerp(m.y, ty, Math.min(1, dt * 12));
    const e = nearestEnemy(w, m.x, m.y, 470);
    if (e) { m.aim = Math.atan2(e.y - m.y, e.x - m.x); if (m.cd <= 0 && play) { m.cd = 1 / (2.6 + m.lv * 0.25); const offs = m.twin ? [-5, 5] : [0]; for (const o of offs) { const ca = Math.cos(m.aim), sa = Math.sin(m.aim); w.bullets.push({ x: m.x + ca * 12 - sa * o, y: m.y + sa * 12 + ca * o, vx: ca * 820, vy: sa * 820, life: 0.7, dmg: 8 + m.lv * 4, team: 2, r: 3, color: '#8fa6ff', core: '#e6ecff', owner: null, pierce: m.lv >= 5 ? 1 : 0, kind: 2 }); } Sound.sfx('laser2'); } }
    return;
  }
  // fighter & spore: steer
  let tx, ty, target = null;
  if (m.kind === 'fighter' || m.kind === 'hopper') {
    target = nearestEnemy(w, lead.x, lead.y, 620);
    if (target) { m.orbit += dt * 1.6; tx = target.x + Math.cos(m.orbit) * 170; ty = target.y + Math.sin(m.orbit) * 170; }
    else { const a = lead.ang + Math.PI * 0.75; tx = lead.x + Math.cos(a) * 80; ty = lead.y + Math.sin(a) * 80; }
  } else {
    target = nearestEnemy(w, w.planet.x, w.planet.y, w.planet.r + 520);
    if (target) { m.orbit += dt * 1.2; tx = target.x + Math.cos(m.orbit) * 200; ty = target.y + Math.sin(m.orbit) * 200; }
    else { m.orbit += dt * 0.5; tx = Math.cos(m.orbit) * (w.planet.r + 230); ty = Math.sin(m.orbit) * (w.planet.r + 230); }
  }
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
  const maxS = m.kind === 'fighter' || m.kind === 'hopper' ? 400 : 280;
  m.vx += dx / d * 1200 * dt; m.vy += dy / d * 1200 * dt;
  const s = Math.hypot(m.vx, m.vy); if (s > maxS) { m.vx *= maxS / s; m.vy *= maxS / s; }
  m.vx *= Math.exp(-dt * 1.4); m.vy *= Math.exp(-dt * 1.4);
  m.x += m.vx * dt; m.y += m.vy * dt;
  m.thrust = clamp(s / maxS, 0, 1);
  const face = target ? Math.atan2(target.y - m.y, target.x - m.x) : Math.atan2(m.vy, m.vx);
  let da = face - m.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); m.ang += da * Math.min(1, dt * 8);
  if (target && play && m.cd <= 0) {
    const dist = Math.hypot(target.x - m.x, target.y - m.y);
    if (m.kind === 'fighter' && dist < 520) {
      m.cd = 1 / (2.4 * (1 + m.lv * 0.1));
      const a = Math.atan2(target.y - m.y, target.x - m.x);
      w.bullets.push({ x: m.x + Math.cos(a) * 18, y: m.y + Math.sin(a) * 18, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, dmg: 12 + m.lv * 5, team: 2, r: 3.5, color: '#ffc04a', core: '#fff3cc', owner: null, pierce: 0, kind: 2 });
      Sound.sfx('laser2');
    } else if (m.kind === 'spore' && dist < 440) {
      m.cd = 0.8;
      const a = Math.atan2(target.y - m.y, target.x - m.x);
      w.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.2, dmg: 10 + m.lv * 5, team: 2, r: 6, color: '#d08bff', core: '#f6e0ff', owner: null, pierce: 0, kind: 3, slow: 0.3 + m.lv * 0.08 });
    } else if ((m.kind === 'hopper' || m.kind === 'hoppling') && dist < 480) {
      const n = m.kind === 'hopper' ? 1 + Math.ceil(m.lv / 2) : 1;
      m.cd = m.kind === 'hopper' ? 0.75 : 1.1 + Math.random() * 0.4;
      const a = Math.atan2(target.y - m.y, target.x - m.x);
      for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * 0.16; w.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a + o) * 620, vy: Math.sin(a + o) * 620, life: 0.9, dmg: m.kind === 'hopper' ? 8 + m.lv * 4 : 7 + m.lv * 3, team: 2, r: 5, color: '#ffb3d9', core: '#fffaf0', owner: null, pierce: 0, kind: 4, star: true }); }
      Sound.sfx('boing');
    }
  }
}

/* ---------- enemy AI ---------- */
function pickTarget(w, e, alive) {
  const T = ENEMY_TYPES[e.type];
  if (e.type === 'leech') return w.planet;
  let best = null, bd = (e.type === 'brute' || T.boss ? 1e9 : 640 * 640);
  for (const p of alive) { const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; best = p; } }
  if (e.type === 'nullheart' || e.type === 'hivemother' || e.type === 'inkwraith') return best && bd < 700 * 700 ? best : w.planet;
  return best || w.planet;
}
function enemyShoot(w, e, a, speed, dmg, color, r = 6, homing = false, life = 3) {
  w.bullets.push({ x: e.x + Math.cos(a) * ENEMY_TYPES[e.type].r, y: e.y + Math.sin(a) * ENEMY_TYPES[e.type].r, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, dmg, team: 1, r, color, core: '#ffffff', homing, kind: 1 });
}
function updateEnemy(w, e, dt, alive) {
  const T = ENEMY_TYPES[e.type], pl = w.planet;
  e.t += dt; e.retarget -= dt; e.slow = Math.max(0, e.slow - dt);
  if (e.retarget <= 0 || !e.target || e.target.dead) { e.target = pickTarget(w, e, alive); e.retarget = 0.5; }
  const tg = e.target;
  const isPlanet = tg === pl;
  let dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1;
  const spd = T.spd * (e.slow > 0 ? 1 - e.slowAmt : 1);
  let ax = 0, ay = 0, face = Math.atan2(dy, dx);
  const playing = w.phase === 'play';
  switch (e.type) {
    case 'skitter': case 'blotling': {
      const wob = Math.sin(e.t * 5 + e.seed) * 0.6;
      const a = face + wob * (d > 200 ? 1 : 0.2);
      ax = Math.cos(a) * spd * 3; ay = Math.sin(a) * spd * 3;
      break;
    }
    case 'spitter': case 'weaver': case 'scrawl': {
      const range = T.range || 380;
      const want = isPlanet ? pl.r + range * 0.8 : range;
      const radial = (d - want) / 100;
      const tang = e.seed > 50 ? 1 : -1;
      ax = (dx / d * clamp(radial, -1, 1) + (-dy / d) * tang * 0.7) * spd * 3;
      ay = (dy / d * clamp(radial, -1, 1) + (dx / d) * tang * 0.7) * spd * 3;
      e.cd -= dt;
      if (e.type !== 'weaver') {
        if (e.cd < 0.45) e.charge = 1 - e.cd / 0.45;
        if (e.cd <= 0 && d < range + 160 && playing) { e.cd = T.fire + Math.random() * 0.6; e.charge = 0; enemyShoot(w, e, face, 330, 8, e.type === 'scrawl' ? '#b06bff' : '#c6ff5c', 6); Sound.sfx('eshot'); }
      } else {
        if (e.cd <= 0 && playing) { e.cd = 3; enemyShoot(w, e, face, 200, 10, '#ff5ad0', 8, true, 4); Sound.sfx('eshot'); }
        e.cd2 -= dt;
        if (e.cd2 <= 0 && playing && e.kids < 3 && w.enemies.length < 40) { e.cd2 = 6; e.kids++; spawnEnemy(w, 'skitter', e.x - Math.cos(face) * 20, e.y - Math.sin(face) * 20); burst(w, e.x, e.y, 8, T.glow, 120, 0.4, 2, 1); }
      }
      break;
    }
    case 'brute': {
      e.cd -= dt;
      if (e.state === 0) { ax = dx / d * spd * 2.5; ay = dy / d * spd * 2.5; if (e.cd <= 0 && d < 600 && !isPlanet) { e.state = 1; e.st = 0.7; e.cd = 4.5; e.chargeA = face; } }
      else if (e.state === 1) { e.st -= dt; e.charge = 1; face = e.chargeA = Math.atan2(dy, dx); if (Math.random() < 0.5) part(w, e.x, e.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.4, 10, '#ff2a6a', 1); if (e.st <= 0) { e.state = 2; e.st = 0.75; } }
      else { e.st -= dt; face = e.chargeA; e.vx = Math.cos(e.chargeA) * spd * 4.2; e.vy = Math.sin(e.chargeA) * spd * 4.2; if (e.st <= 0) { e.state = 0; e.charge = 0; } }
      break;
    }
    case 'leech': {
      if (e.latch === null) {
        ax = dx / d * spd * 3; ay = dy / d * spd * 3;
        if (d < pl.r + 14) { e.latch = Math.atan2(e.y - pl.y, e.x - pl.x); }
      } else {
        e.latch += dt * 0.08;
        e.x = pl.x + Math.cos(e.latch) * (pl.r + 6); e.y = pl.y + Math.sin(e.latch) * (pl.r + 6); e.vx = e.vy = 0;
        face = e.latch + Math.PI;
        if (playing) damagePlanet(w, 7 * dt);
        if (Math.random() < 0.3) part(w, e.x, e.y, Math.cos(e.latch) * 60 + (Math.random() - 0.5) * 40, Math.sin(e.latch) * 60 + (Math.random() - 0.5) * 40, 0.6, 4, w.P.atmo, 1);
      }
      break;
    }
    case 'hivemother': {
      const want = isPlanet ? pl.r + 380 : 300;
      const tang = 1;
      ax = (dx / d * clamp((d - want) / 120, -1, 1) - dy / d * tang * 0.5) * spd * 3;
      ay = (dy / d * clamp((d - want) / 120, -1, 1) + dx / d * tang * 0.5) * spd * 3;
      e.cd -= dt; e.cd2 -= dt;
      if (playing && e.cd <= 0) { e.cd = e.hp < e.maxHp * 0.5 ? 1.6 : 2.3; const n = 14, off = e.t; for (let i = 0; i < n; i++) enemyShoot(w, e, off + i / n * TAU, 230, 9, '#b6ff4a', 7); Sound.sfx('eshot'); }
      if (playing && e.cd2 <= 0 && w.enemies.length < 30) { e.cd2 = 3.5; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; spawnEnemy(w, 'skitter', e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80); } burst(w, e.x, e.y, 20, T.glow, 200, 0.6, 3, 1); }
      if (playing && e.hp < e.maxHp * 0.5) { e.cd3 -= dt; if (e.cd3 <= 0) { e.cd3 = 1.4; const p = nearestPlayer(w, e.x, e.y, 900); if (p) { const a = Math.atan2(p.y - e.y, p.x - e.x); for (const o of [-0.15, 0, 0.15]) enemyShoot(w, e, a + o, 380, 12, '#eaff6a', 7); } } }
      face = e.t * 0.3;
      break;
    }
    case 'maw': {
      ax = dx / d * spd * 2; ay = dy / d * spd * 2;
      // gravity pull on players
      for (const p of alive) {
        if (p.kind !== 'local') continue;
        const px = e.x - p.x, py = e.y - p.y, pd = Math.hypot(px, py);
        if (pd < 750 && pd > 1) { const f = (1 - pd / 750) * 420; p.vx += px / pd * f * dt; p.vy += py / pd * f * dt; if (Math.random() < 0.2) part(w, p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 60, px / pd * 200, py / pd * 200, 0.5, 3, '#ff7a4a', 0); }
      }
      e.cd -= dt; e.cd2 -= dt;
      if (playing && e.cd <= 0) { e.cd = e.hp < e.maxHp * 0.5 ? 2 : 3; const n = 18; for (let i = 0; i < n; i++) enemyShoot(w, e, e.t + i / n * TAU, 260, 11, '#ff6a3a', 7); Sound.sfx('eshot'); }
      if (playing && e.cd2 <= 0 && !isPlanet) { e.cd2 = 5.5; e.vx = dx / d * 650; e.vy = dy / d * 650; part(w, e.x, e.y, 0, 0, 0.4, 160, '#ff5a3d', 2); }
      break;
    }
    case 'inkwraith': {
      const want = pl.r + 430;
      const pdx = pl.x - e.x, pdy = pl.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
      ax = (pdx / pd * clamp((pd - want) / 120, -1, 1) + pdy / pd * 0.45) * spd * 3;
      ay = (pdy / pd * clamp((pd - want) / 120, -1, 1) - pdx / pd * 0.45) * spd * 3;
      const frac = e.hp / e.maxHp;
      e.eye = Math.atan2(dy, dx);
      e.cd -= dt; e.cd2 -= dt; e.cd3 -= dt; e.fade -= dt;
      if (e.ghost > 0) {
        e.ghost -= dt;
        if (e.ghost <= 0) { const a = Math.random() * TAU; e.x = pl.x + Math.cos(a) * want; e.y = pl.y + Math.sin(a) * want; e.vx = e.vy = 0; burst(w, e.x, e.y, 30, '#b06bff', 260, 0.6, 3, 1); Sound.sfx('spawn'); }
      } else if (playing && e.fade <= 0) {
        e.fade = 10; e.ghost = 2.2; burst(w, e.x, e.y, 30, '#b06bff', 220, 0.6, 3, 1);
      }
      if (playing && e.ghost <= 0) {
        if (e.cd <= 0) { const n = frac > 0.5 ? 2 : 3; e.cd = frac > 0.5 ? 0.17 : 0.12; for (let k = 0; k < n; k++) enemyShoot(w, e, e.t * 2.4 + k * TAU / n, 230, 9, '#b06bff', 7, false, 4); }
        if (frac < 0.6 && e.cd2 <= 0) { e.cd2 = frac < 0.3 ? 4.5 : 6.5; const p = nearestPlayer(w, e.x, e.y, 2500); const a0 = p ? Math.atan2(p.y - e.y, p.x - e.x) : Math.random() * TAU; w.beams.push({ owner: e, a: a0 - 0.6, spin: 0.5 * (Math.random() < 0.5 ? 1 : -1), t: 0, warn: 1.1, dur: 3, len: 1500, w: 22 }); }
        if (e.cd3 <= 0 && w.enemies.length < 24) { e.cd3 = 7; for (let k = 0; k < 3; k++) spawnPortal(w, 'blotling'); }
      }
      face = 0;
      break;
    }
    case 'nullheart': {
      const want = pl.r + 480;
      const pdx = pl.x - e.x, pdy = pl.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
      ax = (pdx / pd * clamp((pd - want) / 120, -1, 1) - pdy / pd * 0.4) * spd * 3;
      ay = (pdy / pd * clamp((pd - want) / 120, -1, 1) + pdx / pd * 0.4) * spd * 3;
      const frac = e.hp / e.maxHp;
      e.eye = Math.atan2(dy, dx);
      e.cd -= dt; e.cd2 -= dt; e.cd3 -= dt;
      if (playing && e.cd <= 0) { e.cd = frac > 0.66 ? 0.11 : 0.08; enemyShoot(w, e, e.t * 2.2, 240, 9, '#ff3d71', 6, false, 4); enemyShoot(w, e, e.t * 2.2 + Math.PI, 240, 9, '#ff3d71', 6, false, 4); if (frac < 0.33) enemyShoot(w, e, -e.t * 1.7, 260, 9, '#b98cff', 6, false, 4); }
      if (playing && frac < 0.66 && e.cd2 <= 0) { e.cd2 = frac < 0.33 ? 4 : 6; const p = nearestPlayer(w, e.x, e.y, 2500); const a0 = p ? Math.atan2(p.y - e.y, p.x - e.x) : Math.random() * TAU; w.beams.push({ owner: e, a: a0 - 0.6, spin: 0.55 * (Math.random() < 0.5 ? 1 : -1), t: 0, warn: 1.1, dur: 3.2, len: 1700, w: 26 }); }
      if (playing && e.cd3 <= 0 && w.enemies.length < 26) { e.cd3 = frac < 0.33 ? 5 : 8; for (let i = 0; i < 3; i++) spawnPortal(w, ['skitter', 'spitter', 'leech'][i]); }
      face = 0;
      break;
    }
  }
  if (e.type !== 'brute' || e.state === 0) {
    if (!(e.type === 'leech' && e.latch !== null)) { e.vx += ax * dt; e.vy += ay * dt; e.vx *= Math.exp(-dt * 2.6); e.vy *= Math.exp(-dt * 2.6); }
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
  octConfine(e, ARENA + 60, 0.2);
  if (e.type !== 'nullheart' && e.type !== 'maw' && e.type !== 'hivemother' && e.type !== 'inkwraith') { let da = face - e.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); e.ang += da * Math.min(1, dt * 8); }
  else if (e.type === 'hivemother') e.ang = face;
  // contact with players
  for (const p of alive) {
    const cx = p.x - e.x, cy = p.y - e.y, cd = Math.hypot(cx, cy);
    if (cd < T.r + 20) {
      if (e.type === 'skitter' || e.type === 'blotling') { damagePlayer(w, p, T.dmg); explode(w, e.x, e.y, 0.8, T.glow); e.dead = true; w.enemies.splice(w.enemies.indexOf(e), 1); return; }
      if (e.contactCd > e.t) continue;
      e.contactCd = e.t + 0.6;
      damagePlayer(w, p, T.dmg * (e.state === 2 ? 1.6 : 1));
      if (p.kind === 'local') { const nx = cx / (cd || 1), ny = cy / (cd || 1); p.vx += nx * 420; p.vy += ny * 420; }
    }
  }
  // contact with planet
  if (e.type !== 'leech') {
    const qx = e.x - pl.x, qy = e.y - pl.y, qd = Math.hypot(qx, qy);
    if (qd < pl.r + T.r * 0.8) {
      if (e.type === 'skitter' || e.type === 'blotling') { damagePlanet(w, 20); explode(w, e.x, e.y, 0.8, T.glow); e.dead = true; w.enemies.splice(w.enemies.indexOf(e), 1); return; }
      if (playing) damagePlanet(w, T.dmg * dt * 2);
      e.x = pl.x + qx / qd * (pl.r + T.r * 0.8); e.y = pl.y + qy / qd * (pl.r + T.r * 0.8);
    }
  }
}
function updateBeam(w, bm, dt) {
  bm.t += dt;
  const o = bm.owner;
  if (o.dead) { bm.t = bm.dur; return; }
  bm.x = o.x; bm.y = o.y;
  if (bm.t > bm.warn) {
    bm.a += bm.spin * dt;
    if (w.phase !== 'play') return;
    const ca = Math.cos(bm.a), sa = Math.sin(bm.a);
    for (const p of w.players) {
      if (p.dead) continue;
      const rx = p.x - bm.x, ry = p.y - bm.y, along = rx * ca + ry * sa, perp = Math.abs(-rx * sa + ry * ca);
      if (along > 0 && along < bm.len && perp < bm.w + 16) { if (!bm.hitT || bm.hitT < w.t) { bm.hitT = w.t + 0.25; damagePlayer(w, p, 14); } }
    }
    if (Math.random() < 0.6) { const d = Math.random() * bm.len; part(w, bm.x + ca * d, bm.y + sa * d, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.4, 5, '#ff3d71', 1); }
  }
}

/* remote (online) players inside the host's world */
function updateRemotePlayer(w, p, dt) {
  const r = p.remote; if (!r) return;
  p.x = lerp(p.x, r.x, Math.min(1, dt * 14)); p.y = lerp(p.y, r.y, Math.min(1, dt * 14));
  let da = r.ang - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); p.ang += da * Math.min(1, dt * 14);
  p.aim = r.aim; p.dead = r.dead; p.thrust = r.thrust; p.boost = r.boost;
  p.hull = r.hullPct * p.st.hullMax; p.shield = r.shieldPct * p.st.shieldMax;
  p.fireCd -= dt; p.novaCd = Math.max(0, p.novaCd - dt);
  if (!p.dead && r.fire && p.fireCd <= 0 && w.phase === 'play') { firePlayer(w, p); p.fireCd = 1 / p.st.rate; }
  if (!p.dead && r.novaSeq !== p.novaSeqSeen) { p.novaSeqSeen = r.novaSeq; if (w.phase === 'play') triggerNova(w, p); }
}

/* ---------- camera ---------- */
function updateCamera(w, dt) {
  const locals = w.players.filter(p => p.kind === 'local');
  const focus = locals.filter(p => !p.dead);
  const list = focus.length ? focus : [w.planet];
  let cx = 0, cy = 0; for (const p of list) { cx += p.x; cy += p.y; } cx /= list.length; cy /= list.length;
  let base = clamp(Math.min(VW, VH) / 620, 0.6, 1.4);
  if (focus.length > 1) { const sx = Math.abs(focus[0].x - focus[1].x) + 400, sy = Math.abs(focus[0].y - focus[1].y) + 400; base = Math.min(base, VW / sx, VH / sy); base = Math.max(base, 0.38); }
  // lead toward aim
  const p0 = focus[0];
  if (p0 && focus.length === 1) { cx += Math.cos(p0.aim) * 60; cy += Math.sin(p0.aim) * 60; }
  w.cam.x = lerp(w.cam.x, cx, Math.min(1, dt * 5)); w.cam.y = lerp(w.cam.y, cy, Math.min(1, dt * 5));
  w.cam.zoom = lerp(w.cam.zoom, base, Math.min(1, dt * 3));
}

/* ================= RENDER ================= */
function drawBackground(neb, cx, cy) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#03040b'; ctx.fillRect(0, 0, VW, VH);
  const S = Math.max(VW, VH) * 1.5;
  ctx.drawImage(neb, VW / 2 - S / 2 - cx * 0.04, VH / 2 - S / 2 - cy * 0.04, S, S);
  const pars = [0.05, 0.12, 0.24];
  STARS.forEach((tile, i) => {
    const ts = 512, par = pars[i];
    let sx = (-cx * par) % ts; if (sx > 0) sx -= ts;
    let sy = (-cy * par) % ts; if (sy > 0) sy -= ts;
    for (let x = sx; x < VW; x += ts) for (let y = sy; y < VH; y += ts) ctx.drawImage(tile, x, y);
  });
}
function overlayText(w, x, y, text, color, size, alpha = 1) {
  const sx = (x - w.cam.x) * w.cam.zoom + VW / 2, sy = (y - w.cam.y) * w.cam.zoom + VH / 2;
  if (sx < -50 || sx > VW + 50 || sy < -50 || sy > VH + 50) return;
  octx.globalAlpha = alpha;
  octx.font = `700 ${size}px ${PIXEL_FONT}`; octx.textAlign = 'center';
  octx.fillStyle = 'rgba(3,4,12,0.85)'; octx.fillText(text, Math.round(sx) + 2, Math.round(sy) + 2);
  octx.fillStyle = color; octx.fillText(text, Math.round(sx), Math.round(sy));
  octx.globalAlpha = 1;
}
function renderWorld(w, opts = {}) {
  const cam = w.cam, z = cam.zoom;
  const shk = Save.d.settings.shake ? w.shake : 0;
  const sx = (Math.random() - 0.5) * shk, sy = (Math.random() - 0.5) * shk;
  drawBackground(w.neb, cam.x, cam.y);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (VW / 2 - cam.x * z + sx), DPR * (VH / 2 - cam.y * z + sy));
  const t = G.t, pl = w.planet;
  // arena octagon
  ctx.strokeStyle = 'rgba(178,92,255,0.35)'; ctx.lineWidth = PX / z; ctx.setLineDash([30, 22]);
  octPath(ctx, ARENA / Math.cos(Math.PI / 8), Math.PI / 8); ctx.stroke(); ctx.setLineDash([]);
  // fuel orbit ring
  ctx.strokeStyle = 'rgba(255,154,60,0.3)'; ctx.lineWidth = PX / z; ctx.setLineDash([8, 14]);
  ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 190, t * 0.05, t * 0.05 + TAU); ctx.stroke(); ctx.setLineDash([]);
  // planet
  drawPlanet(ctx, w.P, pl.x, pl.y, pl.r, pl.rot, 40, { damage: pl.flash * 0.35, dim: w.P.mission.hazard === 'dark' });
  if (pl.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(120,200,255,${pl.flash * 0.6})`; ctx.lineWidth = 4; octPath(ctx, pl.r + 22, t); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  // pickups
  for (const k of w.pickups) {
    const blink = k.life < 3 ? (Math.sin(k.life * 20) > 0 ? 1 : 0.3) : 1;
    ctx.globalCompositeOperation = 'lighter';
    if (k.type === 'credit') { drawGlow(ctx, '#ffd84a', k.x, k.y, 12, 0.7 * blink); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff2b0'; octPath(ctx, 4, t * 3 + k.x, k.x, k.y); ctx.fill(); }
    else if (k.type === 'fuel') { drawGlow(ctx, '#ff9a3c', k.x, k.y, 26, 0.8 * blink); ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(Math.sin(t * 2 + k.x) * 0.3); ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-7, -10, 14, 20); ctx.fillStyle = '#2a1408'; ctx.fillRect(-7, -3, 14, 5); ctx.fillStyle = '#ffe0b0'; ctx.fillRect(-3, -13, 6, 4); ctx.restore(); }
    else { drawGlow(ctx, '#7dffc9', k.x, k.y, 24, 0.8 * blink); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#7dffc9'; ctx.fillRect(k.x - 8, k.y - 3, 16, 6); ctx.fillRect(k.x - 3, k.y - 8, 6, 16); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // rocks
  const rockTint = w.P.style === 'ice' ? ['#dff2ff', '#5a7a9a'] : ['#8a6a58', '#2a1a14'];
  for (const r of w.rocks) drawRock(ctx, r, rockTint);
  // portals
  for (const p of w.portals) {
    const k = p.t / p.dur, R = p.r * 2.2 * Math.sin(k * Math.PI * 0.5 + 0.2);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#8a3dff', p.x, p.y, R * 2.2, 0.7);
    ctx.strokeStyle = 'rgba(220,170,255,0.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(p.x, p.y, R * (0.5 + i * 0.25), t * (3 + i) + i, t * (3 + i) + i + 4); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05000a'; ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.4, 0, TAU); ctx.fill();
  }
  // beams (telegraph + fire)
  for (const bm of w.beams) {
    const ca = Math.cos(bm.a), sa = Math.sin(bm.a);
    if (bm.t < bm.warn) {
      ctx.strokeStyle = `rgba(255,61,113,${0.25 + Math.sin(t * 30) * 0.15})`; ctx.lineWidth = 2; ctx.setLineDash([16, 10]);
      ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + ca * bm.len, bm.y + sa * bm.len); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (const [wd, col] of [[bm.w * 2.2, 'rgba(255,40,100,0.25)'], [bm.w, 'rgba(255,90,140,0.6)'], [bm.w * 0.35, 'rgba(255,240,250,0.95)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = wd * (0.9 + Math.random() * 0.2); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + ca * bm.len, bm.y + sa * bm.len); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over';
    }
  }
  // enemies
  for (const e of w.enemies) drawAlien(ctx, e, t);
  // wingmen & players
  for (const m of w.wingmen) drawWingman(ctx, m, t);
  for (const p of w.players) {
    if (p.dead) continue;
    if (p.inv > 0 && Math.sin(t * 30) > 0.3) continue;
    const shieldA = p.st.shieldMax ? (p.shield / p.st.shieldMax) * 0.35 + p.shieldHit * 0.6 : 0;
    drawVanguard(ctx, p.x, p.y, p.ang, p.scheme, t, p.thrust, p.boost, shieldA, p.hit);
    if (w.players.length > 1 || p.kind === 'remote') overlayText(w, p.x, p.y - 44, p.label || (p.idx === 0 ? 'P1' : 'P2'), p.scheme.shield, 13);
  }
  // bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const b of w.bullets) {
    if (b.team === 1) {
      drawGlow(ctx, b.color, b.x, b.y, b.r * 3.2, 0.85);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU); ctx.fill();
    } else if (b.star) {
      drawGlow(ctx, b.color, b.x, b.y, b.r * 3, 0.45);
      ctx.globalCompositeOperation = 'source-over'; drawPaperStar(ctx, b.x, b.y, b.r * 1.7, G.t * 9 + b.x * 0.02, b.color); ctx.globalCompositeOperation = 'lighter';
    } else {
      drawGlow(ctx, b.color, b.x, b.y, b.r * 4, 0.6);
      ctx.strokeStyle = b.core || '#fff'; ctx.lineWidth = b.r * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
  // particles
  for (const p of w.parts) {
    const k = p.life / p.max;
    if (p.type === 0) { ctx.strokeStyle = rgba(p.color, k); ctx.lineWidth = p.size * 0.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
    else if (p.type === 1) drawGlow(ctx, p.color, p.x, p.y, p.size * (0.5 + k * 0.7), k * 0.9);
    else if (p.type === 2) { ctx.strokeStyle = rgba(p.color, k * 0.8); ctx.lineWidth = 2 + k * 6; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * k), 0, TAU); ctx.stroke(); }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const p of w.parts) {
    const k = p.life / p.max;
    if (p.type === 3) { ctx.fillStyle = `rgba(20,16,30,${k * 0.35})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, TAU); ctx.fill(); }
    else if (p.type === 4) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = rgba(p.color, k); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
  }
  // floating text
  for (const tx of w.texts) overlayText(w, tx.x, tx.y, String(tx.text), tx.color, tx.size + 2, clamp(tx.life / tx.max * 1.5, 0, 1));

  // ---- screen space ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (w.P.mission.hazard === 'dark') drawDarkness(w);
  ctx.drawImage(VIGNETTE, 0, 0, VW, VH);
  drawIndicators(w);
  drawRadar(w);
  if (Input.mouse.seen && !Input.touch.used && !G.paused && !G.dialog) drawCrosshair(Input.mouse.x, Input.mouse.y, t);
  if (Input.touch.used) drawTouchSticks();
}
let _dark = null;
function drawDarkness(w) {
  if (!_dark || _dark.width !== Math.ceil(VW / 2) || _dark.height !== Math.ceil(VH / 2)) _dark = makeCanvas(Math.ceil(VW / 2), Math.ceil(VH / 2));
  const g = _dark.getContext('2d'), z = w.cam.zoom;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, _dark.width, _dark.height);
  g.fillStyle = 'rgba(2,0,8,0.93)'; g.fillRect(0, 0, _dark.width, _dark.height);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const sx = ((x - w.cam.x) * z + VW / 2) / 2, sy = ((y - w.cam.y) * z + VH / 2) / 2, R = r * z / 2;
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(sx - R, sy - R, R * 2, R * 2);
  };
  for (const p of w.players) if (!p.dead) hole(p.x, p.y, 420);
  for (const m of w.wingmen) hole(m.x, m.y, 160);
  hole(w.planet.x, w.planet.y, w.planet.r * 1.8);
  for (const p of w.parts) if (p.type === 2) hole(p.x, p.y, p.size * 1.2);
  for (const b of w.bullets) if (b.team === 1) hole(b.x, b.y, 50);
  for (const e of w.enemies) if (ENEMY_TYPES[e.type].boss) hole(e.x, e.y, ENEMY_TYPES[e.type].r * 2.4);
  ctx.drawImage(_dark, 0, 0, VW, VH);
}
function worldToScreen(w, x, y) { return [(x - w.cam.x) * w.cam.zoom + VW / 2, (y - w.cam.y) * w.cam.zoom + VH / 2]; }
function drawIndicators(w) {
  const pad = 26; let n = 0;
  for (const e of w.enemies) {
    const [sx, sy] = worldToScreen(w, e.x, e.y);
    if (sx > 0 && sx < VW && sy > 0 && sy < VH) continue;
    if (++n > 16) break;
    const boss = ENEMY_TYPES[e.type].boss, dx = sx - VW / 2, dy = sy - VH / 2;
    const k = Math.min((VW / 2 - pad) / Math.abs(dx || 1), (VH / 2 - pad) / Math.abs(dy || 1));
    const ix = VW / 2 + dx * k, iy = VH / 2 + dy * k, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ix, iy); ctx.rotate(a);
    ctx.fillStyle = boss ? '#ff3d71' : e.type === 'leech' ? '#4dfff0' : 'rgba(255,90,120,0.75)';
    const s = boss ? 14 : 8;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.6, s * 0.7); ctx.fill();
    ctx.restore();
  }
}
function drawRadar(w) {
  const R = VW < 600 ? 52 : 74, cx = VW - R - 18, cy = VH - R - 18 - (Input.touch.used ? 0 : 0);
  const k = R / (ARENA * 1.08);
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,22,0.72)'; octPath(ctx, R + 6, Math.PI / 8, cx, cy); ctx.fill();
  ctx.strokeStyle = 'rgba(255,198,92,0.6)'; ctx.lineWidth = PX; ctx.stroke();
  ctx.strokeStyle = 'rgba(178,92,255,0.35)'; ctx.lineWidth = 1; octPath(ctx, ARENA * k / Math.cos(Math.PI / 8), Math.PI / 8, cx, cy); ctx.stroke();
  ctx.fillStyle = w.P.atmo; ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, w.planet.r * k), 0, TAU); ctx.fill();
  for (const r of w.rocks) { ctx.fillStyle = 'rgba(200,170,140,0.5)'; ctx.fillRect(cx + r.x * k - 1, cy + r.y * k - 1, 2, 2); }
  for (const p of w.pickups) if (p.type === 'fuel') { ctx.fillStyle = '#ff9a3c'; ctx.fillRect(cx + p.x * k - 1.5, cy + p.y * k - 1.5, 3, 3); }
  for (const e of w.enemies) { const boss = ENEMY_TYPES[e.type].boss; ctx.fillStyle = boss ? '#ff3d71' : '#ff6a8a'; const s = boss ? 6 : 2.6; ctx.fillRect(cx + e.x * k - s / 2, cy + e.y * k - s / 2, s, s); }
  for (const p of w.portals) { ctx.fillStyle = '#b25cff'; ctx.fillRect(cx + p.x * k - 2, cy + p.y * k - 2, 4, 4); }
  for (const m of w.wingmen) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx + m.x * k - 1, cy + m.y * k - 1, 2, 2); }
  for (const p of w.players) { if (p.dead) continue; ctx.fillStyle = p.scheme.shield; octPath(ctx, 3.5, Math.PI / 8, cx + p.x * k, cy + p.y * k); ctx.fill(); }
  ctx.restore();
}
function drawCrosshair(x, y, t) {
  const g = octx; x = Math.round(x); y = Math.round(y);
  g.fillStyle = 'rgba(255,214,130,0.95)';
  for (const [dx, dy, w, h] of [[-12, -2, 6, 3], [7, -2, 6, 3], [-2, -12, 3, 6], [-2, 7, 3, 6]]) g.fillRect(x + dx, y + dy, w, h);
  g.fillStyle = '#fff6dc'; g.fillRect(x - 1, y - 1, 2, 2);
  g.strokeStyle = 'rgba(255,214,130,0.5)'; g.lineWidth = 2; octPath(g, 16, Math.PI / 8 + t * 0.8, x, y); g.stroke();
}
function drawTouchSticks() {
  const t = Input.touch, ctx = octx;
  for (const s of [t.move, t.aim]) {
    if (!s) continue;
    ctx.strokeStyle = 'rgba(255,214,130,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, 60, 0, TAU); ctx.stroke();
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(1, 60 / (d || 1));
    ctx.fillStyle = 'rgba(255,214,130,0.4)'; ctx.beginPath(); ctx.arc(s.ox + dx * m, s.oy + dy * m, 24, 0, TAU); ctx.fill();
  }
}

/* ================= GALAXY MAP ================= */
const MapView = {
  hoverI: -1, sel: 0, rot: 0, layout: [],
  center() {
    const wide = VW > 900;
    return { cx: wide ? (VW - 380) / 2 + 10 : VW / 2, cy: wide ? VH / 2 + 20 : VH * 0.36, R: wide ? Math.min((VW - 380) * 0.36, VH * 0.34) : Math.min(VW * 0.36, VH * 0.24) };
  },
  pos(i) {
    const { cx, cy, R } = this.center();
    if (PLANETS[i].side) { const a = G.t * 0.05 + 2.3; return { x: cx + Math.cos(a) * R * 0.6, y: cy + Math.sin(a) * R * 0.6, r: Math.max(12, R * 0.09) }; }
    const a = -Math.PI / 2 + i * Math.PI / 4;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: Math.max(14, R * 0.11) * (PLANETS[i].size / 120) };
  },
  hit(x, y) {
    for (let i = 0; i < PLANETS.length; i++) { const p = this.pos(i); if (Math.hypot(x - p.x, y - p.y) < p.r + 14) return i; }
    return -1;
  },
  hover(x, y) { if (G.state !== 'map') return; this.hoverI = this.hit(x, y); cv.style.cursor = this.hoverI >= 0 ? 'pointer' : ''; },
  click(x, y) { if (G.state !== 'map' || G.dialog) return; const i = this.hit(x, y); if (i >= 0) { this.sel = i; Sound.sfx('ui'); UI.selectPlanet(i); } },
  render(t, title) {
    const neb = makeNebula(['#2a0e3a', '#10284a', '#3a1430'], 5);
    drawBackground(neb, Math.sin(t * 0.03) * 300, Math.cos(t * 0.025) * 200);
    const { cx, cy, R } = title ? { cx: VW / 2, cy: VH / 2, R: Math.min(VW, VH) * 0.42 } : this.center();
    const progress = Save.d.progress;
    // rift
    const riftK = Save.d.ended ? 0 : 1 - progress / 9;
    if (riftK > 0) {
      const rx = cx + R * 1.15, ry = cy - R * 0.85, rr = R * 0.5 * riftK + 10;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#8a2dff', rx, ry, rr * 2.2, 0.55);
      drawGlow(ctx, '#ff2a6a', rx, ry, rr * 1.2, 0.35);
      ctx.strokeStyle = 'rgba(220,160,255,0.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(rx, ry, rr * (0.4 + i * 0.2), rr * (0.18 + i * 0.09), t * 0.2 + i, t * (0.8 + i * 0.3), t * (0.8 + i * 0.3) + 3.5); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(rx, ry, rr * 0.25, rr * 0.1, t * 0.2, 0, TAU); ctx.fill();
    }
    // star Hesper
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#ffb347', cx, cy, R * 0.55, 0.65); drawGlow(ctx, '#fff1c4', cx, cy, R * 0.2, 0.95);
    ctx.globalCompositeOperation = 'source-over';
    if (title) { // slow orbiting planets only
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4 + t * 0.02; const r = R * (0.55 + (i % 2) * 0.12); drawPlanet(ctx, PLANETS[i], cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 0.7, Math.max(8, R * 0.05) * PLANETS[i].size / 120, t * 0.1 + i, 12); }
      return;
    }
    // octagon ring
    const pts = PLANETS.map((_, i) => this.pos(i));
    for (let i = 0; i < 8; i++) {
      const a = pts[i], b = pts[(i + 1) % 8], lit = i < progress && (i + 1) % 8 < progress || (Save.d.ended);
      ctx.strokeStyle = lit ? 'rgba(255,198,92,0.8)' : 'rgba(150,160,220,0.3)'; ctx.lineWidth = lit ? PX * 1.5 : PX;
      if (!lit) ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(255,179,217,0.3)'; ctx.lineWidth = PX; ctx.setLineDash([4, 10]);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < PLANETS.length; i++) {
      const P = PLANETS[i], p = pts[i], { saved, cur, locked } = planetStatus(i);
      drawPlanet(ctx, P, p.x, p.y, p.r, t * 0.15 + i, 16, { dim: locked });
      if (locked) { ctx.fillStyle = 'rgba(3,4,11,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      if (cur && (P.side || !Save.d.ended)) { ctx.strokeStyle = `rgba(255,61,113,${0.5 + Math.sin(t * 4) * 0.3})`; ctx.lineWidth = PX; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8 + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke(); }
      if (saved) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#ffc65c', p.x, p.y - p.r - 12, 8, 0.9); ctx.globalCompositeOperation = 'source-over'; }
      if (i === this.sel || i === this.hoverI) { ctx.strokeStyle = i === this.sel ? '#ffd27a' : 'rgba(255,210,122,0.5)'; ctx.lineWidth = PX; octPath(ctx, p.r + 16, t * 0.5, p.x, p.y); ctx.stroke(); }
      octx.textAlign = 'center'; octx.font = `700 ${VW < 600 ? 12 : 15}px ${PIXEL_FONT}`;
      octx.fillStyle = 'rgba(3,4,12,0.8)'; octx.fillText(P.name.toUpperCase(), Math.round(p.x) + 2, Math.round(p.y + p.r + 24) + 2);
      octx.fillStyle = locked ? 'rgba(180,186,220,0.55)' : '#e8ecff';
      octx.fillText(P.name.toUpperCase(), Math.round(p.x), Math.round(p.y + p.r + 24));
      octx.font = `400 ${VW < 600 ? 9 : 10}px Silkscreen, monospace`;
      octx.fillStyle = saved ? '#ffc65c' : cur ? '#ff6a8a' : 'rgba(180,186,220,0.5)';
      octx.fillText(saved ? 'SAVED' : cur ? (P.side ? 'FRIENDS IN NEED' : 'UNDER ATTACK') : 'LOCKED', Math.round(p.x), Math.round(p.y + p.r + 39));
    }
    ctx.drawImage(VIGNETTE, 0, 0, VW, VH);
  },
};

/* ================= MAIN LOOP ================= */
let lastT = performance.now();
function frame(now) {
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.05) dt = 0.05;
  G.t += dt;
  TEX_BUDGET.n = 1;
  octx.setTransform(ODPR, 0, 0, ODPR, 0, 0); octx.clearRect(0, 0, VW, VH);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  try {
    if (G.state === 'mission' && G.world) {
      if (!G.paused && !G.dialog) updateWorld(G.world, dt * (Save.d.settings.speed || 1));
      else if (G.dialog && G.world.phase === 'brief') { G.world.t += dt; updateCamera(G.world, dt); G.world.planet.rot += dt * 0.05; }
      renderWorld(G.world);
      Net.hostTick(G.world, dt);
      UI.updateHUD(G.world);
    } else if (G.state === 'guest') {
      Net.guestFrame(dt);
    } else if (G.state === 'map') {
      MapView.render(G.t, false);
      Net.lobbyTick(dt);
    } else {
      MapView.render(G.t, true);
      Net.lobbyTick(dt);
    }
  } catch (err) { console.error(err); }
  Input.pressed = Object.create(null);
  UI.tick(dt);
  requestAnimationFrame(frame);
}
