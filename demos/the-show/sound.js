/* The Show — sound, made rather than loaded.
 *
 * Same rule as the rest of the demos here: nothing is fetched. Every crack of
 * the bat, every ballpark organ riff, is a few oscillators and a burst of
 * noise. A file is a thing that can fail to arrive; an oscillator is not.
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
  const STORE = 'show.muted.v1';

  let ctx = null;
  let master = null, musicBus = null, sfxBus = null;
  let ready = false;
  let muted = false;

  try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* storage blocked */ }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ------------------------------------------------------------- plumbing */

  function unlock() {
    if (!ready) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();

        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.85;
        master.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.3;            // the organ sits under the game
        musicBus.connect(master);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(master);

        ready = true;
        if (pending) { const p = pending; pending = null; music(p.name, p.shift); }
      } catch (e) {
        ready = false;                        // no audio here; carry on quietly
        return;
      }
    }

    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* One tone with an envelope. `to` slides the pitch, which is most of what
   * makes these read as game sounds rather than as beeps. */
  function tone(bus, opts) {
    if (!ready) return;
    const t = ctx.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.12;

    const o = ctx.createOscillator();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);

    const g = ctx.createGain();
    const peak = opts.gain == null ? 0.25 : opts.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* Filtered noise. The bat, the dirt, the crowd — all of it is this. */
  function hiss(bus, opts) {
    if (!ready) return;
    const t = ctx.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.12;

    const s = ctx.createBufferSource();
    s.buffer = noise();
    s.loop = true;

    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t + dur);
    f.Q.value = opts.q == null ? 1.2 : opts.q;

    const g = ctx.createGain();
    const peak = opts.gain == null ? 0.2 : opts.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* ------------------------------------------------------------------ sfx */

  const SFX = {
    // Moving about.
    jump:  () => tone(sfxBus, { freq: 300, to: 620, dur: 0.11, gain: 0.2, type: 'square' }),
    hop:   () => tone(sfxBus, { freq: 480, to: 880, dur: 0.1, gain: 0.16, type: 'square' }),
    land:  () => hiss(sfxBus, { freq: 420, to: 180, dur: 0.07, gain: 0.12, q: 0.8 }),
    glide: () => hiss(sfxBus, { freq: 1600, dur: 0.12, gain: 0.04, q: 0.6 }),

    // The bat. `swing` is the miss, `crack` is the one you want to hear, and
    // `homer` is the one the crowd hears.
    swing: () => hiss(sfxBus, { freq: 1700, to: 500, dur: 0.12, gain: 0.1, q: 0.7 }),
    crack: () => { hiss(sfxBus, { freq: 2400, to: 600, dur: 0.09, gain: 0.5, q: 0.9, attack: 0.001 });
                   tone(sfxBus, { freq: 220, to: 90, dur: 0.1, gain: 0.3, type: 'triangle' }); },
    homer: () => { hiss(sfxBus, { freq: 3000, to: 500, dur: 0.14, gain: 0.55, q: 0.8, attack: 0.001 });
                   tone(sfxBus, { freq: 160, to: 60, dur: 0.2, gain: 0.35, type: 'triangle' });
                   SFX.cheer(); },
    stomp: () => { tone(sfxBus, { freq: 500, to: 120, dur: 0.1, gain: 0.26, type: 'square' });
                   hiss(sfxBus, { freq: 900, to: 200, dur: 0.1, gain: 0.16, q: 0.7 }); },
    toss:  () => tone(sfxBus, { freq: 900, to: 1500, dur: 0.07, gain: 0.14, type: 'sine' }),
    pitch: () => tone(sfxBus, { freq: 1200, to: 700, dur: 0.09, gain: 0.12, type: 'sine' }),

    // Picking things up.
    coin:  () => { tone(sfxBus, { freq: 1050, dur: 0.05, gain: 0.16 });
                   tone(sfxBus, { freq: 1570, dur: 0.09, gain: 0.16, at: 0.045 }); },
    card:  () => [0, 4, 7, 11, 12].forEach((n, i) =>
                   tone(sfxBus, { freq: midi(76 + n), dur: 0.16, gain: 0.18, at: i * 0.07, type: 'triangle' })),
    power: () => [0, 5, 9, 12, 16].forEach((n, i) =>
                   tone(sfxBus, { freq: midi(64 + n), dur: 0.14, gain: 0.2, at: i * 0.06 })),
    block: () => { tone(sfxBus, { freq: 240, to: 140, dur: 0.07, gain: 0.2, type: 'square' });
                   hiss(sfxBus, { freq: 700, dur: 0.06, gain: 0.12, q: 0.6 }); },
    smash: () => hiss(sfxBus, { freq: 1400, to: 200, dur: 0.22, gain: 0.3, q: 0.5 }),

    // Stakes.
    lose:  () => { tone(sfxBus, { freq: 420, to: 180, dur: 0.22, gain: 0.26, type: 'sawtooth' });
                   hiss(sfxBus, { freq: 800, to: 200, dur: 0.22, gain: 0.14, q: 0.6 }); },
    hurt:  () => tone(sfxBus, { freq: 320, to: 120, dur: 0.24, gain: 0.3, type: 'sawtooth' }),
    out:   () => [0, -2, -5, -9].forEach((n, i) =>
                   tone(sfxBus, { freq: midi(64 + n), dur: 0.3, gain: 0.26, at: i * 0.13, type: 'triangle' })),
    check: () => { tone(sfxBus, { freq: 520, dur: 0.1, gain: 0.2 });
                   tone(sfxBus, { freq: 780, dur: 0.16, gain: 0.2, at: 0.09 }); },

    // The crowd, which is just noise with a shape to it.
    cheer: () => { hiss(sfxBus, { freq: 900, to: 1500, dur: 1.1, gain: 0.16, q: 0.3, attack: 0.25 });
                   hiss(sfxBus, { freq: 2600, dur: 0.9, gain: 0.05, q: 0.4, attack: 0.3 }); },
    boo:   () => hiss(sfxBus, { freq: 260, to: 150, dur: 0.9, gain: 0.14, q: 0.4, attack: 0.2 }),

    // Screens.
    select:() => tone(sfxBus, { freq: 640, dur: 0.05, gain: 0.14 }),
    start: () => [0, 7, 12].forEach((n, i) =>
                   tone(sfxBus, { freq: midi(60 + n), dur: 0.18, gain: 0.24, at: i * 0.09 })),
    deny:  () => tone(sfxBus, { freq: 200, to: 140, dur: 0.14, gain: 0.2, type: 'square' }),

    // The end of a level: a call-up horn, then the park.
    promo: () => { [0, 4, 7, 12, 16, 19].forEach((n, i) =>
                     tone(sfxBus, { freq: midi(60 + n), dur: 0.26, gain: 0.24, at: i * 0.1, type: 'square' }));
                   SFX.cheer(); },
  };

  function sfx(name) {
    if (!ready || muted) return;
    const f = SFX[name];
    if (!f) return;
    try { f(); } catch (e) { /* one missed noise is not worth a crash */ }
  }

  /* ---------------------------------------------------------------- music */

  /* A step sequencer on sixteenths. Patterns are strings so they read as
   * rhythm at a glance: a digit is a note from the scale, '.' is a rest.
   *
   * The scale is major pentatonic with a couple of neighbours, because this is
   * a sunny game about a kid in a dirt lot, and a minor key would be lying.
   * The organ line is what makes it a ballpark rather than a level. */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

  const TRACKS = {
    menu: {
      bpm: 92, root: 48,
      bass: '0.......4.......',
      lead: '....5.......7...',
      organ:'2...........5...',
      hat:  '..*...*...*...*.',
    },
    // The sandlot and the parks: a loose, easy shuffle.
    sand: {
      bpm: 126, root: 48,
      bass: '0...0...4...4...',
      lead: '5.7.5...8.7.5.4.',
      organ:'0.......2.......',
      hat:  '*.*.*.*.*.*.*.*.',
    },
    // The minors: the same tune, working harder.
    minors: {
      bpm: 142, root: 46,
      bass: '0.0.3.3.4.4.2.2.',
      lead: '5.7.8.7.5.4.5.7.',
      organ:'..3.....5.......',
      hat:  '*.**.*.**.*.**.*',
    },
    // The Show: the organ takes the melody, the way it does between innings.
    show: {
      bpm: 132, root: 48,
      bass: '0...0...5...4...',
      lead: '7...8...9...8...',
      organ:'5.4.5.7.8.7.5.4.',
      hat:  '*..**..**..**..*',
    },
    // A closer on the mound, and a count.
    boss: {
      bpm: 158, root: 43,
      bass: '0.0.0.0.5.5.4.4.',
      lead: '7.8.9.8.7.5.7.8.',
      organ:'0...0...0...0...',
      hat:  '*.**.*.**.*.**.*',
    },
  };

  let track = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let shift = 0;              // per-league transpose, so leagues differ a little
  let pending = null;         // asked for before unlock; played when it arrives

  function scheduleStep(when) {
    const t = TRACKS[track];
    if (!t) return;
    const i = step % 16;

    const b = t.bass[i];
    if (b !== '.') {
      tone(musicBus, { freq: midi(t.root + shift + SCALE[+b] - 12), dur: 0.17,
                       gain: 0.3, type: 'triangle', at: when });
    }

    const l = t.lead[i];
    if (l !== '.') {
      tone(musicBus, { freq: midi(t.root + shift + SCALE[+l] + 12), dur: 0.11,
                       gain: 0.1, type: 'square', at: when });
    }

    // The organ is three sines spread out — a drawbar, more or less.
    const o = t.organ[i];
    if (o !== '.') {
      const n = t.root + shift + SCALE[+o];
      tone(musicBus, { freq: midi(n), dur: 0.42, gain: 0.1, type: 'sine', at: when });
      tone(musicBus, { freq: midi(n + 12), dur: 0.42, gain: 0.05, type: 'sine', at: when });
      tone(musicBus, { freq: midi(n + 19), dur: 0.36, gain: 0.03, type: 'sine', at: when });
    }

    if (t.hat[i] === '*') hiss(musicBus, { freq: 7000, dur: 0.03, gain: 0.05, q: 2, at: when });

    step++;
  }

  // Standard Web Audio scheduling: a coarse timer that queues notes slightly
  // ahead of time, because setInterval on its own is far too jittery for this.
  function pump() {
    if (!ready || !track) return;
    const t = TRACKS[track];
    const spb = 60 / t.bpm / 4;                    // seconds per sixteenth
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(Math.max(0, nextTime - ctx.currentTime));
      nextTime += spb;
    }
  }

  function music(name, transpose) {
    if (!ready) { pending = { name: name, shift: transpose || 0 }; return; }
    const tr = transpose || 0;
    if (track === name && shift === tr) return;
    shift = tr;
    track = name;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    if (timer) clearInterval(timer);
    if (!name) { timer = null; return; }
    timer = setInterval(() => { try { pump(); } catch (e) {} }, 25);
  }

  function stopMusic() {
    track = null;
    pending = null;
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ----------------------------------------------------------------- mute */

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) {}
    if (master) {
      // A ramp rather than a jump, or muting mid-note clicks.
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.02);
    }
    return muted;
  }

  return {
    unlock,
    sfx,
    music,
    stopMusic,
    toggleMute,
    get muted() { return muted; },
    get ready() { return ready; },
    get state() { return ctx ? ctx.state : 'none'; },
  };
})();
