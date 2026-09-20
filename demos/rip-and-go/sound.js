/* Pokémon Rip and Go — sound, made rather than loaded.
 *
 * Same rule as the rest of the demos in this folder: nothing is fetched. The
 * tear of a pack, the chime when a legendary turns over, the little tune in
 * the town — all of it is a handful of oscillators and some shaped noise. A
 * file is a thing that can fail to arrive; an oscillator is not.
 *
 * Two rules the whole thing hangs off:
 *
 *   1. Nothing plays until the player has touched something. Browsers suspend
 *      an AudioContext built before a gesture, so unlock() runs from the first
 *      keypress or tap — and tries to resume every time, not just the first,
 *      because a context can be born suspended and stay that way.
 *
 *   2. If any of this throws, the game carries on in silence. Audio is the
 *      first thing to break in a locked-down browser and the last thing worth
 *      taking a game down over.
 */
const Sound = (() => {
  'use strict';

  const STORE = 'ripgo.muted.v1';

  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let ready = false, muted = false;
  let songTimer = null, songStep = 0, song = null;

  try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* storage blocked */ }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* -------------------------------------------------------------- plumbing */

  function unlock() {
    if (!ready) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.22;      // the tune sits under everything
        musicBus.connect(master);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(master);
        ready = true;
      } catch (e) { return; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.8;
    try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    return muted;
  }

  /* One note. Everything in this file is built out of this. */
  function tone(freq, t0, len, type, vol, bus, bend) {
    if (!ready) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t0 + len);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g); g.connect(bus || sfxBus);
      o.start(t0); o.stop(t0 + len + 0.02);
    } catch (e) { /* silence is fine */ }
  }

  /* A burst of noise, shaped. Tears, thumps and impacts are all this. */
  function noise(t0, len, vol, hi, lo) {
    if (!ready) return;
    try {
      const n = Math.floor(ctx.sampleRate * len);
      const buf = ctx.createBuffer(1, Math.max(1, n), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(hi || 1800, t0);
      if (lo) f.frequency.exponentialRampToValueAtTime(lo, t0 + len);
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(t0); src.stop(t0 + len + 0.02);
    } catch (e) { /* silence is fine */ }
  }

  const now = () => (ready ? ctx.currentTime : 0);

  /* ------------------------------------------------------------- the noises */

  const S = {
    step: () => noise(now(), 0.05, 0.10, 900, 400),
    cursor: () => tone(midi(84), now(), 0.05, 'square', 0.13),
    ok: () => { const t = now(); tone(midi(76), t, 0.07, 'square', 0.18); tone(midi(83), t + 0.06, 0.1, 'square', 0.16); },
    back: () => { const t = now(); tone(midi(74), t, 0.07, 'square', 0.15); tone(midi(67), t + 0.06, 0.1, 'square', 0.13); },
    deny: () => { const t = now(); tone(midi(55), t, 0.12, 'sawtooth', 0.16, null, midi(48)); },
    door: () => { const t = now(); noise(t, 0.16, 0.2, 700, 250); tone(midi(60), t, 0.14, 'triangle', 0.12); },

    /* Money leaving your hands should sound like a small good thing. */
    buy: () => {
      const t = now();
      [72, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.05, 0.1, 'square', 0.15));
    },

    /* The tear. Two bursts, because a wrapper never comes apart in one go. */
    rip: () => {
      const t = now();
      noise(t, 0.13, 0.34, 3400, 1200);
      noise(t + 0.10, 0.20, 0.28, 2600, 700);
    },

    flip: () => { const t = now(); noise(t, 0.06, 0.18, 2600, 1400); tone(midi(79), t, 0.05, 'triangle', 0.10); },

    /* What a card is worth, said out loud. Common gets a click; a legendary
     * gets the whole arpeggio and a shimmer on top. */
    reveal: (rarity) => {
      const t = now();
      if (rarity === 'common') { tone(midi(72), t, 0.06, 'square', 0.12); return; }
      if (rarity === 'uncommon') { tone(midi(74), t, 0.07, 'square', 0.15); tone(midi(81), t + 0.06, 0.1, 'square', 0.13); return; }
      if (rarity === 'rare') {
        [76, 83, 88].forEach((n, i) => tone(midi(n), t + i * 0.06, 0.16, 'square', 0.17));
        return;
      }
      if (rarity === 'epic') {
        [76, 80, 83, 88, 91].forEach((n, i) => tone(midi(n), t + i * 0.055, 0.2, 'square', 0.17));
        tone(midi(95), t + 0.3, 0.5, 'triangle', 0.1);
        return;
      }
      [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => {
        tone(midi(n), t + i * 0.07, 0.34, 'square', 0.18);
        tone(midi(n + 12), t + i * 0.07 + 0.01, 0.3, 'triangle', 0.08);
      });
      noise(t + 0.5, 0.6, 0.12, 6000, 2000);
    },

    keep: () => { const t = now(); tone(midi(81), t, 0.06, 'square', 0.16); tone(midi(86), t + 0.05, 0.12, 'square', 0.14); },
    drop: () => { const t = now(); noise(t, 0.09, 0.2, 1600, 500); },

    hit: (mult) => {
      const t = now();
      noise(t, 0.12, mult >= 2 ? 0.42 : 0.28, mult >= 2 ? 2600 : 1500, 320);
      tone(midi(mult >= 2 ? 48 : 52), t, 0.1, 'sawtooth', 0.16, null, midi(36));
    },
    faint: () => { const t = now(); tone(midi(64), t, 0.5, 'triangle', 0.18, null, midi(40)); },
    heal: () => { const t = now(); [72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.06, 0.18, 'triangle', 0.14)); },
    buff: () => { const t = now(); tone(midi(60), t, 0.22, 'square', 0.14, null, midi(72)); },
    debuff: () => { const t = now(); tone(midi(72), t, 0.22, 'square', 0.14, null, midi(58)); },
    levelup: () => { const t = now(); [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n), t + i * 0.07, 0.24, 'square', 0.17)); },
    win: () => { const t = now(); [72, 72, 79, 84, 88].forEach((n, i) => tone(midi(n), t + i * 0.11, 0.3, 'square', 0.18)); },
    lose: () => { const t = now(); [67, 64, 60, 55].forEach((n, i) => tone(midi(n), t + i * 0.16, 0.4, 'triangle', 0.17)); },
  };

  /* ---------------------------------------------------------------- tunes */
  /* Two, both four bars of nothing much: a bass note on the beat and a melody
   * over it. Written as MIDI numbers so it can be read and changed. */

  const SONGS = {
    town: {
      bpm: 132,
      bass: [48, 48, 55, 55, 53, 53, 50, 50],
      lead: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 83, 81, 79, 76, 74],
    },
    battle: {
      bpm: 168,
      bass: [45, 45, 45, 52, 43, 43, 43, 50],
      lead: [69, 72, 76, 72, 69, 71, 74, 71, 67, 70, 74, 70, 68, 71, 75, 79],
    },
    shop: {
      bpm: 108,
      bass: [50, 50, 57, 57, 55, 55, 53, 53],
      lead: [74, 78, 81, 78, 76, 79, 83, 79, 74, 78, 81, 85, 83, 81, 78, 76],
    },
  };

  function playSong(name) {
    if (song === name) return;
    stopSong();
    song = name;
    if (!ready || !SONGS[name]) return;
    const s = SONGS[name];
    const beat = 60 / s.bpm / 2;
    songStep = 0;
    songTimer = setInterval(() => {
      if (!ready || muted) return;
      const t = now() + 0.02;
      const i = songStep % s.lead.length;
      tone(midi(s.lead[i]), t, beat * 0.9, 'square', 0.1, musicBus);
      if (songStep % 2 === 0) {
        tone(midi(s.bass[(songStep / 2) % s.bass.length]), t, beat * 1.7, 'triangle', 0.16, musicBus);
      }
      songStep++;
    }, beat * 1000);
  }

  function stopSong() {
    if (songTimer) clearInterval(songTimer);
    songTimer = null;
    song = null;
  }

  return Object.assign({
    unlock, toggleMute, playSong, stopSong,
    isMuted: () => muted,
    current: () => song,
  }, S);
})();
