/* Pokémon Rip and Go — team codes.
 *
 * A team code is your six turned into a short string you can read down a
 * phone, write on a napkin, or paste into a message. Someone who types it
 * back in gets your team to fight — not to keep.
 *
 * ------------------------------------------------------------------- why
 *
 * There is no server behind this game and there is not going to be one today,
 * so "multiplayer" here means the oldest kind: two people and a piece of
 * paper. The code carries enough to rebuild the team exactly and nothing
 * else, which is the whole trick — it is short because of what it leaves out.
 *
 * ------------------------------------------------------- what it carries
 *
 * Per creature: which one, what level, and whether it is the odd colour.
 * Fourteen bits each. Moves are NOT in the code: they are worked out from the
 * learnset at that level, the same four a wild one of that species would turn
 * up with. That is a real trade — a team you taught something unusual to will
 * arrive knowing the ordinary thing instead — and it buys a code of about
 * twenty characters rather than fifty, which is the difference between a code
 * somebody types and a code somebody gives up on. It also means nobody can
 * hand you a creature holding four moves it could never learn.
 *
 * ------------------------------------------------------------- the letters
 *
 * Base 32, and the missing four are I, O, 0 and 1 — the ones people get wrong
 * reading a code out loud. Everything is upper case because the game's font
 * has one case and because a code should not care.
 */
const Codes = (() => {
  'use strict';

  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  /* Version 2 carries fusions. Each creature now opens with a bit saying
   * whether it is one creature or two, and a spliced one spends six more bits
   * naming the body. A team of plain creatures costs one bit each more than
   * it used to, which is nothing; a team of fusions costs seven, which is the
   * honest price of describing something made of two things. */
  const VERSION = 2;
  const FUSE_MARK = '+';
  const MAX_TEAM = 6;

  /* ================================================================== bits */

  function writer() {
    const bits = [];
    return {
      push(value, n) {
        for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
      },
      finish() {
        while (bits.length % 5) bits.push(0);
        let out = '';
        for (let i = 0; i < bits.length; i += 5) {
          let v = 0;
          for (let j = 0; j < 5; j++) v = (v << 1) | bits[i + j];
          out += ALPHABET[v];
        }
        return out;
      },
    };
  }

  function reader(str) {
    const bits = [];
    for (const ch of str) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
    }
    let at = 0;
    return {
      left() { return bits.length - at; },
      pull(n) {
        if (at + n > bits.length) return null;
        let v = 0;
        for (let i = 0; i < n; i++) v = (v << 1) | bits[at++];
        return v;
      },
    };
  }

  /* ============================================================== checksum */
  /* Ten bits off the contents, so a mistyped letter is caught here rather
   * than arriving as a level 93 nothing. */

  function sumOf(list) {
    let n = list.length * 7;
    list.forEach((m, i) => {
      n = (n * 31 + m.species * 101 + m.level * 7 + (m.shiny ? 3 : 0) + i) % 1024;
      if (m.bodySpecies !== undefined) n = (n * 31 + m.bodySpecies * 17 + 5) % 1024;
    });
    return n;
  }

  /* ================================================================ encode */

  function encode(party) {
    const list = [];
    (party || []).slice(0, MAX_TEAM).forEach((m) => {
      const sp = Dex.byId(m.species);
      if (!sp) return;
      const entry = { level: Math.max(1, Math.min(100, m.level)), shiny: !!m.shiny };
      if (sp.fusion) {
        const head = Dex.byId(sp.headId), body = Dex.byId(sp.bodyId);
        if (!head || !body) return;
        entry.species = head.no - 1;
        entry.bodySpecies = body.no - 1;
      } else {
        entry.species = sp.no - 1;
      }
      list.push(entry);
    });
    if (!list.length) return '';

    const w = writer();
    w.push(VERSION, 4);
    w.push(list.length - 1, 3);
    list.forEach((m) => {
      const fused = m.bodySpecies !== undefined;
      w.push(fused ? 1 : 0, 1);
      w.push(m.species, 6);
      if (fused) w.push(m.bodySpecies, 6);
      w.push(m.level, 7);
      w.push(m.shiny ? 1 : 0, 1);
    });
    w.push(sumOf(list), 10);
    return w.finish();
  }

  /* ================================================================ decode */
  /* Says what is wrong rather than just refusing, because the person typing
   * it in is reading it off something and wants to know where to look. */

  function decode(str) {
    const clean = String(str || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
    if (!clean) return { ok: false, error: 'Nothing typed in.' };

    const r = reader(clean);
    if (!r) return { ok: false, error: 'That has a letter a code cannot contain.' };

    const version = r.pull(4);
    if (version === null) return { ok: false, error: 'Too short to be a code.' };
    if (version !== VERSION) return { ok: false, error: 'That code is from a different build.' };

    const count = r.pull(3);
    if (count === null) return { ok: false, error: 'Too short to be a code.' };
    const n = count + 1;
    if (n > MAX_TEAM) return { ok: false, error: 'That code claims more than six.' };

    const list = [];
    for (let i = 0; i < n; i++) {
      const fused = r.pull(1);
      const species = r.pull(6);
      const bodySpecies = fused === 1 ? r.pull(6) : undefined;
      const level = r.pull(7), shiny = r.pull(1);
      if (fused === null || species === null || level === null || shiny === null
        || (fused === 1 && bodySpecies === null)) {
        return { ok: false, error: 'The code stops in the middle. A character is missing.' };
      }
      if (species >= Dex.SPECIES.length || (fused === 1 && bodySpecies >= Dex.SPECIES.length)) {
        return { ok: false, error: 'That code names something not in this dex.' };
      }
      if (level < 1 || level > 100) return { ok: false, error: 'That code has an impossible level in it.' };
      const entry = { species, level, shiny: !!shiny };
      if (fused === 1) entry.bodySpecies = bodySpecies;
      list.push(entry);
    }

    const sum = r.pull(10);
    if (sum === null) return { ok: false, error: 'The code is missing its last few characters.' };
    if (sum !== sumOf(list)) return { ok: false, error: 'That does not check out. A character is wrong.' };

    return {
      ok: true,
      team: list.map((m) => ({
        species: m.bodySpecies === undefined
          ? Dex.SPECIES[m.species].id
          : Dex.SPECIES[m.species].id + FUSE_MARK + Dex.SPECIES[m.bodySpecies].id,
        level: m.level,
        shiny: m.shiny,
      })),
    };
  }

  /* ============================================================ pack seeds */
  /* A pack seed is six characters that decide exactly which eight cards fall
   * out of a pack. Two people who type in the same six get the same eight,
   * draft their own five out of them, and then swap team codes to find out
   * whose five were the better read of the same hand.
   *
   * Three bits of version, two of bracket and twenty-five of seed. Thirty
   * bits, six characters, and no checksum — a mistyped seed is a different
   * pack rather than a broken one, and telling somebody their seed is invalid
   * when it would happily open is worse than letting them open it. */

  const SEED_VERSION = 1;
  const SEED_BITS = 25;

  /* Mulberry32. Small, fast, and the same everywhere — which is the only
   * property that matters when two machines have to agree on a pack. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedEncode(tier, seed) {
    const w = writer();
    w.push(SEED_VERSION, 3);
    w.push(tier & 3, 2);
    w.push(seed >>> 0 & ((1 << SEED_BITS) - 1), SEED_BITS);
    return w.finish();
  }

  function seedDecode(str) {
    const clean = strip(str);
    if (!clean) return { ok: false, error: 'Nothing typed in.' };
    if (clean.length !== 6) return { ok: false, error: 'A pack seed is six characters.' };
    const r = reader(clean);
    if (!r) return { ok: false, error: 'That has a letter a seed cannot contain.' };
    const version = r.pull(3);
    if (version !== SEED_VERSION) return { ok: false, error: 'That seed is from a different build.' };
    const tier = r.pull(2);
    const seed = r.pull(SEED_BITS);
    if (tier === null || seed === null) return { ok: false, error: 'That seed is too short.' };
    return { ok: true, tier, seed };
  }

  function randomSeed() {
    return Math.floor(Math.random() * (1 << SEED_BITS)) >>> 0;
  }

  /* ================================================================ pretty */
  /* Five at a time, because that is how people read a string of letters back
   * to each other without losing their place. */

  function format(code) {
    return String(code || '').replace(/(.{5})(?=.)/g, '$1-');
  }

  function strip(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  }

  /* ============================================================== the check */
  /* Every creature in the dex, at a handful of levels, has to survive the
   * round trip. A code that comes back as a different creature is the kind of
   * bug that only shows up when somebody else has already written it down. */

  function validate() {
    const bad = [];
    const levels = [1, 5, 17, 50, 100];
    Dex.SPECIES.forEach((sp) => {
      levels.forEach((lv) => {
        const party = [{ species: sp.id, level: lv, shiny: lv === 17 }];
        const out = decode(encode(party));
        if (!out.ok) { bad.push(sp.name + ' L' + lv + ': ' + out.error); return; }
        const got = out.team[0];
        if (got.species !== sp.id || got.level !== lv || got.shiny !== (lv === 17)) {
          bad.push(sp.name + ' L' + lv + ': came back as ' + got.species + ' L' + got.level);
        }
      });
    });

    // Fusions have to survive the trip too, including a team that mixes
    // spliced creatures with whole ones.
    const fusedTeam = [
      { species: 'pyrehound' + FUSE_MARK + 'stormwing', level: 44, shiny: false },
      { species: 'spriglet', level: 12, shiny: true },
      { species: 'wisplet' + FUSE_MARK + 'rimemaw', level: 31, shiny: true },
    ];
    const fusedBack = decode(encode(fusedTeam));
    if (!fusedBack.ok) bad.push('a team with fusions in it: ' + fusedBack.error);
    else fusedTeam.forEach((want, i) => {
      const got = fusedBack.team[i];
      if (!got || got.species !== want.species || got.level !== want.level || got.shiny !== want.shiny) {
        bad.push('fusion slot ' + i + ' changed in transit: ' + (got && got.species));
      }
    });

    // A full six, and a one-character typo in it, which must not survive.
    const six = Dex.SPECIES.slice(0, 6).map((sp, i) => ({ species: sp.id, level: 10 + i * 9, shiny: false }));
    const code = encode(six);
    const back = decode(code);
    if (!back.ok || back.team.length !== 6) bad.push('a team of six did not survive the trip');
    else back.team.forEach((m, i) => {
      if (m.species !== six[i].species || m.level !== six[i].level) bad.push('slot ' + i + ' changed in transit');
    });

    let caught = 0;
    for (let i = 0; i < code.length; i++) {
      const wrong = ALPHABET[(ALPHABET.indexOf(code[i]) + 7) % 32];
      if (!decode(code.slice(0, i) + wrong + code.slice(i + 1)).ok) caught++;
    }
    if (caught < code.length * 0.9) {
      bad.push('single-character typos are getting through: only ' + caught + ' of ' + code.length + ' caught');
    }

    // Seeds: six characters, round-trip, and the same seed must give the same
    // numbers on every call — the whole feature is worthless if it drifts.
    for (let tier = 0; tier < 4; tier++) {
      [0, 1, 12345, (1 << SEED_BITS) - 1].forEach((seed) => {
        const code = seedEncode(tier, seed);
        if (code.length !== 6) bad.push('seed ' + tier + '/' + seed + ' encoded to ' + code.length + ' characters');
        const out = seedDecode(code);
        if (!out.ok) bad.push('seed ' + tier + '/' + seed + ': ' + out.error);
        else if (out.tier !== tier || out.seed !== seed) {
          bad.push('seed ' + tier + '/' + seed + ' came back as ' + out.tier + '/' + out.seed);
        }
      });
    }
    const a = rng(999), b = rng(999);
    for (let i = 0; i < 50; i++) {
      if (a() !== b()) { bad.push('the same seed gave two different sequences'); break; }
    }
    if (rng(1)() === rng(2)()) bad.push('two different seeds opened with the same number');

    if (bad.length) console.error('Codes: ' + bad.length + ' problem(s)\n' + bad.slice(0, 20).join('\n'));
    return bad;
  }

  return {
    ALPHABET, MAX_TEAM, encode, decode, format, strip, validate,
    rng, seedEncode, seedDecode, randomSeed,
  };
})();

Codes.validate();
