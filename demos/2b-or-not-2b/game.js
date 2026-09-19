/* 2B or Not 2B — a pencil, ninety units below where it started.
 *
 * A 3D platformer with one route through it and four verbs: run, jump, stab,
 * dash. The interesting one is the stab. A pencil has a sharp end, so it can
 * hang off anything soft — cork, vinyl, chewing gum, chipboard — and kick off
 * again. That costs sharpness, sharpness only comes back at a sharpener, and
 * the sharpeners are the checkpoints. So the resource, the fast route and the
 * safety net are all the same system, which is the only reason it earns its
 * place in a game this small.
 *
 * Falling is not death. You land, you are fine, and you are at the bottom
 * again — which is worse and much funnier. `R` gives up and sends you back to
 * the last sharpener, and the game counts that against you rather than the
 * fall.
 *
 * Layout of this file: state, then the world it loads, then input, then the
 * pencil, then the camera, then what gets drawn, then the screens, then the
 * loop that drives all of it.
 */
(function () {
'use strict';

/* ================================================================ numbers */
/* All of these were tuned against the level rather than chosen first. The one
   that matters most is JUMP: every gap in world.js assumes a standing jump
   clears about seven units across and three up. */

const STEP = 1 / 60;
const GRAV = 42, FALL_GRAV = 58;
const JUMP = 17, DJUMP = 13.4;
const RUN = 10.5, ACCEL = 84, AIR_ACCEL = 42, FRICTION = 46;
const DASH_SPEED = 26, DASH_TIME = 0.16;
const CLING_SLIDE = 1.4, CLING_COST = 0.115;
const DIVE_SPEED = 32;
const RAD = 0.55, TALL = 1.9;

/* The three numbers that do most of the work in how it feels:
   how tall a lip you walk over, how far the feet reach down for a floor that
   has dropped away, and how hard a jump is cut short when you let go. */
const STEP_UP = 0.78, SNAP_DOWN = 0.85, JUMP_CUT = 9.5;

const FOG = { col: 0xc9cfd6, near: 90, far: 300 };

/* =================================================================== state */

const glc = document.getElementById('gl');
const $ = (id) => document.getElementById(id);

let world = null, statics = null, dyn = null, grid = null;
let mode = 'title';                 // title | play | pause | achv | help | win
let last = 0, acc = 0, simTime = 0;  // simulated seconds, not wall-clock seconds
let shake = 0, flash = 0;

const p = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  yaw: 0, lean: 0, spin: 0, spinV: 0, wobble: 0,
  grounded: false, coyote: 0, jumpBuf: 0,
  doubleLeft: 1, dashReady: true, dashT: 0, dashX: 0, dashZ: 0,
  cling: false, clingNX: 0, clingNZ: 0, clingCool: 0,
  diving: false, stun: 0, sharp: 1, cutable: false, clingGrace: 0,
  surface: null, wall: null, peak: 0, air: 0,
  chain: 0, bounceChain: 0, flightDash: false, flightSpin: false, flightStab: false,
};

const cam = { yaw: -0.6, pitch: 0.22, dist: 11, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, fov: 1.15 };
const parts = [];
let stats = null, checkpoint = null, runTime = 0, wonAt = 0;
let hintText = '', hintFor = 0;
const seenHints = {};

/* Stars found stay found, so the chart is a record of the classroom rather
   than of one attempt. Everything else lifetime-ish rides along with it. */
const SAVE = '2b.progress.v2';
let saved = { stars: [], crumbs: 0, dashes: 0, stabs: 0, spins: 0, walked: 0,
  sharpenings: 0, diveBounces: 0, gumWads: 0, glueTime: 0, inkTime: 0,
  inBin: false, inMug: false, best: 0, runs: 0 };
try {
  const raw = localStorage.getItem(SAVE);
  if (raw) Object.assign(saved, JSON.parse(raw) || {});
} catch (e) { /* private mode: this run is the only run */ }
function persist() {
  try { localStorage.setItem(SAVE, JSON.stringify(saved)); } catch (e) { /* fine */ }
}

/* ================================================================== world */

/* A grid over the floor plan so collision never looks at the whole room. The
   level is tall and thin, so the buckets are square in x/z and everything in a
   bucket is filtered by height at query time. */
const CELL = 18;
function keyOf(ix, iz) { return ix * 4096 + iz; }

function buildGrid(shapes) {
  const g = new Map();
  for (const s of shapes) {
    if (s.kind === 'deco') continue;
    const i0 = Math.floor(s.x0 / CELL), i1 = Math.floor(s.x1 / CELL);
    const j0 = Math.floor(s.z0 / CELL), j1 = Math.floor(s.z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = keyOf(i, j);
      let a = g.get(k);
      if (!a) { a = []; g.set(k, a); }
      a.push(s);
    }
  }
  return g;
}

/* Two scratch lists, not one: the step-up test runs inside the loop that is
   already walking a list, and a single shared array would have it pull the
   rug out from under itself. */
const found = [];
const scratch = [];

function nearInto(out, x0, y0, z0, x1, y1, z1) {
  out.length = 0;
  const i0 = Math.floor(x0 / CELL), i1 = Math.floor(x1 / CELL);
  const j0 = Math.floor(z0 / CELL), j1 = Math.floor(z1 / CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const a = grid.get(keyOf(i, j));
    if (!a) continue;
    for (const s of a) {
      if (s.y1 < y0 || s.y0 > y1) continue;
      if (out.indexOf(s) < 0) out.push(s);
    }
  }
  for (const m of world.movers) {
    const s = m.s;
    if (s.y1 < y0 || s.y0 > y1 || s.x1 < x0 || s.x0 > x1 || s.z1 < z0 || s.z0 > z1) continue;
    if (out.indexOf(s) < 0) out.push(s);
  }
  return out;
}

function near(x0, y0, z0, x1, y1, z1) {
  return nearInto(found, x0, y0, z0, x1, y1, z1);
}

function bakeStatics() {
  const m = GFX.mesh(24000);
  for (const s of world.shapes) {
    const w = s.x1 - s.x0, d = s.z1 - s.z0;
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    if (s.kind === 'wind') continue;
    if (s.kind === 'ramp') {
      m.wedge(cx, s.y0, cz, w / 2, d / 2, s.rise, s.axis, s.col, s.flip);
      continue;
    }
    if (s.move) continue;                 // movers are redrawn every frame
    m.box(cx, (s.y0 + s.y1) / 2, cz, w / 2, (s.y1 - s.y0) / 2, d / 2, s.col);
  }
  return m;
}

function loadWorld() {
  world = World.build();
  for (const m of world.movers) {
    const s = m.s;
    m.base = { x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1, z0: s.z0, z1: s.z1 };
    m.off = 0;
    s.move = m;
  }
  for (const c of world.crumbs) { c.got = false; c.spin = Math.random() * 6.3; }
  for (const st of world.stars) st.got = saved.stars.indexOf(st.name) >= 0;
  world.winds = world.shapes.filter((s) => s.kind === 'wind');
  grid = buildGrid(world.shapes);
  statics = bakeStatics();
  dyn = GFX.mesh(6000);
}

/* ================================================================== input */

const keys = {};
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyE: 'dash',
  ControlLeft: 'dive', KeyQ: 'dive', KeyF: 'dive',
};
let pressedJump = false, pressedDash = false, pressedDive = false;
let mouseDX = 0, mouseDY = 0, locked = false;

addEventListener('keydown', (e) => {
  Sound.unlock();
  if (e.code === 'Escape') { e.preventDefault(); onEscape(); return; }
  if (e.code === 'KeyM' && mode !== 'title') { toggleMute(); return; }
  const k = KEYMAP[e.code];
  if (mode === 'play') {
    if (e.code === 'KeyR') { e.preventDefault(); respawn(true); return; }
    if (k) {
      e.preventDefault();
      if (!keys[k]) {
        if (k === 'jump') pressedJump = true;
        if (k === 'dash') pressedDash = true;
        if (k === 'dive') pressedDive = true;
      }
      keys[k] = true;
    }
  } else if (mode === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault(); startRun();
  } else if (mode === 'win' && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault(); startRun();
  }
});

addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});

addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* Two ways to look around, because pointer lock is a click the player has to
   know to make. Clicking locks the pointer; failing that, dragging works. */
let dragging = false, dragX = 0, dragY = 0;

glc.addEventListener('mousedown', (e) => {
  Sound.unlock();
  dragging = true; dragX = e.clientX; dragY = e.clientY;
  if (mode === 'play' && glc.requestPointerLock) glc.requestPointerLock();
});
addEventListener('mouseup', () => { dragging = false; });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === glc; });
addEventListener('mousemove', (e) => {
  if (mode !== 'play') return;
  if (locked) {
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  } else if (dragging) {
    mouseDX += e.clientX - dragX;
    mouseDY += e.clientY - dragY;
    dragX = e.clientX; dragY = e.clientY;
  }
});

/* Touch: drag on the left half to move, drag on the right half to look, and
   three buttons for the three things your thumb needs. */
const stick = { id: -1, x: 0, y: 0, dx: 0, dy: 0 };
const look = { id: -1, x: 0, y: 0 };

function touchStart(e) {
  Sound.unlock();
  for (const t of e.changedTouches) {
    if (t.target && t.target.dataset && t.target.dataset.key) continue;
    if (t.clientX < innerWidth * 0.45 && stick.id < 0) {
      stick.id = t.identifier; stick.x = t.clientX; stick.y = t.clientY; stick.dx = 0; stick.dy = 0;
    } else if (look.id < 0) {
      look.id = t.identifier; look.x = t.clientX; look.y = t.clientY;
    }
  }
}
function touchMove(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) {
      stick.dx = Math.max(-1, Math.min(1, (t.clientX - stick.x) / 46));
      stick.dy = Math.max(-1, Math.min(1, (t.clientY - stick.y) / 46));
    } else if (t.identifier === look.id) {
      mouseDX += (t.clientX - look.x) * 1.5;
      mouseDY += (t.clientY - look.y) * 1.5;
      look.x = t.clientX; look.y = t.clientY;
    }
  }
  if (mode === 'play') e.preventDefault();
}
function touchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) { stick.id = -1; stick.dx = 0; stick.dy = 0; }
    if (t.identifier === look.id) look.id = -1;
  }
}
glc.addEventListener('touchstart', touchStart, { passive: true });
glc.addEventListener('touchmove', touchMove, { passive: false });
glc.addEventListener('touchend', touchEnd, { passive: true });
glc.addEventListener('touchcancel', touchEnd, { passive: true });

for (const b of document.querySelectorAll('#touch button')) {
  const k = b.dataset.key;
  const down = (e) => {
    e.preventDefault(); Sound.unlock();
    if (!keys[k]) {
      if (k === 'jump') pressedJump = true;
      if (k === 'dash') pressedDash = true;
      if (k === 'dive') pressedDive = true;
    }
    keys[k] = true;
  };
  const up = (e) => { e.preventDefault(); keys[k] = false; };
  b.addEventListener('touchstart', down, { passive: false });
  b.addEventListener('touchend', up, { passive: false });
  b.addEventListener('touchcancel', up, { passive: false });
  b.addEventListener('mousedown', down);
  b.addEventListener('mouseup', up);
}

/* =============================================================== collision */

function boxAt(s, x, y, z) {
  return x > s.x0 - RAD && x < s.x1 + RAD && z > s.z0 - RAD && z < s.z1 + RAD &&
         y < s.y1 && y + TALL > s.y0;
}

function rampTop(s, x, z) {
  const t = s.axis === 'x'
    ? (x - s.x0) / Math.max(0.001, s.x1 - s.x0)
    : (z - s.z0) / Math.max(0.001, s.z1 - s.z0);
  const u = Math.max(0, Math.min(1, s.flip ? 1 - t : t));
  return s.top + u * s.rise;
}

/* Is there room for the whole body here? Asked before lifting the pencil onto
   a lip, so it can never step up into a ceiling. */
function clearAt(x, y, z) {
  nearInto(scratch, x - RAD, y, z - RAD, x + RAD, y + TALL, z + RAD);
  for (const s of scratch) {
    if (s.kind === 'wind' || s.kind === 'deco' || s.kind === 'ramp') continue;
    if (boxAt(s, x, y, z)) return false;
  }
  return true;
}

/* The nearest floor under the feet, within reach. Returns the height, and
   leaves the thing it belongs to in `floorShape`. */
let floorShape = null;
function floorUnder(x, y, z, reach) {
  nearInto(scratch, x - RAD, y - reach, z - RAD, x + RAD, y + 0.1, z + RAD);
  let best = -1e9;
  floorShape = null;
  for (const s of scratch) {
    if (s.kind === 'wind' || s.kind === 'deco') continue;
    if (x <= s.x0 - RAD || x >= s.x1 + RAD || z <= s.z0 - RAD || z >= s.z1 + RAD) continue;
    const top = s.kind === 'ramp' ? rampTop(s, x, z) : s.y1;
    if (top <= y + 0.06 && top > best) { best = top; floorShape = s; }
  }
  return best;
}

/* If we have ended up inside something — spawned there, carried there by a
   moving platform, squeezed by two things at once — leave by the shortest
   way out rather than along whichever axis we happened to be moving. Pushing
   out along the movement axis when you are deeply inside is how you get
   flung across the room. */
function unstick() {
  nearInto(scratch, p.x - RAD, p.y, p.z - RAD, p.x + RAD, p.y + TALL, p.z + RAD);
  for (const s of scratch) {
    if (s.kind === 'wind' || s.kind === 'deco' || s.kind === 'ramp') continue;
    if (!boxAt(s, p.x, p.y, p.z)) continue;
    const xl = (s.x0 - RAD) - p.x, xr = (s.x1 + RAD) - p.x;
    const zl = (s.z0 - RAD) - p.z, zr = (s.z1 + RAD) - p.z;
    const yd = (s.y0 - TALL) - p.y, yu = s.y1 - p.y;
    const px = Math.abs(xl) < Math.abs(xr) ? xl : xr;
    const pz = Math.abs(zl) < Math.abs(zr) ? zl : zr;
    const py = Math.abs(yd) < Math.abs(yu) ? yd : yu;
    const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);
    if (ay <= ax && ay <= az) {
      p.y += py;
      if (py > 0) { p.vy = Math.max(0, p.vy); p.grounded = true; p.surface = s; }
      else p.vy = Math.min(0, p.vy);
    } else if (ax <= az) { p.x += px; p.vx = 0; }
    else { p.z += pz; p.vz = 0; }
  }
}

/* One axis at a time, small steps, push out of anything overlapped. Crude and
   completely predictable, which is what a platformer wants — with one bit of
   kindness bolted on: anything low enough gets stepped over instead of
   stopping you dead. The world is built out of hundreds of separate boxes and
   without that you catch on every seam between two of them. */
function moveAxis(axis, d) {
  if (!d) return;
  if (axis === 'x') p.x += d; else if (axis === 'z') p.z += d; else p.y += d;

  const list = near(p.x - RAD - 1, p.y - 1, p.z - RAD - 1, p.x + RAD + 1, p.y + TALL + 1, p.z + RAD + 1);
  for (const s of list) {
    if (s.kind === 'wind' || s.kind === 'deco') continue;

    if (s.kind === 'ramp') {
      if (axis !== 'y' || d > 0) continue;
      if (p.x < s.x0 - RAD || p.x > s.x1 + RAD || p.z < s.z0 - RAD || p.z > s.z1 + RAD) continue;
      const top = rampTop(s, p.x, p.z);
      if (p.y <= top && p.y > top - 2.2) {
        p.y = top; p.vy = 0; p.grounded = true; p.surface = s;
      }
      continue;
    }
    if (!boxAt(s, p.x, p.y, p.z)) continue;

    if (axis === 'y') {
      if (d > 0) { p.y = s.y0 - TALL; p.vy = Math.min(p.vy, 0); }
      else { p.y = s.y1; land(s); }
      continue;
    }

    // A lip you could have walked over. Erasers are left out on purpose: an
    // eraser is meant to be landed on, not strolled onto.
    const rise = s.y1 - p.y;
    if (rise > 0 && rise <= STEP_UP && s.kind !== 'bounce' && p.vy <= 0.5 &&
        !p.cling && clearAt(p.x, s.y1 + 0.02, p.z)) {
      p.y = s.y1 + 0.02;
      p.vy = 0;
      p.grounded = true;
      p.surface = s;
      continue;
    }

    if (axis === 'x') {
      if (d > 0) { p.x = s.x0 - RAD; touchWall(s, -1, 0); }
      else { p.x = s.x1 + RAD; touchWall(s, 1, 0); }
      p.vx = 0;
    } else {
      if (d > 0) { p.z = s.z0 - RAD; touchWall(s, 0, -1); }
      else { p.z = s.z1 + RAD; touchWall(s, 0, 1); }
      p.vz = 0;
    }
  }
}

function touchWall(s, nx, nz) {
  p.wall = { s, nx, nz };
}

/* ================================================================== pencil */

function land(s) {
  const speed = -p.vy;
  const wasDiving = p.diving;
  p.vy = 0;
  p.grounded = true;
  p.surface = s;

  if (s.kind === 'bounce') {
    // Damped hard enough to lose height every time. At 0.92 it gave back more
    // than it took — rising gravity is lighter than falling gravity — and an
    // eraser became a lift to the ceiling.
    const up = wasDiving ? 27 : Math.max(18, speed * 0.72);
    p.vy = up;
    p.grounded = false;
    p.doubleLeft = 1; p.dashReady = true;
    p.bounceChain++;
    if (wasDiving) { stats.diveBounces++; saved.diveBounces++; }
    p.diving = false;
    Sound.play('bounce');
    puff(p.x, p.y, p.z, 0xf58ea8, 10);
    return;
  }
  p.bounceChain = 0;

  if (wasDiving) {
    p.diving = false;
    p.stun = 0.18;
    p.sharp = Math.max(0, p.sharp - 0.05);
    shake = Math.max(shake, 0.5);
    Sound.play('stab');
    puff(p.x, p.y, p.z, s.col, 14);
  } else if (speed > 6) {
    Sound.play('land', Math.min(1, speed / 28));
    if (speed > 20) { shake = Math.max(shake, 0.28); puff(p.x, p.y, p.z, s.col, 8); }
  }

  // How far you came down, and whether it was the whole desk.
  const fell = p.peak - p.y;
  if (fell > stats.run.bigFall) stats.run.bigFall = fell;
  if (wasDiving && fell > stats.run.bestDive) stats.run.bestDive = fell;
  if (fell > 40) Sound.play('hurt');

  p.chain = 0;
  p.doubleLeft = 1;
  p.dashReady = true;
  p.flightDash = p.flightSpin = p.flightStab = false;
  p.peak = p.y;
}

/* Turning is smoothed rather than snapped: a pencil pivoting instantly looks
   like a sprite, and you can see the whole body turn at this size. */
function turnTo(target, dt) {
  let d = target - p.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.yaw += d * Math.min(1, dt * 16);
}

/* Every jump that came from a button can be cut short by letting go of that
   button — but only if the button was actually still down when it fired. A
   jump that came out of the buffer, from a tap made just before landing, is
   not a tap the player wants shortened. Launches that are not jumps at all
   (erasers, rubber bands) are never cut. */
function jump(v, fromButton) {
  p.vy = v;
  p.grounded = false;
  p.coyote = 0;
  p.peak = p.y;
  p.cutable = !!fromButton && !!keys.jump;
}

function respawn(manual) {
  const c = checkpoint || world.spawn;
  p.x = c.x; p.y = c.y + 0.4; p.z = c.z;
  p.vx = p.vy = p.vz = 0;
  p.cling = false; p.diving = false; p.stun = 0; p.chain = 0;
  p.doubleLeft = 1; p.dashReady = true; p.peak = p.y;
  p.sharp = 1;
  if (manual !== false) stats.run.resets++;
  flash = 0.4;
  Sound.play('reset');
}

function updatePlayer(dt) {
  // ---- what the sticks and keys are asking for, in camera space
  let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let iz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (stick.id >= 0) { ix += stick.dx; iz += stick.dy; }
  const mag = Math.hypot(ix, iz);
  if (mag > 1) { ix /= mag; iz /= mag; }
  // Camera space to world space. The camera sits at (sin, cos) from the
  // pencil and looks back at it, so forward is the negative of that and right
  // is forward turned a quarter. Getting one of these signs wrong mirrors your
  // controls as the camera comes round behind you, which is exactly as awful
  // as it sounds and exactly what the first version did.
  const cs = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
  let wx = ix * cs + iz * sn;
  let wz = iz * cs - ix * sn;
  const want = Math.hypot(wx, wz);

  const kind = p.surface ? p.surface.kind : '';
  const slick = kind === 'slick';
  const sticky = inSticky();

  p.wall = null;

  // ---- dash. Straight line, no gravity, and it draws.
  if (pressedDash && p.dashT <= 0 && p.dashReady && !p.cling && p.stun <= 0) {
    const dx = want > 0.1 ? wx / want : Math.sin(p.yaw);
    const dz = want > 0.1 ? wz / want : Math.cos(p.yaw);
    p.dashX = dx; p.dashZ = dz;
    p.dashT = DASH_TIME;
    p.dashReady = false;
    p.flightDash = true;
    p.yaw = Math.atan2(dx, dz);
    stats.dashes++; stats.run.dashes++; saved.dashes++;
    Sound.play('dash');
  }
  pressedDash = false;

  // ---- dive: tip first, straight down, and it will stick you in the floor
  if (pressedDive && !p.grounded && !p.cling && !p.diving && p.dashT <= 0) {
    p.diving = true;
    p.vy = -DIVE_SPEED;
    p.vx *= 0.25; p.vz *= 0.25;
    p.peak = Math.max(p.peak, p.y);
    Sound.play('slip');
  }
  pressedDive = false;

  if (pressedJump) p.jumpBuf = 0.12;
  pressedJump = false;
  p.jumpBuf -= dt;
  p.clingCool -= dt;
  p.stun -= dt;

  // ---- clinging to something soft
  if (p.cling) {
    // A short grace on letting go, so a moment of no input while you line up
    // the next kick does not drop you off the wall.
    const pushing = want > 0.15 && (wx * -p.clingNX + wz * -p.clingNZ) > -0.35;
    p.clingGrace = pushing ? 0.3 : p.clingGrace - dt;
    const holding = pushing || p.clingGrace > 0;
    p.vx = p.vy = p.vz = 0;
    p.y -= CLING_SLIDE * dt;
    p.sharp = Math.max(0, p.sharp - CLING_COST * dt);
    p.peak = p.y;
    if (p.jumpBuf > 0) {
      p.jumpBuf = 0;
      p.cling = false;
      p.clingCool = 0.16;
      p.vx = p.clingNX * 10.5; p.vz = p.clingNZ * 10.5;
      jump(15.6, true);
      p.yaw = Math.atan2(p.clingNX, p.clingNZ);
      p.doubleLeft = 1; p.dashReady = true;
      p.chain++;
      if (p.chain > stats.run.bestChain) stats.run.bestChain = p.chain;
      Sound.play('kick');
      puff(p.x, p.y + 1, p.z, 0xd8d2c0, 6);
    } else if (!holding || p.sharp <= 0) {
      p.cling = false;
      p.clingCool = 0.12;
      if (p.sharp <= 0) Sound.play('slip');
    }
  }

  // ---- ordinary ground and air movement
  if (!p.cling) {
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashX * DASH_SPEED;
      p.vz = p.dashZ * DASH_SPEED;
      p.vy = 0;
      if (Math.random() < 0.7) graphite();
      if (p.dashT <= 0) { p.vx *= 0.45; p.vz *= 0.45; }
    } else {
      const top = RUN * (sticky ? 0.45 : 1) * (p.stun > 0 ? 0.2 : 1);
      const accel = (p.grounded ? ACCEL : AIR_ACCEL) * (slick ? 0.4 : 1) * (sticky ? 0.5 : 1);
      if (want > 0.05) {
        p.vx += wx * accel * dt;
        p.vz += wz * accel * dt;
        turnTo(Math.atan2(wx, wz), dt);
      } else if (p.grounded) {
        const sp = Math.hypot(p.vx, p.vz);
        if (sp > 0.001) {
          const k = Math.max(0, sp - (slick ? 3 : FRICTION) * dt) / sp;
          p.vx *= k; p.vz *= k;
        }
      }
      // On the ground the limit is a limit. In the air it is bled off instead,
      // so a dash or a launch keeps its speed for a beat rather than vanishing
      // — but it has to bleed faster than air control can top it back up, or
      // you accelerate forever, which is exactly what the first version did.
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > top) {
        const eased = p.grounded && !slick ? top : Math.max(top, sp - 55 * dt);
        const k = eased / sp;
        p.vx *= k; p.vz *= k;
      }

      // jump, then the spin you get for spending the second one
      if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) {
        p.jumpBuf = 0;
        jump(JUMP, true);
        stats.run.jumps++;
        Sound.play('jump');
        puff(p.x, p.y, p.z, 0xe6e2d4, 5);
      } else if (p.jumpBuf > 0 && p.doubleLeft > 0 && !p.diving) {
        p.jumpBuf = 0;
        p.doubleLeft--;
        jump(DJUMP, true);
        p.spinV = 15;
        p.flightSpin = true;
        stats.spins++; saved.spins++;
        Sound.play('flip');
        puff(p.x, p.y + 0.8, p.z, 0xffffff, 7);
      }

      // Let go early and the jump stops early. A tap is a hop, a hold is the
      // full three units, and everything in between is yours.
      if (p.cutable && !keys.jump && p.vy > JUMP_CUT) { p.vy = JUMP_CUT; p.cutable = false; }
      if (p.vy <= 0) p.cutable = false;

      p.vy -= (p.vy > 0 ? GRAV : FALL_GRAV) * dt;
      if (p.vy < -60) p.vy = -60;
    }
  }

  // ---- the fan
  for (const s of world.winds) {
    if (p.x < s.x0 || p.x > s.x1 || p.z < s.z0 || p.z > s.z1 || p.y < s.y0 || p.y > s.y1) continue;
    const g = gustAt(s);
    if (g < 0.02) continue;
    const k = s.strength * g * dt;
    p.vx += s.push[0] * k; p.vy += s.push[1] * k; p.vz += s.push[2] * k;
    stats.run.blown += Math.abs(s.push[0] * k) + Math.abs(s.push[2] * k);
    if (Math.random() < 0.2 * g) Sound.play('wind');
  }

  // ---- move, in pieces small enough not to miss anything
  const wasGround = p.grounded;
  const carrier = p.grounded && p.surface && p.surface.move ? p.surface.move : null;
  p.grounded = false;
  p.surface = null;

  unstick();

  const speed = Math.max(Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz));
  const n = Math.max(1, Math.ceil(speed * dt / 0.3));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    moveAxis('x', p.vx * h);
    moveAxis('z', p.vz * h);
    moveAxis('y', p.vy * h);
  }
  if (carrier) { p.x += carrier.dx || 0; p.y += carrier.dy || 0; p.z += carrier.dz || 0; }

  // Going downhill, or down a step, the floor drops away faster than gravity
  // takes you and you spend the whole slope bouncing a centimetre off it. If
  // we were on the ground a moment ago and the ground is still within reach,
  // reach for it. Not while rising, and not while clinging or diving — those
  // are leaving the ground on purpose.
  if (!p.grounded && wasGround && p.vy <= 0 && !p.cling && !p.diving && p.dashT <= 0) {
    const g = floorUnder(p.x, p.y, p.z, SNAP_DOWN);
    if (g > -1e8 && p.y - g <= SNAP_DOWN) {
      p.y = g;
      p.vy = 0;
      p.grounded = true;
      p.surface = floorShape;
    }
  }

  // ---- can we hang off what we just bumped into?
  if (!p.grounded && !p.cling && p.wall && p.wall.s.kind === 'stab' &&
      p.sharp > 0 && p.clingCool <= 0 && p.dashT <= 0 && p.vy < 10 && !p.diving) {
    p.cling = true;
    p.clingNX = p.wall.nx; p.clingNZ = p.wall.nz;
    p.vx = p.vy = p.vz = 0;
    p.flightStab = true;
    p.clingGrace = 0.3;
    // Going in costs more than hanging there does, so a chimney is priced by
    // the number of kicks it takes rather than by how long you dawdle.
    p.sharp = Math.max(0, p.sharp - 0.045);
    stats.stabs++; stats.run.stabs++; saved.stabs++;
    if (p.wall.s.col === World.C.gumOld || p.wall.s.col === World.C.gum) {
      if (!p.wall.s.chewed) { p.wall.s.chewed = true; stats.gumWads++; saved.gumWads++; }
    }
    Sound.play('stab');
    puff(p.x - p.clingNX * 0.6, p.y + 1.1, p.z - p.clingNZ * 0.6, p.wall.s.col, 8);
    hint('stab', 'Space kicks off. Every stab costs you tip.');
  }

  if (p.grounded) {
    p.coyote = 0.12;
    p.air = 0;
    if (!wasGround) p.peak = p.y;
    if (slick && Math.hypot(p.vx, p.vz) > stats.run.slickSpeed) {
      stats.run.slickSpeed = Math.hypot(p.vx, p.vz);
    }
  } else {
    p.coyote -= dt;
    p.air += dt;
    if (p.air > stats.run.bestAir) stats.run.bestAir = p.air;
    if (p.y > p.peak) p.peak = p.y;
  }

  // ---- the look of the thing
  const sp2 = Math.hypot(p.vx, p.vz);
  p.lean += ((p.cling ? 0 : Math.min(0.3, sp2 * 0.022)) - p.lean) * Math.min(1, dt * 9);
  if (p.spinV > 0) {
    p.spin += p.spinV * dt;
    p.spinV -= dt * 22;
    if (p.spin >= Math.PI * 2) { p.spin = 0; p.spinV = 0; }
    if (p.spinV <= 0) { p.spin = 0; }
  }
  p.wobble += dt * (2 + sp2 * 0.4);

  // ---- footsteps, walked distance, standing perfectly still
  if (p.grounded && sp2 > 1) {
    stats.walked += sp2 * dt; saved.walked += sp2 * dt;
    if (Math.floor(p.wobble * 1.6) !== Math.floor((p.wobble - dt * (2 + sp2 * 0.4)) * 1.6)) Sound.play('step');
  }
  stats.run.idle = (p.grounded && sp2 < 0.05 && want < 0.01) ? stats.run.idle + dt : 0;

  if (sticky) { stats.glueTime += dt; saved.glueTime += dt; }
  if (inInk()) { stats.inkTime += dt; saved.inkTime += dt; }

  if (p.y < -20) respawn(false);
}

/* How hard the fan is blowing right now: nothing for half of every cycle,
   then up and over. Squaring it keeps the lull long and the peak short, which
   is the shape you want for something you have to wait out. */
function gustAt(s) {
  const t = Math.sin(simTime * (Math.PI * 2 / (s.period || 4.6)) + (s.phase || 0));
  return t <= 0 ? 0 : t * t;
}

/* What we are standing in, as opposed to on. Puddles are flat and you are
   inside them, so they are checked by point rather than by collision. */
function fluid(kind) {
  const list = near(p.x - RAD, p.y - 0.4, p.z - RAD, p.x + RAD, p.y + 0.6, p.z + RAD);
  for (const s of list) {
    if (s.kind !== kind) continue;
    if (p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1 && p.y < s.y1 + 0.3 && p.y > s.y0 - 0.6) return s;
  }
  return null;
}
function inSticky() { return !!fluid('sticky'); }
function inInk() {
  const s = fluid('sticky');
  return !!s && s.col === World.C.ink;
}

/* ============================================================== pickups */

function pickups(dt) {
  // Crumbs, close enough to sweep up.
  for (const c of world.crumbs) {
    if (c.got) continue;
    c.spin += dt * 2;
    const dx = c.x - p.x, dy = c.y - (p.y + 0.9), dz = c.z - p.z;
    if (dx*dx + dy*dy + dz*dz < 6.6) {
      c.got = true;
      stats.crumbs++; stats.run.crumbs++; saved.crumbs++;
      Sound.play('crumb');
      puff(c.x, c.y, c.z, 0x6b7280, 5);
    }
  }

  for (const st of world.stars) {
    if (st.taken) continue;
    const dx = st.x - p.x, dy = st.y - (p.y + 0.9), dz = st.z - p.z;
    if (dx*dx + dy*dy + dz*dz > 9) continue;
    st.taken = true;
    stats.run.stars++;
    if (!st.got) {
      st.got = true;
      saved.stars.push(st.name);
      persist();
    }
    stats.stars = countStars();
    Sound.play('star');
    flash = 0.25;
    toast('Gold star', st.name);
    puff(st.x, st.y, st.z, 0xffd54a, 16);
  }

  // Sharpeners: the checkpoint and the refill, in one object.
  for (const c of world.checkpoints) {
    const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z;
    if (dx*dx + dy*dy*0.4 + dz*dz > 16) continue;
    if (p.sharp < 0.999) {
      p.sharp = 1;
      stats.sharpenings++; saved.sharpenings++;
      Sound.play('sharpen');
      puff(c.x, c.y + 1, c.z, 0xe4c98a, 12);
    }
    if (checkpoint !== c) {
      checkpoint = c;
      toast('Sharpened', c.name);
      Sound.play('ui');
    }
  }

  // Two places you can end up that are not on the way anywhere.
  for (const s of near(p.x - RAD, p.y - 1, p.z - RAD, p.x + RAD, p.y + 1, p.z + RAD)) {
    if (s.tag === 'bin' && p.y < 12) { stats.inBin = saved.inBin = true; }
  }
  if (Math.abs(p.x + 15) < 5 && Math.abs(p.z - 6) < 5 && p.y > 88 && p.y < 100) {
    stats.inMug = saved.inMug = true;
  }

  // Home.
  if (!stats.won) {
    const g = world.goal;
    if (Math.abs(p.x - g.x) < 18 && Math.abs(p.z - g.z) < g.r && Math.abs(p.y - g.y) < 3) win();
  }
}

function countStars() {
  let n = 0;
  for (const st of world.stars) if (st.got) n++;
  return n;
}

/* =============================================================== particles */

function puff(x, y, z, col, n) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x, y: y + 0.3, z, col,
      vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 6,
      life: 0.5 + Math.random() * 0.4, t: 0, s: 0.1 + Math.random() * 0.14, g: 22,
    });
  }
}

/* The line a dash leaves behind. It does not move and it fades slowly, which
   is the whole gag: the pencil draws its own path through the room. */
function graphite() {
  parts.push({
    x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + 0.9, z: p.z + (Math.random() - 0.5) * 0.3,
    col: 0x4a4f5c, vx: 0, vy: 0, vz: 0, life: 1.1, t: 0, s: 0.16, g: 0,
  });
}

function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.t += dt;
    if (q.t >= q.life) { parts.splice(i, 1); continue; }
    q.vy -= q.g * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
  }
  if (parts.length > 400) parts.splice(0, parts.length - 400);
}

/* ================================================================= movers */

function updateMovers(t) {
  for (const m of world.movers) {
    const v = Math.sin(t * Math.PI * 2 / m.period + m.phase) * m.amp;
    const d = v - m.off;
    m.off = v;
    m.dx = m.ax * d; m.dy = m.ay * d; m.dz = m.az * d;
    const s = m.s, b = m.base;
    s.x0 = b.x0 + m.ax * v; s.x1 = b.x1 + m.ax * v;
    s.y0 = b.y0 + m.ay * v; s.y1 = b.y1 + m.ay * v;
    s.z0 = b.z0 + m.az * v; s.z1 = b.z1 + m.az * v;
  }
}

/* ================================================================= camera */

function updateCamera(dt) {
  cam.yaw -= mouseDX * 0.0026;
  cam.pitch += mouseDY * 0.0022;
  mouseDX = 0; mouseDY = 0;
  // On the title screen the camera drifts round the pencil on its own, so the
  // first thing anyone sees is the room rather than a menu on a still.
  if (mode === 'title') cam.yaw += dt * 0.12;
  cam.pitch = Math.max(-0.55, Math.min(1.15, cam.pitch));

  const tx = p.x, ty = p.y + 1.5, tz = p.z;
  cam.tx += (tx - cam.tx) * Math.min(1, dt * 14);
  cam.ty += (ty - cam.ty) * Math.min(1, dt * 9);
  cam.tz += (tz - cam.tz) * Math.min(1, dt * 14);

  const cp = Math.cos(cam.pitch);
  const dx = Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cp;

  let want = 9;
  for (let t = 1; t < want; t += 0.5) {
    if (solidAt(cam.tx + dx * t, cam.ty + dy * t, cam.tz + dz * t)) { want = Math.max(2.2, t - 0.6); break; }
  }
  cam.dist += (want - cam.dist) * Math.min(1, dt * (want < cam.dist ? 20 : 5));

  const sp = Math.hypot(p.vx, p.vz);
  cam.fov += ((1.14 + Math.min(0.16, sp * 0.008) + (p.dashT > 0 ? 0.1 : 0)) - cam.fov) * Math.min(1, dt * 6);

  let sx = 0, sy = 0;
  if (shake > 0) {
    sx = (Math.random() - 0.5) * shake * 0.6;
    sy = (Math.random() - 0.5) * shake * 0.6;
    shake = Math.max(0, shake - dt * 2.2);
  }
  cam.x = cam.tx + dx * cam.dist + sx;
  cam.y = cam.ty + dy * cam.dist + sy;
  cam.z = cam.tz + dz * cam.dist;
}

function solidAt(x, y, z) {
  const list = near(x - 0.3, y - 0.3, z - 0.3, x + 0.3, y + 0.3, z + 0.3);
  for (const s of list) {
    if (s.kind === 'wind' || s.kind === 'deco' || s.kind === 'sticky') continue;
    if (s.kind === 'ramp') {
      if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y < rampTop(s, x, z)) return true;
      continue;
    }
    if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1 && z > s.z0 && z < s.z1) return true;
  }
  return false;
}

function groundBelow(x, y, z) {
  const list = near(x - 0.5, y - 60, z - 0.5, x + 0.5, y + 0.2, z + 0.5);
  let best = -999;
  for (const s of list) {
    if (s.kind === 'wind' || s.kind === 'deco') continue;
    if (x < s.x0 - RAD || x > s.x1 + RAD || z < s.z0 - RAD || z > s.z1 + RAD) continue;
    const top = s.kind === 'ramp' ? rampTop(s, x, z) : s.y1;
    if (top <= y + 0.05 && top > best) best = top;
  }
  return best;
}

/* ============================================================== the pencil */
/* Drawn from the tip up: lead, wood, six-sided body with a face on the front,
   a tin collar and a rubber. The tip gets shorter as it blunts, which is the
   sharpness meter you actually look at. */

const M = GFX.m4.make();
const M2 = GFX.m4.make();

function drawPencil() {
  let pitch = p.lean;
  let yaw = p.yaw;
  let lift = 0;

  if (p.cling) {
    yaw = Math.atan2(-p.clingNX, -p.clingNZ);
    pitch = 1.25;
    lift = 0.8;
  } else if (p.diving) {
    pitch = 0;
  } else if (p.spinV > 0) {
    pitch = p.lean - p.spin;
  } else if (!p.grounded) {
    pitch = p.lean * 1.4;
  } else {
    pitch = p.lean + Math.sin(p.wobble * 3) * 0.03;
  }

  GFX.m4.compose(p.x, p.y + lift, p.z, yaw, pitch, 0, 1, M);

  const sharpLen = 0.1 + p.sharp * 0.22;
  const C = World.C;
  dyn.prism(6, 0.001, 0.1, 0, sharpLen, 0x33363f, M);            // the lead
  dyn.prism(6, 0.1, 0.34, sharpLen, sharpLen + 0.34, 0xe6c99a, M); // the wood
  dyn.prism(6, 0.34, 0.34, sharpLen + 0.34, 1.5, 0xf5c518, M);     // the body
  dyn.prism(6, 0.35, 0.35, 0.95, 1.06, 0xd8a614, M);               // a painted band
  dyn.prism(10, 0.31, 0.31, 1.5, 1.66, 0xb9bcc4, M);               // the collar
  dyn.prism(10, 0.3, 0.26, 1.66, 1.9, 0xef7f9a, M);                // the rubber

  // A face, on the flat of the body that is pointing forward.
  const eye = (ox) => {
    GFX.m4.compose(0, 0, 0, 0, 0, 0, 1, M2);
    dyn.box(ox, 1.24, 0.33, 0.07, 0.09, 0.05, 0x2b2f38, M);
  };
  eye(-0.13); eye(0.13);
  const mouth = p.diving || p.dashT > 0 ? 0.06 : 0.03;
  dyn.box(0, 1.06, 0.33, 0.12, mouth, 0.04, 0x2b2f38, M);

  // A blob of shadow on whatever is underneath, shrinking with the drop. With
  // no lighting to speak of it is the only thing telling you where you are
  // about to land, so it matters more here than it looks like it should.
  const g = groundBelow(p.x, p.y, p.z);
  if (g > -900) {
    const drop = Math.max(0, p.y - g);
    if (drop < 44) {
      const s = Math.max(0.2, 0.68 - drop * 0.012);
      GFX.m4.compose(p.x, g + 0.05, p.z, 0, 0, 0, 1, M2);
      dyn.prism(10, s, s, 0, 0.03, 0x5b6158, M2);
    }
  }
}

/* ============================================================ what is drawn */

function drawScene() {
  dyn.reset();
  drawPencil();

  const t = performance.now() / 1000;

  // Crumbs, turning slowly. Only the ones nearby: there are a lot of them and
  // a crumb thirty units off is one pixel.
  for (const c of world.crumbs) {
    if (c.got) continue;
    const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z;
    if (dx*dx + dy*dy + dz*dz > 4900) continue;
    GFX.m4.compose(c.x, c.y + Math.sin(t * 2 + c.spin) * 0.12, c.z, c.spin + t * 1.4, 0.6, 0, 1, M);
    dyn.box(0, 0, 0, 0.2, 0.2, 0.2, 0x4a4f5c, M);
    dyn.box(0, 0, 0, 0.28, 0.06, 0.06, 0x71798a, M);
  }

  // Stars: a proper five-pointed one is four boxes at forty-five degrees.
  for (const st of world.stars) {
    if (st.got) continue;
    const dx = st.x - p.x, dy = st.y - p.y, dz = st.z - p.z;
    if (dx*dx + dy*dy + dz*dz > 14000) continue;
    GFX.m4.compose(st.x, st.y + 1.2 + Math.sin(t * 1.6) * 0.25, st.z, t * 1.1, 0, 0, 1, M);
    for (let i = 0; i < 3; i++) {
      GFX.m4.compose(st.x, st.y + 1.2 + Math.sin(t * 1.6) * 0.25, st.z, t * 1.1, 0, i * 1.05, 1, M2);
      dyn.box(0, 0, 0, 0.85, 0.22, 0.14, 0xffd54a, M2);
    }
  }

  // Sharpeners get a ring of chips spinning over them, gold once used.
  for (const c of world.checkpoints) {
    const dx = c.x - p.x, dz = c.z - p.z;
    if (dx*dx + dz*dz > 14000) continue;
    const on = checkpoint === c;
    for (let i = 0; i < 4; i++) {
      const a = t * (on ? 2.2 : 0.7) + i * 1.57;
      dyn.box(c.x + Math.cos(a) * 1.7, c.y + 4.6 + Math.sin(t * 2 + i) * 0.15, c.z + Math.sin(a) * 1.7,
        0.16, 0.16, 0.16, on ? 0xffd54a : 0x9aa3ae);
    }
  }

  // Dust in the gust. Not particles — the motes are a formula of the clock, so
  // they cost nothing to keep and they stop dead when the fan does. Without
  // them the wind is an invisible hand, which is the worst kind of hazard.
  for (const s of world.winds) {
    const g = gustAt(s);
    if (g < 0.06) continue;
    const span = s.x1 - s.x0;
    for (let i = 0; i < 44; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const rz = h - Math.floor(h);
      const h2 = Math.sin(i * 78.233) * 12345.6789;
      const ry = h2 - Math.floor(h2);
      const travel = (simTime * 26 + i * 7.3) % span;
      const x = s.x1 - travel;
      if (x < s.x0) continue;
      const z = s.z0 + rz * (s.z1 - s.z0) - travel * 0.5 * 0.4;
      const y = s.y0 + ry * (s.y1 - s.y0) + travel * 0.14 * 0.3;
      if (z < s.z0 - 6 || y > s.y1) continue;
      const k = 0.14 + g * 0.2;
      dyn.box(x, y, z, k * 3.2, k, k, 0xe9e4d6);
    }
  }

  // Movers are drawn where they are now, not where they were baked.
  for (const m of world.movers) {
    const s = m.s;
    dyn.box((s.x0+s.x1)/2, (s.y0+s.y1)/2, (s.z0+s.z1)/2,
      (s.x1-s.x0)/2, (s.y1-s.y0)/2, (s.z1-s.z0)/2, s.col);
  }

  for (const q of parts) {
    const k = 1 - q.t / q.life;
    dyn.box(q.x, q.y, q.z, q.s * k, q.s * k, q.s * k, q.col);
  }

  GFX.begin(cam, FOG);
  GFX.draw(statics);
  GFX.draw(dyn);
}

/* ================================================================== screens */

function show(which) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = true;
  const v = $('veil');
  if (which) { $(which).hidden = false; v.hidden = false; }
  else v.hidden = true;
  $('hud').hidden = !!which;
  $('touch').hidden = !!which;
}

function onEscape() {
  if (mode === 'play') { mode = 'pause'; show('screen-pause'); if (document.exitPointerLock) document.exitPointerLock(); }
  else if (mode === 'pause') resume();
  else if (mode === 'achv' || mode === 'help') {
    mode = wonAt ? 'win' : (runTime > 0 ? 'pause' : 'title');
    show(mode === 'win' ? 'screen-win' : mode === 'pause' ? 'screen-pause' : 'screen-title');
  }
}

function resume() { mode = 'play'; show(null); }

function startRun() {
  if (!world) return;
  stats = Achv.freshStats({ crumbs: world.crumbs.length, stars: world.stars.length });
  stats.crumbs = saved.crumbs;
  stats.dashes = saved.dashes; stats.stabs = saved.stabs; stats.spins = saved.spins;
  stats.walked = saved.walked; stats.sharpenings = saved.sharpenings;
  stats.diveBounces = saved.diveBounces; stats.gumWads = saved.gumWads;
  stats.glueTime = saved.glueTime; stats.inkTime = saved.inkTime;
  stats.inBin = saved.inBin; stats.inMug = saved.inMug;
  stats.stars = countStars();

  for (const c of world.crumbs) c.got = false;
  for (const st of world.stars) st.taken = false;
  for (const s of world.shapes) s.chewed = false;
  parts.length = 0;

  checkpoint = null;
  runTime = 0; wonAt = 0;
  p.x = world.spawn.x; p.y = world.spawn.y; p.z = world.spawn.z;
  p.vx = p.vy = p.vz = 0; p.yaw = world.spawn.yaw; p.sharp = 1;
  p.cling = false; p.diving = false; p.spin = 0; p.spinV = 0; p.chain = 0;
  p.doubleLeft = 1; p.dashReady = true; p.peak = p.y;
  cam.yaw = world.spawn.yaw; cam.pitch = 0.2;
  cam.tx = p.x; cam.ty = p.y + 1.5; cam.tz = p.z;

  saved.runs++;
  persist();
  mode = 'play';
  show(null);
  Sound.music(true);
  hint('start', 'The desk is up there somewhere. Follow the graphite.');
}

function win() {
  stats.won = true;
  stats.run.time = runTime;
  stats.wonSpinning = p.spinV > 0;
  wonAt = runTime;
  mode = 'win';
  if (!saved.best || runTime < saved.best) saved.best = runTime;
  persist();
  Sound.music(false);
  Sound.play('win');
  for (let i = 0; i < 60; i++) {
    puff(world.goal.x + (Math.random() - 0.5) * 20, world.goal.y + 2, world.goal.z + (Math.random() - 0.5) * 6,
      [0xffd54a, 0xef7f9a, 0x7ce6ff, 0xf5c518][i & 3], 1);
  }
  $('win-time').textContent = clock(runTime);
  $('win-crumbs').textContent = stats.run.crumbs + ' / ' + world.crumbs.length;
  $('win-stars').textContent = stats.run.stars + ' / ' + world.stars.length;
  $('win-best').textContent = clock(saved.best);
  show('screen-win');
  if (document.exitPointerLock) document.exitPointerLock();
}

function clock(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* --------------------------------------------------------------- the chart */

function paintChart() {
  const box = $('achv-list');
  const pr = Achv.progress();
  $('achv-count').textContent = pr.got + ' of ' + pr.total;
  $('achv-bar').style.width = Math.round(pr.got / pr.total * 100) + '%';
  let html = '';
  for (const a of Achv.LIST) {
    const got = Achv.earned(a.id);
    const secret = a.secret && !got;
    html += '<li class="' + (got ? 'got' : '') + (secret ? ' secret' : '') + '">' +
      '<span class="sticker">' + (got ? '★' : secret ? '?' : '☆') + '</span>' +
      '<b>' + (secret ? 'Hidden' : a.name) + '</b>' +
      '<i>' + (secret ? 'Play and find out.' : a.note) + '</i></li>';
  }
  box.innerHTML = html;
}

/* ------------------------------------------------------------------ toasts */

function toast(kind, text) {
  const box = $('toasts');
  // Four at once is plenty. A run that trips six achievements in a second
  // should not paper over the game with its own congratulations.
  while (box.children.length > 3) box.removeChild(box.firstChild);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span>' + kind + '</span><b>' + text + '</b>';
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); }, 3200);
  setTimeout(() => { el.remove(); }, 3900);
}

function hint(id, text) {
  if (seenHints[id]) return;
  seenHints[id] = true;
  hintText = text;
  hintFor = 5;
}

/* ------------------------------------------------------------------ HUD */

let hudTick = 0;
function paintHud(dt) {
  hudTick -= dt;
  const zone = World.zoneAt(p.y, p.z);
  $('sharp-fill').style.height = Math.round(p.sharp * 100) + '%';
  $('meter-pip').style.bottom = Math.max(0, Math.min(100, (p.y / 90) * 100)) + '%';
  if (hudTick > 0) return;
  hudTick = 0.12;
  $('zone-name').textContent = zone.name;
  $('zone-sub').textContent = Math.max(0, Math.round(p.y)) + ' up, ' + Math.max(0, Math.round(90 - p.y)) + ' to go';
  $('n-crumb').textContent = stats.run.crumbs;
  $('n-star').textContent = stats.run.stars + '/' + world.stars.length;
  $('n-time').textContent = clock(runTime);
  const h = $('hint');
  if (hintFor > 0) { h.textContent = hintText; h.hidden = false; }
  else h.hidden = true;
}

/* =================================================================== stats */

function bookkeeping(dt) {
  runTime += dt;
  stats.run.time = runTime;
  stats.run.sharp = p.sharp;
  if (p.y > stats.run.height) stats.run.height = p.y;
  const z = World.zoneAt(p.y, p.z);
  if (!stats.run.zones[z.id]) { stats.run.zones[z.id] = true; stats.run.zoneCount++; announceZone(z); }
  if (p.flightDash && p.flightSpin && p.flightStab) stats.run.freehand = true;
  if (p.bounceChain > stats.run.bounceChain) stats.run.bounceChain = p.bounceChain;
  hintFor -= dt;

  const got = Achv.poll(stats);
  for (const a of got) {
    toast('Achievement', a.name);
    Sound.play('achievement');
    flash = Math.max(flash, 0.2);
  }
  if (got.length) persist();
}

/* One line the first time you arrive somewhere that works differently. They
   are hints, not a tutorial: each one says what the zone is for and then the
   game never mentions it again. */
const ZONE_HINTS = {
  backpack: 'The straps are a ladder. The cork behind them will take your tip.',
  chair: 'Shift dashes — one per jump, back again when you land.',
  backrest: 'Jump into a gap between two slats and hold toward one of them.',
  under: 'There is a fan on the floor and it can still reach you up here.',
  drawer: 'Chipboard takes a tip too. Get up the inside of the front.',
  desktop: 'The groove is along the back edge. The lunchbox is the way over.',
};

let lastZone = '';
function announceZone(z) {
  if (z.id === lastZone) return;
  lastZone = z.id;
  if (runTime > 1) toast('Reached', z.name);
  if (ZONE_HINTS[z.id]) hint('zone-' + z.id, ZONE_HINTS[z.id]);
}

/* ==================================================================== loop */

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  tick(dt);
}

function tick(dt) {
  if (mode === 'play') {
    acc += dt;
    let guard = 5;
    while (acc >= STEP && guard-- > 0) {
      acc -= STEP;
      simTime += STEP;
      updateMovers(simTime);
      updatePlayer(STEP);
      pickups(STEP);
      updateParts(STEP);
      bookkeeping(STEP);
    }
    if (acc > 0.25) acc = 0;
    updateCamera(dt);
    paintHud(dt);
  } else {
    updateCamera(Math.min(dt, 0.05));
    updateParts(dt);
  }

  if (flash > 0) {
    flash = Math.max(0, flash - dt * 2);
    $('flash').style.opacity = flash * 0.5;
  }

  if (GFX.ok && world) drawScene();
}

/* ================================================================== wiring */

function toggleMute() {
  const m = Sound.toggle();
  for (const el of document.querySelectorAll('[data-mute]')) el.textContent = m ? 'Sound: off' : 'Sound: on';
}

function bind(id, fn) {
  const el = $(id);
  if (el) el.addEventListener('click', () => { Sound.unlock(); Sound.play('ui'); fn(); });
}

bind('btn-play', startRun);
bind('btn-play-again', startRun);
bind('btn-resume', resume);
bind('btn-restart', startRun);
bind('btn-title', () => { mode = 'title'; runTime = 0; wonAt = 0; Sound.music(false); show('screen-title'); });
bind('btn-title2', () => { mode = 'title'; runTime = 0; wonAt = 0; show('screen-title'); });
for (const id of ['btn-achv', 'btn-achv2', 'btn-achv3']) {
  bind(id, () => { mode = 'achv'; paintChart(); show('screen-achv'); });
}
for (const id of ['btn-help', 'btn-help2']) {
  bind(id, () => { mode = 'help'; show('screen-help'); });
}
bind('btn-back', onEscape);
bind('btn-back2', onEscape);
bind('btn-forget', () => {
  if (!confirm('Clear every sticker and start the chart again?')) return;
  Achv.forget();
  saved = { stars: [], crumbs: 0, dashes: 0, stabs: 0, spins: 0, walked: 0, sharpenings: 0,
    diveBounces: 0, gumWads: 0, glueTime: 0, inkTime: 0, inBin: false, inMug: false, best: 0, runs: 0 };
  persist();
  for (const st of world.stars) st.got = false;
  paintChart();
});
for (const el of document.querySelectorAll('[data-mute]')) el.addEventListener('click', () => { Sound.unlock(); toggleMute(); });

addEventListener('resize', () => GFX.resize());

/* =================================================================== boot */

function boot() {
  if (!GFX.init(glc)) {
    $('screen-title').hidden = true;
    $('veil').hidden = false;
    $('screen-sorry').hidden = false;
    return;
  }
  loadWorld();
  stats = Achv.freshStats({ crumbs: world.crumbs.length, stars: world.stars.length });
  p.x = world.spawn.x; p.y = world.spawn.y; p.z = world.spawn.z;
  cam.tx = p.x; cam.ty = p.y + 1.5; cam.tz = p.z;
  cam.yaw = world.spawn.yaw;

  const pr = Achv.progress();
  $('title-stickers').textContent = pr.got + ' / ' + pr.total + ' stickers';
  $('title-best').textContent = saved.best ? 'Best climb: ' + clock(saved.best) : 'Never made it up yet';
  for (const el of document.querySelectorAll('[data-mute]')) el.textContent = Sound.muted ? 'Sound: off' : 'Sound: on';

  show('screen-title');
  last = performance.now();
  requestAnimationFrame(frame);
}

/* A handle on the innards, for anyone who wants to poke at the game from the
   console — including whoever is checking whether that jump is actually
   possible. `step` runs the simulation by hand, which is how the route was
   measured; `go` puts the pencil somewhere. Nothing here does anything the
   game does not already do to itself. */
window.PENCIL = {
  get p() { return p; },
  get world() { return world; },
  get stats() { return stats; },
  get keys() { return keys; },
  get cam() { return cam; },
  get mode() { return mode; },
  go(x, y, z) { p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.peak = y; },
  step(n, dt) { for (let i = 0; i < (n || 1); i++) tick(dt || STEP); },
  tap(k) { if (k === 'jump') pressedJump = true; if (k === 'dash') pressedDash = true; if (k === 'dive') pressedDive = true; },
};

boot();
})();
