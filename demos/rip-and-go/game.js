/* Pokémon Rip and Go — a fan-made collector about opening packs.
 *
 * The loop is the whole game and it is three verbs long: earn coins in the
 * Battle Court, spend them on packs, rip a pack open and keep five. Five is
 * the rule the game is named after. A prism pack holds eight cards, and the
 * three you do not keep get torn up in front of you for coins — so the good
 * feeling of a legendary turning over is immediately followed by having to
 * decide what it is worth losing to keep it.
 *
 * That is why there is no "keep all" button and never will be. A collection
 * you chose is a different thing from a collection you accumulated.
 *
 * ------------------------------------------------------------------ files
 *
 *   dex.js      every creature: art, type, rarity, numbers
 *   sprites.js  your own PNG sheets, and which frame is which creature
 *   art.js      the font, the baking, the cards, the town
 *   sound.js    oscillators, no files
 *   lab.html    the Sprite Lab — the one page in here with real buttons
 *
 * Nothing is fetched. The game runs from a file:// address with the wifi off,
 * which is the standard the rest of this folder is held to.
 */
(function () {
'use strict';

const W = 384, H = 216;
const HUD = 24;                            // the strip along the top
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
  const aw = Math.max(80, innerWidth);
  const ah = Math.max(60, innerHeight);
  const want = Math.min(aw / W, ah / H);
  /* Scaling up, every game pixel gets a whole number of device pixels or the
   * 3x5 font goes to mush. Scaling *down* — a 384-wide game on a 375-wide
   * phone — that same rule has nowhere to go but half size, which wastes the
   * screen. So below 1x it just fits, and takes the resampling. */
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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

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
function anyTap() { return Object.keys(tap).some((k) => tap[k]); }

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
      if (KEYMAP.ArrowLeft && (k === 'left' || k === 'right' || k === 'up' || k === 'down')) held[k] = true;
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

/* =================================================================== state */

const SAVE = 'ripgo.save.v1';

let S = null;
let uid = 1;

function freshMon(species, level, shiny) {
  const sp = Dex.byId(species);
  const m = {
    uid: uid++,
    species,
    level: level,
    xp: 0,
    shiny: !!shiny,
  };
  m.hp = maxHp(m);
  return m;
}

function newGame() {
  S = {
    coins: 260,
    party: [],
    box: [],
    seen: {},
    opened: 0,
    kept: 0,
    ripped: 0,
    wins: 0,
    best: 0,            // highest court tier beaten
    tips: true,
  };
  uid = 1;
}

function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({ s: S, uid }));
  } catch (e) { /* storage blocked — the game still plays, it just forgets */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.s) return false;
    S = d.s;
    uid = d.uid || 1;
    // A save from a build with different species in it should not crash the
    // box; drop anything the dex no longer knows about.
    S.party = (S.party || []).filter((m) => Dex.byId(m.species));
    S.box = (S.box || []).filter((m) => Dex.byId(m.species));
    S.party.forEach(fixMon);
    S.box.forEach(fixMon);
    return true;
  } catch (e) { return false; }
}

function fixMon(m) {
  m.level = m.level || 5;
  m.xp = m.xp || 0;
  const mx = maxHp(m);
  if (typeof m.hp !== 'number' || m.hp > mx) m.hp = mx;
}

/* ================================================================= numbers */

function baseOf(m) { return Dex.stats(Dex.byId(m.species)); }
function maxHp(m) { return Math.floor(baseOf(m).hp * (1 + m.level * 0.11)) + 12; }
function statOf(m, k) { return Math.floor(baseOf(m)[k] * (1 + m.level * 0.075)) + 2; }
function xpNeeded(lvl) { return 16 + lvl * 11; }
function nameOf(m) { return Dex.byId(m.species).name; }
function typeOf(m) { return Dex.byId(m.species).type; }
function movesOf(m) { return Dex.moves(Dex.byId(m.species)); }
function alive(m) { return m.hp > 0; }
function healAll() { (S.party || []).forEach((m) => { m.hp = maxHp(m); }); }

function gainXp(m, amount) {
  m.xp += amount;
  let ups = 0;
  while (m.xp >= xpNeeded(m.level) && m.level < 60) {
    m.xp -= xpNeeded(m.level);
    m.level++;
    ups++;
    m.hp = maxHp(m);
  }
  return ups;
}

/* ================================================================== packs */

const PACKS = {
  scrub: {
    id: 'scrub', name: 'SCRUB PACK', cost: 80, cards: 5, floor: null, tier: 0,
    colour: '#b0bec5', shiny: 70,
    odds: { common: 79, uncommon: 17, rare: 3.6, epic: 0.4, legend: 0 },
    blurb: 'Five cards. Mostly what you already have.',
  },
  field: {
    id: 'field', name: 'FIELD PACK', cost: 200, cards: 6, floor: 'uncommon', tier: 1,
    colour: '#66bb6a', shiny: 60,
    odds: { common: 61, uncommon: 29, rare: 8.5, epic: 1.4, legend: 0.1 },
    blurb: 'Six cards, one of them uncommon at worst.',
  },
  foil: {
    id: 'foil', name: 'FOIL PACK', cost: 480, cards: 7, floor: 'rare', tier: 2,
    colour: '#42a5f5', shiny: 44,
    odds: { common: 43, uncommon: 34, rare: 19, epic: 3.6, legend: 0.4 },
    blurb: 'Seven cards and a rare you can count on.',
  },
  prism: {
    id: 'prism', name: 'PRISM PACK', cost: 1100, cards: 8, floor: 'epic', tier: 3,
    colour: '#ce93d8', shiny: 26,
    odds: { common: 22, uncommon: 36, rare: 29, epic: 11, legend: 2 },
    blurb: 'Eight cards, an epic floor, and a real shot at a legendary.',
  },
  welcome: {
    id: 'welcome', name: 'WELCOME PACK', cost: 0, cards: 5, floor: 'uncommon', tier: 0,
    colour: '#ffd166', shiny: 60,
    odds: { common: 70, uncommon: 26, rare: 4, epic: 0, legend: 0 },
    blurb: 'On the house.',
  },
};

function rollRarity(odds) {
  let total = 0;
  Dex.RARITY_ORDER.forEach((r) => { total += odds[r] || 0; });
  let n = Math.random() * total;
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
  const tierBump = pack.tier * 4;
  const rareBump = Dex.RARITY_ORDER.indexOf(poolR) * 2;
  return {
    species: sp.id,
    level: 4 + tierBump + rareBump + rnd(4),
    shiny: rnd(pack.shiny) === 0,
  };
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
    // Guarantee by upgrading the best card already in there, so a pack never
    // shows you two floors and calls one of them lucky.
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

/* ================================================================== shops */

const SHOPS = {
  corner: {
    id: 'corner', name: 'THE CORNER SHOP', colour: '#e2483c',
    line: 'Cheap packs, honest odds, no returns.',
    stock: ['scrub', 'field'],
  },
  foil: {
    id: 'foil', name: 'FOIL EMPORIUM', colour: '#7e57c2',
    line: 'The good shelf. Bring coins.',
    stock: ['field', 'foil', 'prism'],
  },
};

/* ================================================================== court */

const TIERS = [
  { name: 'ROOKIE',   fee: 0,   prize: 70,   level: 5,  size: 1, pools: ['common'] },
  { name: 'AMATEUR',  fee: 40,  prize: 190,  level: 10, size: 2, pools: ['common', 'uncommon'] },
  { name: 'PRO',      fee: 120, prize: 440,  level: 17, size: 2, pools: ['uncommon', 'rare'] },
  { name: 'ACE',      fee: 300, prize: 980,  level: 25, size: 3, pools: ['rare', 'epic'] },
  { name: 'CHAMPION', fee: 700, prize: 2300, level: 34, size: 3, pools: ['epic', 'legend'] },
];

const RIVALS = ['DARA', 'KOJI', 'MEGS', 'PIP', 'VIC', 'RONNIE', 'SAM', 'TUX', 'BEX', 'OLU'];

function makeOpponent(tier) {
  const team = [];
  for (let i = 0; i < tier.size; i++) {
    const pool = Dex.pool(pick(tier.pools));
    const sp = pool.length ? pick(pool) : pick(Dex.pool('common'));
    team.push(freshMon(sp.id, tier.level + rnd(3), rnd(60) === 0));
  }
  return { name: pick(RIVALS), team };
}

/* ================================================================== town */
/* One screen, never scrolls. Buildings are pixel rectangles with a door cut
 * into the bottom of them; walking onto a door and pressing A is the only
 * interaction in the whole town. */

const PLACES = [
  { id: 'corner', kind: 'shop', label: 'CARD SHOP', colour: '#e2483c', x: 18, y: 32, w: 84, h: 56 },
  { id: 'foil', kind: 'shop', label: 'FOIL CO.', colour: '#7e57c2', x: 118, y: 32, w: 84, h: 56 },
  { id: 'court', kind: 'court', label: 'BATTLE COURT', colour: '#ffb300', x: 222, y: 32, w: 96, h: 56 },
  { id: 'lab', kind: 'lab', label: 'SPRITE LAB', colour: '#26c6da', x: 34, y: 120, w: 80, h: 48 },
  { id: 'box', kind: 'box', label: 'YOUR BOX', colour: '#5ce08a', x: 244, y: 120, w: 80, h: 48 },
];

PLACES.forEach((p) => {
  p.door = { x: p.x + (p.w - 12) / 2, y: p.y + p.h - 16, w: 12, h: 16 };
  p.mat = { x: p.door.x - 2, y: p.y + p.h, w: 16, h: 8 };
});

const player = { x: 186, y: 112, dir: 'down', step: 0, walk: 0 };

function solidAt(x, y) {
  for (const p of PLACES) {
    if (x > p.x - 2 && x < p.x + p.w + 2 && y > p.y && y < p.y + p.h) {
      // The doorway is a hole in the front wall, so you can stand in it.
      if (y > p.y + p.h - 6 && x > p.door.x && x < p.door.x + p.door.w) continue;
      return true;
    }
  }
  return false;
}

function nearDoor() {
  for (const p of PLACES) {
    const m = p.mat;
    if (player.x + 6 > m.x && player.x + 6 < m.x + m.w &&
        player.y + 15 > m.y - 10 && player.y + 15 < m.y + m.h) return p;
  }
  return null;
}

/* ================================================================= scenes */

let scene = 'title';
let t = 0, tick = 0;

const ui = {
  cursor: 0, row: 0, page: 0, tab: 0,
  cards: [], flipped: 0, keep: [], place: [],
  pack: null, shop: null, tier: 0,
  message: '', messageT: 0,
  fade: 0,
};

function go(next) {
  scene = next;
  ui.cursor = 0; ui.row = 0;
  ui.fade = 0.35;
  if (next === 'town') Sound.playSong('town');
  else if (next === 'shop') Sound.playSong('shop');
  else if (next === 'battle') Sound.playSong('battle');
  else if (next === 'title') Sound.stopSong();
  save();
}

function flash(msg) { ui.message = msg; ui.messageT = 2.2; }

/* ================================================================== battle */

const B = {
  active: false, opp: null, tier: null, mine: 0, theirs: 0,
  phase: 'intro', menu: 0, moveSel: 0, swapSel: 0,
  queue: [], wait: 0, shakeMe: 0, shakeThem: 0, flashT: 0,
  mods: {}, result: null, xpLog: [],
};

function startBattle(tierIdx) {
  const tier = TIERS[tierIdx];
  B.active = true;
  B.tier = tierIdx;
  B.opp = makeOpponent(tier);
  B.mine = S.party.findIndex(alive);
  B.theirs = 0;
  B.phase = 'intro';
  B.menu = 0; B.moveSel = 0; B.swapSel = 0;
  B.queue = [];
  B.wait = 0;
  B.mods = { me: { atk: 0, def: 0, spd: 0 }, them: { atk: 0, def: 0, spd: 0 } };
  B.result = null;
  B.xpLog = [];
  say(B.opp.name + ' wants to battle!');
  say('GO, ' + nameOf(S.party[B.mine]) + '!');
  go('battle');
}

function say(text, fn) { B.queue.push({ text, fn }); }

function myMon() { return S.party[B.mine]; }
function theirMon() { return B.opp.team[B.theirs]; }

function modMult(n) { return n >= 0 ? (2 + n) / 2 : 2 / (2 - n); }

function damage(from, to, move, fromMods, toMods) {
  const atk = statOf(from, 'atk') * modMult(fromMods.atk);
  const def = statOf(to, 'def') * modMult(toMods.def);
  const eff = Dex.effect(move.type, typeOf(to));
  const stab = move.type === typeOf(from) ? 1.25 : 1;
  const roll = 0.85 + Math.random() * 0.15;
  const raw = ((2 * from.level / 5 + 2) * move.power * atk / Math.max(1, def)) / 50 + 2;
  return { dmg: Math.max(1, Math.floor(raw * eff * stab * roll)), eff };
}

function useMove(attackerIsMe, move) {
  const from = attackerIsMe ? myMon() : theirMon();
  const to = attackerIsMe ? theirMon() : myMon();
  const fromMods = attackerIsMe ? B.mods.me : B.mods.them;
  const toMods = attackerIsMe ? B.mods.them : B.mods.me;

  say((attackerIsMe ? '' : 'FOE ') + nameOf(from) + ' used ' + move.name + '!', () => {
    if (move.power > 0) {
      const { dmg, eff } = damage(from, to, move, fromMods, toMods);
      to.hp = Math.max(0, to.hp - dmg);
      if (attackerIsMe) B.shakeThem = 0.32; else B.shakeMe = 0.32;
      B.flashT = 0.12;
      Sound.hit(eff);
      if (eff > 1) say('It lands hard!');
      else if (eff < 1) say('It barely troubles it.');
    } else if (move.heal) {
      const before = from.hp;
      from.hp = Math.min(maxHp(from), from.hp + Math.floor(maxHp(from) * move.heal));
      Sound.heal();
      say(nameOf(from) + ' ' + (move.note || 'recovers') + ' (+' + (from.hp - before) + ').');
    } else if (move.stat) {
      const target = move.self ? fromMods : toMods;
      const who = move.self ? from : to;
      target[move.stat] = clamp(target[move.stat] + move.by, -4, 4);
      if (move.by > 0) Sound.buff(); else Sound.debuff();
      say(nameOf(who) + "'s " + move.stat.toUpperCase() + (move.by > 0 ? ' rose.' : ' fell.'));
    }
  });
}

/* The other side is not clever and does not need to be: it prefers a move
 * that is strong against what is in front of it, leans on its utility when
 * it is hurt, and otherwise hits things. */
function opponentMove() {
  const me = theirMon(), you = myMon();
  const moves = movesOf(me);
  const dmgMoves = moves.filter((m) => m.power > 0);
  const util = moves.find((m) => m.power === 0);
  if (util && util.heal && me.hp < maxHp(me) * 0.3 && rnd(2) === 0) return util;
  if (util && !util.heal && rnd(5) === 0) return util;
  let best = dmgMoves[0], bestScore = -1;
  dmgMoves.forEach((m) => {
    const score = m.power * Dex.effect(m.type, typeOf(you)) * (m.type === typeOf(me) ? 1.25 : 1);
    if (score > bestScore) { bestScore = score; best = m; }
  });
  return best;
}

function takeTurn(myAction) {
  const me = myMon(), them = theirMon();
  const theirMove = opponentMove();

  if (myAction.kind === 'swap') {
    B.mine = myAction.index;
    B.mods.me = { atk: 0, def: 0, spd: 0 };
    say('Come back! Go, ' + nameOf(S.party[B.mine]) + '!');
    useMove(false, theirMove);
  } else {
    const mySpd = statOf(me, 'spd') * modMult(B.mods.me.spd);
    const theirSpd = statOf(them, 'spd') * modMult(B.mods.them.spd);
    const meFirst = mySpd === theirSpd ? rnd(2) === 0 : mySpd > theirSpd;
    if (meFirst) {
      useMove(true, myAction.move);
      say('', () => { if (alive(theirMon())) useMove(false, theirMove); });
    } else {
      useMove(false, theirMove);
      say('', () => { if (alive(myMon())) useMove(true, myAction.move); });
    }
  }
  say('', checkFaints);
  B.phase = 'text';
}

function checkFaints() {
  const them = theirMon(), me = myMon();
  if (!alive(them)) {
    Sound.faint();
    say('FOE ' + nameOf(them) + ' went down!', () => {
      const up = gainXp(me, 16 + them.level * 6);
      B.xpLog.push(nameOf(me) + ' +' + (16 + them.level * 6) + 'XP');
      if (up) { Sound.levelup(); say(nameOf(me) + ' reached level ' + me.level + '!'); }
      const next = B.opp.team.findIndex(alive);
      if (next < 0) { winBattle(); return; }
      B.theirs = next;
      B.mods.them = { atk: 0, def: 0, spd: 0 };
      say(B.opp.name + ' sends out ' + nameOf(B.opp.team[next]) + '!');
    });
    return;
  }
  if (!alive(me)) {
    Sound.faint();
    say(nameOf(me) + ' went down!', () => {
      const next = S.party.findIndex(alive);
      if (next < 0) { loseBattle(); return; }
      B.phase = 'forceswap';
    });
  }
}

function winBattle() {
  const tier = TIERS[B.tier];
  S.coins += tier.prize;
  S.wins++;
  if (B.tier + 1 > S.best) S.best = B.tier + 1;
  B.result = { win: true, prize: tier.prize };
  Sound.win();
  say('You win! ' + tier.prize + ' coins.', () => { B.phase = 'over'; });
}

function loseBattle() {
  B.result = { win: false, prize: 0 };
  Sound.lose();
  say('Your team is out of it.', () => { B.phase = 'over'; });
}

function endBattle() {
  B.active = false;
  healAll();
  Sound.playSong('town');
  go('town');
}

/* ================================================================== update */

function update(dt) {
  t += dt;
  tick = Math.floor(t * 6);
  if (muteFlash > 0) muteFlash -= dt;
  if (ui.messageT > 0) ui.messageT -= dt;
  if (ui.fade > 0) ui.fade -= dt;

  switch (scene) {
    case 'title': updateTitle(); break;
    case 'town': updateTown(dt); break;
    case 'shop': updateShop(); break;
    case 'rip': updateRip(); break;
    case 'pick': updatePick(); break;
    case 'stash': updateStash(); break;
    case 'box': updateBox(); break;
    case 'court': updateCourt(); break;
    case 'battle': updateBattle(dt); break;
    case 'menu': updateMenu(); break;
    case 'help': updateHelp(); break;
  }
  for (const k in tap) tap[k] = false;
}

/* ------------------------------------------------------------------ title */

function updateTitle() {
  if (eat('ok') || eat('start')) {
    Sound.ok();
    if (!S.party.length && !S.box.length) {
      // A first game starts the way every game after it does: with a pack.
      beginRip(PACKS.welcome);
    } else {
      go('town');
    }
  }
}

/* ------------------------------------------------------------------- town */

function updateTown(dt) {
  const sp = 66 * dt;
  let dx = 0, dy = 0;
  if (held.left) dx -= 1;
  if (held.right) dx += 1;
  if (held.up) dy -= 1;
  if (held.down) dy += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = player.x + (dx / len) * sp;
    const ny = player.y + (dy / len) * sp;
    // Feet only. A head clipping a roof is not a collision anybody wants.
    if (!solidAt(nx + 2, player.y + 15) && !solidAt(nx + 9, player.y + 15)) player.x = nx;
    if (!solidAt(player.x + 2, ny + 15) && !solidAt(player.x + 9, ny + 15)) player.y = ny;
    player.x = clamp(player.x, 18, W - 30);
    player.y = clamp(player.y, HUD + 2, H - 32);
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx < 0 ? 'left' : 'right';
    else if (dy) player.dir = dy < 0 ? 'up' : 'down';
    player.walk += dt * 7;
    if (Math.floor(player.walk) % 2 === 1 && player.step === 0) { player.step = 1; Sound.step(); }
    if (Math.floor(player.walk) % 2 === 0) player.step = 0;
  } else {
    player.walk = 0; player.step = 0;
  }

  if (eat('start')) { Sound.ok(); go('menu'); return; }

  const door = nearDoor();
  if (door && eat('ok')) {
    Sound.door();
    S.tips = false;                          // you have found a door; the hint has done its job
    if (door.kind === 'shop') { ui.shop = SHOPS[door.id]; ui.cursor = 0; go('shop'); }
    else if (door.kind === 'court') { ui.cursor = 0; go('court'); }
    else if (door.kind === 'box') { ui.tab = 0; ui.cursor = 0; go('box'); }
    else if (door.kind === 'lab') { save(); location.href = 'lab.html'; }
  }
}

/* ------------------------------------------------------------------- shop */

function updateShop() {
  const shop = ui.shop;
  const n = shop.stock.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('back') || eat('start')) { Sound.back(); go('town'); return; }
  if (eat('ok')) {
    const pack = PACKS[shop.stock[ui.cursor]];
    if (S.coins < pack.cost) { Sound.deny(); flash('Not enough coins.'); return; }
    S.coins -= pack.cost;
    Sound.buy();
    beginRip(pack);
  }
}

/* -------------------------------------------------------------------- rip */

function beginRip(pack) {
  ui.pack = pack;
  ui.cards = openPack(pack);
  ui.flipped = 0;
  ui.keep = ui.cards.map(() => false);
  S.opened++;
  Sound.rip();
  go('rip');
}

function flipCard() {
  const c = ui.cards[ui.flipped];
  const sp = Dex.byId(c.species);
  S.seen[sp.id] = true;
  Sound.reveal(sp.rarity);
  ui.flipped++;
}

function updateRip() {
  if (eat('ok') || eat('start')) {
    if (ui.flipped < ui.cards.length) flipCard();
    else { Sound.ok(); ui.cursor = 0; go('pick'); }
  }
  // Eight cards is a lot of pressing on the twentieth pack, so B turns the
  // rest over at once. The best card in what is left still gets its noise.
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

/* ------------------------------------------------------------------- pick */

const KEEP_MAX = 5;

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
    else if (keptCount() >= KEEP_MAX) { Sound.deny(); flash('Five is the limit. That is the game.'); }
    else { ui.keep[i] = true; Sound.keep(); }
  }

  if (eat('start') || eat('back')) {
    if (keptCount() === 0) { Sound.deny(); flash('Keep at least one.'); return; }
    Sound.ok();
    // Fill the team while there is room and put the rest in the box. Counting
    // has to happen as the list is built — asking how many are already placed
    // reads the array being replaced, which is how six of them ended up on a
    // team of three.
    let room = 6 - S.party.length;
    ui.place = ui.cards.map((c, i) => {
      if (!ui.keep[i]) return null;
      if (room > 0) { room--; return 'team'; }
      return 'box';
    });
    ui.cursor = ui.keep.findIndex(Boolean);
    go('stash');
  }
}

function countPlaced() {
  return (ui.place || []).filter((p) => p === 'team').length;
}

/* ------------------------------------------------------------------ stash */
/* Where the kept cards actually land. Team if there is room, box otherwise,
 * and you can shuffle them between the two before confirming. */

function keptIndexes() {
  const out = [];
  ui.keep.forEach((k, i) => { if (k) out.push(i); });
  return out;
}

function updateStash() {
  const list = keptIndexes();
  const n = list.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }

  if (eat('left') || eat('right') || eat('ok')) {
    const idx = list[ui.cursor];
    if (ui.place[idx] === 'team') { ui.place[idx] = 'box'; Sound.cursor(); }
    else {
      const teamSize = S.party.length + countPlaced();
      if (teamSize >= 6) { Sound.deny(); flash('Six on a team. The rest go in the box.'); }
      else { ui.place[idx] = 'team'; Sound.keep(); }
    }
  }

  if (eat('start') || eat('back')) {
    let coins = 0;
    ui.cards.forEach((c, i) => {
      if (ui.keep[i]) {
        const m = freshMon(c.species, c.level, c.shiny);
        if (ui.place[i] === 'team' && S.party.length < 6) S.party.push(m);
        else S.box.push(m);
        S.kept++;
      } else {
        coins += Dex.RARITY[Dex.byId(c.species).rarity].rip;
        S.ripped++;
      }
    });
    S.coins += coins;
    Sound.rip();
    Sound.ok();
    flash(coins > 0 ? 'Torn up for ' + coins + ' coins.' : 'Kept the lot.');
    save();
    go('town');
  }
}

/* -------------------------------------------------------------------- box */

function updateBox() {
  const list = ui.tab === 0 ? S.party : S.box;
  const n = list.length;

  if (eat('start') || eat('back')) { Sound.back(); go('town'); return; }
  if (eat('left') && ui.tab === 1) { ui.tab = 0; ui.cursor = 0; Sound.cursor(); return; }
  if (eat('right') && ui.tab === 0) { ui.tab = 1; ui.cursor = 0; Sound.cursor(); return; }
  if (!n) return;

  const cols = ui.tab === 0 ? 1 : 6;
  if (ui.tab === 0) {
    if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
    if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  } else {
    if (eat('up')) { ui.cursor = (ui.cursor + n - cols) % n; Sound.cursor(); }
    if (eat('down')) { ui.cursor = (ui.cursor + cols) % n; Sound.cursor(); }
    if (eat('left')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
    if (eat('right')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  }
  ui.cursor = clamp(ui.cursor, 0, n - 1);

  if (eat('ok')) {
    if (ui.tab === 0) {
      if (S.party.length <= 1) { Sound.deny(); flash('Keep one on the team.'); return; }
      S.box.push(S.party.splice(ui.cursor, 1)[0]);
      ui.cursor = clamp(ui.cursor, 0, S.party.length - 1);
      Sound.keep();
    } else {
      if (S.party.length >= 6) { Sound.deny(); flash('Team is full.'); return; }
      S.party.push(S.box.splice(ui.cursor, 1)[0]);
      ui.cursor = clamp(ui.cursor, 0, Math.max(0, S.box.length - 1));
      Sound.keep();
    }
    save();
  }
}

/* ------------------------------------------------------------------ court */

function updateCourt() {
  if (eat('up')) { ui.cursor = (ui.cursor + TIERS.length - 1) % TIERS.length; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % TIERS.length; Sound.cursor(); }
  if (eat('back') || eat('start')) { Sound.back(); go('town'); return; }
  if (eat('ok')) {
    const tier = TIERS[ui.cursor];
    if (!S.party.length) { Sound.deny(); flash('You need something on your team.'); return; }
    if (ui.cursor > S.best) { Sound.deny(); flash('Win the tier below this one first.'); return; }
    if (S.coins < tier.fee) { Sound.deny(); flash('The entry fee is ' + tier.fee + '.'); return; }
    S.coins -= tier.fee;
    healAll();
    Sound.ok();
    startBattle(ui.cursor);
  }
}

/* ----------------------------------------------------------------- battle */

function updateBattle(dt) {
  if (B.shakeMe > 0) B.shakeMe -= dt;
  if (B.shakeThem > 0) B.shakeThem -= dt;
  if (B.flashT > 0) B.flashT -= dt;

  // Anything queued up gets read out first. A press hurries it along.
  if (B.queue.length) {
    B.wait -= dt;
    if (eat('ok') || eat('start') || B.wait <= 0) {
      const ev = B.queue.shift();
      if (ev.fn) ev.fn();
      B.wait = ev.text ? 1.1 : 0;
      if (!ev.text && B.queue.length) B.wait = 0;
    }
    if (!B.queue.length && B.phase === 'text') B.phase = 'menu';
    if (!B.queue.length && B.phase === 'intro') B.phase = 'menu';
    return;
  }

  if (B.phase === 'over') {
    if (eat('ok') || eat('start')) { Sound.ok(); endBattle(); }
    return;
  }

  if (B.phase === 'forceswap') {
    const opts = S.party.map((m, i) => i).filter((i) => alive(S.party[i]));
    if (!opts.length) { loseBattle(); return; }
    if (eat('up')) { B.swapSel = (B.swapSel + opts.length - 1) % opts.length; Sound.cursor(); }
    if (eat('down')) { B.swapSel = (B.swapSel + 1) % opts.length; Sound.cursor(); }
    if (eat('ok')) {
      B.mine = opts[clamp(B.swapSel, 0, opts.length - 1)];
      B.mods.me = { atk: 0, def: 0, spd: 0 };
      Sound.ok();
      say('Go, ' + nameOf(myMon()) + '!');
      B.phase = 'text';
    }
    return;
  }

  if (B.phase === 'menu') {
    if (eat('up')) { B.menu = (B.menu + 2) % 3; Sound.cursor(); }
    if (eat('down')) { B.menu = (B.menu + 1) % 3; Sound.cursor(); }
    if (eat('ok')) {
      Sound.ok();
      if (B.menu === 0) { B.phase = 'moves'; B.moveSel = 0; }
      else if (B.menu === 1) {
        // Opening a swap list with nothing swappable in it leaves the player
        // pressing A at a menu where every option refuses — so it is refused
        // one level earlier, where there is still somewhere to go.
        const bench = S.party.filter((m, i) => i !== B.mine && alive(m));
        if (!bench.length) { Sound.deny(); flash('Nothing else of yours can fight.'); return; }
        B.phase = 'swap';
        B.swapSel = S.party.findIndex((m, i) => i !== B.mine && alive(m));
      }
      else {
        if (B.tier === 0) { say('You walked out of a free match.'); B.result = { win: false, prize: 0, ran: true }; say('', () => { B.phase = 'over'; }); B.phase = 'text'; }
        else { say('You forfeit the fee and leave.'); B.result = { win: false, prize: 0, ran: true }; say('', () => { B.phase = 'over'; }); B.phase = 'text'; }
      }
    }
    return;
  }

  if (B.phase === 'moves') {
    const moves = movesOf(myMon());
    if (eat('up')) { B.moveSel = (B.moveSel + moves.length - 1) % moves.length; Sound.cursor(); }
    if (eat('down')) { B.moveSel = (B.moveSel + 1) % moves.length; Sound.cursor(); }
    if (eat('back')) { B.phase = 'menu'; Sound.back(); }
    if (eat('ok')) { Sound.ok(); takeTurn({ kind: 'move', move: moves[B.moveSel] }); }
    return;
  }

  if (B.phase === 'swap') {
    const n = S.party.length;
    if (eat('up')) { B.swapSel = (B.swapSel + n - 1) % n; Sound.cursor(); }
    if (eat('down')) { B.swapSel = (B.swapSel + 1) % n; Sound.cursor(); }
    if (eat('back')) { B.phase = 'menu'; Sound.back(); }
    if (eat('ok')) {
      if (B.swapSel === B.mine) { Sound.deny(); flash('That one is already out.'); return; }
      if (!alive(S.party[B.swapSel])) { Sound.deny(); flash('That one cannot fight.'); return; }
      Sound.ok();
      takeTurn({ kind: 'swap', index: B.swapSel });
    }
  }
}

/* ------------------------------------------------------------------- menu */

const MENU_ITEMS = ['TEAM AND BOX', 'SPRITE LAB', 'HOW TO PLAY', 'SOUND', 'BACK'];

function updateMenu() {
  const n = MENU_ITEMS.length;
  if (eat('up')) { ui.cursor = (ui.cursor + n - 1) % n; Sound.cursor(); }
  if (eat('down')) { ui.cursor = (ui.cursor + 1) % n; Sound.cursor(); }
  if (eat('back') || eat('start')) { Sound.back(); go('town'); return; }
  if (eat('ok')) {
    Sound.ok();
    const item = MENU_ITEMS[ui.cursor];
    if (item === 'TEAM AND BOX') { ui.tab = 0; ui.cursor = 0; go('box'); }
    else if (item === 'SPRITE LAB') { save(); location.href = 'lab.html'; }
    else if (item === 'HOW TO PLAY') { go('help'); }
    else if (item === 'SOUND') { muteFlash = 1.2; Sound.toggleMute(); }
    else go('town');
  }
}

function updateHelp() {
  if (eat('ok') || eat('back') || eat('start')) { Sound.back(); go('menu'); }
}

/* ==================================================================== draw */

function draw() {
  box(0, 0, W, H, '#05070c');
  switch (scene) {
    case 'title': drawTitle(); break;
    case 'town': drawTown(); drawHud(); break;
    case 'shop': drawShop(); drawHud(); break;
    case 'rip': drawRip(); drawHud(); break;
    case 'pick': drawPick(); drawHud(); break;
    case 'stash': drawStash(); drawHud(); break;
    case 'box': drawBox(); drawHud(); break;
    case 'court': drawCourt(); drawHud(); break;
    case 'battle': drawBattle(); break;
    case 'menu': drawTown(); drawMenu(); drawHud(); break;
    case 'help': drawHelp(); break;
  }

  if (ui.messageT > 0) {
    const w = Art.width(ui.message, 1) + 12;
    panel((W - w) / 2, H - 30, w, 13, '#1a1030', '#ffd166');
    txt(ui.message, W / 2, H - 26, '#ffd166', 1, 'center');
  }

  if (muteFlash > 0) {
    txs(Sound.isMuted() ? 'SOUND OFF' : 'SOUND ON', W - 4, 4, '#ffd166', 1, 'right');
  }

  if (ui.fade > 0) {
    ctx.fillStyle = 'rgba(0,0,0,' + (ui.fade / 0.35 * 0.8).toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* -------------------------------------------------------------------- hud */

function drawHud() {
  box(0, 0, W, HUD, '#0c1120');
  box(0, HUD - 1, W, 1, '#2a3350');

  // Coins
  box(6, 7, 7, 7, '#ffd166');
  box(7, 8, 5, 5, '#c79a2e');
  txt('$', 8, 9, '#ffe9a8', 1);
  txs(S.coins, 18, 8, '#ffe9a8', 1);

  txs('TEAM ' + S.party.length + '/6', 120, 8, '#9fe6b4', 1);
  txs('BOX ' + S.box.length, 186, 8, '#9fb0d8', 1);
  txs('SEEN ' + Object.keys(S.seen).length + '/' + Dex.SPECIES.length, 240, 8, '#c8b4f0', 1);
  txs('PACKS ' + S.opened, 330, 8, '#e6a89a', 1);
}

/* ------------------------------------------------------------------ title */

function drawTitle() {
  // A sky with a card falling through it.
  for (let y = 0; y < H; y++) {
    const k = y / H;
    box(0, y, W, 1, k < 0.6 ? '#0b1026' : '#131b38');
  }
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + 13) % W, y = (i * 53 + 7) % (H - 60);
    box(x, y, 1, 1, i % 3 ? '#2b3a66' : '#4a5c96');
  }

  const bob = Math.sin(t * 2) * 3;
  Art.card(ctx, { species: Dex.SPECIES[(Math.floor(t / 2.2) % Dex.SPECIES.length)].id, level: 12, shiny: false },
    W / 2 - 22, 44 + bob, 44, 60, { tick });

  txs('POKEMON', W / 2, 14, '#ffd166', 2, 'center');
  txs('RIP AND GO', W / 2, 116, '#f4f1e4', 3, 'center');
  txt('BUY PACKS. RIP THEM. KEEP FIVE.', W / 2, 142, '#8fa3d8', 1, 'center');

  if (Math.floor(t * 2) % 2) txs('PRESS A TO START', W / 2, 166, '#5ce08a', 1, 'center');
  txt('A: Z OR ENTER   B: X   MENU: TAB   MUTE: M', W / 2, 190, '#4c5a80', 1, 'center');
  txt('A FAN GAME. ALL ART IS ITS OWN.', W / 2, 202, '#3d4867', 1, 'center');
}

/* ------------------------------------------------------------------- town */

function drawTown() {
  // Ground
  for (let y = HUD; y < H; y += 16) {
    for (let x = 0; x < W; x += 16) {
      const n = (x * 7 + y * 13) % 11;
      Art.tile(ctx, n === 0 ? 'flower' : n < 4 ? 'grass2' : 'grass', x, y);
    }
  }
  /* Two bands of path on the tile grid, one in front of the shops and one in
   * front of the lab and the box, joined down the middle. Where you can walk
   * is a different colour from where you cannot, which is the whole job of
   * it — and it has to sit on the grid, or the grass edges do not line up and
   * the path reads as a slab dropped on the town. */
  for (let x = 16; x < W - 16; x += 16) {
    Art.tile(ctx, 'path', x, 88);
    Art.tile(ctx, 'path', x, 104);
    Art.tile(ctx, 'path', x, 168);
    Art.tile(ctx, 'path', x, 184);
  }
  for (let y = 120; y <= 152; y += 16) {
    Art.tile(ctx, 'path', 176, y);
    Art.tile(ctx, 'path', 192, y);
  }

  // Trees down both sides, so the screen has a boundary that is not a line.
  for (let y = HUD; y < H; y += 16) {
    Art.tile(ctx, 'tree', 0, y);
    Art.tile(ctx, 'tree', W - 16, y);
  }
  for (let x = 16; x < W - 16; x += 16) Art.tile(ctx, 'fence', x, H - 16);

  PLACES.forEach((p) => {
    Art.building(ctx, p.x, p.y, p.w, p.h, p.colour, (p.w - 12) / 2);
    txt(p.label, p.x + p.w / 2, p.y + 1, '#2b1d10', 1, 'center');
    txt(p.label, p.x + p.w / 2, p.y, '#fff3d0', 1, 'center');
  });

  Art.trainer(ctx, player.dir, player.step, player.x, player.y, 16);

  const door = nearDoor();
  if (door) {
    const w = Art.width('A: ' + door.label, 1) + 10;
    panel(player.x + 6 - w / 2, player.y - 14, w, 12, '#101a30', '#ffd166');
    txt('A: ' + door.label, player.x + 6, player.y - 11, '#ffd166', 1, 'center');
  }

  if (S.tips) {
    panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
    txt('WALK WITH THE ARROWS. A AT A DOOR. TAB FOR THE MENU.', W / 2, H - 13, '#7186b8', 1, 'center');
  }
}

/* ------------------------------------------------------------------- shop */

function drawShop() {
  const shop = ui.shop;
  box(0, HUD, W, H - HUD, '#171225');
  // Shelves behind the counter
  for (let y = HUD + 10; y < 120; y += 22) {
    box(20, y, W - 40, 3, '#3a2c20');
    for (let x = 26; x < W - 46; x += 26) {
      const c = ['#b0bec5', '#66bb6a', '#42a5f5', '#ce93d8'][(x + y) % 4];
      box(x, y - 14, 16, 14, '#241b33');
      Art.frame(ctx, x, y - 14, 16, 14, c);
      box(x + 3, y - 10, 10, 6, c);
    }
  }
  box(0, 120, W, H - 120, '#1e1830');
  box(0, 120, W, 2, shop.colour);

  txs(shop.name, 10, HUD + 6, shop.colour, 1);
  txt(shop.line, 10, HUD + 16, '#8f83b0', 1);

  const x = 14, y = 128;
  shop.stock.forEach((id, i) => {
    const p = PACKS[id];
    const py = y + i * 26;
    const on = i === ui.cursor;
    panel(x, py, W - 28, 24, on ? '#2b2242' : '#191330', on ? p.colour : '#3a3155');

    // The pack itself, as a little wrapper.
    box(x + 5, py + 4, 14, 16, p.colour);
    box(x + 5, py + 4, 14, 3, Dex.lighten(p.colour, 0.4));
    box(x + 7, py + 10, 10, 2, '#1b1530');

    txt(p.name, x + 25, py + 5, on ? '#ffffff' : '#c9c0e0', 1);
    txt(p.blurb, x + 25, py + 15, '#8f83b0', 1);
    const afford = S.coins >= p.cost;
    txs(p.cost + '$', W - 34, py + 9, afford ? '#ffd166' : '#8a5a5a', 1, 'right');
    if (on) txt('>', x - 4, py + 9, '#ffd166', 1);
  });

  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  txt('A: BUY AND RIP     B: LEAVE', W / 2, H - 13, '#7186b8', 1, 'center');
}

/* -------------------------------------------------------------------- rip */

/* Five cards want one row; six want two rows of three; seven and eight want
 * four across. A 4+1 row looks like a mistake rather than a layout. */
function cardCols(n) {
  if (n <= 5) return n;
  if (n === 6) return 3;
  return 4;
}

function cardLayout(n) {
  const cw = 44, ch = 60;
  const cols = cardCols(n);
  const rows = Math.ceil(n / cols);
  const gap = 6;
  const totalW = cols * cw + (cols - 1) * gap;
  const totalH = rows * ch + (rows - 1) * gap;
  const x0 = (W - totalW) / 2;
  const y0 = HUD + 6 + Math.max(0, (H - HUD - 36 - totalH) / 2);
  return { cw, ch, cols, rows, gap, x0, y0 };
}

function drawRip() {
  box(0, HUD, W, H - HUD, '#120f22');
  for (let i = 0; i < 30; i++) {
    const x = (i * 71 + Math.floor(t * 12)) % W;
    const y = HUD + ((i * 37) % (H - HUD));
    box(x, y, 1, 1, '#2a2348');
  }

  const L = cardLayout(ui.cards.length);
  ui.cards.forEach((c, i) => {
    const cx = L.x0 + (i % L.cols) * (L.cw + L.gap);
    const cy = L.y0 + Math.floor(i / L.cols) * (L.ch + L.gap);
    if (i < ui.flipped) {
      const sp = Dex.byId(c.species);
      Art.card(ctx, c, cx, cy, L.cw, L.ch, { tick });
      if (i === ui.flipped - 1 && Dex.RARITY_ORDER.indexOf(sp.rarity) >= 2) {
        const glow = Dex.RARITY[sp.rarity].colour;
        Art.frame(ctx, cx - 2, cy - 2, L.cw + 4, L.ch + 4, tick % 2 ? glow : '#ffffff');
      }
    } else {
      Art.cardBack(ctx, cx, cy, L.cw, L.ch);
    }
  });

  txs(ui.pack.name, W / 2, HUD + 2, ui.pack.colour, 1, 'center');
  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  const left = ui.cards.length - ui.flipped;
  txt(left > 0 ? 'A: TURN ONE   B: TURN THE REST   (' + left + ' LEFT)' : 'A: NOW CHOOSE WHAT TO KEEP',
    W / 2, H - 13, left > 0 ? '#7186b8' : '#5ce08a', 1, 'center');
}

/* ------------------------------------------------------------------- pick */

function drawPick() {
  box(0, HUD, W, H - HUD, '#101a1c');
  const L = cardLayout(ui.cards.length);
  ui.cards.forEach((c, i) => {
    const cx = L.x0 + (i % L.cols) * (L.cw + L.gap);
    const cy = L.y0 + Math.floor(i / L.cols) * (L.ch + L.gap);
    Art.card(ctx, c, cx, cy, L.cw, L.ch, { tick, kept: ui.keep[i], cursor: i === ui.cursor });
  });

  const n = keptCount();
  txs('KEEP UP TO FIVE', 10, HUD + 2, '#5ce08a', 1);
  txs(n + ' / ' + KEEP_MAX, W - 10, HUD + 2, n >= KEEP_MAX ? '#ffd166' : '#9fb0d8', 1, 'right');

  // What the ones you are not keeping are worth, said before you decide.
  let coins = 0;
  ui.cards.forEach((c, i) => { if (!ui.keep[i]) coins += Dex.RARITY[Dex.byId(c.species).rarity].rip; });
  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  txt('A: KEEP / DROP     START: DONE     THE REST RIP FOR ' + coins + '$',
    W / 2, H - 13, '#7186b8', 1, 'center');
}

/* ------------------------------------------------------------------ stash */

function drawStash() {
  box(0, HUD, W, H - HUD, '#101427');
  const list = keptIndexes();
  txs('WHERE DO THEY GO?', 10, HUD + 4, '#ffd166', 1);
  txt('TEAM HOLDS SIX. THE BOX HOLDS EVERYTHING ELSE.', 10, HUD + 14, '#7186b8', 1);

  list.forEach((idx, row) => {
    const c = ui.cards[idx];
    const sp = Dex.byId(c.species);
    const y = HUD + 26 + row * 26;
    const on = row === ui.cursor;
    panel(10, y, W - 20, 24, on ? '#1b2340' : '#141a30', on ? '#ffd166' : '#2a3350');
    Art.mon(ctx, sp, c.shiny, 14, y + 3, 18, false);
    txt(sp.name, 38, y + 5, '#e8eefc', 1);
    txt('LV' + c.level + (c.shiny ? '  SHINY' : ''), 38, y + 14, '#9fb0d8', 1);
    Art.typeChip(ctx, sp.type, 130, y + 8, 1);

    const dest = ui.place[idx];
    const dx = W - 74;
    box(dx, y + 6, 30, 12, dest === 'team' ? '#1d4a2c' : '#1a2340');
    Art.frame(ctx, dx, y + 6, 30, 12, dest === 'team' ? '#5ce08a' : '#42a5f5');
    txt('TEAM', dx + 15, y + 10, dest === 'team' ? '#5ce08a' : '#3a4560', 1, 'center');
    box(dx + 34, y + 6, 26, 12, dest === 'box' ? '#1a2a4a' : '#1a2340');
    Art.frame(ctx, dx + 34, y + 6, 26, 12, dest === 'box' ? '#42a5f5' : '#2a3350');
    txt('BOX', dx + 47, y + 10, dest === 'box' ? '#8fd0ff' : '#3a4560', 1, 'center');
  });

  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  txt('A: SWAP TEAM / BOX     START: CONFIRM', W / 2, H - 13, '#7186b8', 1, 'center');
}

/* -------------------------------------------------------------------- box */

function drawBox() {
  box(0, HUD, W, H - HUD, '#0e1626');

  // Tabs
  const tabs = ['TEAM (' + S.party.length + ')', 'BOX (' + S.box.length + ')'];
  tabs.forEach((label, i) => {
    const x = 10 + i * 96;
    const on = ui.tab === i;
    box(x, HUD + 4, 92, 14, on ? '#1e2b48' : '#121a2c');
    Art.frame(ctx, x, HUD + 4, 92, 14, on ? '#ffd166' : '#2a3350');
    txt(label, x + 46, HUD + 9, on ? '#ffd166' : '#6d7ea8', 1, 'center');
  });

  const list = ui.tab === 0 ? S.party : S.box;

  if (!list.length) {
    txt(ui.tab === 0 ? 'NOTHING ON THE TEAM.' : 'THE BOX IS EMPTY.', W / 2, 110, '#4c5a80', 1, 'center');
  } else if (ui.tab === 0) {
    list.forEach((m, i) => {
      const y = HUD + 24 + i * 24;
      const on = i === ui.cursor;
      const sp = Dex.byId(m.species);
      panel(10, y, W - 20, 22, on ? '#1b2340' : '#121a2c', on ? '#ffd166' : '#2a3350');
      Art.mon(ctx, sp, m.shiny, 13, y + 2, 18, false);
      txt(sp.name, 36, y + 3, '#e8eefc', 1);
      if (m.shiny) txt('*', 36 + Art.width(sp.name, 1) + 3, y + 3, '#ffd166', 1);
      txt('LV' + m.level, 36, y + 12, '#9fb0d8', 1);
      Art.typeChip(ctx, sp.type, 110, y + 7, 1);
      Art.bar(ctx, 170, y + 8, 60, 6, m.hp / maxHp(m), hpColour(m.hp / maxHp(m)));
      txt(m.hp + '/' + maxHp(m), 236, y + 8, '#9fb0d8', 1);
      txt('A' + statOf(m, 'atk') + ' D' + statOf(m, 'def') + ' S' + statOf(m, 'spd'), 300, y + 8, '#6d7ea8', 1);
    });
  } else {
    const cols = 6, cw = 58, chh = 30;
    const start = Math.floor(ui.cursor / cols) > 3 ? (Math.floor(ui.cursor / cols) - 3) * cols : 0;
    for (let i = start; i < Math.min(list.length, start + cols * 4); i++) {
      const m = list[i];
      const sp = Dex.byId(m.species);
      const gx = 12 + ((i - start) % cols) * cw;
      const gy = HUD + 24 + Math.floor((i - start) / cols) * chh;
      const on = i === ui.cursor;
      panel(gx, gy, cw - 4, chh - 4, on ? '#1b2340' : '#121a2c', on ? '#ffd166' : '#2a3350');
      Art.mon(ctx, sp, m.shiny, gx + 2, gy + 3, 20, false);
      txt(sp.name.slice(0, 7), gx + 24, gy + 5, '#d8e2f8', 1);
      if (m.shiny) txt('*', gx + 17, gy + 2, '#ffd166', 1);
      txt('LV' + m.level, gx + 24, gy + 14, '#8fa3d8', 1);
    }
    if (list.length > cols * 4) {
      txt((ui.cursor + 1) + '/' + list.length, W - 12, HUD + 9, '#6d7ea8', 1, 'right');
    }
  }

  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  txt(ui.tab === 0 ? 'A: SEND TO BOX     RIGHT: THE BOX     B: LEAVE'
    : 'A: PUT ON TEAM     LEFT: THE TEAM     B: LEAVE', W / 2, H - 13, '#7186b8', 1, 'center');
}

function hpColour(f) { return f > 0.5 ? '#5ce08a' : f > 0.22 ? '#ffd166' : '#ef5350'; }

/* ------------------------------------------------------------------ court */

function drawCourt() {
  box(0, HUD, W, H - HUD, '#171a2c');
  // A court floor with a line down the middle.
  box(0, HUD, W, 40, '#1d2238');
  for (let x = 0; x < W; x += 8) box(x, HUD + 38, 4, 1, '#2f3a58');

  txs('BATTLE COURT', 10, HUD + 6, '#ffb300', 1);
  txt('WIN A TIER TO UNLOCK THE NEXT ONE.', 10, HUD + 16, '#7186b8', 1);

  TIERS.forEach((tier, i) => {
    const y = HUD + 30 + i * 26;
    const on = i === ui.cursor;
    const locked = i > S.best;
    panel(10, y, W - 20, 24, on ? '#242c48' : '#141a2e', on ? '#ffd166' : '#2a3350');
    txt(tier.name, 16, y + 4, locked ? '#5a6480' : '#ffffff', 1);
    txt(tier.size + ' ON THE TEAM, AROUND LEVEL ' + tier.level, 16, y + 14,
      locked ? '#3f4763' : '#8fa3d8', 1);
    if (locked) {
      txt('LOCKED', W - 20, y + 9, '#5a6480', 1, 'right');
    } else {
      txt('FEE ' + tier.fee + '$', W - 96, y + 4, S.coins >= tier.fee ? '#c9c0e0' : '#8a5a5a', 1);
      txs('WIN ' + tier.prize + '$', W - 20, y + 10, '#ffd166', 1, 'right');
    }
    if (i < S.best) txt('CLEARED', W - 96, y + 14, '#5ce08a', 1);
  });

  panel(4, H - 16, W - 8, 12, '#0d1426', '#2a3350');
  txt('A: FIGHT     B: LEAVE     YOUR TEAM IS PATCHED UP FIRST', W / 2, H - 13, '#7186b8', 1, 'center');
}

/* ----------------------------------------------------------------- battle */

function drawBattle() {
  // Field
  for (let y = 0; y < 150; y++) {
    box(0, y, W, 1, y < 70 ? '#1a2340' : '#20304a');
  }
  box(0, 96, W, 54, '#2f6b3a');
  box(0, 96, W, 2, '#3c7f46');
  box(0, 148, W, 6, '#24512c');

  const them = theirMon(), me = myMon();

  // Them, up the back
  const tx = 246 + (B.shakeThem > 0 ? rnd(3) - 1 : 0);
  const ty = 40;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(tx + 24, ty + 50, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  // A fainted creature stays on the field but goes faint, rather than
  // vanishing between one message and the next.
  ctx.globalAlpha = alive(them) ? 1 : 0.3;
  Art.mon(ctx, Dex.byId(them.species), them.shiny, tx, ty + (alive(them) ? 0 : 6), 48, true);
  ctx.globalAlpha = 1;

  // Me, down the front and bigger, facing away is a lie we do not tell — the
  // art only faces one way, so it is mirrored and that reads fine.
  const mx = 48 + (B.shakeMe > 0 ? rnd(3) - 1 : 0);
  const my = 84;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(mx + 28, my + 58, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alive(me) ? 1 : 0.3;
  Art.mon(ctx, Dex.byId(me.species), me.shiny, mx, my + (alive(me) ? 0 : 6), 56, false);
  ctx.globalAlpha = 1;

  if (B.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, W, 150); }

  drawBattleCard(them, 10, 8, true);
  drawBattleCard(me, W - 156, 112, false);

  // The text box
  panel(4, 152, W - 8, H - 156, '#0d1426', '#3c4a70');

  if (B.queue.length) {
    const ev = B.queue[0];
    txt(ev.text || '', 14, 160, '#e8eefc', 1);
    if (Math.floor(t * 3) % 2) txt('>', W - 16, H - 14, '#ffd166', 1);
    return;
  }

  if (B.phase === 'over') {
    const r = B.result || {};
    txt(r.win ? 'YOU TOOK IT. ' + r.prize + ' COINS.' : r.ran ? 'YOU LEFT THE COURT.' : 'BEATEN THIS TIME.',
      14, 160, r.win ? '#5ce08a' : '#ef9a9a', 1);
    B.xpLog.slice(0, 2).forEach((l, i) => txt(l, 14, 172 + i * 9, '#9fb0d8', 1));
    if (Math.floor(t * 2) % 2) txt('A: BACK TO TOWN', W - 16, H - 14, '#ffd166', 1, 'right');
    return;
  }

  if (B.phase === 'menu') {
    txt('WHAT NOW?', 14, 160, '#e8eefc', 1);
    ['FIGHT', 'SWAP', 'LEAVE'].forEach((label, i) => {
      const y = 158 + i * 11;
      const on = i === B.menu;
      txt((on ? '> ' : '  ') + label, 200, y, on ? '#ffd166' : '#8fa3d8', 1);
    });
    return;
  }

  if (B.phase === 'moves') {
    const moves = movesOf(me);
    moves.forEach((mv, i) => {
      const y = 158 + i * 11;
      const on = i === B.moveSel;
      const eff = mv.power > 0 ? Dex.effect(mv.type, typeOf(them)) : 1;
      txt((on ? '>' : ' ') + mv.name, 12, y, on ? '#ffd166' : '#8fa3d8', 1);
      Art.typeChip(ctx, mv.type, 150, y - 1, 1);
      if (mv.power > 0) {
        txt('PWR ' + mv.power, 210, y, '#6d7ea8', 1);
        if (eff > 1) txt('STRONG', 268, y, '#5ce08a', 1);
        else if (eff < 1) txt('WEAK', 268, y, '#ef9a9a', 1);
      } else {
        txt(mv.note || 'A trick', 210, y, '#6d7ea8', 1);
      }
    });
    txt('B: BACK', W - 16, H - 14, '#6d7ea8', 1, 'right');
    return;
  }

  if (B.phase === 'swap' || B.phase === 'forceswap') {
    const list = B.phase === 'swap' ? S.party.map((m, i) => i)
      : S.party.map((m, i) => i).filter((i) => alive(S.party[i]));
    txt(B.phase === 'forceswap' ? 'SEND OUT WHO?' : 'SWAP TO WHO?', 12, 158, '#e8eefc', 1);
    list.slice(0, 4).forEach((idx, row) => {
      const m = S.party[idx];
      const y = 168 + row * 10;
      const on = row === clamp(B.swapSel, 0, list.length - 1);
      const dead = !alive(m);
      txt((on ? '>' : ' ') + nameOf(m).slice(0, 10), 12, y,
        dead ? '#5a6480' : on ? '#ffd166' : '#8fa3d8', 1);
      txt('LV' + m.level, 110, y, dead ? '#5a6480' : '#6d7ea8', 1);
      Art.bar(ctx, 150, y, 40, 5, m.hp / maxHp(m), hpColour(m.hp / maxHp(m)));
      if (idx === B.mine) txt('OUT', 196, y, '#5ce08a', 1);
    });
    if (B.phase === 'swap') txt('B: BACK', W - 16, H - 14, '#6d7ea8', 1, 'right');
  }
}

function drawBattleCard(m, x, y, isFoe) {
  panel(x, y, 140, 30, '#101a30', '#3c4a70');
  txt(nameOf(m), x + 5, y + 4, '#e8eefc', 1);
  txt('LV' + m.level, x + 108, y + 4, '#9fb0d8', 1);
  Art.typeChip(ctx, typeOf(m), x + 5, y + 12, 1);
  const f = m.hp / maxHp(m);
  Art.bar(ctx, x + 56, y + 13, 78, 6, f, hpColour(f));
  if (!isFoe) txt(m.hp + '/' + maxHp(m), x + 56, y + 21, '#9fb0d8', 1);
  if (m.shiny) txt('*', x + 132, y + 21, '#ffd166', 1);
}

/* ------------------------------------------------------------------- menu */

function drawMenu() {
  ctx.fillStyle = 'rgba(5,7,12,0.72)';
  ctx.fillRect(0, HUD, W, H - HUD);
  const w = 150, h = MENU_ITEMS.length * 14 + 26;
  const x = (W - w) / 2, y = HUD + 16;
  panel(x, y, w, h, '#101a30', '#ffd166');
  txt('MENU', x + w / 2, y + 6, '#ffd166', 1, 'center');
  MENU_ITEMS.forEach((item, i) => {
    const on = i === ui.cursor;
    const label = item === 'SOUND' ? 'SOUND: ' + (Sound.isMuted() ? 'OFF' : 'ON') : item;
    txt((on ? '> ' : '  ') + label, x + 12, y + 22 + i * 14, on ? '#ffffff' : '#8fa3d8', 1);
  });
  txt('SPRITE LAB LOADS YOUR OWN PNG SHEETS', x + w / 2, y + h - 10, '#4c5a80', 1, 'center');
}

/* ------------------------------------------------------------------- help */

const HELP = [
  'THE LOOP',
  ' 1  FIGHT AT THE COURT FOR COINS.',
  ' 2  BUY A PACK AT A SHOP.',
  ' 3  RIP IT OPEN, ONE CARD AT A TIME.',
  ' 4  KEEP UP TO FIVE. THE REST TEAR UP FOR COINS.',
  ' 5  SIX ON THE TEAM, THE REST IN THE BOX.',
  '',
  'IN A FIGHT',
  ' TYPE BEATS TYPE. THE MOVE LIST SAYS STRONG OR WEAK',
  ' BEFORE YOU COMMIT, SO THE CHART IS LEARNABLE.',
  ' A MOVE OF YOUR OWN TYPE HITS A LITTLE HARDER.',
  '',
  'YOUR OWN ART',
  ' THE SPRITE LAB TAKES A PNG SHEET, CUTS IT INTO',
  ' FRAMES, AND LETS YOU POINT A FRAME AT ANY CREATURE',
  ' OR AT THE TRAINER. IT STICKS, EVERYWHERE, FOR GOOD.',
];

function drawHelp() {
  box(0, 0, W, H, '#0b1020');
  txs('HOW TO PLAY', 12, 10, '#ffd166', 1);
  HELP.forEach((line, i) => {
    const head = line && line[0] !== ' ';
    txt(line, 12, 26 + i * 10, head ? '#5ce08a' : '#9fb0d8', 1);
  });
  txt('B: BACK', W - 12, H - 14, '#6d7ea8', 1, 'right');
}

/* ==================================================================== loop */

let last = performance.now(), acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 6) { update(STEP); acc -= STEP; }
  draw();
  requestAnimationFrame(frame);
}

/* Sheets decode after the game has started drawing, so a creature whose art
 * arrives late needs nothing more than the next frame — which it gets. */
Sprites.onReady(() => {});

if (!load()) newGame();
healAll();
requestAnimationFrame(frame);

/* Handy from the console while building: RIPGO.give('voiddrake', 40) */
window.RIPGO = {
  state: () => S,
  give: (id, lvl) => { S.party.push(freshMon(id, lvl || 20, false)); save(); },
  coins: (n) => { S.coins += n; save(); },
  wipe: () => { localStorage.removeItem(SAVE); newGame(); go('title'); },
};

})();
