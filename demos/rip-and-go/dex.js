/* Pokémon Rip and Go — the dex.
 *
 * Every creature in the game is in this file: what it looks like, what it is
 * made of, what it learns and what it turns into. Nothing here is fetched and
 * no image ships with the game — each creature's art is typed out as letters,
 * one character per pixel, and every one of the thirty-three has its own
 * drawing. There is no shared body plan and no recolour standing in for a
 * species, because a creature you cannot tell apart from the last one is not
 * a creature, it is a palette.
 *
 * ------------------------------------------------------------------ pixels
 *
 * 16x16 per creature, drawn facing RIGHT and mirrored by the game when
 * something faces the other way:
 *
 *     '.'        nothing — the background shows through
 *     '0'-'7'    an index into the species' palette
 *
 * Slot 0 is the outline and slot 7 is white. At this size a figure without a
 * dark edge dissolves into whatever is behind it, and an eye without a white
 * in it is not an eye. The other six come from three colours typed per
 * species, so everything in the game is lit from the same corner.
 *
 * --------------------------------------------------------------- families
 *
 * Ten families of three plus three that stand alone. A family shares a theme
 * and nothing else: each stage is drawn from scratch, gets bigger, and picks
 * up a second type on the way up, which is the whole reason to keep something
 * on the team long enough to see what it becomes.
 */
const Dex = (() => {
  'use strict';

  /* ================================================================ colour */
  /* Three colours per species, eight slots on the sprite. The other five are
   * worked out from the three, so every creature in the game is lit from the
   * same corner: highlight top left, shade bottom right. */

  const hex = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const str = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v)))
      .toString(16).padStart(2, '0')).join('');

  function lighten(h, t) {
    const c = hex(h);
    return str(c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t);
  }
  function darken(h, t) {
    const c = hex(h);
    return str(c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t));
  }

  /* A shiny is not a second palette, it is this one turned. Cheap, and it
   * reads instantly as "that one is not the usual". */
  function spin(h, deg) {
    const c = hex(h).map((v) => v / 255);
    const max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
    const d = max - min;
    let hh = 0;
    if (d) {
      if (max === c[0]) hh = ((c[1] - c[2]) / d + 6) % 6;
      else if (max === c[1]) hh = (c[2] - c[0]) / d + 2;
      else hh = (c[0] - c[1]) / d + 4;
      hh *= 60;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    hh = ((hh + deg) % 360 + 360) % 360;
    const ch = (1 - Math.abs(2 * l - 1)) * s;
    const x = ch * (1 - Math.abs((hh / 60) % 2 - 1));
    const m = l - ch / 2;
    const t = hh < 60 ? [ch, x, 0] : hh < 120 ? [x, ch, 0] : hh < 180 ? [0, ch, x]
      : hh < 240 ? [0, x, ch] : hh < 300 ? [x, 0, ch] : [ch, 0, x];
    return str((t[0] + m) * 255, (t[1] + m) * 255, (t[2] + m) * 255);
  }

  function palette(body, accent, belly, shinyDeg) {
    if (shinyDeg) {
      body = spin(body, shinyDeg);
      accent = spin(accent, shinyDeg + 50);
      belly = spin(belly, shinyDeg);
    }
    return [
      '#0b0d14',              // 0  outline
      body,                   // 1  body
      lighten(body, 0.30),    // 2  body, lit
      darken(body, 0.34),     // 3  body, shaded
      belly,                  // 4  belly and undersides
      accent,                 // 5  accent — horns, fins, markings
      lighten(accent, 0.38),  // 6  accent, lit
      '#ffffff',              // 7  the white of an eye
    ];
  }

  /* ================================================================= types */
  /* Nine, and PLAIN is one of them now rather than a shrug for moves with no
   * type. Something has to be the honest middle of the chart, and a rodent
   * that is nothing in particular carries it better than a footnote does. */

  const TYPES = {
    EMBER: { name: 'EMBER', colour: '#ff7043', dark: '#40160c' },
    WAVE:  { name: 'WAVE',  colour: '#42a5f5', dark: '#0b2440' },
    LEAF:  { name: 'LEAF',  colour: '#66bb6a', dark: '#0e2c15' },
    SPARK: { name: 'SPARK', colour: '#ffd54f', dark: '#3a2d05' },
    FROST: { name: 'FROST', colour: '#80deea', dark: '#0c2f36' },
    STONE: { name: 'STONE', colour: '#a1887f', dark: '#2a1f1b' },
    GALE:  { name: 'GALE',  colour: '#b0bec5', dark: '#23303a' },
    SHADE: { name: 'SHADE', colour: '#9575cd', dark: '#241a3c' },
    PLAIN: { name: 'PLAIN', colour: '#cfd8dc', dark: '#262c33' },
  };

  const TYPE_LIST = ['EMBER', 'WAVE', 'LEAF', 'SPARK', 'FROST', 'STONE', 'GALE', 'SHADE', 'PLAIN'];

  /* What an attacking type does to a defending one. Anything not listed lands
   * at full price. Nothing is immune to anything: a move that simply does not
   * work teaches you less than one that lands for a quarter. */
  const CHART = {
    EMBER: { LEAF: 2, FROST: 2, WAVE: 0.5, STONE: 0.5, EMBER: 0.5 },
    WAVE:  { EMBER: 2, STONE: 2, LEAF: 0.5, WAVE: 0.5 },
    LEAF:  { WAVE: 2, STONE: 2, EMBER: 0.5, LEAF: 0.5, GALE: 0.5, FROST: 0.5 },
    SPARK: { WAVE: 2, GALE: 2, LEAF: 0.5, SPARK: 0.5, STONE: 0.5 },
    FROST: { LEAF: 2, GALE: 2, EMBER: 0.5, WAVE: 0.5, FROST: 0.5, STONE: 0.5 },
    STONE: { EMBER: 2, GALE: 2, FROST: 2, WAVE: 0.5, LEAF: 0.5 },
    GALE:  { LEAF: 2, SHADE: 2, SPARK: 0.5, STONE: 0.5, FROST: 0.5 },
    SHADE: { SHADE: 2, PLAIN: 2, GALE: 0.5 },
    PLAIN: { STONE: 0.5, SHADE: 0.5 },
  };

  /* A creature can have two types, so the multiplier is the product. */
  function effect(moveType, a, b) {
    const row = CHART[moveType] || {};
    let m = row[a] === undefined ? 1 : row[a];
    if (b && b !== a) m *= row[b] === undefined ? 1 : row[b];
    return m;
  }

  /* ================================================================= moves */
  /* Power, accuracy, and how many times you may use it. PP is the reason a
   * long walk between towns is a decision and not a formality: the move that
   * wins fights is the one you run out of. */

  const MOVES = {};

  function mv(name, type, power, acc, pp, opt) {
    MOVES[name] = Object.assign({ name, type, power, acc, pp }, opt || {});
    return MOVES[name];
  }

  //   name             type     pow  acc  pp   extras
  mv('TACKLE',         'PLAIN',  40, 100, 35);
  mv('SCRATCH',        'PLAIN',  40, 100, 35);
  mv('QUICK JAB',      'PLAIN',  40, 100, 30, { prio: 1 });
  mv('HEADBUTT',       'PLAIN',  70, 100, 15, { flinch: 20 });
  mv('BODY SLAM',      'PLAIN',  85, 100, 15);
  mv('TAKE DOWN',      'PLAIN',  95,  85, 15, { recoil: 0.25 });
  mv('GROWL',          'PLAIN',   0, 100, 40, { stat: { who: 'foe', key: 'atk', by: -1 } });
  mv('TAIL WHIP',      'PLAIN',   0, 100, 30, { stat: { who: 'foe', key: 'def', by: -1 } });
  mv('SCREECH',        'PLAIN',   0,  85, 20, { stat: { who: 'foe', key: 'def', by: -2 } });
  mv('HARDEN',         'PLAIN',   0,   0, 30, { stat: { who: 'self', key: 'def', by: 1 } });
  mv('FOCUS',          'PLAIN',   0,   0, 30, { stat: { who: 'self', key: 'atk', by: 1 } });
  mv('AGILITY',        'PLAIN',   0,   0, 30, { stat: { who: 'self', key: 'spd', by: 2 } });
  mv('SETTLE',         'PLAIN',   0,   0, 10, { heal: 0.5 });

  mv('EMBER',          'EMBER',  40, 100, 25, { status: { kind: 'burn', chance: 10 } });
  mv('FIRE FANG',      'EMBER',  65,  95, 15, { status: { kind: 'burn', chance: 10 } });
  mv('FLAME BURST',    'EMBER',  80, 100, 15, { status: { kind: 'burn', chance: 10 } });
  mv('INFERNO',        'EMBER', 110,  85,  5, { status: { kind: 'burn', chance: 20 } });
  mv('SEAR',           'EMBER',   0, 100, 20, { stat: { who: 'foe', key: 'atk', by: -1 } });

  mv('BUBBLE',         'WAVE',   40, 100, 30, { stat: { who: 'foe', key: 'spd', by: -1, chance: 20 } });
  mv('WATER JET',      'WAVE',   40, 100, 20, { prio: 1 });
  mv('AQUA SLASH',     'WAVE',   70, 100, 20);
  mv('TIDAL CRASH',    'WAVE',  110,  80,  5);
  mv('MIST VEIL',      'WAVE',    0,   0, 20, { stat: { who: 'self', key: 'def', by: 1 } });

  mv('VINE WHIP',      'LEAF',   45, 100, 25);
  mv('LEECH BITE',     'LEAF',   60, 100, 15, { drain: 0.5 });
  mv('RAZOR LEAF',     'LEAF',   70,  95, 20, { crit: true });
  mv('BLOOM BURST',    'LEAF',  110,  85,  5);
  mv('SPORE',          'LEAF',    0,  75, 10, { status: { kind: 'sleep', chance: 100 } });
  mv('POISON SPUR',    'LEAF',   55, 100, 20, { status: { kind: 'poison', chance: 30 } });

  mv('ZAP',            'SPARK',  40, 100, 30, { status: { kind: 'para', chance: 10 } });
  mv('SPARK BITE',     'SPARK',  65, 100, 20, { status: { kind: 'para', chance: 20 } });
  mv('THUNDERCLAP',    'SPARK', 110,  80,  5, { status: { kind: 'para', chance: 10 } });
  mv('STATIC FIELD',   'SPARK',   0,  90, 20, { status: { kind: 'para', chance: 100 } });

  mv('CHILL',          'FROST',  40, 100, 25, { stat: { who: 'foe', key: 'spd', by: -1, chance: 30 } });
  mv('ICE SHARD',      'FROST',  40, 100, 20, { prio: 1 });
  mv('FROST BITE',     'FROST',  65,  95, 20, { stat: { who: 'foe', key: 'spd', by: -1, chance: 20 } });
  mv('BLIZZARD',       'FROST', 110,  75,  5);

  mv('PEBBLE TOSS',    'STONE',  40, 100, 30);
  mv('ROCK SLAM',      'STONE',  70,  95, 20, { flinch: 10 });
  mv('ROCKFALL',       'STONE', 110,  80,  5);
  mv('SHELL UP',       'STONE',   0,   0, 20, { stat: { who: 'self', key: 'def', by: 2 } });

  mv('GUST',           'GALE',   40, 100, 30);
  mv('WING SLASH',     'GALE',   70, 100, 20, { crit: true });
  mv('CYCLONE',        'GALE',  110,  80,  5);
  mv('TAILWIND',       'GALE',    0,   0, 20, { stat: { who: 'self', key: 'spd', by: 2 } });

  /* The move you get when there is nothing left to use. It is not on any
   * learnset and it never runs out, because a fight that cannot end is worse
   * than a fight you lose — and in a trainer battle, where walking away is
   * not on the menu, it is the only thing standing between an empty PP bar
   * and a save file you have to reload. */
  mv('STRUGGLE',       'PLAIN',  45, 100,  0, { recoil: 0.25, last: true });

  mv('SHADOW NIP',     'SHADE',  40, 100, 30);
  mv('NIGHT BITE',     'SHADE',  65, 100, 20, { stat: { who: 'foe', key: 'atk', by: -1, chance: 20 } });
  mv('NIGHTFALL',      'SHADE', 110,  80,  5);
  mv('CURSE EYE',      'SHADE',   0, 100, 20, { stat: { who: 'foe', key: 'spd', by: -2 } });

  /* ================================================================ strikes */
  /* One move per type that only a spliced creature can know. Nothing in the
   * wild learns a STRIKE and no learnset lists one: a fusion gets the one
   * matching its head, which means it is always the fusion's own type and
   * always hits at full strength.
   *
   * This is the reward for splicing. Two creatures put together lose the
   * evolution they might have had and half a learnset each, so they get back
   * something neither half could do on its own — a heavy, reliable move that
   * splits what it hits. Nine of them, one per type, so every one of the
   * thousand-odd fusions has exactly one. */

  const STRIKES = {};
  TYPE_LIST.forEach((type) => {
    const name = type + ' STRIKE';
    STRIKES[type] = name;
    mv(name, type, 90, 95, 10, {
      strike: true,
      stat: { who: 'foe', key: 'def', by: -1, chance: 20 },
    });
  });

  /* The card shop still sells packs, and a pack still needs to know what a
   * lucky pull looks like, so rarity survives as a property of the species
   * rather than as a system of its own. */
  const RARITY = {
    common:   { key: 'common',   name: 'COMMON',    colour: '#b0bec5', rip: 8 },
    uncommon: { key: 'uncommon', name: 'UNCOMMON',  colour: '#66bb6a', rip: 24 },
    rare:     { key: 'rare',     name: 'RARE',      colour: '#42a5f5', rip: 70 },
    epic:     { key: 'epic',     name: 'EPIC',      colour: '#ce93d8', rip: 190 },
    legend:   { key: 'legend',   name: 'LEGENDARY', colour: '#ffd54f', rip: 520 },
  };
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legend'];

  /* ==================================================================== art */
  /* One drawing per creature. Thirty-three of them, and every one is typed
   * out by hand — which is the only way a family reads as a family that grew
   * rather than three sizes of the same stamp. */

  const ART = {};

  /* ------------------------------------------------ the leaf starter line */

  /* A seed that has just decided to be something. Two leaves and a sulk. */
  ART.spriglet = [
    '.......00.......',
    '......0560......',
    '.....056650.....',
    '....05666500....',
    '.....055500.....',
    '......050.......',
    '....0000000.....',
    '...021111130....',
    '..02111111130...',
    '..02111107130...',
    '..02114441130...',
    '..01144444130...',
    '...014444430....',
    '....00044400....',
    '.....0110110....',
    '......00.00.....',
  ];

  /* Up on two legs now, with a frond it keeps having to duck under. */
  ART.fernaut = [
    '.....55.........',
    '....0560...5....',
    '...056650.565...',
    '...0566500650...',
    '....0555000.....',
    '.....011100.....',
    '....011111100...',
    '....011107110...',
    '...0011111110...',
    '.05011444411050.',
    '.06501444410650.',
    '.05001444410050.',
    '....011444110...',
    '....011001100...',
    '....0110.0110...',
    '....000...000...',
  ];

  /* Bark, thorns, and four legs that have stopped asking permission. */
  ART.thornroot = [
    '...5...5...5....',
    '..050.050.050...',
    '.00500500500000.',
    '.002222222222220',
    '0222222222222220',
    '0222222222222070',
    '0222222222222220',
    '0322222222222220',
    '0334444444422220',
    '0344444444444320',
    '0044444444444300',
    '.011001100110...',
    '.011001100110...',
    '.011001100110...',
    '.000.000.000....',
    '................',
  ];

  /* ----------------------------------------------- the ember starter line */

  /* A pup with a lit tail and no sense of what that means for curtains. */
  ART.cindpup = [
    '................',
    '..55.......00...',
    '.0560.....0110..',
    '.05650....0110..',
    '..05500000011000',
    '...011111111110.',
    '...011111110710.',
    '...011111111110.',
    '...014441111110.',
    '..01144444111100',
    '..01144444111100',
    '..00114441110000',
    '....0110011000..',
    '....0110.0110...',
    '....0110.0110...',
    '....000...000...',
  ];

  /* Longer in the leg, and the fire has climbed onto its shoulders. */
  ART.embercur = [
    '..5...5.....55..',
    '.050.050...0560.',
    '.0500500...05650',
    '.05005000000550.',
    '..000111111110..',
    '..01111111110710',
    '..01111111111110',
    '..01111111111110',
    '..01144411111100',
    '..01444444111100',
    '..01444444111000',
    '..00144441110000',
    '...0110.0110....',
    '...0110.0110....',
    '...0110.0110....',
    '...000...000....',
  ];

  /* The hound the town warns you about, and a mane that is not fur. */
  ART.pyrehound = [
    '.5..5..5....55..',
    '050.050.050.0560',
    '0500500500500565',
    '.055055055055650',
    '..00011111105500',
    '..01111111111500',
    '..01111111110700',
    '..01111111111100',
    '..01144111111100',
    '..01444441111100',
    '.014444444111100',
    '.014444444110000',
    '.0011444111000..',
    '..0110.0110.....',
    '..0110.0110.....',
    '..000...000.....',
  ];

  /* ------------------------------------------------ the wave starter line */

  /* A drop of water that has worked out how to sulk in one place. */
  ART.puddlet = [
    '.......00.......',
    '......0220......',
    '.....022220.....',
    '.....022220.....',
    '....02222220....',
    '...0222222220...',
    '..022222220720..',
    '..022222222220..',
    '.02222444422220.',
    '.02224444442230.',
    '.02244444444230.',
    '.02444444444430.',
    '.00244444444300.',
    '5500244444430055',
    '0565002222230650',
    '.050..00000.050.',
  ];

  /* Out of the puddle, up on its hind feet, and immediately louder. */
  ART.splashfin = [
    '.....00000......',
    '....0222220.....',
    '...022222220....',
    '...02222220700..',
    '...02222222230..',
    '...00222222300..',
    '55..0111111300..',
    '0550011444113055',
    '0565011444413055',
    '.050011444413055',
    '..000114444130..',
    '....01444413....',
    '....01444413....',
    '....01144113....',
    '...0511111350...',
    '...0550000550...',
  ];

  /* All fin and jaw. It comes up under the boat, not at it. */
  ART.tidefang = [
    '.....55.........',
    '....0560........',
    '....05650.......',
    '...05665000000..',
    '..0566502222220.',
    '.05665022222070.',
    '.05665022222220.',
    '.056650222222230',
    '..05502244444230',
    '..0500244444430.',
    '...002444444300.',
    '....02444443000.',
    '....0224443055..',
    '....0224430565..',
    '....022430.050..',
    '....00000...00..',
  ];

  /* ------------------------------------------------------ the bug family */

  /* A grub with an appetite and no plan beyond it. */
  ART.nibbug = [
    '................',
    '................',
    '.........55.55..',
    '..........05.50.',
    '.00000005005000.',
    '0222222222222200',
    '0222222222207220',
    '0222222222222220',
    '0244444444444220',
    '0244444444444220',
    '0024444444444200',
    '..000000000000..',
    '...05.05.05.....',
    '................',
    '................',
    '................',
  ];

  /* Hung up under a branch, doing something it will not explain. */
  ART.chitling = [
    '....00000000....',
    '...0555555550...',
    '..052222222250..',
    '.05222222222250.',
    '.05222220722250.',
    '.05222222222250.',
    '.05224444442250.',
    '.05244444444250.',
    '.05244444444250.',
    '.05224444442250.',
    '.05222222222250.',
    '.05222222222350.',
    '..05222223350...',
    '...052233300....',
    '.....000000.....',
    '................',
  ];

  /* It kept the appetite and added blades. Wings are the part that surprises. */
  ART.mantivine = [
    '.....5..5.......',
    '......05.50.....',
    '..0000050050....',
    '.05502222220....',
    '05665022207220..',
    '05666502222220..',
    '.0566502222220..',
    '..05665011110...',
    '...05650111100..',
    '....0500144410..',
    '.....001444410..',
    '......014444100.',
    '......014444100.',
    '......01111110..',
    '......011..011..',
    '......00....00..',
  ];

  /* ----------------------------------------------------- the bird family */

  /* Round, loud, and only technically airborne. */
  ART.pipeep = [
    '................',
    '......0000......',
    '.....022220.....',
    '....022222220...',
    '...02222220700..',
    '...0222222205500',
    '..02222222205650',
    '..02244422205500',
    '.022444442233000',
    '.02244444422330.',
    '.02244444442330.',
    '.00224444423300.',
    '..002222223300..',
    '....0500550.....',
    '....050.050.....',
    '....00...00.....',
  ];

  /* Long tail, short patience. It follows you for the first half of a route. */
  ART.skyjay = [
    '........00000...',
    '.......0222220..',
    '.......02220700.',
    '00.....022220550',
    '03300..02222200.',
    '03330..0222220..',
    '.03330022222220.',
    '..0333022444220.',
    '...033022444420.',
    '....030022444420',
    '.....00022444430',
    '........02244430',
    '........02222300',
    '.........050500.',
    '.........05.050.',
    '.........00..00.',
  ];

  /* Weather with opinions. The wings are open because they never close. */
  ART.stormwing = [
    '.00.......00000.',
    '0330.....0222220',
    '03330...02220700',
    '033330..02222055',
    '0333330.02222055',
    '.033333022222200',
    '..03333022222220',
    '...0333022222220',
    '..00333022442200',
    '.033003302244420',
    '03300..002244430',
    '0300.....0224430',
    '00.......0222300',
    '.........055500.',
    '.........05.050.',
    '.........00..00.',
  ];

  /* --------------------------------------------------- the rodent family */

  /* Two teeth and a plan for your porch. */
  ART.gnawkin = [
    '................',
    '...00......00...',
    '..0550....0550..',
    '..0550....0550..',
    '..05500000550...',
    '..011111111110..',
    '.01111111110710.',
    '.01111111111110.',
    '.011444111111770',
    '.01444441111100.',
    '.01444441111000.',
    '.00144441100000.',
    '...011001100....',
    '...0110.0110....',
    '...0110.0110....',
    '...000...000....',
  ];

  /* The cheeks are storage. It has been at your bag. */
  ART.cheeker = [
    '................',
    '..00........00..',
    '.0550......0550.',
    '.0550......0550.',
    '.05500000000550.',
    '.01111111111110.',
    '.01111111110710.',
    '.01111111111110.',
    '.011444111111770',
    '0114444441111100',
    '0144444444111100',
    '0144444444411100',
    '0014444444111000',
    '..00144411000...',
    '...0110.0110....',
    '...000...000....',
  ];

  /* It went down and came back up armoured. The claws are for the down part. */
  ART.burrowback = [
    '....5555555.....',
    '...055555550....',
    '..0550000005500.',
    '.055011111111550',
    '.05011111110710.',
    '.050111111111550',
    '.050111111111550',
    '.05011444411150.',
    '.05014444441150.',
    '.05501444444500.',
    '..0550144445500.',
    '...05501111500..',
    '..0550.011100...',
    '.0550..0110.....',
    '.050...0110.....',
    '.00....000......',
  ];

  /* ------------------------------------------------- the spark bug family */

  /* Small, charged, and permanently about to touch something metal. */
  ART.voltmite = [
    '................',
    '..5.........5...',
    '..050.....050...',
    '...050...050....',
    '....05000050....',
    '....00111100....',
    '...021111130....',
    '..02111110730...',
    '..02111111130...',
    '..02115555130...',
    '..02115555130...',
    '..02111111130...',
    '..00211111300...',
    '....00111300....',
    '...05.000.50....',
    '...00.....00....',
  ];

  /* Two coils and a temper. Standing near it makes your arm hair vote. */
  ART.arcmite = [
    '..55.......55...',
    '.0560.....0650..',
    '.0560.....0650..',
    '..05000000550...',
    '..021111111300..',
    '.02111111110730.',
    '.02111111111130.',
    '.02115555555130.',
    '.02155666655130.',
    '.02155666655130.',
    '.02115555555130.',
    '.02111111111130.',
    '.00211111111300.',
    '...0011111100...',
    '...05.0000.50...',
    '...00......00...',
  ];

  /* The charge found wings. Do not look directly at the pattern. */
  ART.dynamoth = [
    '.55..........55.',
    '0560........0650',
    '05660......06650',
    '056660....066650',
    '0566660..0666650',
    '0566660110666650',
    '0566600170066650',
    '0566600110066650',
    '0566600110066650',
    '.056600110066650',
    '..05600110066500',
    '...050011006500.',
    '.....00110000...',
    '.....014410.....',
    '.....014410.....',
    '.....011110.....',
  ];

  /* ----------------------------------------------------- the stone family */

  /* A rock that worked out arms. Pleased about it. */
  ART.pebblet = [
    '................',
    '................',
    '.....000000.....',
    '....02222230....',
    '...0222222230...',
    '..022222207230..',
    '.02222222222230.',
    '0022222222222330',
    '0110222222223300',
    '0110022222233000',
    '00100222223300..',
    '...02222233000..',
    '....0222330.....',
    '....0110110.....',
    '....0110110.....',
    '....000.000.....',
  ];

  /* Three rocks that agreed to be one thing. It does not always hold. */
  ART.cobblin = [
    '.....000000.....',
    '....02222230....',
    '...0222070230...',
    '...0222222230...',
    '..0222222222330.',
    '..0022222223300.',
    '.011002222233000',
    '0110002222233300',
    '0110022222223300',
    '0110222222222330',
    '0110222222222330',
    '0010022222223300',
    '...02222222330..',
    '...022222330....',
    '....0110.0110...',
    '....000...000...',
  ];

  /* Quarry-sized, crystal-cored, and slow in a way that is not a weakness. */
  ART.geodon = [
    '..55.....55.....',
    '.0560...0560....',
    '.0560...0560....',
    '.005000000050000',
    '.022222222222220',
    '0222222222072230',
    '0222222222222230',
    '0222255662222230',
    '0222556666222230',
    '0222556666222230',
    '0022255662222300',
    '.002222222233300',
    '0110022222330000',
    '0110.02222330...',
    '000..0110.0110..',
    '.....000...000..',
  ];

  /* ----------------------------------------------------- the shade family */

  /* A small light that is not attached to anything. */
  ART.wisplet = [
    '.......55.......',
    '......0560......',
    '.....056650.....',
    '....0566500.....',
    '...00222200.....',
    '..0222222200....',
    '.0222222072230..',
    '.02222222222230.',
    '.02224444222330.',
    '.02244444422330.',
    '..0244444423300.',
    '..0022244233000.',
    '...0022223300...',
    '.....0222300....',
    '......02300.....',
    '.......000......',
  ];

  /* The light found a case to live in. It still gets out at night. */
  ART.lanternwisp = [
    '.......00.......',
    '......0550......',
    '.....0566550....',
    '.....0000000....',
    '....022222230...',
    '...02222207230..',
    '..022222222230..',
    '..02255555522300',
    '.022566666552230',
    '.022566666552230',
    '.022556666552230',
    '.022555555523300',
    '..02222222233300',
    '...022222233000.',
    '.....0222330....',
    '......00300.....',
  ];

  /* Tall, hooded, and wearing the face on the front because there is no back. */
  ART.hauntis = [
    '.....000000.....',
    '....05555550....',
    '...0555555550...',
    '..055000000550..',
    '..0502222220050.',
    '.05022077022050.',
    '.05022077022050.',
    '.05022222222050.',
    '.05022555522050.',
    '.05502222222550.',
    '..0502222222550.',
    '..0502222223300.',
    '...00222222300..',
    '....022222300...',
    '.....0223300....',
    '.......000......',
  ];

  /* ------------------------------------------------------ the fish family */

  /* Small, quick, and entirely convinced the pond is the world. */
  ART.finnik = [
    '................',
    '................',
    '.55........000..',
    '0560......02220.',
    '05650...00222220',
    '056650.022222070',
    '0566500222222220',
    '0566502224442220',
    '0566500224442220',
    '056650.022222220',
    '05650...02222300',
    '0560.....000000.',
    '.55.............',
    '................',
    '................',
    '................',
  ];

  /* The fins went hard and the water around it stopped moving. */
  ART.glacifin = [
    '.......55555....',
    '.5....0566660...',
    '050..056666660..',
    '0560.05500000000',
    '0566002222222220',
    '0566022222220700',
    '0566022222222220',
    '0566022244422220',
    '0566022444442220',
    '0566002244442220',
    '0566002222222230',
    '.056600000000300',
    '..05666660......',
    '...0566650......',
    '....05550.......',
    '................',
  ];

  /* The part that comes up is the jaw. Everything else stays in the dark. */
  ART.rimemaw = [
    '.....55.........',
    '....0560........',
    '....05650.......',
    '....05650.55555.',
    '....056650566650',
    '.....05005666650',
    '....000002222220',
    '...0222222220700',
    '..02222222222220',
    '.022222222244220',
    '0222222244444220',
    '0222244444444220',
    '0022444444444220',
    '.002444444444230',
    '..00244444423300',
    '...00222223300..',
  ];

  /* ------------------------------------------------------ the three alone */

  /* Legendary. Wings open, and nothing about the pose is defensive. */
  ART.pyrewing = [
    '.......55.......',
    '......0550......',
    '.....005500.....',
    '.....022220.....',
    '.....020720.....',
    '....00222200....',
    '.00.02222220.00.',
    '0550022222200550',
    '0565022222220650',
    '0566502222206650',
    '0566650222066650',
    '.05665022056650.',
    '..056502205650..',
    '...05502200550..',
    '....050.00.050..',
    '.....00....00...',
  ];

  /* Legendary. What comes up is the neck. The rest stays down there. */
  ART.tidemaw = [
    '......0550......',
    '.....056650.....',
    '....05666500000.',
    '....056665222220',
    '....056662072220',
    '....056622222220',
    '....05660000000.',
    '.....0552222220.',
    '.....055222220..',
    '....055222220...',
    '...055222220....',
    '..0552222200....',
    '.0552222222000..',
    '0552222222222200',
    '0544444444444420',
    '.00000000000000.',
  ];

  /* Legendary. A mask, a ring, and two hands that are not attached to it. */
  ART.stoneward = [
    '.....000000.....',
    '...0055555500...',
    '..055000000550..',
    '.05500222200550.',
    '.055002222200550',
    '.055022077220550',
    '.055022077220550',
    '.055022222220550',
    '.055022555520550',
    '.055002222200550',
    '.05500222200550.',
    '..055000000550..',
    '...0055555500...',
    '.....000000.....',
    '..00........00..',
    '.0330......0330.',
  ];

  /* =============================================================== species */
  /* Base stats are read the way you would read them anywhere: a hundred is
   * exceptional, thirty is a liability, and the sum tells you roughly where
   * in the game something belongs. A first stage sits near 250, a last stage
   * near 480, and the three that stand alone are above that on purpose. */

  const SPECIES = [];

  function sp(o) {
    o.id = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    o.no = SPECIES.length + 1;
    o.types = o.t2 ? [o.t1, o.t2] : [o.t1];
    SPECIES.push(o);
    return o;
  }

  /* ------ 1-3  the leaf starter */
  sp({
    name: 'SPRIGLET', t1: 'LEAF', rarity: 'common',
    body: '#8bc34a', accent: '#c5e1a5', belly: '#f0f4c3',
    base: { hp: 50, atk: 44, def: 50, spd: 42 }, catch: 190, yield: 62, evo: { to: 'fernaut', lv: 16 },
    learn: [[1, 'TACKLE'], [1, 'GROWL'], [6, 'VINE WHIP'], [10, 'HARDEN'],
      [14, 'LEECH BITE'], [19, 'RAZOR LEAF'], [25, 'SPORE'], [32, 'BLOOM BURST']],
    dex: 'Sleeps in the seam between two paving stones and comes out when it rains.',
  });
  sp({
    name: 'FERNAUT', t1: 'LEAF', rarity: 'uncommon',
    body: '#66bb6a', accent: '#aed581', belly: '#dcedc8',
    base: { hp: 66, atk: 60, def: 66, spd: 56 }, catch: 90, yield: 142, evo: { to: 'thornroot', lv: 34 },
    learn: [[1, 'TACKLE'], [1, 'VINE WHIP'], [1, 'GROWL'], [18, 'LEECH BITE'],
      [23, 'RAZOR LEAF'], [29, 'POISON SPUR'], [36, 'SPORE'], [42, 'BLOOM BURST']],
    dex: 'The frond is a weather instrument. It ducks a minute before the rain.',
  });
  sp({
    name: 'THORNROOT', t1: 'LEAF', t2: 'STONE', rarity: 'rare',
    body: '#558b2f', accent: '#a1887f', belly: '#c5e1a5',
    base: { hp: 92, atk: 90, def: 100, spd: 62 }, catch: 45, yield: 232,
    learn: [[1, 'RAZOR LEAF'], [1, 'HARDEN'], [1, 'PEBBLE TOSS'], [34, 'ROCK SLAM'],
      [40, 'POISON SPUR'], [46, 'BLOOM BURST'], [52, 'ROCKFALL']],
    dex: 'Stands in one place long enough that the path goes around it instead.',
  });

  /* ------ 4-6  the ember starter */
  sp({
    name: 'CINDPUP', t1: 'EMBER', rarity: 'common',
    body: '#ff8a65', accent: '#ffd54f', belly: '#ffe0b2',
    base: { hp: 46, atk: 54, def: 42, spd: 54 }, catch: 190, yield: 62, evo: { to: 'embercur', lv: 16 },
    learn: [[1, 'SCRATCH'], [1, 'GROWL'], [6, 'EMBER'], [10, 'FOCUS'],
      [14, 'QUICK JAB'], [19, 'FIRE FANG'], [25, 'HEADBUTT'], [32, 'FLAME BURST']],
    dex: 'Warms the doorstep it sleeps on. Two families have replaced the doorstep.',
  });
  sp({
    name: 'EMBERCUR', t1: 'EMBER', rarity: 'uncommon',
    body: '#f4511e', accent: '#ffb300', belly: '#ffcc80',
    base: { hp: 62, atk: 74, def: 56, spd: 72 }, catch: 90, yield: 142, evo: { to: 'pyrehound', lv: 34 },
    learn: [[1, 'SCRATCH'], [1, 'EMBER'], [1, 'GROWL'], [18, 'FIRE FANG'],
      [23, 'QUICK JAB'], [29, 'SEAR'], [36, 'FLAME BURST'], [42, 'TAKE DOWN']],
    dex: 'Runs the ridge at dusk. You see the mane first and the dog a second later.',
  });
  sp({
    name: 'PYREHOUND', t1: 'EMBER', rarity: 'rare',
    body: '#d84315', accent: '#ffca28', belly: '#ffab91',
    base: { hp: 84, atk: 108, def: 74, spd: 96 }, catch: 45, yield: 232,
    learn: [[1, 'FIRE FANG'], [1, 'QUICK JAB'], [1, 'SEAR'], [34, 'FLAME BURST'],
      [40, 'TAKE DOWN'], [46, 'AGILITY'], [52, 'INFERNO']],
    dex: 'The bell on the old gate is rung by nothing. It has been doing that for years.',
  });

  /* ------ 7-9  the wave starter */
  sp({
    name: 'PUDDLET', t1: 'WAVE', rarity: 'common',
    body: '#4fc3f7', accent: '#0288d1', belly: '#b3e5fc',
    base: { hp: 54, atk: 44, def: 52, spd: 40 }, catch: 190, yield: 62, evo: { to: 'splashfin', lv: 16 },
    learn: [[1, 'TACKLE'], [1, 'TAIL WHIP'], [6, 'BUBBLE'], [10, 'MIST VEIL'],
      [14, 'WATER JET'], [19, 'AQUA SLASH'], [25, 'SETTLE'], [32, 'TIDAL CRASH']],
    dex: 'Holds its shape out of politeness. Given a slope, it stops bothering.',
  });
  sp({
    name: 'SPLASHFIN', t1: 'WAVE', rarity: 'uncommon',
    body: '#29b6f6', accent: '#0277bd', belly: '#e1f5fe',
    base: { hp: 70, atk: 62, def: 68, spd: 56 }, catch: 90, yield: 142, evo: { to: 'tidefang', lv: 34 },
    learn: [[1, 'TACKLE'], [1, 'BUBBLE'], [1, 'TAIL WHIP'], [18, 'WATER JET'],
      [23, 'AQUA SLASH'], [29, 'CHILL'], [36, 'SETTLE'], [42, 'TIDAL CRASH']],
    dex: 'Floats on its back in the shallows holding a stone it has no use for.',
  });
  sp({
    name: 'TIDEFANG', t1: 'WAVE', t2: 'FROST', rarity: 'rare',
    body: '#0277bd', accent: '#4dd0e1', belly: '#b3e5fc',
    base: { hp: 94, atk: 92, def: 88, spd: 74 }, catch: 45, yield: 232,
    learn: [[1, 'AQUA SLASH'], [1, 'CHILL'], [1, 'MIST VEIL'], [34, 'FROST BITE'],
      [40, 'SETTLE'], [46, 'TIDAL CRASH'], [52, 'BLIZZARD']],
    dex: 'Comes up under the jetty at slack water. The boards know before you do.',
  });

  /* ------ 10-12  the bug */
  sp({
    name: 'NIBBUG', t1: 'LEAF', rarity: 'common',
    body: '#9ccc65', accent: '#827717', belly: '#dcedc8',
    base: { hp: 44, atk: 40, def: 44, spd: 44 }, catch: 255, yield: 39, evo: { to: 'chitling', lv: 9 },
    learn: [[1, 'TACKLE'], [1, 'POISON SPUR'], [5, 'HARDEN']],
    dex: 'Eats its own weight in leaf and then some of the fence.',
  });
  sp({
    name: 'CHITLING', t1: 'LEAF', rarity: 'common',
    body: '#c0ca33', accent: '#827717', belly: '#f0f4c3',
    base: { hp: 56, atk: 34, def: 70, spd: 32 }, catch: 120, yield: 72, evo: { to: 'mantivine', lv: 15 },
    learn: [[1, 'HARDEN'], [1, 'TACKLE']],
    dex: 'Doing something in there. Will not say what. Hardens if you ask.',
  });
  sp({
    name: 'MANTIVINE', t1: 'LEAF', t2: 'GALE', rarity: 'uncommon',
    body: '#7cb342', accent: '#cddc39', belly: '#dcedc8',
    base: { hp: 68, atk: 84, def: 62, spd: 84 }, catch: 60, yield: 178,
    learn: [[1, 'RAZOR LEAF'], [1, 'GUST'], [18, 'WING SLASH'], [24, 'POISON SPUR'],
      [30, 'AGILITY'], [38, 'CYCLONE'], [45, 'BLOOM BURST']],
    dex: 'Holds perfectly still on a stalk that is also holding perfectly still.',
  });

  /* ------ 13-15  the bird */
  sp({
    name: 'PIPEEP', t1: 'GALE', rarity: 'common',
    body: '#90caf9', accent: '#ffb74d', belly: '#ffffff',
    base: { hp: 46, atk: 46, def: 40, spd: 62 }, catch: 255, yield: 50, evo: { to: 'skyjay', lv: 14 },
    learn: [[1, 'TACKLE'], [1, 'GROWL'], [6, 'GUST'], [11, 'QUICK JAB'], [17, 'WING SLASH']],
    dex: 'Loud for its size, and its size is the size of a bread roll.',
  });
  sp({
    name: 'SKYJAY', t1: 'GALE', rarity: 'uncommon',
    body: '#5c6bc0', accent: '#ffd54f', belly: '#e8eaf6',
    base: { hp: 60, atk: 64, def: 54, spd: 84 }, catch: 100, yield: 138, evo: { to: 'stormwing', lv: 32 },
    learn: [[1, 'GUST'], [1, 'QUICK JAB'], [1, 'GROWL'], [20, 'WING SLASH'],
      [26, 'TAILWIND'], [33, 'HEADBUTT'], [40, 'CYCLONE']],
    dex: 'Escorts you for half a route, then peels off like that was the plan.',
  });
  sp({
    name: 'STORMWING', t1: 'GALE', t2: 'SPARK', rarity: 'rare',
    body: '#3949ab', accent: '#ffeb3b', belly: '#c5cae9',
    base: { hp: 82, atk: 100, def: 72, spd: 110 }, catch: 45, yield: 228,
    learn: [[1, 'WING SLASH'], [1, 'ZAP'], [1, 'TAILWIND'], [34, 'SPARK BITE'],
      [41, 'AGILITY'], [47, 'CYCLONE'], [54, 'THUNDERCLAP']],
    dex: 'The weather does what it is told. Not quickly, and not politely, but it does.',
  });

  /* ------ 16-18  the rodent */
  sp({
    name: 'GNAWKIN', t1: 'PLAIN', rarity: 'common',
    body: '#a1887f', accent: '#efebe9', belly: '#d7ccc8',
    base: { hp: 48, atk: 52, def: 42, spd: 58 }, catch: 255, yield: 51, evo: { to: 'cheeker', lv: 15 },
    learn: [[1, 'SCRATCH'], [1, 'TAIL WHIP'], [6, 'QUICK JAB'], [12, 'HEADBUTT'], [18, 'SCREECH']],
    dex: 'Has been through your bag. Found nothing. Went through it again.',
  });
  sp({
    name: 'CHEEKER', t1: 'PLAIN', rarity: 'uncommon',
    body: '#8d6e63', accent: '#ffe0b2', belly: '#d7ccc8',
    base: { hp: 68, atk: 70, def: 58, spd: 72 }, catch: 120, yield: 134, evo: { to: 'burrowback', lv: 30 },
    learn: [[1, 'QUICK JAB'], [1, 'TAIL WHIP'], [1, 'SCRATCH'], [20, 'HEADBUTT'],
      [25, 'SCREECH'], [31, 'BODY SLAM'], [38, 'TAKE DOWN']],
    dex: 'The cheeks are storage. What is in them is between it and the cheeks.',
  });
  sp({
    name: 'BURROWBACK', t1: 'PLAIN', t2: 'STONE', rarity: 'rare',
    body: '#6d4c41', accent: '#bcaaa4', belly: '#d7ccc8',
    base: { hp: 96, atk: 96, def: 96, spd: 66 }, catch: 60, yield: 218,
    learn: [[1, 'HEADBUTT'], [1, 'PEBBLE TOSS'], [1, 'HARDEN'], [32, 'ROCK SLAM'],
      [38, 'BODY SLAM'], [44, 'TAKE DOWN'], [50, 'ROCKFALL']],
    dex: 'The road crew stopped calling it a sinkhole after the third one moved.',
  });

  /* ------ 19-21  the spark bug */
  sp({
    name: 'VOLTMITE', t1: 'SPARK', rarity: 'common',
    body: '#fdd835', accent: '#424242', belly: '#fff59d',
    base: { hp: 44, atk: 48, def: 46, spd: 60 }, catch: 190, yield: 58, evo: { to: 'arcmite', lv: 18 },
    learn: [[1, 'TACKLE'], [1, 'ZAP'], [8, 'STATIC FIELD'], [13, 'QUICK JAB'], [20, 'SPARK BITE']],
    dex: 'Sleeps against the fence wire. The fence has opinions about this.',
  });
  sp({
    name: 'ARCMITE', t1: 'SPARK', rarity: 'uncommon',
    body: '#ffc107', accent: '#37474f', belly: '#fff8e1',
    base: { hp: 62, atk: 70, def: 62, spd: 82 }, catch: 90, yield: 148, evo: { to: 'dynamoth', lv: 36 },
    learn: [[1, 'ZAP'], [1, 'STATIC FIELD'], [1, 'TACKLE'], [22, 'SPARK BITE'],
      [28, 'AGILITY'], [35, 'HEADBUTT'], [42, 'THUNDERCLAP']],
    dex: 'Standing near it makes the hair on your arm hold a vote and lose.',
  });
  sp({
    name: 'DYNAMOTH', t1: 'SPARK', t2: 'GALE', rarity: 'epic',
    body: '#ffca28', accent: '#7e57c2', belly: '#fff8e1',
    base: { hp: 82, atk: 104, def: 76, spd: 104 }, catch: 40, yield: 236,
    learn: [[1, 'SPARK BITE'], [1, 'GUST'], [1, 'AGILITY'], [36, 'WING SLASH'],
      [43, 'STATIC FIELD'], [49, 'THUNDERCLAP'], [55, 'CYCLONE']],
    dex: 'The wing pattern is not decoration. Do not look at it for long.',
  });

  /* ------ 22-24  the stone */
  sp({
    name: 'PEBBLET', t1: 'STONE', rarity: 'common',
    body: '#a1887f', accent: '#8d6e63', belly: '#d7ccc8',
    base: { hp: 56, atk: 56, def: 76, spd: 26 }, catch: 190, yield: 60, evo: { to: 'cobblin', lv: 22 },
    learn: [[1, 'TACKLE'], [1, 'HARDEN'], [7, 'PEBBLE TOSS'], [13, 'SHELL UP'], [21, 'ROCK SLAM']],
    dex: 'Indistinguishable from the path until it is standing on a different part of it.',
  });
  sp({
    name: 'COBBLIN', t1: 'STONE', rarity: 'uncommon',
    body: '#8d6e63', accent: '#a1887f', belly: '#bcaaa4',
    base: { hp: 74, atk: 78, def: 100, spd: 34 }, catch: 100, yield: 152, evo: { to: 'geodon', lv: 38 },
    learn: [[1, 'PEBBLE TOSS'], [1, 'SHELL UP'], [1, 'HARDEN'], [24, 'ROCK SLAM'],
      [30, 'SCREECH'], [37, 'BODY SLAM'], [44, 'ROCKFALL']],
    dex: 'Three rocks that agreed to be one thing. The agreement is renegotiated daily.',
  });
  sp({
    name: 'GEODON', t1: 'STONE', rarity: 'epic',
    body: '#546e7a', accent: '#4dd0e1', belly: '#b2ebf2',
    base: { hp: 100, atk: 98, def: 130, spd: 38 }, catch: 45, yield: 240,
    learn: [[1, 'ROCK SLAM'], [1, 'SHELL UP'], [1, 'SCREECH'], [38, 'BODY SLAM'],
      [45, 'TAKE DOWN'], [52, 'ROCKFALL']],
    dex: 'The quarry lost a face of stone overnight. It was found two valleys over.',
  });

  /* ------ 25-27  the shade */
  sp({
    name: 'WISPLET', t1: 'SHADE', rarity: 'common',
    body: '#b39ddb', accent: '#fff59d', belly: '#ede7f6',
    base: { hp: 44, atk: 58, def: 40, spd: 58 }, catch: 190, yield: 62, evo: { to: 'lanternwisp', lv: 20 },
    learn: [[1, 'SHADOW NIP'], [1, 'GROWL'], [8, 'CURSE EYE'], [14, 'NIGHT BITE'], [22, 'CHILL']],
    dex: 'A small light with nothing underneath it. It follows at a polite distance.',
  });
  sp({
    name: 'LANTERNWISP', t1: 'SHADE', rarity: 'uncommon',
    body: '#7e57c2', accent: '#ffca28', belly: '#d1c4e9',
    base: { hp: 62, atk: 80, def: 58, spd: 70 }, catch: 90, yield: 156, evo: { to: 'hauntis', lv: 36 },
    learn: [[1, 'NIGHT BITE'], [1, 'CURSE EYE'], [1, 'SHADOW NIP'], [24, 'EMBER'],
      [30, 'CHILL'], [38, 'SETTLE'], [44, 'NIGHTFALL']],
    dex: 'The case was made to hold a candle. Nobody put the candle in.',
  });
  sp({
    name: 'HAUNTIS', t1: 'SHADE', t2: 'FROST', rarity: 'rare',
    body: '#4527a0', accent: '#ff5252', belly: '#311b92',
    base: { hp: 82, atk: 112, def: 70, spd: 92 }, catch: 45, yield: 234,
    learn: [[1, 'NIGHT BITE'], [1, 'CHILL'], [1, 'CURSE EYE'], [36, 'FROST BITE'],
      [42, 'SETTLE'], [48, 'NIGHTFALL'], [55, 'BLIZZARD']],
    dex: 'The mask is the front. There is no back. People have checked.',
  });

  /* ------ 28-30  the fish */
  sp({
    name: 'FINNIK', t1: 'WAVE', rarity: 'common',
    body: '#4dd0e1', accent: '#ff8a65', belly: '#e0f7fa',
    base: { hp: 50, atk: 48, def: 46, spd: 52 }, catch: 255, yield: 54, evo: { to: 'glacifin', lv: 21 },
    learn: [[1, 'TACKLE'], [1, 'BUBBLE'], [7, 'TAIL WHIP'], [13, 'WATER JET'], [20, 'AQUA SLASH']],
    dex: 'Entirely convinced the pond is the world, and unreachable on the point.',
  });
  sp({
    name: 'GLACIFIN', t1: 'WAVE', t2: 'FROST', rarity: 'uncommon',
    body: '#4fc3f7', accent: '#e1f5fe', belly: '#b3e5fc',
    base: { hp: 66, atk: 68, def: 66, spd: 64 }, catch: 90, yield: 150, evo: { to: 'rimemaw', lv: 38 },
    learn: [[1, 'WATER JET'], [1, 'CHILL'], [1, 'BUBBLE'], [24, 'ICE SHARD'],
      [30, 'AQUA SLASH'], [36, 'FROST BITE'], [43, 'BLIZZARD']],
    dex: 'The fins went hard one winter and the water around it stopped moving.',
  });
  sp({
    name: 'RIMEMAW', t1: 'WAVE', t2: 'FROST', rarity: 'epic',
    body: '#0288d1', accent: '#b2ebf2', belly: '#e0f7fa',
    base: { hp: 106, atk: 100, def: 92, spd: 64 }, catch: 40, yield: 238,
    learn: [[1, 'FROST BITE'], [1, 'AQUA SLASH'], [1, 'ICE SHARD'], [38, 'SETTLE'],
      [45, 'TIDAL CRASH'], [52, 'BLIZZARD']],
    dex: 'Came up through the ice without breaking it. The hole is the shape of the jaw.',
  });

  /* ------ 31-33  the three that stand alone */
  sp({
    name: 'PYREWING', t1: 'EMBER', t2: 'GALE', rarity: 'legend',
    body: '#e64a19', accent: '#ffd54f', belly: '#ffab91',
    base: { hp: 96, atk: 120, def: 88, spd: 110 }, catch: 8, yield: 340,
    learn: [[1, 'FLAME BURST'], [1, 'WING SLASH'], [1, 'TAILWIND'], [50, 'SEAR'],
      [58, 'CYCLONE'], [64, 'INFERNO']],
    dex: 'Burns down to nothing roughly once a century, on purpose, and comes back cross.',
  });
  sp({
    name: 'TIDEMAW', t1: 'WAVE', t2: 'SHADE', rarity: 'legend',
    body: '#0277bd', accent: '#4dd0e1', belly: '#b3e5fc',
    base: { hp: 120, atk: 112, def: 100, spd: 82 }, catch: 8, yield: 340,
    learn: [[1, 'TIDAL CRASH'], [1, 'NIGHT BITE'], [1, 'MIST VEIL'], [50, 'CURSE EYE'],
      [58, 'SETTLE'], [64, 'NIGHTFALL']],
    dex: 'The part you can see is the neck. Nobody has volunteered to check the rest.',
  });
  sp({
    name: 'STONEWARD', t1: 'STONE', t2: 'SHADE', rarity: 'legend',
    body: '#8d6e63', accent: '#ffd54f', belly: '#d7ccc8',
    base: { hp: 110, atk: 104, def: 140, spd: 60 }, catch: 8, yield: 340,
    learn: [[1, 'ROCKFALL'], [1, 'CURSE EYE'], [1, 'SHELL UP'], [50, 'NIGHT BITE'],
      [58, 'BODY SLAM'], [64, 'NIGHTFALL']],
    dex: 'Guarding something. Will not say what. Has been at it since before the road.',
  });

  /* ================================================================ lookup */

  const BY_ID = {};
  SPECIES.forEach((s) => { BY_ID[s.id] = s; });

  /* ================================================================ fusion */
  /* Two creatures spliced into one: the head of the first on the body of the
   * second. Thirty-three of them make one thousand and eighty-nine fusions,
   * which is a roster nobody drew and everybody can find something new in.
   *
   * A fusion is a species like any other — it has an id, a name, base stats,
   * types and a learnset — so once it exists, nothing else in the game needs
   * to know it is unusual. It fights, it levels, it goes in the box, it shows
   * up in the dex. The id is 'head+body', which is also what a save file
   * stores, so `byId` builds one on demand when a save comes back with a
   * fusion in it rather than dropping the creature on the floor.
   *
   * ------------------------------------------------------------ the split
   *
   * The head brings what a head does: attack, speed, the first type, and the
   * top seven rows of the drawing. The body brings the rest. Stats are two
   * parts the one that owns them to one part the other, so a fusion is
   * recognisably built out of its parents rather than an average of
   * everything, and a fast head on a bulky body is a real thing you can go
   * looking for. */

  const FUSE = '+';

  /* Names are the front of one and the back of the other, cut on syllables
   * rather than in the middle, so SPRIGLET on CINDPUP comes out SPRIGLUP and
   * not SPRIGLEINDP. The head keeps everything up to its second vowel sound;
   * the body joins at its last one, backing up a syllable if that would only
   * be a letter or two. */
  function vowelRuns(word) {
    const runs = [];
    for (let i = 0; i < word.length; i++) {
      if ('AEIOUY'.indexOf(word[i]) < 0) continue;
      if (runs.length && runs[runs.length - 1].end === i - 1) runs[runs.length - 1].end = i;
      else runs.push({ start: i, end: i });
    }
    return runs;
  }

  function fuseName(a, b) {
    const head = a.replace(/[^A-Z]/g, ''), body = b.replace(/[^A-Z]/g, '');
    const hr = vowelRuns(head), br = vowelRuns(body);

    // The head up to where its second syllable starts.
    const cut = hr.length > 1 ? hr[1].start : Math.ceil(head.length * 0.6);
    let prefix = head.slice(0, Math.max(2, cut));

    // The body from its last syllable, backing up if that is barely anything.
    let from = br.length ? br[br.length - 1].start : Math.floor(body.length / 2);
    if (body.length - from < 3 && br.length > 1) from = br[br.length - 2].start;
    let suffix = body.slice(from);

    let out = prefix + suffix;
    if (out.length > 10) { prefix = prefix.slice(0, Math.max(2, 10 - suffix.length)); out = prefix + suffix; }
    if (out.length < 4) out = head.slice(0, 3) + body.slice(-3);
    return out.slice(0, 11);
  }

  function fuseTypes(h, b) {
    const first = h.types[0];
    const second = b.types[b.types.length - 1];
    return first === second ? [first] : [first, second];
  }

  /* Both learnsets, the earlier level winning where they overlap. */
  function fuseLearn(h, b) {
    const at = {};
    (h.learn || []).concat(b.learn || []).forEach(([lv, name]) => {
      if (at[name] === undefined || lv < at[name]) at[name] = lv;
    });
    return Object.keys(at).map((name) => [at[name], name]).sort((x, y) => x[0] - y[0]);
  }

  function isFusionId(id) { return typeof id === 'string' && id.indexOf(FUSE) > 0; }

  function fuse(headId, bodyId) {
    const id = headId + FUSE + bodyId;
    if (BY_ID[id]) return BY_ID[id];
    const h = BY_ID[headId], b = BY_ID[bodyId];
    if (!h || !b || h.fusion || b.fusion) return null;

    const lean = (mine, theirs) => Math.round((2 * mine + theirs) / 3);
    const types = fuseTypes(h, b);
    const sp = {
      id, no: 0, fusion: true, headId, bodyId,
      // The one thing neither half could do alone, typed off the head.
      signature: STRIKES[types[0]],
      name: fuseName(h.name, b.name),
      // The drawing is cut in half, so the colours are too: the head keeps
      // its own, the body keeps its own, and the seam is the point.
      body: b.body, accent: h.accent, belly: b.belly,
      types,
      base: {
        hp: lean(b.base.hp, h.base.hp),
        atk: lean(h.base.atk, b.base.atk),
        def: lean(b.base.def, h.base.def),
        spd: lean(h.base.spd, b.base.spd),
      },
      rarity: RARITY_ORDER.indexOf(h.rarity) >= RARITY_ORDER.indexOf(b.rarity) ? h.rarity : b.rarity,
      catch: Math.min(h.catch, b.catch),
      yield: Math.round((h.yield + b.yield) / 2),
      learn: fuseLearn(h, b),
      dex: 'The head of a ' + h.name + ' on the body of a ' + b.name + '. '
        + 'Nobody has decided yet whether that is one creature or two.',
    };
    BY_ID[id] = sp;
    return sp;
  }

  /* A save that comes back holding a fusion should get the fusion, not a
   * hole where a creature used to be. */
  function lookup(id) {
    if (BY_ID[id]) return BY_ID[id];
    if (isFusionId(id)) {
      const [a, b] = id.split(FUSE);
      return fuse(a, b);
    }
    return undefined;
  }

  const POOLS = {};
  RARITY_ORDER.forEach((r) => { POOLS[r] = SPECIES.filter((s) => s.rarity === r); });

  /* Levels the way the rest of the genre does them: a stat is the base
   * doubled, scaled by level, plus a floor so a level 2 is not a rounding
   * error. HP gets its own line because it needs the bigger floor. */
  function statAt(sp, key, level) {
    if (key === 'hp') return Math.floor(sp.base.hp * 2 * level / 100) + level + 10;
    return Math.floor(sp.base[key] * 2 * level / 100) + 5;
  }

  /* Medium-fast: total experience to be level L is L cubed. */
  function xpForLevel(level) { return level * level * level; }

  /* Everything a species knows by a given level, newest last. */
  function learnedBy(sp, level) {
    const out = [];
    (sp.learn || []).forEach((e) => { if (e[0] <= level) out.push(e[1]); });
    return out;
  }

  /* The four it would have if it had grown up in the wild: the last four it
   * could have learned, which is also what a wild encounter fights with.
   *
   * With one rule on top — at least one of the four has to do damage. Four
   * status moves is a creature that cannot win a fight it started, and on the
   * wild side of the screen that is a battle nobody can end. */
  function wildMoves(sp, level) {
    const all = learnedBy(sp, level);
    const out = [];
    for (let i = all.length - 1; i >= 0 && out.length < 4; i--) {
      if (out.indexOf(all[i]) < 0) out.unshift(all[i]);
    }
    if (!out.length) out.push('TACKLE');
    if (!out.some((n) => MOVES[n] && MOVES[n].power > 0)) {
      const hit = all.slice().reverse().find((n) => MOVES[n] && MOVES[n].power > 0);
      out[out.length - 1] = hit || 'TACKLE';
    }
    // A fusion always carries its strike. It is not on any learnset — it is
    // the thing being two creatures gets you — so it is put in here rather
    // than waited for, taking the oldest slot if all four are full.
    if (sp.signature && out.indexOf(sp.signature) < 0) {
      if (out.length < 4) out.push(sp.signature);
      else out[0] = sp.signature;
    }
    return out;
  }

  function paletteFor(sp, shiny) {
    return palette(sp.body, sp.accent, sp.belly, shiny ? 150 : 0);
  }

  function typeLabel(sp) { return sp.types.join('/'); }

  /* ============================================================== the check */
  /* Every drawing has to be 16 rows of 16. A row one character short shifts
   * the whole creature and is nearly impossible to spot by eye, so it gets
   * said out loud in the console instead of waiting to be found in the grass. */
  function validate() {
    const bad = [];
    Object.keys(ART).forEach((k) => {
      const f = ART[k];
      if (f.length !== 16) bad.push(k + ': ' + f.length + ' rows, want 16');
      f.forEach((row, i) => {
        if (row.length !== 16) bad.push(k + ' row ' + i + ': ' + row.length + ' wide — "' + row + '"');
        if (/[^0-7.]/.test(row)) bad.push(k + ' row ' + i + ': stray character — "' + row + '"');
      });
    });
    SPECIES.forEach((s) => {
      if (!ART[s.id]) bad.push(s.name + ': no drawing');
      s.types.forEach((t) => { if (!TYPES[t]) bad.push(s.name + ': no type called ' + t); });
      if (!RARITY[s.rarity]) bad.push(s.name + ': no rarity called ' + s.rarity);
      if (s.evo && !BY_ID[s.evo.to]) bad.push(s.name + ': evolves into nothing called ' + s.evo.to);
      (s.learn || []).forEach((e) => {
        if (!MOVES[e[1]]) bad.push(s.name + ': no move called ' + e[1]);
      });
    });
    if (bad.length) console.error('Dex: ' + bad.length + ' problem(s)\n' + bad.join('\n'));
    return bad;
  }

  return {
    TYPES, TYPE_LIST, CHART, MOVES, ART, SPECIES, RARITY, RARITY_ORDER,
    byId: lookup,
    fuse, isFusionId, fuseName, FUSE,
    move: (name) => MOVES[name],
    pool: (r) => POOLS[r] || [],
    effect, statAt, xpForLevel, learnedBy, wildMoves,
    paletteFor, palette, lighten, darken, spin, typeLabel, validate,
  };
})();

Dex.validate();
