/* The Show — everything you can see.
 *
 * No images. The sprites below are typed out as letters, one character per
 * pixel, and baked into small offscreen canvases the first time they are
 * asked for. That buys three things a PNG would not:
 *
 *   - nothing to fetch, so the game cannot open half-drawn on bad wifi;
 *   - a flipped copy for free, baked once instead of a transform per frame;
 *   - palette swaps, which is how one ballplayer wears eight different kits
 *     on his way up, and how a crow in the rain is a darker crow.
 *
 * Tiles and backdrops are drawn with rectangles instead, because they are
 * themed per league and a rectangle takes a colour argument.
 */
const Art = (() => {

  /* ==================================================================== font */
  /* 3x5 letters, a rectangle at a time, so text lands on the same grid as the
   * art does. The menus are drawn into the canvas too — there is no DOM text
   * anywhere in this game — so this font is the only one it has. */
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
  };

  function textWidth(s, sc) { return String(s).length * 4 * (sc || 1) - (sc || 1); }

  function text(g, s, x, y, colour, sc, align) {
    sc = sc || 1;
    const str = String(s).toUpperCase();
    let px = x;
    if (align === 'center') px = Math.round(x - textWidth(str, sc) / 2);
    if (align === 'right') px = Math.round(x - textWidth(str, sc));
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
    text(g, s, x + sc, y + sc, shade || '#120b14', sc, align);
    text(g, s, x, y, colour, sc, align);
  }

  /* ================================================================ palettes */
  /* Letters used by every sprite below. A kit is a partial override merged
   * over this, so a league only has to name the colours it changes. */
  const BASE = {
    k: '#241a26',   // outline / shadow, on everything
    s: '#f0bb88',   // skin
    S: '#c98e5b',   // skin, shaded
    e: '#241a26',   // eye
    j: '#f6f2e4',   // jersey
    J: '#d3cdba',   // jersey, shaded
    a: '#d8433f',   // team accent: cap, sleeve, number
    A: '#8e2523',   // team accent, shaded
    g: '#cfd3d9',   // trousers
    G: '#a3a8b1',   // trousers, shaded
    b: '#c08a4a',   // bat
    B: '#8a5c2c',   // bat, shaded
    l: '#a8703f',   // leather: glove, ball seams live on white
    w: '#ffffff',   // ball
    d: '#241a26',   // feathers / dark animal
    D: '#3d3346',   // feathers, lighter
    o: '#ff9d3d',   // beak, warning stripe
    m: '#7d6a5a',   // metal
    M: '#4e4239',   // metal, shaded
    y: '#ffd166',   // gold
    p: '#ff7ab8',   // gum
    c: '#8fe3ff',   // glass / shine
    n: '#6b4b2f',   // fur
    N: '#48301d',   // fur, shaded
    r: '#5ce08a',   // green
    v: '#9b6bd8',   // purple
  };

  // The kit changes as the leagues do: dirt-lot cream, school colours, then
  // the whites and pinstripes of a place with a groundskeeper.
  const KITS = {
    sandlot: { j: '#e9e2cd', J: '#c6bda4', a: '#d8433f', A: '#8e2523', g: '#cbbfa4', G: '#a08f74' },
    little:  { j: '#f6f2e4', J: '#d3cdba', a: '#3f8fd8', A: '#23558e', g: '#dfe3ea', G: '#aab0ba' },
    school:  { j: '#f2ead8', J: '#cdc4ae', a: '#3fb87a', A: '#1f6f47', g: '#e3e6ea', G: '#aeb3bb' },
    college: { j: '#fbf7ea', J: '#d8d2c0', a: '#f0a726', A: '#a86f11', g: '#e9ecf1', G: '#b3b8c1' },
    single:  { j: '#eef0f2', J: '#c9ccd1', a: '#8a53d0', A: '#57318a', g: '#dde0e6', G: '#a7abb4' },
    double:  { j: '#e6e9ee', J: '#bfc3cb', a: '#e05c2a', A: '#8f3413', g: '#d5d9e1', G: '#9ea2ac' },
    triple:  { j: '#f4f6fa', J: '#ccd0d8', a: '#2fb3c9', A: '#186876', g: '#e2e6ee', G: '#a9adb7' },
    show:    { j: '#ffffff', J: '#d6dae3', a: '#c8102e', A: '#7d0a1d', g: '#f0f3f8', G: '#b6bac4' },
  };

  /* ================================================================= sprites */
  /* One character per pixel. '.' is left transparent. Width is taken from the
   * first row; a row of the wrong length is a typo, so it is padded and
   * shouted about once rather than silently drawing crooked art. */

  const SPRITES = {
    /* -------------------------------------------------- the ballplayer, 12x16
     * He is drawn without his bat. The bat is a rectangle the game rotates at
     * his hands, which is how one sprite can swing through a whole arc. */
    idle0: [
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      '.jjjjjjjj...',
      '.jajjjjjj...',
      '.jjjjjjjJ...',
      '..jjjjjJ....',
      '...gggg.....',
      '...gggg.....',
      '...gg.gg....',
      '...gg.gg....',
      '..kkk.kkk...',
      '............',
    ],
    idle1: [
      '............',
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      '.jjjjjjjj...',
      '.jajjjjjj...',
      '..jjjjjJ....',
      '...gggg.....',
      '...gggg.....',
      '...gg.gg....',
      '...gg.gg....',
      '..kkk.kkk...',
      '............',
    ],
    run0: [
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      '.jjjjjjjjs..',
      '.jajjjjjj...',
      '.sjjjjjjJ...',
      '..jjjjjJ....',
      '...gggg.....',
      '..ggggg.....',
      '..gg..gg....',
      '.gg....gg...',
      '.kkk...kkk..',
      '............',
    ],
    run1: [
      '............',
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjjs...',
      '.jjjjjjjj...',
      '.jajjjjjj...',
      '..jjjjjJ....',
      '...gggg.....',
      '...gggg.....',
      '...ggggg....',
      '...gg..g....',
      '..kkk..kk...',
      '............',
    ],
    run2: [
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      'sjjjjjjjj...',
      '.jajjjjjjs..',
      '.jjjjjjjJ...',
      '..jjjjjJ....',
      '...gggg.....',
      '...ggggg....',
      '..gg...gg...',
      '.gg.....gg..',
      '.kkk...kkk..',
      '............',
    ],
    run3: [
      '............',
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      '.jjjjjjjj...',
      '.jajjjjjjs..',
      '..jjjjjJ....',
      '...gggg.....',
      '...gggg.....',
      '..gggg......',
      '..gg..g.....',
      '.kkk..kkk...',
      '............',
    ],
    jump: [
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      's.jjjjjj.s..',
      '.sjjjjjjs...',
      '.jajjjjjj...',
      '.jjjjjjjJ...',
      '..jjjjjJ....',
      '...gggg.....',
      '..ggg.gg....',
      '..gg...gg...',
      '.kkk...gg...',
      '.......kkk..',
      '............',
    ],
    fall: [
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      'sjjjjjjjjs..',
      '.jajjjjjj...',
      '.jjjjjjjJ...',
      '..jjjjjJ....',
      '...gggg.....',
      '...gggg.....',
      '..gg...gg...',
      '..gg...gg...',
      '.kkk...kkk..',
      '............',
    ],
    hurt: [
      '..aaaaa.....',
      '.aaaaaaaa...',
      '..sssek.....',
      '..sssek.....',
      '..Ssss......',
      's.jjjjjj....',
      '.sjjjjjjjs..',
      '..jajjjjj...',
      '..jjjjjjJ...',
      '...jjjjJ....',
      '...gggg.....',
      '..gg..gg....',
      '.gg....gg...',
      '.kk.....kk..',
      '............',
      '............',
    ],
    // Knees bent, weight back: the frame the swing comes out of.
    load: [
      '............',
      '...aaaaa....',
      '..aaaaaaaa..',
      '...ssssk....',
      '...ssesk....',
      '...Ssss.....',
      '..jjjjjj....',
      '.jjjjjjjj...',
      '.jajjjjjj...',
      '.jjjjjjjJ...',
      '..gggggg....',
      '..gggggg....',
      '..gg..gg....',
      '.gg....gg...',
      '.kkk..kkk...',
      '............',
    ],

    /* ------------------------------------------------------ the helmet, 12x4
     * Drawn over the head when he is wearing one, so there is one body sprite
     * rather than two of everything. */
    helmet: [
      '..aaaaaa....',
      '.aaaaaaaa...',
      '.aAaaaaaaa..',
      '............',
    ],

    /* ---------------------------------------------------------- pickups, 8x8 */
    ball: [
      '..wwww..',
      '.wwAwww.',
      'wwwAwwww',
      'wAAwwAAw',
      'wwwwAwww',
      'wwwwAwww',
      '.wwwwww.',
      '..wwww..',
    ],
    card: [
      'kkkkkkkk',
      'kjjjjjjk',
      'kjaaaajk',
      'kjjjjjjk',
      'kjjkkjjk',
      'kjkkkkjk',
      'kjjjjjjk',
      'kkkkkkkk',
    ],
    pickHelmet: [
      '..aaaa..',
      '.aaaaaa.',
      'aaAaaaaa',
      'aaaaaaaa',
      'aaaaaaaa',
      'kkkkkkkk',
      '........',
      '........',
    ],
    pickBat: [
      '.....yyy',
      '....yyy.',
      '...yyy..',
      '..yyy...',
      '.yyy....',
      'yyy.....',
      'yy......',
      'y.......',
    ],
    pickCleats: [
      '........',
      '.ccc....',
      'cccccc..',
      'cccccccc',
      'kkkkkkkk',
      '.k.k.k.k',
      '........',
      '........',
    ],
    pickGum: [
      '..pppp..',
      '.pppppp.',
      'pppwpppp',
      'pppppppp',
      'pppppppp',
      '.pppppp.',
      '..pppp..',
      '........',
    ],
    pickArm: [
      '..llll..',
      '.llllll.',
      'llwwwlll',
      'llwwwlll',
      'llllllll',
      '.llllll.',
      '..llll..',
      '........',
    ],

    /* ---------------------------------------------------------- enemies */
    // A crow, 12x10. Stomp it or swing at it; it walks, it turns at edges.
    crow0: [
      '....dddd....',
      '...dddddd...',
      '...dwddd....',
      '...dedd.....',
      '..oddddd....',
      '.dddddddd...',
      'DDddddddDD..',
      '..dddddd....',
      '...d..d.....',
      '..oo..oo....',
    ],
    crow1: [
      '....dddd....',
      '...dddddd...',
      '...dwddd....',
      '...dedd.....',
      '..oddddd....',
      '.dddddddd...',
      '..dddddd....',
      '.DDddddDD...',
      '...d..d.....',
      '..oo..oo....',
    ],
    // A gopher, 10x10, in and out of his hole. Gopher ball, obviously.
    gopher0: [
      '..nnnnnn..',
      '.nnnnnnnn.',
      '.nnennenn.',
      '.nnnnnnnn.',
      '..nnwwnn..',
      '..NnnnnN..',
      '...nnnn...',
      '..........',
      '..........',
      '..........',
    ],
    gopher1: [
      '..........',
      '..........',
      '..nnnnnn..',
      '.nnnnnnnn.',
      '.nnennenn.',
      '.nnnnnnnn.',
      '..nnwwnn..',
      '..NnnnnN..',
      '...nnnn...',
      '..........',
    ],
    // A pitching machine, 16x14. It throws; you hit what it throws back at it.
    machine0: [
      '.....mmmmm......',
      '....mmmmmmm.....',
      '...mmMMMMMmm....',
      '...mM.....Mm....',
      '...mM..w..Mm....',
      '...mM.....Mm....',
      '...mmMMMMMmm....',
      '....mmmmmmm.....',
      '......mmm.......',
      '.....MMMMM......',
      '....MMMMMMM.....',
      '...MM.....MM....',
      '..MMM.....MMM...',
      '..kkk.....kkk...',
    ],
    machine1: [
      '.....mmmmm......',
      '....mmmmmmm.....',
      '...mmMMMMMmm....',
      '...mM.....Mm..w.',
      '...mM.....Mm....',
      '...mM.....Mm....',
      '...mmMMMMMmm....',
      '....mmmmmmm.....',
      '......mmm.......',
      '.....MMMMM......',
      '....MMMMMMM.....',
      '...MM.....MM....',
      '..MMM.....MMM...',
      '..kkk.....kkk...',
    ],
    // A rival with a helmet on, 12x16. The helmet is the point: you cannot
    // stomp him, so he is the reason the bat exists.
    rival0: [
      '..vvvvvv....',
      '.vvvvvvvv...',
      '.vVvssssk...',
      '...ssesk....',
      '...Ssss.....',
      '..JJJJJJ....',
      '.JJJJJJJJ...',
      '.JvJJJJJJ...',
      '.JJJJJJJG...',
      '..JJJJJG....',
      '...GGGG.....',
      '..GGGGG.....',
      '..GG..GG....',
      '.GG....GG...',
      '.kkk...kkk..',
      '............',
    ],
    rival1: [
      '............',
      '..vvvvvv....',
      '.vvvvvvvv...',
      '.vVvssssk...',
      '...ssesk....',
      '...Ssss.....',
      '..JJJJJJ....',
      '.JJJJJJJJ...',
      '.JvJJJJJJ...',
      '..JJJJJG....',
      '...GGGG.....',
      '...GGGGG....',
      '...GG..G....',
      '..GGG..GG...',
      '..kkk..kkk..',
      '............',
    ],
    // A curveball with a grin, 10x10. It weaves. Stomping a spinning ball
    // does not work; the bat does.
    slider0: [
      '..wwwwww..',
      '.wwAwwAww.',
      'wwAwwwwAww',
      'wweewweeww',
      'wwwwwwwwww',
      'wwwAAAAwww',
      'wwwwwwwwww',
      'wwAwwwwAww',
      '.wwAwwAww.',
      '..wwwwww..',
    ],
    slider1: [
      '..wwwwww..',
      '.wwwAAwww.',
      'wwwwwwwwww',
      'wweewweeww',
      'wwAwwwwAww',
      'wwAAAAAAww',
      'wwAwwwwAww',
      'wwwwwwwwww',
      '.wwwAAwww.',
      '..wwwwww..',
    ],
    // The Closer, 24x28. He is the last level, and he only throws heat.
    closer0: [
      '.......aaaaaaaaaa.......',
      '......aaaaaaaaaaaa......',
      '.....aaAAaaaaaaAAaa.....',
      '......ssssssssssss......',
      '......sseesssseess......',
      '......ssssssssssss......',
      '.......SSssssssSS.......',
      '.....jjjjjjjjjjjjjj.....',
      '....jjjjjjjjjjjjjjjj....',
      '...jjjjjjjaajjjjjjjjj...',
      '..jjjjjjjjaajjjjjjjjjj..',
      '..jjjjjjjjjjjjjjjjjjjj..',
      '..jjjjjjjjjjjjjjjjjjjj..',
      '...jjjjjjjjjjjjjjjjjj...',
      '....JJJJJJJJJJJJJJJJ....',
      '.....gggggggggggggg.....',
      '.....gggggggggggggg.....',
      '.....gggg......gggg.....',
      '.....gggg......gggg.....',
      '.....gggg......gggg.....',
      '.....gggg......gggg.....',
      '....kkkkkk....kkkkkk....',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    closer1: [
      '.......aaaaaaaaaa.......',
      '......aaaaaaaaaaaa......',
      '.....aaAAaaaaaaAAaa.....',
      '......ssssssssssss......',
      '......sseesssseess......',
      '......ssssssssssss......',
      '.......SSssssssSS.......',
      '..ss.jjjjjjjjjjjjjj.....',
      '..ssjjjjjjjjjjjjjjjj....',
      '...jjjjjjjaajjjjjjjjj...',
      '...jjjjjjjaajjjjjjjjjj..',
      '...jjjjjjjjjjjjjjjjjjj..',
      '....jjjjjjjjjjjjjjjjjj..',
      '....jjjjjjjjjjjjjjjjj...',
      '.....JJJJJJJJJJJJJJJ....',
      '.....gggggggggggggg.....',
      '.....gggggggggggggg.....',
      '.....ggg........ggg.....',
      '....ggg..........ggg....',
      '....ggg..........ggg....',
      '...gggg..........gggg...',
      '..kkkkkk........kkkkkk..',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  };

  /* ------------------------------------------------------------ the bakery */

  const cache = new Map();      // "name|kit|flip" -> canvas
  let warned = false;

  function bake(name, kitName, flip) {
    const key = name + '|' + kitName + '|' + (flip ? 1 : 0);
    const hit = cache.get(key);
    if (hit) return hit;

    const rows = SPRITES[name];
    if (!rows) return null;

    const w = rows[0].length, h = rows.length;
    const pal = Object.assign({}, BASE, KITS[kitName] || null);

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');

    for (let y = 0; y < h; y++) {
      const row = rows[y];
      if (row.length !== w && !warned) {
        warned = true;
        console.warn('The Show: sprite "' + name + '" row ' + y + ' is ' +
                     row.length + ' wide, expected ' + w);
      }
      for (let x = 0; x < w; x++) {
        const c = row[x];
        if (!c || c === '.') continue;
        const col = pal[c];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
      }
    }

    cache.set(key, cv);
    return cv;
  }

  /* Draw a sprite with its top-left at x,y. Coordinates are rounded because a
   * pixel sprite on a half pixel goes soft at the edges. */
  function spr(g, name, x, y, flip, kit) {
    const cv = bake(name, kit || 'sandlot', flip);
    if (!cv) return;
    g.drawImage(cv, Math.round(x), Math.round(y));
  }

  function sprSize(name) {
    const rows = SPRITES[name];
    return rows ? { w: rows[0].length, h: rows.length } : { w: 0, h: 0 };
  }

  /* A sprite drawn as one flat colour — the invulnerability flash, and the
   * white flash a thing gets on the frame it dies. */
  function sprTint(g, name, x, y, flip, kit, colour, alpha) {
    const cv = bake(name, kit || 'sandlot', flip);
    if (!cv) return;
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.drawImage(cv, Math.round(x), Math.round(y));
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = colour;
    g.fillRect(Math.round(x), Math.round(y), cv.width, cv.height);
    g.restore();
  }

  /* The tint above needs a clean surface to work on, so it goes through a
   * scratch canvas the size of the biggest sprite rather than the screen. */
  const scratch = document.createElement('canvas');
  scratch.width = 32; scratch.height = 32;
  const sg = scratch.getContext('2d');

  function sprFlash(g, name, x, y, flip, kit, colour) {
    const cv = bake(name, kit || 'sandlot', flip);
    if (!cv) return;
    if (scratch.width < cv.width || scratch.height < cv.height) {
      scratch.width = cv.width; scratch.height = cv.height;
    }
    sg.clearRect(0, 0, scratch.width, scratch.height);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(cv, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    sg.fillStyle = colour;
    sg.fillRect(0, 0, cv.width, cv.height);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, 0, 0, cv.width, cv.height, Math.round(x), Math.round(y), cv.width, cv.height);
  }

  /* ==================================================================== bat */
  /* The bat is not a sprite. It is a rounded rectangle drawn at an angle from
   * the hands, which is the whole reason the swing can be a real arc instead
   * of three frames pretending to be one. */
  function bat(g, hx, hy, angle, len, kit, gold) {
    const pal = Object.assign({}, BASE, KITS[kit] || null);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const wood = gold ? '#ffd166' : pal.b;
    const dark = gold ? '#c9932b' : pal.B;
    // Walked down the shaft a pixel at a time: no transforms, no smoothing,
    // and it lands on the same grid as everything else.
    for (let i = 0; i < len; i++) {
      const x = Math.round(hx + ca * i);
      const y = Math.round(hy + sa * i);
      const thick = i < len * 0.35 ? 1 : i < len * 0.7 ? 2 : 3;
      g.fillStyle = i < len * 0.2 ? dark : wood;
      g.fillRect(x, y - (thick >> 1), thick >= 3 ? 2 : 1, thick);
    }
  }

  /* ================================================================== tiles */
  /* Themes are the league you are in. Every tile takes its colours from here,
   * which is why the same level geometry reads as a dirt lot in one place and
   * a ballpark in another. */
  const THEMES = {
    sandlot: {
      kit: 'sandlot',
      sky: ['#8fd3f4', '#dff2fb'], ground: '#c08f5a', groundTop: '#5fb94a',
      groundDark: '#94663a', brick: '#b4805a', far: 'trees', mid: 'fence',
      crowd: false, lights: false, night: false, cloud: '#ffffff', music: 'sand', shift: 0,
    },
    little: {
      kit: 'little',
      sky: ['#79c8f0', '#e8f6ff'], ground: '#b98a55', groundTop: '#63c254',
      groundDark: '#8c6236', brick: '#c98f55', far: 'houses', mid: 'fence',
      crowd: true, lights: false, night: false, cloud: '#ffffff', music: 'sand', shift: 2,
    },
    school: {
      kit: 'school',
      sky: ['#20325e', '#4a5f96'], ground: '#6b5a48', groundTop: '#3f8f4a',
      groundDark: '#4a3d31', brick: '#7a6552', far: 'school', mid: 'fence',
      crowd: true, lights: true, night: true, cloud: '#6d7fae', music: 'sand', shift: -3,
    },
    college: {
      kit: 'college',
      sky: ['#5fb8e8', '#ffe8b8'], ground: '#c2884f', groundTop: '#4fb04a',
      groundDark: '#956331', brick: '#c58a4e', far: 'stadium', mid: 'wall',
      crowd: true, lights: false, night: false, cloud: '#fff4dd', music: 'minors', shift: 0,
    },
    single: {
      kit: 'single',
      sky: ['#1b2440', '#3b3f6b'], ground: '#4b4a5c', groundTop: '#5a6a7a',
      groundDark: '#33323f', brick: '#5b5a6c', far: 'highway', mid: 'bus',
      crowd: false, lights: true, night: true, cloud: '#4b4f7a', music: 'minors', shift: -2,
    },
    double: {
      kit: 'double',
      sky: ['#4c5a68', '#8d9aa4'], ground: '#7a6247', groundTop: '#4e7a45',
      groundDark: '#574533', brick: '#856a4c', far: 'stadium', mid: 'wall',
      crowd: true, lights: true, night: false, cloud: '#b8c2cb', rain: true, music: 'minors', shift: 3,
    },
    triple: {
      kit: 'triple',
      sky: ['#2b6fb0', '#bfe4ff'], ground: '#b8834e', groundTop: '#46b05a',
      groundDark: '#8a6039', brick: '#bd8a52', far: 'stadium', mid: 'wall',
      crowd: true, lights: true, night: false, cloud: '#ffffff', music: 'minors', shift: 5,
    },
    show: {
      kit: 'show',
      sky: ['#101a3a', '#2a3f7a'], ground: '#a8703f', groundTop: '#3fa85a',
      groundDark: '#7d5028', brick: '#b07a45', far: 'bigleague', mid: 'wall',
      crowd: true, lights: true, night: true, cloud: '#33407a', music: 'show', shift: 0,
    },
  };

  /* A deterministic scatter, so the freckles on the dirt do not crawl about
   * between frames. Same seed in, same speckle out. */
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  const T = 16;

  function tile(g, ch, tx, ty, px, py, th, openAbove) {
    if (ch === '#') {
      g.fillStyle = th.ground;
      g.fillRect(px, py, T, T);
      if (openAbove) {
        g.fillStyle = th.groundTop;
        g.fillRect(px, py, T, 4);
        g.fillStyle = th.groundDark;
        g.fillRect(px, py + 4, T, 1);
      }
      // Speckle, fixed to the tile's own coordinates.
      g.fillStyle = th.groundDark;
      for (let i = 0; i < 5; i++) {
        const r = hash(tx * 7 + i, ty * 13 + i * 3);
        const rx = Math.floor(r * 14), ry = 5 + Math.floor(hash(tx + i, ty * 5 + i) * 10);
        if (ry < T) g.fillRect(px + rx, py + ry, 2, 1);
      }
      return;
    }

    if (ch === 'X') {                       // the brick of a built-up league
      g.fillStyle = th.brick;
      g.fillRect(px, py, T, T);
      g.fillStyle = th.groundDark;
      g.fillRect(px, py, T, 1);
      g.fillRect(px, py + 8, T, 1);
      g.fillRect(px + 8, py + 1, 1, 7);
      g.fillRect(px, py + 9, 1, 7);
      return;
    }

    if (ch === '=') {                       // a plank you can jump up through
      g.fillStyle = th.groundDark;
      g.fillRect(px, py, T, 4);
      g.fillStyle = '#e0c089';
      g.fillRect(px, py, T, 3);
      g.fillStyle = th.brick;
      g.fillRect(px + 2, py + 3, 3, 1);
      g.fillRect(px + 11, py + 3, 3, 1);
      return;
    }

    if (ch === 'B') {                       // a crate of balls, breakable
      g.fillStyle = '#b8823f';
      g.fillRect(px, py, T, T);
      g.fillStyle = '#8a5c26';
      g.fillRect(px, py, T, 2); g.fillRect(px, py + 14, T, 2);
      g.fillRect(px, py, 2, T); g.fillRect(px + 14, py, 2, T);
      g.fillStyle = '#d8a05a';
      g.fillRect(px + 3, py + 3, 10, 10);
      g.fillStyle = '#8a5c26';
      g.fillRect(px + 3, py + 3, 10, 1);
      g.fillRect(px + 7, py + 3, 2, 10);
      return;
    }

    if (ch === 'S') {                       // solid, unbreakable, no grass cap
      g.fillStyle = th.groundDark;
      g.fillRect(px, py, T, T);
      g.fillStyle = th.brick;
      g.fillRect(px + 1, py + 1, T - 2, T - 2);
      g.fillStyle = th.groundDark;
      g.fillRect(px + 4, py + 4, 2, 2);
      g.fillRect(px + 10, py + 10, 2, 2);
      return;
    }

    if (ch === '^') {                       // a rake, business side up
      g.fillStyle = '#6b5a48';
      g.fillRect(px, py + 11, T, 5);
      g.fillStyle = '#c9ced6';
      for (let i = 0; i < 4; i++) {
        g.fillRect(px + 1 + i * 4, py + 4, 2, 8);
        g.fillRect(px + 1 + i * 4, py + 2, 1, 3);
      }
      return;
    }

    if (ch === 'W') {                       // outfield wall / dugout front
      g.fillStyle = '#1f4d2f';
      g.fillRect(px, py, T, T);
      g.fillStyle = '#296b3f';
      g.fillRect(px, py, T, 2);
      g.fillStyle = '#f6f2e4';
      g.fillRect(px, py + 7, T, 1);
      return;
    }
  }

  /* =============================================================== backdrop */

  function backdrop(g, th, camX, camY, t, W, H) {
    // Sky.
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, th.sky[0]);
    grad.addColorStop(1, th.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    if (th.night) {
      // Stars, pinned to the world so they drift with the camera very slowly.
      const ox = (camX * 0.02) | 0;
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 71 + 13) - ox) % (W + 40);
        const sy = (i * 37) % 70;
        g.fillStyle = i % 5 === 0 ? '#cfe4ff' : '#8fa8d8';
        g.fillRect(sx < 0 ? sx + W + 40 : sx, sy, 1, 1);
      }
    } else {
      // Clouds. Three slabs of rectangle each, which is all a cloud ever is.
      // The offset is rounded before anything is built out of it: a parallax
      // layer on a half pixel is the one thing that gives away a fake screen.
      const ox = Math.round(camX * 0.08);
      g.fillStyle = th.cloud;
      for (let i = 0; i < 6; i++) {
        let cx = (i * 97 + 20 - ox) % (W + 120);
        if (cx < -120) cx += W + 120;
        const cy = 12 + (i * 23) % 36;
        g.fillRect(cx, cy, 30, 6);
        g.fillRect(cx + 6, cy - 4, 18, 6);
        g.fillRect(cx + 12, cy - 7, 10, 5);
      }
    }

    // Light towers, behind everything, for the leagues that have them.
    if (th.lights) {
      const ox = Math.round(camX * 0.18);
      for (let i = 0; i < 5; i++) {
        let lx = (i * 140 + 40 - ox) % (W + 300);
        if (lx < -300) lx += W + 300;
        const base = 96;
        g.fillStyle = '#2c3242';
        g.fillRect(lx, 26, 3, base - 26);
        g.fillStyle = '#3a4152';
        g.fillRect(lx - 10, 14, 23, 14);
        for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
          const on = th.night || (a + b) % 2 === 0;
          g.fillStyle = on ? '#fff6c8' : '#9aa2b4';
          g.fillRect(lx - 8 + a * 7, 16 + b * 6, 5, 4);
        }
        if (th.night) {
          g.globalAlpha = 0.09;
          g.fillStyle = '#ffeec0';
          g.fillRect(lx - 24, 26, 50, 70);
          g.globalAlpha = 1;
        }
      }
    }

    farLayer(g, th, camX, t, W, H);
    if (th.crowd) crowd(g, th, camX, t, W, H);
    midLayer(g, th, camX, t, W, H);
  }

  function farLayer(g, th, camX, t, W, H) {
    const ox = Math.round(camX * 0.25);
    const sky = th.far;

    if (sky === 'trees') {
      for (let i = 0; i < 14; i++) {
        let x = (i * 63 + 10 - ox) % (W + 200);
        if (x < -200) x += W + 200;
        const h0 = 30 + (i * 17) % 22;
        g.fillStyle = '#2f6b33';
        g.fillRect(x, 120 - h0, 26, h0);
        g.fillRect(x + 4, 120 - h0 - 8, 18, 10);
        g.fillStyle = '#3f8a42';
        g.fillRect(x + 2, 120 - h0 + 2, 10, h0 - 4);
      }
    } else if (sky === 'houses') {
      for (let i = 0; i < 12; i++) {
        let x = (i * 71 + 5 - ox) % (W + 200);
        if (x < -200) x += W + 200;
        const h0 = 26 + (i * 23) % 20;
        g.fillStyle = '#7d6a74';
        g.fillRect(x, 120 - h0, 40, h0);
        g.fillStyle = '#5c4d56';
        g.fillRect(x - 3, 120 - h0 - 6, 46, 7);
        g.fillStyle = '#ffe9a8';
        for (let w0 = 0; w0 < 3; w0++) g.fillRect(x + 6 + w0 * 12, 120 - h0 + 8, 6, 6);
      }
    } else if (sky === 'school') {
      for (let i = 0; i < 8; i++) {
        let x = (i * 110 - ox) % (W + 260);
        if (x < -260) x += W + 260;
        g.fillStyle = '#3b3f52';
        g.fillRect(x, 62, 96, 58);
        g.fillStyle = '#2b2f3e';
        g.fillRect(x, 58, 96, 5);
        g.fillStyle = '#ffe9a8';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
          if ((r + c + i) % 3 === 0) g.fillRect(x + 8 + c * 14, 70 + r * 16, 8, 9);
        }
      }
    } else if (sky === 'highway') {
      g.fillStyle = '#242a45';
      g.fillRect(0, 84, W, 36);
      const fast = Math.round(ox * 1.6), slow = Math.round(ox * 0.7);
      for (let i = 0; i < 20; i++) {
        let x = (i * 47 - fast) % (W + 80);
        if (x < -80) x += W + 80;
        g.fillStyle = i % 3 === 0 ? '#ffd166' : '#8fa8d8';
        g.fillRect(x, 92 + (i % 4) * 6, 3, 2);
      }
      g.fillStyle = '#1a1f36';
      for (let i = 0; i < 9; i++) {
        let x = (i * 96 - slow) % (W + 200);
        if (x < -200) x += W + 200;
        g.fillRect(x, 48, 54, 40);
      }
    } else {
      // A stadium bowl: the deck, then the deck above it.
      const deck = sky === 'bigleague' ? '#1c2444' : '#6f6a62';
      const deck2 = sky === 'bigleague' ? '#26305a' : '#847d73';
      g.fillStyle = deck;
      g.fillRect(0, 54, W, 66);
      g.fillStyle = deck2;
      g.fillRect(0, 54, W, 4);
      g.fillRect(0, 86, W, 4);
      // Bunting, because it is a big day.
      if (sky === 'bigleague') {
        for (let i = 0; i < 40; i++) {
          const x = i * 9 - (ox % 9);
          g.fillStyle = i % 2 ? '#c8102e' : '#f6f2e4';
          g.fillRect(x, 58, 8, 5);
          g.fillRect(x + 2, 63, 4, 3);
        }
      }
    }
  }

  /* A crowd is dots that bob. Two rows of them, out of step, and at this size
   * the eye fills in a stadium. */
  function crowd(g, th, camX, t, W, H) {
    const ox = Math.round(camX * 0.25);
    const cols = ['#e8b07a', '#c98e5b', '#f6f2e4', '#d8433f', '#3f8fd8', '#2fb3c9', '#f0a726'];
    for (let row = 0; row < 3; row++) {
      const y = 64 + row * 11;
      for (let i = 0; i < 70; i++) {
        let x = (i * 7 - ox) % (W + 30);
        if (x < -30) x += W + 30;
        const bob = Math.sin(t * 3 + i * 0.8 + row) > 0.72 ? -2 : 0;
        g.fillStyle = cols[(i * 3 + row * 5) % cols.length];
        g.fillRect(x, y + bob, 4, 5);
        g.fillStyle = th.night ? '#2a3050' : '#00000022';
        g.fillRect(x, y + 5 + bob, 4, 1);
      }
    }
  }

  function midLayer(g, th, camX, t, W, H) {
    const ox = Math.round(camX * 0.5);

    if (th.mid === 'fence') {
      const y = 104;
      g.fillStyle = '#9aa0a8';
      g.fillRect(0, y, W, 2);
      for (let i = 0; i < 60; i++) {
        let x = (i * 6 - ox) % (W + 20);
        if (x < -20) x += W + 20;
        g.fillStyle = '#8b9199';
        g.fillRect(x, y, 1, 16);
      }
      g.fillStyle = '#6e747c';
      for (let i = 0; i < 12; i++) {
        let x = (i * 40 - ox) % (W + 60);
        if (x < -60) x += W + 60;
        g.fillRect(x, y, 2, 18);
      }
    } else if (th.mid === 'bus') {
      for (let i = 0; i < 4; i++) {
        let x = (i * 190 - ox) % (W + 260);
        if (x < -260) x += W + 260;
        g.fillStyle = '#c8b05a';
        g.fillRect(x, 92, 120, 26);
        g.fillStyle = '#2a2f3e';
        g.fillRect(x + 6, 96, 100, 10);
        g.fillStyle = '#ffe9a8';
        for (let w0 = 0; w0 < 6; w0++) g.fillRect(x + 10 + w0 * 16, 98, 10, 7);
        g.fillStyle = '#1a1f2c';
        g.fillRect(x + 16, 116, 12, 6);
        g.fillRect(x + 88, 116, 12, 6);
      }
    } else {
      // The outfield wall, with the numbers painted on it.
      const y = 96;
      g.fillStyle = '#1f4d2f';
      g.fillRect(0, y, W, 24);
      g.fillStyle = '#2a6b3f';
      g.fillRect(0, y, W, 3);
      g.fillStyle = '#f6f2e4';
      g.fillRect(0, y + 20, W, 1);
      for (let i = 0; i < 6; i++) {
        let x = (i * 120 - ox) % (W + 200);
        if (x < -200) x += W + 200;
        text(g, ['395', '410', '375'][i % 3], x, y + 8, '#e8e3d2', 1);
      }
    }
  }

  /* ================================================================ weather */
  function rain(g, camX, t, W, H) {
    g.fillStyle = 'rgba(180,205,230,0.5)';
    const drift = Math.round((t * 320 + camX * 0.6) % 400);
    const fall = Math.round(t * 520);
    for (let i = 0; i < 90; i++) {
      const x = (i * 37 + drift) % (W + 40) - 20;
      const y = (i * 53 + fall) % (H + 20);
      g.fillRect(x, y, 1, 5);
    }
  }

  return {
    GLYPHS, text, textShadow, textWidth,
    spr, sprSize, sprFlash, bat,
    THEMES, KITS, BASE, tile, backdrop, rain, hash,
    T,
  };
})();
