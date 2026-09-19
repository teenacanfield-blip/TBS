/* The Show — the climb, one league at a time.
 *
 * Levels are code, not a file to load. Each one is a short function that talks
 * to a builder: lay a floor here, open a gap there, put a crow on it. That
 * reads better than two hundred columns of ASCII, it cannot go out of sync
 * with itself, and — the real reason — a gap is written as the space between
 * two floors rather than counted out in dots, so a level can be widened
 * without retyping a map.
 *
 * The grid is 16 rows of 16px tiles. Row 12 is where the floor normally sits,
 * which leaves three and a bit tiles of headroom on screen and a storey above
 * that for the levels that climb.
 *
 * Tiles:
 *   .  air            #  earth, with grass on top     X  brick
 *   =  a plank you jump up through                    S  stone, unbreakable
 *   B  a crate of balls, breakable                    ^  a rake, teeth up
 *   W  the outfield wall
 *
 * At the bottom of this file every level is walked over and measured against
 * what the player can actually do — see REACH. A gap nobody can clear is a
 * typing mistake, not a difficulty setting, and it should say so in the
 * console rather than waiting to be found on the fifth league.
 */
const Levels = (() => {

  const H = 16;                 // rows
  const FLOOR = 12;             // the usual height of the ground

  /* What a ballplayer can do, in tiles, taken from the numbers in game.js:
   * a 292px jump against 800px/s² gravity is 53px up, and a 0.73s flight at
   * 104px/s covers 76px. Rounded *down*, because a jump that only works at a
   * dead run is not a jump, it is a trick. */
  const REACH = { gap: 5, rise: 3 };

  function make(def) {
    const W = def.width;
    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill('.'));

    const ents = [];
    const crates = {};          // "x,y" -> what is inside this one

    const put = (x, y, ch) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      grid[y][x] = ch;
    };

    const b = {
      W, H, FLOOR,

      /* Ground from `x` for `w` tiles, with its surface at row `top`. */
      floor(x, w, top) {
        top = top == null ? FLOOR : top;
        for (let i = 0; i < w; i++) for (let y = top; y < H; y++) put(x + i, y, '#');
        return b;
      },

      /* Ground from `x` up to — but not including — `x2`. The gaps are the
       * interesting part, so spans are written by where they end. */
      floorTo(x, x2, top) { return b.floor(x, x2 - x, top); },

      rect(x, y, w, h, ch) {
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) put(x + i, y + j, ch || 'X');
        return b;
      },

      /* A plank: solid from above, thin air from below. */
      plank(x, w, y) { for (let i = 0; i < w; i++) put(x + i, y, '='); return b; },

      /* A staircase of `n` steps, climbing away from `x`. */
      stair(x, y, n, dir) {
        dir = dir || 1;
        for (let i = 0; i < n; i++) {
          const cx = x + i * dir;
          for (let j = y - i; j < H; j++) put(cx, j, '#');
        }
        return b;
      },

      rakes(x, w, y) { for (let i = 0; i < w; i++) put(x + i, y == null ? FLOOR - 1 : y, '^'); return b; },

      /* A crate. `holds` is what comes out when it breaks: a power-up name,
       * 'balls' for a handful of them, or nothing for one ball. */
      crate(x, y, holds) { put(x, y, 'B'); if (holds) crates[x + ',' + y] = holds; return b; },

      /* ------------------------------------------------------------ things */
      coin(x, y) { ents.push({ t: 'coin', x, y }); return b; },
      coins(x, y, n, step) {
        step = step || 1;
        for (let i = 0; i < n; i++) ents.push({ t: 'coin', x: x + i * step, y });
        return b;
      },
      /* Baseballs thrown in an arc over a gap, which is how you tell a player
       * the gap is jumpable without writing it down. */
      arc(x, y, n) {
        for (let i = 0; i < n; i++) {
          const f = n === 1 ? 0 : i / (n - 1);
          ents.push({ t: 'coin', x: x + i, y: y - Math.round(Math.sin(f * Math.PI) * 2.4) });
        }
        return b;
      },
      card(x, y) { ents.push({ t: 'card', x, y }); return b; },
      item(x, y, kind) { ents.push({ t: 'item', x, y, kind }); return b; },
      sign(x, y, lines) { ents.push({ t: 'sign', x, y, lines }); return b; },
      check(x, y) { ents.push({ t: 'check', x, y: y == null ? FLOOR - 1 : y }); return b; },

      crow(x, y) { ents.push({ t: 'crow', x, y: y == null ? FLOOR - 1 : y }); return b; },
      gopher(x, y) { ents.push({ t: 'gopher', x, y: y == null ? FLOOR - 1 : y }); return b; },
      machine(x, y, dir) { ents.push({ t: 'machine', x, y: y == null ? FLOOR - 1 : y, dir: dir || -1 }); return b; },
      slider(x, y, amp) { ents.push({ t: 'slider', x, y, amp: amp || 2 }); return b; },
      rival(x, y) { ents.push({ t: 'rival', x, y: y == null ? FLOOR - 1 : y }); return b; },

      /* A platform that goes somewhere. `ax`/`ay` is the direction, `dist` how
       * far in tiles, `speed` in tiles a second. */
      mover(x, y, w, ax, ay, dist, speed) {
        ents.push({ t: 'mover', x, y, w: w || 3, ax: ax || 0, ay: ay || 0, dist: dist || 4, speed: speed || 2 });
        return b;
      },

      boss(x, y) { ents.push({ t: 'boss', x, y }); return b; },
      start(x, y) { b._start = { x, y: y == null ? FLOOR - 2 : y }; return b; },
      /* `y` is the row the gate stands *on*, not the row it starts at, so a
       * goal is placed the same way a person would place one: on the ground. */
      goal(x, y) { b._goal = { x, y: y == null ? FLOOR : y }; return b; },
    };

    def.build(b);

    return {
      id: def.id, name: def.name, league: def.league, theme: def.theme,
      note: def.note, par: def.par, boss: !!def.bossFight,
      w: W, h: H, grid, ents, crates,
      start: b._start || { x: 2, y: FLOOR - 2 },
      goalAt: b._goal || { x: W - 4, y: FLOOR - 4 },
    };
  }

  /* ==================================================================== 1 */
  /* The first level is a lesson, and it is allowed to be easy. Two-tile gaps,
   * one thing happening at a time, a sign before each new idea, and a crate
   * with a helmet in it before anything that can take a hit off you. */
  const sandlot = {
    id: 'sandlot', name: 'THE SANDLOT', league: 'SANDLOT', theme: 'sandlot',
    note: 'A dirt lot, a taped bat, and a fence nobody has cleared yet.',
    par: 80, width: 168,
    build(b) {
      b.start(3);

      // Flat ground, nothing on it, until you have had a run about.
      b.floorTo(0, 24);
      b.sign(7, b.FLOOR - 3, ['ARROWS OR A D TO RUN', 'SPACE TO JUMP']);
      b.coins(13, b.FLOOR - 3, 4);
      b.crate(20, b.FLOOR - 2);

      // The first gap is two tiles wide. You would have to try to miss it.
      b.arc(24, b.FLOOR - 3, 2);
      b.floorTo(26, 50);
      b.sign(29, b.FLOOR - 3, ['LAND ON A CROW', 'OR SWING WITH J']);
      b.crow(36);
      b.crate(42, b.FLOOR - 2); b.crate(43, b.FLOOR - 2, 'balls'); b.crate(44, b.FLOOR - 2);
      b.check(47);

      b.arc(50, b.FLOOR - 3, 3);
      b.floorTo(53, 74);
      b.crate(56, b.FLOOR - 4, 'helmet');
      b.sign(60, b.FLOOR - 3, ['A HELMET TAKES', 'ONE HIT FOR YOU']);
      b.crow(66);
      b.stair(68, b.FLOOR - 1, 3);
      b.coins(69, b.FLOOR - 6, 3);
      b.card(72, b.FLOOR - 5);

      b.arc(74, b.FLOOR - 4, 3);
      b.floorTo(77, 96, b.FLOOR - 2);
      b.gopher(80, b.FLOOR - 3);
      b.crate(84, b.FLOOR - 4, 'balls');
      b.crow(88, b.FLOOR - 3);
      b.plank(90, 4, b.FLOOR - 6);
      b.coins(91, b.FLOOR - 7, 3);

      b.arc(96, b.FLOOR - 5, 3);
      b.floorTo(99, 120);
      b.check(101);
      b.sign(104, b.FLOOR - 3, ['SWING BREAKS CRATES', 'AND RETIRES RUNNERS']);
      b.crate(108, b.FLOOR - 4); b.crate(109, b.FLOOR - 4, 'bat'); b.crate(110, b.FLOOR - 4);
      b.crow(115);

      b.arc(120, b.FLOOR - 3, 3);
      b.floorTo(123, 140);
      b.gopher(127);
      b.card(131, b.FLOOR - 3);
      b.crow(136);

      b.arc(140, b.FLOOR - 3, 3);
      b.floorTo(143, 168);
      b.coins(146, b.FLOOR - 3, 4);
      b.stair(150, b.FLOOR - 1, 3);
      b.card(154, b.FLOOR - 6);
      b.goal(162);
    },
  };

  /* ==================================================================== 2 */
  const little = {
    id: 'little', name: 'LITTLE LEAGUE', league: 'LITTLE LEAGUE', theme: 'little',
    note: 'Real bases, real bleachers, and the machine that never gets tired.',
    par: 95, width: 180,
    build(b) {
      b.start(3);
      b.floorTo(0, 28);
      b.coins(8, b.FLOOR - 3, 4);
      b.crow(14);
      b.sign(18, b.FLOOR - 3, ['SWING AT A PITCH', 'TO HIT IT BACK']);
      b.machine(24, b.FLOOR - 1, -1);

      b.arc(28, b.FLOOR - 3, 3);
      b.floorTo(31, 54);
      b.crate(35, b.FLOOR - 4, 'arm');
      b.sign(39, b.FLOOR - 3, ['K OR C THROWS', 'A BASEBALL']);
      b.plank(43, 5, b.FLOOR - 4);
      b.coins(44, b.FLOOR - 5, 4);
      b.machine(50, b.FLOOR - 1, -1);
      b.check(52);

      b.arc(54, b.FLOOR - 3, 4);
      b.floorTo(58, 76, b.FLOOR - 1);
      b.gopher(62, b.FLOOR - 2); b.gopher(68, b.FLOOR - 2);
      b.card(71, b.FLOOR - 4);
      b.crate(74, b.FLOOR - 3, 'balls');

      b.arc(76, b.FLOOR - 4, 3);
      b.floorTo(79, 95);
      b.crow(82); b.crow(88);
      b.stair(91, b.FLOOR - 1, 4);

      // Up a storey, and it stays up there for a while.
      b.floorTo(95, 118, b.FLOOR - 4);
      b.plank(97, 6, b.FLOOR - 7);
      b.coins(98, b.FLOOR - 8, 5);
      b.machine(106, b.FLOOR - 5, -1);
      b.card(111, b.FLOOR - 6);
      b.check(115, b.FLOOR - 5);

      b.floorTo(119, 128);
      b.rakes(123, 2, b.FLOOR - 1);

      b.arc(128, b.FLOOR - 3, 3);
      b.floorTo(131, 150);
      b.crate(134, b.FLOOR - 2); b.crate(135, b.FLOOR - 2, 'helmet');
      b.crow(140);
      b.plank(142, 4, b.FLOOR - 5);
      b.coins(143, b.FLOOR - 6, 3);
      b.gopher(147);

      b.arc(150, b.FLOOR - 3, 4);
      b.floorTo(154, 180);
      b.machine(158, b.FLOOR - 1, -1);
      b.stair(162, b.FLOOR - 1, 3);
      b.card(166, b.FLOOR - 6);
      b.coins(169, b.FLOOR - 3, 4);
      b.goal(175);
    },
  };

  /* ==================================================================== 3 */
  const school = {
    id: 'school', name: 'FRIDAY NIGHT', league: 'HIGH SCHOOL', theme: 'school',
    note: 'Under the lights, with scouts in the third row and a bus at eleven.',
    par: 110, width: 190,
    build(b) {
      b.start(3);
      b.floorTo(0, 22);
      b.crate(9, b.FLOOR - 4, 'cleats');
      b.sign(13, b.FLOOR - 3, ['CLEATS ARE SPEED', 'AND A SECOND JUMP']);
      b.crow(18);

      b.arc(22, b.FLOOR - 3, 4);
      b.floorTo(26, 40);
      b.coins(28, b.FLOOR - 3, 4);
      b.rival(33);
      b.plank(36, 5, b.FLOOR - 4);
      b.card(38, b.FLOOR - 6);

      b.mover(43, b.FLOOR - 2, 3, 1, 0, 6, 2.2);
      b.floorTo(53, 68);
      b.check(55);
      b.machine(60, b.FLOOR - 1, -1);
      b.stair(63, b.FLOOR - 1, 5);

      b.floorTo(70, 82, b.FLOOR - 5);
      b.coins(72, b.FLOOR - 7, 5);
      b.rival(78, b.FLOOR - 6);
      b.mover(85, b.FLOOR - 6, 3, 0, 1, 4, 1.8);
      b.floorTo(90, 107);
      b.crow(94); b.gopher(99);
      b.crate(101, b.FLOOR - 2, 'balls');

      b.arc(107, b.FLOOR - 3, 4);
      b.floorTo(111, 124);
      b.check(113);
      b.machine(118, b.FLOOR - 1, -1);
      b.plank(120, 5, b.FLOOR - 5);
      b.card(122, b.FLOOR - 7);

      b.mover(128, b.FLOOR - 3, 3, 1, 0, 8, 2.6);
      b.floorTo(141, 158);
      b.rival(146); b.crow(152);
      b.crate(149, b.FLOOR - 5, 'helmet');
      b.floorTo(159, 165);
      b.rakes(161, 3, b.FLOOR - 1);

      b.arc(165, b.FLOOR - 3, 3);
      b.floorTo(168, 190);
      b.stair(171, b.FLOOR - 1, 4);
      b.card(175, b.FLOOR - 7);
      b.coins(179, b.FLOOR - 3, 5);
      b.goal(185);
    },
  };

  /* ==================================================================== 4 */
  const college = {
    id: 'college', name: 'SUNDAY DOUBLEHEADER', league: 'COLLEGE', theme: 'college',
    note: 'Aluminium bats, wooden benches, and curveballs that mean it.',
    par: 120, width: 196,
    build(b) {
      b.start(3);
      b.floorTo(0, 25);
      b.crate(10, b.FLOOR - 4, 'gum');
      b.sign(14, b.FLOOR - 3, ['HOLD JUMP WITH GUM', 'TO FLOAT DOWN']);
      b.slider(20, b.FLOOR - 4, 2);

      b.arc(25, b.FLOOR - 3, 4);
      b.floorTo(29, 42, b.FLOOR - 2);
      b.slider(34, b.FLOOR - 6, 3);
      b.card(39, b.FLOOR - 5);
      b.machine(41, b.FLOOR - 3, -1);

      b.plank(45, 4, b.FLOOR - 4);
      b.plank(52, 4, b.FLOOR - 6);
      b.coins(53, b.FLOOR - 8, 3);
      b.floorTo(59, 77);
      b.check(61);
      b.rival(66); b.crow(71);
      b.crate(69, b.FLOOR - 2, 'balls');

      b.arc(77, b.FLOOR - 4, 4);
      b.floorTo(81, 92, b.FLOOR - 3);
      b.coins(83, b.FLOOR - 5, 4);
      b.slider(86, b.FLOOR - 6, 3);

      b.mover(95, b.FLOOR - 7, 3, 0, 1, 5, 2);
      b.floorTo(100, 116);
      b.machine(106, b.FLOOR - 1, -1);
      b.card(111, b.FLOOR - 3);
      b.check(114);

      b.stair(118, b.FLOOR - 1, 5);
      b.floorTo(123, 138, b.FLOOR - 5);
      b.slider(128, b.FLOOR - 8, 2);
      b.rival(133, b.FLOOR - 6);

      b.arc(138, b.FLOOR - 7, 5);
      b.floorTo(143, 160);
      b.crate(147, b.FLOOR - 2); b.crate(148, b.FLOOR - 2, 'helmet'); b.crate(149, b.FLOOR - 2);
      b.plank(151, 6, b.FLOOR - 5);
      b.coins(152, b.FLOOR - 6, 5);
      b.machine(155, b.FLOOR - 1, -1);

      b.mover(163, b.FLOOR - 3, 3, 1, 0, 7, 2.6);
      b.floorTo(174, 196);
      b.crow(178);
      b.stair(181, b.FLOOR - 1, 4);
      b.card(185, b.FLOOR - 7);
      b.coins(188, b.FLOOR - 3, 4);
      b.goal(192);
    },
  };

  /* ==================================================================== 5 */
  const single = {
    id: 'single', name: 'THE BUS LEAGUE', league: 'SINGLE-A', theme: 'single',
    note: 'Four hundred miles a night. Play where the bus stops.',
    par: 125, width: 200,
    build(b) {
      b.start(3);
      b.floorTo(0, 18);
      b.coins(6, b.FLOOR - 3, 4);
      b.rival(14);

      b.mover(21, b.FLOOR - 2, 4, 1, 0, 7, 2.8);
      b.floorTo(32, 44);
      b.machine(37, b.FLOOR - 1, -1);
      b.card(41, b.FLOOR - 3);
      b.check(43);

      b.mover(47, b.FLOOR - 3, 3, 0, 1, 4, 2.2);
      b.mover(54, b.FLOOR - 6, 3, 0, 1, 5, 2.6);
      b.floorTo(60, 75, b.FLOOR - 4);
      b.crow(64, b.FLOOR - 5); b.gopher(69, b.FLOOR - 5);
      b.crate(67, b.FLOOR - 6, 'balls');

      b.arc(75, b.FLOOR - 5, 4);
      b.floorTo(79, 94);
      b.machine(84, b.FLOOR - 1, -1); b.machine(90, b.FLOOR - 1, -1);
      b.plank(86, 5, b.FLOOR - 5);
      b.coins(87, b.FLOOR - 6, 4);
      b.check(93);

      b.mover(98, b.FLOOR - 2, 3, 1, 0, 9, 3);
      b.floorTo(111, 124, b.FLOOR - 3);
      b.card(117, b.FLOOR - 5);
      b.rival(121, b.FLOOR - 4);
      b.floorTo(126, 132);
      b.rakes(128, 3, b.FLOOR - 1);

      b.arc(132, b.FLOOR - 3, 3);
      b.floorTo(135, 152);
      b.slider(140, b.FLOOR - 5, 3);
      b.crate(144, b.FLOOR - 4, 'cleats');
      b.machine(150, b.FLOOR - 1, -1);
      b.stair(154, b.FLOOR - 1, 5);

      b.floorTo(159, 172, b.FLOOR - 4);
      b.card(165, b.FLOOR - 6);
      b.rival(169, b.FLOOR - 5);
      b.mover(176, b.FLOOR - 5, 3, 1, 1, 5, 2.4);

      b.floorTo(183, 200);
      b.crow(187);
      b.crate(190, b.FLOOR - 2, 'helmet');
      b.coins(193, b.FLOOR - 3, 4);
      b.goal(196);
    },
  };

  /* ==================================================================== 6 */
  const doubleA = {
    id: 'double', name: 'RAIN DELAY', league: 'DOUBLE-A', theme: 'double',
    note: 'They will not call it. The tarp stays rolled and so do you.',
    par: 130, width: 204,
    build(b) {
      b.start(3);
      b.floorTo(0, 23);
      b.machine(16, b.FLOOR - 1, -1);
      b.coins(7, b.FLOOR - 3, 4);

      b.arc(23, b.FLOOR - 3, 4);
      b.floorTo(27, 40);
      b.rival(32); b.crow(37);
      b.crate(35, b.FLOOR - 5, 'gum');
      b.plank(42, 5, b.FLOOR - 3);
      b.card(44, b.FLOOR - 5);

      b.floorTo(49, 62, b.FLOOR - 2);
      b.slider(54, b.FLOOR - 6, 3);
      b.machine(59, b.FLOOR - 3, -1);
      b.check(61, b.FLOOR - 3);

      b.mover(65, b.FLOOR - 3, 3, 0, 1, 5, 2.6);
      b.mover(72, b.FLOOR - 6, 3, 1, 0, 6, 2.8);
      b.floorTo(82, 102);
      b.gopher(86); b.gopher(92);
      b.coins(88, b.FLOOR - 4, 4);
      b.rakes(98, 3, b.FLOOR - 1);

      b.floorTo(105, 125);
      b.machine(110, b.FLOOR - 1, -1); b.machine(120, b.FLOOR - 1, 1);
      b.card(114, b.FLOOR - 6);
      b.plank(112, 6, b.FLOOR - 5);
      b.check(123);

      b.arc(125, b.FLOOR - 3, 4);
      b.floorTo(129, 147, b.FLOOR - 3);
      b.rival(134, b.FLOOR - 4); b.rival(140, b.FLOOR - 4);
      b.crate(137, b.FLOOR - 5, 'helmet');

      b.arc(147, b.FLOOR - 4, 3);
      b.floorTo(150, 166);
      b.slider(151, b.FLOOR - 7, 4);
      b.stair(153, b.FLOOR - 1, 5);
      b.card(158, b.FLOOR - 8);
      b.plank(160, 5, b.FLOOR - 8);
      b.coins(161, b.FLOOR - 9, 4);
      b.machine(164, b.FLOOR - 1, -1);

      b.mover(170, b.FLOOR - 3, 3, 1, 0, 8, 3);
      b.floorTo(182, 204);
      b.crow(186); b.gopher(191);
      b.crate(194, b.FLOOR - 2, 'balls');
      b.coins(196, b.FLOOR - 4, 4);
      b.goal(200);
    },
  };

  /* ==================================================================== 7 */
  const triple = {
    id: 'triple', name: 'ONE CALL AWAY', league: 'TRIPLE-A', theme: 'triple',
    note: 'Everybody here has been up once. Everybody here wants back.',
    par: 140, width: 212,
    build(b) {
      b.start(3);
      b.floorTo(0, 21);
      b.rival(12);
      b.machine(17, b.FLOOR - 1, -1);

      b.arc(21, b.FLOOR - 3, 4);
      b.floorTo(25, 38, b.FLOOR - 3);
      b.slider(30, b.FLOOR - 7, 3);
      b.card(35, b.FLOOR - 5);

      b.mover(41, b.FLOOR - 4, 3, 0, 1, 5, 2.8);
      b.floorTo(47, 62);
      b.machine(52, b.FLOOR - 1, -1); b.machine(58, b.FLOOR - 1, 1);
      b.plank(53, 6, b.FLOOR - 5);
      b.coins(54, b.FLOOR - 6, 5);
      b.check(61);

      b.mover(66, b.FLOOR - 3, 3, 1, 0, 8, 3.2);
      b.floorTo(78, 93, b.FLOOR - 5);
      b.rival(83, b.FLOOR - 6); b.rival(88, b.FLOOR - 6);
      b.crate(85, b.FLOOR - 7, 'bat');

      b.arc(93, b.FLOOR - 6, 4);
      b.floorTo(97, 119);
      b.gopher(101); b.gopher(108);
      b.slider(105, b.FLOOR - 6, 3);
      b.card(110, b.FLOOR - 4);
      b.rakes(114, 4, b.FLOOR - 1);
      b.check(118);

      b.floorTo(122, 138);
      b.machine(126, b.FLOOR - 1, -1);
      b.stair(129, b.FLOOR - 1, 5);
      b.floorTo(134, 138, b.FLOOR - 5);
      b.rival(136, b.FLOOR - 6);
      b.mover(141, b.FLOOR - 6, 3, 0, 1, 6, 3);

      b.floorTo(147, 165, b.FLOOR - 2);
      b.machine(152, b.FLOOR - 3, -1);
      b.slider(157, b.FLOOR - 7, 4);
      b.crate(159, b.FLOOR - 4, 'helmet');
      b.card(161, b.FLOOR - 6);

      b.arc(165, b.FLOOR - 4, 4);
      b.floorTo(169, 186);
      b.rival(173); b.crow(179);
      b.machine(184, b.FLOOR - 1, -1);
      b.plank(175, 6, b.FLOOR - 5);
      b.coins(176, b.FLOOR - 6, 5);

      b.mover(189, b.FLOOR - 3, 3, 1, 0, 7, 3.2);
      b.floorTo(199, 212);
      b.stair(202, b.FLOOR - 1, 4);
      b.coins(205, b.FLOOR - 7, 4);
      b.goal(208);
    },
  };

  /* ==================================================================== 8 */
  /* The Show is short on purpose. The walk to the plate is the level; the
   * Closer is the rest of it. */
  const show = {
    id: 'show', name: 'THE SHOW', league: 'THE BIG LEAGUES', theme: 'show',
    note: 'Forty thousand people, and one man who throws ninety-nine.',
    par: 150, width: 150, bossFight: true,
    build(b) {
      b.start(3);
      b.floorTo(0, 27);
      b.sign(7, b.FLOOR - 3, ['THEY CALLED YOU UP', 'DO NOT LOOK UP']);
      b.coins(13, b.FLOOR - 3, 5);
      b.rival(21);

      b.arc(27, b.FLOOR - 3, 4);
      b.floorTo(31, 46);
      b.machine(36, b.FLOOR - 1, -1); b.machine(43, b.FLOOR - 1, 1);
      b.plank(37, 6, b.FLOOR - 5);
      b.card(40, b.FLOOR - 7);
      b.check(45);

      b.mover(49, b.FLOOR - 3, 3, 1, 0, 7, 3.4);
      b.floorTo(60, 77, b.FLOOR - 4);
      b.rival(65, b.FLOOR - 5);
      b.crate(68, b.FLOOR - 6, 'helmet');
      b.slider(72, b.FLOOR - 8, 4);

      b.arc(77, b.FLOOR - 5, 4);
      b.floorTo(81, 96);
      b.gopher(85); b.rival(91);
      b.machine(94, b.FLOOR - 1, -1);
      b.card(88, b.FLOOR - 5);
      b.plank(86, 5, b.FLOOR - 5);

      b.mover(99, b.FLOOR - 4, 3, 0, 1, 5, 3);
      b.floorTo(105, 121);
      b.slider(110, b.FLOOR - 6, 4);
      b.crate(113, b.FLOOR - 2, 'bat'); b.crate(114, b.FLOOR - 2, 'balls');
      b.card(116, b.FLOOR - 4);
      b.check(119);

      // The mound and the plate. Flat, walled at the far end: nowhere to hide
      // and, once the camera locks, nowhere to walk back to either.
      b.floorTo(121, 150);
      b.rect(149, b.FLOOR - 6, 1, 6, 'S');
      b.plank(126, 3, b.FLOOR - 4);
      b.plank(140, 3, b.FLOOR - 4);
      b.boss(142, b.FLOOR - 2);
      b.goal(132);
    },
  };

  const DEFS = [sandlot, little, school, college, single, doubleA, triple, show];

  // Built once, on load. Eight levels of tile grid is a few hundred kilobytes
  // of nothing much, and building them up front means no hitch at the door.
  const LIST = DEFS.map(make);

  /* ------------------------------------------------------------- the audit */

  /* Walk each level and complain about anything a player cannot physically
   * get past: a gap wider than a jump, or a landing higher than one. Moving
   * platforms count as ground, since standing on one is the point of it.
   *
   * This runs on load and costs a millisecond. It exists because three of
   * these levels shipped their first draft with a six-tile gap in them, and
   * finding that by falling into it is a slow way to work. */
  function audit(L) {
    // Two heights per column: `hi` is the highest thing you could be stood on
    // there (the best place to jump *from*) and `lo` the lowest (the easiest
    // thing to land *on*). For solid ground they are the same row. A lift is
    // the reason they are not: it is a floor that moves, and judging it by
    // either end alone calls a fair jump unfair.
    const hi = [], lo = [];
    for (let x = 0; x < L.w; x++) {
      let r = -1;
      for (let y = 0; y < L.h; y++) if ('#XSWB='.indexOf(L.grid[y][x]) >= 0) { r = y; break; }
      hi.push(r); lo.push(r);
    }
    for (const e of L.ents) {
      if (e.t !== 'mover') continue;
      const x0 = e.x, x1 = e.x + e.w + (e.ax ? e.dist : 0);
      const bottom = e.y + (e.ay ? e.dist : 0);
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= L.w) continue;
        if (hi[x] < 0 || e.y < hi[x]) hi[x] = e.y;
        if (lo[x] < 0 || bottom > lo[x]) lo[x] = bottom;
      }
    }

    const bad = [];
    let s = -1;
    for (let x = 0; x <= L.w; x++) {
      const pit = x < L.w && lo[x] < 0;
      if (pit) { if (s < 0) s = x; continue; }
      if (s < 0) continue;
      const w = x - s;
      const from = s > 0 ? hi[s - 1] : 99;
      const to = x < L.w ? lo[x] : 99;
      if (w > REACH.gap) bad.push('gap of ' + w + ' at ' + s);
      else if (from - to > REACH.rise) bad.push('landing ' + (from - to) + ' tiles up at ' + x);
      s = -1;
    }
    // The last columns are the back of the level — a wall there is the point.
    for (let x = 1; x < L.w - 2; x++) {
      if (lo[x] < 0 || hi[x - 1] < 0) continue;
      if (hi[x - 1] - lo[x] > REACH.rise && '#XSW'.indexOf(L.grid[lo[x]][x]) >= 0) {
        bad.push('wall ' + (hi[x - 1] - lo[x]) + ' tiles high at ' + x);
      }
    }
    if (bad.length) console.warn('The Show: ' + L.id + ' — ' + bad.join('; '));
    return bad;
  }

  const faults = [];
  for (const L of LIST) for (const f of audit(L)) faults.push(L.id + ': ' + f);

  return {
    list: LIST,
    count: LIST.length,
    get(i) { return LIST[Math.max(0, Math.min(LIST.length - 1, i))]; },
    // The Show will not let you in on promotion alone.
    CARDS_FOR_SHOW: 12,
    faults,
    H, FLOOR, REACH,
  };
})();
