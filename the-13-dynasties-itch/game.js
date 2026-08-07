(() => {
  "use strict";

  // ---------- config ----------
  const TILE = 32;
  const COLS = 70;
  const ROWS = 55;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 960;
  const VIEW_H = 600;

  const DAY_LENGTH = 180; // seconds per full day-night cycle

  const PLAYER_SPEED = 140;
  const SPRINT_MULT = 1.7;
  const PLAYER_SIZE = 22;

  // The surface is the forgiving half of the game; the Undergrove is the test.
  const HUNGER_DRAIN_SURFACE = 100 / 600;   // ~10 minutes from full to empty
  const HUNGER_DRAIN_UNDERGROVE = 100 / 300; // ~5 minutes — food matters down there
  const SPRINT_HUNGER_MULT = 2.5;   // sprinting burns food faster, so it isn't free
  const STARVE_HEALTH_DRAIN_SURFACE = 1.0;
  const STARVE_HEALTH_DRAIN_UNDERGROVE = 2.5;
  const REGEN_HEALTH_RATE_SURFACE = 2.2;    // recover quickly in safe territory
  const REGEN_HEALTH_RATE_UNDERGROVE = 0.6; // barely regenerate underground

  const BUSH_REGROW_TIME = 30;
  const BUSH_MAX_BERRIES = 3;
  const TUFT_REGROW_TIME = 25;
  const BERRY_HUNGER_RESTORE = 30;
  const TRAILMIX_HUNGER_RESTORE = 55;
  const EGG_HUNGER_RESTORE = 25;
  const MILK_HUNGER_RESTORE = 10;
  const MILK_HEAL = 15;
  const MEAL_HUNGER_RESTORE = 75;
  const MEAL_HEAL = 20;
  const BANDAGE_HEAL = 25;

  const GATHER_RADIUS = 44;
  const INTERACT_RADIUS = 56;
  const ATTACK_RADIUS = 46;
  const TREE_HP = 3;
  const ROCK_HP = 3;

  const SLEEP_DURATION = 1.0;
  const SLEEP_HEALTH_RESTORE = 25;

  // Health is tracked 0-100 and displayed as MAX_HEARTS pips.
  // The player starts wounded at START_HEARTS and recovers to full over RECOVERY_NIGHTS.
  const MAX_HEARTS = 10;
  const START_HEARTS = 4;
  const RECOVERY_NIGHTS = 7;
  const START_MAX_HEALTH = (100 / MAX_HEARTS) * START_HEARTS;

  const AUTOSAVE_INTERVAL = 45; // seconds between background saves

  const HOUSE_WOOD_NEEDED = 10;
  const HOUSE_STONE_NEEDED = 6;

  const THUG_COUNT = 11; // roaming thugs in the Undergrove
  const ANIMAL_COW_COUNT = 7;
  const ANIMAL_CHICKEN_COUNT = 10;
  const UNDERGROVE_WALL_CLUMPS = 16;
  const UNDERGROVE_ROCK_COUNT = 34;
  const TREE_COUNT = 160;
  const ROCK_COUNT = 70;
  const BUSH_COUNT = 20;
  const TUFT_COUNT = 24;
  const CLIFF_FORMATIONS = 7;
  const PASSAGE_REVEAL_DAY = 5;
  const CAVE_HINT_DAY = 2; // start pointing at the cave from this day on

  const NED_FOLLOW_SPEED = 130;
  const NED_FOLLOW_DISTANCE = 50;
  const NED_ATTACK_RADIUS = 44;
  const NED_DAMAGE = 12;
  const NED_ATTACK_COOLDOWN = 1.4;

  // Surface cave guards: beatable early, before you own a sword.
  const THUG_MAX_HP = 32;
  const FIST_DAMAGE = 8;
  const SWORD_DAMAGE = 20;
  const SWORD_DAMAGE_TIER2 = 35;
  const THUG_ATTACK_DAMAGE = 5;
  const THUG_ATTACK_COOLDOWN = 1.2;
  const THUG_AGGRO_RADIUS = 170;
  const THUG_GIVEUP_RADIUS = 260;
  const THUG_CHASE_SPEED = 95;
  const THUG_WANDER_SPEED = 35;
  const THUG_CONTACT_RADIUS = 24;
  const THUG_RESPAWN_TIME = 40;

  // Undergrove thugs: hit harder, chase faster, and take a real weapon to kill.
  const UNDERGROVE_THUG_MAX_HP = 75;
  const UNDERGROVE_THUG_ATTACK_DAMAGE = 15;
  const UNDERGROVE_THUG_CHASE_SPEED = 122;
  const UNDERGROVE_THUG_AGGRO_RADIUS = 230;

  const BOSS_MAX_HP = THUG_MAX_HP * 10;
  const BOSS_ATTACK_DAMAGE = 20;
  const BOSS_CHASE_SPEED = 70;
  const BOSS_AGGRO_RADIUS = 220;
  const BOSS_CONTACT_RADIUS = 34;

  const ANIMAL_WANDER_SPEED = 28;
  const COW_MILK_REGROW = 45;
  const CHICKEN_EGG_REGROW = 30;

  const XP_PER_LEVEL = 1000;
  const XP_THUG_KILL = 50;
  const XP_TREE_FELLED = 100;
  const XP_ROCK_MINED = 25;

  // tile ids
  const T_GRASS = 0;
  const T_WATER = 1;
  const T_DIRT = 2;
  const T_TREE = 3;
  const T_ROCK = 4;
  const T_CAVEFLOOR = 5;
  const T_CAVEWALL = 6;
  const T_CLIFF = 7;

  const BLOCKED = new Set([T_WATER, T_TREE, T_ROCK, T_CAVEWALL, T_CLIFF]);
  const BLOCKING_STRUCTURES = new Set(["wall", "stonewall"]);

  const RECIPES = [
    { id: "axe", name: "Axe", cost: { wood: 3 }, tool: true, hint: "Required to chop trees", minLevel: 1 },
    { id: "pickaxe", name: "Pickaxe", cost: { wood: 3, stone: 2 }, tool: true, hint: "Required to mine rocks", minLevel: 1 },
    { id: "wall", name: "Wood Wall", cost: { wood: 2 }, hint: "Blocks movement (key 1)", minLevel: 1 },
    { id: "campfire", name: "Campfire", cost: { wood: 5, stone: 3 }, hint: "Lights the night (key 3)", minLevel: 1 },
    { id: "torch", name: "Torch", cost: { wood: 1, fiber: 1 }, hint: "Small light (key 4)", minLevel: 1 },
    { id: "bandage", name: "Bandage", cost: { fiber: 3 }, hint: "Use with B: +25 Health", minLevel: 1 },
    { id: "sword", name: "Sword", cost: { wood: 2, stone: 3 }, tool: true, hint: "Attack with Space (20 dmg)", minLevel: 2 },
    { id: "stonewall", name: "Stone Wall", cost: { stone: 4 }, hint: "Sturdier wall (key 2)", minLevel: 2 },
    { id: "trailmix", name: "Trail Mix", cost: { berry: 3, fiber: 1 }, hint: "Use with F: +55 Hunger", minLevel: 2 },
    { id: "meal", name: "Cooked Meal", cost: { egg: 2, milk: 1 }, hint: "Use with F: +75 Hunger, +20 Health", minLevel: 2 },
    { id: "workbench", name: "Upgrade Bench", cost: { wood: 6, stone: 4 }, hint: "Place it, press E to upgrade tools (key 6)", minLevel: 2 },
    { id: "shield", name: "Shield", cost: { wood: 3, stone: 2 }, tool: true, hint: "Halves damage taken", minLevel: 3 },
    { id: "bedroll", name: "Bedroll", cost: { wood: 4, fiber: 3 }, hint: "Sleep anywhere (key 5)", minLevel: 3 },
  ];

  const UPGRADE_RECIPES = [
    { id: "axe", name: "Axe", cost: { wood: 6, stone: 4 }, hint: "2x wood per hit → 4x" },
    { id: "pickaxe", name: "Pickaxe", cost: { wood: 6, stone: 6 }, hint: "2x stone per hit → 4x" },
    { id: "sword", name: "Sword", cost: { wood: 4, stone: 8 }, hint: "20 dmg → 35 dmg" },
    { id: "shield", name: "Shield", cost: { wood: 6, stone: 6 }, hint: "50% reduction → 70%" },
  ];

  // ---------- canvas ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // ---------- dom ----------
  const barHunger = document.getElementById("bar-hunger");
  const heartPips = document.querySelectorAll("#hearts-row .heart-pip");
  const levelLabel = document.getElementById("level-label");
  const barXP = document.getElementById("bar-xp");
  const dayLabel = document.getElementById("day-label");
  const clockLabel = document.getElementById("clock-label");
  const toastBox = document.getElementById("toast");
  const gameoverBox = document.getElementById("gameover");
  const gameoverReason = document.getElementById("gameover-reason");
  const gameoverDays = document.getElementById("gameover-days");
  const restartBtn = document.getElementById("restart-btn");
  const continueBtn = document.getElementById("continue-btn");
  const gameoverCost = document.getElementById("gameover-cost");
  const victoryScreen = document.getElementById("victory-screen");
  const victoryDays = document.getElementById("victory-days");
  const victoryRestartBtn = document.getElementById("victory-restart-btn");
  const actionHint = document.getElementById("action-hint");
  const craftPanel = document.getElementById("craft-panel");
  const craftList = document.getElementById("craft-list");
  const upgradePanel = document.getElementById("upgrade-panel");
  const upgradeList = document.getElementById("upgrade-list");
  const inventoryPanel = document.getElementById("inventory-panel");
  const inventoryGrid = document.getElementById("inventory-grid");
  const toolsGrid = document.getElementById("tools-grid");
  const hudEl = document.getElementById("hud");
  const instructionsEl = document.getElementById("instructions");
  const cutsceneUi = document.getElementById("cutscene-ui");
  const cutsceneCaption = document.getElementById("cutscene-caption");
  const mpPanel = document.getElementById("mp-panel");
  const mpHostBtn = document.getElementById("mp-host-btn");
  const mpLocalBtn = document.getElementById("mp-local-btn");
  const mpJoinBtn = document.getElementById("mp-join-btn");
  const mpCodeInput = document.getElementById("mp-code-input");
  const mpCodeDisplay = document.getElementById("mp-code-display");
  const mpCodeEl = document.getElementById("mp-code");
  const mpMessage = document.getElementById("mp-message");
  const netStatus = document.getElementById("net-status");

  restartBtn.addEventListener("click", () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage blocked */ }
    location.reload();
  });
  continueBtn.addEventListener("click", () => { respawn(); continueBtn.blur(); });
  victoryRestartBtn.addEventListener("click", () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage blocked */ }
    location.reload();
  });

  // ---------- audio ----------
  // Everything is synthesised with the Web Audio API, so there are no sound
  // files to download and nothing extra to host. Browsers block audio until the
  // user interacts with the page, so the context is created lazily on first input.
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let audioReady = false;
  let musicTimer = null;
  let musicStep = 0;
  let musicEnabled = true;

  function initAudio() {
    if (audioReady) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(audioCtx.destination);

      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(masterGain);

      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(masterGain);

      audioReady = true;
      startMusic();
    } catch (err) {
      audioReady = false;
    }
  }

  function resumeAudio() {
    if (!audioReady) { initAudio(); return; }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  // One short synthesised blip. type/freq/duration shape the character.
  function blip(opts) {
    if (!audioReady || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const dur = opts.dur || 0.12;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqTo), now + dur);
    const vol = opts.vol == null ? 0.25 : opts.vol;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(opts.toMusic ? musicGain : sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // Filtered white noise — used for chopping, mining and hits.
  function noiseBurst(opts) {
    if (!audioReady || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const dur = opts.dur || 0.15;
    const frames = Math.floor(audioCtx.sampleRate * dur);
    const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = opts.filterType || "bandpass";
    filter.frequency.value = opts.freq || 900;
    const gain = audioCtx.createGain();
    gain.gain.value = opts.vol == null ? 0.3 : opts.vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    src.start(now);
  }

  const SFX = {
    chop:      () => noiseBurst({ freq: 420, dur: 0.18, vol: 0.35, filterType: "lowpass" }),
    mine:      () => noiseBurst({ freq: 1600, dur: 0.14, vol: 0.3 }),
    gather:    () => blip({ freq: 700, freqTo: 1100, dur: 0.09, type: "triangle", vol: 0.2 }),
    craft:     () => { blip({ freq: 520, dur: 0.08, type: "square", vol: 0.2 }); setTimeout(() => blip({ freq: 780, dur: 0.12, type: "square", vol: 0.2 }), 80); },
    upgrade:   () => { blip({ freq: 600, dur: 0.09, vol: 0.2 }); setTimeout(() => blip({ freq: 900, dur: 0.09, vol: 0.2 }), 90); setTimeout(() => blip({ freq: 1200, dur: 0.16, vol: 0.22 }), 180); },
    place:     () => blip({ freq: 240, freqTo: 160, dur: 0.1, type: "square", vol: 0.22 }),
    eat:       () => blip({ freq: 380, freqTo: 520, dur: 0.14, type: "triangle", vol: 0.22 }),
    heal:      () => { blip({ freq: 660, dur: 0.1, type: "sine", vol: 0.24 }); setTimeout(() => blip({ freq: 990, dur: 0.16, type: "sine", vol: 0.22 }), 90); },
    swing:     () => noiseBurst({ freq: 1200, dur: 0.09, vol: 0.18, filterType: "highpass" }),
    hitEnemy:  () => noiseBurst({ freq: 300, dur: 0.12, vol: 0.4, filterType: "lowpass" }),
    playerHurt:() => blip({ freq: 300, freqTo: 90, dur: 0.28, type: "sawtooth", vol: 0.3 }),
    enemyDown: () => blip({ freq: 420, freqTo: 110, dur: 0.35, type: "square", vol: 0.26 }),
    levelUp:   () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip({ freq: f, dur: 0.18, type: "square", vol: 0.24 }), i * 95)); },
    sleep:     () => blip({ freq: 300, freqTo: 150, dur: 0.6, type: "sine", vol: 0.22 }),
    door:      () => blip({ freq: 180, freqTo: 90, dur: 0.35, type: "sawtooth", vol: 0.24 }),
    error:     () => blip({ freq: 200, dur: 0.12, type: "square", vol: 0.16 }),
    save:      () => blip({ freq: 880, freqTo: 1320, dur: 0.12, type: "sine", vol: 0.2 }),
    magic:     () => blip({ freq: 900, freqTo: 1800, dur: 0.2, type: "sine", vol: 0.2 }),
  };

  function sfx(name) {
    const fn = SFX[name];
    if (fn) fn();
  }

  // Simple looping melody. Two moods: calm on the surface, tense underground.
  const MUSIC_SURFACE = [220, 0, 262, 0, 294, 0, 262, 0, 196, 0, 247, 0, 294, 0, 247, 0];
  const MUSIC_CAVE = [147, 0, 0, 165, 131, 0, 0, 110, 147, 0, 0, 175, 131, 0, 110, 0];

  function musicTick() {
    if (!audioReady || !musicEnabled || audioCtx.state !== "running") return;
    const track = currentArea === "undergrove" ? MUSIC_CAVE : MUSIC_SURFACE;
    const note = track[musicStep % track.length];
    if (note) {
      blip({ freq: note, dur: 0.42, type: "triangle", vol: 0.16, toMusic: true });
      if (musicStep % 4 === 0) {
        blip({ freq: note / 2, dur: 0.5, type: "sine", vol: 0.12, toMusic: true });
      }
    }
    musicStep++;
  }

  function startMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(musicTick, 340);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    if (musicGain) musicGain.gain.value = on ? 0.32 : 0;
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast-msg";
    el.textContent = msg;
    toastBox.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  // ---------- rng helpers ----------
  // Runtime randomness (loot rolls, wander AI). Not seeded — these vary every session.
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // ---------- fog of war ----------
  // Tiles start hidden. Walking near a tile reveals it permanently; tiles you've
  // seen but aren't currently near stay visible but dimmed ("remembered").
  const FOG_SIGHT_RADIUS = 6.5;   // tiles you can currently see
  const FOG_MEMORY_DIM = 0.55;    // how dark remembered tiles are

  function makeExploredGrid() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(false));
    return grid;
  }

  function revealAround(x, y, radius) {
    if (!explored) return;
    const pc = Math.floor(x / TILE);
    const pr = Math.floor(y / TILE);
    const rad = Math.ceil(radius);
    for (let r = pr - rad; r <= pr + rad; r++) {
      if (r < 0 || r >= ROWS) continue;
      for (let c = pc - rad; c <= pc + rad; c++) {
        if (c < 0 || c >= COLS) continue;
        if (dist(c, r, pc, pr) <= radius) explored[r][c] = true;
      }
    }
  }

  // ---------- seeded world generation ----------
  // World layout is generated from a seed so the same seed always produces the
  // same world. This lets players share a world, and is the prerequisite for
  // any future multiplayer (every player must generate an identical map).
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readSeedFromUrl() {
    try {
      const raw = new URLSearchParams(window.location.search).get("seed");
      if (raw && raw.trim()) return raw.trim().toUpperCase().slice(0, 12);
    } catch (err) {
      // Malformed URL — fall through to a random seed.
    }
    return null;
  }

  function makeRandomSeed() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  let worldSeed = readSeedFromUrl() || makeRandomSeed();
  let wRand = mulberry32(hashSeed(worldSeed));

  function resetWorldRng(seed) {
    worldSeed = seed;
    wRand = mulberry32(hashSeed(seed));
  }

  // Seeded integer in [min, max]. Used only while building the world.
  function wRandInt(min, max) {
    return Math.floor(wRand() * (max - min + 1)) + min;
  }

  // ---------- pixel sprite helpers ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function drawGridSprite(grid, palette, originX, originY, pixelSize, skipSet) {
    originX = Math.round(originX);
    originY = Math.round(originY);
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const idx = row[c];
        if (idx === 0) continue;
        if (skipSet && skipSet.has(`${r},${c}`)) continue;
        ctx.fillStyle = palette[idx];
        ctx.fillRect(originX + c * pixelSize, originY + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  const PALETTE = {
    grassA: "#7CFB3E",
    grassB: "#63E028",
    dirt: "#E3A24E",
    water: "#3FB6FF",
    playerBody: "#2F7DFF",
    playerHead: "#FFD9A8",
    flameOuter: "#FF8C1A",
    flameInner: "#FFD23F",
  };

  // 8x8 pixel sprites (pixelSize 4 -> fills one 32px tile)
  const TREE_SPRITE = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 3, 3, 4, 3, 1, 0],
    [1, 3, 3, 4, 3, 3, 3, 1],
    [1, 3, 4, 3, 3, 4, 3, 1],
    [0, 1, 3, 3, 3, 3, 1, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ];
  const TREE_PALETTE = { 1: "#1C2412", 2: "#B97A34", 3: "#2FE065", 4: "#17B845" };

  const ROCK_SPRITE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 2, 2, 2, 1, 0, 0],
    [1, 2, 2, 3, 2, 2, 1, 0],
    [1, 2, 3, 3, 2, 2, 1, 0],
    [1, 3, 2, 2, 2, 3, 1, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const ROCK_PALETTE = { 1: "#1C2412", 2: "#F0F0F0", 3: "#B9B9B9" };

  const BUSH_FULL_SPRITE = [
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 2, 3, 2, 1, 0, 0],
    [1, 2, 4, 2, 3, 2, 1, 0],
    [1, 3, 2, 2, 2, 4, 1, 0],
    [1, 2, 4, 3, 2, 2, 1, 0],
    [0, 1, 2, 2, 3, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const BUSH_EMPTY_SPRITE = BUSH_FULL_SPRITE.map((row) => row.map((v) => (v === 4 ? 2 : v)));
  const BUSH_PALETTE = { 1: "#1C2412", 2: "#2FE065", 3: "#17B845", 4: "#FF3B3B" };

  const WALL_SPRITE = [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 3, 2, 2, 3, 1],
    [1, 2, 2, 3, 2, 2, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 3, 2, 2, 3, 1],
    [1, 2, 2, 3, 2, 2, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ];
  const WALL_PALETTE = { 1: "#1C2412", 2: "#D89A4A", 3: "#B97A34" };

  const STONEWALL_SPRITE = [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 1, 3, 3, 2, 1],
    [1, 2, 2, 1, 3, 3, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 3, 2, 1, 2, 2, 1],
    [1, 3, 3, 2, 1, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ];
  const STONEWALL_PALETTE = { 1: "#1C2412", 2: "#D8DCE0", 3: "#A9AEB4" };

  const TORCH_BASE_SPRITE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
  ];
  const TORCH_PALETTE = { 1: "#1C2412", 2: "#7A4A1E" };

  const BEDROLL_SPRITE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 2, 3, 2, 3, 2, 3, 1],
    [1, 2, 3, 2, 3, 2, 3, 1],
    [1, 2, 3, 2, 3, 2, 3, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const BEDROLL_PALETTE = { 1: "#1C2412", 2: "#A0432F", 3: "#7A2E1F" };

  const WORKBENCH_SPRITE = [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0],
  ];
  const WORKBENCH_PALETTE = { 1: "#1C2412", 2: "#B97A34", 3: "#9AA0A6" };

  const CAMPFIRE_BASE_SPRITE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 0, 2, 1, 0, 0],
    [1, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
  ];
  const CAMPFIRE_PALETTE = { 1: "#1C2412", 2: "#B9B9B9" };

  const COW_SPRITE = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 3, 2, 2, 1, 0],
    [1, 2, 2, 2, 3, 2, 2, 1],
    [1, 2, 3, 2, 2, 2, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 2, 4, 4, 2, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
  ];
  const COW_PALETTE = { 1: "#1C2412", 2: "#FFFFFF", 3: "#3A2A20", 4: "#F2A6B4" };

  const CHICKEN_SPRITE = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 1, 2, 2, 2, 1, 0, 0],
    [1, 2, 2, 2, 2, 2, 1, 4],
    [1, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 1, 4, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ];
  const CHICKEN_PALETTE = { 1: "#1C2412", 2: "#FFFFFF", 3: "#E4453F", 4: "#FFA83F" };

  // 10x8 elephant skull sprite (pixelSize 4 -> 40x32px)
  const SKULL_SPRITE = [
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
    [1, 2, 4, 2, 2, 2, 2, 4, 2, 1],
    [1, 2, 2, 2, 3, 3, 2, 2, 2, 1],
    [0, 1, 2, 2, 3, 3, 2, 2, 1, 0],
    [0, 0, 1, 1, 2, 2, 1, 1, 0, 0],
    [0, 5, 1, 0, 0, 0, 0, 1, 5, 0],
  ];
  const SKULL_PALETTE = { 1: "#2A241C", 2: "#D8CFC0", 3: "#B8AC98", 4: "#1A1610", 5: "#E8E0D0" };

  // 12x12 house sprite (pixelSize 4 -> 48px)
  const HOUSE_GRID = [
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0],
    [0, 1, 2, 2, 3, 2, 2, 3, 2, 2, 1, 0],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 4, 4, 7, 7, 4, 4, 7, 7, 4, 4, 1],
    [1, 4, 4, 7, 7, 4, 4, 7, 7, 4, 4, 1],
    [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
    [1, 4, 4, 4, 4, 6, 6, 4, 4, 4, 4, 1],
    [1, 4, 4, 4, 4, 6, 6, 4, 4, 4, 4, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  const HOUSE_PALETTE = { 1: "#1C2412", 2: "#E4453F", 3: "#C23530", 4: "#E3C089", 6: "#7A4A1E", 7: "#3FB6FF" };
  const RUINED_HOUSE_PALETTE = { 1: "#141A10", 2: "#8A8378", 3: "#6F6A60", 4: "#9A9186" };
  const HOUSE_DOOR_CELLS = [[9, 5], [9, 6], [10, 5], [10, 6]];
  const HOUSE_WINDOW_CELLS = [[6, 3], [6, 4], [6, 7], [6, 8], [7, 3], [7, 4], [7, 7], [7, 8]];
  const HOUSE_RUINED_HOLES = ["1,5", "2,6", "3,3", "4,2", "4,9", "8,2", "8,9", "9,2", "10,9"];
  const HOUSE_RUINED_SKIP = new Set([
    ...HOUSE_RUINED_HOLES,
    ...HOUSE_DOOR_CELLS.map(([r, c]) => `${r},${c}`),
    ...HOUSE_WINDOW_CELLS.map(([r, c]) => `${r},${c}`),
  ]);

  // 8x8 pixel sprite grids, NES-Zelda style. Shared by player and thugs (different palettes).
  const HUMANOID_SPRITES = {
    down: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 5, 5, 5, 5, 1, 0],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [1, 1, 3, 4, 4, 3, 1, 1],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [0, 1, 6, 0, 0, 6, 1, 0],
    ],
    up: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 5, 5, 5, 5, 1, 0],
      [0, 1, 5, 5, 5, 5, 1, 0],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [1, 1, 3, 4, 4, 3, 1, 1],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [0, 1, 6, 0, 0, 6, 1, 0],
    ],
    // This art faces LEFT: the skin (2) sits on the left of the head and the
    // hair (5, back of the head) trails on the right. The right-facing frame is
    // mirrored from it below.
    left: [
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 1, 5, 5, 5, 1, 0, 0],
      [0, 1, 2, 2, 5, 1, 0, 0],
      [0, 1, 2, 2, 1, 1, 0, 0],
      [0, 1, 3, 3, 3, 1, 0, 0],
      [1, 1, 3, 3, 4, 1, 1, 0],
      [0, 1, 3, 3, 3, 1, 0, 0],
      [0, 1, 6, 0, 6, 1, 0, 0],
    ],
  };
  // Mirror within the sprite's used columns, not the full row. A plain row
  // reverse shifts the art sideways (the source art doesn't fill all 8 columns),
  // which made the character visibly jump when turning left vs right.
  function mirrorSprite(grid) {
    let minC = Infinity, maxC = -Infinity;
    for (const row of grid) {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== 0) {
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
    if (minC > maxC) return grid.map((row) => [...row]);
    return grid.map((row) => {
      const out = new Array(row.length).fill(0);
      for (let c = minC; c <= maxC; c++) out[minC + (maxC - c)] = row[c];
      return out;
    });
  }

  HUMANOID_SPRITES.right = mirrorSprite(HUMANOID_SPRITES.left);

  function playerPalette() {
    return {
      1: "#1C2412",
      2: PALETTE.playerHead,
      3: PALETTE.playerBody,
      4: shade(PALETTE.playerBody, -40),
      5: "#7A4A1E",
      6: "#5B3D24",
    };
  }

  function thugPalette() {
    return {
      1: "#1C2412",
      2: "#C9A47A",
      3: "#3A3A3A",
      4: shade("#3A3A3A", -40),
      5: "#8A1F1F",
      6: "#141414",
    };
  }

  // ---------- world generation ----------
  let map, bushes, tufts, house, player, resourceHp, structures, structureTiles, blockedStructureTiles, enemies, animals, explored;
  let currentArea = "surface";
  let surfaceData = null;
  let undergroveData = null;
  let passage, exitStairs;
  let caveBounds = null;
  let caveDecor;
  let ned;

  function generateWorld() {
    map = [];
    for (let r = 0; r < ROWS; r++) {
      map.push(new Array(COLS).fill(T_GRASS));
    }

    const pondCx = wRandInt(8, 16);
    const pondCy = wRandInt(8, 14);
    const pondR = 3.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (dist(c, r, pondCx, pondCy) < pondR) map[r][c] = T_WATER;
      }
    }

    const spawnCol = Math.floor(COLS / 2);
    const spawnRow = Math.floor(ROWS / 2);
    const clearOfSpawn = (c, r) => dist(c, r, spawnCol, spawnRow) > 3;

    for (let i = 0; i < TREE_COUNT; i++) {
      const c = wRandInt(1, COLS - 2);
      const r = wRandInt(1, ROWS - 2);
      if (map[r][c] === T_GRASS && clearOfSpawn(c, r)) map[r][c] = T_TREE;
    }

    for (let i = 0; i < ROCK_COUNT; i++) {
      const c = wRandInt(1, COLS - 2);
      const r = wRandInt(1, ROWS - 2);
      if (map[r][c] === T_GRASS && clearOfSpawn(c, r)) map[r][c] = T_ROCK;
    }

    for (let i = 0; i < CLIFF_FORMATIONS; i++) {
      const cx = wRandInt(4, COLS - 5);
      const cy = wRandInt(4, ROWS - 5);
      if (!clearOfSpawn(cx, cy)) continue;
      const length = wRandInt(6, 12);
      const horizontal = wRand() < 0.5;
      const thickness = wRandInt(2, 3);
      for (let step = 0; step < length; step++) {
        const wobble = wRandInt(-1, 1);
        const baseC = horizontal ? cx + step : cx + wobble;
        const baseR = horizontal ? cy + wobble : cy + step;
        for (let th = 0; th < thickness; th++) {
          const c = horizontal ? baseC : baseC + th;
          const r = horizontal ? baseR + th : baseR;
          if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1 && map[r][c] === T_GRASS && clearOfSpawn(c, r)) {
            map[r][c] = T_CLIFF;
          }
        }
      }
    }

    for (let i = 0; i < 10; i++) {
      const cx = wRandInt(2, COLS - 3);
      const cy = wRandInt(2, ROWS - 3);
      const rad = wRandInt(1, 2);
      for (let r = cy - rad; r <= cy + rad; r++) {
        for (let c = cx - rad; c <= cx + rad; c++) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && map[r][c] === T_GRASS) {
            if (dist(c, r, cx, cy) <= rad) map[r][c] = T_DIRT;
          }
        }
      }
    }

    for (let r = spawnRow - 2; r <= spawnRow + 2; r++) {
      for (let c = spawnCol - 2; c <= spawnCol + 2; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = T_GRASS;
      }
    }

    resourceHp = new Map();
    explored = makeExploredGrid();

    bushes = [];
    let placed = 0, attempts = 0;
    while (placed < BUSH_COUNT && attempts < 3000) {
      attempts++;
      const c = wRandInt(1, COLS - 2);
      const r = wRandInt(1, ROWS - 2);
      if (map[r][c] === T_GRASS && clearOfSpawn(c, r)) {
        bushes.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, berries: BUSH_MAX_BERRIES, regrowT: 0 });
        placed++;
      }
    }

    tufts = [];
    placed = 0; attempts = 0;
    while (placed < TUFT_COUNT && attempts < 3000) {
      attempts++;
      const c = wRandInt(1, COLS - 2);
      const r = wRandInt(1, ROWS - 2);
      if (map[r][c] === T_GRASS && clearOfSpawn(c, r)) {
        tufts.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, available: true, regrowT: 0 });
        placed++;
      }
    }

    enemies = []; // thugs live in the Undergrove now, not on the surface

    animals = [];
    const kinds = [];
    for (let i = 0; i < ANIMAL_COW_COUNT; i++) kinds.push("cow");
    for (let i = 0; i < ANIMAL_CHICKEN_COUNT; i++) kinds.push("chicken");
    for (const kind of kinds) {
      attempts = 0;
      while (attempts < 2000) {
        attempts++;
        const c = wRandInt(1, COLS - 2);
        const r = wRandInt(1, ROWS - 2);
        if (map[r][c] === T_GRASS && clearOfSpawn(c, r)) {
          const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
          animals.push({ x, y, homeX: x, homeY: y, kind, wanderTarget: null, wanderPauseT: 0, facing: "down", resourceReady: true, regrowT: 0 });
          break;
        }
      }
    }

    const houseCol = spawnCol + 3;
    const houseRow = spawnRow;
    for (let r = houseRow - 1; r <= houseRow; r++) {
      for (let c = houseCol; c <= houseCol + 1; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = T_DIRT;
      }
    }
    house = {
      x: houseCol * TILE + TILE,
      y: houseRow * TILE,
      built: false,
      woodGiven: 0,
      stoneGiven: 0,
      woodNeeded: HOUSE_WOOD_NEEDED,
      stoneNeeded: HOUSE_STONE_NEEDED,
    };

    // thug-camp cave: tucked in the far corner of the map, guarded by 3 thugs,
    // with a campfire inside and the Undergrove's rotting log hidden behind it.
    // Kept far from spawn on purpose so you have time to gear up before finding it.
    const caveW = 9, caveH = 7;
    const caveLeft = COLS - 18;
    const caveTop = ROWS - 14;
    const caveRight = caveLeft + caveW - 1;
    const caveBottom = caveTop + caveH - 1;
    const caveRow = caveTop + Math.floor(caveH / 2);

    for (let r = caveTop; r <= caveBottom; r++) {
      for (let c = caveLeft; c <= caveRight; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const isEdge = r === caveTop || r === caveBottom || c === caveLeft || c === caveRight;
        map[r][c] = isEdge ? T_CAVEWALL : T_CAVEFLOOR;
      }
    }
    // doorway on the west wall, facing back toward spawn
    map[caveRow][caveLeft] = T_CAVEFLOOR;
    map[caveRow + 1][caveLeft] = T_CAVEFLOOR;
    if (caveLeft - 1 >= 0) map[caveRow][caveLeft - 1] = T_GRASS;

    caveBounds = {
      minX: caveLeft * TILE, maxX: (caveRight + 1) * TILE,
      minY: caveTop * TILE, maxY: (caveBottom + 1) * TILE,
      tileMinC: caveLeft, tileMaxC: caveRight, tileMinR: caveTop, tileMaxR: caveBottom,
    };

    const campfireC = caveLeft + Math.floor(caveW / 2);
    const campfireR = caveRow;
    const campfireX = campfireC * TILE + TILE / 2, campfireY = campfireR * TILE + TILE / 2;

    // the log sits on the far side of the campfire from the doorway
    const logC = caveRight - 1;
    const logR = caveRow;
    passage = { x: logC * TILE + TILE / 2, y: logR * TILE + TILE / 2, revealed: false };

    structures = [{ type: "campfire", x: campfireX, y: campfireY, c: campfireC, r: campfireR }];
    structureTiles = new Set([`${campfireC},${campfireR}`]);
    blockedStructureTiles = new Set();

    enemies = [];
    const guardSpots = [
      { c: caveRight - 2, r: caveTop + 1 },
      { c: caveRight - 2, r: caveBottom - 1 },
      { c: caveLeft + 2, r: caveRow },
    ];
    for (const spot of guardSpots) {
      const x = spot.c * TILE + TILE / 2, y = spot.r * TILE + TILE / 2;
      enemies.push({
        x, y, homeX: x, homeY: y, hp: THUG_MAX_HP, maxHp: THUG_MAX_HP,
        state: "wander", wanderTarget: null, wanderPauseT: 0,
        attackCooldown: 0, facing: "down", dead: false, respawnTimer: 0,
        guardsCave: true,
      });
    }

    const nedC = caveRight - 1;
    const nedR = caveBottom - 1;
    ned = {
      x: nedC * TILE + TILE / 2, y: nedR * TILE + TILE / 2,
      facing: "down", captive: true, freed: false, moving: false, attackCooldown: 0,
    };

    caveDecor = {
      skull: { x: (caveLeft + 2) * TILE + TILE / 2, y: (caveTop + 1) * TILE + TILE / 2 },
      bloodStains: [
        { x: (caveRight - 2) * TILE + TILE / 2 - 10, y: (caveTop + 1) * TILE + TILE / 2 + 14, scale: 1 },
        { x: (caveLeft + 2) * TILE + TILE / 2 + 8, y: caveRow * TILE + TILE / 2 + 12, scale: 0.8 },
        { x: (caveRight - 3) * TILE + TILE / 2, y: (caveBottom - 1) * TILE + TILE / 2 - 10, scale: 0.9 },
      ],
    };

    player = { x: spawnCol * TILE + TILE / 2, y: spawnRow * TILE + TILE / 2, facing: "down", moving: false };
  }

  function saveAreaState(area) {
    const bundle = { map, bushes, tufts, animals, enemies, structures, structureTiles, blockedStructureTiles, resourceHp, explored };
    if (area === "surface") surfaceData = bundle;
    else undergroveData = bundle;
  }

  function loadAreaState(area) {
    const bundle = area === "surface" ? surfaceData : undergroveData;
    map = bundle.map;
    bushes = bundle.bushes;
    tufts = bundle.tufts;
    animals = bundle.animals;
    enemies = bundle.enemies;
    structures = bundle.structures;
    structureTiles = bundle.structureTiles;
    blockedStructureTiles = bundle.blockedStructureTiles;
    resourceHp = bundle.resourceHp;
    explored = bundle.explored || makeExploredGrid();
  }

  // ---------- save / load ----------
  const SAVE_KEY = "the13dynasties_save_v1";

  function serializeArea(bundle) {
    return {
      map: bundle.map,
      bushes: bundle.bushes,
      tufts: bundle.tufts,
      animals: bundle.animals,
      enemies: bundle.enemies,
      structures: bundle.structures,
      structureTiles: Array.from(bundle.structureTiles),
      blockedStructureTiles: Array.from(bundle.blockedStructureTiles),
      resourceHp: Array.from(bundle.resourceHp.entries()),
      // Store fog as rows of 0/1 so it stays compact in the save file.
      explored: bundle.explored.map((row) => row.map((v) => (v ? 1 : 0))),
    };
  }

  function deserializeArea(data) {
    return {
      map: data.map,
      bushes: data.bushes,
      tufts: data.tufts,
      animals: data.animals,
      enemies: data.enemies,
      structures: data.structures,
      structureTiles: new Set(data.structureTiles),
      blockedStructureTiles: new Set(data.blockedStructureTiles),
      resourceHp: new Map(data.resourceHp),
      explored: data.explored
        ? data.explored.map((row) => row.map((v) => !!v))
        : makeExploredGrid(),
    };
  }

  function buildSaveData() {
    saveAreaState(currentArea);
    return {
      version: 1,
      player: { x: player.x, y: player.y, facing: player.facing },
      stat: {
        health: state.health, maxHealth: state.maxHealth, nightsSurvived: state.nightsSurvived,
        hunger: state.hunger, day: state.day, time: state.time, xp: state.xp,
        inventory: state.inventory, tools: state.tools, foundCave: state.foundCave,
      },
      currentArea,
      house: { built: house.built, woodGiven: house.woodGiven, stoneGiven: house.stoneGiven },
      passageRevealed: passage.revealed,
      ned: { x: ned.x, y: ned.y, freed: ned.freed, captive: ned.captive },
      surface: serializeArea(surfaceData),
      undergrove: serializeArea(undergroveData),
    };
  }

  // Writes the save. Returns true on success. `quiet` skips the toast/sound so
  // autosaves don't spam the screen.
  function writeSave(quiet) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
      if (!quiet) {
        sfx("save");
        toast("Game saved!");
      }
      return true;
    } catch (err) {
      // Safari private mode and blocked-storage settings throw here.
      if (!quiet) toast("Could not save — your browser is blocking storage");
      return false;
    }
  }

  function saveGame() {
    writeSave(false);
  }

  function autosave() {
    if (state.over || state.victory) return;
    writeSave(true);
  }

  function loadGame() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      toast("Could not load — your browser is blocking storage");
      return;
    }
    if (!raw) {
      toast("No saved game found");
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      toast("Save file is corrupted");
      return;
    }
    player.x = data.player.x;
    player.y = data.player.y;
    player.facing = data.player.facing;
    state.health = data.stat.health;
    state.maxHealth = data.stat.maxHealth;
    state.nightsSurvived = data.stat.nightsSurvived;
    state.hunger = data.stat.hunger;
    state.day = data.stat.day;
    state.time = data.stat.time;
    state.xp = data.stat.xp;
    state.inventory = data.stat.inventory;
    state.tools = data.stat.tools;
    state.foundCave = !!data.stat.foundCave;
    house.built = data.house.built;
    house.woodGiven = data.house.woodGiven;
    house.stoneGiven = data.house.stoneGiven;
    passage.revealed = data.passageRevealed;
    ned.x = data.ned.x;
    ned.y = data.ned.y;
    ned.freed = data.ned.freed;
    ned.captive = data.ned.captive;
    surfaceData = deserializeArea(data.surface);
    undergroveData = deserializeArea(data.undergrove);
    currentArea = data.currentArea;
    loadAreaState(currentArea);
    updateInventoryHud();
    refreshCraftPanel();
    toast("Game loaded!");
  }

  function generateUndergrove() {
    const ugMap = [];
    for (let r = 0; r < ROWS; r++) ugMap.push(new Array(COLS).fill(T_CAVEFLOOR));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ugMap[r][c] = T_CAVEWALL;
      }
    }

    const ugCol = Math.floor(COLS / 2);
    const ugRow = Math.floor(ROWS / 2);
    const clearOfEntry = (c, r) => dist(c, r, ugCol, ugRow) > 3;

    for (let i = 0; i < UNDERGROVE_WALL_CLUMPS; i++) {
      const cx = wRandInt(3, COLS - 4);
      const cy = wRandInt(3, ROWS - 4);
      if (!clearOfEntry(cx, cy)) continue;
      const rad = wRandInt(1, 2);
      for (let r = cy - rad; r <= cy + rad; r++) {
        for (let c = cx - rad; c <= cx + rad; c++) {
          if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1 && dist(c, r, cx, cy) <= rad) ugMap[r][c] = T_CAVEWALL;
        }
      }
    }

    let placed = 0, attempts = 0;
    while (placed < UNDERGROVE_ROCK_COUNT && attempts < 3000) {
      attempts++;
      const c = wRandInt(2, COLS - 3);
      const r = wRandInt(2, ROWS - 3);
      if (ugMap[r][c] === T_CAVEFLOOR && clearOfEntry(c, r)) {
        ugMap[r][c] = T_ROCK;
        placed++;
      }
    }

    for (let r = ugRow - 2; r <= ugRow + 2; r++) {
      for (let c = ugCol - 2; c <= ugCol + 2; c++) {
        if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) ugMap[r][c] = T_CAVEFLOOR;
      }
    }

    exitStairs = { x: ugCol * TILE + TILE / 2, y: ugRow * TILE + TILE / 2 };

    // boss chamber: a walled room in the far corner of the Undergrove, holding the goblin king
    const bossW = 13, bossH = 10;
    const bossLeft = COLS - 15;
    const bossTop = ROWS - 13;
    const bossRight = bossLeft + bossW - 1;
    const bossBottom = bossTop + bossH - 1;
    const bossDoorRow = bossTop + Math.floor(bossH / 2);
    const bossCenterCol = Math.floor((bossLeft + bossRight) / 2);
    const bossCenterRow = Math.floor((bossTop + bossBottom) / 2);
    const clearOfBoss = (c, r) => dist(c, r, bossCenterCol, bossCenterRow) > 9;

    for (let r = bossTop; r <= bossBottom; r++) {
      for (let c = bossLeft; c <= bossRight; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const isEdge = r === bossTop || r === bossBottom || c === bossLeft || c === bossRight;
        ugMap[r][c] = isEdge ? T_CAVEWALL : T_CAVEFLOOR;
      }
    }
    ugMap[bossDoorRow][bossLeft] = T_CAVEFLOOR;
    ugMap[bossDoorRow + 1][bossLeft] = T_CAVEFLOOR;
    if (bossLeft - 1 >= 0) ugMap[bossDoorRow][bossLeft - 1] = T_CAVEFLOOR;

    const bossX = bossCenterCol * TILE + TILE / 2;
    const bossY = bossCenterRow * TILE + TILE / 2;

    const ugEnemies = [];
    ugEnemies.push({
      x: bossX, y: bossY, homeX: bossX, homeY: bossY,
      hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP,
      state: "wander", wanderTarget: null, wanderPauseT: 0,
      attackCooldown: 0, facing: "down", dead: false, respawnTimer: 0,
      isBoss: true, atk: BOSS_ATTACK_DAMAGE, chaseSpeed: BOSS_CHASE_SPEED,
      aggroRadius: BOSS_AGGRO_RADIUS, contactRadius: BOSS_CONTACT_RADIUS,
    });

    placed = 0; attempts = 0;
    while (placed < THUG_COUNT && attempts < 3000) {
      attempts++;
      const c = wRandInt(2, COLS - 3);
      const r = wRandInt(2, ROWS - 3);
      if (ugMap[r][c] === T_CAVEFLOOR && dist(c, r, ugCol, ugRow) > 5 && clearOfBoss(c, r)) {
        const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
        ugEnemies.push({
          x, y, homeX: x, homeY: y, hp: UNDERGROVE_THUG_MAX_HP, maxHp: UNDERGROVE_THUG_MAX_HP,
          state: "wander", wanderTarget: null, wanderPauseT: 0,
          attackCooldown: 0, facing: "down", dead: false, respawnTimer: 0,
          atk: UNDERGROVE_THUG_ATTACK_DAMAGE, chaseSpeed: UNDERGROVE_THUG_CHASE_SPEED,
          aggroRadius: UNDERGROVE_THUG_AGGRO_RADIUS,
        });
        placed++;
      }
    }

    undergroveData = {
      map: ugMap, bushes: [], tufts: [], animals: [], enemies: ugEnemies,
      structures: [], structureTiles: new Set(), blockedStructureTiles: new Set(),
      resourceHp: new Map(), explored: makeExploredGrid(),
    };
  }

  generateWorld();
  saveAreaState("surface");
  generateUndergrove();
  currentArea = "surface";

  function enterUndergrove() {
    saveAreaState("surface");
    loadAreaState("undergrove");
    currentArea = "undergrove";
    player.x = exitStairs.x;
    player.y = exitStairs.y + 24;
    if (ned.freed) {
      ned.x = exitStairs.x + 20;
      ned.y = exitStairs.y + 24;
    }
    sfx("door");
    toast("You descend into the Undergrove...");
    autosave();
  }

  function exitUndergrove() {
    saveAreaState("undergrove");
    loadAreaState("surface");
    currentArea = "surface";
    player.x = passage.x;
    player.y = passage.y + 24;
    if (ned.freed) {
      ned.x = passage.x + 20;
      ned.y = passage.y + 24;
    }
    sfx("door");
    toast("You climb back to the surface.");
    autosave();
  }

  // ---------- game state ----------
  const state = {
    health: START_MAX_HEALTH,
    maxHealth: START_MAX_HEALTH,
    nightsSurvived: 0,
    hunger: 100,
    day: 1,
    time: 0.02,
    over: false,
    overReason: "",
    lastDamageSource: null,
    sleeping: { active: false, t: 0, applied: false },
    craftOpen: false,
    inventoryOpen: false,
    upgradeOpen: false,
    mpOpen: false,
    victory: false,
    foundCave: false,
    inventory: {
      wood: 6, stone: 3, fiber: 0, berry: 0,
      wall: 0, stonewall: 0, campfire: 0, torch: 0, bedroll: 0, workbench: 0,
      bandage: 0, trailmix: 0, meal: 0, egg: 0, milk: 0,
    },
    tools: { axe: 0, pickaxe: 0, sword: 0, shield: 0 },
    xp: 0,
  };

  let autosaveTimer = 0;
  let lastAttackTime = 0;
  let lastAttackDir = "down";
  let lastHitTime = 0;
  let lastNedCastTime = 0;
  let lastNedCastX = 0;
  let lastNedCastY = 0;

  // ---------- input ----------
  const keys = new Set();
  const justPressed = new Set();

  const PREVENT_DEFAULT = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "1", "2", "3", "4", "5", "6", "c", "f", "e", "b", "i", "j", "p", "l"];

  // While the player is typing in a text field, keys belong to the field, not the game.
  function typingInField() {
    const el = document.activeElement;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    resumeAudio(); // browsers only allow audio after a user gesture
    if (typingInField()) {
      if (k === "enter") mpJoinBtn.click();
      if (k === "escape") { e.target.blur(); setMpOpen(false); }
      return;
    }
    if (cutsceneActive) {
      if (k === "x") {
        e.preventDefault();
        endCutscene();
      } else if (k === " " || k === "enter") {
        e.preventDefault();
        advanceCutsceneSlide();
      }
      return;
    }
    if (k === "m") {
      e.preventDefault();
      setMusicEnabled(!musicEnabled);
      toast(musicEnabled ? "Music on" : "Music off");
      return;
    }
    if (PREVENT_DEFAULT.includes(k)) e.preventDefault();
    if (!keys.has(k) && !e.repeat) justPressed.add(k);
    keys.add(k);
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
  });

  // A key can get "stuck" held if its keyup is never delivered — alt-tabbing,
  // clicking a button, or the window losing focus mid-press. The player then
  // drifts with no input. Clear held keys whenever focus changes either way.
  function clearHeldKeys() {
    keys.clear();
    justPressed.clear();
  }
  window.addEventListener("blur", clearHeldKeys);
  window.addEventListener("focus", clearHeldKeys);
  document.addEventListener("visibilitychange", () => {
    clearHeldKeys();
    // Closing a tab often only fires visibilitychange, so save progress here too.
    if (document.hidden) autosave();
  });
  window.addEventListener("pagehide", () => autosave());
  canvas.addEventListener("pointerdown", () => { canvas.focus(); resumeAudio(); });
  window.addEventListener("pointerdown", resumeAudio, { once: false });

  // ---------- touch controls ----------
  // On-screen pads drive the same `keys` / `justPressed` sets the keyboard uses,
  // so no game logic needs to know whether input came from a finger or a key.
  const touchControls = document.getElementById("touch-controls");

  function pressVirtualKey(k) {
    if (!keys.has(k)) justPressed.add(k);
    keys.add(k);
  }
  function releaseVirtualKey(k) {
    keys.delete(k);
  }

  function bindTouchButton(btn) {
    const key = btn.dataset.key;
    const isHold = btn.dataset.hold === "1" || ["w", "a", "s", "d", "shift"].includes(key);

    const down = (e) => {
      e.preventDefault();
      resumeAudio();
      btn.classList.add("pressed");
      pressVirtualKey(key);
      // Taps fire once; movement and sprint stay held until release.
      if (!isHold) setTimeout(() => releaseVirtualKey(key), 60);
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove("pressed");
      if (isHold) releaseVirtualKey(key);
    };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  document.querySelectorAll("#touch-controls .tbtn").forEach(bindTouchButton);

  const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    touchControls.classList.remove("hidden");
    document.body.classList.add("touch");
  }

  // Scale the fixed 960x600 stage down to fit whatever screen it lands on.
  const gameWrap = document.getElementById("game-wrap");
  function fitToScreen() {
    const pad = window.innerWidth <= 1000 ? 0 : 40;
    const scale = Math.min(
      (window.innerWidth - pad) / VIEW_W,
      (window.innerHeight - pad) / VIEW_H,
      1
    );
    gameWrap.style.transform = scale < 1 ? `scale(${scale})` : "";
    document.body.style.height = scale < 1 ? `${VIEW_H * scale}px` : "";
  }
  window.addEventListener("resize", fitToScreen);
  window.addEventListener("orientationchange", fitToScreen);
  fitToScreen();

  function isDown(...names) {
    return names.some((n) => keys.has(n));
  }

  // ---------- crafting ----------
  function costText(cost) {
    return Object.entries(cost).map(([k, v]) => `${v} ${k[0].toUpperCase()}${k.slice(1)}`).join(", ");
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => state.inventory[k] >= v);
  }
  function craftItem(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    if (currentLevel() < (r.minLevel || 1)) return;
    if (r.tool && state.tools[id] >= 1) return;
    if (!canAfford(r.cost)) return;
    for (const [k, v] of Object.entries(r.cost)) state.inventory[k] -= v;
    if (r.tool) {
      state.tools[id] = 1;
    } else {
      state.inventory[id] = (state.inventory[id] || 0) + 1;
    }
    sfx("craft");
    toast(`Crafted ${r.name}`);
    refreshCraftPanel();
    updateInventoryHud();
  }

  function refreshCraftPanel() {
    craftList.innerHTML = "";
    const level = currentLevel();
    for (const r of RECIPES) {
      const row = document.createElement("div");
      row.className = "craft-row";
      const locked = level < (r.minLevel || 1);

      const info = document.createElement("div");
      info.className = "craft-info";
      const name = document.createElement("div");
      name.className = "craft-name";
      name.textContent = r.name;
      const cost = document.createElement("div");
      cost.className = "craft-cost";
      cost.textContent = locked ? `Unlocks at Level ${r.minLevel}` : `${costText(r.cost)} — ${r.hint}`;
      info.appendChild(name);
      info.appendChild(cost);

      const btn = document.createElement("button");
      btn.className = "craft-btn";
      const owned = r.tool && state.tools[r.id] >= 1;
      btn.textContent = locked ? "Locked" : owned ? "Owned" : "Craft";
      btn.disabled = locked || owned || !canAfford(r.cost);
      // Blur after clicking, or the button keeps keyboard focus and a later
      // Space press re-activates it instead of swinging in-game.
      btn.addEventListener("click", () => { craftItem(r.id); btn.blur(); });

      row.appendChild(info);
      row.appendChild(btn);
      craftList.appendChild(row);
    }
  }

  function setCraftOpen(open) {
    state.craftOpen = open;
    craftPanel.classList.toggle("hidden", !open);
    if (open) refreshCraftPanel();
  }

  function upgradeItem(id) {
    const r = UPGRADE_RECIPES.find((x) => x.id === id);
    if (!r) return;
    if (!state.tools[id] || state.tools[id] < 1) {
      toast(`You need to craft a ${r.name} first`);
      return;
    }
    if (state.tools[id] >= 2) {
      toast(`${r.name} is already upgraded`);
      return;
    }
    if (!canAfford(r.cost)) return;
    for (const [k, v] of Object.entries(r.cost)) state.inventory[k] -= v;
    state.tools[id] = 2;
    sfx("upgrade");
    toast(`Upgraded ${r.name}!`);
    refreshUpgradePanel();
    updateInventoryHud();
  }

  function refreshUpgradePanel() {
    upgradeList.innerHTML = "";
    for (const r of UPGRADE_RECIPES) {
      const row = document.createElement("div");
      row.className = "craft-row";
      const tier = state.tools[r.id] || 0;

      const info = document.createElement("div");
      info.className = "craft-info";
      const name = document.createElement("div");
      name.className = "craft-name";
      name.textContent = r.name;
      const cost = document.createElement("div");
      cost.className = "craft-cost";
      cost.textContent = tier < 1 ? "Craft the base tool first" : tier >= 2 ? "Fully upgraded" : `${costText(r.cost)} — ${r.hint}`;
      info.appendChild(name);
      info.appendChild(cost);

      const btn = document.createElement("button");
      btn.className = "craft-btn";
      btn.textContent = tier >= 2 ? "Maxed" : "Upgrade";
      btn.disabled = tier < 1 || tier >= 2 || !canAfford(r.cost);
      btn.addEventListener("click", () => { upgradeItem(r.id); btn.blur(); });

      row.appendChild(info);
      row.appendChild(btn);
      upgradeList.appendChild(row);
    }
  }

  function setUpgradeOpen(open) {
    state.upgradeOpen = open;
    upgradePanel.classList.toggle("hidden", !open);
    if (open) refreshUpgradePanel();
  }

  // ---------- time / daylight ----------
  function currentHour() {
    return (6 + state.time * 24) % 24;
  }

  function daylightFactor() {
    const h = currentHour();
    let d = Math.abs(h - 13);
    if (d > 12) d = 24 - d;
    let daylight = 1 - d / 11;
    return Math.max(0, Math.min(1, daylight));
  }

  function formatClock() {
    const h = currentHour();
    let hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    const ampm = hh >= 12 ? "PM" : "AM";
    let hh12 = hh % 12;
    if (hh12 === 0) hh12 = 12;
    return `${hh12}:${mm.toString().padStart(2, "0")} ${ampm}`;
  }

  // ---------- collision ----------
  function isWalkable(px, py) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    if (BLOCKED.has(map[r][c])) return false;
    if (blockedStructureTiles.has(`${c},${r}`)) return false;
    return true;
  }

  function canStandAt(cx, cy) {
    const half = PLAYER_SIZE / 2;
    return (
      isWalkable(cx - half, cy - half) &&
      isWalkable(cx + half, cy - half) &&
      isWalkable(cx - half, cy + half) &&
      isWalkable(cx + half, cy + half)
    );
  }

  // ---------- gathering / placing / house ----------
  function findNearestGatherable() {
    const pc = Math.floor(player.x / TILE);
    const pr = Math.floor(player.y / TILE);
    let best = null;
    let bestDist = GATHER_RADIUS;

    for (let r = pr - 1; r <= pr + 1; r++) {
      for (let c = pc - 1; c <= pc + 1; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const t = map[r][c];
        if (t === T_TREE || t === T_ROCK) {
          const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
          const d = dist(player.x, player.y, cx, cy);
          if (d < bestDist) {
            bestDist = d;
            best = { kind: t === T_TREE ? "tree" : "rock", c, r };
          }
        }
      }
    }
    for (const b of bushes) {
      const d = dist(player.x, player.y, b.x, b.y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "bush", ref: b };
      }
    }
    for (const g of tufts) {
      const d = dist(player.x, player.y, g.x, g.y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "tuft", ref: g };
      }
    }
    for (const a of animals) {
      const d = dist(player.x, player.y, a.x, a.y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: a.kind, ref: a };
      }
    }
    return best;
  }

  function tryGather() {
    const best = findNearestGatherable();
    if (!best) {
      toast("Nothing to gather here");
      return;
    }

    if (best.kind === "tree" || best.kind === "rock") {
      const isTree = best.kind === "tree";
      if (isTree && state.tools.axe < 1) {
        toast("Need an Axe to chop trees");
        return;
      }
      if (!isTree && state.tools.pickaxe < 1) {
        toast("Need a Pickaxe to mine rocks");
        return;
      }
      const key = `${best.c},${best.r}`;
      let hp = resourceHp.has(key) ? resourceHp.get(key) : (isTree ? TREE_HP : ROCK_HP);
      hp -= 1;
      const tier = isTree ? state.tools.axe : state.tools.pickaxe;
      const amt = tier >= 2 ? 4 : 2;
      if (isTree) state.inventory.wood += amt;
      else state.inventory.stone += amt;
      sfx(isTree ? "chop" : "mine");
      toast(`+${amt} ${isTree ? "Wood" : "Stone"}`);
      if (hp <= 0) {
        map[best.r][best.c] = currentArea === "undergrove" ? T_CAVEFLOOR : T_GRASS;
        resourceHp.delete(key);
        addXP(isTree ? XP_TREE_FELLED : XP_ROCK_MINED);
        if (net.active && net.connected) {
          requestAction("harvest", { c: best.c, r: best.r, area: currentArea });
        }
      } else {
        resourceHp.set(key, hp);
      }
      updateInventoryHud();
    } else if (best.kind === "bush") {
      const b = best.ref;
      if (b.berries > 0) {
        b.berries -= 1;
        state.inventory.berry += 1;
        sfx("gather");
        toast("+1 Berry");
        updateInventoryHud();
      } else {
        toast("No berries here yet");
      }
    } else if (best.kind === "tuft") {
      const g = best.ref;
      if (g.available) {
        const amt = randInt(1, 2);
        state.inventory.fiber += amt;
        g.available = false;
        g.regrowT = 0;
        sfx("gather");
        toast(`+${amt} Fiber`);
        updateInventoryHud();
      } else {
        toast("Already picked");
      }
    } else if (best.kind === "cow" || best.kind === "chicken") {
      const a = best.ref;
      if (a.resourceReady) {
        a.resourceReady = false;
        a.regrowT = 0;
        sfx("gather");
        if (best.kind === "cow") {
          state.inventory.milk += 1;
          toast("+1 Milk");
        } else {
          state.inventory.egg += 1;
          toast("+1 Egg");
        }
        updateInventoryHud();
      } else {
        toast(best.kind === "cow" ? "No milk right now" : "No egg right now");
      }
    }
  }

  function findNearestEnemyInRange(radius) {
    let best = null, bestDist = radius;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  function killEnemy(e, source) {
    e.dead = true;
    if (e.isBoss) {
      toast(`${source} defeated the Goblin King!`);
      triggerEnding();
      return;
    }
    e.respawnTimer = THUG_RESPAWN_TIME;
    sfx("enemyDown");
    addXP(XP_THUG_KILL);
    if (e.guardsCave) {
      const wood = randInt(3, 6);
      const stone = randInt(2, 4);
      state.inventory.wood += wood;
      state.inventory.stone += stone;
      updateInventoryHud();
      toast(`${source} defeated the thug! Dropped ${wood} Wood, ${stone} Stone`);
    } else {
      toast(`${source} defeated the thug!`);
    }
  }

  function attackEnemy(e) {
    const dmg = state.tools.sword >= 2 ? SWORD_DAMAGE_TIER2 : state.tools.sword >= 1 ? SWORD_DAMAGE : FIST_DAMAGE;
    lastAttackTime = performance.now();
    lastAttackDir = player.facing;
    sfx("hitEnemy");

    // As a joiner we don't own enemy health — ask the host to apply the hit and
    // wait for its snapshot, so both players never disagree about who is alive.
    if (net.active && net.connected && !net.isHost) {
      requestAction("damageEnemy", { index: enemies.indexOf(e), amount: dmg, area: currentArea });
      toast(`Hit the thug! (-${dmg})`);
      return;
    }

    e.hp -= dmg;
    if (e.hp <= 0) {
      killEnemy(e, "You");
    } else {
      toast(`Hit the thug! (-${dmg})`);
    }
  }

  function tryAttackOrGather() {
    const enemy = findNearestEnemyInRange(ATTACK_RADIUS);
    if (enemy) {
      attackEnemy(enemy);
      return;
    }
    sfx("swing");
    tryGather();
  }

  function dealDamageToPlayer(amount, reason) {
    const shieldMult = state.tools.shield >= 2 ? 0.3 : state.tools.shield >= 1 ? 0.5 : 1;
    const reduced = Math.round(amount * shieldMult);
    state.health = Math.max(0, state.health - reduced);
    state.lastDamageSource = reason;
    lastHitTime = performance.now();
    sfx("playerHurt");
    toast(`A thug attacks you! (-${reduced} Health)`);
  }

  // Eats the best food available. Cooked meals first, then trail mix, then raw
  // items. Milk is kept for last since it is the only food that also heals.
  function tryEat() {
    const order = ["meal", "trailmix", "berry", "egg", "milk"];
    const pick = order.find((k) => (state.inventory[k] || 0) > 0);
    if (!pick) {
      sfx("error");
      toast("No food to eat");
      return;
    }
    sfx("eat");
    state.inventory[pick] -= 1;

    const FOOD = {
      meal:     { hunger: MEAL_HUNGER_RESTORE, heal: MEAL_HEAL, name: "a cooked meal" },
      trailmix: { hunger: TRAILMIX_HUNGER_RESTORE, heal: 0, name: "trail mix" },
      berry:    { hunger: BERRY_HUNGER_RESTORE, heal: 0, name: "a berry" },
      egg:      { hunger: EGG_HUNGER_RESTORE, heal: 0, name: "an egg" },
      milk:     { hunger: MILK_HUNGER_RESTORE, heal: MILK_HEAL, name: "milk" },
    }[pick];

    state.hunger = Math.min(100, state.hunger + FOOD.hunger);
    let msg = `Ate ${FOOD.name} (+${FOOD.hunger} Hunger`;
    if (FOOD.heal > 0) {
      state.health = Math.min(state.maxHealth, state.health + FOOD.heal);
      msg += `, +${FOOD.heal} Health`;
      sfx("heal");
    }
    toast(msg + ")");
    updateInventoryHud();
  }

  // ---------- multiplayer ----------
  // One player hosts and owns the simulation; joiners mirror it and send their
  // position plus requests to act. Two transports share one interface so the
  // game logic never cares how bytes actually travel:
  //   - "local": BroadcastChannel, same browser, no internet, cannot fail
  //   - "peer":  PeerJS/WebRTC, across the internet, needs a room code
  const PEERJS_SRC = "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js";
  const NET_POS_HZ = 15;         // position updates per second
  const NET_WORLD_HZ = 6;        // host world snapshots per second
  const NET_TIMEOUT = 6;         // seconds of silence before a peer is dropped
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const net = {
    active: false,
    mode: null,        // "local" | "peer"
    isHost: false,
    connected: false,
    code: null,
    transport: null,
    posAccum: 0,
    worldAccum: 0,
    lastHeard: 0,
    // Everything we know about the other player, for drawing them.
    remote: { x: 0, y: 0, facing: "down", moving: false, present: false, area: "surface" },
    pendingActions: [],
  };

  function makeRoomCode() {
    let s = "";
    for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }

  function setNetStatus(text, cls) {
    netStatus.classList.remove("hidden", "live", "waiting", "lost");
    if (cls) netStatus.classList.add(cls);
    netStatus.innerHTML = `<span class="dot"></span>${text}`;
  }

  function mpSay(text, isError) {
    mpMessage.textContent = text;
    mpMessage.classList.toggle("error", !!isError);
  }

  // --- transport: same-browser tabs -------------------------------------------
  function createLocalTransport(code, onMessage, onOpen) {
    const ch = new BroadcastChannel("t13d-" + code);
    ch.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.from === net.selfId) return;
      if (msg.t === "join" && net.isHost) onOpen();
      onMessage(msg);
    };
    return {
      send(msg) {
        msg.from = net.selfId;
        ch.postMessage(msg);
      },
      close() { try { ch.close(); } catch (e) { /* already closed */ } },
      announceJoin() { this.send({ t: "join" }); },
    };
  }

  // --- transport: internet via PeerJS ------------------------------------------
  function loadPeerJs() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve();
      const s = document.createElement("script");
      s.src = PEERJS_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load the networking library"));
      document.head.appendChild(s);
    });
  }

  function createPeerTransport(code, isHost, onMessage, onOpen, onClose) {
    // Room code doubles as the host's peer id, so joiners can find them.
    const peerId = "t13d-" + code;
    const peer = isHost ? new window.Peer(peerId) : new window.Peer();
    let conn = null;

    function wire(c) {
      conn = c;
      c.on("open", onOpen);
      c.on("data", (d) => onMessage(d));
      c.on("close", onClose);
      c.on("error", onClose);
    }

    peer.on("error", (err) => {
      const msg = String(err && err.type === "unavailable-id"
        ? "That code is already in use — try hosting again."
        : err && err.type === "peer-unavailable"
        ? "No world found with that code."
        : "Connection problem: " + (err && err.type ? err.type : "unknown"));
      mpSay(msg, true);
      setNetStatus("Offline", "lost");
    });

    if (isHost) {
      peer.on("open", () => mpSay("Waiting for a friend to join…"));
      peer.on("connection", wire);
    } else {
      peer.on("open", () => wire(peer.connect(peerId, { reliable: false })));
    }

    return {
      send(msg) { if (conn && conn.open) conn.send(msg); },
      close() { try { if (conn) conn.close(); peer.destroy(); } catch (e) { /* already gone */ } },
      announceJoin() { this.send({ t: "join" }); },
    };
  }

  // --- session control ----------------------------------------------------------
  function netSend(msg) {
    if (net.transport) net.transport.send(msg);
  }

  function onPeerConnected() {
    net.connected = true;
    net.lastHeard = performance.now() / 1000;
    net.remote.present = true;
    startHeartbeat();
    sfx("magic");
    if (net.isHost) {
      // The host defines reality: same seed means the same world for both.
      netSend({
        t: "hello",
        seed: worldSeed,
        day: state.day,
        time: state.time,
        passageRevealed: passage.revealed,
        houseBuilt: house.built,
        nedFreed: ned.freed,
      });
      mpSay("Friend connected!");
      setNetStatus("Playing together", "live");
    } else {
      mpSay("Connected! Loading their world…");
      setNetStatus("Connected", "live");
    }
    setTimeout(() => setMpOpen(false), 900);
  }

  function onPeerLost() {
    if (!net.active) return;
    net.connected = false;
    net.remote.present = false;
    stopHeartbeat();
    setNetStatus("Friend disconnected", "lost");
    toast("Your friend disconnected.");
  }

  function handleNetMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    net.lastHeard = performance.now() / 1000;

    switch (msg.t) {
      case "join":
        // A joiner announced itself on the local channel.
        if (net.isHost && !net.connected) onPeerConnected();
        break;

      case "hello":
        // Host told us which world to build. Rebuild ours to match exactly.
        if (net.isHost) break;
        adoptHostWorld(msg);
        break;

      case "pos":
        net.remote.x = msg.x;
        net.remote.y = msg.y;
        net.remote.facing = msg.facing;
        net.remote.moving = msg.moving;
        net.remote.area = msg.area;
        net.remote.present = true;
        break;

      case "world":
        if (net.isHost) break;
        applyWorldSnapshot(msg);
        break;

      case "act":
        // Enemy damage is host-authoritative; map edits mirror in both directions
        // so each player sees the other's felled trees and placed walls.
        if (msg.kind === "damageEnemy") {
          if (net.isHost) applyRemoteAction(msg);
        } else {
          applyRemoteAction(msg);
        }
        break;

      case "ping":
        // Nothing to do — receiving it already refreshed net.lastHeard above.
        break;

      case "bye":
        onPeerLost();
        break;
    }
  }

  // Position updates ride the render loop, which browsers throttle to a crawl in
  // background tabs. A timer-based heartbeat keeps the link alive regardless, so
  // switching apps or locking a phone doesn't drop the session.
  function startHeartbeat() {
    stopHeartbeat();
    net.heartbeatTimer = setInterval(() => {
      if (net.active && net.connected) netSend({ t: "ping" });
    }, 1500);
  }

  function stopHeartbeat() {
    if (net.heartbeatTimer) clearInterval(net.heartbeatTimer);
    net.heartbeatTimer = null;
  }

  function startSession(mode, isHost, code) {
    net.active = true;
    net.mode = mode;
    net.isHost = isHost;
    net.code = code;
    net.selfId = Math.random().toString(36).slice(2);
    net.connected = false;
    net.lastHeard = performance.now() / 1000;

    const onMsg = handleNetMessage;
    if (mode === "local") {
      net.transport = createLocalTransport(code, onMsg, onPeerConnected);
      if (!isHost) {
        net.transport.announceJoin();
        onPeerConnected();
      }
      setNetStatus(isHost ? "Waiting for player 2" : "Connected", isHost ? "waiting" : "live");
      return Promise.resolve();
    }

    return loadPeerJs().then(() => {
      net.transport = createPeerTransport(code, isHost, onMsg, onPeerConnected, onPeerLost);
      setNetStatus(isHost ? "Waiting for a friend" : "Connecting…", "waiting");
    });
  }

  function stopSession() {
    if (!net.active) return;
    netSend({ t: "bye" });
    stopHeartbeat();
    if (net.transport) net.transport.close();
    net.active = false;
    net.connected = false;
    net.transport = null;
    net.remote.present = false;
    netStatus.classList.add("hidden");
  }

  // Nudge the player to the nearest standable tile. Needed after adopting a new
  // world, where the terrain under their feet may have changed to solid rock.
  function placePlayerSafely(preferX, preferY) {
    if (canStandAt(preferX, preferY)) {
      player.x = preferX;
      player.y = preferY;
      return true;
    }
    for (let radius = 1; radius <= 12; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = preferX + dx * TILE;
          const y = preferY + dy * TILE;
          if (x < TILE || y < TILE || x > WORLD_W - TILE || y > WORLD_H - TILE) continue;
          if (canStandAt(x, y)) {
            player.x = x;
            player.y = y;
            return true;
          }
        }
      }
    }
    return false;
  }

  // Joiner rebuilds its world from the host's seed so both players share a map.
  function adoptHostWorld(msg) {
    resetWorldRng(msg.seed);
    generateWorld();
    saveAreaState("surface");
    generateUndergrove();
    currentArea = "surface";
    loadAreaState("surface");

    // generateWorld() reset `player` to spawn, but the joiner may have wandered
    // before connecting — make sure wherever they land is actually walkable.
    placePlayerSafely(player.x, player.y);

    state.day = msg.day;
    state.time = msg.time;
    passage.revealed = !!msg.passageRevealed;
    house.built = !!msg.houseBuilt;
    ned.freed = !!msg.nedFreed;
    if (ned.freed) ned.captive = false;

    updateInventoryHud();
    toast(`Joined world ${msg.seed}`);
    setNetStatus("Playing together", "live");
  }

  function setMpOpen(open) {
    state.mpOpen = open;
    mpPanel.classList.toggle("hidden", !open);
    if (open) {
      mpCodeDisplay.classList.toggle("hidden", !net.code);
      if (net.code) mpCodeEl.textContent = net.code;
    }
  }

  mpHostBtn.addEventListener("click", () => {
    const code = makeRoomCode();
    mpCodeEl.textContent = code;
    mpCodeDisplay.classList.remove("hidden");
    mpSay("Starting…");
    mpHostBtn.disabled = true;
    mpLocalBtn.disabled = true;
    startSession("peer", true, code).catch((e) => {
      mpSay(e.message, true);
      mpHostBtn.disabled = false;
      mpLocalBtn.disabled = false;
    });
    mpHostBtn.blur();
  });

  mpJoinBtn.addEventListener("click", () => {
    const code = (mpCodeInput.value || "").trim().toUpperCase();
    if (code.length < 4) { mpSay("Enter the code your friend gave you.", true); return; }
    mpSay("Connecting…");
    startSession("peer", false, code).catch((e) => mpSay(e.message, true));
    mpJoinBtn.blur();
  });

  mpLocalBtn.addEventListener("click", () => {
    // Same-browser play: host claims the room, a second tab joins it.
    const existing = mpCodeInput.value.trim().toUpperCase();
    if (existing.length >= 4) {
      startSession("local", false, existing);
      mpSay("Joined the tab next door.");
    } else {
      const code = makeRoomCode();
      mpCodeEl.textContent = code;
      mpCodeDisplay.classList.remove("hidden");
      startSession("local", true, code);
      mpSay("Open this page in another tab, type this code, and press Same Computer.");
    }
    mpLocalBtn.blur();
  });

  // --- shared world (host is authoritative) -------------------------------------
  // The host owns enemies, the clock, and the map. It ships a compact snapshot
  // several times a second; joiners overwrite their copy with it.
  // Enemy lists live in whichever bundle is not currently loaded, so resolve by area.
  function enemiesForArea(area) {
    if (area === currentArea) return enemies;
    const bundle = area === "surface" ? surfaceData : undergroveData;
    return bundle ? bundle.enemies : null;
  }

  function packEnemies(list) {
    return (list || []).map((e) => ({
      x: Math.round(e.x), y: Math.round(e.y),
      hp: Math.round(e.hp), dead: e.dead, facing: e.facing,
    }));
  }

  function unpackEnemies(list, packed) {
    if (!list || !packed) return;
    for (let i = 0; i < Math.min(list.length, packed.length); i++) {
      const src = packed[i];
      list[i].x = src.x;
      list[i].y = src.y;
      list[i].hp = src.hp;
      list[i].dead = src.dead;
      list[i].facing = src.facing;
    }
  }

  function buildWorldSnapshot() {
    return {
      t: "world",
      day: state.day,
      time: state.time,
      passageRevealed: passage.revealed,
      houseBuilt: house.built,
      nedFreed: ned.freed,
      ned: { x: Math.round(ned.x), y: Math.round(ned.y), facing: ned.facing },
      // Both areas travel together — only ~15 entities, cheap at this rate.
      surfaceEnemies: packEnemies(enemiesForArea("surface")),
      undergroveEnemies: packEnemies(enemiesForArea("undergrove")),
    };
  }

  function applyWorldSnapshot(msg) {
    state.day = msg.day;
    state.time = msg.time;
    passage.revealed = !!msg.passageRevealed;
    house.built = !!msg.houseBuilt;
    if (msg.nedFreed && !ned.freed) { ned.freed = true; ned.captive = false; }
    if (msg.ned) { ned.x = msg.ned.x; ned.y = msg.ned.y; ned.facing = msg.ned.facing; }

    unpackEnemies(enemiesForArea("surface"), msg.surfaceEnemies);
    unpackEnemies(enemiesForArea("undergrove"), msg.undergroveEnemies);
  }

  // Joiners never mutate the world directly — they ask the host to do it.
  function requestAction(kind, payload) {
    netSend(Object.assign({ t: "act", kind }, payload));
  }

  function applyRemoteAction(msg) {
    switch (msg.kind) {
      case "damageEnemy": {
        const list = enemiesForArea(msg.area || currentArea);
        const e = list && list[msg.index];
        if (!e || e.dead) return;
        e.hp -= msg.amount;
        if (e.hp <= 0) killEnemy(e, "Your friend");
        break;
      }
      case "harvest": {
        // Remove a tree/rock the other player finished off, so both maps agree.
        const bundle = msg.area === "undergrove" ? undergroveData : surfaceData;
        const targetMap = (msg.area === currentArea) ? map : (bundle ? bundle.map : null);
        if (targetMap && targetMap[msg.r] && targetMap[msg.r][msg.c] !== undefined) {
          targetMap[msg.r][msg.c] = msg.area === "undergrove" ? T_CAVEFLOOR : T_GRASS;
        }
        break;
      }
      case "structure": {
        // Mirror a wall/torch/etc the other player placed.
        const key = `${msg.c},${msg.r}`;
        if (msg.area === currentArea && !structureTiles.has(key)) {
          structures.push({ type: msg.type, x: msg.x, y: msg.y, c: msg.c, r: msg.r });
          structureTiles.add(key);
          if (BLOCKING_STRUCTURES.has(msg.type)) blockedStructureTiles.add(key);
        }
        break;
      }
    }
  }

  // Pumped once per frame: sends our position, and if we host, the world state.
  function netUpdate(dt) {
    if (!net.active || !net.connected) return;

    net.posAccum += dt;
    if (net.posAccum >= 1 / NET_POS_HZ) {
      net.posAccum = 0;
      netSend({
        t: "pos",
        x: Math.round(player.x),
        y: Math.round(player.y),
        facing: player.facing,
        moving: player.moving,
        area: currentArea,
      });
    }

    if (net.isHost) {
      net.worldAccum += dt;
      if (net.worldAccum >= 1 / NET_WORLD_HZ) {
        net.worldAccum = 0;
        netSend(buildWorldSnapshot());
      }
    }

    // Drop a peer that has gone quiet.
    const now = performance.now() / 1000;
    if (now - net.lastHeard > NET_TIMEOUT && net.connected) onPeerLost();
  }

  // ---------- death and recovery ----------
  // Dying costs you half your carried raw materials, but never your tools,
  // buildings, level, or world progress. The run survives; the mistake stings.
  const DEATH_RESOURCE_LOSS = 0.5;
  const RAW_MATERIALS = ["wood", "stone", "fiber", "berry", "egg", "milk"];

  function handleDeath() {
    state.over = true;
    state.overReason = state.lastDamageSource === "combat"
      ? "A thug got the better of you."
      : "You starved.";

    // Work out what dying will cost, so the player can see it before continuing.
    let lost = 0;
    for (const k of RAW_MATERIALS) lost += Math.floor((state.inventory[k] || 0) * DEATH_RESOURCE_LOSS);

    gameoverReason.textContent = state.overReason;
    gameoverDays.textContent = `You survived ${state.day} day${state.day === 1 ? "" : "s"}, reaching Level ${currentLevel()}.`;
    gameoverCost.textContent = lost > 0
      ? `Getting back up will cost you ${lost} raw materials. You keep your tools, buildings and level.`
      : "You keep your tools, buildings and level.";
    gameoverBox.classList.remove("hidden");
  }

  function respawn() {
    for (const k of RAW_MATERIALS) {
      state.inventory[k] = Math.ceil((state.inventory[k] || 0) * (1 - DEATH_RESOURCE_LOSS));
    }

    // Wake up on the surface, by the house if it's standing.
    if (currentArea === "undergrove") exitUndergrove();
    player.x = house.x;
    player.y = house.y + TILE * 2;
    if (!canStandAt(player.x, player.y)) {
      player.x = Math.floor(COLS / 2) * TILE + TILE / 2;
      player.y = Math.floor(ROWS / 2) * TILE + TILE / 2;
    }

    state.health = state.maxHealth;
    state.hunger = Math.max(state.hunger, 60);
    state.lastDamageSource = null;
    state.over = false;

    gameoverBox.classList.add("hidden");
    updateInventoryHud();
    sfx("heal");
    toast("You come to, back at the house.");
    autosave();
  }

  function tryUseBandage() {
    if (state.inventory.bandage > 0) {
      state.inventory.bandage -= 1;
      state.health = Math.min(state.maxHealth, state.health + BANDAGE_HEAL);
      sfx("heal");
      toast(`Used a bandage (+${BANDAGE_HEAL} Health)`);
      updateInventoryHud();
    } else {
      sfx("error");
      toast("No bandages to use");
    }
  }

  function tryPlace(type) {
    if ((state.inventory[type] || 0) <= 0) {
      toast(`No ${type} to place`);
      return;
    }
    const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing];
    const tx = player.x + dirVec[0] * TILE;
    const ty = player.y + dirVec[1] * TILE;
    const c = Math.floor(tx / TILE);
    const r = Math.floor(ty / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) {
      toast("Can't place there");
      return;
    }
    if (BLOCKED.has(map[r][c])) {
      toast("Can't place there");
      return;
    }
    const key = `${c},${r}`;
    if (structureTiles.has(key)) {
      toast("Something is already there");
      return;
    }

    if (BLOCKING_STRUCTURES.has(type)) {
      blockedStructureTiles.add(key);
      if (!canStandAt(player.x, player.y)) {
        blockedStructureTiles.delete(key);
        toast("Too close to yourself to place there");
        return;
      }
    }

    const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
    structures.push({ type, x: cx, y: cy, c, r });
    structureTiles.add(key);
    state.inventory[type] -= 1;
    sfx("place");
    toast(`Placed ${type[0].toUpperCase()}${type.slice(1)}`);
    updateInventoryHud();
    if (net.active && net.connected) {
      requestAction("structure", { type, x: cx, y: cy, c, r, area: currentArea });
    }
  }

  function tryInteractHouse() {
    if (!house.built) {
      const needWood = house.woodNeeded - house.woodGiven;
      const needStone = house.stoneNeeded - house.stoneGiven;
      const giveWood = Math.min(state.inventory.wood, needWood);
      const giveStone = Math.min(state.inventory.stone, needStone);
      if (giveWood <= 0 && giveStone <= 0) {
        toast(`Need ${needWood} more Wood, ${needStone} more Stone to repair`);
        return;
      }
      state.inventory.wood -= giveWood;
      house.woodGiven += giveWood;
      state.inventory.stone -= giveStone;
      house.stoneGiven += giveStone;
      updateInventoryHud();
      if (house.woodGiven >= house.woodNeeded && house.stoneGiven >= house.stoneNeeded) {
        house.built = true;
        toast("The house is repaired! Press E here to sleep.");
      } else {
        toast(`Repairing house: ${house.woodGiven}/${house.woodNeeded} Wood, ${house.stoneGiven}/${house.stoneNeeded} Stone`);
      }
    } else {
      state.sleeping.active = true;
      state.sleeping.t = 0;
      state.sleeping.applied = false;
    }
  }

  function findNearbyBedroll() {
    return structures.find((s) => s.type === "bedroll" && dist(player.x, player.y, s.x, s.y) < INTERACT_RADIUS);
  }

  function findNearbyWorkbench() {
    return structures.find((s) => s.type === "workbench" && dist(player.x, player.y, s.x, s.y) < INTERACT_RADIUS);
  }

  function tryInteractE() {
    if (findNearbyWorkbench()) {
      setUpgradeOpen(true);
      return;
    }
    if (findNearbyBedroll()) {
      state.sleeping.active = true;
      state.sleeping.t = 0;
      state.sleeping.applied = false;
      return;
    }
    if (currentArea === "surface") {
      if (dist(player.x, player.y, house.x, house.y) < INTERACT_RADIUS) {
        tryInteractHouse();
        return;
      }
      if (!ned.freed && dist(player.x, player.y, ned.x, ned.y) < INTERACT_RADIUS) {
        ned.captive = false;
        ned.freed = true;
        toast("You freed Ned! He'll fight by your side now.");
        return;
      }
      if (passage.revealed && dist(player.x, player.y, passage.x, passage.y) < INTERACT_RADIUS) {
        enterUndergrove();
        return;
      }
      if (!passage.revealed && dist(player.x, player.y, passage.x, passage.y) < INTERACT_RADIUS) {
        toast("The log hasn't rotted through yet.");
        return;
      }
    } else {
      if (dist(player.x, player.y, exitStairs.x, exitStairs.y) < INTERACT_RADIUS) {
        exitUndergrove();
        return;
      }
    }
    toast("Nothing to interact with here");
  }

  // ---------- wildlife / enemy AI ----------
  function wanderStep(entity, dt, speed) {
    if (!entity.wanderTarget) {
      if (entity.wanderPauseT > 0) {
        entity.wanderPauseT -= dt;
        return;
      }
      if (Math.random() < 0.35) {
        entity.wanderPauseT = randInt(1, 3);
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const r = randInt(40, 110);
      entity.wanderTarget = { x: entity.homeX + Math.cos(angle) * r, y: entity.homeY + Math.sin(angle) * r };
    }
    if (Math.random() < dt * 0.15) {
      entity.wanderTarget = null;
      return;
    }
    const dx = entity.wanderTarget.x - entity.x;
    const dy = entity.wanderTarget.y - entity.y;
    const d = Math.hypot(dx, dy);
    if (d < 5) {
      entity.wanderTarget = null;
      return;
    }
    const nx = entity.x + (dx / d) * speed * dt;
    const ny = entity.y + (dy / d) * speed * dt;
    if (canStandAt(nx, entity.y)) entity.x = nx;
    if (canStandAt(entity.x, ny)) entity.y = ny;
    entity.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }

  function reviveEnemy(e) {
    let attempts = 0;
    while (attempts < 2000) {
      attempts++;
      const c = randInt(1, COLS - 2);
      const r = randInt(1, ROWS - 2);
      if (!BLOCKED.has(map[r][c])) {
        const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
        if (dist(x, y, player.x, player.y) > 300) {
          e.x = x; e.y = y; e.homeX = x; e.homeY = y;
          e.hp = e.maxHp; e.dead = false; e.state = "wander";
          e.wanderTarget = null; e.wanderPauseT = 0; e.attackCooldown = 0;
          return;
        }
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) {
        if (!e.guardsCave && !e.isBoss) {
          e.respawnTimer -= dt;
          if (e.respawnTimer <= 0) reviveEnemy(e);
        }
        continue;
      }
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      // Cave guards stay in their camp. Without this they chase the player out
      // onto the surface, where the dome hides them — invisible attackers.
      if (e.guardsCave && !isInsideCaveBounds(player.x, player.y)) {
        e.state = "wander";
        wanderStep(e, dt, THUG_WANDER_SPEED);
        if (!isInsideCaveBounds(e.x, e.y)) {
          e.x = e.homeX;
          e.y = e.homeY;
          e.wanderTarget = null;
        }
        continue;
      }

      const dPlayer = dist(e.x, e.y, player.x, player.y);
      const aggroRadius = e.aggroRadius || THUG_AGGRO_RADIUS;
      if (e.state === "wander" && dPlayer < aggroRadius) e.state = "chase";
      if (e.state === "chase" && dPlayer > THUG_GIVEUP_RADIUS) e.state = "wander";

      if (e.state === "chase") {
        const dx = player.x - e.x, dy = player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = e.chaseSpeed || THUG_CHASE_SPEED;
        const nx = e.x + (dx / d) * speed * dt;
        const ny = e.y + (dy / d) * speed * dt;
        if (canStandAt(nx, e.y)) e.x = nx;
        if (canStandAt(e.x, ny)) e.y = ny;
        e.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        if (d < (e.contactRadius || THUG_CONTACT_RADIUS) && e.attackCooldown <= 0) {
          dealDamageToPlayer(e.atk || THUG_ATTACK_DAMAGE, "combat");
          e.attackCooldown = THUG_ATTACK_COOLDOWN;
        }
      } else {
        wanderStep(e, dt, THUG_WANDER_SPEED);
      }
    }
  }

  function updateAnimals(dt) {
    for (const a of animals) {
      wanderStep(a, dt, ANIMAL_WANDER_SPEED);
      if (!a.resourceReady) {
        a.regrowT += dt;
        const need = a.kind === "cow" ? COW_MILK_REGROW : CHICKEN_EGG_REGROW;
        if (a.regrowT >= need) a.resourceReady = true;
      }
    }
  }

  function updateNed(dt) {
    if (!ned.freed) return;
    ned.attackCooldown = Math.max(0, ned.attackCooldown - dt);

    let target = null, bestD = NED_ATTACK_RADIUS;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(ned.x, ned.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        target = e;
      }
    }

    if (target) {
      const dx = target.x - ned.x, dy = target.y - ned.y;
      ned.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      ned.moving = false;
      if (ned.attackCooldown <= 0) {
        target.hp -= NED_DAMAGE;
        ned.attackCooldown = NED_ATTACK_COOLDOWN;
        lastNedCastTime = performance.now();
        sfx("magic");
        lastNedCastX = target.x;
        lastNedCastY = target.y;
        if (target.hp <= 0) killEnemy(target, "Ned");
      }
      return;
    }

    const d = dist(ned.x, ned.y, player.x, player.y);
    if (d > NED_FOLLOW_DISTANCE) {
      const dx = player.x - ned.x, dy = player.y - ned.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = ned.x + (dx / len) * NED_FOLLOW_SPEED * dt;
      const ny = ned.y + (dy / len) * NED_FOLLOW_SPEED * dt;
      if (canStandAt(nx, ned.y)) ned.x = nx;
      if (canStandAt(ned.x, ny)) ned.y = ny;
      ned.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      ned.moving = true;
    } else {
      ned.moving = false;
    }
  }

  // ---------- update ----------
  let lastTime = performance.now();

  function update(dt) {
    if (justPressed.has("c") && !state.over && !state.sleeping.active) {
      setCraftOpen(!state.craftOpen);
    }
    justPressed.delete("c");

    if (justPressed.has("i") && !state.over && !state.sleeping.active) {
      setInventoryOpen(!state.inventoryOpen);
    }
    justPressed.delete("i");

    if (justPressed.has("e") && state.upgradeOpen) {
      setUpgradeOpen(false);
      justPressed.delete("e");
    }

    if (justPressed.has("j") && !state.over && !state.sleeping.active) {
      setMpOpen(!state.mpOpen);
    }
    justPressed.delete("j");

    // Escape closes whichever panel is open.
    if (justPressed.has("escape")) {
      if (state.craftOpen) setCraftOpen(false);
      if (state.inventoryOpen) setInventoryOpen(false);
      if (state.upgradeOpen) setUpgradeOpen(false);
      if (state.mpOpen) setMpOpen(false);
      justPressed.delete("escape");
    }

    if (state.craftOpen || state.inventoryOpen || state.upgradeOpen || state.mpOpen) {
      justPressed.clear();
      return;
    }

    if (state.sleeping.active) {
      state.sleeping.t += dt;
      if (!state.sleeping.applied && state.sleeping.t >= SLEEP_DURATION / 2) {
        state.nightsSurvived += 1;
        state.maxHealth = Math.min(100, START_MAX_HEALTH + state.nightsSurvived * ((100 - START_MAX_HEALTH) / RECOVERY_NIGHTS));
        state.health = Math.min(state.maxHealth, state.health + SLEEP_HEALTH_RESTORE);
        state.day += 1;
        state.time = 0.0;
        state.sleeping.applied = true;
        sfx("sleep");
        toast("You slept through the night");
        autosave();
      }
      if (state.sleeping.t >= SLEEP_DURATION) {
        state.sleeping.active = false;
      }
      justPressed.clear();
      return;
    }

    if (state.over || state.victory) {
      justPressed.clear();
      return;
    }

    state.time += dt / DAY_LENGTH;
    if (state.time >= 1) {
      state.time -= 1;
      state.day += 1;
    }

    if (!passage.revealed && state.day >= PASSAGE_REVEAL_DAY) {
      passage.revealed = true;
      toast("The rotting log finally gives way, revealing a hidden hole in the ground!");
    }

    let dx = 0, dy = 0;
    if (isDown("w", "arrowup")) dy -= 1;
    if (isDown("s", "arrowdown")) dy += 1;
    if (isDown("a", "arrowleft")) dx -= 1;
    if (isDown("d", "arrowright")) dx += 1;

    const moving = dx !== 0 || dy !== 0;
    player.moving = moving;

    const sprinting = isDown("shift") && moving;

    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      if (Math.abs(dx) > Math.abs(dy)) {
        player.facing = dx > 0 ? "right" : "left";
      } else {
        player.facing = dy > 0 ? "down" : "up";
      }

      let speed = PLAYER_SPEED;
      if (sprinting) speed *= SPRINT_MULT;

      const nx = player.x + dx * speed * dt;
      const ny = player.y + dy * speed * dt;

      if (canStandAt(nx, player.y)) player.x = nx;
      if (canStandAt(player.x, ny)) player.y = ny;

      player.x = Math.max(PLAYER_SIZE, Math.min(WORLD_W - PLAYER_SIZE, player.x));
      player.y = Math.max(PLAYER_SIZE, Math.min(WORLD_H - PLAYER_SIZE, player.y));
    }

    revealAround(player.x, player.y, FOG_SIGHT_RADIUS);

    if (!state.foundCave && isInsideCaveBounds(player.x, player.y)) {
      state.foundCave = true;
    }

    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL) {
      autosaveTimer = 0;
      autosave();
    }

    netUpdate(dt);

    // A joiner receives enemies and Ned from the host, so running the local AI
    // too would make them jitter between two sets of positions.
    const simOwner = !net.active || !net.connected || net.isHost;
    if (simOwner) {
      updateEnemies(dt);
      updateNed(dt);
    }
    updateAnimals(dt);

    const deep = currentArea === "undergrove";
    const hungerBase = deep ? HUNGER_DRAIN_UNDERGROVE : HUNGER_DRAIN_SURFACE;
    const hungerRate = hungerBase * (sprinting ? SPRINT_HUNGER_MULT : 1);
    state.hunger = Math.max(0, state.hunger - hungerRate * dt);

    if (state.hunger <= 0) {
      state.health -= (deep ? STARVE_HEALTH_DRAIN_UNDERGROVE : STARVE_HEALTH_DRAIN_SURFACE) * dt;
      state.lastDamageSource = "starve";
    }
    if (state.hunger > 60 && state.health < state.maxHealth) {
      const regen = deep ? REGEN_HEALTH_RATE_UNDERGROVE : REGEN_HEALTH_RATE_SURFACE;
      state.health = Math.min(state.maxHealth, state.health + regen * dt);
    }
    state.health = Math.max(0, Math.min(state.maxHealth, state.health));

    if (state.health <= 0 && !state.over) {
      handleDeath();
    }

    for (const b of bushes) {
      if (b.berries < BUSH_MAX_BERRIES) {
        b.regrowT += dt;
        if (b.regrowT >= BUSH_REGROW_TIME) {
          b.berries = Math.min(BUSH_MAX_BERRIES, b.berries + 1);
          b.regrowT = 0;
        }
      }
    }
    for (const g of tufts) {
      if (!g.available) {
        g.regrowT += dt;
        if (g.regrowT >= TUFT_REGROW_TIME) g.available = true;
      }
    }

    if (justPressed.has(" ")) tryAttackOrGather();
    if (justPressed.has("f")) tryEat();
    if (justPressed.has("b")) tryUseBandage();
    if (justPressed.has("1")) tryPlace("wall");
    if (justPressed.has("2")) tryPlace("stonewall");
    if (justPressed.has("3")) tryPlace("campfire");
    if (justPressed.has("4")) tryPlace("torch");
    if (justPressed.has("5")) tryPlace("bedroll");
    if (justPressed.has("6")) tryPlace("workbench");
    if (justPressed.has("e")) tryInteractE();
    if (justPressed.has("p")) saveGame();
    if (justPressed.has("l")) loadGame();

    justPressed.clear();
  }

  // ---------- rendering ----------
  function computeCamera() {
    let camX = player.x - VIEW_W / 2;
    let camY = player.y - VIEW_H / 2;
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, camX));
    camY = Math.max(0, Math.min(WORLD_H - VIEW_H, camY));
    return { camX: Math.round(camX), camY: Math.round(camY) };
  }

  function tileColor(t, c, r) {
    switch (t) {
      case T_GRASS:
        return (c + r) % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
      case T_WATER:
        return PALETTE.water;
      case T_DIRT:
        return PALETTE.dirt;
      case T_CAVEFLOOR:
        return (c + r) % 2 === 0 ? "#3A342E" : "#332E29";
      case T_CAVEWALL:
        return (c + r) % 2 === 0 ? "#2B2723" : "#241F1A";
      case T_CLIFF:
        return (c + r) % 2 === 0 ? "#5C4A3D" : "#4E3F34";
      default:
        return (c + r) % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
    }
  }

  function domeTileColor(c, r) {
    return (c + r) % 2 === 0 ? "#5A6058" : "#4E5349";
  }

  function isInsideCaveBounds(x, y) {
    return currentArea === "surface" && caveBounds &&
      x > caveBounds.minX && x < caveBounds.maxX &&
      y > caveBounds.minY && y < caveBounds.maxY;
  }

  function drawTree(x, y) {
    drawGridSprite(TREE_SPRITE, TREE_PALETTE, x, y, TILE / 8);
  }

  function drawRock(x, y) {
    drawGridSprite(ROCK_SPRITE, ROCK_PALETTE, x, y, TILE / 8);
  }

  function drawBush(b) {
    const grid = b.berries > 0 ? BUSH_FULL_SPRITE : BUSH_EMPTY_SPRITE;
    drawGridSprite(grid, BUSH_PALETTE, b.x - 16, b.y - 16, 4);
  }

  function drawTuft(g) {
    if (!g.available) return;
    ctx.fillStyle = "#9fe05c";
    for (const ox of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(g.x + ox, g.y + 8);
      ctx.lineTo(g.x + ox - 2, g.y - 6);
      ctx.lineTo(g.x + ox + 2, g.y - 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWallStructure(s) {
    drawGridSprite(WALL_SPRITE, WALL_PALETTE, s.x - 16, s.y - 16, 4);
  }

  function drawStoneWallStructure(s) {
    drawGridSprite(STONEWALL_SPRITE, STONEWALL_PALETTE, s.x - 16, s.y - 16, 4);
  }

  function drawBedrollStructure(s) {
    drawGridSprite(BEDROLL_SPRITE, BEDROLL_PALETTE, s.x - 16, s.y - 16, 4);
  }

  function drawWorkbenchStructure(s) {
    drawGridSprite(WORKBENCH_SPRITE, WORKBENCH_PALETTE, s.x - 16, s.y - 16, 4);
  }

  function drawTorch(s, time) {
    drawGridSprite(TORCH_BASE_SPRITE, TORCH_PALETTE, s.x - 16, s.y - 16, 4);
    const flick = Math.sin(time / 90 + s.x) * 2;
    ctx.fillStyle = PALETTE.flameOuter;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8 + flick, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.flameInner;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8 + flick, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCampfire(s, time) {
    drawGridSprite(CAMPFIRE_BASE_SPRITE, CAMPFIRE_PALETTE, s.x - 16, s.y - 16, 4);
    const flick = Math.sin(time / 80 + s.x) * 3;
    ctx.fillStyle = PALETTE.flameOuter;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 12 + flick);
    ctx.lineTo(s.x - 7, s.y + 8);
    ctx.lineTo(s.x + 7, s.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.flameInner;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 4 + flick);
    ctx.lineTo(s.x - 4, s.y + 7);
    ctx.lineTo(s.x + 4, s.y + 7);
    ctx.closePath();
    ctx.fill();
  }

  function drawLightGlow(s, time) {
    const baseRadius = s.type === "campfire" ? 110 : 70;
    const flick = Math.sin(time / 150 + s.x) * 7;
    const radius = baseRadius + flick;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
    grad.addColorStop(0, "rgba(255,210,130,0.85)");
    grad.addColorStop(0.35, "rgba(255,170,80,0.55)");
    grad.addColorStop(0.7, "rgba(255,140,50,0.22)");
    grad.addColorStop(1, "rgba(255,140,50,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHouse(h) {
    const palette = h.built ? HOUSE_PALETTE : RUINED_HOUSE_PALETTE;
    const skip = h.built ? null : HOUSE_RUINED_SKIP;
    drawGridSprite(HOUSE_GRID, palette, h.x - 24, h.y - 24, 4, skip);
  }

  function drawPassage(p) {
    if (!p.revealed) {
      drawRottingLog(p);
      return;
    }
    ctx.fillStyle = "#05060A";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3A3F4A";
    for (const [ox, oy] of [[-16, -8], [14, -10], [-14, 10], [16, 8]]) {
      ctx.fillRect(p.x + ox - 3, p.y + oy - 3, 6, 6);
    }
  }

  function drawRottingLog(p) {
    ctx.fillStyle = "#4A5A32";
    ctx.fillRect(p.x - 20, p.y - 8, 40, 16);
    ctx.fillStyle = "#3A4726";
    for (const [ox, oy] of [[-12, -4], [4, 2], [14, -3]]) {
      ctx.fillRect(p.x + ox, p.y + oy, 6, 5);
    }
    ctx.fillStyle = "#2E2A1F";
    ctx.beginPath();
    ctx.ellipse(p.x - 20, p.y, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + 20, p.y, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawExitStairs(s) {
    ctx.fillStyle = "#8A8378";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(s.x - 16 + i * 8, s.y + 12 - i * 6, 8, 6);
    }
    ctx.fillStyle = "#6F6A60";
    ctx.fillRect(s.x - 16, s.y - 16, 32, 6);
  }

  function drawAnimal(a) {
    const grid = a.kind === "cow" ? COW_SPRITE : CHICKEN_SPRITE;
    const pal = a.kind === "cow" ? COW_PALETTE : CHICKEN_PALETTE;
    drawGridSprite(grid, pal, a.x - 16, a.y - 16, 4);
  }

  function drawEnemy(e) {
    if (e.dead) return;
    if (e.isBoss) {
      drawBoss(e);
      return;
    }
    const grid = HUMANOID_SPRITES[e.facing] || HUMANOID_SPRITES.down;
    drawGridSprite(grid, thugPalette(), e.x - 16, e.y - 16, 4);
    if (e.hp < e.maxHp) {
      const w = 24;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - 22, w, 4);
      ctx.fillStyle = "#E4453F";
      ctx.fillRect(e.x - w / 2, e.y - 22, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function goblinPalette() {
    return {
      1: "#0F1A0C",
      2: "#4A9A3A",
      3: "#2E3B22",
      4: shade("#2E3B22", -30),
      5: "#1A1A1A",
      6: "#141414",
    };
  }

  function drawBoss(e) {
    const grid = HUMANOID_SPRITES[e.facing] || HUMANOID_SPRITES.down;
    const pixelSize = 7;
    drawGridSprite(grid, goblinPalette(), e.x - (8 * pixelSize) / 2, e.y - (8 * pixelSize) / 2, pixelSize);

    ctx.fillStyle = "#8A8F99";
    ctx.fillRect(e.x - 20, e.y - 32, 40, 6);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.fillStyle = `rgba(90,200,255,${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 29, 3, 0, Math.PI * 2);
    ctx.fill();

    const w = 64;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(e.x - w / 2, e.y - 44, w, 6);
    ctx.fillStyle = "#E4453F";
    ctx.fillRect(e.x - w / 2, e.y - 44, w * Math.max(0, e.hp / e.maxHp), 6);
  }

  // The other player, in green so you can tell who is who at a glance.
  function remotePalette() {
    return {
      1: "#1C2412",
      2: PALETTE.playerHead,
      3: "#3FBF6A",
      4: shade("#3FBF6A", -40),
      5: "#7A4A1E",
      6: "#5B3D24",
    };
  }

  function drawRemotePlayer() {
    if (!net.active || !net.connected || !net.remote.present) return;
    if (net.remote.area !== currentArea) return; // they're in the other world

    const r = net.remote;
    const bob = r.moving ? Math.sin(performance.now() / 90) * 1.5 : 0;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 13, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const grid = HUMANOID_SPRITES[r.facing] || HUMANOID_SPRITES.down;
    drawGridSprite(grid, remotePalette(), r.x - 16, r.y - 16 + bob - 3, 4);

    ctx.fillStyle = "rgba(159,224,120,0.95)";
    ctx.font = "10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("friend", r.x, r.y - 24);
  }

  function drawPlayer() {
    const { x, y, facing } = player;
    const bob = player.moving ? Math.sin(performance.now() / 90) * 1.5 : 0;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const grid = HUMANOID_SPRITES[facing] || HUMANOID_SPRITES.down;
    const pal = playerPalette();
    const pixelSize = 4;
    const originX = x - (8 * pixelSize) / 2;
    const originY = y - (8 * pixelSize) / 2 + bob - 3;
    drawGridSprite(grid, pal, originX, originY, pixelSize);
  }

  function drawSwingEffect(now) {
    if (now - lastAttackTime >= 150) return;
    const alpha = 1 - (now - lastAttackTime) / 150;
    const dirOffsets = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[lastAttackDir];
    const sx = player.x + dirOffsets[0] * 16, sy = player.y + dirOffsets[1] * 16;
    ctx.strokeStyle = `rgba(235,235,235,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 1.3);
    ctx.stroke();
  }

  function nedPalette() {
    return {
      1: "#1C2412",
      2: "#C9A47A",
      3: "#5B3A8C",
      4: shade("#5B3A8C", -40),
      5: "#4A2E70",
      6: "#2A2A2A",
    };
  }

  function drawNed(n) {
    const grid = HUMANOID_SPRITES[n.facing] || HUMANOID_SPRITES.down;
    const bob = n.moving ? Math.sin(performance.now() / 90) * 1.5 : 0;
    drawGridSprite(grid, nedPalette(), n.x - 16, n.y - 16 + bob, 4);

    const staffX = n.x + (n.facing === "left" ? -11 : 11);
    ctx.fillStyle = "#6B4A2E";
    ctx.fillRect(staffX - 1, n.y - 16 + bob, 2, 20);
    ctx.fillStyle = "#9F6FE0";
    ctx.beginPath();
    ctx.arc(staffX, n.y - 17 + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    if (n.captive) {
      ctx.strokeStyle = "#2A2A2A";
      ctx.lineWidth = 2;
      for (const ox of [-14, -5, 5, 14]) {
        ctx.beginPath();
        ctx.moveTo(n.x + ox, n.y - 18);
        ctx.lineTo(n.x + ox, n.y + 14);
        ctx.stroke();
      }
    }
  }

  function drawNedCastEffect(now) {
    if (now - lastNedCastTime >= 220) return;
    const t = (now - lastNedCastTime) / 220;
    const alpha = 1 - t;
    ctx.fillStyle = `rgba(159,111,224,${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(lastNedCastX, lastNedCastY, 10 + t * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(210,180,255,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lastNedCastX, lastNedCastY, 14 + t * 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawElephantSkull(x, y) {
    drawGridSprite(SKULL_SPRITE, SKULL_PALETTE, x - 20, y - 16, 4);
  }

  function drawBloodStain(x, y, scale) {
    ctx.fillStyle = "rgba(110, 20, 20, 0.55)";
    const spots = [[0, 0, 7 * scale], [6 * scale, 3 * scale, 3 * scale], [-5 * scale, 4 * scale, 3 * scale], [2 * scale, -5 * scale, 2.5 * scale]];
    for (const [ox, oy, r] of spots) {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, r, r * 0.6, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCaveDecor() {
    if (!caveDecor) return;
    for (const b of caveDecor.bloodStains) drawBloodStain(b.x, b.y, b.scale);
    drawElephantSkull(caveDecor.skull.x, caveDecor.skull.y);
  }

  // The cave sits in a far corner behind fog, and the whole story is inside it.
  // Once the player has had a day to settle in, point them at it from the screen
  // edge until they find it. The marker disappears for good after their first visit.
  function drawCaveCompass(camX, camY) {
    if (currentArea !== "surface" || !caveBounds || state.foundCave) return;
    if (state.day < CAVE_HINT_DAY) return;

    const cx = (caveBounds.minX + caveBounds.maxX) / 2;
    const cy = (caveBounds.minY + caveBounds.maxY) / 2;
    const sx = cx - camX;
    const sy = cy - camY;

    const margin = 34;
    const onScreen = sx > 0 && sx < VIEW_W && sy > 0 && sy < VIEW_H;
    if (onScreen) return; // they can see it; no need to nag

    const dx = sx - VIEW_W / 2;
    const dy = sy - VIEW_H / 2;
    const angle = Math.atan2(dy, dx);

    const halfW = VIEW_W / 2 - margin;
    const halfH = VIEW_H / 2 - margin;
    const scale = Math.min(halfW / Math.abs(Math.cos(angle) || 1e-6), halfH / Math.abs(Math.sin(angle) || 1e-6));
    const ax = VIEW_W / 2 + Math.cos(angle) * scale;
    const ay = VIEW_H / 2 + Math.sin(angle) * scale;

    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(255, 210, 63, ${pulse})`;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(30,24,8,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = `rgba(255, 210, 63, ${pulse})`;
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("something out here", ax, ay + 26);
  }

  function render() {
    const now = performance.now();
    const { camX, camY } = computeCamera();
    const insideCave = isInsideCaveBounds(player.x, player.y);
    const domeHidden = currentArea === "surface" && caveBounds && !insideCave;

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-camX, -camY);

    const startCol = Math.max(0, Math.floor(camX / TILE));
    const endCol = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE));
    const startRow = Math.max(0, Math.floor(camY / TILE));
    const endRow = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H) / TILE));

    const inDomeTile = (c, r) => domeHidden && c >= caveBounds.tileMinC && c <= caveBounds.tileMaxC &&
      r >= caveBounds.tileMinR && r <= caveBounds.tileMaxR;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const t = map[r][c];
        if (inDomeTile(c, r)) {
          ctx.fillStyle = domeTileColor(c, r);
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          continue;
        }
        ctx.fillStyle = tileColor(t, c, r);
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        if (t === T_WATER) {
          const shimmer = (Math.sin(now / 400 + c + r) + 1) / 2;
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.globalAlpha = shimmer * 0.4;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          ctx.globalAlpha = 1;
        }
      }
    }

    if (domeHidden) {
      const cx = (caveBounds.minX + caveBounds.maxX) / 2;
      const cy = (caveBounds.minY + caveBounds.maxY) / 2;
      const rw = (caveBounds.maxX - caveBounds.minX) / 2 + 6;
      const rh = (caveBounds.maxY - caveBounds.minY) / 2 + 6;
      const grad = ctx.createRadialGradient(cx, cy - rh * 0.3, 8, cx, cy, Math.max(rw, rh) * 1.3);
      grad.addColorStop(0, "rgba(130,136,124,0.4)");
      grad.addColorStop(1, "rgba(60,64,58,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw * 1.3, rh * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (inDomeTile(c, r)) continue;
        const t = map[r][c];
        if (t === T_TREE) drawTree(c * TILE, r * TILE);
        else if (t === T_ROCK) drawRock(c * TILE, r * TILE);
      }
    }

    for (const g of tufts) drawTuft(g);
    for (const b of bushes) drawBush(b);
    for (const a of animals) drawAnimal(a);
    for (const s of structures) {
      if (domeHidden && s.c >= caveBounds.tileMinC && s.c <= caveBounds.tileMaxC &&
        s.r >= caveBounds.tileMinR && s.r <= caveBounds.tileMaxR) continue;
      if (s.type === "wall") drawWallStructure(s);
      else if (s.type === "stonewall") drawStoneWallStructure(s);
      else if (s.type === "torch") { drawTorch(s, now); drawLightGlow(s, now); }
      else if (s.type === "campfire") { drawCampfire(s, now); drawLightGlow(s, now); }
      else if (s.type === "bedroll") drawBedrollStructure(s);
      else if (s.type === "workbench") drawWorkbenchStructure(s);
    }
    if (currentArea === "surface") {
      drawHouse(house);
      if (insideCave) {
        drawPassage(passage);
        drawCaveDecor();
      }
    } else {
      drawExitStairs(exitStairs);
    }
    for (const e of enemies) {
      if (e.guardsCave && domeHidden) continue;
      drawEnemy(e);
    }
    const nedHidden = domeHidden && isInsideCaveBounds(ned.x, ned.y);
    if ((ned.freed || currentArea === "surface") && !nedHidden) drawNed(ned);
    drawRemotePlayer();
    drawPlayer();
    drawSwingEffect(now);
    drawNedCastEffect(now);

    // Fog of war: unseen tiles are solid black, seen-but-distant tiles are dimmed.
    // Drawn last in world space so it hides entities standing in the fog too.
    if (explored) {
      const pc = player.x / TILE - 0.5;
      const pr = player.y / TILE - 0.5;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const seen = explored[r][c];
          if (!seen) {
            ctx.fillStyle = "#05060A";
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          } else if (dist(c, r, pc, pr) > FOG_SIGHT_RADIUS) {
            ctx.fillStyle = `rgba(5, 6, 10, ${FOG_MEMORY_DIM})`;
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }
    }

    ctx.restore();

    const darkness = currentArea === "undergrove" ? 0.8 : insideCave ? 0.6 : (1 - daylightFactor()) * 0.72;
    if (darkness > 0.01) {
      ctx.fillStyle = `rgba(10, 14, 35, ${darkness})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.globalCompositeOperation = "destination-out";
      for (const s of structures) {
        if (s.type !== "campfire" && s.type !== "torch") continue;
        const sx = s.x - camX, sy = s.y - camY;
        if (sx < -150 || sx > VIEW_W + 150 || sy < -150 || sy > VIEW_H + 150) continue;
        const radius = s.type === "campfire" ? 120 + Math.sin(now / 300) * 8 : 75 + Math.sin(now / 300) * 5;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        grad.addColorStop(0, "rgba(0,0,0,0.95)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    drawCaveCompass(camX, camY);

    if (now - lastHitTime < 200) {
      const alpha = (1 - (now - lastHitTime) / 200) * 0.35;
      ctx.fillStyle = `rgba(220,30,30,${alpha})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (state.sleeping.active) {
      const t = state.sleeping.t / SLEEP_DURATION;
      const alpha = Math.sin(Math.PI * Math.min(1, t)) * 0.95;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // ---------- inventory icons ----------
  // Small 8x8 pixel icons so slots read as objects, not coloured squares.
  const ICON_WOOD = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 2, 3, 2, 2, 3, 2, 1],
      [1, 3, 2, 2, 3, 2, 2, 1],
      [1, 2, 2, 3, 2, 2, 3, 1],
      [1, 2, 3, 2, 2, 3, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#1C2412", 2: "#D89A4A", 3: "#A9713A" },
  };
  const ICON_FIBER = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 2, 0, 0],
      [0, 2, 0, 2, 0, 2, 0, 0],
      [0, 2, 2, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 2: "#9FE05C", 3: "#5E9A34" },
  };
  const ICON_BERRY = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 3, 0, 0, 0, 0],
      [0, 0, 3, 3, 0, 0, 0, 0],
      [0, 1, 2, 2, 1, 0, 0, 0],
      [1, 2, 2, 2, 2, 1, 0, 0],
      [1, 2, 2, 2, 2, 1, 0, 0],
      [0, 1, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#7A1010", 2: "#FF3B3B", 3: "#2FE065" },
  };
  const ICON_EGG = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 1, 2, 2, 2, 1, 0, 0],
      [1, 2, 2, 2, 3, 2, 1, 0],
      [1, 2, 2, 2, 2, 2, 1, 0],
      [1, 2, 2, 2, 2, 2, 1, 0],
      [0, 1, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#8A7A55", 2: "#FFF3D1", 3: "#FFFFFF" },
  };
  const ICON_MILK = {
    grid: [
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 2, 1, 0, 0, 0],
      [0, 1, 2, 2, 2, 1, 0, 0],
      [0, 1, 2, 2, 2, 1, 0, 0],
      [0, 1, 3, 3, 3, 1, 0, 0],
      [0, 1, 3, 3, 3, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#5A6068", 2: "#DDE6F0", 3: "#F5F5F5" },
  };
  const ICON_BANDAGE = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 2, 3, 2, 2, 2, 1],
      [1, 2, 3, 3, 3, 2, 2, 1],
      [1, 2, 2, 3, 2, 2, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#9AA0A6", 2: "#F0F0F0", 3: "#E4453F" },
  };
  const ICON_TRAILMIX = {
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [1, 2, 3, 2, 4, 2, 2, 1],
      [1, 2, 2, 4, 2, 3, 2, 1],
      [1, 2, 4, 2, 2, 2, 3, 1],
      [1, 2, 2, 3, 2, 4, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#5B3D24", 2: "#C9915A", 3: "#FF3B3B", 4: "#7A4A1E" },
  };
  const ICON_MEAL = {
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 4, 0, 0, 0, 0],
      [0, 0, 4, 0, 4, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 2, 3, 2, 2, 3, 2, 1],
      [1, 2, 2, 3, 2, 2, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ],
    palette: { 1: "#5A6068", 2: "#E8C08A", 3: "#C4643F", 4: "#AAB4C0" },
  };

  const ICON_CAMPFIRE = {
    grid: [
      [0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 2, 3, 2, 0, 0, 0],
      [0, 2, 3, 3, 3, 2, 0, 0],
      [0, 2, 3, 4, 3, 2, 0, 0],
      [0, 2, 3, 3, 3, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0, 0],
      [0, 1, 5, 5, 5, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    palette: { 1: "#1C2412", 2: "#FF8C1A", 3: "#FFD23F", 4: "#FFFFFF", 5: "#B9B9B9" },
  };
  const ICON_TORCH = {
    grid: [
      [0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 2, 3, 2, 0, 0, 0],
      [0, 0, 2, 3, 2, 0, 0, 0],
      [0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 1, 4, 1, 0, 0, 0],
      [0, 0, 1, 4, 1, 0, 0, 0],
      [0, 0, 1, 4, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
    ],
    palette: { 1: "#1C2412", 2: "#FF8C1A", 3: "#FFD23F", 4: "#7A4A1E" },
  };

  const ITEM_ICONS = {
    wood: ICON_WOOD,
    stone: { grid: ROCK_SPRITE, palette: ROCK_PALETTE },
    fiber: ICON_FIBER,
    berry: ICON_BERRY,
    egg: ICON_EGG,
    milk: ICON_MILK,
    bandage: ICON_BANDAGE,
    trailmix: ICON_TRAILMIX,
    meal: ICON_MEAL,
    wall: { grid: WALL_SPRITE, palette: WALL_PALETTE },
    stonewall: { grid: STONEWALL_SPRITE, palette: STONEWALL_PALETTE },
    campfire: ICON_CAMPFIRE,
    torch: ICON_TORCH,
    bedroll: { grid: BEDROLL_SPRITE, palette: BEDROLL_PALETTE },
    workbench: { grid: WORKBENCH_SPRITE, palette: WORKBENCH_PALETTE },
  };

  function makeIconCanvas(id, scale) {
    const icon = ITEM_ICONS[id];
    const cv = document.createElement("canvas");
    const px = scale || 3;
    cv.width = 8 * px;
    cv.height = 8 * px;
    cv.className = "inv-icon";
    if (!icon) return cv;
    const ic = cv.getContext("2d");
    ic.imageSmoothingEnabled = false;
    for (let r = 0; r < icon.grid.length; r++) {
      const row = icon.grid[r];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (!v) continue;
        ic.fillStyle = icon.palette[v];
        ic.fillRect(c * px, r * px, px, px);
      }
    }
    return cv;
  }

  const INVENTORY_ITEMS = [
    { id: "wood", label: "Wood" },
    { id: "stone", label: "Stone" },
    { id: "fiber", label: "Fiber" },
    { id: "berry", label: "Berry" },
    { id: "egg", label: "Egg" },
    { id: "milk", label: "Milk" },
    { id: "bandage", label: "Bandage" },
    { id: "trailmix", label: "Trail Mix" },
    { id: "meal", label: "Meal" },
    { id: "wall", label: "Wood Wall" },
    { id: "stonewall", label: "Stone Wall" },
    { id: "campfire", label: "Campfire" },
    { id: "torch", label: "Torch" },
    { id: "bedroll", label: "Bedroll" },
    { id: "workbench", label: "Workbench" },
  ];
  const TOOL_ITEMS = [
    { id: "axe", label: "Axe" },
    { id: "pickaxe", label: "Pickaxe" },
    { id: "sword", label: "Sword" },
    { id: "shield", label: "Shield" },
  ];

  function refreshInventoryPanel() {
    inventoryGrid.innerHTML = "";
    for (const item of INVENTORY_ITEMS) {
      const count = state.inventory[item.id] || 0;
      const slot = document.createElement("div");
      slot.className = "inv-slot" + (count === 0 ? " empty" : "");
      slot.title = item.label;
      const nameEl = document.createElement("span");
      nameEl.className = "inv-name";
      nameEl.textContent = item.label;
      const countEl = document.createElement("span");
      countEl.className = "count";
      countEl.textContent = count;
      slot.appendChild(makeIconCanvas(item.id, 3));
      slot.appendChild(nameEl);
      slot.appendChild(countEl);
      inventoryGrid.appendChild(slot);
    }

    toolsGrid.innerHTML = "";
    for (const t of TOOL_ITEMS) {
      const tier = state.tools[t.id] || 0;
      const slot = document.createElement("div");
      slot.className = "tool-slot" + (tier >= 1 ? " owned" : "") + (tier >= 2 ? " tier2" : "");
      slot.textContent = tier >= 2 ? `${t.label} (Tier 2)` : tier >= 1 ? t.label : `${t.label} (locked)`;
      toolsGrid.appendChild(slot);
    }
  }

  function setInventoryOpen(open) {
    state.inventoryOpen = open;
    inventoryPanel.classList.toggle("hidden", !open);
    if (open) refreshInventoryPanel();
  }

  function updateInventoryHud() {
    if (state.inventoryOpen) refreshInventoryPanel();
  }

  function currentLevel() {
    return Math.floor(state.xp / XP_PER_LEVEL) + 1;
  }

  function xpIntoLevel() {
    return state.xp % XP_PER_LEVEL;
  }

  function addXP(amount) {
    const levelBefore = currentLevel();
    state.xp += amount;
    const levelAfter = currentLevel();
    if (levelAfter > levelBefore) {
      state.health = state.maxHealth;
      state.hunger = 100;
      sfx("levelUp");
      toast(`Level Up! You are now Level ${levelAfter}`);
      refreshCraftPanel();
    }
  }

  function updateHint() {
    if (state.over || state.sleeping.active || state.craftOpen) {
      actionHint.classList.remove("visible");
      return;
    }
    const enemy = findNearestEnemyInRange(ATTACK_RADIUS);
    if (enemy) {
      actionHint.textContent = "Press Space to attack!";
      actionHint.classList.add("visible");
      return;
    }
    if (findNearbyWorkbench()) {
      actionHint.textContent = "Press E to upgrade tools";
      actionHint.classList.add("visible");
      return;
    }
    if (findNearbyBedroll()) {
      actionHint.textContent = "Press E to sleep";
      actionHint.classList.add("visible");
      return;
    }
    if (currentArea === "surface") {
      if (dist(player.x, player.y, house.x, house.y) < INTERACT_RADIUS) {
        if (!house.built) {
          const needWood = house.woodNeeded - house.woodGiven;
          const needStone = house.stoneNeeded - house.stoneGiven;
          actionHint.textContent = `Press E to repair house (needs ${needWood} Wood, ${needStone} Stone)`;
        } else {
          actionHint.textContent = "Press E to sleep";
        }
        actionHint.classList.add("visible");
        return;
      }
      if (!ned.freed && dist(player.x, player.y, ned.x, ned.y) < INTERACT_RADIUS) {
        actionHint.textContent = "Press E to free Ned";
        actionHint.classList.add("visible");
        return;
      }
      if (dist(player.x, player.y, passage.x, passage.y) < INTERACT_RADIUS) {
        actionHint.textContent = passage.revealed ? "Press E to enter the Undergrove" : "A rotting log covers something here...";
        actionHint.classList.add("visible");
        return;
      }
    } else if (dist(player.x, player.y, exitStairs.x, exitStairs.y) < INTERACT_RADIUS) {
      actionHint.textContent = "Press E to climb to the surface";
      actionHint.classList.add("visible");
      return;
    }
    const g = findNearestGatherable();
    if (g) {
      const labels = {
        tree: state.tools.axe ? "Press Space to chop tree" : "Need an Axe to chop this tree",
        rock: state.tools.pickaxe ? "Press Space to mine rock" : "Need a Pickaxe to mine this rock",
        bush: "Press Space to gather berries",
        tuft: "Press Space to gather fiber",
        cow: "Press Space to milk cow",
        chicken: "Press Space to collect egg",
      };
      actionHint.textContent = labels[g.kind];
      actionHint.classList.add("visible");
      return;
    }
    actionHint.classList.remove("visible");
  }

  function updateHearts() {
    const heartValue = 100 / MAX_HEARTS;
    for (let i = 0; i < MAX_HEARTS; i++) {
      const threshold = (i + 1) * heartValue;
      const pip = heartPips[i];
      pip.classList.remove("full", "empty", "locked");
      if (threshold > state.maxHealth + 0.01) pip.classList.add("locked");
      else if (state.health >= threshold - 0.01) pip.classList.add("full");
      else pip.classList.add("empty");
    }
  }

  function updateHud() {
    updateHearts();
    barHunger.style.width = `${Math.max(0, state.hunger)}%`;
    levelLabel.textContent = `Lv ${currentLevel()}`;
    barXP.style.width = `${(xpIntoLevel() / XP_PER_LEVEL) * 100}%`;
    dayLabel.textContent = `Day ${state.day}`;
    clockLabel.textContent = formatClock();
    updateHint();
  }

  // ---------- opening cutscene ----------
  function fatherPalette() {
    return { 1: "#1C2412", 2: "#C9A47A", 3: "#3D5A3D", 4: shade("#3D5A3D", -40), 5: "#3A2A1E", 6: "#141414" };
  }
  function motherPalette() {
    return { 1: "#1C2412", 2: "#C9A47A", 3: "#A03B5C", 4: shade("#A03B5C", -40), 5: "#3A2A1E", 6: "#141414" };
  }

  function drawFigure(cx, cy, facing, palette, pixelSize) {
    const grid = HUMANOID_SPRITES[facing] || HUMANOID_SPRITES.down;
    drawGridSprite(grid, palette, cx - (8 * pixelSize) / 2, cy - (8 * pixelSize) / 2, pixelSize);
  }

  function cutsceneBg() {
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  function cutsceneGround() {
    ctx.fillStyle = "#1c2b16";
    ctx.fillRect(0, 400, VIEW_W, VIEW_H - 400);
  }

  function drawTitleSlide(t) {
    cutsceneBg();
    ctx.globalAlpha = Math.min(1, t / 1.2);
    ctx.fillStyle = "#E4453F";
    ctx.font = "bold 54px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("THE 13 DYNASTIES.NET", 480, 280);
    ctx.fillStyle = "#FFD9A8";
    ctx.font = "20px Georgia, serif";
    ctx.fillText("a survival story", 480, 320);
    ctx.globalAlpha = 1;
  }

  function drawFamilySlide() {
    cutsceneBg();
    cutsceneGround();
    drawFigure(400, 380, "down", fatherPalette(), 9);
    drawFigure(480, 385, "down", playerPalette(), 8);
    drawFigure(560, 380, "down", motherPalette(), 9);
  }

  function drawThugsApproachSlide(t) {
    cutsceneBg();
    cutsceneGround();
    drawFigure(360, 380, "down", fatherPalette(), 9);
    drawFigure(440, 385, "down", playerPalette(), 8);
    drawFigure(520, 380, "down", motherPalette(), 9);
    const shift = Math.min(60, t * 25);
    drawFigure(820 - shift, 360, "left", thugPalette(), 9);
    drawFigure(870 - shift, 400, "left", thugPalette(), 9);
  }

  function drawShootingSlide(t) {
    cutsceneBg();
    cutsceneGround();
    const shake = t < 0.7 ? Math.sin(t * 70) * 5 * (1 - t / 0.7) : 0;
    drawFigure(700, 380, "left", thugPalette(), 9);
    drawFigure(480 + shake, 385, "right", playerPalette(), 8);

    const pulse = 0.5 + 0.5 * Math.sin(t * 14);
    ctx.fillStyle = `rgba(255,220,120,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(650, 375);
    ctx.lineTo(672, 366);
    ctx.lineTo(668, 384);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(230,40,30,${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(514, 362, 9 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();

    const dropCount = Math.min(7, Math.floor(t * 3));
    for (let i = 0; i < dropCount; i++) {
      const dropT = Math.max(0, t - i * 0.28);
      const dy = Math.min(65, dropT * 45);
      ctx.fillStyle = "#7A1010";
      ctx.fillRect(508 + i * 3, 368 + dy, 3, 6);
    }

    if (t < 0.5) {
      ctx.fillStyle = `rgba(180,20,10,${(0.5 - t) * 0.6})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawFaintSlide(t) {
    cutsceneBg();
    cutsceneGround();
    ctx.save();
    ctx.translate(480, 400);
    ctx.rotate(Math.PI / 2);
    drawFigure(0, 0, "down", playerPalette(), 8);
    ctx.restore();
    const alpha = Math.min(0.9, t / 3);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawWeakenedSlide() {
    cutsceneBg();
    ctx.save();
    ctx.translate(480, 340);
    ctx.rotate(Math.PI / 2);
    drawFigure(0, 0, "down", playerPalette(), 7);
    ctx.restore();
    const pipW = 20, gap = 4, total = MAX_HEARTS * pipW + (MAX_HEARTS - 1) * gap;
    const startX = 480 - total / 2;
    for (let i = 0; i < MAX_HEARTS; i++) {
      const x = startX + i * (pipW + gap);
      ctx.fillStyle = i < START_HEARTS ? "#e6534a" : "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 460, pipW, 16);
    }
  }

  function drawGoalSlide(t) {
    cutsceneBg();
    cutsceneGround();
    drawFigure(480, 385, "down", playerPalette(), 9);
    const bob = Math.sin(t * 2) * 3;
    ctx.fillStyle = "#7A4A1E";
    ctx.fillRect(478, 250 + bob, 4, 60);
    ctx.fillStyle = "#E4453F";
    ctx.beginPath();
    ctx.moveTo(482, 252 + bob);
    ctx.lineTo(520, 262 + bob);
    ctx.lineTo(482, 274 + bob);
    ctx.closePath();
    ctx.fill();
  }

  const CUTSCENE_SLIDES = [
    { caption: "", duration: 3, draw: drawTitleSlide },
    { caption: "Once, in a quiet village, a boy lived happily with his mother and father.", duration: 4.5, draw: drawFamilySlide },
    { caption: "One night, a band of thugs broke into their home.", duration: 4.5, draw: drawThugsApproachSlide },
    { caption: "In the chaos, a thug fired — the shot tore through his shoulder and arm. The pain was blinding.", duration: 5.5, draw: drawShootingSlide },
    { caption: "He collapsed. Darkness took him.", duration: 3.5, draw: drawFaintSlide },
    { caption: "He awoke the next day, gravely weakened — his strength reduced to just four hearts.", duration: 5, draw: drawWeakenedSlide },
    { caption: "His parents are gone. To find them, and reclaim his family's place among the Thirteen Dynasties, he alone must survive.", duration: 5.5, draw: drawGoalSlide },
  ];

  // ---------- ending cutscene ----------
  function drawEndingCollapseSlide(t) {
    cutsceneBg();
    cutsceneGround();
    drawFigure(480, 385, "down", playerPalette(), 9);
    const alpha = Math.max(0, 1 - t / 1.2);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawEndingPortalSlide(t) {
    cutsceneBg();
    cutsceneGround();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const r = 40 + pulse * 15;
    const grad = ctx.createRadialGradient(480, 340, 5, 480, 340, r);
    grad.addColorStop(0, "rgba(210,180,255,0.9)");
    grad.addColorStop(1, "rgba(210,180,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(480, 340, r, 0, Math.PI * 2);
    ctx.fill();
    drawFigure(480, 400, "up", playerPalette(), 9);
  }

  function drawEndingReunionSlide(t) {
    cutsceneBg();
    cutsceneGround();
    const settle = Math.min(1, t / 1.5);
    const fatherX = 480 - 40 * (1 - settle) - 30;
    const motherX = 480 + 40 * (1 - settle) + 30;
    const alpha = Math.min(1, t / 0.8);
    ctx.globalAlpha = alpha;
    drawFigure(fatherX, 385, "right", fatherPalette(), 9);
    drawFigure(480, 385, "down", playerPalette(), 8);
    drawFigure(motherX, 385, "left", motherPalette(), 9);
    ctx.globalAlpha = 1;
    const glow = 0.4 + 0.3 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(255,215,140,${glow * settle * 0.3})`;
    ctx.beginPath();
    ctx.arc(480, 385, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEndingFamilySlide(t) {
    cutsceneBg();
    cutsceneGround();
    drawFigure(410, 385, "right", fatherPalette(), 9);
    drawFigure(465, 385, "down", playerPalette(), 8);
    drawFigure(520, 385, "left", motherPalette(), 9);
    const slide = Math.min(1, t / 1.2);
    drawFigure(620 - slide * 60, 385, "left", nedPalette(), 8);
  }

  function drawEndingCreditsSlide(t) {
    cutsceneBg();
    ctx.globalAlpha = Math.min(1, t / 1.2);
    ctx.fillStyle = "#E4453F";
    ctx.font = "bold 46px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("THE 13 DYNASTIES.NET", 480, 260);
    ctx.fillStyle = "#FFD9A8";
    ctx.font = "22px Georgia, serif";
    ctx.fillText("— The End —", 480, 310);
    ctx.fillStyle = "#cfd3e0";
    ctx.font = "16px Georgia, serif";
    ctx.fillText("Thank you for playing.", 480, 360);
    ctx.globalAlpha = 1;
  }

  const ENDING_SLIDES = [
    { caption: "The massive goblin collapses. Its headband flickers and dies.", duration: 3, draw: drawEndingCollapseSlide },
    { caption: "Behind where it stood, hidden machinery hums to life, and the air begins to shimmer.", duration: 4, draw: drawEndingPortalSlide },
    { caption: "In a flash of light, his parents appear before him. He runs to them, and they hold each other tight.", duration: 5, draw: drawEndingReunionSlide },
    { caption: "Ned steps forward to join them. From that day on, he was family too.", duration: 4.5, draw: drawEndingFamilySlide },
    { caption: "", duration: 5, draw: drawEndingCreditsSlide },
  ];

  // ---------- generic cutscene player (used for both the intro and the ending) ----------
  let cutsceneActive = false;
  let cutsceneSlides = [];
  let cutsceneIndex = 0;
  let cutsceneSlideT = 0;
  let cutsceneLastTime = performance.now();
  let cutsceneOnDone = null;

  function renderCutsceneFrame() {
    const slide = cutsceneSlides[cutsceneIndex];
    if (!slide) return;
    slide.draw(cutsceneSlideT);
    cutsceneCaption.textContent = slide.caption;
  }

  function advanceCutsceneSlide() {
    cutsceneIndex += 1;
    cutsceneSlideT = 0;
    if (cutsceneIndex >= cutsceneSlides.length) endCutscene();
  }

  function endCutscene() {
    if (!cutsceneActive) return;
    cutsceneActive = false;
    cutsceneUi.classList.add("hidden");
    const done = cutsceneOnDone;
    cutsceneOnDone = null;
    if (done) done();
  }

  function cutsceneLoop(now) {
    const dt = Math.min(0.05, (now - cutsceneLastTime) / 1000);
    cutsceneLastTime = now;
    cutsceneSlideT += dt;
    renderCutsceneFrame();
    if (cutsceneSlideT >= cutsceneSlides[cutsceneIndex].duration) advanceCutsceneSlide();
    if (cutsceneActive) requestAnimationFrame(cutsceneLoop);
  }

  function playCutscene(slides, onDone) {
    cutsceneSlides = slides;
    cutsceneIndex = 0;
    cutsceneSlideT = 0;
    cutsceneOnDone = onDone;
    cutsceneActive = true;
    cutsceneUi.classList.remove("hidden");
    requestAnimationFrame((now) => {
      cutsceneLastTime = now;
      requestAnimationFrame(cutsceneLoop);
    });
  }

  function afterIntro() {
    hudEl.classList.remove("hidden");
    instructionsEl.classList.remove("hidden");
    updateInventoryHud();
    refreshCraftPanel();
    setTimeout(() => toast("Salvaged 6 Wood and 3 Stone from the wreckage — enough for an Axe and Pickaxe"), 400);
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function showCredits() {
    victoryDays.textContent = `You reunited your family on Day ${state.day}, at Level ${currentLevel()}.`;
    victoryScreen.classList.remove("hidden");
  }

  function triggerEnding() {
    if (state.victory) return;
    state.victory = true;
    playCutscene(ENDING_SLIDES, showCredits);
  }

  canvas.addEventListener("click", () => {
    if (cutsceneActive) advanceCutsceneSlide();
  });

  // ---------- main loop ----------
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    render();
    updateHud();

    if (!state.victory) requestAnimationFrame(loop);
  }

  playCutscene(CUTSCENE_SLIDES, afterIntro);

})();
