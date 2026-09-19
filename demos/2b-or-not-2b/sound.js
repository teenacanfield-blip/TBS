/* Sound, made rather than loaded.
 *
 * The same rule the other games here follow: no audio files. A file is a thing
 * that can fail to arrive, and this game is meant to survive the wifi at a
 * school, so every noise is a few oscillators and a burst of filtered noise.
 *
 * The palette is stationery. Wood, graphite, rubber, tin. Nothing has a long
 * tail, because a pencil is a small hard object and small hard objects click.
 *
 * Two rules, as ever:
 *   1. Nothing plays before the player has touched something — browsers
 *      suspend a context built before a gesture, so unlock() runs on every
 *      keypress and tap, not just the first.
 *   2. If any of this throws, the game carries on in silence.
 */
const Sound = (() => {
'use strict';

const STORE = '2b.muted.v1';

let ctx = null, master = null, sfx = null, mus = null;
let ready = false, muted = false;
let noiseBuf = null;

try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* storage blocked */ }

const now = () => (ctx ? ctx.currentTime : 0);
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function unlock() {
  if (!ready) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);

      sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
      mus = ctx.createGain(); mus.gain.value = 0.32; mus.connect(master);

      // One second of noise, reused by every scrape, thud and whoosh.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      ready = true;
    } catch (e) { ready = false; return; }
  }
  try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) { /* fine */ }
}

/* --------------------------------------------------------------- voices */

function tone(freq, dur, opts) {
  if (!ready || muted) return;
  const o = opts || {};
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'triangle';
    const t = now();
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const peak = (o.gain === undefined ? 0.3 : o.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.cutoff;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.bus || sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch (e) { /* silence is an acceptable failure */ }
}

function noise(dur, opts) {
  if (!ready || muted) return;
  const o = opts || {};
  try {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    const t = now();
    f.frequency.setValueAtTime(o.freq || 900, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t + dur);
    f.Q.value = o.q === undefined ? 1.1 : o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.25, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  } catch (e) { /* as above */ }
}

/* ---------------------------------------------------------------- noises */
/* Each one is named for the thing it is, not the waveform it uses. */

let crumbStep = 0, crumbAt = 0;
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

const noises = {
  // A pencil leaving the ground: light, wooden, upward.
  jump() { tone(430, 0.16, { type: 'square', to: 720, gain: 0.16, cutoff: 2200 }); },

  // The second one is thinner, so you can hear you have spent it.
  flip() {
    tone(620, 0.2, { type: 'square', to: 1080, gain: 0.12, cutoff: 2600 });
    noise(0.14, { freq: 2400, to: 900, gain: 0.06 });
  },

  land(force) {
    const f = Math.min(1, (force || 1));
    tone(150 - f * 40, 0.1, { type: 'sine', to: 70, gain: 0.16 + f * 0.14 });
    noise(0.07, { type: 'lowpass', freq: 900 + f * 600, gain: 0.1 + f * 0.12, q: 0.6 });
  },

  step() { noise(0.035, { freq: 1500 + Math.random() * 700, gain: 0.035, q: 2 }); },

  // Graphite into cork. A short knock and a fibrous crunch.
  stab() {
    tone(190, 0.09, { type: 'square', to: 110, gain: 0.2, cutoff: 900 });
    noise(0.12, { freq: 1700, to: 500, gain: 0.15, q: 0.8 });
  },

  kick() {
    tone(330, 0.14, { type: 'square', to: 660, gain: 0.16, cutoff: 2000 });
    noise(0.09, { freq: 900, to: 2000, gain: 0.08 });
  },

  slip() { noise(0.3, { freq: 600, to: 220, gain: 0.07, q: 0.7 }); },

  dash() {
    noise(0.26, { freq: 320, to: 2600, gain: 0.16, q: 0.9 });
    tone(240, 0.22, { type: 'sawtooth', to: 520, gain: 0.06, cutoff: 1400 });
  },

  bounce() {
    tone(240, 0.26, { type: 'sine', to: 700, gain: 0.28 });
    tone(480, 0.14, { type: 'triangle', to: 900, gain: 0.08 });
  },

  // Rising the more you collect without stopping, and it resets if you do.
  crumb() {
    const t = now();
    if (t - crumbAt > 1.6) crumbStep = 0;
    crumbAt = t;
    const n = 69 + PENT[Math.min(crumbStep, PENT.length - 1)];
    crumbStep++;
    tone(midi(n), 0.13, { type: 'triangle', gain: 0.15 });
    tone(midi(n + 12), 0.08, { type: 'sine', gain: 0.05 });
  },

  star() {
    [0, 4, 7, 12].forEach((s, i) => {
      setTimeout(() => tone(midi(76 + s), 0.3, { type: 'triangle', gain: 0.16 }), i * 70);
    });
  },

  sharpen() {
    noise(0.5, { type: 'bandpass', freq: 800, to: 2600, gain: 0.16, q: 1.6 });
    tone(120, 0.5, { type: 'sawtooth', to: 200, gain: 0.05, cutoff: 700 });
  },

  glue() { noise(0.35, { type: 'lowpass', freq: 500, to: 160, gain: 0.13, q: 0.5 }); },

  wind() { noise(0.9, { type: 'bandpass', freq: 500, to: 900, gain: 0.07, q: 0.5 }); },

  hurt() {
    tone(220, 0.3, { type: 'square', to: 90, gain: 0.2, cutoff: 1200 });
    noise(0.2, { freq: 400, to: 150, gain: 0.12 });
  },

  reset() { tone(520, 0.22, { type: 'sine', to: 260, gain: 0.14 }); },

  ui() { tone(680, 0.06, { type: 'square', gain: 0.09, cutoff: 2400 }); },

  // A gold star on the chart: four notes and a shimmer.
  achievement() {
    [0, 5, 9, 12].forEach((s, i) => {
      setTimeout(() => {
        tone(midi(69 + s), 0.34, { type: 'triangle', gain: 0.2 });
        tone(midi(81 + s), 0.2, { type: 'sine', gain: 0.06 });
      }, i * 85);
    });
  },

  win() {
    const line = [0, 4, 7, 12, 7, 12, 16, 19];
    line.forEach((s, i) => {
      setTimeout(() => {
        tone(midi(60 + s), 0.4, { type: 'triangle', gain: 0.22 });
        tone(midi(48 + s), 0.5, { type: 'sine', gain: 0.12 });
      }, i * 150);
    });
  },
};

function play(name, arg) {
  if (!ready || muted) return;
  const fn = noises[name];
  if (fn) try { fn(arg); } catch (e) { /* keep going */ }
}

/* ----------------------------------------------------------------- music */
/* Eight bars of nothing much: a soft two-note pulse and a melody that picks
   its way up a pentatonic scale, because the whole game is picking its way up
   something. Scheduled a bar ahead so it does not drift. */

let musicOn = false, nextAt = 0, bar = 0, timer = null;
const MEL = [
  [0, 4, 7, 9], [7, 4, 2, 0], [4, 7, 9, 12], [9, 7, 4, 2],
  [0, 4, 7, 9], [12, 9, 7, 4], [2, 4, 7, 12], [7, 4, 0, -3],
];

function schedule() {
  if (!ready || !musicOn) return;
  const t = now();
  while (nextAt < t + 1.2) {
    const line = MEL[bar % MEL.length];
    const root = 48 + (bar % 4 === 3 ? -2 : 0);
    for (let i = 0; i < 4; i++) {
      const at = nextAt + i * 0.42;
      const n = midi(72 + line[i]);
      setTimeout(() => {
        if (musicOn) tone(n, 0.5, { type: 'triangle', gain: 0.055, bus: mus });
      }, Math.max(0, (at - now()) * 1000));
    }
    setTimeout(() => {
      if (musicOn) {
        tone(midi(root), 1.2, { type: 'sine', gain: 0.09, bus: mus });
        tone(midi(root + 7), 1.2, { type: 'sine', gain: 0.05, bus: mus });
      }
    }, Math.max(0, (nextAt - now()) * 1000));
    nextAt += 1.68;
    bar++;
  }
}

function music(on) {
  musicOn = !!on;
  if (!ready) return;
  if (musicOn) {
    nextAt = now() + 0.1;
    if (!timer) timer = setInterval(schedule, 400);
    schedule();
  } else if (timer) { clearInterval(timer); timer = null; }
}

/* ------------------------------------------------------------------ mute */

function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) { /* fine */ }
  if (master) {
    try {
      master.gain.setTargetAtTime(muted ? 0 : 0.85, now(), 0.02);
    } catch (e) { master.gain.value = muted ? 0 : 0.85; }
  }
  return muted;
}

return {
  unlock, play, music, setMuted,
  toggle: () => setMuted(!muted),
  get muted() { return muted; },
};
})();
