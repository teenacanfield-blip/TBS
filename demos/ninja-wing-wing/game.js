/* Ninja Wing Wing — a fighter.
 *
 * Two ideas, borrowed on purpose:
 *
 *   From Smash — a stage made of platforms with nothing underneath, damage that
 *   builds as a percentage rather than a health bar, knockback that grows with
 *   it, and a KO when somebody leaves the screen. Stocks, not rounds.
 *
 *   From Street Fighter — a roster you pick from, where the choice really
 *   changes how you play, moves that come out of a direction plus a button, and
 *   a block you have to hold and spend.
 *
 * The recoil the game was built on is still the spine of it: every shuriken
 * shoves you the opposite way, so throwing downward is how you climb, and a
 * throw behind you is a dash. That is a movement system and a fighting system
 * at the same time, which is why it survived the rewrite.
 *
 * Online is peer-to-peer, the same shape The 13 Dynasties uses: one side hosts
 * and owns the simulation, the other sends its buttons and mirrors what comes
 * back. See the netcode section for what that costs.
 */
(function () {
'use strict';

const W = 320, H = 180;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const STEP = 1 / 60;

/* ===================================================================== font */
/* 3x5 letters, a rectangle at a time, so text lands on the same grid as art. */
const GLYPHS = {
  A: '###,#.#,###,#.#,#.#', B: '##.,#.#,##.,#.#,##.', C: '###,#..,#..,#..,###',
  D: '##.,#.#,#.#,#.#,##.', E: '###,#..,##.,#..,###', F: '###,#..,##.,#..,#..',
  G: '###,#..,#.#,#.#,###', H: '#.#,#.#,###,#.#,#.#', I: '###,.#.,.#.,.#.,###',
  J: '..#,..#,..#,#.#,###', K: '#.#,#.#,##.,#.#,#.#', L: '#..,#..,#..,#..,###',
  M: '#.#,###,###,#.#,#.#', N: '##.,#.#,#.#,#.#,#.#', O: '###,#.#,#.#,#.#,###',
  P: '###,#.#,###,#..,#..', Q: '###,#.#,#.#,###,..#', R: '###,#.#,##.,#.#,#.#',
  S: '###,#..,###,..#,###', T: '###,.#.,.#.,.#.,.#.', U: '#.#,#.#,#.#,#.#,###',
  V: '#.#,#.#,#.#,#.#,.#.', W: '#.#,#.#,###,###,#.#', X: '#.#,#.#,.#.,#.#,#.#',
  Y: '#.#,#.#,.#.,.#.,.#.', Z: '###,..#,.#.,#..,###',
  0: '###,#.#,#.#,#.#,###', 1: '.#.,##.,.#.,.#.,###', 2: '###,..#,###,#..,###',
  3: '###,..#,###,..#,###', 4: '#.#,#.#,###,..#,..#', 5: '###,#..,###,..#,###',
  6: '###,#..,###,#.#,###', 7: '###,..#,..#,..#,..#', 8: '###,#.#,###,#.#,###',
  9: '###,#.#,###,..#,###',
  ' ': '...,...,...,...,...', '!': '.#.,.#.,.#.,...,.#.', '.': '...,...,...,...,.#.',
  ',': '...,...,...,.#.,#..', ':': '...,.#.,...,.#.,...', '-': '...,...,###,...,...',
  "'": '.#.,.#.,...,...,...', '/': '..#,..#,.#.,#..,#..', '?': '###,..#,.##,...,.#.',
  '+': '...,.#.,###,.#.,...', '%': '#.#,..#,.#.,#..,#.#', '<': '..#,.#.,#..,.#.,..#',
  '>': '#..,.#.,..#,.#.,#..',
};

function textWidth(s, sc) { return String(s).length * 4 * sc - sc; }

function drawText(s, x, y, colour, sc, align) {
  sc = sc || 1;
  const str = String(s).toUpperCase();
  let px = x;
  if (align === 'center') px = Math.round(x - textWidth(str, sc) / 2);
  if (align === 'right') px = Math.round(x - textWidth(str, sc));
  ctx.fillStyle = colour;
  for (const ch of str) {
    const rows = (GLYPHS[ch] || GLYPHS['?']).split(',');
    for (let ry = 0; ry < 5; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < 3; rx++) {
        if (row[rx] === '#') ctx.fillRect(px + rx * sc, y + ry * sc, sc, sc);
      }
    }
    px += 4 * sc;
  }
}

function drawTextShadow(s, x, y, colour, sc, align) {
  drawText(s, x + sc, y + sc, '#0a0208', sc, align);
  drawText(s, x, y, colour, sc, align);
}

/* ==================================================================== input */

/* Two keyboard layouts so two people can share one keyboard, plus a touch pad
 * that always drives player one. `tapped` latches a press that begins and ends
 * inside a single frame, which menus read instead of the held state. */
const keys = {};
const tapped = {};

const LAYOUTS = [
  { // player one — left hand
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyF: 'atk', KeyG: 'star', KeyV: 'block', KeySpace: 'flap',
    Space: 'flap',
  },
  { // player two — right hand
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyK: 'atk', KeyL: 'star', KeyM: 'block', Slash: 'flap',
    Period: 'flap',
  },
];

// Menu keys belong to nobody in particular; either player can drive a menu.
const MENU_KEYS = {
  // Deliberately NOT Space: Space is player one's flap, and a key that means
  // two things lets one press do two jobs across a screen change.
  Enter: 'ok', KeyF: 'ok', KeyK: 'ok',
  Escape: 'back', Backspace: 'back',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
};

function pad(i) { return keys['p' + i] || (keys['p' + i] = {}); }

addEventListener('keydown', (e) => {
  if (codeOpen) return;                 // the room-code field owns the keyboard
  let used = false;

  for (let i = 0; i < 2; i++) {
    const k = LAYOUTS[i][e.code];
    if (k) { const s = pad(i); if (!s[k]) s['t_' + k] = true; s[k] = true; used = true; }
  }
  const m = MENU_KEYS[e.code];
  if (m) { tapped[m] = true; used = true; }

  // Arrows and space scroll the page otherwise, very visible inside the hub.
  if (used) e.preventDefault();
});

addEventListener('keyup', (e) => {
  for (let i = 0; i < 2; i++) {
    const k = LAYOUTS[i][e.code];
    if (k) pad(i)[k] = false;
  }
});

// A held key with no keyup (alt-tab, the hub closing the frame) would leave
// someone walking into a wall forever.
function clearKeys() {
  for (let i = 0; i < 2; i++) { const s = pad(i); for (const k in s) s[k] = false; }
  for (const k in tapped) tapped[k] = false;
}
addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });

// Reads and clears a one-shot press for a pad.
function took(i, k) { const s = pad(i); if (s['t_' + k]) { s['t_' + k] = false; return true; } return false; }
function tookMenu(k) { if (tapped[k]) { tapped[k] = false; return true; } return false; }

(function initTouch() {
  const el = document.getElementById('touch');
  if (!(('ontouchstart' in window) || navigator.maxTouchPoints > 0)) return;
  document.body.classList.add('touch');

  for (const btn of el.querySelectorAll('button')) {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('on');
      const s = pad(0);
      if (!s[k]) s['t_' + k] = true;
      s[k] = true;
      tapped.ok = true;                 // any tap also answers a menu
      if (k === 'left') tapped.left = true;
      if (k === 'right') tapped.right = true;
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('on');
      pad(0)[k] = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
})();

/* ====================================================================== fit */

function fit() {
  const p = 8;
  const aw = Math.max(80, innerWidth - p * 2);
  const ah = Math.max(60, innerHeight - p * 2);
  let s = Math.min(aw / W, ah / H);
  // Whole numbers keep the pixels square, but only once there is room: rounding
  // 1.9 down to 1 threw away half a phone screen in both orientations.
  if (s >= 2) s = Math.floor(s);
  canvas.style.width = Math.round(W * s) + 'px';
  canvas.style.height = Math.round(H * s) + 'px';
}
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
fit();

/* =================================================================== roster */

/* The roster lives in fighters.js so it can be authored in character-lab.html
 * rather than edited by hand in here. Everything the game needs beyond the raw
 * data is worked out once, on load. */
const ROSTER = (typeof FIGHTERS !== 'undefined' ? FIGHTERS : []).map((c) => ({
  ...c,
  // Slot 5 of a fighter's palette is their signature colour — it is the scarf
  // on the default art, and it is what the HUD and the select boxes use.
  colour: (c.palette && c.palette[5]) || '#ff5f6d',
  hint: 'UP: ' + String(c.up || 'jab') + '   DIVE: ' + String(c.dive || 'jab'),
}));

if (!ROSTER.length) {
  // fighters.js failed to load. Say so on the canvas rather than dying with a
  // blank screen and an error nobody will read.
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);
  drawText('FIGHTERS.JS DID NOT LOAD', W / 2, 84, '#ff5f6d', 1, 'center');
  throw new Error('fighters.js missing');
}

const byChar = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];

/* ==================================================================== stage */

/* The maps live in stages.js. `stage()` is the one that is being fought on;
 * everything else asks for its platforms and spawns through here rather than
 * closing over a fixed list. */
const STAGE_LIST = (typeof STAGES !== 'undefined' && STAGES.length) ? STAGES : [];

if (!STAGE_LIST.length) {
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);
  drawText('STAGES.JS DID NOT LOAD', W / 2, 84, '#ff5f6d', 1, 'center');
  throw new Error('stages.js missing');
}

const stage = () => STAGE_LIST[game.stage] || STAGE_LIST[0];
const platforms = () => stage().platforms;
const spawnAt = (i) => stage().spawns[i] || stage().spawns[0];

// Leave these and you lose a stock. Deliberately the same on every map, so a
// map cannot quietly change how hard it is to be knocked out.
const BLAST = { left: -34, right: W + 34, top: -70, bottom: H + 46 };

/* ================================================================== helpers */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let bits = [];
function burst(x, y, n, colour, spread) {
  for (let i = 0; i < n; i++) {
    bits.push({ x, y, vx: rand(-spread, spread), vy: rand(-spread, spread * 0.7),
                life: rand(0.2, 0.55), colour });
  }
}

/* ================================================================= fighters */

function makeFighter(charId, index) {
  const c = byChar(charId);
  return {
    char: c.id, index,
    x: spawnAt(index).x, y: spawnAt(index).y, vx: 0, vy: 0, w: 8, h: 14,
    face: index === 0 ? 1 : -1,
    onGround: false,
    dmg: 0, stocks: 3,
    flaps: c.flaps, flapCool: 0, wing: 0,
    ammo: 4, reload: 0, cool: 0,
    atk: null, atkT: 0, hasHit: false,
    hitstun: 0, invuln: 1.2,
    shield: 1, blocking: false, broken: 0,
    // Item effects, counted down in seconds.
    buffAtk: 0, buffWing: 0,
    dead: 0,
  };
}

/* Every attack in one table. `reach` is how far in front the hitbox sits, and
 * `angle` is the direction the victim is launched, in turns clockwise from
 * straight right — so -0.25 is straight up. */
const MOVES = {
  jab:    { dmg: 5,  base: 62,  scale: 0.62, angle: -0.05, reach: 9,  w: 10, h: 9,  t: 0.22, act: 0.05, end: 0.12 },
  fan:    { dmg: 6,  base: 76,  scale: 0.70, angle: -0.25, reach: 0,  w: 12, h: 13, t: 0.32, act: 0.08, end: 0.20 },
  screw:  { dmg: 5,  base: 70,  scale: 0.66, angle: -0.24, reach: 0,  w: 10, h: 15, t: 0.28, act: 0.06, end: 0.18 },
  bounce: { dmg: 8,  base: 84,  scale: 0.74, angle: -0.26, reach: 0,  w: 14, h: 12, t: 0.36, act: 0.10, end: 0.24 },
  upper:  { dmg: 10, base: 96,  scale: 0.86, angle: -0.27, reach: 2,  w: 11, h: 16, t: 0.38, act: 0.10, end: 0.26 },
  drop:   { dmg: 7,  base: 74,  scale: 0.68, angle:  0.20, reach: 0,  w: 10, h: 11, t: 0.30, act: 0.06, end: 0.20 },
  kick:   { dmg: 6,  base: 66,  scale: 0.60, angle:  0.14, reach: 4,  w: 11, h: 10, t: 0.26, act: 0.05, end: 0.16 },
  pound:  { dmg: 11, base: 92,  scale: 0.80, angle:  0.24, reach: 0,  w: 16, h: 12, t: 0.40, act: 0.12, end: 0.28 },
  meteor: { dmg: 12, base: 104, scale: 0.88, angle:  0.25, reach: 0,  w: 12, h: 12, t: 0.42, act: 0.12, end: 0.30 },
};

function startAttack(f, name) {
  if (f.atk || f.hitstun > 0 || f.broken > 0) return;
  f.atk = name;
  f.atkT = 0;
  f.hasHit = false;
}

// Which move a fighter's ATTACK button produces, given what they are holding.
function chooseAttack(f, inp) {
  const c = byChar(f.char);
  if (inp.up) return c.up;
  if (inp.down && !f.onGround) return c.dive;
  return 'jab';
}

function hitboxOf(f) {
  const m = MOVES[f.atk];
  if (!m) return null;
  if (f.atkT < m.act || f.atkT > m.end) return null;
  const cx = f.x + f.w / 2 + f.face * m.reach;
  const cy = f.y + f.h / 2 + (m.angle > 0.1 ? 6 : m.angle < -0.15 ? -6 : 0);
  return { x: cx - m.w / 2, y: cy - m.h / 2, w: m.w, h: m.h };
}

/* The Smash formula, roughly: how far you fly depends on how hurt you already
 * are, and light fighters fly further. This is what makes a match get more
 * dangerous the longer it runs rather than just slowly draining. */
function applyHit(victim, attacker, m, mul) {
  const c = byChar(attacker.char);
  // Iron Fist multiplies the hit and the launch together, so it feels like
  // strength rather than like chip damage.
  const fist = attacker.buffAtk > 0 ? 1.75 : 1;
  const dmg = m.dmg * c.atk * (mul || 1) * fist;

  if (victim.blocking && victim.shield > 0) {
    victim.shield -= dmg / 46;
    victim.dmg += dmg * 0.18;                 // chip
    victim.vx += attacker.face * 26;
    burst(victim.x + 4, victim.y + 7, 5, '#8fd6ee', 40);
    if (victim.shield <= 0) {                 // shield break: wide open
      victim.shield = 0;
      victim.broken = 1.4;
      victim.blocking = false;
      burst(victim.x + 4, victim.y + 7, 18, '#ffffff', 90);
    }
    return;
  }

  victim.dmg += dmg;
  const wv = byChar(victim.char).weight;
  const kb = (m.base + victim.dmg * m.scale * 1.5) * fist / wv;
  const a = m.angle * Math.PI * 2;
  const dir = attacker.x + attacker.w / 2 <= victim.x + victim.w / 2 ? 1 : -1;

  victim.vx = Math.cos(a) * kb * dir;
  victim.vy = Math.sin(a) * kb;
  victim.hitstun = clamp(kb / 340, 0.14, 0.72);
  victim.atk = null;
  victim.invuln = 0;

  game.shake = Math.min(9, 3 + kb / 46);
  game.freeze = Math.min(0.09, 0.02 + kb / 3400);   // a beat of hitstop, for weight
  burst(victim.x + 4, victim.y + 7, 10, attacker.index === 0 ? '#ff5f6d' : '#7ce6ff', 70);
}

/* ================================================================ shuriken */

let stars = [];

function throwStar(f, inp) {
  if (f.cool > 0 || f.ammo <= 0 || f.hitstun > 0 || f.broken > 0) return;

  let ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let ay = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  if (!ax && !ay) ax = f.face;

  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;

  stars.push({
    x: f.x + f.w / 2 - 2 + ax * 6, y: f.y + f.h / 2 - 2 + ay * 6,
    vx: ax * 200, vy: ay * 200, w: 4, h: 4, spin: 0, life: 1.5, owner: f.index,
  });

  // The recoil this whole game is named after. Slightly stronger upward so a
  // downward throw really does read as a launch.
  const kick = 112;
  f.vx = clamp(f.vx - ax * kick, -190, 190);
  f.vy = clamp(f.vy - ay * (ay > 0 ? kick * 1.2 : kick * 0.7), -200, 250);

  f.ammo--;
  f.cool = 0.15;
  if (ax) f.face = ax > 0 ? 1 : -1;
  burst(f.x + 4, f.y + 7, 3, '#ffd0d4', 26);
}

/* ==================================================================== items */

/* Things that fall onto the stage mid-fight and go off the moment somebody
 * walks into them.
 *
 * Picking up is deliberately not a button. The pad is already full — four
 * directions and four verbs — and a fighting game that makes you stop and
 * press something to take an item turns a scramble into paperwork. Walk over
 * it and it is yours, which also means both players can race for it.
 *
 * The bomb is the reason that works: if everything on the floor were good,
 * running over things would be free. */
const ITEMS = [
  {
    id: 'stars', letter: 'S', name: 'STAR POUCH', colour: '#ffe9ec',
    say: 'STARS FULL',
    take(f) { f.ammo = 8; f.reload = 0; },
  },
  {
    id: 'mend', letter: 'M', name: 'MEND', colour: '#5ce08a',
    say: '-30%',
    take(f) { f.dmg = Math.max(0, f.dmg - 30); },
  },
  {
    id: 'wings', letter: 'W', name: 'WING CHARM', colour: '#9fc4e6',
    say: 'WINGS',
    take(f) { f.buffWing = 9; f.flaps = byChar(f.char).flaps + 2; },
  },
  {
    id: 'fist', letter: 'F', name: 'IRON FIST', colour: '#ff9d3d',
    say: 'IRON FIST',
    take(f) { f.buffAtk = 7; },
  },
  {
    id: 'bomb', letter: 'X', name: 'BOMB', colour: '#ff5f6d',
    say: 'BOMB!',
    take(f) {
      // Hurts the one who grabbed it, and throws them straight up so it reads
      // as a mistake rather than as damage from nowhere.
      f.dmg += 18;
      f.vy = -170;
      f.vx *= 0.4;
      f.hitstun = 0.35;
      game.shake = 8;
      burst(f.x + 4, f.y + 7, 20, '#ff9d3d', 96);
    },
  },
];

const ITEM_EVERY = 7.5;      // seconds between drops
const ITEM_LIFE = 13;        // how long one sits there before fading out

let items = [];
let itemTimer = ITEM_EVERY * 0.6;   // first one comes a little sooner

// Toast shown when somebody takes something, so the effect is legible.
let itemSay = '', itemSayT = 0, itemSayWho = 0;

function dropItem() {
  const kind = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  // Somewhere above the stage, but inside the walls so it does not just fall
  // straight out of play.
  const x = rand(40, W - 48);
  items.push({ id: kind.id, x, y: -10, vx: rand(-14, 14), vy: 20, w: 8, h: 8, life: ITEM_LIFE, rest: false });
}

function kindOf(id) { return ITEMS.find((i) => i.id === id) || ITEMS[0]; }

function stepItems() {
  if (game.items) {
    itemTimer -= STEP;
    if (itemTimer <= 0) { itemTimer = ITEM_EVERY; dropItem(); }
  }

  for (const it of items) {
    it.life -= STEP;

    if (!it.rest) {
      it.vy += 300 * STEP;
      it.x += it.vx * STEP;
      it.y += it.vy * STEP;
      it.vx *= 0.99;

      for (const p of platforms()) {
        if (it.x + it.w <= p.x || it.x >= p.x + p.w) continue;
        if (it.vy >= 0 && it.y + it.h >= p.y && it.y + it.h - it.vy * STEP <= p.y + 4) {
          it.y = p.y - it.h;
          it.vy = 0;
          it.vx = 0;
          it.rest = true;
        }
      }

      // Fell past everything. Gone.
      if (it.y > H + 40) it.life = 0;
    }

    // Taken.
    for (const f of game.fighters) {
      if (f.dead > 0 || it.life <= 0) continue;
      if (!overlap(it, f)) continue;
      const kind = kindOf(it.id);
      kind.take(f);
      it.life = 0;
      itemSay = kind.say;
      itemSayT = 1.3;
      itemSayWho = f.index;
      burst(it.x + 4, it.y + 4, 10, kind.colour, 60);
    }
  }

  items = items.filter((i) => i.life > 0);
  if (itemSayT > 0) itemSayT -= STEP;
}

function drawItems() {
  for (const it of items) {
    const k = kindOf(it.id);
    const x = Math.round(it.x), y = Math.round(it.y);

    // Blink out over the last second and a half so nobody is surprised.
    if (it.life < 1.5 && Math.floor(it.life * 10) % 2 === 0) continue;

    // A bob once it has settled, so a resting item does not read as scenery.
    const bob = it.rest ? Math.round(Math.sin(game.time * 4 + it.x) * 1) : 0;

    ctx.fillStyle = '#0a0208';
    ctx.fillRect(x, y + bob, 8, 8);
    ctx.fillStyle = k.colour;
    ctx.fillRect(x + 1, y + 1 + bob, 6, 6);
    drawText(k.letter, x + 3, y + 2 + bob, '#0a0208', 1);
  }
}

/* ================================================================== physics */

function stepFighter(f, inp) {
  const c = byChar(f.char);

  if (f.dead > 0) { f.dead -= STEP; return; }

  if (f.broken > 0) f.broken -= STEP;
  if (f.invuln > 0) f.invuln -= STEP;
  if (f.hitstun > 0) f.hitstun -= STEP;
  if (f.buffAtk > 0) f.buffAtk -= STEP;
  if (f.buffWing > 0) f.buffWing -= STEP;

  const free = f.hitstun <= 0 && f.broken <= 0;

  // Blocking locks you down; that is the trade for not being launched.
  f.blocking = free && !f.atk && Boolean(inp.block) && f.shield > 0 && f.onGround;
  if (f.blocking) {
    f.shield = Math.max(0, f.shield - STEP * 0.34);
    f.vx *= 0.72;
  } else if (f.shield < 1) {
    f.shield = Math.min(1, f.shield + STEP * 0.20);
  }

  if (free && !f.blocking) {
    const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const accel = (f.onGround ? 720 : 400) * c.speed;
    if (move && !f.atk) {
      f.vx += move * accel * STEP;
      f.face = move > 0 ? 1 : -1;
    } else if (f.onGround) {
      f.vx *= 0.80;
    } else {
      f.vx *= 0.986;
    }
    f.vx = clamp(f.vx, -106 * c.speed, 106 * c.speed);

    if (f.flapCool > 0) f.flapCool -= STEP;
    if (inp.flap && f.flaps > 0 && f.flapCool <= 0 && !f.atk) {
      f.vy = -132;
      f.flaps--;
      f.flapCool = 0.24;
      f.wing = 0.22;
      burst(f.x + 4, f.y + f.h, 5, '#bde3ff', 34);
    }

    if (inp.atk && !f.atk) startAttack(f, chooseAttack(f, inp));
    if (inp.star) throwStar(f, inp);
  } else {
    f.vx *= 0.99;
  }

  if (f.wing > 0) f.wing -= STEP;
  if (f.cool > 0) f.cool -= STEP;

  // The pouch fills fast on the ground and barely at all in the air, so long
  // flights have to end sometime.
  f.reload += STEP * (f.onGround ? 3.4 : 0.55);
  while (f.reload >= 1 && f.ammo < 4) { f.reload -= 1; f.ammo++; }
  if (f.ammo >= 4) f.reload = 0;

  if (f.atk) {
    f.atkT += STEP;
    const m = MOVES[f.atk];
    // A dive drags you down; an uppercut carries you up. The move moves you.
    if (f.atkT < m.end) {
      if (m.angle > 0.1 && !f.onGround) f.vy += 240 * STEP;
      if (m.angle < -0.2) f.vy -= 190 * STEP;
    }
    if (f.atkT >= m.t) { f.atk = null; f.atkT = 0; }
  }

  f.vy += (f.vy < 0 ? 300 : 430) * STEP;
  f.vy = clamp(f.vy, -260, 300);

  f.x += f.vx * STEP;
  f.y += f.vy * STEP;

  // Platforms are one-way: you land on them from above and jump up through.
  f.onGround = false;
  for (const p of platforms()) {
    if (f.x + f.w <= p.x || f.x >= p.x + p.w) continue;
    if (f.vy >= 0 && f.y + f.h >= p.y && f.y + f.h - f.vy * STEP <= p.y + 3) {
      f.y = p.y - f.h;
      f.vy = 0;
      f.onGround = true;
    }
  }

  // A Wing Charm is two extra beats for as long as it lasts.
  if (f.onGround) { f.flaps = c.flaps + (f.buffWing > 0 ? 2 : 0); }
}

function offStage(f) {
  return f.x + f.w < BLAST.left || f.x > BLAST.right ||
         f.y > BLAST.bottom || f.y + f.h < BLAST.top;
}

function loseStock(f) {
  f.stocks--;
  f.dmg = 0;
  f.dead = 0.9;
  f.vx = 0; f.vy = 0;
  f.atk = null; f.hitstun = 0; f.blocking = false; f.broken = 0;
  f.shield = 1;
  game.shake = 9;
  burst(clamp(f.x, 4, W - 4), clamp(f.y, 4, H - 4), 24,
        f.index === 0 ? '#ff5f6d' : '#7ce6ff', 110);
}

function respawn(f) {
  f.x = spawnAt(f.index).x; f.y = spawnAt(f.index).y;
  f.vx = 0; f.vy = 0;
  f.invuln = 1.4;
  f.flaps = byChar(f.char).flaps;
  f.ammo = 4;
}

/* =================================================================== state */


/* Changing screen throws away every latched press.
 *
 * Space is both "confirm" on a menu and player one's flap, so without this the
 * one tap that opened the character select also locked player one in before
 * they had chosen anybody. A single press should only ever do a single thing. */
function setState(s) {
  game.state = s;
  for (const k in tapped) tapped[k] = false;
  for (let i = 0; i < 2; i++) {
    const p = pad(i);
    for (const k in p) if (k.startsWith('t_')) p[k] = false;
  }
}
const game = {
  state: 'title',   // title, mode, select, stagepick, lobby, fight, over
  time: 0,
  shake: 0,
  freeze: 0,
  mode: 'local',    // local | online
  pick: [0, 1],     // roster index each side is hovering
  stage: 0,         // which map, an index into STAGE_LIST
  items: true,      // whether anything drops during a fight
  locked: [false, false],
  fighters: [],
  winner: -1,
  banner: 0,
  msg: '',
};

function startFight() {
  game.fighters = [
    makeFighter(ROSTER[game.pick[0]].id, 0),
    makeFighter(ROSTER[game.pick[1]].id, 1),
  ];
  stars = [];
  items = [];
  itemTimer = ITEM_EVERY * 0.6;
  itemSayT = 0;
  bits = [];
  game.winner = -1;
  game.banner = 1.4;
  setState('fight');
}

/* Player two's buttons come from a different place depending on the mode: the
 * other half of the keyboard, or the network. Everything downstream just reads
 * an input object, so the fighting code never learns which. */
function inputFor(i) {
  if (game.mode === 'online') {
    if (net.isHost) return i === 0 ? pad(0) : net.remoteInput;
    return i === 1 ? pad(0) : net.remoteInput;
  }
  return pad(i);
}

function stepFight() {
  if (game.banner > 0) game.banner -= STEP;

  const [a, b] = game.fighters;

  // A joiner does not simulate; it draws whatever the host last sent.
  if (game.mode === 'online' && !net.isHost) return;

  stepFighter(a, inputFor(0));
  stepFighter(b, inputFor(1));

  for (const f of game.fighters) {
    if (f.dead > 0) {
      if (f.dead <= STEP && f.stocks > 0) respawn(f);
      continue;
    }
    if (offStage(f)) loseStock(f);
  }

  // Melee.
  for (const f of game.fighters) {
    if (!f.atk || f.hasHit || f.dead > 0) continue;
    const box = hitboxOf(f);
    if (!box) continue;
    const o = game.fighters[1 - f.index];
    if (o.dead > 0 || o.invuln > 0) continue;
    if (overlap(box, o)) {
      f.hasHit = true;
      applyHit(o, f, MOVES[f.atk]);
    }
  }

  // Stars.
  for (const s of stars) {
    s.x += s.vx * STEP; s.y += s.vy * STEP; s.spin += STEP * 22; s.life -= STEP;
    if (s.x < -10 || s.x > W + 10 || s.y < -10 || s.y > H + 10) s.life = 0;
    const o = game.fighters[1 - s.owner];
    if (s.life > 0 && o.dead <= 0 && o.invuln <= 0 && overlap(s, o)) {
      s.life = 0;
      applyHit(o, game.fighters[s.owner],
               { dmg: 4, base: 48, scale: 0.42, angle: -0.06 });
    }
  }
  stars = stars.filter((s) => s.life > 0);

  stepItems();

  const dead = game.fighters.find((f) => f.stocks <= 0);
  if (dead) {
    game.winner = 1 - dead.index;
    setState('over');
    if (game.mode === 'online') netSend({ t: 'over', w: game.winner });
  }
}

/* ================================================================== netcode */

/* One side hosts and owns the simulation; the other sends its buttons and
 * mirrors what comes back. That is the same shape The 13 Dynasties uses, and it
 * is honest about what it costs: the joiner's inputs land a round trip late.
 * Between friends that is fine. It is not tournament netcode, and pretending
 * otherwise would just mean lying in the lobby text. */
const PEERJS_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I/O/0/1
const NET_HZ = 30;

const net = {
  on: false,
  isHost: false,
  code: '',
  peer: null,
  conn: null,
  remoteInput: {},
  accum: 0,
  status: '',
  ready: [false, false],
};

function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function loadPeerJs() {
  return new Promise((resolve, reject) => {
    if (window.Peer) return resolve();
    const s = document.createElement('script');
    s.src = PEERJS_SRC;
    s.onload = resolve;
    // Worth naming: school and guest wifi blocking the CDN is the single most
    // common way online fails here, and "undefined" would not help anyone.
    s.onerror = () => reject(new Error('Could not load the networking library. Some school and guest wifi blocks it — Same Keyboard always works.'));
    document.head.appendChild(s);
  });
}

function netSend(msg) {
  if (net.conn && net.conn.open) {
    try { net.conn.send(msg); } catch (e) { /* closing */ }
  }
}

function wireConn(c) {
  net.conn = c;
  c.on('open', () => {
    net.status = 'Connected';
    netSend({ t: 'hello', pick: net.isHost ? game.pick[0] : game.pick[1] });
  });
  c.on('data', onNetMessage);
  const drop = () => {
    net.status = 'The other player left.';
    net.conn = null;
    if (game.state === 'fight') { setState('over'); game.winner = -2; }
  };
  c.on('close', drop);
  c.on('error', drop);
}

async function hostGame() {
  try { await loadPeerJs(); } catch (e) { net.status = e.message; return; }
  net.on = true; net.isHost = true;
  net.code = makeCode();
  net.status = 'Waiting for a challenger…';
  setState('lobby');

  net.peer = new window.Peer('nww-' + net.code);
  net.peer.on('error', (err) => {
    const t = err && err.type;
    net.status = t === 'unavailable-id'
      ? 'That code is taken — go back and host again.'
      : 'Connection problem: ' + (t || 'unknown');
  });
  net.peer.on('connection', (c) => {
    if (net.conn) { try { c.close(); } catch (e) {} return; }   // one challenger
    wireConn(c);
  });
}

async function joinGame(code) {
  try { await loadPeerJs(); } catch (e) { net.status = e.message; return; }
  net.on = true; net.isHost = false;
  net.code = code;
  net.status = 'Knocking…';
  setState('lobby');

  net.peer = new window.Peer();
  net.peer.on('error', (err) => {
    const t = err && err.type;
    net.status = t === 'peer-unavailable'
      ? 'Nobody is hosting with that code.'
      : 'Connection problem: ' + (t || 'unknown');
  });
  net.peer.on('open', () => wireConn(net.peer.connect('nww-' + code, { reliable: false })));
}

function netQuit() {
  try { if (net.conn) net.conn.close(); } catch (e) {}
  try { if (net.peer) net.peer.destroy(); } catch (e) {}
  net.on = false; net.conn = null; net.peer = null;
  net.ready = [false, false];
  net.status = '';
}

function onNetMessage(m) {
  if (!m || typeof m !== 'object') return;

  if (m.t === 'hello' || m.t === 'pick') {
    game.pick[net.isHost ? 1 : 0] = clamp(m.pick | 0, 0, ROSTER.length - 1);
  } else if (m.t === 'ready') {
    net.ready[net.isHost ? 1 : 0] = Boolean(m.v);
  } else if (m.t === 'start') {
    game.pick[0] = clamp(m.p0 | 0, 0, ROSTER.length - 1);
    game.pick[1] = clamp(m.p1 | 0, 0, ROSTER.length - 1);
    // The host owns the map and the items switch; take theirs, not ours.
    game.stage = clamp(m.st | 0, 0, STAGE_LIST.length - 1);
    game.items = Boolean(m.it);
    startFight();
  } else if (m.t === 'input') {
    net.remoteInput = m.i || {};
  } else if (m.t === 'state') {
    applyState(m);
  } else if (m.t === 'over') {
    game.winner = m.w;
    setState('over');
  }
}

// The whole match in one small object. Two fighters and a handful of stars is
// little enough that sending all of it 30 times a second beats being clever.
function snapshot() {
  return {
    t: 'state',
    f: game.fighters.map((f) => ({
      c: f.char, x: Math.round(f.x), y: Math.round(f.y),
      vx: Math.round(f.vx), vy: Math.round(f.vy),
      d: Math.round(f.dmg), s: f.stocks, fa: f.face,
      a: f.atk, at: +f.atkT.toFixed(2), b: f.blocking ? 1 : 0,
      sh: +f.shield.toFixed(2), iv: +f.invuln.toFixed(2),
      de: +f.dead.toFixed(2), am: f.ammo, fl: f.flaps, hs: +f.hitstun.toFixed(2),
      br: +f.broken.toFixed(2), wg: +f.wing.toFixed(2),
      ba: +f.buffAtk.toFixed(1), bw: +f.buffWing.toFixed(1),
    })),
    s: stars.map((s) => [Math.round(s.x), Math.round(s.y), s.owner]),
    // Items are the host's to spawn and to hand out, same as everything else.
    it: items.map((i) => [Math.round(i.x), Math.round(i.y), i.id, +i.life.toFixed(1)]),
  };
}

function applyState(m) {
  if (!m.f || m.f.length !== 2) return;
  for (let i = 0; i < 2; i++) {
    const src = m.f[i];
    let f = game.fighters[i];
    if (!f) { f = game.fighters[i] = makeFighter(src.c, i); }
    f.char = src.c;
    f.x = src.x; f.y = src.y; f.vx = src.vx; f.vy = src.vy;
    f.dmg = src.d; f.stocks = src.s; f.face = src.fa;
    f.atk = src.a; f.atkT = src.at; f.blocking = !!src.b;
    f.shield = src.sh; f.invuln = src.iv; f.dead = src.de;
    f.ammo = src.am; f.flaps = src.fl; f.hitstun = src.hs;
    f.broken = src.br; f.wing = src.wg;
    f.buffAtk = src.ba || 0; f.buffWing = src.bw || 0;
  }
  stars = (m.s || []).map(([x, y, o]) => ({ x, y, w: 4, h: 4, spin: x + y, life: 1, owner: o }));
  items = (m.it || []).map(([x, y, id, life]) => ({ x, y, w: 8, h: 8, id, life, rest: true }));
}

function stepNet() {
  if (!net.on || !net.conn || !net.conn.open) return;
  net.accum += STEP;
  if (net.accum < 1 / NET_HZ) return;
  net.accum = 0;

  if (game.state === 'fight') {
    if (net.isHost) netSend(snapshot());
    else {
      const s = pad(0);
      netSend({ t: 'input', i: {
        left: !!s.left, right: !!s.right, up: !!s.up, down: !!s.down,
        atk: !!s.atk, star: !!s.star, block: !!s.block, flap: !!s.flap,
      } });
    }
  }
}

/* ============================================================== room code UI */

const codeBox = document.getElementById('codebox');
const codeInput = document.getElementById('code');
const codeMsg = document.getElementById('code-msg');
let codeOpen = false;

function openCodeBox() {
  codeOpen = true;
  codeBox.hidden = false;
  codeInput.value = '';
  codeMsg.textContent = '';
  codeInput.focus();
}
function closeCodeBox() {
  codeOpen = false;
  codeBox.hidden = true;
  codeInput.blur();
}

document.getElementById('code-go').addEventListener('click', () => {
  const v = codeInput.value.trim().toUpperCase();
  if (v.length < 4) { codeMsg.textContent = 'Codes are four characters.'; return; }
  closeCodeBox();
  joinGame(v);
});
document.getElementById('code-cancel').addEventListener('click', () => {
  closeCodeBox();
  setState('mode');
});
codeInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') document.getElementById('code-go').click();
  if (e.key === 'Escape') { closeCodeBox(); setState('mode'); }
});

/* =================================================================== menus */

const MODES = [
  { id: 'local',  name: 'SAME KEYBOARD', sub: 'Two players, one computer' },
  { id: 'host',   name: 'HOST A MATCH',  sub: 'Get a code, read it out' },
  { id: 'join',   name: 'JOIN A MATCH',  sub: 'Type a friend\'s code' },
];
let modeIdx = 0;

function stepMenus() {
  const ok = tookMenu('ok');
  const back = tookMenu('back');
  const left = tookMenu('left');
  const right = tookMenu('right');
  const up = tookMenu('up');
  const down = tookMenu('down');

  if (game.state === 'title') {
    if (ok) setState('mode');
    return;
  }

  if (game.state === 'mode') {
    if (up) modeIdx = (modeIdx + MODES.length - 1) % MODES.length;
    if (down) modeIdx = (modeIdx + 1) % MODES.length;
    if (back) setState('title');
    if (ok) {
      const m = MODES[modeIdx];
      if (m.id === 'local') {
        game.mode = 'local';
        game.locked = [false, false];
        setState('select');
      } else if (m.id === 'host') {
        game.mode = 'online';
        hostGame();
      } else {
        game.mode = 'online';
        openCodeBox();
      }
    }
    return;
  }

  if (game.state === 'lobby') {
    if (back) { netQuit(); setState('mode'); return; }
    if (net.conn && net.conn.open) {
      game.locked = [false, false];
      setState('select');
    }
    return;
  }

  if (game.state === 'select') {
    if (back) {
      if (game.mode === 'online') netQuit();
      setState('mode');
      return;
    }

    if (game.mode === 'online') {
      const me = net.isHost ? 0 : 1;
      if (left)  { game.pick[me] = (game.pick[me] + ROSTER.length - 1) % ROSTER.length; netSend({ t: 'pick', pick: game.pick[me] }); }
      if (right) { game.pick[me] = (game.pick[me] + 1) % ROSTER.length; netSend({ t: 'pick', pick: game.pick[me] }); }
      if (ok && !game.locked[me]) {
        game.locked[me] = true;
        net.ready[me] = true;
        netSend({ t: 'ready', v: true });
      }
      // The host picks the map, so the two sides cannot choose different ones.
      if (net.ready[0] && net.ready[1]) setState(net.isHost ? 'stagepick' : 'waiting');
      return;
    }

    // Same keyboard: each side drives its own half with its own buttons.
    for (let i = 0; i < 2; i++) {
      if (game.locked[i]) continue;
      if (took(i, 'left'))  game.pick[i] = (game.pick[i] + ROSTER.length - 1) % ROSTER.length;
      if (took(i, 'right')) game.pick[i] = (game.pick[i] + 1) % ROSTER.length;
      if (took(i, 'atk') || took(i, 'flap')) game.locked[i] = true;
    }
    if (game.locked[0] && game.locked[1]) setState('stagepick');
    return;
  }

  /* Left and right walk the maps, up and down turn items on and off. Online,
   * only the host gets this screen — the other side sits on 'waiting' until
   * the start message arrives, so the two can never disagree about the map. */
  if (game.state === 'stagepick') {
    if (back) {
      game.locked = [false, false];
      net.ready = [false, false];
      if (game.mode === 'online') netSend({ t: 'ready', v: false });
      setState('select');
      return;
    }
    if (left)  game.stage = (game.stage + STAGE_LIST.length - 1) % STAGE_LIST.length;
    if (right) game.stage = (game.stage + 1) % STAGE_LIST.length;
    if (up || down) game.items = !game.items;
    if (ok) {
      if (game.mode === 'online') {
        netSend({ t: 'start', p0: game.pick[0], p1: game.pick[1],
                  st: game.stage, it: game.items });
      }
      startFight();
    }
    return;
  }

  if (game.state === 'waiting') {
    if (back) { netQuit(); setState('mode'); }
    return;
  }

  if (game.state === 'over') {
    if (ok || back) {
      if (game.mode === 'online') { netQuit(); setState('mode'); }
      else { game.locked = [false, false]; setState('select'); }
    }
    return;
  }
}

/* ================================================================== drawing */

/* Draws a fighter from their 14x14 grid in fighters.js.
 *
 * The sprite is authored facing right and mirrored when they turn, so nobody
 * has to draw the same ninja twice. The body sits in the middle eight columns,
 * which is why the grid is pinned three columns left of the collision box. */
const SPR_W = 14, SPR_OFF = 3;

function drawSpriteAt(c, px, py, face) {
  const rows = c.sprite || [];
  const pal = c.palette || [];
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < SPR_W; rx++) {
      const ch = row[face < 0 ? SPR_W - 1 - rx : rx];
      if (!ch || ch === '.') continue;
      const colour = pal[+ch];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(px - SPR_OFF + rx, py + ry, 1, 1);
    }
  }
}

function drawFighterSprite(f) {
  const c = byChar(f.char);
  const x = Math.round(f.x), y = Math.round(f.y);

  if (f.dead > 0) return;
  if (f.invuln > 0 && Math.floor(f.invuln * 18) % 2 === 0) return;

  drawSpriteAt(c, x, y, f.face);

  // Shield: a bubble you can watch shrink.
  if (f.blocking) {
    const r = 7 + f.shield * 4;
    ctx.strokeStyle = 'rgba(143,214,238,' + (0.35 + f.shield * 0.5) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 4, y + 7, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (f.broken > 0) drawText('!', x + 3, y - 7, '#ffffff', 1);

  // The attack, as a flash where the hitbox actually is.
  const box = hitboxOf(f);
  if (box) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(Math.round(box.x), Math.round(box.y), box.w, 1);
    ctx.fillRect(Math.round(box.x), Math.round(box.y + box.h - 1), box.w, 1);
    ctx.fillStyle = c.colour;
    ctx.fillRect(Math.round(box.x), Math.round(box.y + 1), box.w, box.h - 2);
  }
}

function drawStage() {
  const s = stage();

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, s.sky[0]);
  g.addColorStop(1, s.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (s.moon) {
    ctx.fillStyle = '#f5d9a8';
    ctx.beginPath();
    ctx.arc(s.moon.x, s.moon.y, s.moon.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of s.platforms) {
    ctx.fillStyle = s.ink;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = s.lip;
    ctx.fillRect(p.x, p.y, p.w, 2);
  }
}

function drawHud() {
  for (let i = 0; i < 2; i++) {
    const f = game.fighters[i];
    if (!f) continue;
    const c = byChar(f.char);
    const x = i === 0 ? 8 : W - 8;
    const al = i === 0 ? 'left' : 'right';

    drawText(c.name, x, 6, c.colour, 1, al);
    // Damage reddens as it climbs, so you can read the danger without the number.
    const heat = clamp(f.dmg / 150, 0, 1);
    const col = `rgb(${Math.round(244 - heat * 10)},${Math.round(233 - heat * 150)},${Math.round(236 - heat * 160)})`;
    drawText(Math.round(f.dmg) + '%', x, 14, col, 2, al);

    // Whatever they picked up, as a lit pip beside the stocks.
    let bx = i === 0 ? x : x - 3;
    if (f.buffAtk > 0) { ctx.fillStyle = '#ff9d3d'; ctx.fillRect(i === 0 ? x + 40 : x - 43, 26, 3, 3); }
    if (f.buffWing > 0) { ctx.fillStyle = '#9fc4e6'; ctx.fillRect(i === 0 ? x + 45 : x - 48, 26, 3, 3); }

    for (let s = 0; s < f.stocks; s++) {
      const sx = i === 0 ? x + s * 5 : x - 3 - s * 5;
      ctx.fillStyle = c.colour;
      ctx.fillRect(sx, 26, 3, 3);
    }
  }
}

function drawSelect() {
  drawStage();
  ctx.fillStyle = 'rgba(5,7,12,0.72)';
  ctx.fillRect(0, 0, W, H);

  drawTextShadow('CHOOSE YOUR NINJA', W / 2, 10, '#ffe9ec', 2, 'center');

  for (let i = 0; i < ROSTER.length; i++) {
    const c = ROSTER[i];
    const cx = Math.round(W * (i + 1) / (ROSTER.length + 1));
    const chosen = [game.pick[0] === i, game.pick[1] === i];

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(cx - 22, 30, 44, 52);
    if (chosen[0] || chosen[1]) {
      ctx.strokeStyle = chosen[0] ? '#ff5f6d' : '#7ce6ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 22.5, 29.5, 45, 53);
    }

    const dummy = { char: c.id, x: cx - 4, y: 40, w: 8, h: 14, face: 1,
                    wing: 0, dead: 0, invuln: 0, blocking: false, broken: 0,
                    atk: null, atkT: 0 };
    drawFighterSprite(dummy);

    drawText(c.name, cx, 60, c.colour, 1, 'center');
    drawText('WT ' + c.weight.toFixed(2), cx, 68, '#9a8d95', 1, 'center');
    drawText('FLAP ' + c.flaps, cx, 75, '#9a8d95', 1, 'center');
  }

  // Whoever each side is hovering, spelled out underneath.
  for (let i = 0; i < 2; i++) {
    const c = ROSTER[game.pick[i]];
    const x = i === 0 ? 8 : W - 8;
    const al = i === 0 ? 'left' : 'right';
    const mine = game.mode === 'online' && (net.isHost ? i === 0 : i === 1);
    drawText((i === 0 ? 'P1' : 'P2') + (mine ? ' (YOU)' : ''), x, 92, '#c58b9a', 1, al);
    drawText(c.name, x, 100, c.colour, 1, al);
    drawText(c.tag, x, 108, '#9a8d95', 1, al);
    drawText(game.locked[i] ? 'READY' : '...', x, 118, game.locked[i] ? '#5ce08a' : '#6b5a63', 1, al);
  }

  drawText(ROSTER[game.pick[0]].hint, W / 2, 132, '#7d6b75', 1, 'center');

  if (game.mode === 'online') {
    drawText('LEFT / RIGHT TO CHOOSE, F TO LOCK IN', W / 2, 148, '#c58b9a', 1, 'center');
    drawText('WAITING FOR THE OTHER PLAYER', W / 2, 158,
             game.locked[net.isHost ? 0 : 1] ? '#ffe9ec' : '#4a3b43', 1, 'center');
  } else {
    drawText('P1  A/D THEN F', W / 2 - 60, 150, '#c58b9a', 1, 'center');
    drawText('P2  ARROWS THEN K', W / 2 + 60, 150, '#c58b9a', 1, 'center');
  }
}

/* A small picture of each map rather than its name alone — the shape of the
 * platforms is the only thing that actually matters about a stage. */
function drawStageThumb(s, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, s.sky[0]);
  g.addColorStop(1, s.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const sx = w / W, sy = h / H;
  for (const p of s.platforms) {
    ctx.fillStyle = s.lip;
    ctx.fillRect(
      Math.round(x + p.x * sx), Math.round(y + p.y * sy),
      Math.max(1, Math.round(p.w * sx)), Math.max(1, Math.round(p.h * sy))
    );
  }
}

function drawStagePick() {
  drawStage();
  ctx.fillStyle = 'rgba(5,7,12,0.78)';
  ctx.fillRect(0, 0, W, H);

  drawTextShadow('PICK A MAP', W / 2, 10, '#ffe9ec', 2, 'center');

  const tw = 62, th = 36;
  for (let i = 0; i < STAGE_LIST.length; i++) {
    const s = STAGE_LIST[i];
    const cx = Math.round(W * (i + 1) / (STAGE_LIST.length + 1));
    const x = cx - tw / 2, y = 30;

    drawStageThumb(s, x, y, tw, th);

    if (i === game.stage) {
      ctx.strokeStyle = '#ff5f6d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, tw + 3, th + 3);
    }
    drawText(s.name, cx, y + th + 5, i === game.stage ? '#ffe9ec' : '#7d6b75', 1, 'center');
  }

  drawText(stage().tag, W / 2, 84, '#c58b9a', 1, 'center');

  // The items switch.
  const on = game.items;
  ctx.fillStyle = on ? 'rgba(92,224,138,0.16)' : 'rgba(255,255,255,0.04)';
  ctx.fillRect(W / 2 - 52, 100, 104, 18);
  ctx.strokeStyle = on ? '#5ce08a' : '#3a2030';
  ctx.lineWidth = 1;
  ctx.strokeRect(W / 2 - 52.5, 99.5, 105, 19);
  drawText('ITEMS  ' + (on ? 'ON' : 'OFF'), W / 2, 106, on ? '#5ce08a' : '#7d6b75', 2, 'center');

  drawText('LEFT / RIGHT  MAP', W / 2, 130, '#8b7680', 1, 'center');
  drawText('UP / DOWN  ITEMS', W / 2, 140, '#8b7680', 1, 'center');
  drawText('ENTER TO FIGHT', W / 2, 154, '#ffe9ec', 1, 'center');
  drawText('ESC TO GO BACK', W / 2, 166, '#5b3a4a', 1, 'center');
}

function drawWaiting() {
  drawStage();
  ctx.fillStyle = 'rgba(5,7,12,0.8)';
  ctx.fillRect(0, 0, W, H);
  drawTextShadow('READY', W / 2, 54, '#ffe9ec', 3, 'center');
  drawText('THE HOST IS PICKING THE MAP', W / 2, 90, '#c58b9a', 1, 'center');
  if (Math.floor(game.time * 2) % 2 === 0) {
    drawText('HANG ON', W / 2, 106, '#7d6b75', 1, 'center');
  }
  drawText('ESC TO LEAVE', W / 2, H - 12, '#5b3a4a', 1, 'center');
}

function drawLobby() {
  drawStage();
  ctx.fillStyle = 'rgba(5,7,12,0.8)';
  ctx.fillRect(0, 0, W, H);

  if (net.isHost) {
    drawText('YOUR ROOM CODE', W / 2, 40, '#c58b9a', 1, 'center');
    drawTextShadow(net.code || '....', W / 2, 54, '#ffe9ec', 5, 'center');
    drawText('READ IT OUT TO A FRIEND', W / 2, 96, '#9a8d95', 1, 'center');
  } else {
    drawTextShadow('JOINING', W / 2, 54, '#ffe9ec', 3, 'center');
    drawText(net.code || '', W / 2, 82, '#c58b9a', 2, 'center');
  }

  // Long messages have to wrap or they run off a 320px stage.
  const words = String(net.status || '').toUpperCase().split(' ');
  let line = '', y = 116;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (textWidth(test, 1) > W - 24) { drawText(line, W / 2, y, '#c58b9a', 1, 'center'); y += 8; line = word; }
    else line = test;
  }
  if (line) drawText(line, W / 2, y, '#c58b9a', 1, 'center');

  drawText('ESC TO GO BACK', W / 2, H - 12, '#5b3a4a', 1, 'center');
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);

  if (game.shake > 0) {
    ctx.translate(Math.round(rand(-game.shake, game.shake)),
                  Math.round(rand(-game.shake, game.shake)));
  }

  if (game.state === 'title') {
    drawStage();
    ctx.fillStyle = 'rgba(5,7,12,0.62)';
    ctx.fillRect(0, 0, W, H);
    drawTextShadow('NINJA', W / 2, 26, '#ff5f6d', 4, 'center');
    drawTextShadow('WING WING', W / 2, 52, '#ffe9ec', 3, 'center');
    drawText('THROW FIRST, LAND LATER', W / 2, 78, '#c58b9a', 1, 'center');
    drawText('EVERY STAR SHOVES YOU BACK.', W / 2, 96, '#f4e9ec', 1, 'center');
    drawText('THROW DOWN TO GO UP.', W / 2, 106, '#f4e9ec', 1, 'center');
    drawText('KNOCK THEM OFF THE STAGE.', W / 2, 116, '#f4e9ec', 1, 'center');
    if (Math.floor(game.time * 2) % 2 === 0) {
      drawText('PRESS ENTER', W / 2, 140, '#ffe9ec', 1, 'center');
    }
    drawText('THIRSTY BEAR STUDIOS', W / 2, H - 10, '#5b3a4a', 1, 'center');
    return;
  }

  if (game.state === 'mode') {
    drawStage();
    ctx.fillStyle = 'rgba(5,7,12,0.76)';
    ctx.fillRect(0, 0, W, H);
    drawTextShadow('HOW ARE YOU PLAYING', W / 2, 22, '#ffe9ec', 2, 'center');
    for (let i = 0; i < MODES.length; i++) {
      const on = i === modeIdx;
      const y = 56 + i * 28;
      if (on) {
        ctx.fillStyle = 'rgba(255,95,109,0.16)';
        ctx.fillRect(40, y - 6, W - 80, 22);
        drawText('>', 46, y + 1, '#ff5f6d', 1);
      }
      drawText(MODES[i].name, W / 2, y - 2, on ? '#ffe9ec' : '#8b7680', 2, 'center');
      drawText(MODES[i].sub, W / 2, y + 10, on ? '#c58b9a' : '#5b4a52', 1, 'center');
    }
    drawText('W/S OR ARROWS, THEN ENTER', W / 2, H - 12, '#5b3a4a', 1, 'center');
    return;
  }

  if (game.state === 'lobby') { drawLobby(); return; }
  if (game.state === 'select') { drawSelect(); return; }
  if (game.state === 'stagepick') { drawStagePick(); return; }
  if (game.state === 'waiting') { drawWaiting(); return; }

  // Fight, and the result screen drawn over it.
  drawStage();

  for (const b of bits) {
    ctx.fillStyle = b.colour;
    ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
  }

  for (const s of stars) {
    const cx = Math.round(s.x + 2), cy = Math.round(s.y + 2);
    ctx.fillStyle = '#ffe9ec';
    if (Math.floor(s.spin) % 2 === 0) {
      ctx.fillRect(cx - 2, cy, 4, 1); ctx.fillRect(cx, cy - 2, 1, 4);
    } else {
      ctx.fillRect(cx - 2, cy - 2, 2, 2); ctx.fillRect(cx, cy, 2, 2);
    }
  }


  drawItems();
  for (const f of game.fighters) drawFighterSprite(f);
  drawHud();

  if (game.banner > 0) drawTextShadow("FIGHT", W / 2, 70, "#ffe9ec", 4, "center");

  // What the last item did, over whoever took it.
  if (itemSayT > 0) {
    const f = game.fighters[itemSayWho];
    if (f) drawTextShadow(itemSay, clamp(f.x + 4, 30, W - 30), Math.max(8, f.y - 12),
                          itemSayWho === 0 ? "#ff5f6d" : "#7ce6ff", 1, "center");
  }

  if (game.state === 'over') {
    ctx.fillStyle = 'rgba(5,7,12,0.76)';
    ctx.fillRect(0, 0, W, H);
    if (game.winner === -2) {
      drawTextShadow('DISCONNECTED', W / 2, 60, '#ff5f6d', 3, 'center');
    } else {
      const c = byChar(ROSTER[game.pick[game.winner]].id);
      drawTextShadow(c.name + ' WINS', W / 2, 60, c.colour, 3, 'center');
    }
    if (Math.floor(game.time * 2) % 2 === 0) {
      drawText('PRESS ENTER', W / 2, 110, '#ffe9ec', 1, 'center');
    }
  }
}

/* ==================================================================== loop */

function step() {
  game.time += STEP;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - STEP * 40);

  for (const b of bits) { b.x += b.vx * STEP; b.y += b.vy * STEP; b.vy += 150 * STEP; b.life -= STEP; }
  bits = bits.filter((b) => b.life > 0);

  stepMenus();
  stepNet();

  if (game.state === 'fight') stepFight();
}

let last = performance.now(), acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;        // came back from a hidden tab; do not fast-forward
  acc += dt;

  // Hitstop: a couple of frames where nothing moves, so a big hit has weight.
  if (game.freeze > 0) { game.freeze -= dt; acc = Math.min(acc, STEP); }
  else {
    let guard = 0;
    while (acc >= STEP && guard++ < 6) { step(); acc -= STEP; }
  }

  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
})();
