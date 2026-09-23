/* Pokémon Rip and Go — everything you can see.
 *
 * No images ship with this game. The creatures are typed out in dex.js, the
 * trainer is typed out below, and everything else — cards, shopfronts, the
 * town, the menus — is rectangles. That buys the same three things it buys
 * the rest of the demos in this folder: nothing to fetch, a flipped copy for
 * free, and palette swaps, which is how nineteen drawings cover fifty-four
 * creatures and a shiny costs nothing at all.
 *
 * Two rules the art follows, and they are why it reads at this size:
 *
 *   Everything has an outline. At sixteen pixels across, a creature without a
 *   dark edge dissolves into whatever card it is printed on.
 *
 *   Everything is lit from the top left. Highlight on the top and left edges,
 *   shade on the bottom and right — on the creatures, the cards and the town
 *   alike. Two tones and one direction beat ten colours scattered about.
 *
 * Sprites are baked once into little offscreen canvases and then blitted, so
 * a screen with thirty creatures on it is thirty drawImage calls rather than
 * seven thousand fillRects.
 *
 * One thing here is not typed out: if the player has pointed a sheet frame at
 * a creature in the Sprite Lab, that frame wins. See sprites.js.
 */
const Art = (() => {
  'use strict';

  /* ==================================================================== font */
  /* 3x5 letters, a rectangle at a time, so text lands on the same grid the art
   * does. Every word in this game is drawn with it — there is no DOM text
   * anywhere except the Sprite Lab, which is a tool rather than a game. */

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
    '>': '#..,.#.,..#,.#.,#..', '*': '#.#,.#.,#.#,...,...', '(': '..#,.#.,.#.,.#.,..#',
    ')': '#..,.#.,.#.,.#.,#..', '=': '...,###,...,###,...', '#': '#.#,###,#.#,###,#.#',
    'x': '...,#.#,.#.,#.#,...', '$': '###,##.,.#.,.##,###',
  };

  const R = Math.round;

  function width(s, sc) { sc = sc || 1; return String(s).length * 4 * sc - sc; }

  function text(g, s, x, y, colour, sc, align) {
    sc = sc || 1;
    const str = String(s).toUpperCase();
    let px = x;
    if (align === 'center') px = x - width(str, sc) / 2;
    if (align === 'right') px = x - width(str, sc);
    px = R(px); y = R(y);
    g.fillStyle = colour;
    for (const ch of str) {
      const rows = (GLYPHS[ch] || GLYPHS['?']).split(',');
      for (let ry = 0; ry < 5; ry++) {
        const row = rows[ry];
        for (let rx = 0; rx < 3; rx++) {
          if (row[rx] === '#') g.fillRect(px + rx * sc, y + ry * sc, sc, sc);
        }
      }
      px += 4 * sc;
    }
  }

  function textShadow(g, s, x, y, colour, sc, align, shade) {
    sc = sc || 1;
    text(g, s, x + sc, y + sc, shade || '#05070d', sc, align);
    text(g, s, x, y, colour, sc, align);
  }

  /* ================================================================ trainer */
  /* Twelve across, sixteen down, drawn facing right and mirrored to walk the
   * other way. Two frames a direction: the second one has the legs apart, and
   * flicking between them at walking pace is the whole animation.
   *
   *   0 outline  1 skin  2 skin, shaded  3 hair
   *   4 cap      5 shirt 6 trousers      7 white */

  const TRAINER = {
    down: [
      '............',
      '...000000...',
      '..04444440..',
      '..04444440..',
      '..00000000..',
      '..01111110..',
      '..01011010..',
      '..01111110..',
      '..05555550..',
      '.0055555500.',
      '.0105555010.',
      '.0105555010.',
      '..00555500..',
      '..06600660..',
      '..06600660..',
      '..00000000..',
    ],
    downb: [
      '............',
      '...000000...',
      '..04444440..',
      '..04444440..',
      '..00000000..',
      '..01111110..',
      '..01011010..',
      '..01111110..',
      '..05555550..',
      '.0055555500.',
      '.0105555010.',
      '.0105555010.',
      '..00555500..',
      '..06600660..',
      '.0660..0660.',
      '.000...000..',
    ],
    up: [
      '............',
      '...000000...',
      '..04444440..',
      '..04444440..',
      '..00000000..',
      '..03333330..',
      '..03333330..',
      '..03333330..',
      '..05555550..',
      '.0055555500.',
      '.0105555010.',
      '.0105555010.',
      '..00555500..',
      '..06600660..',
      '..06600660..',
      '..00000000..',
    ],
    upb: [
      '............',
      '...000000...',
      '..04444440..',
      '..04444440..',
      '..00000000..',
      '..03333330..',
      '..03333330..',
      '..03333330..',
      '..05555550..',
      '.0055555500.',
      '.0105555010.',
      '.0105555010.',
      '..00555500..',
      '..06600660..',
      '.0660..0660.',
      '.000...000..',
    ],
    side: [
      '............',
      '..0000000...',
      '..04444400..',
      '..0444444000',
      '..00000000..',
      '..03111110..',
      '..03111010..',
      '..03111110..',
      '..05555550..',
      '..05555550..',
      '..01555510..',
      '..00555500..',
      '..06666600..',
      '..06600660..',
      '..06600660..',
      '..00000000..',
    ],
    sideb: [
      '............',
      '..0000000...',
      '..04444400..',
      '..0444444000',
      '..00000000..',
      '..03111110..',
      '..03111010..',
      '..03111110..',
      '..05555550..',
      '..05555550..',
      '..01555510..',
      '..00555500..',
      '..06666600..',
      '.0660.06600.',
      '0660...0660.',
      '000.....000.',
    ],
  };

  const TRAINER_PAL = [
    '#0b0d14', '#f0c199', '#c99771', '#4a2f1d',
    '#e2483c', '#3d7fd6', '#2f3a52', '#ffffff',
  ];

  /* ================================================================= baking */
  /* Every sprite is drawn once into its own little canvas and then blitted.
   * The cache key carries the palette, so a shiny and a normal are two
   * entries rather than two drawings every frame. */

  const baked = {};

  function bake(rows, pal, key) {
    if (baked[key]) return baked[key];
    const w = rows[0].length, h = rows.length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const c = row[x];
        if (c === '.') continue;
        g.fillStyle = pal[+c] || '#ff00ff';
        g.fillRect(x, y, 1, 1);
      }
    }
    baked[key] = cv;
    return cv;
  }

  /* A fusion has no drawing of its own — it has two, cut across and stitched.
   * The top seven rows come from the head with the head's colours and the
   * rest from the body with the body's, which is why a fusion reads as two
   * creatures that have been put together rather than one that was averaged.
   * The seam is the whole point and it is not smoothed over. */
  const FUSE_SPLIT = 7;

  function fusionCanvas(sp, shiny) {
    const key = 'f.' + sp.id + (shiny ? '.s' : '');
    if (baked[key]) return baked[key];
    const head = Dex.byId(sp.headId), body = Dex.byId(sp.bodyId);
    const rows = [Dex.ART[head.id], Dex.ART[body.id]];
    const pals = [Dex.paletteFor(head, shiny), Dex.paletteFor(body, shiny)];
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d');
    for (let y = 0; y < 16; y++) {
      const half = y < FUSE_SPLIT ? 0 : 1;
      const row = rows[half][y];
      for (let x = 0; x < 16; x++) {
        const c = row[x];
        if (c === '.') continue;
        g.fillStyle = pals[half][+c] || '#ff00ff';
        g.fillRect(x, y, 1, 1);
      }
    }
    baked[key] = cv;
    return cv;
  }

  function monCanvas(sp, shiny) {
    if (sp.fusion) return fusionCanvas(sp, shiny);
    const key = 'm.' + sp.id + (shiny ? '.s' : '');
    if (baked[key]) return baked[key];
    return bake(Dex.ART[sp.id], Dex.paletteFor(sp, shiny), key);
  }

  /* A creature, at whatever size the screen has room for. Asks the Sprite Lab
   * first: if the player has pointed a sheet frame at this species, that is
   * what a card of it shows, everywhere, for good. */
  function mon(g, sp, shiny, x, y, size, flip) {
    // Your frame wins even for a shiny. A shiny of the built-in art is the
    // palette turned, and a PNG has no palette to turn — so the sparkle
    // drawn next to it is what says "not the usual one" from here on.
    if (Sprites.draw(g, sp.id, x, y, size, size, flip)) return;
    const cv = monCanvas(sp, shiny);
    g.save();
    g.imageSmoothingEnabled = false;
    if (flip) {
      g.translate(R(x) + size, R(y));
      g.scale(-1, 1);
      g.drawImage(cv, 0, 0, size, size);
    } else {
      g.drawImage(cv, R(x), R(y), size, size);
    }
    g.restore();
  }

  /* The player. `dir` is down/up/left/right; left is the right-facing sprite
   * mirrored, which is why there is no left in the table. */
  function trainer(g, dir, step, x, y, size) {
    const side = dir === 'left' || dir === 'right';
    const base = side ? 'side' : dir;
    const key = base + (step ? 'b' : '');
    const target = 'trainer.' + (side ? 'side' : dir) + (step ? 'b' : '');
    const flip = dir === 'left';
    const w = Math.round(size * 12 / 16);
    if (Sprites.draw(g, target, x, y, w, size, flip)) return;
    if (step && Sprites.draw(g, 'trainer.' + (side ? 'side' : dir), x, y, w, size, flip)) return;
    const cv = bake(TRAINER[key], TRAINER_PAL, 't.' + key);
    g.save();
    g.imageSmoothingEnabled = false;
    if (flip) {
      g.translate(R(x) + w, R(y));
      g.scale(-1, 1);
      g.drawImage(cv, 0, 0, w, size);
    } else {
      g.drawImage(cv, R(x), R(y), w, size);
    }
    g.restore();
  }

  /* ==================================================================== ui */

  function box(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(R(x), R(y), R(w), R(h));
  }

  /* A panel with a lit top edge and a shaded bottom one, so a menu sitting on
   * top of the town still looks like an object rather than a hole. */
  function panel(g, x, y, w, h, fill, edge) {
    x = R(x); y = R(y); w = R(w); h = R(h);
    box(g, x, y, w, h, fill || '#121a2c');
    box(g, x, y, w, 1, edge || '#3c4a70');
    box(g, x, y + h - 1, w, 1, '#070a12');
    box(g, x, y, 1, h, edge || '#3c4a70');
    box(g, x + w - 1, y, 1, h, '#070a12');
  }

  function frame(g, x, y, w, h, col) {
    box(g, x, y, w, 1, col);
    box(g, x, y + h - 1, w, 1, col);
    box(g, x, y, 1, h, col);
    box(g, x + w - 1, y, 1, h, col);
  }

  function bar(g, x, y, w, h, frac, col, back) {
    box(g, x, y, w, h, back || '#0a0f1c');
    const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
    if (fw > 0) box(g, x + 1, y + 1, Math.max(1, fw), h - 2, col);
  }

  /* A type badge. Small, coloured, and always the same colour for the same
   * type, because that is the only way a player learns the chart. */
  function typeChip(g, type, x, y, scale) {
    const t = Dex.TYPES[type] || Dex.TYPES.PLAIN;
    const sc = scale || 1;
    const w = width(t.name, sc) + 5 * sc;
    box(g, x, y, w, 9 * sc, t.dark);
    frame(g, x, y, w, 9 * sc, t.colour);
    text(g, t.name, x + 2 * sc, y + 2 * sc, t.colour, sc);
    return w;
  }

  /* ================================================================== cards */
  /* A card is a rectangle with a creature standing in it. The rarity is the
   * border colour and nothing else — no badges, no stars — because eight of
   * these are on screen at once and the eye should be able to sort them in
   * one pass. */

  function cardBack(g, x, y, w, h) {
    panel(g, x, y, w, h, '#1b2440', '#4d5f96');
    box(g, x + 3, y + 3, w - 6, h - 6, '#243157');
    frame(g, x + 3, y + 3, w - 6, h - 6, '#3d4f80');
    for (let i = 0; i < 4; i++) {
      box(g, x + 6 + i * 2, y + h / 2 - 8 + i * 4, w - 12 - i * 4, 2, '#324070');
    }
    text(g, 'R+G', x + w / 2, y + h / 2 - 2, '#6f83c4', 1, 'center');
  }

  function card(g, c, x, y, w, h, opt) {
    opt = opt || {};
    const sp = Dex.byId(c.species);
    const rar = Dex.RARITY[sp.rarity];
    const t = Dex.TYPES[sp.types[0]];

    panel(g, x, y, w, h, '#101728', rar.colour);
    frame(g, x + 1, y + 1, w - 2, h - 2, rar.colour);

    // The art sits on a wash of its own type colour, which is the fastest
    // read on a table of eight cards.
    box(g, x + 3, y + 8, w - 6, h - 26, t.dark);

    const size = Math.min(w - 10, h - 30);
    mon(g, sp, c.shiny, x + (w - size) / 2, y + 8 + (h - 26 - size) / 2, size, false);

    if (c.shiny) {
      const s = ['#fff59d', '#ffffff'][(opt.tick || 0) % 2];
      box(g, x + w - 8, y + 11, 1, 3, s);
      box(g, x + w - 9, y + 12, 3, 1, s);
    }

    text(g, sp.name.slice(0, 9), x + w / 2, y + 2, '#e8eefc', 1, 'center');
    text(g, 'LV' + c.level, x + 3, y + h - 7, '#9fb0d8', 1);
    text(g, t.name.slice(0, 5), x + w - 3, y + h - 7, t.colour, 1, 'right');

    if (opt.kept) {
      box(g, x, y, w, h, 'rgba(90,220,140,0.20)');
      frame(g, x, y, w, h, '#5ce08a');
      frame(g, x + 1, y + 1, w - 2, h - 2, '#5ce08a');
      box(g, x + w / 2 - 11, y + h / 2 + 11, 22, 7, '#5ce08a');
      text(g, 'KEEP', x + w / 2, y + h / 2 + 12, '#0d1a12', 1, 'center');
    }
    if (opt.cursor) {
      frame(g, x - 2, y - 2, w + 4, h + 4, '#ffd166');
      frame(g, x - 3, y - 3, w + 6, h + 6, '#8a6a20');
    }
  }

  /* =================================================================== town */
  /* Sixteen-pixel tiles, baked the same way the sprites are. The town is one
   * screen and never scrolls, so this is a handful of canvases reused. */

  function tile(g, kind, x, y) {
    const key = 'tile.' + kind;
    let cv = baked[key];
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const c = cv.getContext('2d');
      paintTile(c, kind);
      baked[key] = cv;
    }
    g.drawImage(cv, R(x), R(y));
  }

  function paintTile(c, kind) {
    const f = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

    /* ---------------------------------------------------------- outdoors */
    if (kind === 'grass') {
      f(0, 0, 16, 16, '#3a7a45');
      f(0, 0, 16, 1, '#478c52');
      f(3, 5, 2, 1, '#4d9558'); f(10, 9, 2, 1, '#4d9558'); f(6, 12, 2, 1, '#2f6a3a');
    } else if (kind === 'tall') {
      /* The tile the whole game turns on, so it is louder than the grass
       * beside it: darker ground, blades that break the top edge. */
      f(0, 0, 16, 16, '#2a5f33');
      f(0, 0, 16, 1, '#35723d');
      f(1, 2, 2, 6, '#4f9c58'); f(4, 4, 2, 8, '#3f8a4a');
      f(7, 1, 2, 7, '#56a75f'); f(10, 4, 2, 8, '#3f8a4a');
      f(13, 2, 2, 6, '#4f9c58');
      f(0, 14, 16, 2, '#22502b');
    } else if (kind === 'path') {
      f(0, 0, 16, 16, '#b9a077');
      f(0, 0, 16, 1, '#cdb389');
      f(0, 15, 16, 1, '#96805e');
      f(4, 4, 3, 2, '#a88f68'); f(11, 9, 3, 2, '#a88f68'); f(2, 11, 2, 2, '#c6ad84');
    } else if (kind === 'flower') {
      f(0, 0, 16, 16, '#3a7a45');
      f(0, 0, 16, 1, '#478c52');
      f(4, 5, 2, 2, '#f06292'); f(5, 4, 1, 1, '#ffffff');
      f(10, 10, 2, 2, '#ffd54f'); f(11, 9, 1, 1, '#ffffff');
    } else if (kind === 'sand') {
      f(0, 0, 16, 16, '#d8c48c');
      f(0, 0, 16, 1, '#e7d5a2');
      f(5, 7, 2, 1, '#c6b07a'); f(11, 3, 2, 1, '#c6b07a');
    } else if (kind === 'water') {
      f(0, 0, 16, 16, '#2a6ea8');
      f(0, 0, 16, 2, '#3c85c0');
      f(2, 6, 6, 1, '#6fb4e6'); f(9, 11, 5, 1, '#6fb4e6');
      f(4, 13, 4, 1, '#1f5686');
    } else if (kind === 'tree') {
      f(0, 0, 16, 16, '#3a7a45');
      f(6, 10, 4, 6, '#6b4a2a');
      f(2, 1, 12, 10, '#1f5a2c');
      f(3, 0, 10, 2, '#2d7a3a');
      f(2, 1, 2, 8, '#2d7a3a');
      f(11, 6, 3, 5, '#164522');
      f(5, 3, 2, 2, '#3b9a4a');
    } else if (kind === 'rock') {
      f(0, 0, 16, 16, '#3a7a45');
      f(2, 4, 12, 11, '#8d7b6a');
      f(3, 3, 9, 3, '#a89785');
      f(2, 4, 2, 9, '#a89785');
      f(10, 8, 4, 7, '#6a5b4d');
      f(2, 14, 12, 1, '#4a3f35');
    } else if (kind === 'ledge') {
      /* A drop, seen from above: grass on top, a lip, shadow under it. The
       * arrow is the only instruction the tile gets and it points the one way
       * you are allowed to go. */
      f(0, 0, 16, 16, '#3a7a45');
      f(0, 0, 16, 5, '#2f6a3a');
      f(0, 5, 16, 4, '#8d7b6a');
      f(0, 5, 16, 1, '#a89785');
      f(0, 9, 16, 3, '#4a3f35');
      f(0, 12, 16, 4, '#2b5c34');
      f(6, 12, 4, 1, '#cdb389'); f(7, 13, 2, 1, '#cdb389'); f(7, 14, 2, 1, '#cdb389');
    } else if (kind === 'fence') {
      f(0, 0, 16, 16, '#3a7a45');
      f(0, 6, 16, 2, '#8d6e50'); f(0, 10, 16, 2, '#8d6e50');
      f(3, 3, 3, 12, '#a3815f'); f(11, 3, 3, 12, '#a3815f');
      f(3, 3, 3, 1, '#c3a179'); f(11, 3, 3, 1, '#c3a179');

    /* -------------------------------------------------------- buildings */
    } else if (kind === 'roof') {
      f(0, 0, 16, 16, '#b4453a');
      f(0, 0, 16, 2, '#d4655a');
      f(0, 15, 16, 1, '#7d2b24');
      f(0, 5, 16, 1, '#96362e'); f(0, 11, 16, 1, '#96362e');
      f(4, 2, 1, 3, '#c9564b'); f(11, 8, 1, 3, '#c9564b');
    } else if (kind === 'wall') {
      f(0, 0, 16, 16, '#c9b394');
      f(0, 0, 16, 1, '#ded0b6');
      f(0, 15, 16, 1, '#9e8a6e');
      f(3, 4, 9, 7, '#2b3a5a');
      f(3, 4, 9, 1, '#6f5c44'); f(3, 10, 9, 1, '#6f5c44');
      f(4, 5, 3, 3, '#5a76ab');
    } else if (kind === 'door') {
      f(0, 0, 16, 16, '#c9b394');
      f(2, 1, 12, 15, '#6b4a2a');
      f(2, 1, 12, 1, '#8d6540');
      f(3, 2, 10, 14, '#4a3218');
      f(11, 8, 1, 2, '#e0c088');
      f(4, 3, 6, 4, '#5f4426');

    /* --------------------------------------------------------- indoors */
    } else if (kind === 'floor') {
      f(0, 0, 16, 16, '#7e6a52');
      f(0, 0, 16, 1, '#96805f');
      f(0, 8, 16, 1, '#6e5c46');
      f(8, 0, 1, 8, '#6e5c46'); f(0, 9, 1, 7, '#6e5c46');
    } else if (kind === 'mat') {
      f(0, 0, 16, 16, '#7e6a52');
      f(1, 2, 14, 12, '#b4453a');
      f(1, 2, 14, 1, '#d4655a');
      f(3, 5, 10, 1, '#96362e'); f(3, 9, 10, 1, '#96362e');
    } else if (kind === 'table') {
      f(0, 0, 16, 16, '#7e6a52');
      f(0, 2, 16, 11, '#a3815f');
      f(0, 2, 16, 2, '#c3a179');
      f(0, 12, 16, 1, '#6b4a2a');
      f(2, 13, 3, 3, '#6b4a2a'); f(11, 13, 3, 3, '#6b4a2a');
    } else if (kind === 'counter') {
      f(0, 0, 16, 16, '#7e6a52');
      f(0, 3, 16, 13, '#8d6e50');
      f(0, 3, 16, 2, '#b08a63');
      f(0, 10, 16, 1, '#6b4a2a');
      f(3, 6, 3, 2, '#c9b394');
    } else if (kind === 'shelf') {
      f(0, 0, 16, 16, '#7e6a52');
      f(0, 0, 16, 15, '#6b4a2a');
      f(1, 1, 14, 5, '#3a2818'); f(1, 8, 14, 5, '#3a2818');
      f(2, 2, 2, 4, '#c05a4a'); f(5, 2, 2, 4, '#4a8ec0'); f(8, 2, 2, 4, '#c9b394');
      f(2, 9, 2, 4, '#7cb342'); f(6, 9, 2, 4, '#ffd166'); f(10, 9, 2, 4, '#9575cd');
    } else if (kind === 'machine') {
      /* The thing the nurse puts your team on. Two lit slots, because you
       * should be able to tell at a glance that it is the healing one. */
      f(0, 0, 16, 16, '#7e6a52');
      f(1, 1, 14, 14, '#cfd8dc');
      f(1, 1, 14, 2, '#eceff1');
      f(2, 5, 12, 8, '#546e7a');
      f(4, 7, 3, 3, '#ff8a80'); f(9, 7, 3, 3, '#ff8a80');
      f(4, 7, 3, 1, '#ffcdd2'); f(9, 7, 3, 1, '#ffcdd2');
    } else if (kind === 'splicer') {
      /* Two slots and one chute, which is the whole machine. */
      f(0, 0, 16, 16, '#7e6a52');
      f(1, 1, 14, 14, '#4a3a5e');
      f(1, 1, 14, 2, '#6b558a');
      f(3, 5, 4, 5, '#0f1c24'); f(9, 5, 4, 5, '#0f1c24');
      f(4, 6, 2, 3, '#ce93d8'); f(10, 6, 2, 3, '#80deea');
      f(6, 11, 4, 3, '#0f1c24');
      f(7, 12, 2, 1, '#ffd166');
    } else if (kind === 'pc') {
      f(0, 0, 16, 16, '#7e6a52');
      f(1, 1, 14, 14, '#455a64');
      f(1, 1, 14, 2, '#607d8b');
      f(3, 4, 10, 7, '#0f1c24');
      f(4, 5, 8, 5, '#4dd0e1');
      f(5, 6, 3, 1, '#0f1c24'); f(5, 8, 5, 1, '#0f1c24');
      f(5, 12, 6, 2, '#37474f');
    } else if (kind === 'gymfloor') {
      f(0, 0, 16, 16, '#3b4a63');
      f(0, 0, 16, 1, '#4b5c79');
      f(0, 15, 16, 1, '#2c3850');
      f(7, 7, 2, 2, '#54678a');
    } else if (kind === 'gymmat') {
      f(0, 0, 16, 16, '#3b4a63');
      f(1, 1, 14, 14, '#ffd166');
      f(1, 1, 14, 2, '#ffe1a0');
      f(4, 5, 8, 6, '#3b4a63');
      f(6, 7, 4, 2, '#ffd166');

    /* ------------------------------------------------------------- cave */
    } else if (kind === 'cavefloor') {
      f(0, 0, 16, 16, '#4a4238');
      f(0, 0, 16, 1, '#5a5145');
      f(3, 6, 3, 1, '#3c352d'); f(10, 11, 3, 1, '#3c352d');
      f(8, 3, 2, 1, '#5f574a');
    } else if (kind === 'cavewall') {
      f(0, 0, 16, 16, '#2a251f');
      f(0, 0, 16, 3, '#3d362d');
      f(2, 4, 12, 10, '#37302a');
      f(2, 4, 10, 1, '#4a4238');
      f(11, 7, 3, 7, '#211d18');
    } else if (kind === 'dark') {
      f(0, 0, 16, 16, '#05070c');
    } else {
      f(0, 0, 16, 16, '#3a7a45');
    }
  }

  /* A shopfront. Roof, wall, window, door, and a sign with the shop's colour
   * on it — the door is the only part the game cares about, so it is the only
   * part drawn twice. */
  function building(g, x, y, w, h, col, doorX) {
    x = R(x); y = R(y); w = R(w); h = R(h);
    box(g, x, y + 6, w, h - 6, '#c9b394');
    box(g, x, y + 6, w, 2, '#ded0b6');
    box(g, x, y + h - 2, w, 2, '#9e8a6e');
    box(g, x - 2, y, w + 4, 7, col);
    box(g, x - 2, y, w + 4, 2, Dex.lighten(col, 0.35));
    box(g, x - 2, y + 6, w + 4, 1, '#3a2f22');

    for (let i = 0; i < 2; i++) {
      const wx = x + 4 + i * (w - 16);
      box(g, wx, y + 11, 8, 8, '#2b3a5a');
      frame(g, wx, y + 11, 8, 8, '#6f5c44');
      box(g, wx + 1, y + 12, 3, 3, '#5a76ab');
    }

    const dx = x + (doorX === undefined ? (w - 12) / 2 : doorX);
    box(g, R(dx), y + h - 16, 12, 16, '#6b4a2a');
    box(g, R(dx), y + h - 16, 12, 1, '#8d6540');
    box(g, R(dx) + 1, y + h - 15, 10, 14, '#4a3218');
    box(g, R(dx) + 8, y + h - 9, 1, 2, '#e0c088');
    return { x: R(dx), y: y + h - 16, w: 12, h: 16 };
  }

  return {
    text, textShadow, width, box, panel, frame, bar, typeChip,
    bake, mon, monCanvas, trainer, card, cardBack, tile, building,
    GLYPHS, TRAINER, TRAINER_PAL,
  };
})();
