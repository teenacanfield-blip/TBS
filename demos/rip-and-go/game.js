/* Pokémon Rip and Go — a fan-made creature-collecting RPG.
 *
 * You wake up in a town with one road out of it. A professor gives you one of
 * three, a boy your age takes the one that beats it, and from there it is the
 * oldest loop there is: walk into the long grass, find something, weaken it,
 * throw a ball, keep it, and take the six you trust into a building where
 * somebody is waiting to find out whether you were paying attention.
 *
 * ------------------------------------------------------------------ files
 *
 *   dex.js      thirty-three creatures: art, types, stats, learnsets, evolution
 *   folks.js    the people: four bodies, fourteen faces, six frames each
 *   world.js    every map, every door, everyone standing in one
 *   art.js      the font, the tiles, the baking, the cards
 *   sprites.js  your own PNG sheets, and which frame is which creature
 *   sound.js    oscillators, no files
 *   lab.html    the Sprite Lab — the one page in here with real buttons
 *
 * Nothing is fetched. The whole game runs from a file:// address with the wifi
 * off, which is the standard the rest of this folder is held to.
 *
 * -------------------------------------------------------------- the fight
 *
 * Damage is the genre's own arithmetic, kept honest: level and power and the
 * ratio of attack to defence, then same-type bonus, then the chart, then a
 * roll between 0.85 and 1. Speed decides who goes first unless a move has
 * priority. Four moves, each with its own PP, which is what makes the walk
 * between two towns a resource problem rather than a corridor.
 */
(function () {
'use strict';

const W = 384, H = 216;
const TS = 16;                             // one tile, in pixels
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

/* Pixel perfect, and meant literally: one game pixel has to land on a whole
 * number of the screen's own pixels, or the art shimmers and the 3x5 font goes
 * to mush. So the scale is chosen in *device* pixels and divided back down —
 * on a 2x display that allows 1.5x and still keeps every edge on a real
 * boundary, which plain integer CSS scaling would throw away. */
function fit() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const want = Math.min(Math.max(80, innerWidth) / W, Math.max(60, innerHeight) / H);
  const s = want >= 1 ? Math.max(1, Math.floor(want * dpr)) / dpr : want;
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
document.addEventListener('webkitfullscreenchange', fit);
fit();

const STEP = 1 / 60;
const R = Math.round;

const txt = (s, x, y, c, sc, al) => Art.text(ctx, s, x, y, c, sc, al);
const txs = (s, x, y, c, sc, al) => Art.textShadow(ctx, s, x, y, c, sc, al);
const box = (x, y, w, h, c) => Art.box(ctx, x, y, w, h, c);
const panel = (x, y, w, h, f, e) => Art.panel(ctx, x, y, w, h, f, e);
const frame = (x, y, w, h, c) => Art.frame(ctx, x, y, w, h, c);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Everything random in the game goes through one source, so that one source
 * can be swapped for a seeded one while a pack is being torn open and put
 * back the moment it is done. That is the whole mechanism behind two people
 * opening the same eight cards on two different machines. */
let rngSource = Math.random;
const rand = () => rngSource();
const rnd = (n) => Math.floor(rand() * n);
const pick = (a) => a[rnd(a.length)];
const chance = (pct) => rand() * 100 < pct;

/* Runs fn with the dice replaced. Restores them even if fn throws, because a
 * game left running on a seeded generator would repeat itself forever. */
function withSeed(seed, fn) {
  const prev = rngSource;
  rngSource = Codes.rng(seed);
  try { return fn(); } finally { rngSource = prev; }
}

/* ==================================================================== input */

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
const PRESSMAP = {
  Enter: 'ok', Space: 'ok', KeyZ: 'ok', KeyJ: 'ok',
  Escape: 'back', Backspace: 'back', KeyX: 'back', KeyK: 'back',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Tab: 'start', KeyQ: 'start',
};

const held = {};
const tap = {};

function eat(k) { const v = !!tap[k]; tap[k] = false; return v; }

addEventListener('keydown', (e) => {
  Sound.unlock();
  if (e.code === 'KeyM') { muteFlash = 1.2; Sound.toggleMute(); e.preventDefault(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); e.preventDefault(); return; }
  let used = false;
  const h = KEYMAP[e.code];
  if (h) { held[h] = true; used = true; }
  const p = PRESSMAP[e.code];
  if (p) { if (!e.repeat) tap[p] = true; used = true; }
  if (used) e.preventDefault();
});

addEventListener('keyup', (e) => {
  const h = KEYMAP[e.code];
  if (h) held[h] = false;
});

/* Touch. The same six buttons drive every screen, which is the only reason a
 * game with this many menus fits on a phone at all. */
(function touchSetup() {
  const pad = document.getElementById('touch');
  if (!pad) return;
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine || 'ontouchstart' in window) document.body.classList.add('touch');
  pad.querySelectorAll('button').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => {
      e.preventDefault();
      Sound.unlock();
      b.classList.add('on');
      held[k] = true;
      tap[k] = true;
    };
    const off = (e) => {
      e.preventDefault();
      b.classList.remove('on');
      held[k] = false;
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });
})();

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  } catch (e) { /* not allowed here, never mind */ }
}

let muteFlash = 0;

/* ==================================================================== items */

const ITEMS = {
  'BALL':         { name: 'BALL', kind: 'ball', mult: 1, cost: 200,
    blurb: 'Throws at a wild one. Works better on a hurt one.' },
  'GREAT BALL':   { name: 'GREAT BALL', kind: 'ball', mult: 1.5, cost: 600,
    blurb: 'A better ball, and it shows on the shakes.' },
  'ULTRA BALL':   { name: 'ULTRA BALL', kind: 'ball', mult: 2, cost: 1200,
    blurb: 'The best one anybody sells.' },
  'POTION':       { name: 'POTION', kind: 'heal', amount: 20, cost: 300,
    blurb: 'Puts back 20 HP.' },
  'SUPER POTION': { name: 'SUPER POTION', kind: 'heal', amount: 50, cost: 700,
    blurb: 'Puts back 50 HP.' },
  'FULL RESTORE': { name: 'FULL RESTORE', kind: 'heal', amount: 999, cure: true, cost: 2500,
    blurb: 'All of it, and whatever it had.' },
  'REMEDY':       { name: 'REMEDY', kind: 'cure', cost: 250,
    blurb: 'Clears burn, poison, sleep or a paralysis.' },
  'REVIVE':       { name: 'REVIVE', kind: 'revive', cost: 1500,
    blurb: 'Brings one back at half health.' },
};

const SHOPS = {
  basic: ['BALL', 'POTION', 'REMEDY'],
  /* The Emberside shop is behind two badges, which is where the best ball
   * belongs: it existed in the item table from the start and nothing sold
   * it, so the best ball in the game was unobtainable. */
  good: ['BALL', 'GREAT BALL', 'ULTRA BALL', 'POTION', 'SUPER POTION', 'REMEDY', 'REVIVE'],
};

/* ==================================================================== packs */
/* The card shop from the old build, kept because a shop that sells luck is a
 * good thing to have in a town. A pack is opened, five are kept, the rest are
 * torn up for coin. What you keep walks out as a real creature. */

const PACKS = {
  scrub: { id: 'scrub', name: 'SCRUB PACK', cost: 400, cards: 5, floor: null, tier: 0,
    colour: '#b0bec5', shiny: 70, level: [5, 10],
    odds: { common: 79, uncommon: 17, rare: 3.6, epic: 0.4, legend: 0 },
    blurb: 'Five cards. Mostly what you already have.' },
  field: { id: 'field', name: 'FIELD PACK', cost: 1100, cards: 6, floor: 'uncommon', tier: 1,
    colour: '#66bb6a', shiny: 60, level: [12, 20],
    odds: { common: 61, uncommon: 29, rare: 8.5, epic: 1.4, legend: 0.1 },
    blurb: 'Six cards, one of them uncommon at worst.' },
  foil: { id: 'foil', name: 'FOIL PACK', cost: 2600, cards: 7, floor: 'rare', tier: 2,
    colour: '#42a5f5', shiny: 44, level: [22, 30],
    odds: { common: 43, uncommon: 34, rare: 19, epic: 3.6, legend: 0.4 },
    blurb: 'Seven cards and a rare you can count on.' },
  prism: { id: 'prism', name: 'PRISM PACK', cost: 6000, cards: 8, floor: 'epic', tier: 3,
    colour: '#ce93d8', shiny: 26, level: [30, 38],
    odds: { common: 21, uncommon: 36, rare: 29, epic: 11, legend: 3 },
    blurb: 'Eight cards, an epic floor, and a real shot at a legendary.' },
};
const PACK_LIST = ['scrub', 'field', 'foil', 'prism'];
const KEEP_MAX = 5;

/* ==================================================================== state */

const SAVE = 'ripgo.save.v2';

let S = null;
let uid = 1;

function newGame() {
  S = {
    map: 'house', x: 5, y: 5, dir: 'down',
    party: [], box: [],
    bag: { 'BALL': 5, 'POTION': 1 },
    money: 900,
    badges: [],
    seen: {}, caught: {},
    flags: {},
    beaten: {},
    healAt: { map: 'house', x: 5, y: 6 },
    steps: 0, wins: 0, caughtCount: 0,
  };
  uid = 1;
}

function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ s: S, uid })); return true; }
  catch (e) { return false; }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.s || !World.map(d.s.map)) return false;
    S = d.s;
    uid = d.uid || 1;
    S.party = (S.party || []).filter((m) => Dex.byId(m.species));
    S.box = (S.box || []).filter((m) => Dex.byId(m.species));
    S.party.concat(S.box).forEach(fixMon);
    return true;
  } catch (e) { return false; }
}

/* A save from a build with different numbers in it should not crash the team. */
function fixMon(m) {
  m.level = clamp(m.level || 5, 1, 100);
  if (typeof m.xp !== 'number') m.xp = Dex.xpForLevel(m.level);
  if (!Array.isArray(m.moves) || !m.moves.length) m.moves = defaultMoves(m.species, m.level);
  m.moves = m.moves.filter((mv) => Dex.move(mv.name)).slice(0, 4);
  if (!m.moves.length) m.moves = defaultMoves(m.species, m.level);
  m.moves.forEach((mv) => {
    const d = Dex.move(mv.name);
    if (typeof mv.pp !== 'number') mv.pp = d.pp;
    mv.pp = clamp(mv.pp, 0, d.pp);
  });
  m.status = m.status || '';
  const mx = maxHp(m);
  if (typeof m.hp !== 'number' || m.hp > mx) m.hp = mx;
  if (m.hp < 0) m.hp = 0;
}

/* ================================================================== numbers */

function spOf(m) { return Dex.byId(m.species); }
function nameOf(m) { return m.nick || spOf(m).name; }
function maxHp(m) { return Dex.statAt(spOf(m), 'hp', m.level); }
function statOf(m, k) { return Dex.statAt(spOf(m), k, m.level); }
function alive(m) { return m.hp > 0; }
function typesOf(m) { return spOf(m).types; }

function defaultMoves(species, level) {
  return Dex.wildMoves(Dex.byId(species), level)
    .map((n) => ({ name: n, pp: Dex.move(n).pp }));
}

function makeMon(species, level, opt) {
  opt = opt || {};
  const m = {
    uid: uid++,
    species, level,
    xp: Dex.xpForLevel(level),
    status: '', sleep: 0,
    shiny: opt.shiny !== undefined ? opt.shiny : rnd(320) === 0,
    moves: defaultMoves(species, level),
  };
  m.hp = maxHp(m);
  return m;
}

function xpToNext(m) {
  const need = Dex.xpForLevel(m.level + 1);
  const have = Dex.xpForLevel(m.level);
  return { into: m.xp - have, span: Math.max(1, need - have) };
}

/* What beating one is worth to the one that beat it. */
function xpFrom(foe, isTrainer) {
  return Math.max(1, Math.floor(spOf(foe).yield * foe.level / 7 * (isTrainer ? 1.5 : 1)));
}

function healParty() {
  S.party.forEach((m) => {
    m.hp = maxHp(m);
    m.status = ''; m.sleep = 0;
    m.moves.forEach((mv) => { mv.pp = Dex.move(mv.name).pp; });
  });
}

function partyAlive() { return S.party.some(alive); }

function addMon(m) {
  S.seen[m.species] = true;
  S.caught[m.species] = true;
  if (S.party.length < 6) { S.party.push(m); return 'party'; }
  S.box.push(m);
  return 'box';
}

function bagCount(name) { return S.bag[name] || 0; }
function bagAdd(name, n) { S.bag[name] = (S.bag[name] || 0) + n; }
function bagTake(name) {
  if (!S.bag[name]) return false;
  S.bag[name]--;
  if (S.bag[name] <= 0) delete S.bag[name];
  return true;
}
function bagList() { return Object.keys(S.bag).filter((k) => ITEMS[k] && S.bag[k] > 0); }

/* ==================================================================== scene */

let scene = 'title';
let t = 0;
const ui = { cursor: 0, cursor2: 0, tab: 0, fade: 0, flash: '', flashT: 0, scroll: 0 };

function go(s) { scene = s; ui.cursor = 0; ui.cursor2 = 0; ui.scroll = 0; }
function flash(msg) { ui.flash = msg; ui.flashT = 1.9; }

/* ==================================================================== world */

const cam = { x: 0, y: 0 };
const you = {
  tx: 0, ty: 0,          // the tile you are on
  ox: 0, oy: 0,          // pixels away from it while stepping
  dir: 'down', step: 0, walk: 0,
  moving: false, mt: 0, from: null,
  hop: 0,
};

let map = null;          // the World map object
let npcs = [];           // runtime copies of map.people
/* The tile you arrived on. A door you have just come out of must not throw
 * you straight back in, but it has to work again the moment you step off it
 * and back, so this is a place rather than a flag: it stops being true as
 * soon as you are standing somewhere else. */
let arrivedAt = null;
let banner = 0;          // the place-name card, on entry
let encounterCooldown = 0;

/* The dialogue box, which is also how every scripted thing in the game says
 * what it is doing. `after` runs when the last line is dismissed. */
const D = { lines: null, i: 0, after: null, who: null };

function talk(lines, after, who) {
  D.lines = Array.isArray(lines) ? lines.slice() : [String(lines)];
  D.i = 0;
  D.after = after || null;
  D.who = who || null;
}
function talking() { return !!D.lines; }
function closeTalk() {
  const after = D.after;
  D.lines = null; D.i = 0; D.after = null; D.who = null;
  if (after) after();
}

function enterMap(id, tx, ty, dir) {
  map = World.map(id);
  S.map = id;
  you.tx = tx; you.ty = ty;
  you.ox = 0; you.oy = 0;
  you.moving = false; you.hop = 0;
  if (dir) you.dir = dir;
  S.x = tx; S.y = ty; S.dir = you.dir;
  arrivedAt = { x: tx, y: ty };
  banner = 1.8;
  encounterCooldown = 0.3;
  buildNpcs();
  centreCam(true);
  Sound.playSong(map.song || 'town');
}

/* A person in the world is the data from world.js plus where they have walked
 * to. Anything that has been dealt with — a beaten trainer keeps its sprite, a
 * lifted gate loses it — is decided here, once, on entry. */
function buildNpcs() {
  npcs = [];
  (map.people || []).forEach((p, i) => {
    if (p.block && S.party.length) return;             // the professor goes back to the lab
    // A road guard does not vanish when you earn the badge — they move off
    // the path and say so, which is the difference between a road opening and
    // a person you never see again.
    const open = p.opensAt && S.badges.length >= p.opensAt;
    npcs.push({
      def: p, idx: i,
      tx: open && p.aside ? p.aside.x : p.x,
      ty: open && p.aside ? p.aside.y : p.y,
      ox: 0, oy: 0, open: !!open,
      dir: p.dir || 'down', step: 0, walk: 0,
      beaten: p.id ? !!S.beaten[p.id] : false,
      notice: 0, walkTo: null,
    });
  });
}

function npcAt(tx, ty) {
  for (const n of npcs) if (n.tx === tx && n.ty === ty) return n;
  return null;
}

function solidAt(tx, ty) {
  const ch = World.tileAt(map, tx, ty);
  if (ch === null) return true;
  if (World.info(ch).solid) return true;
  if (npcAt(tx, ty)) return true;
  return false;
}

function warpAt(tx, ty) {
  return (map.warps || []).find((w) => w.x === tx && w.y === ty) || null;
}

const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function faceTile(dir) {
  const d = DELTA[dir];
  return { x: you.tx + d[0], y: you.ty + d[1] };
}

function centreCam(snap) {
  const px = you.tx * TS + you.ox;
  const py = you.ty * TS + you.oy;
  const mw = map.rows[0].length * TS;
  const mh = map.rows.length * TS;
  let cx = px + TS / 2 - W / 2;
  let cy = py + TS / 2 - H / 2;
  // A map smaller than the window sits in the middle of it rather than
  // clamping to a corner and leaving all the empty space on one side.
  cx = mw <= W ? (mw - W) / 2 : clamp(cx, 0, mw - W);
  cy = mh <= H ? (mh - H) / 2 : clamp(cy, 0, mh - H);
  if (snap) { cam.x = cx; cam.y = cy; } else { cam.x += (cx - cam.x) * 0.5; cam.y += (cy - cam.y) * 0.5; }
}

/* --------------------------------------------------------------- stepping */

const WALK_TIME = 0.16;

function tryStep(dir) {
  you.dir = dir;
  const d = DELTA[dir];
  const nx = you.tx + d[0], ny = you.ty + d[1];
  const ch = World.tileAt(map, nx, ny);

  // A ledge is a one-way street and the only tile in the game that moves you
  // two squares: you hop down it, and you cannot climb back. Coming at it
  // from any other side it is a wall, which is the entire point of it.
  if (ch !== null && World.info(ch).ledge) {
    if (dir !== 'down') { you.walk += 0.2; return false; }
    const lx = nx, ly = ny + 1;
    if (solidAt(lx, ly)) return false;
    you.moving = true; you.mt = 0; you.hop = 1;
    you.from = { x: you.tx, y: you.ty };
    you.tx = lx; you.ty = ly;
    you.ox = (you.from.x - lx) * TS; you.oy = (you.from.y - ly) * TS;
    Sound.step();
    return true;
  }

  if (solidAt(nx, ny)) {
    // Standing in a doorway and pushing at the wall behind it is how you
    // leave a building, because the mat is on the wall and there is nothing
    // past it to step onto.
    const here = World.tileAt(map, you.tx, you.ty);
    const w = warpAt(you.tx, you.ty);
    if (w && (here === 'm' || here === 'D' || here === 'G')) { doWarp(w); return true; }
    you.walk += 0.2;
    return false;
  }
  you.moving = true; you.mt = 0; you.hop = 0;
  you.from = { x: you.tx, y: you.ty };
  you.tx = nx; you.ty = ny;
  you.ox = -d[0] * TS; you.oy = -d[1] * TS;
  return true;
}

function finishStep() {
  you.ox = 0; you.oy = 0; you.moving = false;
  you.step ^= 1;
  S.x = you.tx; S.y = you.ty; S.dir = you.dir;
  S.steps++;
  Sound.step();

  if (arrivedAt && (you.tx !== arrivedAt.x || you.ty !== arrivedAt.y)) arrivedAt = null;

  const w = warpAt(you.tx, you.ty);
  if (w && !arrivedAt) { doWarp(w); return; }

  if (checkSight()) return;

  const ch = World.tileAt(map, you.tx, you.ty);
  if (ch && World.info(ch).grass && encounterCooldown <= 0) {
    if (chance(13)) { startWild(); return; }
  }
}

/* A door is two beats: the screen goes dark, and then you are somewhere else.
 * Both of them are counted down by the same loop that runs everything else,
 * so a door behaves the same whether the game is running at sixty frames a
 * second or being stepped through one frame at a time. */
function doWarp(w) {
  Sound.door();
  ui.fade = 0.45;
  pendingWarp = { to: w.to, tx: w.tx, ty: w.ty, dir: w.dir, t: 0.14 };
  you.moving = false;
  frozen = 0.28;
}

let frozen = 0;
let pendingWarp = null;

/* ------------------------------------------------------------ line of sight */

function checkSight() {
  for (const n of npcs) {
    if (n.beaten || !n.def.sight || !n.def.party) continue;
    const d = DELTA[n.dir];
    for (let i = 1; i <= n.def.sight; i++) {
      const cx = n.tx + d[0] * i, cy = n.ty + d[1] * i;
      const ch = World.tileAt(map, cx, cy);
      if (ch === null || World.info(ch).solid) break;
      if (cx === you.tx && cy === you.ty) {
        n.notice = 0.75;
        n.walkTo = { x: you.tx - d[0], y: you.ty - d[1] };
        pendingTrainer = n;
        return true;
      }
      if (npcAt(cx, cy)) break;
    }
  }
  return false;
}

let pendingTrainer = null;

/* ------------------------------------------------------------- interacting */

function interact() {
  const f = faceTile(you.dir);
  const n = npcAt(f.x, f.y);
  if (n) {
    // Turn to look at whoever is talking to them.
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (!n.def.sight) n.dir = back[you.dir];
    talkToPerson(n);
    return;
  }
  const key = f.x + ',' + f.y;

  const spot = (map.spots || {})[key];
  if (spot === 'splicer') {
    Sound.ok();
    if (S.party.length < 2 && !S.party.some((m) => spOf(m).fusion)) {
      talk(['A machine with two slots and one chute.',
        'It wants two of yours to put together — or one you already have, to take apart.']);
      return;
    }
    talk(['The splicer hums when you touch it.'], openSplicer);
    return;
  }
  if (spot === 'starters') {
    Sound.ok();
    if (S.flags.gotStarter) { talk(['Two empty spaces and a dent where the third one was.']); return; }
    talk(['Three of them on the table, and one of them is going with you.'],
      () => { ui.cursor = 0; go('starter'); });
    return;
  }

  const sign = (map.signs || {})[key];
  if (sign) { Sound.ok(); talk([sign]); return; }

  const ch = World.tileAt(map, f.x, f.y);
  if (ch === 'c') { Sound.ok(); openBox(); return; }
  if (ch === 'b') { Sound.ok(); talk(['Rows of books. Somebody has been taking notes in the margins.']); return; }
}

function talkToPerson(n) {
  const p = n.def;
  Sound.ok();

  if (p.party && !n.beaten) {
    // A gym leader will take the badge off you either way: bring your own six,
    // or take a sealed pack each and find out who drafts better.
    if (p.leader) {
      talk((p.intro || []).concat([]), () => {
        ask('HOW DO YOU WANT IT?', [
          { name: 'TEAM FIGHT', note: 'Your six against mine.' },
          { name: 'PACK FIGHT', note: 'A sealed pack each. Keep five.' },
        ], (i) => {
          if (i === 0) { startTrainer(n); return; }
          beginDraft({
            id: p.id, pack: p.packTier || 'field', level: p.packLevel || 20,
            type: p.type, prize: p.prize, badge: p.badge, leader: p.leader, npc: n,
            who: p.who, name: Folks.name(p.who), defeat: p.defeat,
            winLines: (p.defeat || []).concat([
              'Out of a pack, too. That is the one that will annoy me.']),
            loseLines: ['Your five are down.',
              'Same size pack as mine. Come back and draft better.'],
          });
        });
      });
      return;
    }
    talk((p.intro || []).concat([]), () => startTrainer(n));
    return;
  }
  if (p.heal) {
    talk(p.lines, () => {
      Sound.heal();
      healParty();
      S.healAt = { map: S.map, x: you.tx, y: you.ty + 1 };
      save();
      talk(['All of them, back on their feet.', 'The machine goes quiet. Off you go.']);
    });
    return;
  }
  if (p.shop) { talk(p.lines, () => { ui.shopKind = p.shop; ui.cursor = 0; go('shop'); }); return; }
  if (p.packs) {
    talk(p.lines, () => {
      ask('WHAT ARE YOU AFTER?', [
        { name: 'BUY A PACK', note: 'Rip it, keep five, they walk out with you.' },
        { name: 'PACK ARENA', note: 'Draft five and fight the house for a purse.' },
      ], (i) => { ui.cursor = 0; go(i === 0 ? 'packs' : 'arena'); });
    });
    return;
  }
  if (p.starters && !S.flags.gotStarter) {
    talk(p.lines, () => { ui.cursor = 0; go('starter'); });
    return;
  }
  if (p.opensAt) { talk(n.open ? (p.pass || p.lines) : p.lines); return; }

  if (p.legendary) {
    if (S.badges.length < (p.needs || 0)) { talk(p.lines); return; }
    if (S.flags['legend_' + p.legendary]) {
      talk(['The end of the hall is empty now.', 'It is somehow worse.']);
      return;
    }
    talk(p.lines, () => startLegend(n, p.legendary));
    return;
  }
  if (p.gift && !S.flags[p.gift.once]) {
    talk(p.lines, () => {
      S.flags[p.gift.once] = true;
      bagAdd(p.gift.item, p.gift.n || 1);
      Sound.keep();
      talk(['You take ' + (p.gift.n || 1) + ' ' + p.gift.item + '.']);
      save();
    });
    return;
  }
  if (n.beaten && p.defeat) { talk(p.lines || p.defeat); return; }
  talk(p.lines || ['...']);
}

/* ---------------------------------------------------------------- updating */

function updateWorld(dt) {
  if (ui.fade > 0) ui.fade -= dt;
  if (banner > 0) banner -= dt;
  if (encounterCooldown > 0) encounterCooldown -= dt;

  if (pendingWarp) {
    pendingWarp.t -= dt;
    if (pendingWarp.t <= 0) {
      const w = pendingWarp;
      pendingWarp = null;
      enterMap(w.to, w.tx, w.ty, w.dir);
    }
    return;
  }
  if (frozen > 0) { frozen -= dt; return; }

  // A trainer who has spotted you walks over before anything else happens.
  if (pendingTrainer) { updateNotice(dt); return; }

  if (talking()) {
    if (eat('ok') || eat('start')) {
      D.i++;
      if (D.i >= D.lines.length) closeTalk();
      else Sound.cursor();
    }
    return;
  }

  if (you.moving) {
    you.mt += dt;
    const k = Math.min(1, you.mt / (you.hop ? WALK_TIME * 1.6 : WALK_TIME));
    you.ox = (you.from.x - you.tx) * TS * (1 - k);
    you.oy = (you.from.y - you.ty) * TS * (1 - k);
    if (k >= 1) finishStep();
    centreCam(false);
    return;
  }

  if (eat('start')) { Sound.ok(); ui.cursor = 0; go('menu'); return; }
  if (eat('ok')) { interact(); return; }

  const dir = held.up ? 'up' : held.down ? 'down' : held.left ? 'left' : held.right ? 'right' : null;
  if (dir) {
    if (you.dir !== dir && !you.turnHeld) {
      // A tap of a new direction turns you on the spot, which is how you read
      // a sign you are standing beside without walking into it.
      you.dir = dir;
      you.turnHeld = 0.09;
    }
    if (you.turnHeld > 0) { you.turnHeld -= dt; return; }
    tryStep(dir);
    you.walk += dt * 8;
  } else {
    you.turnHeld = 0;
    you.walk = 0;
  }
  centreCam(false);
}

function updateNotice(dt) {
  const n = pendingTrainer;
  n.notice -= dt;
  if (n.notice > 0) return;

  // Walk to the tile beside you, one square at a time.
  if (n.walkTo && (n.tx !== n.walkTo.x || n.ty !== n.walkTo.y)) {
    const dx = Math.sign(n.walkTo.x - n.tx), dy = Math.sign(n.walkTo.y - n.ty);
    n.tx += dx ? dx : 0;
    n.ty += dx ? 0 : dy;
    n.step ^= 1;
    n.notice = 0.14;
    Sound.step();
    return;
  }
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' };
  n.dir = back[you.dir] || n.dir;
  const who = n;
  pendingTrainer = null;
  talk((n.def.intro || ['...']).concat([]), () => startTrainer(who));
}

/* ------------------------------------------------------------------ drawing */

function drawWorld() {
  box(0, 0, W, H, '#05070c');

  const x0 = Math.floor(cam.x / TS) - 1, x1 = Math.ceil((cam.x + W) / TS) + 1;
  const y0 = Math.floor(cam.y / TS) - 1, y1 = Math.ceil((cam.y + H) / TS) + 1;

  /* In a cave you can see about four tiles, and the fifth is guesswork. The
   * ring of half-lit tiles at the edge is the whole difference between a
   * cave and a square hole cut in a black sheet. */
  const dark = map.dark;
  const lit = (x, y) => {
    if (!dark) return 1;
    const d = Math.max(Math.abs(x - you.tx), Math.abs(y - you.ty));
    return d <= 3 ? 1 : d === 4 ? 0.55 : d === 5 ? 0.22 : 0;
  };

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = World.tileAt(map, x, y);
      if (ch === null) continue;
      const l = lit(x, y);
      if (l <= 0) continue;
      // Inside a building the border is not a hedge, it is the outside of the
      // wall, which from in here is nothing at all.
      const paint = map.inside && ch === '#' ? 'dark' : World.info(ch).paint;
      Art.tile(ctx, paint, x * TS - cam.x, y * TS - cam.y);
      if (l < 1) box(x * TS - cam.x, y * TS - cam.y, TS, TS, 'rgba(5,7,12,' + (1 - l) + ')');
    }
  }

  // Everything that stands on the ground is drawn in order of how far down
  // the screen it is, so walking behind somebody puts you behind them.
  const actors = npcs.map((n) => ({
    y: n.ty * TS + n.oy, draw: () => {
      if (lit(n.tx, n.ty) <= 0) return;
      Folks.draw(ctx, n.def.who, n.dir, n.step, n.tx * TS + n.ox - cam.x, n.ty * TS + n.oy - cam.y, TS);
      if (n.notice > 0 && pendingTrainer === n) {
        const bx = n.tx * TS - cam.x + 5, by = n.ty * TS - cam.y - 10;
        box(bx - 2, by - 1, 7, 11, '#0b0d14');
        box(bx, by, 3, 6, '#ffd166');
        box(bx, by + 7, 3, 2, '#ffd166');
      }
    },
  }));
  actors.push({
    y: you.ty * TS + you.oy, draw: () => {
      const hop = you.hop && you.moving ? -Math.sin(Math.min(1, you.mt / (WALK_TIME * 1.6)) * Math.PI) * 8 : 0;
      Folks.draw(ctx, 'player', you.dir, you.step,
        you.tx * TS + you.ox - cam.x, you.ty * TS + you.oy - cam.y + hop, TS);
    },
  });
  actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

  // Long grass gets a second pass over the top so a creature standing in it
  // is standing *in* it.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = World.tileAt(map, x, y);
      if (ch === null || !World.info(ch).grass) continue;
      if (lit(x, y) <= 0) continue;
      const px = x * TS - cam.x, py = y * TS - cam.y;
      box(px + 1, py + 9, 2, 5, '#2f6a3a');
      box(px + 7, py + 8, 2, 6, '#367a41');
      box(px + 12, py + 10, 2, 4, '#2f6a3a');
    }
  }

  if (banner > 0) {
    const a = Math.min(1, banner * 2);
    const w = Art.width(map.name, 1) + 16;
    ctx.globalAlpha = a;
    panel(6, 6, w, 15, '#101728', '#4d5f96');
    txt(map.name, 6 + w / 2, 11, '#e8eefc', 1, 'center');
    ctx.globalAlpha = 1;
  }

  if (talking()) drawTalkBox();
  if (ui.fade > 0) {
    ctx.globalAlpha = Math.min(1, ui.fade * 2.6);
    box(0, 0, W, H, '#05070c');
    ctx.globalAlpha = 1;
  }
}

function drawTalkBox() {
  const h = 46;
  panel(4, H - h - 4, W - 8, h, '#101728', '#4d5f96');
  frame(6, H - h - 2, W - 12, h - 4, '#2b3c6b');
  const line = D.lines[D.i] || '';
  wrapText(line, 12, H - h + 6, W - 24, 10, '#e8eefc');
  if (Math.floor(t * 3) % 2 === 0) {
    const bx = W - 16, by = H - 14;
    box(bx, by, 5, 2, '#ffd166');
    box(bx + 1, by + 2, 3, 2, '#ffd166');
  }
}

/* The 3x5 font has no measuring beyond counting characters, so wrapping is
 * done on words and the result is checked against the box, not guessed. */
function wrapText(s, x, y, w, lh, col, sc) {
  sc = sc || 1;
  const words = String(s).split(' ');
  let line = '', ly = y;
  words.forEach((word) => {
    const tryLine = line ? line + ' ' + word : word;
    if (Art.width(tryLine, sc) > w && line) {
      txt(line, x, ly, col, sc);
      ly += lh; line = word;
    } else line = tryLine;
  });
  if (line) txt(line, x, ly, col, sc);
  return ly + lh;
}

/* =================================================================== battle */

const B = {
  on: false, kind: 'wild',
  foe: null, foeParty: null, foeIdx: 0, trainer: null,
  mine: 0,
  mods: { me: { atk: 0, def: 0, spd: 0 }, foe: { atk: 0, def: 0, spd: 0 } },
  phase: 'intro', menu: 0, moveSel: 0, swapSel: 0, bagSel: 0,
  script: [], cur: null, wait: 0,
  shown: { me: 0, foe: 0 }, target: { me: 0, foe: 0 },
  shake: { me: 0, foe: 0 }, flashT: 0,
  intro: 0, result: null,
  learnQueue: [], learn: null, learnSel: 0,
  evoQueue: [], evo: null, evoT: 0,
  ballT: 0, ballShakes: 0, caught: false,
  team: null, exhibition: false, arena: null,
  runs: 0, xpBar: 0,
};

/* A fight reads its side from here rather than straight out of the save,
 * because a pack battle is fought with five cards that were never yours and
 * are not yours afterwards. Everything else about the fight is the same. */
function team() { return B.team || S.party; }

function myMon() { return team()[B.mine]; }
function foeMon() { return B.foe; }

/* What the FIGHT menu is allowed to show. Normally the four it knows; when
 * every one of them is empty, the one move nobody teaches it. */
function moveList(m) {
  if (m.moves.some((s) => s.pp > 0)) return m.moves;
  return [{ name: 'STRUGGLE', pp: 1, struggle: true }];
}

function beginBattle(kind, opts) {
  opts = opts || {};
  B.team = opts.team || null;
  B.exhibition = !!opts.exhibition;
  B.on = true;
  B.kind = kind;
  B.mods = { me: { atk: 0, def: 0, spd: 0 }, foe: { atk: 0, def: 0, spd: 0 } };
  B.mine = team().findIndex(alive);
  if (B.mine < 0) B.mine = 0;
  B.phase = 'intro';
  B.menu = 0; B.moveSel = 0; B.bagSel = 0;
  B.script = []; B.cur = null; B.wait = 0;
  B.shown.me = myMon().hp; B.shown.foe = B.foe.hp;
  B.target.me = myMon().hp; B.target.foe = B.foe.hp;
  B.shake.me = 0; B.shake.foe = 0;
  B.result = null; B.learnQueue = []; B.learn = null;
  B.evoQueue = []; B.evo = null;
  B.ballT = 0; B.caught = false; B.runs = 0;
  B.intro = 0;
  S.seen[B.foe.species] = true;
  Sound.playSong('battle');
  go('battle');
}

function startWild() {
  const table = map.encounters || [];
  if (!table.length) return;
  let total = 0;
  table.forEach((e) => { total += e.w; });
  let n = rand() * total;
  let picked = table[0];
  for (const e of table) { n -= e.w; if (n <= 0) { picked = e; break; } }
  const level = picked.min + rnd(picked.max - picked.min + 1);

  /* Once you have a badge, the long grass starts turning up things that are
   * already two creatures. It is rare on purpose — a fusion you walked into
   * should be a story, not a Tuesday — and it is gated behind the first badge
   * so the opening hours stay legible while you are still learning what a
   * creature even is. The body comes from the same table, so a route's
   * fusions are made of that route's animals. */
  let species = picked.id;
  let wildFusion = false;
  if (S.badges.length >= 1 && table.length > 1 && chance(7)) {
    let other = pick(table);
    for (let i = 0; i < 4 && other.id === picked.id; i++) other = pick(table);
    if (other.id !== picked.id) {
      const made = Dex.fuse(picked.id, other.id);
      if (made) { species = made.id; wildFusion = true; }
    }
  }

  B.foe = makeMon(species, level);
  B.foeParty = null; B.trainer = null;
  beginBattle('wild');
  if (wildFusion) push('Something in the grass is two creatures at once.');
  push('A wild ' + nameOf(B.foe) + ' jumped out!');
  push('Go, ' + nameOf(myMon()) + '!', { fn: () => { B.intro = 0.4; } });
  after('menu');
}

function startLegend(n, species) {
  B.foe = makeMon(species, 40, { shiny: false });
  B.foeParty = null; B.trainer = null;
  B.legendFrom = n.def.id;
  beginBattle('wild');
  push('It has been standing here a long time.');
  push(nameOf(B.foe) + ' is awake.');
  push('Go, ' + nameOf(myMon()) + '!');
  after('menu');
}

function startTrainer(n) {
  const p = n.def;
  B.foeParty = p.party.map((e) => makeMon(e[0], e[1], { shiny: false }));
  B.foeIdx = 0;
  B.foe = B.foeParty[0];
  B.trainer = { id: p.id, who: p.who, name: Folks.name(p.who), prize: p.prize || 100,
    defeat: p.defeat || ['...'], badge: p.badge, leader: p.leader, npc: n };
  beginBattle('trainer');
  push(B.trainer.name + ' wants to fight!');
  push(B.trainer.name + ' sent out ' + nameOf(B.foe) + '!');
  push('Go, ' + nameOf(myMon()) + '!');
  after('menu');
}

/* ------------------------------------------------------------- the script */

function push(text, opt) { B.script.push(Object.assign({ text: text || '' }, opt || {})); }
function after(phase) { B.phaseAfter = phase; }

function stage(v) { return v >= 0 ? (2 + v) / 2 : 2 / (2 - v); }

function effLabel(e) {
  if (e >= 2) return 'It is all the way through!';
  if (e > 1) return 'That went in.';
  if (e === 0.25) return 'It barely noticed.';
  if (e < 1) return 'Not much of that landed.';
  return '';
}

function damageOf(att, def, move, aMods, dMods) {
  const A = statOf(att, 'atk') * stage(aMods.atk) * (att.status === 'burn' ? 0.5 : 1);
  const Dv = Math.max(1, statOf(def, 'def') * stage(dMods.def));
  const critRoll = chance(move.crit ? 12.5 : 6.25);
  let base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * move.power * A / Dv) / 50) + 2;
  if (critRoll) base = Math.floor(base * 1.8);
  const stab = typesOf(att).indexOf(move.type) >= 0 ? 1.5 : 1;
  const dt = typesOf(def);
  const eff = Dex.effect(move.type, dt[0], dt[1]);
  const roll = 0.85 + rand() * 0.15;
  return { dmg: Math.max(1, Math.floor(base * stab * eff * roll)), eff, crit: critRoll };
}

function hpStep(side, value, fx, eff) {
  push('', { hp: { side, value }, fx, eff, silent: true });
}

/* One creature attacking another, as a run of script entries. */
function doMove(who, move, slot) {
  const att = who === 'me' ? myMon() : foeMon();
  const def = who === 'me' ? foeMon() : myMon();
  const aMods = who === 'me' ? B.mods.me : B.mods.foe;
  const dMods = who === 'me' ? B.mods.foe : B.mods.me;
  const side = who === 'me' ? 'foe' : 'me';
  const label = who === 'me' ? nameOf(att) : 'The wild ' + nameOf(att);
  const name = B.kind === 'trainer' && who !== 'me' ? B.trainer.name + '\'s ' + nameOf(att) : label;

  // Asleep, frozen in place, or shaking off a paralysis: all three end the
  // turn before the move is named, which is the whole reason status matters.
  if (att.status === 'sleep') {
    att.sleep--;
    if (att.sleep <= 0) { att.status = ''; push(name + ' woke up.'); }
    else { push(name + ' is fast asleep.'); return; }
  }
  if (att.status === 'para' && chance(25)) {
    push(name + ' is too stiff to move.');
    return;
  }

  if (slot) slot.pp = Math.max(0, slot.pp - 1);
  push(name + ' used ' + move.name + '.');

  if (move.acc && !chance(move.acc)) { push('It missed.'); return; }

  if (move.heal) {
    const gain = Math.min(maxHp(att) - att.hp, Math.floor(maxHp(att) * move.heal));
    att.hp += gain;
    hpStep(who, att.hp, 'heal');
    push(name + (gain > 0 ? ' catches its breath.' : ' is already whole.'), { fn: () => Sound.heal() });
    return;
  }

  if (move.power > 0) {
    const r = damageOf(att, def, move, aMods, dMods);
    def.hp = Math.max(0, def.hp - r.dmg);
    hpStep(side, def.hp, 'hit', r.eff);
    if (r.crit) push('A clean hit.');
    const lab = effLabel(r.eff);
    if (lab) push(lab);

    if (move.drain) {
      const back = Math.max(1, Math.floor(r.dmg * move.drain));
      att.hp = Math.min(maxHp(att), att.hp + back);
      hpStep(who, att.hp, 'heal');
      push(name + ' took some of it back.');
    }
    if (move.recoil) {
      const hurt = Math.max(1, Math.floor(r.dmg * move.recoil));
      att.hp = Math.max(0, att.hp - hurt);
      hpStep(who, att.hp, 'hit');
      push(name + ' is hurt by the effort.');
    }
    if (def.hp <= 0) return;
  }

  if (move.status && chance(move.status.chance) && !def.status) {
    def.status = move.status.kind;
    if (def.status === 'sleep') def.sleep = 1 + rnd(3);
    const word = { burn: ' is burned.', para: ' is paralysed.', sleep: ' fell asleep.', poison: ' is poisoned.' };
    push((side === 'me' ? nameOf(def) : 'The foe ' + nameOf(def)) + (word[def.status] || ' is affected.'),
      { fx: 'status' });
  }

  if (move.stat && (move.stat.chance === undefined || chance(move.stat.chance))) {
    const t = move.stat.who === 'self' ? aMods : dMods;
    const tn = move.stat.who === 'self' ? name : (side === 'me' ? nameOf(def) : 'The foe ' + nameOf(def));
    const before = t[move.stat.key];
    t[move.stat.key] = clamp(before + move.stat.by, -6, 6);
    const word = { atk: 'attack', def: 'defence', spd: 'speed' }[move.stat.key];
    if (t[move.stat.key] === before) push(tn + '\'s ' + word + ' will not go further.');
    else push(tn + '\'s ' + word + (move.stat.by > 0 ? ' went up.' : ' went down.'),
      { fn: () => (move.stat.by > 0 ? Sound.buff() : Sound.debuff()) });
  }
}

function endOfTurn() {
  [['me', myMon()], ['foe', foeMon()]].forEach(([who, m]) => {
    if (!m || m.hp <= 0) return;
    if (m.status === 'burn' || m.status === 'poison') {
      const hurt = Math.max(1, Math.floor(maxHp(m) / 8));
      m.hp = Math.max(0, m.hp - hurt);
      hpStep(who, m.hp, 'hit');
      push((who === 'me' ? nameOf(m) : 'The foe ' + nameOf(m)) +
        (m.status === 'burn' ? ' is hurt by the burn.' : ' is hurt by the poison.'));
    }
  });
}

/* The foe picks the move that hurts most, most of the time. */
function foeChoice() {
  const f = foeMon(), me = myMon();
  const usable = f.moves.filter((mv) => mv.pp > 0);
  const pool = usable.length ? usable : [{ name: 'STRUGGLE', pp: 1, struggle: true }];
  /* A move that cannot do anything scores below zero and is not picked, not
   * even by the coin flip. Without that rule two creatures holding a stat
   * move will sit at plus six sharpening themselves at each other until the
   * PP runs out, which is fifty turns of a fight that is not happening. */
  const scored = pool.map((slot) => {
    const mv = Dex.move(slot.name);
    let score;
    if (mv.power > 0) {
      const dt = typesOf(me);
      score = mv.power * Dex.effect(mv.type, dt[0], dt[1]) *
        (typesOf(f).indexOf(mv.type) >= 0 ? 1.5 : 1);
    } else if (mv.stat) {
      const mods = mv.stat.who === 'self' ? B.mods.foe : B.mods.me;
      const now = mods[mv.stat.key];
      const spent = mv.stat.by > 0 ? now >= 6 : now <= -6;
      score = spent ? -1 : 30;
    } else if (mv.heal) {
      score = f.hp < maxHp(f) * 0.55 ? 90 : -1;
    } else if (mv.status) {
      score = me.status ? -1 : 34;          // it is already asleep; let it be
    } else score = 28;
    return { slot, score };
  });

  const useful = scored.filter((s) => s.score >= 0);
  const choices = useful.length ? useful : scored;
  if (chance(20)) return pick(choices).slot;
  return choices.reduce((a, b) => (a.score >= b.score ? a : b)).slot;
}

function takeTurn(action) {
  B.script = []; B.cur = null;

  const foeSlot = foeChoice();
  const foeMove = Dex.move(foeSlot.name) || Dex.move('TACKLE');

  if (action.kind === 'swap') {
    push('Come back, ' + nameOf(myMon()) + '.', { fn: () => { B.mods.me = { atk: 0, def: 0, spd: 0 }; } });
    B.mine = action.index;
    push('Go, ' + nameOf(team()[action.index]) + '!', {
      fn: () => { B.shown.me = myMon().hp; B.target.me = myMon().hp; },
    });
    doMove('foe', foeMove, foeSlot);
  } else if (action.kind === 'item') {
    useItemInBattle(action.item);
    if (B.caught) { after('over'); play(); return; }
    if (foeMon().hp > 0) doMove('foe', foeMove, foeSlot);
  } else if (action.kind === 'run') {
    const me = myMon(), f = foeMon();
    B.runs++;
    const odds = B.kind === 'trainer' ? 0
      : clamp(30 + (statOf(me, 'spd') - statOf(f, 'spd')) * 2 + B.runs * 15, 20, 95);
    if (B.kind === 'trainer') push('There is no walking out of this one.');
    else if (chance(odds)) {
      push('You got away.');
      B.result = { ran: true };
      after('over'); play(); return;
    } else push('It cut you off.');
    doMove('foe', foeMove, foeSlot);
  } else {
    const slot = action.slot;
    const move = Dex.move(slot.name);
    const me = myMon(), f = foeMon();
    const myPrio = move.prio || 0, foePrio = foeMove.prio || 0;
    const mySpd = statOf(me, 'spd') * stage(B.mods.me.spd) * (me.status === 'para' ? 0.5 : 1);
    const foeSpd = statOf(f, 'spd') * stage(B.mods.foe.spd) * (f.status === 'para' ? 0.5 : 1);
    const meFirst = myPrio !== foePrio ? myPrio > foePrio
      : mySpd !== foeSpd ? mySpd > foeSpd : chance(50);

    if (meFirst) {
      doMove('me', move, slot);
      if (foeMon().hp > 0 && myMon().hp > 0) doMove('foe', foeMove, foeSlot);
    } else {
      doMove('foe', foeMove, foeSlot);
      if (myMon().hp > 0 && foeMon().hp > 0) doMove('me', move, slot);
    }
  }

  if (myMon().hp > 0 && foeMon().hp > 0) endOfTurn();
  resolveFaints();
  play();
}

function resolveFaints() {
  const f = foeMon(), me = myMon();

  if (f && f.hp <= 0) {
    push((B.kind === 'trainer' ? B.trainer.name + '\'s ' : 'The wild ') + nameOf(f) + ' fainted.',
      { fx: 'faint', fn: () => Sound.faint() });
    awardXp(f);
    if (B.kind === 'trainer' && B.foeIdx + 1 < B.foeParty.length) {
      B.foeIdx++;
      push(B.trainer.name + ' sent out ' + nameOf(B.foeParty[B.foeIdx]) + '!', {
        fn: () => {
          B.foe = B.foeParty[B.foeIdx];
          B.mods.foe = { atk: 0, def: 0, spd: 0 };
          B.shown.foe = B.foe.hp; B.target.foe = B.foe.hp;
          S.seen[B.foe.species] = true;
        },
      });
      after(B.learnQueue.length ? 'learn' : 'menu');
      return;
    }
    winBattle();
    return;
  }

  if (me && me.hp <= 0) {
    push(nameOf(me) + ' fainted.', { fx: 'faint', fn: () => Sound.faint() });
    if (team().some(alive)) { after('forceswap'); return; }
    push('You are out of anything that can stand up.');
    B.result = { lost: true };
    after('over');
  }
}

function awardXp(foe) {
  // Nothing you drafted out of a sealed pack gets to keep what it learned.
  if (B.exhibition) return;
  const me = myMon();
  if (!me || me.hp <= 0) return;
  const gain = xpFrom(foe, B.kind === 'trainer');
  push(nameOf(me) + ' got ' + gain + ' XP.');
  me.xp += gain;
  let guard = 0;
  while (me.level < 100 && me.xp >= Dex.xpForLevel(me.level + 1) && guard++ < 100) {
    me.level++;
    const before = maxHp(me);
    me.hp += maxHp(me) - before;
    push(nameOf(me) + ' grew to level ' + me.level + '!', {
      fn: () => { Sound.levelup(); B.target.me = myMon().hp; },
    });
    // Anything the learnset hands out at this exact level.
    (spOf(me).learn || []).forEach((e) => {
      if (e[0] !== me.level) return;
      if (me.moves.some((mv) => mv.name === e[1])) return;
      if (me.moves.length < 4) {
        me.moves.push({ name: e[1], pp: Dex.move(e[1]).pp });
        push(nameOf(me) + ' learned ' + e[1] + '.');
      } else {
        B.learnQueue.push({ mon: me, move: e[1] });
      }
    });
    const evo = spOf(me).evo;
    if (evo && me.level >= evo.lv && !B.evoQueue.some((e) => e.mon === me)) {
      B.evoQueue.push({ mon: me, to: evo.to });
    }
  }
}

function winBattle() {
  S.wins++;
  if (B.kind === 'trainer') {
    const tr = B.trainer;
    push(tr.name + ' is beaten.', { fn: () => Sound.win() });
    (tr.defeat || []).forEach((l) => push(l));
    push('You got ' + tr.prize + ' coins.', {
      fn: () => { S.money += tr.prize; Sound.buy(); },
    });
    if (tr.badge && S.badges.indexOf(tr.badge) < 0) {
      push('You took the ' + tr.badge + '.', { fn: () => { S.badges.push(tr.badge); Sound.levelup(); } });
    }
    B.result = { win: true, trainer: tr };
  } else {
    B.result = { win: true };
  }
  after(B.learnQueue.length ? 'learn' : (B.evoQueue.length ? 'evolve' : 'over'));
}

/* ------------------------------------------------------------------ items */

function useItemInBattle(name) {
  const item = ITEMS[name];
  if (!item) return;

  if (item.kind === 'ball') {
    if (B.kind === 'trainer') { push('You cannot catch somebody else\'s.'); return; }
    bagTake(name);
    const f = foeMon();
    const mx = maxHp(f);
    let a = ((3 * mx - 2 * f.hp) * spOf(f).catch * item.mult) / (3 * mx);
    if (f.status === 'sleep') a *= 2.5;
    else if (f.status) a *= 1.5;
    a = Math.min(255, a);
    let shakes = 4;
    if (a < 255) {
      const b = 65536 / Math.pow(255 / a, 0.1875);
      shakes = 0;
      for (let i = 0; i < 4; i++) { if (rand() * 65536 < b) shakes++; else break; }
    }
    push('You threw a ' + name + '.', { fn: () => { B.ballT = 0.01; B.ballShakes = shakes; } });
    push('', { silent: true, wait: 0.5 + shakes * 0.45 });
    if (shakes >= 4) {
      B.caught = true;
      push('Got it. ' + nameOf(f) + ' is yours.', { fn: () => Sound.win() });
      push('', {
        fn: () => {
          const where = addMon(f);
          S.caughtCount++;
          if (where === 'box') flash(nameOf(f) + ' went to the box.');
        }, silent: true,
      });
      B.result = { caught: true, mon: f };
      if (B.legendFrom) S.flags['legend_' + f.species] = true;
    } else {
      const lines = ['It broke straight out.', 'So close.', 'It shook twice and got loose.', 'One more shake.'];
      push(lines[Math.min(3, shakes)], { fn: () => Sound.deny() });
    }
    return;
  }

  const target = myMon();
  if (item.kind === 'heal') {
    bagTake(name);
    const gain = Math.min(maxHp(target) - target.hp, item.amount);
    target.hp += gain;
    if (item.cure) { target.status = ''; target.sleep = 0; }
    hpStep('me', target.hp, 'heal');
    push(nameOf(target) + ' got ' + gain + ' HP back.', { fn: () => Sound.heal() });
  } else if (item.kind === 'cure') {
    if (!target.status) { push('Nothing is wrong with it.'); return; }
    bagTake(name);
    target.status = ''; target.sleep = 0;
    push(nameOf(target) + ' is itself again.', { fn: () => Sound.heal() });
  } else if (item.kind === 'revive') {
    push('Not in the middle of a fight.');
  }
}

/* ---------------------------------------------------------------- playback */

function play() {
  B.cur = null;
  B.wait = 0;
  if (B.script.length) B.phase = 'text';
  else B.phase = B.phaseAfter || 'menu';
}

function nextEntry() {
  if (!B.script.length) {
    B.cur = null;
    const p = B.phaseAfter || 'menu';
    B.phaseAfter = null;
    if (p === 'learn' && B.learnQueue.length) startLearn();
    else if (p === 'evolve' && B.evoQueue.length) startEvolve();
    else B.phase = p;
    return;
  }
  const e = B.script.shift();
  B.cur = e;
  if (e.fn) e.fn();
  if (e.hp) {
    B.target[e.hp.side] = e.hp.value;
    if (e.fx === 'hit') {
      B.shake[e.hp.side] = 0.24;
      B.flashT = 0.12;
      Sound.hit(e.eff || 1);
    }
  }
  B.wait = e.wait !== undefined ? e.wait : (e.silent ? 0.12 : 1.05);
}

function updateBattle(dt) {
  if (B.shake.me > 0) B.shake.me -= dt;
  if (B.shake.foe > 0) B.shake.foe -= dt;
  if (B.flashT > 0) B.flashT -= dt;
  if (B.intro > 0) B.intro -= dt;
  if (B.ballT > 0) B.ballT += dt;
  if (B.evoT > 0) B.evoT += dt;

  // HP bars chase their target so a big hit reads as a slide, not a jump.
  ['me', 'foe'].forEach((side) => {
    const d = B.target[side] - B.shown[side];
    if (Math.abs(d) < 0.6) B.shown[side] = B.target[side];
    else B.shown[side] += d * Math.min(1, dt * 7);
  });

  const settled = Math.abs(B.shown.me - B.target.me) < 0.6 && Math.abs(B.shown.foe - B.target.foe) < 0.6;

  // Whoever started the fight has queued the opening lines by now, so the
  // first frame of a battle is where the script starts reading itself out.
  if (B.phase === 'intro') { play(); return; }

  if (B.phase === 'text') {
    if (!B.cur) { nextEntry(); return; }
    B.wait -= dt;
    const hurried = (B.cur.text && (eat('ok') || eat('start')));
    if ((B.wait <= 0 && settled) || hurried) nextEntry();
    return;
  }

  if (B.phase === 'evolve') { updateEvolve(dt); return; }
  if (B.phase === 'learn') { updateLearn(); return; }

  if (B.phase === 'over') {
    if (eat('ok') || eat('start')) { Sound.ok(); leaveBattle(); }
    return;
  }

  if (B.phase === 'forceswap') {
    const opts = team().map((m, i) => i).filter((i) => alive(team()[i]));
    if (!opts.length) { B.result = { lost: true }; B.phase = 'over'; return; }
    if (eat('up')) { B.swapSel = (B.swapSel + opts.length - 1) % opts.length; Sound.cursor(); }
    if (eat('down')) { B.swapSel = (B.swapSel + 1) % opts.length; Sound.cursor(); }
    if (eat('ok')) {
      B.mine = opts[clamp(B.swapSel, 0, opts.length - 1)];
      B.mods.me = { atk: 0, def: 0, spd: 0 };
      B.shown.me = myMon().hp; B.target.me = myMon().hp;
      Sound.ok();
      B.script = [];
      push('Go, ' + nameOf(myMon()) + '!');
      after('menu');
      play();
    }
    return;
  }

  if (B.phase === 'menu') {
    const cols = 2;
    if (eat('left') && B.menu % cols) { B.menu--; Sound.cursor(); }
    if (eat('right') && B.menu % cols === 0) { B.menu++; Sound.cursor(); }
    if (eat('up') && B.menu >= cols) { B.menu -= cols; Sound.cursor(); }
    if (eat('down') && B.menu < cols) { B.menu += cols; Sound.cursor(); }
    if (eat('ok')) {
      Sound.ok();
      if (B.menu === 0) { B.phase = 'moves'; B.moveSel = 0; }
      else if (B.menu === 1) {
        if (B.exhibition) { Sound.deny(); flash('Sealed means sealed. No bag in here.'); return; }
        const usable = bagList();
        if (!usable.length) { Sound.deny(); flash('The bag is empty.'); return; }
        B.phase = 'bag'; B.bagSel = 0;
      } else if (B.menu === 2) {
        const bench = team().filter((m, i) => i !== B.mine && alive(m));
        if (!bench.length) { Sound.deny(); flash('Nothing else of yours can fight.'); return; }
        B.phase = 'swap';
        B.swapSel = team().findIndex((m, i) => i !== B.mine && alive(m));
      } else {
        takeTurn({ kind: 'run' });
      }
    }
    return;
  }

  if (B.phase === 'moves') {
    const moves = moveList(myMon());
    const n = moves.length;
    B.moveSel = clamp(B.moveSel, 0, n - 1);
    if (eat('up')) { B.moveSel = (B.moveSel + n - 1) % n; Sound.cursor(); }
    if (eat('down')) { B.moveSel = (B.moveSel + 1) % n; Sound.cursor(); }
    if (eat('left')) { B.moveSel = (B.moveSel + n - 1) % n; Sound.cursor(); }
    if (eat('right')) { B.moveSel = (B.moveSel + 1) % n; Sound.cursor(); }
    if (eat('back')) { B.phase = 'menu'; Sound.back(); }
    if (eat('ok')) {
      const slot = moves[B.moveSel];
      if (slot.pp <= 0) { Sound.deny(); flash('No PP left in that one.'); return; }
      Sound.ok();
      takeTurn({ kind: 'move', slot });
    }
    return;
  }

  if (B.phase === 'bag') {
    const list = bagList();
    if (!list.length) { B.phase = 'menu'; return; }
    const n = list.length;
    if (eat('up')) { B.bagSel = (B.bagSel + n - 1) % n; Sound.cursor(); }
    if (eat('down')) { B.bagSel = (B.bagSel + 1) % n; Sound.cursor(); }
    if (eat('back')) { B.phase = 'menu'; Sound.back(); }
    if (eat('ok')) {
      const name = list[clamp(B.bagSel, 0, n - 1)];
      if (ITEMS[name].kind === 'revive') { Sound.deny(); flash('Not in the middle of a fight.'); return; }
      Sound.ok();
      takeTurn({ kind: 'item', item: name });
    }
    return;
  }

  if (B.phase === 'swap') {
    const n = team().length;
    if (eat('up')) { B.swapSel = (B.swapSel + n - 1) % n; Sound.cursor(); }
    if (eat('down')) { B.swapSel = (B.swapSel + 1) % n; Sound.cursor(); }
    if (eat('back')) { B.phase = 'menu'; Sound.back(); }
    if (eat('ok')) {
      if (B.swapSel === B.mine) { Sound.deny(); flash('That one is already out.'); return; }
      if (!alive(team()[B.swapSel])) { Sound.deny(); flash('That one cannot fight.'); return; }
      Sound.ok();
      takeTurn({ kind: 'swap', index: B.swapSel });
    }
  }
}

/* ------------------------------------------------------- learning a move */

function startLearn() {
  B.learn = B.learnQueue.shift();
  B.learnSel = 0;
  B.phase = 'learn';
}

function updateLearn() {
  const n = 5;
  if (eat('up')) { B.learnSel = (B.learnSel + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { B.learnSel = (B.learnSel + 1) % n; Sound.cursor(); }
  if (eat('back')) { B.learnSel = 4; }
  if (eat('ok')) {
    Sound.ok();
    const l = B.learn;
    if (B.learnSel < 4) {
      const old = l.mon.moves[B.learnSel].name;
      l.mon.moves[B.learnSel] = { name: l.move, pp: Dex.move(l.move).pp };
      B.script = [];
      push(nameOf(l.mon) + ' forgot ' + old + ' and learned ' + l.move + '.');
      after(B.learnQueue.length ? 'learn' : (B.evoQueue.length ? 'evolve' : (B.result ? 'over' : 'menu')));
      play();
    } else {
      B.script = [];
      push(nameOf(l.mon) + ' did not learn ' + l.move + '.');
      after(B.learnQueue.length ? 'learn' : (B.evoQueue.length ? 'evolve' : (B.result ? 'over' : 'menu')));
      play();
    }
    B.learn = null;
  }
}

/* -------------------------------------------------------------- evolution */

function startEvolve() {
  B.evo = B.evoQueue.shift();
  B.evoT = 0.01;
  B.phase = 'evolve';
}

function updateEvolve(dt) {
  if (B.evoT < 2.6) {
    if (B.evoT > 1.2 && !B.evo.done) {
      B.evo.done = true;
      const m = B.evo.mon;
      const before = nameOf(m);
      m.species = B.evo.to;
      S.seen[m.species] = true;
      S.caught[m.species] = true;
      m.hp = Math.min(m.hp, maxHp(m));
      B.evo.before = before;
      Sound.levelup();
      // Anything the new shape already knows at this level and it does not.
      Dex.wildMoves(spOf(m), m.level).forEach((nm) => {
        if (m.moves.some((mv) => mv.name === nm)) return;
        if (m.moves.length < 4) m.moves.push({ name: nm, pp: Dex.move(nm).pp });
      });
    }
    return;
  }
  if (eat('ok') || eat('start') || B.evoT > 4.6) {
    B.script = [];
    push(B.evo.before + ' is a ' + nameOf(B.evo.mon) + ' now.');
    after(B.evoQueue.length ? 'evolve' : (B.result ? 'over' : 'menu'));
    B.evo = null; B.evoT = 0;
    play();
  }
}

/* ------------------------------------------------------------------- exit */

function leaveBattle() {
  B.on = false;
  const r = B.result || {};

  // A pack battle is an exhibition: the five you drafted go back in the box
  // they came out of, your own team was never in it, and losing costs the
  // entry fee you already paid and nothing else.
  if (B.exhibition) {
    const arena = B.arena || {};
    const tr = B.trainer;
    // Filed and forgotten: if the board is unreachable the match still
    // happened, so a failed report is a shrug rather than an error screen.
    if (arena.ladder) {
      try { Ladder.record(!!r.win).catch(() => {}); } catch (e) { /* board is optional */ }
    }
    B.team = null; B.exhibition = false; B.arena = null;
    go('world');
    Sound.playSong(map.song || 'town');
    if (r.win) {
      if (tr && tr.id) S.beaten[tr.id] = true;
      const n = npcs.find((x) => x.def.id === (tr && tr.id));
      if (n) n.beaten = true;
      save();
      talk(arena.winLines || ['That is the pack battle.']);
    } else {
      save();
      talk(arena.loseLines || ['Your five are down. The pack is spent.',
        'Buy another and draft better.']);
    }
    return;
  }

  if (r.lost && B.trainer && B.trainer.noPenalty) {
    healParty();
    save();
    go('world');
    Sound.playSong(map.song || 'town');
    talk(['BRAM: That is what I thought.',
      'BRAM: Do not sulk. Go and find something that can hit back.',
      'PROF. HOLLOW: He is insufferable and he is also going to lose eventually.',
      'Everything of yours is back on its feet.']);
    return;
  }

  if (r.lost) {
    const lost = Math.floor(S.money / 2);
    S.money -= lost;
    healParty();
    save();
    const at = S.healAt || { map: 'rookridge', x: 6, y: 6 };
    go('world');
    enterMap(at.map, at.x, at.y, 'down');
    talk(['Everything you had is down.',
      'You come round somewhere warm, ' + lost + ' coins lighter, with all of them back on their feet.']);
    return;
  }

  if (B.kind === 'trainer' && r.win && B.trainer) {
    if (B.trainer.id) S.beaten[B.trainer.id] = true;
    const n = B.trainer.npc;
    if (n) n.beaten = true;
  }
  if (B.legendFrom && (r.caught || r.win)) {
    S.flags['legend_' + (r.mon ? r.mon.species : '')] = true;
    if (r.win) S.flags.legendGone = true;
    const n = npcs.find((x) => x.def.id === B.legendFrom);
    if (n) n.beaten = true;
  }
  B.legendFrom = null;

  save();
  go('world');
  Sound.playSong(map.song || 'town');
  encounterCooldown = 0.8;

  if (B.trainer && B.trainer.leader && r.win) {
    talk(['The ' + B.trainer.badge + ' goes in the case with the others.',
      'Badges: ' + S.badges.length + ' of 3.']);
  }
}

/* --------------------------------------------------------- drawing a fight */

function drawBattle() {
  const t0 = Dex.TYPES[typesOf(foeMon())[0]];
  box(0, 0, W, H, '#0a0f1c');
  // Two washes, one per side, so the screen is split the way the fight is.
  box(0, 0, W, 108, t0.dark);
  const t1 = Dex.TYPES[typesOf(myMon())[0]];
  box(0, 108, W, 108, t1.dark);
  box(0, 104, W, 8, 'rgba(0,0,0,0.28)');

  // Ground shadows.
  box(268, 86, 76, 6, 'rgba(0,0,0,0.30)');
  box(44, 158, 84, 7, 'rgba(0,0,0,0.30)');

  const fs = B.shake.foe > 0 ? rnd(3) - 1 : 0;
  const ms = B.shake.me > 0 ? rnd(3) - 1 : 0;

  const foe = foeMon();
  if (!B.caught || B.ballT <= 0) {
    Art.mon(ctx, spOf(foe), foe.shiny, 272 + fs, 26, 64, true);
  }
  const me = myMon();
  const introSlide = B.intro > 0 ? -B.intro * 90 : 0;
  Art.mon(ctx, spOf(me), me.shiny, 48 + ms + introSlide, 98, 64, false);

  if (B.ballT > 0) drawBall();

  drawMonPanel(foe, 8, 14, true);
  drawMonPanel(me, 216, 112, false);

  if (B.flashT > 0) {
    ctx.globalAlpha = B.flashT * 2;
    box(0, 0, W, H, '#ffffff');
    ctx.globalAlpha = 1;
  }

  if (B.phase === 'evolve') { drawEvolve(); return; }
  if (B.phase === 'learn') { drawLearn(); return; }

  drawBattleBox();
}

function drawBall() {
  const k = Math.min(1, B.ballT / 0.5);
  const x = 60 + (300 - 60) * k;
  const y = 120 - Math.sin(k * Math.PI) * 60 + (k >= 1 ? 0 : 0);
  let bx = x, by = y;
  if (B.ballT > 0.5) {
    bx = 300; by = 66;
    const s = Math.floor((B.ballT - 0.5) / 0.45);
    const wob = s < B.ballShakes ? Math.sin((B.ballT - 0.5) * 16) * 4 : 0;
    bx += wob;
  }
  box(bx - 5, by - 5, 10, 10, '#0b0d14');
  box(bx - 4, by - 4, 8, 4, '#e2483c');
  box(bx - 4, by, 8, 4, '#eceff1');
  box(bx - 4, by - 1, 8, 1, '#0b0d14');
  box(bx - 1, by - 2, 3, 3, '#0b0d14');
  box(bx, by - 1, 1, 1, '#ffd166');
}

function drawMonPanel(m, x, y, isFoe) {
  const w = 160, h = isFoe ? 32 : 40;
  panel(x, y, w, h, '#101728', '#4d5f96');
  txt(nameOf(m), x + 5, y + 4, '#e8eefc', 1);
  txt('L' + m.level, x + w - 5, y + 4, '#9fb0d8', 1, 'right');

  const shown = isFoe ? B.shown.foe : B.shown.me;
  const frac = clamp(shown / maxHp(m), 0, 1);
  const col = frac > 0.5 ? '#5ce08a' : frac > 0.2 ? '#ffd166' : '#e2483c';
  txt('HP', x + 5, y + 14, '#7f8db5', 1);
  Art.bar(ctx, x + 18, y + 13, w - 24, 5, frac, col, '#2b3552');

  if (!isFoe) {
    txt(Math.max(0, Math.round(shown)) + '/' + maxHp(m), x + w - 5, y + 21, '#cfd8dc', 1, 'right');
    const xp = xpToNext(m);
    txt('XP', x + 5, y + 30, '#7f8db5', 1);
    Art.bar(ctx, x + 18, y + 30, w - 24, 3, clamp(xp.into / xp.span, 0, 1), '#5aa9f0', '#22304d');
  }
  if (m.status) {
    const s = { burn: 'BRN', para: 'PAR', sleep: 'SLP', poison: 'PSN' }[m.status] || '???';
    const c = { burn: '#ff7043', para: '#ffd54f', sleep: '#b39ddb', poison: '#9ccc65' }[m.status];
    box(x + 5, y + 20, 15, 7, c);
    txt(s, x + 7, y + 21, '#0b0d14', 1);
  }
  if (m.shiny) {
    const c = ['#fff59d', '#ffffff'][Math.floor(t * 4) % 2];
    box(x + w - 10, y + 22, 1, 3, c);
    box(x + w - 11, y + 23, 3, 1, c);
  }
}

function drawBattleBox() {
  const y = 160, h = 56;
  panel(0, y, W, h, '#101728', '#4d5f96');
  frame(2, y + 2, W - 4, h - 4, '#2b3c6b');

  if (B.phase === 'text' && B.cur) {
    wrapText(B.cur.text || '', 10, y + 10, W - 20, 11, '#e8eefc');
    if (B.cur.text && Math.floor(t * 3) % 2 === 0) {
      box(W - 14, y + h - 12, 5, 2, '#ffd166');
      box(W - 13, y + h - 10, 3, 2, '#ffd166');
    }
    return;
  }

  if (B.phase === 'menu') {
    wrapText('What will ' + nameOf(myMon()) + ' do?', 10, y + 12, 180, 11, '#e8eefc');
    const items = ['FIGHT', 'BAG', 'TEAM', 'RUN'];
    items.forEach((s, i) => {
      const ix = 216 + (i % 2) * 80, iy = y + 12 + Math.floor(i / 2) * 20;
      const on = B.menu === i;
      if (on) { box(ix - 5, iy - 4, 74, 15, '#243157'); frame(ix - 5, iy - 4, 74, 15, '#5aa9f0'); }
      txt(s, ix, iy, on ? '#ffffff' : '#9fb0d8', 1);
    });
    return;
  }

  if (B.phase === 'moves') {
    const moves = moveList(myMon());
    moves.forEach((slot, i) => {
      const d = Dex.move(slot.name);
      const ix = 12 + (i % 2) * 124, iy = y + 9 + Math.floor(i / 2) * 18;
      const on = B.moveSel === i;
      if (on) { box(ix - 5, iy - 4, 120, 16, '#243157'); frame(ix - 5, iy - 4, 120, 16, '#5aa9f0'); }
      txt(d.name, ix, iy, slot.pp > 0 ? (on ? '#ffffff' : '#c8d4f0') : '#6a7290', 1);
      txt(slot.struggle ? 'NO PP LEFT' : slot.pp + '/' + d.pp,
        ix + 114, iy, slot.struggle ? '#ffd166' : slot.pp > 0 ? '#7f8db5' : '#e2483c', 1, 'right');
    });
    const cur = Dex.move(moves[clamp(B.moveSel, 0, moves.length - 1)].name);
    const ty = Dex.TYPES[cur.type];
    Art.typeChip(ctx, cur.type, 266, y + 10, 1);
    txt(cur.power ? 'POWER ' + cur.power : 'NO DAMAGE', 266, y + 24, '#9fb0d8', 1);
    txt(cur.acc ? 'ACC ' + cur.acc : 'ALWAYS', 266, y + 32, '#9fb0d8', 1);
    txt('B TO GO BACK', 266, y + 42, '#5d6b92', 1);
    return;
  }

  if (B.phase === 'bag') {
    const list = bagList();
    txt('BAG', 10, y + 8, '#ffd166', 1);
    list.slice(0, 4).forEach((name, i) => {
      const on = B.bagSel === i;
      const iy = y + 18 + i * 9;
      if (on) box(8, iy - 2, 150, 10, '#243157');
      txt(name, 12, iy, on ? '#ffffff' : '#c8d4f0', 1);
      txt('x' + bagCount(name), 154, iy, '#7f8db5', 1, 'right');
    });
    const sel = list[clamp(B.bagSel, 0, list.length - 1)];
    if (sel) wrapText(ITEMS[sel].blurb, 172, y + 12, 200, 10, '#9fb0d8');
    txt('B TO GO BACK', 172, y + 44, '#5d6b92', 1);
    return;
  }

  if (B.phase === 'swap' || B.phase === 'forceswap') {
    txt(B.phase === 'forceswap' ? 'WHO GOES NEXT?' : 'SEND OUT WHICH?', 10, y + 8, '#ffd166', 1);
    const list = B.phase === 'forceswap'
      ? team().map((m, i) => i).filter((i) => alive(team()[i]))
      : team().map((m, i) => i);
    list.slice(0, 6).forEach((idx, row) => {
      const m = team()[idx];
      const on = B.swapSel === (B.phase === 'forceswap' ? row : idx);
      const ix = 10 + (row % 2) * 186, iy = y + 18 + Math.floor(row / 2) * 11;
      if (on) box(ix - 2, iy - 2, 180, 11, '#243157');
      const dead = !alive(m);
      Art.mon(ctx, spOf(m), m.shiny, ix, iy - 2, 10, false);
      txt(nameOf(m), ix + 12, iy, dead ? '#6a7290' : (on ? '#ffffff' : '#c8d4f0'), 1);
      txt('L' + m.level, ix + 104, iy, '#7f8db5', 1);
      txt(m.hp + '/' + maxHp(m), ix + 176, iy, dead ? '#e2483c' : '#9fb0d8', 1, 'right');
    });
    if (B.phase === 'swap') txt('B TO GO BACK', W - 10, y + h - 10, '#5d6b92', 1, 'right');
    return;
  }

  if (B.phase === 'over') {
    const r = B.result || {};
    const line = r.caught ? 'Caught.' : r.lost ? 'You are out of it.' : r.ran ? 'You got away.' : 'That is the fight.';
    wrapText(line, 10, y + 14, W - 20, 11, '#e8eefc');
    txt('PRESS A', W - 14, y + h - 12, '#ffd166', 1, 'right');
  }
}

function drawEvolve() {
  const k = B.evoT;
  box(0, 0, W, H, '#05070c');
  const m = B.evo.mon;
  const flashOn = k > 0.5 && k < 2.0 && Math.floor(k * 9) % 2 === 0;
  const size = 88;
  const x = W / 2 - size / 2, y = 44;
  if (flashOn) {
    ctx.globalAlpha = 0.9;
    Art.mon(ctx, spOf(m), m.shiny, x, y, size, false);
    ctx.globalAlpha = 1;
    box(x, y, size, size, 'rgba(255,255,255,0.55)');
  } else {
    Art.mon(ctx, spOf(m), m.shiny, x, y, size, false);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + k * 2;
    const r = 60 + Math.sin(k * 4 + i) * 10;
    box(W / 2 + Math.cos(a) * r, y + size / 2 + Math.sin(a) * r * 0.6, 2, 2, '#ffd166');
  }
  panel(0, 160, W, 56, '#101728', '#4d5f96');
  wrapText(k < 1.2 ? 'Something is happening.' : 'It is not what it was.', 10, 176, W - 20, 11, '#e8eefc');
}

function drawLearn() {
  const l = B.learn;
  panel(0, 128, W, 88, '#101728', '#4d5f96');
  frame(2, 130, W - 4, 84, '#2b3c6b');
  wrapText(nameOf(l.mon) + ' wants to learn ' + l.move + ', but it already knows four.',
    10, 136, W - 20, 10, '#e8eefc');
  txt('FORGET WHICH?', 10, 155, '#ffd166', 1);
  l.mon.moves.forEach((slot, i) => {
    const on = B.learnSel === i;
    const iy = 166 + i * 9;
    if (on) box(8, iy - 2, 190, 10, '#243157');
    txt(slot.name, 12, iy, on ? '#ffffff' : '#c8d4f0', 1);
    txt(Dex.move(slot.name).type, 192, iy, Dex.TYPES[Dex.move(slot.name).type].colour, 1, 'right');
  });
  const on = B.learnSel === 4;
  if (on) box(8, 200, 190, 10, '#243157');
  txt('KEEP THE FOUR IT HAS', 12, 202, on ? '#ffffff' : '#9fb0d8', 1);

  const nd = Dex.move(l.move);
  panel(210, 152, 166, 56, '#0d1424', '#39476e');
  txt(nd.name, 218, 158, '#ffd166', 1);
  Art.typeChip(ctx, nd.type, 218, 168, 1);
  txt(nd.power ? 'POWER ' + nd.power : 'NO DAMAGE', 218, 182, '#9fb0d8', 1);
  txt('PP ' + nd.pp + (nd.acc ? '   ACC ' + nd.acc : ''), 218, 192, '#9fb0d8', 1);
}

/* ==================================================================== menus */

const MENU_ITEMS = ['TEAM', 'BAG', 'DEX', 'TEAM CODE', 'LADDER', 'SAVE', 'SOUND', 'SPRITE LAB', 'HOW TO PLAY', 'BACK'];

function updateMenu() {
  const n = MENU_ITEMS.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('back') || eat('start')) { Sound.back(); go('world'); return; }
  if (eat('ok')) {
    Sound.ok();
    const item = MENU_ITEMS[ui.cursor];
    if (item === 'TEAM') { ui.cursor = 0; go('party'); }
    else if (item === 'BAG') { ui.cursor = 0; go('bag'); }
    else if (item === 'DEX') { ui.cursor = 0; go('dex'); }
    else if (item === 'TEAM CODE') {
      if (!S.party.length) { Sound.deny(); flash('You have nothing to write down.'); return; }
      ui.cursor = 0; go('code');
    }
    else if (item === 'LADDER') { openLadder(); }
    else if (item === 'SAVE') { flash(save() ? 'Saved.' : 'This browser will not keep it.'); }
    else if (item === 'SOUND') { muteFlash = 1.2; Sound.toggleMute(); }
    else if (item === 'SPRITE LAB') { save(); location.href = 'lab.html'; }
    else if (item === 'HOW TO PLAY') { go('help'); }
    else go('world');
  }
}

function drawMenu() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.55)');
  const w = 128, h = MENU_ITEMS.length * 12 + 34;
  const x = W - w - 8, y = 8;
  panel(x, y, w, h, '#101728', '#4d5f96');
  txt('MENU', x + 8, y + 7, '#ffd166', 1);
  txt(S.money + ' COINS', x + w - 8, y + 7, '#cfd8dc', 1, 'right');
  box(x + 6, y + 16, w - 12, 1, '#2b3c6b');
  MENU_ITEMS.forEach((s, i) => {
    const iy = y + 22 + i * 12;
    const on = ui.cursor === i;
    if (on) { box(x + 5, iy - 2, w - 10, 11, '#243157'); frame(x + 5, iy - 2, w - 10, 11, '#5aa9f0'); }
    txt(s, x + 10, iy, on ? '#ffffff' : '#9fb0d8', 1);
  });
  txt('BADGES ' + S.badges.length + '/3', x + 8, y + h - 10, '#5ce08a', 1);
}

/* ----------------------------------------------------------------- party */

function updateParty() {
  const n = S.party.length;
  if (eat('back') || eat('start')) { Sound.back(); go('menu'); return; }
  if (!n) return;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    Sound.ok();
    ui.detail = ui.detail === ui.cursor ? -1 : ui.cursor;
  }
}

function drawParty() {
  box(0, 0, W, H, '#0a0f1c');
  txt('YOUR TEAM', 10, 8, '#ffd166', 1);
  txt('A FOR DETAIL   B BACK', W - 10, 8, '#5d6b92', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  if (!S.party.length) {
    txt('Nothing yet. The lab is in Rookridge.', W / 2, 100, '#9fb0d8', 1, 'center');
    return;
  }

  S.party.forEach((m, i) => {
    const y = 24 + i * 30;
    const on = ui.cursor === i;
    panel(8, y, 200, 28, on ? '#1b2440' : '#131b2e', on ? '#5aa9f0' : '#39476e');
    Art.mon(ctx, spOf(m), m.shiny, 12, y + 4, 20, false);
    txt(nameOf(m), 36, y + 4, alive(m) ? '#e8eefc' : '#e2483c', 1);
    txt('L' + m.level, 196, y + 4, '#9fb0d8', 1, 'right');
    const frac = clamp(m.hp / maxHp(m), 0, 1);
    Art.bar(ctx, 36, y + 14, 120, 4, frac, frac > 0.5 ? '#5ce08a' : frac > 0.2 ? '#ffd166' : '#e2483c', '#2b3552');
    txt(m.hp + '/' + maxHp(m), 196, y + 13, '#9fb0d8', 1, 'right');
    let cx = 36;
    typesOf(m).forEach((ty) => { cx += Art.typeChip(ctx, ty, cx, y + 20, 1) + 3; });
    if (m.status) txt(m.status.toUpperCase(), 196, y + 21, '#ffd166', 1, 'right');
  });

  const m = S.party[clamp(ui.cursor, 0, S.party.length - 1)];
  const sp = spOf(m);
  panel(214, 24, W - 222, 184, '#101728', '#4d5f96');
  Art.mon(ctx, sp, m.shiny, 224, 32, 48, false);
  txt('#' + String(sp.no).padStart(2, '0'), 284, 34, '#5d6b92', 1);
  txt(sp.name, 284, 44, '#ffd166', 1);
  txt(Dex.RARITY[sp.rarity].name, 284, 54, Dex.RARITY[sp.rarity].colour, 1);
  txt(m.shiny ? 'UNUSUAL COLOUR' : '', 284, 64, '#fff59d', 1);

  let yy = 88;
  txt('ATK ' + statOf(m, 'atk'), 224, yy, '#cfd8dc', 1);
  txt('DEF ' + statOf(m, 'def'), 284, yy, '#cfd8dc', 1);
  txt('SPD ' + statOf(m, 'spd'), 334, yy, '#cfd8dc', 1);
  yy += 12;
  const xp = xpToNext(m);
  txt('NEXT LEVEL', 224, yy, '#7f8db5', 1);
  Art.bar(ctx, 286, yy, 70, 4, clamp(xp.into / xp.span, 0, 1), '#5aa9f0', '#22304d');
  yy += 14;
  box(222, yy, W - 238, 1, '#2b3c6b');
  yy += 6;
  m.moves.forEach((slot) => {
    const d = Dex.move(slot.name);
    txt(d.name, 224, yy, '#e8eefc', 1);
    txt(d.type, 320, yy, Dex.TYPES[d.type].colour, 1);
    txt(slot.pp + '/' + d.pp, W - 16, yy, slot.pp ? '#7f8db5' : '#e2483c', 1, 'right');
    yy += 10;
  });
  yy += 4;
  if (sp.evo) {
    txt(m.level >= sp.evo.lv ? 'READY TO CHANGE' : 'CHANGES AT LEVEL ' + sp.evo.lv,
      224, yy, m.level >= sp.evo.lv ? '#5ce08a' : '#5d6b92', 1);
    yy += 12;
  }
  wrapText(sp.dex, 224, yy, W - 240, 10, '#9fb0d8');
}

/* -------------------------------------------------------------------- bag */

function updateBag() {
  const list = bagList();
  if (eat('back') || eat('start')) { Sound.back(); go('menu'); return; }
  if (!list.length) return;
  const n = list.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    const name = list[clamp(ui.cursor, 0, n - 1)];
    const item = ITEMS[name];
    if (item.kind === 'ball') { Sound.deny(); flash('Nothing to throw it at.'); return; }
    if (!S.party.length) { Sound.deny(); return; }
    ui.useItem = name;
    ui.cursor2 = 0;
    Sound.ok();
    go('useitem');
  }
}

function drawBag() {
  box(0, 0, W, H, '#0a0f1c');
  txt('BAG', 10, 8, '#ffd166', 1);
  txt(S.money + ' COINS', W - 10, 8, '#cfd8dc', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');
  const list = bagList();
  if (!list.length) { txt('Empty.', W / 2, 100, '#9fb0d8', 1, 'center'); return; }
  list.forEach((name, i) => {
    const y = 26 + i * 13;
    const on = ui.cursor === i;
    if (on) { box(8, y - 3, 200, 13, '#243157'); frame(8, y - 3, 200, 13, '#5aa9f0'); }
    txt(name, 14, y, on ? '#ffffff' : '#c8d4f0', 1);
    txt('x' + bagCount(name), 202, y, '#9fb0d8', 1, 'right');
  });
  const sel = list[clamp(ui.cursor, 0, list.length - 1)];
  panel(214, 24, W - 222, 70, '#101728', '#4d5f96');
  txt(sel, 222, 32, '#ffd166', 1);
  wrapText(ITEMS[sel].blurb, 222, 44, W - 238, 10, '#cfd8dc');
  txt('A TO USE   B BACK', 222, 82, '#5d6b92', 1);
}

function updateUseItem() {
  const n = S.party.length;
  if (eat('back')) { Sound.back(); go('bag'); return; }
  if (eat('up')) { ui.cursor2 = (ui.cursor2 + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor2 = (ui.cursor2 + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    const m = S.party[clamp(ui.cursor2, 0, n - 1)];
    const item = ITEMS[ui.useItem];
    if (item.kind === 'heal') {
      if (!alive(m)) { Sound.deny(); flash('That one is down. Use a REVIVE.'); return; }
      if (m.hp >= maxHp(m) && !(item.cure && m.status)) { Sound.deny(); flash('Nothing to put back.'); return; }
      const gain = Math.min(maxHp(m) - m.hp, item.amount);
      m.hp += gain;
      if (item.cure) { m.status = ''; m.sleep = 0; }
      bagTake(ui.useItem);
      Sound.heal();
      flash(nameOf(m) + ' got ' + gain + ' HP back.');
    } else if (item.kind === 'cure') {
      if (!m.status) { Sound.deny(); flash('Nothing wrong with that one.'); return; }
      m.status = ''; m.sleep = 0;
      bagTake(ui.useItem);
      Sound.heal();
      flash(nameOf(m) + ' is itself again.');
    } else if (item.kind === 'revive') {
      if (alive(m)) { Sound.deny(); flash('That one is already up.'); return; }
      m.hp = Math.floor(maxHp(m) / 2);
      bagTake(ui.useItem);
      Sound.heal();
      flash(nameOf(m) + ' is back on its feet.');
    }
    save();
    if (!bagCount(ui.useItem)) { ui.cursor = 0; go('bag'); }
  }
}

function drawUseItem() {
  drawParty();
  box(0, 0, W, H, 'rgba(5,7,12,0.45)');
  panel(60, 70, 264, 78, '#101728', '#ffd166');
  txt('USE ' + ui.useItem + ' ON WHICH?', 72, 80, '#ffd166', 1);
  S.party.forEach((m, i) => {
    const y = 94 + i * 9;
    const on = ui.cursor2 === i;
    if (on) box(68, y - 2, 248, 10, '#243157');
    txt(nameOf(m), 74, y, on ? '#ffffff' : '#c8d4f0', 1);
    txt(m.hp + '/' + maxHp(m) + (m.status ? '  ' + m.status.toUpperCase() : ''),
      312, y, alive(m) ? '#9fb0d8' : '#e2483c', 1, 'right');
  });
}

/* -------------------------------------------------------------------- dex */

function updateDex() {
  const n = Dex.SPECIES.length;
  if (eat('back') || eat('start')) { Sound.back(); go('menu'); return; }
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('left')) { ui.cursor = clamp(ui.cursor - 8, 0, n - 1); Sound.cursor(); }
  if (eat('right')) { ui.cursor = clamp(ui.cursor + 8, 0, n - 1); Sound.cursor(); }
  const rows = 16;
  if (ui.cursor < ui.scroll) ui.scroll = ui.cursor;
  if (ui.cursor >= ui.scroll + rows) ui.scroll = ui.cursor - rows + 1;
}

function drawDex() {
  box(0, 0, W, H, '#0a0f1c');
  // Fusions are counted apart from the dex proper. There are 1089 of them and
  // listing them would bury the thirty-three the game is actually about, but
  // how many you have found is worth knowing — it is the other collection.
  const keys = Object.keys(S.caught);
  const fused = keys.filter((k) => Dex.isFusionId(k)).length;
  const caught = keys.length - fused;
  const seen = Object.keys(S.seen).filter((k) => !Dex.isFusionId(k)).length;
  txt('THE DEX', 10, 8, '#ffd166', 1);
  txt('CAUGHT ' + caught + '   SEEN ' + seen + '   OF ' + Dex.SPECIES.length,
    W - 10, 8, '#9fb0d8', 1, 'right');
  txt('FUSIONS FOUND ' + fused + ' OF ' + (Dex.SPECIES.length * Dex.SPECIES.length),
    10, 200, fused ? '#ce93d8' : '#3d4a6b', 1);
  box(8, 18, W - 16, 1, '#2b3c6b');

  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const idx = ui.scroll + i;
    if (idx >= Dex.SPECIES.length) break;
    const sp = Dex.SPECIES[idx];
    const y = 24 + i * 11;
    const on = ui.cursor === idx;
    if (on) { box(8, y - 2, 160, 11, '#243157'); frame(8, y - 2, 160, 11, '#5aa9f0'); }
    const got = S.caught[sp.id], sawIt = S.seen[sp.id];
    txt(String(sp.no).padStart(2, '0'), 12, y, '#5d6b92', 1);
    txt(got ? sp.name : sawIt ? sp.name : '----------', 30, y,
      got ? '#e8eefc' : sawIt ? '#9fb0d8' : '#3d4a6b', 1);
    if (got) box(160, y + 1, 4, 4, '#5ce08a');
    else if (sawIt) frame(160, y + 1, 4, 4, '#7f8db5');
  }

  const sp = Dex.SPECIES[clamp(ui.cursor, 0, Dex.SPECIES.length - 1)];
  panel(176, 24, W - 184, 184, '#101728', '#4d5f96');
  if (!S.seen[sp.id]) {
    txt('NOT SEEN YET', 176 + (W - 184) / 2, 110, '#3d4a6b', 1, 'center');
    return;
  }
  Art.mon(ctx, sp, false, 186, 32, 56, false);
  txt('#' + String(sp.no).padStart(2, '0'), 252, 34, '#5d6b92', 1);
  txt(sp.name, 252, 44, '#ffd166', 1);
  let cx = 252;
  sp.types.forEach((ty) => { cx += Art.typeChip(ctx, ty, cx, 54, 1) + 3; });
  txt(Dex.RARITY[sp.rarity].name, 252, 70, Dex.RARITY[sp.rarity].colour, 1);

  if (!S.caught[sp.id]) {
    txt('Seen in the wild. Not yours.', 186, 100, '#9fb0d8', 1);
    return;
  }
  let yy = 98;
  txt('HP  ' + sp.base.hp, 186, yy, '#cfd8dc', 1);
  txt('ATK ' + sp.base.atk, 246, yy, '#cfd8dc', 1);
  txt('DEF ' + sp.base.def, 300, yy, '#cfd8dc', 1);
  txt('SPD ' + sp.base.spd, 350, yy, '#cfd8dc', 1);
  yy += 14;
  if (sp.evo) {
    const to = Dex.byId(sp.evo.to);
    txt('BECOMES ' + to.name + ' AT ' + sp.evo.lv, 186, yy, '#5ce08a', 1);
    yy += 12;
  }
  yy = wrapText(sp.dex, 186, yy, W - 202, 10, '#9fb0d8') + 4;
  box(184, yy, W - 200, 1, '#2b3c6b');
  yy += 6;
  txt('LEARNS', 186, yy, '#7f8db5', 1);
  yy += 10;
  (sp.learn || []).slice(0, 8).forEach((e) => {
    txt('L' + String(e[0]).padStart(2, '0'), 186, yy, '#5d6b92', 1);
    txt(e[1], 210, yy, '#c8d4f0', 1);
    txt(Dex.move(e[1]).type, W - 16, yy, Dex.TYPES[Dex.move(e[1]).type].colour, 1, 'right');
    yy += 9;
  });
}

/* -------------------------------------------------------------------- box */

function openBox() { ui.tab = 0; ui.cursor = 0; go('box'); }

function updateBox() {
  const list = ui.tab === 0 ? S.party : S.box;
  const n = list.length;
  if (eat('back') || eat('start')) { Sound.back(); go('world'); return; }
  if (eat('left') && ui.tab === 1) { ui.tab = 0; ui.cursor = 0; Sound.cursor(); return; }
  if (eat('right') && ui.tab === 0) { ui.tab = 1; ui.cursor = 0; Sound.cursor(); return; }
  if (!n) return;
  const cols = ui.tab === 0 ? 1 : 5;
  if (eat('up')) { ui.cursor = (ui.cursor + n - cols) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + cols) % n; Sound.cursor(); }
  if (ui.tab === 1) {
    if (eat('left')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
    if (eat('right')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  }
  ui.cursor = clamp(ui.cursor, 0, n - 1);
  if (eat('ok')) {
    if (ui.tab === 0) {
      if (S.party.length <= 1) { Sound.deny(); flash('Keep one with you.'); return; }
      S.box.push(S.party.splice(ui.cursor, 1)[0]);
      ui.cursor = clamp(ui.cursor, 0, S.party.length - 1);
      Sound.keep();
    } else {
      if (S.party.length >= 6) { Sound.deny(); flash('Six is the limit.'); return; }
      S.party.push(S.box.splice(ui.cursor, 1)[0]);
      ui.cursor = clamp(ui.cursor, 0, Math.max(0, S.box.length - 1));
      Sound.keep();
    }
    save();
  }
}

function drawBox() {
  box(0, 0, W, H, '#0a0f1c');
  txt('THE BOX', 10, 8, '#ffd166', 1);
  txt('A MOVES   ARROWS SWITCH SIDES   B BACK', W - 10, 8, '#5d6b92', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  panel(8, 24, 150, 184, ui.tab === 0 ? '#1b2440' : '#101728', ui.tab === 0 ? '#5aa9f0' : '#39476e');
  txt('WITH YOU  ' + S.party.length + '/6', 16, 30, '#ffd166', 1);
  S.party.forEach((m, i) => {
    const y = 44 + i * 26;
    const on = ui.tab === 0 && ui.cursor === i;
    if (on) { box(12, y - 2, 142, 24, '#243157'); frame(12, y - 2, 142, 24, '#5aa9f0'); }
    Art.mon(ctx, spOf(m), m.shiny, 16, y, 20, false);
    txt(nameOf(m), 40, y + 1, '#e8eefc', 1);
    txt('L' + m.level, 148, y + 1, '#9fb0d8', 1, 'right');
    const frac = clamp(m.hp / maxHp(m), 0, 1);
    Art.bar(ctx, 40, y + 12, 100, 4, frac, frac > 0.5 ? '#5ce08a' : '#ffd166', '#2b3552');
  });

  panel(164, 24, W - 172, 184, ui.tab === 1 ? '#1b2440' : '#101728', ui.tab === 1 ? '#5aa9f0' : '#39476e');
  txt('IN THE BOX  ' + S.box.length, 172, 30, '#ffd166', 1);
  if (!S.box.length) txt('Nothing in here yet.', 172, 48, '#5d6b92', 1);
  S.box.forEach((m, i) => {
    if (i >= 35) return;
    const cx = 172 + (i % 5) * 40, cy = 42 + Math.floor(i / 5) * 24;
    const on = ui.tab === 1 && ui.cursor === i;
    if (on) { box(cx - 2, cy - 2, 38, 22, '#243157'); frame(cx - 2, cy - 2, 38, 22, '#5aa9f0'); }
    Art.mon(ctx, spOf(m), m.shiny, cx, cy, 18, false);
    txt('L' + m.level, cx + 20, cy + 6, '#9fb0d8', 1);
  });

  const cur = ui.tab === 0 ? S.party[ui.cursor] : S.box[ui.cursor];
  if (cur) {
    const sp = spOf(cur);
    txt(sp.name + '   ' + Dex.typeLabel(sp), 172, 198, '#c8d4f0', 1);
  }
}

/* ------------------------------------------------------------------- shop */

function updateShop() {
  const stock = SHOPS[ui.shopKind] || SHOPS.basic;
  const n = stock.length + 1;
  if (eat('back') || eat('start')) { Sound.back(); go('world'); return; }
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    if (ui.cursor >= stock.length) { Sound.back(); go('world'); return; }
    const name = stock[ui.cursor];
    const cost = ITEMS[name].cost;
    if (S.money < cost) { Sound.deny(); flash('Not enough coins.'); return; }
    S.money -= cost;
    bagAdd(name, 1);
    Sound.buy();
    flash('One ' + name + '. ' + S.money + ' left.');
    save();
  }
}

function drawShop() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.55)');
  const stock = SHOPS[ui.shopKind] || SHOPS.basic;
  const w = 200, h = stock.length * 14 + 54;
  const x = 20, y = 30;
  panel(x, y, w, h, '#101728', '#4d5f96');
  txt('FOR SALE', x + 10, y + 8, '#ffd166', 1);
  txt(S.money + ' COINS', x + w - 10, y + 8, '#cfd8dc', 1, 'right');
  box(x + 8, y + 18, w - 16, 1, '#2b3c6b');
  stock.forEach((name, i) => {
    const iy = y + 26 + i * 14;
    const on = ui.cursor === i;
    if (on) { box(x + 6, iy - 3, w - 12, 13, '#243157'); frame(x + 6, iy - 3, w - 12, 13, '#5aa9f0'); }
    txt(name, x + 12, iy, on ? '#ffffff' : '#c8d4f0', 1);
    txt(ITEMS[name].cost + '', x + w - 12, iy, S.money >= ITEMS[name].cost ? '#5ce08a' : '#e2483c', 1, 'right');
  });
  const iy = y + 26 + stock.length * 14;
  const on = ui.cursor === stock.length;
  if (on) { box(x + 6, iy - 3, w - 12, 13, '#243157'); frame(x + 6, iy - 3, w - 12, 13, '#5aa9f0'); }
  txt('THAT IS ALL', x + 12, iy, on ? '#ffffff' : '#9fb0d8', 1);

  const sel = stock[clamp(ui.cursor, 0, stock.length - 1)];
  panel(x + w + 10, y, W - x - w - 30, 80, '#101728', '#4d5f96');
  if (ui.cursor < stock.length) {
    txt(sel, x + w + 20, y + 8, '#ffd166', 1);
    wrapText(ITEMS[sel].blurb, x + w + 20, y + 22, W - x - w - 50, 10, '#cfd8dc');
    txt('YOU HAVE ' + bagCount(sel), x + w + 20, y + 62, '#9fb0d8', 1);
  }
}

/* ------------------------------------------------------------------ packs */

function rollRarity(odds) {
  let total = 0;
  Dex.RARITY_ORDER.forEach((r) => { total += odds[r] || 0; });
  let n = rand() * total;
  for (const r of Dex.RARITY_ORDER) {
    n -= odds[r] || 0;
    if (n <= 0) return r;
  }
  return 'common';
}

function makeCard(pack, rarity) {
  const poolR = rarity || rollRarity(pack.odds);
  const pool = Dex.pool(poolR);
  const sp = pool.length ? pick(pool) : pick(Dex.pool('common'));
  const lv = pack.level[0] + rnd(pack.level[1] - pack.level[0] + 1);
  return { species: sp.id, level: lv, shiny: rnd(pack.shiny) === 0 };
}

function openPack(pack) {
  const cards = [];
  const seen = {};
  for (let i = 0; i < pack.cards; i++) {
    let c = makeCard(pack);
    // Three of the same creature in one pack reads as a broken generator
    // rather than bad luck, so a third copy gets a few chances to be
    // something else before the pack gives up and prints it anyway.
    for (let tries = 0; tries < 6 && (seen[c.species] || 0) >= 2; tries++) c = makeCard(pack);
    seen[c.species] = (seen[c.species] || 0) + 1;
    cards.push(c);
  }
  if (pack.floor) {
    const floorIdx = Dex.RARITY_ORDER.indexOf(pack.floor);
    let bestIdx = 0, bestRank = -1;
    cards.forEach((c, i) => {
      const rank = Dex.RARITY_ORDER.indexOf(Dex.byId(c.species).rarity);
      if (rank > bestRank) { bestRank = rank; bestIdx = i; }
    });
    if (bestRank < floorIdx) cards[bestIdx] = makeCard(pack, pack.floor);
  }
  return cards;
}

function updatePacks() {
  const n = PACK_LIST.length + 1;
  if (eat('back') || eat('start')) { Sound.back(); go('world'); return; }
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    if (ui.cursor >= PACK_LIST.length) { Sound.back(); go('world'); return; }
    const pack = PACKS[PACK_LIST[ui.cursor]];
    if (S.money < pack.cost) { Sound.deny(); flash('Not enough coins.'); return; }
    S.money -= pack.cost;
    Sound.buy();
    ui.pack = pack;
    ui.cards = openPack(pack);
    ui.flipped = 0;
    ui.keep = ui.cards.map(() => false);
    ui.pickMode = 'keep';
    Sound.rip();
    go('rip');
  }
}

function drawPacks() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.55)');
  panel(16, 24, 180, 130, '#101728', '#4d5f96');
  txt('PACKS', 26, 32, '#ffd166', 1);
  txt(S.money + ' COINS', 186, 32, '#cfd8dc', 1, 'right');
  box(24, 42, 164, 1, '#2b3c6b');
  PACK_LIST.forEach((id, i) => {
    const p = PACKS[id];
    const y = 50 + i * 16;
    const on = ui.cursor === i;
    if (on) { box(22, y - 3, 168, 15, '#243157'); frame(22, y - 3, 168, 15, p.colour); }
    txt(p.name, 28, y, on ? '#ffffff' : '#c8d4f0', 1);
    txt(p.cost + '', 184, y, S.money >= p.cost ? '#5ce08a' : '#e2483c', 1, 'right');
  });
  const iy = 50 + PACK_LIST.length * 16;
  const on = ui.cursor === PACK_LIST.length;
  if (on) { box(22, iy - 3, 168, 15, '#243157'); frame(22, iy - 3, 168, 15, '#5aa9f0'); }
  txt('NOT TODAY', 28, iy, on ? '#ffffff' : '#9fb0d8', 1);

  const p = PACKS[PACK_LIST[clamp(ui.cursor, 0, PACK_LIST.length - 1)]];
  panel(206, 24, W - 222, 130, '#101728', '#4d5f96');
  if (ui.cursor < PACK_LIST.length) {
    txt(p.name, 216, 32, p.colour, 1);
    wrapText(p.blurb, 216, 46, W - 244, 10, '#cfd8dc');
    let y = 74;
    txt('ODDS', 216, y, '#7f8db5', 1); y += 10;
    Dex.RARITY_ORDER.forEach((r) => {
      if (!p.odds[r]) return;
      txt(Dex.RARITY[r].name, 216, y, Dex.RARITY[r].colour, 1);
      txt(p.odds[r] + '%', W - 26, y, '#9fb0d8', 1, 'right');
      y += 9;
    });
  }
  txt('Five is the limit on what you keep.', W / 2, 164, '#5d6b92', 1, 'center');
}

function cardCols(n) { return n <= 5 ? n : Math.ceil(n / 2); }

function updateRip() {
  if (eat('ok') || eat('start')) {
    if (ui.flipped < ui.cards.length) {
      const c = ui.cards[ui.flipped];
      S.seen[c.species] = true;
      Sound.reveal(Dex.byId(c.species).rarity);
      ui.flipped++;
    } else { Sound.ok(); ui.cursor = 0; go('pick'); }
  }
  if (eat('back') && ui.flipped < ui.cards.length) {
    let best = 'common';
    for (let i = ui.flipped; i < ui.cards.length; i++) {
      const r = Dex.byId(ui.cards[i].species).rarity;
      if (Dex.RARITY_ORDER.indexOf(r) > Dex.RARITY_ORDER.indexOf(best)) best = r;
      S.seen[ui.cards[i].species] = true;
    }
    ui.flipped = ui.cards.length;
    Sound.reveal(best);
  }
}

function layoutCards(n) {
  const cols = cardCols(n);
  const rows = Math.ceil(n / cols);
  const cw = 54, chh = 72, gap = 5;
  const totalW = cols * cw + (cols - 1) * gap;
  const totalH = rows * chh + (rows - 1) * gap;
  const x0 = (W - totalW) / 2, y0 = (H - totalH) / 2 + 6;
  return { cols, rows, cw, ch: chh, gap, x0, y0 };
}

function drawRip() {
  box(0, 0, W, H, '#0a0f1c');
  txt(ui.pack.name, W / 2, 8, ui.pack.colour, 1, 'center');
  const L = layoutCards(ui.cards.length);
  ui.cards.forEach((c, i) => {
    const x = L.x0 + (i % L.cols) * (L.cw + L.gap);
    const y = L.y0 + Math.floor(i / L.cols) * (L.ch + L.gap);
    if (i < ui.flipped) Art.card(ctx, c, x, y, L.cw, L.ch, { tick: Math.floor(t * 4) });
    else Art.cardBack(ctx, x, y, L.cw, L.ch);
  });
  if (ui.pickMode === 'draft') txt('SEED ' + seedCodeOf(ui.arena), W - 8, 8, '#ce93d8', 1, 'right');
  txt(ui.flipped < ui.cards.length ? 'A TO TURN THE NEXT ONE   B FOR ALL OF THEM' : 'A TO CHOOSE',
    W / 2, H - 12, '#9fb0d8', 1, 'center');
}

/* ============================================================ pack battles */
/* The shop's rules and the gym's stakes in the same room. Both sides tear a
 * sealed pack, keep five of what falls out, and fight with exactly that —
 * no team, no bag, no running. Levels are flattened to one number for the
 * whole match, so the thing that decides it is what you pulled and what you
 * knew to keep, rather than which of you spent longer in the long grass.
 *
 * It is the only mode in the game where a legendary is not an advantage you
 * earned. It is an advantage you were handed, and the person across from you
 * was handed one too. */

/* How badly a card wants to be kept, for the side that is not you. Rarity
 * first because rarity is raw numbers, then a nudge for anything that hits
 * the house type hard. */
function draftScore(card, wantType) {
  const sp = Dex.byId(card.species);
  let score = Dex.RARITY_ORDER.indexOf(sp.rarity) * 100;
  score += sp.base.hp + sp.base.atk + sp.base.def + sp.base.spd;
  if (wantType && sp.types.indexOf(wantType) >= 0) score += 120;
  return score;
}

/* The house pack. A gym's is stacked toward its own type, which is the whole
 * reason a LEAF gym is still a LEAF gym when nobody brought a team. */
/* A draft pack is the tier's odds over more cards than anybody gets to keep,
 * because five out of five is not a draft, it is an inventory. */
function draftPack(tier, count) {
  return Object.assign({}, PACKS[tier], { cards: count || DRAFT_CARDS });
}

const DRAFT_CARDS = 8;

/* Everything enters at fighting weight. The first build of this mode handed
 * one side a last-stage rare at the same level as everybody's first-stage
 * commons, and it walked through all five without being hit back — which is
 * not a draft, it is a lottery with extra steps. So a card's level is set
 * from what the card *is*: the heavier the species, the younger it comes in,
 * and what is left to decide the match is the chart and the five you kept. */
function fightingLevel(speciesId, target) {
  const sp = Dex.byId(speciesId);
  const total = sp.base.hp + sp.base.atk + sp.base.def + sp.base.spd;
  return clamp(Math.round(target * 250 / total), 5, 70);
}

function draftCards(pack, target) {
  return openPack(pack).map((c) => ({
    species: c.species,
    level: fightingLevel(c.species, target),
    shiny: c.shiny,
  }));
}

function housePack(setup) {
  const pack = draftPack(setup.foePack || setup.pack, setup.count);

  // All of the house's randomness sits inside one seeded run — the pack and
  // the type stacking both — or two people on the same seed would get the
  // same eight cards and a different opponent.
  const build = () => {
    const cards = draftCards(pack, setup.level);
    if (setup.type) {
      const pool = Dex.SPECIES.filter((s) => s.types.indexOf(setup.type) >= 0);
      const stack = Math.min(cards.length, setup.stack || 4);
      for (let i = 0; i < stack && pool.length; i++) {
        const sp = pick(pool);
        cards[i] = { species: sp.id, level: fightingLevel(sp.id, setup.level), shiny: false };
      }
    }
    return cards;
  };

  const seeded = setup.seed !== undefined && setup.seed !== null;
  const cards = seeded ? withSeed(setup.seed + 1, build) : build();

  cards.sort((a, b) => draftScore(b, setup.type) - draftScore(a, setup.type));
  return cards.slice(0, KEEP_MAX).map((c) => makeMon(c.species, c.level, { shiny: c.shiny }));
}

/* Every draft has a seed, whether you asked for one or not. A random entry
 * rolls one and shows it to you; a typed one reproduces somebody else's pack
 * exactly. The house draws from the seed too — one step along it — so two
 * people playing the same six characters face the same table. */
function beginDraft(setup) {
  if (setup.seed === undefined || setup.seed === null) setup.seed = Codes.randomSeed();
  ui.arena = setup;
  ui.pack = draftPack(setup.pack, setup.count);
  ui.cards = withSeed(setup.seed, () => draftCards(ui.pack, setup.level));
  ui.flipped = 0;
  ui.keep = ui.cards.map(() => false);
  ui.pickMode = 'draft';
  ui.cursor = 0;
  Sound.rip();
  go('rip');
}

/* The six characters that open this pack again, anywhere. */
function seedCodeOf(setup) {
  if (!setup || setup.seed === undefined || setup.seed === null) return '';
  return Codes.seedEncode(setup.tier || 0, setup.seed);
}

function startPackBattle(setup, mine) {
  B.arena = setup;
  B.foeParty = housePack(setup);
  B.foeIdx = 0;
  B.foe = B.foeParty[0];
  B.trainer = {
    id: setup.id, who: setup.who, name: setup.name,
    prize: setup.prize || 0, defeat: setup.defeat || ['...'],
    badge: setup.badge, leader: setup.leader, npc: setup.npc, noPenalty: true,
  };
  beginBattle('trainer', { team: mine, exhibition: true });
  push(setup.name + ' tears a pack open.');
  push(setup.name + ' keeps five and sends out ' + nameOf(B.foe) + '!');
  push('Go, ' + nameOf(myMon()) + '!');
  after('menu');
}

/* ------------------------------------------------------------- the arena */
/* The card shop's back room. Pay the fee, draft, and fight whatever the
 * house drafted out of the same tier. Endlessly repeatable, which is the
 * point: it is the only place in the game where the pack is the run. */

const ARENA_TIERS = [
  { id: 'scrub', name: 'SCRUB BRACKET', pack: 'scrub', level: 12, fee: 300, purse: 700,
    blurb: 'Eight cards each, keep five, level 12. Cheap seats, honest pack.' },
  { id: 'field', name: 'FIELD BRACKET', pack: 'field', level: 22, fee: 900, purse: 2200,
    blurb: 'Eight each at level 22, and an uncommon floor on both sides.' },
  { id: 'foil', name: 'FOIL BRACKET', pack: 'foil', level: 32, fee: 2200, purse: 5200,
    blurb: 'Eight each at level 32, a rare guaranteed. The house gets one too.' },
  { id: 'prism', name: 'PRISM BRACKET', pack: 'prism', level: 45, fee: 5000, purse: 12000,
    blurb: 'Eight each at level 45, an epic floor, and a real shot at a legendary.' },
];

const ARENA_FOES = ['rival', 'hiker', 'angler', 'picnicker', 'youngster', 'elder', 'clerk'];

function enterBracket(tierIdx, seed) {
  const t = ARENA_TIERS[tierIdx];
  if (S.money < t.fee) { Sound.deny(); flash('The fee is ' + t.fee + '.'); return false; }
  S.money -= t.fee;
  Sound.buy();
  const who = pick(ARENA_FOES);
  beginDraft({
    id: null, tier: tierIdx, seed, pack: t.pack, level: t.level, prize: t.purse,
    who, name: Folks.name(who),
    defeat: ['A better five. That is all it ever is.'],
    winLines: ['You took the bracket. The purse is yours.'],
    loseLines: ['The house drafted better.', 'Another pack is another draw.'],
  });
  return true;
}

function updateArena() {
  const n = ARENA_TIERS.length + 2;          // brackets, PLAY A SEED, leave
  if (eat('back') || eat('start')) { Sound.back(); go('world'); return; }
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    if (ui.cursor === ARENA_TIERS.length) {   // PLAY A SEED
      Sound.ok();
      beginCodeEntry('seed');
      return;
    }
    if (ui.cursor > ARENA_TIERS.length) { Sound.back(); go('world'); return; }
    enterBracket(ui.cursor);
  }
}

function drawArena() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.55)');
  panel(16, 20, 190, 150, '#101728', '#ce93d8');
  txt('PACK ARENA', 26, 28, '#ce93d8', 1);
  txt(S.money + ' COINS', 196, 28, '#cfd8dc', 1, 'right');
  box(24, 38, 174, 1, '#2b3c6b');
  ARENA_TIERS.forEach((t, i) => {
    const y = 46 + i * 18;
    const on = ui.cursor === i;
    if (on) { box(22, y - 3, 178, 17, '#243157'); frame(22, y - 3, 178, 17, '#ce93d8'); }
    txt(t.name, 28, y, on ? '#ffffff' : '#c8d4f0', 1);
    txt('FEE ' + t.fee, 28, y + 8, S.money >= t.fee ? '#5ce08a' : '#e2483c', 1);
    txt('WIN ' + t.purse, 194, y + 8, '#ffd166', 1, 'right');
  });
  const sy = 46 + ARENA_TIERS.length * 18;
  const onSeed = ui.cursor === ARENA_TIERS.length;
  if (onSeed) { box(22, sy - 3, 178, 13, '#243157'); frame(22, sy - 3, 178, 13, '#ce93d8'); }
  txt('PLAY A SEED', 28, sy, onSeed ? '#ffffff' : '#c8d4f0', 1);

  const iy = sy + 14;
  const on = ui.cursor === ARENA_TIERS.length + 1;
  if (on) { box(22, iy - 3, 178, 13, '#243157'); frame(22, iy - 3, 178, 13, '#5aa9f0'); }
  txt('NOT TODAY', 28, iy, on ? '#ffffff' : '#9fb0d8', 1);

  panel(214, 20, W - 230, 150, '#101728', '#4d5f96');
  const t = ARENA_TIERS[clamp(ui.cursor, 0, ARENA_TIERS.length - 1)];
  if (ui.cursor === ARENA_TIERS.length) {
    txt('PLAY A SEED', 222, 28, '#ce93d8', 1);
    let y = wrapText('Six characters that decide exactly which eight cards fall out '
      + 'of the pack.', 222, 42, W - 248, 10, '#cfd8dc') + 6;
    y = wrapText('Give somebody your seed and they open the same eight. Draft your '
      + 'five each, swap team codes, and fight the other one\'s draft.',
      222, y, W - 248, 10, '#9fb0d8') + 6;
    y = wrapText('The house draws from the seed too, so the table is the same on '
      + 'both sides of it.', 222, y, W - 248, 10, '#9fb0d8') + 8;
    txt('THE FEE IS THE BRACKET\'S OWN.', 222, y, '#5d6b92', 1);
  } else if (ui.cursor < ARENA_TIERS.length) {
    txt(t.name, 222, 28, '#ce93d8', 1);
    let y = wrapText(t.blurb, 222, 42, W - 248, 10, '#cfd8dc') + 6;
    box(220, y, W - 244, 1, '#2b3c6b'); y += 8;
    txt('BOTH SIDES TEAR ONE PACK', 222, y, '#9fb0d8', 1); y += 10;
    txt('EIGHT CARDS, KEEP FIVE', 222, y, '#9fb0d8', 1); y += 10;

    txt('LEVELS SET TO FIGHTING WEIGHT', 222, y, '#9fb0d8', 1); y += 10;
    txt('NO TEAM. NO BAG. NO RUNNING.', 222, y, '#ffd166', 1); y += 14;
    txt('THE DRAFT AND THE CHART DECIDE IT.', 222, y, '#5d6b92', 1);
  }
  txt('A TO ENTER   B TO LEAVE', W / 2, 182, '#5d6b92', 1, 'center');
}

/* ================================================================= ladder */
/* Other people's teams, and a way to fight them. Everything here is async in
 * a game that is otherwise entirely synchronous, so the scene holds a state
 * rather than a result: it is loading, or it has rows, or it has a reason it
 * has none. Every one of those three draws something.
 *
 * Nothing on this screen can hurt the save. A ladder fight is the same link
 * match a team code gives you — both sides whole, no experience, your own
 * team copied rather than used. */

const LAD = { phase: 'idle', rows: [], error: '', cursor: 0, busy: '', note: '' };

function openLadder() {
  LAD.cursor = 0; LAD.note = '';
  go('ladder');
  refreshLadder();
}

function refreshLadder() {
  const s = Ladder.state();
  if (!s.ok) { LAD.phase = 'off'; LAD.error = ''; LAD.rows = []; return; }
  LAD.phase = 'loading'; LAD.error = ''; LAD.rows = [];
  Ladder.list().then((rows) => {
    LAD.rows = rows;
    LAD.phase = 'ok';
    LAD.cursor = clamp(LAD.cursor, 0, Math.max(0, rows.length - 1));
  }).catch((e) => {
    LAD.phase = 'error';
    LAD.error = (e && e.message) || 'The board would not load.';
  });
}

function updateLadder() {
  if (eat('back') || eat('start')) { Sound.back(); go('menu'); return; }

  if (eat('right')) {                       // post or replace my team
    const s = Ladder.state();
    if (!s.ok) { Sound.deny(); return; }
    if (!S.party.length) { Sound.deny(); LAD.note = 'You have no team to post.'; return; }
    if (LAD.busy) return;
    Sound.ok();
    LAD.busy = 'posting';
    Ladder.post(Codes.encode(S.party), S.badges.length)
      .then(() => { LAD.busy = ''; LAD.note = 'Posted as ' + s.name + '.'; refreshLadder(); })
      .catch((e) => { LAD.busy = ''; LAD.note = (e && e.message) || 'That would not post.'; });
    return;
  }

  if (eat('left')) { Sound.cursor(); refreshLadder(); return; }

  if (LAD.phase !== 'ok' || !LAD.rows.length) return;

  const n = LAD.rows.length;
  if (eat('up')) { LAD.cursor = (LAD.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { LAD.cursor = (LAD.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    const row = LAD.rows[clamp(LAD.cursor, 0, n - 1)];
    if (!S.party.some(alive)) { Sound.deny(); LAD.note = 'Nothing of yours can stand up.'; return; }
    Sound.ok();
    ui.rival = Ladder.teamOf(row).map((c) => makeMon(c.species, c.level, { shiny: c.shiny }));
    ui.rivalCode = Codes.strip(row.code);
    ui.ladderFoe = row.username;
    startLinkBattle(ui.rival, row.username);
  }
}

function drawLadder() {
  box(0, 0, W, H, '#0a0f1c');
  txt('THE LADDER', 10, 8, '#ffd166', 1);
  const s = Ladder.state();
  txt(s.ok ? 'AS ' + s.name : 'NOT SIGNED IN', W - 10, 8, s.ok ? '#5ce08a' : '#5d6b92', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  if (LAD.phase === 'off') {
    panel(20, 40, W - 40, 110, '#101728', '#4d5f96');
    txt('THE BOARD IS NOT ON', 34, 50, '#e2483c', 1);
    let y = 66;
    Ladder.explain(Ladder.state().why).forEach((line) => {
      y = wrapText(line, 34, y, W - 68, 11, '#cfd8dc') + 4;
    });
    txt('B GOES BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
    return;
  }

  if (LAD.phase === 'loading') {
    txt('LOADING THE BOARD' + '.'.repeat(1 + Math.floor(t * 2) % 3), W / 2, 100, '#9fb0d8', 1, 'center');
    return;
  }

  if (LAD.phase === 'error') {
    panel(20, 50, W - 40, 80, '#101728', '#e2483c');
    txt('THE BOARD WOULD NOT LOAD', 34, 60, '#e2483c', 1);
    wrapText(LAD.error, 34, 76, W - 68, 11, '#cfd8dc');
    txt('LEFT TRIES AGAIN   B GOES BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
    return;
  }

  if (!LAD.rows.length) {
    txt('Nobody has posted a team yet.', W / 2, 90, '#9fb0d8', 1, 'center');
    txt('RIGHT POSTS YOURS', W / 2, 106, '#5ce08a', 1, 'center');
    txt('B GOES BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
    return;
  }

  // The board.
  panel(8, 26, 186, 172, '#101728', '#4d5f96');
  txt('W-L', 140, 32, '#7f8db5', 1);
  txt('BADGES', 188, 32, '#7f8db5', 1, 'right');
  const rows = Math.min(12, LAD.rows.length);
  const from = clamp(LAD.cursor - 5, 0, Math.max(0, LAD.rows.length - rows));
  for (let i = 0; i < rows; i++) {
    const idx = from + i;
    const row = LAD.rows[idx];
    const y = 44 + i * 12;
    const on = LAD.cursor === idx;
    if (on) { box(12, y - 3, 178, 12, '#243157'); frame(12, y - 3, 178, 12, '#5aa9f0'); }
    txt(String(idx + 1).padStart(2, '0'), 16, y, '#5d6b92', 1);
    txt(row.username.slice(0, 14), 34, y, on ? '#ffffff' : '#c8d4f0', 1);
    txt((row.wins | 0) + '-' + (row.losses | 0), 140, y, '#9fb0d8', 1);
    txt(String(row.badges | 0), 188, y, '#5ce08a', 1, 'right');
  }

  // Whoever is under the cursor, drawn out.
  const row = LAD.rows[clamp(LAD.cursor, 0, LAD.rows.length - 1)];
  const team = Ladder.teamOf(row);
  panel(200, 26, W - 208, 172, '#101728', '#4d5f96');
  txt(row.username.slice(0, 16), 210, 34, '#ffd166', 1);
  txt((row.wins | 0) + ' W   ' + (row.losses | 0) + ' L', W - 16, 34, '#9fb0d8', 1, 'right');
  box(208, 46, W - 224, 1, '#2b3c6b');
  team.slice(0, 6).forEach((c, i) => {
    const sp = Dex.byId(c.species);
    const x = 210 + (i % 3) * 56, y = 54 + Math.floor(i / 3) * 46;
    Art.mon(ctx, sp, c.shiny, x, y, 32, false);
    txt(sp.name.slice(0, 9), x, y + 34, '#c8d4f0', 1);
    txt('L' + c.level, x, y + 42, '#7f8db5', 1);
  });

  txt(LAD.busy ? 'POSTING...' : (LAD.note || 'A FIGHTS THEM   RIGHT POSTS YOURS   LEFT REFRESHES'),
    W / 2, H - 10, LAD.note ? '#ffd166' : '#5d6b92', 1, 'center');
}

/* ================================================================= splicer */
/* Two of yours in, one of yours out — the head of the first on the body of
 * the second. Thirty-three creatures make one thousand and eighty-nine of
 * these, so the interesting question stops being "what did you catch" and
 * becomes "what did you think to put together".
 *
 * A splice is reversible. The machine remembers what went in, and feeding a
 * fusion back gives you both halves at the level the fusion reached, because
 * a mechanic that can only destroy things is one people stop touching. */

const SPL = { stage: 0, head: -1, body: -1, cursor: 0, note: '' };

function openSplicer() {
  SPL.stage = 0; SPL.head = -1; SPL.body = -1; SPL.cursor = 0; SPL.note = '';
  go('splice');
}

function splicedMon(headMon, bodyMon) {
  const sp = Dex.fuse(spOf(headMon).id, spOf(bodyMon).id);
  if (!sp) return null;
  const level = Math.max(headMon.level, bodyMon.level);
  const m = makeMon(sp.id, level, { shiny: headMon.shiny || bodyMon.shiny });
  // Carry across whatever of the two was in better shape, proportionally.
  const frac = Math.max(headMon.hp / maxHp(headMon), bodyMon.hp / maxHp(bodyMon));
  m.hp = Math.max(1, Math.round(maxHp(m) * frac));
  return m;
}

function updateSplice() {
  const n = S.party.length;

  if (eat('back') || eat('start')) {
    if (SPL.stage === 0) { Sound.back(); go('world'); return; }
    SPL.stage--; SPL.note = ''; Sound.back();
    SPL.cursor = clamp(SPL.cursor, 0, Math.max(0, n - 1));
    return;
  }

  if (SPL.stage === 2) {
    if (eat('ok')) {
      const head = S.party[SPL.head], body = S.party[SPL.body];
      const made = splicedMon(head, body);
      if (!made) { Sound.deny(); SPL.note = 'Those two will not go together.'; return; }
      // Out with two, in with one, at the slot the head came from.
      const keep = Math.min(SPL.head, SPL.body);
      S.party = S.party.filter((m, i) => i !== SPL.head && i !== SPL.body);
      S.party.splice(clamp(keep, 0, S.party.length), 0, made);
      S.seen[made.species] = true; S.caught[made.species] = true;
      Sound.levelup();
      save();
      go('world');
      talk(['The machine runs for a moment and stops.',
        'It is a ' + nameOf(made) + ' now — the head of a ' + spOf(head).name
          + ' on the body of a ' + spOf(body).name + '.',
        'Bring it back any time and it comes apart again.']);
    }
    return;
  }

  if (!n) return;
  if (eat('up')) { SPL.cursor = (SPL.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { SPL.cursor = (SPL.cursor + 1) % n; Sound.cursor(); }

  if (eat('ok')) {
    const m = S.party[SPL.cursor];
    const sp = spOf(m);

    // A fusion on its own comes apart instead.
    if (sp.fusion && SPL.stage === 0) {
      if (S.party.length >= 6) { Sound.deny(); SPL.note = 'No room for two. Leave one behind first.'; return; }
      const head = makeMon(sp.headId, m.level, { shiny: m.shiny });
      const body = makeMon(sp.bodyId, m.level, { shiny: m.shiny });
      S.party.splice(SPL.cursor, 1, head, body);
      Sound.levelup();
      save();
      go('world');
      talk([nameOf(m) + ' comes apart on the table.',
        'A ' + spOf(head).name + ' and a ' + spOf(body).name + ', both at level ' + m.level + '.']);
      return;
    }

    if (SPL.stage === 0) {
      SPL.head = SPL.cursor; SPL.stage = 1; SPL.note = ''; Sound.ok();
      SPL.cursor = (SPL.cursor + 1) % n;
      return;
    }
    if (SPL.cursor === SPL.head) { Sound.deny(); SPL.note = 'It cannot be spliced with itself.'; return; }
    if (sp.fusion) { Sound.deny(); SPL.note = 'A fusion cannot be spliced again.'; return; }
    SPL.body = SPL.cursor; SPL.stage = 2; SPL.note = ''; Sound.ok();
  }
}

function drawSplice() {
  box(0, 0, W, H, '#0a0f1c');
  const titles = ['CHOOSE THE HEAD', 'CHOOSE THE BODY', 'LIKE THIS?'];
  txt('THE SPLICER', 10, 8, '#ce93d8', 1);
  txt(titles[SPL.stage], W - 10, 8, '#ffd166', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  // The team, down the left.
  panel(8, 26, 150, 182, '#101728', '#4d5f96');
  if (!S.party.length) txt('Nothing to splice.', 16, 36, '#5d6b92', 1);
  S.party.forEach((m, i) => {
    const y = 34 + i * 28;
    const on = SPL.cursor === i && SPL.stage < 2;
    const chosen = i === SPL.head || i === SPL.body;
    if (on) { box(12, y - 3, 142, 26, '#243157'); frame(12, y - 3, 142, 26, '#5aa9f0'); }
    else if (chosen) frame(12, y - 3, 142, 26, '#ce93d8');
    Art.mon(ctx, spOf(m), m.shiny, 16, y, 22, false);
    txt(nameOf(m).slice(0, 11), 42, y, spOf(m).fusion ? '#ce93d8' : '#e8eefc', 1);
    txt('L' + m.level, 150, y, '#9fb0d8', 1, 'right');
    let cx = 42;
    typesOf(m).forEach((ty) => { cx += Art.typeChip(ctx, ty, cx, y + 11, 1) + 2; });
    if (i === SPL.head) txt('HEAD', 150, y + 12, '#ce93d8', 1, 'right');
    if (i === SPL.body) txt('BODY', 150, y + 12, '#ce93d8', 1, 'right');
  });

  // What comes out, down the right.
  panel(164, 26, W - 172, 182, '#101728', SPL.stage === 2 ? '#ce93d8' : '#4d5f96');
  const head = SPL.head >= 0 ? S.party[SPL.head] : null;
  const body = SPL.stage >= 1 && SPL.cursor !== SPL.head
    ? S.party[SPL.stage === 2 ? SPL.body : SPL.cursor] : null;

  if (!head) {
    wrapText('Pick one to be the head. It brings the attack, the speed, the first type '
      + 'and the top of the drawing.', 174, 38, W - 190, 11, '#9fb0d8');
    wrapText('Pick a fusion on its own and the machine takes it apart instead.',
      174, 80, W - 190, 11, '#5d6b92');
    txt('A CHOOSES   B GOES BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
    return;
  }

  const preview = body && !spOf(body).fusion && !spOf(head).fusion
    ? Dex.fuse(spOf(head).id, spOf(body).id) : null;

  if (!preview) {
    wrapText('Now pick one to be the body: the health, the defence, the second type '
      + 'and everything below the neck.', 174, 38, W - 190, 11, '#9fb0d8');
    if (SPL.note) txt(SPL.note, 174, 86, '#e2483c', 1);
    txt('A CHOOSES   B GOES BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
    return;
  }

  Art.mon(ctx, preview, head.shiny || body.shiny, 174, 34, 64, false);
  txt(preview.name, 246, 38, '#ce93d8', 1);
  let cx = 246;
  preview.types.forEach((ty) => { cx += Art.typeChip(ctx, ty, cx, 50, 1) + 3; });
  txt('LEVEL ' + Math.max(head.level, body.level), 246, 66, '#9fb0d8', 1);
  txt('FROM ' + spOf(head).name + ' AND ' + spOf(body).name, 246, 78, '#5d6b92', 1);

  // Base stats, with each parent's underneath so the trade is visible.
  let y = 110;
  txt('HP  ATK  DEF  SPD', 174, y, '#7f8db5', 1); y += 11;
  const row = (label, o, col) => {
    txt(label, 174, y, col, 1);
    txt(String(o.hp), 236, y, col, 1, 'right');
    txt(String(o.atk), 268, y, col, 1, 'right');
    txt(String(o.def), 300, y, col, 1, 'right');
    txt(String(o.spd), 332, y, col, 1, 'right');
    y += 11;
  };
  row('HEAD', spOf(head).base, '#5d6b92');
  row('BODY', spOf(body).base, '#5d6b92');
  row('FUSED', preview.base, '#5ce08a');

  y += 6;
  wrapText(preview.dex, 174, y, W - 190, 10, '#9fb0d8');

  txt(SPL.stage === 2 ? 'A SPLICES THEM   B GOES BACK' : 'A CHOOSES   B GOES BACK',
    W / 2, H - 10, SPL.stage === 2 ? '#5ce08a' : '#5d6b92', 1, 'center');
}

/* ------------------------------------------------------- what you drafted */
/* The moment between keeping five and fighting with them, which exists so
 * there is somewhere to read your five back and, more to the point, somewhere
 * to copy the code for them down. Two people on one seed meet here. */

function updateDrafted() {
  if (eat('up')) { ui.cursor = ui.cursor ? 0 : 1; Sound.cursor(); }
  if (eat('down')) { ui.cursor = ui.cursor ? 0 : 1; Sound.cursor(); }
  if (eat('back') || eat('start') || eat('ok')) {
    Sound.ok();
    startPackBattle(ui.arena, ui.drafted);
  }
}

function drawDrafted() {
  box(0, 0, W, H, '#0a0f1c');
  txt('YOUR FIVE', 10, 8, '#ce93d8', 1);
  txt('SEED ' + seedCodeOf(ui.arena), W - 10, 8, '#ce93d8', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  ui.drafted.forEach((m, i) => {
    const x = 10 + i * 75, y = 26;
    panel(x, y, 70, 68, '#131b2e', '#39476e');
    Art.mon(ctx, spOf(m), m.shiny, x + 11, y + 4, 48, false);
    txt(nameOf(m).slice(0, 10), x + 35, y + 54, '#e8eefc', 1, 'center');
    txt('L' + m.level, x + 35, y + 62, '#9fb0d8', 1, 'center');
  });

  panel(20, 104, W - 40, 34, '#131b2e', '#ffd166');
  txt('THE CODE FOR THESE FIVE', W / 2, 110, '#7f8db5', 1, 'center');
  txs(Codes.format(ui.draftCode), W / 2, 122, '#ffd166', 1, 'center');

  wrapText('Send that to whoever else opened this seed and they can fight the five you kept. '
    + 'Their code does the same for you, from the TEAM CODE menu.',
    20, 146, W - 40, 11, '#9fb0d8');

  txt('A FIGHTS THE HOUSE WITH THEM', W / 2, H - 12, '#5ce08a', 1, 'center');
}

/* ------------------------------------------------------ a two-way question */
/* Used where the game needs an answer rather than an acknowledgement — which
 * of two fights a gym leader is being asked for, mostly. */

function ask(title, options, after) {
  ui.ask = { title, options, after };
  ui.cursor = 0;
  go('ask');
}

function updateAsk() {
  const n = ui.ask.options.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('back')) { Sound.back(); go('world'); return; }
  if (eat('ok')) {
    Sound.ok();
    const pickIdx = clamp(ui.cursor, 0, n - 1);
    const fn = ui.ask.after;
    go('world');
    fn(pickIdx);
  }
}

function drawAsk() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.5)');
  const opts = ui.ask.options;
  const w = 250, h = 34 + opts.length * 22;
  const x = (W - w) / 2, y = (H - h) / 2;
  panel(x, y, w, h, '#101728', '#ffd166');
  txt(ui.ask.title, x + w / 2, y + 8, '#ffd166', 1, 'center');
  box(x + 8, y + 18, w - 16, 1, '#2b3c6b');
  opts.forEach((o, i) => {
    const iy = y + 26 + i * 22;
    const on = ui.cursor === i;
    if (on) { box(x + 6, iy - 3, w - 12, 20, '#243157'); frame(x + 6, iy - 3, w - 12, 20, '#5aa9f0'); }
    txt(o.name, x + 12, iy, on ? '#ffffff' : '#c8d4f0', 1);
    txt(o.note || '', x + 12, iy + 9, '#7f8db5', 1);
  });
}

function keptCount() { return ui.keep.filter(Boolean).length; }

function updatePick() {
  const n = ui.cards.length;
  const cols = cardCols(n);
  if (eat('left')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('right')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('up')) { ui.cursor = (ui.cursor + n - cols) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + cols) % n; Sound.cursor(); }
  if (eat('ok')) {
    const i = ui.cursor;
    if (ui.keep[i]) { ui.keep[i] = false; Sound.drop(); }
    else if (keptCount() >= KEEP_MAX) { Sound.deny(); flash('Five is the limit. That is the deal.'); }
    else { ui.keep[i] = true; Sound.keep(); }
  }
  if (eat('start') || eat('back')) {
    if (!keptCount()) { Sound.deny(); flash('Keep at least one.'); return; }
    Sound.ok();

    // A draft is the same five decisions with none of the ownership: the
    // cards become a side for one fight and are gone afterwards.
    if (ui.pickMode === 'draft') {
      const mine = [];
      ui.cards.forEach((c, i) => {
        if (ui.keep[i]) mine.push(makeMon(c.species, c.level, { shiny: c.shiny }));
      });
      // The five you kept get a code of their own, so the other half of a
      // shared seed is "now send me yours" rather than "describe them to me".
      ui.drafted = mine;
      ui.draftCode = Codes.encode(mine);
      ui.cursor = 0;
      go('drafted');
      return;
    }

    let coins = 0, toBox = 0;
    ui.cards.forEach((c, i) => {
      if (ui.keep[i]) {
        const m = makeMon(c.species, c.level, { shiny: c.shiny });
        if (addMon(m) === 'box') toBox++;
      } else coins += Dex.RARITY[Dex.byId(c.species).rarity].rip;
    });
    S.money += coins;
    save();
    go('world');
    talk(['The ones you kept are yours.' + (toBox ? ' ' + toBox + ' went to the box.' : ''),
      'The rest come apart for ' + coins + ' coins.']);
  }
}

function drawPick() {
  const draft = ui.pickMode === 'draft';
  box(0, 0, W, H, '#0a0f1c');
  txt(draft ? 'DRAFT FIVE' : 'KEEP FIVE', W / 2, 6, draft ? '#ce93d8' : '#ffd166', 1, 'center');
  if (draft) txt('SEED ' + seedCodeOf(ui.arena), W - 8, 6, '#ce93d8', 1, 'right');
  txt(keptCount() + ' OF ' + KEEP_MAX, W / 2, 16, keptCount() >= KEEP_MAX ? '#5ce08a' : '#9fb0d8', 1, 'center');
  const L = layoutCards(ui.cards.length);
  ui.cards.forEach((c, i) => {
    const x = L.x0 + (i % L.cols) * (L.cw + L.gap);
    const y = L.y0 + Math.floor(i / L.cols) * (L.ch + L.gap);
    Art.card(ctx, c, x, y, L.cw, L.ch, { kept: ui.keep[i], cursor: ui.cursor === i, tick: Math.floor(t * 4) });
  });
  txt(draft ? 'A DRAFTS OR DROPS   START WHEN YOUR FIVE ARE SET'
    : 'A KEEPS OR DROPS   START WHEN YOU ARE DONE', W / 2, H - 10, '#5d6b92', 1, 'center');
}

/* ---------------------------------------------------------------- starter */

const STARTERS = ['spriglet', 'cindpup', 'puddlet'];
const RIVAL_PICK = { spriglet: 'cindpup', cindpup: 'puddlet', puddlet: 'spriglet' };

function updateStarter() {
  const n = STARTERS.length;
  if (eat('left')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('right')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('back')) { Sound.back(); go('world'); return; }
  if (eat('ok')) {
    const id = STARTERS[ui.cursor];
    Sound.win();
    const m = makeMon(id, 5);
    S.party.push(m);
    S.seen[id] = true; S.caught[id] = true;
    S.flags.gotStarter = true;
    S.starter = id;
    S.rival = RIVAL_PICK[id];
    save();
    go('world');
    buildNpcs();
    talk([
      'You take ' + Dex.byId(id).name + '.',
      'PROF. HOLLOW: Good. That is the one you picked, so that is the one that is right.',
      'BRAM: Then I will have the one that beats it.',
      'BRAM: Come on. Right here, right now.',
    ], startRivalBattle);
  }
}

function startRivalBattle() {
  const lvl = 5;
  B.foeParty = [makeMon(S.rival, lvl, { shiny: false })];
  B.foeIdx = 0;
  B.foe = B.foeParty[0];
  B.trainer = {
    id: 'rival1', who: 'rival', name: Folks.name('rival'), prize: 300,
    defeat: ['BRAM: Fine. You got the better end of it.',
      'BRAM: I am going on ahead. Try to keep up.'],
    npc: null,
    // The first fight in the game is the one you are least equipped to win,
    // so it does not take anything off you. Bram gets to be smug instead.
    noPenalty: true,
  };
  beginBattle('trainer');
  push('BRAM sent out ' + nameOf(B.foe) + '!');
  push('Go, ' + nameOf(myMon()) + '!');
  after('menu');
}

function drawStarter() {
  drawWorld();
  box(0, 0, W, H, 'rgba(5,7,12,0.65)');
  panel(16, 26, W - 32, 164, '#101728', '#ffd166');
  txt('THREE ON THE TABLE', W / 2, 34, '#ffd166', 1, 'center');

  STARTERS.forEach((id, i) => {
    const sp = Dex.byId(id);
    const cw = 104;
    const x = 28 + i * (cw + 8);
    const on = ui.cursor === i;
    panel(x, 48, cw, 104, on ? '#1b2440' : '#131b2e', on ? '#5aa9f0' : '#39476e');
    Art.mon(ctx, sp, false, x + (cw - 48) / 2, 54, 48, false);
    txt(sp.name, x + cw / 2, 106, on ? '#ffffff' : '#c8d4f0', 1, 'center');
    const chipW = Art.width(sp.types[0], 1) + 5;
    Art.typeChip(ctx, sp.types[0], x + (cw - chipW) / 2, 116, 1);
    txt('HP ' + sp.base.hp + '  ATK ' + sp.base.atk, x + cw / 2, 132, '#9fb0d8', 1, 'center');
    txt('DEF ' + sp.base.def + '  SPD ' + sp.base.spd, x + cw / 2, 141, '#9fb0d8', 1, 'center');
  });

  const sp = Dex.byId(STARTERS[clamp(ui.cursor, 0, 2)]);
  wrapText(sp.dex, 28, 160, W - 56, 10, '#cfd8dc');
  txt('A TO TAKE IT', W / 2, 182, '#5d6b92', 1, 'center');
}

/* ------------------------------------------------------------------ title */

function updateTitle() {
  if (eat('ok') || eat('start')) {
    Sound.unlock();
    Sound.ok();
    if (!S) {
      newGame();
      go('world');
      enterMap('house', 5, 5, 'down');
      talk(['You slept through the alarm again.',
        'Downstairs, then out. The lab has been asking for you.']);
    } else {
      go('world');
      enterMap(S.map, S.x, S.y, S.dir);
    }
  }
}

function drawTitle() {
  box(0, 0, W, H, '#080c18');
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W, y = (i * 53) % 90;
    box(x, y, 1, 1, i % 3 ? '#1c2a4a' : '#2b3c6b');
  }
  box(0, 120, W, 96, '#13301c');
  box(0, 120, W, 2, '#1d4527');
  for (let x = 0; x < W; x += 16) Art.tile(ctx, x % 32 ? 'tall' : 'grass', x, 168);
  for (let x = 0; x < W; x += 16) Art.tile(ctx, 'tree', x, 120);

  const bob = Math.sin(t * 2) * 2;
  Art.mon(ctx, Dex.byId('cindpup'), false, 40, 96 + bob, 48, false);
  Art.mon(ctx, Dex.byId('spriglet'), false, W - 96, 96 - bob, 48, true);
  Folks.draw(ctx, 'player', 'down', Math.floor(t * 4) % 2, W / 2 - 16, 104, 32);

  // The accent is in the page title and the catalogue, where there are real
  // fonts. Up here there are twenty-six letters and ten digits, so it is
  // POKEMON, and the lockup does the work the accent would have done.
  txs('POKEMON', W / 2, 20, '#e2483c', 2, 'center');
  txs('RIP AND GO', W / 2, 34, '#ffd166', 3, 'center');
  txt('A FAN-MADE CREATURE COLLECTOR', W / 2, 60, '#9fb0d8', 1, 'center');
  txt('THIRTY-THREE TO FIND. THREE BADGES. ONE ROAD.', W / 2, 72, '#5d6b92', 1, 'center');

  const blink = Math.floor(t * 2) % 2 === 0;
  if (blink) txt(S ? 'PRESS A TO CARRY ON' : 'PRESS A TO START', W / 2, 196, '#e8eefc', 1, 'center');
  txt('ARROWS MOVE   Z OR ENTER   X BACK   TAB MENU', W / 2, 208, '#3d4a6b', 1, 'center');
}

/* ------------------------------------------------------------------- help */

const HELP = [
  ['THE ROAD', 'Arrows walk. A talks to whoever you are facing and reads signs. ' +
    'TAB opens the menu. Long grass has things living in it.'],
  ['CATCHING', 'Hurt it first, then throw a ball from the BAG. A sleeping one is easier again. ' +
    'Six travel with you and the rest wait in the box at any healing center.'],
  ['THE CHART', 'EMBER beats LEAF and FROST. WAVE beats EMBER and STONE. LEAF beats WAVE and STONE. ' +
    'SPARK beats WAVE and GALE. FROST beats LEAF and GALE. STONE beats EMBER, GALE and FROST. ' +
    'GALE beats LEAF and SHADE. SHADE beats SHADE and PLAIN.'],
  ['PP', 'Every move has a number of uses and the walk between towns is long. ' +
    'The red roof heals everything, including PP, and it is free.'],
  ['BADGES', 'Three gyms, and somebody standing in the road until you have beaten each one. ' +
    'Each leader will take the badge off you two ways: your six against theirs, or a sealed ' +
    'pack each. What is at the end of the keep is not a gym.'],
  ['PACK BATTLES', 'Eight cards, keep five, and that is the match — no team, no bag, no running. ' +
    'Every card enters at fighting weight, so a legendary is a good card rather than a won game. ' +
    'The back room of the card shop runs brackets for a purse.'],
  ['TEAM CODES', 'The menu turns your team into about twenty letters. Read it to somebody and they ' +
    'can type it in and fight it. Nothing is sent anywhere and nothing changes hands — your team ' +
    'comes back exactly as it went in.'],
  ['THE LADDER', 'If the site has a ladder switched on, the menu shows teams other people ' +
    'have posted and lets you fight them. Records are self-reported — it is a place to find ' +
    'teams worth fighting, not a rank. Posting needs an account, made on the main site.'],
  ['THE SPLICER', 'The machine in either healing center takes two of yours and gives back one: ' +
    'the head of the first on the body of the second. It brings the attack, the speed and the ' +
    'first type; the body brings the health, the defence and the rest. Thirty-three creatures ' +
    'make one thousand and eighty-nine fusions. Feed a fusion back in on its own and it comes ' +
    'apart again, both halves at the level it reached. A fusion also knows a STRIKE, a heavy ' +
    'move of its own type that nothing unspliced can learn — and once you have a badge, the ' +
    'long grass starts turning up things that are already two creatures.'],
  ['PACK SEEDS', 'Every draft has a six-character seed, shown while you are choosing. Give it to ' +
    'somebody and they open the same eight cards. Draft your five each, swap the team codes the ' +
    'game hands you, and fight the other one\'s draft: same pack, two reads of it.'],
];

/* ============================================================== team codes */
/* The oldest multiplayer there is: you read a string of letters to somebody
 * and they type it back in. No server, no account, no waiting for anyone to
 * be online. What arrives is a team to fight, never a team to keep — nothing
 * that comes out of a code can be caught, kept, or walked out of the room. */

const CODE_MENU = ['SHOW MY CODE', 'TYPE IN A CODE', 'BACK'];

function updateCode() {
  const n = CODE_MENU.length;
  if (eat('back') || eat('start')) { Sound.back(); go('menu'); return; }
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok')) {
    Sound.ok();
    const item = CODE_MENU[ui.cursor];
    if (item === 'SHOW MY CODE') { ui.myCode = Codes.encode(S.party); go('codeshow'); }
    else if (item === 'TYPE IN A CODE') { beginCodeEntry(); }
    else go('menu');
  }
}

function drawCode() {
  box(0, 0, W, H, '#0a0f1c');
  txt('TEAM CODE', 10, 8, '#ffd166', 1);
  box(8, 18, W - 16, 1, '#2b3c6b');

  panel(8, 26, 170, 80, '#101728', '#4d5f96');
  CODE_MENU.forEach((s, i) => {
    const y = 36 + i * 22;
    const on = ui.cursor === i;
    if (on) { box(14, y - 4, 158, 18, '#243157'); frame(14, y - 4, 158, 18, '#5aa9f0'); }
    txt(s, 20, y, on ? '#ffffff' : '#c8d4f0', 1);
  });

  panel(186, 26, W - 194, 174, '#101728', '#4d5f96');
  let y = 34;
  txt('HOW IT WORKS', 194, y, '#ffd166', 1); y += 12;
  y = wrapText('A code is your team turned into about twenty letters. Read it to '
    + 'somebody and they can fight it.', 194, y, W - 210, 10, '#cfd8dc') + 6;
  y = wrapText('What arrives is a team to fight, never a team to keep.',
    194, y, W - 210, 10, '#9fb0d8') + 6;
  y = wrapText('Moves are not in the code. They come from the learnset at that '
    + 'level, so a team you trained oddly will turn up knowing the ordinary thing.',
    194, y, W - 210, 10, '#9fb0d8') + 6;
  y = wrapText('Nothing is sent anywhere. The code is the whole message.',
    194, y, W - 210, 10, '#5d6b92');

  txt('B TO GO BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
}

/* --------------------------------------------------------- showing yours */

function drawCodeShow() {
  box(0, 0, W, H, '#0a0f1c');
  txt('YOUR CODE', 10, 8, '#ffd166', 1);
  box(8, 18, W - 16, 1, '#2b3c6b');

  const pretty = Codes.format(ui.myCode);
  panel(20, 30, W - 40, 40, '#131b2e', '#ffd166');
  txs(pretty, W / 2, 44, '#ffd166', 2, 'center');

  txt('WRITE IT DOWN OR READ IT OUT', W / 2, 78, '#9fb0d8', 1, 'center');

  let y = 96;
  txt('THIS CODE IS', 20, y, '#7f8db5', 1); y += 12;
  S.party.forEach((m) => {
    Art.mon(ctx, spOf(m), m.shiny, 20, y - 3, 14, false);
    txt(nameOf(m), 38, y, '#e8eefc', 1);
    txt('L' + m.level, 150, y, '#9fb0d8', 1, 'right');
    if (m.shiny) txt('ODD COLOUR', 220, y, '#fff59d', 1);
    y += 14;
  });

  txt('B TO GO BACK', W / 2, H - 10, '#5d6b92', 1, 'center');
}

function updateCodeShow() {
  if (eat('back') || eat('ok') || eat('start')) { Sound.back(); go('code'); }
}

/* --------------------------------------------------------- typing one in */
/* Six buttons and no keyboard, so the letters are a grid you walk around —
 * which is how every game on this hardware asked you to spell anything. */

const CODE_COLS = 8;

function beginCodeEntry(kind) {
  ui.entry = '';
  ui.entryCur = 0;
  ui.entryErr = '';
  ui.entryKind = kind || 'team';
  go('codein');
}

function updateCodeIn() {
  const alpha = Codes.ALPHABET;
  const cells = alpha.length + 2;              // + DELETE + DONE
  const rows = Math.ceil(cells / CODE_COLS);

  if (eat('start')) { Sound.back(); go(ui.entryKind === 'seed' ? 'arena' : 'code'); return; }
  if (eat('back')) {
    if (ui.entry) { ui.entry = ui.entry.slice(0, -1); ui.entryErr = ''; Sound.drop(); }
    else { Sound.back(); go(ui.entryKind === 'seed' ? 'arena' : 'code'); }
    return;
  }
  if (eat('left')) { ui.entryCur = (ui.entryCur + cells - 1) % cells; Sound.cursor(); }
  if (eat('right')) { ui.entryCur = (ui.entryCur + 1) % cells; Sound.cursor(); }
  if (eat('up')) { ui.entryCur = (ui.entryCur + cells - CODE_COLS) % cells; Sound.cursor(); }
  if (eat('down')) { ui.entryCur = (ui.entryCur + CODE_COLS) % cells; Sound.cursor(); }
  ui.entryCur = clamp(ui.entryCur, 0, cells - 1);

  if (eat('ok')) {
    const i = ui.entryCur;
    if (i === alpha.length) {                   // DELETE
      if (ui.entry) { ui.entry = ui.entry.slice(0, -1); Sound.drop(); }
      else Sound.deny();
      ui.entryErr = '';
      return;
    }
    if (i === alpha.length + 1) {               // DONE
      if (ui.entryKind === 'seed') {
        const out = Codes.seedDecode(ui.entry);
        if (!out.ok) { Sound.deny(); ui.entryErr = out.error; return; }
        Sound.ok();
        if (!enterBracket(out.tier, out.seed)) { ui.entryErr = 'You cannot cover that bracket.'; }
        return;
      }
      const out = Codes.decode(ui.entry);
      if (!out.ok) { Sound.deny(); ui.entryErr = out.error; return; }
      Sound.ok();
      ui.rival = out.team.map((c) => makeMon(c.species, c.level, { shiny: c.shiny }));
      ui.rivalCode = Codes.strip(ui.entry);
      ui.cursor = 0;
      go('codeteam');
      return;
    }
    if (ui.entry.length >= 40) { Sound.deny(); ui.entryErr = 'That is longer than any code.'; return; }
    ui.entry += alpha[i];
    ui.entryErr = '';
    Sound.cursor();
  }
}

function drawCodeIn() {
  box(0, 0, W, H, '#0a0f1c');
  txt(ui.entryKind === 'seed' ? 'TYPE IN A PACK SEED' : 'TYPE IN A CODE', 10, 8, '#ffd166', 1);
  box(8, 18, W - 16, 1, '#2b3c6b');

  // What has been typed so far, in fives.
  panel(20, 26, W - 40, 26, '#131b2e', ui.entryErr ? '#e2483c' : '#4d5f96');
  // The caret is drawn rather than typed: the font is twenty-six letters and
  // ten digits, and an underscore it does not have comes out as a question
  // mark sitting in the middle of somebody's code.
  const shown = Codes.format(ui.entry) || '';
  const wide = Art.width(shown, 1);
  txs(shown, W / 2, 36, '#ffd166', 1, 'center');
  if (Math.floor(t * 3) % 2 === 0) box(W / 2 + wide / 2 + 2, 41, 4, 1, '#ffd166');

  if (ui.entryErr) txt(ui.entryErr, W / 2, 58, '#e2483c', 1, 'center');
  else txt('A TYPES   B RUBS OUT   START LEAVES', W / 2, 58, '#5d6b92', 1, 'center');

  const alpha = Codes.ALPHABET;
  const cells = alpha.length + 2;
  const cw = 34, ch = 20;
  const gridW = CODE_COLS * cw;
  const x0 = (W - gridW) / 2, y0 = 74;

  for (let i = 0; i < cells; i++) {
    const cx = x0 + (i % CODE_COLS) * cw;
    const cy = y0 + Math.floor(i / CODE_COLS) * ch;
    const on = ui.entryCur === i;
    const label = i < alpha.length ? alpha[i] : (i === alpha.length ? 'DEL' : 'DONE');
    const col = i < alpha.length ? '#c8d4f0' : (i === alpha.length ? '#ef9a9a' : '#5ce08a');
    if (on) { box(cx + 1, cy, cw - 2, ch - 2, '#243157'); frame(cx + 1, cy, cw - 2, ch - 2, '#5aa9f0'); }
    txt(label, cx + cw / 2, cy + 6, on ? '#ffffff' : col, 1, 'center');
  }
}

/* ------------------------------------------------------ what turned up */

function updateCodeTeam() {
  if (eat('back') || eat('start')) { Sound.back(); go('code'); return; }
  if (eat('up')) { ui.cursor = ui.cursor ? 0 : 1; Sound.cursor(); }
  if (eat('down')) { ui.cursor = ui.cursor ? 0 : 1; Sound.cursor(); }
  if (eat('ok')) {
    Sound.ok();
    if (ui.cursor === 1) { go('code'); return; }
    if (!S.party.some(alive)) { Sound.deny(); flash('Nothing of yours can stand up.'); return; }
    startLinkBattle(ui.rival);
  }
}

function drawCodeTeam() {
  box(0, 0, W, H, '#0a0f1c');
  txt('THEIR TEAM', 10, 8, '#ffd166', 1);
  txt(Codes.format(ui.rivalCode), W - 10, 8, '#5d6b92', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  ui.rival.forEach((m, i) => {
    const x = 12 + (i % 3) * 124, y = 26 + Math.floor(i / 3) * 62;
    panel(x, y, 118, 56, '#131b2e', '#39476e');
    Art.mon(ctx, spOf(m), m.shiny, x + 4, y + 4, 34, false);
    txt(nameOf(m), x + 42, y + 6, '#e8eefc', 1);
    txt('L' + m.level, x + 42, y + 18, '#9fb0d8', 1);
    let cx = x + 42;
    typesOf(m).forEach((ty) => { cx += Art.typeChip(ctx, ty, cx, y + 28, 1) + 2; });
    if (m.shiny) txt('ODD', x + 112, y + 6, '#fff59d', 1, 'right');
    // Two names fit in a card this wide; a third would be cut off mid-word,
    // which reads as a bug rather than as a list that carries on.
    const names = m.moves.map((s) => s.name);
    txt(names.slice(0, 2).join(', ') + (names.length > 2 ? '  +' + (names.length - 2) : ''),
      x + 4, y + 44, '#5d6b92', 1);
  });

  const opts = ['FIGHT THEM', 'NOT NOW'];
  opts.forEach((s, i) => {
    const x = 100 + i * 110, y = 186;
    const on = ui.cursor === i;
    if (on) { box(x - 6, y - 4, 96, 15, '#243157'); frame(x - 6, y - 4, 96, 15, '#5aa9f0'); }
    txt(s, x, y, on ? '#ffffff' : '#9fb0d8', 1);
  });
  txt('YOUR TEAM FIGHTS AT FULL HEALTH. NOTHING IS KEPT AND NOTHING IS LOST.',
    W / 2, H - 10, '#5d6b92', 1, 'center');
}

/* A link battle is an exhibition with your own six in it: they come in whole,
 * they go out whole, and no experience changes hands. Otherwise a friend's
 * code would be a training dummy you could farm all afternoon. */
function startLinkBattle(rivalTeam, whoFrom) {
  const mine = S.party.map((m) => {
    const copy = JSON.parse(JSON.stringify(m));
    copy.hp = maxHp(copy);
    copy.status = ''; copy.sleep = 0;
    copy.moves.forEach((s) => { s.pp = Dex.move(s.name).pp; });
    return copy;
  });
  const fromLadder = !!whoFrom;
  B.arena = {
    // A ladder result is filed against your own row and nobody else's, which
    // is the only kind of result a page holding a public key can be trusted
    // to file at all.
    ladder: fromLadder,
    winLines: ['You took the link match.',
      fromLadder ? 'Filed as a win on your own row. Theirs is theirs to keep.'
        : 'Nothing changes hands. That is what a link match is.'],
    loseLines: ['Their team had the better of yours.',
      fromLadder ? 'Filed as a loss on your own row.'
        : 'Nothing changes hands. Go again when you are ready.'],
  };
  B.foeParty = rivalTeam.map((m) => JSON.parse(JSON.stringify(m)));
  B.foeIdx = 0;
  B.foe = B.foeParty[0];
  B.trainer = {
    id: null, who: 'rival', name: (whoFrom || 'THE CHALLENGER').slice(0, 16), prize: 0,
    defeat: ['That is the match.'], npc: null, noPenalty: true,
  };
  beginBattle('trainer', { team: mine, exhibition: true });
  push(fromLadder ? whoFrom + ' is on the board.' : 'A team arrives out of the code.');
  push('They sent out ' + nameOf(B.foe) + '!');
  push('Go, ' + nameOf(myMon()) + '!');
  after('menu');
}

function updateHelp() {
  const n = HELP.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('ok') || eat('back') || eat('start')) { Sound.back(); go('menu'); }
}

function drawHelp() {
  box(0, 0, W, H, '#0a0f1c');
  txt('HOW TO PLAY', 10, 8, '#ffd166', 1);
  txt('ARROWS PICK   B GOES BACK', W - 10, 8, '#5d6b92', 1, 'right');
  box(8, 18, W - 16, 1, '#2b3c6b');

  // A list and a panel, because eight of these stacked on one screen runs off
  // the bottom of it and the last two are the new ones nobody would find.
  panel(8, 26, 120, 182, '#101728', '#4d5f96');
  HELP.forEach(([head], i) => {
    const y = 34 + i * 14;
    const on = ui.cursor === i;
    if (on) { box(12, y - 3, 112, 13, '#243157'); frame(12, y - 3, 112, 13, '#5aa9f0'); }
    txt(head, 18, y, on ? '#ffffff' : '#8d9ac0', 1);
  });

  const entry = HELP[clamp(ui.cursor, 0, HELP.length - 1)];
  panel(136, 26, W - 144, 182, '#101728', '#4d5f96');
  txt(entry[0], 146, 34, '#5ce08a', 1);
  box(144, 46, W - 160, 1, '#2b3c6b');
  wrapText(entry[1], 146, 54, W - 164, 11, '#e8eefc');
}

/* ===================================================================== loop */

function update(dt) {
  t += dt;
  if (muteFlash > 0) muteFlash -= dt;
  if (ui.flashT > 0) ui.flashT -= dt;

  switch (scene) {
    case 'title': updateTitle(); break;
    case 'world': updateWorld(dt); break;
    case 'menu': updateMenu(); break;
    case 'party': updateParty(); break;
    case 'bag': updateBag(); break;
    case 'useitem': updateUseItem(); break;
    case 'dex': updateDex(); break;
    case 'box': updateBox(); break;
    case 'shop': updateShop(); break;
    case 'packs': updatePacks(); break;
    case 'arena': updateArena(); break;
    case 'splice': updateSplice(); break;
    case 'drafted': updateDrafted(); break;
    case 'ask': updateAsk(); break;
    case 'rip': updateRip(); break;
    case 'pick': updatePick(); break;
    case 'starter': updateStarter(); break;
    case 'battle': updateBattle(dt); break;
    case 'code': updateCode(); break;
    case 'codeshow': updateCodeShow(); break;
    case 'codein': updateCodeIn(); break;
    case 'codeteam': updateCodeTeam(); break;
    case 'ladder': updateLadder(); break;
    case 'help': updateHelp(); break;
  }
  for (const k in tap) tap[k] = false;
}

function draw() {
  box(0, 0, W, H, '#05070c');
  switch (scene) {
    case 'title': drawTitle(); break;
    case 'world': drawWorld(); break;
    case 'menu': drawMenu(); break;
    case 'party': drawParty(); break;
    case 'bag': drawBag(); break;
    case 'useitem': drawUseItem(); break;
    case 'dex': drawDex(); break;
    case 'box': drawBox(); break;
    case 'shop': drawShop(); break;
    case 'packs': drawPacks(); break;
    case 'arena': drawArena(); break;
    case 'splice': drawSplice(); break;
    case 'drafted': drawDrafted(); break;
    case 'ask': drawAsk(); break;
    case 'rip': drawRip(); break;
    case 'pick': drawPick(); break;
    case 'starter': drawStarter(); break;
    case 'battle': drawBattle(); break;
    case 'code': drawCode(); break;
    case 'codeshow': drawCodeShow(); break;
    case 'codein': drawCodeIn(); break;
    case 'codeteam': drawCodeTeam(); break;
    case 'ladder': drawLadder(); break;
    case 'help': drawHelp(); break;
  }

  if (ui.flashT > 0 && ui.flash) {
    const w = Art.width(ui.flash, 1) + 16;
    const a = Math.min(1, ui.flashT * 2.2);
    ctx.globalAlpha = a;
    panel((W - w) / 2, 4, w, 14, '#101728', '#ffd166');
    txt(ui.flash, W / 2, 9, '#ffd166', 1, 'center');
    ctx.globalAlpha = 1;
  }
  if (muteFlash > 0) {
    ctx.globalAlpha = Math.min(1, muteFlash * 2);
    txt(Sound.isMuted() ? 'SOUND OFF' : 'SOUND ON', W - 6, H - 10, '#ffd166', 1, 'right');
    ctx.globalAlpha = 1;
  }
}

let acc = 0, last = performance.now();
function tickFrame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }
  draw();
  requestAnimationFrame(tickFrame);
}

/* ==================================================================== boot */

if (!load()) S = null;
Sprites.load();
requestAnimationFrame(tickFrame);

})();
