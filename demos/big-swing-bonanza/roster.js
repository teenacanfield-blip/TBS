/* The roster.
 *
 * Everybody here is made up. The game is laid out the way the pitch asked for
 * it — current stars, former stars and legends — but the names, faces and
 * numbers are our own. Real players' names and likenesses are licensed through
 * MLB and the players' union, and a public site cannot borrow them.
 *
 * Stats run 1–10. `pow` is how hard the ball leaves the bat in the derby,
 * `con` is how forgiving the swing is, `spd` is how fast the bean runs in the
 * Golden Bat race. Each player carries one ability for the race.
 */
const ABILITIES = {
  steal: {
    name: 'Base Steal',
    key: 'E',
    cd: 6,
    desc: 'A two-second burst of speed.',
  },
  moonshot: {
    name: 'Moonshot',
    key: 'E',
    cd: 7,
    desc: 'A jump twice as high as anyone else’s.',
  },
  heater: {
    name: 'Heater',
    key: 'E',
    cd: 5,
    desc: 'Throws a fastball down the course. The first runner it hits goes over.',
  },
  gear: {
    name: 'Catcher’s Gear',
    key: 'E',
    cd: 9,
    desc: 'Three seconds where nothing can knock you down.',
  },
  slide: {
    name: 'Headfirst Slide',
    key: 'E',
    cd: 5,
    desc: 'A long, low dive that shoves anyone in the way.',
  },
};

const ERAS = [
  { id: 'current', label: 'Current Stars' },
  { id: 'former', label: 'Former Stars' },
  { id: 'legend', label: 'Legends' },
];

const ROSTER = [
  // ------------------------------------------------------------ current
  { id: 'nova', name: 'Nova Reyes', nick: 'The Comet', era: 'current', num: 7,
    jersey: '#1f6fff', trim: '#ffffff', cap: '#0d2b66', skin: '#c68a5b',
    pow: 8, con: 7, spd: 8, ability: 'steal' },
  { id: 'mack', name: 'Mack Mbeki', nick: 'Mack Truck', era: 'current', num: 44,
    jersey: '#e63946', trim: '#ffd166', cap: '#7a1219', skin: '#7a4a2c',
    pow: 10, con: 5, spd: 4, ability: 'gear' },
  { id: 'kaito', name: 'Kaito Hoshi', nick: 'Shooting Star', era: 'current', num: 17,
    jersey: '#f4f4f4', trim: '#c8102e', cap: '#c8102e', skin: '#e8b98c',
    pow: 9, con: 8, spd: 7, ability: 'heater' },
  { id: 'luna', name: 'Luna Castillo', nick: 'Moonbeam', era: 'current', num: 3,
    jersey: '#6a4cff', trim: '#b9f3ff', cap: '#2a1a7a', skin: '#d9a07a',
    pow: 7, con: 9, spd: 8, ability: 'moonshot' },
  { id: 'zeke', name: 'Zeke Park', nick: 'Zippy', era: 'current', num: 1,
    jersey: '#2ec27e', trim: '#0b3d2a', cap: '#0b3d2a', skin: '#f0c9a0',
    pow: 5, con: 8, spd: 10, ability: 'slide' },
  { id: 'dre', name: 'Dre Holloway', nick: 'Big Dre', era: 'current', num: 99,
    jersey: '#0b1f3a', trim: '#ff8c1a', cap: '#ff8c1a', skin: '#5c3a22',
    pow: 10, con: 6, spd: 5, ability: 'moonshot' },

  // ------------------------------------------------------------- former
  { id: 'rocket', name: 'Ray Ortega', nick: 'Rocket Ray', era: 'former', num: 21,
    jersey: '#ff6b1a', trim: '#1a1a1a', cap: '#1a1a1a', skin: '#c68a5b',
    pow: 8, con: 7, spd: 6, ability: 'heater' },
  { id: 'tide', name: 'Tate Brennan', nick: 'Big Tide', era: 'former', num: 34,
    jersey: '#0f7b8a', trim: '#f2e6c9', cap: '#08434b', skin: '#f2c6a0',
    pow: 10, con: 6, spd: 3, ability: 'gear' },
  { id: 'broom', name: 'Vinny Vale', nick: 'The Broom', era: 'former', num: 5,
    jersey: '#8a1c7c', trim: '#ffd166', cap: '#4a0f42', skin: '#e0ac86',
    pow: 5, con: 9, spd: 8, ability: 'slide' },
  { id: 'kaz', name: 'Kaz Okada', nick: 'Kid Lightning', era: 'former', num: 51,
    jersey: '#1a3fa0', trim: '#ffe14d', cap: '#ffe14d', skin: '#ecc19a',
    pow: 6, con: 10, spd: 9, ability: 'steal' },
  { id: 'dom', name: 'Dom Pappas', nick: 'Big Dom', era: 'former', num: 34,
    jersey: '#b3121f', trim: '#1c2b4a', cap: '#1c2b4a', skin: '#8a5a3a',
    pow: 10, con: 7, spd: 3, ability: 'moonshot' },
  { id: 'glove', name: 'Tito Flores', nick: 'Magic Mitt', era: 'former', num: 1,
    jersey: '#b0b7c3', trim: '#c8102e', cap: '#c8102e', skin: '#6b4226',
    pow: 4, con: 9, spd: 9, ability: 'slide' },

  // ------------------------------------------------------------ legends
  { id: 'hammer', name: 'Hal Hooper', nick: 'The Anvil', era: 'legend', num: 44,
    jersey: '#efe3c8', trim: '#23355c', cap: '#23355c', skin: '#5c3a22',
    pow: 10, con: 8, spd: 5, ability: 'heater', stache: false },
  { id: 'moe', name: 'Moe Malone', nick: 'Moonshot Moe', era: 'legend', num: 3,
    jersey: '#f4ecd8', trim: '#1b1b3a', cap: '#1b1b3a', skin: '#f0c9a0',
    pow: 10, con: 7, spd: 3, ability: 'moonshot', stache: true },
  { id: 'gus', name: 'Gus Kowalski', nick: 'Steady Gus', era: 'legend', num: 4,
    jersey: '#e9dfc4', trim: '#5b3a1a', cap: '#5b3a1a', skin: '#f2c6a0',
    pow: 8, con: 9, spd: 5, ability: 'gear', stache: true },
  { id: 'cyclone', name: 'Celestino Ruiz', nick: 'The Cyclone', era: 'legend', num: 21,
    jersey: '#f1e6cc', trim: '#b0122a', cap: '#b0122a', skin: '#a8703f',
    pow: 7, con: 10, spd: 9, ability: 'steal' },
  { id: 'steam', name: 'Joe Dillard', nick: 'Steam Engine', era: 'legend', num: 9,
    jersey: '#ece2c6', trim: '#2c4d2c', cap: '#2c4d2c', skin: '#e8b98c',
    pow: 9, con: 9, spd: 6, ability: 'heater', stache: false },
  { id: 'flash', name: 'Wendell Brooks', nick: 'Jet Stream', era: 'legend', num: 17,
    jersey: '#efe6d0', trim: '#1d2f6b', cap: '#1d2f6b', skin: '#4f3120',
    pow: 6, con: 9, spd: 10, ability: 'slide', stache: false },
  { id: 'thunder', name: 'Ace Whitaker', nick: 'Old Thunder', era: 'legend', num: 8,
    jersey: '#f3ead2', trim: '#7a1f1f', cap: '#7a1f1f', skin: '#f2c6a0',
    pow: 10, con: 6, spd: 4, ability: 'moonshot', stache: true },
  { id: 'rosa', name: 'Rosa Delgado', nick: 'Queen of Diamonds', era: 'legend', num: 11,
    jersey: '#f6ecd6', trim: '#6a2c91', cap: '#6a2c91', skin: '#c68a5b',
    pow: 7, con: 10, spd: 8, ability: 'steal', stache: false },
  { id: 'streak', name: 'Buck Tanaka', nick: 'Blue Streak', era: 'legend', num: 2,
    jersey: '#eee5cc', trim: '#1f4fa0', cap: '#1f4fa0', skin: '#e8b98c',
    pow: 6, con: 8, spd: 10, ability: 'slide', stache: false },
  { id: 'sugar', name: 'Otis Greenlee', nick: 'Sugar Swing', era: 'legend', num: 24,
    jersey: '#f1e8d0', trim: '#0f6b4a', cap: '#0f6b4a', skin: '#5c3a22',
    pow: 9, con: 9, spd: 7, ability: 'heater', stache: false },
  { id: 'southpaw', name: 'Lefty Pruitt', nick: 'Southpaw', era: 'legend', num: 31,
    jersey: '#efe4c9', trim: '#b35a00', cap: '#b35a00', skin: '#f0c9a0',
    pow: 6, con: 8, spd: 6, ability: 'heater', stache: true },
  { id: 'oak', name: 'Jim Oduya', nick: 'The Oak', era: 'legend', num: 25,
    jersey: '#f0e7cf', trim: '#3d2a14', cap: '#3d2a14', skin: '#4a2e1c',
    pow: 10, con: 7, spd: 4, ability: 'gear', stache: false },
  { id: 'pepper', name: 'Pepper Lomax', nick: 'Pepper', era: 'legend', num: 6,
    jersey: '#f4ebd3', trim: '#c8102e', cap: '#c8102e', skin: '#e0ac86',
    pow: 5, con: 10, spd: 9, ability: 'steal', stache: true },
  { id: 'stretch', name: 'Silas Crane', nick: 'Stretch', era: 'legend', num: 19,
    jersey: '#ede3c8', trim: '#2a5a7a', cap: '#2a5a7a', skin: '#f2c6a0',
    pow: 8, con: 8, spd: 7, ability: 'moonshot', stache: false },
  { id: 'lasso', name: 'Tex Barlow', nick: 'The Lasso', era: 'legend', num: 14,
    jersey: '#f2e9d1', trim: '#8a5a2b', cap: '#8a5a2b', skin: '#d9a07a',
    pow: 8, con: 7, spd: 6, ability: 'gear', stache: true },
  { id: 'birch', name: 'Cornelius Birch', nick: 'Birchwood', era: 'legend', num: 42,
    jersey: '#efe6ce', trim: '#1b1b3a', cap: '#1b1b3a', skin: '#6b4226',
    pow: 9, con: 8, spd: 8, ability: 'slide', stache: false },
];
