/* ============================================================================
   ROAMINALS
   A monster-catching game in the shape of the original Game Boy ones, set
   entirely inside one very large building: the Rothsay Grand Hotel, shut for
   forty years.

   The fiction that drives every system: the hotel's ghosts could not stay
   ghosts, so each one moved into an OBJECT — a mop, a boiler, a ledger, a
   chandelier — and the object moved into an ANIMAL that had wandered in out of
   the cold. That fusion is a Roaminal. What the ghost possessed is the
   creature's TYPE, which is why the type chart is a wheel of household things
   rather than fire and water.

   One generation, forty-four species. Commons everywhere, ultra rares that turn
   up about one encounter in forty, three legendaries that exist once each, and
   a shiny roll on every single wild creature.

   Plain JS, no dependencies, no build step. Everything is drawn from character
   grids and canvas primitives into a 160x144 buffer — a Game Boy screen — and
   blown up whole. There are no image, font or audio files.
   ========================================================================== */
(() => {
'use strict';

/* ---------------------------------------------------------------- constants */

const BW = 160, BH = 144;      // the screen, in art pixels. A Game Boy.
const SCALE = 4;               // blown up to 640x576
const TS = 16;                 // tile size, art pixels
const VIEW_W = BW / TS, VIEW_H = BH / TS;   // ten tiles across, nine down

const FW = 40, FH = 32;        // every floor of the hotel is this many tiles
const STEP_FRAMES = 8;         // frames to walk one tile (2px a frame)
const TURN_FRAMES = 5;         // frames spent turning on the spot

const MAX_PARTY = 6;
const MAX_LEVEL = 60;
const SHINY_ODDS = 220;        // one wild creature in this many, halved by the penny

/* The four shades of a Game Boy screen. Index 0 is the lightest — the colour of
   the glass with nothing drawn on it — and 3 is the darkest ink. */
const PAL = ['#e0f8cf', '#86c06c', '#306850', '#071821'];

const SAVE_KEY = 'roaminals-save-v1';

/* ------------------------------------------------------------------- canvas */

const cv = document.getElementById('c');
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

const buf = document.createElement('canvas');
buf.width = BW; buf.height = BH;
const bx = buf.getContext('2d');
bx.imageSmoothingEnabled = false;

function clear(shade) {
  bx.fillStyle = PAL[shade === undefined ? 0 : shade];
  bx.fillRect(0, 0, BW, BH);
}

function present() {
  cx.imageSmoothingEnabled = false;
  cx.drawImage(buf, 0, 0, BW * SCALE, BH * SCALE);
}

/* ---------------------------------------------------------------- utilities */

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const rnd = n => Math.floor(Math.random() * n);
const chance = p => Math.random() < p;
const pick = arr => arr[rnd(arr.length)];

/* A seeded generator, so a floor of the hotel comes out the same way for
   everybody who plays it without one map being stored in this file. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ letters */
/* A 5x7 face. Six art pixels a character means twenty-six characters fit across
   the screen, which is the width the dialogue is written to. */

const FONT = {
  'A': [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  'B': ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  'C': [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  'D': ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  'E': ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  'F': ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  'G': [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  'H': ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  'I': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  'J': ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  'K': ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  'L': ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  'M': ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  'N': ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  'O': [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  'P': ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  'Q': [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  'R': ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  'S': [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  'T': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  'U': ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  'V': ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  'W': ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  'X': ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  'Y': ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  'Z': ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  '0': [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  '1': ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  '2': [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  '3': ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  '4': ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  '5': ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  '6': [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  '7': ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  '8': [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  '9': [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  '.': [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ',': [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  '!': ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  '?': [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ':': [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ';': [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  '-': [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  '/': ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  '(': ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ')': [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  '%': ["#...#", "...#.", "..#..", "..#..", ".#...", "#...#", "....."],
  '+': [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  '*': [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  '<': ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  '>': [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  '=': [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  '#': [".#.#.", "#####", ".#.#.", ".#.#.", "#####", ".#.#.", "....."],
  '&': [".##..", "#..#.", "#..#.", ".##..", "#..#.", "#..#.", ".##.#"],
  '_': [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  '@': [".###.", "#...#", "#.##.", "#.#.#", "#.##.", "#....", ".###."],
  '^': ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
  '~': [".....", ".....", ".#...", "#.#.#", "...#.", ".....", "....."],
  '$': ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
};

const GW = 5, GH = 7, GAP = 1;
const textCache = new Map();

function textWidth(str, scale) {
  const n = String(str).length;
  return n ? (n * (GW + GAP) - GAP) * (scale || 1) : 0;
}

function bakeText(str, shade, scale) {
  const s = scale || 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, textWidth(str, s));
  c.height = GH * s;
  const g = c.getContext('2d');
  g.fillStyle = PAL[shade];
  for (let i = 0; i < str.length; i++) {
    const glyph = FONT[str[i]];
    if (!glyph) continue;                    // spaces and unknowns: left blank
    const ox = i * (GW + GAP) * s;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (glyph[y][x] === '#') g.fillRect(ox + x * s, y * s, s, s);
      }
    }
  }
  return c;
}

/* align: 'left' (default), 'center', 'right'. Coordinates are art pixels. */
function text(str, x, y, shade, scale, align) {
  str = String(str).toUpperCase();
  const sh = shade === undefined ? 3 : shade;
  const s = scale || 1;
  const key = str + '|' + sh + '|' + s;
  let c = textCache.get(key);
  if (!c) {
    if (textCache.size > 500) textCache.clear();
    c = bakeText(str, sh, s);
    textCache.set(key, c);
  }
  let dx = Math.round(x);
  if (align === 'center') dx = Math.round(x - c.width / 2);
  else if (align === 'right') dx = Math.round(x - c.width);
  bx.drawImage(c, dx, Math.round(y));
  return c.width;
}

/* ------------------------------------------------------------------ sprites */
/* Art is written as rows of characters: '.' is see-through and '0' to '3' are
   the four shades, lightest to darkest. `remap` is a four-character string that
   re-points those shades, which is how a creature's evolutions and its shiny
   coat all come out of one grid — '0123' is the plain coat, '1223' a heavier
   one, and '3210' the inversion a shiny wears. */

const spriteCache = new Map();

function makeSprite(rows, remap) {
  let byRemap = spriteCache.get(rows);
  if (!byRemap) { byRemap = new Map(); spriteCache.set(rows, byRemap); }
  const key = remap || '0123';
  const hit = byRemap.get(key);
  if (hit) return hit;

  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch < '0' || ch > '3') continue;
      g.fillStyle = PAL[+key[+ch]];
      g.fillRect(x, y, 1, 1);
    }
  }
  byRemap.set(key, c);
  return c;
}

/* Draws a sprite canvas, optionally mirrored and blown up by a whole number.
   Everything lands on whole pixels — nothing here is ever drawn on a half
   pixel, which is what keeps the grid honest. */
function blit(spr, x, y, flip, scale) {
  const s = scale || 1;
  x = Math.round(x); y = Math.round(y);
  const w = spr.width * s, h = spr.height * s;
  if (flip) {
    bx.save();
    bx.translate(x + w, y);
    bx.scale(-1, 1);
    bx.drawImage(spr, 0, 0, w, h);
    bx.restore();
  } else {
    bx.drawImage(spr, x, y, w, h);
  }
}

/* A flat silhouette of a sprite: the ledger's unseen entries, and the shape
   inside a jar that has not popped open yet. */
function blitSolid(spr, x, y, shade, scale) {
  const s = scale || 1;
  const c = document.createElement('canvas');
  c.width = spr.width; c.height = spr.height;
  const g = c.getContext('2d');
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = PAL[shade];
  g.fillRect(0, 0, c.width, c.height);
  bx.drawImage(c, Math.round(x), Math.round(y), spr.width * s, spr.height * s);
}

/* -------------------------------------------------------------- panel chrome */
/* Every box in the game — dialogue, menus, the battle HUD — is the same double
   frame, so the whole thing reads as one machine. */

function panel(x, y, w, h) {
  bx.fillStyle = PAL[0];
  bx.fillRect(x, y, w, h);
  bx.fillStyle = PAL[3];
  bx.fillRect(x, y, w, 1);
  bx.fillRect(x, y + h - 1, w, 1);
  bx.fillRect(x, y, 1, h);
  bx.fillRect(x + w - 1, y, 1, h);
  bx.fillStyle = PAL[2];
  bx.fillRect(x + 2, y + 2, w - 4, 1);
  bx.fillRect(x + 2, y + h - 3, w - 4, 1);
  bx.fillRect(x + 2, y + 2, 1, h - 4);
  bx.fillRect(x + w - 3, y + 2, 1, h - 4);
}

function fillRect(x, y, w, h, shade) {
  bx.fillStyle = PAL[shade];
  bx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/* The chevron that marks the highlighted line of any list. */
function cursorMark(x, y, shade) {
  const s = shade === undefined ? 3 : shade;
  fillRect(x, y, 1, 5, s);
  fillRect(x + 1, y + 1, 1, 3, s);
  fillRect(x + 2, y + 2, 1, 1, s);
}

/* ============================================================================
   ART
   Creatures are drawn as a 16x16 BODY belonging to a family, plus an 8x8 ITEM
   showing what the ghost inside it possessed. That is why a line's stages look
   like relatives: the same animal, shaded heavier, wearing more of the object
   until the last stage is carrying two of them and trailing ghostlight.
   ========================================================================== */

/* ------------------------------------------------------------- animal bodies */
/* Every grid is 16 wide and 16 tall. 3 is the outline, 1 the coat, 2 the shadow
   under it, 0 a highlight. Eyes are always dark on a light face so they still
   read when a shade scheme moves the coat around underneath them. */

const BODY = {

possum: [
"................",
"..33........33..",
"..313......313..",
"..311333333113..",
"..311111111113..",
"..313311113313..",
"..311111111113..",
"..311132231113..",
".31111111111113.",
".31111111111113.",
".31122222222113.",
".31122222222113.",
".31122222222113.",
"..311111111113..",
"...3311111133...",
"...33......33...",
],

rat: [
"................",
"...33.....33....",
"..3113...3113...",
"..3113333113....",
"..3111111113....",
"..3131131113....",
"..3111111113....",
"..3111322113....",
".311111111113...",
".311111111113.33",
".31122222113.33.",
".31122222113.3..",
".3112222211333..",
".31111111113....",
"..333111333.....",
"....3333........",
],

moth: [
"................",
"...3......3.....",
"...33....33.....",
"3333113113333...",
"322111311112233.",
"321111311111223.",
"321113111311223.",
"332111311113233.",
".33211131112333.",
"..332111312313..",
"...332111233....",
"...332111313....",
"....3311233.....",
".....33333......",
"................",
"................",
],

cat: [
"................",
"..3..........3..",
"..33........33..",
"..313......313..",
"..311333333113..",
"..311111111113..",
"..313111111313..",
"..311113311113..",
"..311131131113..",
".31111111111113.",
".31111111111113.",
".31122222222113.",
".31122222222113.",
".31133111133113.",
"..33...3333..33.",
"................",
],

beetle: [
"................",
".....333333.....",
"....31111113....",
"....31311313....",
"....31111113....",
"..333333333333..",
".33111111111133.",
"3311111111111133",
"3111111111111113",
"3111122112211113",
"3111222222221113",
"3311222222221133",
".33112222221133.",
"..331111111113..",
"3..3333333333..3",
"33............33",
],

newt: [
"................",
"................",
"....3333333.....",
"...311111113....",
"...313111313....",
"...311111113....",
"...311122113333.",
"..33111111111133",
".331111111111113",
"3311122222211113",
"3111122222211113",
".331111111111113",
"..33111111111133",
"...3.33111133...",
"....33.3113.....",
".......33.......",
],

hare: [
"................",
"...33....33.....",
"..3113..3113....",
"..3113..3113....",
"..3113..3113....",
"..31133333113...",
"...3111111113...",
"...313111313....",
"...311111113....",
"..33111321133...",
".3311111111133..",
".3111111111113..",
".3112222222113..",
".3311222221113..",
"..331111111313..",
"...3333333313...",
],

snail: [
"................",
"................",
".....33333......",
"...331111133....",
"..3113333113....",
".311311113113...",
".311311131113...",
".311131113113...",
".311133311133...",
".33111111113....",
"3.331111113.....",
"33..3333333.....",
"3113............",
"3113.3333333....",
".33.311111113...",
"....33333333....",
],

pigeon: [
"................",
".......333......",
"......31113.....",
".....3131113....",
".....3111113....",
"....31111132....",
"...311111133....",
"..3111111133....",
".31111111133....",
".31111111133....",
".31122211133....",
"..3112221133....",
"...33122113.....",
".....331133.....",
"....331..33.....",
"...33.....3.....",
],

bear: [
"................",
"..333......333..",
".31113....31113.",
".31113....31113.",
".31133333331113.",
"..311111111113..",
"..313111111313..",
"..311111111113..",
"..311113311113..",
".331111111111133",
"3311111111111133",
"3111122222211113",
"3111222222221113",
"3311222222221133",
".33111111111133.",
"..3333....3333..",
],

frog: [
"................",
"................",
"...333....333...",
"..31113..31113..",
"..31313..31313..",
"..311133331113..",
".3311111111133..",
"3311111111111133",
"3111111111111113",
"3111333333331113",
"3311111111111133",
".33111111111113.",
"3..33111111133.3",
"33...33333333.33",
"3113.........311",
".33...........33",
],

eel: [
"................",
".....33333......",
"....3111113.....",
"....3131113.....",
"....3111113.....",
"...331111113....",
"...3311111133...",
"....331111113...",
".....33111113...",
"......33111133..",
".....3311111133.",
"....33111111133.",
"...33111111133..",
"..331111113133..",
"..33111133......",
"...33333........",
],

spider: [
"................",
"3..............3",
"33....3333....33",
"133..311113..331",
"1133311111133311",
"1113313131133111",
"111311111113111.",
"111311111113111.",
"113311111113311.",
"11331111111133.1",
"1.331111111113.1",
"3..33111111133.3",
"....3311111313..",
"...3.3333333.3..",
"..33..3..3..33..",
".33...3..3...33.",
],

warden: [
"................",
"......3333......",
"....331111133...",
"...3111111113...",
"...3131131313...",
"...3111111113...",
"...3311111131...",
"..3311111133....",
".331111111133...",
".311111111113...",
".311222222113...",
".311111111113...",
".331111111133...",
"..33111111133...",
"...33.3333.33...",
"................",
],

stoker: [
"................",
"..3..........3..",
"..3333333333333.",
".33111111111333.",
"331311131311333.",
"3111111111111113",
"3113333333333113",
"3131313131313113",
"3113333333333113",
"3111111111111113",
"3311122222211133",
"3331122222211333",
"3.331111111133.3",
"3..3333333333..3",
"33.3........33.3",
".3..........3..3",
],

midnight: [
"................",
".....333333.....",
"...3311111133...",
"..331311131133..",
"..311111111113..",
"..311333331113..",
"..311311311113..",
"..311311311113..",
"..311111311113..",
"..331111111133..",
"...3311111113...",
"...33111111113..",
"..3311111111113.",
".33111111111113.",
".33.33333333.33.",
".3...........3..",
],

};

/* ------------------------------------------------------- the possessed things */
/* 8x8, hung on the animal at the family's own anchor. A last-stage Roaminal
   carries two, one on each side. */

const THING = {
mop:   ["...33...", "..3113..", "..3113..", ".311113.", "3111113.", "3131113.", "3111113.", ".333333."],
flame: ["...33...", "..3113..", ".311113.", "3110111.", "3110111.", "3111113.", ".311113.", "..3333.."],
frost: ["3..33..3", "33.11.33", ".331133.", "31111113", "31111113", ".331133.", "33.11.33", "3..33..3"],
wire:  ["..3333..", ".311113.", "3113311.", "31133113", "31133113", "311331..", ".311113.", "..3333.."],
paper: ["33333333", "31111113", "31333113", "31111113", "31333113", "31111113", "31333113", "33333333"],
glass: ["...33...", "..3113..", ".311113.", "31101113", "31110113", ".311113.", "..3113..", "...33..."],
cloth: ["33333333", "31111113", "31111113", "31111113", "31111113", "31311313", "313.3.13", ".3.3.3.3"],
brass: [".3333...", "311113..", "313.113.", "311113..", ".33113..", "...3113.", "...31133", "....3333"],
root:  ["....33..", "...3113.", "..31113.", ".3111133", "31111133", "31111133", ".333333.", "...33..."],
toy:   ["33333333", "31111113", "31331313", "31111113", "31313313", "31111113", "31133113", "33333333"],
};

/* Where the thing hangs, and whether the pair looks right mirrored. */
const FAMILY = {
  possum:   { anchor: [9, 0] },
  rat:      { anchor: [9, 0] },
  moth:     { anchor: [4, 9], pair: false },
  cat:      { anchor: [9, 0] },
  beetle:   { anchor: [10, 8] },
  newt:     { anchor: [9, 0] },
  hare:     { anchor: [9, 8] },
  snail:    { anchor: [5, 3], pair: false },
  pigeon:   { anchor: [0, 4] },
  bear:     { anchor: [9, 8] },
  frog:     { anchor: [8, 0] },
  eel:      { anchor: [0, 6] },
  spider:   { anchor: [10, 9] },
  warden:   { anchor: [9, 8] },
  stoker:   { anchor: [4, 5], pair: false },
  midnight: { anchor: [4, 4], pair: false },
};

/* Shade schemes. The outline never moves — only the coat under it darkens as a
   line evolves. A shiny is the whole grid turned inside out, which on a Game
   Boy is the only way a different-coloured creature could ever announce
   itself. */
const COAT = ['0113', '0123', '0023'];
const SHINY_COAT = '3203';

/* --------------------------------------------------------------- the marks */
/* Every one of the forty-four wears its own thing on top of the family shape:
   a horn, a crown, bristles, drawer fronts, a winding key. Runs are written as
   [x, y, w, h, shade] in the creature's own sixteen-pixel grid, so a mark can
   break the outline and change the silhouette — which is the point. No two
   Roaminals in the generation share a set. */

const MARK = {
  1:  [[7, 1, 2, 2, 3]],
  2:  [[1, 8, 2, 2, 0], [13, 10, 2, 2, 0], [2, 11, 1, 1, 0]],
  3:  [[3, 7, 1, 2, 3], [5, 6, 1, 3, 3], [7, 6, 1, 3, 3], [9, 6, 1, 3, 3], [11, 7, 1, 2, 3]],

  4:  [[7, 3, 2, 2, 3], [8, 2, 1, 1, 0]],
  5:  [[3, 10, 3, 1, 3], [9, 11, 4, 1, 3], [5, 12, 3, 1, 3]],
  6:  [[4, 9, 1, 4, 3], [6, 9, 1, 4, 3], [8, 9, 1, 4, 3], [10, 9, 1, 4, 3], [7, 0, 2, 3, 3]],

  7:  [[3, 0, 1, 1, 3], [12, 0, 1, 1, 3]],
  8:  [[3, 5, 2, 2, 3], [11, 5, 2, 2, 3]],
  9:  [[2, 4, 3, 3, 3], [11, 4, 3, 3, 3], [5, 12, 6, 3, 2], [6, 15, 4, 1, 3]],

  10: [[2, 1, 2, 2, 0], [2, 1, 2, 1, 3]],
  11: [[3, 10, 10, 1, 3], [3, 12, 10, 1, 3]],
  12: [[3, 9, 10, 1, 3], [3, 12, 10, 1, 3], [7, 10, 2, 1, 0], [7, 13, 2, 1, 0]],

  13: [[7, 9, 2, 2, 3], [8, 10, 1, 3, 3]],
  14: [[4, 8, 2, 2, 3], [10, 8, 2, 2, 3], [7, 12, 2, 2, 3]],
  15: [[7, 0, 2, 4, 3], [6, 0, 1, 2, 3], [9, 0, 1, 2, 3]],

  16: [[5, 7, 1, 1, 3], [8, 6, 1, 1, 3], [11, 7, 1, 1, 3]],
  17: [[4, 8, 1, 4, 3], [7, 8, 1, 4, 3], [10, 8, 1, 4, 3]],
  18: [[6, 1, 1, 3, 3], [8, 0, 1, 4, 3], [10, 1, 1, 3, 3], [3, 9, 2, 1, 0]],

  19: [[3, 1, 2, 2, 0], [8, 1, 2, 2, 0]],
  20: [[2, 9, 12, 1, 0], [4, 10, 8, 1, 0]],
  21: [[2, 0, 1, 3, 3], [13, 0, 1, 3, 3], [1, 1, 1, 2, 3], [14, 1, 1, 2, 3], [3, 9, 10, 1, 0]],

  22: [[8, 0, 1, 3, 3], [7, 0, 1, 1, 3], [10, 1, 1, 1, 3]],
  23: [[2, 6, 1, 6, 3], [13, 7, 1, 5, 3], [4, 4, 3, 1, 3]],
  24: [[7, 0, 2, 4, 3], [5, 0, 6, 2, 3], [3, 1, 3, 1, 3], [11, 1, 3, 1, 3]],

  25: [[7, 0, 1, 3, 3], [9, 0, 1, 2, 3]],
  26: [[1, 8, 1, 3, 3], [2, 10, 1, 3, 3], [3, 12, 1, 2, 3]],
  27: [[3, 13, 10, 1, 3], [4, 14, 1, 2, 0], [7, 15, 1, 1, 0], [10, 14, 1, 2, 0]],

  28: [[7, 7, 1, 1, 3], [7, 9, 1, 1, 3], [7, 11, 1, 1, 3]],
  29: [[13, 5, 3, 1, 3], [14, 4, 1, 3, 3], [12, 5, 1, 1, 3]],
  30: [[2, 0, 12, 1, 3], [4, 1, 8, 1, 3], [7, 1, 2, 3, 3], [1, 1, 1, 1, 3], [14, 1, 1, 1, 3]],

  31: [[12, 3, 3, 3, 0], [13, 2, 1, 1, 0]],
  32: [[7, 0, 2, 4, 0], [6, 1, 1, 2, 0], [9, 1, 1, 2, 0]],

  33: [[3, 4, 10, 1, 3], [3, 6, 10, 1, 3]],
  34: [[5, 2, 6, 1, 3], [5, 2, 1, 4, 3], [10, 2, 1, 4, 3], [5, 5, 6, 1, 3]],

  35: [[7, 7, 1, 4, 3], [8, 9, 4, 1, 3]],
  36: [[3, 5, 1, 1, 3], [12, 5, 1, 1, 3], [3, 12, 1, 1, 3], [12, 12, 1, 1, 3], [7, 4, 2, 1, 3]],

  37: [[5, 0, 1, 3, 3], [7, 0, 2, 4, 3], [10, 0, 1, 3, 3], [4, 14, 8, 2, 2]],
  38: [[4, 0, 8, 1, 3], [5, 0, 1, 2, 3], [8, 0, 1, 2, 3], [11, 0, 1, 2, 3], [3, 10, 10, 1, 0]],
  39: [[3, 0, 1, 3, 0], [6, 0, 1, 4, 0], [9, 0, 1, 4, 0], [12, 0, 1, 3, 0], [2, 9, 12, 1, 0]],
  40: [[8, 0, 1, 2, 3], [7, 2, 1, 2, 3], [9, 2, 1, 2, 3], [6, 4, 1, 2, 3], [0, 7, 2, 1, 3]],
  41: [[2, 0, 1, 4, 3], [13, 0, 1, 4, 3], [1, 2, 1, 1, 3], [14, 2, 1, 1, 3], [4, 1, 1, 2, 3], [11, 1, 1, 2, 3]],

  42: [[6, 0, 4, 1, 3], [7, 0, 1, 2, 3], [4, 12, 8, 1, 3], [7, 13, 2, 3, 3]],
  43: [[1, 0, 2, 3, 3], [13, 0, 2, 3, 3], [6, 0, 1, 2, 3], [9, 0, 1, 2, 3], [3, 10, 10, 1, 0]],
  44: [[7, 5, 1, 5, 3], [8, 8, 4, 1, 3], [7, 0, 2, 2, 0], [2, 2, 1, 1, 0], [13, 2, 1, 1, 0], [2, 13, 1, 1, 0], [13, 13, 1, 1, 0]],
};

function drawMark(runs, x, y, s, coat) {
  if (!runs) return;
  for (const r of runs) {
    fillRect(x + r[0] * s, y + r[1] * s, r[2] * s, r[3] * s, +coat[r[4]]);
  }
}

/* Ghostlight coming off a creature. Seeded per species, so the same Roaminal
   always smokes the same way. */
function drawWisps(x, y, n, seed, t) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const ax = x + Math.floor(r() * 34);
    const ay = y + Math.floor(r() * 30);
    const bob = Math.round(Math.sin(t * 2 + i) * 2);
    fillRect(ax, ay + bob, 2, 2, 2);
    fillRect(ax + 1, ay + bob - 2, 1, 1, 1);
  }
}

/* The whole creature: animal, the object that possessed it, and whatever the
   evolution has piled on top. `scale` is 2 in battle, 1 in the menus. */
function drawCreature(sp, x, y, scale, shiny, t) {
  const s = scale || 1;
  const fam = FAMILY[sp.family] || FAMILY.possum;
  const coat = shiny ? SHINY_COAT : COAT[Math.min(2, sp.stage - 1)];
  const body = makeSprite(BODY[sp.family] || BODY.possum, coat);
  const thing = makeSprite(THING[sp.thing] || THING.mop, coat);

  if (sp.stage >= 2 || sp.rarity !== 'COMMON') {
    drawWisps(x - 3 * s, y - 2 * s, sp.stage >= 3 ? 6 : 3, sp.no * 977 + 13, t || 0);
  }

  blit(body, x, y, false, s);
  drawMark(MARK[sp.no], x, y, s, coat);
  blit(thing, x + fam.anchor[0] * s, y + fam.anchor[1] * s, false, s);

  /* The last stage of a line carries a second one, mirrored, and wears a hoop
     of ghostlight that turns slowly. */
  if (sp.stage >= 3) {
    if (fam.pair !== false) {
      blit(thing, x + (8 - fam.anchor[0]) * s, y + fam.anchor[1] * s, true, s);
    }
    const w = 16 * s;
    for (let i = 0; i < 6; i++) {
      const a = (t || 0) * 1.5 + i * 1.05;
      fillRect(x + w / 2 + Math.cos(a) * (w * 0.66) - 1,
               y + 9 * s + Math.sin(a) * (w * 0.34) - 1, 2, 2, 2);
    }
  }
}

/* --------------------------------------------------------------- the porter */
/* You: the new night porter. Cap, satchel, sixteen pixels tall. */

const PORTER_DOWN = [
"................",
"....333333......",
"...31111113.....",
"..3111111113....",
"..3333333333....",
"...31111113.....",
"...31311313.....",
"...31111113.....",
"...33111133.....",
"..3113113113....",
"..3113113113....",
"..3111111113....",
"..3111111113....",
"...31111113.....",
"...3113.3113....",
"...333...333....",
];

const PORTER_UP = [
"................",
"....333333......",
"...31111113.....",
"..3111111113....",
"..3333333333....",
"...31111113.....",
"...31111113.....",
"...31111113.....",
"...33111133.....",
"..3113113113....",
"..3113113113....",
"..3111111113....",
"..3111111113....",
"...31111113.....",
"...3113.3113....",
"...333...333....",
];

const PORTER_SIDE = [
"................",
"....3333........",
"...311113.......",
"..31111113......",
"..333333333.....",
"...3111133......",
"...3131133......",
"...3111113......",
"...3311113......",
"..31111113......",
"..311111133.....",
"..311111113.....",
"..311111113.....",
"...3111113......",
"...31133113.....",
"...333..333.....",
];

/* Somebody else in the building: staff who never clocked off, guests who never
   checked out, and the ones who have stopped pretending to have feet. */
const NPC_STAFF = [
"................",
"....333333......",
"...31111113.....",
"...31111113.....",
"...31311313.....",
"...31111113.....",
"...33111133.....",
"..331111113.....",
".33111111113....",
".31111111113....",
".31113311113....",
".31113311113....",
".33111111113....",
"..3111111113....",
"..3113..3113....",
"..333....333....",
];

const NPC_GUEST = [
"................",
"...33333333.....",
"..3333333333....",
"....311113......",
"....313113......",
"....311113......",
"....331133......",
"...31111113.....",
"..3111111113....",
"..3113113113....",
"..3113113113....",
"..3111111113....",
"...31111113.....",
"...31111113.....",
"...3113.3113....",
"...333...333....",
];

const NPC_GHOST = [
"................",
"................",
"....333333......",
"...31111113.....",
"...31311313.....",
"...31111113.....",
"..3111111113....",
"..3111111113....",
".311111111113...",
".311111111113...",
".311111111113...",
".311111111113...",
".311111111113...",
".311311311313...",
"..33.33.33.33...",
"................",
];

/* The walk cycle is one frame: the bottom four rows drawn a pixel across, so
   the legs shuffle without a second grid for every heading. */
const walkCache = new Map();
let walkIds = 0;
function walkFrame(spr, dir) {
  if (!spr.__wid) spr.__wid = ++walkIds;
  const key = spr.__wid + '|' + dir;
  let c = walkCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = spr.width; c.height = spr.height;
  const g = c.getContext('2d');
  const cut = spr.height - 4;
  g.drawImage(spr, 0, 0, spr.width, cut, 0, 1, spr.width, cut);
  g.drawImage(spr, 0, cut, spr.width, 4, dir, cut, spr.width, 4);
  walkCache.set(key, c);
  return c;
}

/* ------------------------------------------------------------------- tiles */
/* Tiles are drawn rather than stored, so a floor's whole look — carpet, tiling,
   floorboards, boiler grating — comes out of one small theme object. */

function px(g, x, y, w, h, shade) {
  g.fillStyle = PAL[shade];
  g.fillRect(x, y, w, h);
}

const tileCache = new Map();

function tile(kind, th) {
  const key = kind + '|' + th.id;
  let c = tileCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = TS; c.height = TS;
  const g = c.getContext('2d');
  paintTile(g, kind, th);
  tileCache.set(key, c);
  return c;
}

function paintFloor(g, th) {
  px(g, 0, 0, TS, TS, th.f);
  const a = th.acc;
  switch (th.pattern) {
    case 'carpet':
      px(g, 3, 3, 2, 2, a); px(g, 11, 11, 2, 2, a);
      px(g, 11, 3, 1, 1, a); px(g, 3, 11, 1, 1, a);
      break;
    case 'tiles':
      px(g, 0, 0, TS, 1, a); px(g, 0, 0, 1, TS, a);
      px(g, 8, 8, 8, 1, a); px(g, 8, 8, 1, 8, a);
      break;
    case 'boards':
      px(g, 0, 0, TS, 1, a); px(g, 0, 8, TS, 1, a);
      px(g, 5, 0, 1, 8, a); px(g, 12, 8, 1, 8, a);
      break;
    case 'grate':
      for (let i = 2; i < TS; i += 4) px(g, i, 0, 1, TS, a);
      px(g, 0, 7, TS, 1, a);
      break;
    case 'stone':
      px(g, 2, 4, 2, 1, a); px(g, 9, 2, 3, 1, a);
      px(g, 6, 10, 2, 1, a); px(g, 12, 12, 2, 1, a);
      break;
    default:
      px(g, 7, 7, 1, 1, a);
  }
}

function paintTile(g, kind, th) {
  switch (kind) {

    case 'floor':
      paintFloor(g, th);
      break;

    /* The tall grass of a hotel: forty years of dust, in drifts. Walk through
       it and something in it wakes up. */
    case 'dust':
      paintFloor(g, th);
      for (const p of [[2, 10], [6, 6], [10, 12], [12, 4], [7, 13]]) {
        px(g, p[0], p[1], 1, 3, th.dust);
        px(g, p[0] - 1, p[1] + 1, 1, 2, th.dust);
        px(g, p[0] + 1, p[1] + 1, 1, 2, th.dust);
      }
      break;

    case 'wall':
      px(g, 0, 0, TS, TS, th.w);
      px(g, 0, 0, TS, 1, th.wl);
      px(g, 0, 7, TS, 1, 3);
      px(g, 0, 15, TS, 1, 3);
      px(g, 5, 0, 1, 7, 3);
      px(g, 11, 8, 1, 7, 3);
      break;

    /* Furniture: crates, trunks, cabinets. Always the same shape, whichever
       floor you are on, so you always know what you cannot walk through. */
    case 'prop':
      paintFloor(g, th);
      px(g, 2, 3, 12, 11, 3);
      px(g, 3, 4, 10, 9, 2);
      px(g, 3, 4, 10, 1, 1);
      px(g, 7, 4, 1, 9, 3);
      px(g, 3, 8, 10, 1, 3);
      break;

    case 'plant':
      paintFloor(g, th);
      px(g, 6, 10, 5, 5, 3);
      px(g, 7, 11, 3, 3, 2);
      px(g, 7, 2, 3, 8, 2);
      px(g, 4, 4, 4, 2, 2); px(g, 9, 6, 4, 2, 2);
      px(g, 5, 2, 2, 2, 1); px(g, 10, 3, 2, 2, 1);
      break;

    case 'door':
      px(g, 0, 0, TS, TS, th.w);
      px(g, 2, 1, 12, 15, 3);
      px(g, 3, 2, 10, 14, 1);
      px(g, 3, 2, 10, 1, 0);
      px(g, 11, 8, 2, 2, 3);
      px(g, 5, 4, 6, 3, 2);
      break;

    /* The lift. Everything in this building hangs off it. */
    case 'elev':
      px(g, 0, 0, TS, TS, th.w);
      px(g, 1, 0, 14, 16, 3);
      px(g, 2, 2, 12, 13, 2);
      px(g, 8, 2, 1, 13, 3);
      px(g, 2, 2, 12, 1, 0);
      px(g, 6, 4, 4, 1, 0);
      px(g, 7, 3, 2, 1, 0);
      break;

    /* Housekeeping cart. Rest against it and everything in your jars comes back
       up to full. The building's only kindness. */
    case 'heal':
      paintFloor(g, th);
      px(g, 1, 4, 14, 9, 3);
      px(g, 2, 5, 12, 7, 1);
      px(g, 7, 6, 2, 5, 3);
      px(g, 5, 7, 6, 2, 3);
      px(g, 3, 13, 3, 2, 3); px(g, 10, 13, 3, 2, 3);
      break;

    /* A vending machine that still takes tokens, forty years on. */
    case 'shop':
      px(g, 0, 0, TS, TS, th.w);
      px(g, 1, 0, 14, 16, 3);
      px(g, 2, 1, 9, 11, 0);
      px(g, 3, 3, 7, 1, 2); px(g, 3, 6, 7, 1, 2); px(g, 3, 9, 7, 1, 2);
      px(g, 12, 2, 2, 4, 2);
      px(g, 12, 8, 2, 2, 1);
      px(g, 2, 13, 12, 2, 2);
      break;

    case 'sign':
      paintFloor(g, th);
      px(g, 2, 2, 12, 9, 3);
      px(g, 3, 3, 10, 7, 0);
      px(g, 4, 5, 8, 1, 2); px(g, 4, 7, 6, 1, 2);
      px(g, 7, 11, 2, 4, 3);
      break;

    /* A lost-and-found box. Something is in it, once. */
    case 'item':
      paintFloor(g, th);
      px(g, 3, 5, 10, 9, 3);
      px(g, 4, 6, 8, 7, 1);
      px(g, 4, 9, 8, 1, 3);
      px(g, 7, 6, 2, 7, 3);
      break;

    case 'itemgone':
      paintFloor(g, th);
      px(g, 4, 10, 8, 4, 3);
      px(g, 5, 11, 6, 2, 2);
      break;

    /* Where a legendary is waiting: a furnace door, a desk bell, a clock face.
       Drawn as a shrine so you can see it from across the room. */
    case 'shrine':
      px(g, 0, 0, TS, TS, th.w);
      px(g, 2, 1, 12, 14, 3);
      px(g, 3, 2, 10, 12, 2);
      px(g, 5, 4, 6, 6, 0);
      px(g, 7, 5, 2, 4, 3);
      px(g, 4, 12, 8, 2, 1);
      break;

    default:
      paintFloor(g, th);
  }
}

/* ============================================================================
   TYPES, MOVES AND THE ONE GENERATION
   ========================================================================== */

/* The Ledger Wheel. A ghost overpowers the two things that come after it and
   struggles against the two before it, all the way round — flame takes cloth
   and broom, cloth takes broom and paper, and so on until toy takes flame and
   the wheel closes. Ten links, no exceptions, printed on the wall of the lobby
   so nobody has to memorise a chart. */
const WHEEL = ['FLAME', 'CLOTH', 'BROOM', 'PAPER', 'WIRE', 'BRASS', 'GLASS', 'FROST', 'ROOT', 'TOY'];

function effect(atkType, defType) {
  if (atkType === 'PLAIN' || defType === 'PLAIN') return 1;
  const i = WHEEL.indexOf(atkType), j = WHEEL.indexOf(defType);
  if (i < 0 || j < 0) return 1;
  const d = (j - i + 10) % 10;
  if (d === 1 || d === 2) return 2;
  if (d === 8 || d === 9) return 0.5;
  return 1;
}

/* --------------------------------------------------------------------- moves */
/* pow 0 means the move does no damage and exists for its effect.
   eff: rattle (may lose a turn), soak (their attack down), brace (your defence
   up), sharpen (your attack up), drain (half the damage comes back to you),
   crit (lands a critical far more often). */

const MOVES = {
  'SCUFF':      { t: 'PLAIN', pow: 20, acc: 100, pp: 35 },
  'TACKLE':     { t: 'PLAIN', pow: 35, acc: 100, pp: 30 },
  'LUNGE':      { t: 'PLAIN', pow: 55, acc: 95,  pp: 20 },
  'SPOOK':      { t: 'PLAIN', pow: 0,  acc: 90,  pp: 15, eff: 'rattle' },
  'SNARL':      { t: 'PLAIN', pow: 0,  acc: 100, pp: 20, eff: 'soak' },
  'BRACE':      { t: 'PLAIN', pow: 0,  acc: 100, pp: 20, eff: 'brace' },
  'SHARPEN':    { t: 'PLAIN', pow: 0,  acc: 100, pp: 20, eff: 'sharpen' },

  'SWEEP':      { t: 'BROOM', pow: 35, acc: 100, pp: 30 },
  'LATHER':     { t: 'BROOM', pow: 50, acc: 95,  pp: 20, eff: 'soak' },
  'GRAND SWEEP':{ t: 'BROOM', pow: 80, acc: 90,  pp: 10 },

  'EMBER':      { t: 'FLAME', pow: 35, acc: 100, pp: 30 },
  'SCORCH':     { t: 'FLAME', pow: 55, acc: 95,  pp: 20 },
  'FURNACE':    { t: 'FLAME', pow: 85, acc: 85,  pp: 8 },

  'CHILL':      { t: 'FROST', pow: 35, acc: 100, pp: 30 },
  'FROSTBITE':  { t: 'FROST', pow: 55, acc: 95,  pp: 20, eff: 'rattle' },
  'DEEP FREEZE':{ t: 'FROST', pow: 85, acc: 85,  pp: 8 },

  'BUZZ':       { t: 'WIRE',  pow: 35, acc: 100, pp: 30 },
  'SHORT OUT':  { t: 'WIRE',  pow: 55, acc: 95,  pp: 20, eff: 'rattle' },
  'OVERLOAD':   { t: 'WIRE',  pow: 85, acc: 85,  pp: 8 },

  'PAPER CUT':  { t: 'PAPER', pow: 35, acc: 100, pp: 30 },
  'RED TAPE':   { t: 'PAPER', pow: 50, acc: 95,  pp: 20, eff: 'soak' },
  'FILE AWAY':  { t: 'PAPER', pow: 80, acc: 90,  pp: 10 },

  'GLINT':      { t: 'GLASS', pow: 35, acc: 100, pp: 30 },
  'SHARDS':     { t: 'GLASS', pow: 55, acc: 95,  pp: 20, eff: 'crit' },
  'SHATTER':    { t: 'GLASS', pow: 85, acc: 85,  pp: 8 },

  'SMOTHER':    { t: 'CLOTH', pow: 35, acc: 100, pp: 30 },
  'WRAP UP':    { t: 'CLOTH', pow: 50, acc: 95,  pp: 20, eff: 'soak' },
  'SHROUD':     { t: 'CLOTH', pow: 80, acc: 90,  pp: 10 },

  'CLANG':      { t: 'BRASS', pow: 35, acc: 100, pp: 30 },
  'KEY TURN':   { t: 'BRASS', pow: 55, acc: 95,  pp: 20 },
  'BELL TOLL':  { t: 'BRASS', pow: 85, acc: 85,  pp: 8, eff: 'rattle' },

  'TENDRIL':    { t: 'ROOT',  pow: 35, acc: 100, pp: 30 },
  'SIPHON':     { t: 'ROOT',  pow: 50, acc: 100, pp: 15, eff: 'drain' },
  'OVERGROW':   { t: 'ROOT',  pow: 80, acc: 90,  pp: 10 },

  'WIND UP':    { t: 'TOY',   pow: 35, acc: 100, pp: 30 },
  'JACK BOX':   { t: 'TOY',   pow: 55, acc: 95,  pp: 20, eff: 'rattle' },
  'CAROUSEL':   { t: 'TOY',   pow: 80, acc: 90,  pp: 10 },
};

/* Each type's weak, middling and heavy move, in order. */
const TYPE_MOVES = {
  PLAIN: ['SCUFF', 'TACKLE', 'LUNGE'],
  BROOM: ['SWEEP', 'LATHER', 'GRAND SWEEP'],
  FLAME: ['EMBER', 'SCORCH', 'FURNACE'],
  FROST: ['CHILL', 'FROSTBITE', 'DEEP FREEZE'],
  WIRE:  ['BUZZ', 'SHORT OUT', 'OVERLOAD'],
  PAPER: ['PAPER CUT', 'RED TAPE', 'FILE AWAY'],
  GLASS: ['GLINT', 'SHARDS', 'SHATTER'],
  CLOTH: ['SMOTHER', 'WRAP UP', 'SHROUD'],
  BRASS: ['CLANG', 'KEY TURN', 'BELL TOLL'],
  ROOT:  ['TENDRIL', 'SIPHON', 'OVERGROW'],
  TOY:   ['WIND UP', 'JACK BOX', 'CAROUSEL'],
};

const TRICKS = ['SPOOK', 'SNARL', 'BRACE', 'SHARPEN'];

/* A species' learnset is built from its type rather than written out, so the
   whole generation stays consistent and nothing in here is a typo waiting to
   happen. Rarer creatures come into their heavy move earlier. */
function learnset(spec) {
  const [a, b, c] = TYPE_MOVES[spec.type];
  const shift = spec.rarity === 'LEGEND' ? 12 : spec.rarity === 'ULTRA' ? 6 : 0;
  const t1 = TRICKS[spec.no % 4], t2 = TRICKS[(spec.no + 2) % 4];
  const at = lv => Math.max(1, lv - shift);
  return [
    [1, a], [1, 'SCUFF'],
    [at(7), 'TACKLE'], [at(12), t1],
    [at(16), b], [at(22), 'LUNGE'],
    [at(29), t2], [at(35), c],
  ].sort((p, q) => p[0] - q[0]);
}

/* ---------------------------------------------------------------- the roster */
/* fam  = which animal grid it is drawn from
   th   = the object the ghost inside it possessed
   b    = base HP / attack / defence / speed
   ev   = [level, species number] it turns into
   Rarity is exactly what it says on the ledger page: COMMON is what the floors
   are full of, ULTRA turns up about once in forty encounters, and there are
   three LEGENDs in the building, one each, and no second chances. */

const SPECIES = [
  { no: 1,  name: 'MOPOSSUM',  fam: 'possum', th: 'mop',   type: 'BROOM', rarity: 'COMMON', stage: 1, b: [50, 48, 44, 52], ev: [16, 2] },
  { no: 2,  name: 'SUDSOSSUM', fam: 'possum', th: 'mop',   type: 'BROOM', rarity: 'COMMON', stage: 2, b: [70, 68, 62, 70], ev: [32, 3] },
  { no: 3,  name: 'BROOMBACK', fam: 'possum', th: 'mop',   type: 'BROOM', rarity: 'COMMON', stage: 3, b: [92, 94, 84, 88] },

  { no: 4,  name: 'EMBERAT',   fam: 'rat',    th: 'flame', type: 'FLAME', rarity: 'COMMON', stage: 1, b: [45, 55, 40, 58], ev: [16, 5] },
  { no: 5,  name: 'CINDERAT',  fam: 'rat',    th: 'flame', type: 'FLAME', rarity: 'COMMON', stage: 2, b: [64, 76, 56, 76], ev: [34, 6] },
  { no: 6,  name: 'FURNACRAT', fam: 'rat',    th: 'flame', type: 'FLAME', rarity: 'COMMON', stage: 3, b: [86, 104, 76, 96] },

  { no: 7,  name: 'LINTMOTH',  fam: 'moth',   th: 'cloth', type: 'CLOTH', rarity: 'COMMON', stage: 1, b: [44, 42, 42, 62], ev: [15, 8] },
  { no: 8,  name: 'DRAPEMOTH', fam: 'moth',   th: 'cloth', type: 'CLOTH', rarity: 'COMMON', stage: 2, b: [62, 60, 60, 84], ev: [31, 9] },
  { no: 9,  name: 'SHROUDWING',fam: 'moth',   th: 'cloth', type: 'CLOTH', rarity: 'COMMON', stage: 3, b: [82, 82, 80, 110] },

  { no: 10, name: 'NOTECAT',   fam: 'cat',    th: 'paper', type: 'PAPER', rarity: 'COMMON', stage: 1, b: [48, 50, 46, 54], ev: [17, 11] },
  { no: 11, name: 'LEDGERCAT', fam: 'cat',    th: 'paper', type: 'PAPER', rarity: 'COMMON', stage: 2, b: [68, 70, 64, 74], ev: [33, 12] },
  { no: 12, name: 'ARCHIVAT',  fam: 'cat',    th: 'paper', type: 'PAPER', rarity: 'COMMON', stage: 3, b: [90, 92, 88, 94] },

  { no: 13, name: 'KEYTLE',    fam: 'beetle', th: 'brass', type: 'BRASS', rarity: 'COMMON', stage: 1, b: [52, 46, 58, 40], ev: [16, 14] },
  { no: 14, name: 'BOLTLE',    fam: 'beetle', th: 'brass', type: 'BRASS', rarity: 'COMMON', stage: 2, b: [72, 64, 80, 56], ev: [32, 15] },
  { no: 15, name: 'BRASSCARAB',fam: 'beetle', th: 'brass', type: 'BRASS', rarity: 'COMMON', stage: 3, b: [96, 86, 108, 72] },

  { no: 16, name: 'WIRENEWT',  fam: 'newt',   th: 'wire',  type: 'WIRE',  rarity: 'COMMON', stage: 1, b: [46, 52, 42, 56], ev: [18, 17] },
  { no: 17, name: 'COILNEWT',  fam: 'newt',   th: 'wire',  type: 'WIRE',  rarity: 'COMMON', stage: 2, b: [66, 72, 58, 78], ev: [34, 18] },
  { no: 18, name: 'DYNANEWT',  fam: 'newt',   th: 'wire',  type: 'WIRE',  rarity: 'COMMON', stage: 3, b: [88, 98, 78, 102] },

  { no: 19, name: 'CHILLHARE', fam: 'hare',   th: 'frost', type: 'FROST', rarity: 'COMMON', stage: 1, b: [54, 46, 48, 50], ev: [16, 20] },
  { no: 20, name: 'FROSTHARE', fam: 'hare',   th: 'frost', type: 'FROST', rarity: 'COMMON', stage: 2, b: [76, 64, 68, 68], ev: [33, 21] },
  { no: 21, name: 'GLACIHARE', fam: 'hare',   th: 'frost', type: 'FROST', rarity: 'COMMON', stage: 3, b: [100, 88, 92, 86] },

  { no: 22, name: 'POTSNAIL',  fam: 'snail',  th: 'root',  type: 'ROOT',  rarity: 'COMMON', stage: 1, b: [56, 44, 56, 36], ev: [16, 23] },
  { no: 23, name: 'VINESNAIL', fam: 'snail',  th: 'root',  type: 'ROOT',  rarity: 'COMMON', stage: 2, b: [78, 62, 78, 50], ev: [32, 24] },
  { no: 24, name: 'GROVESNAIL',fam: 'snail',  th: 'root',  type: 'ROOT',  rarity: 'COMMON', stage: 3, b: [104, 84, 104, 66] },

  { no: 25, name: 'PANEON',    fam: 'pigeon', th: 'glass', type: 'GLASS', rarity: 'COMMON', stage: 1, b: [44, 50, 40, 64], ev: [17, 26] },
  { no: 26, name: 'GLINTOVE',  fam: 'pigeon', th: 'glass', type: 'GLASS', rarity: 'COMMON', stage: 2, b: [62, 70, 56, 86], ev: [33, 27] },
  { no: 27, name: 'CHANDOVE',  fam: 'pigeon', th: 'glass', type: 'GLASS', rarity: 'COMMON', stage: 3, b: [84, 96, 76, 112] },

  { no: 28, name: 'PLUSHBEAR', fam: 'bear',   th: 'toy',   type: 'TOY',   rarity: 'COMMON', stage: 1, b: [58, 52, 50, 38], ev: [18, 29] },
  { no: 29, name: 'WINDUPBEAR',fam: 'bear',   th: 'toy',   type: 'TOY',   rarity: 'COMMON', stage: 2, b: [80, 74, 70, 52], ev: [34, 30] },
  { no: 30, name: 'CAROUBEAR', fam: 'bear',   th: 'toy',   type: 'TOY',   rarity: 'COMMON', stage: 3, b: [106, 100, 94, 70] },

  { no: 31, name: 'SUDSFROG',  fam: 'frog',   th: 'mop',   type: 'BROOM', rarity: 'COMMON', stage: 1, b: [58, 48, 52, 44], ev: [24, 32] },
  { no: 32, name: 'GEYSERFROG',fam: 'frog',   th: 'mop',   type: 'BROOM', rarity: 'COMMON', stage: 3, b: [96, 84, 90, 74] },

  { no: 33, name: 'PIPEEL',    fam: 'eel',    th: 'brass', type: 'BRASS', rarity: 'COMMON', stage: 1, b: [50, 56, 44, 54], ev: [24, 34] },
  { no: 34, name: 'DRAINEEL',  fam: 'eel',    th: 'brass', type: 'BRASS', rarity: 'COMMON', stage: 3, b: [88, 98, 78, 92] },

  { no: 35, name: 'TICKSPIDER',fam: 'spider', th: 'wire',  type: 'WIRE',  rarity: 'COMMON', stage: 1, b: [46, 54, 46, 60], ev: [24, 36] },
  { no: 36, name: 'GEARSPIDER',fam: 'spider', th: 'wire',  type: 'WIRE',  rarity: 'COMMON', stage: 3, b: [84, 96, 82, 100] },

  /* Ultra rares. Nothing evolves into these and they evolve into nothing —
     they turned up in the building already finished. */
  { no: 37, name: 'VELVETINE', fam: 'moth',   th: 'cloth', type: 'CLOTH', rarity: 'ULTRA',  stage: 3, b: [96, 104, 92, 118] },
  { no: 38, name: 'AURIGAT',   fam: 'cat',    th: 'brass', type: 'BRASS', rarity: 'ULTRA',  stage: 3, b: [104, 112, 106, 88] },
  { no: 39, name: 'COLDSNAP',  fam: 'hare',   th: 'frost', type: 'FROST', rarity: 'ULTRA',  stage: 3, b: [112, 98, 104, 96] },
  { no: 40, name: 'SPARKLARK', fam: 'pigeon', th: 'wire',  type: 'WIRE',  rarity: 'ULTRA',  stage: 3, b: [92, 116, 84, 124] },
  { no: 41, name: 'IVYCLAW',   fam: 'bear',   th: 'root',  type: 'ROOT',  rarity: 'ULTRA',  stage: 3, b: [118, 110, 112, 74] },

  /* The three that are one each. */
  { no: 42, name: 'BELLHOLLOW',fam: 'warden', th: 'brass', type: 'BRASS', rarity: 'LEGEND', stage: 3, b: [124, 118, 126, 96] },
  { no: 43, name: 'ASHKEEPER', fam: 'stoker', th: 'flame', type: 'FLAME', rarity: 'LEGEND', stage: 3, b: [128, 136, 110, 100] },
  { no: 44, name: 'MIDNIGHTER',fam: 'midnight', th: 'glass', type: 'GLASS', rarity: 'LEGEND', stage: 3, b: [136, 128, 120, 122] },
];

/* Everything derived from the roster, worked out once at load. */
const DEX = {};
for (const s of SPECIES) {
  s.family = s.fam;
  s.thing = s.th;
  /* Catch rates. The three legendaries are the hardest thing in the building
     to jar, but the last one is also how the game ends, so it is a real number
     and not a lottery: worn down to a sliver, a Vault Jar takes it about a
     third of the time. */
  s.catchRate = s.rarity === 'LEGEND' ? 30 : s.rarity === 'ULTRA' ? 45
    : s.stage === 1 ? 190 : s.stage === 2 ? 110 : 62;
  s.xpBase = s.rarity === 'LEGEND' ? 230 : s.rarity === 'ULTRA' ? 165
    : s.stage === 1 ? 46 : s.stage === 2 ? 78 : 118;
  s.moves = learnset(s);
  DEX[s.no] = s;
}
const speciesByName = {};
for (const s of SPECIES) speciesByName[s.name] = s;

function spec(no) { return DEX[no] || SPECIES[0]; }

/* -------------------------------------------------------------- a live creature */

function xpForLevel(lv) { return lv * lv * lv; }

function statAt(base, lv, isHp) {
  return isHp ? Math.floor(base * lv / 50) + lv + 10
              : Math.floor(base * lv / 50) + 5;
}

function movesAtLevel(sp, lv) {
  const known = [];
  for (const [at, mv] of sp.moves) {
    if (at > lv) break;
    if (!known.includes(mv)) known.push(mv);
  }
  const four = known.slice(-4);
  return four.map(k => ({ k, pp: MOVES[k].pp, max: MOVES[k].pp }));
}

function makeMon(no, lv, opts) {
  const o = opts || {};
  const sp = spec(no);
  const m = {
    no, lv,
    xp: xpForLevel(lv),
    shiny: o.shiny || false,
    moves: movesAtLevel(sp, lv),
    hp: 0,
  };
  m.maxhp = statAt(sp.b[0], lv, true);
  m.hp = m.maxhp;
  return m;
}

function monName(m) { return spec(m.no).name; }
function monMaxHp(m) { return statAt(spec(m.no).b[0], m.lv, true); }
function monAtk(m) { return statAt(spec(m.no).b[1], m.lv); }
function monDef(m) { return statAt(spec(m.no).b[2], m.lv); }
function monSpd(m) { return statAt(spec(m.no).b[3], m.lv); }
function alive(m) { return m.hp > 0; }

function healMon(m) {
  m.maxhp = monMaxHp(m);
  m.hp = m.maxhp;
  for (const mv of m.moves) mv.pp = mv.max;
}

/* ------------------------------------------------------------------- the bag */

const ITEMS = {
  'JAR':        { kind: 'jar',  mult: 1.0, cost: 40,  info: 'AN EMPTY PRESERVE JAR. GHOSTS FIT.' },
  'GHOST JAR':  { kind: 'jar',  mult: 1.7, cost: 120, info: 'LEAD-LINED. HOLDS THE STRONGER ONES.' },
  'VAULT JAR':  { kind: 'jar',  mult: 2.8, cost: 400, info: 'OUT OF THE HOTEL SAFE. HOLDS ANYTHING.' },
  'POULTICE':   { kind: 'heal', amount: 25, cost: 50,  info: 'MENDS 25 HP OF A ROAMINAL.' },
  'TONIC':      { kind: 'heal', amount: 60, cost: 140, info: 'MENDS 60 HP OF A ROAMINAL.' },
  'FULL KIT':   { kind: 'heal', amount: 999, cost: 500, info: 'MENDS EVERYTHING, INCLUDING NERVES.' },
  'SMELLING SALTS': { kind: 'cure', cost: 60, info: 'SETTLES A RATTLED ROAMINAL.' },
  'SUGAR CUBE': { kind: 'level', cost: 900, info: 'ONE WHOLE LEVEL, ALL AT ONCE.' },
  'DUST SHEET': { kind: 'repel', steps: 200, cost: 100, info: 'KEEPS THE DUST DOWN FOR 200 STEPS.' },
  'BRIGHT PENNY': { kind: 'key', info: 'DOUBLES YOUR ODDS ON A SHINY COAT.' },
  'MASTER RING': { kind: 'key', info: 'THE MANAGER’S KEYS. OPENS THE ROOF.' },
};

const SHOP_STOCK = ['JAR', 'GHOST JAR', 'POULTICE', 'TONIC', 'SMELLING SALTS', 'DUST SHEET'];

/* ============================================================================
   THE ROTHSAY GRAND
   Ten floors, and the lift is the only way between them. Every floor is laid
   out by a seeded generator rather than stored as a map, so the building is
   enormous, is the same building for everybody, and costs this file nothing.
   ========================================================================== */

const FLOORS = [
  {
    label: '1F', name: 'THE LOBBY', seed: 1101,
    theme: { id: 'lobby', f: 0, acc: 1, w: 2, wl: 1, dust: 2, pattern: 'carpet' },
    lv: [2, 4],
    table: [[1, 12], [10, 10], [13, 9], [25, 8], [38, 1]],
    items: ['JAR', 'JAR', 'POULTICE'],
    shrine: { no: 42, lv: 34, keys: 6,
      wait: ['THE DESK BELL IS COLD.', 'IT WILL NOT RING FOR', 'A PORTER WITH NO FLOORS.'],
      call: ['YOU RING THE DESK BELL.', 'SOMETHING VERY OLD', 'SITS UP INSIDE IT.'] },
    boss: {
      name: 'BELLHOP OSKAR', art: 'staff', reward: 300,
      team: [[13, 7], [25, 8]],
      pre: ['BELLHOP OSKAR: FORTY YEARS', 'I HAVE HELD THIS DOOR.', 'SHOW ME A REASON, PORTER.'],
      win: ['OSKAR: TAKE THE KEY.', 'THE BASEMENT WANTS', 'SOMEBODY ELSE FOR A WHILE.'],
      done: ['OSKAR: THE LIFT IS YOURS.', 'MIND THE THIRD FLOOR.'],
    },
    folks: [
      { kind: 'talk', art: 'guest', lines: ['A GUEST, STILL WAITING', 'TO CHECK IN.', 'HE DOES NOT LOOK UP.'] },
      { kind: 'talk', art: 'ghost', lines: ['EVERY GHOST IN HERE', 'MOVED INTO AN OBJECT.', 'THE OBJECT MOVED INTO', 'AN ANIMAL. THAT IS A', 'ROAMINAL, AND THAT IS', 'WHY THEY HAVE TYPES.'] },
      { kind: 'fight', name: 'PAGEBOY WICK', art: 'staff', reward: 120, team: [[1, 5], [10, 5]],
        pre: ['PAGEBOY WICK: NEW COAT!', 'LET ME SEE IT MOVE.'],
        win: ['WICK: THAT WAS FUN.', 'DO IT AGAIN SOMETIME.'] },
    ],
  },

  {
    label: 'B1', name: 'LAUNDRY', seed: 2202,
    theme: { id: 'laundry', f: 1, acc: 0, w: 3, wl: 2, dust: 3, pattern: 'tiles' },
    lv: [5, 8],
    table: [[31, 12], [7, 11], [1, 9], [13, 7], [37, 1]],
    items: ['POULTICE', 'GHOST JAR', 'JAR'],
    boss: {
      name: 'LAUNDRESS MAUD', art: 'ghost', reward: 500,
      team: [[31, 11], [7, 11], [8, 12]],
      pre: ['MAUD: EVERYTHING COMES', 'OUT OF THAT MACHINE', 'CLEANER THAN IT WENT IN.', 'HOLD STILL.'],
      win: ['MAUD: HMPH. A GOOD SOAK', 'WOULD FIX YOUR ATTITUDE.', 'GO ON. TAKE THE KEY.'],
      done: ['MAUD: DOWN IS WARMER.', 'DO NOT TOUCH THE PIPES.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['THE DRIERS RAN ALL NIGHT', 'FOR FORTY YEARS.', 'THAT IS A LOT OF LINT', 'AND LINT GETS IDEAS.'] },
      { kind: 'fight', name: 'PORTER HALLAM', art: 'staff', reward: 200, team: [[31, 9], [1, 10]],
        pre: ['HALLAM: THE OTHER PORTER.', 'ONLY ONE OF US', 'GETS THE ROUND.'],
        win: ['HALLAM: TAKE IT THEN.', 'MY FEET HURT ANYWAY.'] },
    ],
  },

  {
    label: 'B2', name: 'BOILER ROOM', seed: 3303,
    theme: { id: 'boiler', f: 1, acc: 2, w: 3, wl: 2, dust: 3, pattern: 'grate' },
    lv: [8, 12],
    table: [[4, 13], [33, 10], [13, 8], [35, 8], [38, 1]],
    items: ['TONIC', 'GHOST JAR', 'JAR', 'BRIGHT PENNY'],
    shrine: { no: 43, lv: 28, keys: 3,
      wait: ['THE FURNACE DOOR IS SHUT', 'AND WARM AS A HAND.', 'NOT YET.'],
      call: ['YOU OPEN THE FURNACE.', 'SOMETHING STANDS UP', 'IN THE FIRE.'] },
    boss: {
      name: 'STOKER GRIMSBY', art: 'staff', reward: 800,
      team: [[4, 14], [33, 14], [5, 16]],
      pre: ['GRIMSBY: SHE NEEDS FEEDING', 'EVERY HOUR, DEAD OR NOT.', 'YOU FEEDING HER TODAY?'],
      win: ['GRIMSBY: GOOD ARM ON YOU.', 'KITCHENS NEXT. TELL ANOUK', 'THE HEAT IS BACK ON.'],
      done: ['GRIMSBY: SHE STILL BURNS.', 'THAT IS THE WHOLE JOB.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['SOMETHING LIVES', 'IN THE FURNACE ITSELF.', 'IT WILL NOT COME OUT', 'FOR A PORTER WITH', 'FEWER THAN THREE KEYS.'] },
      { kind: 'fight', name: 'ENGINEER ROOKE', art: 'staff', reward: 320, team: [[35, 12], [4, 13]],
        pre: ['ROOKE: MIND THE PIPES.', 'MIND ME AS WELL.'],
        win: ['ROOKE: FAIR. FAIR.', 'THE PIPES LIKED YOU.'] },
    ],
  },

  {
    label: '2F', name: 'KITCHENS', seed: 4404,
    theme: { id: 'kitchen', f: 0, acc: 1, w: 2, wl: 1, dust: 2, pattern: 'tiles' },
    lv: [12, 16],
    table: [[19, 12], [13, 9], [14, 8], [33, 8], [39, 1]],
    items: ['TONIC', 'GHOST JAR', 'SMELLING SALTS'],
    boss: {
      name: 'CHEF ANOUK', art: 'ghost', reward: 1100,
      team: [[19, 18], [14, 18], [20, 20]],
      pre: ['ANOUK: SERVICE IS SERVICE.', 'FORTY YEARS AND NOBODY', 'HAS SENT ANYTHING BACK.'],
      win: ['ANOUK: PLATE CLEAN.', 'GO UP. THE GUESTS', 'HAVE BEEN RINGING.'],
      done: ['ANOUK: THE FREEZER STAYS', 'SHUT. YOU HEARD ME.'],
    },
    folks: [
      { kind: 'talk', art: 'guest', lines: ['THE WALK-IN FREEZER', 'HAS NOT BEEN OPENED', 'SINCE THE HOTEL SHUT.', 'SOMETHING IN THERE', 'IS VERY RARE AND', 'VERY UNIMPRESSED.'] },
      { kind: 'fight', name: 'POT WASH ELSIE', art: 'ghost', reward: 460, team: [[31, 16], [19, 17]],
        pre: ['ELSIE: I HAVE SCRUBBED', 'WORSE THAN YOU.'],
        win: ['ELSIE: GO ON, THEN.', 'MIND THE WET FLOOR.'] },
    ],
  },

  {
    label: '3F', name: 'GUEST ROOMS', seed: 5505,
    theme: { id: 'rooms', f: 1, acc: 2, w: 3, wl: 2, dust: 3, pattern: 'carpet' },
    lv: [16, 21],
    table: [[8, 12], [2, 10], [11, 9], [25, 7], [37, 1]],
    items: ['TONIC', 'GHOST JAR', 'GHOST JAR', 'DUST SHEET'],
    boss: {
      name: 'HOUSEKEEPER VANE', art: 'ghost', reward: 1500,
      team: [[2, 22], [8, 22], [3, 24]],
      pre: ['VANE: THIRTEEN IS MADE UP', 'EVERY MORNING.', 'NOBODY HAS EVER SLEPT', 'IN IT. NOBODY WILL.'],
      win: ['VANE: FINE. THE BALLROOM.', 'THEY ARE STILL PLAYING.', 'THEY DO NOT KNOW.'],
      done: ['VANE: DO NOT OPEN', 'ROOM THIRTEEN.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['THE CURTAINS IN THE', 'SUITES ARE VELVET.', 'ONE OF THEM IS NOT', 'A CURTAIN AT ALL.'] },
      { kind: 'fight', name: 'MAID CORRIE', art: 'staff', reward: 640, team: [[8, 20], [2, 21]],
        pre: ['CORRIE: TURN DOWN SERVICE.', 'THAT MEANS YOU.'],
        win: ['CORRIE: SLEEP WELL,', 'IF YOU EVER DO.'] },
    ],
  },

  {
    label: '4F', name: 'BALLROOM', seed: 6606,
    theme: { id: 'ball', f: 0, acc: 1, w: 2, wl: 1, dust: 2, pattern: 'boards' },
    lv: [21, 26],
    table: [[26, 12], [9, 9], [36, 8], [17, 8], [40, 1]],
    items: ['FULL KIT', 'GHOST JAR', 'TONIC'],
    boss: {
      name: 'BANDLEADER HOLLIS', art: 'ghost', reward: 2000,
      team: [[26, 27], [36, 27], [27, 29]],
      pre: ['HOLLIS: WE HAVE PLAYED', 'THE SAME EIGHT BARS', 'SINCE THE LIGHTS WENT.', 'DO YOU DANCE?'],
      win: ['HOLLIS: A NEW NUMBER.', 'AT LAST. UP YOU GO —', 'THE OFFICES OWE US ALL.'],
      done: ['HOLLIS: STILL THE SAME', 'EIGHT BARS. WE LIKE THEM.'],
    },
    folks: [
      { kind: 'talk', art: 'guest', lines: ['THE CHANDELIER HAS', 'ELEVEN THOUSAND DROPS.', 'ONE OF THEM BLINKS.'] },
      { kind: 'fight', name: 'DANCER MIRA', art: 'ghost', reward: 880, team: [[9, 25], [26, 26]],
        pre: ['MIRA: ONE DANCE.', 'I ALWAYS LEAD.'],
        win: ['MIRA: YOU LEAD, THEN.', 'JUST THIS ONCE.'] },
    ],
  },

  {
    label: '5F', name: 'OFFICES', seed: 7707,
    theme: { id: 'office', f: 1, acc: 2, w: 3, wl: 2, dust: 3, pattern: 'tiles' },
    lv: [26, 31],
    table: [[11, 12], [12, 8], [14, 9], [34, 8], [38, 1]],
    items: ['FULL KIT', 'VAULT JAR', 'SUGAR CUBE'],
    boss: {
      name: 'CLERK PELL', art: 'staff', reward: 2600,
      team: [[11, 32], [14, 32], [12, 34]],
      pre: ['PELL: EVERY GUEST SINCE', 'NINETEEN TWELVE IS IN', 'THESE DRAWERS.', 'YOU ARE NOT FILED YET.'],
      win: ['PELL: I WILL MAKE YOU', 'A CARD. NIGHT PORTER.', 'ACTIVE. GOOD LUCK', 'WITH THE NURSERY.'],
      done: ['PELL: YOUR FILE IS THIN', 'BUT IT IS GROWING.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['THE MANAGER SIGNED', 'EVERY WAGE SLIP', 'FOR TWELVE YEARS', 'AFTER HE DIED.'] },
      { kind: 'fight', name: 'AUDITOR GREY', art: 'staff', reward: 1150, team: [[12, 30], [34, 31]],
        pre: ['GREY: LET US SEE', 'YOUR PAPERWORK.'],
        win: ['GREY: IN ORDER.', 'DISAPPOINTINGLY.'] },
    ],
  },

  {
    label: '6F', name: 'NURSERY', seed: 8808,
    theme: { id: 'nursery', f: 0, acc: 1, w: 2, wl: 1, dust: 2, pattern: 'carpet' },
    lv: [31, 36],
    table: [[29, 12], [28, 9], [30, 7], [36, 8], [41, 1]],
    items: ['FULL KIT', 'VAULT JAR', 'FULL KIT'],
    boss: {
      name: 'NANNY BIRCH', art: 'ghost', reward: 3200,
      team: [[29, 37], [36, 37], [30, 39]],
      pre: ['BIRCH: QUIET HOUR.', 'THE TOYS ARE ASLEEP.', 'YOU HAVE WOKEN THEM,', 'SO YOU CAN TIRE THEM OUT.'],
      win: ['BIRCH: THEY LIKED THAT.', 'GO AND SEE THE GARDEN', 'BEFORE IT EATS THE LIFT.'],
      done: ['BIRCH: SHHH. NAPS.'],
    },
    folks: [
      { kind: 'talk', art: 'guest', lines: ['THE ROCKING HORSE', 'HAS BEEN ROCKING', 'SINCE BEFORE I GOT HERE.', 'NOBODY IS ON IT.'] },
      { kind: 'fight', name: 'TWINS ODA & OTT', art: 'ghost', reward: 1500, team: [[28, 34], [29, 35], [30, 35]],
        pre: ['ODA & OTT: TWO OF US.', 'ONE OF YOU.', 'THAT IS THE GAME.'],
        win: ['ODA & OTT: AGAIN!', 'AGAIN! ...OH, FINE.'] },
    ],
  },

  {
    label: '7F', name: 'CONSERVATORY', seed: 9909,
    theme: { id: 'garden', f: 1, acc: 2, w: 2, wl: 1, dust: 3, pattern: 'stone' },
    lv: [36, 42],
    table: [[23, 12], [24, 8], [32, 9], [9, 8], [41, 1]],
    items: ['FULL KIT', 'VAULT JAR', 'SUGAR CUBE', 'MASTER RING'],
    boss: {
      name: 'GARDENER FEN', art: 'ghost', reward: 4000,
      team: [[23, 43], [32, 43], [24, 45]],
      pre: ['FEN: THE GLASS HOUSE HELD.', 'EVERYTHING ELSE ROTTED', 'AND THEN GREW BACK', 'MEANER. LIKE ME.'],
      win: ['FEN: TAKE THE RING.', 'IT OPENS THE ROOF.', 'HE IS UP THERE. HE HAS', 'BEEN UP THERE ALL ALONG.'],
      done: ['FEN: WATER THE BEDS', 'IF YOU PASS THEM.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['NOBODY PLANTED THE IVY.', 'IT CAME UP THE LIFT SHAFT', 'ON ITS OWN.'] },
      { kind: 'fight', name: 'PRUNER ASHE', art: 'staff', reward: 1900, team: [[24, 41], [23, 42]],
        pre: ['ASHE: EVERYTHING IN HERE', 'GETS CUT BACK.'],
        win: ['ASHE: YOU GREW ANYWAY.', 'GOOD FOR YOU.'] },
    ],
  },

  {
    label: 'R', name: 'THE ROOF', seed: 1313,
    theme: { id: 'roof', f: 1, acc: 2, w: 3, wl: 2, dust: 3, pattern: 'stone' },
    lv: [42, 48],
    table: [[27, 10], [9, 9], [21, 9], [18, 9], [37, 1]],
    items: ['FULL KIT', 'VAULT JAR', 'VAULT JAR'],
    shrine: { no: 44, lv: 50, keys: 10,
      wait: ['THE CLOCK FACE IS DARK.', 'IT IS NOT MIDNIGHT YET.', 'THE MANAGER SAYS WHEN.'],
      call: ['THE HANDS MEET AT TWELVE.', 'THE CLOCK OPENS.', 'SOMETHING STEPS OUT', 'OF FORTY YEARS AGO.'] },
    boss: {
      name: 'THE NIGHT MANAGER', art: 'ghost', reward: 6000,
      team: [[12, 46], [21, 47], [6, 48], [38, 50]],
      pre: ['NIGHT MANAGER: THE POST', 'IS FILLED, THANK YOU.', 'IT HAS BEEN FILLED', 'SINCE THE NIGHT I DIED.', 'PROVE YOU CAN CARRY IT.'],
      win: ['NIGHT MANAGER: ...THEN', 'THE POST IS YOURS.', 'ONE DUTY REMAINS.', 'THE CLOCK. AT TWELVE.', 'DO NOT LET IT LEAVE.'],
      done: ['NIGHT MANAGER: THE CLOCK.', 'IT IS THE ONLY GUEST', 'I NEVER CHECKED IN.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['EVERY GHOST IN THIS', 'BUILDING CAME UP HERE', 'ONCE AND CHANGED', 'THEIR MIND.'] },
      { kind: 'fight', name: 'WATCHMAN COLE', art: 'staff', reward: 2600, team: [[18, 44], [27, 45]],
        pre: ['COLE: NOBODY GOES PAST', 'ME AT THIS HOUR.'],
        win: ['COLE: ...ALRIGHT.', 'THIS HOUR ONLY.'] },
    ],
  },
];

/* --------------------------------------------------------------- generation */

const WALK = { '.': 1, ',': 1 };
function walkable(ch) { return WALK[ch] === 1; }

/* Nine rooms in a three by three grid, joined by elbow corridors, then dressed
   with dust drifts, furniture and the fittings that make a floor a place: the
   lift, a housekeeping cart, a vending machine, a few lost-and-found boxes. */
function buildFloor(fi) {
  const f = FLOORS[fi];
  const r = mulberry(f.seed);
  const g = [];
  for (let y = 0; y < FH; y++) g.push(new Array(FW).fill('#'));

  const rooms = [];
  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      const x0 = 1 + rx * 13, y0 = 1 + ry * 10;
      const w = 7 + Math.floor(r() * 5);
      const h = 5 + Math.floor(r() * 4);
      const x = x0 + Math.floor(r() * (12 - w));
      const y = y0 + Math.floor(r() * (9 - h));
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) g[j][i] = '.';
      }
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
  }

  const carveH = (x1, x2, y) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) if (g[y][x] === '#') g[y][x] = '.';
  };
  const carveV = (y1, y2, x) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (g[y][x] === '#') g[y][x] = '.';
  };

  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      const a = rooms[ry * 3 + rx];
      if (rx < 2) {
        const b = rooms[ry * 3 + rx + 1];
        carveH(a.cx, b.cx, a.cy);
        carveV(a.cy, b.cy, b.cx);
      }
      if (ry < 2) {
        const b = rooms[(ry + 1) * 3 + rx];
        carveV(a.cy, b.cy, a.cx);
        carveH(a.cx, b.cx, b.cy);
      }
    }
  }

  /* Dust drifts. They cluster in a corner of a room rather than filling it, so
     you can always walk a clean line through if you want to. */
  for (let i = 0; i < rooms.length; i++) {
    const rm = rooms[i];
    if (i === 4) continue;                      // the lift lobby stays swept
    const dx = rm.x + 1 + Math.floor(r() * Math.max(1, rm.w - 4));
    const dy = rm.y + 1 + Math.floor(r() * Math.max(1, rm.h - 3));
    const dw = 3 + Math.floor(r() * 4), dh = 2 + Math.floor(r() * 3);
    for (let y = dy; y < Math.min(dy + dh, rm.y + rm.h); y++) {
      for (let x = dx; x < Math.min(dx + dw, rm.x + rm.w); x++) {
        if (g[y][x] === '.' && r() > 0.18) g[y][x] = ',';
      }
    }
    /* Furniture, and a plant if the floor is the kind that would have had one.
       Never on the edge of a room: a doorway is on the edge, and a crate in a
       doorway is a sealed room. */
    const props = 1 + Math.floor(r() * 3);
    for (let p = 0; p < props; p++) {
      const px2 = rm.x + 1 + Math.floor(r() * Math.max(1, rm.w - 2));
      const py2 = rm.y + 1 + Math.floor(r() * Math.max(1, rm.h - 2));
      if (g[py2][px2] === '.') g[py2][px2] = r() > 0.7 ? 'p' : '=';
    }
  }

  /* A fitting hangs on the room like furniture, and always leaves the tile
     below it clear — otherwise a vending machine can end up somewhere you
     cannot stand to use it. */
  const put = (rm, ch, ox, oy) => {
    const x = clamp(rm.cx + (ox || 0), 1, FW - 2);
    const y = clamp(rm.cy + (oy || 0), 1, FH - 2);
    g[y][x] = ch;
    g[y + 1][x] = '.';
    if (g[y + 1][x - 1] === '#') g[y + 1][x - 1] = '.';
    return { x, y };
  };

  /* The lift sits in the middle room with clear floor in front of it. */
  const lobby = rooms[4];
  const lift = { x: lobby.cx, y: lobby.y };
  g[lift.y][lift.x] = 'E';
  for (let y = lift.y + 1; y <= lift.y + 2; y++) {
    for (let x = lift.x - 1; x <= lift.x + 1; x++) {
      if (y < FH - 1 && g[y][x] !== '#') g[y][x] = '.';
    }
  }
  if (g[lift.y + 1][lift.x - 2] !== '#') g[lift.y + 1][lift.x - 2] = 'n';

  put(rooms[0], 'H', 0, -1);
  put(rooms[2], 'S', 0, -1);

  /* Lost-and-found boxes, one per listed item, spread around the outer rooms. */
  const boxRooms = [1, 3, 5, 7, 6, 0];
  const boxes = [];
  f.items.forEach((it, idx) => {
    const rm = rooms[boxRooms[idx % boxRooms.length]];
    let x = rm.x + 1 + Math.floor(r() * Math.max(1, rm.w - 2));
    let y = rm.y + 1 + Math.floor(r() * Math.max(1, rm.h - 2));
    let tries = 0;
    while (g[y][x] !== '.' && g[y][x] !== ',' && tries++ < 40) {
      x = rm.x + 1 + Math.floor(r() * Math.max(1, rm.w - 2));
      y = rm.y + 1 + Math.floor(r() * Math.max(1, rm.h - 2));
    }
    g[y][x] = 'i';
    boxes.push({ x, y, item: it });
  });

  /* The legendary's own tile: a furnace door, a desk bell, a clock face. */
  let shrine = null;
  if (f.shrine) {
    const rm = rooms[7];
    const pos = put(rm, 'L', 0, -1);
    shrine = { x: pos.x, y: pos.y };
  }

  /* People. The floor's staff ghost stands in the far room, everybody else is
     spread out where they will actually be walked into. */
  const folk = [];
  const spot = (rm, dx, dy) => {
    let x = clamp(rm.cx + dx, rm.x, rm.x + rm.w - 1);
    let y = clamp(rm.cy + dy, rm.y, rm.y + rm.h - 1);
    if (!walkable(g[y][x])) { x = rm.cx; y = rm.cy; g[y][x] = '.'; }
    return { x, y };
  };

  const bossSpot = spot(rooms[8], 0, -1);
  folk.push(Object.assign({}, f.boss, {
    kind: 'boss', x: bossSpot.x, y: bossSpot.y, dir: 0, floor: fi,
  }));

  const folkRooms = [1, 3, 6, 5, 2];
  f.folks.forEach((p, idx) => {
    const rm = rooms[folkRooms[idx % folkRooms.length]];
    const s = spot(rm, idx % 2 ? 1 : -1, idx % 3 ? 0 : 1);
    folk.push(Object.assign({}, p, { x: s.x, y: s.y, dir: 0, floor: fi }));
  });

  /* Nothing the floor needs is allowed to end up sealed off. Flood the place
     from the lift doors; anything the flood did not reach gets a corridor dug
     to it, straight through whatever is in the way. Ten floors of random
     rooms, and this is the line that means none of them can be a dead end. */
  const FITTINGS = { 'E': 1, 'H': 1, 'S': 1, 'L': 1, 'i': 1, 'x': 1, 'n': 1 };

  const flood = () => {
    const seen = new Set();
    const start = lift.x + ',' + (lift.y + 1);
    const st = [[lift.x, lift.y + 1]];
    seen.add(start);
    while (st.length) {
      const cur = st.pop();
      for (const d of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cur[0] + d[0], ny = cur[1] + d[1], k = nx + ',' + ny;
        if (nx < 1 || ny < 1 || nx >= FW - 1 || ny >= FH - 1 || seen.has(k)) continue;
        if (!walkable(g[ny][nx])) continue;
        seen.add(k); st.push([nx, ny]);
      }
    }
    return seen;
  };

  const dig = (x1, y1) => {
    const x2 = lift.x, y2 = lift.y + 1;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (!FITTINGS[g[y1][x]]) g[y1][x] = '.';
    }
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (!FITTINGS[g[y][x2]]) g[y][x2] = '.';
    }
  };

  let reach = flood();
  const needed = [{ x: lift.x, y: lift.y + 1 }];
  for (const f of folk) needed.push({ x: f.x, y: f.y });
  for (const b of boxes) needed.push({ x: b.x, y: b.y + 1 });
  for (let y = 1; y < FH - 1; y++) {
    for (let x = 1; x < FW - 1; x++) {
      if (g[y][x] === 'H' || g[y][x] === 'S' || g[y][x] === 'L') needed.push({ x, y: y + 1 });
    }
  }
  for (const n of needed) {
    if (reach.has(n.x + ',' + n.y)) continue;
    dig(n.x, n.y);
    reach = flood();
  }

  return {
    grid: g, rooms, lift, boxes, shrine, folk,
    spawn: { x: lift.x, y: lift.y + 1 },
  };
}

/* ============================================================================
   STATE, SAVING AND INPUT
   ========================================================================== */

const S = {
  mode: 'boot',          // boot | title | world | battle | evolve | credits
  ui: null,              // whatever box is open on top of the world
  t: 0, frame: 0,
  floor: 0,
  map: null,
  p: { x: 0, y: 0, dir: 0, sub: 0, moving: 0, anim: 0 },
  party: [],
  bag: {},
  tokens: 500,
  keys: 0,               // floors of the hotel the lift will admit you to
  seen: {}, caught: {},
  taken: {}, beaten: {}, shrines: {},
  repel: 0, steps: 0, playFrames: 0,
  started: false, finished: false,
  fade: 0, fadeDir: 0, fadeThen: null,
};

function bagAdd(item, n) { S.bag[item] = (S.bag[item] || 0) + (n || 1); }
function bagTake(item, n) {
  S.bag[item] = (S.bag[item] || 0) - (n || 1);
  if (S.bag[item] <= 0) delete S.bag[item];
}
function bagList() { return Object.keys(S.bag).filter(k => S.bag[k] > 0); }
function jarList() { return bagList().filter(k => ITEMS[k] && ITEMS[k].kind === 'jar'); }

function firstAlive() { return S.party.findIndex(alive); }
function partyAlive() { return S.party.some(alive); }

/* ------------------------------------------------------------------- saving */

function saveGame() {
  try {
    const data = {
      v: 1, floor: S.floor, p: { x: S.p.x, y: S.p.y, dir: S.p.dir },
      party: S.party, bag: S.bag, tokens: S.tokens, keys: S.keys,
      seen: S.seen, caught: S.caught, taken: S.taken, beaten: S.beaten,
      shrines: S.shrines, steps: S.steps, playFrames: S.playFrames,
      finished: S.finished,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) return false;
    S.floor = d.floor || 0;
    S.party = d.party || [];
    S.bag = d.bag || {};
    S.tokens = d.tokens || 0;
    S.keys = d.keys || 0;
    S.seen = d.seen || {}; S.caught = d.caught || {};
    S.taken = d.taken || {}; S.beaten = d.beaten || {};
    S.shrines = d.shrines || {};
    S.steps = d.steps || 0; S.playFrames = d.playFrames || 0;
    S.finished = !!d.finished;
    enterFloor(S.floor, d.p ? d.p.x : null, d.p ? d.p.y : null);
    S.p.dir = d.p ? (d.p.dir || 0) : 0;
    S.started = true;
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------- input */

const keys = {};      // held
const hit = {};       // pressed this frame

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'a', Z: 'a', ' ': 'a', j: 'a', J: 'a',
  x: 'b', X: 'b', k: 'b', K: 'b', Backspace: 'b', Escape: 'b',
  Enter: 'start', Tab: 'start',
};

addEventListener('keydown', e => {
  const k = KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  if (!keys[k]) hit[k] = true;
  keys[k] = true;
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  keys[k] = false;
});

/* Touch pads mirror the same two buttons and a cross. */
(function touchSetup() {
  const pad = document.getElementById('touch');
  if (!pad) return;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) pad.classList.remove('hidden');
  for (const b of pad.querySelectorAll('.tb')) {
    const k = b.dataset.key;
    const down = e => { e.preventDefault(); if (!keys[k]) hit[k] = true; keys[k] = true; };
    const up = e => { e.preventDefault(); keys[k] = false; };
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    b.addEventListener('mousedown', down);
    b.addEventListener('mouseup', up);
    b.addEventListener('mouseleave', up);
  }
})();

function clearHits() { for (const k in hit) hit[k] = false; }

/* Held directions repeat on a menu after a short delay, so long lists are not
   a finger workout. */
let repeatKey = null, repeatWait = 0;
function menuDir() {
  for (const k of ['up', 'down', 'left', 'right']) {
    if (hit[k]) { repeatKey = k; repeatWait = 22; return k; }
  }
  if (repeatKey && keys[repeatKey]) {
    if (--repeatWait <= 0) { repeatWait = 6; return repeatKey; }
  } else repeatKey = null;
  return null;
}

/* ------------------------------------------------------------------ dialogue */

/* say(lines, then) — three lines to a page, A to turn the page. */
function say(lines, then) {
  S.ui = { kind: 'dialog', lines: lines.slice(), page: 0, then: then || null, tick: 0 };
}

function dialogPages(ui) { return Math.ceil(ui.lines.length / 3); }

function updateDialog(ui) {
  ui.tick++;
  if (hit.a || hit.b) {
    ui.page++;
    if (ui.page >= dialogPages(ui)) {
      const then = ui.then;
      S.ui = null;
      if (then) then();
    }
  }
}

/* ------------------------------------------------------------------ the world */

function themeOf(fi) { return FLOORS[fi].theme; }

function enterFloor(fi, atX, atY) {
  S.floor = fi;
  S.map = buildFloor(fi);
  const taken = S.taken[fi] || {};
  for (const b of S.map.boxes) {
    if (taken[b.x + ',' + b.y]) S.map.grid[b.y][b.x] = 'x';
  }
  if (S.map.shrine && S.shrines[fi]) {
    S.map.grid[S.map.shrine.y][S.map.shrine.x] = '=';
  }
  for (const f of S.map.folk) {
    f.beaten = !!S.beaten[fi + ':' + (f.name || 'BOSS')];
  }
  S.p.x = atX === null || atX === undefined ? S.map.spawn.x : atX;
  S.p.y = atY === null || atY === undefined ? S.map.spawn.y : atY;
  S.p.sub = 0; S.p.moving = 0; S.p.dir = 0;
}

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= FW || y >= FH) return '#';
  return S.map.grid[y][x];
}

function folkAt(x, y) {
  return S.map.folk.find(f => f.x === x && f.y === y) || null;
}

function blocked(x, y) {
  if (!walkable(tileAt(x, y))) return true;
  return !!folkAt(x, y);
}

const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]];   // down, up, left, right

function playerPixel() {
  const d = DIRV[S.p.dir];
  const f = S.p.moving ? (S.p.sub / STEP_FRAMES) : 0;
  return {
    x: (S.p.x + d[0] * f) * TS,
    y: (S.p.y + d[1] * f) * TS,
  };
}

/* --------------------------------------------------------------- encounters */

function rollWild() {
  const f = FLOORS[S.floor];
  let total = 0;
  for (const e of f.table) total += e[1];
  let r = Math.random() * total;
  let no = f.table[0][0];
  for (const e of f.table) { r -= e[1]; if (r <= 0) { no = e[0]; break; } }
  const lv = f.lv[0] + rnd(f.lv[1] - f.lv[0] + 1);
  const odds = S.bag['BRIGHT PENNY'] ? SHINY_ODDS / 2 : SHINY_ODDS;
  return makeMon(no, lv, { shiny: rnd(Math.floor(odds)) === 0 });
}

function stepFinished() {
  S.steps++;
  if (S.repel > 0) S.repel--;
  const t = tileAt(S.p.x, S.p.y);
  if (t === ',' && S.repel <= 0 && chance(0.13)) {
    startBattle({ kind: 'wild', foe: [rollWild()] });
  }
}

/* --------------------------------------------------------------- interacting */

function facingTile() {
  const d = DIRV[S.p.dir];
  return { x: S.p.x + d[0], y: S.p.y + d[1] };
}

function interact() {
  const f = facingTile();
  const who = folkAt(f.x, f.y);
  if (who) { talkTo(who); return; }

  const t = tileAt(f.x, f.y);
  const fl = FLOORS[S.floor];

  if (t === 'E') { openElevator(); return; }

  if (t === 'H') {
    for (const m of S.party) healMon(m);
    say(['YOU REST AGAINST THE',
      'HOUSEKEEPING CART.',
      'EVERY JAR IS FULL AGAIN.']);
    return;
  }

  if (t === 'S') { openShop(); return; }

  if (t === 'n') {
    say(['THE LEDGER WHEEL:', 'FLAME CLOTH BROOM PAPER',
      'WIRE BRASS GLASS FROST',
      'ROOT TOY, AND ROUND AGAIN.',
      'EACH BEATS THE NEXT TWO.',
      'EACH FEARS THE LAST TWO.']);
    return;
  }

  if (t === 'i') {
    const box = S.map.boxes.find(b => b.x === f.x && b.y === f.y);
    if (box) {
      bagAdd(box.item);
      S.map.grid[f.y][f.x] = 'x';
      if (!S.taken[S.floor]) S.taken[S.floor] = {};
      S.taken[S.floor][f.x + ',' + f.y] = true;
      say(['A LOST-AND-FOUND BOX.', 'YOU FOUND ' + box.item + '!']);
    }
    return;
  }

  if (t === 'x') { say(['THE BOX IS EMPTY NOW.']); return; }

  if (t === 'L' && fl.shrine) {
    if (S.keys < fl.shrine.keys) { say(fl.shrine.wait); return; }
    const sh = fl.shrine;
    say(sh.call, () => {
      const m = makeMon(sh.no, sh.lv, { shiny: rnd(60) === 0 });
      startBattle({ kind: 'legend', foe: [m] });
    });
    return;
  }

  if (t === '=' || t === 'p') {
    say([pick(['FORTY YEARS OF DUST', 'SOMETHING SCUTTLES AWAY', 'NOBODY HAS MOVED THIS']),
      pick(['SITS ON IT.', 'BEHIND IT.', 'SINCE THE HOTEL SHUT.'])]);
  }
}

function talkTo(who) {
  if (who.kind === 'talk') { say(who.lines); return; }

  /* Staff who never clocked off. Beat them once; after that they are friendly. */
  if (who.beaten) { say(who.done || who.win); return; }
  say(who.pre, () => {
    startBattle({
      kind: 'trainer', foe: who.team.map(t => makeMon(t[0], t[1])),
      who,
    });
  });
}

/* --------------------------------------------------------------- world update */

function updateWorld() {
  const ui = S.ui;
  if (ui) {
    if (ui.kind === 'dialog') updateDialog(ui);
    else updateMenu(ui);
    return;
  }

  if (hit.start) { openMainMenu(); return; }

  if (S.p.moving) {
    S.p.sub++;
    S.p.anim++;
    if (S.p.sub >= STEP_FRAMES) {
      const d = DIRV[S.p.dir];
      S.p.x += d[0]; S.p.y += d[1];
      S.p.sub = 0; S.p.moving = 0;
      stepFinished();
    }
    return;
  }

  if (S.p.turn > 0) { S.p.turn--; return; }

  if (hit.a) { interact(); return; }

  let want = -1;
  if (keys.down) want = 0;
  else if (keys.up) want = 1;
  else if (keys.left) want = 2;
  else if (keys.right) want = 3;

  if (want >= 0) {
    if (S.p.dir !== want) {
      S.p.dir = want;
      S.p.turn = TURN_FRAMES;
      return;
    }
    const d = DIRV[want];
    if (!blocked(S.p.x + d[0], S.p.y + d[1])) {
      S.p.moving = 1; S.p.sub = 0;
    } else {
      S.p.anim++;
    }
  } else {
    S.p.anim = 0;
  }
}

/* ============================================================================
   DRAWING THE WORLD, AND EVERY BOX THAT OPENS OVER IT
   ========================================================================== */

const TILE_KIND = {
  '#': 'wall', '.': 'floor', ',': 'dust', '=': 'prop', 'p': 'plant',
  'E': 'elev', 'H': 'heal', 'S': 'shop', 'i': 'item', 'x': 'itemgone',
  'n': 'sign', 'L': 'shrine',
};

function drawWorld() {
  const th = themeOf(S.floor);
  const pp = playerPixel();
  let camX = Math.round(pp.x - BW / 2 + TS / 2);
  let camY = Math.round(pp.y - BH / 2 + TS / 2);
  camX = clamp(camX, 0, FW * TS - BW);
  camY = clamp(camY, 0, FH * TS - BH);

  const t0x = Math.floor(camX / TS), t0y = Math.floor(camY / TS);
  for (let y = t0y; y <= t0y + VIEW_H; y++) {
    for (let x = t0x; x <= t0x + VIEW_W; x++) {
      const ch = tileAt(x, y);
      const kind = TILE_KIND[ch] || 'floor';
      bx.drawImage(tile(kind, th), x * TS - camX, y * TS - camY);
    }
  }

  /* Everybody standing about, then you, in whatever order keeps feet in front
     of heads. */
  const actors = [];
  for (const f of S.map.folk) {
    if (f.x < t0x - 1 || f.x > t0x + VIEW_W + 1) continue;
    if (f.y < t0y - 1 || f.y > t0y + VIEW_H + 1) continue;
    actors.push({ y: f.y, draw: () => drawFolk(f, f.x * TS - camX, f.y * TS - camY) });
  }
  actors.push({ y: S.p.y, draw: () => drawPorter(pp.x - camX, pp.y - camY) });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();
}

function drawPorter(x, y) {
  const dir = S.p.dir;
  const base = dir === 1 ? PORTER_UP : dir === 0 ? PORTER_DOWN : PORTER_SIDE;
  let spr = makeSprite(base, '0123');
  if (S.p.moving) {
    const f = Math.floor(S.p.anim / 6) % 2;
    if (f) spr = walkFrame(spr, dir === 3 ? 1 : -1);
  }
  blit(spr, x, y, dir === 2);
}

function drawFolk(f, x, y) {
  const art = f.art === 'guest' ? NPC_GUEST : f.art === 'ghost' ? NPC_GHOST : NPC_STAFF;
  const spr = makeSprite(art, f.art === 'ghost' ? '0112' : '0123');
  /* The dead ones bob. It is how you tell across a dark room. */
  const bob = f.art === 'ghost' ? Math.round(Math.sin(S.t * 2 + f.x) * 1) : 0;
  blit(spr, x, y + bob);
}

/* --------------------------------------------------------------- dialogue box */

function drawDialog(ui) {
  panel(0, 96, BW, 48);
  const start = ui.page * 3;
  for (let i = 0; i < 3; i++) {
    const line = ui.lines[start + i];
    if (line === undefined) break;
    text(line, 8, 104 + i * 12, 3);
  }
  if (Math.floor(S.t * 3) % 2 === 0) {
    const last = ui.page >= dialogPages(ui) - 1;
    fillRect(BW - 12, 133, 5, 1, 3);
    fillRect(BW - 11, 134, 3, 1, 3);
    fillRect(BW - 10, 135, 1, 1, 3);
    if (!last) fillRect(BW - 12, 131, 5, 1, 2);
  }
}

/* ------------------------------------------------------------------- menus */

function listMenu(o) {
  S.ui = Object.assign({ kind: 'menu', idx: 0, scroll: 0 }, o);
}

function closeUI() { S.ui = null; }

function updateMenu(ui) {
  switch (ui.kind) {
    case 'menu': return updateList(ui);
    case 'party': return updateParty(ui);
    case 'summary': return updateSummary(ui);
    case 'bag': return updateBag(ui);
    case 'ledger': return updateLedger(ui);
    case 'shop': return updateShop(ui);
    case 'elevator': return updateElevator(ui);
    case 'dialog': return updateDialog(ui);
  }
}

function drawUI(ui) {
  switch (ui.kind) {
    case 'menu': return drawList(ui);
    case 'party': return drawParty(ui);
    case 'summary': return drawSummary(ui);
    case 'bag': return drawBag(ui);
    case 'ledger': return drawLedger(ui);
    case 'shop': return drawShop(ui);
    case 'elevator': return drawElevator(ui);
    case 'dialog': return drawDialog(ui);
  }
}

function updateList(ui) {
  const d = menuDir();
  const n = ui.items.length;
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (hit.a) {
    const it = ui.items[ui.idx];
    if (it && it.on) it.on();
    return;
  }
  if (hit.b || hit.start) {
    S.ui = null;
    if (ui.onCancel) ui.onCancel();
  }
}

function drawList(ui) {
  const w = ui.w || 76;
  const x = ui.x === undefined ? BW - w : ui.x;
  const y = ui.y === undefined ? 0 : ui.y;
  const h = ui.items.length * 11 + (ui.title ? 22 : 12);
  panel(x, y, w, h);
  let ty = y + 7;
  if (ui.title) { text(ui.title, x + 7, ty, 2); ty += 11; }
  ui.items.forEach((it, i) => {
    const yy = ty + i * 11;
    if (i === ui.idx) cursorMark(x + 5, yy, 3);
    text(it.label, x + 11, yy, 3);
    if (it.right) text(it.right, x + w - 7, yy, 3, 1, 'right');
  });
}

function openMainMenu() {
  listMenu({
    x: BW - 78, y: 2, w: 76,
    items: [
      { label: 'ROAMINALS', on: openParty },
      { label: 'BAG', on: () => openBag(null) },
      { label: 'LEDGER', on: openLedger },
      { label: 'PORTER', on: openPorter },
      { label: 'SAVE', on: () => {
        const ok = saveGame();
        say(ok ? ['THE NIGHT BOOK IS WRITTEN.', 'YOUR ROUND IS SAVED.']
               : ['THE NIGHT BOOK WILL NOT', 'TAKE ANY MORE INK.']);
      } },
      { label: 'CLOSE', on: closeUI },
    ],
  });
}

function openPorter() {
  const mins = Math.floor(S.playFrames / 3600);
  say([
    'NIGHT PORTER',
    'FLOOR KEYS  ' + S.keys + '/10',
    'TOKENS      ' + S.tokens,
    'CAUGHT      ' + Object.keys(S.caught).length + '/44',
    'SEEN        ' + Object.keys(S.seen).length + '/44',
    'ON SHIFT    ' + mins + ' MIN',
  ]);
}

/* ------------------------------------------------------------------ the party */

function openParty(opts) {
  const o = opts || {};
  S.ui = Object.assign({ kind: 'party', idx: 0 }, o);
}

function updateParty(ui) {
  const d = menuDir();
  const n = Math.max(1, S.party.length);
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;

  if (hit.a && S.party.length) {
    const m = S.party[ui.idx];
    if (ui.pick) { ui.pick(ui.idx, m); return; }
    S.ui = { kind: 'summary', idx: ui.idx, back: () => openParty(ui) };
    return;
  }
  if (hit.b) {
    S.ui = null;
    if (ui.back) ui.back();
    else if (ui.onCancel) ui.onCancel();
  }
}

function hpBar(x, y, w, cur, max, shade) {
  fillRect(x, y, w, 3, 3);
  fillRect(x + 1, y + 1, w - 2, 1, 0);
  const fillW = Math.max(cur > 0 ? 1 : 0, Math.round((w - 2) * cur / Math.max(1, max)));
  fillRect(x + 1, y + 1, fillW, 1, shade === undefined ? 2 : shade);
}

function drawParty(ui) {
  clear(1);
  panel(0, 0, BW, BH);
  text(ui.pick ? 'CHOOSE A ROAMINAL' : 'YOUR ROAMINALS', 8, 6, 2);
  if (!S.party.length) text('THE SATCHEL IS EMPTY.', 8, 22, 3);

  S.party.forEach((m, i) => {
    const y = 18 + i * 20;
    const sp = spec(m.no);
    if (i === ui.idx) {
      fillRect(4, y - 2, BW - 8, 19, 1);
      cursorMark(5, y + 5, 3);
    }
    drawCreature(sp, 10, y, 1, m.shiny, S.t);
    text(sp.name, 30, y + 1, 3);
    if (m.shiny) text('*', 26, y + 1, 3);
    text('L' + m.lv, BW - 46, y + 1, 3);
    text(sp.type, 30, y + 10, 2);
    hpBar(BW - 46, y + 12, 40, m.hp, monMaxHp(m));
    text(m.hp + '/' + monMaxHp(m), BW - 6, y + 8, 3, 1, 'right');
  });
}

function updateSummary(ui) {
  const d = menuDir();
  if (d === 'left') ui.idx = (ui.idx + S.party.length - 1) % S.party.length;
  if (d === 'right') ui.idx = (ui.idx + 1) % S.party.length;
  if (hit.b || hit.a) { S.ui = null; if (ui.back) ui.back(); }
}

function drawSummary(ui) {
  const m = S.party[ui.idx];
  if (!m) { S.ui = null; return; }
  const sp = spec(m.no);
  clear(1);
  panel(0, 0, BW, BH);
  drawCreature(sp, 8, 12, 2, m.shiny, S.t);
  text(sp.name, 48, 8, 3);
  if (m.shiny) text('SHINY COAT', 48, 17, 2);
  text('NO ' + String(sp.no).padStart(3, '0'), 48, 26, 2);
  text('LEVEL ' + m.lv, 48, 35, 3);
  text(sp.type, 48, 44, 3);
  text(sp.rarity, 100, 44, 2);

  text('HP ' + m.hp + '/' + monMaxHp(m), 8, 54, 3);
  hpBar(8, 63, 60, m.hp, monMaxHp(m));
  text('ATK ' + monAtk(m), 80, 54, 3);
  text('DEF ' + monDef(m), 80, 63, 3);
  text('SPD ' + monSpd(m), 80, 72, 3);

  const need = xpForLevel(m.lv + 1) - xpForLevel(m.lv);
  const has = m.xp - xpForLevel(m.lv);
  text('NEXT', 8, 72, 2);
  hpBar(30, 75, 40, clamp(has, 0, need), Math.max(1, need), 1);

  fillRect(6, 82, BW - 12, 1, 2);
  m.moves.forEach((mv, i) => {
    const y = 87 + i * 12;
    text(mv.k, 8, y, 3);
    text(MOVES[mv.k].t, 92, y, 2);
    text(mv.pp + '/' + mv.max, BW - 8, y, 3, 1, 'right');
  });
  if (sp.ev) text('EVOLVES AT ' + sp.ev[0], 8, 136, 2);
  else text('THIS IS AS FAR AS IT GOES', 8, 136, 2);
}

/* --------------------------------------------------------------------- bag */

function openBag(battle) {
  S.ui = { kind: 'bag', idx: 0, scroll: 0, battle: !!battle };
}

function useItem(name, inBattle) {
  const it = ITEMS[name];
  if (!it) return;

  if (it.kind === 'jar') {
    if (!inBattle) { say(['NOTHING TO THROW IT AT.']); return; }
    S.ui = null;
    throwJar(name);
    return;
  }
  if (it.kind === 'key') { say([name + ':', it.info]); return; }
  if (it.kind === 'repel') {
    bagTake(name); S.repel = it.steps;
    S.ui = null;
    say(['YOU SHAKE OUT THE SHEET.', 'THE DUST LIES DOWN FOR', it.steps + ' STEPS.']);
    return;
  }

  /* Everything else is used on one of your own. */
  openParty({
    pick: (i, m) => {
      if (it.kind === 'heal') {
        if (m.hp >= monMaxHp(m)) { say(['IT IS ALREADY FULL.'], () => openBag(inBattle)); return; }
        const before = m.hp;
        m.hp = Math.min(monMaxHp(m), m.hp + it.amount);
        bagTake(name);
        const done = () => { if (inBattle) { S.ui = null; battleAfterItem(); } else S.ui = null; };
        say([monName(m) + ' TOOK THE ' + name + '.', 'IT MENDED ' + (m.hp - before) + ' HP.'], done);
      } else if (it.kind === 'cure') {
        bagTake(name);
        m.rattled = 0;
        const done = () => { if (inBattle) { S.ui = null; battleAfterItem(); } else S.ui = null; };
        say([monName(m) + ' SETTLES DOWN.'], done);
      } else if (it.kind === 'level') {
        bagTake(name);
        gainXp(m, Math.max(1, xpForLevel(m.lv + 1) - m.xp), () => { S.ui = null; });
      }
    },
    back: () => openBag(inBattle),
  });
}

function updateBag(ui) {
  const items = bagList();
  const d = menuDir();
  const n = Math.max(1, items.length);
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (hit.a && items.length) { useItem(items[ui.idx], ui.battle); return; }
  if (hit.b) { S.ui = null; if (ui.battle) battleMenuBack(); }
}

function drawBag(ui) {
  clear(1);
  panel(0, 0, BW, BH);
  text('BAG', 8, 6, 2);
  text(S.tokens + ' TOKENS', BW - 8, 6, 2, 1, 'right');
  const items = bagList();
  if (!items.length) text('NOTHING BUT LINT.', 8, 24, 3);
  const view = 7;
  const start = clamp(ui.idx - 3, 0, Math.max(0, items.length - view));
  for (let i = 0; i < Math.min(view, items.length); i++) {
    const idx = start + i;
    const name = items[idx];
    const y = 20 + i * 12;
    if (idx === ui.idx) cursorMark(6, y, 3);
    text(name, 12, y, 3);
    text('x' + S.bag[name], BW - 10, y, 3, 1, 'right');
  }
  fillRect(6, 106, BW - 12, 1, 2);
  const sel = items[ui.idx];
  if (sel) {
    const info = ITEMS[sel].info;
    const words = info.split(' ');
    let line = '', ln = 0;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 25) { text(line, 8, 112 + ln * 10, 3); line = w; ln++; }
      else line = (line + ' ' + w).trim();
    }
    text(line, 8, 112 + ln * 10, 3);
  }
}

/* ------------------------------------------------------------------ ledger */

function openLedger() { S.ui = { kind: 'ledger', idx: 0, detail: false }; }

function updateLedger(ui) {
  const d = menuDir();
  if (ui.detail) {
    if (d === 'left') ui.idx = (ui.idx + 43) % 44;
    if (d === 'right') ui.idx = (ui.idx + 1) % 44;
    if (hit.a || hit.b) ui.detail = false;
    return;
  }
  if (d === 'up') ui.idx = (ui.idx + 43) % 44;
  if (d === 'down') ui.idx = (ui.idx + 1) % 44;
  if (d === 'left') ui.idx = clamp(ui.idx - 7, 0, 43);
  if (d === 'right') ui.idx = clamp(ui.idx + 7, 0, 43);
  if (hit.a) ui.detail = true;
  else if (hit.b) S.ui = null;
}

function drawLedger(ui) {
  clear(1);
  panel(0, 0, BW, BH);
  const no = ui.idx + 1;
  const sp = spec(no);
  const seen = S.seen[no], caught = S.caught[no];

  if (ui.detail) {
    text('LEDGER  NO ' + String(no).padStart(3, '0'), 8, 6, 2);
    if (seen) drawCreature(sp, 10, 18, 2, false, S.t);
    else blitSolid(makeSprite(BODY[sp.family]), 10, 18, 2, 2);
    text(seen ? sp.name : '- - - - -', 50, 20, 3);
    text(seen ? sp.type : '?', 50, 32, 3);
    text(sp.rarity, 50, 42, 2);
    text(caught ? 'IN YOUR JARS' : seen ? 'SEEN, NOT HELD' : 'NOT MET', 50, 52, 2);
    fillRect(6, 66, BW - 12, 1, 2);
    if (seen) {
      text('HP ' + sp.b[0] + '  ATK ' + sp.b[1], 8, 72, 3);
      text('DEF ' + sp.b[2] + '  SPD ' + sp.b[3], 8, 84, 3);
      text('STAGE ' + sp.stage + ' OF ITS LINE', 8, 96, 2);
      text(sp.ev ? 'EVOLVES AT LEVEL ' + sp.ev[0] : 'FULLY GROWN', 8, 108, 2);
      text('POSSESSED A ' + sp.thing.toUpperCase(), 8, 120, 2);
    } else {
      text('THE PAGE IS BLANK.', 8, 80, 3);
    }
    text('< >  A CLOSE', 8, 134, 2);
    return;
  }

  text('LEDGER', 8, 6, 2);
  text(Object.keys(S.caught).length + '/44 HELD', BW - 8, 6, 2, 1, 'right');
  const view = 8;
  const start = clamp(ui.idx - 4, 0, 44 - view);
  for (let i = 0; i < view; i++) {
    const n = start + i + 1;
    const s = spec(n);
    const y = 18 + i * 13;
    if (n - 1 === ui.idx) { fillRect(4, y - 2, BW - 8, 12, 1); cursorMark(6, y + 1, 3); }
    text(String(n).padStart(3, '0'), 12, y, 2);
    text(S.seen[n] ? s.name : '- - - - - -', 34, y, 3);
    if (S.caught[n]) text('*', BW - 12, y, 3);
    else if (S.seen[n]) text('.', BW - 12, y, 2);
  }
  text('A: PAGE   B: BACK', 8, 134, 2);
}

/* -------------------------------------------------------------------- shop */

function openShop() {
  S.ui = { kind: 'shop', idx: 0 };
}

function updateShop(ui) {
  const d = menuDir();
  const n = SHOP_STOCK.length;
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (hit.a) {
    const name = SHOP_STOCK[ui.idx];
    const cost = ITEMS[name].cost;
    if (S.tokens < cost) { say(['THE MACHINE CLUNKS.', 'NOT ENOUGH TOKENS.'], openShop); return; }
    S.tokens -= cost;
    bagAdd(name);
    say([name + ' DROPS INTO', 'THE TRAY. -' + cost + ' TOKENS.'], openShop);
    return;
  }
  if (hit.b) S.ui = null;
}

function drawShop(ui) {
  clear(1);
  panel(0, 0, BW, BH);
  text('VENDING MACHINE', 8, 6, 2);
  text(S.tokens + ' TOKENS', BW - 8, 6, 2, 1, 'right');
  SHOP_STOCK.forEach((name, i) => {
    const y = 22 + i * 13;
    if (i === ui.idx) { fillRect(4, y - 2, BW - 8, 12, 1); cursorMark(6, y + 1, 3); }
    text(name, 12, y, 3);
    text(ITEMS[name].cost, BW - 10, y, 3, 1, 'right');
  });
  fillRect(6, 106, BW - 12, 1, 2);
  text(ITEMS[SHOP_STOCK[ui.idx]].info.slice(0, 25), 8, 112, 3);
  text('A: BUY    B: LEAVE', 8, 128, 2);
}

/* ------------------------------------------------------------------ the lift */

function openElevator() {
  S.ui = { kind: 'elevator', idx: S.floor };
}

function updateElevator(ui) {
  const d = menuDir();
  const top = Math.min(S.keys, FLOORS.length - 1);
  if (d === 'up') ui.idx = (ui.idx + top) % (top + 1);
  if (d === 'down') ui.idx = (ui.idx + 1) % (top + 1);
  if (hit.a) {
    const to = ui.idx;
    S.ui = null;
    if (to === S.floor) return;
    fadeTo(() => enterFloor(to));
    return;
  }
  if (hit.b) S.ui = null;
}

function drawElevator(ui) {
  const top = Math.min(S.keys, FLOORS.length - 1);
  const h = (top + 1) * 12 + 26;
  panel(20, Math.max(4, 70 - h / 2), BW - 40, h);
  const x = 26, y0 = Math.max(4, 70 - h / 2) + 7;
  text('THE LIFT', x, y0, 2);
  for (let i = 0; i <= top; i++) {
    const y = y0 + 14 + i * 12;
    if (i === ui.idx) cursorMark(x - 1, y, 3);
    text(FLOORS[i].label, x + 5, y, 3);
    text(FLOORS[i].name, x + 22, y, i === S.floor ? 2 : 3);
  }
  if (S.keys < FLOORS.length - 1) {
    text('LOCKED ABOVE', x + 5, y0 + 14 + (top + 1) * 12, 2);
  }
}

/* ------------------------------------------------------------------- fading */

function fadeTo(then) {
  S.fadeDir = 1; S.fade = 0; S.fadeThen = then;
}

function updateFade() {
  if (!S.fadeDir) return false;
  S.fade += S.fadeDir * 0.08;
  if (S.fade >= 1 && S.fadeDir > 0) {
    S.fade = 1; S.fadeDir = -1;
    if (S.fadeThen) { S.fadeThen(); S.fadeThen = null; }
  } else if (S.fade <= 0 && S.fadeDir < 0) {
    S.fade = 0; S.fadeDir = 0;
  }
  return true;
}

/* The screen does not dim on a Game Boy — it fills in, darkest shade first,
   in a checker that gets denser. */
function drawFade() {
  if (S.fade <= 0) return;
  const level = Math.min(3, Math.floor(S.fade * 4));
  if (level >= 3) { fillRect(0, 0, BW, BH, 3); return; }
  const step = level === 0 ? 4 : level === 1 ? 3 : 2;
  bx.fillStyle = PAL[3];
  for (let y = 0; y < BH; y += 2) {
    for (let x = (y / 2) % 2 ? 0 : step; x < BW; x += step) {
      bx.fillRect(x, y, 2, 2);
    }
  }
}

/* ============================================================================
   BATTLE
   Turn based, one out each side, and the whole thing runs off a queue of
   events. Anything that happens — a line of text, a hit, a faint, a jar going
   in — is pushed onto that queue, and an event is allowed to push more events
   in front of itself. That is what makes a turn read in the right order
   without a single nested callback.
   ========================================================================== */

function myMon() { return S.party[S.bt.mi]; }
function foeMon() { return S.bt.foe[S.bt.fi]; }

function stageMul(s) { return s >= 0 ? (2 + s) / 2 : 2 / (2 - s); }

function qsay(...lines) { S.bt.q.unshift(...lines.map(s => ({ m: s }))); }
function qthen(fn) { S.bt.q.unshift({ f: fn }); }
function qwait(n) { S.bt.q.unshift({ w: n }); }
function qpush(...ev) { S.bt.q.push(...ev); }

function startBattle(o) {
  const foe = o.foe;
  for (const m of foe) S.seen[m.no] = 1;

  S.bt = {
    kind: o.kind, who: o.who || null,
    foe, fi: 0, mi: Math.max(0, firstAlive()),
    q: [], msg: null, msgTick: 0,
    sub: 'wait', menu: 0, moveIdx: 0,
    stM: { atk: 0, def: 0 }, stF: { atk: 0, def: 0 },
    runs: 0, over: null, ending: false,
    dispM: 0, dispF: 0,
    shakeM: 0, shakeF: 0, flashF: 0, flashM: 0,
    intro: 0, jar: null,
  };
  S.mode = 'battle';
  const bt = S.bt;
  bt.dispM = myMon() ? myMon().hp : 0;
  bt.dispF = foeMon().hp;

  if (o.kind === 'wild') {
    qpush({ m: 'A WILD ' + monName(foe[0]) + ' STIRS!' });
    if (foe[0].shiny) qpush({ m: 'ITS COAT IS INSIDE OUT!' });
  } else if (o.kind === 'legend') {
    qpush({ m: monName(foe[0]) + ' IS AWAKE.' },
          { m: 'IT HAS BEEN AWAKE', m2: 1 },
          { m: 'THE WHOLE TIME.' });
  } else {
    qpush({ m: o.who.name + ' STEPS OUT!' });
  }
  qpush({ f: () => qsay('GO, ' + monName(myMon()) + '!') });
  qpush({ f: () => { S.bt.sub = 'main'; } });
}

/* ---------------------------------------------------------------- the maths */

function damageRoll(att, def, key, stA, stD) {
  const mv = MOVES[key];
  const a = monAtk(att) * stageMul(stA.atk);
  const d = monDef(def) * stageMul(stD.def);
  let base = Math.floor(((2 * att.lv / 5 + 2) * mv.pow * a / Math.max(1, d)) / 50) + 2;
  const stab = mv.t === spec(att.no).type ? 1.5 : 1;
  const eff = effect(mv.t, spec(def.no).type);
  const crit = chance(mv.eff === 'crit' ? 0.22 : 0.0625);
  const rand = 0.85 + Math.random() * 0.15;
  return {
    dmg: Math.max(1, Math.floor(base * stab * eff * (crit ? 2 : 1) * rand)),
    eff, crit,
  };
}

function effLine(eff) {
  if (eff > 1) return 'THE GHOST CANNOT STAND IT!';
  if (eff < 1) return 'IT BARELY NOTICES.';
  return null;
}

/* ------------------------------------------------------------------- a hit */

function doAttack(side, key) {
  const bt = S.bt;
  const att = side === 'mine' ? myMon() : foeMon();
  const def = side === 'mine' ? foeMon() : myMon();
  if (!att || !def || att.hp <= 0 || def.hp <= 0) return;

  const stA = side === 'mine' ? bt.stM : bt.stF;
  const stD = side === 'mine' ? bt.stF : bt.stM;
  const mv = MOVES[key];
  const who = side === 'mine' ? '' : 'FOE ';

  /* A rattled Roaminal loses its nerve about a quarter of the time. */
  if (att.rattled && chance(0.25)) {
    qsay(who + monName(att) + ' IS TOO RATTLED', 'TO MOVE!');
    return;
  }

  const lines = [who + monName(att) + ' USED ' + key + '!'];

  if (Math.random() * 100 > mv.acc) {
    lines.push('IT MISSED.');
    qsay(...lines);
    return;
  }

  if (!mv.pow) {
    switch (mv.eff) {
      case 'rattle':
        def.rattled = 1;
        lines.push(who ? monName(def) + ' IS RATTLED!' : 'FOE ' + monName(def) + ' IS RATTLED!');
        break;
      case 'soak':
        stD.atk = clamp(stD.atk - 1, -3, 3);
        lines.push('ITS ATTACK DROPS.');
        break;
      case 'brace':
        stA.def = clamp(stA.def + 1, -3, 3);
        lines.push('ITS GUARD GOES UP.');
        break;
      case 'sharpen':
        stA.atk = clamp(stA.atk + 1, -3, 3);
        lines.push('IT SHARPENS UP.');
        break;
      default:
        lines.push('NOTHING HAPPENED.');
    }
    qsay(...lines);
    return;
  }

  const r = damageRoll(att, def, key, stA, stD);
  def.hp = Math.max(0, def.hp - r.dmg);
  if (side === 'mine') { bt.shakeF = 10; bt.flashF = 6; } else { bt.shakeM = 10; bt.flashM = 6; }

  if (r.crit) lines.push('A CRITICAL HIT!');
  const el = effLine(r.eff);
  if (el) lines.push(el);

  if (mv.eff === 'drain') {
    const back = Math.max(1, Math.floor(r.dmg / 2));
    att.hp = Math.min(monMaxHp(att), att.hp + back);
    lines.push('IT DRINKS THE DIFFERENCE.');
  }
  if (mv.eff === 'soak' && chance(0.35)) {
    stD.atk = clamp(stD.atk - 1, -3, 3);
    lines.push('ITS ATTACK DROPS.');
  }
  if (mv.eff === 'rattle' && chance(0.3)) {
    def.rattled = 1;
    lines.push((side === 'mine' ? 'FOE ' : '') + monName(def) + ' IS RATTLED!');
  }
  qsay(...lines);
}

/* --------------------------------------------------------------- experience */

function gainXp(m, amount, done) {
  const lines = [];
  m.xp += amount;
  let guard = 0;
  while (m.lv < MAX_LEVEL && m.xp >= xpForLevel(m.lv + 1) && guard++ < 60) {
    const before = monMaxHp(m);
    m.lv++;
    const after = monMaxHp(m);
    m.hp = Math.min(after, m.hp + (after - before));
    m.maxhp = after;
    lines.push(monName(m) + ' REACHED LEVEL ' + m.lv + '!');
    for (const [at, key] of spec(m.no).moves) {
      if (at !== m.lv) continue;
      if (m.moves.some(x => x.k === key)) continue;
      if (m.moves.length < 4) {
        m.moves.push({ k: key, pp: MOVES[key].pp, max: MOVES[key].pp });
        lines.push('IT LEARNED ' + key + '!');
      } else {
        const drop = m.moves.shift();
        m.moves.push({ k: key, pp: MOVES[key].pp, max: MOVES[key].pp });
        lines.push('IT FORGOT ' + drop.k + ' AND', 'LEARNED ' + key + '!');
      }
    }
  }
  if (done) done(lines);
  return lines;
}

/* ------------------------------------------------------------------- faints */

function afterFoeDown() {
  const bt = S.bt;
  const down = foeMon();
  const lines = [(bt.kind === 'trainer' ? 'FOE ' : 'THE WILD ') + monName(down) + ' IS SPENT!'];

  const me = myMon();
  if (me && me.hp > 0) {
    const sp = spec(down.no);
    const gain = Math.floor(sp.xpBase * down.lv / 7) * (bt.kind === 'trainer' ? 3 / 2 : 1);
    const amount = Math.max(1, Math.floor(gain));
    lines.push(monName(me) + ' GAINED ' + amount + ' XP.');
    gainXp(me, amount, ls => lines.push(...ls));
  }

  bt.q.length = 0;
  qsay(...lines);

  const next = bt.foe.findIndex(m => m.hp > 0);
  if (next >= 0) {
    qpush({ f: () => {
      S.bt.fi = next;
      S.bt.stF = { atk: 0, def: 0 };
      S.bt.dispF = foeMon().hp;
      qsay((S.bt.who ? S.bt.who.name + ' SENDS OUT ' : 'ANOTHER ONE: ') + monName(foeMon()) + '!');
      qpush({ f: () => { S.bt.sub = 'main'; } });
    } });
  } else {
    qpush({ f: winBattle });
  }
}

function afterMineDown() {
  const bt = S.bt;
  bt.q.length = 0;
  qsay(monName(myMon()) + ' HAS NOTHING LEFT.');
  qpush({ f: () => {
    if (partyAlive()) {
      const opts = {
        pick: (i, m) => {
          if (!alive(m)) { say(['THAT ONE IS SPENT.'], () => openParty(opts)); return; }
          S.ui = null;
          S.bt.mi = i;
          S.bt.stM = { atk: 0, def: 0 };
          S.bt.dispM = m.hp;
          qsay('GO, ' + monName(m) + '!');
          qpush({ f: () => { S.bt.sub = 'main'; } });
        },
      };
      openParty(opts);
      S.bt.sub = 'wait';
    } else {
      blackOut();
    }
  } });
}

function checkDowns() {
  const bt = S.bt;
  if (bt.ending) return;
  if (foeMon() && foeMon().hp <= 0) { bt.ending = true; afterFoeDown(); return; }
  const me = myMon();
  if (me && me.hp <= 0) { bt.ending = true; afterMineDown(); }
}

/* --------------------------------------------------------------- turn order */

function playerTurn(moveIdx) {
  const bt = S.bt;
  bt.sub = 'wait';
  const me = myMon();
  const spent = me.moves.every(m => m.pp <= 0);
  const mv = me.moves[moveIdx];

  /* With nothing left in any move you throw yourself at it instead — which is
     the only thing standing between an out-of-PP trainer fight and a
     dead end. */
  if (spent) {
    const foeKeyS = pickFoeMove();
    bt.ending = false;
    qpush({ f: () => {
      qsay(monName(myMon()) + ' HAS NOTHING LEFT', 'AND THROWS ITSELF IN!');
      const foe = foeMon();
      const hurt = Math.max(1, Math.floor(monAtk(myMon()) / 3));
      foe.hp = Math.max(0, foe.hp - hurt);
      myMon().hp = Math.max(0, myMon().hp - Math.max(1, Math.floor(hurt / 2)));
      S.bt.shakeF = 10; S.bt.shakeM = 8;
    } });
    qpush({ f: checkDowns });
    qpush({ f: () => doAttack('foe', foeKeyS) });
    qpush({ f: checkDowns });
    qpush({ f: endOfTurn });
    return;
  }

  if (!mv || mv.pp <= 0) {
    qsay('NO STRENGTH LEFT IN THAT ONE.');
    qpush({ f: () => { S.bt.sub = 'main'; } });
    return;
  }
  mv.pp--;
  const foeKey = pickFoeMove();
  const mineFirst = monSpd(myMon()) * stageMul(0) >= monSpd(foeMon()) ? true : false;
  const order = mineFirst ? ['mine', 'foe'] : ['foe', 'mine'];

  bt.ending = false;
  for (const side of order) {
    qpush({ f: () => doAttack(side, side === 'mine' ? mv.k : foeKey) });
    qpush({ f: checkDowns });
  }
  qpush({ f: endOfTurn });
}

function pickFoeMove() {
  const foe = foeMon(), me = myMon();
  const usable = foe.moves.filter(m => m.pp > 0);
  if (!usable.length) return 'SCUFF';
  /* Staff ghosts read the wheel; wild ones swing at whatever. */
  if (S.bt.kind !== 'wild' && chance(0.75)) {
    let best = usable[0], bestScore = -1;
    for (const m of usable) {
      const mv = MOVES[m.k];
      const sc = (mv.pow || 30) * effect(mv.t, spec(me.no).type) *
        (mv.t === spec(foe.no).type ? 1.5 : 1);
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    best.pp--;
    return best.k;
  }
  const m = pick(usable);
  m.pp--;
  return m.k;
}

function endOfTurn() {
  const bt = S.bt;
  if (bt.over) return;
  bt.ending = false;
  bt.sub = 'main';
}

function battleMenuBack() { S.bt.sub = 'main'; }
function battleAfterItem() { enemyFreeTurn(); }

/* Using an item or swapping costs you the turn. */
function enemyFreeTurn() {
  const bt = S.bt;
  bt.sub = 'wait';
  bt.ending = false;
  const key = pickFoeMove();
  qpush({ f: () => doAttack('foe', key) });
  qpush({ f: checkDowns });
  qpush({ f: endOfTurn });
}

/* ------------------------------------------------------------------ the jar */

function catchChance(m, mult) {
  const sp = spec(m.no);
  const max = monMaxHp(m);
  const hpPart = (3 * max - 2 * m.hp) / (3 * max);
  const p = hpPart * (sp.catchRate / 255) * mult * (m.rattled ? 1.4 : 1);
  return clamp(p, 0.02, 0.92);
}

function throwJar(name) {
  const bt = S.bt;
  bt.sub = 'wait';
  if (bt.kind === 'trainer') {
    qsay('IT IS NOT YOURS TO JAR.');
    qpush({ f: () => { S.bt.sub = 'main'; } });
    return;
  }
  bagTake(name);
  const foe = foeMon();
  const win = chance(catchChance(foe, ITEMS[name].mult));
  const shakes = win ? 3 : rnd(3);

  qsay('YOU THROW THE ' + name + '!');
  qpush({ f: () => { S.bt.jar = { t: 0, shakes, win }; } });
  qpush({ w: 30 + shakes * 22 });
  qpush({ f: () => {
    S.bt.jar = null;
    if (win) {
      S.caught[foe.no] = 1;
      foe.rattled = 0;
      if (S.party.length < MAX_PARTY) {
        S.party.push(foe);
        qsay(monName(foe) + ' IS IN THE JAR!', 'THE LEDGER IS UPDATED.');
      } else {
        qsay(monName(foe) + ' IS IN THE JAR!',
          'THE SATCHEL IS FULL, SO IT', 'GOES TO LOST PROPERTY.');
      }
      qpush({ f: () => endBattle('caught') });
    } else {
      qsay(shakes === 0 ? 'IT DID NOT EVEN CLOSE.'
        : shakes === 1 ? 'THE LID CAME OFF.'
        : 'ONE MORE SHAKE AND...');
      qpush({ f: enemyFreeTurn });
    }
  } });
}

/* ------------------------------------------------------------------- ending */

function winBattle() {
  const bt = S.bt;
  if (bt.kind === 'trainer' && bt.who) {
    const w = bt.who;
    S.beaten[S.floor + ':' + (w.name || 'BOSS')] = true;
    for (const f of S.map.folk) {
      if (f.name === w.name && f.kind === w.kind) f.beaten = true;
    }
    S.tokens += w.reward || 100;
    /* One qsay, in order — each call pushes in FRONT of the queue, so two of
       them would come out backwards. */
    qsay(...(w.win || ['THEY STAND ASIDE.']),
      'YOU COLLECT ' + (w.reward || 100) + ' TOKENS.');
    if (w.kind === 'boss') {
      if (S.keys === S.floor) {
        S.keys = Math.min(FLOORS.length, S.floor + 1);
        qpush({ f: () => qsay('FLOOR KEY ' + S.keys + ' OF 10.',
          'THE LIFT WILL GO FURTHER.') });
      }
      if (S.floor === FLOORS.length - 1) {
        S.keys = FLOORS.length;
        qpush({ f: () => qsay('THE CLOCK ON THE ROOF', 'HAS STARTED TICKING.') });
      }
    }
  } else if (bt.kind === 'legend') {
    qsay(monName(bt.foe[0]) + ' FADES BACK', 'INTO THE FITTINGS.',
      'IT WILL BE THERE AGAIN.');
  }
  qpush({ f: () => endBattle('win') });
}

function blackOut() {
  qsay('EVERY JAR IS EMPTY.', 'THE DARK GETS THE ROUND.');
  qpush({ f: () => {
    const lost = Math.floor(S.tokens / 2);
    S.tokens -= lost;
    for (const m of S.party) healMon(m);
    qsay('YOU COME TO AT THE CART.', 'IT COST YOU ' + lost + ' TOKENS.');
    qpush({ f: () => endBattle('lose') });
  } });
}

function endBattle(result) {
  const wasLegend = S.bt.kind === 'legend';
  const caughtNo = result === 'caught' ? foeMon().no : 0;
  S.bt.over = result;
  for (const m of S.party) m.rattled = 0;

  fadeTo(() => {
    S.mode = 'world';
    S.bt = null;
    if (result === 'lose') {
      const heal = findTile('H');
      if (heal) { S.p.x = heal.x; S.p.y = heal.y + 1; S.p.dir = 1; }
      else { S.p.x = S.map.spawn.x; S.p.y = S.map.spawn.y; }
    }
    if (result === 'caught' && wasLegend) {
      S.shrines[S.floor] = 1;
      if (S.map.shrine) S.map.grid[S.map.shrine.y][S.map.shrine.x] = '=';
      if (caughtNo === 44) { finishGame(); return; }
    }
    checkEvolutions();
  });
}

function findTile(ch) {
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) if (S.map.grid[y][x] === ch) return { x, y };
  }
  return null;
}

/* ---------------------------------------------------------------- evolution */

function checkEvolutions() {
  for (let i = 0; i < S.party.length; i++) {
    const m = S.party[i];
    const sp = spec(m.no);
    if (sp.ev && m.lv >= sp.ev[0]) {
      S.mode = 'evolve';
      S.evo = { i, from: m.no, to: sp.ev[1], t: 0, done: false };
      return;
    }
  }
}

function updateEvolve() {
  const e = S.evo;
  e.t += 1 / 60;
  if (!e.done && e.t > 3.2) {
    const m = S.party[e.i];
    const before = monMaxHp(m);
    m.no = e.to;
    m.maxhp = monMaxHp(m);
    m.hp = Math.min(m.maxhp, m.hp + (m.maxhp - before));
    S.seen[e.to] = 1; S.caught[e.to] = 1;
    /* Anything it should have learned by now, it learns on the way through. */
    for (const [at, key] of spec(e.to).moves) {
      if (at > m.lv) break;
      if (m.moves.some(x => x.k === key)) continue;
      if (m.moves.length < 4) m.moves.push({ k: key, pp: MOVES[key].pp, max: MOVES[key].pp });
      else { m.moves.shift(); m.moves.push({ k: key, pp: MOVES[key].pp, max: MOVES[key].pp }); }
    }
    e.done = true;
  }
  if (e.done && (hit.a || hit.b || e.t > 6.5)) {
    S.evo = null;
    S.mode = 'world';
    checkEvolutions();
  }
}

function drawEvolve() {
  const e = S.evo;
  clear(0);
  const flick = e.done ? 1 : (Math.sin(e.t * e.t * 3) > 0 ? 1 : 0);
  const sp = spec(flick ? e.to : e.from);
  const m = S.party[e.i];
  drawCreature(sp, BW / 2 - 16, 34, 2, m && m.shiny, S.t);
  panel(0, 96, BW, 48);
  if (!e.done) {
    text('WHAT? SOMETHING IS', 8, 106, 3);
    text('HAPPENING TO IT...', 8, 118, 3);
  } else {
    text(spec(e.from).name + ' BECAME', 8, 106, 3);
    text(spec(e.to).name + '!', 8, 118, 3);
    if (Math.floor(S.t * 3) % 2 === 0) text('A', BW - 14, 130, 2);
  }
}

/* ------------------------------------------------------------------ finish */

function finishGame() {
  S.finished = true;
  S.mode = 'credits';
  S.credits = { t: 0 };
  saveGame();
}

/* ============================================================================
   THE BATTLE SCREEN, THE TITLE, AND THE LOOP THAT DRIVES ALL OF IT
   ========================================================================== */

function pumpBattle() {
  const bt = S.bt;
  if (bt.wait > 0) { bt.wait--; return; }

  if (bt.msg) {
    bt.msgTick++;
    if ((hit.a || hit.b) && bt.msgTick > 8) bt.msg = null;
    else if (bt.msgTick > 84) bt.msg = null;
    return;
  }

  const ev = bt.q.shift();
  if (!ev) return;
  if (ev.m !== undefined) {
    const lines = [ev.m];
    if (bt.q.length && bt.q[0].m !== undefined) lines.push(bt.q.shift().m);
    bt.msg = lines; bt.msgTick = 0;
    return;
  }
  if (ev.w !== undefined) { bt.wait = ev.w; return; }
  if (ev.f) ev.f();
}

function tryRun() {
  const bt = S.bt;
  bt.sub = 'wait';
  if (bt.kind === 'trainer') {
    qsay('THERE IS NO WALKING OUT', 'ON A MEMBER OF STAFF.');
    qpush({ f: () => { S.bt.sub = 'main'; } });
    return;
  }
  bt.runs++;
  const odds = monSpd(myMon()) >= monSpd(foeMon()) ? 0.85 : 0.45 + bt.runs * 0.15;
  if (chance(odds)) {
    qsay('YOU BACK OUT OF THE ROOM.');
    qpush({ f: () => endBattle('run') });
  } else {
    qsay('IT IS BETWEEN YOU AND', 'THE DOOR.');
    qpush({ f: enemyFreeTurn });
  }
}

function swapTo(i) {
  const m = S.party[i];
  const back = S.ui;                      // the party list we were just in
  if (!alive(m)) { say(['THAT ONE IS SPENT.'], () => openParty(back)); return; }
  if (i === S.bt.mi) { say(['IT IS ALREADY OUT.'], () => openParty(back)); return; }
  S.ui = null;
  S.bt.mi = i;
  S.bt.stM = { atk: 0, def: 0 };
  S.bt.dispM = m.hp;
  S.bt.sub = 'wait';
  qsay('COME BACK. GO, ' + monName(m) + '!');
  qpush({ f: enemyFreeTurn });
}

function updateBattle() {
  const bt = S.bt;
  if (!bt) return;

  /* Health bars slide rather than jump, so a big hit reads as a big hit. */
  const me = myMon(), foe = foeMon();
  if (me) bt.dispM += clamp(me.hp - bt.dispM, -2.2, 2.2);
  if (foe) bt.dispF += clamp(foe.hp - bt.dispF, -2.2, 2.2);
  if (bt.shakeM > 0) bt.shakeM--;
  if (bt.shakeF > 0) bt.shakeF--;
  if (bt.flashM > 0) bt.flashM--;
  if (bt.flashF > 0) bt.flashF--;
  if (bt.jar) bt.jar.t++;

  if (S.ui) { updateMenu(S.ui); return; }

  if (bt.sub === 'main' && !bt.msg && !bt.q.length) {
    const d = menuDir();
    if (d === 'left' || d === 'right') bt.menu ^= 1;
    if (d === 'up' || d === 'down') bt.menu ^= 2;
    if (hit.a) {
      switch (bt.menu) {
        case 0: bt.sub = 'moves'; bt.moveIdx = 0; break;
        case 1: openBag(true); break;
        case 2: openParty({ pick: i => swapTo(i), back: battleMenuBack }); break;
        case 3: tryRun(); break;
      }
    }
    return;
  }

  if (bt.sub === 'moves' && !bt.msg && !bt.q.length) {
    const moves = myMon().moves;
    const d = menuDir();
    if (d === 'left' || d === 'right') bt.moveIdx ^= 1;
    if (d === 'up' || d === 'down') bt.moveIdx ^= 2;
    if (bt.moveIdx >= moves.length) bt.moveIdx = moves.length - 1;
    if (hit.b) { bt.sub = 'main'; return; }
    if (hit.a) playerTurn(bt.moveIdx);
    return;
  }

  pumpBattle();
}

/* ------------------------------------------------------------------ drawing */

const JAR_ART = [
"..333333..",
".3111113..",
"3111111 3.",
"31111113..",
"31111113..",
"31111113..",
"31111113..",
"31111113..",
".3111113..",
"..3333 3..",
];

function drawHpBox(x, y, w, m, disp, mine) {
  panel(x, y, w, mine ? 32 : 26);
  const sp = spec(m.no);
  text(sp.name, x + 6, y + 5, 3);
  if (m.shiny) text('*', x + w - 20, y + 5, 3);
  text('L' + m.lv, x + w - 6, y + 5, 3, 1, 'right');
  text('HP', x + 6, y + 15, 2);
  hpBar(x + 20, y + 17, w - 28, Math.max(0, disp), monMaxHp(m));
  if (mine) {
    text(Math.max(0, Math.round(disp)) + '/' + monMaxHp(m), x + w - 6, y + 22, 3, 1, 'right');
  }
}

function drawBattle() {
  const bt = S.bt;
  clear(0);

  /* Two strips of floor, one for each side. On a Game Boy this is all the
     staging a fight ever got. */
  fillRect(0, 46, 108, 2, 2);
  fillRect(84, 44, 24, 2, 2);
  fillRect(4, 92, 96, 2, 2);
  fillRect(4, 90, 20, 2, 2);

  const foe = foeMon(), me = myMon();

  if (foe) {
    const sx = bt.shakeF > 0 ? (bt.shakeF % 4 < 2 ? 2 : -2) : 0;
    if (!bt.jar && (bt.flashF <= 0 || bt.flashF % 4 < 2)) {
      drawCreature(spec(foe.no), 104 + sx, 12, 2, foe.shiny, S.t);
    }
    drawHpBox(4, 4, 84, foe, bt.dispF, false);
  }

  if (me) {
    const sy = bt.shakeM > 0 ? (bt.shakeM % 4 < 2 ? 1 : -1) : 0;
    if (bt.flashM <= 0 || bt.flashM % 4 < 2) {
      /* Your own is drawn from behind: the same grid, mirrored and set low. */
      drawCreature(spec(me.no), 14, 58 + sy, 2, me.shiny, S.t);
    }
    drawHpBox(72, 62, 84, me, bt.dispM, true);
  }

  if (bt.jar) {
    const j = bt.jar;
    const spr = makeSprite(JAR_ART, '0123');
    const wob = j.t < 26 ? 0 : Math.round(Math.sin(j.t / 5) * 3);
    const fly = Math.min(1, j.t / 26);
    const jx = 20 + (108 - 20) * fly + wob;
    const jy = 70 - Math.sin(fly * Math.PI) * 42 - (28 * fly);
    blit(spr, jx, jy, false, 2);
  }

  /* The bottom of the screen is either what just happened, or what you do
     about it. */
  if (bt.msg) {
    panel(0, 96, BW, 48);
    text(bt.msg[0] || '', 8, 108, 3);
    if (bt.msg[1]) text(bt.msg[1], 8, 122, 3);
    return;
  }

  if (bt.sub === 'moves' && me) {
    panel(0, 96, BW, 48);
    const moves = me.moves;
    for (let i = 0; i < 4; i++) {
      const mv = moves[i];
      const cx2 = 10 + (i % 2) * 76, cy = 104 + (i >> 1) * 13;
      if (!mv) { text('-', cx2 + 6, cy, 2); continue; }
      if (i === bt.moveIdx) cursorMark(cx2, cy, 3);
      text(mv.k, cx2 + 6, cy, mv.pp > 0 ? 3 : 2);
    }
    const sel = moves[bt.moveIdx];
    if (sel) {
      text(MOVES[sel.k].t, 10, 131, 2);
      text('PP ' + sel.pp + '/' + sel.max, BW - 10, 131, 2, 1, 'right');
    }
    return;
  }

  panel(0, 96, BW, 48);
  if (bt.sub === 'main') {
    const labels = ['FIGHT', 'BAG', 'SWAP', bt.kind === 'trainer' ? 'STAY' : 'RUN'];
    for (let i = 0; i < 4; i++) {
      const cx2 = 12 + (i % 2) * 74, cy = 108 + (i >> 1) * 16;
      if (i === bt.menu) cursorMark(cx2 - 8, cy, 3);
      text(labels[i], cx2, cy, 3);
    }
  } else {
    text('...', 8, 116, 2);
  }
}

/* ------------------------------------------------------------------- title */

const TITLE_LINES = [
  'THE ROTHSAY GRAND HOTEL',
  'CLOSED FORTY YEARS.',
  '',
  'THE GHOSTS COULD NOT STAY',
  'GHOSTS, SO EACH ONE MOVED',
  'INTO SOMETHING SOLID: A MOP,',
  'A BOILER, A LEDGER, A BELL.',
  '',
  'THE OBJECTS MOVED INTO THE',
  'ANIMALS THAT CAME IN OUT OF',
  'THE COLD. THAT IS A ROAMINAL.',
  '',
  'YOU ARE THE NEW NIGHT PORTER.',
  'YOU HAVE A SATCHEL OF JARS',
  'AND TEN FLOORS TO GET THROUGH.',
];

function drawTitle() {
  clear(0);
  const t = S.t;
  /* The clock creature looms behind the letters. */
  drawCreature(spec(44), BW / 2 - 16, 22 + Math.round(Math.sin(t) * 2), 2, false, t);
  fillRect(0, 0, BW, 18, 1);
  fillRect(0, 18, BW, 1, 3);
  text('ROAMINALS', BW / 2, 4, 3, 2, 'center');

  panel(6, 60, BW - 12, 30);
  text('ONE GENERATION.', BW / 2, 66, 3, 1, 'center');
  text('ONE VERY LARGE BUILDING.', BW / 2, 78, 2, 1, 'center');

  const ui = S.titleUI;
  ui.items.forEach((it, i) => {
    const y = 100 + i * 13;
    if (i === ui.idx) cursorMark(BW / 2 - 44, y, 3);
    text(it, BW / 2 - 34, y, 3);
  });
  text('THIRSTY BEAR STUDIOS', BW / 2, 136, 2, 1, 'center');
}

function updateTitle() {
  const ui = S.titleUI;
  const d = menuDir();
  const n = ui.items.length;
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (hit.a || hit.start) {
    const pickName = ui.items[ui.idx];
    if (pickName === 'CONTINUE') {
      if (loadGame()) { S.mode = 'world'; }
      return;
    }
    if (pickName === 'NEW ROUND') {
      S.mode = 'intro';
      S.introPage = 0;
      return;
    }
    if (pickName === 'LEDGER') { openLedger(); S.mode = 'titledex'; }
  }
}

function drawIntro() {
  clear(0);
  panel(4, 4, BW - 8, BH - 8);
  const start = S.introPage * 6;
  for (let i = 0; i < 6; i++) {
    const line = TITLE_LINES[start + i];
    if (line === undefined) break;
    text(line, 10, 16 + i * 13, 3);
  }
  if (Math.floor(S.t * 3) % 2 === 0) text('A', BW - 16, 126, 2);
}

function updateIntro() {
  if (hit.a || hit.start) {
    S.introPage++;
    if (S.introPage * 6 >= TITLE_LINES.length) {
      S.mode = 'starter';
      S.starter = { idx: 1 };
    }
  }
}

/* ------------------------------------------------------------- your first */

const STARTERS = [4, 19, 22];

function drawStarter() {
  clear(0);
  panel(0, 0, BW, 92);
  text('LOST PROPERTY', 8, 6, 2);
  text('THREE JARS NOBODY CLAIMED.', 8, 18, 3);
  STARTERS.forEach((no, i) => {
    const x = 12 + i * 48;
    const sel = i === S.starter.idx;
    if (sel) fillRect(x - 4, 30, 40, 44, 1);
    drawCreature(spec(no), x, 32, 2, false, S.t);
    if (sel) cursorMark(x + 14, 76, 3);
  });
  const sp = spec(STARTERS[S.starter.idx]);
  panel(0, 92, BW, 52);
  text(sp.name, 8, 100, 3);
  text(sp.type + '  LEVEL 5', 8, 112, 2);
  text('POSSESSED A ' + sp.thing.toUpperCase() + '.', 8, 124, 3);
  text('A: TAKE IT', BW - 8, 134, 2, 1, 'right');
}

function updateStarter() {
  const d = menuDir();
  if (d === 'left') S.starter.idx = (S.starter.idx + 2) % 3;
  if (d === 'right') S.starter.idx = (S.starter.idx + 1) % 3;
  if (hit.a) {
    const no = STARTERS[S.starter.idx];
    newGame(no);
  }
}

function newGame(starterNo) {
  S.party = [makeMon(starterNo, 5)];
  S.seen[starterNo] = 1; S.caught[starterNo] = 1;
  S.bag = {}; bagAdd('JAR', 5); bagAdd('POULTICE', 3);
  S.tokens = 500; S.keys = 0;
  S.taken = {}; S.beaten = {}; S.shrines = {};
  S.steps = 0; S.playFrames = 0; S.finished = false;
  S.started = true;
  enterFloor(0);
  S.mode = 'world';
  say(['ARROWS WALK. Z OR SPACE IS',
    'A: TALK, OPEN, CONFIRM.',
    'X IS B. ENTER IS START.',
    'THE LIFT IS THE ONLY WAY',
    'BETWEEN FLOORS, AND IT ONLY',
    'STOPS WHERE YOU HAVE A KEY.',
    'BEAT THE STAFF GHOST ON A',
    'FLOOR AND THE NEXT ONE',
    'OPENS UP. GOOD LUCK.']);
}

/* ----------------------------------------------------------------- credits */

const CREDIT_LINES = [
  'THE CLOCK IS IN A JAR.',
  '',
  'THE ROTHSAY GRAND IS QUIET',
  'FOR THE FIRST TIME SINCE',
  'THE NIGHT IT SHUT.',
  '',
  'THE STAFF STAY ON. THEY LIKE',
  'THE WORK. SO DO YOU.',
  '',
  'ROAMINALS',
  '',
  'PRODUCED BY CLAUDE AND',
  'THIRSTY BEAR STUDIOS',
  '',
  'MADE BY CLAUDE,',
  'JULIAN CANFIELD',
  'AND COREY CANFIELD',
  '',
  'NIGHT PORTER: YOU',
];

function drawCredits() {
  clear(0);
  const y0 = BH - S.credits.t * 22;
  CREDIT_LINES.forEach((l, i) => {
    const y = y0 + i * 12;
    if (y > -10 && y < BH) text(l, BW / 2, y, 3, 1, 'center');
  });
  const end = y0 + CREDIT_LINES.length * 12;
  if (end < 40) {
    text('CAUGHT ' + Object.keys(S.caught).length + '/44', BW / 2, 60, 3, 1, 'center');
    text('A: TITLE', BW / 2, 80, 2, 1, 'center');
  }
}

function updateCredits() {
  S.credits.t += 1 / 60;
  const end = BH - S.credits.t * 22 + CREDIT_LINES.length * 12;
  if (end < 40 && (hit.a || hit.start)) toTitle();
}

/* --------------------------------------------------------------------- loop */

function toTitle() {
  S.mode = 'title';
  S.ui = null;
  S.titleUI = { idx: 0, items: hasSave() ? ['CONTINUE', 'NEW ROUND'] : ['NEW ROUND'] };
}

function step() {
  S.t += 1 / 60;
  S.frame++;
  if (S.mode === 'world' || S.mode === 'battle') S.playFrames++;

  if (updateFade()) { clearHits(); return; }

  switch (S.mode) {
    case 'title': updateTitle(); break;
    case 'titledex':
      if (S.ui) updateMenu(S.ui);
      if (!S.ui) S.mode = 'title';
      break;
    case 'intro': updateIntro(); break;
    case 'starter': updateStarter(); break;
    case 'world': updateWorld(); break;
    case 'battle': updateBattle(); break;
    case 'evolve': updateEvolve(); break;
    case 'credits': updateCredits(); break;
  }
  clearHits();
}

function draw() {
  switch (S.mode) {
    case 'title': drawTitle(); break;
    case 'titledex': if (S.ui) drawUI(S.ui); else drawTitle(); break;
    case 'intro': drawIntro(); break;
    case 'starter': drawStarter(); break;
    case 'world':
      drawWorld();
      if (S.ui) drawUI(S.ui);
      break;
    case 'battle':
      drawBattle();
      if (S.ui) drawUI(S.ui);
      break;
    case 'evolve': drawEvolve(); break;
    case 'credits': drawCredits(); break;
    default: clear(0);
  }
  drawFade();
  present();
}

let acc = 0, last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let guard = 0;
  while (acc >= 1 / 60 && guard++ < 6) { step(); acc -= 1 / 60; }
  draw();
}

toTitle();
requestAnimationFrame(frame);

})();
