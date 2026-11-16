/* Octant Vanguard — game data: characters, planets, aliens, upgrades, story */
'use strict';

const CHARACTERS = {
  sys:   { name: 'VANGUARD AI', color: '#9fe8ff', voice: 'glassy',  rate: 1.05, pitch: 1.0,  bVoice: 0 },
  cmd:   { name: 'Commander {cs}', color: '#ffd27a', voice: 'buttery', rate: 1.0, pitch: 0.95, bVoice: 1 },
  hale:  { name: 'Admiral Imogen Hale', color: '#ff8f62', voice: 'rounded', rate: 0.95, pitch: 0.8, bVoice: 2 },
  kira:  { name: 'Kira Sol', color: '#ffd84f', voice: 'airy', rate: 1.12, pitch: 1.3, bVoice: 3 },
  wrench:{ name: 'Bram "Wrench" Okoro', color: '#62c8ff', voice: 'buttery', rate: 0.94, pitch: 0.6, bVoice: 4 },
  lys:   { name: 'Dr. Lys Aranel', color: '#7dffc9', voice: 'glassy', rate: 0.95, pitch: 1.15, bVoice: 5 },
  tak:   { name: 'TAK-9', color: '#aab8ff', voice: 'glassy', rate: 1.18, pitch: 0.25, bVoice: 6 },
  ssiv:  { name: 'Ssiv', color: '#d08bff', voice: 'rounded', rate: 0.8, pitch: 0.45, bVoice: 7 },
  null:  { name: 'Nullheart', color: '#ff3d71', voice: 'rounded', rate: 0.72, pitch: 0.1, bVoice: 8 },
  pip:   { name: 'Pip', color: '#ffb3d9', voice: 'airy', rate: 1.2, pitch: 1.7, bVoice: 9 },
  elder: { name: 'Elder Crinkle', color: '#c9b6ff', voice: 'rounded', rate: 0.86, pitch: 1.25, bVoice: 10 },
  ink:   { name: 'The Inkwraith', color: '#b06bff', voice: 'rounded', rate: 0.72, pitch: 0.15, bVoice: 11 },
};

/* Team members. `ship` = flies a wingman in missions. */
const CREW = {
  kira: {
    name: 'Kira Sol', role: 'Ace pilot', joins: 0, ship: 'fighter',
    blurb: 'Flies the Sunspear fighter on your wing. Hunts whatever is closest to you.',
    perk: lv => `Sunspear damage ${12 + lv * 5}, fire rate +${lv * 10}%`,
  },
  wrench: {
    name: 'Bram "Wrench" Okoro', role: 'Fuel engineer', joins: 1, ship: null,
    blurb: 'Tunes your burners. Every drop of rocket fuel goes further, and he patches the hull mid-fight.',
    perk: lv => `Fuel use −${lv * 9}%, hull repair ${(lv * 0.7).toFixed(1)}/s, more fuel drops`,
  },
  lys: {
    name: 'Dr. Lys Aranel', role: 'Xenobiologist', joins: 2, ship: null,
    blurb: 'Reads Vorr anatomy in real time. Your shots find weak points and your shields recover faster.',
    perk: lv => `Critical hits ${lv * 5}%, shield regen +${lv * 25}%`,
  },
  tak: {
    name: 'TAK-9', role: 'Turret drone', joins: 3, ship: 'drone',
    blurb: 'A retired war drone that orbits your hull and shoots things. Those are its two skills.',
    perk: lv => `Drone damage ${8 + lv * 4}, ${lv >= 3 ? 'twin' : 'single'} barrel`,
  },
  ssiv: {
    name: 'Ssiv', role: 'Vorr Speaker', joins: 4, ship: 'spore',
    blurb: 'An alien who still hears. Its spore-ship slows the Hushed and drains their strength.',
    perk: lv => `Spores slow ${30 + lv * 8}%, spore damage ${10 + lv * 5}`,
  },
  pip: {
    name: 'Pip', role: 'Hoppling glider', joins: 8, ship: 'hopper',
    blurb: 'A brave little Hoppling from Papyra. Folds paper stars and throws them at anything inky. Never stops smiling.',
    perk: lv => `Paper stars ${8 + lv * 4} damage, ${1 + Math.ceil(lv / 2)} stars per throw`,
  },
};
const CREW_ORDER = ['kira', 'wrench', 'lys', 'tak', 'ssiv', 'pip'];
const CREW_MAX = 5;
const crewCost = lv => 120 + lv * lv * 70 + lv * 60;

/* Ship upgrades for the Vanguard */
const UPGRADES = [
  { id: 'hull',   name: 'Octagon Hull',     unit: 'hull',   desc: lv => `Max hull ${100 + lv * 30}` },
  { id: 'shield', name: 'Shield Lattice',   unit: 'shield', desc: lv => `Max shield ${50 + lv * 22}` },
  { id: 'dmg',    name: 'Blaster Coils',    unit: 'dmg',    desc: lv => `Bolt damage ${Math.round(10 * (1 + lv * 0.22))}` },
  { id: 'rate',   name: 'Cycle Accelerator',unit: 'rate',   desc: lv => `${(6 * (1 + lv * 0.13)).toFixed(1)} shots/s` },
  { id: 'spread', name: 'Spread Array',     unit: 'spread', desc: lv => ['Single bolt', 'Twin bolts', 'Triple fan', 'Triple + flank', 'Five-way fan', 'Five-way, piercing'][lv] },
  { id: 'fuel',   name: 'Rocket Fuel Tank', unit: 'fuel',   desc: lv => `Tank holds ${100 + lv * 30} units` },
  { id: 'engine', name: 'Hesper Engines',   unit: 'engine', desc: lv => `Top speed +${lv * 9}%` },
  { id: 'nova',   name: 'Nova Charge',      unit: 'nova',   desc: lv => `Blast ${70 + lv * 30} dmg, recharge ${20 - lv * 2.5}s` },
];
const UPG_MAX = 5;
const upgCost = lv => 90 + lv * lv * 55 + lv * 45;

/* Alien roster. r = radius, hp, spd, dmg (contact), reward credits */
const ENEMY_TYPES = {
  skitter: { r: 13, hp: 16,  spd: 205, dmg: 9,  reward: 6,  color: '#6dff9a', glow: '#38ff7a' },
  spitter: { r: 17, hp: 32,  spd: 115, dmg: 8,  reward: 10, color: '#c07bff', glow: '#a04dff', range: 330, fire: 1.5 },
  brute:   { r: 28, hp: 140, spd: 72,  dmg: 26, reward: 26, color: '#ff4f8b', glow: '#ff2266' },
  leech:   { r: 12, hp: 20,  spd: 140, dmg: 6,  reward: 8,  color: '#4dfff0', glow: '#1ce8ff' },
  weaver:  { r: 22, hp: 70,  spd: 82,  dmg: 12, reward: 18, color: '#ff8de0', glow: '#ff4fd0' },
  hivemother: { r: 70,  hp: 1500, spd: 45, dmg: 30, reward: 400, color: '#9dff5c', glow: '#59ff2e', boss: true, name: 'Hive Mother' },
  maw:        { r: 80,  hp: 2300, spd: 60, dmg: 40, reward: 600, color: '#ff5a3d', glow: '#ff2a12', boss: true, name: 'The Maw' },
  nullheart:  { r: 64,  hp: 3600, spd: 50, dmg: 40, reward: 1000, color: '#ff3d71', glow: '#ff1f5a', boss: true, name: 'Nullheart' },
  blotling:   { r: 14, hp: 22, spd: 170, dmg: 10, reward: 7,  color: '#2a1840', glow: '#8a5cff' },
  scrawl:     { r: 17, hp: 34, spd: 110, dmg: 8,  reward: 11, color: '#3d2a5a', glow: '#b06bff', range: 340, fire: 1.4 },
  inkwraith:  { r: 66, hp: 2600, spd: 55, dmg: 30, reward: 700, color: '#1a0f2e', glow: '#b06bff', boss: true, name: 'The Inkwraith' },
};
const ENEMY_KEYS = Object.keys(ENEMY_TYPES);

/* Wave helper: list of [type, count] */
const W = (...pairs) => { const out = []; for (let i = 0; i < pairs.length; i += 2) out.push([pairs[i], pairs[i + 1]]); return out; };

/* The eight worlds of the Octant, in ring order */
const PLANETS = [
  {
    id: 'verdance', name: 'Verdance', chapter: 'I', title: 'First Light', kind: 'Agri-world',
    desc: 'The breadbasket of the Octant. Grain domes and quiet seas. The Vorr struck here first.',
    style: 'terran', seed: 11, pal: ['#1f5e8a', '#2f9a55', '#8fd96a', '#e8f7d0'], atmo: '#8fffc0', size: 120,
    neb: ['#0e3a3a', '#18306a', '#2e1450'],
    mission: { kind: 'defend', waves: [W('skitter', 6), W('skitter', 8, 'spitter', 2), W('skitter', 9, 'spitter', 4)] },
    reward: 220, crew: 'kira', threat: 1,
  },
  {
    id: 'cindral', name: 'Cindral', chapter: 'II', title: 'Fuel of the Fire', kind: 'Refinery world',
    desc: 'Volcanic mining world. Its refineries make the rocket fuel every ship in the Octant burns.',
    style: 'lava', seed: 23, pal: ['#1a0d0a', '#3a1d14', '#ff5a1f', '#ffd36b'], atmo: '#ff9a4a', size: 110,
    neb: ['#3a1208', '#2a0c1e', '#120c2a'],
    mission: { kind: 'defend', hazard: 'asteroids', waves: [W('skitter', 8, 'spitter', 2), W('skitter', 8, 'spitter', 4, 'brute', 1), W('spitter', 5, 'brute', 2, 'skitter', 8), W('brute', 3, 'skitter', 12, 'spitter', 4)] },
    reward: 320, crew: 'wrench', threat: 2,
  },
  {
    id: 'thalassa', name: 'Thalassa', chapter: 'III', title: 'Deep Water', kind: 'Ocean world',
    desc: 'A single planet-wide ocean. Leech swarms are draining its atmosphere into space.',
    style: 'ocean', seed: 37, pal: ['#06204a', '#0c4a8a', '#2aa6d8', '#dff6ff'], atmo: '#6fd8ff', size: 125,
    neb: ['#08284a', '#0a3a4a', '#1c1450'],
    mission: { kind: 'defend', waves: [W('leech', 10, 'skitter', 4), W('leech', 12, 'spitter', 4), W('leech', 14, 'brute', 2, 'skitter', 6), W('leech', 18, 'spitter', 6, 'brute', 2)] },
    reward: 380, crew: 'lys', threat: 3,
  },
  {
    id: 'ferros', name: 'Ferros', chapter: 'IV', title: 'Iron Choir', kind: 'Foundry world',
    desc: 'Machine foundries wrapped around a metal core. Something enormous is chewing through the crust.',
    style: 'metal', seed: 41, pal: ['#22262e', '#3b4250', '#8c97ab', '#ffb648'], atmo: '#ffc677', size: 115,
    neb: ['#2a2010', '#14202e', '#24102a'],
    mission: { kind: 'defend', waves: [W('skitter', 10, 'spitter', 4, 'weaver', 1), W('brute', 3, 'spitter', 6, 'weaver', 2), W('hivemother', 1, 'skitter', 6)] },
    reward: 520, crew: 'tak', threat: 4,
  },
  {
    id: 'glacia', name: 'Glacia', chapter: 'V', title: 'The Speaker', kind: 'Ice world',
    desc: 'Frozen shelves and ice rings. An unknown signal is broadcasting on the Octacore band.',
    style: 'ice', seed: 53, pal: ['#4a6a8a', '#9cc4e4', '#e6f6ff', '#ffffff'], atmo: '#cfeeff', size: 118,
    neb: ['#102a44', '#1a3c5a', '#2a2050'],
    mission: { kind: 'defend', hazard: 'asteroids', ally: 'ssiv', waves: [W('skitter', 10, 'weaver', 2), W('spitter', 8, 'leech', 8), W('brute', 3, 'weaver', 3, 'skitter', 8), W('brute', 4, 'spitter', 8, 'weaver', 2), W('skitter', 16, 'leech', 10, 'brute', 3)] },
    reward: 560, crew: 'ssiv', threat: 5,
  },
  {
    id: 'umbra', name: 'Umbra', chapter: 'VI', title: 'Lantern', kind: 'Shadow world',
    desc: 'Its core has been pulled by Admiral Hale. The lights are out across the whole planet.',
    style: 'dark', seed: 67, pal: ['#07060e', '#16122a', '#3b2a66', '#a58cff'], atmo: '#7b5cff', size: 120,
    neb: ['#0a0614', '#140a24', '#06060e'],
    mission: { kind: 'defend', hazard: 'dark', waves: [W('skitter', 12, 'spitter', 6), W('leech', 12, 'brute', 3, 'weaver', 2), W('spitter', 8, 'weaver', 4, 'brute', 3), W('maw', 1, 'skitter', 8)] },
    reward: 680, crew: null, threat: 6,
  },
  {
    id: 'aurora', name: 'Aurora', chapter: 'VII', title: 'Return the Light', kind: 'Gas giant',
    desc: 'A banded giant with a ring station. The ancient seal resonators sit in its orbit.',
    style: 'gas', seed: 79, pal: ['#3a1f5a', '#b0508a', '#ffb37a', '#ffe9c4'], atmo: '#ffb3e0', size: 135, ring: true,
    neb: ['#2a0e3a', '#3a1430', '#10183a'],
    mission: { kind: 'survive', duration: 120, mix: ['skitter', 'skitter', 'spitter', 'leech', 'brute', 'weaver'] },
    reward: 760, crew: null, threat: 7,
  },
  {
    id: 'prime', name: 'Octavia Prime', chapter: 'VIII', title: 'The Eighth Seal', kind: 'Capital world',
    desc: 'Home of the Octant Council. The rift has opened directly above its northern sky.',
    style: 'capital', seed: 97, pal: ['#0a2a4a', '#2a6a5a', '#c9b98a', '#ffe7a0'], atmo: '#ffd58a', size: 130,
    neb: ['#2a0a1e', '#3a0a2a', '#0a0a2a'],
    mission: { kind: 'defend', waves: [W('skitter', 14, 'spitter', 6, 'brute', 2), W('brute', 4, 'weaver', 4, 'leech', 10), W('nullheart', 1, 'spitter', 4)] },
    reward: 1200, crew: null, threat: 8,
  },
  {
    id: 'papyra', name: 'Papyra', chapter: 'Side story', side: true, title: 'The Ink Spirit', kind: 'Papercraft world',
    desc: 'A tiny folded-paper world tucked close to Hesper. Its friendly Hopplings are holding back a spirit made of living ink.',
    style: 'paper', seed: 131, pal: ['#f6efe0', '#ffc8dd', '#bde0fe', '#caffbf'], atmo: '#ffd6f0', size: 112,
    neb: ['#3a2350', '#23345a', '#4a2340'],
    mission: { kind: 'defend', ally: 'hopplings', waves: [W('blotling', 10, 'scrawl', 2), W('blotling', 12, 'scrawl', 5), W('scrawl', 6, 'blotling', 14), W('inkwraith', 1, 'blotling', 6)] },
    reward: 480, crew: 'pip', threat: 3,
  },
];
const RING = 8; // the eight story worlds; anything after is a side world

/* ---------------- STORY ---------------- */
/* Each line: [speaker, text]. {cs} is replaced with the player's callsign. */
const STORY = {
  prologue: [
    ['sys', 'Octant Defense Network offline. Six relay stations lost. Hesper standard time: day one of the Breach.'],
    ['hale', 'Commander {cs}. If you are hearing this, Kepler Station is gone, and so is most of my fleet.'],
    ['hale', 'The things that came through the rift, we are calling them the Vorr. They are tearing at our worlds like they are looking for something.'],
    ['hale', 'Your ship, the Vanguard, runs on the first Octacore we ever dug out of the ground. It is the only engine they cannot outrun.'],
    ['hale', 'Eight worlds, Commander. Eight lights in the dark. Keep them burning.'],
    ['cmd', 'Understood, Admiral. Vanguard is lifting off.'],
    ['sys', 'Rocket fuel at one hundred percent. Weapons hot. Plotting course to Verdance.'],
  ],
  verdance_pre: [
    ['kira', 'Mayday, mayday. This is Kira Sol, Sunspear Squadron, or what is left of it. Is anybody out there?'],
    ['cmd', 'Vanguard here. Hold on, Sol. We are inbound.'],
    ['kira', 'Is that an octagon? You are flying a stop sign into a war zone?'],
    ['kira', 'Okay. A stop sign with very big guns. I will take it. They are hitting the grain domes. Keep them off the planet!'],
    ['sys', 'Fly with W A S D, aim with the mouse, hold the button to fire. Shift burns rocket fuel for a boost. Space fires a Nova Charge. Orbit close to the planet to refuel.'],
  ],
  verdance_post: [
    ['kira', 'Verdance is still green. First good news I have had in three days.'],
    ['kira', 'My squadron bought the evacuation ships time. I would like to make that count.'],
    ['cmd', 'Then fly with us. The Vanguard has room on the wing.'],
    ['kira', 'Kira Sol, Sunspear One, reporting for duty. Try to keep up, Commander.'],
    ['sys', 'Kira Sol has joined your team. Upgrade her in the Hangar.'],
  ],
  cindral_pre: [
    ['wrench', 'Whoever is flying that octagon, the Vorr are cracking open my fuel silos. If Cindral falls, every ship in the Octant runs dry.'],
    ['wrench', 'Name is Bram Okoro. Everyone calls me Wrench. I keep the rocket fuel flowing.'],
    ['kira', 'He is not exaggerating. No Cindral, no fuel. No fuel, and we are very expensive rocks.'],
    ['wrench', 'Volcanic rock is drifting all through the orbit. Crack it open, there is fuel inside. Go!'],
  ],
  cindral_post: [
    ['wrench', 'Silos holding. You fly like you stole that ship.'],
    ['wrench', 'I have been tuning burners for twenty years. Let me aboard and I will squeeze twice the distance out of every drop.'],
    ['cmd', 'Welcome aboard, Wrench.'],
    ['wrench', 'One more thing. When the Vorr hit the refinery, they ignored the fuel. They went straight for the old Architect vault underneath. Where we keep the core.'],
    ['sys', 'Wrench has joined your team. Rocket fuel efficiency improved.'],
  ],
  thalassa_pre: [
    ['lys', 'This is Doctor Lys Aranel, Thalassa Deep Station. Please do not shoot the planet. The swarm is doing that already.'],
    ['lys', 'They are Leeches. Small Vorr that latch onto the atmosphere and drain it. Stop them before they reach orbit.'],
    ['lys', 'Commander, one more thing. I have been recording their calls. They are singing on the same frequency as our Octacore.'],
  ],
  thalassa_post: [
    ['lys', 'The ocean is still breathing. Thank you.'],
    ['lys', 'I would like to come with you. If the Vorr are speaking the language of the cores, someone should be listening.'],
    ['kira', 'Great. A scientist. Do we get a cat too?'],
    ['lys', 'Cats are terrible in zero gravity. I have checked.'],
    ['sys', 'Doctor Lys Aranel has joined your team. Shield regeneration improved.'],
  ],
  ferros_pre: [
    ['tak', 'Unidentified vessel. This is defense unit TAK-9. I have been decommissioned for six years.'],
    ['tak', 'I would like to be recommissioned. Immediately. There is a very large organism eating my foundry.'],
    ['wrench', 'That is a Hive Mother. Biggest thing we have seen. It births its own escorts.'],
    ['tak', 'Correction. It is the biggest thing you have seen. I have watched it for forty minutes. It is also very rude.'],
  ],
  ferros_post: [
    ['tak', 'Hive Mother terminated. A process called joy is running. I did not know I had that process.'],
    ['tak', 'Request: mount me to your hull. I will orbit. I will shoot things. These are my two skills.'],
    ['cmd', 'Request granted, TAK.'],
    ['lys', 'Commander, the Hive Mother was not attacking the foundry. It was digging toward the core vault. Just like on Cindral.'],
    ['sys', 'TAK-9 has joined your team. Turret drone online.'],
  ],
  glacia_pre: [
    ['sys', 'Warning. Unknown transmission on the Octacore band.'],
    ['ssiv', 'Vanguard. Do not fire. I am Ssiv. I speak for those of the Vorr who still hear.'],
    ['kira', 'Is the bug talking? Why is the bug talking?'],
    ['ssiv', 'Your cores taught us your words. Listen. The swarm behind me is Hushed. They hear nothing now. They will kill me, and then your ice world.'],
    ['lys', 'Commander, the Hushed read as a different signature. Ssiv is clean. I believe it.'],
    ['cmd', 'Stay close to the planet, Ssiv. We talk after.'],
  ],
  glacia_post: [
    ['ssiv', 'You protected one of us. No Vorr has ever seen a human do this.'],
    ['ssiv', 'Hear the truth, Commander. The eight cores were never engines. They were a seal. A lock on a door.'],
    ['ssiv', 'On the far side of that door is the Hollow. It eats light. It ate our suns. When you pulled the cores from the ground, the door opened.'],
    ['lys', 'The Architect glyphs. The octagon on every vault. It was never decoration. It is a lock.'],
    ['ssiv', 'We did not come to conquer. We came to close the door you opened. The Hollow reached the minds of the Hushed first.'],
    ['kira', 'So we have been shooting at the people trying to fix our mistake.'],
    ['ssiv', 'Some of them. Not all. Let me fly with you, and I will show you which.'],
    ['sys', 'Ssiv has joined your team. Spore-ship online.'],
  ],
  umbra_pre: [
    ['hale', 'Commander. I have read your logs. Talking with the enemy. Very touching.'],
    ['hale', 'Here is what you do not know. Twenty years ago we decoded the Architect glyphs. We knew what the cores were. We used them anyway. We had cities to light.'],
    ['hale', 'Project Lantern ends this. I have pulled Umbra\'s core. We concentrate all eight and fire them into the rift.'],
    ['ssiv', 'No. The Hollow does not die from light. It feeds on it. You will give it a feast.'],
    ['hale', 'Noted. Umbra\'s defenses are down, and the Hushed are coming. You can save it, or you can argue with me. Not both.'],
    ['wrench', 'Lights are out across the whole planet. Stay close to your own engine glow, Commander.'],
  ],
  umbra_post: [
    ['lys', 'Umbra survived. Barely. Without its core, it will not last a year.'],
    ['cmd', 'Then we put the cores back where they belong. All of them.'],
    ['hale', 'That creature, the Maw. It came out of the rift when Lantern\'s test fired. Ssiv was right. It grew when we fed it.'],
    ['hale', 'I need to think about what I have done, Commander.'],
    ['kira', 'Think fast, Admiral.'],
  ],
  aurora_pre: [
    ['hale', 'I am sending you the location of the Lantern cores. They are on Aurora\'s ring station. Take them. Put them back.'],
    ['wrench', 'If we drop them into the Architect resonators here, the seal comes back online. Takes about two minutes to spin up.'],
    ['ssiv', 'The Hollow will feel it. Every Hushed thing in the Octant will come.'],
    ['tak', 'Two minutes. I will count them out loud. One. Two. That was a joke. I will not.'],
    ['cmd', 'Then we hold for two minutes. Everyone on the wing.'],
  ],
  aurora_post: [
    ['sys', 'Seal resonance: seven of eight. The rift is shrinking.'],
    ['hale', 'I watched it from my bridge. Seven lights. It is beautiful.'],
    ['hale', 'Commander, the eighth core is yours. The Vanguard\'s. It is the only one left that is not in the ground.'],
    ['kira', 'Wait. What does that mean for the ship? For you?'],
    ['cmd', 'It means we fly to Octavia Prime. And we finish this.'],
  ],
  prime_pre: [
    ['sys', 'Anomaly at the rift. Mass reading: unmeasurable.'],
    ['ssiv', 'That is Nullheart. The voice of the Hollow. The thing that hushed my people.'],
    ['null', 'Little octagon. You carry the last light. Give it to me, and the dark will be gentle.'],
    ['cmd', 'No.'],
    ['hale', 'Commander, the Resolute is with you. Every ship I have left is with you. Light it up.'],
  ],
  prime_post: [
    ['sys', 'Nullheart destroyed. Seal resonance seven of eight. The rift is collapsing, and it is unstable.'],
    ['lys', 'It needs the eighth core now, or it tears open again.'],
    ['cmd', 'Wrench, prep the core for ejection. I will fly it in myself.'],
    ['kira', 'Absolutely not. You do not get to be the hero and leave me with the paperwork.'],
    ['hale', 'Neither of you will. Commander, transfer the core to the Resolute. That is an order. My last one.'],
    ['hale', 'I opened this door. I will close it from the inside. Fly home, {cs}. Keep the lights on.'],
    ['sys', 'Core transferred. The Resolute is entering the rift.'],
    ['sys', 'Seal resonance: eight of eight. The rift is closed.'],
    ['ssiv', 'She heard, in the end. The Vorr will sing her name.'],
    ['wrench', 'No core in the Vanguard now. We are running on pure rocket fuel and spite. Good thing I know where to get more.'],
    ['lys', 'Ssiv, the southern ice shelves on Glacia are empty. There is room for your people, if they want it.'],
    ['ssiv', 'We would like that very much.'],
    ['kira', 'Eight lights, Commander. Still burning.'],
    ['sys', 'The Octant is safe. Patrol missions remain open. The Hushed still roam.'],
  ],
  papyra_pre: [
    ['sys', 'Faint signal from an uncharted world close to Hesper. Surface reading: paper. Folded paper.'],
    ['pip', 'Hello? Hello! Big shiny octagon! Are you a hero? You look like a hero.'],
    ['pip', 'I am Pip! We are the Hopplings. When the stars get crumpled, we fold them back into shape.'],
    ['elder', 'Forgive the young one, Commander. I am Elder Crinkle. A spirit made of ink has woken in our sky. We call it the Inkwraith.'],
    ['elder', 'It does not want our little world. It wants every story in the universe blotted out, one page at a time. Yours too.'],
    ['ink', 'Such a small, bright page. I will soak it through, and no one will remember it was ever written.'],
    ['kira', 'Okay. The bunnies are adorable, and the ghost is terrifying. Got it.'],
    ['pip', 'We will fight too! We have paper stars, and our ears are very strong!'],
    ['cmd', 'Then stay close, Pip. Nobody blots out your story while we are here.'],
  ],
  papyra_post: [
    ['pip', 'We did it! Look, the ink is washing right out of the sky!'],
    ['elder', 'The Inkwraith is scattered, not destroyed. Spirits like that feed on fear. Today, it starves.'],
    ['elder', 'I think it is a whisper of the same Hollow that hunts your Octant. A darkness that hates anything written in light.'],
    ['elder', 'Take Pip with you. Hopplings were made to mend things, and your universe needs mending.'],
    ['pip', 'Really? Really really? I will be the best wingmate ever. I will fold you a new star every morning!'],
    ['sys', 'Pip has joined your team. Paper-star glider online.'],
  ],
};

/* Mid-mission radio chatter. Each entry: list of [speaker, text]; the first one whose speaker is available is used. */
const BARKS = {
  lowFuel:    [['wrench', 'Rocket fuel under twenty percent! Orbit the planet or grab a canister.'], ['sys', 'Rocket fuel low. Orbit the planet to refuel.']],
  noFuel:     [['wrench', 'We are dry! Thrusters are on emergency power.'], ['sys', 'Rocket fuel depleted. Emergency thrusters only.']],
  planetLow:  [['lys', 'The planet\'s shield is failing. Get those things off it!'], ['kira', 'The planet cannot take much more!'], ['elder', 'The ink is soaking into our world. Please hurry, Commander!'], ['sys', 'Planetary integrity critical.']],
  hullLow:    [['lys', 'Hull breach, Commander. Let your shields recover.'], ['kira', 'You are leaking sparks. Pull back a second!'], ['pip', 'Your ship is all crinkly! Fly near the planet and smooth it out!'], ['sys', 'Hull integrity low.']],
  waveClear:  [['kira', 'Wave down. Catch your breath.'], ['tak', 'Wave eliminated. I am counting that one as mine.'], ['pip', 'Yay! Inky things go poof!'], ['sys', 'Wave cleared.']],
  respawn:    [['kira', 'Got your escape pod! Pushing you back out there.'], ['wrench', 'Spare hull is bolted on. Try not to break this one.'], ['pip', 'I folded you a brand new ship! It is only a little bit paper. Kidding!'], ['sys', 'Escape pod recovered. Relaunching.']],
  papyraGo:   [['pip', 'Hopplings, ears up! Paper stars ready!']],
  boss_inkwraith: [['ink', 'Every story ends, little octagon. I simply skip to the last page.']],
  boss_hivemother: [['wrench', 'Hive Mother incoming! Kill the escorts or it will bury us in them.']],
  boss_maw:   [['ssiv', 'The Maw. It pulls everything toward its mouth. Burn your engines away from it!']],
  boss_nullheart: [['null', 'Every light goes out, little octagon. Even yours.'], ['sys', 'Massive signature detected.']],
  survive:    [['tak', 'Resonators charging. I am not counting. I am definitely not counting.'], ['sys', 'Hold position while the seal charges.']],
  coop:       [['kira', 'Another ship on the wing. Now we are a squadron.']],
};

const SKIP_PRE_HINT = 'Space, Enter or click to continue';
