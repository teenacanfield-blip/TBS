/* ============================================================================
   ROAMINALS
   A monster-catching game in the shape of the handheld ones, set entirely
   inside one very large building: the Rothsay Grand Hotel, shut for forty
   years.

   The fiction that drives every system: the hotel's ghosts could not stay
   ghosts, so each one moved into an OBJECT — a mop, a boiler, a ledger, a
   chandelier — and the object moved into an ANIMAL that had wandered in out of
   the cold. That fusion is a Roaminal. What the ghost possessed is the
   creature's TYPE, which is why the type chart is a wheel of household things
   rather than fire and water.

   One generation, forty-four species. Commons everywhere, ultra rares that turn
   up about one encounter in forty, three legendaries that exist once each, and
   a shiny roll on every single wild creature.

   The screen is a Game Boy Advance: 240x160, and colour the way that machine
   did colour — every sprite is a four-tone grid pointed at a palette, so a
   creature is its animal's natural coat plus the material of the thing
   possessing it, and a floor is one palette away from being a different room.

   Plain JS, no dependencies, no build step, no image, font or audio files.
   ========================================================================== */
(() => {
'use strict';

/* ---------------------------------------------------------------- constants */

const BW = 240, BH = 160;      // the screen, in art pixels. A Game Boy Advance.
const SCALE = 4;               // blown up to 960x640
const TS = 16;                 // tile size, art pixels
const VIEW_W = BW / TS, VIEW_H = BH / TS;   // fifteen tiles across, ten down

const FW = 40, FH = 32;        // every floor of the hotel is this many tiles
const STEP_FRAMES = 8;         // frames to walk one tile (2px a frame)
const TURN_FRAMES = 5;         // frames spent turning on the spot

const MAX_PARTY = 10;      // the satchel
const BOX_COUNT = 5;       // dusty boxes in the housekeeping cart
const BOX_SIZE = 10;       // and what each one holds
const MAX_LEVEL = 60;
const SHINY_ODDS = 200;        // one wild creature in this many, halved by the penny

const SAVE_KEY = 'roaminals-save-v1';

/* -------------------------------------------------------------- the palette */
/* Art is written as four-tone character grids and pointed at a RAMP — four
   colours running light to dark. That is how the hardware this looks like
   actually worked, and it is why one possum grid can be a grey possum, a
   frost-blue one, and a shiny that has never been seen on this floor.

   UI_INK is the ramp everything chrome-coloured uses, so the old habit of
   passing 0-3 for a shade still means something everywhere. */

const UI_INK = ['#fbfaf2', '#93a6c8', '#4a5878', '#131a2c'];

const UI = {
  panel:   '#fbfaf2',
  panelLo: '#dfe3ee',
  edge:    '#131a2c',
  frame:   '#4870c0',
  frameHi: '#89b4f0',
  ink:     '#1d2438',
  inkSoft: '#5d6b90',
  pick:    '#f8d878',
  pickLo:  '#e0a830',
  good:    '#58c860',
  warn:    '#f0b038',
  bad:     '#e05848',
  shadow:  'rgba(19,26,44,0.35)',
};

/* A shade is either an index into UI_INK or a colour of its own. */
function col(c) {
  return typeof c === 'number' ? UI_INK[clamp(c, 0, 3)] : c;
}

/* ------------------------------------------------------------ colour maths */
/* Ramps are derived rather than written out twice: a stage-one coat is its
   family's ramp lifted towards the light, a last stage is the same ramp pushed
   down into it, and a shiny is the whole thing walked around the colour wheel.
   Forty-four species, three legendary hues and a shiny each, out of sixteen
   written ramps. */

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(r, g, b) {
  const f = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function mix(hex, target, amount) {
  const a = hexRgb(hex), b = hexRgb(target);
  return rgbHex(a[0] + (b[0] - a[0]) * amount,
                a[1] + (b[1] - a[1]) * amount,
                a[2] + (b[2] - a[2]) * amount);
}
function lighten(hex, a) { return mix(hex, '#ffffff', a); }
function darken(hex, a) { return mix(hex, '#000000', a); }

function hueShift(hex, deg) {
  let [r, g, b] = hexRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return rgbHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

/* Hue, saturation, lightness in — hex out. The skin lab's colour strip is
   built from this rather than from a list of five hundred written-out
   swatches. */
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function rampLift(ramp, a) { return ramp.map(c => lighten(c, a)); }
function rampSink(ramp, a) { return ramp.map(c => darken(c, a)); }
function rampShift(ramp, deg) { return ramp.map(c => hueShift(c, deg)); }

/* ------------------------------------------------------------------- canvas */

const cv = document.getElementById('c');
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

const buf = document.createElement('canvas');
buf.width = BW; buf.height = BH;
const bx = buf.getContext('2d');
bx.imageSmoothingEnabled = false;

function clear(c) {
  bx.fillStyle = col(c === undefined ? 0 : c);
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
/* A 5x7 face. Six art pixels a character means thirty-eight characters fit
   across the screen, which is the width the dialogue is written to. */

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

function bakeText(str, colour, scale) {
  const s = scale || 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, textWidth(str, s));
  c.height = GH * s;
  const g = c.getContext('2d');
  g.fillStyle = colour;
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
  const colour = col(shade === undefined ? UI.ink : shade);
  const s = scale || 1;
  const key = str + '|' + colour + '|' + s;
  let c = textCache.get(key);
  if (!c) {
    if (textCache.size > 600) textCache.clear();
    c = bakeText(str, colour, s);
    textCache.set(key, c);
  }
  let dx = Math.round(x);
  if (align === 'center') dx = Math.round(x - c.width / 2);
  else if (align === 'right') dx = Math.round(x - c.width);
  bx.drawImage(c, dx, Math.round(y));
  return c.width;
}

/* Anything sitting over artwork gets a hard shadow so it stays readable. */
function textShadow(str, x, y, shade, scale, align) {
  text(str, x + 1, y + 1, UI.edge, scale, align);
  return text(str, x, y, shade, scale, align);
}

/* ------------------------------------------------------------------ sprites */
/* Art is rows of characters: '.' is see-through, and a digit points at that
   slot of whatever ramp the sprite is drawn with. Creatures and tiles use four
   tones; people get a longer ramp, because a face needs skin, hair and cloth
   that do not share a colour. */

const spriteCache = new Map();

function makeSprite(rows, ramp) {
  const pal = ramp || UI_INK;
  let byRamp = spriteCache.get(rows);
  if (!byRamp) { byRamp = new Map(); spriteCache.set(rows, byRamp); }
  const key = pal.join('');
  const hit = byRamp.get(key);
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
      if (ch < '0' || ch > '7') continue;
      const colour = pal[+ch];
      if (!colour) continue;
      g.fillStyle = colour;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (byRamp.size > 40) byRamp.clear();
  byRamp.set(key, c);
  return c;
}

/* Sprites are cached against the grid they were baked from, so when the skin
   lab paints on a grid the old bake has to be thrown away by hand. */
function invalidateSprite(rows) { spriteCache.delete(rows); }

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
  g.fillStyle = col(shade);
  g.fillRect(0, 0, c.width, c.height);
  bx.drawImage(c, Math.round(x), Math.round(y), spr.width * s, spr.height * s);
}

/* -------------------------------------------------------------- panel chrome */
/* Every box in the game — dialogue, menus, the battle HUD — is the same bone
   panel inside a blue frame, so the whole thing reads as one machine. */

function fillRect(x, y, w, h, shade) {
  bx.fillStyle = col(shade);
  bx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function panel(x, y, w, h) {
  fillRect(x + 1, y + 1, w - 2, h - 2, UI.shadow);
  fillRect(x, y, w, h, UI.edge);
  fillRect(x + 1, y + 1, w - 2, h - 2, UI.frame);
  fillRect(x + 2, y + 2, w - 4, 1, UI.frameHi);
  fillRect(x + 2, y + 2, 1, h - 4, UI.frameHi);
  fillRect(x + 3, y + 3, w - 6, h - 6, UI.panel);
  fillRect(x + 3, y + h - 4, w - 6, 1, UI.panelLo);
}

/* The chevron that marks the highlighted line of any list. */
function cursorMark(x, y, shade) {
  const c = shade === undefined ? UI.pickLo : shade;
  fillRect(x, y, 2, 7, c);
  fillRect(x + 2, y + 1, 2, 5, c);
  fillRect(x + 4, y + 2, 2, 3, c);
  fillRect(x, y, 1, 5, lighten(col(c), 0.4));
}

/* A bar with a lip on it: HP, experience, anything that fills. */
function meter(x, y, w, cur, max, colour) {
  fillRect(x, y, w, 6, UI.edge);
  fillRect(x + 1, y + 1, w - 2, 4, '#2a3350');
  const inner = w - 2;
  const fill = Math.max(cur > 0 ? 1 : 0, Math.round(inner * clamp(cur / Math.max(1, max), 0, 1)));
  fillRect(x + 1, y + 1, fill, 4, colour);
  fillRect(x + 1, y + 1, fill, 1, lighten(colour, 0.45));
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

/* Where the thing hangs, whether the pair looks right mirrored, and the coat
   the animal itself wears — real fur, feather and shell colours, so a creature
   reads as an ANIMAL carrying a glowing OBJECT rather than as one tinted
   blob. */
const FAMILY = {
  possum:   { anchor: [9, 0],  coat: ['#ececf4', '#adadbe', '#6b6b7e', '#272736'] },
  rat:      { anchor: [9, 0],  coat: ['#e6cdae', '#ac8259', '#6d4c31', '#291b12'] },
  moth:     { anchor: [4, 9],  pair: false, coat: ['#f4ecd6', '#ccb494', '#8b7152', '#2e241a'] },
  cat:      { anchor: [9, 0],  coat: ['#ffdca6', '#e69a51', '#a25d22', '#3a1d0b'] },
  beetle:   { anchor: [10, 8], coat: ['#c6d6b6', '#6c855b', '#39492e', '#141d12'] },
  newt:     { anchor: [9, 0],  coat: ['#deeea6', '#8cae53', '#4e6b2a', '#18260e'] },
  hare:     { anchor: [9, 8],  coat: ['#f6e6cf', '#c6ae86', '#836b4a', '#2d251a'] },
  snail:    { anchor: [5, 3],  pair: false, coat: ['#eeddE6', '#b494ac', '#72526a', '#291a29'] },
  pigeon:   { anchor: [0, 4],  coat: ['#e6eef6', '#9caec6', '#5a6c84', '#1c2532'] },
  bear:     { anchor: [9, 8],  coat: ['#f6dcbc', '#c69463', '#835b36', '#2d1d12'] },
  frog:     { anchor: [8, 0],  coat: ['#ddf6b6', '#8cc663', '#4a8332', '#15320a'] },
  eel:      { anchor: [0, 6],  coat: ['#cceeee', '#6cacac', '#3a6c6c', '#0d2626'] },
  spider:   { anchor: [10, 9], coat: ['#ddcdee', '#8c6cac', '#523a6c', '#1d122a'] },
  warden:   { anchor: [9, 8],  coat: ['#f4f4ff', '#b4b4de', '#6c6ca6', '#252542'] },
  stoker:   { anchor: [4, 5],  pair: false, coat: ['#eec6a6', '#a67253', '#624232', '#211512'] },
  midnight: { anchor: [8, 4],  pair: false, coat: ['#d6deff', '#7484d6', '#424a96', '#15193a'] },
};

/* The material of the thing possessing the animal. A ghost that moved into a
   brass key glows brass no matter what it is riding. */
const THING_RAMP = {
  mop:   ['#dcf6ea', '#6ccaa6', '#2a835c', '#0d3224'],
  flame: ['#ffdda6', '#fa8434', '#b23c12', '#4c160a'],
  frost: ['#e6f2ff', '#8cbcf4', '#3a64b4', '#121e42'],
  wire:  ['#fffcb6', '#f2d434', '#aa8400', '#3c2a00'],
  paper: ['#fff4cc', '#eccc7c', '#aa7c32', '#422a0a'],
  glass: ['#dcfcff', '#7cdcf4', '#2a8cb4', '#0a3242'],
  cloth: ['#eed4fc', '#bc7ce4', '#723ca4', '#2c1242'],
  brass: ['#ffecb6', '#e4ac44', '#a26c1a', '#3c220a'],
  root:  ['#dcf4a6', '#7cc444', '#3a7c1a', '#122a0a'],
  toy:   ['#ffdcec', '#fa7cac', '#b23c6c', '#420e22'],
};

/* Every type also has a ramp, which is what the marks and the type badges are
   drawn in. */
const TYPE_RAMP = {
  PLAIN: ['#ececec', '#a4a4a4', '#5c5c5c', '#1a1a1a'],
  BROOM: THING_RAMP.mop,   FLAME: THING_RAMP.flame, FROST: THING_RAMP.frost,
  WIRE:  THING_RAMP.wire,  PAPER: THING_RAMP.paper, GLASS: THING_RAMP.glass,
  CLOTH: THING_RAMP.cloth, BRASS: THING_RAMP.brass, ROOT:  THING_RAMP.root,
  TOY:   THING_RAMP.toy,
};

/* A line's stages are the same coat lifted towards the light or pushed down
   into it, and a shiny is that coat walked most of the way round the colour
   wheel — which is exactly the trick the hardware this imitates used to get a
   second version of a creature for free. */
function coatFor(sp, shiny) {
  const fam = FAMILY[sp.family] || FAMILY.possum;
  /* A coat repainted in the skin lab replaces the family's, and everything
     below still happens to it — so a recoloured line still darkens as it
     evolves, and its shiny is still its own colour turned round. */
  let ramp = (SKINS.mons && SKINS.mons[sp.no]) || fam.coat;
  if (sp.stage === 1) ramp = rampLift(ramp, 0.16);
  else if (sp.stage >= 3) ramp = rampSink(ramp, 0.12);
  if (sp.rarity === 'ULTRA') ramp = rampShift(ramp, 40);
  if (sp.rarity === 'LEGEND') ramp = rampLift(rampShift(ramp, -25), 0.08);
  if (shiny) ramp = rampLift(rampShift(ramp, 155), 0.12);
  return ramp;
}

function thingFor(sp, shiny) {
  let ramp = THING_RAMP[sp.thing] || THING_RAMP.mop;
  if (sp.stage >= 3) ramp = rampLift(ramp, 0.10);
  if (shiny) ramp = rampShift(ramp, 155);
  return ramp;
}

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

function drawMark(runs, x, y, s, ramp) {
  if (!runs) return;
  for (const r of runs) {
    fillRect(x + r[0] * s, y + r[1] * s, r[2] * s, r[3] * s, ramp[r[4]]);
  }
}

/* Ghostlight coming off a creature, in the colour of whatever possessed it.
   Seeded per species, so the same Roaminal always smokes the same way. */
function drawWisps(x, y, n, seed, t, ramp, s) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const ax = x + Math.floor(r() * 17 * s);
    const ay = y + Math.floor(r() * 15 * s);
    const bob = Math.round(Math.sin(t * 2 + i) * 2);
    fillRect(ax, ay + bob, 2, 2, ramp[2]);
    fillRect(ax + 1, ay + bob - 2, 1, 1, ramp[1]);
  }
}

/* The whole creature: animal, the object that possessed it, and whatever the
   evolution has piled on top. `scale` is 3 in battle, 1 or 2 in the menus. */
function drawCreature(sp, x, y, scale, shiny, t) {
  const s = scale || 1;
  const fam = FAMILY[sp.family] || FAMILY.possum;
  const coat = coatFor(sp, shiny);
  const glow = thingFor(sp, shiny);
  const body = makeSprite(BODY[sp.family] || BODY.possum, coat);
  const thing = makeSprite(THING[sp.thing] || THING.mop, glow);

  if (sp.stage >= 2 || sp.rarity !== 'COMMON') {
    drawWisps(x - 3 * s, y - 2 * s, sp.stage >= 3 ? 6 : 3, sp.no * 977 + 13,
      t || 0, glow, s);
  }

  blit(body, x, y, false, s);
  drawMark(MARK[sp.no], x, y, s, glow);
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
      const hx = x + w / 2 + Math.cos(a) * (w * 0.66) - 1;
      const hy = y + 9 * s + Math.sin(a) * (w * 0.34) - 1;
      fillRect(hx, hy, 2, 2, glow[1]);
      fillRect(hx, hy, 1, 1, glow[0]);
    }
  }
}

/* A little coloured plate with the type on it, used anywhere a creature is
   named. It is the fastest way to read the wheel mid-fight. */
function typeBadge(type, x, y) {
  const ramp = TYPE_RAMP[type] || TYPE_RAMP.PLAIN;
  const w = textWidth(type, 1) + 7;
  fillRect(x, y, w, 10, ramp[3]);
  fillRect(x + 1, y + 1, w - 2, 8, ramp[1]);
  fillRect(x + 1, y + 1, w - 2, 1, ramp[0]);
  text(type, x + 4, y + 2, ramp[3]);
  return w;
}

/* ------------------------------------------------------------------ MAX */
/* You. Fifteen, hoodie, headphones round the neck, the night porter's satchel
   across one shoulder because nobody else applied for the job.

   People get a seven-slot ramp instead of the four a creature uses:
   0 outline, 1 skin, 2 skin shadow, 3 cloth, 4 cloth shadow, 5 hair,
   6 the bright accent — Max's headphones and satchel buckle. */

/* Mutable on purpose: the skin lab writes into this array in place, so every
   sprite already drawn from it re-bakes with the new colours. */
const MAX_PAL = ['#171128', '#f4c79a', '#c68a5e', '#4a7ccc', '#2c4c94', '#7a4a2a', '#f8d05c'];

const MAX_PAL_STOCK = MAX_PAL.slice();

/* What the seven slots are, in the lab's list. */
const MAX_SLOTS = ['OUTLINE', 'SKIN', 'SHADOW', 'HOODIE', 'FOLD', 'HAIR', 'BRASS'];

/* Everything the player has repainted. Kept in its own store so a skin
   outlives any single round. */
const SKINS = { max: null, grids: null, mons: {} };

/* Anatomy first, then detail. The head is ten pixels across and the shoulders
   twelve, so the body is the wider of the two and he stands like a person
   rather than balancing. There is a collar between them, the arms are two
   pixels wide with a hand on the end of each, and the legs get two rows —
   knee and foot — instead of being stubs on the bottom line. */

const MAX_DOWN = [
"................",
"....00000000....",
"...0555555550...",
"...0555555550...",
"...0551111550...",
"..605101101506..",
"..605111111506..",
"...0511221150...",
"....01111110....",
"..033333333330..",
"..034336633430..",
"..034333663430..",
"..014344443410..",
"..066333333440..",
"....0330..0330..",
"...0440...0440..",
];

const MAX_UP = [
"................",
"....00000000....",
"...0555555550...",
"...0555555550...",
"...0555555550...",
"..605555555506..",
"..605555555506..",
"...0555555550...",
"....05555550....",
"..033333333330..",
"..034333333430..",
"..034336633430..",
"..014333333410..",
"..044333333660..",
"....0330..0330..",
"...0440...0440..",
];

const MAX_SIDE = [
"................",
"....00000000....",
"...0555555550...",
"...0555555550...",
"...0555511110...",
"..60555510110...",
"..60555511110...",
"...0555511210...",
"....05511110....",
"...0333333330...",
"...0433663330...",
"...0433663330...",
"...0134444310...",
"...0663333440...",
"....0330.0330...",
"...0440..0440...",
];

/* The grids the lab paints on, and the originals to put back on RESET. */
const MAX_GRIDS = { DOWN: MAX_DOWN, UP: MAX_UP, SIDE: MAX_SIDE };
const MAX_GRIDS_STOCK = {
  DOWN: MAX_DOWN.slice(), UP: MAX_UP.slice(), SIDE: MAX_SIDE.slice(),
};

/* Put a saved skin back on. Colours are written into the live palette in
   place and grids row by row, so nothing that already holds a reference to
   either has to be told about it — only the sprite bakery, which is cleared. */
function applySkins() {
  if (SKINS.max) {
    for (let i = 0; i < MAX_PAL.length; i++) {
      if (SKINS.max[i]) MAX_PAL[i] = SKINS.max[i];
    }
  }
  if (SKINS.grids) {
    for (const key of Object.keys(MAX_GRIDS)) {
      const rows = SKINS.grids[key];
      if (!rows) continue;
      const live = MAX_GRIDS[key];
      for (let y = 0; y < live.length; y++) {
        if (typeof rows[y] === 'string') live[y] = rows[y];
      }
      invalidateSprite(live);
    }
  }
  walkCache.clear();
}

function resetSkins() {
  for (let i = 0; i < MAX_PAL.length; i++) MAX_PAL[i] = MAX_PAL_STOCK[i];
  for (const key of Object.keys(MAX_GRIDS)) {
    const live = MAX_GRIDS[key], stock = MAX_GRIDS_STOCK[key];
    for (let y = 0; y < live.length; y++) live[y] = stock[y];
    invalidateSprite(live);
  }
  SKINS.max = null; SKINS.grids = null; SKINS.mons = {};
  walkCache.clear();
}

/* Somebody else in the building: staff who never clocked off, guests who never
   checked out, and the ones who have stopped pretending to have feet. These
   keep the four-tone creature convention — light to dark. */

const NPC_PAL = {
  staff: ['#ffe4c4', '#c85a5a', '#7c2c34', '#22101a'],
  guest: ['#eaf6ff', '#7ab0c8', '#3a6478', '#141e28'],
  ghost: ['#f6fbff', '#aecdf4', '#6b88c8', '#2b3a68'],
};

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
/* Tiles are drawn rather than stored, so a floor's whole look — red lobby
   carpet, laundry tiling, boiler grating, the conservatory's mossy stone —
   comes out of one small theme object of colours. Fittings that are the same
   object everywhere (a vending machine, a housekeeping cart) keep their own
   colours on every floor, because that is what makes them findable. */

function px(g, x, y, w, h, colour) {
  g.fillStyle = colour;
  g.fillRect(x, y, w, h);
}

const tileCache = new Map();

/* Colours a theme does not name are worked out from the ones it does. */
function resolve(th) {
  if (th._done) return th;
  th.floorHi = th.floorHi || lighten(th.floor, 0.16);
  th.floorLo = th.floorLo || darken(th.floor, 0.16);
  th.wallLo = th.wallLo || darken(th.wall, 0.35);
  th.mortar = th.mortar || darken(th.wall, 0.5);
  th.prop = th.prop || '#9c6b3c';
  th.propHi = th.propHi || lighten(th.prop, 0.25);
  th.propLo = th.propLo || darken(th.prop, 0.3);
  th._done = true;
  return th;
}

function tile(kind, th) {
  resolve(th);
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
  px(g, 0, 0, TS, TS, th.floor);
  switch (th.pattern) {
    case 'carpet':
      px(g, 3, 3, 2, 2, th.accent); px(g, 11, 11, 2, 2, th.accent);
      px(g, 11, 3, 1, 1, th.floorHi); px(g, 3, 11, 1, 1, th.floorHi);
      px(g, 0, 7, TS, 1, th.floorLo);
      break;
    case 'tiles':
      px(g, 0, 0, TS, 1, th.floorLo); px(g, 0, 0, 1, TS, th.floorLo);
      px(g, 1, 1, 6, 1, th.floorHi); px(g, 9, 9, 6, 1, th.floorHi);
      px(g, 8, 8, 8, 1, th.floorLo); px(g, 8, 8, 1, 8, th.floorLo);
      break;
    case 'boards':
      px(g, 0, 0, TS, 1, th.floorLo); px(g, 0, 8, TS, 1, th.floorLo);
      px(g, 0, 1, TS, 1, th.floorHi); px(g, 0, 9, TS, 1, th.floorHi);
      px(g, 5, 1, 1, 7, th.floorLo); px(g, 12, 9, 1, 7, th.floorLo);
      break;
    case 'grate':
      for (let i = 2; i < TS; i += 4) {
        px(g, i, 0, 1, TS, th.floorLo);
        px(g, i + 1, 0, 1, TS, th.floorHi);
      }
      px(g, 0, 7, TS, 1, th.accent);
      break;
    case 'stone':
      px(g, 0, 0, TS, 1, th.floorLo); px(g, 0, 8, TS, 1, th.floorLo);
      px(g, 7, 1, 1, 7, th.floorLo); px(g, 2, 9, 1, 7, th.floorLo);
      px(g, 3, 3, 2, 1, th.accent); px(g, 10, 11, 3, 1, th.accent);
      break;
    default:
      px(g, 7, 7, 2, 2, th.accent);
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
        px(g, p[0], p[1], 1, 1, lighten(th.dust, 0.3));
      }
      break;

    case 'wall':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 0, 0, TS, 3, th.wallTop);
      px(g, 0, 3, TS, 1, th.wallLo);
      px(g, 0, 9, TS, 1, th.mortar);
      px(g, 0, 15, TS, 1, th.mortar);
      px(g, 5, 4, 1, 5, th.mortar);
      px(g, 11, 10, 1, 5, th.mortar);
      px(g, 0, 4, TS, 1, lighten(th.wall, 0.1));
      px(g, 0, 10, TS, 1, lighten(th.wall, 0.1));
      break;

    /* Furniture: crates, trunks, cabinets. Always the same shape, whichever
       floor you are on, so you always know what you cannot walk through. */
    case 'prop':
      paintFloor(g, th);
      px(g, 2, 3, 12, 12, '#000000');
      px(g, 2, 3, 12, 11, th.propLo);
      px(g, 3, 4, 10, 9, th.prop);
      px(g, 3, 4, 10, 1, th.propHi);
      px(g, 7, 4, 1, 9, th.propLo);
      px(g, 3, 8, 10, 1, th.propLo);
      px(g, 4, 5, 2, 1, lighten(th.prop, 0.4));
      break;

    case 'plant':
      paintFloor(g, th);
      px(g, 5, 10, 7, 6, '#231512');
      px(g, 5, 10, 7, 5, '#a0522d');
      px(g, 5, 10, 7, 1, '#c87a4a');
      px(g, 7, 3, 3, 8, '#2f6b28');
      px(g, 3, 4, 5, 3, '#3f8f34'); px(g, 8, 6, 5, 3, '#3f8f34');
      px(g, 4, 4, 3, 1, '#67c04a'); px(g, 9, 6, 3, 1, '#67c04a');
      px(g, 6, 1, 4, 3, '#3f8f34'); px(g, 7, 1, 2, 1, '#7ad45a');
      break;

    case 'door':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 1, 0, 14, 16, '#2a1a12');
      px(g, 2, 1, 12, 15, '#8b5a2b');
      px(g, 2, 1, 12, 1, '#b57a44');
      px(g, 4, 3, 8, 5, '#6b4423');
      px(g, 4, 10, 8, 4, '#6b4423');
      px(g, 11, 8, 2, 2, '#f8d05c');
      break;

    /* The lift. Everything in this building hangs off it. */
    case 'elev':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 0, 0, 16, 16, '#1b2030');
      px(g, 1, 1, 14, 14, '#8a94a8');
      px(g, 1, 1, 14, 1, '#c6cddc');
      px(g, 2, 2, 6, 12, '#6f7a90');
      px(g, 9, 2, 5, 12, '#6f7a90');
      px(g, 8, 1, 1, 14, '#3a4256');
      px(g, 6, 5, 4, 3, '#f8d05c');
      px(g, 7, 4, 2, 1, '#f8d05c');
      px(g, 6, 12, 4, 2, '#2a3142');
      break;

    /* Housekeeping cart. Rest against it and everything in your jars comes back
       up to full. The building's only kindness. */
    case 'heal':
      paintFloor(g, th);
      px(g, 1, 3, 14, 11, '#1b2030');
      px(g, 2, 4, 12, 9, '#eef2f6');
      px(g, 2, 4, 12, 1, '#ffffff');
      px(g, 7, 5, 2, 7, '#e04848');
      px(g, 4, 7, 8, 2, '#e04848');
      px(g, 2, 13, 3, 3, '#2a3142'); px(g, 11, 13, 3, 3, '#2a3142');
      px(g, 3, 14, 1, 1, '#8a94a8'); px(g, 12, 14, 1, 1, '#8a94a8');
      break;

    /* A vending machine that still takes tokens, forty years on. */
    case 'shop':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 0, 0, 16, 16, '#141a26');
      px(g, 1, 1, 14, 14, '#c03a3a');
      px(g, 1, 1, 14, 1, '#e86a5a');
      px(g, 2, 2, 8, 11, '#1a2436');
      px(g, 3, 3, 6, 1, '#5ac8e0');
      px(g, 3, 5, 2, 3, '#f8d05c'); px(g, 6, 5, 2, 3, '#58c860');
      px(g, 3, 9, 2, 3, '#e05888'); px(g, 6, 9, 2, 3, '#5a88e0');
      px(g, 11, 3, 3, 5, '#2a3142');
      px(g, 11, 9, 3, 3, '#f8d05c');
      break;

    /* A row of these stands against the laundry wall. Three of them still
       have their doors shut, and they do not all contain washing. */
    case 'wash':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 1, 1, 14, 15, '#1d2536');
      px(g, 2, 2, 12, 13, '#dfe6ee');
      px(g, 2, 2, 12, 1, '#ffffff');
      px(g, 2, 14, 12, 1, '#9aa8bc');
      px(g, 3, 3, 10, 3, '#9aa8bc');
      px(g, 4, 4, 2, 1, '#e05848');
      px(g, 7, 4, 2, 1, '#58c860');
      px(g, 10, 4, 2, 1, '#f8d05c');
      px(g, 4, 7, 8, 7, '#1d2536');
      px(g, 5, 8, 6, 5, '#4a90b8');
      px(g, 6, 9, 4, 3, '#9fd8ea');
      px(g, 6, 9, 2, 1, '#ffffff');
      break;

    case 'sign':
      paintFloor(g, th);
      px(g, 7, 9, 2, 7, '#5a4028');
      px(g, 1, 1, 14, 9, '#2a1a12');
      px(g, 2, 2, 12, 7, '#e8dcc0');
      px(g, 3, 4, 10, 1, '#7a6a50'); px(g, 3, 6, 7, 1, '#7a6a50');
      break;

    /* A lost-and-found box. Something is in it, once. */
    case 'item':
      paintFloor(g, th);
      px(g, 2, 4, 12, 11, '#231a10');
      px(g, 3, 5, 10, 9, '#c8963c');
      px(g, 3, 5, 10, 2, '#e8bc64');
      px(g, 3, 9, 10, 1, '#8a5c1c');
      px(g, 7, 5, 2, 9, '#8a5c1c');
      px(g, 4, 6, 2, 1, '#f8e0a0');
      break;

    case 'itemgone':
      paintFloor(g, th);
      px(g, 3, 11, 10, 4, '#231a10');
      px(g, 4, 12, 8, 2, '#8a6a3c');
      break;

    /* Where a legendary is waiting: a furnace door, a desk bell, a clock face.
       Drawn as an alcove with something lit inside it, so you can see it from
       across the room. */
    case 'shrine':
      px(g, 0, 0, TS, TS, th.wall);
      px(g, 1, 0, 14, 16, '#1a1424');
      px(g, 2, 1, 12, 14, '#4a3a6a');
      px(g, 3, 2, 10, 12, '#2a2040');
      px(g, 4, 3, 8, 8, '#8a6ad8');
      px(g, 5, 4, 6, 6, '#c8a8f8');
      px(g, 6, 5, 4, 4, '#f8f0ff');
      px(g, 3, 12, 10, 2, '#6a5490');
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
  /* Catch rates. This game would rather you had the creature than the war
     story: a common goes in better than a third of the time at full health,
     and everything gets much easier once it is worn down. Even a legendary,
     softened up with the right jar, is a coin flip in your favour. */
  s.catchRate = s.rarity === 'LEGEND' ? 60 : s.rarity === 'ULTRA' ? 80
    : s.stage === 1 ? 230 : s.stage === 2 ? 170 : 120;
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
  'JAR':        { kind: 'jar',  mult: 1.2, cost: 40,  info: 'AN EMPTY PRESERVE JAR. GHOSTS FIT.' },
  'GHOST JAR':  { kind: 'jar',  mult: 2.0, cost: 120, info: 'LEAD-LINED. HOLDS THE STRONGER ONES.' },
  'VAULT JAR':  { kind: 'jar',  mult: 3.2, cost: 400, info: 'OUT OF THE HOTEL SAFE. HOLDS ANYTHING.' },
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
    theme: { id: 'lobby', pattern: 'carpet', floor: '#b8544c', accent: '#8f3a36', wall: '#6d4536', wallTop: '#96674c', dust: '#e8c088', prop: '#9c6b3c' },
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
    theme: { id: 'laundry', pattern: 'tiles', floor: '#aebccb', accent: '#8b9cae', wall: '#4f6076', wallTop: '#7185a0', dust: '#eef4fa', prop: '#7f8fa6' },
    lv: [5, 8],
    table: [[31, 12], [7, 11], [1, 9], [13, 7], [37, 1]],
    items: ['POULTICE', 'GHOST JAR', 'JAR'],
    /* Three machines against the wall. The first has no back to it and is the
       way into the room the laundry was built around. The other two have
       something in the drum that should not fit in a drum. */
    machines: {
      mon: { no: 4, lv: 1000 },
      secret: ['VAULT JAR', 'SUGAR CUBE', 'FULL KIT'],
    },
    boss: {
      name: 'LAUNDRESS MAUD', art: 'ghost', reward: 500,
      team: [[31, 11], [7, 11], [8, 12]],
      pre: ['MAUD: EVERYTHING COMES', 'OUT OF THAT MACHINE', 'CLEANER THAN IT WENT IN.', 'HOLD STILL.'],
      win: ['MAUD: HMPH. A GOOD SOAK', 'WOULD FIX YOUR ATTITUDE.', 'GO ON. TAKE THE KEY.'],
      done: ['MAUD: DOWN IS WARMER.', 'DO NOT TOUCH THE PIPES.'],
    },
    folks: [
      { kind: 'talk', art: 'ghost', lines: ['THE DRIERS RAN ALL NIGHT', 'FOR FORTY YEARS.', 'THAT IS A LOT OF LINT', 'AND LINT GETS IDEAS.'] },
      { kind: 'talk', art: 'staff', lines: ['THREE MACHINES ON THAT WALL.', 'ONLY ONE OF THEM WASHES.',
        'THE FIRST HAS NO BACK TO IT', 'AND GOES SOMEWHERE.', 'DO NOT OPEN THE OTHER TWO.', 'I AM SERIOUS.'] },
      { kind: 'fight', name: 'PORTER HALLAM', art: 'staff', reward: 200, team: [[31, 9], [1, 10]],
        pre: ['HALLAM: THE OTHER PORTER.', 'ONLY ONE OF US', 'GETS THE ROUND.'],
        win: ['HALLAM: TAKE IT THEN.', 'MY FEET HURT ANYWAY.'] },
    ],
  },

  {
    label: 'B2', name: 'BOILER ROOM', seed: 3303,
    theme: { id: 'boiler', pattern: 'grate', floor: '#6d564b', accent: '#c8702c', wall: '#392924', wallTop: '#5a4038', dust: '#e08a3c', prop: '#7a4a2a' },
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
    theme: { id: 'kitchen', pattern: 'tiles', floor: '#dcdccb', accent: '#b2b2a0', wall: '#5f6b62', wallTop: '#87958a', dust: '#efe6bb', prop: '#9aa3a8' },
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
    theme: { id: 'rooms', pattern: 'carpet', floor: '#6f4f96', accent: '#523874', wall: '#3f2b56', wallTop: '#62457f', dust: '#d0aae8', prop: '#8a5f3a' },
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
    theme: { id: 'ball', pattern: 'boards', floor: '#c69a5e', accent: '#a17342', wall: '#6f4f2f', wallTop: '#9c7448', dust: '#f0d8a4', prop: '#8f6134' },
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
    theme: { id: 'office', pattern: 'tiles', floor: '#95a276', accent: '#77855a', wall: '#465038', wallTop: '#6a7658', dust: '#d2d8ab', prop: '#8a6a42' },
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
    theme: { id: 'nursery', pattern: 'carpet', floor: '#e59fbb', accent: '#c07792', wall: '#9a5170', wallTop: '#c1748f', dust: '#fbd8e8', prop: '#d88a5a' },
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
    theme: { id: 'garden', pattern: 'stone', floor: '#7fae6f', accent: '#5f8f52', wall: '#44633c', wallTop: '#63895a', dust: '#bfe4a6', prop: '#6f8f4a' },
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
    theme: { id: 'roof', pattern: 'stone', floor: '#526086', accent: '#3b4767', wall: '#242c42', wallTop: '#3d4a68', dust: '#9fb0d0', prop: '#4a5470' },
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

  /* ---- the washing machines, and the room behind the first one ---- */
  const machines = [];
  const secretBoxes = [];
  let secret = null;
  if (f.machines) {
    const rm = rooms[3];

    /* Three in a row along the top of the room, on a stretch with solid rock
       behind it — otherwise a machine can end up parked in a doorway, which
       both looks wrong and quietly walls off a corridor. */
    let mx = clamp(rm.cx - 1, 1, FW - 4), my = clamp(rm.y, 1, FH - 3);
    for (let x = rm.x; x <= rm.x + rm.w - 3; x++) {
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (g[rm.y][x + i] !== '.' || g[rm.y - 1][x + i] !== '#') { ok = false; break; }
      }
      if (ok) { mx = x; my = rm.y; break; }
    }

    for (let i = 0; i < 3; i++) {
      const x = mx + i, y = my;
      g[y][x] = 'W';
      g[y + 1][x] = '.';
      machines.push({ x, y, kind: i === 0 ? 'door' : 'rat' });
    }

    /* A sealed room, dug into solid wall and joined to nothing. The only way
       in is through the first machine, which is why the flood-repair below is
       told to leave its boxes alone. */
    /* Find solid rock big enough to hollow out, with a wall left all the way
       round it so the room touches nothing. Biggest first, and it settles for
       a cupboard if that is all the floor has left. */
    const findRock = (w, h) => {
      for (let y = 2; y < FH - h - 2; y++) {
        for (let x = 2; x < FW - w - 2; x++) {
          let clear = true;
          for (let j = -1; j <= h && clear; j++) {
            for (let i = -1; i <= w && clear; i++) {
              if (g[y + j][x + i] !== '#') clear = false;
            }
          }
          if (clear) return { x, y };
        }
      }
      return null;
    };

    let spot = null, SW = 0, SH = 0;
    for (const size of [[8, 5], [7, 4], [5, 3]]) {
      spot = findRock(size[0], size[1]);
      if (spot) { SW = size[0]; SH = size[1]; break; }
    }
    if (spot) {
      for (let j = 0; j < SH; j++) {
        for (let i = 0; i < SW; i++) g[spot.y + j][spot.x + i] = '.';
      }
      /* The back of the machine you came through, to get out again. */
      g[spot.y][spot.x + 1] = 'W';
      g[spot.y + 1][spot.x + 1] = '.';
      machines.push({ x: spot.x + 1, y: spot.y, kind: 'back' });

      /* What the laundry was hiding, in a row along the back wall — as many
         as the room it found will hold. */
      const iy = spot.y + Math.min(2, SH - 1);
      let ix = spot.x + 2;
      for (const item of f.machines.secret) {
        if (ix > spot.x + SW - 2) break;
        g[iy][ix] = 'i';
        secretBoxes.push({ x: ix, y: iy, item, secret: true });
        ix += 2;
      }

      secret = { x: spot.x + 1, y: spot.y + 1 };
    }
  }

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
  boxes.push(...secretBoxes);

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
  /* The secret room's boxes are left off this list on purpose — digging a
     corridor to them is exactly what would stop them being secret. */
  for (const b of boxes) if (!b.secret) needed.push({ x: b.x, y: b.y + 1 });
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
    grid: g, rooms, lift, boxes, shrine, folk, machines, secret,
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
  /* Five dusty boxes in the cart, ten to a box. */
  boxes: [[], [], [], [], []],
  bag: {},
  tokens: 500,
  keys: 0,               // floors of the hotel the lift will admit you to
  seen: {}, caught: {},
  taken: {}, beaten: {}, shrines: {}, machines: {},
  repel: 0, steps: 0, playFrames: 0,
  started: false, finished: false,
  fade: 0, fadeDir: 0, fadeThen: null,
  lab: null,
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
      party: S.party, boxes: S.boxes, bag: S.bag, tokens: S.tokens, keys: S.keys,
      seen: S.seen, caught: S.caught, taken: S.taken, beaten: S.beaten,
      shrines: S.shrines, machines: S.machines, steps: S.steps, playFrames: S.playFrames,
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
    /* Saves from before the boxes existed kept one flat drawer; pour it into
       the new ones so nobody loses what they had handed in. */
    S.boxes = [[], [], [], [], []];
    if (d.boxes) {
      for (let i = 0; i < BOX_COUNT; i++) S.boxes[i] = (d.boxes[i] || []).slice(0, BOX_SIZE);
    } else if (d.box) {
      for (const m of d.box) {
        const room = S.boxes.find(b => b.length < BOX_SIZE);
        if (room) room.push(m);
      }
    }
    S.bag = d.bag || {};
    S.tokens = d.tokens || 0;
    S.keys = d.keys || 0;
    S.seen = d.seen || {}; S.caught = d.caught || {};
    S.taken = d.taken || {}; S.beaten = d.beaten || {};
    S.shrines = d.shrines || {};
    S.machines = d.machines || {};
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

  /* The cart mends everything, and its bottom drawer is where the hotel's
     lost property ends up — including whatever you jarred with a full
     satchel. There is one on every floor. */
  if (t === 'H') {
    listMenu({
      x: BW - 100, y: 26, w: 96, title: 'HOUSEKEEPING',
      items: [
        { label: 'REST', on: () => {
          for (const m of S.party) healMon(m);
          say(['YOU REST AGAINST THE',
            'HOUSEKEEPING CART.',
            'EVERY JAR IS FULL AGAIN.']);
        } },
        { label: 'DUSTY BOXES', right: boxTotal() + '/' + (BOX_COUNT * BOX_SIZE), on: openBox },
        { label: 'LEAVE', on: closeUI },
      ],
    });
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

  /* The three machines in the laundry. One of them is a door. */
  if (t === 'W') {
    const m = (S.map.machines || []).find(w => w.x === f.x && w.y === f.y);
    if (!m) return;

    if (m.kind === 'door') {
      say(['THE FIRST MACHINE HAS NO', 'BACK TO IT. THE DRUM IS A', 'HOLE IN THE WALL.'], () => {
        if (!S.map.secret) { say(['IT IS BRICKED UP NOW.']); return; }
        fadeTo(() => {
          S.p.x = S.map.secret.x; S.p.y = S.map.secret.y;
          S.p.dir = 0; S.p.sub = 0; S.p.moving = 0;
        });
      });
      return;
    }

    if (m.kind === 'back') {
      const out = (S.map.machines || []).find(w => w.kind === 'door');
      say(['YOU CLIMB BACK THROUGH.'], () => {
        if (!out) return;
        fadeTo(() => {
          S.p.x = out.x; S.p.y = out.y + 1;
          S.p.dir = 0; S.p.sub = 0; S.p.moving = 0;
        });
      });
      return;
    }

    /* The other two. */
    const key = S.floor + ':' + f.x + ',' + f.y;
    if (S.machines && S.machines[key]) {
      say(['THE DRUM IS EMPTY.', 'IT IS STILL WARM.']);
      return;
    }
    const spawn = FLOORS[S.floor].machines.mon;
    say(['SOMETHING IS ASLEEP IN THE',
      'DRUM. IT IS FAR TOO BIG TO',
      'BE IN THERE, AND IT IS',
      'GETTING UP.'], () => {
      startBattle({
        kind: 'wild', machine: { x: f.x, y: f.y },
        foe: [makeMon(spawn.no, spawn.lv, { shiny: rnd(40) === 0 })],
      });
    });
    return;
  }

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
  'n': 'sign', 'L': 'shrine', 'W': 'wash',
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

  /* Everybody standing about, then Max, in whatever order keeps feet in front
     of heads. */
  const actors = [];
  for (const f of S.map.folk) {
    if (f.x < t0x - 1 || f.x > t0x + VIEW_W + 1) continue;
    if (f.y < t0y - 1 || f.y > t0y + VIEW_H + 1) continue;
    actors.push({ y: f.y, draw: () => drawFolk(f, f.x * TS - camX, f.y * TS - camY) });
  }
  actors.push({ y: S.p.y, draw: () => drawMax(pp.x - camX, pp.y - camY) });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();

  /* A strip along the top saying where in the building you are. */
  const fl = FLOORS[S.floor];
  const w = textWidth(fl.label + '  ' + fl.name, 1) + 12;
  fillRect(3, 3, w, 13, UI.shadow);
  fillRect(2, 2, w, 13, UI.edge);
  fillRect(3, 3, w - 2, 11, UI.frame);
  fillRect(3, 3, w - 2, 1, UI.frameHi);
  text(fl.label + '  ' + fl.name, 7, 5, UI.panel);
}

function shadowUnder(x, y) {
  fillRect(x + 4, y + 14, 8, 2, 'rgba(20,16,30,0.30)');
}

function drawMax(x, y) {
  const dir = S.p.dir;
  const base = dir === 1 ? MAX_UP : dir === 0 ? MAX_DOWN : MAX_SIDE;
  let spr = makeSprite(base, MAX_PAL);
  if (S.p.moving) {
    const f = Math.floor(S.p.anim / 6) % 2;
    if (f) spr = walkFrame(spr, dir === 3 ? 1 : -1);
  }
  shadowUnder(x, y);
  blit(spr, x, y, dir === 2);
}

function drawFolk(f, x, y) {
  const art = f.art === 'guest' ? NPC_GUEST : f.art === 'ghost' ? NPC_GHOST : NPC_STAFF;
  const spr = makeSprite(art, NPC_PAL[f.art] || NPC_PAL.staff);
  /* The dead ones bob. It is how you tell across a dark room. */
  const bob = f.art === 'ghost' ? Math.round(Math.sin(S.t * 2 + f.x) * 1) : 0;
  if (f.art !== 'ghost') shadowUnder(x, y);
  blit(spr, x, y + bob);
  /* Staff you have not beaten yet wear a mark, so a floor reads at a glance. */
  if ((f.kind === 'boss' || f.kind === 'fight') && !f.beaten) {
    const bl = Math.sin(S.t * 4) > 0;
    fillRect(x + 6, y - 6 + (bl ? 0 : 1), 4, 4, f.kind === 'boss' ? UI.pick : UI.bad);
    fillRect(x + 6, y - 6 + (bl ? 0 : 1), 4, 1, UI.panel);
  }
}

/* --------------------------------------------------------------- dialogue box */

function drawDialog(ui) {
  panel(4, 104, BW - 8, 52);
  const start = ui.page * 3;
  for (let i = 0; i < 3; i++) {
    const line = ui.lines[start + i];
    if (line === undefined) break;
    text(line, 14, 114 + i * 13, UI.ink);
  }
  if (Math.floor(S.t * 3) % 2 === 0) {
    const x = BW - 20, y = 143;
    fillRect(x, y, 7, 2, UI.pickLo);
    fillRect(x + 1, y + 2, 5, 2, UI.pickLo);
    fillRect(x + 2, y + 4, 3, 2, UI.pickLo);
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
    case 'box': return updateBox(ui);
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
    case 'box': return drawBox(ui);
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
  const w = ui.w || 84;
  const x = ui.x === undefined ? BW - w - 4 : ui.x;
  const y = ui.y === undefined ? 4 : ui.y;
  const h = ui.items.length * 13 + (ui.title ? 26 : 14);
  panel(x, y, w, h);
  let ty = y + 8;
  if (ui.title) { text(ui.title, x + 10, ty, UI.inkSoft); ty += 13; }
  ui.items.forEach((it, i) => {
    const yy = ty + i * 13;
    if (i === ui.idx) {
      fillRect(x + 5, yy - 2, w - 10, 11, '#dce6fa');
      cursorMark(x + 6, yy, UI.pickLo);
    }
    text(it.label, x + 15, yy, UI.ink);
    if (it.right) text(it.right, x + w - 9, yy, UI.inkSoft, 1, 'right');
  });
}

function openMainMenu() {
  listMenu({
    x: BW - 88, y: 4, w: 84, title: 'MAX',
    items: [
      { label: 'ROAMINALS', on: openParty },
      { label: 'BAG', on: () => openBag(null) },
      { label: 'LEDGER', on: openLedger },
      { label: 'TRAINER', on: openTrainerCard },
      { label: 'SKIN LAB', on: () => { S.ui = null; openSkinLab('world'); } },
      { label: 'SAVE', on: () => {
        const ok = saveGame();
        say(ok ? ['THE NIGHT BOOK IS WRITTEN.', 'YOUR ROUND IS SAVED.']
               : ['THE NIGHT BOOK WILL NOT', 'TAKE ANY MORE INK.']);
      } },
      { label: 'CLOSE', on: closeUI },
    ],
  });
}

function openTrainerCard() {
  const mins = Math.floor(S.playFrames / 3600);
  say([
    'MAX, NIGHT PORTER. AGE 15.',
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
  /* Ten of them, in two columns of five. Up and down run a column, left and
     right hop across. */
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (d === 'left' || d === 'right') {
    const other = ui.idx < 5 ? ui.idx + 5 : ui.idx - 5;
    if (other < S.party.length) ui.idx = other;
  }

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

/* Health colour says how worried to be without reading a number. */
function hpColour(cur, max) {
  const f = cur / Math.max(1, max);
  return f > 0.5 ? UI.good : f > 0.2 ? UI.warn : UI.bad;
}

function screen(title, right) {
  fillRect(0, 0, BW, BH, '#2b3450');
  for (let y = 0; y < BH; y += 4) fillRect(0, y, BW, 1, '#313b5c');
  panel(2, 2, BW - 4, BH - 4);
  fillRect(6, 6, BW - 12, 13, UI.frame);
  fillRect(6, 6, BW - 12, 1, UI.frameHi);
  text(title, 11, 8, UI.panel);
  if (right) text(right, BW - 11, 8, UI.panel, 1, 'right');
}

function drawParty(ui) {
  screen(ui.pick ? 'CHOOSE A ROAMINAL' : 'YOUR ROAMINALS',
    S.party.length + '/' + MAX_PARTY);
  if (!S.party.length) text('THE SATCHEL IS EMPTY.', 12, 30, UI.ink);

  /* Two columns of five. */
  S.party.forEach((m, i) => {
    const x = 5 + (i < 5 ? 0 : 116);
    const y = 22 + (i % 5) * 25;
    const sp = spec(m.no);
    if (i === ui.idx) {
      fillRect(x, y - 2, 114, 24, '#dce6fa');
      fillRect(x, y - 2, 114, 1, UI.frameHi);
      fillRect(x, y + 21, 114, 1, UI.pickLo);
      cursorMark(x + 1, y + 7, UI.pickLo);
    }
    drawCreature(sp, x + 8, y, 1, m.shiny, S.t);
    text(sp.name, x + 27, y, m.hp > 0 ? UI.ink : UI.bad);
    if (m.shiny) text('*', x + 27 + textWidth(sp.name, 1) + 3, y, UI.pickLo);
    text('L' + m.lv, x + 111, y, UI.ink, 1, 'right');
    typeBadge(sp.type, x + 27, y + 10);
    meter(x + 76, y + 12, 35, m.hp, monMaxHp(m), hpColour(m.hp, monMaxHp(m)));
  });
  text('A: LOOK   B: BACK', 8, BH - 12, UI.inkSoft);
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
  screen('NO ' + String(sp.no).padStart(3, '0'), sp.rarity);

  fillRect(10, 24, 56, 56, '#1e2740');
  fillRect(11, 25, 54, 54, TYPE_RAMP[sp.type][3]);
  drawCreature(sp, 14, 28, 3, m.shiny, S.t);

  text(sp.name, 74, 26, UI.ink);
  if (m.shiny) text('SHINY COAT', 74, 36, UI.pickLo);
  typeBadge(sp.type, 74, 46);
  text('LEVEL ' + m.lv, 140, 48, UI.ink);

  text('HP', 74, 62, UI.inkSoft);
  meter(88, 62, 80, m.hp, monMaxHp(m), hpColour(m.hp, monMaxHp(m)));
  text(m.hp + '/' + monMaxHp(m), 172, 62, UI.ink);

  const need = xpForLevel(m.lv + 1) - xpForLevel(m.lv);
  const has = m.xp - xpForLevel(m.lv);
  text('XP', 74, 72, UI.inkSoft);
  meter(88, 72, 80, clamp(has, 0, need), Math.max(1, need), '#5a9cf0');

  text('ATK ' + monAtk(m), 12, 86, UI.ink);
  text('DEF ' + monDef(m), 74, 86, UI.ink);
  text('SPD ' + monSpd(m), 136, 86, UI.ink);

  fillRect(10, 96, BW - 20, 1, '#c8cfe0');
  m.moves.forEach((mv, i) => {
    const x = 12 + (i % 2) * 112, y = 102 + (i >> 1) * 16;
    const ramp = TYPE_RAMP[MOVES[mv.k].t];
    fillRect(x, y, 4, 9, ramp[1]);
    text(mv.k, x + 8, y + 1, UI.ink);
    text(mv.pp + '/' + mv.max, x + 104, y + 1, UI.inkSoft, 1, 'right');
  });
  text(sp.ev ? 'EVOLVES AT LEVEL ' + sp.ev[0] : 'THIS IS AS FAR AS IT GOES',
    12, BH - 13, UI.inkSoft);
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
  const opts = {
    pick: (i, m) => {
      if (it.kind === 'heal') {
        if (m.hp >= monMaxHp(m)) { say(['IT IS ALREADY FULL.'], () => openBag(inBattle)); return; }
        const before = m.hp;
        m.hp = Math.min(monMaxHp(m), m.hp + it.amount);
        bagTake(name);
        const done = () => { S.ui = null; if (inBattle) battleAfterItem(); };
        say([monName(m) + ' TOOK THE ' + name + '.', 'IT MENDED ' + (m.hp - before) + ' HP.'], done);
      } else if (it.kind === 'cure') {
        bagTake(name);
        m.rattled = 0;
        const done = () => { S.ui = null; if (inBattle) battleAfterItem(); };
        say([monName(m) + ' SETTLES DOWN.'], done);
      } else if (it.kind === 'level') {
        bagTake(name);
        gainXp(m, Math.max(1, xpForLevel(m.lv + 1) - m.xp), lines => {
          say(lines.length ? lines : ['NOTHING CHANGED.'], () => { S.ui = null; });
        });
      }
    },
    back: () => openBag(inBattle),
  };
  openParty(opts);
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
  screen('BAG', S.tokens + ' TOKENS');
  const items = bagList();
  if (!items.length) text('NOTHING BUT LINT.', 12, 30, UI.ink);
  const view = 8;
  const start = clamp(ui.idx - 4, 0, Math.max(0, items.length - view));
  for (let i = 0; i < Math.min(view, items.length); i++) {
    const idx = start + i;
    const name = items[idx];
    const y = 24 + i * 12;
    if (idx === ui.idx) {
      fillRect(8, y - 2, 150, 11, '#dce6fa');
      cursorMark(9, y, UI.pickLo);
    }
    text(name, 18, y, UI.ink);
    text('x' + S.bag[name], 152, y, UI.inkSoft, 1, 'right');
  }
  fillRect(10, 122, BW - 20, 1, '#c8cfe0');
  const sel = items[ui.idx];
  if (sel) {
    const words = ITEMS[sel].info.split(' ');
    let line = '', ln = 0;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 37) { text(line, 12, 128 + ln * 11, UI.ink); line = w; ln++; }
      else line = (line + ' ' + w).trim();
    }
    text(line, 12, 128 + ln * 11, UI.ink);
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
  if (d === 'left') ui.idx = clamp(ui.idx - 8, 0, 43);
  if (d === 'right') ui.idx = clamp(ui.idx + 8, 0, 43);
  if (hit.a) ui.detail = true;
  else if (hit.b) S.ui = null;
}

function drawLedger(ui) {
  const no = ui.idx + 1;
  const sp = spec(no);
  const seen = S.seen[no], caught = S.caught[no];

  if (ui.detail) {
    screen('LEDGER  NO ' + String(no).padStart(3, '0'), sp.rarity);
    fillRect(10, 24, 56, 56, '#1e2740');
    fillRect(11, 25, 54, 54, seen ? TYPE_RAMP[sp.type][3] : '#333c58');
    if (seen) drawCreature(sp, 14, 28, 3, false, S.t);
    else blitSolid(makeSprite(BODY[sp.family]), 14, 28, '#4c5878', 3);

    text(seen ? sp.name : '- - - - - -', 74, 26, UI.ink);
    if (seen) typeBadge(sp.type, 74, 38);
    text(caught ? 'IN YOUR JARS' : seen ? 'SEEN, NOT HELD' : 'NOT MET',
      74, 52, caught ? UI.good : UI.inkSoft);
    if (seen) {
      text('HP ' + sp.b[0] + '   ATK ' + sp.b[1], 74, 64, UI.ink);
      text('DEF ' + sp.b[2] + '   SPD ' + sp.b[3], 74, 74, UI.ink);
      fillRect(10, 88, BW - 20, 1, '#c8cfe0');
      text('STAGE ' + sp.stage + ' OF ITS LINE', 12, 94, UI.inkSoft);
      text(sp.ev ? 'EVOLVES AT LEVEL ' + sp.ev[0] : 'FULLY GROWN', 12, 106, UI.inkSoft);
      text('THE GHOST IN IT POSSESSED', 12, 118, UI.inkSoft);
      text('A ' + sp.thing.toUpperCase() + '.', 12, 130, UI.ink);
    } else {
      text('THE PAGE IS BLANK.', 74, 66, UI.inkSoft);
    }
    text('< >  A: CLOSE', BW - 12, BH - 13, UI.inkSoft, 1, 'right');
    return;
  }

  screen('LEDGER', Object.keys(S.caught).length + '/44 HELD');
  const view = 9;
  const start = clamp(ui.idx - 4, 0, 44 - view);
  for (let i = 0; i < view; i++) {
    const n = start + i + 1;
    const s = spec(n);
    const y = 24 + i * 13;
    if (n - 1 === ui.idx) {
      fillRect(8, y - 2, BW - 16, 12, '#dce6fa');
      cursorMark(9, y, UI.pickLo);
    }
    text(String(n).padStart(3, '0'), 18, y, UI.inkSoft);
    text(S.seen[n] ? s.name : '- - - - - -', 44, y, S.seen[n] ? UI.ink : UI.inkSoft);
    if (S.seen[n]) typeBadge(s.type, 130, y - 1);
    if (S.caught[n]) text('HELD', BW - 18, y, UI.good, 1, 'right');
  }
  text('A: PAGE   B: BACK', 12, BH - 13, UI.inkSoft);
}

/* -------------------------------------------------------------------- shop */

function openShop() { S.ui = { kind: 'shop', idx: 0 }; }

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
    say([name + ' DROPS INTO THE TRAY.', '-' + cost + ' TOKENS.'], openShop);
    return;
  }
  if (hit.b) S.ui = null;
}

function drawShop(ui) {
  screen('VENDING MACHINE', S.tokens + ' TOKENS');
  SHOP_STOCK.forEach((name, i) => {
    const y = 26 + i * 14;
    if (i === ui.idx) {
      fillRect(8, y - 3, BW - 16, 13, '#dce6fa');
      cursorMark(9, y, UI.pickLo);
    }
    text(name, 18, y, UI.ink);
    const cost = ITEMS[name].cost;
    text(cost, BW - 18, y, S.tokens >= cost ? UI.ink : UI.bad, 1, 'right');
  });
  fillRect(10, 116, BW - 20, 1, '#c8cfe0');
  text(ITEMS[SHOP_STOCK[ui.idx]].info, 12, 124, UI.ink);
  text('A: BUY    B: LEAVE', 12, BH - 13, UI.inkSoft);
}

/* --------------------------------------------------------- lost property */
/* Jar something with a full satchel and it ends up in here. Two columns: what
   you are carrying on the left, what the hotel is holding for you on the
   right. Left and right move between them, A moves the creature under the
   cursor to the other side. */

const BOX_NAMES = ['DUSTY BOX 1', 'DUSTY BOX 2', 'DUSTY BOX 3', 'DUSTY BOX 4', 'DUSTY BOX 5'];

function boxTotal() { return S.boxes.reduce((n, b) => n + b.length, 0); }
function firstFreeBox() { return S.boxes.find(b => b.length < BOX_SIZE) || null; }

function openBox() {
  S.ui = { kind: 'box', side: 0, idx: 0, box: 0, msg: '', msgT: 0 };
}

function boxToast(ui, m) { ui.msg = m; ui.msgT = 110; }

/* Both halves are a five by two grid of slots, so the cursor moves the same
   way on either side and crossing between them is just walking off the edge. */
function updateBox(ui) {
  if (ui.msgT > 0) ui.msgT--;
  const list = ui.side === 0 ? S.party : S.boxes[ui.box];
  const d = menuDir();
  let col = ui.idx % 5, row = (ui.idx / 5) | 0;

  if (d === 'left') {
    if (col > 0) col--;
    else { ui.side ^= 1; col = 4; }
  }
  if (d === 'right') {
    if (col < 4) col++;
    else { ui.side ^= 1; col = 0; }
  }
  if (d === 'up') row = row === 0 ? 1 : 0;
  if (d === 'down') row = row === 1 ? 0 : 1;
  if (d) ui.idx = row * 5 + col;

  /* START walks along the shelf of boxes. */
  if (hit.start) {
    ui.box = (ui.box + 1) % BOX_COUNT;
    ui.side = 1;
    boxToast(ui, BOX_NAMES[ui.box]);
    return;
  }

  if (hit.a) {
    const here = ui.side === 0 ? S.party : S.boxes[ui.box];
    const m = here[ui.idx];
    if (!m) { boxToast(ui, 'NOTHING IN THAT SLOT.'); return; }
    if (ui.side === 1) {
      if (S.party.length >= MAX_PARTY) { boxToast(ui, 'THE SATCHEL IS FULL.'); return; }
      S.boxes[ui.box].splice(ui.idx, 1);
      S.party.push(m);
      boxToast(ui, monName(m) + ' IS IN THE SATCHEL.');
    } else {
      /* You are never allowed to walk out of here with nothing. */
      if (S.party.length <= 1) { boxToast(ui, 'YOU CANNOT BOX YOUR LAST ONE.'); return; }
      const room = S.boxes[ui.box].length < BOX_SIZE ? S.boxes[ui.box] : firstFreeBox();
      if (!room) { boxToast(ui, 'EVERY BOX IS FULL.'); return; }
      S.party.splice(ui.idx, 1);
      room.push(m);
      boxToast(ui, monName(m) + ' IS IN A BOX.');
    }
    saveGame();
    return;
  }
  if (hit.b) { S.ui = null; }
}

/* One slot: the creature, or an empty dusty square. */
function boxSlot(m, x, y, on) {
  fillRect(x, y, 21, 21, on ? '#dce6fa' : '#e8ecf6');
  fillRect(x, y, 21, 1, on ? UI.pick : '#c8cfe0');
  fillRect(x, y + 20, 21, 1, '#c8cfe0');
  if (m) {
    drawCreature(spec(m.no), x + 3, y + 3, 1, m.shiny, S.t);
    if (m.hp <= 0) fillRect(x + 1, y + 1, 19, 19, 'rgba(224,88,72,0.30)');
  } else {
    fillRect(x + 8, y + 9, 5, 3, '#c8cfe0');
  }
  if (on) {
    fillRect(x - 1, y - 1, 23, 2, UI.pickLo);
    fillRect(x - 1, y + 20, 23, 2, UI.pickLo);
    fillRect(x - 1, y - 1, 2, 23, UI.pickLo);
    fillRect(x + 20, y - 1, 2, 23, UI.pickLo);
  }
}

function boxGrid(list, x, y, live, ui) {
  for (let i = 0; i < BOX_SIZE; i++) {
    const cx2 = x + (i % 5) * 22, cy = y + ((i / 5) | 0) * 22;
    boxSlot(list[i], cx2, cy, live && i === ui.idx);
  }
}

function drawBox(ui) {
  screen('THE CART', 'HELD ' + boxTotal() + '/' + (BOX_COUNT * BOX_SIZE));

  fillRect(6, 22, 110, 10, ui.side === 0 ? UI.frame : '#3a4668');
  text('SATCHEL ' + S.party.length + '/' + MAX_PARTY, 11, 24, UI.panel);
  fillRect(124, 22, 110, 10, ui.side === 1 ? UI.frame : '#3a4668');
  text(BOX_NAMES[ui.box] + '  ' + S.boxes[ui.box].length + '/' + BOX_SIZE, 129, 24, UI.panel);

  boxGrid(S.party, 6, 34, ui.side === 0, ui);
  boxGrid(S.boxes[ui.box], 124, 34, ui.side === 1, ui);

  /* Which of the five you are looking at. */
  for (let i = 0; i < BOX_COUNT; i++) {
    const x = 124 + i * 12;
    fillRect(x, 80, 10, 4, i === ui.box ? UI.pickLo : '#c8cfe0');
  }

  /* A readout for whatever the cursor is on. */
  const m = (ui.side === 0 ? S.party : S.boxes[ui.box])[ui.idx];
  fillRect(6, 88, 228, 1, '#c8cfe0');
  if (m) {
    const sp = spec(m.no);
    drawCreature(sp, 10, 94, 2, m.shiny, S.t);
    text(sp.name, 50, 94, m.hp > 0 ? UI.ink : UI.bad);
    if (m.shiny) text('*', 50 + textWidth(sp.name, 1) + 4, 94, UI.pickLo);
    typeBadge(sp.type, 50, 105);
    text('L' + m.lv, 120, 94, UI.ink);
    text('NO ' + String(sp.no).padStart(3, '0'), 150, 94, UI.inkSoft);
    meter(120, 108, 100, m.hp, monMaxHp(m), hpColour(m.hp, monMaxHp(m)));
    text(m.hp + '/' + monMaxHp(m), 232, 118, UI.inkSoft, 1, 'right');
  } else {
    text('EMPTY SLOT', 10, 96, UI.inkSoft);
  }

  if (ui.msgT > 0) text(ui.msg, 8, BH - 13, UI.pickLo);
  else text('A: MOVE IT ACROSS   START: NEXT BOX   B: DONE', 8, BH - 13, UI.inkSoft);
}

/* ------------------------------------------------------------------ the lift */

function openElevator() { S.ui = { kind: 'elevator', idx: S.floor }; }

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
  const rows = top + 1;
  const h = rows * 12 + 30;
  const y0 = clamp(80 - h / 2, 4, BH - h - 4);
  const x = 66, w = 108;
  panel(x, y0, w, h);
  fillRect(x + 4, y0 + 4, w - 8, 12, UI.frame);
  fillRect(x + 4, y0 + 4, w - 8, 1, UI.frameHi);
  text('THE LIFT', x + 9, y0 + 6, UI.panel);
  for (let i = 0; i <= top; i++) {
    const y = y0 + 20 + i * 12;
    if (i === ui.idx) {
      fillRect(x + 5, y - 2, w - 10, 11, '#dce6fa');
      cursorMark(x + 6, y, UI.pickLo);
    }
    text(FLOORS[i].label, x + 15, y, i === S.floor ? UI.pickLo : UI.ink);
    text(FLOORS[i].name, x + 33, y, i === S.floor ? UI.inkSoft : UI.ink);
  }
  if (S.keys < FLOORS.length - 1) {
    text('LOCKED ABOVE', x + 15, y0 + 20 + rows * 12, UI.inkSoft);
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

function drawFade() {
  if (S.fade <= 0) return;
  bx.save();
  bx.globalAlpha = clamp(S.fade, 0, 1);
  fillRect(0, 0, BW, BH, '#0b0f1c');
  bx.restore();
}

/* ============================================================================
   THE SKIN LAB
   Repaint Max, and repaint anything in your satchel.

   Two things can be changed. A COLOUR is a slot in a ramp — swap Max's hoodie
   from blue to red and every sprite drawn from that palette changes with it,
   because the art was never storing colours in the first place. A PIXEL is a
   cell in Max's own 16x16 grid, painted with one of his seven slots, which is
   how you give him a fringe or take his headphones off.

   Creatures are colour-only on purpose: the forty-four share sixteen animal
   grids between them, so painting a possum pixel would paint every possum in
   the line. Their coats are theirs alone, and those you can do anything to.
   ========================================================================== */

/* The colour strip: six greys and eleven hues in four steps each. Built rather
   than written out, so it stays one line of intent instead of sixty of hex. */
const SWATCHES = (() => {
  const list = ['#ffffff', '#d0d0d0', '#989898', '#606060', '#303030', '#0a0a0a'];
  const hues = [0, 20, 40, 60, 95, 150, 180, 205, 230, 265, 300, 330];
  for (const h of hues) {
    for (const sl of [[0.85, 0.78], [0.85, 0.62], [0.80, 0.46], [0.75, 0.30], [0.70, 0.18]]) {
      list.push(hslHex(h, sl[0], sl[1]));
    }
  }
  return list;
})();

function nearestSwatch(hex) {
  const want = hexRgb(hex);
  let best = 0, bestD = 1e9;
  for (let i = 0; i < SWATCHES.length; i++) {
    const c = hexRgb(SWATCHES[i]);
    const d = (c[0] - want[0]) ** 2 + (c[1] - want[1]) ** 2 + (c[2] - want[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* Whole looks, for anybody who does not want to pick seven colours by hand. */
const MAX_PRESETS = [
  { name: 'NIGHT PORTER', pal: ['#171128', '#f4c79a', '#c68a5e', '#4a7ccc', '#2c4c94', '#7a4a2a', '#f8d05c'] },
  { name: 'LOST PROPERTY', pal: ['#1a1020', '#f0c49a', '#c08a5e', '#c8402c', '#8f2a20', '#e8c060', '#f4f0e0'] },
  { name: 'BOILER ROOM', pal: ['#180f0c', '#c08050', '#8a5630', '#e07828', '#a04c14', '#2a1c14', '#f8d05c'] },
  { name: 'LAUNDRY', pal: ['#1c2028', '#f6d6b4', '#c8a078', '#e8eef4', '#b0bcc8', '#4a4038', '#8fd0e8'] },
  { name: 'VELVET SUITE', pal: ['#180f24', '#f0c8a8', '#bc9068', '#7a44b8', '#4e2880', '#e8e0f0', '#f0c85c'] },
  { name: 'CONSERVATORY', pal: ['#0f1c10', '#e8c49c', '#b48a60', '#4a9c48', '#2c6830', '#3a2a18', '#f0e0a0'] },
  { name: 'THIRSTY BEAR', pal: ['#1a120c', '#f0c49a', '#bc8c60', '#96663f', '#5c3b21', '#241a12', '#7ce6ff'] },
  { name: 'MIDNIGHT', pal: ['#0a0c1a', '#d8c8f0', '#a08cc0', '#2a3060', '#161a3a', '#c8b0e8', '#f4f7ff'] },
];

const MON_SLOTS = ['HIGHLIGHT', 'COAT', 'SHADOW', 'OUTLINE'];

/* ------------------------------------------------------------------ storage */

const SKIN_KEY = 'roaminals-skins-v1';
const SKIN_ART = 2;      // bumped whenever Max is redrawn

function saveSkins() {
  try {
    localStorage.setItem(SKIN_KEY, JSON.stringify({
      v: 1, art: SKIN_ART, max: SKINS.max, grids: SKINS.grids, mons: SKINS.mons,
    }));
    return true;
  } catch (e) { return false; }
}

function loadSkins() {
  try {
    const d = JSON.parse(localStorage.getItem(SKIN_KEY));
    if (!d) return false;
    SKINS.max = d.max || null;
    /* Pixels painted onto an older drawing of Max would land in the wrong
       places on this one, so a redraw drops the paint and keeps the colours. */
    SKINS.grids = d.art === SKIN_ART ? (d.grids || null) : null;
    SKINS.mons = d.mons || {};
    applySkins();
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------- opening */

function labSubjects() {
  const list = [{ kind: 'max', name: 'MAX' }];
  for (let i = 0; i < S.party.length; i++) {
    list.push({ kind: 'mon', no: S.party[i].no, idx: i, name: monName(S.party[i]) });
  }
  /* Nothing caught yet — let them play with the three they are about to
     choose between, so the lab is never an empty room. */
  if (S.party.length === 0) {
    for (const no of STARTERS) list.push({ kind: 'mon', no, name: spec(no).name });
  }
  return list;
}

function openSkinLab(back) {
  S.lab = {
    back: back || 'title',
    subjects: labSubjects(), subject: 0,
    row: 0, preset: 0, face: 'DOWN',
    painter: null, cx: 8, cy: 8, tool: 1,
    toast: '', toastT: 0,
  };
  S.mode = 'skinlab';
}

function labSubject() { return S.lab.subjects[S.lab.subject]; }

/* The ramp the lab is currently pointed at. Max's is the live palette itself;
   a creature's is its override, made on first touch from the family coat. */
function labRamp() {
  const sub = labSubject();
  if (sub.kind === 'max') return MAX_PAL;
  if (!SKINS.mons[sub.no]) {
    const fam = FAMILY[spec(sub.no).family] || FAMILY.possum;
    SKINS.mons[sub.no] = fam.coat.slice();
  }
  return SKINS.mons[sub.no];
}

function labSlots() {
  return labSubject().kind === 'max' ? MAX_SLOTS : MON_SLOTS;
}

function labToast(msg) { S.lab.toast = msg; S.lab.toastT = 90; }

function labCommit() {
  const sub = labSubject();
  if (sub.kind === 'max') {
    SKINS.max = MAX_PAL.slice();
    walkCache.clear();
  }
  saveSkins();
}

/* -------------------------------------------------------------------- update */

function updateSkinLab() {
  const L = S.lab;
  if (L.toastT > 0) L.toastT--;
  if (L.painter) return updatePainter();

  const isMax = labSubject().kind === 'max';
  const d = menuDir();
  /* Row 0 is the preset row, then one row per colour, then — for Max — the
     row that says which way he is facing when you go in to paint him. A
     creature has three fewer rows than Max, so the cursor is pulled back up
     whenever it would be left pointing past the end of the list. */
  const faceRow = isMax ? labSlots().length + 1 : -1;
  const rows = labSlots().length + (isMax ? 2 : 1);
  if (L.row >= rows) L.row = rows - 1;
  if (d === 'up') L.row = (L.row + rows - 1) % rows;
  if (d === 'down') L.row = (L.row + 1) % rows;

  if (d === 'left' || d === 'right') {
    const step = d === 'left' ? -1 : 1;
    if (L.row === faceRow) {
      const order = ['DOWN', 'UP', 'SIDE'];
      L.face = order[(order.indexOf(L.face) + step + 3) % 3];
    } else if (L.row === 0) {
      if (labSubject().kind === 'max') {
        L.preset = (L.preset + step + MAX_PRESETS.length) % MAX_PRESETS.length;
        const pal = MAX_PRESETS[L.preset].pal;
        for (let i = 0; i < MAX_PAL.length; i++) MAX_PAL[i] = pal[i];
        labToast(MAX_PRESETS[L.preset].name);
      } else {
        /* A creature's presets are the ten type ramps — the fastest way to
           make something look like it was possessed by a different object. */
        L.preset = (L.preset + step + WHEEL.length) % WHEEL.length;
        const ramp = TYPE_RAMP[WHEEL[L.preset]];
        const live = labRamp();
        for (let i = 0; i < 4; i++) live[i] = ramp[i];
        labToast(WHEEL[L.preset] + ' RAMP');
      }
      labCommit();
    } else {
      const ramp = labRamp();
      const i = L.row - 1;
      const at = nearestSwatch(ramp[i]);
      ramp[i] = SWATCHES[(at + step + SWATCHES.length) % SWATCHES.length];
      labCommit();
    }
    return;
  }

  if (hit.start) {
    L.subject = (L.subject + 1) % L.subjects.length;
    L.row = 0; L.preset = 0;
    return;
  }

  if (hit.a) {
    if (isMax) {
      L.painter = L.face; L.cx = 8; L.cy = 8; L.tool = 1;
    } else {
      labToast('COLOURS ONLY - THEY SHARE GRIDS');
    }
    return;
  }

  if (hit.b) {
    labCommit();
    S.lab = null;
    S.mode = L.back;
    if (S.mode === 'title') toTitle();
    return;
  }
}

function updatePainter() {
  const L = S.lab;
  const grid = MAX_GRIDS[L.painter];
  const d = menuDir();
  if (d === 'left') L.cx = (L.cx + 15) % 16;
  if (d === 'right') L.cx = (L.cx + 1) % 16;
  if (d === 'up') L.cy = (L.cy + 15) % 16;
  if (d === 'down') L.cy = (L.cy + 1) % 16;

  /* Four buttons: START steps the colour you are painting with — the last one
     along is the rubber — A paints, and B is the way out. Which way Max is
     facing was chosen on the way in. */
  if (hit.start) L.tool = (L.tool + 1) % (MAX_PAL.length + 1);
  if (hit.b) { L.painter = null; labCommit(); return; }

  const paint = (ch) => {
    const row = grid[L.cy];
    if (row[L.cx] === ch) return;
    grid[L.cy] = row.slice(0, L.cx) + ch + row.slice(L.cx + 1);
    invalidateSprite(grid);
    walkCache.clear();
    if (!SKINS.grids) SKINS.grids = {};
    SKINS.grids[L.painter] = grid.slice();
    saveSkins();
  };

  /* Held, not tapped, so you can draw a line by walking the cursor along it. */
  if (keys.a) paint(L.tool >= MAX_PAL.length ? '.' : String(L.tool));
}

/* --------------------------------------------------------------------- draw */

function labHeader(title, right) {
  fillRect(0, 0, BW, 15, UI.frame);
  fillRect(0, 0, BW, 1, UI.frameHi);
  fillRect(0, 15, BW, 1, UI.edge);
  text(title, 8, 4, UI.panel);
  if (right) text(right, BW - 8, 4, UI.pick, 1, 'right');
}

function drawSkinLab() {
  const L = S.lab;
  if (L.painter) return drawPainter();

  fillRect(0, 0, BW, BH, '#2b3450');
  for (let y = 16; y < BH; y += 4) fillRect(0, y, BW, 1, '#313b5c');
  labHeader('SKIN LAB', labSubject().name);

  /* ---- the subject ---- */
  panel(4, 19, 88, 92);
  const sub = labSubject();
  if (sub.kind === 'max') {
    fillRect(12, 25, 72, 68, '#1e2740');
    blit(makeSprite(MAX_GRIDS.DOWN, MAX_PAL), 24, 27, false, 4);
    blit(makeSprite(MAX_GRIDS.SIDE, MAX_PAL), 14, 95, false, 1);
    blit(makeSprite(MAX_GRIDS.DOWN, MAX_PAL), 36, 95, false, 1);
    blit(makeSprite(MAX_GRIDS.UP, MAX_PAL), 58, 95, false, 1);
  } else {
    const sp = spec(sub.no);
    fillRect(12, 25, 72, 72, TYPE_RAMP[sp.type][3]);
    drawCreature(sp, 16, 29, 4, false, S.t);
    text(sp.type, 48, 99, UI.inkSoft, 1, 'center');
  }

  /* ---- the slots ---- */
  panel(96, 19, 140, 92);
  const slots = labSlots(), ramp = labRamp();
  const presetName = sub.kind === 'max'
    ? MAX_PRESETS[L.preset].name : WHEEL[L.preset] + ' RAMP';

  const isMax = sub.kind === 'max';
  const faceRow = isMax ? slots.length + 1 : -1;
  const lastRow = slots.length + (isMax ? 1 : 0);
  if (L.row > lastRow) L.row = lastRow;

  for (let r = 0; r <= lastRow; r++) {
    const y = 25 + r * 11;
    const on = r === L.row;
    if (on) {
      fillRect(100, y - 2, 132, 11, '#dce6fa');
      cursorMark(101, y, UI.pickLo);
    }
    if (r === faceRow) {
      text('PAINT', 110, y, UI.ink);
      text(L.face, 232, y, on ? UI.ink : UI.inkSoft, 1, 'right');
    } else if (r === 0) {
      text('PRESET', 110, y, UI.ink);
      text(presetName, 232, y, on ? UI.ink : UI.inkSoft, 1, 'right');
    } else {
      const colour = ramp[r - 1];
      fillRect(110, y - 1, 10, 9, UI.edge);
      fillRect(111, y, 8, 7, colour);
      text(slots[r - 1], 124, y, UI.ink);
      text(colour.toUpperCase(), 232, y, UI.inkSoft, 1, 'right');
    }
  }

  /* ---- the colour strip ---- */
  panel(4, 114, BW - 8, 42);
  if (L.row === faceRow) {
    text('LEFT AND RIGHT TURN HIM ROUND', 14, 122, UI.ink);
  } else if (L.row === 0) {
    text('LEFT AND RIGHT TRY A WHOLE LOOK', 14, 122, UI.ink);
  } else {
    const cur = nearestSwatch(ramp[L.row - 1] || ramp[0]);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const idx = (cur - 7 + i + SWATCHES.length * 2) % SWATCHES.length;
      const x = 14 + i * 15;
      fillRect(x, 120, 13, 14, SWATCHES[idx]);
      if (i === 7) {
        fillRect(x - 2, 118, 17, 2, UI.pick);
        fillRect(x - 2, 134, 17, 2, UI.pick);
        fillRect(x - 2, 118, 2, 18, UI.pick);
        fillRect(x + 13, 118, 2, 18, UI.pick);
      }
    }
  }

  if (L.toastT > 0) {
    text(L.toast, BW / 2, 140, UI.pickLo, 1, 'center');
  } else {
    text(sub.kind === 'max' ? 'A: PAINT PIXELS   START: WHO   B: DONE'
                            : 'START: WHO   B: DONE', BW / 2, 140, UI.inkSoft, 1, 'center');
  }
}

function drawPainter() {
  const L = S.lab;
  const grid = MAX_GRIDS[L.painter];
  fillRect(0, 0, BW, BH, '#2b3450');
  labHeader('PAINTING MAX', L.painter);

  /* The grid, eight screen pixels to the art pixel, on a checker so you can
     see which cells are see-through. */
  const gx = 6, gy = 20, cell = 8;
  fillRect(gx - 2, gy - 2, 16 * cell + 4, 16 * cell + 4, UI.edge);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = grid[y][x];
      const px2 = gx + x * cell, py = gy + y * cell;
      if (ch >= '0' && ch <= '7' && MAX_PAL[+ch]) {
        fillRect(px2, py, cell, cell, MAX_PAL[+ch]);
      } else {
        fillRect(px2, py, cell, cell, (x + y) % 2 ? '#39456e' : '#2f3a60');
      }
    }
  }
  /* The cursor, drawn as a ring so it never hides the cell under it. */
  const cxp = gx + L.cx * cell, cyp = gy + L.cy * cell;
  fillRect(cxp - 1, cyp - 1, cell + 2, 2, UI.pick);
  fillRect(cxp - 1, cyp + cell - 1, cell + 2, 2, UI.pick);
  fillRect(cxp - 1, cyp - 1, 2, cell + 2, UI.pick);
  fillRect(cxp + cell - 1, cyp - 1, 2, cell + 2, UI.pick);

  panel(140, 19, 96, 74);
  fillRect(146, 25, 62, 62, '#1e2740');
  blit(makeSprite(grid, MAX_PAL), 147, 26, false, 4);

  panel(140, 96, 96, 60);
  text('PAINT WITH', 148, 102, UI.inkSoft);
  for (let i = 0; i <= MAX_PAL.length; i++) {
    const x = 147 + i * 11, y = 112;
    fillRect(x, y, 10, 10, UI.edge);
    if (i < MAX_PAL.length) {
      fillRect(x + 1, y + 1, 8, 8, MAX_PAL[i]);
    } else {
      /* The rubber, drawn as the same checker the empty cells use. */
      fillRect(x + 1, y + 1, 8, 8, '#2f3a60');
      fillRect(x + 1, y + 1, 4, 4, '#39456e');
      fillRect(x + 5, y + 5, 4, 4, '#39456e');
    }
    if (i === L.tool) {
      fillRect(x - 1, y - 2, 12, 2, UI.pick);
      fillRect(x - 1, y + 10, 12, 2, UI.pick);
    }
  }
  text(L.tool >= MAX_PAL.length ? 'RUB OUT' : (MAX_SLOTS[L.tool] || ''), 148, 126, UI.ink);
  text('A: PAINT   START: COLOUR', 148, 136, UI.inkSoft);
  text('B: BACK TO THE LAB', 148, 146, UI.inkSoft);
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
    kind: o.kind, who: o.who || null, machine: o.machine || null,
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

/* How well a jar goes on. Health is the big lever — a creature at full
   strength still goes in a fair share of the time, and one worn down to a
   sliver almost always does — with the jar and a rattled nerve on top. */
function catchChance(m, mult) {
  const sp = spec(m.no);
  const hpPart = 1 - 0.6 * clamp(m.hp / Math.max(1, monMaxHp(m)), 0, 1);
  const p = hpPart * (sp.catchRate / 255) * mult * (m.rattled ? 1.35 : 1);
  return clamp(p, 0.08, 0.96);
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
        /* Actually kept, not quietly binned — the dusty boxes in any
           housekeeping cart will hand it back. */
        const room = firstFreeBox();
        if (room) {
          room.push(foe);
          qsay(monName(foe) + ' IS IN THE JAR!',
            'THE SATCHEL IS FULL, SO IT WENT',
            'INTO A DUSTY BOX IN THE CART.');
        } else {
          qsay(monName(foe) + ' IS IN THE JAR!',
            'BUT THE SATCHEL AND EVERY BOX',
            'ARE FULL, SO IT WRIGGLES OUT',
            'AND GOES BACK TO WORK.');
        }
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
  /* Jar whatever was in the drum and the drum is finally just a drum. */
  if (result === 'caught' && S.bt.machine) {
    S.machines[S.floor + ':' + S.bt.machine.x + ',' + S.bt.machine.y] = 1;
  }
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
  const flick = e.done ? 1 : (Math.sin(e.t * e.t * 3) > 0 ? 1 : 0);
  const sp = spec(flick ? e.to : e.from);
  const m = S.party[e.i];
  const ramp = TYPE_RAMP[sp.type];

  /* The light behind it comes up as the change takes hold. */
  fillRect(0, 0, BW, BH, darken(ramp[3], 0.4));
  const glow = clamp(e.t / 3.2, 0, 1);
  for (let i = 5; i > 0; i--) {
    const r = 18 + i * 9 * (0.5 + glow);
    fillRect(BW / 2 - r, 46 - r * 0.6, r * 2, r * 1.2,
      mix(darken(ramp[3], 0.4), ramp[1], 0.10 * (6 - i) * glow));
  }
  for (let i = 0; i < 10; i++) {
    const a = e.t * 2 + i * 0.63;
    fillRect(BW / 2 + Math.cos(a) * (40 + i * 3) - 1,
      48 + Math.sin(a) * (26 + i * 2) - 1, 2, 2, ramp[0]);
  }

  drawCreature(sp, BW / 2 - 24, 22, 3, m && m.shiny, S.t);

  panel(2, 104, BW - 4, 54);
  if (!e.done) {
    text('WHAT? SOMETHING IS', 14, 118, UI.ink);
    text('HAPPENING TO IT...', 14, 134, UI.ink);
  } else {
    text(spec(e.from).name + ' BECAME', 14, 118, UI.ink);
    text(spec(e.to).name + '!', 14, 134, UI.ink);
    if (Math.floor(S.t * 3) % 2 === 0) text('A', BW - 18, 142, UI.pickLo);
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
"3111111.3.",
"31111113..",
"31111113..",
"31111113..",
"31111113..",
"31111113..",
".3111113..",
"..3333.3..",
];
const JAR_RAMP = ['#ffffff', '#bfe8f4', '#5aa8c8', '#1b3448'];

function drawHpBox(x, y, w, m, disp, mine) {
  const h = mine ? 40 : 32;
  panel(x, y, w, h);
  const sp = spec(m.no);
  text(sp.name, x + 8, y + 7, UI.ink);
  if (m.shiny) text('*', x + 8 + textWidth(sp.name, 1) + 3, y + 7, UI.pickLo);
  text('L' + m.lv, x + w - 8, y + 7, UI.ink, 1, 'right');
  typeBadge(sp.type, x + 8, y + 17);
  meter(x + 8, y + 29, w - 16, Math.max(0, disp), monMaxHp(m),
    hpColour(disp, monMaxHp(m)));
  if (mine) {
    text(Math.max(0, Math.round(disp)) + '/' + monMaxHp(m), x + w - 8, y + h - 10,
      UI.inkSoft, 1, 'right');
  }
}

/* The room the fight happens in, coloured by the floor you are on. */
function battleBackdrop() {
  const th = resolve(themeOf(S.floor));
  fillRect(0, 0, BW, BH, darken(th.wall, 0.25));
  fillRect(0, 0, BW, 46, th.wall);
  fillRect(0, 44, BW, 2, th.wallTop);
  for (let x = 0; x < BW; x += 24) fillRect(x, 8, 2, 34, darken(th.wall, 0.3));
  fillRect(0, 46, BW, BH - 46, th.floor);
  fillRect(0, 46, BW, 2, lighten(th.floor, 0.2));
  for (let y = 54; y < BH; y += 10) {
    fillRect(0, y, BW, 1, darken(th.floor, 0.12));
  }
  /* Two ledges to stand on. */
  const pad = (cx, cy, w) => {
    fillRect(cx - w / 2, cy, w, 5, darken(th.floor, 0.3));
    fillRect(cx - w / 2 + 2, cy - 2, w - 4, 3, lighten(th.floor, 0.12));
    fillRect(cx - w / 2 + 4, cy - 3, w - 8, 2, lighten(th.floor, 0.28));
  };
  pad(176, 66, 68);
  pad(52, 102, 78);
}

function drawBattle() {
  const bt = S.bt;
  battleBackdrop();

  const foe = foeMon(), me = myMon();

  if (foe) {
    const sx = bt.shakeF > 0 ? (bt.shakeF % 4 < 2 ? 3 : -3) : 0;
    if (!bt.jar && (bt.flashF <= 0 || bt.flashF % 4 < 2)) {
      drawCreature(spec(foe.no), 152 + sx, 20, 3, foe.shiny, S.t);
    }
    drawHpBox(6, 8, 104, foe, bt.dispF, false);
  }

  if (me) {
    const sy = bt.shakeM > 0 ? (bt.shakeM % 4 < 2 ? 2 : -2) : 0;
    if (bt.flashM <= 0 || bt.flashM % 4 < 2) {
      drawCreature(spec(me.no), 28, 54 + sy, 3, me.shiny, S.t);
    }
    drawHpBox(128, 56, 106, me, bt.dispM, true);
  }

  if (bt.jar) {
    const j = bt.jar;
    const spr = makeSprite(JAR_ART, JAR_RAMP);
    const fly = Math.min(1, j.t / 26);
    const wob = j.t < 26 ? 0 : Math.round(Math.sin(j.t / 5) * 3);
    const jx = 40 + (160 - 40) * fly + wob;
    const jy = 80 - Math.sin(fly * Math.PI) * 46 - (30 * fly);
    blit(spr, jx, jy, false, 3);
  }

  /* The bottom of the screen is either what just happened, or what you do
     about it. */
  if (bt.msg) {
    panel(2, 104, BW - 4, 54);
    text(bt.msg[0] || '', 14, 118, UI.ink);
    if (bt.msg[1]) text(bt.msg[1], 14, 134, UI.ink);
    return;
  }

  if (bt.sub === 'moves' && me) {
    panel(2, 104, BW - 4, 54);
    const moves = me.moves;
    for (let i = 0; i < 4; i++) {
      const mv = moves[i];
      const x = 14 + (i % 2) * 112, y = 112 + (i >> 1) * 15;
      if (!mv) { text('-', x + 10, y, UI.inkSoft); continue; }
      if (i === bt.moveIdx) {
        fillRect(x - 2, y - 3, 106, 13, '#dce6fa');
        cursorMark(x - 1, y, UI.pickLo);
      }
      const ramp = TYPE_RAMP[MOVES[mv.k].t];
      fillRect(x + 8, y, 3, 8, ramp[1]);
      text(mv.k, x + 14, y, mv.pp > 0 ? UI.ink : UI.bad);
    }
    const sel = moves[bt.moveIdx];
    if (sel) {
      const mv = MOVES[sel.k];
      typeBadge(mv.t, 14, 142);
      text('POWER ' + (mv.pow || '-'), 80, 144, UI.inkSoft);
      text('PP ' + sel.pp + '/' + sel.max, BW - 14, 144, UI.inkSoft, 1, 'right');
    }
    return;
  }

  if (bt.sub === 'main' && me) {
    panel(2, 104, 116, 54);
    text('WHAT WILL', 14, 118, UI.ink);
    text(monName(me), 14, 132, UI.ink);
    text('DO?', 14, 146, UI.ink);
    panel(120, 104, 118, 54);
    const labels = ['FIGHT', 'BAG', 'SWAP', bt.kind === 'trainer' ? 'STAY' : 'RUN'];
    for (let i = 0; i < 4; i++) {
      const x = 138 + (i % 2) * 54, y = 118 + (i >> 1) * 20;
      if (i === bt.menu) {
        fillRect(x - 10, y - 4, 50, 15, '#dce6fa');
        cursorMark(x - 9, y, UI.pickLo);
      }
      text(labels[i], x, y, UI.ink);
    }
    return;
  }

  panel(2, 104, BW - 4, 54);
  text('...', 14, 120, UI.inkSoft);
}

/* ------------------------------------------------------------------- title */

const TITLE_LINES = [
  'THE ROTHSAY GRAND HOTEL. CLOSED FORTY YEARS.',
  '',
  'THE GHOSTS COULD NOT STAY GHOSTS, SO EACH ONE',
  'MOVED INTO SOMETHING SOLID: A MOP, A BOILER,',
  'A LEDGER, A BELL.',
  '',
  'THEN THE OBJECTS MOVED INTO THE ANIMALS THAT',
  'CAME IN OUT OF THE COLD. THAT IS A ROAMINAL.',
  '',
  'YOU ARE MAX. FIFTEEN, AND THE ONLY APPLICANT',
  'FOR NIGHT PORTER.',
  '',
  'YOU GET A SATCHEL OF JARS, A LIFT THAT ONLY',
  'STOPS WHERE YOU HAVE A KEY, AND TEN FLOORS.',
];

function drawTitle() {
  const t = S.t;
  /* Night sky over the hotel, with one window still lit. */
  fillRect(0, 0, BW, BH, '#141a34');
  for (let i = 0; i < 40; i++) {
    const r = mulberry(i * 71 + 3);
    const x = Math.floor(r() * BW), y = Math.floor(r() * 70);
    if ((i + Math.floor(t * 2)) % 7) fillRect(x, y, 1, 1, '#5a6a9c');
  }
  fillRect(0, 96, BW, BH - 96, '#1d2444');
  fillRect(40, 40, 160, 60, '#26304f');
  fillRect(40, 40, 160, 2, '#38446c');
  for (let wy = 46; wy < 96; wy += 12) {
    for (let wx = 48; wx < 194; wx += 14) {
      const lit = ((wx * 7 + wy * 13) % 11) === 0;
      fillRect(wx, wy, 8, 7, lit ? '#f8d05c' : '#1a2140');
    }
  }
  drawCreature(spec(44), BW / 2 - 24, 44 + Math.round(Math.sin(t) * 2), 3, false, t);

  textShadow('ROAMINALS', BW / 2, 12, '#f8f0d0', 3, 'center');
  fillRect(BW / 2 - 78, 34, 156, 1, '#f8d05c');
  textShadow('THE ROTHSAY GRAND', BW / 2, 100, '#c8d4f0', 1, 'center');

  const ui = S.titleUI;
  const h = ui.items.length * 14 + 12;
  panel(BW / 2 - 52, 112, 104, h);
  ui.items.forEach((it, i) => {
    const y = 119 + i * 14;
    if (i === ui.idx) {
      fillRect(BW / 2 - 47, y - 3, 94, 13, '#dce6fa');
      cursorMark(BW / 2 - 46, y, UI.pickLo);
    }
    text(it, BW / 2 - 34, y, UI.ink);
  });
  text('THIRSTY BEAR STUDIOS', BW - 6, BH - 10, '#6a78a8', 1, 'right');
}

function updateTitle() {
  const ui = S.titleUI;
  const d = menuDir();
  const n = ui.items.length;
  if (d === 'up') ui.idx = (ui.idx + n - 1) % n;
  if (d === 'down') ui.idx = (ui.idx + 1) % n;
  if (hit.a || hit.start) {
    const chosen = ui.items[ui.idx];
    if (chosen === 'CONTINUE') { if (loadGame()) S.mode = 'world'; return; }
    if (chosen === 'NEW ROUND') { S.mode = 'intro'; S.introPage = 0; return; }
    if (chosen === 'SKIN LAB') { openSkinLab('title'); return; }
    if (chosen === 'LEDGER') { openLedger(); S.mode = 'titledex'; }
  }
}

function drawIntro() {
  fillRect(0, 0, BW, BH, '#141a34');
  panel(4, 4, BW - 8, BH - 8);
  const start = S.introPage * 7;
  for (let i = 0; i < 7; i++) {
    const line = TITLE_LINES[start + i];
    if (line === undefined) break;
    text(line, 12, 16 + i * 16, UI.ink);
  }
  if (Math.floor(S.t * 3) % 2 === 0) {
    text('A', BW - 18, BH - 20, UI.pickLo);
  }
}

function updateIntro() {
  if (hit.a || hit.start) {
    S.introPage++;
    if (S.introPage * 7 >= TITLE_LINES.length) {
      S.mode = 'starter';
      S.starter = { idx: 1 };
    }
  }
}

/* ------------------------------------------------------------- your first */

const STARTERS = [4, 19, 22];

function drawStarter() {
  fillRect(0, 0, BW, BH, '#2b3450');
  panel(2, 2, BW - 4, 96);
  fillRect(6, 6, BW - 12, 13, UI.frame);
  fillRect(6, 6, BW - 12, 1, UI.frameHi);
  text('LOST PROPERTY', 11, 8, UI.panel);
  text('THREE JARS NOBODY EVER CLAIMED.', 11, 24, UI.ink);

  STARTERS.forEach((no, i) => {
    const x = 22 + i * 70;
    const sel = i === S.starter.idx;
    const sp = spec(no);
    fillRect(x - 6, 34, 60, 60, sel ? TYPE_RAMP[sp.type][2] : '#1e2740');
    fillRect(x - 5, 35, 58, 58, sel ? TYPE_RAMP[sp.type][3] : '#252e48');
    drawCreature(sp, x, 40, 3, false, S.t);
    if (sel) {
      fillRect(x - 6, 34, 60, 2, UI.pick);
      fillRect(x - 6, 92, 60, 2, UI.pick);
    }
  });

  const sp = spec(STARTERS[S.starter.idx]);
  panel(2, 100, BW - 4, 58);
  text(sp.name, 14, 110, UI.ink);
  typeBadge(sp.type, 14, 122);
  text('LEVEL 5', 90, 124, UI.inkSoft);
  text('THE GHOST IN IT POSSESSED A ' + sp.thing.toUpperCase() + '.', 14, 138, UI.ink);
  text('< >   A: TAKE IT', BW - 14, 148, UI.inkSoft, 1, 'right');
}

function updateStarter() {
  const d = menuDir();
  if (d === 'left') S.starter.idx = (S.starter.idx + 2) % 3;
  if (d === 'right') S.starter.idx = (S.starter.idx + 1) % 3;
  if (hit.a) newGame(STARTERS[S.starter.idx]);
}

function newGame(starterNo) {
  S.party = [makeMon(starterNo, 5)];
  S.boxes = [[], [], [], [], []];
  S.seen = {}; S.caught = {};
  S.seen[starterNo] = 1; S.caught[starterNo] = 1;
  S.bag = {}; bagAdd('JAR', 5); bagAdd('POULTICE', 3);
  S.tokens = 500; S.keys = 0;
  S.taken = {}; S.beaten = {}; S.shrines = {}; S.machines = {};
  S.steps = 0; S.playFrames = 0; S.finished = false;
  S.started = true;
  enterFloor(0);
  S.mode = 'world';
  say(['ARROWS WALK. Z OR SPACE IS A:',
    'TALK, OPEN, CONFIRM. X IS B.',
    'ENTER OPENS MAX\'S MENU.',
    'THE LIFT IS THE ONLY WAY BETWEEN',
    'FLOORS, AND IT ONLY STOPS WHERE',
    'YOU HAVE A KEY.',
    'BEAT THE STAFF GHOST ON A FLOOR',
    'AND THE NEXT ONE OPENS UP.',
    'GOOD LUCK, MAX.']);
}

/* ----------------------------------------------------------------- credits */

const CREDIT_LINES = [
  'THE CLOCK IS IN A JAR.',
  '',
  'THE ROTHSAY GRAND IS QUIET FOR THE',
  'FIRST TIME SINCE THE NIGHT IT SHUT.',
  '',
  'THE STAFF STAY ON. THEY LIKE THE WORK.',
  'SO DOES MAX.',
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
  'NIGHT PORTER: MAX',
];

function drawCredits() {
  fillRect(0, 0, BW, BH, '#141a34');
  for (let i = 0; i < 30; i++) {
    const r = mulberry(i * 91 + 7);
    fillRect(Math.floor(r() * BW), Math.floor(r() * BH), 1, 1, '#3a4670');
  }
  const y0 = BH - S.credits.t * 22;
  CREDIT_LINES.forEach((l, i) => {
    const y = y0 + i * 14;
    if (y > -12 && y < BH) textShadow(l, BW / 2, y, '#f0f4ff', 1, 'center');
  });
  const end = y0 + CREDIT_LINES.length * 14;
  if (end < 50) {
    panel(BW / 2 - 60, 50, 120, 46);
    text('CAUGHT ' + Object.keys(S.caught).length + '/44', BW / 2, 62, UI.ink, 1, 'center');
    text('A: TITLE', BW / 2, 78, UI.inkSoft, 1, 'center');
  }
}

function updateCredits() {
  S.credits.t += 1 / 60;
  const end = BH - S.credits.t * 22 + CREDIT_LINES.length * 14;
  if (end < 50 && (hit.a || hit.start)) toTitle();
}

/* --------------------------------------------------------------------- loop */

function toTitle() {
  S.mode = 'title';
  S.ui = null;
  const items = hasSave() ? ['CONTINUE', 'NEW ROUND'] : ['NEW ROUND'];
  items.push('SKIN LAB');
  S.titleUI = { idx: 0, items };
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
    case 'skinlab': updateSkinLab(); break;
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
    case 'skinlab': drawSkinLab(); break;
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

/* The art book page loads this very file rather than a copy of its palettes:
   it raises a flag first, takes the drawing tools, and the game never starts.
   That way the swatches on the site can never drift from the ones the game
   actually uses. */
if (window.ROAMINALS_ART) {
  window.RoaminalsArt = {
    BW, BH, buf, bx, clear, fillRect, blit, makeSprite, drawCreature, typeBadge,
    SPECIES, spec, DEX, WHEEL, TYPE_RAMP, THING_RAMP, FAMILY, coatFor, thingFor,
    MAX_PAL, MAX_DOWN, MAX_UP, MAX_SIDE, NPC_PAL, NPC_STAFF, NPC_GUEST, NPC_GHOST,
    FLOORS, tile, resolve, MOVES, ITEMS, effect,
  };
} else {
  loadSkins();                 // whatever the skin lab was left holding
  toTitle();
  requestAnimationFrame(frame);
}

})();
