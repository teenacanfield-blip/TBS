/* Sound, made rather than loaded.
 *
 * Every noise in this game is synthesised in the browser. There are no audio
 * files, for the same reason there is no sprite sheet: a file is a thing that
 * can fail to arrive, and the demos here that lean on a CDN already go silent
 * or blank on school wifi. A few hundred bytes of oscillator does not.
 *
 * Two rules the whole thing hangs off:
 *
 *   1. Nothing may play until the player has touched something. Browsers
 *      suspend an AudioContext made before a gesture, and a game that opens
 *      with a burst of noise deserves to be muted anyway. unlock() is called
 *      from the first keypress or tap.
 *
 *   2. If any of this throws, the game carries on in silence. Audio is the
 *      first thing to break in a locked-down browser and the last thing worth
 *      taking a game down over — so every entry point is wrapped.
 */
const Sound = (() => {
  const STORE = 'nww.muted.v1';

  let ctx = null;
  let master = null, musicBus = null, sfxBus = null;
  let ready = false;
  let muted = false;

  try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* storage blocked */ }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ------------------------------------------------------------- plumbing */

  /* Called on every keypress and tap, not just the first.
   *
   * The context has to be built once, but it can also come up *suspended* and
   * stay that way until a gesture the browser considers real. An earlier
   * version returned as soon as the context existed, which meant a context born
   * suspended could never be woken and the game was silent forever. So: build
   * once, but try to resume every time. */
  function unlock() {
    if (!ready) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();

        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.34;          // music sits well under the hits
        musicBus.connect(master);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(master);

        ready = true;
      } catch (e) {
        ready = false;                        // no audio here; carry on quietly
        return;
      }
    }

    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // Noise is wanted often enough that one buffer is worth keeping.
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* A single tone with an envelope. `to` slides the pitch, which is most of
   * what makes these read as game sounds rather than as beeps. */
  function tone(bus, opts) {
    if (!ready) return;
    const t = ctx.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.12;

    const o = ctx.createOscillator();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);

    const g = ctx.createGain();
    const peak = opts.gain == null ? 0.3 : opts.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function hiss(bus, opts) {
    if (!ready) return;
    const t = ctx.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.14;

    const s = ctx.createBufferSource();
    s.buffer = noise();

    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 900, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to), t + dur);
    f.Q.value = opts.q == null ? 1.1 : opts.q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain == null ? 0.32 : opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* ------------------------------------------------------------------ sfx */

  const SFX = {
    // Menus. Quiet and short — these fire a lot.
    move:  () => tone(sfxBus, { freq: 520, to: 640, dur: 0.05, gain: 0.13, type: 'square' }),
    ok:    () => { tone(sfxBus, { freq: 480, to: 720, dur: 0.09, gain: 0.2 });
                   tone(sfxBus, { freq: 720, to: 960, dur: 0.1, gain: 0.15, at: 0.06 }); },
    back:  () => tone(sfxBus, { freq: 400, to: 240, dur: 0.09, gain: 0.16 }),

    // The verbs.
    star:  () => { tone(sfxBus, { freq: 1300, to: 700, dur: 0.07, gain: 0.16, type: 'square' });
                   hiss(sfxBus, { freq: 2600, to: 1200, dur: 0.07, gain: 0.12 }); },
    flap:  () => hiss(sfxBus, { freq: 500, to: 1500, dur: 0.13, gain: 0.16, q: 0.7 }),
    swing: () => hiss(sfxBus, { freq: 1500, to: 500, dur: 0.1, gain: 0.1, q: 0.8 }),

    // Contact. The thump under the crack is what gives a hit its weight.
    hit:   () => { hiss(sfxBus, { freq: 1800, to: 300, dur: 0.14, gain: 0.34, q: 0.6 });
                   tone(sfxBus, { freq: 180, to: 60, dur: 0.16, gain: 0.32, type: 'triangle' }); },
    big:   () => { hiss(sfxBus, { freq: 1400, to: 160, dur: 0.26, gain: 0.4, q: 0.5 });
                   tone(sfxBus, { freq: 120, to: 40, dur: 0.3, gain: 0.4, type: 'triangle' }); },
    block: () => { tone(sfxBus, { freq: 900, to: 1400, dur: 0.07, gain: 0.2, type: 'sine' });
                   hiss(sfxBus, { freq: 3000, dur: 0.05, gain: 0.1 }); },
    break: () => { hiss(sfxBus, { freq: 2400, to: 400, dur: 0.4, gain: 0.34, q: 0.4 });
                   tone(sfxBus, { freq: 300, to: 90, dur: 0.4, gain: 0.24, type: 'sawtooth' }); },

    // Items.
    item:  () => { tone(sfxBus, { freq: 700, dur: 0.07, gain: 0.2 });
                   tone(sfxBus, { freq: 1050, dur: 0.07, gain: 0.2, at: 0.06 });
                   tone(sfxBus, { freq: 1400, dur: 0.11, gain: 0.2, at: 0.12 }); },
    bomb:  () => { hiss(sfxBus, { freq: 900, to: 70, dur: 0.5, gain: 0.45, q: 0.4, filter: 'lowpass' });
                   tone(sfxBus, { freq: 90, to: 30, dur: 0.45, gain: 0.4, type: 'sawtooth' }); },
    drop:  () => tone(sfxBus, { freq: 1600, to: 900, dur: 0.12, gain: 0.1, type: 'sine' }),

    // Stakes.
    ko:    () => { tone(sfxBus, { freq: 700, to: 90, dur: 0.5, gain: 0.36, type: 'sawtooth' });
                   hiss(sfxBus, { freq: 1200, to: 120, dur: 0.5, gain: 0.3, q: 0.5 }); },
    fight: () => { tone(sfxBus, { freq: 300, dur: 0.12, gain: 0.3 });
                   tone(sfxBus, { freq: 400, dur: 0.12, gain: 0.3, at: 0.13 });
                   tone(sfxBus, { freq: 600, dur: 0.3, gain: 0.34, at: 0.26 }); },
    win:   () => [0, 4, 7, 12].forEach((n, i) =>
                   tone(sfxBus, { freq: midi(69 + n), dur: 0.3, gain: 0.26, at: i * 0.11, type: 'square' })),
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
   * Everything is in a minor pentatonic, which is why nothing here can land
   * on an actively wrong note. */
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];

  const TRACKS = {
    menu: {
      bpm: 84, root: 45,
      bass: '0.......5.......',
      lead: '....2.......4...',
      hat:  '..*...*...*...*.',
    },
    fight: {
      bpm: 150, root: 45,
      bass: '0.0.0.0.5.5.3.3.',
      lead: '2.4.5.4.2.4.7.5.',
      hat:  '*.*.*.*.*.*.*.*.',
    },
    tense: {                    // last stock, for either side
      bpm: 168, root: 43,
      bass: '0.0.3.3.0.0.5.5.',
      lead: '4.5.7.5.4.2.4.7.',
      hat:  '*.**.*.**.*.**.*',
    },
  };

  let track = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let shift = 0;              // per-stage transpose, so maps do not all sound alike

  function scheduleStep(when) {
    const t = TRACKS[track];
    if (!t) return;
    const i = step % 16;

    const b = t.bass[i];
    if (b !== '.') {
      tone(musicBus, { freq: midi(t.root + shift + SCALE[+b] - 12), dur: 0.16,
                       gain: 0.3, type: 'triangle', at: when });
    }

    const l = t.lead[i];
    if (l !== '.') {
      tone(musicBus, { freq: midi(t.root + shift + SCALE[+l] + 12), dur: 0.12,
                       gain: 0.12, type: 'square', at: when });
    }

    if (t.hat[i] === '*') {
      hiss(musicBus, { freq: 7000, dur: 0.03, gain: 0.05, q: 2, at: when });
    }

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
    if (!ready) { track = name; return; }          // remembered until unlock
    shift = transpose || 0;
    if (track === name) return;
    track = name;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    if (timer) clearInterval(timer);
    if (!name) return;
    timer = setInterval(() => { try { pump(); } catch (e) {} }, 25);
  }

  function stopMusic() {
    track = null;
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ----------------------------------------------------------------- mute */

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) {}
    if (master) {
      // A ramp rather than a jump, or muting mid-note clicks.
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
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
    // Handy when sound is not working on somebody's machine.
    get state() { return ctx ? ctx.state : 'none'; },
  };
})();
