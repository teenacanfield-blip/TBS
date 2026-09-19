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
 * Two rules the art follows, and they are why it reads at this size:
 *
 *   Everything has an outline. At twelve pixels across, a figure without a
 *   dark edge dissolves into whatever is behind it the moment the background
 *   is busy — and the backgrounds here are crowds.
 *
 *   Everything is lit from the top left. Highlights on the top and left edges,
 *   shade on the bottom and right, on the sprites and on the tiles alike. Two
 *   tones and one consistent direction do more for a 16px block of dirt than
 *   ten colours scattered about.
 *
 * Tiles are drawn with rectangles rather than typed out, because they are
 * themed per league and a rectangle takes a colour argument — but each one is
 * baked to its own little canvas too, keyed by which of its neighbours are
 * open, so the grass knows where its edges are and the whole floor costs one
 * drawImage a tile.
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
    px = Math.round(px); y = Math.round(y);
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
    k: '#1c1426',   // the outline, on everything
    K: '#342a42',   // a softer inner line, for folds and creases

    s: '#f2bd8c',   // skin
    S: '#c9895a',   // skin, shaded
    e: '#1c1426',   // eye

    j: '#f7f3e6',   // jersey
    J: '#cdc6b2',   // jersey, shaded
    H: '#ffffff',   // jersey, lit
    a: '#d8433f',   // team accent: cap, sleeve, number
    A: '#8e2523',   // team accent, shaded
    g: '#dfe3ea',   // trousers
    G: '#aeb4c0',   // trousers, shaded
    c: '#2a2230',   // cleats

    b: '#c08a4a',   // bat
    B: '#8a5c2c',   // bat, shaded
    l: '#a8703f',   // leather
    L: '#7d5730',   // leather, shaded

    w: '#ffffff',   // ball
    W: '#d7dbe4',   // ball, shaded
    r: '#d8433f',   // stitching

    d: '#2c2436',   // feathers
    D: '#4a4059',   // feathers, lit
    o: '#ffa53d',   // beak, warning stripe
    O: '#cc7515',   // beak, shaded

    m: '#8b93a3',   // metal
    M: '#4e5566',   // metal, shaded
    n: '#c3cbd8',   // metal, lit

    f: '#a06a3c',   // fur
    F: '#6b4526',   // fur, shaded

    p: '#ff86c2',   // gum
    P: '#d4589b',   // gum, shaded
    y: '#ffd166',   // gold
    Y: '#c9932b',   // gold, shaded
    t: '#8fe3ff',   // cyan, for anything that wants attention
    v: '#9b6bd8',   // rival purple
    V: '#5f3d91',   // rival purple, shaded
  };

  // The kit changes as the leagues do: dirt-lot cream, school colours, then
  // the whites and pinstripes of a place with a groundskeeper.
  const KITS = {
    sandlot: { j: '#e9e2cd', J: '#c2b89c', H: '#f6f1e2', a: '#d8433f', A: '#8e2523', g: '#cbbfa4', G: '#9c8b70' },
    little:  { j: '#f7f3e6', J: '#cdc6b2', H: '#ffffff', a: '#3f8fd8', A: '#23558e', g: '#dfe3ea', G: '#aab0ba' },
    school:  { j: '#f2ead8', J: '#c9c0aa', H: '#fdf8ea', a: '#3fb87a', A: '#1f6f47', g: '#e3e6ea', G: '#aeb3bb' },
    college: { j: '#fbf7ea', J: '#d4cebc', H: '#ffffff', a: '#f0a726', A: '#a86f11', g: '#e9ecf1', G: '#b3b8c1' },
    single:  { j: '#eef0f2', J: '#c5c8cd', H: '#ffffff', a: '#8a53d0', A: '#57318a', g: '#dde0e6', G: '#a7abb4' },
    double:  { j: '#e6e9ee', J: '#bbbfc7', H: '#f7f9fc', a: '#e05c2a', A: '#8f3413', g: '#d5d9e1', G: '#9ea2ac' },
    triple:  { j: '#f4f6fa', J: '#c8ccd4', H: '#ffffff', a: '#2fb3c9', A: '#186876', g: '#e2e6ee', G: '#a9adb7' },
    show:    { j: '#ffffff', J: '#d2d6df', H: '#ffffff', a: '#c8102e', A: '#7d0a1d', g: '#f0f3f8', G: '#b6bac4' },
  };

  /* ================================================================= sprites */
  /* One character per pixel, '.' left clear. Width comes from the first row; a
   * row of the wrong length is a typo, so it is shouted about once rather than
   * quietly drawing crooked art.
   *
   * The ballplayer is 12 wide and 18 tall and is drawn without his bat — the
   * bat is a rectangle the game rotates at his hands, which is how one sprite
   * can swing through a whole arc. */

  const SPRITES = {
    /* ---------------------------------------------------- the ballplayer */
    idle0: [
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk....',
      '.kjHjjjjk...',
      '.kjajjjjk...',
      '.kjjjjjJk...',
      '..kJjjJk....',
      '..kggggk....',
      '..kgGgGk....',
      '..kgk.kgk...',
      '..kck.kck...',
      '.kcck.kcck..',
    ],
    idle1: [
      '............',
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk....',
      '.kjHjjjjk...',
      '.kjajjjjk...',
      '..kjjjJk....',
      '..kggggk....',
      '..kgGgGk....',
      '..kgk.kgk...',
      '..kck.kck...',
      '.kcck.kcck..',
    ],
    // Four frames of running: contact, passing, contact, passing. The arms
    // swap with the legs, which is the whole trick.
    run0: [
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk.ks.',
      '.kjHjjjjkss.',
      'skjajjjjk...',
      'ksjjjjjJk...',
      '..kJjjJk....',
      '.kgggggk....',
      '.kgk.kGgk...',
      'kgk...kGgk..',
      'kck....kck..',
      'kcck...kcck.',
    ],
    run1: [
      '............',
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk.s..',
      '.kjHjjjjks..',
      '.kjajjjjk...',
      '..kjjjJk....',
      '..kggggk....',
      '..kggGgk....',
      '..kgkkGgk...',
      '.kck..kck...',
      '.kcck.kcck..',
    ],
    run2: [
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '.sk kjjkk...',
      'sskjHjjjjk..',
      '..kjajjjjks.',
      '..kjjjjjJks.',
      '..kJjjJk....',
      '..kgggggk...',
      '.kGgk.kggk..',
      '.kGk...kgk..',
      '.kck...kck..',
      'kcck..kcck..',
    ],
    run3: [
      '............',
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk....',
      '.kjHjjjjk.s.',
      '.kjajjjjkss.',
      '..kjjjJk....',
      '..kggggk....',
      '..kgGggk....',
      '.kgGkkgk....',
      '.kck..kck...',
      'kcck..kcck..',
    ],
    // Going up: knees tucked, arms up.
    jump: [
      '...s.kkkk.s.',
      '..sskaaaakss',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk....',
      '.kjHjjjjk...',
      '.kjajjjjk...',
      '.kjjjjjJk...',
      '..kJjjJk....',
      '..kggggk....',
      '.kGgkkgGk...',
      '.kgk..kgk...',
      '.kck..kck...',
      'kcck...kcck.',
    ],
    // Coming down: arms out, legs reaching.
    fall: [
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      'skkkjjkkks..',
      'sskjHjjjjkss',
      '.kjajjjjk...',
      '.kjjjjjJk...',
      '..kJjjJk....',
      '..kggggk....',
      '..kgk.kgk...',
      '.kgk...kgk..',
      '.kck...kck..',
      'kcck....kcck',
    ],
    // Loaded up: weight back, knees bent, half a beat before the swing.
    load: [
      '............',
      '............',
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..ksssssk...',
      '..ksesssk...',
      '..kSssssk...',
      '...kSssk....',
      '..kkjjkk....',
      '.kjHjjjjk...',
      '.kjajjjjk...',
      '.kJjjjjJk...',
      '.kggggggk...',
      '.kgGk.kGgk..',
      'kcck...kcck.',
      '............',
    ],
    hurt: [
      '..s.kkkk..s.',
      '.sskaaaaks..',
      '..kaaaaaakk.',
      '..kAaaaaakk.',
      '..kssssskk..',
      '..kssesskk..',
      '..kSssssk...',
      '...kSssk....',
      '.kkkjjkkk...',
      '.kjHjjjjk...',
      '.kjajjjjk...',
      '..kjjjjJk...',
      '..kJjjJk....',
      '..kggggk....',
      '.kGgk.kgk...',
      'kGgk...kgk..',
      'kck.....kck.',
      'kck......kck',
    ],

    /* The helmet, laid over the cap. One body, two hats. */
    helmet: [
      '....kkkk....',
      '...kaaaak...',
      '..kaaaaaakk.',
      '..kaAaaaakk.',
      '..kaak......',
    ],

    /* ------------------------------------------------------- pickups, 10x10 */
    ball: [
      '..wwww..',
      '.wwwwWW.',
      'wrwwwwrW',
      'wrrwwrrW',
      'wwrwwrwW',
      'wwrwwrwW',
      '.WwwwwW.',
      '..WWWW..',
    ],
    card: [
      'kkkkkkkkkk',
      'kjjjjjjjjk',
      'kjaaaaaajk',
      'kjjwwwwjjk',
      'kjjwsswjjk',
      'kjjwwwwjjk',
      'kjjjbjjjjk',
      'kjjjjjjjjk',
      'kjJJJJJJjk',
      'kkkkkkkkkk',
    ],
    pickHelmet: [
      '...kkkk...',
      '..kaaaak..',
      '.kaaaaaak.',
      'kaAaaaaaak',
      'kaaaaaaaak',
      'kaakaaaaak',
      'kkkkkkkkkk',
      '..........',
      '..........',
      '..........',
    ],
    pickBat: [
      '.......kyk',
      '......kyyk',
      '.....kyyk.',
      '....kyyk..',
      '...kyYk...',
      '..kyYk....',
      '.kyYk.....',
      'kYYk......',
      'kYk.......',
      'kk........',
    ],
    pickCleats: [
      '..........',
      '..kkkk....',
      '.ktttkkk..',
      'kttttttkk.',
      'ktttttttk.',
      'kkkkkkkkk.',
      '.k.k.k.k..',
      '..........',
      '..........',
      '..........',
    ],
    pickGum: [
      '...kkk....',
      '..kpppk...',
      '.kpwppPk..',
      'kpppppPPk.',
      'kpppppPPk.',
      'kPpppPPPk.',
      '.kPPPPPk..',
      '..kkkkk...',
      '..........',
      '..........',
    ],
    pickArm: [
      '..kkkk....',
      '.klllllk..',
      'kllwwlllk.',
      'klwwwwllk.',
      'klwwwllLk.',
      'kllllLLLk.',
      '.kllLLLk..',
      '..kkkkk...',
      '..........',
      '..........',
    ],

    /* ---------------------------------------------------------- enemies */
    // A crow, 14x12. It walks, it turns at edges, and it is the first thing
    // in the game you are allowed to land on.
    crow0: [
      '....kkkkk.....',
      '...kdddddk....',
      '..kddwdddk....',
      '..kddedddkoo..',
      '..kdddddkOOo..',
      '.kdddddddk....',
      '.kdDDddddk....',
      '.kdDDddddk....',
      '..kdddddk.....',
      '...kkdkk......',
      '....o.o.......',
      '...ooo.ooo....',
    ],
    crow1: [
      '..kD..........',
      '...kDdkkk.....',
      '...kdddddk....',
      '..kddwdddkoo..',
      '..kddedddkOo..',
      '..kdddddk.....',
      '.kdddddddk....',
      '.kddddddk.....',
      '..kdddddk.....',
      '...kkdkk......',
      '....ooo.......',
      '...ooo.ooo....',
    ],
    // A gopher, 12x12, in and out of his hole. Gopher ball, obviously.
    gopher0: [
      '..kkffkk....',
      '.kffffffk...',
      'kfffffffffk.',
      'kffefffefk..',
      'kfffffffk...',
      'kffwwwwffk..',
      '.kfwFFwfk...',
      '.kFffffFk...',
      '..kFFFFk....',
      '...kkkk.....',
      '............',
      '............',
    ],
    gopher1: [
      '............',
      '............',
      '..kkffkk....',
      '.kffffffk...',
      'kfffffffffk.',
      'kffefffefk..',
      'kfffffffk...',
      'kffwwwwffk..',
      '.kfwFFwfk...',
      '.kFffffFk...',
      '..kFFFFk....',
      '...kkkk.....',
    ],
    // A pitching machine, 18x16. It throws; you hit what it throws back at it.
    machine0: [
      '......kkkkk.......',
      '....kknnnnnkk.....',
      '...knnmmmmmnnk....',
      '..knmMMMMMMMmnk...',
      '..knM.......Mnk...',
      '..knM..wWw..Mnk...',
      '..knM..WwW..Mnk...',
      '..knM.......Mnk...',
      '..knmMMMMMMMmnk...',
      '...knnmmmmmnnk....',
      '.....kmmmmmk......',
      '....kMMMMMMMk.....',
      '...kMMmmmmmMMk....',
      '..kMMk.....kMMk...',
      '..kMk.......kMk...',
      '..kkk.......kkk...',
    ],
    machine1: [
      '......kkkkk.......',
      '....kknnnnnkk.....',
      '...knnmmmmmnnk....',
      '..knmMMMMMMMmnk...',
      '..knM.......Mnk.w.',
      '..knM.......Mnkww.',
      '..knM..wWw..Mnk.w.',
      '..knM.......Mnk...',
      '..knmMMMMMMMmnk...',
      '...knnmmmmmnnk....',
      '.....kmmmmmk......',
      '....kMMMMMMMk.....',
      '...kMMmmmmmMMk....',
      '..kMMk.....kMMk...',
      '..kMk.......kMk...',
      '..kkk.......kkk...',
    ],
    // A rival with a helmet on, 14x18. The helmet is the point: you cannot
    // stomp him, so he is the reason the bat exists.
    rival0: [
      '....kkkkk.....',
      '...kvvvvvk....',
      '..kvvvvvvvkk..',
      '..kvVvvvvvkk..',
      '..kvvksssk....',
      '..kvkssessk...',
      '...kSsssssk...',
      '....kSsssk....',
      '...kkJJkk.....',
      '..kJJJJJJk....',
      '..kJvJJJJk....',
      '..kJJJJJGk....',
      '...kGJJGk.....',
      '...kGGGGk.....',
      '...kGgGgk.....',
      '...kGk.kGk....',
      '...kck.kck....',
      '..kcck.kcck...',
    ],
    rival1: [
      '..............',
      '....kkkkk.....',
      '...kvvvvvk....',
      '..kvvvvvvvkk..',
      '..kvVvvvvvkk..',
      '..kvvksssk....',
      '..kvkssessk...',
      '...kSsssssk...',
      '....kSsssk....',
      '...kkJJkk.....',
      '..kJJJJJJk....',
      '..kJvJJJJk....',
      '...kJJJGk.....',
      '...kGGGGk.....',
      '...kGGgGGk....',
      '..kGGk.kGk....',
      '..kck..kck....',
      '.kcck..kcck...',
    ],
    // A curveball with a grin on it, 12x12. It weaves. Stomping a spinning
    // ball does not work; the bat does.
    slider0: [
      '...kkkkk....',
      '..kwwwwwk...',
      '.kwrwwwrwk..',
      'kwwrwwwrwwk.',
      'kwewwwwewwk.',
      'kwwwwwwwwWk.',
      'kwwrrrrwwWk.',
      'kwrwwwwrwWk.',
      '.kwrwwwrWk..',
      '..kWwwwWk...',
      '...kkkkk....',
      '............',
    ],
    slider1: [
      '...kkkkk....',
      '..kwwwwwk...',
      '.kwwwrrwwk..',
      'kwwwwwwwwwk.',
      'kwewwwwewwk.',
      'kwrwwwwrwWk.',
      'kwrrrrrrwWk.',
      'kwrwwwwrwWk.',
      '.kwwwrrwWk..',
      '..kWwwwWk...',
      '...kkkkk....',
      '............',
    ],
    // The Closer, 24x30. He is the last level, and he only throws heat.
    closer0: [
      '.......kkkkkkkk.......',
      '......kaaaaaaaak......',
      '.....kaaaaaaaaaak.....',
      '.....kaAAaaaaaaakk....',
      '.....kssssssssssk.....',
      '.....ksseessseesk.....',
      '.....ksssssssssskk....',
      '......kSssssssSk......',
      '.......kSSsssSk.......',
      '....kkkjjjjjjkkk......',
      '...kjjjjjjjjjjjjk.....',
      '..kjjjjjjaajjjjjjk....',
      '..kjHjjjjaajjjjjjk....',
      '..kjHjjjjjjjjjjjjk....',
      '..kjjjjjjjjjjjjjJk....',
      '..kjjjjjjjjjjjjjJk....',
      '...kjjjjjjjjjjjJk.....',
      '....kJJJJJJJJJJk......',
      '.....kgggggggggk......',
      '.....kgggggggggk......',
      '.....kgGgggggGgk......',
      '.....kggk...kggk......',
      '.....kggk...kggk......',
      '.....kGgk...kGgk......',
      '.....kGgk...kGgk......',
      '....kccck...kccck.....',
      '....kccck...kccck.....',
      '......................',
      '......................',
      '......................',
    ],
    closer1: [
      '.......kkkkkkkk.......',
      '......kaaaaaaaak......',
      '.....kaaaaaaaaaak.....',
      '.....kaAAaaaaaaakk....',
      '.....kssssssssssk.....',
      '.....ksseessseesk.....',
      '.....ksssssssssskk....',
      '......kSssssssSk......',
      '..ss...kSSsssSk.......',
      '.sskkkkjjjjjjkkk......',
      '..kjjjjjjjjjjjjk......',
      '..kjjjjjjaajjjjjjk....',
      '...kjHjjjaajjjjjjk....',
      '...kjHjjjjjjjjjjjk....',
      '...kjjjjjjjjjjjjJk....',
      '....kjjjjjjjjjjjJk....',
      '....kjjjjjjjjjjJk.....',
      '.....kJJJJJJJJJk......',
      '.....kgggggggggk......',
      '.....kgggggggggk......',
      '.....kgGgggggGgk......',
      '.....kggk..kggk.......',
      '....kggk....kggk......',
      '....kGgk.....kGgk.....',
      '...kGgk......kGgk.....',
      '...kccck....kccck.....',
      '..kccck.....kccck.....',
      '......................',
      '......................',
      '......................',
    ],
  };

  /* ------------------------------------------------------------ the bakery */

  const cache = new Map();      // "name|kit|flip" -> canvas
  const warned = new Set();     // sprites already complained about

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
      // A row of the wrong length is a typo in the art, and it draws crooked
      // rather than failing, so it has to say so out loud — once per sprite,
      // naming the row, which is the only part that is hard to find by eye.
      if (row.length !== w && !warned.has(name + y)) {
        warned.add(name + y);
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

  /* A sprite as one flat colour: the frame something dies on, and the hit
   * flash on anything that takes more than one. It goes through a scratch
   * canvas so the fill has a clean alpha mask to sit inside. */
  const scratch = document.createElement('canvas');
  scratch.width = 32; scratch.height = 32;
  let sg = scratch.getContext('2d');

  function sprFlash(g, name, x, y, flip, kit, colour) {
    const cv = bake(name, kit || 'sandlot', flip);
    if (!cv) return;
    if (scratch.width < cv.width || scratch.height < cv.height) {
      scratch.width = Math.max(scratch.width, cv.width);
      scratch.height = Math.max(scratch.height, cv.height);
      sg = scratch.getContext('2d');
    }
    sg.clearRect(0, 0, scratch.width, scratch.height);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(cv, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    sg.fillStyle = colour;
    sg.fillRect(0, 0, cv.width, cv.height);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, 0, 0, cv.width, cv.height,
                Math.round(x), Math.round(y), cv.width, cv.height);
  }

  /* ==================================================================== bat */
  /* The bat is not a sprite. It is a tapered rectangle walked out from the
   * hands a pixel at a time, which is the whole reason the swing can be a real
   * arc instead of three frames pretending to be one. No transforms, so it
   * lands on the same grid as everything else. */
  function bat(g, hx, hy, angle, len, kit, gold) {
    const pal = Object.assign({}, BASE, KITS[kit] || null);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const wood = gold ? '#ffd166' : pal.b;
    const dark = gold ? '#c9932b' : pal.B;
    const lit = gold ? '#fff0b8' : '#dcae72';

    for (let i = 0; i < len; i++) {
      const f = i / len;
      const x = Math.round(hx + ca * i);
      const y = Math.round(hy + sa * i);
      const thick = f < 0.3 ? 2 : f < 0.62 ? 3 : 4;
      const half = thick >> 1;
      g.fillStyle = f < 0.18 ? dark : wood;
      g.fillRect(x, y - half, 1, thick);
      // One lit pixel along the top edge gives the barrel a roundness that a
      // flat bar of colour never has.
      if (f > 0.2) { g.fillStyle = lit; g.fillRect(x, y - half, 1, 1); }
    }
    // The knob.
    g.fillStyle = dark;
    g.fillRect(Math.round(hx - ca * 2) - 1, Math.round(hy - sa * 2) - 1, 2, 2);
  }

  /* ================================================================== tiles */
  /* Themes are the league you are in. Every tile takes its colours from here,
   * which is why the same level geometry reads as a dirt lot in one place and
   * a ballpark in another. */
  const THEMES = {
    sandlot: {
      id: 'sandlot', kit: 'sandlot',
      sky: ['#7fcdf0', '#dff0f7'], sun: '#fff3c4',
      ground: '#c08f5a', groundTop: '#5fb94a', groundLit: '#7ed166', groundDark: '#8a5f36',
      soil: '#a9784a', brick: '#b4805a', far: 'trees', mid: 'fence',
      crowd: false, lights: false, night: false, cloud: '#ffffff', music: 'sand', shift: 0,
    },
    little: {
      id: 'little', kit: 'little',
      sky: ['#6cc0ec', '#e6f4fb'], sun: '#fff6cf',
      ground: '#b98a55', groundTop: '#63c254', groundLit: '#84d86f', groundDark: '#82602f',
      soil: '#a17244', brick: '#c98f55', far: 'houses', mid: 'fence',
      crowd: true, lights: false, night: false, cloud: '#ffffff', music: 'sand', shift: 2,
    },
    school: {
      id: 'school', kit: 'school',
      sky: ['#151f45', '#41548a'], sun: '#dfe8ff',
      ground: '#6b5a48', groundTop: '#3f8f4a', groundLit: '#54a75c', groundDark: '#41362a',
      soil: '#5b4c3d', brick: '#7a6552', far: 'school', mid: 'fence',
      crowd: true, lights: true, night: true, cloud: '#5d6d9c', music: 'sand', shift: -3,
    },
    college: {
      id: 'college', kit: 'college',
      sky: ['#4fa9e0', '#ffe2ab'], sun: '#fff0b8',
      ground: '#c2884f', groundTop: '#4fb04a', groundLit: '#6cc763', groundDark: '#8a5c2e',
      soil: '#ab7440', brick: '#c58a4e', far: 'stadium', mid: 'wall',
      crowd: true, lights: false, night: false, cloud: '#fff4dd', music: 'minors', shift: 0,
    },
    single: {
      id: 'single', kit: 'single',
      sky: ['#141b33', '#343a63'], sun: '#cdd6ff',
      ground: '#4b4a5c', groundTop: '#5a6a7a', groundLit: '#6f8092', groundDark: '#2c2b38',
      soil: '#3e3d4d', brick: '#5b5a6c', far: 'highway', mid: 'bus',
      crowd: false, lights: true, night: true, cloud: '#3f4470', music: 'minors', shift: -2,
    },
    double: {
      id: 'double', kit: 'double',
      sky: ['#44525f', '#8a97a1'], sun: '#c6d2da',
      ground: '#7a6247', groundTop: '#4e7a45', groundLit: '#5f8f55', groundDark: '#4a3b2b',
      soil: '#69543c', brick: '#856a4c', far: 'stadium', mid: 'wall',
      crowd: true, lights: true, night: false, cloud: '#aab5be', rain: true, music: 'minors', shift: 3,
    },
    triple: {
      id: 'triple', kit: 'triple',
      sky: ['#2472b6', '#bfe4ff'], sun: '#fff6d8',
      ground: '#b8834e', groundTop: '#46b05a', groundLit: '#61c473', groundDark: '#82592f',
      soil: '#a2723f', brick: '#bd8a52', far: 'stadium', mid: 'wall',
      crowd: true, lights: true, night: false, cloud: '#ffffff', music: 'minors', shift: 5,
    },
    show: {
      id: 'show', kit: 'show',
      sky: ['#0b1330', '#243a72'], sun: '#e8eeff',
      ground: '#a8703f', groundTop: '#3fa85a', groundLit: '#55bd6d', groundDark: '#6f4622',
      soil: '#8f5f34', brick: '#b07a45', far: 'bigleague', mid: 'wall',
      crowd: true, lights: true, night: true, cloud: '#2b3668', music: 'show', shift: 0,
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

  /* Every tile is baked once per (theme, character, which neighbours are open,
   * variant) and then stamped. Four variants of dirt is the difference between
   * a floor and a wallpaper, and baking means the extra detail is free after
   * the first frame it appears on. */
  const tiles = new Map();

  function paintGround(g, th, nb, v) {
    const up = nb & 1, left = nb & 2, right = nb & 4;

    g.fillStyle = th.ground;
    g.fillRect(0, 0, T, T);

    /* Mottled, not banded. The first version of this drew two horizontal
     * stripes of darker soil in every tile, which lined up across the whole
     * level and turned a hillside into plywood. Scattering the same amount of
     * ink at positions seeded from the variant gives four tiles that tessellate
     * in any order without a seam showing. */
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(hash(v * 53 + i, i * 17 + 3) * 15);
      const y = 3 + Math.floor(hash(i * 29 + 5, v * 11 + 7) * 12);
      if (y >= T) continue;
      g.fillStyle = i % 4 === 0 ? th.groundDark
                  : i % 3 === 0 ? th.soil
                  : 'rgba(255,255,255,0.045)';
      g.fillRect(x, y, i % 5 === 0 ? 3 : 2, 1);
    }
    // A few stones, lit on top like everything else.
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(v * 7 + i, 91) * 13);
      const y = 7 + Math.floor(hash(i, v * 3 + 1) * 8);
      if (y >= T - 1) continue;
      g.fillStyle = th.soil;
      g.fillRect(x, y, 2, 2);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x, y, 2, 1);
    }

    if (up) {
      // Grass: a lit top edge, the body of it, a dark line where it meets the
      // earth, and a few blades standing up out of the line.
      g.fillStyle = th.groundTop;
      g.fillRect(0, 0, T, 5);
      g.fillStyle = th.groundLit;
      g.fillRect(0, 0, T, 2);
      g.fillStyle = th.groundDark;
      g.fillRect(0, 5, T, 1);
      g.fillStyle = th.groundTop;
      for (let i = 0; i < 4; i++) {
        const bx = Math.floor(hash(v * 7 + i, 11) * 15);
        g.fillRect(bx, 6, 1, 1);
      }
      // Tufts hanging over an open edge.
      if (left) { g.fillStyle = th.groundLit; g.fillRect(0, 2, 1, 4); }
      if (right) { g.fillStyle = th.groundLit; g.fillRect(T - 1, 2, 1, 4); }
    }

    // Shading on the open sides, which is what makes a cliff edge read as one.
    if (left) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, up ? 6 : 0, 2, T - (up ? 6 : 0));
    }
    if (right) {
      g.fillStyle = 'rgba(0,0,0,0.26)';
      g.fillRect(T - 2, up ? 6 : 0, 2, T - (up ? 6 : 0));
    }
    // Nothing along the top of a buried tile: a one pixel shadow there is
    // invisible on its own and a stripe every sixteen pixels once the ground
    // is four tiles deep.
  }

  function paintBrick(g, th, nb) {
    g.fillStyle = th.brick;
    g.fillRect(0, 0, T, T);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(0, 7, T, 1);
    g.fillRect(0, 15, T, 1);
    g.fillRect(7, 0, 1, 7);
    g.fillRect(0, 8, 1, 7);
    g.fillRect(15, 8, 1, 7);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(0, 0, T, 1);
    g.fillRect(0, 8, T, 1);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(2, 3, 3, 1);
    g.fillRect(10, 11, 3, 1);
  }

  function paintStone(g, th) {
    g.fillStyle = th.groundDark;
    g.fillRect(0, 0, T, T);
    g.fillStyle = th.brick;
    g.fillRect(1, 1, T - 2, T - 2);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(1, 1, T - 2, 1);
    g.fillRect(1, 1, 1, T - 2);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(1, T - 2, T - 2, 1);
    g.fillRect(T - 2, 1, 1, T - 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(4, 5, 2, 2);
    g.fillRect(9, 10, 2, 2);
  }

  function paintPlank(g) {
    g.fillStyle = '#5c4326';
    g.fillRect(0, 0, T, 6);
    g.fillStyle = '#c99a5c';
    g.fillRect(0, 0, T, 4);
    g.fillStyle = '#e6c089';
    g.fillRect(0, 0, T, 1);
    g.fillStyle = '#a8763f';
    g.fillRect(2, 2, 5, 1);
    g.fillRect(9, 3, 4, 1);
    g.fillStyle = '#3d2c18';
    g.fillRect(2, 1, 1, 1);
    g.fillRect(13, 1, 1, 1);
  }

  function paintCrate(g) {
    g.fillStyle = '#8a5c26';
    g.fillRect(0, 0, T, T);
    g.fillStyle = '#c08a4a';
    g.fillRect(1, 1, T - 2, T - 2);
    g.fillStyle = '#d8a86a';
    g.fillRect(1, 1, T - 2, 1);
    g.fillRect(1, 1, 1, T - 2);
    g.fillStyle = '#6f4a1e';
    g.fillRect(1, T - 2, T - 2, 1);
    g.fillRect(T - 2, 1, 1, T - 2);
    // Braces, corner to corner.
    g.fillStyle = '#a06f34';
    for (let i = 2; i < 14; i++) { g.fillRect(i, i, 1, 1); g.fillRect(15 - i, i, 1, 1); }
    // A ball stencilled on the lid.
    g.fillStyle = '#f2f4f8';
    g.fillRect(6, 6, 4, 4);
    g.fillRect(7, 5, 2, 6);
    g.fillRect(5, 7, 6, 2);
    g.fillStyle = '#d8433f';
    g.fillRect(6, 7, 1, 2);
    g.fillRect(9, 7, 1, 2);
  }

  function paintRake(g) {
    g.fillStyle = '#5c4326';
    g.fillRect(0, 12, T, 4);
    g.fillStyle = '#7d5a30';
    g.fillRect(0, 12, T, 1);
    for (let i = 0; i < 4; i++) {
      const x = 1 + i * 4;
      g.fillStyle = '#9aa2b0';
      g.fillRect(x, 4, 2, 9);
      g.fillStyle = '#dfe6f0';
      g.fillRect(x, 4, 1, 9);
      g.fillStyle = '#eef3fa';
      g.fillRect(x, 2, 1, 3);
    }
  }

  function paintWall(g) {
    g.fillStyle = '#1b4029';
    g.fillRect(0, 0, T, T);
    g.fillStyle = '#245537';
    g.fillRect(0, 1, T, 6);
    g.fillStyle = '#2d6b45';
    g.fillRect(0, 0, T, 1);
    g.fillStyle = '#122c1c';
    g.fillRect(0, 7, T, 1);
    g.fillRect(15, 0, 1, T);
    g.fillStyle = '#ffd166';
    g.fillRect(0, 9, T, 1);
  }

  const PAINT = { '#': paintGround, X: paintBrick, S: paintStone, '=': paintPlank,
                  B: paintCrate, '^': paintRake, W: paintWall };

  function tileCanvas(th, ch, nb, v) {
    const key = th.id + ch + nb + v;
    const hit = tiles.get(key);
    if (hit) return hit;
    const cv = document.createElement('canvas');
    cv.width = T; cv.height = T;
    const g = cv.getContext('2d');
    const f = PAINT[ch];
    if (f) f(g, th, nb, v);
    tiles.set(key, cv);
    return cv;
  }

  /* `nb` is which neighbours are open: 1 above, 2 left, 4 right. */
  function tile(g, ch, tx, ty, px, py, th, nb) {
    // Eight variants of earth. Four was enough to see the pattern repeat.
    const v = ch === '#' ? (hash(tx, ty) * 8) | 0 : 0;
    g.drawImage(tileCanvas(th, ch, ch === '#' ? nb : 0, v), px, py);
  }

  /* =============================================================== backdrop */

  function backdrop(g, th, camX, camY, t, W, H) {
    // Sky, and a sun or a moon in it.
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, th.sky[0]);
    grad.addColorStop(1, th.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    const sx = W - 62, sy = 26;
    if (th.night) {
      const ox = Math.round(camX * 0.02);
      for (let i = 0; i < 46; i++) {
        let x = (i * 71 + 13 - ox) % (W + 40);
        if (x < 0) x += W + 40;
        const y = (i * 37) % 72;
        g.fillStyle = i % 5 === 0 ? '#e8f0ff' : i % 3 === 0 ? '#9db2e0' : '#6b7ba8';
        g.fillRect(x, y, 1, 1);
      }
      // A moon, with one crater and a soft edge.
      g.fillStyle = 'rgba(220,230,255,0.10)';
      g.fillRect(sx - 4, sy - 4, 20, 20);
      g.fillStyle = th.sun;
      g.fillRect(sx + 2, sy - 1, 8, 14);
      g.fillRect(sx, sy + 2, 12, 8);
      g.fillRect(sx + 1, sy + 1, 10, 10);
      g.fillStyle = 'rgba(150,165,200,0.5)';
      g.fillRect(sx + 3, sy + 3, 3, 2);
      g.fillRect(sx + 7, sy + 7, 2, 2);
    } else {
      g.fillStyle = 'rgba(255,240,180,0.13)';
      g.fillRect(sx - 6, sy - 6, 26, 26);
      g.fillStyle = th.sun;
      g.fillRect(sx + 2, sy - 2, 10, 18);
      g.fillRect(sx - 2, sy + 2, 18, 10);
      g.fillRect(sx, sy, 14, 14);
    }

    if (!th.night) {
      // Clouds: a lit top, a flat shaded underside.
      const ox = Math.round(camX * 0.08);
      for (let i = 0; i < 6; i++) {
        let cx = (i * 97 + 20 - ox) % (W + 130);
        if (cx < -130) cx += W + 130;
        const cy = 12 + (i * 23) % 34;
        g.fillStyle = th.cloud;
        g.fillRect(cx, cy, 32, 6);
        g.fillRect(cx + 6, cy - 4, 18, 6);
        g.fillRect(cx + 13, cy - 7, 10, 5);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(cx + 6, cy - 4, 16, 2);
        g.fillRect(cx + 13, cy - 7, 9, 2);
        g.fillStyle = 'rgba(90,110,150,0.20)';
        g.fillRect(cx, cy + 4, 32, 2);
      }
    }

    // Light towers, behind everything, for the leagues that have them.
    if (th.lights) {
      const ox = Math.round(camX * 0.18);
      for (let i = 0; i < 5; i++) {
        let lx = (i * 140 + 40 - ox) % (W + 300);
        if (lx < -300) lx += W + 300;
        if (th.night) {
          g.fillStyle = 'rgba(255,238,192,0.07)';
          g.fillRect(lx - 26, 24, 54, 78);
          g.fillStyle = 'rgba(255,238,192,0.05)';
          g.fillRect(lx - 40, 24, 82, 96);
        }
        g.fillStyle = '#242a38';
        g.fillRect(lx, 26, 4, 72);
        g.fillStyle = '#39415a';
        g.fillRect(lx, 26, 1, 72);
        for (let r = 30; r < 96; r += 8) { g.fillStyle = '#2d3447'; g.fillRect(lx - 2, r, 8, 1); }
        g.fillStyle = '#39415a';
        g.fillRect(lx - 11, 13, 26, 15);
        g.fillStyle = '#242a38';
        g.fillRect(lx - 11, 27, 26, 2);
        for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
          const on = th.night || (a + b) % 2 === 0;
          g.fillStyle = on ? '#fff6c8' : '#8e97ab';
          g.fillRect(lx - 9 + a * 8, 15 + b * 6, 6, 5);
          g.fillStyle = on ? '#ffffff' : '#a9b2c4';
          g.fillRect(lx - 9 + a * 8, 15 + b * 6, 6, 1);
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
        let x = (i * 63 + 10 - ox) % (W + 220);
        if (x < -220) x += W + 220;
        const h0 = 34 + (i * 17) % 24;
        const base = 122;
        g.fillStyle = '#4a3320';
        g.fillRect(x + 11, base - 10, 5, 12);
        // Canopy in three shelves, lit on top.
        g.fillStyle = '#245c2b';
        g.fillRect(x, base - h0, 28, h0 - 8);
        g.fillStyle = '#2f7436';
        g.fillRect(x + 2, base - h0 + 2, 24, h0 - 14);
        g.fillRect(x + 5, base - h0 - 7, 17, 9);
        g.fillStyle = '#3f9042';
        g.fillRect(x + 4, base - h0 + 2, 12, 5);
        g.fillRect(x + 7, base - h0 - 6, 9, 4);
      }
    } else if (sky === 'houses') {
      for (let i = 0; i < 12; i++) {
        let x = (i * 71 + 5 - ox) % (W + 220);
        if (x < -220) x += W + 220;
        const h0 = 28 + (i * 23) % 20;
        const base = 122;
        g.fillStyle = '#7a6874';
        g.fillRect(x, base - h0, 42, h0);
        g.fillStyle = '#8d7b86';
        g.fillRect(x, base - h0, 42, 2);
        g.fillStyle = '#4e4049';
        g.fillRect(x - 4, base - h0 - 8, 50, 9);
        g.fillStyle = '#5d4d58';
        g.fillRect(x - 4, base - h0 - 8, 50, 2);
        g.fillStyle = '#3a2f36';
        g.fillRect(x + 30, base - h0 - 16, 6, 9);
        for (let w0 = 0; w0 < 3; w0++) {
          g.fillStyle = (i + w0) % 4 === 0 ? '#3c3138' : '#ffe9a8';
          g.fillRect(x + 5 + w0 * 12, base - h0 + 9, 7, 7);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x + 5 + w0 * 12, base - h0 + 15, 7, 1);
        }
      }
    } else if (sky === 'school') {
      for (let i = 0; i < 8; i++) {
        let x = (i * 110 - ox) % (W + 280);
        if (x < -280) x += W + 280;
        g.fillStyle = '#32384c';
        g.fillRect(x, 60, 100, 62);
        g.fillStyle = '#3d4459';
        g.fillRect(x, 60, 100, 2);
        g.fillStyle = '#272c3c';
        g.fillRect(x, 56, 100, 5);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
          const lit = (r + c + i) % 3 === 0;
          g.fillStyle = lit ? '#ffe9a8' : '#20253a';
          g.fillRect(x + 8 + c * 15, 70 + r * 17, 9, 10);
          if (lit) { g.fillStyle = 'rgba(255,233,168,0.18)'; g.fillRect(x + 6 + c * 15, 68 + r * 17, 13, 14); }
        }
      }
    } else if (sky === 'highway') {
      g.fillStyle = '#1d2440';
      g.fillRect(0, 80, W, 42);
      g.fillStyle = '#262e4e';
      g.fillRect(0, 80, W, 2);
      const slow = Math.round(ox * 0.7), fast = Math.round(ox * 1.6);
      // A skyline behind, then traffic in front of it.
      g.fillStyle = '#161c33';
      for (let i = 0; i < 9; i++) {
        let x = (i * 96 - slow) % (W + 220);
        if (x < -220) x += W + 220;
        const h0 = 30 + (i * 19) % 26;
        g.fillRect(x, 80 - h0, 54, h0);
        g.fillStyle = '#2a3560';
        for (let r = 0; r < 4; r++) if ((i + r) % 2) g.fillRect(x + 6 + r * 12, 80 - h0 + 8, 5, 5);
        g.fillStyle = '#161c33';
      }
      for (let i = 0; i < 22; i++) {
        let x = (i * 43 - fast) % (W + 80);
        if (x < -80) x += W + 80;
        const y = 92 + (i % 4) * 7;
        g.fillStyle = i % 3 === 0 ? '#ffd166' : '#ff6b6b';
        g.fillRect(x, y, 4, 2);
        g.fillStyle = 'rgba(255,209,102,0.25)';
        g.fillRect(x - 6, y, 6, 2);
      }
    } else {
      // A stadium bowl: lower deck, a walkway, upper deck, and a roof.
      const big = sky === 'bigleague';
      const deck = big ? '#141c3c' : '#6b665e';
      const lit = big ? '#26305a' : '#847d73';
      const dark = big ? '#0d1330' : '#4f4a44';

      g.fillStyle = deck;
      g.fillRect(0, 52, W, 70);
      g.fillStyle = lit;
      g.fillRect(0, 52, W, 3);
      g.fillStyle = dark;
      g.fillRect(0, 84, W, 5);
      g.fillStyle = lit;
      g.fillRect(0, 84, W, 1);

      // Support columns, on the parallax.
      g.fillStyle = dark;
      for (let i = 0; i < 12; i++) {
        let x = (i * 40 - ox) % (W + 60);
        if (x < -60) x += W + 60;
        g.fillRect(x, 55, 3, 29);
      }
      // Roof over the top deck.
      g.fillStyle = dark;
      g.fillRect(0, 46, W, 7);
      g.fillStyle = lit;
      g.fillRect(0, 46, W, 2);

      if (big) {
        // Bunting, because it is a big day.
        for (let i = 0; i < 42; i++) {
          const x = i * 9 - (ox % 9);
          g.fillStyle = i % 2 ? '#c8102e' : '#f6f2e4';
          g.fillRect(x, 53, 8, 5);
          g.fillRect(x + 2, 58, 4, 3);
        }
      }
    }
  }

  /* A crowd is dots that bob — but with a head, a shoulder line and a shadow
   * under it, so at three rows deep the eye fills in a stadium. */
  function crowd(g, th, camX, t, W, H) {
    const ox = Math.round(camX * 0.25);
    const shirts = ['#e8b07a', '#c98e5b', '#f6f2e4', '#d8433f', '#3f8fd8', '#2fb3c9', '#f0a726', '#8a53d0'];
    const skins = ['#f2bd8c', '#c9895a', '#8a5a34', '#5c3a1e'];

    // A stadium gives the crowd somewhere to sit. A park does not, so build
    // them a stand — three rows of people floating over a row of houses is
    // the one thing that gave the old backdrop away.
    if (th.far !== 'stadium' && th.far !== 'bigleague') {
      g.fillStyle = th.night ? '#1a1f36' : '#6f6a62';
      g.fillRect(0, 58, W, 38);
      g.fillStyle = th.night ? '#262c48' : '#847d73';
      g.fillRect(0, 58, W, 2);
      g.fillStyle = th.night ? '#12162a' : '#57534c';
      for (let r = 0; r < 3; r++) g.fillRect(0, 69 + r * 11, W, 2);
    }

    for (let row = 0; row < 3; row++) {
      const y = 62 + row * 11;
      for (let i = 0; i < 72; i++) {
        let x = (i * 7 - ox) % (W + 30);
        if (x < -30) x += W + 30;
        const seed = (i * 3 + row * 5);
        const bob = Math.sin(t * 3 + i * 0.8 + row) > 0.72 ? -2 : 0;
        g.fillStyle = 'rgba(0,0,0,0.30)';
        g.fillRect(x, y + 6 + bob, 5, 2);
        g.fillStyle = shirts[seed % shirts.length];
        g.fillRect(x, y + 2 + bob, 5, 5);
        g.fillStyle = skins[seed % skins.length];
        g.fillRect(x + 1, y + bob, 3, 3);
        if (th.night) { g.fillStyle = 'rgba(20,26,50,0.22)'; g.fillRect(x, y + bob, 5, 8); }
      }
    }
  }

  function midLayer(g, th, camX, t, W, H) {
    const ox = Math.round(camX * 0.5);

    if (th.mid === 'fence') {
      const y = 102;
      // Chain link: posts, two rails, and a diamond weave between them.
      g.fillStyle = 'rgba(190,200,215,0.35)';
      for (let i = 0; i < 80; i++) {
        let x = (i * 5 - ox) % (W + 20);
        if (x < -20) x += W + 20;
        for (let j = 0; j < 4; j++) {
          g.fillRect(x + j, y + 4 + j * 4, 1, 1);
          g.fillRect(x + 4 - j, y + 4 + j * 4, 1, 1);
        }
      }
      g.fillStyle = '#9aa3ae';
      g.fillRect(0, y, W, 2);
      g.fillRect(0, y + 17, W, 2);
      g.fillStyle = '#c3ccd8';
      g.fillRect(0, y, W, 1);
      g.fillStyle = '#6e7680';
      for (let i = 0; i < 12; i++) {
        let x = (i * 40 - ox) % (W + 60);
        if (x < -60) x += W + 60;
        g.fillRect(x, y - 2, 3, 22);
        g.fillStyle = '#98a2ae';
        g.fillRect(x, y - 2, 1, 22);
        g.fillStyle = '#6e7680';
      }
    } else if (th.mid === 'bus') {
      for (let i = 0; i < 4; i++) {
        let x = (i * 190 - ox) % (W + 280);
        if (x < -280) x += W + 280;
        const y = 90;
        g.fillStyle = '#3a3320';
        g.fillRect(x, y + 28, 124, 4);
        g.fillStyle = '#d4bb5e';
        g.fillRect(x, y, 122, 28);
        g.fillStyle = '#eddb8c';
        g.fillRect(x, y, 122, 2);
        g.fillStyle = '#a8913f';
        g.fillRect(x, y + 24, 122, 4);
        g.fillStyle = '#1c2231';
        g.fillRect(x + 5, y + 5, 108, 11);
        for (let w0 = 0; w0 < 6; w0++) {
          g.fillStyle = (i + w0) % 3 === 0 ? '#2e3752' : '#ffe9a8';
          g.fillRect(x + 7 + w0 * 18, y + 6, 13, 9);
        }
        g.fillStyle = '#161a24';
        g.fillRect(x + 16, y + 27, 14, 7);
        g.fillRect(x + 92, y + 27, 14, 7);
        g.fillStyle = '#39404f';
        g.fillRect(x + 18, y + 29, 10, 3);
        g.fillRect(x + 94, y + 29, 10, 3);
      }
    } else {
      // The outfield wall, padded, with the numbers painted on it.
      const y = 96;
      g.fillStyle = '#1b4029';
      g.fillRect(0, y, W, 26);
      g.fillStyle = '#245537';
      g.fillRect(0, y + 2, W, 10);
      g.fillStyle = '#2d6b45';
      g.fillRect(0, y, W, 2);
      g.fillStyle = '#122c1c';
      for (let i = 0; i < 24; i++) {
        let x = (i * 22 - ox) % (W + 40);
        if (x < -40) x += W + 40;
        g.fillRect(x, y + 2, 1, 22);
      }
      g.fillStyle = '#ffd166';
      g.fillRect(0, y + 21, W, 2);
      for (let i = 0; i < 6; i++) {
        let x = (i * 120 - ox) % (W + 220);
        if (x < -220) x += W + 220;
        text(g, ['395', '410', '375'][i % 3], x, y + 8, '#e8e3d2', 1);
      }
    }
  }

  /* ================================================================ weather */
  function rain(g, camX, t, W, H) {
    const drift = Math.round((t * 320 + camX * 0.6) % 400);
    const fall = Math.round(t * 520);
    for (let i = 0; i < 90; i++) {
      const x = (i * 37 + drift) % (W + 40) - 20;
      const y = (i * 53 + fall) % (H + 20);
      g.fillStyle = i % 4 === 0 ? 'rgba(210,230,255,0.55)' : 'rgba(170,195,225,0.4)';
      g.fillRect(x, y, 1, i % 4 === 0 ? 6 : 4);
    }
  }

  return {
    GLYPHS, text, textShadow, textWidth,
    spr, sprSize, sprFlash, bat,
    THEMES, KITS, BASE, tile, backdrop, rain, hash,
    T,
  };
})();
