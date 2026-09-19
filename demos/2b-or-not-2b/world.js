/* The classroom, at pencil scale.
 *
 * One continuous level, ninety units tall, from the lino to the groove at the
 * top of the desk. Nothing here is decoration for its own sake: if a thing is
 * in the room it is either something to stand on, something to stab, something
 * that hurts, or something far enough away to be scenery.
 *
 * Everything is a box with its footprint centred on (x, z) and its underside
 * sitting at y, because that is how you actually place furniture — "put it
 * here, this big, standing on that". Collision uses the same boxes the
 * renderer draws, so what you can see is exactly what you can land on.
 *
 * The kinds a box can be:
 *
 *   solid   ordinary. Stand on it, bump into it.
 *   stab    soft enough to take a pencil tip — cork, vinyl, chewing gum,
 *           chipboard. This is what you can cling to and jump off.
 *   bounce  erasers and rubber bands. Land on one and you go up.
 *   slick   glossy covers. Almost no friction; you will overshoot.
 *   sticky  glue and old juice. Halves your speed while you are in it.
 *   wind    not solid at all. A box-shaped shove, for the fan.
 *   deco    drawn, never touched.
 *
 * There is deliberately no kind that kills you. Falling is the punishment in
 * this game and falling is not a death: you land on the lino, entirely fine,
 * ninety units below where you were, and that is worse.
 *
 * Crumbs of graphite are laid along the intended route as you go, so the line
 * of them is the level's own tutorial: follow the crumbs and you are climbing.
 */
const World = (() => {
'use strict';

/* ---------------------------------------------------------------- palette */
const C = {
  lino: 0x9aa08c, linoAlt: 0x8f9682, grout: 0x777d6b,
  wall: 0xded7c4, wallLow: 0xb9c3ae, ceiling: 0xefeade,
  board: 0xf4f6f2, window: 0xbfe3f2, frame: 0xe8e8e4,
  wood: 0xc59355, woodDark: 0x9a6c38, woodEdge: 0xd9ad72,
  metal: 0xb6bcc6, metalDark: 0x8d949f, screw: 0x9aa3ae,
  chair: 0x2f7fb5, chairDark: 0x24638d,
  bag: 0x2f5fa8, bagDark: 0x21467c, strap: 0x1b3a68, buckle: 0x39404b,
  paper: 0xf3f0e6, paperEdge: 0xe0dbcb, ruled: 0xd8e3ee,
  eraser: 0xf58ea8, eraserWorn: 0xe2748f,
  gum: 0x8fbf6f, gumOld: 0x76a459,
  cork: 0xc79a5f, vinyl: 0x2a6d9c, chip: 0xa9865c,
  glue: 0xe8f0e2, ink: 0x2c3e70,
  bookA: 0xc0392b, bookB: 0x27ae60, bookC: 0x2f6fb5, bookD: 0xe8b62c,
  bookE: 0x8e44ad, bookF: 0xd35400,
  clip: 0xc9d1da, band: 0xd9835f, shaving: 0xe4c98a,
  bin: 0x3f4a58, lunch: 0x4fbfa8, mug: 0xdd6b5a,
  star: 0xffd54a, crumb: 0x4a4f5c, sharpener: 0xd0d6de,
};

/* -------------------------------------------------------------- the sheet */
/* Everything the builder produces lands in these. */
let shapes, crumbs, stars, checkpoints, movers, goal, spawn;

/* x, z are the centre of the footprint; y is the underside. */
function box(x, y, z, w, h, d, col, kind, extra) {
  const s = {
    x0: x - w / 2, x1: x + w / 2,
    y0: y,         y1: y + h,
    z0: z - d / 2, z1: z + d / 2,
    col, kind: kind || 'solid',
  };
  if (extra) Object.assign(s, extra);
  shapes.push(s);
  return s;
}

/* A sloped top. Ramps are their own collider: inside the footprint the floor
   height is a straight line, which is all a leaning ruler needs to be. */
function ramp(x, y, z, w, h, d, rise, axis, col, flip) {
  const s = {
    x0: x - w / 2, x1: x + w / 2,
    y0: y,         y1: y + h + rise,
    z0: z - d / 2, z1: z + d / 2,
    col, kind: 'ramp', top: y + h, rise, axis, flip: !!flip,
  };
  shapes.push(s);
  return s;
}

function crumb(x, y, z) { crumbs.push({ x, y, z }); }
function star(x, y, z, name) { stars.push({ x, y, z, name, got: false }); }

/* A sharpener marks a checkpoint, and the checkpoint is the patch of floor you
   stand on — so the object itself is set a little to one side. Put it on the
   spot and the pencil disappears inside it, which is how the first version
   looked. `ox`/`oz` say which side there is room on. */
function sharpener(x, y, z, zone, name, ox, oz) {
  checkpoints.push({ x, y, z, zone, name, i: checkpoints.length });
  const px = x + (ox === undefined ? 3.2 : ox), pz = z + (oz || 0);
  box(px, y, pz, 4.4, 2.2, 3.2, C.sharpener, 'deco');
  box(px, y + 2.2, pz, 3.6, 0.4, 2.6, 0xeef2f6, 'deco');
  box(px + 0.5, y + 1.3, pz, 2.8, 0.4, 1.3, 0x717985, 'deco');
  box(px - 2.2, y, pz, 0.7, 2.2, 3.2, 0x949ca6, 'deco');
}

/* A platform with a crumb hanging over it. Used for anything on the route, so
   the trail of graphite and the trail of footholds are the same list. */
function step(x, y, z, w, d, col, kind) {
  box(x, y, z, w, 1.2, d, col, kind);
  crumb(x, y + 2.4, z);
}

/* Platforms winding around a leg as they climb. The angle between two of them
   times the radius is a jump, so both numbers are chosen against how far a
   pencil can actually go: about six across and three up, from a standstill
   rather less. */
function spiral(cx, cz, radius, y0, y1, n, col, turn, sweep) {
  const t0 = turn || 0, da = sweep || 1.15;
  for (let i = 0; i < n; i++) {
    const a = t0 + i * da;
    const y = y0 + (y1 - y0) * (i / (n - 1 || 1));
    step(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius, 5.5, 5.5, col);
  }
}

/* ================================================================== build */

function build() {
  shapes = []; crumbs = []; stars = []; checkpoints = []; movers = [];

  room();
  lino();
  backpack();
  chair();
  backrest();
  deskFrame();
  underside();
  drawer();
  desktop();
  scenery();

  return { shapes, crumbs, stars, checkpoints, movers, goal, spawn, zones: ZONES };
}

/* ------------------------------------------------------------------ room */
/* A shell big enough that the walls are fog, and a floor you cannot fall off.
   The room is 200 across; the desk sits in the middle of it. */

function room() {
  spawn = { x: -44, y: 0.2, z: 52, yaw: -0.6 };

  // Lino, in tiles, because a floor of one flat colour at this scale looks
  // like nothing at all and you lose all sense of speed.
  for (let ix = -5; ix <= 5; ix++) {
    for (let iz = -5; iz <= 5; iz++) {
      const alt = (ix + iz) & 1;
      box(ix * 20, -2, iz * 20, 19.4, 2, 19.4, alt ? C.lino : C.linoAlt, 'solid');
    }
  }
  box(0, -3.2, 0, 240, 1.4, 240, C.grout, 'solid');

  // Walls, and the strip of darker paint schools put along the bottom.
  const W2 = 110;
  box(0, 0, -W2, 240, 150, 6, C.wall, 'solid');
  box(0, 0, W2, 240, 150, 6, C.wall, 'solid');
  box(-W2, 0, 0, 6, 150, 240, C.wall, 'solid');
  box(W2, 0, 0, 6, 150, 240, C.wall, 'solid');
  box(0, 0, -W2 + 3.2, 240, 26, 1, C.wallLow, 'deco');
  box(-W2 + 3.2, 0, 0, 1, 26, 240, C.wallLow, 'deco');
  box(0, 150, 0, 240, 4, 240, C.ceiling, 'deco');

  // Windows down one wall, and the light coming through them.
  for (let i = -1; i <= 1; i++) {
    box(-W2 + 3.4, 34, i * 62, 1.2, 70, 44, C.window, 'deco');
    box(-W2 + 4.2, 34, i * 62, 1, 70, 46, C.frame, 'deco');
    box(-W2 + 4.2, 68, i * 62, 1, 2, 46, C.frame, 'deco');
    box(-W2 + 4.2, 34, i * 62 - 23, 1, 70, 2, C.frame, 'deco');
    box(-W2 + 4.2, 34, i * 62 + 23, 1, 70, 2, C.frame, 'deco');
  }

  // A whiteboard, a clock, strip lights: the classroom, told in four boxes.
  box(0, 40, W2 - 3.4, 130, 56, 1.2, C.board, 'deco');
  box(0, 38, W2 - 4.2, 134, 4, 1, C.frame, 'deco');
  box(60, 84, W2 - 3.6, 16, 16, 1.2, C.frame, 'deco');
  box(60, 84, W2 - 4.4, 12, 12, 1, C.paper, 'deco');
  for (let i = -1; i <= 1; i++) box(i * 60, 142, 0, 10, 2, 90, 0xfdf6d8, 'deco');
}

/* ------------------------------------------------------------------ lino */
/* Where you land, and the only part of the game that is flat. The route out
   is a dropped ruler leaning on a stack of readers. */

function lino() {
  sharpener(-44, 0, 52, 0, 'Where you landed');

  // Bits and pieces that fell with you.
  box(-38, 0, 58, 9, 1.6, 3.4, C.eraser, 'bounce');
  box(-52, 0, 44, 3, 1.4, 9, C.eraser, 'bounce');
  box(-30, 0, 46, 2.2, 2.2, 2.2, C.paper, 'solid');
  box(-33, 0, 40, 3.2, 3, 3.2, C.paper, 'solid');
  box(-24, 0, 56, 2.6, 2.6, 2.6, C.paper, 'solid');
  crumb(-38, 2.6, 58); crumb(-30, 3.6, 46);

  // A biro, lying where it rolled. Round, so you slip off the top.
  box(-20, 0, 62, 26, 2.2, 2.2, 0x2c6cc4, 'slick');
  box(-8, 0, 62, 4, 1.8, 1.8, C.metal, 'slick');
  crumb(-20, 4.2, 62);

  // Somebody's glue stick, uncapped, going off in a puddle.
  box(-14, 0, 34, 14, 0.5, 12, C.glue, 'sticky');
  box(-10, 0, 30, 3.2, 6, 3.2, 0xe0e6ea, 'solid');

  // The ruler: the way up. Leaning off the floor onto the readers.
  ramp(-50, 0, 47, 7, 0.8, 14, 3.2, 'z', 0xf0e3b8, true);
  crumb(-50, 3, 50); crumb(-50, 5.4, 43);

  // Three readers, stacked and slid off each other, going up to the bag.
  box(-50, 0, 35, 20, 4, 8, C.bookA, 'solid');
  box(-48, 4, 33, 19, 2.6, 8, C.bookC, 'solid');
  box(-49, 6.6, 35, 17, 2.6, 8, C.bookD, 'solid');
  crumb(-50, 6.4, 35); crumb(-48, 9, 33); crumb(-49, 11.6, 35);
  star(-58, 5.6, 33, 'Down the side of the readers');

  // The bin, off to one side. Nothing up there — but you can get in it.
  box(46, 0, -34, 22, 26, 22, C.bin, 'solid');
  box(46, 25, -34, 19, 2, 19, 0x2a323d, 'solid');
  box(46, 5, -34, 15, 1, 15, 0x1a2029, 'solid', { tag: 'bin' });
  box(46, 6, -34, 12, 3, 12, C.paper, 'solid');
  star(46, 9, -34, 'In the bin, obviously');
}

/* -------------------------------------------------------------- backpack */
/* Slumped against the desk on its left. The straps are the ladder and the
   half-open pocket is a room you can stand inside. */

function backpack() {
  const bx = -46, bz = 12;
  const face = 26.5;        // the side of the bag you climb, in front of it

  box(bx, 0, bz, 30, 26, 26, C.bag, 'solid');                  // the bag
  box(bx, 26, bz - 1, 27, 2, 21, C.bagDark, 'solid');          // the flap, top 28
  box(bx, 0, face - 0.5, 22, 10, 5, C.bagDark, 'solid');       // the front pocket
  box(bx, 10, face + 1, 23, 1.4, 4, C.strap, 'solid');         // and its lip
  crumb(bx, 14, face + 1);

  // Zip teeth across the top of the pocket. Just a line of small metal.
  for (let i = 0; i < 6; i++) {
    box(bx - 10 + i * 4, 10.4, face + 2.6, 2.6, 1, 1.2, C.metal, 'deco');
  }

  // Cork down the face of the bag, between the straps: the first thing in the
  // game you can put your tip into, and entirely optional, which is the point
  // — you meet the stab somewhere it cannot cost you anything.
  box(bx, 11.4, face - 1.6, 26, 15, 1.2, C.cork, 'stab');

  // The straps, hanging down the face in a zig-zag. This is the ladder, and
  // the rungs are spaced by what a standing jump can do, not by the look of it.
  const rungs = [[-50, 13.2], [-42, 15.6], [-50, 18], [-42, 20.4], [-50, 22.8], [-46, 25.4]];
  for (const [rx, ry] of rungs) {
    box(rx, ry, face + 0.5, 8, 1.2, 4, C.strap, 'solid');
    crumb(rx, ry + 3, face + 0.5);
  }
  box(-41, 21.6, face + 0.5, 3.4, 1.6, 3.4, C.buckle, 'solid');
  star(-58, 18.2, face + 1, 'Off the end of a strap');

  sharpener(bx, 28, bz - 1, 1, 'On top of the bag');
  crumb(bx, 31, bz - 1);

  // A term's worth of exercise books between the bag and the chair, each one
  // slid a little off the one below. The overhang is the staircase.
  const covers = [C.bookB, C.bookE, C.bookF, C.bookC];
  for (let i = 0; i < 12; i++) {
    const off = i % 2 ? 3 : -3;
    box(-20 + off, i * 2.6, 24 + ((i % 3) - 1) * 1.6, 15, 2.6, 13, covers[i % 4], 'solid');
    if (i % 2 === 0) crumb(-20 + off * 2.2, i * 2.6 + 4, 24);
  }
}

/* ----------------------------------------------------------------- chair */
/* Tucked in at the back edge of the desk. Metal legs with a spiral of
   crossbars, and a plastic seat with a jumper left on it. */

const CHAIR = { x: 0, zf: 5.5, zb: 23, lx: 11.5, seat: 50 };

function chair() {
  const { zf, zb, lx, seat } = CHAIR;

  for (const sx of [-1, 1]) {
    for (const cz of [zf, zb]) {
      box(sx * lx, 0, cz, 3, seat, 3, C.metal, 'solid');
      box(sx * lx, 0, cz, 4.4, 1.4, 4.4, C.metalDark, 'solid');   // foot
    }
    box(sx * lx, 15, (zf + zb) / 2, 2.4, 2.4, zb - zf, C.metalDark, 'solid');
  }
  box(0, 15, zf, lx * 2, 2.4, 2.4, C.metalDark, 'solid');
  box(0, 30, zb, lx * 2, 2.4, 2.4, C.metalDark, 'solid');
  crumb(-13, 18, zf + 4); crumb(0, 17.6, zf);

  // Round the back leg, a crossbar at a time, up to the seat.
  spiral(-lx, zb, 4.6, 33, 46.5, 9, C.metalDark, 0.4);

  box(0, seat - 2, 14, 30, 2, 26, C.chair, 'solid');
  box(0, seat - 4.4, 14, 26, 2.4, 22, C.chairDark, 'solid');
  crumb(0, seat + 2.4, 14);

  // Somebody's jumper, left on the seat. Solid: a trampoline here would fight
  // the chimney above it, and you want to start that climb from a firm foot.
  box(-4, seat, 18, 16, 3, 12, 0x8e3b4e, 'solid');
  box(2, seat + 2, 22, 10, 3, 8, 0x9c465a, 'solid');
  box(4, 46, 26.5, 7, 3, 6, 0x8e3b4e, 'solid');            // a sleeve, hanging
  box(6, 40, 26.5, 5, 8, 4, 0x8e3b4e, 'stab');

  sharpener(-8, seat, 10, 2, 'On the seat');
  star(11, seat + 1, 4, 'On the corner of the seat');
}

/* -------------------------------------------------------------- backrest */
/* Twenty-six units of vertical with no floor in it, and the reason the stab
   exists. Four vinyl slats with five-unit gaps between them: too wide to
   straddle, near enough to kick across. You go up the gaps, not the slats.
   Nothing else in the game is climbed this way, so the whole zone is one
   lesson taught at length. */

function backrest() {
  const { seat } = CHAIR;
  const z = 24.5;

  for (const sx of [-12, -4, 4, 12]) {
    box(sx, seat, z, 3, 26, 3.6, C.vinyl, 'stab');
    box(sx, seat, z + 1.9, 2.4, 26, 0.6, C.chairDark, 'deco');
  }
  for (const sx of [-1, 1]) box(sx * 15, seat, z, 3, 30, 3.6, C.metal, 'solid');

  // Screw heads sticking out of the frame: a rest, halfway up, on each side.
  step(-15, seat + 9, z - 3.2, 4.5, 4.5, C.screw);
  step(15, seat + 17, z - 3.2, 4.5, 4.5, C.screw);
  star(-15, seat + 12, z - 3.2, 'Wedged behind the backrest');

  // The top rail is set back behind the slats on purpose. A rail sitting over
  // the chimney would be a lid on it: you kick up the gap, and the last kick
  // has to have somewhere to land, so the front of the slat tops is left open
  // and the rail is the step above that.
  box(0, seat + 26, z + 2.5, 34, 2.4, 3.4, C.chair, 'solid');
  crumb(0, seat + 29.5, z + 2.5);
  sharpener(0, seat + 28.4, z + 2.5, 3, 'On the top rail');
}

/* ------------------------------------------------------------ desk frame */
/* The desk itself: top at ninety, four legs, and a square of rails underneath
   that is the whole of the next zone. */

const DESK = { hw: 22, hd: 14, top: 86, thick: 4, legX: 19, legZ: 11, rail: 74 };

function deskFrame() {
  const { hw, hd, top, thick, legX, legZ, rail } = DESK;

  box(0, top, 0, hw * 2, thick, hd * 2, C.wood, 'solid');
  box(0, top + thick, 0, hw * 2 + 1, 0.4, hd * 2 + 1, C.woodEdge, 'deco');
  box(0, top - 0.6, 0, hw * 2 - 1, 0.6, hd * 2 - 1, C.woodDark, 'deco');

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(sx * legX, 0, sz * legZ, 3.4, top, 3.4, C.woodDark, 'solid');
    box(sx * legX, 0, sz * legZ, 4.6, 1.2, 4.6, C.metalDark, 'solid');
    // Somebody has been putting gum on the desk legs for years.
    box(sx * (legX - 2.1), 24, sz * legZ, 1, 40, 3, C.gum, 'stab');
  }
  // The rails: a square track under the top, four units below it.
  for (const sz of [-1, 1]) box(0, rail, sz * legZ, legX * 2, 4, 4.6, C.woodDark, 'solid');
  for (const sx of [-1, 1]) box(sx * legX, rail, 0, 4.6, 4, legZ * 2, C.woodDark, 'solid');
}

/* -------------------------------------------------------- under the desk */
/* Upside-down country. Gum on the underside, a cable to walk, and a fan on the
   floor eighty units below that can still push you off. */

function underside() {
  const { legX, legZ, rail, top } = DESK;

  // Getting on: a marker pen left lying from the back of the chair to the
  // desk rail, which is the only thing joining the two.
  box(0, rail + 3.8, legZ + 5, 3.2, 2.4, 12, 0x2f3b8c, 'solid');
  box(0, rail + 3.8, legZ + 11.6, 2.6, 2, 2.4, 0x8f9aa8, 'solid');
  crumb(0, rail + 7.4, legZ + 8);
  crumb(0, rail + 7.4, legZ + 2);

  // Gum wads on the underside, hanging down far enough to stab.
  const wads = [[-12, 8], [-4, 2], [6, -4], [13, 3], [4, 8], [-9, -6]];
  for (const [wx, wz] of wads) {
    box(wx, top - 3.2, wz, 4.6, 3.2, 4.6, C.gumOld, 'stab');
    crumb(wx, top - 4.6, wz);
  }

  // A cable, taped up under the desk and sagging between the legs. It hangs a
  // few units in from the front rail rather than over it: a tightrope you
  // choose to get on, not a thing you bang your head on while walking.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const cx = -legX + t * legX * 2;
    box(cx, rail + 5.6 - Math.sin(t * Math.PI) * 3.2, -legZ + 6, 7, 1.4, 1.4, 0x333a44, 'solid');
  }
  star(0, rail + 4.2, -legZ + 6, 'Balanced on the cable');

  // The fan, down on the floor, aimed under the desk. It cannot reach you on
  // the rails — but the moment you are out over the gap, it can.
  box(52, 0, 22, 4, 20, 14, C.metalDark, 'solid');
  box(52, 18, 22, 20, 20, 6, C.metal, 'solid');
  box(52, 18, 22, 17, 17, 3, 0x39414d, 'deco');
  // It stops well below the desktop on purpose: under the desk it is the
  // hazard, and up on top it would just be unfair.
  // It blows in gusts rather than steadily. A constant shove makes the east
  // rail a coin toss; a gust with a lull in it makes the same rail a thing you
  // time, and the dust blowing through shows you the rhythm. The west side of
  // the square is out of its reach, so this is a shortcut, not a toll.
  box(28, 58, 7, 44, 24, 26, 0, 'wind',
    { push: [-1, 0.14, -0.5], strength: 12, period: 4.6, phase: 1.2 });

  sharpener(-legX + 3, rail + 4, -legZ, 4, 'On the front rail', 4.5);
}

/* ---------------------------------------------------------------- drawer */
/* Pulled halfway out and never shut. Inside it is the only interior in the
   game: a floor, four walls, and the tat that lives in a school drawer. */

const DRAWER = { z: -18.3, hw: 15, front: -24, floor: 78, wall: 86 };

function drawer() {
  const { z, hw, front, floor, wall } = DRAWER;
  const back = -12.6;    // far enough in to meet the desk's front rail
  const depth = back - front;

  box(0, floor - 1.4, z, hw * 2, 1.4, depth, C.chip, 'solid');
  for (const sx of [-1, 1]) box(sx * hw, floor - 1.4, z, 1.6, wall - floor + 1.4, depth, C.chip, 'stab');
  box(0, floor - 1.4, front + 1, hw * 2, 10, 2, C.chip, 'stab');
  box(0, floor - 1.4, front - 0.4, hw * 2 + 3, 12, 1.6, C.wood, 'solid');   // the face
  box(0, floor + 10.6, front - 0.4, 8, 1.6, 3.2, C.metalDark, 'solid');     // the handle
  crumb(0, floor + 13, front - 0.4);

  // What is in the drawer.
  box(-9, floor, z + 2, 12, 1.6, 8, C.bookD, 'solid');
  box(9, floor, z - 3, 10, 2.4, 7, C.eraserWorn, 'bounce');
  box(2, floor, z + 4, 6, 0.6, 6, C.shaving, 'solid');
  for (let i = 0; i < 4; i++) box(-6 + i * 4, floor + 0.4, z - 4, 1, 0.5, 5, C.clip, 'solid');

  // Paperclips bridged across the drawer, and rubber bands strung tight
  // enough to throw you at the handle.
  step(-10, floor + 3, z - 1, 7, 3, C.clip);
  box(0, floor + 4.6, z - 1, 9, 0.8, 6, C.band, 'bounce');
  crumb(0, floor + 7, z - 1);
  step(10, floor + 6, z + 1, 7, 4, C.clip);
  step(3, floor + 8.2, z - 2, 6, 3, C.clip);

  star(-12, floor + 1, z + 5, 'At the back of the drawer');
  sharpener(-6, floor + 1.6, z + 2, 5, 'In the drawer', -4);

  // Out is up the inside of the drawer face — chipboard takes a tip — onto the
  // top edge of it, and then along a biro somebody left lying across the gap.
  box(0, floor + 9.4, -18.6, 2.4, 2.2, 9.2, 0x2c6cc4, 'slick');
  box(0, floor + 9.4, -23.4, 2, 1.8, 2.6, C.metal, 'slick');
  crumb(0, floor + 13, -21);
  crumb(0, floor + 13, -16);
}

/* --------------------------------------------------------------- desktop */
/* The last zone, and the only one that is a straight run. Books, a lunchbox,
   a mug of pens, a marble that will not stay still — and the groove. */

function desktop() {
  const { hw, hd, top, thick } = DESK;
  const y = top + thick;                       // 90: the surface itself

  sharpener(0, y, -12, 6, 'On the desk at last');

  // A mug of pens, standing where a mug stands: in the way.
  box(-17, y, -8, 9, 12, 9, C.mug, 'solid');
  box(-17, y + 12, -8, 6.4, 0.6, 6.4, 0x2b2f38, 'solid');
  box(-17, y + 12, -8, 1.6, 14, 1.6, 0x2c6cc4, 'slick');
  box(-15, y + 12, -7, 1.6, 12, 1.6, 0x27ae60, 'slick');
  box(-19, y + 13, -9, 1.4, 11, 1.4, 0xc0392b, 'slick');
  star(-17, y + 14, -8, 'Dropped in with the pens');

  // An exercise book, open, its pages a ramp onto the pile.
  ramp(-6, y, -8, 11, 0.4, 9, 2.6, 'x', C.paper);
  box(-6, y, -8, 11, 0.2, 9, C.ruled, 'deco');
  crumb(-6, y + 3, -8);

  // The pile. The middle one is glossy and will not hold you.
  step(5, y + 2.4, -9, 12, 7, C.bookC);
  step(6, y + 5, -9, 11, 7, C.bookA, 'slick');
  step(6, y + 7.6, -9, 10, 7, C.bookE);
  star(6, y + 10.6, -9, 'On top of the pile');

  // Textbooks standing on their ends, right across the middle of the desk.
  // You cannot climb them and the west end hangs over the edge, so the whole
  // desktop funnels into one crossing: over the lunchbox.
  const spines = [C.bookB, C.bookD, C.bookE, C.bookA, C.bookF, C.bookC, C.bookB];
  for (let i = 0; i < 7; i++) {
    box(-21 + i * 4.6, y, 2, 4.2, 9 + (i % 3) * 1.5, 11, spines[i], 'solid');
  }

  // The lunchbox: the high ground, and the bridge over the books.
  box(16, y, 2, 14, 7, 14, C.lunch, 'solid');
  box(16, y + 7, 2, 15, 1.4, 15, 0x3aa38e, 'solid');
  crumb(16, y + 11, 2);
  crumb(16, y + 11, 7);

  // A marble, rolling back and forth in front of the groove. It does not
  // hurt — it just takes the ground out from under you at the worst moment.
  const marble = box(0, y, 6, 3.6, 3.6, 3.6, 0x6fd3e8, 'solid');
  movers.push({ s: marble, ax: 1, ay: 0, az: 0, amp: 13, period: 4.4, phase: 0 });

  // A ruler, balanced on a rubber, rocking.
  const seesaw = box(10, y + 1.2, 10, 18, 1, 4, 0xf0e3b8, 'solid');
  movers.push({ s: seesaw, ax: 0, ay: 1, az: 0, amp: 2.2, period: 3, phase: 1.1 });
  box(10, y, 10, 3, 1.2, 3, C.eraser, 'solid');
  crumb(10, y + 5, 10);

  // The groove: the channel along the back edge that a pencil belongs in.
  // Painted into it is the outline of one, so that from anywhere on the desk
  // it is obvious that the channel is the point and not just more furniture.
  box(0, y, hd - 5.5, hw * 2 - 6, 1.6, 1.6, C.woodDark, 'solid');
  box(0, y, hd - 1.5, hw * 2 - 6, 1.6, 1.6, C.woodDark, 'solid');
  box(-5, y - 0.1, hd - 3.5, 12, 0.2, 1.7, 0xe8cf8a, 'deco');
  box(2.4, y - 0.1, hd - 3.5, 3, 0.2, 1.4, 0xd8b56a, 'deco');
  box(4.6, y - 0.1, hd - 3.5, 1.6, 0.2, 1, 0x6f6a62, 'deco');
  box(-11.6, y - 0.1, hd - 3.5, 1.4, 0.2, 1.7, 0xe0a0b0, 'deco');
  goal = { x: 0, y: y + 0.5, z: hd - 3.5, r: 2.2 };
  crumb(0, y + 2.4, hd - 3.5);

  // Spilled ink at the far end of the groove, for anyone who goes looking.
  box(-15, y, 11, 9, 0.4, 5, C.ink, 'sticky');
  star(-19, y + 1, 11, 'At the inky end of the groove');
}

/* --------------------------------------------------------------- scenery */
/* Other desks, receding into the fog. Never touched, and cheap: nine boxes
   each and they are only ever seen from a long way off. */

function scenery() {
  for (const [dx, dz] of [[-70, -60], [0, -66], [70, -60], [-72, 62], [72, 64], [0, 78]]) {
    box(dx, 86, dz, 44, 4, 28, C.wood, 'deco');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(dx + sx * 19, 0, dz + sz * 11, 3.4, 86, 3.4, C.woodDark, 'deco');
    }
    box(dx, 48, dz + 20, 28, 2, 24, C.chair, 'deco');
    box(dx, 50, dz + 30, 26, 28, 3, C.chair, 'deco');
  }
}

/* ----------------------------------------------------------------- zones */
/* What the height meter is counting off, and what the game calls where you
   are. A zone starts at its `y` and runs up to the next one. */

const ZONES = [
  { id: 'lino',     name: 'The Lino',        y: -99 },
  { id: 'backpack', name: 'The Backpack',    y: 11 },
  { id: 'chair',    name: 'The Chair',       y: 31 },
  { id: 'backrest', name: 'The Backrest',    y: 52 },
  { id: 'under',    name: 'Under the Desk',  y: 72 },
  { id: 'drawer',   name: 'The Drawer',      y: 78.5 },
  { id: 'desktop',  name: 'The Desktop',     y: 90 },
];

/* Height alone cannot tell the drawer from the rails above it — they are the
   same seventy-eight units up — so that one zone is settled by where you are
   standing rather than how high. */
function zoneAt(y, z) {
  if (y >= 90) return ZONES[6];
  if (y >= 76 && z !== undefined && z < -13) return ZONES[5];
  let out = ZONES[0];
  for (let i = 0; i < 5; i++) if (y >= ZONES[i].y) out = ZONES[i];
  return out;
}

return { build, zoneAt, ZONES, C, DESK, DRAWER, CHAIR };
})();
