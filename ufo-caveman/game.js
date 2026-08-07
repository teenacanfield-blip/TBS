/* ============================================================================
   UGG & THE UNDERSAUCER
   A sidescrolling platformer about a caveman with a flying saucer bolted to his
   underside, in a cave that actively lies to the player.

   Plain JS, no dependencies, no build step. Everything is drawn with canvas
   primitives, so there are no image or audio files to load.

   The design rule for every "confusing" mechanic in here: the cave is allowed to
   lie about the WORLD (fake platforms, backwards signs, mirrored view, swapped
   keys) but the HUD badge row at the top always tells the truth about which lie
   is currently running. That is what keeps it hard-and-confusing instead of
   simply unfair.
   ========================================================================== */
(() => {
'use strict';

/* ---------------------------------------------------------------- constants */

const TS = 32;                 // tile size in WORLD pixels (physics units)
const VW = 960, VH = 540;      // canvas size on screen

/* The whole game is drawn into a small art-pixel buffer and then blown up with
   nearest-neighbour, which is what gives it the handheld look: 320x180 art
   pixels at 3x. One art pixel = 2 world pixels, so a 32-world-px tile is a
   classic 16x16 sprite tile and the view shows 20x11 tiles. */
const BW = 320, BH = 180;      // art-pixel buffer, blown up 3x onto the canvas
const WPB = 2;                 // world pixels per art pixel
const TA = TS / WPB;           // 16 art pixels per tile
const viewW = BW * WPB, viewH = BH * WPB;   // visible world area

const CW = 16, CH = 18;        // chunk size in tiles
const STEP = 1 / 60;           // fixed physics step

const CFG = {
  grav: 0.62, maxFall: 13,
  accel: 0.85, maxRun: 4.4,
  fricGround: 0.80, fricAir: 0.93,
  jumpV: 11.0, coyote: 7, jumpBuffer: 7,
  thrust: 0.98, maxRise: 3.4,
  fuelMax: 100, fuelBurn: 1.15, fuelRegen: 1.8,
  restartFuel: 42,             // fuel the saucer needs before it will restart
  rebootLift: 0.9, rebootTime: 0.5,
  stunTime: 0.4,
  windAccel: 0.24,
  lagFrames: 13,
  echoDelay: 150,              // frames the doppelganger trails you by
  blinkPeriod: 1.5,            // seconds per blinker half-cycle
};

const SPLASH_TIME = 4.0;       // seconds the studio plate holds before the title

const PW = 22, PH = 30;        // player collision box (art is bigger than this)

/* Tile characters.
   #  solid rock            =  stone platform      ^  spikes
   ~  glowing goo           F  fake platform (looks solid, is not)
   P  phantom platform (invisible, IS solid)       T  bounce pad
   B  blinker phase A       b  blinker phase B
   C  conveyor right        c  conveyor left
   K  checkpoint            G  mothership (exit)   g  decoy mothership
   *  shiny rock            ?  lying sign
   S  saw    V  crusher     o  spark spawner       d  cave critter
   E  echo trigger          R  boulder spawner     @  spawn                    */

const SOLID = new Set(['#', '=', 'P', 'C', 'c', 'T']);
const DEADLY = new Set(['^', '~']);

/* --------------------------------------------------------------- level data */
/* Chunks are 16x18 tiles and bottom-aligned: a chunk may supply fewer than 18
   rows and the loader pads the missing rows onto the top as empty space.
   `z` holds zone rectangles in chunk-local tile coords: [type, x, y, w, h, param]. */

const CHUNKS = {


  /* ---- shared ---- */

  /* Every chunk keeps its walking surface on the same row, so the seams between
     chunks are flat. A mismatch there reads as an invisible wall. */

  intro: { r: [
    "                ",
    "                ",
    "          *     ",
    "                ",
    "      ==        ",
    "                ",
    "  @         ?   ",
    "################",
    "################",
    "################",
    "################",
  ]},

  opener: { r: [
    "                ",
    "                ",
    "       *        ",
    "                ",
    "     ==         ",
    "                ",
    "  @        ?    ",
    "################",
    "################",
    "################",
    "################",
  ]},

  /* Three rest rooms, so the checkpoint stop is not the same picture every time. */

  restK2: { r: [
    "                ",
    "                ",
    "     *          ",
    "                ",
    "   ==     ==    ",
    "                ",
    "          K     ",
    "################",
    "################",
    "################",
    "################",
  ]},

  restK3: { r: [
    "                ",
    "                ",
    "        *       ",
    "                ",
    "                ",
    "    ======      ",
    "  K             ",
    "################",
    "################",
    "################",
    "################",
  ]},

  restK: { r: [
    "                ",
    "                ",
    "        *       ",
    "                ",
    "      ====      ",
    "                ",
    "    K           ",
    "################",
    "################",
    "################",
    "################",
  ]},

  /* ---- stratum 1: the platforms lie ---- */

  fakes: { r: [
    "                ",
    "        *       ",
    "                ",
    "     ==         ",
    "                ",
    "    FF   ==     ",
    "?               ",
    "#####      #####",
    "#####^^^^^^#####",
    "################",
    "################",
  ]},

  phantom: { r: [
    "                ",
    "       *        ",
    "                ",
    "   PP  PP  PP   ",
    "                ",
    "?               ",
    "###          ###",
    "###~~~~~~~~~~###",
    "################",
    "################",
  ]},

  dinodip: { r: [
    "                ",
    "                ",
    "          *     ",
    "                ",
    "     d          ",
    "    =====       ",
    "                ",
    "  d     T     d ",
    "######    ######",
    "######^^^^######",
    "################",
    "################",
  ]},

  invert1: { z: [['invert', 0, 0, 16, 18]], r: [
    "                ",
    "        *       ",
    "                ",
    "     ==         ",
    "            ==  ",
    "?               ",
    "####        ####",
    "####^^^^^^^^####",
    "################",
    "################",
  ]},

  blink1: { r: [
    "                ",
    "                ",
    "      *    *    ",
    "                ",
    "   BB  bb  BB   ",
    "                ",
    "###          ###",
    "###~~~~~~~~~~###",
    "################",
    "################",
  ]},

  decoyend: { r: [
    "                ",
    "                ",
    "        ?g      ",
    "        ====    ",
    "                ",
    "   ==           ",
    "                ",
    "            G   ",
    "#####    #######",
    "#####^^^^#######",
    "################",
    "################",
  ]},

  /* ---- stratum 2: the room lies ---- */

  flipin: { z: [['flip', 1, 0, 15, 18]], r: [
    "################",
    "################",
    "      ##        ",
    "                ",
    "        *       ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "################",
    "################",
    "################",
    "################",
  ]},

  mirror1: { z: [['mirror', 0, 0, 16, 18]], r: [
    "                ",
    "     *          ",
    "                ",
    "   ===          ",
    "        ===     ",
    "?               ",
    "###        #####",
    "###^^^^^^^^#####",
    "################",
    "################",
  ]},

  saws1: { r: [
    "         S      ",
    "                ",
    "                ",
    "    ==========  ",
    "                ",
    "     S          ",
    "                ",
    "#####      #####",
    "#####^^^^^^#####",
    "################",
    "################",
  ]},

  conveyor: { r: [
    "                ",
    "        *       ",
    "                ",
    "   ccccc        ",
    "                ",
    "        CCCCC   ",
    "###          ###",
    "###~~~~~~~~~~###",
    "################",
    "################",
  ]},

  lag1: { z: [['lag', 0, 0, 16, 18]], r: [
    "                ",
    "                ",
    "   V     V      ",
    "                ",
    "        *       ",
    "?               ",
    "################",
    "################",
    "################",
    "################",
  ]},

  crush1: { r: [
    "                ",
    "  V   V   V   V ",
    "                ",
    "                ",
    "      *         ",
    "                ",
    "#####  #####  ##",
    "#####^^#####^^##",
    "################",
    "################",
  ]},

  flip2: { z: [['flip', 0, 0, 16, 18]], r: [
    "################",
    "################",
    "     ^^   ##    ",
    "                ",
    "         *      ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "#####      #####",
    "#####^^^^^^#####",
    "################",
    "################",
  ]},

  blinkgoo: { r: [
    "                ",
    "     *     *    ",
    "                ",
    "  bb   BB   bb  ",
    "                ",
    "                ",
    "##          ####",
    "##~~~~~~~~~~####",
    "################",
    "################",
  ]},

  end2: { r: [
    "                ",
    "                ",
    "                ",
    "                ",
    "         ==     ",
    "                ",
    "           G    ",
    "######### ######",
    "#########^######",
    "################",
    "################",
  ]},

  /* ---- stratum 3: everything lies at once ---- */

  dark1: { z: [['dark', 0, 0, 16, 18]], r: [
    "                ",
    "                ",
    "   PP  PP  PP   ",
    "         *      ",
    "                ",
    "?               ",
    "###          ###",
    "###^^^^^^^^^^###",
    "################",
    "################",
  ]},

  strobe1: { z: [['strobe', 0, 0, 16, 18]], r: [
    "                ",
    "      *         ",
    "           d    ",
    "   ==     ====  ",
    "                ",
    "                ",
    "####        ####",
    "####^^^^^^^^####",
    "################",
    "################",
  ]},

  wind1: { z: [['wind', 0, 0, 16, 18, -1]], r: [
    "                ",
    "     o          ",
    "                ",
    "   ==     ==    ",
    "                ",
    "        *       ",
    "###          ###",
    "###^^^^^^^^^^###",
    "################",
    "################",
  ]},

  echo1: { r: [
    "                ",
    "                ",
    "                ",
    "     ======     ",
    "                ",
    "  E       *     ",
    "################",
    "################",
    "################",
    "################",
  ]},

  boulder1: { r: [
    "                ",
    "                ",
    " R              ",
    "                ",
    "        *       ",
    "                ",
    "########    ####",
    "########^^^^####",
    "################",
    "################",
  ]},

  stack1: { z: [['invert', 0, 0, 16, 18], ['heavy', 7, 0, 9, 18]], r: [
    "                ",
    "        *       ",
    "                ",
    "    ==     ==   ",
    "                ",
    "                ",
    "####       #####",
    "####^^^^^^^#####",
    "################",
    "################",
  ]},

  stack2: { z: [['mirror', 0, 0, 16, 18], ['low', 0, 0, 16, 18], ['lag', 8, 0, 8, 18]], r: [
    "                ",
    "      *    *    ",
    "                ",
    "   ==   ==   == ",
    "                ",
    "                ",
    "##            ##",
    "##~~~~~~~~~~~~##",
    "################",
    "################",
  ]},

  finalgauntlet: { z: [['strobe', 0, 0, 16, 18], ['swapkeys', 0, 0, 16, 18]], r: [
    "################",
    "################",
    "      ^^        ",
    "                ",
    "         *      ",
    "                ",
    "                ",
    "   V       V    ",
    "                ",
    "                ",
    "                ",
    "     BB   bb    ",
    "                ",
    "        S       ",
    "##            ##",
    "##^^^^^^^^^^^^##",
    "################",
    "################",
  ]},

  /* ---- extra rooms, drawn on by the level builder ---- */

  steps: { r: [
    "                ",
    "            *   ",
    "                ",
    "         ===    ",
    "                ",
    "     ===        ",
    "                ",
    " ===            ",
    "################",
    "################",
    "################",
    "################",
  ]},

  tower: { r: [
    "  *             ",
    "                ",
    "  ==            ",
    "                ",
    "       ==       ",
    "                ",
    "           ==   ",
    "                ",
    "####      ######",
    "####^^^^^^######",
    "################",
    "################",
  ]},

  pillars: { r: [
    "                ",
    "      *         ",
    "                ",
    "   ##   ##   ## ",
    "   ##   ##   ## ",
    "   ##   ##   ## ",
    "   ##   ##   ## ",
    "   ##   ##   ## ",
    "################",
    "################",
    "################",
    "################",
  ]},

  overhang: { r: [
    "  ####    ####  ",
    "  ^^^^    ^^^^  ",
    "                ",
    "        *       ",
    "                ",
    "                ",
    "                ",
    "                ",
    "################",
    "################",
    "################",
    "################",
  ]},

  goochannel: { r: [
    "                ",
    "     *     *    ",
    "                ",
    "                ",
    "                ",
    "   ==   ==   == ",
    "                ",
    "                ",
    "##            ##",
    "##~~~~~~~~~~~~##",
    "################",
    "################",
  ]},

  sawcorridor: { r: [
    "                ",
    "        *       ",
    "   S            ",
    "                ",
    "  ===========   ",
    "                ",
    "          S     ",
    "                ",
    "###          ###",
    "###^^^^^^^^^^###",
    "################",
    "################",
  ]},

  critterpit: { r: [
    "                ",
    "      *         ",
    "                ",
    "     d          ",
    "    ======      ",
    "                ",
    "                ",
    "  d          d  ",
    "#####    #######",
    "#####^^^^#######",
    "################",
    "################",
  ]},

  blinkbridge: { r: [
    "                ",
    "    *      *    ",
    "                ",
    "                ",
    "                ",
    "  BB  bb  BB bb ",
    "                ",
    "                ",
    "##            ##",
    "##^^^^^^^^^^^^##",
    "################",
    "################",
  ]},

  crushhall: { r: [
    "                ",
    "   V     V      ",
    "                ",
    "                ",
    "                ",
    "        *       ",
    "                ",
    "                ",
    "################",
    "################",
    "################",
    "################",
  ]},

  sparkroom: { r: [
    "                ",
    "     o          ",
    "                ",
    "         *      ",
    "                ",
    "   ====   ====  ",
    "                ",
    "                ",
    "###          ###",
    "###^^^^^^^^^^###",
    "################",
    "################",
  ]},

  conveyorbelt: { r: [
    "                ",
    "        *       ",
    "                ",
    "                ",
    "   CCCC         ",
    "                ",
    "        cccc    ",
    "                ",
    "###          ###",
    "###~~~~~~~~~~###",
    "################",
    "################",
  ]},

  trampolines: { r: [
    "                ",
    "       *        ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "  T         T   ",
    "####      ######",
    "####^^^^^^######",
    "################",
    "################",
  ]},

  phantomwalk: { r: [
    "                ",
    "      *         ",
    "                ",
    "                ",
    "  PP  PP  PP PP ",
    "                ",
    "                ",
    "                ",
    "##            ##",
    "##^^^^^^^^^^^^##",
    "################",
    "################",
  ]},

  fakerow: { r: [
    "                ",
    "        *       ",
    "                ",
    "                ",
    "   FF  ==  FF   ",
    "                ",
    "                ",
    "                ",
    "###          ###",
    "###^^^^^^^^^^###",
    "################",
    "################",
  ]},

  boulderrun: { r: [
    "                ",
    " R              ",
    "                ",
    "         *      ",
    "                ",
    "                ",
    "                ",
    "                ",
    "########    ####",
    "########^^^^####",
    "################",
    "################",
  ]},

  echoroom: { r: [
    "                ",
    "                ",
    "                ",
    "                ",
    "     ======     ",
    "                ",
    "                ",
    "  E       *     ",
    "################",
    "################",
    "################",
    "################",
  ]},

  end3: { r: [
    "                ",
    "                ",
    "                ",
    "                ",
    "     ====       ",
    "                ",
    "  ?        G    ",
    "################",
    "################",
    "################",
    "################",
  ]},
};

/* ------------------------------------------------------------------- stages */
/* Five stages of ten levels. Each stage owns a colour theme, a pool of rooms,
   and the set of lies it is allowed to tell. Level 1 of the first three stages
   is hand-built; the rest are composed from the pool by a seeded builder, so
   every level is fixed and repeatable but no two are laid out the same. */

const STAGE_COUNT = 5, LEVELS_PER_STAGE = 10;

const STAGES = [
  {
    name: 'THE CRUST',
    blurb: 'GENTLE. HARMLESS. A MEADOW, REALLY.',
    theme: {
      rock: '#2b2440', rockLit: '#6b5c96', rockEdge: '#453a63', rockSpec: '#3a3157',
      slab: '#453a63', slabLit: '#6b5c96', slabTop: '#9a8fc4',
      bands: ['#1c1733', '#191530', '#16122b', '#131026', '#100d20', '#0d0b16'],
      far: '#2a2250', farLit: '#3a2f5e', near: '#1a1533',
    },
    pool: ['fakes', 'phantom', 'dinodip', 'steps', 'pillars', 'fakerow', 'trampolines',
           'critterpit', 'tower', 'overhang', 'blink1', 'goochannel', 'phantomwalk'],
    effects: ['invert'],
    effectChance: 0.2,
    end: 'decoyend',
    handmade: { 0: ['intro', 'fakes', 'restK', 'phantom', 'dinodip', 'invert1', 'restK', 'blink1', 'decoyend'] },
  },
  {
    name: 'THE MIRROR SHELF',
    blurb: 'EVERYTHING HERE IS THE RIGHT WAY ROUND.',
    theme: {
      rock: '#1e3340', rockLit: '#4f8ba0', rockEdge: '#2f5566', rockSpec: '#28485a',
      slab: '#2f5566', slabLit: '#4f8ba0', slabTop: '#8fd0e0',
      bands: ['#122b38', '#102632', '#0e212c', '#0c1c26', '#0a1720', '#08121a'],
      far: '#1d4152', farLit: '#2a5c72', near: '#12303e',
    },
    pool: ['sawcorridor', 'conveyorbelt', 'saws1', 'conveyor', 'goochannel', 'steps',
           'blinkbridge', 'mirror1', 'fakerow', 'tower', 'lag1', 'crush1', 'trampolines'],
    effects: ['mirror', 'invert', 'lag'],
    effectChance: 0.42,
    end: 'end2',
    handmade: { 0: ['opener', 'flipin', 'mirror1', 'restK', 'saws1', 'conveyor', 'lag1', 'restK', 'crush1', 'flip2', 'blinkgoo', 'end2'] },
  },
  {
    name: 'LIGHTLESS DEEP',
    blurb: 'WELL LIT AND EASY TO READ.',
    theme: {
      rock: '#191527', rockLit: '#413a63', rockEdge: '#2a2440', rockSpec: '#221d36',
      slab: '#2a2440', slabLit: '#4a4270', slabTop: '#6f66a0',
      bands: ['#141026', '#120e22', '#100c1e', '#0d0a19', '#0a0814', '#07060f'],
      far: '#1c1738', farLit: '#282050', near: '#12102a',
    },
    pool: ['phantomwalk', 'dark1', 'strobe1', 'blinkbridge', 'sparkroom', 'fakerow',
           'goochannel', 'phantom', 'overhang', 'steps', 'lag1', 'echo1', 'pillars'],
    effects: ['dark', 'strobe', 'lag', 'swapkeys'],
    effectChance: 0.5,
    end: 'end3',
    handmade: { 0: ['opener', 'dark1', 'strobe1', 'restK', 'wind1', 'echo1', 'boulder1', 'restK', 'stack1', 'stack2', 'restK', 'finalgauntlet', 'end3'] },
  },
  {
    name: 'THE UPSIDE',
    blurb: 'DOWN IS DOWN. IT HAS ALWAYS BEEN DOWN.',
    theme: {
      rock: '#20351f', rockLit: '#5c8a4a', rockEdge: '#33512f', rockSpec: '#2a4426',
      slab: '#33512f', slabLit: '#5c8a4a', slabTop: '#9ad080',
      bands: ['#152a1d', '#13251a', '#111f17', '#0e1a14', '#0b1510', '#08100c'],
      far: '#1e3d28', farLit: '#2c5636', near: '#132a1c',
    },
    pool: ['flipin', 'flip2', 'overhang', 'goochannel', 'pillars', 'tower', 'trampolines',
           'wind1', 'steps', 'phantomwalk', 'blinkgoo', 'critterpit', 'fakerow'],
    effects: ['wind', 'low', 'heavy', 'invert'],
    effectChance: 0.45,
    end: 'end2',
  },
  {
    name: 'THE MOTHERSHIP',
    blurb: 'YOU HAVE ALREADY WON. GO HOME.',
    theme: {
      rock: '#2e2438', rockLit: '#8a6ba8', rockEdge: '#4a3a5c', rockSpec: '#3b2e4a',
      slab: '#4a3a5c', slabLit: '#8a6ba8', slabTop: '#c0a0d8',
      bands: ['#241a33', '#20172d', '#1c1427', '#171021', '#120d1a', '#0d0913'],
      far: '#332450', farLit: '#4a3570', near: '#1f1733',
    },
    pool: ['crushhall', 'crush1', 'boulderrun', 'echoroom', 'sawcorridor', 'blinkbridge',
           'finalgauntlet', 'sparkroom', 'stack1', 'stack2', 'boulder1', 'blinkgoo', 'phantomwalk'],
    effects: ['strobe', 'swapkeys', 'mirror', 'dark', 'heavy', 'lag', 'invert'],
    effectChance: 0.62,
    end: 'end3',
  },
];

/* ------------------------------------------------------------- the mother board */
/* Shiny rocks are the currency. Each level banks its best haul once, so rocks
   can be improved by replaying a level but never farmed in a loop. The board
   itself is laid out like a PCB: power on the left, traces running right, each
   upgrade a chip soldered onto the line that feeds it. */

const BOARD = [
  { id: 'cap1',   code: 'C1', name: 'POWER CELL',    desc: '+30 SAUCER STAMINA',            cost: 6,  req: [],        x: 40,  y: 52,  bank: 0 },
  { id: 'reg',    code: 'VR', name: 'REGULATOR',     desc: 'STAMINA REFILLS 60% FASTER',    cost: 6,  req: [],        x: 40,  y: 108, bank: 0 },

  { id: 'heat',   code: 'HS', name: 'HEAT SINK',     desc: 'FLYING BURNS 20% LESS',         cost: 12, req: ['cap1'],  x: 104, y: 26,  bank: 1 },
  { id: 'cap2',   code: 'C2', name: 'POWER CELL 2',  desc: '+30 MORE SAUCER STAMINA',       cost: 18, req: ['cap1'],  x: 104, y: 62,  bank: 1 },
  { id: 'damp',   code: 'DP', name: 'DAMPENER',      desc: 'NO STUN WHEN THE SAUCER CRASHES', cost: 12, req: ['reg'], x: 104, y: 100, bank: 1 },
  { id: 'boost',  code: 'BO', name: 'BOOSTER',       desc: 'RUN 18% FASTER',                cost: 8,  req: ['reg'],   x: 104, y: 138, bank: 1 },

  { id: 'core',   code: 'OC', name: 'OVERCLOCK',     desc: 'STRONGER SAUCER THRUST',        cost: 20, req: ['heat'],  x: 168, y: 26,  bank: 2 },
  { id: 'magnet', code: 'TB', name: 'TRACTOR BEAM',  desc: 'ROCKS PULL TOWARDS YOU',        cost: 8,  req: ['cap2'],  x: 168, y: 62,  bank: 2 },
  { id: 'fuse',   code: 'FU', name: 'SPARE FUSE',    desc: 'SURVIVE ONE HIT PER CHECKPOINT', cost: 28, req: ['damp'], x: 168, y: 100, bank: 2 },
  { id: 'anchor', code: 'MB', name: 'MAG BOOTS',     desc: 'WIND NO LONGER PUSHES YOU',     cost: 14, req: ['boost'], x: 168, y: 138, bank: 2 },

  { id: 'lamp',   code: 'HL', name: 'HEADLAMP',      desc: 'SEE MUCH FURTHER IN THE DARK',  cost: 10, req: ['core'],  x: 232, y: 44,  bank: 3 },
  { id: 'gyro',   code: 'GY', name: 'GYRO CHIP',     desc: 'DOUBLE JUMP',                   cost: 22, req: ['fuse'],  x: 232, y: 118, bank: 3 },

  { id: 'scan',   code: 'SC', name: 'SCANNER',       desc: 'FAKE AND PHANTOM TILES ALWAYS SHOW', cost: 18, req: ['lamp'], x: 288, y: 44,  bank: 4 },
  { id: 'stab',   code: 'ST', name: 'STABILIZER',    desc: 'REVERSED AND SWAPPED CONTROLS STOP', cost: 34, req: ['gyro'], x: 288, y: 118, bank: 4 },
];

const BOARD_BY_ID = {};
for (const n of BOARD) BOARD_BY_ID[n.id] = n;

function hasSkill(id) { return !!game.skills[id]; }

/* Each chip belongs to a bank that ships with a stage. Clearing your way into
   stage N reveals bank N — and nothing you already installed is ever taken
   away, so the board only ever grows. */
function bankUnlocked(bank) {
  if (!bank) return true;
  if (game.reached.stage > bank) return true;
  return game.reached.stage === bank && (game.reached.idx > 0 || game.cleared[bank][0]);
}

function skillVisible(node) { return bankUnlocked(node.bank || 0); }

function skillReady(node) {
  return skillVisible(node) && node.req.every(r => hasSkill(r));
}

function rocksAvailable() {
  let earned = 0;
  for (const row of game.best) for (const v of row) earned += v;
  return earned - game.spent;
}

/* Recomputed whenever the board changes; the player reads these, not CFG. */
function refreshSkills() {
  game.sk = {
    fuelMax: CFG.fuelMax + (hasSkill('cap1') ? 30 : 0) + (hasSkill('cap2') ? 30 : 0),
    burn: CFG.fuelBurn * (hasSkill('heat') ? 0.8 : 1),
    regen: CFG.fuelRegen * (hasSkill('reg') ? 1.6 : 1),
    thrust: CFG.thrust * (hasSkill('core') ? 1.18 : 1),
    maxRun: CFG.maxRun * (hasSkill('boost') ? 1.18 : 1),
    doubleJump: hasSkill('gyro'),
    noStun: hasSkill('damp'),
    lamp: hasSkill('lamp'),
    scan: hasSkill('scan'),
    magnet: hasSkill('magnet'),
    fuse: hasSkill('fuse'),
    stab: hasSkill('stab'),
    anchor: hasSkill('anchor'),
  };
}

function buySkill(node) {
  if (hasSkill(node.id) || !skillReady(node) || rocksAvailable() < node.cost) return false;
  game.skills[node.id] = true;
  game.spent += node.cost;
  refreshSkills();
  writeSave();
  return true;
}

/* Deterministic RNG, so level 3-7 is the same level 3-7 on every machine. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function levelName(stage, idx) {
  return `${stage + 1}-${idx + 1}`;
}

/* Builds the chunk list and per-room effects for one level. */
function composeLevel(stage, idx) {
  const st = STAGES[stage];
  const rng = mulberry32((stage + 1) * 7919 + (idx + 1) * 104729);
  const zones = [];

  if (st.handmade && st.handmade[idx]) {
    return { name: levelName(stage, idx), chunks: st.handmade[idx].slice(), zones };
  }

  /* Rooms are drawn from a shuffled bag rather than picked at random, so a
     level never shows the same room twice until the whole pool is used up.
     Reshuffling only happens on levels longer than the pool. */
  const bagOf = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  let bag = bagOf(st.pool), bagAt = 0;
  const takeRoom = () => {
    if (bagAt >= bag.length) { bag = bagOf(st.pool); bagAt = 0; }
    return bag[bagAt++];
  };

  const rests = bagOf(['restK', 'restK2', 'restK3']);
  let restAt = 0;
  const takeRest = () => {
    if (restAt >= rests.length) restAt = 0;
    return rests[restAt++];
  };

  const body = 4 + Math.min(5, Math.floor(idx / 2));   // 4 rooms early, 9 late
  const chunks = [idx === 0 ? 'intro' : 'opener'];

  /* Checkpoints land every third or fourth room instead of always the third,
     so the rhythm of a level is not identical to the last one. */
  let sinceRest = 0;
  const restEvery = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < body; i++) {
    if (sinceRest >= restEvery && i < body - 1) {
      chunks.push(takeRest());
      sinceRest = 0;
      continue;
    }
    chunks.push(takeRoom());
    sinceRest++;
  }
  chunks.push(takeRest());
  chunks.push(st.end);

  /* Layer the stage's lies over whole rooms. Rest rooms stay honest, the same
     trick never runs in two rooms in a row, and the chance ramps up across the
     stage so the last levels are the nastiest. */
  const chance = st.effectChance * (0.55 + 0.75 * (idx / (LEVELS_PER_STAGE - 1)));
  let lastEffect = '';
  for (let i = 1; i < chunks.length - 1; i++) {
    if (chunks[i].startsWith('restK')) { lastEffect = ''; continue; }
    if (rng() > chance) { lastEffect = ''; continue; }
    let t = lastEffect;
    for (let tries = 0; tries < 6 && t === lastEffect; tries++) {
      t = st.effects[Math.floor(rng() * st.effects.length)];
    }
    lastEffect = t;
    zones.push([i, t, t === 'wind' ? (rng() < 0.5 ? -1 : 1) : 1]);
  }

  return { name: levelName(stage, idx), chunks, zones };
}

/* Signs, in the order they appear. Exactly one of them is true. */
const SIGNS = [
  "THIS PLATFORM IS DEFINITELY REAL",
  "SPIKES ARE JUST VERY FIRM MOSS",
  "SHORTCUT BELOW",
  "GRAVITY: 100% NORMAL, AS ALWAYS",
  "THE FLOOR IS ALWAYS DOWN",
  "TAKE THE HIGH ROUTE. NEVER THE LOW ROUTE.",
  "FUEL IS A MYTH. HOLD THE SAUCER FOREVER.",
  "YOU CANNOT DIE HERE",
  "THE FIRST MOTHERSHIP IS THE REAL ONE",
  "EVERY SIGN IN THIS CAVE LIES. INCLUDING THIS ONE.",
  "SIMPLY WALK RIGHT",
  "NOTHING IS BEHIND YOU",
];

/* Zone presentation: colour, badge text, badge order. */
const ZONE_INFO = {
  invert:   { col: '#ff5fd0', label: '<> REVERSED' },
  swapkeys: { col: '#ffd23f', label: 'BUTTONS SWAPPED' },
  lag:      { col: '#5fa8ff', label: 'INPUT DELAY' },
  mirror:   { col: '#5fe8ff', label: 'MIRRORED' },
  heavy:    { col: '#ff6b4a', label: 'HEAVY' },
  low:      { col: '#b98cff', label: 'LOW GRAVITY' },
  dark:     { col: '#8f89a6', label: 'LIGHTS OUT' },
  flip:     { col: '#5fff9b', label: 'GRAVITY FLIPPED' },
  wind:     { col: '#ffa14a', label: 'WIND' },
  strobe:   { col: '#ffffff', label: 'FLICKER' },
};

/* ------------------------------------------------------------------- canvas */

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* Offscreen art-pixel buffer. Everything is drawn here in art pixels, then
   scaled up to the visible canvas in one nearest-neighbour blit. */
const bc = document.createElement('canvas');
bc.width = BW; bc.height = BH;
const bx = bc.getContext('2d');
bx.imageSmoothingEnabled = false;

const touchPad = document.getElementById('touch');

/* -------------------------------------------------------------------- audio */
/* Tiny synthesised blips so the game ships as three text files. */

let actx = null, muted = false;

function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function sfx(kind) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.connect(g); g.connect(a.destination);

  const shapes = {
    jump:    ['square',   420,  780, 0.10, 0.14],
    thrust:  ['sawtooth',  90,  150, 0.07, 0.09],
    land:    ['triangle', 200,  120, 0.07, 0.09],
    pickup:  ['square',   880, 1500, 0.09, 0.10],
    check:   ['triangle', 520, 1040, 0.16, 0.22],
    die:     ['sawtooth', 300,   60, 0.20, 0.38],
    flip:    ['sine',     240,  820, 0.13, 0.20],
    warp:    ['square',   660,  220, 0.11, 0.16],
    goal:    ['triangle', 440, 1320, 0.18, 0.45],
    thud:    ['square',    70,   45, 0.16, 0.14],
    stall:   ['sawtooth', 420,   70, 0.16, 0.40],
    crash:   ['square',    90,   38, 0.18, 0.22],
    reboot:  ['sine',      180, 700, 0.14, 0.35],
  };
  const [type, f0, f1, vol, dur] = shapes[kind] || shapes.jump;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/* -------------------------------------------------------------------- input */

const rawKeys = Object.create(null);
const touchKeys = Object.create(null);

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ShiftLeft: 'thrust', ShiftRight: 'thrust', KeyS: 'thrust', ArrowDown: 'thrust',
};

addEventListener('keydown', e => {
  audio();

  /* Typing a sign message swallows everything except Enter and Escape. */
  if (editor.on && editor.typing) {
    e.preventDefault();
    if (e.key === 'Enter') {
      const key = editor.tx + ',' + editor.ty;
      if (!level.src.signs) level.src.signs = {};
      if (editor.buf.trim()) level.src.signs[key] = editor.buf.trim().toUpperCase();
      else delete level.src.signs[key];
      editor.typing = false;
      editor.dirty = true;
      rebuildFromSource(false);
      editStatus('SIGN SET', 1.4);
    } else if (e.key === 'Escape') {
      editor.typing = false;
      editStatus('CANCELLED', 1);
    } else if (e.key === 'Backspace') {
      editor.buf = editor.buf.slice(0, -1);
    } else if (e.key.length === 1 && editor.buf.length < 42) {
      editor.buf += e.key;
    }
    return;
  }

  if (editor.on) {
    e.preventDefault();
    switch (e.code) {
      case 'KeyE': case 'Escape': closeEditor(); editStatus('', 0); return;
      case 'BracketLeft': editor.tool = (editor.tool + TOOLS.length - 1) % TOOLS.length; return;
      case 'BracketRight': editor.tool = (editor.tool + 1) % TOOLS.length; return;
      case 'KeyZ': if (editor.tx >= 0) cycleRoomZone(editor.tx); return;
      case 'KeyS': editorSave(); return;
      case 'KeyP': publishFromEditor(); return;
      case 'KeyX': editorRevert(); return;
      case 'Enter': editorTestPlay(); return;
      case 'KeyT':
        if (editor.tx >= 0 && signAt(editor.tx, editor.ty)) {
          editor.typing = true;
          const cur = level.src.signs && level.src.signs[editor.tx + ',' + editor.ty];
          editor.buf = cur || '';
        } else {
          editStatus('POINT AT A SIGN FIRST', 1.4);
        }
        return;
      case 'KeyM': muted = !muted; editStatus(muted ? 'MUTED' : 'UNMUTED', 1); return;
    }
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 9) editor.tool = Math.min(TOOLS.length - 1, n);
      return;
    }
    /* arrows and WASD fall through to pan the camera */
    const act = KEYMAP[e.code];
    if (act) rawKeys[act] = true;
    return;
  }

  if (lab.on) {
    if (e.ctrlKey || e.metaKey) {
      /* Ctrl+C copies; Ctrl+V falls through to the paste handler below. */
      if (e.code === 'KeyC') { e.preventDefault(); labCopy(); }
      return;
    }
    e.preventDefault();
    switch (e.code) {
      case 'ArrowLeft': lab.cx = (lab.cx + SKIN_W - 1) % SKIN_W; return;
      case 'ArrowRight': lab.cx = (lab.cx + 1) % SKIN_W; return;
      case 'ArrowUp': lab.cy = (lab.cy + SKIN_H - 1) % SKIN_H; return;
      case 'ArrowDown': lab.cy = (lab.cy + 1) % SKIN_H; return;
      case 'Space': labSetPixel(lab.cx, lab.cy, lab.col); return;
      case 'Backspace': case 'Delete': labSetPixel(lab.cx, lab.cy, '.'); return;
      case 'BracketLeft':
        lab.col = SKIN_PALETTE[(SKIN_PALETTE.indexOf(lab.col) + SKIN_PALETTE.length - 1) % SKIN_PALETTE.length];
        return;
      case 'BracketRight':
        lab.col = SKIN_PALETTE[(SKIN_PALETTE.indexOf(lab.col) + 1) % SKIN_PALETTE.length];
        return;
      case 'KeyS': labSave(); return;
      case 'KeyR': labReset(); return;
      case 'KeyX': labClear(); return;
      case 'KeyC': labCycleBeard(e.shiftKey ? -1 : 1); return;
      case 'KeyQ': labShave(); return;
      case 'Escape': closeLab(); return;
      case 'KeyM': muted = !muted; return;
    }
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 4) labSelectSlot(n - 1);
    }
    return;
  }

  /* The board wants four-way navigation, so it takes the arrows itself rather
     than letting them fall through to the shared jump/thrust mapping. */
  if (game.state === 'board') {
    e.preventDefault();
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': boardMove(-1, 0); return;
      case 'ArrowRight': case 'KeyD': boardMove(1, 0); return;
      case 'ArrowUp': case 'KeyW': boardMove(0, -1); return;
      case 'ArrowDown': case 'KeyS': boardMove(0, 1); return;
      case 'Space': case 'Enter': {
        const n = BOARD[game.boardCursor];
        if (buySkill(n)) { sfx('check'); toast(n.name + ' INSTALLED', 1.4); }
        else sfx('thud');
        return;
      }
      case 'KeyB': case 'Escape': showMap(game.stage); return;
      case 'KeyM': muted = !muted; return;
    }
    return;
  }

  const act = KEYMAP[e.code];
  if (act) { rawKeys[act] = true; e.preventDefault(); }
  if (e.code === 'KeyB' && game.state === 'map') { showBoard(); return; }
  if (e.code === 'KeyC' && (game.state === 'map' || game.state === 'title')) { openLab(); return; }
  if (e.code === 'KeyG' && (game.state === 'map' || game.state === 'title')) { showChoose(); return; }
  if (e.code === 'KeyR' && game.state === 'play') respawn(true);
  if (e.code === 'KeyM') { muted = !muted; toast(muted ? 'MUTED' : 'UNMUTED', 0.8); }
  if (e.code === 'KeyE') {
    if (game.state === 'play') { openEditor(); return; }
    if (game.state === 'map' && isUnlocked(game.stage, game.cursor)) {
      startLevel(game.stage, game.cursor);
      openEditor();
      return;
    }
  }
  if (e.code === 'Escape') {
    if (game.state === 'play') showMap(game.stage);
    else if (game.state === 'map') showTitle();
  }
  if (e.code === 'Enter') { rawKeys.jump = true; e.preventDefault(); }
}, { passive: false });

addEventListener('keyup', e => {
  if (e.code === 'Enter') rawKeys.jump = false;
}, { passive: false });

function clearHeldKeys() {
  for (const k in rawKeys) rawKeys[k] = false;
  for (const k in touchKeys) touchKeys[k] = false;
  menuPrev = { l: true, r: true, j: true, t: true };   // swallow the key that got us here
}

addEventListener('keyup', e => {
  const act = KEYMAP[e.code];
  if (act) { rawKeys[act] = false; e.preventDefault(); }
}, { passive: false });

addEventListener('blur', () => { for (const k in rawKeys) rawKeys[k] = false; });

/* Touch buttons */
for (const btn of document.querySelectorAll('#touch .tb')) {
  const act = btn.dataset.key;
  const on = e => { e.preventDefault(); touchKeys[act] = true; audio(); };
  const off = e => { e.preventDefault(); touchKeys[act] = false; };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off, { passive: false });
  btn.addEventListener('touchcancel', off, { passive: false });
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
}
if (matchMedia('(hover: none) and (pointer: coarse)').matches) touchPad.classList.remove('hidden');

function readRaw() {
  return {
    l: !!(rawKeys.left || touchKeys.left),
    r: !!(rawKeys.right || touchKeys.right),
    j: !!(rawKeys.jump || touchKeys.jump),
    t: !!(rawKeys.thrust || touchKeys.thrust),
  };
}

/* -------------------------------------------------------------- game state */

const game = {
  state: 'title',            // title | map | play | clear | finale
  stage: 0,                  // which stage map we are on
  levelIdx: 0,               // which node on that map
  cursor: 0,                 // highlighted node on the map screen
  time: 0,
  frame: 0,
  deaths: 0,
  runDeaths: 0,
  shake: 0,
  flash: 0,                  // white flash, used on gravity flips
  redFlash: 0,               // death flash
  mirrorAmt: 0,              // eased 0..1 so the world squishes through the flip
  darkAmt: 0,
  cleared: [],               // cleared[stage][idx] = true
  best: [],                  // best[stage][idx] = most rocks banked from that level
  skills: {},                // mother board chips owned
  spent: 0,                  // rocks spent on the board
  sk: null,                  // derived stats, see refreshSkills
  boardCursor: 0,
  charIdx: 0,                // which character you fly as
  charChosen: false,
  reached: { stage: 0, idx: 0 },   // furthest node unlocked
  fade: 0,                   // screen wipe between states
  markerAt: 0,               // eased map marker position
  splashT: 0,                // studio splash timer
  creditsY: 0,               // credits scroll offset
  credits: null,
};

function totalCleared() {
  let n = 0;
  for (const row of game.cleared) for (const v of row) if (v) n++;
  return n;
}

function isUnlocked(stage, idx) {
  if (stage < game.reached.stage) return true;
  return stage === game.reached.stage && idx <= game.reached.idx;
}

let level = null;
let p = null;                // player
let ents = [];
let particles = [];
let inputLog = [];           // raw input snapshots, for the delay zones
let prevEff = { l: 0, r: 0, j: 0, t: 0 };
let cam = { x: 0, y: 0 };
let hintText = '', hintTimer = 0;
let toastText = '', toastTimer = 0;
let clearInfo = null;

/* -------------------------------------------------------------------- save */

const SAVE_KEY = 'uggsaucer.progress';

function blankCleared() {
  const out = [];
  for (let s = 0; s < STAGE_COUNT; s++) out.push(new Array(LEVELS_PER_STAGE).fill(false));
  return out;
}

function blankBest() {
  const out = [];
  for (let s = 0; s < STAGE_COUNT; s++) out.push(new Array(LEVELS_PER_STAGE).fill(0));
  return out;
}

function loadSave() {
  game.cleared = blankCleared();
  game.best = blankBest();
  game.skills = {};
  game.spent = 0;
  game.reached = { stage: 0, idx: 0 };
  game.deaths = 0;
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    game.deaths = s.deaths | 0;
    game.spent = s.spent | 0;
    if (Array.isArray(s.cleared)) {
      for (let a = 0; a < STAGE_COUNT; a++) {
        for (let b = 0; b < LEVELS_PER_STAGE; b++) {
          game.cleared[a][b] = !!(s.cleared[a] && s.cleared[a][b]);
          if (Array.isArray(s.best) && s.best[a]) game.best[a][b] = s.best[a][b] | 0;
        }
      }
    }
    if (s.skills) for (const n of BOARD) if (s.skills[n.id]) game.skills[n.id] = true;
    game.charIdx = clamp(s.charIdx | 0, 0, CHARACTERS.length - 1);
    game.charChosen = !!s.charChosen;
    if (s.reached) {
      game.reached.stage = clamp(s.reached.stage | 0, 0, STAGE_COUNT - 1);
      game.reached.idx = clamp(s.reached.idx | 0, 0, LEVELS_PER_STAGE - 1);
    }
  } catch (_) { /* storage blocked; play without saving */ }
  game.stage = game.reached.stage;
  game.cursor = game.reached.idx;
  refreshSkills();
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cleared: game.cleared, best: game.best, skills: game.skills,
      spent: game.spent, reached: game.reached, deaths: game.deaths,
      charIdx: game.charIdx, charChosen: game.charChosen,
    }));
  } catch (_) { /* ignore */ }
}

/* ---- edited levels -------------------------------------------------------
   The editor saves a whole level source here, keyed by stage and index. If a
   level has an override it is loaded instead of being composed from chunks, so
   an edit survives reloads and can always be reverted back to the original. */

const EDIT_KEY = 'uggsaucer.levels';
let overrides = {};

function loadOverrides() {
  try { overrides = JSON.parse(localStorage.getItem(EDIT_KEY) || '{}') || {}; }
  catch (_) { overrides = {}; }
}

function persistOverrides() {
  try { localStorage.setItem(EDIT_KEY, JSON.stringify(overrides)); return true; }
  catch (_) { return false; }
}

function overrideKey(stage, idx) { return stage + ',' + idx; }

function hasOverride(stage, idx) {
  return Object.prototype.hasOwnProperty.call(overrides, overrideKey(stage, idx));
}

function saveOverride(stage, idx, src) {
  overrides[overrideKey(stage, idx)] = {
    rows: src.rows.slice(),
    zones: (src.zones || []).map(z => z.slice()),
    signs: Object.assign({}, src.signs),
  };
  return persistOverrides();
}

function clearOverride(stage, idx) {
  delete overrides[overrideKey(stage, idx)];
  persistOverrides();
}

/* ---- shareable level codes ----------------------------------------------
   A whole level as one line of text, so a level can be posted, pasted into a
   message, or handed to anyone else. Rows are run-length encoded —
   tile characters are never digits, so "#16" is unambiguous — which takes a
   typical level from a few thousand characters to a few hundred. */

function rleRow(row) {
  let out = '';
  let i = 0;
  while (i < row.length) {
    const ch = row[i] === ' ' ? '.' : row[i];
    let n = 1;
    while (i + n < row.length && (row[i + n] === ' ' ? '.' : row[i + n]) === ch) n++;
    out += ch + n;
    i += n;
  }
  return out;
}

function unRleRow(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    i++;
    let num = '';
    while (i < s.length && s[i] >= '0' && s[i] <= '9') { num += s[i]; i++; }
    const n = parseInt(num || '1', 10);
    out += (ch === '.' ? ' ' : ch).repeat(Math.max(0, Math.min(4096, n)));
  }
  return out;
}

function encodeLevelCode(src, name) {
  const clean = String(name || 'UNTITLED').replace(/~/g, '-').slice(0, 24);
  const rows = src.rows.map(rleRow).join(';');
  const zones = (src.zones || []).map(z => z.join(',')).join(';');
  const signs = Object.keys(src.signs || {})
    .map(k => k.replace(/[|:]/g, '') + ':' + String(src.signs[k]).replace(/[|~]/g, ' '))
    .join('|');
  return ['TBS1', clean, rows, zones, signs].join('~');
}

function decodeLevelCode(code) {
  const parts = String(code).trim().split('~');
  if (parts[0] !== 'TBS1' || parts.length < 3) return null;
  const name = parts[1] || 'UNTITLED';
  const rows = parts[2].split(';').map(unRleRow);
  if (!rows.length) return null;

  /* every row must be the same width, and a whole number of rooms wide */
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  w = Math.max(CW, Math.ceil(w / CW) * CW);
  const padded = [];
  for (let y = 0; y < CH; y++) {
    let r = rows[y] || '';
    if (r.length > w) r = r.slice(0, w);
    while (r.length < w) r += ' ';
    padded.push(r);
  }

  const zones = [];
  if (parts[3]) {
    for (const z of parts[3].split(';')) {
      if (!z) continue;
      const f = z.split(',');
      if (f.length < 5) continue;
      zones.push([f[0], +f[1] || 0, +f[2] || 0, +f[3] || 0, +f[4] || 0, f[5] === undefined ? 1 : +f[5]]);
    }
  }

  const signs = {};
  if (parts[4]) {
    for (const s of parts[4].split('|')) {
      const at = s.indexOf(':');
      if (at < 0) continue;
      signs[s.slice(0, at)] = s.slice(at + 1);
    }
  }

  return { name, src: { rows: padded, zones, signs } };
}

/* A flat starter level for building one from scratch. */
function blankUserLevel(rooms) {
  const cols = (rooms || 6) * CW;
  const rows = [];
  for (let y = 0; y < CH; y++) {
    if (y >= 14) rows.push('#'.repeat(cols));
    else rows.push(' '.repeat(cols));
  }
  const put = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  put(2, 13, '@');
  put(cols - 4, 13, 'G');
  return { rows, zones: [], signs: {} };
}

/* The source a level should load from: an edit if one exists, else the
   generated original. */
function levelSource(stage, idx) {
  if (hasOverride(stage, idx)) {
    const o = overrides[overrideKey(stage, idx)];
    return { rows: o.rows.slice(), zones: (o.zones || []).map(z => z.slice()), signs: Object.assign({}, o.signs) };
  }
  const built = sourceFromChunks(composeLevel(stage, idx));
  built.signs = {};
  return built;
}

/* ------------------------------------------------------------ level loading */

/* Stamps a level's chunk list into a plain character grid. Everything stays in
   the grid as authored, entity markers included: that grid is the editable
   source of truth, and buildLevel is what turns it into a playable level. */
function sourceFromChunks(def) {
  const cols = def.chunks.length * CW;
  const rows = [];
  for (let y = 0; y < CH; y++) rows.push(new Array(cols).fill(' '));
  const zones = [];

  def.chunks.forEach((id, ci) => {
    const chunk = CHUNKS[id];
    if (!chunk) { console.warn('missing chunk', id); return; }
    const top = CH - chunk.r.length;        // bottom-align the chunk
    const ox = ci * CW;
    for (let ry = 0; ry < chunk.r.length; ry++) {
      const row = chunk.r[ry];
      if (row.length !== CW) console.warn(`chunk ${id} row ${ry} is ${row.length} wide, expected ${CW}`);
      for (let rx = 0; rx < CW; rx++) {
        const ch = row[rx] || ' ';
        if (ch !== ' ') rows[top + ry][ox + rx] = ch;
      }
    }
    if (chunk.z) {
      for (const [t, zx, zy, zw, zh, param] of chunk.z) {
        zones.push([t, (ox + zx), zy, zw, zh, param === undefined ? 1 : param]);
      }
    }
  });

  /* Whole-room effects chosen by the level builder, as tile rects. */
  for (const [ci, t, param] of (def.zones || [])) {
    zones.push([t, ci * CW, 0, CW, CH, param]);
  }

  return { rows: rows.map(r => r.join('')), zones };
}

/* src: { rows: [string], zones: [[type,tx,ty,tw,th,param]], signs: {"x,y": text} } */
function buildLevel(src, stage, name) {
  const cols = src.rows[0].length;
  const grid = [];
  for (let y = 0; y < CH; y++) grid.push(new Array(cols).fill(' '));

  const zones = [];
  const defs = [];              // entity blueprints, re-instanced on respawn
  const checkpoints = [];
  const signs = [];
  const shinies = [];
  let spawn = null;
  let goal = null, decoy = null;
  let signCount = 0;

  for (let gy = 0; gy < CH; gy++) {
    const row = src.rows[gy] || '';
    for (let gx = 0; gx < cols; gx++) {
      const ch = row[gx] || ' ';
      if (ch === ' ') continue;
      const px = gx * TS, py = gy * TS;

      switch (ch) {
        case '@':
          spawn = { x: px + 5, y: py + TS - PH };
          break;
        case 'K':
          checkpoints.push({ x: px, y: py, gx, gy, hit: false });
          grid[gy][gx] = 'K';
          break;
        case 'G':
          goal = { x: px, y: py };
          grid[gy][gx] = 'G';
          break;
        case 'g':
          decoy = { x: px, y: py };
          grid[gy][gx] = 'g';
          break;
        case '*':
          shinies.push({ x: px + TS / 2, y: py + TS / 2, got: false });
          break;
        case '?': {
          const custom = src.signs && src.signs[gx + ',' + gy];
          signs.push({ x: px, y: py, gx, gy, msg: custom || SIGNS[signCount % SIGNS.length] });
          signCount++;
          grid[gy][gx] = '?';
          break;
        }
        case 'S': defs.push({ k: 'saw', x: px + TS / 2, y: py + TS / 2 }); break;
        case 'V': defs.push({ k: 'crusher', x: px, y: py }); break;
        case 'o': defs.push({ k: 'spark', x: px + TS / 2, y: py + TS / 2 }); break;
        case 'd': defs.push({ k: 'critter', x: px + 2, y: py + 4 }); break;
        case 'E': defs.push({ k: 'echotrigger', x: px, y: py }); break;
        case 'R': defs.push({ k: 'boulderspawn', x: px + TS / 2, y: py + TS / 2 }); break;
        default:
          grid[gy][gx] = ch;
      }
    }
  }

  for (const [t, tx, ty, tw, thh, param] of (src.zones || [])) {
    zones.push({ t, x: tx * TS, y: ty * TS, w: tw * TS, h: thh * TS, p: param === undefined ? 1 : param });
  }

  /* An edited level might have no spawn marker left; drop him in at the left. */
  if (!spawn) spawn = { x: TS, y: 13 * TS };

  level = {
    stage, name, src, grid, cols, rows: CH,
    w: cols * TS, h: CH * TS,
    theme: STAGES[stage].theme,
    zones, defs, checkpoints, signs, shinies, spawn, goal, decoy,
    totalShiny: shinies.length,
  };

  /* Crushers need to know how far they can extend; measure it once. */
  for (const d of level.defs) {
    if (d.k !== 'crusher') continue;
    const gx = Math.floor(d.x / TS);
    let reach = 0;
    for (let gy = Math.floor(d.y / TS) + 1; gy < CH && reach < 6; gy++) {
      if (isSolidAt(gx, gy)) break;
      reach++;
    }
    d.reach = reach * TS;
  }

  spawnEntities();
  return level;
}

function spawnEntities() {
  ents = [];
  for (const d of level.defs) {
    switch (d.k) {
      case 'saw':
        ents.push({ k: 'saw', x: d.x, y: d.y, r: 15, vx: 1.6, min: d.x - 4.5 * TS, max: d.x + 4.5 * TS, spin: 0 });
        break;
      case 'crusher':
        ents.push({ k: 'crusher', x: d.x, y: d.y, homeY: d.y, reach: d.reach || 4 * TS, t: Math.random() * 2.4, ext: 0 });
        break;
      case 'spark':
        ents.push({ k: 'spark', x: d.x, y: d.y, vx: 0, vy: 0, r: 9 });
        break;
      case 'critter':
        ents.push({ k: 'critter', x: d.x, y: d.y, w: 26, h: 24, vx: 1.1, vy: 0, dir: 1, bob: Math.random() * 6 });
        break;
      case 'echotrigger':
        ents.push({ k: 'echotrigger', x: d.x, y: d.y, used: false });
        break;
      case 'boulderspawn':
        ents.push({ k: 'boulderspawn', x: d.x, y: d.y, used: false });
        break;
    }
  }
}

/* --------------------------------------------------------------- tile tests */

function tileAt(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= level.cols || gy >= level.rows) return gx < 0 ? '#' : ' ';
  return level.grid[gy][gx];
}

function blinkOn(phaseB) {
  const on = Math.floor(game.time / CFG.blinkPeriod) % 2 === 0;
  return phaseB ? !on : on;
}

function isSolidAt(gx, gy) {
  const ch = tileAt(gx, gy);
  if (SOLID.has(ch)) return true;
  if (ch === 'B') return blinkOn(false);
  if (ch === 'b') return blinkOn(true);
  return false;
}

/* Solid tiles overlapping a box, as a list. Used for collision resolution. */
function boxSolids(x, y, w, h) {
  const out = [];
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 1) / TS);
  const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 1) / TS);
  for (let gy = y0; gy <= y1; gy++)
    for (let gx = x0; gx <= x1; gx++)
      if (isSolidAt(gx, gy)) out.push({ gx, gy, ch: tileAt(gx, gy) });
  return out;
}

function boxHitsSolid(x, y, w, h) {
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 1) / TS);
  const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 1) / TS);
  for (let gy = y0; gy <= y1; gy++)
    for (let gx = x0; gx <= x1; gx++)
      if (isSolidAt(gx, gy)) return true;
  return false;
}

/* Spikes attached to a ceiling point downward, and their hitbox follows. */
function spikeHangs(gx, gy) {
  return isSolidAt(gx, gy - 1) && !isSolidAt(gx, gy + 1);
}

/* Hazard tiles get a smaller box than their tile so grazing an edge is survivable. */
function boxHitsDeadly(x, y, w, h) {
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 1) / TS);
  const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 1) / TS);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const ch = tileAt(gx, gy);
      if (!DEADLY.has(ch)) continue;
      let hy, hh;
      if (ch === '^') {
        hh = TS - 12;
        hy = spikeHangs(gx, gy) ? gy * TS + 2 : gy * TS + 11;
      } else {
        hy = gy * TS + 4; hh = TS - 5;
      }
      const hx = gx * TS + 5, hw = TS - 10;
      if (x < hx + hw && x + w > hx && y < hy + hh && y + h > hy) return true;
    }
  }
  return false;
}

/* --------------------------------------------------------------- the player */

function makePlayer(at) {
  return {
    x: at.x, y: at.y, vx: 0, vy: 0, w: PW, h: PH,
    onGround: false, coyote: 0, buffer: 0, facing: 1,
    fuel: game.sk.fuelMax, gdir: 1, thrusting: false,
    airJumps: 0,                       // gyro chip allowance, refreshed on landing
    shield: game.sk.fuse ? 1 : 0,      // spare fuse, one hit per checkpoint
    invuln: 0,
    stalled: false, stunTimer: 0, rebootTimer: 0,
    dead: false, deadTimer: 0, winTimer: 0,
    checkpoint: { x: at.x, y: at.y },
    shiny: 0, echoOn: false, history: [],
    eff: {},
  };
}

function startLevel(stage, idx) {
  game.stage = stage;
  game.levelIdx = idx;
  game.state = 'play';
  game.time = 0;
  game.runDeaths = 0;
  game.mirrorAmt = 0;
  game.darkAmt = 0;
  game.fade = 1;
  buildLevel(levelSource(stage, idx), stage, levelName(stage, idx));
  p = makePlayer(level.spawn);
  particles = [];
  inputLog = [];
  cam.x = clamp(p.x - viewW / 2, 0, Math.max(0, level.w - viewW));
  cam.y = clamp(p.y - viewH / 2, 0, Math.max(0, level.h - viewH));
  clearHeldKeys();               // the key that opened the level must not also jump
  toast('LEVEL ' + level.name, 1.6);
}

function respawn(manual) {
  const cp = p.checkpoint;
  const keptShiny = p.shiny;
  p = makePlayer(cp);
  p.checkpoint = { x: cp.x, y: cp.y };
  p.shiny = keptShiny;
  p.echoOn = false;               // the doppelganger always resets, mercifully
  spawnEntities();
  /* Re-arm triggers the player already passed, except the echo. */
  inputLog = [];
  if (!manual) { game.deaths++; game.runDeaths++; writeSave(); }
}

/* ---- the saucer stalling, crashing, and coming back ----------------------
   Ugg's beard is the fuel gauge: it hangs loose when the saucer is charged and
   knots itself up as the stamina drains. At zero the saucer quits, he drops,
   and he sits there tangled until it charges enough to lift him back up. None
   of this is fatal on its own — only what he lands on can kill him. */

function stallSaucer() {
  if (p.stalled) return;
  p.stalled = true;
  p.thrusting = false;
  p.rebootTimer = 0;
  p.vy += 1.4 * p.gdir;
  game.shake = 5;
  sfx('stall');
  toast('BEARD TANGLED', 1.2);
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: p.x + p.w / 2 + rand(-8, 8), y: p.y + p.h / 2,
      vx: rand(-1.2, 1.2), vy: rand(-1.4, 0.4) * p.gdir,
      life: rand(0.4, 0.9), max: 0.9, col: '#5b6280', r: rand(2, 4),
    });
  }
}

function crashLanding(impact) {
  p.stunTimer = game.sk.noStun ? 0 : CFG.stunTime;
  game.shake = Math.min(11, 4 + impact);
  sfx('crash');
  burst(p.x + p.w / 2, p.y + (p.gdir > 0 ? p.h : 0), 14, '#8a7f9e');
}

function rebootSaucer() {
  p.stalled = false;
  p.rebootTimer = CFG.rebootTime;
  sfx('reboot');
  toast('SAUCER REBOOTING', 0.9);
  burst(p.x + p.w / 2, p.y + (p.gdir > 0 ? p.h : 0), 12, '#7ff3d8');
}

function kill(reason) {
  if (p.dead || p.winTimer > 0) return;
  if (p.invuln > 0) return;

  /* Spare fuse: eats one hit, then needs a checkpoint to reset. Falling out of
     the level is not something a fuse can help with. */
  if (p.shield > 0 && reason !== 'GONE') {
    p.shield--;
    p.invuln = 1.1;
    p.vy = -7 * p.gdir;
    p.vx = -p.facing * 4;
    game.shake = 8;
    sfx('warp');
    toast('FUSE BLOWN', 1.1);
    burst(p.x + p.w / 2, p.y + p.h / 2, 18, '#ffd479');
    return;
  }
  p.dead = true;
  p.deadTimer = 0.75;
  game.redFlash = 1;
  game.shake = 12;
  sfx('die');
  burst(p.x + p.w / 2, p.y + p.h / 2, 26, '#ff6a5a');
  burst(p.x + p.w / 2, p.y + p.h / 2, 14, '#c9c9d8');
  toast(reason || 'OOG', 0.9);
}

/* ------------------------------------------------------------------- effects */

function computeEffects() {
  const e = { windDir: 0 };
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (const z of level.zones) {
    if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) {
      e[z.t] = true;
      if (z.t === 'wind') e.windDir = z.p;
    }
  }
  /* Mother board chips that cancel a lie outright. */
  if (game.sk.stab) { e.invert = false; e.swapkeys = false; }
  if (game.sk.anchor) { e.wind = false; e.windDir = 0; }
  return e;
}

function effectiveInput(eff) {
  const raw = readRaw();
  inputLog.push(raw);
  if (inputLog.length > 200) inputLog.shift();

  let inp = raw;
  if (eff.lag) {
    const i = inputLog.length - 1 - CFG.lagFrames;
    if (i >= 0) inp = inputLog[i];
    else inp = { l: false, r: false, j: false, t: false };
  }

  let l = inp.l, r = inp.r, j = inp.j, t = inp.t;
  if (eff.invert) { const s = l; l = r; r = s; }
  if (eff.swapkeys) { const s = j; j = t; t = s; }
  return { l, r, j, t };
}

/* ------------------------------------------------------------------- physics */

function updatePlayer() {
  const eff = computeEffects();
  p.eff = eff;

  /* gravity direction can invert; announce the change loudly */
  const wantDir = eff.flip ? -1 : 1;
  if (wantDir !== p.gdir) {
    p.gdir = wantDir;
    p.vy *= -0.25;
    game.flash = 0.8;
    game.shake = 7;
    sfx('flip');
    burst(p.x + p.w / 2, p.y + p.h / 2, 16, '#5fff9b');
  }

  let grav = CFG.grav;
  if (eff.heavy) grav *= 1.95;
  if (eff.low) grav *= 0.40;

  const inp = effectiveInput(eff);

  /* A crashed saucer leaves Ugg sprawled for a moment before he can do anything. */
  if (p.stunTimer > 0) {
    p.stunTimer -= STEP;
    inp.l = inp.r = inp.j = inp.t = false;
  }

  /* --- horizontal --- */
  let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (dir !== 0) {
    p.vx += CFG.accel * dir;
    p.facing = dir;
  }
  if (eff.wind) p.vx += CFG.windAccel * eff.windDir;

  const maxRun = (eff.wind ? game.sk.maxRun + 1.2 : game.sk.maxRun);
  p.vx = clamp(p.vx, -maxRun - 2, maxRun + 2);
  if (dir === 0) p.vx *= (p.onGround ? CFG.fricGround : CFG.fricAir);
  if (Math.abs(p.vx) > maxRun) p.vx *= 0.96;
  if (Math.abs(p.vx) < 0.04) p.vx = 0;

  /* --- jump (with coyote time and a small input buffer, so the difficulty
         comes from the cave lying and not from dropped inputs) --- */
  const jumpPressed = inp.j && !prevEff.j;
  if (jumpPressed) p.buffer = CFG.jumpBuffer;
  if (p.buffer > 0) p.buffer--;
  if (p.coyote > 0) p.coyote--;

  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -CFG.jumpV * p.gdir;
    p.buffer = 0; p.coyote = 0; p.onGround = false;
    sfx('jump');
    burst(p.x + p.w / 2, p.y + (p.gdir > 0 ? p.h : 0), 6, '#cfc0a0');
  } else if (p.buffer > 0 && p.airJumps > 0) {
    /* gyro chip: one extra jump in mid-air, with its own little flourish */
    p.airJumps--;
    p.buffer = 0;
    p.vy = -CFG.jumpV * 0.92 * p.gdir;
    sfx('jump');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      particles.push({
        x: p.x + p.w / 2 + Math.cos(a) * 10, y: p.y + p.h / 2 + Math.sin(a) * 8,
        vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4,
        life: 0.35, max: 0.35, col: '#5fff9b', r: 2,
      });
    }
  }
  /* --- saucer thrust --- */
  p.thrusting = false;
  if (inp.t && p.fuel > 0 && !p.stalled) {
    p.vy -= game.sk.thrust * p.gdir;
    if (p.vy * p.gdir < -CFG.maxRise) p.vy = -CFG.maxRise * p.gdir;
    p.fuel = Math.max(0, p.fuel - game.sk.burn);
    p.thrusting = true;
    if (p.fuel === 0) stallSaucer();
    if (game.frame % 2 === 0) {
      const fy = p.y + (p.gdir > 0 ? p.h - 2 : 2);
      particles.push({
        x: p.x + p.w / 2 + rand(-6, 6), y: fy, vx: rand(-0.7, 0.7),
        vy: (rand(1.2, 2.6)) * p.gdir, life: 0.4, max: 0.4,
        col: Math.random() < 0.5 ? '#7ff3d8' : '#5fa8ff', r: rand(2, 4),
      });
    }
    if (game.frame % 7 === 0) sfx('thrust');
  }

  /* Once it restarts it lifts him back up on its own for a moment. */
  if (p.rebootTimer > 0) {
    p.rebootTimer -= STEP;
    p.vy -= CFG.rebootLift * p.gdir;
    const cap = CFG.maxRise * 0.75;
    if (p.vy * p.gdir < -cap) p.vy = -cap * p.gdir;
    p.thrusting = true;
    if (game.frame % 3 === 0) {
      particles.push({
        x: p.x + p.w / 2 + rand(-6, 6), y: p.y + (p.gdir > 0 ? p.h : 0),
        vx: rand(-0.6, 0.6), vy: rand(1.0, 2.2) * p.gdir,
        life: 0.35, max: 0.35, col: '#7ff3d8', r: rand(2, 3),
      });
    }
  }

  /* A dead saucer is dead weight. */
  if (p.stalled && !p.onGround) {
    p.vy += 0.16 * p.gdir;
    if (game.frame % 6 === 0) {
      particles.push({
        x: p.x + p.w / 2 + rand(-7, 7), y: p.y + p.h / 2,
        vx: rand(-0.5, 0.5), vy: rand(-0.8, -0.2) * p.gdir,
        life: rand(0.3, 0.6), max: 0.6, col: '#4a4560', r: rand(2, 4),
      });
    }
  }

  /* Releasing jump early cuts the arc short, but never fights the saucer. */
  if (!inp.j && !p.thrusting && p.vy * p.gdir < -3) p.vy = -3 * p.gdir;

  /* --- integrate + collide --- */
  p.vy += grav * p.gdir;
  p.vy = clamp(p.vy, -CFG.maxFall, CFG.maxFall);

  moveX(p.vx);
  const wasGround = p.onGround;
  const impact = Math.abs(p.vy);          // moveY zeroes vy, so read it first
  moveY(p.vy);
  settleOnGround();
  const justLanded = p.onGround && !wasGround;
  if (justLanded && p.stalled) crashLanding(impact);
  else if (justLanded && impact > 2) sfx('land');

  if (p.onGround) {
    p.coyote = CFG.coyote;
    p.airJumps = game.sk.doubleJump ? 1 : 0;
    p.fuel = Math.min(game.sk.fuelMax, p.fuel + game.sk.regen);
    if (p.stalled && p.stunTimer <= 0 && p.fuel >= game.sk.fuelMax * 0.42) rebootSaucer();
  }
  if (p.invuln > 0) p.invuln -= STEP;

  /* conveyors and bounce pads read the tile just past the player's feet */
  const footY = p.gdir > 0 ? p.y + p.h + 1 : p.y - 1;
  if (p.onGround) {
    const fx0 = Math.floor((p.x + 3) / TS), fx1 = Math.floor((p.x + p.w - 3) / TS);
    const fy = Math.floor(footY / TS);
    for (let gx = fx0; gx <= fx1; gx++) {
      const ch = tileAt(gx, fy);
      if (ch === 'C') p.vx += 0.55;
      else if (ch === 'c') p.vx -= 0.55;
      else if (ch === 'T') {
        p.vy = -16.5 * p.gdir;
        p.onGround = false;
        sfx('jump');
        burst(p.x + p.w / 2, footY, 12, '#ffd479');
      }
    }
  }

  /* --- hazards and bounds --- */
  if (boxHitsDeadly(p.x, p.y, p.w, p.h)) kill('OUCH');
  if (p.y > level.h + 120 || p.y < -160) kill('GONE');

  /* --- pickups, checkpoints, exits --- */
  for (const s of level.shinies) {
    if (s.got) continue;
    /* tractor beam drags nearby rocks in */
    if (game.sk.magnet) {
      const dx = (p.x + p.w / 2) - s.x, dy = (p.y + p.h / 2) - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 90 && d > 1) { s.x += (dx / d) * 2.6; s.y += (dy / d) * 2.6; }
    }
    if (Math.abs(s.x - (p.x + p.w / 2)) < 20 && Math.abs(s.y - (p.y + p.h / 2)) < 22) {
      s.got = true; p.shiny++; sfx('pickup');
      burst(s.x, s.y, 10, '#9fd0ff');
    }
  }

  for (const c of level.checkpoints) {
    if (c.hit) continue;
    if (rectHit(p.x, p.y, p.w, p.h, c.x - 6, c.y - 10, TS + 12, TS + 14)) {
      c.hit = true;
      p.checkpoint = { x: c.x + 3, y: c.y + TS - PH };
      if (game.sk.fuse) p.shield = 1;      // the fuse box is restocked here
      sfx('check');
      toast('CHECKPOINT (this one is honest)', 1.4);
      burst(c.x + TS / 2, c.y + TS / 2, 14, '#7de3c8');
    }
  }

  if (level.decoy && rectHit(p.x, p.y, p.w, p.h, level.decoy.x - 8, level.decoy.y - 8, TS + 16, TS + 16)) {
    p.vx = -7; p.vy = -6 * p.gdir;
    game.shake = 8;
    sfx('warp');
    toast('WRONG MOTHERSHIP', 1.3);
    level.decoy.hitOnce = true;
  }

  if (level.goal && p.winTimer === 0 &&
      rectHit(p.x, p.y, p.w, p.h, level.goal.x - 6, level.goal.y - 10, TS + 12, TS + 16)) {
    p.winTimer = 0.9;
    sfx('goal');
    burst(level.goal.x + TS / 2, level.goal.y + TS / 2, 40, '#ffe9a8');
  }

  /* --- doppelganger --- */
  p.history.push({ x: p.x, y: p.y, f: p.facing, g: p.gdir });
  if (p.history.length > CFG.echoDelay + 10) p.history.shift();
  if (p.echoOn) {
    const e = echoPos();
    if (e && rectHit(p.x, p.y, p.w, p.h, e.x + 3, e.y + 3, p.w - 6, p.h - 6)) kill('YOUR PAST CAUGHT YOU');
  }

  prevEff = inp;

  /* --- ease the visual effects --- */
  const targetMirror = p.eff.mirror ? 1 : 0;
  game.mirrorAmt += (targetMirror - game.mirrorAmt) * 0.12;
  const targetDark = p.eff.dark ? 1 : 0;
  game.darkAmt += (targetDark - game.darkAmt) * 0.10;
}

function moveX(dx) {
  p.x += dx;
  const hits = boxSolids(p.x, p.y, p.w, p.h);
  if (hits.length) {
    if (dx > 0) {
      let m = Infinity;
      for (const t of hits) m = Math.min(m, t.gx * TS);
      p.x = m - p.w;
    } else if (dx < 0) {
      let m = -Infinity;
      for (const t of hits) m = Math.max(m, t.gx * TS + TS);
      p.x = m;
    }
    p.vx = 0;
  }
  p.x = clamp(p.x, 0, level.w - p.w);
}

function moveY(dy) {
  p.y += dy;
  p.onGround = false;
  const hits = boxSolids(p.x, p.y, p.w, p.h);
  if (hits.length) {
    if (dy > 0) {
      let m = Infinity;
      for (const t of hits) m = Math.min(m, t.gy * TS);
      p.y = m - p.h;
      if (p.gdir > 0) p.onGround = true;
      p.vy = 0;
    } else if (dy < 0) {
      let m = -Infinity;
      for (const t of hits) m = Math.max(m, t.gy * TS + TS);
      p.y = m;
      if (p.gdir < 0) p.onGround = true;
      p.vy = 0;
    } else {
      /* A blinker materialised inside us. Nudge out along the shortest axis
         rather than killing the player, which would read as a random death. */
      const t = hits[0];
      const up = (t.gy * TS) - (p.y + p.h), down = (t.gy * TS + TS) - p.y;
      if (Math.abs(up) < Math.abs(down)) p.y += up; else p.y += down;
    }
  }
}

/* A box resting exactly on a tile boundary does not overlap anything, so the
   collision pass alone reports "airborne" on the frames between micro-falls.
   Probing the strip just past the feet keeps standing still actually standing. */
function groundedProbe() {
  const y = p.gdir > 0 ? p.y + p.h : p.y - 1;
  return boxHitsSolid(p.x + 3, y, p.w - 6, 1);
}

function settleOnGround() {
  if (p.onGround || !groundedProbe()) return;
  p.onGround = true;
  if (p.vy * p.gdir > 0) {
    p.vy = 0;
    p.y = p.gdir > 0
      ? Math.floor((p.y + p.h) / TS) * TS - p.h
      : Math.floor((p.y - 1) / TS) * TS + TS;
  }
}

function echoPos() {
  const i = p.history.length - 1 - CFG.echoDelay;
  return i >= 0 ? p.history[i] : null;
}

/* ------------------------------------------------------------------ entities */

function updateEnts() {
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;

  for (const e of ents) {
    switch (e.k) {

      case 'saw': {
        e.x += e.vx;
        e.spin += 0.34;
        if (e.x < e.min || e.x > e.max) { e.vx *= -1; e.x = clamp(e.x, e.min, e.max); }
        if (boxHitsSolid(e.x - e.r + 4, e.y - 4, (e.r - 4) * 2, 8)) { e.vx *= -1; e.x += e.vx * 2; }
        if (dist2(e.x, e.y, pcx, pcy) < (e.r + 11) ** 2) kill('SAW');
        break;
      }

      case 'crusher': {
        e.t += STEP;
        const cycle = 2.6;
        const ph = e.t % cycle;
        if (ph < 1.25) e.ext *= 0.86;                       // resting
        else if (ph < 1.45) e.ext = e.reach;                // slam
        else if (ph < 1.85) e.ext = e.reach;                // hold
        else e.ext += (0 - e.ext) * 0.12;                   // retract
        if (ph >= 1.25 && ph < 1.32 && Math.abs(e.x - pcx) < 200) { game.shake = 6; sfx('thud'); }
        e.y = e.homeY + e.ext;
        if (rectHit(p.x, p.y, p.w, p.h, e.x + 1, e.y + 1, TS - 2, TS - 2)) kill('SQUISH');
        break;
      }

      case 'spark': {
        const dx = pcx - e.x, dy = pcy - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.vx += (dx / d) * 0.055;
        e.vy += (dy / d) * 0.055;
        const sp = Math.hypot(e.vx, e.vy);
        if (sp > 2.1) { e.vx *= 2.1 / sp; e.vy *= 2.1 / sp; }
        e.x += e.vx; e.y += e.vy;
        if (game.frame % 3 === 0) {
          particles.push({ x: e.x, y: e.y, vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4),
            life: 0.35, max: 0.35, col: '#ffd23f', r: rand(1.5, 3) });
        }
        if (d < e.r + 12) kill('ZAP');
        break;
      }

      case 'critter': {
        e.bob += 0.12;
        e.vy += CFG.grav;
        e.vy = Math.min(e.vy, 10);
        e.x += e.vx * e.dir;
        if (boxHitsSolid(e.x, e.y, e.w, e.h)) { e.x -= e.vx * e.dir; e.dir *= -1; }
        e.y += e.vy;
        if (boxHitsSolid(e.x, e.y, e.w, e.h)) {
          /* land on top of whatever we hit */
          const gy = Math.floor((e.y + e.h) / TS);
          e.y = gy * TS - e.h;
          e.vy = 0;
          /* turn around at ledges so critters stay on their platform */
          const ahead = Math.floor((e.dir > 0 ? e.x + e.w + 3 : e.x - 3) / TS);
          if (!isSolidAt(ahead, Math.floor((e.y + e.h + 4) / TS))) e.dir *= -1;
        }
        if (rectHit(p.x, p.y, p.w, p.h, e.x + 3, e.y + 3, e.w - 6, e.h - 6)) kill('CHOMP');
        break;
      }

      case 'echotrigger': {
        if (!e.used && Math.abs(pcx - e.x) < TS && Math.abs(pcy - e.y) < TS * 1.5) {
          e.used = true;
          p.echoOn = true;
          p.history = [];
          toast('SOMETHING IS COPYING YOU', 1.8);
          sfx('warp');
        }
        break;
      }

      case 'boulderspawn': {
        if (!e.used && pcx > e.x - TS && pcx < e.x + TS * 3) {
          e.used = true;
          ents.push({ k: 'boulder', x: e.x, y: e.y, vx: 3.4, vy: 0, r: 20, spin: 0 });
          toast('RUN', 1.2);
          sfx('thud');
          game.shake = 8;
        }
        break;
      }

      case 'boulder': {
        e.spin += e.vx * 0.05;
        e.vy = Math.min(e.vy + CFG.grav, 12);
        e.x += e.vx;
        if (boxHitsSolid(e.x - e.r, e.y - e.r + 6, e.r * 2, e.r * 2 - 12)) {
          e.x -= e.vx;
          e.vy = -7;                      // hop over small ledges
        }
        e.y += e.vy;
        if (boxHitsSolid(e.x - e.r + 4, e.y - e.r, e.r * 2 - 8, e.r * 2)) {
          if (e.vy > 0) {
            e.y = Math.floor((e.y + e.r) / TS) * TS - e.r;
            e.vy *= -0.32;
            if (Math.abs(e.vy) < 1.2) e.vy = 0;
          } else { e.y -= e.vy; e.vy = 0; }
        }
        if (dist2(e.x, e.y, pcx, pcy) < (e.r + 12) ** 2) kill('FLATTENED');
        if (e.y > level.h + 200 || e.x > level.w + 100) e.gone = true;
        break;
      }
    }
  }
  ents = ents.filter(e => !e.gone);
}

/* ----------------------------------------------------------------- particles */

function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(0.6, 4.2);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.3, 0.8), max: 0.8, col, r: rand(1.5, 4),
    });
  }
}

function updateParticles() {
  for (const q of particles) {
    q.x += q.vx; q.y += q.vy;
    q.vy += 0.12;
    q.vx *= 0.98;
    q.life -= STEP;
  }
  if (particles.length > 400) particles.splice(0, particles.length - 400);
  particles = particles.filter(q => q.life > 0);
}

/* ---------------------------------------------------------------------- HUD */

function toast(msg, secs) {
  toastText = String(msg);
  toastTimer = secs || 1.2;
}

function showHint(msg) {
  hintText = msg;
  hintTimer = 0.35;
}

function tickHud() {
  if (toastTimer > 0) toastTimer -= STEP;
  if (hintTimer > 0) hintTimer -= STEP;
}

/* -------------------------------------------------------------------- screens */

/* Node positions for each stage map, in art pixels. Ten nodes per stage, walked
   left to right along a winding trail. */
const MAP_PATHS = [
  [[30, 138], [60, 128], [90, 138], [120, 122], [150, 130], [180, 114], [208, 122], [236, 106], [264, 114], [294, 98]],
  [[30, 120], [58, 142], [88, 118], [116, 140], [146, 116], [174, 138], [204, 114], [232, 136], [260, 112], [292, 132]],
  [[32, 96], [60, 110], [90, 102], [118, 120], [148, 112], [176, 130], [206, 122], [234, 138], [262, 128], [292, 144]],
  [[32, 146], [60, 128], [90, 112], [120, 100], [150, 94], [180, 96], [210, 104], [238, 118], [266, 134], [294, 148]],
  [[30, 136], [58, 120], [86, 134], [114, 116], [144, 128], [172, 108], [200, 120], [228, 100], [258, 112], [292, 88]],
];

function showSplash() {
  game.state = 'splash';
  game.splashT = 0;
  game.fade = 1;
}

function showTitle() {
  game.state = 'title';
  game.fade = 1;
  toastTimer = 0;
  hintTimer = 0;
}

function showBoard() {
  game.state = 'board';
  game.fade = 1;
  toastTimer = 0;
}

function showMap(stage) {
  game.state = 'map';
  game.stage = clamp(stage === undefined ? game.stage : stage, 0, STAGE_COUNT - 1);
  game.cursor = clamp(game.cursor, 0, LEVELS_PER_STAGE - 1);
  if (!isUnlocked(game.stage, game.cursor)) {
    game.cursor = game.stage === game.reached.stage ? game.reached.idx : LEVELS_PER_STAGE - 1;
  }
  game.markerAt = game.cursor;
  game.fade = 1;
  level = null;
  toastTimer = 0;
  hintTimer = 0;
}

function levelCleared() {
  const st = game.stage, idx = game.levelIdx;
  game.cleared[st][idx] = true;

  /* Bank only what this level has never yielded before, so a better run pays
     the difference and a repeat run pays nothing. */
  const gained = Math.max(0, p.shiny - game.best[st][idx]);
  game.best[st][idx] = Math.max(game.best[st][idx], p.shiny);

  /* Unlock the next node, rolling on to the next stage after the tenth. */
  let ns = st, ni = idx + 1;
  if (ni >= LEVELS_PER_STAGE) { ns = st + 1; ni = 0; }
  if (ns < STAGE_COUNT) {
    if (ns > game.reached.stage || (ns === game.reached.stage && ni > game.reached.idx)) {
      game.reached = { stage: ns, idx: ni };
    }
  }
  writeSave();

  game.state = (st === STAGE_COUNT - 1 && idx === LEVELS_PER_STAGE - 1) ? 'finale' : 'clear';
  game.fade = 1;
  clearInfo = {
    name: level.name,
    shiny: p.shiny,
    total: level.totalShiny,
    gained,
    bank: rocksAvailable(),
    oogs: game.runDeaths,
    nextStage: ns, nextIdx: ni,
    newStage: ns !== st && ns < STAGE_COUNT,
  };
}

/* Advance from the clear screen back onto the map. */
function leaveClearScreen() {
  if (clearInfo && clearInfo.nextStage < STAGE_COUNT) {
    game.stage = clearInfo.nextStage;
    game.cursor = clearInfo.nextIdx;
  }
  showMap(game.stage);
}

/* ------------------------------------------------------------------ pixel art */
/* Sprites are authored as character grids and baked once into tiny offscreen
   canvases, one art pixel per character. Rows may be ragged; they are treated
   as left-aligned and padded with transparency, so the sprite is as wide as its
   widest row. '.' is transparent. */

const PAL = {
  '0': '#0d0b16', '1': '#1c1733', '2': '#2b2440', '3': '#453a63', '4': '#6b5c96', '5': '#9a8fc4',
  '6': '#c98a5b', '7': '#8a5a37', '8': '#f0c9a0', '9': '#3a2416',
  'a': '#6b4a20', 'b': '#a87c3a',
  'c': '#5b6280', 'd': '#9aa3bb', 'e': '#d6dcea',
  'f': '#7ff3d8', 'g': '#35d6b0', 'h': '#ff5fd0', 'i': '#ffd23f', 'j': '#ff7d4a',
  'k': '#48c46a', 'l': '#20502f',
  'm': '#ffffff', 'n': '#c9c9d8', 'o': '#6b3f8f', 'p': '#a86fd4', 'q': '#151022',
  'r': '#9fd0ff', 's': '#dff0ff', 't': '#ff6b4a', 'u': '#3f7a6b', 'v': '#7a5a3f', 'w': '#ffc07d',
};

function makeSprite(rows, swap) {
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const c = document.createElement('canvas');
  c.width = w; c.height = rows.length;
  const g = c.getContext('2d');
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      let ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      if (swap && swap[ch]) ch = swap[ch];
      const col = PAL[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/* A caveman with a UFO bolted under him, facing right. 16x20, so he is exactly
   one tile wide. Heavy brow, club in the near hand, and a proper flying-saucer
   hull below the waist: lit portholes, a full-width brim, tapering underside,
   and running lights animated over the top of the baked sprite. */
const ART_UGG = [
  ".....999999.....",
  "....99999999....",
  "...9999999999...",
  "...9999999999...",
  "....6666mq68....",
  "....66666678....",
  "....66666676....",
  ".....666666.....",
  ".....766667.bb..",
  "....7666667abb..",
  "....76666667....",
  ".....766667.....",
  ".....677776.....",
  "....aaaaaaaa....",
  "...aabaaaabaa...",
  "..0dddddddddd0..",
  ".0ddrddrddrddd0.",
  "0eeeeeeeeeeeeee0",
  ".0cccccccccccc0.",
  "..0cccccccccc0..",
];

/* Thrust plume, cycled. */
const ART_FLAME = [
  [
    "...ffff...",
    "..gffffg..",
    "...gffg...",
    "....gg....",
  ],
  [
    "..ffffff..",
    "..gffffg..",
    "...gffg...",
    "...gffg...",
    "....g.....",
  ],
  [
    "...ffff...",
    "..gffffg..",
    "..ggffgg..",
    "...gffg...",
    "....gg....",
    "....g.....",
  ],
];

/* Cave critter, two walk frames. 16x13, faces right. */
const ART_CRITTER = [
  [
    ".....oooooo.....",
    "...oopppppoo....",
    "..opppppppppo...",
    "..oppppppppppo..",
    "..opppppppmppo..",
    "..oppppppppqpo..",
    "..oppppppppppo..",
    "...opppppppppo..",
    "...ommmmmmmmo...",
    "....o.oo.oo.o...",
    "....oo....oo....",
    "................",
    "................",
  ],
  [
    "................",
    ".....oooooo.....",
    "...oopppppoo....",
    "..opppppppppo...",
    "..oppppppppppo..",
    "..opppppppmppo..",
    "..oppppppppqpo..",
    "..oppppppppppo..",
    "...ommmmmmmmo...",
    "....oo.oo.oo....",
    "...oo........oo.",
    "................",
    "................",
  ],
];

/* Sawblade, two frames a half-tooth apart. 15x15. */
const ART_SAW = [
  [
    ".......n.......",
    "......nnn......",
    "..n...nnn...n..",
    ".nn..nnnnn..nn.",
    "..nnnnnnnnnnn..",
    "...nnndddnnn...",
    ".nnnndddddnnnn.",
    "nnnnddeeeddnnnn",
    ".nnnndddddnnnn.",
    "...nnndddnnn...",
    "..nnnnnnnnnnn..",
    ".nn..nnnnn..nn.",
    "..n...nnn...n..",
    "......nnn......",
    ".......n.......",
  ],
  [
    "...n.......n...",
    "..nnn.....nnn..",
    "...nnn...nnn...",
    "....nnnnnnn....",
    "..nnnnnnnnnnn..",
    ".nnnnndddnnnnn.",
    "..nnndddddnnn..",
    "..nnddeeeddnn..",
    "..nnndddddnnn..",
    ".nnnnndddnnnnn.",
    "..nnnnnnnnnnn..",
    "....nnnnnnn....",
    "...nnn...nnn...",
    "..nnn.....nnn..",
    "...n.......n...",
  ],
];

/* Rolling boulder, two frames. 18x18. */
const ART_BOULDER = [
  [
    ".....444444.....",
    "...4444444444...",
    "..444444444444..",
    ".44444333444444.",
    ".44443333344444.",
    "4444433333444444",
    "4444433334444444",
    "4444443344444444",
    "4444444444444444",
    "4444444444344444",
    "4444444443334444",
    "4444444433333444",
    ".44444444333444.",
    ".44444444444444.",
    "..444444444444..",
    "...4444444444...",
    ".....444444.....",
  ],
  [
    ".....444444.....",
    "...4444444444...",
    "..444444444444..",
    ".44444444444444.",
    ".44444444333444.",
    "4444444433333444",
    "4443444433334444",
    "4433344443344444",
    "4433334444444444",
    "4443344444444444",
    "4444444444444444",
    "4444444444444444",
    ".44444444444444.",
    ".44444444444444.",
    "..444444444444..",
    "...4444444444...",
    ".....444444.....",
  ],
];

/* Homing spark, two frames. */
const ART_SPARK = [
  [
    "....i....",
    "..i.i.i..",
    "...iii...",
    "iiiimiiii",
    "...iii...",
    "..i.i.i..",
    "....i....",
  ],
  [
    ".........",
    "..i...i..",
    "...iii...",
    "..iimii..",
    "...iii...",
    "..i...i..",
    ".........",
  ],
];

const ART_SHINY = [
  "...mm...",
  "..mssm..",
  ".msrrsm.",
  "msrrrrsm",
  ".msrrsm.",
  "..msrm..",
  "...mm...",
];

const ART_SIGN = [
  "................",
  "..bbbbbbbbbbb...",
  "..bqqbqbbqqbb...",
  "..bbbbbbbbbbb...",
  "..bqbqqbqbqbb...",
  "..bbbbbbbbbbb...",
  "......aa........",
  "......aa........",
  "......aa........",
  "......aa........",
  "......aa........",
  "......aa........",
  "......aa........",
  ".....aaaa.......",
  "................",
  "................",
];

/* Mothership: the exit. 34x16. Palette-swapped for the decoy. */
const ART_SHIP = [
  "..............eeee................",
  "............eesssseee.............",
  "..........eesssssssseee...........",
  ".........eessssssssssee...........",
  "........ddeessssssssseedd.........",
  "......dddddeessssssseeddddd.......",
  "....dddddddddeeeeeeedddddddddd....",
  "..dddddddddddddddddddddddddddddd..",
  ".dddddddddddddddddddddddddddddddd.",
  "cccccccccccccccccccccccccccccccccc",
  ".cccccccccccccccccccccccccccccccc.",
  "..cc..cc..cc..cc..cc..cc..cc..cc..",
  "....i.......i.......i.......i.....",
];

const ART_CRUSHER = [
  "cccccccccccccccc",
  "cddddddddddddddc",
  "cdccccccccccccdc",
  "cdc22222222222dc",
  "cdc23333333332dc",
  "cdc23333333332dc",
  "cdc23333333332dc",
  "cdc23333333332dc",
  "cdc22222222222dc",
  "cdccccccccccccdc",
  "cddddddddddddddc",
  "cccccccccccccccc",
  "nn.nn.nn.nn.nn.n",
  ".n..n..n..n..n..",
];

const ART_TRAMP = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "..hhhhhhhhhhhh..",
  ".hhmmmmmmmmmmhh.",
  "..hhhhhhhhhhhh..",
  "...o........o...",
  "...o........o...",
  "...oooooooooo...",
  "...oooooooooo...",
  "................",
];

const ART_SPIKES = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "..m....m....m...",
  "..n....n....n...",
  "..n....n....n...",
  ".nnn..nnn..nnn..",
  ".nnn..nnn..nnn..",
  "nnnnn.nnnn.nnnnn",
  "nnnnn.nnnn.nnnnn",
  "2222222222222222",
  "2222222222222222",
  "1111111111111111",
  "1111111111111111",
];

/* The other cave pilot: same build and same bolted-on saucer, longer hair. */
const ART_OONA = [
  ".....999999.....",
  "....99999999....",
  "...9999999999...",
  "...9999999999...",
  "...96666mq689...",
  "...9666666789...",
  "...9966666699...",
  "....96666669....",
  "...9.766667.9...",
  "...97666667abb..",
  "...976666679....",
  "....9666669.....",
  ".....677776.....",
  "....aaaaaaaa....",
  "...aabaaaabaa...",
  "..0dddddddddd0..",
  ".0ddrddrddrddd0.",
  "0eeeeeeeeeeeeee0",
  ".0cccccccccccc0.",
  "..0cccccccccc0..",
];

/* The studio mark: a bear, mid-drink. */
const ART_BEAR = [
  "..99......99....",
  ".9aa9....9aa9...",
  ".9aaa9999aaa9...",
  "..9aaaaaaaaa9...",
  "..9aaaaaaaaa9...",
  "..9amaaaaama9...",
  "..9aqaaaaaqa9...",
  "..9aaaaaaaaa9...",
  "..9aa88888aa9...",
  "..9a8888888a9...",
  "..9a88qqq88a9...",
  "..9a8888888a9...",
  "...9a88888a9....",
  "....99999999....",
];

const ART_MUG = [
  ".ddddd..",
  ".dfffd..",
  ".dfffddd",
  ".dfffd.d",
  ".dfffddd",
  ".dfffd..",
  ".ddddd..",
];

/* Baked sprites. */
const SPR = {
  ugg: makeSprite(ART_UGG),
  echo: makeSprite(ART_UGG, {   // palette swap: the doppelganger in ghost colours
    '9': 'o', '6': 'p', '7': 'o', '8': 'p', 'a': 'o', 'b': 'p',
    'c': 'o', 'd': 'p', 'e': 'r', 'm': 'r', 'q': '1', '0': '1',
  }),
  flame: ART_FLAME.map(f => makeSprite(f)),
  critter: ART_CRITTER.map(f => makeSprite(f)),
  saw: ART_SAW.map(f => makeSprite(f)),
  boulder: ART_BOULDER.map(f => makeSprite(f)),
  spark: ART_SPARK.map(f => makeSprite(f)),
  shiny: makeSprite(ART_SHINY),
  sign: makeSprite(ART_SIGN),
  ship: makeSprite(ART_SHIP),
  shipDecoy: makeSprite(ART_SHIP, { 's': 'j', 'e': 't', 'i': 't' }),
  crusher: makeSprite(ART_CRUSHER),
  tramp: makeSprite(ART_TRAMP),
  spikes: makeSprite(ART_SPIKES),
  bear: makeSprite(ART_BEAR),
  mug: makeSprite(ART_MUG),
};

/* ---------------------------------------------------------------- pixel font */
/* A 5x7 bitmap face. At the game's 3x blowup a glyph is 15x21 screen pixels,
   which stays crisp and readable while matching the art. Rendered strings are
   baked to little canvases and cached, so a HUD line costs one drawImage. */

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
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  '&': [".##..", "#..#.", "#..#.", ".##..", "#..#.", "#..#.", ".##.#"],
  '_': [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  '^': ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
  '~': [".....", ".....", ".#...", "#.#.#", "...#.", ".....", "....."],
  '@': [".###.", "#...#", "#.##.", "#.#.#", "#.##.", "#....", ".###."],
  '[': ["..##.", "..#..", "..#..", "..#..", "..#..", "..#..", "..##."],
  ']': [".##..", "...#.", "...#.", "...#.", "...#.", "...#.", ".##.."],
};

const GLYPH_W = 5, GLYPH_H = 7, GLYPH_GAP = 1;
const textCache = new Map();

function textWidth(str, scale) {
  return str.length ? (str.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP) * (scale || 1) : 0;
}

function bakeText(str, col, scale) {
  const s = scale || 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, textWidth(str, s));
  c.height = GLYPH_H * s;
  const g = c.getContext('2d');
  g.fillStyle = col;
  for (let i = 0; i < str.length; i++) {
    const glyph = FONT[str[i]];
    if (!glyph) continue;                       // space and unknowns: blank
    const ox = i * (GLYPH_W + GLYPH_GAP) * s;
    for (let y = 0; y < GLYPH_H; y++) {
      const row = glyph[y];
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] === '#') g.fillRect(ox + x * s, y * s, s, s);
      }
    }
  }
  return c;
}

/* align: 'left' | 'center' | 'right'. Coordinates are art pixels. */
function drawText(str, x, y, col, scale, align) {
  str = String(str).toUpperCase();
  const s = scale || 1;
  const key = str + '|' + col + '|' + s;
  let c = textCache.get(key);
  if (!c) {
    if (textCache.size > 400) textCache.clear();
    c = bakeText(str, col, s);
    textCache.set(key, c);
  }
  let dx = Math.round(x);
  if (align === 'center') dx = Math.round(x - c.width / 2);
  else if (align === 'right') dx = Math.round(x - c.width);
  bx.drawImage(c, dx, Math.round(y));
  return c.width;
}

/* Text with a hard drop shadow, for anything sitting over busy artwork. */
function drawTextShadow(str, x, y, col, scale, align) {
  drawText(str, x + 1, y + 1, '#0d0b16', scale, align);
  return drawText(str, x, y, col, scale, align);
}

/* ------------------------------------------------------------------ rendering */

/* World pixels -> art pixels, relative to the camera. */
let camAX = 0, camAY = 0;
function ax(wx) { return Math.round(wx / WPB) - camAX; }
function ay(wy) { return Math.round(wy / WPB) - camAY; }

function blit(spr, x, y, flipX, flipY) {
  x = Math.round(x); y = Math.round(y);
  if (!flipX && !flipY) { bx.drawImage(spr, x, y); return; }
  bx.save();
  bx.translate(x + (flipX ? spr.width : 0), y + (flipY ? spr.height : 0));
  bx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  bx.drawImage(spr, 0, 0);
  bx.restore();
}

/* Re-draw a band of rows from a sprite over whatever has been drawn since, in
   the sprite's own coordinates so it lines up under any flip. */
function blitRows(spr, x, y, y0, y1, flipX, flipY) {
  bx.save();
  bx.translate(Math.round(x) + (flipX ? spr.width : 0), Math.round(y) + (flipY ? spr.height : 0));
  bx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  bx.drawImage(spr, 0, y0, spr.width, y1 - y0, 0, y0, spr.width, y1 - y0);
  bx.restore();
}

/* A filled triangle, one scanline at a time, so the edges stay hard. */
function pixTriangle(cx, baseY, halfW, h, dir, col) {
  bx.fillStyle = col;
  for (let i = 0; i < h; i++) {
    const t = 1 - i / h;
    const w = Math.max(1, Math.round(halfW * t * 2));
    bx.fillRect(Math.round(cx - w / 2), baseY + i * dir, w, 1);
  }
}

function present() {
  ctx.drawImage(bc, 0, 0, BW, BH, 0, 0, VW, VH);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.globalAlpha = 1;

  if (game.state === 'splash') { drawSplash(); drawFade(); present(); return; }
  if (game.state === 'choose') { drawChoose(); drawFade(); present(); return; }
  if (game.state === 'title') { drawTitle(); drawFade(); present(); return; }
  if (game.state === 'map') { drawMap(); drawFade(); present(); return; }
  if (game.state === 'board') { drawBoard(); drawFade(); present(); return; }
  if (game.state === 'lab') { drawLab(); drawFade(); present(); return; }
  if (!level) { drawIdleBackdrop(); present(); return; }

  /* camera, in world pixels — the editor drives it by hand */
  if (editor.on) {
    cam.x = editor.camX;
    cam.y = editor.camY;
  } else {
    const lookX = clamp(p.vx * 14, -50, 50);
    const tx = clamp(p.x + p.w / 2 - viewW / 2 + lookX, 0, Math.max(0, level.w - viewW));
    const ty = clamp(p.y + p.h / 2 - viewH / 2, 0, Math.max(0, level.h - viewH));
    cam.x += (tx - cam.x) * 0.11;
    cam.y += (ty - cam.y) * 0.09;
  }

  let shx = 0, shy = 0;
  if (game.shake > 0) {
    shx = Math.round(rand(-game.shake, game.shake) / WPB);
    shy = Math.round(rand(-game.shake, game.shake) / WPB);
    game.shake *= 0.88;
    if (game.shake < 0.3) game.shake = 0;
  }
  camAX = Math.round(cam.x / WPB) - shx;
  camAY = Math.round(cam.y / WPB) - shy;

  drawBackground();

  /* Mirror the WORLD layer only; the HUD is drawn after this and stays upright.
     Quantised so the squish lands on whole art pixels. */
  const sx = Math.round((1 - 2 * game.mirrorAmt) * 8) / 8;
  bx.save();
  bx.translate(BW / 2, 0);
  bx.scale(sx === 0 ? 0.001 : sx, 1);
  bx.translate(-BW / 2, 0);

  drawZones();
  drawTiles();
  drawEnts();
  drawShinies();
  drawEcho();
  if (!p.dead) drawPlayer();
  drawParticles();

  bx.restore();

  if (editor.on) {
    drawEditorOverlay();
    drawFade();
    present();
    return;
  }

  drawDark();
  drawFlashes();
  if (game.state !== 'finale') drawHud();     // the credits own the whole screen
  if (game.state === 'clear') drawClearScreen();
  else if (game.state === 'finale') drawFinale();
  drawFade();

  present();
}

function drawIdleBackdrop() {
  const bands = ['#1c1733', '#191530', '#16122b', '#131026', '#100d20', '#0d0b16'];
  const bh = Math.ceil(BH / bands.length);
  for (let i = 0; i < bands.length; i++) {
    bx.fillStyle = bands[i];
    bx.fillRect(0, i * bh, BW, bh);
    if (i > 0) {                       // dither seam between bands
      bx.fillStyle = bands[i - 1];
      for (let x = (i % 2); x < BW; x += 2) bx.fillRect(x, i * bh, 1, 1);
    }
  }
  bx.fillStyle = '#3a2f5e';
  for (let i = 0; i < 12; i++) {
    const x = (i * 4099) % BW;
    pixTriangle(x, BH - 1, 10 + (i * 7) % 14, 30 + (i * 13) % 46, -1, i % 3 ? '#241d47' : '#33295e');
  }
  for (let i = 0; i < 60; i++) {
    const x = (i * 137) % BW, y = (i * 89) % BH;
    bx.fillStyle = i % 4 ? 'rgba(154,143,196,0.55)' : 'rgba(255,210,120,0.7)';
    bx.fillRect(x, y, 1, 1);
  }
}

function drawBackground() {
  const th = level.theme;
  const bands = th.bands;
  const bh = Math.ceil(BH / bands.length);
  for (let i = 0; i < bands.length; i++) {
    bx.fillStyle = bands[i];
    bx.fillRect(0, i * bh, BW, bh);
    if (i > 0) {                       // checkerboard dither across the seam
      bx.fillStyle = bands[i - 1];
      for (let x = 0; x < BW; x += 2) bx.fillRect(x, i * bh, 1, 1);
      for (let x = 1; x < BW; x += 2) bx.fillRect(x, i * bh + 1, 1, 1);
    }
  }

  /* Far crystal field. Anchored to the level's usual ground line rather than the
     bottom of the screen, so it peeks above the foreground instead of hiding
     behind it, and still slides with the camera. */
  const p1 = Math.round(-cam.x * 0.10 / WPB);
  const horizon = ay(15 * TS);
  for (let i = 0; i < 40; i++) {
    const x = ((i * 137) % 900) + p1;
    if (x < -40 || x > BW + 40) continue;
    const h = 16 + (i * 31) % 30;
    pixTriangle(x, horizon + (i * 7) % 6, h * 0.8, h, -1, i % 4 === 0 ? th.farLit : th.far);
  }

  /* nearer stalactites hanging from the ceiling */
  const p2 = Math.round(-cam.x * 0.24 / WPB);
  for (let i = 0; i < 40; i++) {
    const x = ((i * 167) % 1100) + p2;
    if (x < -24 || x > BW + 24) continue;
    const h = 12 + (i * 71) % 30;
    pixTriangle(x, 0, 6 + (i * 7) % 7, h, 1, i % 3 === 0 ? th.far : th.near);
  }

  /* drifting motes */
  for (let i = 0; i < 30; i++) {
    const mx = Math.round(((i * 97) % 700) - cam.x * 0.4 / WPB);
    if (mx < 0 || mx > BW) continue;
    const my = 20 + ((i * 57) % (BH - 40)) + Math.round(Math.sin(game.time * 0.8 + i) * 5);
    bx.fillStyle = i % 5 === 0 ? '#ffd23f' : '#5b6280';
    bx.fillRect(mx, my, 1, 1);
  }
}

function drawZones() {
  const x0 = cam.x - 40, x1 = cam.x + viewW + 40;
  for (const z of level.zones) {
    if (z.x > x1 || z.x + z.w < x0) continue;
    const info = ZONE_INFO[z.t];
    if (!info) continue;
    const zx = ax(z.x), zy = ay(z.y), zw = Math.round(z.w / WPB), zh = Math.round(z.h / WPB);
    bx.save();
    bx.globalAlpha = 0.10;
    bx.fillStyle = info.col;
    bx.fillRect(zx, zy, zw, zh);
    bx.globalAlpha = 0.65;
    bx.fillStyle = info.col;
    /* dashed border, drawn as pixels so it stays on the art grid */
    for (let x = 0; x < zw; x += 4) {
      bx.fillRect(zx + x, zy, 2, 1);
      bx.fillRect(zx + x, zy + zh - 1, 2, 1);
    }
    for (let y = 0; y < zh; y += 4) {
      bx.fillRect(zx, zy + y, 1, 2);
      bx.fillRect(zx + zw - 1, zy + y, 1, 2);
    }
    bx.restore();
  }
}

/* Deterministic per-tile jitter, so speckles don't crawl between frames. */
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0xffff) / 0xffff;
}

function strobeAlpha(min) {
  const t = game.time;
  const s = 0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 6.3 + 1.1);
  return min + (1 - min) * (s > 0.35 ? 1 : 0.12);
}

function drawTiles() {
  const th = level.theme;
  const flick = p.eff.strobe;
  const gx0 = Math.max(0, Math.floor(cam.x / TS) - 1);
  const gx1 = Math.min(level.cols - 1, Math.ceil((cam.x + viewW) / TS));
  const gy0 = Math.max(0, Math.floor(cam.y / TS) - 1);
  const gy1 = Math.min(level.rows - 1, Math.ceil((cam.y + viewH) / TS));
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;

  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const ch = level.grid[gy][gx];
      if (ch === ' ') continue;
      const x = ax(gx * TS), y = ay(gy * TS);
      bx.save();
      if (flick) bx.globalAlpha = DEADLY.has(ch) ? strobeAlpha(0.4) : strobeAlpha(0.06);

      switch (ch) {

        case '#': {
          bx.fillStyle = th.rock;
          bx.fillRect(x, y, TA, TA);
          const openTop = !isSolidAt(gx, gy - 1);
          if (openTop) {
            bx.fillStyle = th.rockLit;
            bx.fillRect(x, y, TA, 1);
            bx.fillStyle = th.rockEdge;
            bx.fillRect(x, y + 1, TA, 2);
            /* a couple of grass-like nubs of rock on the lit edge */
            for (let i = 0; i < TA; i += 3) {
              if (hash2(gx * 7 + i, gy) > 0.55) { bx.fillStyle = th.slabTop; bx.fillRect(x + i, y, 1, 1); }
            }
          }
          if (!isSolidAt(gx - 1, gy)) { bx.fillStyle = th.rockSpec; bx.fillRect(x, y, 1, TA); }
          if (!isSolidAt(gx + 1, gy)) { bx.fillStyle = '#0d0b16'; bx.fillRect(x + TA - 1, y, 1, TA); }
          /* speckle */
          for (let i = 0; i < 5; i++) {
            const hx = Math.floor(hash2(gx * 5 + i, gy) * (TA - 2)) + 1;
            const hy = Math.floor(hash2(gx, gy * 5 + i) * (TA - 4)) + 3;
            bx.fillStyle = hash2(gx + i, gy + i) > 0.55 ? th.rockSpec : 'rgba(0,0,0,0.3)';
            bx.fillRect(x + hx, y + hy, 2, 1);
          }
          break;
        }

        case '=': case 'F': {
          const fake = ch === 'F';
          const near = fake && (game.sk.scan ||
            (Math.abs(pcx - (gx * TS + TS / 2)) < 150 && Math.abs(pcy - (gy * TS)) < 150));
          if (near) bx.globalAlpha *= 0.45 + 0.3 * Math.sin(game.time * 9);
          bx.fillStyle = th.slab;
          bx.fillRect(x, y + 3, TA, TA - 6);
          bx.fillStyle = th.slabLit;
          bx.fillRect(x, y + 3, TA, 1);
          bx.fillStyle = th.slabTop;
          for (let i = 0; i < TA; i += 4) bx.fillRect(x + i, y + 3, 2, 1);
          bx.fillStyle = '#0d0b16';
          bx.fillRect(x, y + TA - 4, TA, 1);
          for (let i = 0; i < 3; i++) {
            const hx = Math.floor(hash2(gx * 3 + i, gy) * (TA - 3));
            bx.fillStyle = th.rockSpec;
            bx.fillRect(x + hx, y + 6 + i * 2, 2, 1);
          }
          if (near) {                       // the tell: a magenta flicker outline
            bx.fillStyle = '#ff5fd0';
            for (let i = 0; i < TA; i += 3) {
              bx.fillRect(x + i, y + 3, 1, 1);
              bx.fillRect(x + i, y + TA - 4, 1, 1);
            }
          }
          break;
        }

        case 'P': {
          const d = game.sk.scan ? 0 : Math.hypot(pcx - (gx * TS + TS / 2), pcy - (gy * TS + TS / 2));
          if (d < 130) {
            bx.globalAlpha *= (1 - d / 130) * 0.95;
            bx.fillStyle = '#9fd0ff';
            for (let i = 0; i < TA; i += 2) {
              bx.fillRect(x + i, y + 3, 1, 1);
              bx.fillRect(x + i, y + TA - 4, 1, 1);
            }
            bx.fillRect(x, y + 3, 1, TA - 6);
            bx.fillRect(x + TA - 1, y + 3, 1, TA - 6);
          } else {
            bx.globalAlpha *= 0.3;
            bx.fillStyle = '#9fd0ff';
            const wob = Math.round(Math.sin(game.time * 2 + gx) * 1);
            bx.fillRect(x + 3, y + 7 + wob, 1, 1);
            bx.fillRect(x + TA - 5, y + 8 - wob, 1, 1);
          }
          break;
        }

        case 'B': case 'b': {
          const on = ch === 'B' ? blinkOn(false) : blinkOn(true);
          const phase = (game.time % CFG.blinkPeriod) / CFG.blinkPeriod;
          const soon = phase > 0.82;
          const dark = ch === 'B' ? '#3f7a6b' : '#7a5a3f';
          const lite = ch === 'B' ? '#7ff3d8' : '#ffc07d';
          if (on) {
            if (soon) bx.globalAlpha *= 0.55 + 0.45 * Math.sin(game.time * 32);
            bx.fillStyle = dark;
            bx.fillRect(x, y + 2, TA, TA - 4);
            bx.fillStyle = lite;
            bx.fillRect(x, y + 2, TA, 1);
            bx.fillRect(x, y + TA - 3, TA, 1);
            for (let i = 1; i < TA; i += 3) { bx.fillRect(x + i, y + 6, 1, 1); bx.fillRect(x + i + 1, y + 9, 1, 1); }
          } else {
            bx.globalAlpha *= soon ? 0.4 + 0.35 * Math.sin(game.time * 32) : 0.3;
            bx.fillStyle = lite;
            for (let i = 0; i < TA; i += 3) {
              bx.fillRect(x + i, y + 2, 2, 1);
              bx.fillRect(x + i, y + TA - 3, 2, 1);
            }
          }
          break;
        }

        case 'C': case 'c': {
          const d = ch === 'C' ? 1 : -1;
          bx.fillStyle = '#2b2440';
          bx.fillRect(x, y + 3, TA, TA - 6);
          bx.fillStyle = '#5b6280';
          bx.fillRect(x, y + 3, TA, 1);
          bx.fillRect(x, y + TA - 4, TA, 1);
          const off = Math.round(((game.time * 26 * d) % TA + TA) % TA);
          bx.fillStyle = '#ffd23f';
          for (let k = -1; k <= 1; k++) {
            const bxx = x + off + k * TA;
            for (let i = 0; i < 4; i++) {
              bx.fillRect(bxx + (d > 0 ? i : 3 - i), y + 6 + i, 1, 1);
              bx.fillRect(bxx + (d > 0 ? i : 3 - i), y + 11 - i, 1, 1);
            }
          }
          break;
        }

        case 'T': blit(SPR.tramp, x, y + Math.round(Math.sin(game.time * 6)), false, false); break;

        case '^': blit(SPR.spikes, x, y, false, spikeHangs(gx, gy)); break;

        case '~': {
          const wob = Math.round(Math.sin(game.time * 3 + gx * 0.8) * 1.5);
          bx.fillStyle = '#20502f';
          bx.fillRect(x, y + 4, TA, TA - 4);
          bx.fillStyle = '#48c46a';
          bx.fillRect(x, y + 5 + wob, TA, TA - 5 - wob);
          bx.fillStyle = '#a8f0b8';
          bx.fillRect(x, y + 5 + wob, TA, 1);
          for (let i = 0; i < TA; i += 5) {
            const bub = Math.round(Math.sin(game.time * 2 + gx + i) * 2);
            bx.fillStyle = '#a8f0b8';
            bx.fillRect(x + i + 1, y + 9 + bub, 1, 1);
          }
          break;
        }

        case 'K': {
          const c = level.checkpoints.find(k => k.gx === gx && k.gy === gy);
          const lit = c && c.hit;
          /* Tall enough to spot from across the room: checkpoints are the one
             honest thing in the cave, so they should not be easy to miss. */
          const top = y - 10;
          bx.fillStyle = '#4a3418';
          bx.fillRect(x + 3, top, 2, TA + 10);
          bx.fillStyle = '#6b4a20';
          bx.fillRect(x + 1, y + TA - 2, 6, 2);
          const wave = lit ? Math.round(Math.sin(game.time * 5) * 1.4) : 0;
          for (let i = 0; i < 10; i++) {
            const w = 11 - Math.abs(i - 4) + wave;
            bx.fillStyle = lit
              ? (i % 3 === 0 ? '#a8fff0' : '#7ff3d8')
              : (i % 3 === 0 ? '#6b6a86' : '#4a4966');
            bx.fillRect(x + 5, top + 1 + i, Math.max(2, w), 1);
          }
          if (lit) {
            bx.fillStyle = '#ffffff';
            bx.fillRect(x + 5, top + 1, 1, 10);
            /* sparkles rather than a glow rectangle, which reads as a hard box */
            bx.globalAlpha *= 0.5 + 0.4 * Math.sin(game.time * 4);
            bx.fillStyle = '#a8fff0';
            for (let i = 0; i < 5; i++) {
              const a = game.time * 1.6 + i * 1.257;
              bx.fillRect(
                x + 8 + Math.round(Math.cos(a) * 11),
                top + 5 + Math.round(Math.sin(a) * 9), 1, 1);
            }
          }
          break;
        }

        case 'G': case 'g': {
          const spr = ch === 'G' ? SPR.ship : SPR.shipDecoy;
          const bob = Math.round(Math.sin(game.time * 2 + (ch === 'G' ? 0 : 1.6)) * 2);
          blit(spr, x + TA / 2 - spr.width / 2, y + TA / 2 - spr.height / 2 + bob);
          break;
        }

        case '?': blit(SPR.sign, x, y); break;
      }
      bx.restore();
    }
  }

  /* sign text goes to the DOM hint bar when the player stands near a sign */
  let nearSign = null;
  for (const s of level.signs) {
    if (Math.abs((s.x + TS / 2) - (p.x + p.w / 2)) < 90 && Math.abs(s.y - p.y) < 90) nearSign = s;
  }
  if (nearSign) showHint(nearSign.msg);
}

function drawShinies() {
  for (const s of level.shinies) {
    if (s.got) continue;
    if (s.x < cam.x - 40 || s.x > cam.x + viewW + 40) continue;
    const bob = Math.round(Math.sin(game.time * 3 + s.x * 0.01) * 2);
    blit(SPR.shiny, ax(s.x) - 4, ay(s.y) - 3 + bob);
  }
}

function drawEnts() {
  for (const e of ents) {
    if (e.x < cam.x - 140 || e.x > cam.x + viewW + 140) continue;
    switch (e.k) {

      case 'saw': {
        const f = SPR.saw[Math.floor(game.time * 14) % 2];
        blit(f, ax(e.x) - f.width / 2, ay(e.y) - f.height / 2);
        break;
      }

      case 'crusher': {
        /* chain up to the ceiling */
        bx.fillStyle = '#3a3157';
        const cx0 = ax(e.x) + TA / 2;
        for (let yy = 0; yy < ay(e.y); yy += 3) {
          bx.fillRect(cx0 - 1, yy, 2, 2);
        }
        blit(SPR.crusher, ax(e.x), ay(e.y));
        break;
      }

      case 'spark': {
        const f = SPR.spark[Math.floor(game.time * 12) % 2];
        blit(f, ax(e.x) - f.width / 2, ay(e.y) - f.height / 2);
        break;
      }

      case 'critter': {
        const f = SPR.critter[Math.floor(game.time * 7) % 2];
        blit(f, ax(e.x) - 1, ay(e.y) - 1, e.dir < 0);
        break;
      }

      case 'boulder': {
        const f = SPR.boulder[Math.floor(Math.abs(e.spin) * 2) % 2];
        blit(f, ax(e.x) - f.width / 2, ay(e.y) - f.height / 2);
        break;
      }

      case 'echotrigger': {
        if (!e.used) {
          bx.save();
          bx.globalAlpha = 0.5 + 0.35 * Math.sin(game.time * 4);
          bx.fillStyle = '#a86fd4';
          const cx1 = ax(e.x) + TA / 2, cy1 = ay(e.y) + TA / 2;
          const r = 5 + Math.round(Math.sin(game.time * 3) * 2);
          for (let a = 0; a < 12; a++) {
            const an = (a / 12) * Math.PI * 2;
            bx.fillRect(Math.round(cx1 + Math.cos(an) * r), Math.round(cy1 + Math.sin(an) * r), 1, 1);
          }
          bx.fillRect(cx1 - 1, cy1 - 3, 2, 4);
          bx.fillRect(cx1 - 1, cy1 + 2, 2, 2);
          bx.restore();
        }
        break;
      }
    }
  }
}

function drawEcho() {
  if (!p.echoOn) return;
  const e = echoPos();
  if (!e) return;
  bx.save();
  bx.globalAlpha = 0.7;
  const a = uggAnchor(e.x, e.y, e.g, 0);
  blit(SPR.echo, a.sx, a.sy, e.f < 0, e.g < 0);
  drawBeard(a.sx, a.sy, e.f < 0, e.g < 0, 0.25);
  blitRows(SPR.echo, a.sx, a.sy, 13, 20, e.f < 0, e.g < 0);
  bx.restore();
}

/* The sprite is taller than the collision box and hangs off it: when gravity is
   flipped the whole thing mirrors, so the hull lines up with whichever edge of
   the box is currently "down". */
function uggAnchor(x, y, gdir, bob) {
  return { sx: ax(x) - 2, sy: (gdir > 0 ? ay(y) - 4 + bob : ay(y) - bob) };
}

/* The beard is drawn live rather than baked into the sprite, because it doubles
   as the stamina gauge: loose and swaying past the hull when the saucer is
   charged, knotting itself shorter and lumpier as the stamina drains. Drawn in
   sprite-local coordinates so it inherits the sprite's flips. */
/* Beard styles. Every one of them still knots up as the stamina drains, so the
   gauge survives whichever you pick — except CLEAN SHAVEN, which trades the
   readout away for the look. */
const BEARDS = [
  { id: 'none', name: 'CLEAN SHAVEN' },
  { id: 'classic', name: 'CLASSIC', len: 18, w0: 6, bulge: 1.8, taper: 4.0 },
  { id: 'long', name: 'LONG', len: 26, w0: 5, bulge: 1.0, taper: 2.6 },
  { id: 'braid', name: 'BRAIDED', len: 22, w0: 5, bulge: 0.8, taper: 2.4, braid: true },
  { id: 'goatee', name: 'GOATEE', len: 9, w0: 4, bulge: 0.7, taper: 2.4 },
  { id: 'bushy', name: 'BUSHY', len: 13, w0: 8, bulge: 2.8, taper: 5.5 },
  { id: 'forked', name: 'FORKED', len: 20, w0: 6, bulge: 1.4, taper: 3.0, fork: true },
  { id: 'mutton', name: 'MUTTON CHOPS', len: 8, w0: 9, bulge: 0.4, taper: 1.5, hollow: true },
];

let activeBeard = 1;

function beardRow(x, y, w, i) {
  bx.fillStyle = '#2a1a0e';
  bx.fillRect(x, y, w, 1);
  if (w > 2) {
    bx.fillStyle = i % 3 === 0 ? '#5a3a1c' : '#432915';
    bx.fillRect(x + 1, y, w - 2, 1);
  }
  /* strand highlights down the sides */
  if (i % 4 === 1 && w > 3) { bx.fillStyle = '#6b4a20'; bx.fillRect(x + w - 2, y, 1, 1); }
  if (i % 4 === 3 && w > 4) { bx.fillStyle = '#6b4a20'; bx.fillRect(x + 1, y, 1, 1); }
}

function drawBeardLocal(tangle, styleIdx) {
  const b = BEARDS[styleIdx === undefined ? activeBeard : styleIdx];
  if (!b || b.id === 'none') return;

  const t = game.time;
  const len = Math.max(2, Math.round(b.len * (1 - 0.55 * tangle)));

  for (let i = 0; i < len; i++) {
    const f = len > 1 ? i / (len - 1) : 0;
    /* full at the jaw, bulging through the middle, tapering to a point */
    let w = Math.round(b.w0 + Math.sin(f * Math.PI) * b.bulge - f * b.taper);
    if (tangle > 0.25) w += Math.round(Math.sin(i * 1.9 + t * 0.6) * 1.7 * tangle);
    w = clamp(w, 2, 10);

    const sway = (1 - tangle) * Math.sin(t * 2.2 + i * 0.45) * (0.35 + f * 1.7);
    const kink = tangle * Math.sin(i * 2.2 + t * 0.9) * 2.2;
    /* Anchored to the face rather than the sprite's centre: the eye and nose
       sit forward of centre, so a beard centred on the sprite reads as hanging
       off the back of the jaw. Flipping the sprite mirrors this with it. */
    const cx = 8.2 + sway + kink;
    const y = 7 + i;

    if (b.hollow) {                          // chops: two side panels, bare chin
      const tw = Math.max(2, Math.round(w * 0.34));
      beardRow(Math.round(cx - w / 2), y, tw, i);
      beardRow(Math.round(cx + w / 2 - tw), y, tw, i);
    } else if (b.fork && f > 0.55) {         // splits into two tails near the end
      const spread = (f - 0.55) * 9;
      const tw = Math.max(2, Math.round(w * 0.55));
      beardRow(Math.round(cx - spread - tw / 2), y, tw, i);
      beardRow(Math.round(cx + spread - tw / 2), y, tw, i);
    } else {
      beardRow(Math.round(cx - w / 2), y, w, i);
      if (b.braid && i % 3 === 2) {          // binding every few rows
        bx.fillStyle = '#2a1a0e';
        bx.fillRect(Math.round(cx - w / 2), y, w, 1);
        bx.fillStyle = '#8a6a35';
        bx.fillRect(Math.round(cx - w / 2) + 1, y, Math.max(1, w - 2), 1);
      }
    }
  }

  if (tangle > 0.45) {                      // knots, once it is really matted
    for (let k = 0; k < 3; k++) {
      const kx = 6 + Math.round(Math.sin(t * 0.7 + k * 2.1) * 3 * tangle);
      const ky = 9 + k * 3;
      if (ky > 7 + len) break;
      bx.fillStyle = '#2a1a0e';
      bx.fillRect(kx - 1, ky - 1, 5, 4);
      bx.fillStyle = '#5a3a1c';
      bx.fillRect(kx, ky, 3, 2);
      bx.fillStyle = '#2a1a0e';
      bx.fillRect(kx + 1, ky, 1, 2);
    }
  }
}

function drawBeard(sx, sy, flipX, flipY, tangle) {
  bx.save();
  bx.translate(Math.round(sx) + (flipX ? 16 : 0), Math.round(sy) + (flipY ? 21 : 0));
  bx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  drawBeardLocal(tangle);
  bx.restore();
}

function beardTangle() {
  return p.stalled ? 1 : clamp(1 - p.fuel / game.sk.fuelMax, 0, 1);
}

function drawPlayer() {
  const bob = p.onGround ? Math.round(Math.sin(game.time * 5)) : 0;
  const { sx: sx0, sy: sy0 } = uggAnchor(p.x, p.y, p.gdir, bob);

  if (p.thrusting) {
    const f = SPR.flame[Math.floor(game.time * 20) % 3];
    const fx = ax(p.x) + Math.round(p.w / WPB / 2) - Math.round(f.width / 2);
    const fy = p.gdir > 0 ? ay(p.y + p.h) - 1 : ay(p.y) + 1 - f.height;
    blit(f, fx, fy, false, p.gdir < 0);
  }

  const flipX = p.facing < 0, flipY = p.gdir < 0;
  blit(SPR.ugg, sx0, sy0, flipX, flipY);
  drawBeard(sx0, sy0, flipX, flipY, beardTangle());
  /* the hull sits in front of the beard, so the saucer reads as one solid
     object and the beard hangs out below it rather than cutting it in half */
  blitRows(SPR.ugg, sx0, sy0, 13, 20, flipX, flipY);

  /* running lights, drawn after the beard so they stay readable */
  const lightRow = p.gdir > 0 ? sy0 + 19 : sy0;
  for (let i = 0; i < 3; i++) {
    const on = Math.floor(game.time * 5 + i) % 3 === 0;
    bx.fillStyle = on ? (i === 1 ? '#ff5fd0' : '#7ff3d8') : '#3a3157';
    bx.fillRect(sx0 + 4 + i * 4, lightRow, 1, 1);
  }
}

function drawParticles() {
  for (const q of particles) {
    bx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max));
    bx.fillStyle = q.col;
    const s = q.r > 3 ? 2 : 1;
    bx.fillRect(ax(q.x), ay(q.y), s, s);
  }
  bx.globalAlpha = 1;
}

function drawDark() {
  if (game.darkAmt < 0.01) return;
  const sx = Math.round((1 - 2 * game.mirrorAmt) * 8) / 8;
  let wx = (p.x + p.w / 2) / WPB - camAX;
  wx = BW / 2 + (wx - BW / 2) * (sx === 0 ? 0.001 : sx);
  const py = (p.y + p.h / 2) / WPB - camAY;
  const r = game.sk.lamp ? 76 : 44;          // headlamp chip widens the circle
  const g = bx.createRadialGradient(wx, py, r * 0.3, wx, py, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, `rgba(6,5,12,${0.75 * game.darkAmt})`);
  g.addColorStop(1, `rgba(6,5,12,${0.97 * game.darkAmt})`);
  bx.fillStyle = g;
  bx.fillRect(0, 0, BW, BH);
  bx.fillStyle = `rgba(6,5,12,${0.5 * game.darkAmt})`;
  bx.fillRect(0, 0, BW, BH);
}

/* ------------------------------------------------------------------- the HUD */

function drawHud() {
  const th = level.theme;
  const eff = p.eff;

  /* top bar strip so text stays legible over any terrain */
  bx.fillStyle = 'rgba(8,6,16,0.72)';
  bx.fillRect(0, 0, BW, 11);
  bx.fillStyle = th.slabLit;
  bx.fillRect(0, 11, BW, 1);

  drawText('LV ' + level.name, 3, 2, '#ffd479', 1);
  drawText('ROCKS ' + p.shiny + '/' + level.totalShiny, 150, 2, '#9fd0ff', 1, 'center');
  drawText('OOGS ' + game.runDeaths, BW - 3, 2, '#ff8f7a', 1, 'right');
  if (p.shield > 0) {                        // spare fuse still intact
    bx.fillStyle = '#ffd479';
    bx.fillRect(BW - 62, 3, 4, 6);
    bx.fillStyle = '#0d0b16';
    bx.fillRect(BW - 61, 5, 2, 2);
  }

  /* stamina bar, dimmed when the lights are out */
  bx.save();
  if (eff.dark) bx.globalAlpha = 0.25;
  const barX = 3, barY = 15, barW = 52;
  drawText('SAUCER', barX, barY, p.stalled ? '#ff7d7d' : '#7de3c8', 1);
  bx.fillStyle = '#0a1418';
  bx.fillRect(barX, barY + 9, barW, 5);
  bx.fillStyle = p.stalled ? '#b8434a' : (p.fuel < game.sk.fuelMax * 0.25 ? '#ff7d7d' : '#35d6b0');
  bx.fillRect(barX + 1, barY + 10, Math.round((barW - 2) * (p.fuel / game.sk.fuelMax)), 3);
  bx.strokeStyle = p.stalled ? '#ff7d7d' : '#2f4a58';
  bx.lineWidth = 1;
  bx.strokeRect(barX + 0.5, barY + 9.5, barW - 1, 4);
  if (p.stalled && Math.floor(game.time * 4) % 2 === 0) {
    drawText('TANGLED', barX + barW + 4, barY + 8, '#ff7d7d', 1);
  }
  bx.restore();

  /* the badge row: the one thing in the cave that never lies */
  const order = ['invert', 'swapkeys', 'lag', 'mirror', 'flip', 'heavy', 'low', 'wind', 'dark', 'strobe'];
  const on = order.filter(k => eff[k]);
  if (on.length) {
    let totalW = 0;
    for (const k of on) totalW += textWidth(ZONE_INFO[k].label, 1) + 8;
    let x = Math.round((BW - totalW) / 2);
    for (const k of on) {
      const info = ZONE_INFO[k];
      const w = textWidth(info.label, 1) + 6;
      bx.fillStyle = 'rgba(8,6,16,0.85)';
      bx.fillRect(x, 14, w, 11);
      bx.strokeStyle = info.col;
      bx.lineWidth = 1;
      bx.strokeRect(x + 0.5, 14.5, w - 1, 10);
      drawText(info.label, x + 3, 16, info.col, 1);
      x += w + 2;
    }
  }

  /* lying signs */
  if (hintTimer > 0) {
    const w = textWidth(hintText, 1) + 8;
    const x = Math.round((BW - w) / 2);
    bx.fillStyle = 'rgba(10,8,4,0.9)';
    bx.fillRect(x, BH - 22, w, 12);
    bx.strokeStyle = '#6b5320';
    bx.lineWidth = 1;
    bx.strokeRect(x + 0.5, BH - 21.5, w - 1, 11);
    drawText(hintText, BW / 2, BH - 19, '#f3d9a0', 1, 'center');
  }

  if (toastTimer > 0) {
    drawTextShadow(toastText, BW / 2, 52, '#ffffff',
      textWidth(toastText, 2) <= BW - 12 ? 2 : 1, 'center');
  }
}

/* ---------------------------------------------------------- editor overlay */

function drawEditorOverlay() {
  const t = game.time;

  /* tile grid, and a heavier line on each room boundary */
  bx.globalAlpha = 0.18;
  bx.fillStyle = '#ffffff';
  const gx0 = Math.max(0, Math.floor(cam.x / TS)), gx1 = Math.min(level.cols, Math.ceil((cam.x + viewW) / TS));
  for (let gx = gx0; gx <= gx1; gx++) {
    const x = ax(gx * TS);
    bx.globalAlpha = (gx % CW === 0) ? 0.4 : 0.13;
    bx.fillRect(x, 0, 1, BH);
  }
  for (let gy = 0; gy <= CH; gy++) {
    bx.globalAlpha = 0.13;
    bx.fillRect(0, ay(gy * TS), BW, 1);
  }
  bx.globalAlpha = 1;

  /* room numbers along the top */
  for (let r = Math.floor(cam.x / (CW * TS)); r <= Math.ceil((cam.x + viewW) / (CW * TS)); r++) {
    if (r < 0 || r * CW >= level.cols) continue;
    drawText('ROOM ' + (r + 1), ax(r * CW * TS) + 3, 14, '#5f5a75', 1);
  }

  /* hovered tile */
  if (editor.tx >= 0) {
    const hx = ax(editor.tx * TS), hy = ay(editor.ty * TS);
    const tool = TOOLS[editor.tool];
    bx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 8);
    bx.fillStyle = tool.col;
    bx.fillRect(hx, hy, TA, TA);
    bx.globalAlpha = 1;
    bx.strokeStyle = '#ffffff';
    bx.lineWidth = 1;
    bx.strokeRect(hx + 0.5, hy + 0.5, TA - 1, TA - 1);
  }

  /* spawn point, which is extracted out of the grid and so draws nothing */
  if (level.spawn) {
    const sx = ax(level.spawn.x) - 2, sy = ay(level.spawn.y) - 4;
    bx.globalAlpha = 0.55;
    blit(SPR.ugg, sx, sy);
    bx.globalAlpha = 1;
    drawText('SPAWN', sx + 8, sy - 8, '#ffe9a8', 1, 'center');
  }

  /* top bar */
  bx.fillStyle = 'rgba(8,6,16,0.85)';
  bx.fillRect(0, 0, BW, 11);
  drawText('EDIT ' + level.name + (editor.dirty ? ' *' : ''), 3, 2, editor.dirty ? '#ffd479' : '#7de3c8', 1);
  if (editor.tx >= 0) {
    drawText('X' + editor.tx + ' Y' + editor.ty, BW - 3, 2, '#8f89a6', 1, 'right');
  }
  drawText(hasOverride(level.stage, game.levelIdx) ? 'EDITED' : 'GENERATED', BW / 2, 2, '#5f5a75', 1, 'center');

  /* status line */
  if (editor.statusTimer > 0) {
    drawTextShadow(editor.status, BW / 2, 22, '#ffffff', 1, 'center');
  }

  /* sign typing prompt */
  if (editor.typing) {
    bx.fillStyle = 'rgba(8,6,16,0.92)';
    bx.fillRect(10, 60, BW - 20, 34);
    bx.strokeStyle = '#a87c3a';
    bx.lineWidth = 1;
    bx.strokeRect(10.5, 60.5, BW - 21, 33);
    drawText('SIGN TEXT - ENTER TO SET, ESC TO CANCEL', BW / 2, 64, '#8f89a6', 1, 'center');
    const caret = Math.floor(t * 3) % 2 === 0 ? '_' : ' ';
    drawText(editor.buf + caret, BW / 2, 78, '#f3d9a0', 1, 'center');
  }

  /* bottom panel: help, selected tool name, palette */
  const barY = BH - 16;
  bx.fillStyle = 'rgba(8,6,16,0.92)';
  bx.fillRect(0, BH - 42, BW, 42);
  drawText('LMB PAINT  RMB ERASE  [ ] TOOL  Z ROOM FX', BW / 2, BH - 40, '#6f6a86', 1, 'center');
  drawText('T SIGN  S SAVE  P PUBLISH  ENTER TEST  E EXIT', BW / 2, BH - 32, '#6f6a86', 1, 'center');
  drawText(TOOLS[editor.tool].name, BW / 2, BH - 24, TOOLS[editor.tool].col, 1, 'center');

  for (let i = 0; i < TOOLS.length; i++) {
    const cx = i * 13, sel = i === editor.tool;
    bx.fillStyle = sel ? TOOLS[i].col : 'rgba(255,255,255,0.07)';
    bx.fillRect(cx + 1, barY + 3, 11, 11);
    drawText(TOOLS[i].lab, cx + 6, barY + 5, sel ? '#0d0b16' : TOOLS[i].col, 1, 'center');
    if (sel) {
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 1;
      bx.strokeRect(cx + 0.5, barY + 2.5, 12, 12);
    }
  }
}

/* -------------------------------------------------------------- studio splash */

function drawSplash() {
  const t = game.splashT;

  bx.fillStyle = '#07060c';
  bx.fillRect(0, 0, BW, BH);

  /* slow starfield so the plate is not dead still */
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137) % BW, sy = (i * 89) % BH;
    const tw = Math.sin(game.time * 1.4 + i) > 0.2;
    bx.fillStyle = tw ? '#2a2440' : '#171325';
    bx.fillRect(sx, sy, 1, 1);
  }

  /* the whole plate eases in, holds, and eases out */
  const fadeIn = clamp(t / 0.6, 0, 1);
  const fadeOut = clamp((SPLASH_TIME - t) / 0.6, 0, 1);
  bx.globalAlpha = Math.min(fadeIn, fadeOut);

  drawText('PRODUCED BY', BW / 2, 24, '#6f6a86', 1, 'center');
  drawTextShadow('CLAUDE', BW / 2, 36, '#8fe6ff', 3, 'center');
  drawText('AND', BW / 2, 64, '#6f6a86', 1, 'center');

  /* studio mark at double size so it reads as a logo, not a sprite */
  const bob = Math.round(Math.sin(game.time * 2) * 1);
  bx.save();
  bx.translate(BW / 2 - 24, 76 + bob);
  bx.scale(2, 2);
  blit(SPR.bear, 0, 0);
  blit(SPR.mug, 15, 6);
  bx.restore();

  drawTextShadow('THIRSTY BEAR', BW / 2, 112, '#ffd479', 2, 'center');
  drawTextShadow('STUDIOS', BW / 2, 128, '#ffd479', 2, 'center');

  bx.globalAlpha = 1;
  if (t > 1.2 && Math.floor(t * 2) % 2 === 0) {
    drawText('PRESS SPACE', BW / 2, 166, '#4f4a63', 1, 'center');
  }
}

/* ------------------------------------------------------------ character select */

function drawChoose() {
  const t = game.time;
  drawIdleBackdrop();

  bx.fillStyle = 'rgba(8,6,16,0.72)';
  bx.fillRect(0, 0, BW, BH);

  drawTextShadow('WHO ARE YOU?', BW / 2, 18, '#ffe9a8', 2, 'center');
  drawText('YOU CAN CHANGE THIS ANY TIME', BW / 2, 36, '#8f89a6', 1, 'center');

  for (let i = 0; i < CHARACTERS.length; i++) {
    const who = CHARACTERS[i];
    const cx = Math.round(BW * (i + 1) / (CHARACTERS.length + 1));
    const sel = i === game.charIdx;
    const bob = sel ? Math.round(Math.sin(t * 3) * 2) : 0;

    bx.fillStyle = sel ? 'rgba(255,212,121,0.10)' : 'rgba(255,255,255,0.03)';
    bx.fillRect(cx - 30, 48, 60, 82);
    bx.strokeStyle = sel ? '#ffd479' : '#3a3450';
    bx.lineWidth = 1;
    bx.strokeRect(cx - 29.5, 48.5, 59, 81);

    /* live portrait, drawn exactly the way the game will draw them */
    const spr = characterSprite(i);
    bx.save();
    bx.translate(cx - 16, 58 + bob);
    bx.scale(2, 2);
    if (sel) blit(SPR.flame[Math.floor(t * 20) % 3], 3, 20);
    blit(spr, 0, 0);
    drawBeardLocal(0.12, who.beard);
    bx.drawImage(spr, 0, 13, SKIN_W, 7, 0, 13, SKIN_W, 7);
    bx.restore();

    drawText(who.name, cx, 104, sel ? '#ffe9a8' : '#8f89a6', 2, 'center');
    drawText(who.sub, cx, 120, sel ? '#a8ffd9' : '#5f5a75', 1, 'center');
  }

  drawText('< >  CHOOSE', BW / 2, 144, '#8f89a6', 1, 'center');
  if (Math.floor(t * 2) % 2 === 0) {
    drawText('SPACE: START', BW / 2, 158, '#ffffff', 2, 'center');
  }
  drawText('MAKE YOUR OWN LOOK LATER WITH C', BW / 2, 172, '#4f4a63', 1, 'center');
}

/* Character portraits are baked once each and reused. */
const charSprites = [];
function characterSprite(i) {
  if (!charSprites[i]) charSprites[i] = makeSprite(CHARACTERS[i].art);
  return charSprites[i];
}

function showChoose() {
  game.state = 'choose';
  game.fade = 1;
  toastTimer = 0;
}

/* --------------------------------------------------------------- title screen */

function drawTitle() {
  drawIdleBackdrop();

  const t = game.time;
  const bob = Math.round(Math.sin(t * 1.6) * 2);

  drawTextShadow('UGG', BW / 2 - 44, 26 + bob, '#ffe9a8', 3, 'center');
  drawTextShadow('&', BW / 2, 30 + bob, '#8fe6ff', 2, 'center');
  drawTextShadow('THE', BW / 2 + 40, 26 + bob, '#ffe9a8', 3, 'center');
  drawTextShadow('UNDERSAUCER', BW / 2, 50 + bob, '#ffe9a8', 3, 'center');

  /* Ugg himself, hovering under the logo at double size */
  const ux = Math.round(BW / 2 - 16), uy = 70 + Math.round(Math.sin(t * 2.2) * 3);
  const f = SPR.flame[Math.floor(t * 20) % 3];
  bx.save();
  bx.translate(ux, uy);
  bx.scale(2, 2);
  blit(f, 3, 20);
  blit(SPR.ugg, 0, 0);
  drawBeardLocal(0.1);
  blitRows(SPR.ugg, 0, 0, 13, 20, false, false);
  bx.restore();

  drawText('A CAVEMAN. A SAUCER BOLTED TO HIS BACKSIDE.', BW / 2, 116, '#b9b2cc', 1, 'center');
  drawText('A CAVE THAT LIES.', BW / 2, 126, '#b9b2cc', 1, 'center');

  if (Math.floor(t * 2) % 2 === 0) {
    drawText('PRESS SPACE', BW / 2, 146, '#ffd479', 2, 'center');
  }
  drawText('CLEARED ' + totalCleared() + '/' + (STAGE_COUNT * LEVELS_PER_STAGE) +
    '   OOGS ' + game.deaths, BW / 2, 168, '#6f6a86', 1, 'center');
}

/* ----------------------------------------------------------------- world map */

function drawMap() {
  const st = STAGES[game.stage];
  const th = st.theme;
  const path = MAP_PATHS[game.stage];
  const t = game.time;

  /* sky bands */
  const bh = Math.ceil(BH / th.bands.length);
  for (let i = 0; i < th.bands.length; i++) {
    bx.fillStyle = th.bands[i];
    bx.fillRect(0, i * bh, BW, bh);
    if (i > 0) {
      bx.fillStyle = th.bands[i - 1];
      for (let x = 0; x < BW; x += 2) bx.fillRect(x, i * bh, 1, 1);
      for (let x = 1; x < BW; x += 2) bx.fillRect(x, i * bh + 1, 1, 1);
    }
  }

  /* stars and drifting motes to fill the sky */
  for (let i = 0; i < 70; i++) {
    const sx2 = (i * 137 + game.stage * 29) % BW;
    const sy2 = 26 + ((i * 89 + game.stage * 17) % 80);
    const tw = Math.sin(t * 1.5 + i) > 0.3;
    bx.fillStyle = i % 6 === 0 ? '#ffd479' : (tw ? th.slabTop : th.far);
    bx.fillRect(sx2, sy2, 1, 1);
  }

  /* floating rocks, parallax-ish drift */
  for (let i = 0; i < 5; i++) {
    const rx = Math.round(((i * 71 + game.stage * 23) % (BW + 40)) - 20 + Math.sin(t * 0.3 + i) * 6);
    const ry = 34 + ((i * 43) % 54);
    bx.fillStyle = th.far;
    bx.fillRect(rx, ry, 12, 4);
    bx.fillRect(rx + 2, ry - 2, 8, 2);
    bx.fillStyle = th.farLit;
    bx.fillRect(rx + 2, ry - 2, 6, 1);
  }

  /* rolling hills behind the trail */
  for (let i = 0; i < 22; i++) {
    const hx = (i * 47 + game.stage * 13) % (BW + 60) - 30;
    const hh = 20 + ((i * 31 + game.stage * 7) % 30);
    pixTriangle(hx, BH - 6, hh * 0.9, hh, -1, i % 3 === 0 ? th.farLit : th.far);
  }
  bx.fillStyle = th.rock;
  bx.fillRect(0, BH - 8, BW, 8);
  bx.fillStyle = th.rockLit;
  bx.fillRect(0, BH - 8, BW, 1);

  /* the trail */
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const done = game.cleared[game.stage][i];
    for (let s = 0; s <= steps; s += 3) {
      const f = s / steps;
      bx.fillStyle = done ? th.slabTop : '#4a4560';
      bx.fillRect(Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f), 2, 2);
    }
  }

  /* nodes */
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    const cleared = game.cleared[game.stage][i];
    const open = isUnlocked(game.stage, i);
    const boss = i === LEVELS_PER_STAGE - 1;
    const r = boss ? 6 : 5;

    bx.fillStyle = '#0d0b16';
    bx.fillRect(x - r - 1, y - r - 1, (r + 1) * 2, (r + 1) * 2);
    if (!open) {
      bx.fillStyle = '#332e47';
      bx.fillRect(x - r, y - r, r * 2, r * 2);
      bx.fillStyle = '#1a1626';
      bx.fillRect(x - 2, y - 3, 4, 6);
    } else if (cleared) {
      bx.fillStyle = '#35d6b0';
      bx.fillRect(x - r, y - r, r * 2, r * 2);
      bx.fillStyle = '#0d3b30';
      bx.fillRect(x - 3, y - 1, 2, 3);
      bx.fillRect(x - 1, y + 1, 2, 2);
      bx.fillRect(x + 1, y - 3, 2, 5);
    } else if (boss) {
      blit(SPR.ship, x - 17, y - 8);
    } else {
      bx.fillStyle = '#ffd479';
      bx.fillRect(x - r, y - r, r * 2, r * 2);
      bx.fillStyle = '#5c4310';
      bx.fillRect(x - 1, y - 3, 2, 4);
      bx.fillRect(x - 1, y + 2, 2, 2);
    }

    if (i === game.cursor) {
      const pulse = Math.floor(t * 6) % 2 === 0 ? 2 : 1;
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 1;
      bx.strokeRect(x - r - pulse - 0.5, y - r - pulse - 0.5, (r + pulse) * 2 + 1, (r + pulse) * 2 + 1);
    }

    drawText(String(i + 1), x, y + 9, open ? '#cfc8e6' : '#4a4560', 1, 'center');
  }

  /* Ugg's marker slides between nodes, riding above them */
  game.markerAt += (game.cursor - game.markerAt) * 0.25;
  const a = Math.floor(game.markerAt), b = Math.min(path.length - 1, a + 1);
  const f = game.markerAt - a;
  const mx = Math.round(path[a][0] + (path[b][0] - path[a][0]) * f);
  const my = Math.round(path[a][1] + (path[b][1] - path[a][1]) * f) - 30 + Math.round(Math.sin(t * 4) * 2);
  blit(SPR.flame[Math.floor(t * 20) % 3], mx - 5, my + 21);
  blit(SPR.ugg, mx - 8, my);

  /* header and footer */
  bx.fillStyle = 'rgba(8,6,16,0.8)';
  bx.fillRect(0, 0, BW, 28);
  bx.fillStyle = th.slabLit;
  bx.fillRect(0, 28, BW, 1);
  /* Drop a size rather than run off the edge if a stage name is long. */
  const title = 'STAGE ' + (game.stage + 1) + ' - ' + st.name;
  drawText(title, BW / 2, 3, '#ffe9a8', textWidth(title, 2) <= BW - 8 ? 2 : 1, 'center');
  drawText(st.blurb, BW / 2, 19, '#8f89a6', 1, 'center');

  bx.fillStyle = 'rgba(8,6,16,0.85)';
  bx.fillRect(0, BH - 16, BW, 16);
  const open = isUnlocked(game.stage, game.cursor);
  const done = game.cleared[game.stage][game.cursor];
  drawText('LEVEL ' + levelName(game.stage, game.cursor) +
    (done ? '  CLEARED' : open ? '' : '  LOCKED'), 4, BH - 12, done ? '#7de3c8' : open ? '#ffd479' : '#6f6a86', 1);
  if (open && Math.floor(t * 2) % 2 === 0) {
    drawText('SPACE: ENTER', BW - 4, BH - 12, '#ffffff', 1, 'right');
  }
  drawText('< > MOVE   E EDIT   B BOARD   C SKIN', BW / 2, BH - 12, '#8f89a6', 1, 'center');
  drawText('ROCKS ' + rocksAvailable(), 4, 32, '#9fd0ff', 1);
  if (hasOverride(game.stage, game.cursor)) {
    drawText('EDITED', BW / 2, BH - 22, '#ffd479', 1, 'center');
  }

  if (game.stage > 0) drawText('< STAGE ' + game.stage, 4, 32, '#5f5a75', 1);
  if (game.stage < STAGE_COUNT - 1 && isUnlocked(game.stage + 1, 0)) {
    drawText('STAGE ' + (game.stage + 2) + ' >', BW - 4, 32, '#5f5a75', 1, 'right');
  }
}

/* -------------------------------------------------------------- mother board */

const PCB = {
  base: '#123024', baseLit: '#1b4433', grid: '#0d241b',
  traceOff: '#2f4a3a', traceOn: '#c9a227', traceHot: '#ffd479',
  chip: '#141018', chipEdge: '#2a2436', pin: '#b9b0c8',
  ledOff: '#3a3a44', ledOn: '#5fff9b', ledCan: '#ffd479',
};

function boardNodeAt(i) { return BOARD[i]; }

/* Arrow keys hop to the nearest chip in that direction. */
function boardMove(dx, dy) {
  const cur = BOARD[game.boardCursor];
  let best = -1, bestScore = 1e9;
  for (let i = 0; i < BOARD.length; i++) {
    if (i === game.boardCursor) continue;
    const n = BOARD[i];
    const ox = n.x - cur.x, oy = n.y - cur.y;
    if (dx && Math.sign(ox) !== Math.sign(dx)) continue;
    if (dy && Math.sign(oy) !== Math.sign(dy)) continue;
    /* prefer aligned, then near */
    const along = Math.abs(dx ? ox : oy);
    const across = Math.abs(dx ? oy : ox);
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best >= 0) { game.boardCursor = best; sfx('jump'); }
}

function drawTrace(x0, y0, x1, y1, col, dashPhase) {
  /* right-angle copper: out, across, in */
  const midX = Math.round((x0 + x1) / 2);
  const pts = [[x0, y0], [midX, y0], [midX, y1], [x1, y1]];
  bx.fillStyle = col;
  for (let s = 0; s < 3; s++) {
    const [ax0, ay0] = pts[s], [ax1, ay1] = pts[s + 1];
    if (ay0 === ay1) {
      const a = Math.min(ax0, ax1), b = Math.max(ax0, ax1);
      for (let x = a; x <= b; x++) {
        if (dashPhase !== undefined && ((x + dashPhase) % 8) < 3) continue;
        bx.fillRect(x, ay0, 1, 2);
      }
    } else {
      const a = Math.min(ay0, ay1), b = Math.max(ay0, ay1);
      for (let y = a; y <= b; y++) {
        if (dashPhase !== undefined && ((y + dashPhase) % 8) < 3) continue;
        bx.fillRect(ax0, y, 2, 1);
      }
    }
  }
}

function drawBoard() {
  const t = game.time;

  /* board substrate */
  bx.fillStyle = PCB.base;
  bx.fillRect(0, 0, BW, BH);
  bx.fillStyle = PCB.grid;
  for (let x = 0; x < BW; x += 8) bx.fillRect(x, 0, 1, BH);
  for (let y = 0; y < BH; y += 8) bx.fillRect(0, y, BW, 1);
  /* solder vias scattered over the board */
  for (let i = 0; i < 90; i++) {
    const vx = (i * 53) % BW, vy = (i * 97) % BH;
    bx.fillStyle = PCB.baseLit;
    bx.fillRect(vx, vy, 2, 2);
    bx.fillStyle = PCB.grid;
    bx.fillRect(vx, vy, 1, 1);
  }

  /* power rail down the left edge, feeding the first column */
  bx.fillStyle = hasSkill('cap1') || hasSkill('reg') ? PCB.traceOn : PCB.traceOff;
  bx.fillRect(18, 40, 3, 84);
  drawText('PWR', 12, 30, '#7de3c8', 1);

  /* traces */
  const phase = Math.floor(t * 12);
  for (const n of BOARD) {
    if (!n.req.length) {
      const live = hasSkill(n.id);
      drawTrace(21, n.y, n.x - 10, n.y, live ? PCB.traceOn : PCB.traceOff, live ? undefined : phase);
      continue;
    }
    for (const r of n.req) {
      const from = BOARD_BY_ID[r];
      const live = hasSkill(n.id);
      const armed = !live && hasSkill(r);
      drawTrace(from.x + 10, from.y, n.x - 10, n.y,
        live ? PCB.traceOn : armed ? PCB.traceHot : PCB.traceOff,
        live ? undefined : phase);
    }
  }

  /* chips */
  const avail = rocksAvailable();
  for (let i = 0; i < BOARD.length; i++) {
    const n = BOARD[i];
    const owned = hasSkill(n.id);
    const shipped = skillVisible(n);
    const ready = skillReady(n) && !owned;
    const affordable = ready && avail >= n.cost;
    const sel = i === game.boardCursor;

    /* A bank you have not reached yet is an empty socket, not a chip. */
    if (!shipped && !owned) {
      bx.fillStyle = '#0f2018';
      bx.fillRect(n.x - 10, n.y - 8, 20, 16);
      bx.strokeStyle = '#1b4433';
      bx.lineWidth = 1;
      bx.setLineDash([2, 2]);
      bx.strokeRect(n.x - 9.5, n.y - 7.5, 19, 15);
      bx.setLineDash([]);
      if (sel) {
        bx.strokeStyle = '#ffffff';
        bx.strokeRect(n.x - 12.5, n.y - 10.5, 25, 21);
      }
      continue;
    }

    /* pins */
    bx.fillStyle = owned ? PCB.pin : '#5b5470';
    for (let k = -1; k <= 1; k++) {
      bx.fillRect(n.x - 12, n.y + k * 4 - 1, 3, 2);
      bx.fillRect(n.x + 9, n.y + k * 4 - 1, 3, 2);
    }
    /* body */
    bx.fillStyle = PCB.chipEdge;
    bx.fillRect(n.x - 10, n.y - 8, 20, 16);
    bx.fillStyle = PCB.chip;
    bx.fillRect(n.x - 9, n.y - 7, 18, 14);
    if (owned) {
      bx.fillStyle = 'rgba(95,255,155,0.14)';
      bx.fillRect(n.x - 9, n.y - 7, 18, 14);
    }
    drawText(n.code, n.x, n.y - 4, owned ? '#a8ffd9' : affordable ? '#ffe9a8' : '#6f6a86', 1, 'center');

    /* status LED */
    const blink = Math.floor(t * 4) % 2 === 0;
    bx.fillStyle = owned ? PCB.ledOn : affordable ? (blink ? PCB.ledCan : '#6b5320') : PCB.ledOff;
    bx.fillRect(n.x + 5, n.y + 3, 3, 2);

    if (sel) {
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 1;
      const pad = Math.floor(t * 6) % 2 === 0 ? 1 : 2;
      bx.strokeRect(n.x - 10 - pad + 0.5, n.y - 8 - pad + 0.5, 20 + pad * 2 - 1, 16 + pad * 2 - 1);
    }
  }

  /* header */
  bx.fillStyle = 'rgba(6,14,10,0.9)';
  bx.fillRect(0, 0, BW, 18);
  bx.fillStyle = PCB.traceOn;
  bx.fillRect(0, 18, BW, 1);
  drawText('THE MOTHER BOARD', 4, 3, '#a8ffd9', 2);
  drawText('ROCKS ' + avail, BW - 4, 3, '#9fd0ff', 2, 'right');

  /* selected chip details */
  const n = BOARD[game.boardCursor];
  const isOwned = hasSkill(n.id);
  const isReady = skillReady(n);
  bx.fillStyle = 'rgba(6,14,10,0.92)';
  bx.fillRect(0, BH - 30, BW, 30);
  bx.fillStyle = PCB.traceOn;
  bx.fillRect(0, BH - 30, BW, 1);

  const hidden = !skillVisible(n) && !isOwned;
  drawText(hidden ? 'EMPTY SOCKET' : n.name, 4, BH - 27, isOwned ? '#a8ffd9' : hidden ? '#5f7a6a' : '#ffe9a8', 1);
  drawText(hidden ? 'NEW HARDWARE ARRIVES EACH STAGE' : n.desc, 4, BH - 18, '#8fb0a0', 1);

  if (isOwned) {
    drawText('INSTALLED', BW - 4, BH - 27, '#5fff9b', 1, 'right');
  } else if (!skillVisible(n)) {
    drawText('SHIPS WITH STAGE ' + ((n.bank || 0) + 1), BW - 4, BH - 27, '#5f7a6a', 1, 'right');
  } else if (!isReady) {
    const missing = n.req.filter(r => !hasSkill(r)).map(r => BOARD_BY_ID[r].name);
    drawText('NEEDS ' + missing.join(' + '), BW - 4, BH - 27, '#ff8f7a', 1, 'right');
  } else {
    const can = avail >= n.cost;
    drawText('COST ' + n.cost + ' ROCKS', BW - 4, BH - 27, can ? '#ffd479' : '#ff8f7a', 1, 'right');
    if (can && Math.floor(t * 2) % 2 === 0) {
      drawText('SPACE: INSTALL', BW - 4, BH - 18, '#ffffff', 1, 'right');
    }
  }
  const owned = BOARD.filter(n => hasSkill(n.id)).length;
  drawText(owned + '/' + BOARD.length + ' INSTALLED', 4, BH - 9, '#5f7a6a', 1);
  drawText('ARROWS MOVE   B OR ESC: BACK', BW - 4, BH - 9, '#5f7a6a', 1, 'right');
}

/* ------------------------------------------------------- character lab screen */

function labCheckerRect(x, y, w, h) {
  for (let j = 0; j < h; j += 2) {
    for (let i = 0; i < w; i += 2) {
      bx.fillStyle = ((i + j) / 2) % 2 === 0 ? '#241f33' : '#1a1626';
      bx.fillRect(x + i, y + j, 2, 2);
    }
  }
}

/* Draws a skin grid at one art pixel per cell, for thumbnails. */
function drawSkinThumb(rows, x, y) {
  for (let gy = 0; gy < SKIN_H; gy++) {
    for (let gx = 0; gx < SKIN_W; gx++) {
      const ch = rows[gy][gx];
      if (ch === '.' || !PAL[ch]) continue;
      bx.fillStyle = PAL[ch];
      bx.fillRect(x + gx, y + gy, 1, 1);
    }
  }
}

function drawLab() {
  const t = game.time;

  bx.fillStyle = '#12101d';
  bx.fillRect(0, 0, BW, BH);
  for (let i = 0; i < 60; i++) {
    bx.fillStyle = i % 5 === 0 ? '#241f33' : '#1a1626';
    bx.fillRect((i * 71) % BW, (i * 53) % BH, 2, 2);
  }

  /* ---- the pixel grid ---- */
  const gx0 = LAB.gridX, gy0 = LAB.gridY, cs = LAB.cell;
  labCheckerRect(gx0, gy0, SKIN_W * cs, SKIN_H * cs);
  for (let y = 0; y < SKIN_H; y++) {
    for (let x = 0; x < SKIN_W; x++) {
      const ch = lab.rows[y][x];
      if (ch === '.' || !PAL[ch]) continue;
      bx.fillStyle = PAL[ch];
      bx.fillRect(gx0 + x * cs, gy0 + y * cs, cs, cs);
    }
  }
  bx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let x = 0; x <= SKIN_W; x++) bx.fillRect(gx0 + x * cs, gy0, 1, SKIN_H * cs);
  for (let y = 0; y <= SKIN_H; y++) bx.fillRect(gx0, gy0 + y * cs, SKIN_W * cs, 1);

  /* guides: where the beard attaches and which rows are drawn over it */
  bx.fillStyle = '#6b4a20';
  bx.fillRect(gx0 - 4, gy0 + 7 * cs, 3, 1);
  bx.fillStyle = '#5b6280';
  bx.fillRect(gx0 + SKIN_W * cs + 1, gy0 + 13 * cs, 1, 7 * cs);
  /* beard selector */
  bx.fillStyle = '#0d0b16';
  bx.fillRect(LAB.previewX - 6, 112, 56, 24);
  bx.strokeStyle = lab.beard === 0 ? '#5b6280' : '#6b4a20';
  bx.lineWidth = 1;
  bx.strokeRect(LAB.previewX - 5.5, 112.5, 55, 23);
  drawText('BEARD  C/Q', LAB.previewX + 22, 114, '#8f89a6', 1, 'center');
  drawText(BEARDS[lab.beard].name, LAB.previewX + 22, 124,
    lab.beard === 0 ? '#8f89a6' : '#c9a06a', 1, 'center');


  /* hovered / cursor cell */
  bx.strokeStyle = '#ffffff';
  bx.lineWidth = 1;
  bx.strokeRect(gx0 + lab.cx * cs + 0.5, gy0 + lab.cy * cs + 0.5, cs - 1, cs - 1);

  /* ---- palette ---- */
  drawText('PALETTE', LAB.palX, LAB.palY - 10, '#8f89a6', 1);
  for (let i = 0; i < SKIN_PALETTE.length; i++) {
    const ch = SKIN_PALETTE[i];
    const px = LAB.palX + (i % LAB.palCols) * LAB.palCell;
    const py = LAB.palY + Math.floor(i / LAB.palCols) * LAB.palCell;
    if (ch === '.') labCheckerRect(px, py, 8, 8);
    else { bx.fillStyle = PAL[ch]; bx.fillRect(px, py, 8, 8); }
    if (ch === lab.col) {
      bx.strokeStyle = '#ffffff';
      bx.lineWidth = 1;
      bx.strokeRect(px - 0.5, py - 0.5, 9, 9);
    }
  }

  /* ---- live preview ---- */
  const pvX = LAB.previewX, pvY = LAB.previewY;
  bx.fillStyle = '#0d0b16';
  bx.fillRect(pvX - 6, pvY - 10, 56, 62);
  bx.strokeStyle = '#2a2436';
  bx.lineWidth = 1;
  bx.strokeRect(pvX - 5.5, pvY - 9.5, 55, 61);
  drawText('PREVIEW', pvX + 22, pvY - 8, '#8f89a6', 1, 'center');

  const preview = makeSprite(lab.rows);
  const bob = Math.round(Math.sin(t * 2.4) * 2);
  bx.save();
  bx.translate(pvX + 6, pvY + bob + 4);
  bx.scale(2, 2);
  blit(SPR.flame[Math.floor(t * 20) % 3], 3, 20);
  blit(preview, 0, 0);
  drawBeardLocal(0.15, lab.beard);
  bx.drawImage(preview, 0, 13, SKIN_W, 7, 0, 13, SKIN_W, 7);
  bx.restore();

  /* ---- slots ---- */
  drawText('SLOTS', LAB.slotX, LAB.slotY - 10, '#8f89a6', 1);
  for (let i = 0; i < 4; i++) {
    const sx = LAB.slotX + i * 26, sy = LAB.slotY;
    const sel = i === lab.active;
    bx.fillStyle = sel ? '#2a2436' : '#171325';
    bx.fillRect(sx, sy, 22, 26);
    if (lab.slots[i]) drawSkinThumb(lab.slots[i].rows, sx + 3, sy + 3);
    else drawText('-', sx + 11, sy + 10, '#4a4560', 1, 'center');
    bx.strokeStyle = sel ? '#ffffff' : '#3a3450';
    bx.lineWidth = 1;
    bx.strokeRect(sx - 0.5, sy - 0.5, 23, 27);
    drawText(String(i + 1), sx + 11, sy + 28, sel ? '#ffe9a8' : '#5f5a75', 1, 'center');
  }

  /* ---- header and help ---- */
  bx.fillStyle = 'rgba(8,6,16,0.9)';
  bx.fillRect(0, 0, BW, 20);
  bx.fillStyle = '#5fe8ff';
  bx.fillRect(0, 20, BW, 1);
  drawText('CHARACTER LAB', 4, 4, '#8fe6ff', 2);
  drawText('SLOT ' + (lab.active + 1) + (lab.dirty ? ' *' : ''), BW - 4, 4,
    lab.dirty ? '#ffd479' : '#7de3c8', 2, 'right');

  bx.fillStyle = 'rgba(8,6,16,0.9)';
  bx.fillRect(0, BH - 26, BW, 26);
  if (lab.statusTimer > 0) {
    drawText(lab.status, BW / 2, BH - 24, '#ffffff', 1, 'center');
  } else {
    drawText('GUIDES: BEARD HANGS FROM ROW 8   HULL IS ROWS 14-20', BW / 2, BH - 24, '#4f4a63', 1, 'center');
  }
  drawText('LMB PAINT  RMB ERASE  C BEARD  Q SHAVE  1-4 SLOT', BW / 2, BH - 15, '#6f6a86', 1, 'center');
  drawText('S SAVE  R RESET  X CLEAR  CTRL+C/V SHARE  ESC BACK', BW / 2, BH - 7, '#6f6a86', 1, 'center');
}

/* --------------------------------------------------------- clear and finale */

function drawClearScreen() {
  bx.fillStyle = 'rgba(8,6,16,0.82)';
  bx.fillRect(0, 0, BW, BH);
  const c = clearInfo;
  drawTextShadow('LEVEL ' + c.name + ' CLEARED', BW / 2, 44, '#a8ffd9', 2, 'center');
  drawText('SHINY ROCKS ' + c.shiny + ' OF ' + c.total, BW / 2, 74, '#9fd0ff', 1, 'center');
  drawText(c.gained > 0 ? '+' + c.gained + ' BANKED   ' + c.bank + ' TO SPEND'
    : 'NO NEW ROCKS   ' + c.bank + ' TO SPEND', BW / 2, 84, c.gained > 0 ? '#ffd479' : '#6f6a86', 1, 'center');
  drawText('OOGS ' + c.oogs, BW / 2, 94, '#ff8f7a', 1, 'center');
  if (c.newStage) {
    drawTextShadow('STAGE ' + (c.nextStage + 1) + ' OPEN', BW / 2, 106, '#ffd479', 2, 'center');
    drawText(STAGES[c.nextStage].name, BW / 2, 122, '#ffe9a8', 1, 'center');
  }
  if (Math.floor(game.time * 2) % 2 === 0) {
    drawText('PRESS SPACE', BW / 2, 148, '#ffffff', 1, 'center');
  }
}

/* Built when the last level falls, so the run's numbers can go in the roll. */
function buildCredits() {
  const rocks = (() => { let n = 0; for (const r of game.best) for (const v of r) n += v; return n; })();
  return [
    { ship: true },
    { t: 'UGG REACHES', s: 2, c: '#ffe9a8' },
    { t: 'THE MOTHERSHIP', s: 2, c: '#ffe9a8' },
    { gap: 10 },
    { t: 'THE SAUCER WAS HIS THE WHOLE TIME.', s: 1, c: '#b9b2cc' },
    { t: 'NOBODY KNOWS WHO BOLTED IT ON.', s: 1, c: '#b9b2cc' },
    { gap: 20 },

    { t: 'MADE BY', s: 1, c: '#6f6a86' },
    { gap: 6 },
    { t: 'CLAUDE', s: 3, c: '#8fe6ff' },
    { gap: 8 },
    { t: 'JULIAN CANFIELD', s: 2, c: '#a8ffd9' },
    { gap: 4 },
    { t: 'COREY CANFIELD', s: 2, c: '#a8ffd9' },
    { gap: 16 },

    { bear: true },
    { t: 'THIRSTY BEAR STUDIOS', s: 2, c: '#ffd479' },
    { gap: 24 },

    { t: 'THE RUN', s: 1, c: '#6f6a86' },
    { gap: 6 },
    { t: 'LEVELS CLEARED  ' + totalCleared() + '/' + (STAGE_COUNT * LEVELS_PER_STAGE), s: 1, c: '#9fd0ff' },
    { t: 'SHINY ROCKS FOUND  ' + rocks, s: 1, c: '#9fd0ff' },
    { t: 'CHIPS INSTALLED  ' + BOARD.filter(n => hasSkill(n.id)).length + '/' + BOARD.length, s: 1, c: '#a8ffd9' },
    { t: 'OOGS ALL TIME  ' + game.deaths, s: 1, c: '#ff8f7a' },
    { gap: 24 },

    { t: 'EVERY SIGN IN THIS CAVE LIED TO YOU.', s: 1, c: '#8f89a6' },
    { t: 'THANKS FOR PLAYING ANYWAY.', s: 1, c: '#8f89a6' },
    { gap: 20 },
    { t: 'THE END', s: 3, c: '#ffe9a8' },
  ];
}

function drawFinale() {
  const t = game.time;
  if (!game.credits) { game.credits = buildCredits(); game.creditsY = BH + 10; }

  bx.fillStyle = 'rgba(8,6,16,0.92)';
  bx.fillRect(0, 0, BW, BH);

  /* drifting stars behind the roll */
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137) % BW;
    const sy = ((i * 89) % BH + game.time * 4) % BH;
    bx.fillStyle = i % 5 === 0 ? '#ffd479' : '#2a2440';
    bx.fillRect(sx, Math.round(sy), 1, 1);
  }

  let y = Math.round(game.creditsY);
  for (const line of game.credits) {
    if (line.gap) { y += line.gap; continue; }
    if (line.ship) {
      if (y > -20 && y < BH + 20) blit(SPR.ship, BW / 2 - 17, y + Math.round(Math.sin(t * 2) * 2));
      y += 20;
      continue;
    }
    if (line.bear) {
      if (y > -40 && y < BH + 40) {
        bx.save();
        bx.translate(BW / 2 - 24, y);
        bx.scale(2, 2);
        blit(SPR.bear, 0, 0);
        blit(SPR.mug, 15, 6);
        bx.restore();
      }
      y += 34;
      continue;
    }
    if (y > -12 && y < BH + 4) drawTextShadow(line.t, BW / 2, y, line.c, line.s, 'center');
    y += line.s * 8 + 3;
  }

  /* stop once the tail reaches the middle of the screen */
  const end = y - game.creditsY;
  if (game.creditsY > BH / 2 - end + 40) game.creditsY -= 0.35;

  bx.fillStyle = 'rgba(8,6,16,0.85)';
  bx.fillRect(0, BH - 12, BW, 12);
  if (Math.floor(t * 2) % 2 === 0) {
    drawText('PRESS SPACE', BW / 2, BH - 9, '#ffffff', 1, 'center');
  }
}

function drawFade() {
  if (game.fade <= 0.01) return;
  game.fade *= 0.88;
  bx.fillStyle = `rgba(8,6,16,${game.fade})`;
  bx.fillRect(0, 0, BW, BH);
}

function drawFlashes() {
  if (game.flash > 0.01) {
    bx.fillStyle = `rgba(168,255,216,${game.flash * 0.35})`;
    bx.fillRect(0, 0, BW, BH);
    game.flash *= 0.86;
  }
  if (game.redFlash > 0.01) {
    bx.fillStyle = `rgba(200,50,50,${game.redFlash * 0.5})`;
    bx.fillRect(0, 0, BW, BH);
    game.redFlash *= 0.90;
  }
}

/* ------------------------------------------------------------------ main loop */

/* --------------------------------------------------------- the character lab */
/* Ugg is a 16x20 character grid, so making a skin is editing that grid and
   re-baking the sprite. Skins live in four slots; the active one is applied to
   the player, the map marker, the title screen and (palette-swapped) to the
   doppelganger, exactly like the built-in one. */

const SKIN_W = 16, SKIN_H = 20;
const SKIN_KEY = 'uggsaucer.skins';

/* Who you fly as. Picked once when you first start, changeable any time from
   the title, and overridden entirely if you save a skin in the Character Lab. */
const CHARACTERS = [
  { id: 'ugg', name: 'UGG', sub: 'HE / HIM', art: ART_UGG, beard: 1 },
  { id: 'oona', name: 'OONA', sub: 'SHE / HER', art: ART_OONA, beard: 0 },
];

function chosenCharacter() { return CHARACTERS[clamp(game.charIdx | 0, 0, CHARACTERS.length - 1)]; }

const DEFAULT_SKIN = ART_UGG.slice();

/* Palette shown in the lab: transparent first, then every colour the art uses. */
const SKIN_PALETTE = ['.'].concat(Object.keys(PAL));

const lab = {
  on: false,
  rows: null,
  slots: [null, null, null, null],
  active: 0,
  col: '9',
  cx: 0, cy: 0,
  painting: 0,
  status: '', statusTimer: 0,
  dirty: false,
};

/* Geometry of the lab screen, in art pixels. */
const LAB = {
  gridX: 8, gridY: 28, cell: 6,
  palX: 116, palY: 36, palCell: 9, palCols: 6,
  slotX: 116, slotY: 106,
  previewX: 232, previewY: 46,
};

function labStatus(msg, secs) { lab.status = msg; lab.statusTimer = secs || 1.6; }

function normaliseSkin(rows) {
  const out = [];
  for (let y = 0; y < SKIN_H; y++) {
    let r = (rows && rows[y]) || '';
    if (r.length > SKIN_W) r = r.slice(0, SKIN_W);
    while (r.length < SKIN_W) r += '.';
    /* drop anything that is not a known palette key */
    let clean = '';
    for (const ch of r) clean += (ch === '.' || PAL[ch]) ? ch : '.';
    out.push(clean);
  }
  return out;
}

/* A slot is { rows, beard }. Older saves stored a bare row array, so those are
   read as the classic beard. */
function normaliseSlot(v) {
  if (!v) return null;
  if (Array.isArray(v)) return { rows: normaliseSkin(v), beard: 1 };
  return { rows: normaliseSkin(v.rows), beard: clamp(v.beard | 0, 0, BEARDS.length - 1) };
}

/* Codes carry the beard as a leading B token, and survive without one. */
function skinToCode(rows, beard) { return 'B' + beard + '/' + rows.join('/'); }

function skinFromCode(code) {
  const parts = String(code).trim().split('/');
  let beard = 1;
  if (parts.length && /^B\d+$/i.test(parts[0])) {
    beard = clamp(parseInt(parts.shift().slice(1), 10), 0, BEARDS.length - 1);
  }
  return { rows: normaliseSkin(parts), beard };
}

function loadSkins() {
  lab.slots = [null, null, null, null];
  lab.active = 0;
  try {
    const s = JSON.parse(localStorage.getItem(SKIN_KEY) || '{}');
    if (Array.isArray(s.slots)) {
      for (let i = 0; i < 4; i++) lab.slots[i] = normaliseSlot(s.slots[i]);
    }
    lab.active = clamp(s.active | 0, 0, 3);
  } catch (_) { /* storage blocked */ }
  applySkin();
}

function persistSkins() {
  try {
    localStorage.setItem(SKIN_KEY, JSON.stringify({ slots: lab.slots, active: lab.active }));
    return true;
  } catch (_) { return false; }
}

function activeSlot() { return lab.slots[lab.active]; }

function activeSkinRows() {
  const s = activeSlot();
  return s ? s.rows : DEFAULT_SKIN;
}

/* Re-bakes every sprite that is made from the character grid. */
function applySkin() {
  const s = activeSlot();
  const who = chosenCharacter();
  const rows = s ? s.rows : who.art;
  activeBeard = s ? s.beard : who.beard;
  SPR.ugg = makeSprite(rows);
  SPR.echo = makeSprite(rows, {
    '9': 'o', '6': 'p', '7': 'o', '8': 'p', 'a': 'o', 'b': 'p',
    'c': 'o', 'd': 'p', 'e': 'r', 'm': 'r', 'q': '1', '0': '1',
  });
}

function openLab() {
  lab.on = true;
  game.state = 'lab';
  const s = activeSlot();
  lab.rows = (s ? s.rows : DEFAULT_SKIN).slice();
  lab.beard = s ? s.beard : 1;
  lab.dirty = false;
  game.fade = 1;
  labStatus('SLOT ' + (lab.active + 1), 1.4);
}

function labCycleBeard(dir) {
  lab.beard = (lab.beard + dir + BEARDS.length) % BEARDS.length;
  lab.dirty = true;
  labStatus('BEARD: ' + BEARDS[lab.beard].name, 1.6);
  sfx('pickup');
}

function labShave() {
  if (lab.beard === 0) { labStatus('ALREADY CLEAN SHAVEN', 1.2); return; }
  lab.beard = 0;
  lab.dirty = true;
  labStatus('BEARD REMOVED', 1.6);
  sfx('warp');
}

function closeLab() {
  lab.on = false;
  showMap(game.stage);
}

function labSetPixel(x, y, ch) {
  if (x < 0 || y < 0 || x >= SKIN_W || y >= SKIN_H) return;
  if (lab.rows[y][x] === ch) return;
  lab.rows[y] = lab.rows[y].slice(0, x) + ch + lab.rows[y].slice(x + 1);
  lab.dirty = true;
}

function labSave() {
  lab.slots[lab.active] = { rows: lab.rows.slice(), beard: lab.beard };
  const ok = persistSkins();
  applySkin();
  lab.dirty = !ok;
  labStatus(ok ? 'SAVED TO SLOT ' + (lab.active + 1) : 'SAVE FAILED - STORAGE BLOCKED', 2);
  sfx(ok ? 'check' : 'die');
}

function labSelectSlot(i) {
  lab.active = clamp(i, 0, 3);
  const s = activeSlot();
  lab.rows = (s ? s.rows : DEFAULT_SKIN).slice();
  lab.beard = s ? s.beard : 1;
  lab.dirty = false;
  persistSkins();
  applySkin();
  labStatus('SLOT ' + (lab.active + 1) + (s ? '' : ' (EMPTY - SHOWING DEFAULT)'), 1.8);
}

function labReset() {
  lab.rows = DEFAULT_SKIN.slice();
  lab.beard = 1;
  lab.dirty = true;
  labStatus('RESET TO THE ORIGINAL UGG', 1.6);
}

function labClear() {
  lab.rows = [];
  for (let y = 0; y < SKIN_H; y++) lab.rows.push('.'.repeat(SKIN_W));
  lab.dirty = true;
  labStatus('CLEARED', 1.2);
}

function labCopy() {
  const code = skinToCode(lab.rows, lab.beard);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(
      () => labStatus('SKIN CODE COPIED - SHARE IT', 2),
      () => labStatus('COPY BLOCKED BY BROWSER', 2));
  } else {
    labStatus('CLIPBOARD NOT AVAILABLE', 2);
  }
}

/* Ctrl+V anywhere in the lab pastes a shared skin code. */
addEventListener('paste', e => {
  if (!lab.on) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  e.preventDefault();
  const parsed = skinFromCode(text);
  lab.rows = parsed.rows;
  lab.beard = parsed.beard;
  lab.dirty = true;
  labStatus('SKIN CODE PASTED', 1.8);
  sfx('pickup');
});

/* ------------------------------------------------------------------- editor */
/* Paints straight onto the level's source grid, then rebuilds the level so the
   result is immediately playable. Everything an editor places is just a
   character in that grid, which is why hazards, enemies and props all work the
   same way. */

const TOOLS = [
  { ch: ' ', lab: 'X', name: 'ERASE', col: '#8f89a6' },
  { ch: '#', lab: '#', name: 'ROCK', col: '#6b5c96' },
  { ch: '=', lab: '=', name: 'PLATFORM', col: '#9a8fc4' },
  { ch: 'F', lab: 'F', name: 'FAKE PLATFORM', col: '#ff5fd0' },
  { ch: 'P', lab: 'P', name: 'PHANTOM PLATFORM', col: '#9fd0ff' },
  { ch: 'B', lab: 'B1', name: 'BLINKER A', col: '#7ff3d8' },
  { ch: 'b', lab: 'B2', name: 'BLINKER B', col: '#ffc07d' },
  { ch: 'C', lab: '>', name: 'CONVEYOR RIGHT', col: '#ffd23f' },
  { ch: 'c', lab: '<', name: 'CONVEYOR LEFT', col: '#ffd23f' },
  { ch: 'T', lab: 'T', name: 'BOUNCE PAD', col: '#ff5fd0' },
  { ch: '^', lab: '^', name: 'SPIKES', col: '#c9c9d8' },
  { ch: '~', lab: '~', name: 'GOO', col: '#48c46a' },
  { ch: 'S', lab: 'S', name: 'SAWBLADE', col: '#c9c9d8' },
  { ch: 'V', lab: 'V', name: 'CRUSHER', col: '#a86fd4' },
  { ch: 'o', lab: 'O', name: 'HOMING SPARK', col: '#ffd23f' },
  { ch: 'd', lab: 'D', name: 'CAVE CRITTER', col: '#a86fd4' },
  { ch: 'R', lab: 'R', name: 'BOULDER SPAWN', col: '#6f5f8c' },
  { ch: 'E', lab: 'E', name: 'ECHO TRIGGER', col: '#b98cff' },
  { ch: '?', lab: '?', name: 'LYING SIGN', col: '#a87c3a' },
  { ch: '*', lab: '*', name: 'SHINY ROCK', col: '#9fd0ff' },
  { ch: 'K', lab: 'K', name: 'CHECKPOINT', col: '#7de3c8' },
  { ch: '@', lab: '@', name: 'SPAWN', col: '#ffe9a8' },
  { ch: 'G', lab: 'G1', name: 'MOTHERSHIP', col: '#ffe9a8' },
  { ch: 'g', lab: 'G2', name: 'DECOY SHIP', col: '#ff8f7a' },
];

/* Only one of these may exist per level, so painting one clears the others. */
const UNIQUE_TOOLS = '@Gg';

const ZONE_CYCLE = [null, 'invert', 'swapkeys', 'lag', 'mirror', 'flip', 'heavy', 'low', 'wind', 'dark', 'strobe'];

const editor = {
  on: false,
  tool: 1,
  camX: 0, camY: 0,
  mx: 0, my: 0,            // mouse in art pixels
  tx: -1, ty: -1,          // hovered tile
  painting: 0,             // 1 paint, 2 erase
  typing: false,
  buf: '',
  status: '',
  statusTimer: 0,
  dirty: false,
};

function editStatus(msg, secs) {
  editor.status = msg;
  editor.statusTimer = secs || 1.6;
}

function openEditor() {
  if (!level) return;
  editor.on = true;
  editor.typing = false;
  editor.camX = cam.x;
  editor.camY = cam.y;
  editor.dirty = false;
  game.mirrorAmt = 0;
  game.darkAmt = 0;
  editStatus('EDITING ' + level.name, 2);
}

function closeEditor() {
  editor.on = false;
  editor.typing = false;
}

/* Rebuild the level from its (edited) source, keeping the editor open. */
function rebuildFromSource(resetPlayer) {
  const src = level.src;
  const stage = level.stage, name = level.name;
  buildLevel(src, stage, name);
  if (resetPlayer) {
    p = makePlayer(level.spawn);
    particles = [];
    inputLog = [];
  }
}

function setTile(gx, gy, ch) {
  if (gx < 0 || gy < 0 || gx >= level.cols || gy >= CH) return false;
  const rows = level.src.rows;
  if (rows[gy][gx] === ch) return false;

  /* spawn, goal and decoy are one-per-level */
  if (ch !== ' ' && UNIQUE_TOOLS.includes(ch)) {
    for (let y = 0; y < CH; y++) {
      const idx = rows[y].indexOf(ch);
      if (idx >= 0) rows[y] = rows[y].slice(0, idx) + ' ' + rows[y].slice(idx + 1);
    }
  }
  if (rows[gy][gx] === '?' && ch !== '?' && level.src.signs) {
    delete level.src.signs[gx + ',' + gy];
  }
  rows[gy] = rows[gy].slice(0, gx) + ch + rows[gy].slice(gx + 1);
  editor.dirty = true;
  return true;
}

/* Cycles the whole-room effect for the 16-tile room under the cursor. */
function cycleRoomZone(gx) {
  const room = Math.floor(gx / CW);
  const zones = level.src.zones;
  let at = -1;
  for (let i = 0; i < zones.length; i++) {
    const [, zx, , zw] = zones[i];
    if (zx === room * CW && zw === CW) { at = i; break; }
  }
  const current = at >= 0 ? zones[at][0] : null;
  let next = ZONE_CYCLE[(ZONE_CYCLE.indexOf(current) + 1) % ZONE_CYCLE.length];
  if (at >= 0) zones.splice(at, 1);
  if (next) zones.push([next, room * CW, 0, CW, CH, 1]);
  editor.dirty = true;
  rebuildFromSource(false);
  editStatus('ROOM ' + (room + 1) + ': ' + (next ? ZONE_INFO[next].label : 'NO EFFECT'), 1.6);
}

function signAt(gx, gy) {
  return level.src.rows[gy] && level.src.rows[gy][gx] === '?';
}

function editorPaint(erase) {
  const gx = editor.tx, gy = editor.ty;
  if (gx < 0) return;
  const ch = erase ? ' ' : TOOLS[editor.tool].ch;
  if (setTile(gx, gy, ch)) rebuildFromSource(false);
}

function editorSave() {
  /* A shared level is not a campaign level, so it must never be written over
     one. Saving there copies its code out instead. */
  if (game.userLevel) { publishFromEditor(); return; }
  const ok = saveOverride(level.stage, game.levelIdx, level.src);
  editor.dirty = !ok;
  editStatus(ok ? 'SAVED LEVEL ' + level.name : 'SAVE FAILED - STORAGE BLOCKED', 2);
  sfx(ok ? 'check' : 'die');
}

function editorRevert() {
  if (game.userLevel) {
    level.src = blankUserLevel(Math.max(1, level.cols / CW));
    rebuildFromSource(true);
    editor.dirty = false;
    editStatus('CLEARED TO A BLANK LEVEL', 2);
    sfx('warp');
    return;
  }
  clearOverride(level.stage, game.levelIdx);
  level.src = levelSource(level.stage, game.levelIdx);
  rebuildFromSource(true);
  editor.dirty = false;
  editStatus('REVERTED TO GENERATED LEVEL', 2);
  sfx('warp');
}

function editorTestPlay() {
  closeEditor();
  rebuildFromSource(true);
  cam.x = clamp(p.x - viewW / 2, 0, Math.max(0, level.w - viewW));
  cam.y = clamp(p.y - viewH / 2, 0, Math.max(0, level.h - viewH));
  clearHeldKeys();
  toast('TESTING ' + level.name, 1.2);
}

/* ---- editor input ---- */

function pointerArt(e) {
  const r = cv.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width * BW,
    y: (e.clientY - r.top) / r.height * BH,
  };
}

function updateHover() {
  const wx = (editor.mx + Math.round(editor.camX / WPB)) * WPB;
  const wy = (editor.my + Math.round(editor.camY / WPB)) * WPB;
  const gx = Math.floor(wx / TS), gy = Math.floor(wy / TS);
  editor.tx = (gx >= 0 && gx < level.cols && gy >= 0 && gy < CH) ? gx : -1;
  editor.ty = gy;
}

cv.addEventListener('contextmenu', e => { if (editor.on || lab.on) e.preventDefault(); });

/* Which lab widget, if any, is under a point. */
function labHit(a) {
  const g = { x: LAB.gridX, y: LAB.gridY, w: SKIN_W * LAB.cell, h: SKIN_H * LAB.cell };
  if (a.x >= g.x && a.x < g.x + g.w && a.y >= g.y && a.y < g.y + g.h) {
    return { what: 'grid', x: Math.floor((a.x - g.x) / LAB.cell), y: Math.floor((a.y - g.y) / LAB.cell) };
  }
  const pw = LAB.palCols * LAB.palCell;
  const ph = Math.ceil(SKIN_PALETTE.length / LAB.palCols) * LAB.palCell;
  if (a.x >= LAB.palX && a.x < LAB.palX + pw && a.y >= LAB.palY && a.y < LAB.palY + ph) {
    const i = Math.floor((a.y - LAB.palY) / LAB.palCell) * LAB.palCols
            + Math.floor((a.x - LAB.palX) / LAB.palCell);
    if (i >= 0 && i < SKIN_PALETTE.length) return { what: 'pal', i };
  }
  if (a.y >= LAB.slotY && a.y < LAB.slotY + 26) {
    const i = Math.floor((a.x - LAB.slotX) / 26);
    if (i >= 0 && i < 4 && a.x >= LAB.slotX) return { what: 'slot', i };
  }
  return null;
}

cv.addEventListener('pointerdown', e => {
  audio();

  if (lab.on) {
    const hit = labHit(pointerArt(e));
    if (!hit) return;
    if (hit.what === 'grid') {
      lab.cx = hit.x; lab.cy = hit.y;
      lab.painting = e.button === 2 ? 2 : 1;
      labSetPixel(hit.x, hit.y, lab.painting === 2 ? '.' : lab.col);
      cv.setPointerCapture(e.pointerId);
    } else if (hit.what === 'pal') {
      lab.col = SKIN_PALETTE[hit.i];
      sfx('pickup');
    } else if (hit.what === 'slot') {
      labSelectSlot(hit.i);
    }
    return;
  }

  if (!editor.on || !level) return;
  const a = pointerArt(e);
  editor.mx = a.x; editor.my = a.y;
  updateHover();
  if (a.y > BH - 16) {                      // clicked the palette bar
    const i = Math.floor(a.x / 13);
    if (i >= 0 && i < TOOLS.length) { editor.tool = i; sfx('pickup'); }
    return;
  }
  editor.painting = e.button === 2 ? 2 : 1;
  editorPaint(editor.painting === 2);
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', e => {
  if (lab.on) {
    if (!lab.painting) return;
    const hit = labHit(pointerArt(e));
    if (hit && hit.what === 'grid') {
      lab.cx = hit.x; lab.cy = hit.y;
      labSetPixel(hit.x, hit.y, lab.painting === 2 ? '.' : lab.col);
    }
    return;
  }
  if (!editor.on || !level) return;
  const a = pointerArt(e);
  editor.mx = a.x; editor.my = a.y;
  const before = editor.tx + ',' + editor.ty;
  updateHover();
  if (editor.painting && before !== editor.tx + ',' + editor.ty) {
    editorPaint(editor.painting === 2);
  }
});

addEventListener('pointerup', () => { editor.painting = 0; lab.painting = 0; });

/* Menu and map navigation, driven by the same inputs as the game so the touch
   buttons work everywhere. */
let menuPrev = { l: false, r: false, j: false, t: false };

function menuStep() {
  const raw = readRaw();
  const hitL = raw.l && !menuPrev.l;
  const hitR = raw.r && !menuPrev.r;
  const hitJ = raw.j && !menuPrev.j;
  menuPrev = raw;

  switch (game.state) {
    case 'splash':
      game.splashT += STEP;
      if (hitJ || game.splashT >= SPLASH_TIME) {
        if (game.charChosen) showTitle(); else showChoose();
        clearHeldKeys();
      }
      break;

    case 'choose':
      if (hitL && game.charIdx > 0) { game.charIdx--; applySkin(); sfx('jump'); }
      if (hitR && game.charIdx < CHARACTERS.length - 1) { game.charIdx++; applySkin(); sfx('jump'); }
      if (hitJ) {
        game.charChosen = true;
        applySkin();
        writeSave();
        sfx('check');
        showTitle();
        clearHeldKeys();
      }
      break;

    case 'title':
      if (hitJ) { sfx('check'); showMap(game.reached.stage); clearHeldKeys(); }
      break;

    case 'map':
      if (hitL) {
        if (game.cursor > 0) { game.cursor--; sfx('jump'); }
        else if (game.stage > 0) { game.stage--; game.cursor = LEVELS_PER_STAGE - 1; game.markerAt = game.cursor; sfx('warp'); }
      }
      if (hitR) {
        if (game.cursor < LEVELS_PER_STAGE - 1 && isUnlocked(game.stage, game.cursor + 1)) {
          game.cursor++; sfx('jump');
        } else if (game.cursor === LEVELS_PER_STAGE - 1 && game.stage < STAGE_COUNT - 1 && isUnlocked(game.stage + 1, 0)) {
          game.stage++; game.cursor = 0; game.markerAt = 0; sfx('warp');
        }
      }
      if (hitJ && isUnlocked(game.stage, game.cursor)) {
        sfx('check');
        startLevel(game.stage, game.cursor);
      }
      break;

    case 'board': {
      if (hitL) boardMove(-1, 0);
      if (hitR) boardMove(1, 0);
      if (hitJ) {
        const n = BOARD[game.boardCursor];
        if (buySkill(n)) {
          sfx('check');
          toast(n.name + ' INSTALLED', 1.4);
        } else {
          sfx('thud');
        }
      }
      break;
    }

    case 'clear':
      if (hitJ) { sfx('check'); leaveClearScreen(); clearHeldKeys(); }
      break;

    case 'finale':
      if (hitJ) { sfx('check'); game.credits = null; showTitle(); clearHeldKeys(); }
      break;
  }
}

function editorStep() {
  if (editor.statusTimer > 0) editor.statusTimer -= STEP;
  if (editor.typing) return;
  const raw = readRaw();
  const speed = 6;
  if (raw.l) editor.camX -= speed;
  if (raw.r) editor.camX += speed;
  if (raw.j) editor.camY -= speed;
  if (raw.t) editor.camY += speed;
  editor.camX = clamp(editor.camX, 0, Math.max(0, level.w - viewW));
  editor.camY = clamp(editor.camY, 0, Math.max(0, level.h - viewH));
  updateHover();
}

function step() {
  game.time += STEP;
  game.frame++;

  if (lab.on) { if (lab.statusTimer > 0) lab.statusTimer -= STEP; return; }
  if (editor.on) { editorStep(); return; }
  if (game.state !== 'play') { menuStep(); return; }

  if (p.dead) {
    p.deadTimer -= STEP;
    if (p.deadTimer <= 0) respawn(false);
    updateParticles();
    return;
  }

  if (p.winTimer > 0) {
    p.winTimer -= STEP;
    p.vy += CFG.grav * 0.2;
    burstTrail();
    updateParticles();
    if (p.winTimer <= 0) levelCleared();
    return;
  }

  updatePlayer();
  updateEnts();
  updateParticles();
  tickHud();
}

function burstTrail() {
  if (game.frame % 3 === 0) {
    burst(p.x + p.w / 2, p.y + p.h / 2, 3, '#ffe9a8');
  }
}

let last = performance.now(), acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;         // tab was hidden; don't fast-forward
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 6) { step(); acc -= STEP; }
  draw();
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------------- utils */

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* ----------------------------------------------------------------------- boot */

/* ---- shared-level entry points ------------------------------------------
   The game can start three ways: normally, straight into a level someone sent
   you (?code=<code>), or into the editor on a blank canvas (?maker=1). P in the
   editor copies the level's code out so it can be handed to someone else. */

function startUserLevel(src, name, meta) {
  game.stage = 0;
  game.levelIdx = 0;
  game.userLevel = Object.assign({ name: name || 'POSTED LEVEL' }, meta || {});
  game.state = 'play';
  game.time = 0;
  game.runDeaths = 0;
  game.mirrorAmt = 0;
  game.darkAmt = 0;
  game.fade = 1;
  buildLevel(src, 0, name || 'POSTED');
  p = makePlayer(level.spawn);
  particles = [];
  inputLog = [];
  cam.x = clamp(p.x - viewW / 2, 0, Math.max(0, level.w - viewW));
  cam.y = clamp(p.y - viewH / 2, 0, Math.max(0, level.h - viewH));
  clearHeldKeys();
  toast(name || 'POSTED LEVEL', 1.8);
}

function publishFromEditor() {
  const code = encodeLevelCode(level.src, level.name);

  /* Announce it locally too, so anything hosting this build can pick it up
     without caring whether it is in an iframe. */
  try {
    window.dispatchEvent(new CustomEvent('tbs-publish', { detail: { code, name: level.name } }));
  } catch (_) { /* very old browsers */ }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'tbs-publish', code, name: level.name }, '*');
    editStatus('SENT TO THE HOST PAGE', 2);
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(
      () => editStatus('LEVEL CODE COPIED', 2),
      () => editStatus('COPY BLOCKED BY BROWSER', 2));
  } else {
    editStatus('NOWHERE TO PUBLISH TO', 2);
  }
  sfx('check');
}

loadSave();
loadOverrides();
loadSkins();

const bootParams = new URLSearchParams(location.search);
if (bootParams.get('maker') === '1') {
  const seed = bootParams.get('code');
  const decoded = seed ? decodeLevelCode(seed) : null;
  startUserLevel(decoded ? decoded.src : blankUserLevel(6),
    decoded ? decoded.name : 'MY LEVEL', { maker: true });
  openEditor();
} else if (bootParams.get('code')) {
  const decoded = decodeLevelCode(bootParams.get('code'));
  if (decoded) startUserLevel(decoded.src, decoded.name, { posted: true, id: bootParams.get('id') });
  else showSplash();
} else {
  showSplash();                    // studio plate first, then the title
}
requestAnimationFrame(frame);

})();
