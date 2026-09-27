/* The shop, the binder and the save file.
 *
 * Tokens come from winning things (see REWARDS). They buy three kinds of
 * thing:
 *
 *   Gear   — a bat, gloves, cleats and a helmet. Whatever you have on is
 *            added to whoever you pick, in the derby against the CPU and in
 *            every race. It is not used in the two-player derby, so a friend
 *            on the same keyboard is not playing against your wallet.
 *   Packs  — cards for the binder. Owning a player's card makes that player
 *            +1 in every stat when you play as them, +2 for the holo.
 *            Doubles turn back into tokens, and a finished page pays out.
 *   Skins  — colourways for your player, in any mode.
 *
 * Everything is kept in this browser's localStorage and nowhere else. If the
 * browser will not keep it (a private window, say), the game still works; it
 * just forgets when the page closes.
 */
const EQUIPMENT = [
  { id: 'bat1', slot: 'bat', name: 'Maple Bat', stat: 'pow', plus: 1, cost: 120, color: '#e8c08a' },
  { id: 'bat2', slot: 'bat', name: 'Black Birch Bat', stat: 'pow', plus: 2, cost: 320, color: '#2a2a33' },
  { id: 'bat3', slot: 'bat', name: 'Thunder Bat', stat: 'pow', plus: 3, cost: 700, color: '#3fa9ff' },
  { id: 'glv1', slot: 'gloves', name: 'Grip Gloves', stat: 'con', plus: 1, cost: 100, color: '#ffffff' },
  { id: 'glv2', slot: 'gloves', name: 'Pro Gloves', stat: 'con', plus: 2, cost: 280, color: '#ff4d6d' },
  { id: 'glv3', slot: 'gloves', name: 'Magnet Mitts', stat: 'con', plus: 3, cost: 650, color: '#b28bff' },
  { id: 'clt1', slot: 'cleats', name: 'Turf Cleats', stat: 'spd', plus: 1, cost: 100, color: '#2ec27e' },
  { id: 'clt2', slot: 'cleats', name: 'Spike Cleats', stat: 'spd', plus: 2, cost: 280, color: '#ff8c1a' },
  { id: 'clt3', slot: 'cleats', name: 'Rocket Cleats', stat: 'spd', plus: 3, cost: 650, color: '#ff2d2d' },
  { id: 'hlm1', slot: 'helmet', name: 'Batting Helmet', stat: 'cd', plus: 15, cost: 150, color: '#1f6fff' },
  { id: 'hlm2', slot: 'helmet', name: 'All-Star Helmet', stat: 'cd', plus: 30, cost: 420, color: '#ffd23f' },
];
const GEAR_SLOTS = [
  { id: 'bat', label: 'Bat', what: 'Power' },
  { id: 'gloves', label: 'Gloves', what: 'Contact' },
  { id: 'cleats', label: 'Cleats', what: 'Speed' },
  { id: 'helmet', label: 'Helmet', what: 'Ability cooldown' },
];

const SKINS = [
  { id: 'team', name: 'Team Colors', cost: 0 },
  { id: 'throwback', name: 'Throwback', cost: 150, jersey: '#efe6d0', trim: '#b0122a', cap: '#b0122a' },
  { id: 'midnight', name: 'Midnight', cost: 200, jersey: '#141a3a', trim: '#6af0ff', cap: '#0a0e22' },
  { id: 'candy', name: 'Cotton Candy', cost: 200, jersey: '#ff9ad5', trim: '#8fe3ff', cap: '#b28bff' },
  { id: 'lime', name: 'Neon Lime', cost: 200, jersey: '#b6ff3b', trim: '#1c1c24', cap: '#1c1c24' },
  { id: 'jungle', name: 'Jungle', cost: 220, jersey: '#3f6b35', trim: '#e8d6a0', cap: '#2e4a26' },
  { id: 'ice', name: 'Ice Cold', cost: 250, jersey: '#bfe9ff', trim: '#1f6fff', cap: '#ffffff' },
  { id: 'lava', name: 'Lava', cost: 250, jersey: '#ff4a12', trim: '#ffd23f', cap: '#3a0e0e' },
  { id: 'panda', name: 'Panda', cost: 300, jersey: '#ffffff', trim: '#1c1c24', cap: '#1c1c24' },
  { id: 'galaxy', name: 'Galaxy', cost: 350, jersey: '#5a3ce6', trim: '#29ffd6', cap: '#140b2e' },
  { id: 'gold', name: 'Gold Rush', cost: 600, jersey: '#ffcc33', trim: '#7a4a00', cap: '#ffdf6b' },
];

const PACKS = [
  { id: 'rookie', name: 'Rookie Pack', cost: 60, cards: 3, legend: 0.08, holo: 0.05, color: '#2ec27e',
    blurb: 'Three cards. Mostly today’s players.' },
  { id: 'allstar', name: 'All-Star Pack', cost: 150, cards: 4, legend: 0.25, holo: 0.1, color: '#2f7bff',
    blurb: 'Four cards, one guaranteed Rare or better.', rareFloor: 1 },
  { id: 'legends', name: 'Legends Pack', cost: 320, cards: 5, legend: 0.45, holo: 0.18, color: '#ffb000',
    blurb: 'Five cards and a Legend in every pack.', legendFloor: 1 },
];

const REWARDS = {
  derbyWin: 60, derbyLoss: 10, perHomer: 4,
  diffMul: { rookie: 0.6, allstar: 1, legend: 1.6 },
  practice: [50, 25, 25, 10],
  qualify: 30, survive: 45, champion: 200, finalist: 60, knockedOut: 12,
  dupe: 15, dupeHolo: 40, page: 200,
};

const Save = (() => {
  const KEY = 'bigswing.save.v1';
  const blank = () => ({
    tokens: 500,
    gear: { owned: [], on: {} },
    skins: { owned: ['team'], on: 'team' },
    cards: {},
    pages: {},
    earned: 0,
  });
  let data = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* no storage: play without saving */ }
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };

  const rarity = (p) => (p.era === 'legend' ? 'legend' : p.pow + p.con + p.spd >= 23 ? 'rare' : 'common');

  function gearOn(slot) {
    const id = data.gear.on[slot];
    return id ? EQUIPMENT.find((e) => e.id === id) : null;
  }
  /* The player you actually field: base stats, plus your card, plus your gear
   * (unless `noGear`), in your skin. `base` points back at the roster entry. */
  function mine(p, opts = {}) {
    const card = data.cards[p.id];
    const cardBonus = card ? (card.holo ? 2 : 1) : 0;
    const out = Object.assign({}, p, { base: p, cardBonus, gearBonus: { pow: 0, con: 0, spd: 0 }, cdMul: 1 });
    for (const s of ['pow', 'con', 'spd']) out[s] = p[s] + cardBonus;
    if (!opts.noGear) {
      for (const g of GEAR_SLOTS) {
        const e = gearOn(g.id);
        if (!e) continue;
        if (e.stat === 'cd') out.cdMul = 1 - e.plus / 100;
        else { out[e.stat] += e.plus; out.gearBonus[e.stat] += e.plus; }
      }
      const bat = gearOn('bat');
      if (bat) out.batColor = bat.color;
      const cl = gearOn('cleats');
      if (cl) out.shoeColor = cl.color;
      const gl = gearOn('gloves');
      if (gl) out.gloveColor = gl.color;
      const hl = gearOn('helmet');
      if (hl) out.helmet = hl.color;
    }
    const skin = SKINS.find((s) => s.id === data.skins.on);
    if (skin && skin.jersey) Object.assign(out, { jersey: skin.jersey, trim: skin.trim, cap: skin.cap });
    out.id = [p.id, data.skins.on, opts.noGear ? '' : Object.values(data.gear.on).join('+')].join('@');
    return out;
  }

  function spend(n) {
    if (data.tokens < n) return false;
    data.tokens -= n;
    write();
    return true;
  }
  function award(n) {
    n = Math.max(0, Math.round(n));
    data.tokens += n;
    data.earned += n;
    write();
    return n;
  }
  function buyGear(id) {
    const e = EQUIPMENT.find((x) => x.id === id);
    if (!e || data.gear.owned.includes(id) || !spend(e.cost)) return false;
    data.gear.owned.push(id);
    data.gear.on[e.slot] = id;
    write();
    return true;
  }
  function wearGear(id) {
    const e = EQUIPMENT.find((x) => x.id === id);
    if (!e || !data.gear.owned.includes(id)) return;
    data.gear.on[e.slot] = data.gear.on[e.slot] === id ? undefined : id;
    if (!data.gear.on[e.slot]) delete data.gear.on[e.slot];
    write();
  }
  function buySkin(id) {
    const s = SKINS.find((x) => x.id === id);
    if (!s || data.skins.owned.includes(id) || !spend(s.cost)) return false;
    data.skins.owned.push(id);
    data.skins.on = id;
    write();
    return true;
  }
  function wearSkin(id) {
    if (!data.skins.owned.includes(id)) return;
    data.skins.on = id;
    write();
  }

  /* Open a pack: returns [{p, holo, isNew, dupeTokens}] and applies it. */
  function openPack(packId) {
    const pk = PACKS.find((x) => x.id === packId);
    if (!pk || !spend(pk.cost)) return null;
    const pool = { legend: [], rare: [], common: [] };
    for (const p of ROSTER) pool[rarity(p)].push(p);
    const draw = (tier) => pool[tier][Math.floor(Math.random() * pool[tier].length)];
    const cards = [];
    for (let i = 0; i < pk.cards; i++) {
      let tier = Math.random() < pk.legend ? 'legend' : Math.random() < 0.35 ? 'rare' : 'common';
      if (i === pk.cards - 1 && pk.legendFloor && !cards.some((c) => rarity(c.p) === 'legend')) tier = 'legend';
      if (i === pk.cards - 1 && pk.rareFloor && !cards.some((c) => rarity(c.p) !== 'common') && tier === 'common') tier = 'rare';
      cards.push({ p: draw(tier), holo: Math.random() < pk.holo });
    }
    const before = { ...data.cards };
    const pagesBefore = { ...data.pages };
    for (const c of cards) {
      const have = data.cards[c.p.id];
      if (!have) {
        data.cards[c.p.id] = { n: 1, holo: c.holo };
        c.isNew = true;
      } else {
        have.n++;
        if (c.holo && !have.holo) { have.holo = true; c.isNew = true; c.upgraded = true; }
        else { c.dupeTokens = c.holo ? REWARDS.dupeHolo : REWARDS.dupe; data.tokens += c.dupeTokens; }
      }
    }
    // A finished page pays once.
    const pageDone = [];
    for (const era of ERAS) {
      if (data.pages[era.id]) continue;
      if (ROSTER.filter((p) => p.era === era.id).every((p) => data.cards[p.id])) {
        data.pages[era.id] = true;
        data.tokens += REWARDS.page;
        pageDone.push(era.label);
      }
    }
    write();
    return { cards, pageDone, before, pagesBefore };
  }

  function reset() { data = blank(); write(); }

  return {
    get tokens() { return data.tokens; },
    get data() { return data; },
    rarity, mine, gearOn, award, spend, buyGear, wearGear, buySkin, wearSkin, openPack, reset,
  };
})();
