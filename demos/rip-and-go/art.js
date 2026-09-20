/* Pokémon Rip and Go — everything you can see.
 *
 * No images ship with this game. The creatures are typed out in dex.js, the
 * trainer is typed out below, and everything else — cards, shopfronts, the
 * town, the menus — is rectangles. That buys the same three things it buys
 * the rest of the demos in this folder: nothing to fetch, a flipped copy for
 * free, and palette swaps, which is how sixteen drawings cover forty-eight
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

  function monCanvas(sp, shiny) {
    const key = 'm.' + sp.id + (shiny ? '.s' : '');
    if (baked[key]) return baked[key];
    return bake(Dex.FORMS[sp.form], Dex.paletteFor(sp, shiny), key);
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
    const t = Dex.TYPES[sp.type];

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
    if (kind === 'grass') {
      f(0, 0, 16, 16, '#2f6b3a');
      f(0, 0, 16, 1, '#3c7f46');
      f(3, 5, 2, 1, '#3f8a4b'); f(10, 9, 2, 1, '#3f8a4b'); f(6, 12, 2, 1, '#276032');
    } else if (kind === 'grass2') {
      f(0, 0, 16, 16, '#2b6436');
      f(0, 0, 16, 1, '#37773f');
      f(8, 3, 1, 2, '#48934f'); f(2, 10, 1, 2, '#48934f');
    } else if (kind === 'path') {
      f(0, 0, 16, 16, '#9c8663');
      f(0, 0, 16, 1, '#b39b76');
      f(0, 15, 16, 1, '#7d6a4e');
      f(4, 4, 3, 2, '#8d7959'); f(11, 9, 3, 2, '#8d7959'); f(2, 11, 2, 2, '#ab9470');
    } else if (kind === 'water') {
      f(0, 0, 16, 16, '#2a6ea8');
      f(0, 0, 16, 2, '#3c85c0');
      f(2, 6, 6, 1, '#6fb4e6'); f(9, 11, 5, 1, '#6fb4e6');
    } else if (kind === 'sand') {
      f(0, 0, 16, 16, '#d8c48c');
      f(0, 0, 16, 1, '#e7d5a2');
      f(5, 7, 2, 1, '#c6b07a');
    } else if (kind === 'flower') {
      f(0, 0, 16, 16, '#2f6b3a');
      f(0, 0, 16, 1, '#3c7f46');
      f(4, 5, 2, 2, '#f06292'); f(5, 4, 1, 1, '#ffffff');
      f(10, 10, 2, 2, '#ffd54f'); f(11, 9, 1, 1, '#ffffff');
    } else if (kind === 'fence') {
      f(0, 0, 16, 16, '#2f6b3a');
      f(0, 6, 16, 2, '#8d6e50'); f(0, 10, 16, 2, '#8d6e50');
      f(3, 3, 3, 12, '#a3815f'); f(11, 3, 3, 12, '#a3815f');
      f(3, 3, 3, 1, '#c3a179'); f(11, 3, 3, 1, '#c3a179');
    } else if (kind === 'tree') {
      f(0, 0, 16, 16, '#2f6b3a');
      f(6, 10, 4, 6, '#6b4a2a');
      f(2, 1, 12, 10, '#1f5a2c');
      f(3, 0, 10, 2, '#2d7a3a');
      f(2, 1, 2, 8, '#2d7a3a');
      f(11, 6, 3, 5, '#164522');
      f(5, 3, 2, 2, '#3b9a4a');
    } else if (kind === 'sign') {
      f(0, 0, 16, 16, '#2f6b3a');
      f(7, 9, 2, 7, '#6b4a2a');
      f(2, 2, 12, 8, '#a3815f');
      f(2, 2, 12, 1, '#c3a179');
      f(3, 4, 10, 1, '#5c4430'); f(3, 6, 7, 1, '#5c4430');
    } else {
      f(0, 0, 16, 16, '#2f6b3a');
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
