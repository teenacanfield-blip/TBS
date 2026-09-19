/* The sticker chart.
 *
 * Forty-two of them. They are not a to-do list bolted on the side — each one
 * is a sentence about a way to play, and between them they describe the whole
 * game: climb it, climb it fast, climb it without the tools, fall off it on
 * purpose, look under things.
 *
 * Every achievement is a predicate over one object, `s`, which the game keeps
 * up to date and hands over once a frame. Nothing in here reaches into the
 * game; nothing in the game reaches in here except to fill in that object.
 * That means a new achievement is one entry in this list and, at most, one new
 * counter in the stats — which is the point.
 *
 * `s` has two halves. The counters that reset with every attempt (run.*) and
 * the ones that never reset (crumbs found, stars found, best time). An
 * achievement that says "in one run" reads run.*, and one that says "ever"
 * reads the top level.
 */
const Achv = (() => {
'use strict';

const STORE = '2b.stickers.v2';

/* id, name, note, and when it lands. `secret` ones stay blanked out on the
   chart until they happen, because half the joke is finding them. */
const LIST = [
  /* ------------------------------------------------------- the climb */
  { id: 'off-the-lino', name: 'Off the Lino', note: 'Get above the floor and onto the bag.',
    when: (s) => s.run.zones.backpack },
  { id: 'bag-summit', name: 'Bag Summit', note: 'Stand on top of the backpack.',
    when: (s) => s.run.zones.chair || s.run.height > 29 },
  { id: 'taking-a-seat', name: 'Taking a Seat', note: 'Reach the chair.',
    when: (s) => s.run.height > 50 },
  { id: 'high-backed', name: 'High-Backed', note: 'Reach the top rail of the backrest.',
    when: (s) => s.run.zones.backrest && s.run.height > 76 },
  { id: 'the-underneath', name: 'The Underneath', note: 'Get up under the desk.',
    when: (s) => s.run.zones.under },
  { id: 'drawer-business', name: 'Drawer Business', note: 'Get inside the drawer.',
    when: (s) => s.run.zones.drawer },
  { id: 'the-desktop', name: 'Surfaced', note: 'Stand on the desk itself.',
    when: (s) => s.run.zones.desktop },
  { id: 'home', name: '2B Home', note: 'Land in the groove. That is the whole game.',
    when: (s) => s.won },

  /* -------------------------------------------------- the way you climb */
  { id: 'point-taken', name: 'Point Taken', note: 'Stab your tip into something soft and hang there.',
    when: (s) => s.stabs >= 1 },
  { id: 'three-point', name: 'Three-Point Turn', note: 'Three wall kicks without touching the ground.',
    when: (s) => s.run.bestChain >= 3 },
  { id: 'six-of-the-best', name: 'Six of the Best', note: 'Six wall kicks in one flight.',
    when: (s) => s.run.bestChain >= 6 },
  { id: 'drawing-a-line', name: 'Drawing a Line', note: 'Dash. Leave a mark on the air.',
    when: (s) => s.dashes >= 1 },
  { id: 'freehand', name: 'Freehand', note: 'Dash, spin and stab without landing in between.',
    when: (s) => s.run.freehand },
  { id: 'hang-time', name: 'Hang Time', note: 'Two and a half seconds off the ground.',
    when: (s) => s.run.bestAir >= 2.5 },
  { id: 'rubber-ball', name: 'Rubber Ball', note: 'Five eraser bounces in a row.',
    when: (s) => s.run.bounceChain >= 5 },
  { id: 'runaway-pencil', name: 'Runaway Pencil', note: 'Hit full tilt on a glossy cover.',
    when: (s) => s.run.slickSpeed >= 15 },
  { id: 'nosedive', name: 'Nosedive', note: 'Come down tip-first from a long way up.',
    when: (s) => s.run.bestDive >= 14 },
  { id: 'pin-drop', name: 'Pin Drop', note: 'Land a dive straight onto an eraser and get thrown.',
    when: (s) => s.diveBounces >= 1 },

  /* -------------------------------------------------------- collecting */
  { id: 'crumb', name: 'Crumb', note: 'Pick up your first flake of graphite.',
    when: (s) => s.crumbs >= 1 },
  { id: 'pocket-lint', name: 'Pocket Lint', note: 'Fifty crumbs, all told.',
    when: (s) => s.crumbs >= 50 },
  { id: 'swept-up', name: 'Swept Up', note: 'Every crumb in the room, in one attempt.',
    when: (s) => s.crumbsTotal > 0 && s.run.crumbs >= s.crumbsTotal },
  { id: 'gold-star', name: 'Gold Star', note: 'Find a star. There are stars.',
    when: (s) => s.stars >= 1 },
  { id: 'merit', name: 'Merit', note: 'Half the stars found.',
    when: (s) => s.starsTotal > 0 && s.stars >= Math.ceil(s.starsTotal / 2) },
  { id: 'star-chart', name: 'Star Chart', note: 'Every star in the classroom.',
    when: (s) => s.starsTotal > 0 && s.stars >= s.starsTotal },
  { id: 'full-marks', name: 'Full Marks', note: 'Finish a run holding every star.',
    when: (s) => s.won && s.starsTotal > 0 && s.run.stars >= s.starsTotal },

  /* ------------------------------------------------------------- speed */
  { id: 'sharp-pace', name: 'Sharp Pace', note: 'Home in under six minutes.',
    when: (s) => s.won && s.run.time <= 360 },
  { id: 'sketchy-speedrun', name: 'Sketchy Speedrun', note: 'Home in under three.',
    when: (s) => s.won && s.run.time <= 180 },
  { id: 'clean-sheet', name: 'Clean Sheet', note: 'Reach the desktop without ever going back to a sharpener.',
    when: (s) => s.run.zones.desktop && s.run.resets === 0 },
  { id: 'blunt-instrument', name: 'Blunt Instrument', note: 'Finish the climb without dashing once.',
    when: (s) => s.won && s.run.dashes === 0 },
  { id: 'featherweight', name: 'Featherweight', note: 'Finish without ever dropping more than twenty units at once.',
    when: (s) => s.won && s.run.bigFall < 20 },
  { id: 'long-way-up', name: 'The Long Way Up', note: 'Every zone in one attempt, no resets.',
    when: (s) => s.run.zoneCount >= 7 && s.run.resets === 0 },

  /* ------------------------------------------------------- the pencil */
  { id: 'blunt', name: 'Blunt', note: 'Wear your tip down to nothing.',
    when: (s) => s.run.sharp <= 0.001 },
  { id: 'twenty-turns', name: 'Twenty Turns', note: 'Use a sharpener twenty times, ever.',
    when: (s) => s.sharpenings >= 20 },
  { id: 'well-rounded', name: 'Well Rounded', note: 'A hundred spins in the air.',
    when: (s) => s.spins >= 100 },
  { id: 'shoe-leather', name: 'Shoe Leather', note: 'Cover a thousand units of classroom on foot.',
    when: (s) => s.walked >= 1000 },

  /* ------------------------------------------------ things you fall in */
  { id: 'in-the-bin', name: 'In the Bin', note: 'End up in the wastepaper basket.', secret: true,
    when: (s) => s.inBin },
  { id: 'mug-shot', name: 'Mug Shot', note: 'Fall into the mug of pens.', secret: true,
    when: (s) => s.inMug },
  { id: 'stuck-in', name: 'Stuck In', note: 'Spend ten seconds in the glue.', secret: true,
    when: (s) => s.glueTime >= 10 },
  { id: 'red-handed', name: 'Ink-Handed', note: 'Walk it through the spilled ink.', secret: true,
    when: (s) => s.inkTime > 0.2 },
  { id: 'rock-bottom', name: 'Rock Bottom', note: 'Fall from the desk all the way to the lino.', secret: true,
    when: (s) => s.run.bigFall >= 84 },
  { id: 'chewed-over', name: 'Chewed Over', note: 'Stab ten different wads of gum. Ten.', secret: true,
    when: (s) => s.gumWads >= 10 },
  { id: 'a-pencil-at-rest', name: 'A Pencil at Rest', note: 'Lie perfectly still for a minute.', secret: true,
    when: (s) => s.run.idle >= 60 },
  { id: 'wind-assisted', name: 'Wind Assisted', note: 'Let the fan carry you somewhere.', secret: true,
    when: (s) => s.run.blown >= 12 },
  { id: 'style-points', name: 'Style Points', note: 'Land in the groove mid-spin.', secret: true,
    when: (s) => s.wonSpinning },
];

/* --------------------------------------------------------------- storage */

let got = {};
try {
  const raw = localStorage.getItem(STORE);
  if (raw) got = JSON.parse(raw) || {};
} catch (e) { got = {}; }

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(got)); } catch (e) { /* private mode */ }
}

/* ----------------------------------------------------------------- stats */
/* The shape the game fills in. Made here so both sides agree on the names,
   and so a fresh run is one call. */

function freshRun() {
  return {
    time: 0, height: 0, resets: 0, dashes: 0, stabs: 0, jumps: 0,
    crumbs: 0, stars: 0, zones: {}, zoneCount: 0,
    chain: 0, bestChain: 0, air: 0, bestAir: 0, bounceChain: 0,
    slickSpeed: 0, bestDive: 0, bigFall: 0, idle: 0, blown: 0,
    sharp: 1, freehand: false,
  };
}

function freshStats(totals) {
  return {
    crumbs: 0, crumbsTotal: totals.crumbs || 0,
    stars: 0, starsTotal: totals.stars || 0,
    dashes: 0, stabs: 0, spins: 0, walked: 0, sharpenings: 0,
    diveBounces: 0, gumWads: 0, glueTime: 0, inkTime: 0,
    inBin: false, inMug: false, won: false, wonSpinning: false,
    run: freshRun(),
  };
}

/* ------------------------------------------------------------- the check */
/* Called once a frame. Cheap: forty-odd predicates over one small object. */

function poll(s) {
  const won = [];
  for (const a of LIST) {
    if (got[a.id]) continue;
    let hit = false;
    try { hit = !!a.when(s); } catch (e) { hit = false; }
    if (hit) {
      got[a.id] = Date.now();
      won.push(a);
    }
  }
  if (won.length) save();
  return won;
}

function progress() {
  let n = 0;
  for (const a of LIST) if (got[a.id]) n++;
  return { got: n, total: LIST.length };
}

function forget() { got = {}; save(); }

return {
  LIST,
  poll, progress, forget, freshStats, freshRun,
  earned: (id) => !!got[id],
  at: (id) => got[id] || 0,
};
})();
