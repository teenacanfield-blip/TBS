/* Pokémon Rip and Go — the map.
 *
 * Every place you can stand, typed out one character per tile, sixteen pixels
 * a tile. A map is a block of text, a list of doors, a list of people and a
 * table of what lives in the long grass. Nothing is generated: a route is the
 * same route every time, which is the only way "the trainer on the bridge" can
 * ever be a thing anybody says.
 *
 * ------------------------------------------------------------------- tiles
 *
 *     .  grass          ,  long grass, where things live
 *     =  path           ~  flowers
 *     #  tree           R  roof        B  wall      D  door
 *     F  fence          W  water       S  sand      r  rock
 *     L  ledge — you can hop down it southward, never back up
 *     f  floor          m  doormat     T  table     C  counter
 *     b  bookshelf      P  the healing machine      c  computer
 *     g  gym floor      G  gym mat   X  the splicer
 *
 * ------------------------------------------------------------------ people
 *
 * A person has a tile, a facing, a look from folks.js and something to say.
 * Give them a `party` and they are a trainer: `sight` is how many tiles down
 * their nose they will notice you, and once they have been beaten they stay
 * beaten, because a route you have cleared should feel cleared.
 */
const World = (() => {
  'use strict';

  /* ================================================================= tiles */

  const TILES = {
    '.': { paint: 'grass' },
    ',': { paint: 'tall', grass: true },
    '=': { paint: 'path' },
    '~': { paint: 'flower' },
    '#': { paint: 'tree', solid: true },
    'R': { paint: 'roof', solid: true },
    'B': { paint: 'wall', solid: true },
    'D': { paint: 'door' },
    'F': { paint: 'fence', solid: true },
    'W': { paint: 'water', solid: true },
    'S': { paint: 'sand' },
    'r': { paint: 'rock', solid: true },
    'L': { paint: 'ledge', ledge: true },
    'f': { paint: 'floor' },
    'm': { paint: 'mat' },
    'T': { paint: 'table', solid: true },
    'C': { paint: 'counter', solid: true },
    'b': { paint: 'shelf', solid: true },
    'P': { paint: 'machine', solid: true },
    'c': { paint: 'pc', solid: true },
    'g': { paint: 'gymfloor' },
    'G': { paint: 'gymmat' },
    'o': { paint: 'cavefloor' },
    'O': { paint: 'cavewall', solid: true },
    'X': { paint: 'splicer', solid: true },
  };

  const MAPS = {};

  /* =============================================================== rookridge */

  MAPS.rookridge = {
    name: 'ROOKRIDGE',
    song: 'town',
    rows: [
      '##########=#############',
      '##########=#############',
      '###.......==.......#####',
      '###.RRRRR.==.RRRRR.#####',
      '###.RRRRR.==.RRRRR.#####',
      '###.BBDBB.==.BBDBB.#####',
      '###.......==.......#####',
      '###.=========.......####',
      '###.=.......==......####',
      '###.=.RRRRRR==..,,,.####',
      '###.=.RRRRRR==..,,,.####',
      '###.=.BBBDBB==..,,,.####',
      '###.=........==.....####',
      '###.=..~.....==.....####',
      '###.==========......####',
      '###.................####',
      '###.................####',
      '########################',
    ],
    warps: [
      { x: 6, y: 5, to: 'house', tx: 5, ty: 6, dir: 'up' },
      { x: 15, y: 5, to: 'rivalhouse', tx: 5, ty: 6, dir: 'up' },
      { x: 9, y: 11, to: 'lab', tx: 6, ty: 7, dir: 'up' },
      { x: 10, y: 0, to: 'route1', tx: 10, ty: 22, dir: 'up' },
    ],
    signs: {
      '7,13': 'ROOKRIDGE. Four roofs and a lab. The road out is the only road.',
    },
    people: [
      { id: 'gate1', x: 10, y: 1, dir: 'down', who: 'prof', block: true,
        lines: ['Not that way, not yet.',
          'Long grass past the ridge, and nothing of yours to walk through it.',
          'Come down to the lab. I have three that need somewhere to be.'] },
      { x: 17, y: 15, dir: 'down', who: 'elder',
        lines: ['I have lived here sixty years.',
          'Everything interesting happened somewhere else, and I heard about it later.'] },
      { x: 5, y: 16, dir: 'right', who: 'kidnpc',
        lines: ['If a creature is in long grass it will come out at you.',
          'That is not rude. That is just what long grass is.'] },
    ],
    encounters: [],
  };

  MAPS.house = {
    name: 'HOME',
    song: 'town', inside: true,
    rows: [
      '############',
      '#BBBBBBBBBB#',
      '#fTTffffbbf#',
      '#fffffffffc#',
      '#ffffffffff#',
      '#ffffffffff#',
      '#ffffffffff#',
      '#####mm#####',
      '############',
    ],
    warps: [
      { x: 5, y: 7, to: 'rookridge', tx: 6, ty: 6, dir: 'down' },
      { x: 6, y: 7, to: 'rookridge', tx: 6, ty: 6, dir: 'down' },
    ],
    signs: { '8,2': 'A shelf of books about creatures you have never seen.' },
    people: [
      { x: 3, y: 4, dir: 'down', who: 'picnicker', name: 'MUM',
        lines: ['There you are.',
          'Professor Hollow came by twice. Twice, for her.',
          'Go on. I have put a POTION in your bag, which is all the help you get.'],
        gift: { item: 'POTION', n: 1, once: 'mumpotion' } },
    ],
    encounters: [],
  };

  MAPS.rivalhouse = {
    name: 'BRAM\'S HOUSE',
    song: 'town', inside: true,
    rows: [
      '############',
      '#BBBBBBBBBB#',
      '#fbbffffTTf#',
      '#ffffffffff#',
      '#ffffffffff#',
      '#ffffffffff#',
      '#ffffffffff#',
      '#####mm#####',
      '############',
    ],
    warps: [
      { x: 5, y: 7, to: 'rookridge', tx: 15, ty: 6, dir: 'down' },
      { x: 6, y: 7, to: 'rookridge', tx: 15, ty: 6, dir: 'down' },
    ],
    signs: {},
    people: [
      { x: 6, y: 4, dir: 'down', who: 'elder', name: 'BRAM\'S GRAN',
        lines: ['Bram went to the lab an hour ago.',
          'He said he would be back before you even woke up.',
          'He says a lot of things.'] },
    ],
    encounters: [],
  };

  MAPS.lab = {
    name: 'HOLLOW LAB',
    song: 'shop', inside: true,
    rows: [
      '##############',
      '#BBBBBBBBBBBB#',
      '#fbbbffffbbbf#',
      '#ffffffffffff#',
      '#ffffTTTfffff#',
      '#ffffffffffff#',
      '#ffffffffffff#',
      '#ffffffffffff#',
      '######mm######',
      '##############',
    ],
    warps: [
      { x: 6, y: 8, to: 'rookridge', tx: 9, ty: 12, dir: 'down' },
      { x: 7, y: 8, to: 'rookridge', tx: 9, ty: 12, dir: 'down' },
    ],
    signs: {
      '2,2': 'Field notes. Most of them are about the weather.',
      '9,2': 'A shelf of jars. The jars are empty and labelled anyway.',
    },
    /* The three on the table are the table, as far as the game is concerned:
     * walk up to it and press A, the way you would to read anything else. */
    spots: { '5,4': 'starters', '6,4': 'starters', '7,4': 'starters' },
    people: [
      { id: 'prof', x: 6, y: 3, dir: 'down', who: 'prof', starters: true,
        lines: ['There you are. Three on the table.',
          'Pick one. I am not going to tell you which, because then it would be mine.'] },
      { id: 'labassist', x: 11, y: 6, dir: 'left', who: 'clerk', name: 'ASSISTANT',
        lines: ['Every one of them is somebody\'s favourite.',
          'That is not a dodge. I have checked.'] },
    ],
    encounters: [],
  };

  /* ================================================================== route 1 */

  MAPS.route1 = {
    name: 'ROUTE 1',
    song: 'town',
    rows: [
      '##########==############',
      '###.......==.......#####',
      '###.,,,,..==..,,,,.#####',
      '###.,,,,..==..,,,,.#####',
      '###.,,,,..==..,,,,.#####',
      '###.......==.......#####',
      '###..LLLLLLLLLL....#####',
      '###.......==.......#####',
      '###..,,,,.==...rr..#####',
      '###..,,,,.==...rr..#####',
      '###..,,,,.==.......#####',
      '###.......==.......#####',
      '###..=============.#####',
      '###..=...........=.#####',
      '###..=.,,,,,,,,,.=.#####',
      '###..=.,,,,,,,,,.=.#####',
      '###..=...........=.#####',
      '###..=============.#####',
      '###.......==.......#####',
      '###..,,,..==..,,,..#####',
      '###..,,,..==..,,,..#####',
      '###..,,,..==..,,,..#####',
      '###.......==.......#####',
      '##########=#############',
    ],
    warps: [
      { x: 10, y: 23, to: 'rookridge', tx: 10, ty: 1, dir: 'down' },
      { x: 10, y: 0, to: 'willowbank', tx: 10, ty: 16, dir: 'up' },
      { x: 11, y: 0, to: 'willowbank', tx: 11, ty: 16, dir: 'up' },
    ],
    signs: {
      '12,18': 'ROUTE 1. Long grass either side. Walk the path if you would rather not.',
    },
    people: [
      { id: 't_r1a', x: 6, y: 13, dir: 'right', who: 'youngster', sight: 4,
        party: [['gnawkin', 5], ['nibbug', 5]], prize: 120,
        intro: ['You came up the path! Nobody comes up the path.'],
        lines: ['Down the path, along the fence, back again. That is my whole route.'],
        defeat: ['Oh. That is what a real one looks like.'] },
      { id: 't_r1b', x: 14, y: 9, dir: 'left', who: 'picnicker', sight: 3,
        party: [['pipeep', 6], ['spriglet', 6]], prize: 150,
        intro: ['Do not step on the blanket.'],
        lines: ['The rocks are warm. Everything sits on them in the afternoon.'],
        defeat: ['You did step on the blanket.'] },
      { x: 5, y: 20, dir: 'right', who: 'kidnpc',
        lines: ['A creature at half health is far easier to catch.',
          'A creature asleep is easier still. Ask anyone with SPORE.'] },
    ],
    /* Route 1 is the only ground between a level 5 starter and a gym leader
     * whose last one is fifteen, and there are two trainers on it. If the
     * grass tops out at five, the only way across that gap is an hour of
     * walking in circles — so it tops out at seven instead. */
    encounters: [
      { id: 'gnawkin', min: 3, max: 7, w: 30 },
      { id: 'nibbug', min: 3, max: 6, w: 25 },
      { id: 'pipeep', min: 4, max: 7, w: 20 },
      { id: 'spriglet', min: 4, max: 7, w: 8 },
      { id: 'cindpup', min: 4, max: 7, w: 8 },
      { id: 'puddlet', min: 4, max: 7, w: 9 },
    ],
  };

  /* ============================================================== willowbank */

  MAPS.willowbank = {
    name: 'WILLOWBANK',
    song: 'town',
    rows: [
      '########################',
      '#####..............#####',
      '###.RRRRR....RRRRR..####',
      '###.RRRRR....RRRRR..####',
      '###.BBDBB....BBDBB..####',
      '###.................####',
      '###.===============.####',
      '###.=.............=.####',
      '###.=.RRRRR..RRRR.=.####',
      '###.=.RRRRR..RRRR.=.####',
      '###.=.BBDBB..BBDB.=.####',
      '###.=.............=.####',
      '###.===============.####',
      '###.~...............####',
      '###..WWWW...........####',
      '###..WWWW...........####',
      '##########==############',
    ],
    warps: [
      { x: 6, y: 4, to: 'wcenter', tx: 6, ty: 8, dir: 'up' },
      { x: 15, y: 4, to: 'wmart', tx: 6, ty: 8, dir: 'up' },
      { x: 8, y: 10, to: 'gym1', tx: 7, ty: 12, dir: 'up' },
      { x: 15, y: 10, to: 'cardshop', tx: 6, ty: 8, dir: 'up' },
      { x: 10, y: 16, to: 'route1', tx: 10, ty: 1, dir: 'down' },
      { x: 11, y: 16, to: 'route1', tx: 11, ty: 1, dir: 'down' },
      { x: 19, y: 6, to: 'route2', tx: 1, ty: 12, dir: 'right' },
    ],
    signs: {
      '4,13': 'WILLOWBANK. Red roof heals. Blue roof sells. The one with the banner hits back.',
    },
    people: [
      { id: 'gate2', x: 19, y: 6, dir: 'left', who: 'hiker', opensAt: 1, aside: { x: 19, y: 7 },
        lines: ['Road east is mine to stand in until somebody takes the LEAF badge off MARLOW.',
          'He is in the gym. He is the wide one. You cannot miss him.'],
        pass: ['A LEAF badge. Well then. It is your road now.'] },
      { x: 6, y: 13, dir: 'down', who: 'angler',
        lines: ['Water this shallow only holds small things.',
          'Small things grow. That is the entire hobby.'] },
      { x: 14, y: 5, dir: 'down', who: 'youngster',
        lines: ['The card shop is a card shop. It is not a gym and the man in there knows it.',
          'Still. A pack is a pack.'] },
    ],
    encounters: [],
  };

  MAPS.wcenter = {
    name: 'HEALING CENTER',
    song: 'shop', inside: true, center: true,
    rows: [
      '#############',
      '#BBBBBBBBBBB#',
      '#fffCPCfffff#',
      '#ffffffffffc#',
      '#ffffffffffc#',
      '#Xffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '######mm#####',
      '#############',
    ],
    warps: [
      { x: 6, y: 8, to: 'willowbank', tx: 6, ty: 5, dir: 'down' },
      { x: 7, y: 8, to: 'willowbank', tx: 6, ty: 5, dir: 'down' },
    ],
    signs: { '11,3': 'THE BOX. Everything you caught and did not carry.' },
    spots: { '1,5': 'splicer' },
    people: [
      { id: 'nurse1', x: 5, y: 3, dir: 'down', who: 'nurse', heal: true,
        lines: ['Put them on the counter. This takes no time at all.'] },
      { x: 9, y: 6, dir: 'left', who: 'hiker',
        lines: ['Walk in broken, walk out whole, pay nothing.',
          'I have stopped asking how. I just come in more often.'] },
    ],
    encounters: [],
  };

  MAPS.wmart = {
    name: 'WILLOWBANK MART',
    song: 'shop', inside: true,
    rows: [
      '#############',
      '#BBBBBBBBBBB#',
      '#fffCCCfffbb#',
      '#ffffffffffb#',
      '#ffffffffffb#',
      '#fffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '######mm#####',
      '#############',
    ],
    warps: [
      { x: 6, y: 8, to: 'willowbank', tx: 15, ty: 5, dir: 'down' },
      { x: 7, y: 8, to: 'willowbank', tx: 15, ty: 5, dir: 'down' },
    ],
    signs: { '11,2': 'Shelves of things in tins. None of it is for sale.' },
    people: [
      { id: 'clerk1', x: 5, y: 3, dir: 'down', who: 'clerk', shop: 'basic',
        lines: ['Balls, potions, and a word of advice you did not pay for: buy balls.'] },
      { x: 9, y: 6, dir: 'up', who: 'picnicker',
        lines: ['A POTION in the bag is worth two in the shop when you are eight tiles into the grass.'] },
    ],
    encounters: [],
  };

  MAPS.cardshop = {
    name: 'THE CORNER SHOP',
    song: 'shop', inside: true,
    rows: [
      '#############',
      '#BBBBBBBBBBB#',
      '#fffCCCfffbb#',
      '#ffffffffffb#',
      '#fffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '######mm#####',
      '#############',
    ],
    warps: [
      { x: 6, y: 8, to: 'willowbank', tx: 15, ty: 11, dir: 'down' },
      { x: 7, y: 8, to: 'willowbank', tx: 15, ty: 11, dir: 'down' },
    ],
    signs: { '11,2': 'PACKS. NO RETURNS. THE ODDS ARE ON THE WALL AND THEY ARE HONEST.' },
    people: [
      { id: 'packman', x: 5, y: 3, dir: 'down', who: 'clerk', name: 'CARD MAN', packs: true,
        lines: ['A pack is eight cards and you keep five. That is the deal, that is the whole deal.',
          'What you keep walks out with you. What you do not, I tear up in front of you for coin.'] },
      { x: 9, y: 6, dir: 'left', who: 'youngster',
        lines: ['I have opened forty packs.',
          'I have three good ones and a very clear memory of the other thirty-seven.'] },
    ],
    encounters: [],
  };

  MAPS.gym1 = {
    name: 'WILLOWBANK GYM',
    song: 'battle', inside: true, gym: 1,
    rows: [
      '###############',
      '#BBBBBBBBBBBBB#',
      '#ggggggggggggg#',
      '#ggg#ggggg#ggg#',
      '#ggg#ggggg#ggg#',
      '#ggggggggggggg#',
      '#ggg#ggggg#ggg#',
      '#ggg#ggggg#ggg#',
      '#ggggggggggggg#',
      '#ggg#ggggg#ggg#',
      '#ggg#ggggg#ggg#',
      '#ggggggggggggg#',
      '######GG#######',
      '###############',
    ],
    warps: [
      { x: 6, y: 12, to: 'willowbank', tx: 8, ty: 11, dir: 'down' },
      { x: 7, y: 12, to: 'willowbank', tx: 8, ty: 11, dir: 'down' },
    ],
    signs: {},
    people: [
      { id: 'g1a', x: 3, y: 9, dir: 'right', who: 'picnicker', sight: 4,
        party: [['spriglet', 11], ['nibbug', 11]], prize: 260,
        intro: ['Nothing in here is in a hurry. Neither am I.'],
        lines: ['MARLOW is at the back. He has been there all day.'],
        defeat: ['Go on then.'] },
      { id: 'g1b', x: 11, y: 5, dir: 'left', who: 'youngster', sight: 4,
        party: [['spriglet', 12], ['chitling', 12]], prize: 280,
        intro: ['You will not out-wait a LEAF gym. Nobody out-waits a LEAF gym.'],
        lines: ['Fire. Frost. Wings. Any of those. That is the whole puzzle.'],
        defeat: ['You did not wait. That is cheating and it worked.'] },
      { id: 'leader1', x: 7, y: 2, dir: 'down', who: 'leader1', leader: 1, badge: 'LEAF BADGE',
        type: 'LEAF', packTier: 'scrub', packLevel: 16,
        party: [['chitling', 12], ['spriglet', 13], ['fernaut', 15]], prize: 900,
        intro: ['MARLOW. I grow things and I do not rush.',
          'Show me what you have got before the light goes.'],
        lines: ['Take the road east. It is open now, and I have told the man on it so.'],
        defeat: ['There it is. Sixteen levels of it, straight through the middle.',
          'The LEAF BADGE. Yours. Take the east road.'] },
    ],
    encounters: [],
  };

  /* ================================================================= route 2 */

  MAPS.route2 = {
    name: 'ROUTE 2',
    song: 'town',
    rows: [
      '########################',
      '###..,,,,....,,,,...####',
      '###..,,,,....,,,,...####',
      '###..................###',
      '###.====================',
      '###.=...............rr.#',
      '###.=.,,,,,,,,,,,,.rOO.#',
      '###.=.,,,,,,,,,,,,.rOO.#',
      '###.=...............DO.#',
      '###.=...rr.........rrr.#',
      '###.=...rr.............#',
      '###.=..................#',
      '=====..................#',
      '###..,,,,,,....,,,,,,..#',
      '###..,,,,,,....,,,,,,..#',
      '###....................#',
      '########################',
    ],
    warps: [
      { x: 0, y: 12, to: 'willowbank', tx: 18, ty: 6, dir: 'left' },
      { x: 20, y: 8, to: 'cave', tx: 2, ty: 13, dir: 'up' },
      { x: 23, y: 4, to: 'emberside', tx: 1, ty: 8, dir: 'right' },
    ],
    signs: {
      '4,11': 'ROUTE 2. The cave cuts through. The long way round is longer than it looks.',
    },
    people: [
      { id: 't_r2a', x: 8, y: 4, dir: 'down', who: 'hiker', sight: 4,
        party: [['pebblet', 14], ['gnawkin', 15]], prize: 380,
        intro: ['Rocks up here. Rocks in the cave. Rocks all the way down, if you ask me.'],
        lines: ['Mind the cave. It is not deep but it is dark.'],
        defeat: ['Fair. Rocks are slow.'] },
      { id: 't_r2b', x: 16, y: 13, dir: 'up', who: 'youngster', sight: 3,
        party: [['voltmite', 15], ['pipeep', 15], ['nibbug', 14]], prize: 420,
        intro: ['Three of them. All fast. Try to keep up.'],
        lines: ['Fast is not the same as strong. I know. I am working on the other one.'],
        defeat: ['Keeping up was not the problem.'] },
      { id: 't_r2c', x: 12, y: 15, dir: 'up', who: 'picnicker', sight: 3,
        party: [['spriglet', 16], ['puddlet', 16]], prize: 400,
        intro: ['I walked out here to be left alone, and here you are.'],
        lines: ['Go on. Cave is that way.'],
        defeat: ['Now I am alone. Thank you.'] },
    ],
    encounters: [
      { id: 'gnawkin', min: 10, max: 14, w: 18 },
      { id: 'cheeker', min: 14, max: 16, w: 10 },
      { id: 'pipeep', min: 11, max: 14, w: 16 },
      { id: 'voltmite', min: 12, max: 15, w: 16 },
      { id: 'nibbug', min: 10, max: 13, w: 12 },
      { id: 'chitling', min: 13, max: 15, w: 8 },
      { id: 'pebblet', min: 12, max: 15, w: 12 },
      { id: 'wisplet', min: 13, max: 16, w: 8 },
    ],
  };

  MAPS.cave = {
    name: 'WILLOW CUT',
    song: 'battle', inside: true, dark: true,
    rows: [
      'OOOOOOOOOOOOOOOO',
      'OooooooooooooooO',
      'OoOOooooOOooooOO',
      'OoOOooooOOoooooO',
      'Ooooo,,,ooooooOO',
      'Ooooo,,,oooOOooO',
      'OooOO,,,oooOOooO',
      'OooOOooooooooooO',
      'OoooooooOOoooooO',
      'Ooo,,,ooOOoooooO',
      'Ooo,,,oooooooooO',
      'Ooo,,,oooooOOooO',
      'OooooooooooOOooO',
      'OOoOOOOOOOOOOooO',
      'OOOOOOOOOOOOOOOO',
    ],
    warps: [
      { x: 2, y: 13, to: 'route2', tx: 20, ty: 8, dir: 'down' },
      { x: 13, y: 13, to: 'emberside', tx: 12, ty: 15, dir: 'down' },
    ],
    signs: {},
    people: [
      { id: 't_cave', x: 5, y: 7, dir: 'right', who: 'hiker', sight: 4,
        party: [['pebblet', 17], ['cobblin', 18]], prize: 520,
        intro: ['You can hear somebody coming from a long way off in here.'],
        lines: ['Straight through and out the other side. Do not take the left fork, it stops.'],
        defeat: ['Heard you coming. Did not help.'] },
    ],
    encounters: [
      { id: 'pebblet', min: 14, max: 18, w: 30 },
      { id: 'cobblin', min: 17, max: 19, w: 10 },
      { id: 'wisplet', min: 15, max: 18, w: 22 },
      { id: 'voltmite', min: 15, max: 18, w: 18 },
      { id: 'gnawkin', min: 14, max: 17, w: 20 },
    ],
  };

  /* ============================================================== emberside */

  MAPS.emberside = {
    name: 'EMBERSIDE',
    song: 'town',
    rows: [
      '########################',
      '###..............#######',
      '###.RRRRR..RRRRR.#######',
      '###.RRRRR..RRRRR.#######',
      '###.BBDBB..BBDBB.#######',
      '###..............#######',
      '###.============.#######',
      '=====..........=.#######',
      '###.=..........=.#######',
      '###.=.RRRRRRRR.=.#######',
      '###.=.RRRRRRRR.=.#######',
      '###.=.BBBDBBBB.=.#######',
      '###.=..........=.#######',
      '###.============.#######',
      '###.~..........~.#######',
      '###.....====D....#######',
      '##########=#############',
    ],
    warps: [
      { x: 6, y: 4, to: 'ecenter', tx: 6, ty: 8, dir: 'up' },
      { x: 13, y: 4, to: 'emart', tx: 6, ty: 8, dir: 'up' },
      { x: 9, y: 11, to: 'gym2', tx: 7, ty: 12, dir: 'up' },
      { x: 0, y: 7, to: 'route2', tx: 22, ty: 4, dir: 'left' },
      { x: 10, y: 16, to: 'route3', tx: 10, ty: 1, dir: 'down' },
      { x: 12, y: 15, to: 'cave', tx: 13, ty: 13, dir: 'up' },
    ],
    signs: {
      '4,14': 'EMBERSIDE. Built on a vent. The floors are warm in winter and in summer.',
    },
    people: [
      { id: 'gate3', x: 10, y: 15, dir: 'down', who: 'clerk', opensAt: 2, aside: { x: 9, y: 14 },
        lines: ['South road is shut. Rockfall took out the whole bend last night.',
          'Crew is on it. They work faster for people with two badges, oddly enough.'],
        pass: ['Two badges. Right, the road is clear. Mind the loose edge.'] },
      { x: 15, y: 12, dir: 'left', who: 'angler',
        lines: ['IZZY runs the gym. She is quick and she does not warm up first.',
          'Bring something that does not mind being hit.'] },
      { x: 5, y: 5, dir: 'down', who: 'kidnpc',
        lines: ['My sister caught a GEODON in the cut. It took eleven balls.',
          'She says it took two. She is lying.'] },
    ],
    encounters: [],
  };

  MAPS.ecenter = {
    name: 'HEALING CENTER',
    song: 'shop', inside: true, center: true,
    rows: [
      '#############',
      '#BBBBBBBBBBB#',
      '#fffCPCfffff#',
      '#ffffffffffc#',
      '#ffffffffffc#',
      '#Xffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '######mm#####',
      '#############',
    ],
    warps: [
      { x: 6, y: 8, to: 'emberside', tx: 6, ty: 5, dir: 'down' },
      { x: 7, y: 8, to: 'emberside', tx: 6, ty: 5, dir: 'down' },
    ],
    signs: { '11,3': 'THE BOX. Everything you caught and did not carry.' },
    spots: { '1,5': 'splicer' },
    people: [
      { id: 'nurse2', x: 5, y: 3, dir: 'down', who: 'nurse', heal: true,
        lines: ['Straight off the cut, by the look of you. Put them down.'] },
    ],
    encounters: [],
  };

  MAPS.emart = {
    name: 'EMBERSIDE MART',
    song: 'shop', inside: true,
    rows: [
      '#############',
      '#BBBBBBBBBBB#',
      '#fffCCCfffbb#',
      '#ffffffffffb#',
      '#ffffffffffb#',
      '#fffffffffff#',
      '#fffffffffff#',
      '#fffffffffff#',
      '######mm#####',
      '#############',
    ],
    warps: [
      { x: 6, y: 8, to: 'emberside', tx: 13, ty: 5, dir: 'down' },
      { x: 7, y: 8, to: 'emberside', tx: 13, ty: 5, dir: 'down' },
    ],
    signs: { '11,2': 'GREAT BALLS IN STOCK. The sign has been up for a year.' },
    people: [
      { id: 'clerk2', x: 5, y: 3, dir: 'down', who: 'clerk', shop: 'good',
        lines: ['GREAT BALLS, SUPER POTIONS, and one REVIVE at a price I am not proud of.'] },
    ],
    encounters: [],
  };

  MAPS.gym2 = {
    name: 'EMBERSIDE GYM',
    song: 'battle', inside: true, gym: 2,
    rows: [
      '###############',
      '#BBBBBBBBBBBBB#',
      '#ggggggggggggg#',
      '#gg#########gg#',
      '#gg#ggggggg#gg#',
      '#gg#g#####g#gg#',
      '#gg#g#ggg#g#gg#',
      '#gg#g#ggg#g#gg#',
      '#gg#g##g##g#gg#',
      '#gg#ggggggg#gg#',
      '#gg#g#######gg#',
      '#ggggggggggggg#',
      '######GG#######',
      '###############',
    ],
    warps: [
      { x: 6, y: 12, to: 'emberside', tx: 9, ty: 12, dir: 'down' },
      { x: 7, y: 12, to: 'emberside', tx: 9, ty: 12, dir: 'down' },
    ],
    signs: {},
    people: [
      { id: 'g2a', x: 2, y: 6, dir: 'right', who: 'youngster', sight: 5,
        party: [['voltmite', 20], ['pipeep', 20]], prize: 640,
        intro: ['Round and round the outside. That is the gym. That is the joke.'],
        lines: ['STONE grounds it. Everything else takes the hit.'],
        defeat: ['Round and round I go.'] },
      { id: 'g2b', x: 12, y: 9, dir: 'left', who: 'hiker', sight: 5,
        party: [['arcmite', 21], ['gnawkin', 20], ['cheeker', 21]], prize: 700,
        intro: ['I stand in the corner so people have to come to me.'],
        lines: ['IZZY is in the middle. Of course she is.'],
        defeat: ['Worth standing here for.'] },
      { id: 'leader2', x: 7, y: 6, dir: 'down', who: 'leader2', leader: 2, badge: 'SPARK BADGE',
        type: 'SPARK', packTier: 'field', packLevel: 26,
        party: [['voltmite', 21], ['arcmite', 23], ['skyjay', 24], ['arcmite', 26]], prize: 1800,
        intro: ['IZZY. I do not warm up and I do not talk through it.',
          'Go.'],
        lines: ['South road. They will have cleared it by now.'],
        defeat: ['Good. Fast and good. SPARK BADGE, take it, go south.'] },
    ],
    encounters: [],
  };

  /* ================================================================= route 3 */

  MAPS.route3 = {
    name: 'ROUTE 3',
    song: 'town',
    rows: [
      '##########==############',
      '###.......==.......#####',
      '###..,,,..==..,,,..#####',
      '###..,,,..==..,,,..#####',
      '###.......==.......#####',
      '###.SSSSSSSSSSSSSS.#####',
      '###.SWWWWWWWWWWWWS.#####',
      '###.SWWWWWWWWWWWWS.#####',
      '###.SSSSSS==SSSSSS.#####',
      '###.......==.......#####',
      '###..,,,,.==.,,,,..#####',
      '###..,,,,.==.,,,,..#####',
      '###..,,,,.==.,,,,..#####',
      '###.......==.......#####',
      '###..rrr..==..rrr..#####',
      '###.......==.......#####',
      '##########==############',
    ],
    warps: [
      { x: 10, y: 0, to: 'emberside', tx: 10, ty: 15, dir: 'up' },
      { x: 11, y: 0, to: 'emberside', tx: 11, ty: 15, dir: 'up' },
      { x: 10, y: 16, to: 'keep', tx: 10, ty: 14, dir: 'down' },
    ],
    signs: {
      '12,13': 'ROUTE 3. The keep is south. Nobody lives in it. Somebody is in it.',
    },
    people: [
      { id: 't_r3a', x: 6, y: 9, dir: 'right', who: 'angler', sight: 4,
        party: [['finnik', 24], ['glacifin', 26]], prize: 900,
        intro: ['Been here since first light. You are the first thing to bite.'],
        lines: ['Water is shallow but it goes a long way back.'],
        defeat: ['Back to the rod, then.'] },
      { id: 't_r3b', x: 15, y: 12, dir: 'left', who: 'picnicker', sight: 4,
        party: [['spriglet', 25], ['fernaut', 27], ['chitling', 25]], prize: 950,
        intro: ['Last stop before the keep. Make it count.'],
        lines: ['Whatever is in there, it was in there before the keep was.'],
        defeat: ['Go on. Mind yourself.'] },
      { id: 't_r3c', x: 12, y: 3, dir: 'down', who: 'hiker', sight: 4,
        party: [['cobblin', 26], ['burrowback', 28]], prize: 1000,
        intro: ['You have the two badges. Let us see if they were gifts.'],
        lines: ['They were not gifts. I checked.'],
        defeat: ['They were not gifts.'] },
    ],
    encounters: [
      { id: 'finnik', min: 22, max: 26, w: 20 },
      { id: 'glacifin', min: 25, max: 28, w: 10 },
      { id: 'cheeker', min: 22, max: 26, w: 16 },
      { id: 'skyjay', min: 24, max: 27, w: 14 },
      { id: 'wisplet', min: 22, max: 25, w: 14 },
      { id: 'lanternwisp', min: 26, max: 29, w: 8 },
      { id: 'arcmite', min: 24, max: 27, w: 10 },
      { id: 'mantivine', min: 25, max: 28, w: 8 },
    ],
  };

  MAPS.keep = {
    name: 'THE OLD KEEP',
    song: 'battle', inside: true,
    rows: [
      '################',
      '#OOOOOOOOOOOOOO#',
      '#OoooooooooooOO#',
      '#Oooo#####ooooOO',
      '#Oooo#ggg#oooooO',
      '#Oooo#ggg#oooooO',
      '#Oooo##D##oooooO',
      '#OoooooooooooooO',
      '#Oooo,,,,,ooooo#',
      '#Oooo,,,,,ooooo#',
      '#Oooo,,,,,ooooo#',
      '#OooooooooooooO#',
      '#OOOOOoooOOOOOO#',
      '#OooooooooooooO#',
      '##########oo####',
    ],
    warps: [
      { x: 7, y: 6, to: 'gym3', tx: 7, ty: 12, dir: 'up' },
      { x: 10, y: 14, to: 'route3', tx: 10, ty: 16, dir: 'up' },
      { x: 11, y: 14, to: 'route3', tx: 10, ty: 16, dir: 'up' },
    ],
    signs: {},
    people: [
      { id: 't_keep', x: 12, y: 8, dir: 'left', who: 'elder', sight: 4,
        party: [['lanternwisp', 28], ['hauntis', 30]], prize: 1200,
        intro: ['People come in here looking for the warden. Nobody comes in looking for me.'],
        lines: ['The thing at the back of the hall is not the warden either.'],
        defeat: ['Go up. He is expecting somebody.'] },
      { id: 'legend', x: 2, y: 13, dir: 'right', who: 'elder', legendary: 'stoneward', needs: 3,
        lines: ['Something is standing in the dark at the end of the hall.',
          'It has not moved. It is waiting to see whether you will.'] },
    ],
    encounters: [
      { id: 'wisplet', min: 26, max: 29, w: 22 },
      { id: 'lanternwisp', min: 28, max: 32, w: 18 },
      { id: 'hauntis', min: 32, max: 34, w: 6 },
      { id: 'cobblin', min: 27, max: 30, w: 18 },
      { id: 'geodon', min: 33, max: 35, w: 5 },
      { id: 'cheeker', min: 26, max: 29, w: 16 },
      { id: 'burrowback', min: 31, max: 33, w: 8 },
    ],
  };

  MAPS.gym3 = {
    name: 'KEEP GYM',
    song: 'battle', inside: true, gym: 3,
    rows: [
      '###############',
      '#BBBBBBBBBBBBB#',
      '#ggggggggggggg#',
      '#g###ggggg###g#',
      '#g#ggggggggg#g#',
      '#g#g#######g#g#',
      '#g#g#ggggg#g#g#',
      '#g#g#g###g#g#g#',
      '#g#g#g#g#g#g#g#',
      '#g#g#ggggg#g#g#',
      '#g#ggggggggg#g#',
      '#ggggggggggggg#',
      '######GG#######',
      '###############',
    ],
    warps: [
      { x: 6, y: 12, to: 'keep', tx: 7, ty: 7, dir: 'down' },
      { x: 7, y: 12, to: 'keep', tx: 7, ty: 7, dir: 'down' },
    ],
    signs: {},
    people: [
      { id: 'g3a', x: 3, y: 10, dir: 'up', who: 'elder', sight: 4,
        party: [['wisplet', 30], ['lanternwisp', 32]], prize: 1400,
        intro: ['Everyone takes the left wall. The left wall goes nowhere.'],
        lines: ['GALE cuts through SHADE. So does another SHADE, but that one cuts both ways.'],
        defeat: ['Right wall. Should have said.'] },
      { id: 'g3b', x: 11, y: 4, dir: 'down', who: 'angler', sight: 4,
        party: [['hauntis', 31], ['glacifin', 31], ['lanternwisp', 33]], prize: 1500,
        intro: ['Cold in here. It is not the stone.'],
        lines: ['VESK is in the middle and he has been in the middle a long time.'],
        defeat: ['Colder now.'] },
      { id: 'leader3', x: 7, y: 8, dir: 'down', who: 'leader3', leader: 3, badge: 'SHADE BADGE',
        type: 'SHADE', packTier: 'foil', packLevel: 36,
        party: [['lanternwisp', 32], ['hauntis', 34], ['geodon', 34], ['hauntis', 36]], prize: 3200,
        intro: ['WARDEN VESK. I have the keys to a building nobody wants to enter.',
          'That is the job. This is the other half of it.'],
        lines: ['The hall behind me is yours to walk. Whatever is standing at the end of it is not mine to give.'],
        defeat: ['Three badges. The hall is open.',
          'Go and see what has been waiting down there, and take a full bag.'] },
    ],
    encounters: [],
  };

  /* ================================================================== checks */
  /* Is everything in this map in the same place as everything else?
   *
   * The first version of this flooded outward from every door at once and
   * asked what it had missed. That check passes on a map you cannot cross:
   * the keep shipped with its legendary parked in the only corridor to the
   * third gym, and because the gym's own exit was also a starting point, the
   * sealed half looked perfectly reachable from inside itself. Nobody could
   * walk there, and the checker agreed that nobody needed to.
   *
   * So the question is not "what can I reach" but "is this one place". Every
   * door, every person and every readable thing has to sit in a single
   * connected region. Two regions means a map in two halves, however each
   * half looks on its own.
   *
   * People count as walls, because a person standing in a one-tile corridor
   * closes it as surely as a wall does — except the two kinds whose whole job
   * is to be in the way until something happens, who would otherwise report
   * every road they guard as a dead end. Ledges are one-way in play, but for
   * this they join both sides: a one-way drop is a design decision, not a
   * region you cannot get to. */
  function reachability(name, m, gatesAside) {
    const problems = [];

    const blocked = {};
    (m.people || []).forEach((p) => {
      if (p.opensAt || p.block) {
        // A guard who has stepped aside is still a person standing on a tile.
        // Moving one off the road and onto the next square of the same road
        // is not stepping aside, and it looks like stepping aside right up
        // until somebody with the badge walks into them.
        if (gatesAside && p.opensAt && p.aside) blocked[p.aside.x + ',' + p.aside.y] = p.id || p.who;
        return;
      }
      blocked[p.x + ',' + p.y] = p.id || p.who;
    });

    const open = (x, y) => {
      const ch = tileAt(m, x, y);
      if (ch === null || info(ch).solid) return false;
      return !blocked[x + ',' + y];
    };

    /* Label every open tile with the region it belongs to. */
    const region = {};
    let regions = 0;
    for (let y = 0; y < m.rows.length; y++) {
      for (let x = 0; x < m.rows[y].length; x++) {
        const key = x + ',' + y;
        if (!open(x, y) || region[key] !== undefined) continue;
        const id = regions++;
        const queue = [[x, y]];
        region[key] = id;
        while (queue.length) {
          const [cx, cy] = queue.shift();
          [[cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]].forEach(([nx, ny]) => {
            if (!open(nx, ny)) return;
            const k = nx + ',' + ny;
            if (region[k] === undefined) { region[k] = id; queue.push([nx, ny]); }
          });
        }
      }
    }

    /* Everything anybody has to be able to walk to, and which region it is in.
     * A person or a sign is reached from beside it, so it counts as being in
     * whichever region its neighbours are. */
    const points = [];
    (m.warps || []).forEach((w) => {
      points.push({ what: 'the door at ' + w.x + ',' + w.y + ' (to ' + w.to + ')',
        ids: [region[w.x + ',' + w.y]].filter((v) => v !== undefined) });
    });
    const beside = (x, y) => [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]]
      .map(([bx, by]) => region[bx + ',' + by])
      .filter((v) => v !== undefined);
    (m.people || []).forEach((p) => {
      points.push({ what: (p.id || p.who) + ' at ' + p.x + ',' + p.y, ids: beside(p.x, p.y) });
    });
    Object.keys(m.spots || {}).forEach((key) => {
      const [sx, sy] = key.split(',').map(Number);
      points.push({ what: 'the spot at ' + key, ids: beside(sx, sy) });
    });

    points.forEach((p) => {
      if (!p.ids.length) problems.push(name + ': ' + p.what + ' has no open tile next to it');
    });

    /* The region most of the map's business happens in is the one the map is
     * about; anything sitting in a different one is cut off from it. */
    const tally = {};
    points.forEach((p) => p.ids.forEach((id) => { tally[id] = (tally[id] || 0) + 1; }));
    const ids = Object.keys(tally);
    if (ids.length > 1) {
      const main = ids.reduce((a, b) => (tally[a] >= tally[b] ? a : b));
      points.forEach((p) => {
        if (p.ids.length && p.ids.indexOf(+main) < 0) {
          problems.push(name + ': ' + p.what + ' is cut off from the rest of the map');
        }
      });
    }

    return problems;
  }

  /* A map can be internally perfect and still be somewhere nobody can get to.
   * This walks the doors from where a new game starts, which is the only
   * definition of "in the game" that matters. */
  function reachableMaps() {
    const seen = { house: true };
    const queue = ['house'];
    while (queue.length) {
      const id = queue.shift();
      (MAPS[id].warps || []).forEach((w) => {
        if (MAPS[w.to] && !seen[w.to]) { seen[w.to] = true; queue.push(w.to); }
      });
    }
    return seen;
  }

  function validate() {
    const bad = [];

    const reached = reachableMaps();
    Object.keys(MAPS).forEach((k) => {
      if (!reached[k]) bad.push(k + ': no way to walk there from the start of the game');
      if (!(MAPS[k].warps || []).length) bad.push(k + ': has no door out of it');
    });
    Object.keys(MAPS).forEach((k) => {
      const m = MAPS[k];
      const w = m.rows[0].length;
      m.rows.forEach((r, y) => {
        if (r.length !== w) bad.push(k + ' row ' + y + ': ' + r.length + ' wide, want ' + w);
        for (let x = 0; x < r.length; x++) {
          if (!TILES[r[x]]) bad.push(k + ' (' + x + ',' + y + '): no tile called "' + r[x] + '"');
        }
      });
      (m.warps || []).forEach((wp) => {
        if (!MAPS[wp.to]) bad.push(k + ': warp to nothing called ' + wp.to);
      });
      (m.encounters || []).forEach((e) => {
        if (!Dex.byId(e.id)) bad.push(k + ': encounter with nothing called ' + e.id);
      });
      (m.people || []).forEach((p) => {
        (p.party || []).forEach((mon) => {
          if (!Dex.byId(mon[0])) bad.push(k + ': ' + (p.id || p.who) + ' carries nothing called ' + mon[0]);
        });
        if (p.legendary && !Dex.byId(p.legendary)) bad.push(k + ': no legendary called ' + p.legendary);
        const ch = tileAt(m, p.x, p.y);
        if (ch === null) bad.push(k + ': ' + (p.id || p.who) + ' stands off the edge at ' + p.x + ',' + p.y);
        else if (info(ch).solid) bad.push(k + ': ' + (p.id || p.who) + ' stands inside a "' + ch + '" at ' + p.x + ',' + p.y);
      });
      // Twice: once with the road guards gone, and once with them standing
      // wherever they stand after you have earned the badge.
      bad.push.apply(bad, reachability(k, m, false));
      reachability(k, m, true).forEach((p) => {
        if (bad.indexOf(p) < 0) bad.push(p + ' (once the guard has stepped aside)');
      });
      (m.people || []).forEach((p) => {
        if (!p.aside) return;
        const ch = tileAt(m, p.aside.x, p.aside.y);
        if (ch === null || info(ch).solid) {
          bad.push(k + ': ' + (p.id || p.who) + ' steps aside into a wall');
        }
      });
    });
    if (bad.length) console.error('World: ' + bad.length + ' problem(s)\n' + bad.join('\n'));
    return bad;
  }

  function map(id) { return MAPS[id]; }

  function tileAt(m, x, y) {
    if (y < 0 || y >= m.rows.length) return null;
    const row = m.rows[y];
    if (x < 0 || x >= row.length) return null;
    return row[x];
  }

  function info(ch) { return TILES[ch] || { paint: 'grass', solid: true }; }

  return { TILES, MAPS, map, tileAt, info, validate };
})();
