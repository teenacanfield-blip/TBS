/* The shelf.
 *
 * This is the only file you edit to add, remove or rewrite a game. Everything
 * on the site — the home page, the library grid, the sidebar, the detail page
 * — is built from this list. See README.md in this folder for the walkthrough.
 */

/* -------------------------------------------------------------- ratings */
/* Age ratings, youngest first. Every game and demo carries a `rating` id from
 * this list, and an optional `ratingNotes` saying *why* — a letter on its own
 * tells a parent nothing.
 *
 * `min` is the age the rating is aimed at; it is what the Ratings page sorts
 * by, so adding a rating in the middle later does not need any other change.
 *
 * Nothing here is an official ESRB or PEGI rating — those cost money and are
 * for boxed games. These are our own honest labels, in the shape people already
 * recognise.
 */
const RATINGS = [
  {
    id: 'everyone',
    short: 'E',
    label: 'Everyone',
    age: 'All ages',
    min: 0,
    blurb: 'Fine for anybody. No fighting worth the name, nothing frightening.',
  },
  {
    id: 'e10',
    short: '10+',
    label: 'Everyone 10+',
    age: '10 and up',
    min: 10,
    blurb:
      'Cartoon scrapping, mild peril, the odd spooky corner. About what a ' +
      'Saturday morning cartoon does.',
  },
  {
    id: 'teen',
    short: 'T',
    label: 'Teen',
    age: '13 and up',
    min: 13,
    blurb:
      'Rougher violence, darker subjects, or language a younger player should ' +
      'not meet yet.',
  },
  {
    id: 'adult',
    short: 'A',
    label: 'Adult',
    age: '18 and up',
    min: 18,
    blurb: 'Grown-ups only. Strong content of a kind children should not see.',
  },
];

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
 * car, lizard, star, sword, ball, dragon, pencil, batter and card. See
 * art.js to add more.
 */
const DEMOS = [
  {
    id: 'rip-and-go',
    rating: 'everyone',
    ratingNotes: ['Cartoon battling'],
    title: 'Pokémon Rip and Go',
    tagline: 'One of three, one road out, and 1089 ways to splice them.',
    motif: 'ball',
    accent: '#5ce08a',
    accentDark: '#08210f',
    url: '',
    blurb:
      'A fan-made creature collector with a splicer in it: thirty-three ' +
      'creatures, and one thousand and eighty-nine fusions you can make out ' +
      'of them. Put the head of one on the body of another and you get a ' +
      'real creature — its own name, its own sprite cut from both halves, ' +
      'the attack and speed of the head, the health and defence of the body, both ' +
      'their types and both their learnsets. Feed it back in and it comes ' +
      'apart again. A fusion also knows a STRIKE, a heavy move of its own ' +
      'type that nothing unspliced can learn, and once you have a badge the ' +
      'long grass starts turning up things that are already two creatures. ' +
      'Around that: the whole game. A ' +
      'town with one road out of it, a professor with three on a table, a ' +
      'boy your age who takes the one that beats yours, and long grass ' +
      'between you and everywhere else. Walk into it, wear something down, ' +
      'throw a ball, and keep it. Thirty-three creatures in ten families, ' +
      'each one drawn from scratch rather than recoloured — a family grows ' +
      'into a different animal, picks up a second type on the way, and the ' +
      'nine-type chart is the whole puzzle of a gym. Six travel with you, ' +
      'the rest wait in the box, and every move has PP, which is what makes ' +
      'the walk between two towns a decision. Three badges, a cave you ' +
      'cannot see the far side of, and something standing at the end of the ' +
      'keep that has been standing there a while. ' +
      'The card shop is still open in Willowbank, and it does two things now. ' +
      'Buy a pack, turn eight over, keep five, and the rest come apart for ' +
      'coins — or go through to the back room, where a pack battle is the ' +
      'whole match: a sealed pack each, five kept out of eight, no team, no ' +
      'bag, no running. Every card enters at fighting weight, so a lucky ' +
      'legendary is a good card rather than a won game, and what decides it ' +
      'is the five you kept and the chart. Every gym leader will take the ' +
      'badge off you that way too, out of a pack stacked toward their own ' +
      'type, if you would rather not bring a team at all. ' +
      'Give the site a free Supabase project and a ladder appears in the ' +
      'menu: teams other people have posted, and a match against any of ' +
      'them. Without one the game is exactly as it is now and says so. ' +
      'Two people and no server is still multiplayer, and it works twice ' +
      'over. The menu turns your team into about twenty letters, and anyone ' +
      'who types that back in gets your six to fight — full health both ' +
      'sides, nothing changes hands, nothing sent anywhere. And every draft ' +
      'has a six-character seed: give somebody yours and the same eight ' +
      'cards fall out of their pack. Keep five each, swap the codes the game ' +
      'hands you, and fight the other one\'s draft. Same pack, two reads of ' +
      'it, and the only thing between you is which five you trusted. ' +
      'Nothing is fetched — the creatures and ' +
      'the people are typed out as letters, one character per pixel, and ' +
      'the sound is oscillators. If you would rather they looked like ' +
      'something else, the Sprite Lab takes your own PNG sheet, cuts it ' +
      'into frames, and lets you point a frame at any of eighty-nine ' +
      'targets — every creature and every person in the game.',
  },
  {
    id: 'the-show',
    rating: 'everyone',
    ratingNotes: ['Cartoon action'],
    title: 'The Show',
    tagline: 'Sandlot to the big leagues',
    motif: 'batter',
    accent: '#ffd166',
    accentDark: '#2b2103',
    url: '',
    blurb:
      'A baseball platformer, and a straight answer to what a kid in a dirt ' +
      'lot is actually playing for: eight leagues, each one a level, ending ' +
      'at a big-league plate with a closer on the mound. Power-ups come out ' +
      'of crates — a helmet that takes one hit for you, cleats, gum you can ' +
      'float on, an arm that throws. The bat is the real idea, though. Half ' +
      'the things in this game throw something at you, and a swing timed to ' +
      'the pitch sends it back twice as fast through whatever is standing ' +
      'there. The closer cannot be touched by anything except his own ' +
      'fastball, returned.',
  },
  {
    id: 'rc-craze',
    rating: 'everyone',
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
    rating: 'everyone',
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
    rating: 'e10',
    ratingNotes: ['Cartoon fighting'],
    title: 'Ninja Wing Wing',
    tagline: 'Throw first, land later',
    motif: 'star',
    accent: '#ff5f6d',
    accentDark: '#2a0409',
    url: '',
    // Where the fighters are drawn and named. Kept out of the game on purpose:
    // making a character and playing as one are different jobs.
    extras: [{ label: 'Character Lab', url: './demos/ninja-wing-wing/character-lab.html' }],
    blurb:
      'A two-player fighter. Platforms, damage that builds, and a KO when ' +
      'somebody leaves the screen — with a roster to pick from and a block to ' +
      'spend. Every shuriken shoves you the other way, so throwing downward is ' +
      'how you climb. Same keyboard, or online with a room code.',
  },
  {
    id: 'legend-cart',
    rating: 'e10',
    ratingNotes: ['Cartoon combat'],
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
    rating: 'everyone',
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
    rating: 'everyone',
    ratingNotes: ['Mild fantasy peril'],
    title: 'The Dragon’s Last Breath',
    tagline: 'One breath left. Make it count.',
    motif: 'dragon',
    accent: '#c77dff',
    accentDark: '#1d0a2b',
    url: '',
    blurb: 'A tiny adventure through Emberfen Vale — the last dragon, and the last thing it has to give.',
  },
  {
    id: 'woo',
    rating: 'teen',
    ratingNotes: ['Cartoon violence', 'Murder mystery themes'],
    title: 'Woo',
    tagline: 'A masquerade. A guest list. A wolf who RSVP’d yes.',
    motif: 'mask',
    accent: '#c81e3a',
    accentDark: '#230910',
    url: '',
    blurb:
      'A 3D stealth murder mystery, played from the wrong side of the mystery. You are a ' +
      'wolf at a masquerade in a low-poly manor, and the guest list is the hit list: nine ' +
      'animals — rabbits, ducks, pigs, a mouse, a deer, a goose — wandering the ballroom, ' +
      'the library, the kitchen and the conservatory. Get one alone, unwatched, and strike. ' +
      'Get seen, or leave a body somewhere it can be found, and the Heat meter climbs. Six ' +
      'quiet kills unlocks the front door, and Heat maxing out ends the night for you instead ' +
      '— the band stops, every head turns. ' +
      'An owl detective in a deerstalker hat is somewhere in the house the whole time, calm ' +
      'and slow until a scream or a discovered body puts him on your trail — at which point ' +
      'he is fast enough that outrunning him in a straight line is not a plan, only losing ' +
      'him around a corner is. Six hiding spots — two coat closets, a ' +
      'reading nook, a pantry, two garden hedges — are the other half of the game: drag a body ' +
      'into one and it is gone for good, never found, never counted against you. Leave it on ' +
      'the ballroom floor instead and whoever finds it goes running to report it. ' +
      'Walls and furniture actually block sight, not just movement, so a kill made behind a ' +
      'bookshelf is a different bet than one made in the middle of the dance floor. Heat cools ' +
      'on its own if nothing goes wrong for a few seconds, so patience is the whole skill here ' +
      'as much as timing is.',
  },
];

/* ---------------------------------------------------------------- games */

const GAMES = [
  {
    id: 'the-13-dynasties',
    rating: 'e10',
    ratingNotes: ['Fantasy violence', 'Mild peril'],
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
    rating: 'e10',
    ratingNotes: ['Cartoon peril'],
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
    rating: 'e10',
    ratingNotes: ['Mild spooky themes', 'Cartoon battling'],
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
      'Team of 10, plus 5 storage boxes',
      'Ten floors',
      '10 staff-ghost bosses',
      'Ten-type wheel',
      'Skin Lab — repaint Max and your Roaminals',
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

  {
    id: 'big-swing-bonanza',
    rating: 'everyone',
    ratingNotes: ['Cartoon slapstick', 'In-game shop — earned tokens only, no real money'],
    title: 'Big Swing Bonanza',
    suffix: '',
    tagline: 'Sixteen beans, one golden bat',
    url: './demos/big-swing-bonanza/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#ffd23f',
    accentDark: '#2b2103',
    genres: ['Party', 'Sports', '3D platformer', 'Knockout'],
    short:
      'Jelly-bean ballplayers in a home run derby, and a sixteen-bean knockout ' +
      'race to the golden bat across twenty-five obstacle courses.',
    about: [
      'Home Run Derby first. Aim the contact circle over where the pitch will cross the ' +
      'plate, swing as it arrives, and watch it go. Early swings pull the ball, late ones ' +
      'push it, and hitting under or over it decides between a moonshot and a grounder. ' +
      'Seven outs each against the CPU — Rookie, All-Star or Legend — or a friend on the ' +
      'same keyboard, with one golden pitch a round that counts twice.',
      'Then the Golden Bat Bonanza, a knockout tournament in three rounds. Sixteen beans ' +
      'race an obstacle course and the first ten across the line go through. A survival ' +
      'round on a floating diamond, with one giant bat sweeping low and one sweeping high, ' +
      'leaves five. The final is a harder course with the golden bat on a pedestal at the ' +
      'end, and the first hand on it wins.',
      'Twenty-five courses built from fifteen kinds of obstacle — spinning bats to jump or ' +
      'dive under, bats swinging from the sky, rolling baseballs, stepping-stone bases, ' +
      'sliding and rising platforms, trampolines, pitching machines, backwards conveyor ' +
      'belts. Any of them can be played on its own, too.',
      'Twenty-eight invented players across today’s stars, former stars and legends, each ' +
      'with a race ability: a burst of speed, a moonshot jump, a thrown fastball, catcher’s ' +
      'gear, a headfirst slide. Winning pays tokens, and tokens buy gear that adds to your ' +
      'stats, card packs for a binder, and skins.',
    ],
    features: [
      'Single player',
      'Two players on one keyboard (derby)',
      'Home Run Derby vs CPU, three levels',
      'Three-round knockout tournament',
      '25 obstacle courses',
      '28 players, 5 abilities',
      'Token shop: gear, packs, skins',
      'Card binder',
      'Touch controls',
      'Save to your browser',
    ],
    controls: [
      ['Mouse / arrows', 'Derby — aim the contact circle'],
      ['Click / Space', 'Derby — swing'],
      ['F (hold)', 'Derby — fast-forward the CPU'],
      ['WASD / arrows', 'Race — run'],
      ['Space', 'Race — jump'],
      ['Shift / Q', 'Race — dive, under high bats and into other runners'],
      ['E', 'Race — your ability'],
      ['M', 'Mute'],
      ['Esc', 'Pause'],
    ],
    stagesTitle: 'The tournament',
    stages: [
      ['1', 'The Race', 'Sixteen beans, one course. The first ten across the line go through'],
      ['2', 'Batter Up Survival', 'Two giant bats sweep a floating diamond, faster and faster. Last five standing'],
      ['F', 'The Final', 'A harder course, and the golden bat at the end of it. First hand on it wins'],
    ],
    notes: [
      'Every player is invented. Real players’ names and likenesses are licensed, and this is a free game on a public site.',
      'Tokens are only ever won in the game. Nothing in it costs real money.',
      'Gear counts in races and against the CPU, never in the two-player derby.',
      'Owning a player’s card makes them +1 in every stat when you play as them, +2 for a holo.',
      'Saves live in your own browser, on your own device. Clearing browser data erases them.',
      'It loads its 3D engine from the internet when it starts, so wifi that blocks CDNs will leave it blank.',
    ],
  },

  {
    id: '2b-or-not-2b',
    rating: 'everyone',
    title: '2B or Not 2B',
    suffix: '',
    tagline: 'The long way back to the desk',
    url: './demos/2b-or-not-2b/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#f5c518',
    accentDark: '#2a2103',
    genres: ['3D platformer', 'Climbing', 'Collectathon'],
    short:
      'A pencil rolled off the desk. Ninety units of classroom stand between it and ' +
      'the groove at the top.',
    about: [
      'A 3D platformer about a pencil that rolled off a school desk and has ninety units ' +
      'of classroom to climb to get back into the groove at the top of it — up the ' +
      'backpack, the chair, the backrest, under the desk and through the drawer.',
      'A pencil has a sharp end, so it can stab into anything soft — cork, vinyl, chewing ' +
      'gum, the back of a drawer — and kick off again. Every hold costs sharpness, at ' +
      'zero nothing holds, and only a sharpener gives it back. Sharpeners are the ' +
      'checkpoints, too.',
      'Falling is not death; it just puts you on the lino again. Forty-four things to earn ' +
      'a sticker for, and it brings its own 3D renderer, so there is no CDN and nothing to ' +
      'fetch — it works on wifi that blocks everything else.',
    ],
    features: [
      'Single player',
      'Wall-stab and wall-kick climbing',
      'Spin jump, dash and dive',
      '44 stickers to earn',
      'Sharpener checkpoints',
      'Works with no internet',
      'Touch controls',
    ],
    controls: [
      ['W A S D', 'Run, in whatever direction the camera is facing'],
      ['Mouse', 'Look. Click once to hold the camera'],
      ['Space', 'Jump. Again in the air for a spin, once per flight'],
      ['Space at a wall', 'Kick off it, if your tip is in it'],
      ['Shift / E', 'Dash. One per flight, back when you land'],
      ['Ctrl / Q / F', 'Dive tip-first'],
      ['R', 'Back to the last sharpener'],
      ['M', 'Mute'],
      ['Esc', 'Pause'],
    ],
    stagesTitle: 'The climb',
    stages: [
      ['1', 'The Lino', 'Where you land, and where every fall puts you back'],
      ['2', 'The Backpack', 'The first way up, 11 units off the floor'],
      ['3', 'The Chair', 'Up to 31'],
      ['4', 'The Backrest', 'Up to 52'],
      ['5', 'Under the Desk', 'Up to 72'],
      ['6', 'The Drawer', 'Up to 78'],
      ['7', 'The Desktop', 'Ninety up, and the groove where a pencil belongs'],
    ],
    notes: [
      'Hold toward a soft wall in mid-air and the pencil sticks into it. It slides, and it costs sharpness.',
      'Stickers stay on the chart between goes.',
    ],
  },

  {
    id: 'floodlight',
    rating: 'e10',
    ratingNotes: ['Cartoon paint blasting — players get soaked, not hurt', 'Online play with friends (no chat)'],
    title: 'Floodlight',
    suffix: '',
    tagline: 'Kick the ball. Soak the other team.',
    url: './floodlight/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#ff7a1a',
    accentDark: '#2a1200',
    genres: ['Sports', 'Shooter', '3D', 'Online'],
    short:
      'Four-a-side football with paint blasters: you shoot the other team and kick ' +
      'the ball. Then a whole town to roam between matches.',
    about: [
      'A third-person team game. You carry a paint blaster and you play football, and ' +
      'the one rule that holds it together is that paint never moves the ball — you ' +
      'shoot opponents, you kick the ball. Get hit and paint splats across your screen ' +
      'until you can hardly see; keep getting hit and you are soaked and respawn on ' +
      'your side’s shielded balcony.',
      'The goals are raised up on terraces at each end, so most goals are chips: aim ' +
      'up to loft it, hold the kick to power it. Bots fill any empty places, from a ' +
      '1 vs 1 up to 4 vs 4, in four grounds — Gloop Garden in the hills, Sunset Sands ' +
      'by the sea, Snowpeak in the snow, and Harbour Lights after dark.',
      'The Story is one summer in the town of Glowmere: Gloop Garden’s four floodlight ' +
      'towers have gone dark, and every match you win relights one, up to a final ' +
      'played at night under all four.',
      'Then there is Glowmere itself, to roam at day, sunset or night: a square with a ' +
      'clock tower, a park with a football cage and a pond, a basketball court, a train ' +
      'running over the streets, and launch pads up onto the rooftops. The townsfolk ' +
      'have jobs — deliver parcels, repaint faded murals with your blaster — and ' +
      'challenges: a shootaround, a goal rush, and a race over the railway. Thirty ' +
      'Sparks are hidden round town, and coins buy hats, blasters and kits.',
    ],
    features: [
      'Single player with bots',
      'Online with friends — share a room code',
      'Story mode',
      'Free roam town',
      'Practice and target practice',
      'Four grounds',
      'Basketball, jobs, races',
      'Character Locker',
      'Xbox controller support',
    ],
    controls: [
      ['W A S D', 'Move'],
      ['Mouse', 'Aim. Click the game to capture the mouse'],
      ['Left click', 'Shoot paint'],
      ['E', 'Kick — hold to power up, aim up to chip. In town: talk, and throw a basketball'],
      ['Space', 'Jump'],
      ['Shift', 'Sprint'],
      ['Tab', 'Scores'],
      ['M', 'Mute'],
      ['Esc', 'Pause'],
    ],
    stagesTitle: 'The Story',
    stages: [
      ['1', 'First Spark', '1 vs 1 against Rex'],
      ['2', 'Two’s Company', '2 vs 2 with Pip'],
      ['3', 'Long Range', '3 vs 3, and watch out for Mika'],
      ['4', 'Holding the Line', '4 vs 4 with the full squad'],
      ['5', 'Floodlight', 'The final, at night, under the lights'],
    ],
    notes: [
      'This is a big 3D game: it wants a laptop or desktop with a decent graphics card, and the first load fetches about 19 MB.',
      'Online play is peer-to-peer: the host makes a room, friends type its six-letter code. Some school and guest wifi blocks it.',
      'Your character, coins and progress are saved in your own browser on this device.',
      'Basketball in town: walk into a ball to pick it up, hold E and let go while the ring is in the green.',
    ],
  },
  {
    id: 'kaido-festival',
    rating: 'everyone',
    ratingNotes: ['Car crashes and smash-ups, nobody gets hurt'],
    title: 'Kaido Festival',
    suffix: '',
    tagline: 'Open roads across a festival Japan',
    url: './kaido-festival/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#ff2e88',
    accentDark: '#3a0a24',
    genres: ['Racing', 'Open world', 'Driving'],
    short:
      'Drive a hand-built slice of Japan, from the coast highway to a neon city ' +
      'and a mountain pass. Race the locals and smash everything in between.',
    about: [
      'An open-world driving festival. Free-roam the Shiokaze Coast, the rice ' +
      'paddies of the Inaho Plains, the Momiji Hills, Kaidō City and the Oni Pass, ' +
      'with weather that rolls in on its own and a day that turns into night.',
      'Road races, off-road trails, drift zones, speed traps, danger-sign jumps and ' +
      'XP boards to smash. Three drag strips — an eighth mile through a container ' +
      'yard, the quarter mile at Inaho Dragway and a half mile down an airfield ' +
      'runway — with 1v1s for credits or pink slips.',
      'Twelve cars to earn or buy, from a kei van to a GT1 racer, each with ' +
      'upgrades, paints and liveries. Hit things and they break: fences, crates, ' +
      'signs, vending machines, and your own car until you repair it.',
    ],
    features: [
      'Single player',
      'Open world',
      '12 cars with upgrades',
      'Road, off-road and drag racing',
      'Rival duels for pink slips',
      'Five AI difficulty levels',
      'Day, night and weather',
      'Cockpit camera',
      'Controllers and racing wheels',
      'Autosave',
    ],
    controls: [
      ['W / ↑', 'Throttle'],
      ['S / ↓', 'Brake, then reverse'],
      ['A D / ← →', 'Steer'],
      ['Space', 'Handbrake'],
      ['Hold R', 'Rewind'],
      ['E / Enter', 'Start an event at a marker'],
      ['C', 'Change camera, including the cockpit'],
      ['M', 'Map and fast travel'],
      ['G', 'Garage'],
      ['Backspace', 'Back onto the road, and repair'],
      ['X', 'Weather'],
      ['V', 'Heavy effects on or off'],
      ['Esc', 'Pause'],
    ],
    stagesTitle: 'The map',
    stages: [
      ['1', 'Shiokaze Coast', 'The coast highway and the festival site'],
      ['2', 'Inaho Plains', 'Rice paddies, the Inaho Dragway and the Sora Airfield runway'],
      ['3', 'Momiji Hills', 'Dirt trails and rally stages'],
      ['4', 'Kaidō City', 'A neon city block and the Tetsu Yard just outside it'],
      ['5', 'Oni Pass', 'The mountain road and its drift zones'],
    ],
    notes: [
      'Saves live in your own browser, on your own device. Clearing browser data erases them.',
      'Xbox, PlayStation and Nintendo controllers work, and so do Xbox and PlayStation racing wheels — without force feedback, which browsers cannot send.',
      'Online convoys and the auction house only work in the Claude-hosted version, so here the game is single-player.',
      'If it runs slowly, press V to switch off the heavier effects.',
    ],
  },
  {
    id: 'laser-tag',
    collection: 'dinorun',
    rating: 'e10',
    ratingNotes: ['Laser tag — a tag puts a player out of the round, nobody gets hurt'],
    title: 'Laser’s Tag',
    suffix: '',
    tagline: 'One tag and you are out — 1 v 1 up to 5 v 5.',
    url: './dinorun.games/laser-tag/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#4d9bff',
    accentDark: '#0b1a33',
    genres: ['Shooter', '3D', 'Arena'],
    short:
      'Laser tag in a blacklit arena, from 1 v 1 up to 5 v 5, played over the shoulder ' +
      'by the Floodlight players in glowing team suits.',
    about: [
      'Blue against red in an arena of neon-edged walls to hide behind, from 1 v 1 up to ' +
      '5 v 5, with bots in every other place. A tag puts an opponent out of the round; ' +
      'your vest takes five tags on Easy, three on Normal and two on Hard. Last team ' +
      'standing wins.',
      'Abilities mode adds powers. Spider climbs any wall in the arena, clings to it while ' +
      'you shoot, or stands right on top. Gecko turns you invisible for ten seconds so ' +
      'nobody can lock on to you — and some of the red team can do that too.',
      'Wins pay coins, and the shop turns them into new blasters — the rapid Zapper, the ' +
      'long-range Longshot, the three-beam Triple Shot and the Golden Blaster — and suit ' +
      'patterns and vest lights. Practice is sixty seconds against targets that never ' +
      'shoot back.',
    ],
    features: [
      'Single player with bots',
      '1 v 1 up to 5 v 5',
      'Abilities: Spider and Gecko',
      'Practice mode',
      'Easy, Normal and Hard',
      'Shop: blasters, suit patterns, vest lights',
      'Play as a boy or a girl',
      'Xbox controller support',
    ],
    controls: [
      ['W A S D', 'Move'],
      ['Mouse', 'Aim. Click the game to capture the mouse'],
      ['Left click / Space', 'Fire, or hold to keep firing'],
      ['Shift', 'Sprint'],
      ['E', 'Gecko: turn invisible'],
      ['W', 'Spider: walk into a wall to climb it, walk away to drop'],
      ['← / →', 'Turn without the mouse'],
      ['Esc', 'Pause'],
    ],
    notes: [
      'It loads its 3D engine from the internet when it starts, so wifi that blocks CDNs will leave it blank.',
      'It wants a laptop or desktop with a mouse; there are no touch controls yet.',
      'Coins and everything you buy are saved in this browser, on this device.',
    ],
  },
  {
    id: 'patrol-rush',
    collection: 'dinorun',
    rating: 'e10',
    ratingNotes: ['Cops and robbers with cars — robberies, rams and spin-outs, nobody gets hurt'],
    title: 'Patrol Rush',
    suffix: '',
    tagline: 'Cops or robbers in a city that never sleeps.',
    url: './dinorun.games/patrol-rush/index.html',
    developer: 'Thirsty Bear Studios',
    released: '2026',
    accent: '#3d8bff',
    accentDark: '#0b1430',
    genres: ['Driving', 'Chase', '3D'],
    short:
      'Pick a side in a city of 361 blocks. Chase speeders and spin out getaway cars ' +
      'as a cop, or pull heists and shake the police as a robber, in the Kaido Festival cars.',
    about: [
      'As a cop you answer calls, run down speeders and ram getaway cars until they ' +
      'spin out. As a robber you hit corner stores, banks and armored trucks, then lose ' +
      'the police or reach the hideout before they box you in.',
      'Fourteen cars from Kaido Festival, from a kei van to a GT1 racer, unlock as you ' +
      'level up. Cops get a police paint job and a light bar; robbers pick the paint ' +
      'and livery. Each side keeps its own level, up to 50.',
      'Free mode drops the clock and opens every car. Press P whenever you want a pursuit ' +
      'to start, and again to call it off. Dusk, night or day, with neon signs and ' +
      'festival lanterns strung over the streets.',
    ],
    features: [
      'Single player',
      'Play as a cop or a robber',
      'Free mode',
      '14 cars to unlock',
      'Wanted stars and police AI',
      'Dusk, night and day',
      'Cockpit camera',
      'Minimap',
      'Xbox controller support',
      'Touch controls',
    ],
    controls: [
      ['W A S D / arrows', 'Drive'],
      ['V', 'Camera: chase, far, cockpit, hood'],
      ['H', 'Horn'],
      ['L', 'Siren and lights (cop)'],
      ['P', 'Free mode: start or stop a pursuit'],
      ['R', 'Back onto the road'],
      ['Esc', 'Pause'],
    ],
    notes: [
      'It loads its 3D engine from the internet when it starts, so wifi that blocks CDNs will leave it blank.',
      'Your levels are saved in this browser, separately for the cop and the robber.',
    ],
  },
];

/* -------------------------------------------------------------- dinorun */
/* The Dinorun tab shows the dinorun.games titles, which live in
 * ./dinorun.games/.
 *
 * A finished one goes in GAMES above like any other game, with
 * `collection: 'dinorun'` added, and the tab picks it up — it stays in the
 * Library too. The ones still being made wait in this list as "Soon" cards.
 * When one is done: add `collection: 'dinorun'` to its GAMES entry, then
 * delete it from here.
 *
 * `motif` is the shape on the card, from the demo motifs in art.js.
 */
const DINORUN_SOON = [
  {
    id: 'eyes',
    title: 'Eyes',
    tagline: 'Coming soon.',
    motif: 'eye',
    accent: '#b48cff',
    accentDark: '#1a0f33',
  },
];
