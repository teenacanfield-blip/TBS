/* The Show — a ballplayer, a bat, and eight leagues between him and the top.
 *
 * It is a side-on platformer, and it is honest about where it comes from: run,
 * jump, land on things, open crates, find the power-up, reach the flag. What
 * it does with its own idea is the bat.
 *
 * Half the enemies in this game throw something at you. A pitching machine, a
 * curveball with a grin on it, a closer who only knows one pitch. Swing at the
 * moment it arrives and it goes back the other way twice as fast, through
 * whatever is standing there — so the thing that is trying to kill you is also
 * the only ammunition in the level, and the boss cannot be touched except with
 * what he throws himself.
 *
 * Everything else follows from that. The bat is a rectangle rotated at the
 * hands rather than three frames of sprite, because a real arc is what makes
 * timing readable. The sweet spot is the first fifth of the swing, and hitting
 * it is a home run: the crowd noise is synthesised, but it is earned.
 *
 * Nothing here is fetched. Art is letters in art.js, sound is oscillators in
 * sound.js, levels are functions in levels.js. The whole game is four files
 * and no connection.
 */
(function () {
'use strict';

const W = 320, H = 180;
const T = 16;                              // tile size, everywhere
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const STEP = 1 / 60;

const txt = (s, x, y, c, sc, al) => Art.text(ctx, s, x, y, c, sc, al);
const txs = (s, x, y, c, sc, al) => Art.textShadow(ctx, s, x, y, c, sc, al);

/* Everything that reaches the screen goes through this first. Entities move in
 * fractions of a pixel — they have to, or a crow would walk in 1px lurches —
 * but nothing is ever *drawn* on a fraction. One place to round is the only
 * way to keep that true as the file grows. */
const R = Math.round;
function box(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(R(x), R(y), R(w), R(h));
}

/* ==================================================================== input */

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'swing', KeyX: 'swing',
  KeyK: 'throw', KeyC: 'throw',
};

const MENUMAP = {
  Enter: 'ok', Space: 'ok', KeyZ: 'ok', KeyJ: 'ok', KeyX: 'ok',
  Escape: 'back', Backspace: 'back',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
};

const held = {};        // held down right now
const fresh = {};       // pressed this frame, until something reads it
const menu = {};        // menu presses, same idea

addEventListener('keydown', (e) => {
  // Browsers keep an AudioContext suspended until a gesture, so this is the
  // earliest honest moment to start the sound.
  Sound.unlock();

  if (e.code === 'KeyM') { muteFlash = 1.2; Sound.toggleMute(); e.preventDefault(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); e.preventDefault(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { tapPause = true; e.preventDefault(); }

  let used = false;
  const k = KEYMAP[e.code];
  if (k) { if (!held[k]) fresh[k] = true; held[k] = true; used = true; }
  const m = MENUMAP[e.code];
  if (m) { menu[m] = true; used = true; }

  // Arrows and space scroll the page otherwise, very visible inside the hub.
  if (used) e.preventDefault();
});

addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) held[k] = false;
});

// A held key with no keyup (alt-tab, the hub closing the frame) would leave
// somebody running into a wall forever.
function clearKeys() {
  for (const k in held) held[k] = false;
  for (const k in fresh) fresh[k] = false;
  for (const k in menu) menu[k] = false;
}
addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });

function took(k) { if (fresh[k]) { fresh[k] = false; return true; } return false; }
function tookMenu(k) { if (menu[k]) { menu[k] = false; return true; } return false; }
let tapPause = false;

(function initTouch() {
  const el = document.getElementById('touch');
  if (!el) return;
  if (!(('ontouchstart' in window) || navigator.maxTouchPoints > 0)) return;
  document.body.classList.add('touch');

  for (const btn of el.querySelectorAll('button')) {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      Sound.unlock();
      btn.classList.add('on');
      if (k === 'pause') { tapPause = true; return; }
      if (!held[k]) fresh[k] = true;
      held[k] = true;
      menu.ok = true;                       // any tap also answers a menu
      if (k === 'left') menu.left = true;
      if (k === 'right') menu.right = true;
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('on');
      held[k] = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
})();

/* ====================================================================== fit */

/* Pixel perfect, and meant literally: one game pixel has to land on a whole
 * number of the screen's own pixels, or the art shimmers and the 3x5 font goes
 * to mush. So the scale is chosen in *device* pixels and divided back down —
 * on a 2x or 3x display that allows 1.5x or 1.33x and still keeps every edge
 * on a real boundary, which plain integer CSS scaling would throw away. */
function fit() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const aw = Math.max(80, innerWidth);
  const ah = Math.max(60, innerHeight);

  const want = Math.min(aw / W, ah / H);
  const dev = Math.max(1, Math.floor(want * dpr));   // whole device pixels per game pixel
  const s = dev / dpr;

  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
document.addEventListener('webkitfullscreenchange', fit);
fit();

/* The game is 16:9, so on most screens full screen is an exact multiple with
 * nothing left over. Wrapped because a browser that refuses the request should
 * cost you a keystroke, not the game. */
function toggleFullscreen() {
  try {
    const d = document;
    const on = d.fullscreenElement || d.webkitFullscreenElement;
    if (on) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      const el = d.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  } catch (e) { /* not allowed here; the window scale is fine as it is */ }
}

/* ===================================================================== save */

/* What survives a reload: how far up you got, which scout cards you found, and
 * your best time in each league. Anything read back out of storage is treated
 * as suspect — it is a string a person can edit, and a bad one should not be
 * able to take the game down. */
const SAVE_KEY = 'show.save.v1';

const blankSave = () => ({ unlocked: 0, cards: {}, best: {}, balls: 0, beaten: false });

let save = blankSave();

function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
  if (!raw) return;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    save.unlocked = Math.max(0, Math.min(Levels.count - 1, o.unlocked | 0));
    save.balls = Math.max(0, o.balls | 0);
    save.beaten = !!o.beaten;
    if (o.cards && typeof o.cards === 'object') {
      for (const id in o.cards) {
        const v = o.cards[id];
        if (Array.isArray(v)) save.cards[id] = v.slice(0, 3).map(Boolean);
      }
    }
    if (o.best && typeof o.best === 'object') {
      for (const id in o.best) {
        const n = +o.best[id];
        if (isFinite(n) && n > 0) save.best[id] = n;
      }
    }
  } catch (e) { save = blankSave(); }
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}

function cardsOf(id) {
  if (!save.cards[id]) save.cards[id] = [false, false, false];
  return save.cards[id];
}

function totalCards() {
  let n = 0;
  for (const L2 of Levels.list) for (const c of cardsOf(L2.id)) if (c) n++;
  return n;
}

loadSave();

/* ==================================================================== state */

const game = {
  mode: 'title',        // title | map | help | play | pause | report | over | ending
  pick: 0,              // which league the ladder is pointing at
  t: 0,                 // a clock for anything that wiggles
  shake: 0,
  freeze: 0,
  flash: 0,
  fade: 0,              // 1 = black, counts down after a transition
};

let muteFlash = 0;

// The run: outs and gear carry from level to level until you are sent down.
const run = { outs: 3, balls: 0, gear: null, level: 0 };

function freshGear() {
  return { helmet: false, bat: false, cleats: false, gum: false, arm: false };
}
run.gear = freshGear();

/* The level being played, and everything living in it. */
let L = null, theme = null, grid = null;
let ents = [], shots = [], bits = [], pops = [];
let taken = null;             // entity indices already collected this attempt
let camX = 0, camY = 0;
let levelTime = 0, levelBalls = 0, levelCards = 0, putouts = 0, homers = 0;
let checkpoint = null;
let goalOpen = true, bossRef = null, beatBoss = false;
let report = null;

const p = {
  x: 0, y: 0, w: 10, h: 14,
  vx: 0, vy: 0, face: 1,
  onGround: false, coyote: 0, buffer: 0, jumps: 0, holdJump: false,
  swing: -1, swungAt: null, invuln: 0, hurtT: 0,
  anim: 0, dead: false, deadT: 0, cooldown: 0, gliding: false, ridden: null,
};

/* =================================================================== levels */

function loadLevel(i, keepTaken) {
  run.level = i;
  L = Levels.get(i);
  theme = Art.THEMES[L.theme] || Art.THEMES.sandlot;
  grid = L.grid.map((r) => r.slice());
  if (!keepTaken) taken = new Set();

  ents = [];
  shots = []; bits = []; pops = [];
  bossRef = null; beatBoss = false;
  goalOpen = !L.boss;

  let cardNo = 0;
  L.ents.forEach((d, idx) => {
    if (d.t === 'card') d._no = cardNo++;
    if (taken.has(idx)) return;
    // A scout card already in the folder is not put out again.
    if (d.t === 'card' && cardsOf(L.id)[d._no]) return;
    const e = spawn(d, idx);
    if (e) ents.push(e);
  });

  levelTime = 0; levelBalls = 0; levelCards = 0; putouts = 0; homers = 0;
  checkpoint = null;
  respawn(true);
  camX = clamp(p.x - W / 2, 0, L.w * T - W);
  camY = clamp(p.y - H / 2, 0, L.h * T - H);
  Sound.music(theme.music, theme.shift);
}

function respawn(hard) {
  const s = checkpoint || L.start;
  p.x = s.x * T + 3;
  p.y = s.y * T;
  p.vx = 0; p.vy = 0; p.face = 1;
  p.onGround = false; p.jumps = 0; p.swing = -1; p.hurtT = 0;
  p.dead = false; p.deadT = 0; p.cooldown = 0; p.ridden = null;
  p.invuln = hard ? 0.6 : 1.6;
  shots.length = 0;
}

/* A death is not a reload: the entities come back but the baseballs you have
 * already picked up stay picked up, which is the difference between a retry
 * and a punishment. */
function retry() {
  const keep = taken;
  const t0 = levelTime, b0 = levelBalls, c0 = levelCards, k0 = putouts, h0 = homers;
  const cp = checkpoint;
  taken = keep;
  loadLevel(run.level, true);
  checkpoint = cp;
  levelTime = t0; levelBalls = b0; levelCards = c0; putouts = k0; homers = h0;
  respawn(false);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ================================================================= entities */

function spawn(d, idx) {
  const base = { def: d, idx, t: d.t, dead: false, flash: 0, anim: Math.random() * 3 };
  const px = d.x * T, py = d.y * T;

  switch (d.t) {
    case 'coin':  return Object.assign(base, { x: px + 4, y: py + 4, w: 8, h: 8 });
    case 'card':  return Object.assign(base, { x: px + 4, y: py + 2, w: 8, h: 8, no: d._no });
    case 'item':  return Object.assign(base, { x: px + 4, y: py + 8, w: 8, h: 8, kind: d.kind, vy: 0 });
    case 'sign':  return Object.assign(base, { x: px, y: py, w: 16, h: 16, lines: d.lines });
    // The pole stands on the tile below the one it is placed on, so the flag
    // ends up out of the dirt rather than buried to the knee in it.
    case 'check': return Object.assign(base, { x: px + 4, y: (d.y + 1) * T - 40, w: 10, h: 40, lit: false, tx: d.x, ty: d.y });
    case 'crow':  return Object.assign(base, { x: px, y: py + 6, w: 12, h: 10, vx: -28, vy: 0 });
    case 'gopher':return Object.assign(base, { x: px + 3, y: py + 6, w: 10, h: 10, up: 0, timer: Math.random() * 2 });
    case 'machine':return Object.assign(base, { x: px, y: py + 2, w: 16, h: 14, dir: d.dir, cool: 0.8 + Math.random() });
    case 'slider':return Object.assign(base, { x: px, y: py, w: 10, h: 10, home: py, hx: px, amp: d.amp * T, ph: Math.random() * 6 });
    case 'rival': return Object.assign(base, { x: px, y: py, w: 12, h: 16, vx: -46, vy: 0, stun: 0 });
    case 'mover': return Object.assign(base, {
      x: px, y: py, w: d.w * T, h: 6, hx: px, hy: py,
      ax: d.ax, ay: d.ay, dist: d.dist * T, speed: d.speed * T, phase: 0, dvx: 0, dvy: 0,
    });
    case 'boss':  return Object.assign(base, {
      x: px, y: py - 12, w: 20, h: 26, hp: 3, cool: 1.6, state: 'idle', st: 0, vx: 0, vy: 0, home: px,
    });
    default: return null;
  }
}

/* The goal is not an entity: there is exactly one and it never moves. It is
 * anchored to the ground row it stands on and built upwards from there. */
function goalBox() {
  return { x: L.goalAt.x * T, y: L.goalAt.y * T - 44, w: 22, h: 44 };
}

/* ================================================================ the world */

const SOLID = '#XSWB';
function isSolid(ch) { return SOLID.indexOf(ch) >= 0; }

function tileAt(tx, ty) {
  if (ty < 0 || ty >= L.h) return '.';
  if (tx < 0 || tx >= L.w) return '.';
  return grid[ty][tx];
}

/* Horizontal, then vertical, each against the tiles the box actually touches.
 * Doing them separately is what stops a corner from wedging you. */
function moveX(o, dx) {
  o.x += dx;
  const y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 1) / T);
  if (dx > 0) {
    const tx = Math.floor((o.x + o.w - 1) / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (isSolid(tileAt(tx, ty))) { o.x = tx * T - o.w; o.vx = 0; return true; }
    }
  } else if (dx < 0) {
    const tx = Math.floor(o.x / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (isSolid(tileAt(tx, ty))) { o.x = (tx + 1) * T; o.vx = 0; return true; }
    }
  }
  return false;
}

/* `oneWay` lets planks catch you from above and nothing else. `dropping`
 * turns that off for a moment, which is how down-plus-jump falls through. */
function moveY(o, dy, oneWay, dropping) {
  const prevBottom = o.y + o.h;
  o.y += dy;
  const x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - 1) / T);

  if (dy > 0) {
    const ty = Math.floor((o.y + o.h - 1) / T);
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(tx, ty);
      if (isSolid(ch)) { o.y = ty * T - o.h; o.vy = 0; return 'floor'; }
      if (ch === '=' && oneWay && !dropping && prevBottom <= ty * T + 2) {
        o.y = ty * T - o.h; o.vy = 0; return 'floor';
      }
    }
  } else if (dy < 0) {
    const ty = Math.floor(o.y / T);
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tileAt(tx, ty))) {
        o.y = (ty + 1) * T; o.vy = 0;
        return { head: true, tx, ty };
      }
    }
  }
  return null;
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Which row is under this box's feet, or -1 for thin air.
 *
 * Landing alone is not enough to know you are standing on something. Once a
 * box is resting exactly on a surface, gravity pushes it a fifth of a pixel
 * into the floor and the downward sweep catches it again — so a walk along
 * flat ground reads as land, fall, land, fall unless somebody asks this
 * question every frame instead. Getting this wrong makes a jump feel like it
 * is being ignored, which it was. */
function feetRow(o) {
  const feet = o.y + o.h;
  const ty = Math.floor(feet / T);
  const x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - 1) / T);
  for (let tx = x0; tx <= x1; tx++) {
    const ch = tileAt(tx, ty);
    if (isSolid(ch)) return ty;
    if (ch === '=' && feet - ty * T < 3) return ty;
  }
  return -1;
}

/* Put a box down on whatever is under it. Returns true if it is standing. */
function settle(o) {
  if (o.vy < 0) return false;
  const r = feetRow(o);
  if (r < 0) return false;
  o.y = r * T - o.h;
  o.vy = 0;
  return true;
}

/* Is there ground under this point? Used by anything that should not walk off
 * a ledge — crows have more sense than that. */
function groundUnder(x, y) {
  const ch = tileAt(Math.floor(x / T), Math.floor(y / T));
  return isSolid(ch) || ch === '=';
}

/* ================================================================== effects */

function puff(x, y, n, col, spread, up) {
  for (let i = 0; i < n; i++) {
    bits.push({
      x, y,
      vx: (Math.random() - 0.5) * (spread || 60),
      vy: (Math.random() - (up == null ? 0.5 : up)) * (spread || 60),
      life: 0.3 + Math.random() * 0.4, t: 0, col, g: 200, size: 1 + (Math.random() * 2 | 0),
    });
  }
}

function pop(x, y, s, col) {
  pops.push({ x, y, s, col: col || '#fff6c8', t: 0 });
}

function shake(n) { game.shake = Math.max(game.shake, n); }

/* ================================================================ the swing */

const SWING_TIME = 0.28;
const SWING_ON = [0.05, 0.19];        // when the bat is actually a hitbox
const SWEET = 0.10;                   // ... and when it is a home run

/* The arc, as a box. It starts a few pixels inside him rather than at his
 * fingertips, and it is taller than he is: a ball that arrives level with your
 * cap should be hittable, and a swing that misses by two pixels reads as the
 * game being wrong even when it is not. */
function swingBox() {
  const long = run.gear.bat;
  const w0 = long ? 23 : 18, h0 = long ? 26 : 23;
  return {
    x: p.face > 0 ? p.x + p.w - 5 : p.x - w0 + 5,
    y: p.y - 6,
    w: w0, h: h0,
  };
}

function startSwing() {
  if (p.swing >= 0 || p.cooldown > 0) return;
  p.swing = 0;
  p.swungAt = new Set();
  Sound.sfx('swing');
}

/* ================================================================= projectiles */

function addShot(kind, x, y, vx, vy, opts) {
  shots.push(Object.assign({
    kind, x, y, w: 6, h: 6, vx, vy, g: 0, life: 4, t: 0, sweet: false, spin: Math.random() * 6,
  }, opts || null));
}

/* ================================================================== stepping */

function stepPlay(dt) {
  game.t += dt;
  levelTime += dt;

  if (p.dead) {
    p.deadT += dt;
    p.vy += 900 * dt;
    p.y += p.vy * dt;
    if (p.deadT > 1.5) {
      if (run.outs <= 0) {
        game.mode = 'over';
        Sound.music('menu');
      } else {
        retry();
      }
    }
    stepBits(dt);
    return;
  }

  stepPlayer(dt);
  for (const e of ents) stepEnt(e, dt);
  stepShots(dt);
  stepBits(dt);
  ents = ents.filter((e) => !e.dead || e.flash > 0);

  // The gate at the end, once it is open.
  if (goalOpen && overlap(p, goalBox())) finishLevel();

  // Off the bottom of the world.
  if (p.y > L.h * T + 24) hurt(true);

  updateCamera(dt);
}

function updateCamera(dt) {
  const tx = p.x + p.w / 2 - W / 2 + p.face * 24;
  const ty = p.y + p.h / 2 - H / 2 + 8;
  let minX = 0, maxX = L.w * T - W;

  // The boss arena closes behind you. Nowhere to walk away to.
  if (L.boss && bossRef && !bossRef.dead && p.x > 120 * T) minX = 121 * T - 8;

  camX += (clamp(tx, minX, maxX) - camX) * Math.min(1, dt * 6);
  camY += (clamp(ty, 0, L.h * T - H) - camY) * Math.min(1, dt * 5);
  camX = clamp(camX, minX, maxX);
  camY = clamp(camY, 0, L.h * T - H);
}

/* ------------------------------------------------------------------ player */

function stepPlayer(dt) {
  const g = run.gear;
  const RUN_MAX = g.cleats ? 132 : 104;
  const ACC = p.onGround ? 780 : 520;
  const GRAV = 800;

  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.cooldown > 0) p.cooldown -= dt;

  const lockedOut = p.hurtT > 0;

  let want = 0;
  if (!lockedOut) {
    if (held.left) want -= 1;
    if (held.right) want += 1;
  }

  if (want !== 0) {
    p.vx += want * ACC * dt;
    // His own legs stop at RUN_MAX. The cap is applied only in the direction
    // he is pushing, so a knockback can still throw him faster than he runs.
    if (want * p.vx > RUN_MAX) p.vx = want * RUN_MAX;
    if (p.swing < 0) p.face = want;
  } else if (p.onGround) {
    const f = 900 * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  } else {
    const f = 140 * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  p.vx = clamp(p.vx, -RUN_MAX * 1.35, RUN_MAX * 1.35);
  if (Math.abs(p.vx) > RUN_MAX) p.vx += (p.vx > 0 ? -1 : 1) * 400 * dt;

  // Jumping: a coyote window off a ledge, a buffered press before landing,
  // and a cut-off when the button comes up early. Without all three it feels
  // like arguing with the game rather than playing it.
  if (took('jump')) p.buffer = 0.13;
  if (p.buffer > 0) p.buffer -= dt;
  if (p.coyote > 0) p.coyote -= dt;

  const dropping = held.down && p.onGround;

  if (p.buffer > 0 && !lockedOut) {
    if (p.coyote > 0 || p.onGround) {
      if (dropping && tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 2) / T)) === '=') {
        // Down plus jump on a plank: step off it instead of jumping.
        p.y += 4; p.onGround = false; p.coyote = 0; p.buffer = 0;
        Sound.sfx('hop');
      } else {
        p.vy = -292; p.onGround = false; p.coyote = 0; p.buffer = 0;
        p.jumps = 1; p.holdJump = true;
        Sound.sfx('jump');
        puff(p.x + p.w / 2, p.y + p.h, 4, '#ffffff', 40, 0.1);
      }
    } else if (g.cleats && p.jumps === 1) {
      p.vy = -252; p.jumps = 2; p.buffer = 0; p.holdJump = true;
      Sound.sfx('hop');
      puff(p.x + p.w / 2, p.y + p.h, 6, theme.groundTop, 60, 0.2);
    }
  }

  if (!held.jump) p.holdJump = false;
  if (p.vy < 0 && !p.holdJump) p.vy += GRAV * 1.6 * dt;     // let go, come down
  else p.vy += GRAV * dt;

  // Bubble gum: hold jump on the way down and you drift.
  p.gliding = false;
  if (g.gum && p.vy > 20 && held.jump && !p.onGround) {
    p.vy = Math.min(p.vy, 64);
    p.gliding = true;
    if (Math.random() < 0.06) Sound.sfx('glide');
  }
  p.vy = Math.min(p.vy, 360);

  // Swinging, and throwing if he has the arm for it.
  if (!lockedOut && took('swing')) startSwing();
  if (!lockedOut && took('throw') && g.arm && p.cooldown <= 0) {
    const mine = shots.filter((s) => s.kind === 'toss').length;
    if (mine < 2) {
      addShot('toss', p.x + (p.face > 0 ? p.w : -6), p.y + 4, p.face * 210, -70, { g: 430, life: 2 });
      p.cooldown = 0.3;
      Sound.sfx('toss');
    }
  }

  if (p.swing >= 0) {
    p.swing += dt;
    if (p.swing >= SWING_TIME) { p.swing = -1; p.swungAt = null; p.cooldown = 0.06; }
  }

  // Move, riding whatever you are standing on.
  if (p.ridden && !p.ridden.dead) { p.x += p.ridden.dvx; p.y += p.ridden.dvy; }

  moveX(p, p.vx * dt);
  p.x = clamp(p.x, 0, L.w * T - p.w);

  const wasAir = !p.onGround;
  const hit = moveY(p, p.vy * dt, true, dropping);
  p.onGround = hit === 'floor' || settle(p);
  p.ridden = null;

  if (p.onGround) {
    p.coyote = 0.1; p.jumps = 0;
    if (wasAir && p.vy >= 0) {
      Sound.sfx('land');
      puff(p.x + p.w / 2, p.y + p.h, 4, '#ffffff', 50, 0.1);
    }
  } else if (hit && hit.head) {
    headbutt(hit.tx, hit.ty);
  }

  // Standing on a moving platform.
  for (const e of ents) {
    if (e.t !== 'mover' || e.dead) continue;
    const feet = { x: p.x + 1, y: p.y + p.h - 1, w: p.w - 2, h: 4 };
    if (overlap(feet, e) && p.vy >= 0 && p.y + p.h <= e.y + 8) {
      p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.coyote = 0.1; p.jumps = 0;
      p.ridden = e;
    }
  }

  // Rakes hurt on contact; they are not solid, so you can be standing in one.
  const cx = Math.floor((p.x + p.w / 2) / T), cy = Math.floor((p.y + p.h - 2) / T);
  if (tileAt(cx, cy) === '^') hurt(false);

  p.anim += dt * (p.onGround ? Math.abs(p.vx) * 0.07 : 4);

  // What the bat is touching this frame.
  if (p.swing >= SWING_ON[0] && p.swing <= SWING_ON[1]) batHits();
}

function headbutt(tx, ty) {
  const ch = tileAt(tx, ty);
  if (ch === 'B') { breakCrate(tx, ty, false); return; }
  if (isSolid(ch)) Sound.sfx('block');
}

function breakCrate(tx, ty, big) {
  const key = tx + ',' + ty;
  const holds = L.crates[key];
  grid[ty][tx] = '.';
  Sound.sfx('smash');
  puff(tx * T + 8, ty * T + 8, 10, '#d8a05a', 130);
  shake(2);

  if (!holds) {
    giveBalls(1, tx * T + 8, ty * T + 4);
  } else if (holds === 'balls') {
    giveBalls(5, tx * T + 8, ty * T + 4);
  } else {
    ents.push(spawn({ t: 'item', x: tx, y: ty - 1, kind: holds }, -1));
    Sound.sfx('power');
  }
}

function giveBalls(n, x, y) {
  levelBalls += n;
  run.balls += n;
  Sound.sfx('coin');
  pop(x, y, '+' + n, '#ffd166');
  puff(x, y, 3, '#ffffff', 60, 0.8);
  // Fifty of them is another out in the pocket: the oldest deal in the genre.
  while (run.balls >= 50) { run.balls -= 50; run.outs++; Sound.sfx('power'); pop(p.x, p.y - 12, 'EXTRA OUT', '#5ce08a'); }
}

/* Everything the bat touches while it is out. Order matters a little: the
 * ball you are batting back is checked before the thing that threw it. */
function batHits() {
  const arc = swingBox();
  const sweet = p.swing <= SWEET;

  for (const s of shots) {
    if (s.kind !== 'pitch' || s.hitBack) continue;
    if (!overlap(arc, s)) continue;
    s.hitBack = true;
    s.kind = 'drive';
    s.vx = p.face * (sweet ? 420 : 310);
    s.vy = sweet ? -40 : -10;
    s.g = 0;
    s.life = 2.4;
    s.sweet = sweet;
    game.freeze = sweet ? 0.12 : 0.05;
    shake(sweet ? 5 : 2);
    if (sweet) {
      homers++;
      Sound.sfx('homer');
      pop(s.x, s.y - 10, 'HOME RUN', '#ffd166');
      giveBalls(5, s.x, s.y - 4);
      game.flash = 0.18;
    } else {
      Sound.sfx('crack');
      pop(s.x, s.y - 8, 'LINE DRIVE', '#f6f2e4');
    }
    puff(s.x, s.y, 8, '#fff6c8', 140);
  }

  for (const e of ents) {
    if (e.dead || !p.swungAt || p.swungAt.has(e)) continue;
    if (!HITTABLE[e.t]) continue;
    if (e.t === 'gopher' && e.up <= 0) continue;
    if (!overlap(arc, e)) continue;
    p.swungAt.add(e);
    killEnemy(e, 'bat');
  }

  // Crates in the arc.
  const tx0 = Math.floor(arc.x / T), tx1 = Math.floor((arc.x + arc.w) / T);
  const ty0 = Math.floor(arc.y / T), ty1 = Math.floor((arc.y + arc.h) / T);
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      if (tileAt(tx, ty) === 'B') breakCrate(tx, ty, true);
    }
  }
}

const HITTABLE = { crow: 1, gopher: 1, slider: 1, rival: 1, machine: 1 };

function killEnemy(e, how) {
  if (e.dead) return;
  if (e.t === 'machine') {
    e.hp = (e.hp || 2) - 1;
    e.flash = 0.16;
    Sound.sfx('block');
    puff(e.x + 8, e.y + 6, 6, '#c9ced6', 120);
    if (e.hp > 0) return;
  }
  e.dead = true;
  e.flash = 0.16;
  putouts++;
  Sound.sfx(how === 'stomp' ? 'stomp' : 'crack');
  puff(e.x + e.w / 2, e.y + e.h / 2, 9, e.t === 'crow' ? '#3d3346' : '#f6f2e4', 150);
  pop(e.x, e.y - 6, how === 'stomp' ? 'OUT' : 'PUTOUT', '#8fe3ff');
  shake(1.5);
  if (Math.random() < 0.35) giveBalls(1, e.x + e.w / 2, e.y);
}

/* ----------------------------------------------------------------- damage */

function hurt(fatal) {
  if (p.dead) return;
  if (!fatal && p.invuln > 0) return;

  const g = run.gear;
  const order = ['helmet', 'bat', 'arm', 'gum', 'cleats'];
  let lost = null;
  if (!fatal) {
    for (const k of order) if (g[k]) { g[k] = false; lost = k; break; }
  }

  if (lost) {
    p.invuln = 1.7;
    p.hurtT = 0.28;
    p.vy = -150;
    p.vx = -p.face * 90;
    Sound.sfx(lost === 'helmet' ? 'hurt' : 'lose');
    pop(p.x, p.y - 10, lost === 'helmet' ? 'HELMET GONE' : 'LOST THE ' + GEAR[lost].short, '#ff9d3d');
    shake(3);
    game.freeze = 0.06;
    return;
  }

  // Nothing left to lose.
  p.dead = true;
  p.vy = -260;
  run.outs--;
  Sound.sfx('out');
  Sound.sfx('boo');
  shake(5);
  puff(p.x + 5, p.y + 7, 12, '#f6f2e4', 160);
}

/* -------------------------------------------------------------- the others */

function stepEnt(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.dead) return;
  e.anim += dt;

  switch (e.t) {
    case 'coin': case 'card': case 'item': {
      // A power-up knocked out of a crate falls to the floor and waits there.
      // Leaving it hanging four tiles up, where the crate was, turned picking
      // it up into a second puzzle nobody asked for.
      if (e.t === 'item') {
        e.vy = Math.min(e.vy + 620 * dt, 280);
        if (moveY(e, e.vy * dt, true) === 'floor') e.vy = 0;
        else if (settle(e)) e.vy = 0;
      }
      if (overlap(p, e)) {
        if (e.t === 'coin') giveBalls(1, e.x + 4, e.y);
        else if (e.t === 'card') {
          levelCards++;
          cardsOf(L.id)[e.no] = true;
          writeSave();
          Sound.sfx('card');
          pop(e.x, e.y - 8, 'SCOUT CARD', '#8fe3ff');
          puff(e.x + 4, e.y + 4, 10, '#8fe3ff', 120);
        } else {
          run.gear[e.kind] = true;
          Sound.sfx('power');
          pop(e.x, e.y - 10, GEAR[e.kind].name, '#ffd166');
          puff(e.x + 4, e.y + 4, 12, '#ffd166', 140);
          game.flash = 0.1;
        }
        e.dead = true;
        taken.add(e.idx);
      }
      break;
    }

    case 'sign': break;

    case 'check': {
      if (!e.lit && overlap(p, e)) {
        e.lit = true;
        checkpoint = { x: e.tx, y: e.ty - 1 };
        Sound.sfx('check');
        pop(e.x, e.y - 4, 'ON DECK', '#5ce08a');
        puff(e.x + 5, e.y + 20, 10, '#5ce08a', 120, 0.9);
      }
      break;
    }

    case 'crow': {
      moveX(e, e.vx * dt);
      e.vy = Math.min(e.vy + 700 * dt, 300);
      if (moveY(e, e.vy * dt, false) === 'floor') e.vy = 0;
      else settle(e);
      // Turn at a wall, or before walking off the end of the world.
      const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.vx === 0 || !groundUnder(ahead, e.y + e.h + 2)) e.vx = -(e.vx || -28);
      if (isSolid(tileAt(Math.floor(ahead / T), Math.floor((e.y + 4) / T)))) e.vx = -e.vx;
      touchPlayer(e);
      break;
    }

    case 'gopher': {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.up = e.up > 0 ? 0 : 1;
        e.timer = e.up ? 1.5 : 1.4 + Math.random();
        if (e.up) Sound.sfx('pitch');
      }
      if (e.up > 0) touchPlayer(e);
      break;
    }

    case 'machine': {
      e.cool -= dt;
      if (e.cool <= 0) {
        e.cool = 1.7 + Math.random() * 0.6;
        const dir = e.dir;
        addShot('pitch', e.x + (dir > 0 ? 14 : -4), e.y + 4, dir * 108, 0, { life: 5 });
        Sound.sfx('pitch');
        puff(e.x + (dir > 0 ? 16 : 0), e.y + 7, 3, '#c9ced6', 40);
      }
      touchPlayer(e, true);
      break;
    }

    case 'slider': {
      e.ph += dt;
      e.x = e.hx + Math.sin(e.ph * 0.7) * 34;
      e.y = e.home + Math.sin(e.ph * 1.9) * e.amp;
      touchPlayer(e, true);
      break;
    }

    case 'rival': {
      if (e.stun > 0) { e.stun -= dt; e.vx = 0; }
      else if (e.vx === 0) e.vx = -46;
      moveX(e, e.vx * dt);
      e.vy = Math.min(e.vy + 760 * dt, 320);
      if (moveY(e, e.vy * dt, false) !== 'floor') settle(e);
      const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.stun <= 0) {
        if (!groundUnder(ahead, e.y + e.h + 2)) e.vx = -e.vx;
        if (isSolid(tileAt(Math.floor(ahead / T), Math.floor((e.y + 6) / T)))) e.vx = -e.vx;
      }
      touchPlayer(e, false, true);
      break;
    }

    case 'mover': {
      e.phase += dt * (e.speed / Math.max(1, e.dist));
      const f = (Math.sin(e.phase * Math.PI) + 1) / 2;
      const nx = e.hx + e.ax * e.dist * f;
      const ny = e.hy + e.ay * e.dist * f;
      e.dvx = nx - e.x; e.dvy = ny - e.y;
      e.x = nx; e.y = ny;
      break;
    }

    case 'boss': stepBoss(e, dt); break;
  }
}

/* Touching an enemy. `noStomp` is the helmet rule: a rival cannot be jumped
 * on, which is the whole reason the bat exists. */
function touchPlayer(e, noStomp, bouncy) {
  if (p.dead || !overlap(p, e)) return;

  const fromAbove = p.vy > 40 && (p.y + p.h) - e.y < 12;
  if (fromAbove && !noStomp) {
    if (bouncy) {
      // He has a helmet on. You bounce, he staggers.
      p.vy = -210; p.jumps = 1;
      e.stun = 0.9;
      e.flash = 0.12;
      Sound.sfx('block');
      pop(e.x, e.y - 6, 'CLANG', '#c9ced6');
      return;
    }
    killEnemy(e, 'stomp');
    p.vy = held.jump ? -300 : -215;
    p.jumps = 1;
    game.freeze = 0.04;
    return;
  }
  hurt(false);
}

/* ------------------------------------------------------------------- boss */

/* The Closer. He does not walk into you and he cannot be stomped: the only
 * thing that touches him is his own fastball, sent back. */
function stepBoss(e, dt) {
  bossRef = e;
  if (e.state === 'dead') {
    e.st += dt;
    e.vy += 500 * dt;
    e.y += e.vy * dt;
    e.x += e.vx * dt;
    if (e.st > 1.6 && !beatBoss) {
      beatBoss = true;
      goalOpen = true;
      Sound.music('show', 0);
      Sound.sfx('promo');
      pop(p.x, p.y - 20, 'THE PLATE IS OPEN', '#ffd166');
    }
    return;
  }

  // He only starts once you are in the box with him.
  if (p.x < 118 * T) return;

  e.st += dt;
  e.cool -= dt;

  const rush = e.hp <= 1 ? 0.62 : e.hp === 2 ? 0.8 : 1;
  const pace = Math.sin(e.st * 1.1) * 26;
  e.x = e.home + pace;

  if (e.state === 'idle' && e.cool <= 0) { e.state = 'wind'; e.cool = 0.42 * rush; }
  else if (e.state === 'wind' && e.cool <= 0) {
    e.state = 'idle';
    e.cool = (1.5 + Math.random() * 0.5) * rush;

    // He releases from shoulder height and you stand a good deal lower, so the
    // ball is aimed by how long it will be in the air rather than by a flat
    // slope — otherwise every pitch sails over the batter's cap, which is
    // exactly what the first version of him did.
    const from = e.y + 8;
    const speed = 150 + (3 - e.hp) * 28;
    const flight = Math.max(0.25, (e.x - (p.x + p.w)) / speed);
    const dy = clamp(((p.y + 5) - from) / flight, -110, 110);

    addShot('pitch', e.x - 6, from, -speed, dy, { life: 6, heavy: true });
    Sound.sfx('pitch');
    puff(e.x - 4, from + 2, 4, '#ffffff', 60);
    // Down to his last out he throws two: one at you, one at where you would
    // have to jump to.
    if (e.hp === 1) {
      addShot('pitch', e.x - 6, from - 6, -(speed + 30), dy - 45, { life: 6, heavy: true });
    }
  }

  if (overlap(p, e) && !p.dead) {
    // Running into a man that size is its own mistake.
    hurt(false);
    p.vx = -160;
  }
}

function hitBoss(e, s) {
  e.hp--;
  e.flash = 0.2;
  shake(6);
  game.freeze = 0.14;
  game.flash = 0.14;
  puff(e.x + 10, e.y + 12, 16, '#ffd166', 200);
  Sound.sfx('crack');
  Sound.sfx('cheer');
  if (e.hp <= 0) {
    e.state = 'dead';
    e.st = 0;
    e.vy = -180;
    e.vx = 90;
    putouts++;
    pop(e.x, e.y - 12, 'STRUCK HIM OUT', '#ffd166');
  } else {
    pop(e.x, e.y - 10, e.hp + ' TO GO', '#f6f2e4');
  }
}

/* -------------------------------------------------------------- projectiles */

function stepShots(dt) {
  for (const s of shots) {
    s.t += dt;
    s.life -= dt;
    s.spin += dt * 10;
    s.vy += s.g * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    const tx = Math.floor((s.x + 3) / T), ty = Math.floor((s.y + 3) / T);
    const ch = tileAt(tx, ty);

    if (ch === 'B' && (s.kind === 'drive' || s.kind === 'toss')) {
      breakCrate(tx, ty, true);
      if (!s.sweet) s.life = 0;
    } else if (isSolid(ch)) {
      // A batted ball on the sweet spot goes through brick. It is a home run.
      if (!(s.kind === 'drive' && s.sweet)) {
        s.life = 0;
        puff(s.x, s.y, 4, '#ffffff', 70);
        if (s.kind === 'drive') Sound.sfx('block');
      }
    }

    if (s.kind === 'pitch') {
      if (!p.dead && p.invuln <= 0 && overlap(p, s)) { hurt(false); s.life = 0; }
    } else {
      for (const e of ents) {
        if (e.dead || !HITTABLE[e.t]) continue;
        if (e.t === 'gopher' && e.up <= 0) continue;
        if (!overlap(e, s)) continue;
        killEnemy(e, 'ball');
        if (!s.sweet) { s.life = 0; break; }
      }
      if (bossRef && !bossRef.dead && bossRef.state !== 'dead' && s.kind === 'drive' && overlap(bossRef, s)) {
        hitBoss(bossRef, s);
        s.life = 0;
      }
    }

    if (s.x < camX - 80 || s.x > camX + W + 80 || s.y > L.h * T + 40) s.life = 0;
  }
  shots = shots.filter((s) => s.life > 0);
}

function stepBits(dt) {
  for (const b of bits) {
    b.t += dt;
    b.vy += b.g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  bits = bits.filter((b) => b.t < b.life);

  for (const q of pops) { q.t += dt; q.y -= 18 * dt; }
  pops = pops.filter((q) => q.t < 1.1);
}

/* ================================================================== finish */

function finishLevel() {
  const id = L.id;
  const best = save.best[id];
  const record = !best || levelTime < best;
  if (record) save.best[id] = levelTime;
  if (run.level >= save.unlocked && run.level + 1 < Levels.count) save.unlocked = run.level + 1;
  if (run.level === Levels.count - 1) save.beaten = true;
  save.balls = (save.balls | 0) + levelBalls;
  writeSave();

  report = {
    id,
    name: L.name,
    league: L.league,
    time: levelTime,
    balls: levelBalls,
    cards: levelCards,
    putouts, homers,
    record,
    last: run.level === Levels.count - 1,
    next: Math.min(Levels.count - 1, run.level + 1),
  };

  game.mode = report.last ? 'ending' : 'report';
  game.pick = report.next;
  Sound.sfx('promo');
  Sound.music(report.last ? 'show' : 'menu', 0);
}

/* ==================================================================== gear */

const GEAR = {
  helmet: { name: 'BATTING HELMET', short: 'HELMET', spr: 'pickHelmet', blurb: 'TAKES ONE HIT FOR YOU' },
  bat:    { name: 'GOLDEN BAT', short: 'BAT', spr: 'pickBat', blurb: 'LONGER, MEANER SWING' },
  cleats: { name: 'STEEL CLEATS', short: 'CLEATS', spr: 'pickCleats', blurb: 'FASTER, AND A SECOND JUMP' },
  gum:    { name: 'BUBBLE GUM', short: 'GUM', spr: 'pickGum', blurb: 'HOLD JUMP TO FLOAT DOWN' },
  arm:    { name: 'ROCKET ARM', short: 'ARM', spr: 'pickArm', blurb: 'THROW A BALL WITH K' },
};
const GEAR_ORDER = ['helmet', 'bat', 'cleats', 'gum', 'arm'];

/* =================================================================== drawing */

function drawWorld() {
  const ox = Math.round(camX), oy = Math.round(camY);

  Art.backdrop(ctx, theme, ox, oy, game.t, W, H);

  ctx.save();
  ctx.translate(-ox, -oy);

  // Everything below the usual floor line is earth, drawn before the tiles
  // are. Without it a pit is a hole cut straight through to the sky, which
  // reads as a missing tile rather than as somewhere you can fall.
  const deep = Levels.FLOOR * T;
  box(ox - 8, deep, W + 16, L.h * T - deep + 40, theme.groundDark);
  box(ox - 8, deep, W + 16, 2, 'rgba(0,0,0,0.35)');

  // Tiles, only the ones on screen.
  const tx0 = Math.max(0, Math.floor(ox / T) - 1), tx1 = Math.min(L.w - 1, Math.floor((ox + W) / T) + 1);
  const ty0 = Math.max(0, Math.floor(oy / T) - 1), ty1 = Math.min(L.h - 1, Math.floor((oy + H) / T) + 1);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = grid[ty][tx];
      if (ch === '.') continue;
      const open = ty === 0 || grid[ty - 1][tx] === '.' || grid[ty - 1][tx] === '=' || grid[ty - 1][tx] === '^';
      Art.tile(ctx, ch, tx, ty, tx * T, ty * T, theme, open);
    }
  }

  drawGoal();
  for (const e of ents) drawEnt(e);
  drawShots();
  if (!p.dead || p.deadT < 1.4) drawPlayer();
  drawBits();

  ctx.restore();

  if (theme.rain) Art.rain(ctx, ox, game.t, W, H);
}

function drawGoal() {
  const b = goalBox();
  const t = game.t;
  // The mouth of the dugout, with home plate on the dirt in front of it. It
  // lights up when it is open, and stays shut while the Closer is standing.
  box(b.x, b.y + 4, 22, 40, goalOpen ? '#1f2a44' : '#141a28');
  box(b.x - 2, b.y, 26, 6, goalOpen ? theme.groundTop : '#2b3142');
  for (let i = 0; i < 4; i++) {
    box(b.x + 2 + i * 6, b.y + 8, 3, 28, goalOpen ? '#ffd166' : '#555c6e');
  }
  box(b.x + 4, b.y + 38, 14, 4, '#ffffff');       // the plate itself
  if (goalOpen) {
    const bob = R(Math.sin(t * 4) * 2);
    Art.text(ctx, 'NEXT', b.x + 11, b.y - 11 + bob, '#ffd166', 1, 'center');
  } else {
    Art.text(ctx, 'LOCKED', b.x + 11, b.y - 11, '#8a90a2', 1, 'center');
  }
}

function drawEnt(e) {
  const kit = theme.kit;
  const dying = e.dead && e.flash > 0;

  switch (e.t) {
    case 'coin': {
      const f = Math.sin(game.t * 5 + e.anim * 3);
      const sq = Math.abs(f) < 0.3;
      if (sq) { ctx.fillStyle = '#e8e3d2'; ctx.fillRect(e.x + 3, e.y, 2, 8); }
      else Art.spr(ctx, 'ball', e.x, e.y + Math.round(f), false, kit);
      break;
    }
    case 'card': {
      const bob = Math.round(Math.sin(game.t * 3 + e.anim) * 2);
      ctx.fillStyle = 'rgba(143,227,255,0.18)';
      ctx.fillRect(e.x - 3, e.y - 3 + bob, 14, 14);
      Art.spr(ctx, 'card', e.x, e.y + bob, false, kit);
      break;
    }
    case 'item': {
      const bob = Math.round(Math.sin(game.t * 4 + e.anim) * 2);
      ctx.fillStyle = 'rgba(255,209,102,0.2)';
      ctx.fillRect(e.x - 4, e.y - 4 + bob, 16, 16);
      Art.spr(ctx, GEAR[e.kind].spr, e.x, e.y + bob, false, kit);
      break;
    }
    case 'sign': {
      // The board is cut to fit the words rather than the words to the board,
      // so a longer line cannot spill off the end of it.
      let tw = 0;
      for (const line of e.lines) tw = Math.max(tw, Art.textWidth(line, 1));
      const bw = tw + 8, bh = e.lines.length * 7 + 4;
      const bx = R(e.x + 8 - bw / 2), by = R(e.y + 6 - bh);
      // The post runs down to the ground rather than stopping in mid-air.
      const post = Math.max(6, Levels.FLOOR * T - (by + bh));

      box(bx + (bw >> 1) - 1, by + bh, 2, post, '#6b4b2f');
      box(bx, by, bw, bh, '#e8d9b8');
      box(bx, by, bw, 1, '#6b4b2f');
      box(bx, by + bh - 1, bw, 1, '#6b4b2f');
      const near = Math.abs(p.x - e.x) < 72;
      for (let i = 0; i < e.lines.length; i++) {
        Art.text(ctx, e.lines[i], bx + bw / 2, by + 3 + i * 7, near ? '#4a3a24' : '#8a7a60', 1, 'center');
      }
      break;
    }
    case 'check': {
      ctx.fillStyle = '#c9ced6';
      ctx.fillRect(e.x + 4, e.y, 2, 40);
      const w0 = e.lit ? 14 : 10;
      const wave = e.lit ? Math.round(Math.sin(game.t * 8) * 1.5) : 0;
      ctx.fillStyle = e.lit ? theme.sky[0] : '#8a90a2';
      ctx.fillRect(e.x + 6, e.y + 2 + wave, w0, 9);
      ctx.fillStyle = e.lit ? '#ffffff' : '#6e747c';
      ctx.fillRect(e.x + 6, e.y + 2 + wave, w0, 2);
      // The on-deck circle on the ground.
      ctx.fillStyle = e.lit ? 'rgba(92,224,138,0.5)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(e.x - 5, e.y + 38, 20, 3);
      break;
    }
    case 'crow': {
      const f = (Math.floor(game.t * 8) % 2) === 0 ? 'crow0' : 'crow1';
      if (dying) Art.sprFlash(ctx, f, e.x, e.y, e.vx > 0, kit, '#ffffff');
      else Art.spr(ctx, f, e.x, e.y, e.vx > 0, kit);
      break;
    }
    case 'gopher': {
      // The hole first, so he comes out of it rather than over it.
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(e.x - 2, e.y + 6, 14, 5);
      if (e.up > 0 || dying) {
        const f = (Math.floor(game.t * 6) % 2) === 0 ? 'gopher0' : 'gopher1';
        if (dying) Art.sprFlash(ctx, f, e.x, e.y, false, kit, '#ffffff');
        else Art.spr(ctx, f, e.x, e.y, false, kit);
      }
      break;
    }
    case 'machine': {
      const f = e.cool < 0.25 ? 'machine1' : 'machine0';
      if (e.flash > 0) Art.sprFlash(ctx, f, e.x, e.y, e.dir > 0, kit, '#ffffff');
      else Art.spr(ctx, f, e.x, e.y, e.dir > 0, kit);
      break;
    }
    case 'slider': {
      const f = (Math.floor(game.t * 10) % 2) === 0 ? 'slider0' : 'slider1';
      if (dying) Art.sprFlash(ctx, f, e.x, e.y, false, kit, '#ffffff');
      else Art.spr(ctx, f, e.x, e.y, false, kit);
      break;
    }
    case 'rival': {
      const f = e.stun > 0 ? 'rival0' : (Math.floor(game.t * 7) % 2) === 0 ? 'rival0' : 'rival1';
      if (dying || e.flash > 0) Art.sprFlash(ctx, f, e.x, e.y, e.vx > 0, kit, '#ffffff');
      else Art.spr(ctx, f, e.x, e.y, e.vx > 0, kit);
      if (e.stun > 0) {
        for (let i = 0; i < 3; i++) {
          const a = game.t * 6 + i * 2.1;
          box(e.x + 6 + Math.cos(a) * 8, e.y - 4 + Math.sin(a) * 3, 2, 2, '#ffd166');
        }
      }
      break;
    }
    case 'mover': {
      box(e.x, e.y, e.w, 6, '#5c4d3a');
      box(e.x, e.y, e.w, 4, '#e0c089');
      for (let i = 4; i < e.w; i += 8) box(e.x + i, e.y + 4, 3, 1, '#8a5c26');
      // A chalk line showing where it is going, so it is never a surprise.
      if (e.ax) box(e.hx, e.hy + 2, e.dist + e.w, 1, 'rgba(255,255,255,0.14)');
      if (e.ay) box(e.hx + e.w / 2, e.hy, 1, e.dist, 'rgba(255,255,255,0.14)');
      break;
    }
    case 'boss': {
      const winding = e.state === 'wind';
      const f = winding ? 'closer1' : 'closer0';
      const lean = e.state === 'dead' ? 4 : 0;
      if (e.flash > 0) Art.sprFlash(ctx, f, e.x - 2, e.y - 2 + lean, true, 'show', '#ffffff');
      else Art.spr(ctx, f, e.x - 2, e.y - 2 + lean, true, 'show');
      if (e.state !== 'dead') {
        // His count, over the mound.
        for (let i = 0; i < 3; i++) {
          box(e.x + 2 + i * 7, e.y - 12, 5, 5, i < e.hp ? '#ffd166' : '#40465c');
        }
        if (winding) Art.text(ctx, 'HEAT', e.x + 10, e.y - 22, '#ff9d3d', 1, 'center');
      }
      break;
    }
  }
}

function drawPlayer() {
  const kit = theme.kit;
  const g = run.gear;
  const flicker = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  if (flicker) return;

  let f;
  if (p.hurtT > 0) f = 'hurt';
  else if (p.swing >= 0) f = p.swing < SWING_ON[0] ? 'load' : 'idle0';
  else if (!p.onGround) f = p.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(p.vx) > 6) f = ['run0', 'run1', 'run2', 'run3'][Math.floor(p.anim) % 4];
  else f = Math.floor(game.t * 2) % 2 === 0 ? 'idle0' : 'idle1';

  const flip = p.face < 0;
  const px = Math.round(p.x - 1), py = Math.round(p.y - 2);

  // Gum makes a bubble when he floats.
  if (p.gliding) {
    const r = 5 + (Math.sin(game.t * 9) > 0 ? 1 : 0);
    box(px + (flip ? -4 : 9), py - 2, r, r, 'rgba(255,122,184,0.65)');
  }

  Art.spr(ctx, f, px, py, flip, kit);
  if (g.helmet) {
    // The helmet sits on whichever row the head is on in this frame.
    const head = (f === 'idle1' || f === 'run1' || f === 'run3' || f === 'load') ? 1 : 0;
    Art.spr(ctx, 'helmet', px, py + head, flip, kit);
  }

  // The bat, walked out from the hands at whatever angle the swing is at.
  const hx = px + (flip ? 3 : 9), hy = py + 9;
  let a;
  if (p.swing >= 0) {
    const t01 = clamp(p.swing / SWING_TIME, 0, 1);
    a = -2.5 + t01 * 3.1;
  } else {
    a = -2.0 + Math.sin(game.t * 2) * 0.05;
  }
  const len = g.bat ? 15 : 12;
  Art.bat(ctx, hx, hy, flip ? Math.PI - a : a, len, kit, g.bat);

  // The arc itself, drawn as a fading sweep, so timing is something you can
  // see rather than something you have to feel.
  if (p.swing >= SWING_ON[0] && p.swing <= SWING_ON[1]) {
    const sweet = p.swing <= SWEET;
    const trail = sweet ? 'rgba(255,209,102,0.5)' : 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 5; i++) {
      const aa = a - 0.5 + i * 0.22;
      const ax = hx + Math.cos(flip ? Math.PI - aa : aa) * (len + 2);
      const ay = hy + Math.sin(flip ? Math.PI - aa : aa) * (len + 2);
      box(ax - 1, ay - 1, 2, 2, trail);
    }
    if (sweet) {
      const sb = swingBox();
      box(sb.x, sb.y, sb.w, sb.h, 'rgba(255,209,102,0.12)');
    }
  }
}

function drawShots() {
  for (const s of shots) {
    if (s.kind === 'pitch') {
      // A pitch has a tail, which is the only warning you get.
      box(s.x - (s.vx > 0 ? 6 : -6), s.y + 1, 6, 4,
          s.heavy ? 'rgba(255,120,80,0.35)' : 'rgba(255,255,255,0.25)');
      Art.spr(ctx, 'ball', s.x - 1, s.y - 1, false, theme.kit);
    } else if (s.kind === 'drive') {
      box(s.x - (s.vx > 0 ? 12 : -12), s.y, 12, 6,
          s.sweet ? 'rgba(255,209,102,0.55)' : 'rgba(246,242,228,0.4)');
      Art.spr(ctx, 'ball', s.x - 1, s.y - 1, false, theme.kit);
      if (s.sweet && Math.random() < 0.6) {
        bits.push({ x: s.x, y: s.y + 3, vx: -s.vx * 0.1, vy: (Math.random() - 0.5) * 40,
                    life: 0.3, t: 0, col: '#ffd166', g: 0, size: 1 });
      }
    } else {
      Art.spr(ctx, 'ball', s.x - 1, s.y - 1, false, theme.kit);
    }
  }
}

function drawBits() {
  for (const b of bits) {
    const f = 1 - b.t / b.life;
    ctx.globalAlpha = f < 0.4 ? f * 2.5 : 1;
    ctx.fillStyle = b.col;
    ctx.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size);
  }
  ctx.globalAlpha = 1;

  for (const q of pops) {
    const f = 1 - q.t / 1.1;
    ctx.globalAlpha = f < 0.35 ? f * 2.8 : 1;
    Art.textShadow(ctx, q.s, q.x, q.y, q.col, 1, 'center');
  }
  ctx.globalAlpha = 1;
}

/* ====================================================================== hud */

function drawHUD() {
  // A strip along the top, dark enough to read against a bright sky.
  ctx.fillStyle = 'rgba(12,14,24,0.72)';
  ctx.fillRect(0, 0, W, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 15, W, 1);

  txt(L.league, 4, 5, '#e8e3d2', 1);

  // Outs, as three diamonds.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < run.outs ? '#ff5f6d' : '#3a3f52';
    ctx.fillRect(100 + i * 8, 4, 5, 5);
  }
  if (run.outs > 3) txt('+' + (run.outs - 3), 124, 5, '#ff5f6d', 1);

  Art.spr(ctx, 'ball', 140, 3, false, theme.kit);
  txt(String(run.balls), 150, 5, '#f6f2e4', 1);

  Art.spr(ctx, 'card', 172, 3, false, theme.kit);
  txt(levelCards + '/3', 182, 5, '#8fe3ff', 1);

  txt(time(levelTime), 218, 5, '#e8e3d2', 1);

  // Gear, right-hand end, in the order it gets taken off you.
  let gx = 246;
  for (const k of GEAR_ORDER) {
    if (!run.gear[k]) continue;
    Art.spr(ctx, GEAR[k].spr, gx, 3, false, theme.kit);
    gx += 10;
  }

  if (L.boss && bossRef && bossRef.state !== 'dead' && p.x > 116 * T) {
    txs('THE CLOSER', W / 2, 20, '#ff5f6d', 1, 'center');
  }
}

function time(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ================================================================== screens */

/* Every screen is drawn into the same canvas with the same font. There is no
 * DOM text in this game at all, which is why a menu cannot end up in a
 * different typeface from the game behind it. */

function drawTitle() {
  const th = Art.THEMES.show;
  Art.backdrop(ctx, th, game.t * 14, 0, game.t, W, H);
  ctx.fillStyle = 'rgba(8,10,20,0.55)';
  ctx.fillRect(0, 0, W, H);

  // The infield he is stood on, so the batter is not lost in the crowd.
  box(0, 118, W, H - 118, th.ground);
  box(0, 118, W, 4, th.groundTop);
  box(0, 122, W, 1, th.groundDark);
  for (let i = 0; i < 90; i++) {
    const hx = (i * 37) % W, hy = 126 + ((i * 53) % 50);
    box(hx, hy, 2, 1, th.groundDark);
  }
  // The dirt darkens under the words, so the menu reads at any brightness.
  box(0, 124, W, H - 124, 'rgba(12,10,18,0.5)');

  const bob = R(Math.sin(game.t * 2) * 2);
  txs('THE SHOW', W / 2, 26 + bob, '#ffffff', 4, 'center');
  txs('SANDLOT TO THE BIG LEAGUES', W / 2, 50 + bob, '#ffd166', 1, 'center');

  // A ballplayer at the plate, taking a cut every three seconds.
  const t = (game.t % 3) / 3;
  const swinging = t > 0.6;
  const a = swinging ? -2.5 + ((t - 0.6) / 0.4) * 3.1 : -2.0 + Math.sin(game.t * 2) * 0.05;
  const bx = W / 2 - 6, by = 102;
  box(bx + 2, 118, 12, 2, 'rgba(0,0,0,0.25)');
  Art.spr(ctx, swinging ? 'load' : (Math.floor(game.t * 2) % 2 ? 'idle0' : 'idle1'), bx, by, false, 'show');
  Art.bat(ctx, bx + 9, by + 9, a, 13, 'show', false);
  box(W / 2 + 16, 116, 10, 3, '#ffffff');          // home plate

  const fl = Math.floor(game.t * 2) % 2 === 0;
  txs(fl ? 'PRESS ENTER' : '', W / 2, 128, '#f6f2e4', 1, 'center');
  txs('H  CONTROLS      F  FULL SCREEN', W / 2, 142, '#e8dfc6', 1, 'center');
  txs('M  SOUND ' + (Sound.muted ? 'OFF' : 'ON'), W / 2, 152, '#e8dfc6', 1, 'center');

  const c = totalCards();
  txs(c + ' SCOUT CARDS' + (save.beaten ? '   ·   CALLED UP' : ''), W / 2, 164, '#8fe3ff', 1, 'center');
  txs('THIRSTY BEAR STUDIOS', W / 2, 173, '#c6b89a', 1, 'center');
}

/* The ladder: eight stops between a dirt lot and the big leagues. */
function drawMap() {
  const th = Art.THEMES[Levels.get(game.pick).theme];
  Art.backdrop(ctx, th, game.t * 8, 0, game.t, W, H);
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.fillRect(0, 0, W, H);

  txs('THE CLIMB', W / 2, 8, '#ffffff', 2, 'center');

  const n = Levels.count;
  const x0 = 24, dx = (W - 48) / (n - 1);
  // The rail they all sit on.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x0, 46, W - 48, 1);

  for (let i = 0; i < n; i++) {
    const lv = Levels.get(i);
    const x = Math.round(x0 + dx * i);
    const open = isOpen(i);
    const here = i === game.pick;
    const done = save.best[lv.id] != null;

    ctx.fillStyle = open ? (done ? '#5ce08a' : '#ffd166') : '#4a5064';
    const r = here ? 7 : 5;
    ctx.fillRect(x - r / 2, 46 - r / 2, r, r);
    if (here) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 5, 46 - 5, 10, 1);
      ctx.fillRect(x - 5, 46 + 4, 10, 1);
    }
    // Cards found here, as three pips under the stop.
    const cs = cardsOf(lv.id);
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cs[c] ? '#8fe3ff' : 'rgba(255,255,255,0.16)';
      ctx.fillRect(x - 4 + c * 3, 54, 2, 2);
    }
  }

  const lv = Levels.get(game.pick);
  const open = isOpen(game.pick);
  // A card behind the words, because the league behind them is a busy place.
  box(18, 62, W - 36, 86, 'rgba(8,10,20,0.66)');
  box(18, 62, W - 36, 1, 'rgba(255,255,255,0.14)');
  box(18, 147, W - 36, 1, 'rgba(255,255,255,0.14)');
  txs(lv.name, W / 2, 68, open ? '#ffffff' : '#8a90a2', 2, 'center');
  txs(lv.league, W / 2, 84, '#ffd166', 1, 'center');

  // The blurb, wrapped by hand at a width the font can take.
  wrap(lv.note, W / 2, 98, 46, open ? '#c9d0e0' : '#6e7488');

  const best = save.best[lv.id];
  txs(best ? 'BEST ' + time(best) : 'NOT PLAYED', W / 2, 124, '#9aa4c0', 1, 'center');

  if (!open) {
    const need = Levels.CARDS_FOR_SHOW - totalCards();
    if (game.pick === Levels.count - 1 && save.unlocked >= Levels.count - 1) {
      txs('THE SHOW WANTS ' + need + ' MORE SCOUT CARDS', W / 2, 140, '#ff5f6d', 1, 'center');
    } else {
      txs('WIN THE LEAGUE BELOW FIRST', W / 2, 140, '#ff5f6d', 1, 'center');
    }
  } else {
    const fl = Math.floor(game.t * 2) % 2 === 0;
    txs(fl ? 'ENTER TO PLAY' : '', W / 2, 140, '#f6f2e4', 1, 'center');
  }

  txs('LEFT RIGHT  PICK     ESC  TITLE', W / 2, 160, '#7a8296', 1, 'center');
  txs('OUTS ' + run.outs + '   BALLS ' + run.balls + '   CARDS ' + totalCards(), W / 2, 170, '#8fe3ff', 1, 'center');
}

function isOpen(i) {
  if (i > save.unlocked) return false;
  // The last one has a turnstile on it: promotion is not enough.
  if (i === Levels.count - 1 && totalCards() < Levels.CARDS_FOR_SHOW) return false;
  return true;
}

function wrap(s, cx, y, width, col) {
  const words = String(s).toUpperCase().split(' ');
  let line = '';
  let row = 0;
  for (const w0 of words) {
    const test = line ? line + ' ' + w0 : w0;
    if (test.length > width) {
      txs(line, cx, y + row * 9, col, 1, 'center');
      row++;
      line = w0;
    } else line = test;
  }
  if (line) txs(line, cx, y + row * 9, col, 1, 'center');
  return row + 1;
}

function drawHelp() {
  ctx.fillStyle = '#0c1020';
  ctx.fillRect(0, 0, W, H);
  txs('HOW TO PLAY BALL', W / 2, 8, '#ffffff', 2, 'center');

  const rows = [
    ['ARROWS / A D', 'RUN'],
    ['SPACE / W / UP', 'JUMP. HOLD IT FOR HEIGHT'],
    ['DOWN + JUMP', 'DROP THROUGH A PLANK'],
    ['J OR X', 'SWING THE BAT'],
    ['K OR C', 'THROW, WITH A ROCKET ARM'],
    ['ESC OR P', 'PAUSE'],
    ['F', 'FULL SCREEN'],
    ['M', 'SOUND'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 26 + i * 10;
    txt(rows[i][0], 16, y, '#ffd166', 1);
    txt(rows[i][1], 118, y, '#d8dce8', 1);
  }

  txs('THE POINT OF THE BAT', W / 2, 110, '#8fe3ff', 1, 'center');
  wrap('Swing as a pitch reaches you and it goes back the way it came, through whatever is in the way. Early in the swing is the sweet spot: that one is a home run, and it goes through brick.',
       W / 2, 122, 52, '#c9d0e0');

  txs('ESC TO GO BACK', W / 2, 168, '#7a8296', 1, 'center');
}

function drawPause() {
  drawWorld();
  drawHUD();
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  txs('TIME OUT', W / 2, 48, '#ffffff', 3, 'center');
  txs('ENTER   BACK TO THE GAME', W / 2, 86, '#ffd166', 1, 'center');
  txs('R       START THE LEAGUE AGAIN', W / 2, 100, '#d8dce8', 1, 'center');
  txs('ESC     THE CLIMB', W / 2, 114, '#d8dce8', 1, 'center');
  txs('M       SOUND ' + (Sound.muted ? 'OFF' : 'ON'), W / 2, 128, '#d8dce8', 1, 'center');
}

function drawReport() {
  const th = Art.THEMES[Levels.get(report.next).theme];
  Art.backdrop(ctx, th, game.t * 10, 0, game.t, W, H);
  ctx.fillStyle = 'rgba(8,10,20,0.68)';
  ctx.fillRect(0, 0, W, H);

  txs('SCOUTING REPORT', W / 2, 10, '#ffffff', 2, 'center');
  txs(report.name, W / 2, 28, '#ffd166', 1, 'center');

  const rows = [
    ['TIME', time(report.time) + (report.record ? '  BEST' : '')],
    ['BASEBALLS', String(report.balls)],
    ['SCOUT CARDS', report.cards + ' OF 3'],
    ['PUTOUTS', String(report.putouts)],
    ['HOME RUNS', String(report.homers)],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 46 + i * 12;
    txt(rows[i][0], 78, y, '#9aa4c0', 1);
    txt(rows[i][1], 232, y, '#ffffff', 1, 'right');
  }

  txs('CALLED UP TO', W / 2, 116, '#8fe3ff', 1, 'center');
  txs(Levels.get(report.next).league, W / 2, 128, '#ffffff', 2, 'center');

  const fl = Math.floor(game.t * 2) % 2 === 0;
  txs(fl ? 'ENTER TO REPORT FOR DUTY' : '', W / 2, 152, '#f6f2e4', 1, 'center');
  txs('ESC  THE CLIMB', W / 2, 168, '#7a8296', 1, 'center');
}

function drawOver() {
  ctx.fillStyle = '#12101c';
  ctx.fillRect(0, 0, W, H);
  txs('SENT DOWN', W / 2, 40, '#ff5f6d', 3, 'center');
  wrap('Three outs and the inning is over. The leagues you have already won stay won, and so do your scout cards.',
       W / 2, 76, 46, '#c9d0e0');
  txs('ENTER  TRY THE LEAGUE AGAIN', W / 2, 116, '#ffd166', 1, 'center');
  txs('ESC    THE CLIMB', W / 2, 130, '#9aa4c0', 1, 'center');
}

function drawEnding() {
  Art.backdrop(ctx, Art.THEMES.show, game.t * 6, 0, game.t, W, H);
  ctx.fillStyle = 'rgba(8,10,20,0.5)';
  ctx.fillRect(0, 0, W, H);

  const bob = Math.sin(game.t * 2) * 2;
  txs('YOU MADE THE SHOW', W / 2, 22 + bob, '#ffffff', 2, 'center');

  wrap('The kid from the dirt lot, on the last pitch of the ninth, in front of forty thousand people.',
       W / 2, 46, 46, '#ffd166');

  const rows = [
    ['LAST TIME', time(report.time)],
    ['SCOUT CARDS', totalCards() + ' OF 24'],
    ['HOME RUNS', String(report.homers)],
    ['BASEBALLS', String(save.balls)],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 78 + i * 12;
    txt(rows[i][0], 84, y, '#9aa4c0', 1);
    txt(rows[i][1], 236, y, '#ffffff', 1, 'right');
  }

  // A little confetti, because he earned it.
  if (Math.random() < 0.5) {
    bits.push({ x: Math.random() * W, y: -4, vx: (Math.random() - 0.5) * 20, vy: 30 + Math.random() * 40,
                life: 4, t: 0, col: ['#ffd166', '#ff5f6d', '#8fe3ff', '#ffffff'][Math.random() * 4 | 0], g: 14, size: 2 });
  }
  stepBits(STEP);
  drawBits();

  const fl = Math.floor(game.t * 2) % 2 === 0;
  txs(fl ? 'ENTER' : '', W / 2, 146, '#f6f2e4', 1, 'center');
  txs('EVERY LEAGUE IS OPEN NOW. GO AND BEAT YOUR TIMES.', W / 2, 164, '#8fe3ff', 1, 'center');
}

/* =================================================================== screens
 * ... and what each of them does with a button press. */

function stepMenus() {
  switch (game.mode) {
    case 'title':
      if (tookMenu('ok')) { game.mode = 'map'; game.pick = save.unlocked; Sound.sfx('start'); Sound.music('menu'); }
      if (tookKey('KeyH')) game.mode = 'help';
      break;

    case 'help':
      if (tookMenu('back') || tookMenu('ok')) { game.mode = 'title'; Sound.sfx('select'); }
      break;

    case 'map': {
      if (tookMenu('left')) { game.pick = (game.pick + Levels.count - 1) % Levels.count; Sound.sfx('select'); }
      if (tookMenu('right')) { game.pick = (game.pick + 1) % Levels.count; Sound.sfx('select'); }
      if (tookMenu('back')) { game.mode = 'title'; Sound.sfx('select'); }
      if (tookMenu('ok')) {
        if (isOpen(game.pick)) {
          run.outs = Math.max(3, run.outs);
          startLevel(game.pick);
        } else Sound.sfx('deny');
      }
      break;
    }

    case 'pause':
      if (tookMenu('ok')) { game.mode = 'play'; Sound.music(theme.music, theme.shift); }
      if (tookKey('KeyR')) { run.gear = freshGear(); startLevel(run.level); }
      if (tookMenu('back')) { game.mode = 'map'; game.pick = run.level; Sound.music('menu'); }
      break;

    case 'report':
      if (tookMenu('ok')) startLevel(report.next);
      if (tookMenu('back')) { game.mode = 'map'; game.pick = report.next; }
      break;

    case 'over':
      if (tookMenu('ok')) { run.outs = 3; run.gear = freshGear(); startLevel(run.level); }
      if (tookMenu('back')) { run.outs = 3; run.gear = freshGear(); game.mode = 'map'; game.pick = run.level; }
      break;

    case 'ending':
      if (tookMenu('ok') || tookMenu('back')) {
        game.mode = 'map'; game.pick = Levels.count - 1;
        Sound.music('menu');
      }
      break;
  }

  // Pause is the one key that works from inside the game.
  if (tapPause) {
    tapPause = false;
    if (game.mode === 'play') { game.mode = 'pause'; Sound.music('menu'); }
    else if (game.mode === 'pause') { game.mode = 'play'; Sound.music(theme.music, theme.shift); }
  }
  menu.ok = menu.back = menu.left = menu.right = menu.up = menu.down = false;
}

/* A couple of screens want a letter of their own. Reading them straight off
 * the keyboard beats adding them to the menu map, where they would fire in
 * places they have no business firing. */
const letters = {};
addEventListener('keydown', (e) => { if (e.code === 'KeyH' || e.code === 'KeyR') letters[e.code] = true; });
function tookKey(code) { if (letters[code]) { letters[code] = false; return true; } return false; }

function startLevel(i) {
  game.mode = 'play';
  game.fade = 0.5;
  loadLevel(i, false);
  Sound.sfx('start');
}

/* ===================================================================== loop */

function step() {
  if (game.mode === 'play') {
    stepPlay(STEP);
  } else {
    game.t += STEP;
    if (game.mode !== 'pause') stepBits(STEP);
  }
  stepMenus();

  if (game.shake > 0) game.shake = Math.max(0, game.shake - STEP * 18);
  if (game.flash > 0) game.flash -= STEP;
  if (game.fade > 0) game.fade -= STEP;
  if (muteFlash > 0) muteFlash -= STEP;
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);

  if (game.shake > 0.2 && (game.mode === 'play')) {
    ctx.translate(Math.round((Math.random() - 0.5) * game.shake),
                  Math.round((Math.random() - 0.5) * game.shake));
  }

  switch (game.mode) {
    case 'title': drawTitle(); break;
    case 'help': drawHelp(); break;
    case 'map': drawMap(); break;
    case 'play': drawWorld(); drawHUD(); break;
    case 'pause': drawPause(); break;
    case 'report': drawReport(); break;
    case 'over': drawOver(); break;
    case 'ending': drawEnding(); break;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (game.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, game.flash * 2.4) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (game.fade > 0) {
    ctx.fillStyle = 'rgba(5,7,12,' + Math.min(1, game.fade * 2) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (muteFlash > 0) {
    txs(Sound.muted ? 'SOUND OFF' : 'SOUND ON', W - 6, 20, Sound.muted ? '#7d8496' : '#5ce08a', 1, 'right');
  }
}

let last = performance.now(), acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;        // came back from a hidden tab; do not fast-forward
  acc += dt;

  // Hitstop: a couple of frames where nothing moves, so a good hit has weight.
  if (game.freeze > 0) { game.freeze -= dt; acc = Math.min(acc, STEP); }
  else {
    let guard = 0;
    while (acc >= STEP && guard++ < 6) { step(); acc -= STEP; }
  }

  draw();
  requestAnimationFrame(frame);
}

// The title screen needs a level loaded behind it for the themes and nothing
// else; the first real one is picked on the ladder.
loadLevel(0, false);
game.mode = 'title';
Sound.music('menu');
requestAnimationFrame(frame);
})();
