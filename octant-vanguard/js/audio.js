/* Octant Vanguard — synthesized sound effects, generative music, character voices */
'use strict';

const Sound = {
  ctx: null, master: null, sfxGain: null, musGain: null, noiseBuf: null,
  sfxVol: 0.7, musVol: 0.45, last: {},
  music: { on: false, intensity: 0, step: 0, nextTime: 0, timer: null, chord: 0, pads: [], padFilter: null, mode: 'calm' },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
    this.musGain = ctx.createGain(); this.musGain.gain.value = this.musVol; this.musGain.connect(this.master);
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  setVolumes(sfx, mus) {
    this.sfxVol = sfx; this.musVol = mus;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    if (this.musGain) this.musGain.gain.setTargetAtTime(mus, this.ctx.currentTime, 0.05);
  },
  throttle(key, ms) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return false;
    this.last[key] = now; return true;
  },
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  tone(type, f0, f1, dur, vol, dest, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, fType, f0, f1, q = 1, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = fType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); this.env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  sfx(name, opt = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'laser': if (!this.throttle('laser', 45)) return;
        this.tone('square', 1400 + Math.random() * 200, 260, 0.09, 0.06); this.tone('sine', 900, 120, 0.08, 0.05); break;
      case 'laser2': if (!this.throttle('laser2', 60)) return;
        this.tone('sawtooth', 1100, 300, 0.07, 0.035); break;
      case 'eshot': if (!this.throttle('eshot', 70)) return;
        this.tone('triangle', 420, 160, 0.16, 0.05); this.noise(0.08, 0.03, 'bandpass', 2000, 600, 3); break;
      case 'hit': if (!this.throttle('hit', 35)) return;
        this.noise(0.06, 0.08, 'highpass', 3000, 1200); this.tone('square', 300, 120, 0.05, 0.03); break;
      case 'crit': if (!this.throttle('crit', 50)) return;
        this.tone('square', 1800, 900, 0.07, 0.05); break;
      case 'boom': if (!this.throttle('boom', 40)) return; {
        const s = opt.size || 1;
        this.noise(0.35 * s + 0.1, 0.22 * Math.min(1.5, s), 'lowpass', 2400, 90);
        this.tone('sine', 140, 38, 0.35 * s, 0.25 * Math.min(1.4, s)); break; }
      case 'bigboom':
        this.noise(1.4, 0.4, 'lowpass', 1800, 40); this.tone('sine', 90, 25, 1.2, 0.45); this.tone('sawtooth', 220, 30, 0.9, 0.08); break;
      case 'hurt': if (!this.throttle('hurt', 90)) return;
        this.tone('sawtooth', 220, 70, 0.18, 0.12); this.noise(0.15, 0.12, 'lowpass', 1500, 200); break;
      case 'shieldhit': if (!this.throttle('shield', 80)) return;
        this.tone('sine', 1200, 600, 0.12, 0.07); this.tone('sine', 1800, 900, 0.1, 0.04); break;
      case 'pickup':
        this.tone('sine', 660, 660, 0.08, 0.08); this.tone('sine', 990, 990, 0.12, 0.07, null, 0.06); break;
      case 'fuel':
        this.tone('triangle', 330, 660, 0.18, 0.1); this.noise(0.2, 0.05, 'bandpass', 800, 3000, 4); break;
      case 'coin': if (!this.throttle('coin', 30)) return;
        this.tone('square', 1320 + Math.random() * 300, 1320, 0.05, 0.025); break;
      case 'nova':
        this.tone('sine', 80, 30, 1.0, 0.4); this.noise(0.9, 0.3, 'bandpass', 300, 4000, 0.7); this.tone('sawtooth', 600, 60, 0.7, 0.09); break;
      case 'boost': if (!this.throttle('boost', 300)) return;
        this.noise(0.4, 0.07, 'bandpass', 400, 1800, 1.2); break;
      case 'alarm': if (!this.throttle('alarm', 1200)) return;
        this.tone('square', 880, 880, 0.12, 0.05); this.tone('square', 660, 660, 0.12, 0.05, null, 0.16); break;
      case 'spawn': if (!this.throttle('spawn', 120)) return;
        this.tone('sine', 120, 480, 0.5, 0.05); this.noise(0.5, 0.03, 'bandpass', 200, 900, 6); break;
      case 'boing': if (!this.throttle('boing', 90)) return; this.tone('sine', 420, 900, 0.09, 0.05); break;
      case 'ui': this.tone('sine', 880, 1100, 0.05, 0.05); break;
      case 'buy': this.tone('triangle', 523, 523, 0.08, 0.08); this.tone('triangle', 784, 784, 0.1, 0.08, null, 0.07); this.tone('triangle', 1046, 1046, 0.16, 0.08, null, 0.14); break;
      case 'deny': this.tone('square', 200, 160, 0.15, 0.06); break;
      case 'blip': if (!this.throttle('blip', 40)) return; this.tone('sine', 1500 + Math.random() * 400, 1500, 0.02, 0.012); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.09, null, i * 0.13)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.5, 0.06, null, i * 0.2)); break;
      case 'warp': this.tone('sine', 100, 1600, 0.9, 0.08); this.noise(1, 0.08, 'bandpass', 200, 5000, 2); break;
    }
  },

  /* ---------- generative music ---------- */
  CHORDS: {
    calm:   [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],      // Am F C G
    combat: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],      // Am F Dm E
    boss:   [[57, 60, 63], [56, 60, 63], [53, 56, 60], [52, 56, 59]],      // dark
  },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  startMusic() {
    const c = this.ctx, m = this.music;
    if (m.on) return; m.on = true;
    m.padFilter = c.createBiquadFilter(); m.padFilter.type = 'lowpass'; m.padFilter.frequency.value = 900; m.padFilter.Q.value = 0.8;
    const padGain = c.createGain(); padGain.gain.value = 0.06;
    m.padFilter.connect(padGain); padGain.connect(this.musGain);
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 400; lfo.connect(lfoG); lfoG.connect(m.padFilter.frequency); lfo.start();
    for (let i = 0; i < 3; i++) {
      const voice = [];
      for (let k = 0; k < 2; k++) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = k ? 9 : -9;
        o.connect(m.padFilter); o.start(); voice.push(o);
      }
      m.pads.push(voice);
    }
    m.nextTime = c.currentTime + 0.1;
    m.timer = setInterval(() => this.schedule(), 30);
  },
  setMusic(mode, intensity) { this.music.mode = mode; this.music.intensity = intensity; },
  schedule() {
    const c = this.ctx, m = this.music; if (!c || c.state !== 'running') return;
    const bpm = m.mode === 'boss' ? 132 : m.mode === 'combat' ? 116 : 84;
    const stepDur = 60 / bpm / 4;
    while (m.nextTime < c.currentTime + 0.12) {
      const t = m.nextTime, s = m.step % 64;
      const chords = this.CHORDS[m.mode] || this.CHORDS.calm;
      if (s % 16 === 0) {
        m.chord = (m.step / 16 | 0) % 4;
        const ch = chords[m.chord];
        m.pads.forEach((v, i) => v.forEach(o => o.frequency.setTargetAtTime(this.mtof(ch[i]), t, 0.4)));
      }
      const ch = chords[m.chord];
      // arpeggio
      const arpEvery = m.mode === 'calm' ? 4 : 2;
      if (s % arpEvery === 0 && (m.mode !== 'calm' || Math.random() < 0.6)) {
        const pat = [0, 1, 2, 1, 2, 0, 2, 1];
        const n = ch[pat[(s / arpEvery | 0) % pat.length]] + 12 + (m.mode === 'boss' && s % 8 === 0 ? 12 : 0);
        this.note('triangle', this.mtof(n), t, stepDur * 1.6, m.mode === 'calm' ? 0.035 : 0.045);
      }
      if (m.mode !== 'calm') {
        // bass
        if (s % 2 === 0) this.note('square', this.mtof(ch[0] - 24), t, stepDur * 1.2, 0.05, 500);
        // kick
        if (s % 4 === 0) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); this.env(g, t, 0.002, 0.28, 0.2); o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + 0.25); }
        // snare
        if (s % 8 === 4) this.mnoise(t, 0.15, 0.09, 'bandpass', 1800);
        // hats
        if (s % 2 === 1 || m.mode === 'boss') this.mnoise(t, 0.03, 0.025, 'highpass', 8000);
      }
      m.nextTime += stepDur; m.step++;
    }
  },
  note(type, f, t, dur, vol, cutoff = 3000) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
    this.env(g, t, 0.01, vol, dur);
    o.connect(fl); fl.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + dur + 0.05);
  },
  mnoise(t, dur, vol, type, f) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f;
    this.env(g, t, 0.002, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(this.musGain); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
};

/* ---------- Character voices ----------
   Prefers the page's Claude voice (tts capability). Falls back to the browser's speech
   synthesis only when the Claude voice isn't offered in this view at all. */
const Voice = {
  mode: 'auto',           // 'auto' | 'off'
  tts: null, ttsBlocked: false, ttsReady: false,
  browserVoices: [], speaking: false, onStateCb: null, rateLimitedUntil: 0,

  async init() {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        this.tts = await window.claude.use('tts');
        if (this.tts) {
          this.tts.onState(e => {
            this.speaking = e.state !== 'idle';
            if (e.state === 'idle' && e.reason === 'not_granted') this.ttsBlocked = true;
            if (this.onStateCb) this.onStateCb(this.speaking);
          });
        }
      }
    } catch (e) { this.tts = null; }
    this.ttsReady = true;
    if ('speechSynthesis' in window) {
      const load = () => { this.browserVoices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); };
      load();
      try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) {}
    }
  },
  engine() {
    if (this.mode === 'off') return 'off';
    if (this.tts && !this.ttsBlocked) return 'claude';
    if (this.tts && this.ttsBlocked) return 'off'; // viewer turned the Claude voice off: respect it
    if ('speechSynthesis' in window) return 'browser';
    return 'off';
  },
  label() {
    const e = this.engine();
    return e === 'claude' ? 'Claude voices' : e === 'browser' ? 'Browser voices' : 'Voices off';
  },
  speak(who, text, interrupt = true) {
    const eng = this.engine(); if (eng === 'off') return;
    const ch = CHARACTERS[who] || CHARACTERS.sys;
    if (eng === 'claude') {
      if (performance.now() < this.rateLimitedUntil) return;
      const line = { text: text.slice(0, 1900), voice: ch.voice, rate: ch.rate };
      const p = interrupt ? this.tts.speak([line], { language: 'en' }) : this.tts.add([line], { language: 'en' });
      p.catch(e => {
        if (!e) return;
        if (e.code === 'not_granted') this.ttsBlocked = true;
        else if (e.code === 'rate_limited') this.rateLimitedUntil = performance.now() + (e.retryAfterMs || 60000);
      });
    } else {
      try {
        if (interrupt) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.pitch = ch.pitch; u.rate = ch.rate;
        const vs = this.browserVoices;
        if (vs.length) u.voice = vs[ch.bVoice % vs.length];
        u.onstart = () => { this.speaking = true; this.onStateCb && this.onStateCb(true); };
        u.onend = u.onerror = () => { this.speaking = false; this.onStateCb && this.onStateCb(false); };
        speechSynthesis.speak(u);
      } catch (e) {}
    }
  },
  stop() {
    if (this.tts) this.tts.stop().catch(() => {});
    if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
    this.speaking = false;
  },
};
