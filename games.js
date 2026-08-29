/* The shelf.
 *
 * This is the only file you edit to add, remove or rewrite a game. Everything
 * on the site — the home page, the library grid, the sidebar, the detail page
 * — is built from this list. See README.md in this folder for the walkthrough.
 */

/* ---------------------------------------------------------------- demos */
/* Works in progress. These show up in their own section with a review box
 * underneath each one, so people can tell you what they think before the game
 * is finished.
 *
 * You do not set a path here. Each demo lives in `../demos/<id>/index.html` and
 * the hub finds it on load. `url` is only an override, for a demo kept
 * somewhere unusual.
 *
 * Several of these were saved under a different working title — the name the
 * game shows itself is noted in its blurb, so nobody is confused by the two.
 *
 * `motif` picks the shape drawn on the cover. The ones that exist right now are
 * car, lizard, star, sword, ball and dragon. See art.js to add more.
 */
const DEMOS = [
  {
    id: 'rc-craze',
    title: 'RC Craze',
    tagline: 'Radio-controlled, barely controlled',
    motif: 'car',
    accent: '#ff9d3d',
    accentDark: '#2c1503',
    url: '',
    blurb: 'A 3D remote-control racer. Small car, big corners, trees that stay off the road.',
  },
  {
    id: 'liz',
    title: 'Liz',
    tagline: 'Pick a colour, roam the island',
    motif: 'lizard',
    accent: '#5ce08a',
    accentDark: '#08210f',
    url: '',
    blurb: 'Shows itself as Scaly Roam. Choose your lizard’s colour and wander a 3D island.',
  },
  {
    id: 'ninja-wing-wing',
    title: 'Ninja Wing Wing',
    tagline: 'Throw first, land later',
    motif: 'star',
    accent: '#ff5f6d',
    accentDark: '#2a0409',
    url: '',
    // Not built yet — only the sprite sheet on the Desktop exists so far. It
    // turns playable the moment demos/ninja-wing-wing/index.html is there.
    blurb: 'A ninja, a pair of wings, and a lot of shuriken.',
  },
  {
    id: 'legend-cart',
    title: 'Legend Cart',
    tagline: 'A rock & roll combat racer',
    motif: 'sword',
    accent: '#ffd166',
    accentDark: '#2b1e02',
    url: '',
    blurb: 'Shows itself as Hyrule Speedway. Pick a racer and fight your way around the track.',
  },
  {
    id: 'animabal1',
    title: 'Animabal1',
    tagline: 'Three innings, one creature',
    motif: 'ball',
    accent: '#7ce6ff',
    accentDark: '#04212b',
    url: '',
    blurb: 'Shows itself as Diamond At-Bat 3D. Pick a creature and bat for three innings.',
  },
  {
    id: 'dragons-last-breath',
    title: 'The Dragon’s Last Breath',
    tagline: 'One breath left. Make it count.',
    motif: 'dragon',
    accent: '#c77dff',
    accentDark: '#1d0a2b',
    url: '',
    blurb: 'A tiny adventure through Emberfen Vale — the last dragon, and the last thing it has to give.',
  },
];

/* ---------------------------------------------------------------- games */

const GAMES = [
  {
    id: 'the-13-dynasties',
    title: 'The 13 Dynasties',
    suffix: '.net',
    tagline: 'A survival story',
    // Where the playable game lives, relative to this folder.
    url: './the-13-dynasties/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#5ce08a',
    accentDark: '#1d5136',
    genres: ['Survival', 'Top-down', 'Crafting', 'Co-op'],
    short:
      'Chop, mine, build and eat your way down through three worlds, each one ' +
      'meaner than the last. Then take a friend down with you.',
    about: [
      'A top-down pixel-art survival game. You start with nothing but your hands, a ' +
      'house that needs repairing and a family to bring home. Fell trees, break rock, ' +
      'cook food, and put up walls before the light goes — wolves come out after dark.',
      'Three worlds stacked on top of each other, and you have to earn your way down ' +
      'each one. Three Wardens in the Undergrove hold a Dynasty Seal apiece, and all ' +
      'three open the Sealed Stair. Below that, the Deep Hollow: crystal grows nowhere ' +
      'else, and the Goblin King’s throne doors are barred from the inside until you ' +
      'have an iron blade to lever them apart.',
      'The King fights in three phases. He reddens as he loses blood, flattens the ' +
      'ground around him on a wind-up you can see and run out of, calls his guard in ' +
      'when he is hurt, and stops holding back for the last quarter of his health.',
      'Dying is not a wipe. Get Back Up revives you at the house with your tools, ' +
      'buildings, level and world progress intact — it just costs half the raw ' +
      'materials you were carrying.',
    ],
    features: [
      'Single player',
      'Two-player online co-op',
      'Same-computer co-op',
      'Three worlds',
      'Three Warden mini-bosses',
      'Three-phase final boss',
      'Tools to Tier 3',
      'Autosave',
      'Touch controls',
      'Unlockable-free skins',
    ],
    controls: [
      ['WASD', 'Move'],
      ['Shift', 'Sprint'],
      ['Space', 'Gather / attack'],
      ['F', 'Eat'],
      ['B', 'Use bandage, then med kit'],
      ['E', 'Interact — repair, sleep, travel, free Ned, upgrade the bench, open doors'],
      ['C', 'Crafting menu'],
      ['I', 'Inventory'],
      ['1–6', 'Place wall / stone wall / campfire / torch / bedroll / workbench'],
      ['J', 'Play Together'],
      ['K', 'Skins'],
      ['P / L', 'Save / load'],
      ['X', 'Skip cutscene'],
    ],
    stagesTitle: 'The three worlds',
    stages: [
      ['1', 'The Surface', 'Slow hunger, fast healing. Cave guards by day, wolf packs after dark'],
      ['2', 'The Undergrove', 'Hunger twice as fast, barely any healing. Thugs, spitters, brutes, three Wardens'],
      ['3', 'The Deep Hollow', 'Hunger three times as fast and no healing at all. Crystal, elites, and the Goblin King'],
    ],
    notes: [
      'Beds are a night’s rest, not a fast-forward — you can only sleep after dark, and it costs food.',
      'The ore chain runs stone pickaxe → iron → iron pickaxe → crystal → iron sword. There is no skipping a link.',
      'Saves live in your own browser, on your own device. Clearing browser data erases them.',
      'Online co-op is peer-to-peer. Some school and guest wifi blocks it — Same Computer mode always works.',
    ],
  },

  {
    id: 'ugg-and-the-undersaucer',
    title: 'Ugg & the Undersaucer',
    suffix: '',
    tagline: 'The cave lies to you',
    url: './ufo-caveman/game%20load%20up!.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#7ce6ff',
    accentDark: '#2b3f7a',
    genres: ['Platformer', 'Sidescroller', 'Precision'],
    short:
      'A caveman with a flying saucer bolted to his underside, 50 levels deep in ' +
      'a cave that cheats. Fifty levels, five stages, one very confused Ugg.',
    about: [
      'A sidescrolling platformer about walking, jumping and flying through a cave that ' +
      'is actively lying to you. Platforms that are not there. Controls that swap ' +
      'themselves. Gravity that gives up. Fifty levels across five stages, joined by a ' +
      'world map you walk along.',
      'The saucer is your second verb: hold it down to hover, and watch the stamina — ' +
      'it only refills on the ground. Ugg’s beard knots up as it drains, so you can ' +
      'read your fuel without looking at the HUD.',
      'Shiny rocks buy chips on the Mother Board, a printed circuit you power up one ' +
      'trace at a time. The last two chips switch off the lies: the Scanner reveals fake ' +
      'tiles, the Stabilizer stops the control-scrambling. The cave is allowed to cheat, ' +
      'and the board is how you cheat back.',
    ],
    features: [
      'Single player',
      '50 levels across 5 stages',
      'World map',
      '14 upgrade chips',
      'Character Lab skin editor',
      'Touch controls',
    ],
    controls: [
      ['← → or A D', 'Walk, and move along the world map'],
      ['Space / W / ↑', 'Jump, and select on menus and the map'],
      ['Shift / S / ↓', 'Fire the saucer — hold to hover'],
      ['R', 'Back to the last checkpoint'],
      ['B', 'Mother Board (upgrades), from the map'],
      ['C', 'Character Lab (skin editor)'],
      ['M', 'Mute'],
      ['Esc', 'Level → map → title'],
    ],
    stagesTitle: 'The five stages',
    stages: [
      ['1', 'The Crust', 'Fake platforms, phantom platforms, critters, reversed controls'],
      ['2', 'The Mirror Shelf', 'Mirrored screens, conveyors, sawblades, input delay'],
      ['3', 'Lightless Deep', 'Darkness, strobing geometry, swapped buttons'],
      ['4', 'The Upside', 'Flipped gravity, wind, heavy and low gravity'],
      ['5', 'The Mothership', 'Crushers, boulders, doppelgängers, everything at once'],
    ],
    notes: [
      'Every level banks only its best haul of rocks, once — exploring pays, grinding does not.',
      'Skins export as a short code you can paste to a friend.',
    ],
  },

  {
    id: 'roaminals',
    title: 'Roaminals',
    suffix: '',
    tagline: 'Catch the hotel',
    url: './roaminals/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#86c06c',
    accentDark: '#1d3320',
    // Extra buttons on the game's page, beside Play and Pin.
    extras: [{ label: 'Art book', url: './roaminals/art-book.html' }],
    genres: ['Monster catching', 'Turn-based', 'Pixel art', 'Top-down'],
    short:
      'A monster-catching game in the shape of the handheld ones, set entirely ' +
      'inside one very large building: a hotel shut for forty years.',
    about: [
      'The ghosts in the Rothsay Grand could not stay ghosts, so each one moved into ' +
      'an object — a mop, a boiler, a ledger, a chandelier, a bell — and the object ' +
      'moved into an animal that had wandered in out of the cold. That fusion is a ' +
      'Roaminal, and what the ghost possessed is the creature’s type. It is why the ' +
      'type chart is a wheel of household things instead of fire and water.',
      'You are Max, fifteen, and the only applicant for night porter: ten floors, a ' +
      'satchel of jars, and a lift that only stops where you have a key. Beat the ' +
      'staff ghost holding a floor and the next one opens up.',
      'One generation, forty-four species, all catchable. Commons fill the floors in ' +
      'lines that evolve by level. Five ultra rares turn up about one encounter in ' +
      'forty and arrived already finished. Three legendaries exist once each, waiting ' +
      'on a fitting rather than in the dust — the desk bell, the furnace door, and the ' +
      'clock on the roof. Every wild creature rolls for a shiny coat.',
      'Every sprite is a four-tone grid pointed at a palette, the way the handhelds did ' +
      'it, so a creature is drawn twice over: the animal in a real fur or feather ' +
      'colour, and the object possessing it glowing in that object’s own material. A ' +
      'line’s stages are the same coat lifted or darkened, a shiny is that coat walked ' +
      'round the colour wheel, and each of the ten floors carries its own palette.',
      'The floors are laid out by a seeded generator, so the hotel is big, is the same ' +
      'hotel for everybody, and no room, box or member of staff can ever be sealed off.',
    ],
    features: [
      'Single player',
      '44 species, all catchable',
      'Shiny, ultra rare and legendary',
      'Evolution by level',
      'Ten floors',
      '10 staff-ghost bosses',
      'Ten-type wheel',
      'Save to your browser',
      'Touch controls',
    ],
    controls: [
      ['Arrows / WASD', 'Walk, and move any cursor'],
      ['Z / Space', 'A — talk, open, confirm'],
      ['X / Esc', 'B — back'],
      ['Enter', 'Start — Max’s menu'],
    ],
    stagesTitle: 'The building',
    stages: [
      ['1F', 'The Lobby', 'Where you start. Bellhop Oskar holds the first key'],
      ['B1', 'Laundry', 'Lint, suds, and Laundress Maud'],
      ['B2', 'Boiler Room', 'The Bright Penny, and a furnace with something in it'],
      ['2F', 'Kitchens', 'Cutlery, a walk-in freezer, Chef Anouk'],
      ['3F', 'Guest Rooms', 'Velvet, room thirteen, Housekeeper Vane'],
      ['4F', 'Ballroom', 'Eight bars of music since the lights went out'],
      ['5F', 'Offices', 'Every guest since 1912, filed'],
      ['6F', 'Nursery', 'The toys are asleep. Were asleep'],
      ['7F', 'Conservatory', 'Glass held; everything under it grew back meaner'],
      ['R', 'The Roof', 'The Night Manager, and the clock'],
    ],
    notes: [
      'Each type beats the two that follow it on the Ledger Wheel and struggles against the two before it. It is printed on the lobby wall.',
      'Dust drifts are this game’s tall grass — walk through one and something in it wakes up.',
      'Jars are generous. A common goes in about two times in five at full health, and better than nine in ten once it is worn down — health is the big lever, and the jar multiplies it.',
      'Faint your whole party and you come to at the housekeeping cart, minus half your tokens. Nothing else is lost.',
      'A legendary you beat or run from goes back into its fitting, so it can never be missed for good.',
    ],
  },
];
