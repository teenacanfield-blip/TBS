/* Big Swing Bonanza.
 *
 * Three modes on one renderer: Home Run Derby against the CPU, Home Run Derby
 * against a friend on the same keyboard, and the Golden Bat Bonanza — a
 * knockout tournament of bean-shaped ballplayers (a race, a survival round,
 * and a final race to the golden bat), or any one of the 25 courses on its own.
 *
 * Everything you see is built from three.js primitives at load. There are no
 * models or images to fetch; the only thing this page loads is three.js.
 *
 * Speed matters more than anything else here, because this has to run on a
 * school Chromebook. Nearly everything static is merged into a handful of
 * vertex-coloured meshes (a whole bean is eight draw calls, a whole course
 * segment is one), and the page watches its own frame rate and drops the
 * resolution and then the shadows if it cannot keep up.
 */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + (b - a) * Math.random();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  const wrapA = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const ORD = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const PLAYER_BY_ID = Object.fromEntries(ROSTER.map((p) => [p.id, p]));
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

  /* ================================================================ sound */
  const Snd = (() => {
    let ac = null, master = null, buf = null;
    let muted = /[?&]mute\b/.test(location.search);
    try { if (localStorage.getItem('bigswing.mute') === '1') muted = true; } catch (e) { /* ignore */ }
    function ctx() {
      if (muted) return null;
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain();
          master.gain.value = 0.55;
          master.connect(ac.destination);
        } catch (e) { return null; }
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function noiseBuf() {
      if (!buf) {
        buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return buf;
    }
    function nz(dur, type, f, q, vol, attack = 0.004, when = 0) {
      const a = ctx(); if (!a) return null;
      const t = a.currentTime + when;
      const s = a.createBufferSource(); s.buffer = noiseBuf();
      const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl).connect(g).connect(master);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
      return { fl, t };
    }
    function tone(type, f0, f1, dur, vol, when = 0) {
      const a = ctx(); if (!a) return;
      const t = a.currentTime + when;
      const o = a.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      unlock: ctx,
      get muted() { return muted; },
      setMuted(v) {
        muted = v;
        try { localStorage.setItem('bigswing.mute', v ? '1' : '0'); } catch (e) { /* ignore */ }
        if (ac) (v ? ac.suspend() : ac.resume());
      },
      crack(q) { nz(0.08, 'highpass', 1700, 0.7, 0.5 + q * 0.5); tone('triangle', 1500, 450, 0.07, 0.15 + q * 0.2); },
      whiff() { const r = nz(0.22, 'bandpass', 500, 1.4, 0.25, 0.06); if (r) r.fl.frequency.exponentialRampToValueAtTime(2600, r.t + 0.2); },
      mitt() { nz(0.05, 'lowpass', 1000, 0.8, 0.5); tone('sine', 170, 90, 0.08, 0.35); },
      cheer(len = 2.6, vol = 0.3) { nz(len, 'bandpass', 1000, 0.5, vol, 0.3); nz(len * 0.8, 'bandpass', 2400, 0.9, vol * 0.4, 0.2, 0.1); },
      groan() { const r = nz(1.2, 'lowpass', 500, 0.7, 0.15, 0.2); if (r) r.fl.frequency.exponentialRampToValueAtTime(200, r.t + 1.1); },
      jump() { tone('square', 330, 660, 0.1, 0.05); },
      boing() { tone('sine', 180, 950, 0.3, 0.22); },
      bonk() { tone('sine', 240, 55, 0.2, 0.4); nz(0.08, 'lowpass', 600, 1, 0.3); },
      pop() { tone('sine', 600, 1200, 0.08, 0.15); },
      beep(hi) { tone('square', hi ? 988 : 494, hi ? 988 : 494, hi ? 0.45 : 0.15, 0.1); },
      whoosh() { const r = nz(0.35, 'bandpass', 400, 1, 0.25, 0.05); if (r) r.fl.frequency.exponentialRampToValueAtTime(1800, r.t + 0.3); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.4, 0.16, i * 0.13)); },
      lose() { [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.45, 0.13, i * 0.2)); },
      organ() { [392, 523, 659, 784, 659, 784].forEach((f, i) => tone('sawtooth', f, f, 0.16, 0.05, i * 0.14)); },
    };
  })();

  /* ============================================================= renderer */
  const canvas = $('#c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
  let W = 1, H = 1;

  // Quality steps: 2 = sharp with shadows, 1 = 1x with shadows, 0 = soft, no shadows.
  let quality = 2;
  const DPR = window.devicePixelRatio || 1;
  function applyQuality() {
    renderer.setPixelRatio(quality === 2 ? Math.min(DPR, 1.5) : quality === 1 ? 1 : 0.75);
    renderer.setSize(W, H, false);
    if (world && world.sun) world.sun.castShadow = quality > 0;
    if (show.sun) show.sun.castShadow = quality > 0;
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    applyQuality();
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* ============================================================ textures */
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.canvasEl = c;
    return t;
  }
  const TEX = {
    grass: canvasTex(512, 512, (g, w, h) => {
      for (let i = 0; i < 24; i++) {
        g.fillStyle = i % 2 ? '#4fb84a' : '#62c95a';
        g.fillRect((i * w) / 24, 0, w / 24 + 1, h);
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(20,70,20,${Math.random() * 0.1})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }),
    dirt: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d99a5e'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(140,80,30,0.18)' : 'rgba(250,200,140,0.2)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, [6, 6]),
    crowd: canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#2a3a78'; g.fillRect(0, 0, w, h);
      const cols = ['#ff4d6d', '#ffd166', '#4dabf7', '#ffffff', '#51cf66', '#f783ac', '#ff922b', '#845ef7'];
      for (let row = 0; row < 8; row++) {
        g.fillStyle = row % 2 ? '#3a4a90' : '#344488';
        g.fillRect(0, row * 16 + 11, w, 5);
        for (let x = 0; x < w; x += 8) {
          if (Math.random() < 0.12) continue;
          g.fillStyle = pick(cols);
          g.beginPath(); g.arc(x + 4 + rand(-1, 1), row * 16 + 6, 3.2, 0, TAU); g.fill();
          g.fillStyle = '#e8b98c';
          g.beginPath(); g.arc(x + 4, row * 16 + 2, 2, 0, TAU); g.fill();
        }
      }
    }, [14, 1]),
    ball: canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d0202a'; g.lineWidth = 5;
      for (const off of [0, w / 2]) {
        g.beginPath();
        for (let x = 0; x <= w / 2; x += 2) {
          const y = h / 2 + Math.sin((x / (w / 2)) * TAU) * h * 0.28 * (off ? -1 : 1);
          x ? g.lineTo(off + x, y) : g.moveTo(off + x, y);
        }
        g.stroke();
      }
    }),
    arrows: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#3a4a8f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd166';
      g.beginPath(); g.moveTo(64, 96); g.lineTo(24, 48); g.lineTo(44, 48); g.lineTo(64, 72); g.lineTo(84, 48); g.lineTo(104, 48); g.fill();
    }, [3, 6]),
    glow: canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,230,120,1)');
      gr.addColorStop(0.35, 'rgba(255,200,60,0.5)');
      gr.addColorStop(1, 'rgba(255,180,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }),
    blob: canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }),
  };
  const numMatCache = new Map();
  function numberMat(num, color) {
    const k = num + color;
    if (!numMatCache.has(k)) {
      const map = canvasTex(256, 128, (g, w, h) => {
        g.font = 'bold 104px "Lilita One", Impact, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.strokeText(String(num), w / 2, h / 2 + 6);
        g.fillStyle = color;
        g.fillText(String(num), w / 2, h / 2 + 6);
      });
      numMatCache.set(k, new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
    }
    return numMatCache.get(k);
  }
  function labelSprite(text, color = '#ffffff', bg = 'rgba(10,14,30,0.6)') {
    const tex = canvasTex(512, 128, (g, w, h) => {
      g.font = 'bold 64px "Lilita One", Impact, sans-serif';
      const tw = g.measureText(text).width + 50;
      g.fillStyle = bg;
      const x = (w - tw) / 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, 18, tw, 92, 40); else g.rect(x, 18, tw, 92);
      g.fill();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 4);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(2.2, 0.55, 1);
    return s;
  }

  /* ======================================================== geometry kit */
  function capsuleGeo(r, h, seg = 18) {
    const pts = [];
    const cyl = Math.max(0, h - 2 * r);
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r), r + Math.sin(a) * r));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r), r + cyl + Math.sin(a) * r));
    }
    return new THREE.LatheGeometry(pts, seg);
  }
  /* A rounded box is a sphere pulled apart at its seams: every vertex moves
   * out by half the box along the axes it is on the positive or negative side
   * of, and the vertices exactly on a seam stay in the middle of an edge. The
   * sphere's own normals are then already right for the rounded corners. */
  const rbCache = new Map();
  function roundedBox(sx, sy, sz, r = 0.35) {
    r = Math.max(0.03, Math.min(r, sx / 2 - 0.01, sy / 2 - 0.01, sz / 2 - 0.01));
    const k = [sx, sy, sz, r].map((v) => v.toFixed(3)).join();
    if (rbCache.has(k)) return rbCache.get(k);
    const g = new THREE.SphereGeometry(r, 16, 10);
    const p = g.attributes.position;
    const hx = sx / 2 - r, hy = sy / 2 - r, hz = sz / 2 - r, e = 1e-6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, x + (x > e ? hx : x < -e ? -hx : 0), y + (y > e ? hy : y < -e ? -hy : 0), z + (z > e ? hz : z < -e ? -hz : 0));
    }
    g.computeBoundingSphere();
    rbCache.set(k, g);
    return g;
  }
  const GEO = {
    body: capsuleGeo(0.5, 1.36, 24),
    leg: capsuleGeo(0.14, 0.46, 12),
    arm: capsuleGeo(0.11, 0.5, 12),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    lowSphere: new THREE.SphereGeometry(1, 12, 8),
    dome: new THREE.SphereGeometry(0.535, 24, 12, 0, TAU, 0, Math.PI / 2),
    brim: new THREE.CylinderGeometry(0.33, 0.33, 0.05, 24),
    band: new THREE.CylinderGeometry(0.508, 0.508, 0.1, 26, 1, true),
    back: new THREE.CylinderGeometry(0.512, 0.512, 0.46, 16, 1, true, Math.PI - 0.62, 1.24),
    bat: new THREE.CylinderGeometry(0.075, 0.032, 1.0, 12),
    knob: new THREE.CylinderGeometry(0.048, 0.048, 0.035, 12),
    smile: new THREE.TorusGeometry(0.075, 0.018, 6, 14, Math.PI),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
    ball: new THREE.SphereGeometry(1, 24, 16),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  const matCache = new Map();
  function MAT(color, opt) {
    const k = color + (opt ? JSON.stringify(opt) : '');
    if (!matCache.has(k)) {
      const o = Object.assign({ roughness: 0.45, metalness: 0 }, opt || {});
      if (o.emissive) o.emissive = lin(o.emissive);
      o.color = lin(color);
      matCache.set(k, new THREE.MeshStandardMaterial(o));
    }
    return matCache.get(k);
  }
  const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const VC_GLOSS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 });
  const GOLD = new THREE.MeshStandardMaterial({ color: lin('#ffcc33'), metalness: 0.85, roughness: 0.22, emissive: lin('#6b4a00'), emissiveIntensity: 0.7 });
  const BALL_MAT = new THREE.MeshStandardMaterial({ map: TEX.ball, roughness: 0.45 });
  const HEATER_MAT = new THREE.MeshStandardMaterial({ map: TEX.ball, emissive: lin('#ff6a00'), emissiveIntensity: 0.7 });

  function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }

  /* Pour many coloured shapes into one vertex-coloured geometry. `side`
   * recolours everything that does not face up, which is what makes a
   * platform read as a slab of candy rather than a flat card. */
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3();
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  const flatCache = new WeakMap();
  const flatGeo = (g) => {
    let f = flatCache.get(g);
    if (!f) { f = g.index ? g.toNonIndexed() : g; flatCache.set(g, f); }
    return f;
  };
  class Merger {
    constructor() { this.p = []; this.n = []; this.c = []; }
    get count() { return this.p.length; }
    add(geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, side = null) {
      const g = flatGeo(geo);
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      _e.set(rx, ry, rz);
      _q.setFromEuler(_e);
      _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
      _nm.getNormalMatrix(_m);
      _ca.set(color).convertSRGBToLinear();
      if (side) _cb.set(side).convertSRGBToLinear();
      for (let i = 0; i < P.length; i += 3) {
        _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_m);
        _n.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_nm).normalize();
        this.p.push(_v.x, _v.y, _v.z);
        this.n.push(_n.x, _n.y, _n.z);
        const c = side && _n.y < 0.55 ? _cb : _ca;
        this.c.push(c.r, c.g, c.b);
      }
      return this;
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      return g;
    }
    mesh(mat = VC, shadow = true) {
      const m = new THREE.Mesh(this.geometry(), mat);
      m.castShadow = shadow; m.receiveShadow = true;
      return m;
    }
  }

  function skyDome(top, bottom) {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bottom) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.5 + 0.2, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h * h * (3.0 - 2.0 * h)), 1.0); }',
    });
    const d = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), m);
    d.renderOrder = -10;
    d.frustumCulled = false;
    return d;
  }

  const batGeoCache = new Map();
  function makeBat(mat, wood = '#c8955a') {
    const g = new THREE.Group();
    if (mat) {
      g.add(mesh(GEO.bat, mat, 0, 0.5, 0));
      g.add(mesh(GEO.knob, mat, 0, 0, 0));
      return g;
    }
    if (!batGeoCache.has(wood)) {
      batGeoCache.set(wood, new Merger().add(GEO.bat, wood, 0, 0.5, 0).add(GEO.knob, '#5a3a1f', 0, 0, 0).geometry());
    }
    const m = new THREE.Mesh(batGeoCache.get(wood), VC_GLOSS);
    m.castShadow = true;
    g.add(m);
    return g;
  }

  /* A bean. Feet at the origin, facing +Z, about 1.7 m tall with the cap.
   * The head, body, face and cap are one mesh; each limb is another. */
  const beanCache = new Map();
  function beanGeos(p) {
    if (beanCache.has(p.id)) return beanCache.get(p.id);
    const legend = p.era === 'legend';
    const dark = '#1c1c24', white = '#ffffff';
    const b = new Merger();
    b.add(GEO.body, p.jersey, 0, 0.3, 0);
    b.add(GEO.band, p.trim, 0, 0.66, 0);
    b.add(GEO.sphere, p.skin, 0, 0.98, 0.35, 0.4, 0.31, 0.22);
    for (const s of [-1, 1]) {
      b.add(GEO.lowSphere, white, s * 0.14, 1.03, 0.55, 0.1, 0.12, 0.06);
      b.add(GEO.lowSphere, dark, s * 0.14, 1.03, 0.605, 0.05, 0.062, 0.03);
      b.add(GEO.lowSphere, white, s * 0.14 + 0.02, 1.06, 0.632, 0.016, 0.016, 0.01);
      b.add(GEO.lowSphere, shade(p.skin, 0.85), s * 0.27, 0.93, 0.5, 0.07, 0.045, 0.03);
    }
    b.add(GEO.smile, dark, 0, 0.92, 0.565, 1, 1, 1, 0, 0, Math.PI);
    if (p.stache) b.add(GEO.box, '#3a2a1c', 0, 0.96, 0.585, 0.26, 0.05, 0.05);
    if (p.helmet) {
      // A batting helmet from the shop replaces the cap: rounder, shinier, one ear flap.
      b.add(GEO.dome, p.helmet, 0, 1.13, 0, 1.06, 1.08, 1.06);
      b.add(GEO.brim, p.helmet, 0, 1.15, 0.44, 0.9, 1, 0.8, 0.1, 0, 0);
      b.add(GEO.lowSphere, p.helmet, 0.5, 1.02, 0.04, 0.12, 0.2, 0.2);
    } else {
      b.add(GEO.dome, p.cap, 0, 1.15, 0, 1, legend ? 0.8 : 1, 1);
      b.add(GEO.brim, p.cap, 0, 1.17, 0.46, 1, 1, legend ? 0.8 : 1.15, 0.1, 0, 0);
      b.add(GEO.lowSphere, p.trim, 0, 1.15 + (legend ? 0.43 : 0.535), 0, 0.05, 0.03, 0.05);
    }
    const leg = new Merger()
      .add(GEO.leg, legend ? '#efe6d0' : '#f4f4f6', 0, -0.46, 0)
      .add(GEO.lowSphere, p.trim, 0, -0.3, 0, 0.145, 0.1, 0.145)
      .add(GEO.lowSphere, p.shoeColor || dark, 0, -0.43, 0.06, 0.15, 0.1, 0.22);
    const arm = new Merger()
      .add(GEO.arm, p.jersey, 0, -0.5, 0)
      .add(GEO.lowSphere, p.gloveColor || (legend ? p.skin : white), 0, -0.5, 0, 0.12, 0.12, 0.12);
    const out = { body: b.geometry(), leg: leg.geometry(), arm: arm.geometry() };
    beanCache.set(p.id, out);
    return out;
  }
  function makeBean(p, opts = {}) {
    const G = beanGeos(p);
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const body = new THREE.Mesh(G.body, VC_GLOSS);
    body.castShadow = true;
    rig.add(body);
    const num = new THREE.Mesh(GEO.back, numberMat(p.num, p.trim));
    num.position.y = 0.98;
    rig.add(num);
    const limb = (x, y, geo) => {
      const piv = new THREE.Group();
      piv.position.set(x, y, 0);
      const m = new THREE.Mesh(geo, VC_GLOSS);
      m.castShadow = true;
      piv.add(m);
      rig.add(piv);
      return piv;
    };
    const legL = limb(0.2, 0.44, G.leg), legR = limb(-0.2, 0.44, G.leg);
    const armL = limb(0.5, 0.98, G.arm), armR = limb(-0.5, 0.98, G.arm);
    armL.rotation.z = 0.22; armR.rotation.z = -0.22;
    const batPivot = new THREE.Group();
    const bat = makeBat(opts.gold ? GOLD : null, p.batColor || '#c8955a');
    batPivot.add(bat);
    batPivot.position.set(0.05, 0.45, -0.5);
    batPivot.rotation.set(-0.12, 0, 0.75);
    rig.add(batPivot);
    if (opts.noBat) batPivot.visible = false;
    return { root, rig, legL, legR, armL, armR, batPivot, bat, p, phase: Math.random() * 10 };
  }

  function animRun(b, st, dt) {
    const rig = b.rig;
    const k = damp(14, dt);
    if (st.dive) {
      rig.rotation.x = lerp(rig.rotation.x, 1.42, k);
      rig.position.y = lerp(rig.position.y, 0.48, k);
      b.armL.rotation.x = lerp(b.armL.rotation.x, -2.9, k);
      b.armR.rotation.x = lerp(b.armR.rotation.x, -2.9, k);
      b.legL.rotation.x = lerp(b.legL.rotation.x, 0.3, k);
      b.legR.rotation.x = lerp(b.legR.rotation.x, 0.3, k);
      return;
    }
    if (st.stun) {
      rig.rotation.x += dt * 11;
      rig.position.y = 0.8;
      b.armL.rotation.x = -2.6; b.armR.rotation.x = -2.2;
      return;
    }
    rig.rotation.x = lerp(wrapA(rig.rotation.x), st.lean || 0, k);
    b.phase += dt * (6 + 9 * st.speed);
    const ph = b.phase;
    if (st.air) {
      b.legL.rotation.x = lerp(b.legL.rotation.x, -0.7, k);
      b.legR.rotation.x = lerp(b.legR.rotation.x, 0.4, k);
      b.armL.rotation.x = lerp(b.armL.rotation.x, -2.4, k);
      b.armR.rotation.x = lerp(b.armR.rotation.x, -2.4, k);
      rig.position.y = lerp(rig.position.y, 0, k);
    } else {
      const s = st.speed;
      b.legL.rotation.x = Math.sin(ph) * 0.95 * s;
      b.legR.rotation.x = -Math.sin(ph) * 0.95 * s;
      b.armL.rotation.x = -Math.sin(ph) * 0.8 * s;
      b.armR.rotation.x = Math.sin(ph) * 0.8 * s;
      rig.position.y = Math.abs(Math.sin(ph)) * 0.09 * s + (1 - s) * Math.sin(ph * 0.4) * 0.015;
    }
  }

  /* ================================================================ input */
  const keys = new Set();
  const pressed = new Set();
  const PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  function toggleMute() {
    Snd.setMuted(!Snd.muted);
    $('#btn-mute').textContent = Snd.muted ? '🔇' : '🔊';
    $('#btn-mute').setAttribute('aria-label', Snd.muted ? 'Sound off' : 'Sound on');
  }
  $('#btn-mute').addEventListener('click', toggleMute);
  $('#btn-mute').textContent = Snd.muted ? '🔇' : '🔊';
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { toggleMute(); return; }
    Snd.unlock();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (PREVENT.includes(e.code) && mode !== 'menu') e.preventDefault();
    onMenuKey(e);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const edge = (...codes) => {
    let hit = false;
    for (const c of codes) if (pressed.has(c)) { pressed.delete(c); hit = true; }
    return hit;
  };
  const held = (...codes) => codes.some((c) => keys.has(c));
  const touch = { mx: 0, mz: 0, jump: false, dive: false, ability: false, swing: false, ff: false };
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  /* ====================================================== menu / showcase */
  let mode = 'menu';
  let paused = false;
  let world = null;
  const show = (() => {
    const s = new THREE.Scene();
    s.add(skyDome('#2f7bff', '#9fdcff'));
    s.fog = new THREE.Fog('#9fdcff', 20, 60);
    s.add(new THREE.HemisphereLight('#ffffff', '#6a7ad0', 0.9));
    const sun = new THREE.DirectionalLight('#fff2d6', 1.1);
    sun.position.set(3, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    s.add(sun);
    const stage = new Merger()
      .add(GEO.cyl, '#ffd23f', 0, -0.2, 0, 1.1, 0.4, 1.1)
      .add(GEO.cyl, '#ff4d8d', 0, -0.28, 0, 1.3, 0.3, 1.3);
    const ped = stage.mesh(VC_GLOSS);
    s.add(ped);
    const ground = new Merger().add(new THREE.CircleGeometry(40, 48), '#7fd46a', 0, -0.41, 0, 1, 1, 1, -Math.PI / 2, 0, 0);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      ground.add(roundedBox(3, 0.8, 3, 0.35), i % 2 ? '#ffd23f' : '#2ec27e', Math.sin(a) * 14, -0.2, Math.cos(a) * 14 - 6, 1, 1, 1, 0, a, 0, '#ffffff');
    }
    s.add(ground.mesh());
    const balls = [];
    for (let i = 0; i < 20; i++) {
      const b = mesh(GEO.ball, BALL_MAT, rand(-9, 9), rand(-0.5, 6), rand(-12, -3), 0.3, 0.3, 0.3, false);
      b.userData.sp = rand(0.3, 1);
      balls.push(b); s.add(b);
    }
    const gbat = makeBat(GOLD);
    gbat.scale.setScalar(2.2);
    gbat.position.set(0, 1.4, -2.2);
    s.add(gbat);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(4, 4, 1);
    halo.position.set(0, 2.5, -2.4);
    s.add(halo);
    return { scene: s, sun, beans: [], balls, gbat, halo, ped };
  })();
  function setShowBeans(players) {
    for (const b of show.beans) show.scene.remove(b.root);
    show.beans = players.map((p, i) => {
      const b = makeBean(p);
      b.root.position.set(players.length === 1 ? 0 : (i - (players.length - 1) / 2) * 1.5, 0, players.length === 1 ? 0 : -0.3);
      show.scene.add(b.root);
      return b;
    });
    const one = players.length === 1;
    show.ped.visible = one;
    show.gbat.visible = show.halo.visible = !one;
  }
  function updateShow(dt, t) {
    const one = show.beans.length === 1;
    const narrow = W < 820;
    for (const b of show.beans) {
      if (one) {
        b.root.rotation.y = Math.sin(t * 0.7) * 0.6 + 0.35;
        animRun(b, { speed: 0 }, dt);
        b.armR.rotation.x = -0.4 + Math.sin(t * 3) * 0.2;
      } else {
        b.root.rotation.y = Math.sin(t * 1.3 + b.phase) * 0.3;
        animRun(b, { speed: 0.35 }, dt);
        b.root.position.y = Math.abs(Math.sin(t * 4 + b.phase)) * 0.25;
      }
    }
    for (const b of show.balls) {
      b.position.y += dt * b.userData.sp * 0.6;
      if (b.position.y > 7) b.position.y = -1;
      b.rotation.x += dt * b.userData.sp;
    }
    show.gbat.rotation.y = t * 1.4;
    show.gbat.rotation.z = 0.25;
    if (one) {
      camera.position.set(narrow ? 0 : -1.55, narrow ? 1.6 : 1.25, narrow ? 5.2 : 4.4);
      camera.lookAt(narrow ? 0 : -1.55, narrow ? 1.35 : 0.95, 0);
    } else {
      camera.position.set(narrow ? 0 : -2.2, 1.9, narrow ? 9 : 7.2);
      camera.lookAt(narrow ? 0 : -2.2, 1.25, 0);
    }
  }

  /* ================================================================= flow */
  const Flow = { mode: null, picks: [], diff: 'allstar', map: 0, step: 0, tour: null };
  const screens = ['scr-title', 'scr-select', 'scr-maps', 'scr-result', 'scr-pause', 'scr-shop'];
  function showScreen(id) {
    for (const s of screens) $('#' + s).classList.toggle('on', s === id);
    document.body.dataset.screen = id || '';
  }
  function toTitle() {
    mode = 'menu';
    paused = false;
    clearWorld();
    setShowBeans([PLAYER_BY_ID.kaito, PLAYER_BY_ID.moe, PLAYER_BY_ID.nova]);
    showScreen('scr-title');
    setHud(null);
    updateTokens();
  }

  // ---- select screen
  let selEra = 'current';
  let selIdx = 0;
  function selList() { return ROSTER.filter((p) => p.era === selEra); }
  function openSelect() {
    const who = Flow.step;
    const title =
      Flow.mode === 'race' ? 'Pick your runner'
        : who === 0 ? (Flow.mode === 'friend' ? 'Player 1 — pick your slugger' : 'Pick your slugger')
          : Flow.mode === 'friend' ? 'Player 2 — pick your slugger' : 'Pick your CPU opponent';
    $('#sel-title').textContent = title;
    $('#sel-diff').hidden = !(Flow.mode === 'cpu' && who === 1);
    showScreen('scr-select');
    renderSelect();
  }
  function renderSelect() {
    $$('#sel-eras button').forEach((b) => {
      b.classList.toggle('on', b.dataset.era === selEra);
      b.querySelector('small').textContent = ROSTER.filter((p) => p.era === b.dataset.era).length;
    });
    const list = selList();
    selIdx = clamp(selIdx, 0, list.length - 1);
    const taken = Flow.picks[0] && Flow.step === 1 ? Flow.picks[0].id : null;
    $('#sel-grid').innerHTML = list.map((p, i) => `
      <button class="card${i === selIdx ? ' on' : ''}" data-i="${i}" style="--j:${p.jersey};--t:${p.trim}">
        <span class="num">${p.num}</span>
        <span class="nm">${p.name}</span>
        <span class="nk">“${p.nick}”${p.id === taken ? ' · P1' : ''}</span>
      </button>`).join('');
    const p = list[selIdx];
    // Your own pick shows your card, gear and skin; the CPU's and P2's do not.
    const yours = Flow.step === 0;
    const m = yours ? Save.mine(p, { noGear: Flow.mode === 'friend' }) : p;
    const bar = (label, k) => {
      const plus = m[k] - p[k];
      return `<div class="stat"><span>${label}</span><i><b style="width:${Math.min(100, p[k] * 10)}%"></b>${plus ? `<u style="width:${Math.min(100 - p[k] * 10, plus * 10)}%"></u>` : ''}</i><em>${p[k]}${plus ? `<small>+${plus}</small>` : ''}</em></div>`;
    };
    const ab = ABILITIES[p.ability];
    const card = Save.data.cards[p.id];
    $('#sel-info').innerHTML = `
      <h3>${p.name}</h3><div class="nick">“${p.nick}” · #${p.num} · ${ERAS.find((e) => e.id === p.era).label.replace(/s$/, '')}${card ? ` · <span class="owned">${card.holo ? 'Holo card' : 'Card'} owned +${card.holo ? 2 : 1}</span>` : ''}</div>
      ${bar('Power', 'pow')}${bar('Contact', 'con')}${bar('Speed', 'spd')}
      <div class="ab"><b>${ab.name}</b> — ${ab.desc}</div>`;
    const skins = Save.data.skins.owned;
    $('#sel-skin').hidden = !yours || skins.length < 2;
    $('#sel-skin').innerHTML = '<span>Skin</span>' + SKINS.filter((s) => skins.includes(s.id)).map((s) =>
      `<button class="chip-skin${Save.data.skins.on === s.id ? ' on' : ''}" data-skin="${s.id}" style="--c:${s.jersey || p.jersey};--t:${s.trim || p.trim}" title="${s.name}"></button>`).join('');
    $('#sel-go').textContent = `Pick ${p.name.split(' ')[0]}`;
    setShowBeans([m]);
    const on = $('#sel-grid .card.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function confirmPick(p) {
    Snd.pop();
    Flow.picks[Flow.step] = p;
    if (Flow.mode === 'race') { openMaps(); return; }
    if (Flow.step === 0) { Flow.step = 1; openSelect(); return; }
    startDerby();
  }
  $('#sel-eras').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    selEra = b.dataset.era; selIdx = 0; Snd.pop(); renderSelect();
  });
  $('#sel-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.card'); if (!b) return;
    const i = +b.dataset.i;
    if (i === selIdx && e.detail > 1) { confirmPick(selList()[i]); return; }
    selIdx = i; Snd.pop(); renderSelect();
  });
  $('#sel-go').addEventListener('click', () => confirmPick(selList()[selIdx]));
  $('#sel-skin').addEventListener('click', (e) => {
    const b = e.target.closest('[data-skin]'); if (!b) return;
    Save.wearSkin(b.dataset.skin); Snd.pop(); renderSelect();
  });
  $('#sel-shop').addEventListener('click', () => openShop('gear', openSelect));
  $('#sel-rand').addEventListener('click', () => {
    const p = pick(ROSTER);
    selEra = p.era; selIdx = selList().indexOf(p); renderSelect();
  });
  $('#sel-back').addEventListener('click', () => {
    if (Flow.step > 0) { Flow.step--; openSelect(); } else toTitle();
  });
  $$('#sel-diff button').forEach((b) => b.addEventListener('click', () => {
    Flow.diff = b.dataset.d;
    $$('#sel-diff button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  // ---- maps
  function openMaps() {
    showScreen('scr-maps');
    $('#map-grid').innerHTML = MAPS.map((m, i) => {
      const T = MAP_THEMES[m.theme];
      const stars = '★'.repeat(1 + Math.round(m.diff * 4)).padEnd(5, '☆');
      return `<button class="mapc" data-i="${i}" style="--sky:${T.sky};--fl:${T.floor[0]};--ac:${T.accent}">
        <span class="mn">${i + 1}</span><span class="mt">${m.name}</span><span class="ms">${stars}</span></button>`;
    }).join('');
  }
  $('#map-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.mapc'); if (!b) return;
    startPractice(+b.dataset.i);
  });
  $('#map-tour').addEventListener('click', startTournament);
  $('#map-back').addEventListener('click', () => { Flow.step = 0; openSelect(); });

  // ---- title
  $$('#scr-title [data-mode]').forEach((b) => b.addEventListener('click', () => {
    Snd.unlock(); Snd.organ();
    Flow.mode = b.dataset.mode; Flow.picks = []; Flow.step = 0;
    openSelect();
  }));

  // ---- pause / result
  function setPaused(v) {
    if (mode === 'menu') return;
    paused = v;
    showScreen(v ? 'scr-pause' : null);
  }
  $('#pause-resume').addEventListener('click', () => setPaused(false));
  $('#pause-quit').addEventListener('click', toTitle);
  $('#btn-pause').addEventListener('click', () => setPaused(true));
  let resActions = {};
  $('#res-menu').addEventListener('click', toTitle);
  $('#res-again').addEventListener('click', () => resActions.again && resActions.again());
  $('#res-next').addEventListener('click', () => resActions.next && resActions.next());
  $('#btn-skip').addEventListener('click', () => { if (world && world.kind === 'race' && world.state === 'race') endRound(); });

  function onMenuKey(e) {
    const scr = document.body.dataset.screen;
    if (e.code === 'Escape') {
      if (scr === 'scr-pause') setPaused(false);
      else if (mode !== 'menu' && !scr) setPaused(true);
      else if (scr === 'scr-select') $('#sel-back').click();
      else if (scr === 'scr-maps') $('#map-back').click();
      return;
    }
    if (scr === 'scr-select') {
      const n = selList().length;
      if (e.code === 'ArrowRight') { selIdx = (selIdx + 1) % n; renderSelect(); }
      else if (e.code === 'ArrowLeft') { selIdx = (selIdx + n - 1) % n; renderSelect(); }
      else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        const i = ERAS.findIndex((x) => x.id === selEra);
        selEra = ERAS[(i + (e.code === 'ArrowDown' ? 1 : ERAS.length - 1)) % ERAS.length].id;
        selIdx = 0;
        renderSelect();
      } else if (e.code === 'Enter') confirmPick(selList()[selIdx]);
    }
  }

  function setHud(which) {
    $('#hud-derby').hidden = which !== 'derby';
    $('#hud-race').hidden = which !== 'race';
    $('#btn-pause').hidden = !which;
    $('#btn-skip').hidden = true;
    $('#touch-race').hidden = !(which === 'race' && isTouch);
    $('#touch-derby').hidden = !(which === 'derby' && isTouch);
  }
  let bannerT = 0;
  function banner(big, small = '', dur = 1.6, cls = '') {
    const b = $('#banner');
    b.innerHTML = `<div class="big">${big}</div>${small ? `<div class="small">${small}</div>` : ''}`;
    b.className = 'on ' + cls;
    bannerT = dur;
  }
  function tickBanner(dt) {
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) $('#banner').className = '';
    }
  }

  function clearWorld() {
    if (world && world.scene) {
      world.scene.traverse((o) => {
        if (o.geometry && o.userData.own) o.geometry.dispose();
      });
    }
    world = null;
    $('#banner').className = '';
  }
  const own = (m) => { m.userData.own = true; return m; };

  /* ========================================================= HOME RUN DERBY */
  const FENCE_H = 3.0;
  const fenceR = (a) => 100 + 22 * Math.cos(2 * a); // 100 m down the lines, 122 m to center
  const DRAG = 0.0042;
  const OUTS = 7;
  const DIFF = {
    rookie: { st: 0.08, sd: 0.21, label: 'Rookie' },
    allstar: { st: 0.062, sd: 0.17, label: 'All-Star' },
    legend: { st: 0.048, sd: 0.13, label: 'Legend' },
  };

  function buildDerbyScene() {
    const s = new THREE.Scene();
    s.add(skyDome('#3a8cff', '#cbeaff'));
    s.fog = new THREE.Fog('#cbeaff', 190, 480);
    s.add(new THREE.HemisphereLight('#e6f4ff', '#6a9a4a', 0.85));
    const sun = new THREE.DirectionalLight('#fff0d0', 1.1);
    sun.position.set(-18, 30, -10);
    sun.target.position.set(0, 0, 8);
    sun.castShadow = quality > 0;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 26, bottom: -8, near: 1, far: 80 });
    s.add(sun, sun.target);

    const flat = (geo, mat, y) => { const m = own(new THREE.Mesh(geo, mat)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };
    const grassMat = new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 0.9 });
    s.add(flat(new THREE.CircleGeometry(135, 72), grassMat, 0));
    s.add(flat(new THREE.CircleGeometry(600, 32), MAT('#56a84a', { roughness: 1 }), -0.05));
    const dirt = new THREE.MeshStandardMaterial({ map: TEX.dirt, roughness: 1 });
    const dia = flat(new THREE.PlaneGeometry(36, 36), dirt, 0.01);
    dia.rotation.z = Math.PI / 4; dia.position.z = 19.4; s.add(dia);
    const ig = flat(new THREE.PlaneGeometry(24, 24), grassMat, 0.02);
    ig.rotation.z = Math.PI / 4; ig.position.z = 19.4; s.add(ig);
    s.add(flat(new THREE.CircleGeometry(4.2, 36), dirt, 0.03));

    // Everything solid-coloured and still goes into one mesh.
    const M = new Merger();
    M.add(new THREE.CylinderGeometry(1.4, 2.9, 0.25, 32), '#d99a5e', 0, 0.125, 18.4);
    M.add(GEO.box, '#ffffff', 0, 0.26, 18.4, 0.6, 0.04, 0.15);
    for (const [x, z] of [[-19.4, 19.4], [0, 38.8], [19.4, 19.4]]) M.add(roundedBox(0.5, 0.12, 0.5, 0.05), '#ffffff', x, 0.06, z, 1, 1, 1, 0, Math.PI / 4, 0);
    const plate = new THREE.Shape();
    plate.moveTo(-0.216, 0.2); plate.lineTo(0.216, 0.2); plate.lineTo(0.216, 0); plate.lineTo(0, -0.216); plate.lineTo(-0.216, 0); plate.closePath();
    M.add(new THREE.ShapeGeometry(plate), '#ffffff', 0, 0.04, 0, 1, 1, 1, -Math.PI / 2, 0, Math.PI);
    for (const sx of [-1, 1]) {
      for (const [x, z, w, d] of [[0.95, 0, 0.05, 1.8], [0.35, 0, 0.05, 1.8], [0.65, 0.9, 0.65, 0.05], [0.65, -0.9, 0.65, 0.05]]) {
        M.add(GEO.box, '#ffffff', sx * x, 0.04, z, w, 0.01, d);
      }
      M.add(GEO.box, '#ffffff', sx * 50 * Math.SQRT1_2, 0.04, 50 * Math.SQRT1_2, 0.1, 0.01, 100, 0, sx * Math.PI / 4, 0);
      M.add(GEO.cyl, '#ffd23f', sx * 100 * Math.SQRT1_2, 9, 100 * Math.SQRT1_2, 0.25, 18, 0.25);
    }
    const N = 48;
    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 4 + (i / N) * (Math.PI / 2), a1 = -Math.PI / 4 + ((i + 1) / N) * (Math.PI / 2);
      const r0 = fenceR(a0), r1 = fenceR(a1);
      const p0 = V(r0 * Math.sin(a0), 0, r0 * Math.cos(a0)), p1 = V(r1 * Math.sin(a1), 0, r1 * Math.cos(a1));
      const dx = p1.x - p0.x, dz = p1.z - p0.z, L = Math.hypot(dx, dz) + 0.05;
      const rot = Math.atan2(-dz, dx);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      M.add(GEO.box, i % 2 ? '#1f7a4a' : '#23864f', mid.x, FENCE_H / 2, mid.z, L, FENCE_H, 0.5, 0, rot, 0);
      M.add(GEO.box, '#ffd23f', mid.x, FENCE_H + 0.05, mid.z, L, 0.14, 0.58, 0, rot, 0);
      const am = (a0 + a1) / 2, rm = (r0 + r1) / 2 - 2.5;
      M.add(GEO.box, '#c98a50', rm * Math.sin(am), 0.012, rm * Math.cos(am), L + 0.3, 0.02, 5, 0, rot, 0);
    }
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const r = 180;
      M.add(GEO.cyl, '#8a93a6', r * Math.sin(a), 30, r * Math.cos(a), 0.8, 60, 0.8);
    }
    M.add(roundedBox(42, 17.5, 1, 0.5), '#1b2238', 0, 50, 176.6);
    for (const sx of [-1, 1]) M.add(GEO.box, '#2b3350', sx * 14, 20, 177, 2, 42, 2);
    const field = own(M.mesh(VC, false));
    s.add(field);
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const r = 180;
      const lamp = mesh(GEO.box, MAT('#ffffff', { emissive: '#ffffee', emissiveIntensity: 1 }), r * Math.sin(a), 61, r * Math.cos(a), 10, 5, 1, false);
      lamp.lookAt(0, 0, 0); s.add(lamp);
    }
    // Stands: five tiers of crowd.
    const crowdMat = new THREE.MeshStandardMaterial({ map: TEX.crowd, side: THREE.DoubleSide, roughness: 1 });
    const ledgeMat = new THREE.MeshStandardMaterial({ color: lin('#2e3a88'), side: THREE.DoubleSide });
    for (let k = 0; k < 5; k++) {
      const r = 130 + k * 9;
      const m = own(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 7, 64, 1, true, -Math.PI / 4 - 0.28, Math.PI / 2 + 0.56), crowdMat));
      m.position.y = 3.5 + k * 6;
      s.add(m);
      const ledge = own(new THREE.Mesh(new THREE.CylinderGeometry(r + 4.5, r + 4.5, 0.6, 64, 1, true, -Math.PI / 4 - 0.28, Math.PI / 2 + 0.56), ledgeMat));
      ledge.position.y = 7 + k * 6;
      s.add(ledge);
    }

    // Scoreboard.
    const boardTex = canvasTex(768, 300, () => {});
    const board = own(new THREE.Mesh(new THREE.PlaneGeometry(40, 15.6), new THREE.MeshBasicMaterial({ map: boardTex })));
    board.position.set(0, 50, 176);
    board.rotation.y = Math.PI;
    s.add(board);

    // Strike zone, the PCI, the ball.
    const zone = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.44, 0.58)),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthTest: false }));
    zone.position.set(0, 0.8, 0);
    zone.renderOrder = 5;
    s.add(zone);
    const pci = new THREE.Group();
    const pciMat = new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
    pci.add(new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 40), pciMat), new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), pciMat));
    for (const [x, y, w, h] of [[0.3, 0, 0.12, 0.018], [-0.3, 0, 0.12, 0.018], [0, 0.3, 0.018, 0.12], [0, -0.3, 0.018, 0.12]]) {
      const m = new THREE.Mesh(GEO.plane, pciMat); m.position.set(x, y, 0); m.scale.set(w, h, 1); pci.add(m);
    }
    pci.children.forEach((c) => (c.renderOrder = 10));
    pci.rotation.y = Math.PI;
    s.add(pci);
    const ballMat = new THREE.MeshStandardMaterial({ map: TEX.ball, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.25 });
    const ball = mesh(GEO.ball, ballMat, 0, -5, 0, 0.075, 0.075, 0.075);
    s.add(ball);
    const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ballGlow.scale.set(8, 8, 1);
    ball.add(ballGlow);
    const shadowBlob = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false }));
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.scale.set(0.9, 0.9, 1);
    s.add(shadowBlob);
    const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 });
    const trail = [];
    for (let i = 0; i < 12; i++) {
      const t = mesh(GEO.lowSphere, trailMat, 0, -9, 0, 0.06 * (1 - i / 14), 0.06 * (1 - i / 14), 0.06 * (1 - i / 14), false);
      trail.push(t); s.add(t);
    }
    return { scene: s, sun, board, boardTex, zone, pci, ball, ballMat, ballGlow, shadowBlob, trail };
  }

  function startDerby() {
    clearWorld();
    Snd.unlock();
    const sc = buildDerbyScene();
    const coach = { id: 'coach', name: 'Coach', nick: 'BP', era: 'former', num: 0, jersey: '#8a93a6', trim: '#1b2238', cap: '#1b2238', skin: '#e0ac86', pow: 5, con: 5, spd: 5 };
    const pitcher = makeBean(coach, { noBat: true });
    pitcher.root.position.set(0, 0.25, 18.4);
    pitcher.root.rotation.y = Math.PI;
    sc.scene.add(pitcher.root);
    // Your gear only counts against the CPU; your skin shows everywhere.
    const bats = Flow.picks.map((p, i) => ({
      p: i === 0 ? Save.mine(p, { noGear: Flow.mode === 'friend' }) : p,
      cpu: Flow.mode === 'cpu' && i === 1, hr: 0, outs: 0, longest: 0, golden: Math.floor(rand(1, 9)), pitches: 0,
    }));
    world = Object.assign(sc, {
      kind: 'derby', pitcher, bats, cur: 0, state: 'intro', t: 0, sudden: 0,
      batter: null, pciPos: V(0, 0.8, 0), pciGoal: null, pitch: null, flight: null, swingT: -1,
      camPos: V(-0.35, 2.15, -4.9), camLook: V(0, 1.05, 10),
    });
    world.lookCur = world.camLook.clone();
    camera.position.copy(world.camPos);
    camera.lookAt(world.camLook);
    mode = 'derby';
    paused = false;
    showScreen(null);
    setHud('derby');
    resActions = { again: startDerby };
    beginBatter(0);
  }

  function beginBatter(i) {
    const w = world;
    w.cur = i;
    if (w.batter) w.scene.remove(w.batter.root);
    const B = w.bats[i];
    w.batter = makeBean(B.p);
    w.batter.root.position.set(0.85, 0, 0.05);
    w.batter.root.rotation.y = -Math.PI / 2;
    w.scene.add(w.batter.root);
    poseBatter(w.batter, -1);
    B.outs = 0;
    w.state = 'intro'; w.t = 0;
    const who = B.cpu ? `CPU · ${DIFF[Flow.diff].label}` : Flow.mode === 'friend' ? `Player ${i + 1}` : 'You';
    const lim = w.sudden ? '3 outs — sudden death' : `${OUTS} outs`;
    banner(`${B.p.name}`, `${who} · “${B.p.nick}” · ${lim}`, 2.2);
    w.pciPos.set(0, 0.8, 0);
    drawBoard();
    updateDerbyHud();
  }

  function poseBatter(b, s) {
    // s < 0: in the stance. 0..1: the swing, handle through the zone.
    const bp = b.batPivot;
    bp.rotation.order = 'YXZ';
    bp.position.set(0.0, 1.0, 0.18);
    b.armL.rotation.set(-1.25, 0, -0.3);
    b.armR.rotation.set(-1.05, 0, 0.3);
    if (s < 0) {
      bp.rotation.set(0.35, 0.3, 0.55);
      b.rig.rotation.y = 0.15;
      b.legL.rotation.x = 0.1; b.legR.rotation.x = -0.1;
    } else {
      const e = 1 - Math.pow(1 - clamp(s, 0, 1), 3);
      bp.rotation.set(lerp(0.35, 0.05, e), lerp(0.3, -3.6, e), lerp(0.55, Math.PI / 2 - 0.05, Math.min(1, e * 3)));
      b.rig.rotation.y = lerp(0.15, -1.1, e);
      b.legL.rotation.x = lerp(0.1, -0.35, e);
    }
  }
  function posePitcher(b, t) {
    // t: seconds into the windup; release at 0.9.
    const a = b.armR;
    if (t < 0) { a.rotation.set(0, 0, -0.22); b.armL.rotation.set(0, 0, 0.22); b.legL.rotation.x = 0; b.rig.rotation.x = 0; return; }
    if (t < 0.55) {
      const k = t / 0.55;
      a.rotation.x = lerp(0, 1.4, k); b.legL.rotation.x = lerp(0, -1.3, k); b.armL.rotation.x = lerp(0, -1.4, k);
    } else if (t < 0.9) {
      const k = (t - 0.55) / 0.35;
      a.rotation.x = lerp(1.4, -2.6, k); b.legL.rotation.x = lerp(-1.3, 0.2, k); b.rig.rotation.x = lerp(0, 0.35, k);
    } else {
      const k = Math.min(1, (t - 0.9) / 0.3);
      a.rotation.x = lerp(-2.6, 0.9, k); b.rig.rotation.x = lerp(0.35, 0.1, k); b.armL.rotation.x = lerp(-1.4, 0.3, k);
    }
  }

  function newPitch() {
    const w = world, B = w.bats[w.cur];
    B.pitches++;
    const type = pick(['fast', 'fast', 'fast', 'change', 'curve']);
    const speed = type === 'fast' ? rand(29, 33) : type === 'change' ? rand(23, 25.5) : rand(25, 27.5);
    const inZone = Math.random() < 0.82;
    let tx = rand(-0.2, 0.2), ty = rand(0.56, 1.04);
    if (!inZone) {
      if (Math.random() < 0.5) tx = pick([-1, 1]) * rand(0.32, 0.5);
      else ty = pick([rand(0.25, 0.42), rand(1.18, 1.4)]);
    }
    const from = V(-0.35, 1.85, 17.3);
    const to = V(tx, ty, 0);
    const T = from.distanceTo(to) / speed;
    const brk = type === 'curve' ? V(rand(0.35, 0.6) * pick([-1, 1]), 0.35, 0) : type === 'change' ? V(0, 0.25, 0) : V(0, 0.12, 0);
    const golden = B.pitches === B.golden && !w.sudden;
    w.pitch = { from, to, T, t: 0, brk, speed, type, inZone, golden, swung: false, hit: false, cpuSwing: null, v: to.clone().sub(from).divideScalar(T) };
    w.ballMat.color.set(golden ? '#ffd23f' : '#ffffff');
    w.ballMat.emissive.set(golden ? '#ffb000' : '#ffffff');
    w.ballGlow.visible = golden;
    if (golden) banner('GOLDEN PITCH', 'A homer off this one counts twice', 1.2, 'gold');
    if (B.cpu) {
      const d = DIFF[Flow.diff];
      const swing = inZone ? Math.random() < 0.95 : Math.random() < 0.18;
      if (swing) {
        const skill = 1 - (B.p.con - 5) * 0.03;
        w.pitch.cpuSwing = T + gauss() * d.st * skill;
        w.pciGoal = V(tx + gauss() * d.sd * skill, ty + gauss() * d.sd * skill, 0);
      } else w.pciGoal = V(tx * 0.3, 0.8, 0);
    }
  }
  function pitchPos(pt, t, out) {
    const s = t / pt.T;
    if (s <= 1) {
      out.lerpVectors(pt.from, pt.to, s);
      const bulge = 4 * s * (1 - s);
      out.x += pt.brk.x * bulge * 0.5;
      out.y += pt.brk.y * bulge;
    } else {
      out.copy(pt.to).addScaledVector(pt.v, t - pt.T);
      out.y = Math.max(0.05, out.y - 4.9 * (t - pt.T) ** 2);
    }
    return out;
  }

  function swing(atT) {
    const w = world, pt = w.pitch, B = w.bats[w.cur];
    if (!pt || pt.swung) return;
    pt.swung = true;
    w.swingT = 0;
    const err = atT - pt.T;
    const p = B.p;
    const win = 0.07 + p.con * 0.005;
    const reach = 0.2 + p.con * 0.012;
    const bx = w.pciPos.x, by = w.pciPos.y;
    const d = Math.hypot(bx - pt.to.x, by - pt.to.y);
    if (Math.abs(err) > win || d > reach) { Snd.whiff(); return; }
    const tq = 1 - Math.abs(err) / win;
    const dq = 1 - d / reach;
    const q = clamp(0.15 + 0.45 * Math.sqrt(tq) + 0.4 * Math.sqrt(dq), 0, 1);
    const ev = 27 + 17 * q + p.pow * 0.85 + rand(-1, 1);
    const la = clamp(27 + ((pt.to.y - by) / reach) * 42 + (1 - q) * rand(-14, 14), -12, 72) * (Math.PI / 180);
    const spray = clamp(-(err / win) * 42 + (pt.to.x - bx) * 12 + rand(-4, 4), -70, 70) * (Math.PI / 180);
    const pos = pitchPos(pt, atT, V());
    const vel = V(Math.sin(spray) * Math.cos(la), Math.sin(la), Math.cos(spray) * Math.cos(la)).multiplyScalar(ev);
    pt.hit = true;
    Snd.crack(q);
    w.flight = { pos, vel, t: 0, done: false, result: null, crossed: false, q, hrDist: 0, dir: V(vel.x, 0, vel.z).normalize() };
    w.state = 'flight';
  }

  function stepBall(p, v, dt) {
    const s = v.length();
    v.x -= DRAG * s * v.x * dt;
    v.z -= DRAG * s * v.z * dt;
    v.y -= (9.8 + DRAG * s * v.y) * dt;
    p.addScaledVector(v, dt);
  }
  function simulateLanding(pos, vel) {
    const p = pos.clone(), v = vel.clone();
    for (let i = 0; i < 4000 && p.y > 0; i++) stepBall(p, v, 1 / 240);
    return Math.hypot(p.x, p.z);
  }

  function derbyStep(dt) {
    const w = world;
    const B = w.bats[w.cur];
    w.t += dt;
    const human = !B.cpu;

    if (human) {
      const sp = 1.3 * dt;
      if (held('ArrowLeft', 'KeyA')) w.pciPos.x += sp;
      if (held('ArrowRight', 'KeyD')) w.pciPos.x -= sp;
      if (held('ArrowUp', 'KeyW')) w.pciPos.y += sp;
      if (held('ArrowDown', 'KeyS')) w.pciPos.y -= sp;
    } else if (w.pciGoal) {
      w.pciPos.lerp(w.pciGoal, damp(6, dt));
    }
    w.pciPos.x = clamp(w.pciPos.x, -0.7, 0.7);
    w.pciPos.y = clamp(w.pciPos.y, 0.15, 1.6);
    w.pci.position.copy(w.pciPos);
    const wantSwing = human && (edge('Space', 'Enter', 'Mouse') || touch.swing);
    touch.swing = false;

    if (w.swingT >= 0) {
      w.swingT += dt / 0.28;
      poseBatter(w.batter, Math.min(1, w.swingT));
      if (w.swingT > 1.6) { w.swingT = -1; poseBatter(w.batter, -1); }
    }

    switch (w.state) {
      case 'intro':
        posePitcher(w.pitcher, -1);
        if (w.t > 2.2) { w.state = 'wait'; w.t = 0; }
        break;
      case 'wait':
        w.ball.position.set(0, -5, 0);
        if (w.t > 0.5) { w.state = 'windup'; w.t = 0; newPitch(); }
        break;
      case 'windup':
        posePitcher(w.pitcher, w.t);
        w.ball.position.set(-0.4, 1.2, 18.2);
        if (w.t >= 0.9) { w.state = 'pitch'; w.t = 0; Snd.whoosh(); }
        break;
      case 'pitch': {
        const pt = w.pitch;
        pt.t += dt;
        posePitcher(w.pitcher, 0.9 + pt.t);
        pitchPos(pt, pt.t, w.ball.position);
        w.ball.rotation.x += dt * 30;
        if (wantSwing) swing(pt.t);
        else if (!human && pt.cpuSwing !== null && !pt.swung && pt.t >= pt.cpuSwing) swing(pt.t);
        if (w.state !== 'pitch') break;
        if (pt.t > pt.T + 0.05 && !pt.mitt) { pt.mitt = true; Snd.mitt(); }
        if (pt.t > pt.T + 0.6) {
          if (pt.swung) {
            B.outs++;
            banner('STRIKE', `${outsLeft()} left`, 0.9, 'bad');
          } else banner(pt.inZone ? 'Taken' : 'Ball', 'No swing, no out', 0.8);
          endPitch(false);
        }
        break;
      }
      case 'flight':
        flightStep(dt);
        break;
      case 'after':
        if (w.flight) flightStep(dt);
        if (w.t > 1.2) nextPitchOrBatter();
        break;
    }
    if (w.state === 'flight' || (w.state === 'after' && w.flight)) {
      const f = w.flight;
      const goalPos = f.pos.z < 20 ? V(f.pos.x * 0.3, 7, -9) : V(f.pos.x - f.dir.x * 26, Math.max(6, f.pos.y * 0.55 + 6), f.pos.z - f.dir.z * 26);
      camera.position.lerp(goalPos, damp(2.8, dt));
      w.lookCur.lerp(f.pos, damp(8, dt));
    } else {
      camera.position.lerp(w.camPos, damp(5, dt));
      w.lookCur.lerp(w.camLook, damp(6, dt));
    }
    camera.lookAt(w.lookCur);
    w.pci.visible = w.zone.visible = w.state !== 'flight' && w.state !== 'after';
  }
  const outsLeft = () => {
    const w = world, B = w.bats[w.cur];
    const n = (w.sudden ? 3 : OUTS) - B.outs;
    return `${n} out${n === 1 ? '' : 's'}`;
  };

  function flightStep(dt) {
    const w = world, f = w.flight;
    f.t += dt;
    if (!f.done) {
      for (let i = 0; i < 4; i++) {
        stepBall(f.pos, f.vel, dt / 4);
        const r = Math.hypot(f.pos.x, f.pos.z);
        const a = Math.atan2(f.pos.x, f.pos.z);
        const fair = Math.abs(a) <= Math.PI / 4;
        if (!f.crossed && fair && r >= fenceR(a) - 0.3) {
          f.crossed = true;
          if (f.pos.y > FENCE_H) {
            f.result = 'hr';
            f.hrDist = simulateLanding(f.pos, f.vel);
          } else {
            f.result = 'wall';
            f.vel.x *= -0.3; f.vel.z *= -0.3;
          }
        }
        if (f.pos.y <= 0.04) {
          if (!f.result) {
            f.result = r < 4 ? 'dribbler' : !fair ? 'foul' : f.t > 1.2 ? 'fly' : 'ground';
          }
          f.pos.y = 0.04;
          f.vel.y *= -0.35; f.vel.x *= 0.55; f.vel.z *= 0.55;
          if (Math.abs(f.vel.y) < 1) f.done = true;
        }
        if (r > 190) f.done = true;
      }
      if (f.result && !f.announced && (f.result !== 'hr' || f.t > 0.4)) {
        f.announced = true;
        announce(f);
      }
    }
    w.ball.position.copy(f.pos);
    w.shadowBlob.position.set(f.pos.x, 0.06, f.pos.z);
    w.shadowBlob.visible = f.pos.y > 0.2;
    for (let i = w.trail.length - 1; i > 0; i--) w.trail[i].position.copy(w.trail[i - 1].position);
    w.trail[0].position.copy(f.pos);
    if (w.state === 'flight' && ((f.done && f.t > 1.2) || f.t > 7)) {
      if (!f.announced) { f.result = f.result || 'fly'; announce(f); f.announced = true; }
      endPitch(true);
    }
  }
  function announce(f) {
    const w = world, B = w.bats[w.cur];
    const ft = Math.round(f.hrDist * 3.281);
    if (f.result === 'hr') {
      const n = w.pitch.golden ? 2 : 1;
      B.hr += n;
      B.longest = Math.max(B.longest, ft);
      banner(n === 2 ? 'GOLDEN HOMER! +2' : ft >= 450 ? 'MOONSHOT!' : 'HOME RUN!', `${ft} ft · ${B.hr} total`, 1.8, n === 2 ? 'gold' : 'hr');
      Snd.cheer(ft > 440 ? 3.5 : 2.4, ft > 440 ? 0.4 : 0.3);
    } else {
      B.outs++;
      const label = { wall: 'Off the wall', foul: 'Foul ball', fly: 'Fly out', ground: 'Ground out', dribbler: 'Dribbler' }[f.result];
      banner(label, `${outsLeft()} left`, 1.1, 'bad');
      if (f.result === 'wall') Snd.groan();
    }
    drawBoard();
    updateDerbyHud();
  }
  function endPitch(hadFlight) {
    const w = world;
    w.state = 'after'; w.t = 0;
    if (!hadFlight) w.flight = null;
    w.pciGoal = null;
    drawBoard();
    updateDerbyHud();
  }
  function nextPitchOrBatter() {
    const w = world, B = w.bats[w.cur];
    w.flight = null;
    for (const t of w.trail) t.position.set(0, -9, 0);
    w.shadowBlob.visible = false;
    w.ball.position.set(0, -5, 0);
    camera.position.copy(w.camPos);
    w.lookCur.copy(w.camLook);
    const lim = w.sudden ? 3 : OUTS;
    if (B.outs < lim) { w.state = 'wait'; w.t = 0; return; }
    if (w.cur + 1 < w.bats.length) {
      beginBatter(w.cur + 1);
      if (Flow.mode === 'friend') banner('Switch!', `Hand it to Player ${w.cur + 1}`, 2.2);
      return;
    }
    const [a, b] = w.bats;
    if (a.hr === b.hr) {
      w.sudden++;
      for (const x of w.bats) x.golden = -1;
      w.state = 'hold';
      banner('TIED!', 'Sudden death — three outs each', 2.2);
      setTimeout(() => world === w && beginBatter(0), 1800);
      return;
    }
    finishDerby();
  }
  function finishDerby() {
    const w = world;
    w.state = 'done';
    const [a, b] = w.bats;
    const winner = a.hr > b.hr ? a : b;
    const youWon = Flow.mode === 'friend' ? true : winner === a;
    const title = Flow.mode === 'friend' ? `Player ${w.bats.indexOf(winner) + 1} wins!` : youWon ? 'You win the Derby!' : 'The CPU takes it';
    (youWon ? Snd.win : Snd.lose)();
    if (youWon) Snd.cheer(3, 0.35);
    let earned;
    if (Flow.mode === 'cpu') {
      earned = ((youWon ? REWARDS.derbyWin : REWARDS.derbyLoss) + a.hr * REWARDS.perHomer) * REWARDS.diffMul[Flow.diff];
    } else {
      earned = 15 + (a.hr + b.hr) * 2;
    }
    resActions = { again: startDerby };
    showResult(title, `${winner.p.name} · ${winner.hr} home runs`, w.bats.map((x, i) => ({
      name: x.p.name, label: Flow.mode === 'friend' ? `P${i + 1}` : x.cpu ? 'CPU' : 'You',
      val: `${x.hr} HR`, sub: x.longest ? `longest ${x.longest} ft` : 'no homers', win: x === winner,
    })), { again: 'Rematch', tokens: Save.award(earned) });
  }

  function drawBoard() {
    const w = world;
    const c = w.boardTex.canvasEl, g = c.getContext('2d');
    g.fillStyle = '#0c1226'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffd23f';
    g.font = 'bold 44px "Lilita One", Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText(w.sudden ? 'SUDDEN DEATH' : 'HOME RUN DERBY', c.width / 2, 52);
    w.bats.forEach((B, i) => {
      const y = 120 + i * 80;
      g.fillStyle = i === w.cur ? '#ffffff' : '#8fa0c8';
      g.textAlign = 'left';
      g.font = 'bold 46px "Lilita One", Impact, sans-serif';
      g.fillText(B.p.name.toUpperCase(), 30, y + 20);
      g.textAlign = 'right';
      g.fillStyle = '#ffd23f';
      g.fillText(String(B.hr), c.width - 30, y + 20);
      if (i === w.cur) {
        const lim = w.sudden ? 3 : OUTS;
        for (let k = 0; k < lim; k++) {
          g.fillStyle = k < B.outs ? '#ff4d6d' : '#2c3a66';
          g.beginPath(); g.arc(470 + k * 26, y + 4, 9, 0, TAU); g.fill();
        }
      }
    });
    w.boardTex.needsUpdate = true;
  }
  function updateDerbyHud() {
    const w = world;
    const lim = w.sudden ? 3 : OUTS;
    $('#hd-cards').innerHTML = w.bats.map((B, i) => `
      <div class="hcard${i === w.cur ? ' on' : ''}" style="--j:${B.p.jersey}">
        <div class="hn">${Flow.mode === 'friend' ? 'P' + (i + 1) : B.cpu ? 'CPU' : 'YOU'} · ${B.p.name}</div>
        <div class="hr">${B.hr}<small> HR</small></div>
        <div class="outs">${Array.from({ length: lim }, (_, k) => `<i class="${i === w.cur && k < B.outs ? 'x' : ''}"></i>`).join('')}</div>
      </div>`).join('');
    const B = w.bats[w.cur];
    $('#hd-help').textContent = B.cpu
      ? (isTouch ? 'CPU batting · hold ⏩ to fast-forward' : 'CPU batting · hold F to fast-forward')
      : isTouch ? 'Drag to aim · tap SWING when the ball arrives'
        : 'Aim with the mouse or arrows · Click or Space to swing';
    $('#hd-ff').hidden = !(B.cpu && isTouch);
  }

  // Mouse aims the PCI by projecting onto the plate plane.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const aimCam = new THREE.PerspectiveCamera();
  canvas.addEventListener('mousemove', (e) => {
    if (mode !== 'derby' || !world || world.bats[world.cur].cpu) return;
    if (!['windup', 'pitch', 'wait', 'intro'].includes(world.state)) return;
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    // Aim with the resting camera, not wherever it is mid-glide.
    aimCam.copy(camera);
    aimCam.position.copy(world.camPos); aimCam.lookAt(world.camLook); aimCam.updateMatrixWorld();
    ray.setFromCamera(ndc, aimCam);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (Math.abs(d.z) < 1e-4) return;
    const t = -o.z / d.z;
    world.pciPos.x = o.x + d.x * t;
    world.pciPos.y = o.y + d.y * t;
  });
  canvas.addEventListener('mousedown', (e) => {
    Snd.unlock();
    if (mode === 'derby' && e.button === 0) pressed.add('Mouse');
  });

  /* ======================================================= GOLDEN BAT RACE */
  const LANE = 12;
  const STEP_UP = 0.45;
  const GRAV = 26;
  const JUMP_V = 10.5;
  const RAD = 0.4;
  const SURVIVE_T = 60;

  // ---- course building
  function courseKit(C, rng) {
    const T = C.T;
    let mg = new Merger();
    C.flush = () => {
      if (mg.count) C.group.add(own(mg.mesh()));
      mg = new Merger();
    };
    C.mg = () => mg;
    C.solid = (cx, top, cz, sx, sy, sz, color, extra = {}) => {
      const s = Object.assign({
        min: V(cx - sx / 2, top - sy, cz - sz / 2), max: V(cx + sx / 2, top, cz + sz / 2),
        cx() { return (this.min.x + this.max.x) / 2; },
      }, extra);
      const r = extra.r !== undefined ? extra.r : 0.3;
      if (extra.mat || extra.move) {
        const m = own(new THREE.Mesh(extra.mat ? GEO.box : roundedBox(sx, sy, sz, r), extra.mat || MAT(color)));
        if (extra.mat) m.scale.set(sx, sy, sz);
        m.position.set(cx, top - sy / 2, cz);
        m.castShadow = m.receiveShadow = true;
        C.group.add(m);
        s.mesh = m;
      } else if (!extra.hidden) {
        mg.add(roundedBox(sx, sy, sz, r), color, cx, top - sy / 2, cz, 1, 1, 1, 0, 0, 0, extra.side || shade(color, 0.78));
      }
      C.solids.push(s);
      return s;
    };
    C.deco = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, side = null) => mg.add(geo, color, x, y, z, sx, sy, sz, rx, ry, rz, side);
    C.floor = (z0, len, y, w = LANE, x = 0) => {
      for (let t = 0; t < len - 0.01; t += 4) {
        const l = Math.min(4, len - t);
        C.solid(x, y, z0 + t + l / 2, w, 1.2, l, T.floor[C.tile++ % 2], { side: '#ffffff' });
      }
      C.deco(roundedBox(w + 0.5, 1.4, len + 0.2, 0.45), T.edge, x, y - 1.3, z0 + len / 2);
    };
    return C;
  }

  function buildCourse(mi, opts) {
    const M = MAPS[mi], T = MAP_THEMES[M.theme], d = M.diff;
    const rng = mulberry32(9001 + mi * 7919);
    const rr = (a, b) => a + (b - a) * rng();
    const rpick = (a) => a[Math.floor(rng() * a.length)];
    const C = courseKit({
      M, T, d, solids: [], movers: [], sweeps: [], pends: [], spawners: [], rollers: [], machines: [], balls: [],
      wps: [], cps: [], group: new THREE.Group(), time: 0, tile: 0, finish: null, gateZ: null,
    }, rng);
    const { solid, deco, floor } = C;
    const cp = (z, y) => C.cps.push({ z, y });
    const wp = (x, z, o = {}) => C.wps.push(Object.assign({ x, z }, o));
    const hazard = (g) => { C.group.add(g); return g; };

    const SEG = {
      start(z, y) {
        floor(z, 16, y, LANE + 2);
        for (const s of [-1, 1]) deco(GEO.cyl, T.accent, s * 7.4, y + 3, z + 15, 0.35, 6, 0.35);
        const sign = labelSprite(M.name.toUpperCase(), '#ffffff', 'rgba(0,0,0,0.45)');
        sign.position.set(0, y + 6.3, z + 15); sign.scale.set(9, 2.25, 1);
        C.group.add(sign);
        cp(z + 3, y);
        return { z: z + 16, y };
      },
      run(z, y) {
        const len = Math.round(rr(9, 13));
        floor(z, len, y);
        for (const s of [-1, 1]) if (rng() < 0.7) deco(GEO.sphere, '#ffffff', s * 5.2, y + 0.5, z + len / 2, 0.5, 0.5, 0.5);
        cp(z + 1, y);
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      stones(z, y) {
        floor(z, 3, y); cp(z + 1, y);
        let zz = z + 3;
        const rows = 4 + Math.round(d * 3);
        const size = lerp(2.6, 2.0, d);
        // Lay one path that is always a makeable jump from the last stone,
        // then scatter decoys around it.
        let px = 0;
        for (let r = 0; r < rows; r++) {
          zz += rr(1.8, 2.3 + d * 1.1);
          px = clamp(px + rr(-3.4, 3.4), -4.2, 4.2);
          const xs = [px];
          for (const sx of [-4.2, 0, 4.2]) {
            if (Math.abs(sx - px) > size + 0.9 && rng() < 0.7 - d * 0.3) xs.push(sx + rr(-0.4, 0.4));
          }
          for (const x of xs) solid(x, y, zz + size / 2, size, 0.6, size, '#fbfaf5', { side: '#e0b27a', r: 0.22 });
          wp(px, zz + size / 2, { tight: true });
          zz += size;
        }
        zz += rr(1.8, 2.6);
        floor(zz, 4, y);
        wp(0, zz + 1);
        return { z: zz + 4, y };
      },
      sweep(z, y, high) {
        const two = d > 0.45 && !high;
        const len = two ? 22 : 16;
        floor(z, len, y); cp(z + 1, y);
        const at = two ? [z + 6, z + 15] : [z + len / 2];
        at.forEach((cz, i) => {
          const barY = y + (high ? 1.3 : 0.45);
          const R = 6.6;
          deco(GEO.cyl, T.accent, 0, (high ? y + 1.0 : barY), cz, 0.6, high ? 2.0 : 1.2, 0.6);
          const g = new THREE.Group();
          g.position.set(0, barY, cz);
          for (const s of [-1, 1]) {
            const bat = makeBat(null, '#c07a3f');
            bat.scale.set(2.6, R, 2.6);
            bat.rotation.x = s * Math.PI / 2;
            g.add(bat);
          }
          hazard(g);
          const w = (1.3 + d * 1.3) * (i % 2 ? -1 : 1) * (rng() < 0.5 ? 1 : -1);
          C.sweeps.push({ g, c: V(0, barY, cz), R, w, w0: w, ang: rr(0, TAU), high });
        });
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      highbar(z, y) { return SEG.sweep(z, y, true); },
      pendulum(z, y) {
        const len = 22;
        floor(z, len, y); cp(z + 1, y);
        const n = d > 0.5 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const pz = z + 4 + (i * (len - 7)) / (n - 1);
          const pivot = V(0, y + 9, pz);
          const g = new THREE.Group();
          g.position.copy(pivot);
          g.add(mesh(GEO.cyl, MAT('#5a5f70'), 0, -4, 0, 0.1, 8, 0.1, false));
          const head = makeBat(null, '#d69a5a');
          head.scale.set(9, 2.6, 9);
          head.rotation.x = Math.PI / 2;
          head.position.set(0, -8.2, -1.3);
          g.add(head);
          hazard(g);
          deco(roundedBox(12, 0.4, 0.4, 0.18), T.accent, 0, y + 9.1, pz);
          for (const s of [-1, 1]) deco(GEO.cyl, T.accent, s * 6, y + 4.5, pz, 0.22, 9, 0.22);
          C.pends.push({ g, pivot, L: 8.2, A: 0.95, w: 1.5 + d * 1.1, ph: i * 1.7 + rr(0, 1), bob: V(), vx: 0 });
        }
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      rollers(z, y) {
        const len = 26;
        floor(z, len, y); cp(z + 1, y);
        for (const s of [-1, 1]) solid(s * (LANE / 2 + 0.2), y + 0.8, z + len / 2, 0.4, 0.8, len, T.accent, { r: 0.18 });
        deco(roundedBox(LANE + 1, 5, 1.6, 0.5), '#3a4a8f', 0, y + 2.5, z + len + 0.8);
        deco(GEO.cyl, '#ff4d6d', 0, y + 3.2, z + len, 1.4, 0.3, 1.4, Math.PI / 2, 0, 0);
        C.spawners.push({ z0: z, z1: z + len, y, t: 0, every: lerp(1.5, 0.75, d), speed: 6 + d * 5 });
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      movers(z, y) {
        floor(z, 3, y); cp(z + 1, y);
        let zz = z + 3;
        const n = 3 + Math.round(d * 2);
        for (let i = 0; i < n; i++) {
          zz += lerp(1.4, 2.0, d);
          const size = 3.4;
          const s = solid(0, y, zz + size / 2, size, 0.6, size, i % 2 ? T.accent : '#ffffff', {
            move: { axis: 'x', amp: 3.6, w: 1.0 + d * 0.9, ph: i * 1.9 + rr(0, 1), base: V(0, 0, 0) }, delta: V(),
          });
          C.movers.push(s);
          wp(0, zz + 0.4, { dyn: s });
          wp(0, zz + size - 0.4, { dyn: s });
          zz += size;
        }
        zz += lerp(1.4, 2.0, d);
        floor(zz, 4, y);
        return { z: zz + 4, y };
      },
      lifts(z, y) {
        floor(z, 3, y); cp(z + 1, y);
        let zz = z + 3;
        const n = 3 + Math.round(d * 2);
        for (let i = 0; i < n; i++) {
          zz += 1.7;
          const size = 3.4, x = i % 2 ? 2.2 : -2.2;
          const s = solid(x, y, zz + size / 2, size, 0.6, size, i % 2 ? '#ffffff' : T.accent, {
            move: { axis: 'y', amp: 1.2 + d * 0.5, w: 1.2 + d * 0.8, ph: i * 1.3, base: V(0, y, 0) }, delta: V(),
          });
          C.movers.push(s);
          wp(x, zz + 0.4, { dyn: s, lift: true });
          wp(x, zz + size - 0.4, { dyn: s, lift: true });
          zz += size;
        }
        zz += 1.7;
        floor(zz, 4, y);
        return { z: zz + 4, y };
      },
      conveyor(z, y) {
        const len = 24;
        cp(z + 1, y);
        const map = TEX.arrows.clone();
        map.needsUpdate = true;
        const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
        const s = solid(0, y, z + len / 2, LANE, 1.2, len, null, { mat });
        s.conv = -(3 + d * 2.5);
        (C.convMats = C.convMats || []).push({ map, speed: s.conv });
        deco(roundedBox(LANE + 0.5, 1.4, len + 0.2, 0.45), T.edge, 0, y - 1.3, z + len / 2);
        for (let hz = z + 4; hz < z + len - 2; hz += 5.5 - d) solid(0, y + 0.6, hz, LANE, 0.6, 0.45, T.accent, { r: 0.2 });
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      doors(z, y) {
        const len = 22;
        floor(z, len, y); cp(z + 1, y);
        const slots = [-4.5, -1.5, 1.5, 4.5];
        let lastX = 0;
        for (const wz of [z + 5, z + 11, z + 17]) {
          const open = new Set([Math.floor(rng() * 4)]);
          if (d < 0.6 || rng() < 0.5) open.add(Math.floor(rng() * 4));
          for (let i = 0; i < 4; i++) {
            const x = slots[i];
            if (open.has(i)) {
              for (const s of [-1, 1]) solid(x + s * 1.3, y + 3.2, wz, 0.4, 3.2, 0.6, T.edge, { r: 0.15 });
              solid(x, y + 3.2, wz, 3, 0.8, 0.6, T.edge, { r: 0.2 });
            } else {
              solid(x, y + 3.2, wz, 3, 3.2, 0.6, i % 2 ? T.accent : '#ffffff', { r: 0.25 });
            }
          }
          const opts2 = [...open].map((i) => slots[i]);
          const best = opts2.reduce((a, b) => (Math.abs(b - lastX) < Math.abs(a - lastX) ? b : a));
          wp(best, wz - 1.4, { tight: true });
          wp(best, wz + 1.0, { tight: true });
          lastX = best;
        }
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      bleachers(z, y) {
        floor(z, 3, y); cp(z + 1, y);
        let zz = z + 3, yy = y;
        const seat = ['#3a86ff', '#2667d9'];
        for (let i = 0; i < 9; i++) {
          yy += 0.4;
          solid(0, yy, zz + 0.55, LANE, yy - y + 1.2, 1.1, seat[i % 2], { r: 0.12, side: '#dfe8ff' });
          zz += 1.1;
        }
        floor(zz, 4, yy);
        wp(0, zz + 3.5, { loose: true });
        return { z: zz + 4, y: yy };
      },
      bounce(z, y) {
        floor(z, 8, y); cp(z + 1, y);
        const top = y + 4.2;
        solid(0, top, z + 8 + 4, LANE, 5.4, 8, T.edge);
        floor(z + 8, 8, top);
        // One trampoline the width of the course, so nobody can miss it.
        const pad = solid(0, y + 0.2, z + 3.4, LANE, 0.2, 2.6, '#ff8c1a', { hidden: true });
        pad.bounce = 17;
        deco(roundedBox(LANE - 0.2, 0.22, 2.6, 0.1), '#ff8c1a', 0, y + 0.11, z + 3.4);
        for (const x of [-4.5, -1.5, 1.5, 4.5]) deco(GEO.cyl, '#ffd166', x, y + 0.23, z + 3.4, 1, 0.04, 1);
        wp(0, z + 1.3, { loose: true });
        wp(0, z + 13, { loose: true });
        return { z: z + 16, y: top };
      },
      machines(z, y) {
        const len = 22;
        floor(z, len, y); cp(z + 1, y);
        const n = d > 0.5 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const mz = z + 4 + (i * (len - 7)) / (n - 1);
          const side = i % 2 ? 1 : -1;
          const x = side * (LANE / 2 + 1.1);
          deco(roundedBox(1.4, 1.8, 1.4, 0.3), '#3a4a8f', x, y + 0.9, mz);
          deco(GEO.cyl, T.accent, x, y + 1.3, mz, 0.55, 0.3, 0.55, 0, 0, Math.PI / 2);
          deco(GEO.cyl, '#1f2230', x - side * 0.9, y + 0.95, mz, 0.22, 0.8, 0.22, 0, 0, Math.PI / 2);
          solid(x, y + 1.8, mz, 1.4, 1.8, 1.4, null, { hidden: true });
          C.machines.push({ x: x - side * 1.2, y: y + 0.95, z: mz, dir: -side, t: rr(0, 1), every: lerp(1.7, 0.9, d), zr: 0.6 });
        }
        wp(0, z + len - 0.5, { loose: true });
        return { z: z + len, y };
      },
      beams(z, y) {
        floor(z, 3, y); cp(z + 1, y);
        const len = 15;
        const w = lerp(1.5, 1.05, d);
        const bx = rpick([-2.5, 2.5]);
        for (const x of [-2.5, 2.5]) solid(x, y, z + 3 + len / 2, w, 0.6, len, '#ffffff', { side: T.accent, r: 0.2 });
        wp(bx, z + 2.6, { tight: true });
        wp(bx, z + 3 + len, { tight: true });
        floor(z + 3 + len, 4, y);
        return { z: z + 3 + len + 4, y };
      },
      drop(z, y) {
        floor(z, 6, y); cp(z + 1, y);
        const low = y - 3.2;
        floor(z + 6, 8, low);
        wp(0, z + 13, { loose: true });
        return { z: z + 14, y: low };
      },
      gate(z, y) {
        // Qualifying line for a knockout round.
        floor(z, 12, y, LANE + 2);
        cp(z + 1, y);
        const gz = z + 4;
        for (const s of [-1, 1]) deco(roundedBox(0.8, 7, 0.8, 0.3), '#2ec27e', s * 7.4, y + 3.5, gz);
        deco(roundedBox(15.6, 1.2, 0.8, 0.3), '#2ec27e', 0, y + 7, gz);
        for (let i = 0; i < 7; i++) deco(GEO.box, i % 2 ? '#ffffff' : '#1c1c24', -6 + i * 2, y + 0.02, gz, 2, 0.04, 0.6);
        const sign = labelSprite('QUALIFY', '#ffffff', 'rgba(46,194,126,0.95)');
        sign.position.set(0, y + 8.6, gz); sign.scale.set(8, 2, 1);
        C.group.add(sign);
        wp(0, z + 9, { loose: true });
        C.gateZ = gz; C.gateY = y;
        return { z: z + 12, y };
      },
      finish(z, y) {
        floor(z, 18, y, LANE + 2);
        cp(z + 1, y);
        const fz = z + 11;
        deco(GEO.cyl, '#ffd166', 0, y + 0.18, fz, 1.9, 0.36, 1.9);
        deco(GEO.cyl, '#ff4d8d', 0, y + 0.1, fz, 2.4, 0.2, 2.4);
        const bat = makeBat(GOLD);
        bat.scale.setScalar(2.4);
        bat.position.set(0, y + 1.3, fz);
        C.group.add(bat);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(6, 6, 1); halo.position.set(0, y + 2.6, fz);
        C.group.add(halo);
        for (const s of [-1, 1]) C.group.add(mesh(GEO.cyl, GOLD, s * 8, y + 4, z + 3, 0.35, 8, 0.35, false));
        const sign = labelSprite('GOLDEN BAT', '#3a2600', 'rgba(255,210,63,0.95)');
        sign.position.set(0, y + 8.3, z + 3); sign.scale.set(10, 2.5, 1);
        C.group.add(sign);
        wp(0, fz, { tight: true });
        C.finish = { x: 0, y, z: fz, bat, halo };
        return { z: z + 18, y };
      },
    };

    let at = SEG.start(0, 0);
    C.flush();
    for (const id of M.segs) {
      if (!SEG[id]) { console.warn(`Map ${mi + 1} (${M.name}) names a segment nobody wrote: "${id}"`); continue; }
      at = SEG[id](at.z, at.y);
      C.flush();
    }
    at = (opts.final ? SEG.finish : SEG.gate)(at.z, at.y);
    C.flush();
    C.length = at.z;
    C.endZ = C.finish ? C.finish.z : C.gateZ;
    C.wps.sort((a, b) => a.z - b.z);
    C.cps.sort((a, b) => a.z - b.z);
    C.minY = Math.min(...C.cps.map((c) => c.y));
    return C;
  }

  /* The survival round: a floating diamond, a bat spinning low, a bat
   * spinning high, both getting faster. No respawns. */
  function buildArena() {
    const T = MAP_THEMES.sandlot;
    const C = courseKit({
      M: { name: 'Batter Up Survival', theme: 'sandlot' }, T, d: 0.5, solids: [], movers: [], sweeps: [], pends: [], spawners: [],
      rollers: [], machines: [], balls: [], wps: [], cps: [{ z: 0, y: 0 }], group: new THREE.Group(), time: 0, tile: 0,
      finish: null, gateZ: null, survival: true, minY: 0,
    });
    const S = 20;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const x = -S / 2 + 2 + i * 4, z = -S / 2 + 2 + j * 4;
        C.solid(x, 0, z, 4, 1.4, 4, (i + j) % 2 ? '#6fd46a' : '#5cc257', { side: '#ffffff', r: 0.2 });
      }
    }
    C.deco(roundedBox(S + 0.8, 1.6, S + 0.8, 0.5), '#d99a5e', 0, -1.5, 0);
    for (const [x, z] of [[0, -7.8], [7.8, 0], [0, 7.8], [-7.8, 0]]) C.deco(roundedBox(1.4, 0.16, 1.4, 0.06), '#ffffff', x, 0.08, z, 1, 1, 1, 0, Math.PI / 4, 0);
    C.solid(0, 3.4, 0, 1.4, 3.4, 1.4, '#ffd23f', { r: 0.6 });
    C.deco(GEO.sphere, '#ff4d8d', 0, 3.6, 0, 0.9, 0.9, 0.9);
    for (const [high, w] of [[false, 1.0], [true, -0.75]]) {
      const barY = high ? 1.3 : 0.45;
      const g = new THREE.Group();
      g.position.set(0, barY, 0);
      for (const s of [-1, 1]) {
        const bat = makeBat(null, high ? '#8a5a2b' : '#d69a5a');
        bat.scale.set(4.2, 10.5, 4.2);
        bat.rotation.x = s * Math.PI / 2;
        g.add(bat);
      }
      C.group.add(g);
      C.sweeps.push({ g, c: V(0, barY, 0), R: 10.5, w, w0: w, ang: high ? Math.PI / 2 : 0, high });
    }
    for (const [x, dir, z] of [[-11.5, 1, -4], [11.5, -1, 4]]) {
      C.deco(roundedBox(1.4, 1.8, 1.4, 0.3), '#3a4a8f', x, 0.9, z);
      C.deco(GEO.cyl, '#ffd23f', x, 1.3, z, 0.55, 0.3, 0.55, 0, 0, Math.PI / 2);
      C.machines.push({ x: x + dir * 1.2, y: 0.95, z, dir, t: 15, every: 1.6, zr: 5, delay: 15 });
    }
    const sign = labelSprite('LAST BEANS STANDING', '#ffffff', 'rgba(255,77,141,0.95)');
    sign.position.set(0, 9, 16); sign.scale.set(12, 3, 1);
    C.group.add(sign);
    C.flush();
    C.length = S;
    return C;
  }

  (function checkMaps() {
    const known = ['run', 'stones', 'sweep', 'highbar', 'pendulum', 'rollers', 'movers', 'lifts', 'conveyor', 'doors', 'bleachers', 'bounce', 'machines', 'beams', 'drop'];
    if (MAPS.length !== 25) console.warn(`maps.js has ${MAPS.length} maps; the menu expects 25`);
    MAPS.forEach((m, i) => {
      if (!MAP_THEMES[m.theme]) console.warn(`Map ${i + 1} (${m.name}) uses a theme nobody wrote: "${m.theme}"`);
      for (const s of m.segs) if (!known.includes(s)) console.warn(`Map ${i + 1} (${m.name}) names a segment nobody wrote: "${s}"`);
    });
  })();

  function buildRaceScene(C) {
    const T = C.T;
    const s = new THREE.Scene();
    const dome = skyDome(T.sky, T.fog);
    s.add(dome);
    s.fog = new THREE.Fog(T.fog, 55, 210);
    s.add(new THREE.HemisphereLight(T.night ? '#9fb4ff' : '#ffffff', T.ground, T.night ? 0.65 : 0.9));
    const sun = new THREE.DirectionalLight(T.night ? '#c8d6ff' : '#fff4dc', T.night ? 0.8 : 1.05);
    sun.castShadow = quality > 0;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    s.add(sun, sun.target);
    s.add(C.group);
    const lava = C.M.theme === 'lava';
    const g = own(new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({
      color: lin(T.ground), roughness: 1, emissive: lava ? lin('#ff3a00') : lin('#000000'), emissiveIntensity: 0.6,
    })));
    g.rotation.x = -Math.PI / 2; g.position.y = C.minY - 55;
    s.add(g);
    // Clouds, floating bats and light towers in one mesh; baseballs share a material.
    const rng = mulberry32((C.length * 13) | 0);
    const junk = new Merger();
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (18 + rng() * 60), z = rng() * (C.length + 80) - 40, y = rng() * 30 - 12;
      const kind = rng();
      if (kind < 0.4 && !T.stars && !lava) {
        for (let k = 0; k < 4; k++) junk.add(GEO.lowSphere, '#ffffff', x + k * 2.2 - 3, y + 10 + rng() * 1.2, z + rng() * 2, 2.4, 1.6, 2);
      } else if (kind < 0.65) {
        const b = mesh(GEO.ball, BALL_MAT, x, y, z, 1, 1, 1, false);
        b.scale.setScalar(2 + rng() * 4); b.rotation.set(rng() * 3, rng() * 3, 0); s.add(b);
      } else if (kind < 0.85) {
        const sc = 6 + rng() * 6;
        junk.add(GEO.bat, '#c8955a', x, y, z, sc, sc, sc, rng() * 3, rng() * 3, rng() * 3);
      } else {
        const r = 1 + rng();
        junk.add(GEO.cyl, '#8a93a6', x, y - 10, z, r, 50, r);
        junk.add(GEO.box, '#fffbe0', x, y + 16, z, 6, 3, 1);
      }
    }
    s.add(own(junk.mesh(VC, false)));
    let stars = null;
    if (T.stars || T.night) {
      const n = T.stars ? 1500 : 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, b = rng() * Math.PI * 0.5;
        pos[i * 3] = Math.cos(a) * Math.cos(b) * 600;
        pos[i * 3 + 1] = Math.sin(b) * 600 - 50;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * 600;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      stars = own(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false })));
      s.add(stars);
    }
    let rain = null;
    if (T.rain) {
      const n = 700;
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = rand(-30, 30), y = rand(-10, 30), z = rand(-20, 40);
        pos.set([x, y, z, x, y - 0.6, z], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      rain = own(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.45 })));
      s.add(rain);
    }
    return { scene: s, sun, stars, rain, dome };
  }

  // ---- racers
  function makeRacer(p, human, pos) {
    const bean = makeBean(p);
    const r = {
      p, bean, human, pos: pos.clone(), vel: V(), yaw: 0, yawT: 0, ground: null,
      stun: 0, dive: 0, diveCd: 0, getup: 0, abCd: 1, boost: 0, shield: 0, inv: 0, coyote: 0, jbuf: 0, cpi: 0,
      sliding: 0, finished: false, qualified: false, out: false, gone: false, goneT: 0, place: 0,
      ai: human ? null : {
        wi: 0, lo: rand(-1.2, 1.2), sf: rand(0.86, 0.98), skill: rand(0.5, 0.95), bestZ: pos.z, stuckT: 0,
        react: rand(0.12, 0.3), abT: rand(2, 6), jumpDelay: 0, wander: V(), wanderT: 0, backT: 0,
      },
    };
    bean.root.position.copy(r.pos);
    const tag = labelSprite(human ? 'YOU' : p.nick, human ? '#1a1300' : '#ffffff', human ? 'rgba(255,214,70,0.95)' : 'rgba(10,14,30,0.55)');
    tag.position.y = 2.25;
    tag.scale.set(human ? 1.6 : 2.2, human ? 0.4 : 0.55, 1);
    bean.root.add(tag);
    r.tag = tag;
    const bubble = mesh(GEO.sphere, new THREE.MeshStandardMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.3, emissive: '#3fb6ff', emissiveIntensity: 0.4, depthWrite: false }), 0, 0.85, 0, 1.05, 1.1, 1.05, false);
    bubble.visible = false;
    bean.root.add(bubble);
    r.bubble = bubble;
    const blob = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(1.3, 1.3, 1);
    r.blob = blob;
    return r;
  }

  /* ---- modes that use the race engine */
  function startPractice(mi) {
    const me = Flow.picks[0];
    const field = [me, ...shuffle(ROSTER.filter((p) => p.id !== me.id)).slice(0, 7)];
    Flow.tour = null;
    startRace({ map: mi, entrants: field, need: 1, final: true });
  }
  function startTournament() {
    const me = Flow.picks[0];
    const field = [me, ...shuffle(ROSTER.filter((p) => p.id !== me.id)).slice(0, 15)];
    const easy = MAPS.map((_, i) => i).filter((i) => MAPS[i].diff <= 0.45);
    const r1 = pick(easy);
    const r3 = pick(MAPS.map((_, i) => i).filter((i) => i !== r1));
    Flow.tour = {
      round: 0, alive: field,
      plan: [
        { kind: 'race', map: r1, need: 10, label: 'Race' },
        { kind: 'survival', need: 5, label: 'Survival' },
        { kind: 'race', map: r3, need: 1, final: true, label: 'Final' },
      ],
    };
    startRound();
  }
  function startRound() {
    const t = Flow.tour, R = t.plan[t.round];
    if (R.kind === 'race') startRace({ map: R.map, entrants: t.alive, need: R.need, final: !!R.final });
    else startRace({ survival: true, entrants: t.alive, need: R.need });
  }

  function startRace(opts) {
    clearWorld();
    Snd.unlock();
    const C = opts.survival ? buildArena() : buildCourse(opts.map, opts);
    if (!opts.survival) Flow.map = opts.map;
    const sc = buildRaceScene(C);
    const me = Flow.picks[0];
    const n = opts.entrants.length;
    const slots = shuffle([...Array(n).keys()]);
    const racers = opts.entrants.map((p, i) => {
      const s = slots[i];
      let pos;
      if (opts.survival) {
        const a = (s / n) * TAU;
        pos = V(Math.sin(a) * 6, 0, Math.cos(a) * 6);
      } else {
        pos = V(((s % 4) - 1.5) * 2.6, C.cps[0].y, 3 + Math.floor(s / 4) * 2.3);
      }
      const r = makeRacer(p === me ? Save.mine(p) : p, p === me, pos);
      if (opts.survival) r.yaw = r.yawT = Math.atan2(-pos.x, -pos.z);
      return r;
    });
    for (const r of racers) { sc.scene.add(r.bean.root); sc.scene.add(r.blob); }
    world = Object.assign(sc, {
      kind: 'race', C, opts, racers, me: racers.find((r) => r.human), t: 0, state: 'count', count: 3.5, winner: null, endT: 0,
      qualified: [], focus: null,
    });
    world.focus = world.me;
    world.lookCur = V(world.me.pos.x, 1, world.me.pos.z + 6);
    camera.position.set(world.me.pos.x, 6, world.me.pos.z - 10);
    mode = 'race';
    paused = false;
    showScreen(null);
    setHud('race');
    setupRaceHud();
    const t = Flow.tour;
    const roundTag = t ? `Round ${t.round + 1} of ${t.plan.length} · ` : '';
    $('#hr-map').textContent = `${roundTag}${C.M.name}`;
    const ab = ABILITIES[me.ability];
    $('#hr-ab-name').textContent = ab.name;
    $('#hr-help').textContent = isTouch ? '' : 'WASD / arrows run · Space jump · Shift dive · E ' + ab.name;
    const goal = opts.survival ? `Survive! Last ${opts.need} standing go through`
      : opts.final ? 'First to grab the Golden Bat wins' : `First ${opts.need} across the line qualify`;
    banner(t ? (t.round === t.plan.length - 1 ? 'FINAL ROUND' : `ROUND ${t.round + 1}`) : C.M.name, goal, 2.4);
    if (opts.survival) {
      camera.position.set(world.me.pos.x * 1.3, 7, world.me.pos.z * 1.3);
    }
  }

  function groundAt(x, z, yMin, yMax) {
    let best = null;
    for (const s of world.C.solids) {
      // A hair wider than the box, so the seam between two floor tiles is not a gap.
      if (x < s.min.x - 0.06 || x > s.max.x + 0.06 || z < s.min.z - 0.06 || z > s.max.z + 0.06) continue;
      if (s.max.y < yMin || s.max.y > yMax) continue;
      if (best === null || s.max.y > best) best = s.max.y;
    }
    return best;
  }
  const active = (r) => !r.gone && !r.out;

  function knock(r, dx, dz, power, up = 6) {
    if (r.shield > 0 || r.inv > 0 || r.finished || !active(r)) return false;
    const l = Math.hypot(dx, dz) || 1;
    r.vel.x = (dx / l) * power; r.vel.z = (dz / l) * power; r.vel.y = up;
    r.stun = 0.95; r.dive = 0; r.sliding = 0; r.ground = null; r.inv = 0.5;
    if (r.human || distToMe(r) < 12) Snd.bonk();
    return true;
  }
  const distToMe = (r) => (world && world.focus ? r.pos.distanceTo(world.focus.pos) : 99);

  function useAbility(r) {
    const ab = ABILITIES[r.p.ability];
    r.abCd = ab.cd * (r.p.cdMul || 1);
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
    switch (r.p.ability) {
      case 'steal': r.boost = 2; if (r.human) Snd.whoosh(); break;
      case 'moonshot':
        r.vel.y = r.ground || r.coyote > 0 ? 16.5 : Math.max(r.vel.y, 13);
        r.ground = null; r.coyote = 0;
        if (r.human) Snd.boing();
        break;
      case 'heater': {
        const m = mesh(GEO.ball, HEATER_MAT, 0, 0, 0, 0.3, 0.3, 0.3);
        world.scene.add(m);
        world.C.balls.push({ pos: V(r.pos.x + fx * 0.9, r.pos.y + 1.1, r.pos.z + fz * 0.9), vel: V(fx * 30, 0, fz * 30), r: 0.3, life: 1.3, owner: r, mesh: m, heater: true });
        if (r.human || distToMe(r) < 15) Snd.whoosh();
        break;
      }
      case 'gear': r.shield = 3; if (r.human) Snd.pop(); break;
      case 'slide':
        startDive(r, 7);
        r.sliding = 0.9;
        if (r.human) Snd.whoosh();
        break;
    }
  }
  function runSpeed(r) {
    return (7.2 + r.p.spd * 0.22) * (r.boost > 0 ? 1.55 : 1) * (r.ai ? r.ai.sf : 1);
  }
  function startDive(r, extra) {
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
    const sp = runSpeed(r) + extra;
    r.dive = 0.45;
    r.vel.x = fx * sp; r.vel.z = fz * sp;
    // Low and flat from the ground, so a dive really does go under a high bat.
    r.vel.y = r.ground ? 2.5 : Math.max(r.vel.y, 2.5);
    r.ground = null;
    r.diveCd = 0.9;
  }

  function racerStep(r, inp, dt) {
    const C = world.C;
    r.abCd = Math.max(0, r.abCd - dt);
    r.diveCd -= dt; r.boost -= dt; r.shield -= dt; r.inv -= dt; r.coyote -= dt; r.jbuf -= dt; r.sliding -= dt;
    if (inp.jump) r.jbuf = 0.13;
    if (r.ground) {
      if (r.ground.delta) r.pos.add(r.ground.delta);
      if (r.ground.conv) r.pos.z += r.ground.conv * dt;
      r.coyote = 0.1;
    }
    const grounded = !!r.ground;
    const spd = runSpeed(r);
    if (r.finished) {
      r.vel.x *= 0.8; r.vel.z *= 0.8;
    } else if (r.stun > 0) {
      r.stun -= dt;
      if (grounded) { r.vel.x *= 1 - damp(5, dt); r.vel.z *= 1 - damp(5, dt); }
    } else if (r.dive > 0) {
      if (grounded) {
        r.dive -= dt;
        r.vel.x *= 1 - damp(3, dt); r.vel.z *= 1 - damp(3, dt);
        if (r.dive <= 0) r.getup = 0.22;
      }
      if (inp.jump && grounded) { r.dive = 0; r.getup = 0; }
    } else {
      let mx = inp.mx, mz = inp.mz;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      if (r.getup > 0) { r.getup -= dt; mx *= 0.35; mz *= 0.35; }
      const k = damp(grounded ? 14 : 5, dt);
      r.vel.x += (mx * spd - r.vel.x) * k;
      r.vel.z += (mz * spd - r.vel.z) * k;
      if (ml > 0.15) r.yawT = Math.atan2(mx, mz);
      if (r.jbuf > 0 && r.coyote > 0) {
        r.vel.y = JUMP_V; r.coyote = 0; r.jbuf = 0; r.ground = null;
        if (r.human) Snd.jump();
      }
      if (inp.dive && r.diveCd <= 0) { r.yaw = r.yawT; startDive(r, 4); if (r.human) Snd.whoosh(); }
    }
    if (inp.ability && r.abCd <= 0 && r.stun <= 0 && !r.finished) useAbility(r);

    r.vel.y = Math.max(-32, r.vel.y - GRAV * dt);
    const prevY = r.pos.y;
    r.pos.addScaledVector(r.vel, dt);
    collide(r, prevY);

    if (r.stun <= 0) r.yaw += wrapA(r.yawT - r.yaw) * damp(r.dive > 0 ? 3 : 14, dt);

    if (C.survival) {
      if (r.pos.y < -7) eliminate(r);
      return;
    }
    const next = C.cps[r.cpi + 1];
    if (next && r.ground && r.pos.z >= next.z && Math.abs(r.pos.y - next.y) < 1.5) {
      r.cpi++;
      if (r.human && r.cpi > 1) flashCheckpoint();
    }
    if (r.pos.y < C.cps[r.cpi].y - 16) respawn(r);
  }

  function collide(r, prevY) {
    const H = r.dive > 0 ? 0.8 : 1.6;
    r.ground = null;
    for (const s of world.C.solids) {
      const mn = s.min, mx = s.max;
      if (r.pos.x < mn.x - RAD || r.pos.x > mx.x + RAD || r.pos.z < mn.z - RAD || r.pos.z > mx.z + RAD) continue;
      if (r.pos.y >= mx.y || r.pos.y + H <= mn.y) continue;
      const up = mx.y - r.pos.y;
      if (r.vel.y <= 0.5 && (prevY >= mx.y - 0.06 || up <= STEP_UP)) {
        r.pos.y = mx.y;
        if (s.bounce && r.vel.y < 0.5) {
          r.vel.y = s.bounce;
          r.dive = 0;
          if (r.human || distToMe(r) < 12) Snd.boing();
          continue;
        }
        r.vel.y = 0;
        r.ground = s;
      } else if (r.vel.y > 0 && prevY + H <= mn.y + 0.08) {
        r.pos.y = mn.y - H;
        r.vel.y = 0;
      } else {
        const px1 = mx.x + RAD - r.pos.x, px2 = r.pos.x - (mn.x - RAD);
        const pz1 = mx.z + RAD - r.pos.z, pz2 = r.pos.z - (mn.z - RAD);
        const m = Math.min(px1, px2, pz1, pz2);
        if (m === px1) { r.pos.x += px1; if (r.vel.x < 0) r.vel.x = 0; }
        else if (m === px2) { r.pos.x -= px2; if (r.vel.x > 0) r.vel.x = 0; }
        else if (m === pz1) { r.pos.z += pz1; if (r.vel.z < 0) r.vel.z = 0; }
        else { r.pos.z -= pz2; if (r.vel.z > 0) r.vel.z = 0; }
      }
    }
  }

  function respawn(r) {
    const c = world.C.cps[r.cpi];
    r.pos.set(rand(-2.5, 2.5), c.y + 0.5, c.z + rand(0, 1));
    r.vel.set(0, 0, 0);
    r.stun = 0; r.dive = 0; r.getup = 0; r.inv = 1.2; r.ground = null; r.yaw = r.yawT = 0;
    if (r.ai) {
      r.ai.wi = world.C.wps.findIndex((w) => w.z > r.pos.z);
      if (r.ai.wi < 0) r.ai.wi = world.C.wps.length;
      r.ai.stuckT = 0; r.ai.bestZ = r.pos.z;
    }
    if (r.human) Snd.pop();
  }
  function eliminate(r) {
    if (r.out) return;
    r.out = true;
    r.bean.root.visible = false;
    r.blob.visible = false;
    const alive = world.racers.filter((x) => !x.out).length;
    if (r.human) {
      banner('ELIMINATED', 'You fell off — spectating', 2.2, 'bad');
      Snd.lose();
      $('#btn-skip').hidden = false;
    } else if (world.me && !world.me.out) {
      $('#hr-feed').insertAdjacentHTML('afterbegin', `<div>${r.p.name} is out · ${alive} left</div>`);
      const f = $('#hr-feed');
      while (f.children.length > 4) f.lastChild.remove();
    }
  }
  let cpFlashT = 0;
  function flashCheckpoint() {
    $('#hr-cp').classList.add('on');
    cpFlashT = 1.1;
  }

  // ---- AI
  function aiInput(r, dt) {
    const a = r.ai, C = world.C;
    const inp = { mx: 0, mz: 0, jump: false, dive: false, ability: false };
    if (r.finished || world.winner) return inp;

    if (C.survival) {
      a.wanderT -= dt;
      if (a.wanderT <= 0) {
        const ang = rand(0, TAU), rad = rand(2.5, 6);
        a.wander.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
        a.wanderT = rand(1.2, 3);
      }
      let dx = a.wander.x - r.pos.x, dz = a.wander.z - r.pos.z;
      const L = Math.hypot(dx, dz);
      if (L > 0.6) { inp.mx = dx / L; inp.mz = dz / L; }
      if (Math.max(Math.abs(r.pos.x), Math.abs(r.pos.z)) > 7.6) {
        const l2 = Math.hypot(r.pos.x, r.pos.z) || 1;
        inp.mx = -r.pos.x / l2; inp.mz = -r.pos.z / l2;
      }
    } else {
      a.backT -= dt;
      while (a.wi < C.wps.length) {
        const p = C.wps[a.wi];
        // A stone or platform only counts once we are standing on or past it.
        const precise = p.tight || p.dyn;
        const passed = a.backT > 0 ? Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < 1.2
          : p.z < r.pos.z + 0.3 && (!precise || r.ground || p.z < r.pos.z - 1.5);
        if (!passed) break;
        a.wi++;
      }
      const wp = C.wps[a.wi];
      // Where a sliding platform will be `ahead` seconds from now.
      const slideX = (s, ahead) => s.move.base.x + Math.sin((C.time + ahead) * s.move.w + s.move.ph) * s.move.amp;
      const sliding = wp && wp.dyn && !wp.lift;
      let tx, tz;
      if (!wp) { tx = 0; tz = C.endZ + 3; }
      else {
        tx = sliding ? wp.dyn.cx() : wp.dyn ? wp.x : wp.x + (wp.tight ? 0 : a.lo);
        tz = wp.z;
      }
      let dx = tx - r.pos.x, dz = tz - r.pos.z;
      const L = Math.hypot(dx, dz) || 1;
      dx /= L; dz /= L;
      inp.mx = dx; inp.mz = dz;

      // In the air, aim the landing: work out when we come down on the
      // target's height and ask for exactly the speed that gets us there —
      // for a sliding platform, where it will be by then.
      if (!r.ground && r.stun <= 0 && wp) {
        const ty = wp.dyn ? wp.dyn.max.y : groundAt(tx, tz, r.pos.y - 4, r.pos.y + 1.5);
        if (ty !== null && ty <= r.pos.y + 1.5) {
          const disc = r.vel.y * r.vel.y + 4 * (GRAV / 2) * (r.pos.y - ty);
          const tl = disc > 0 ? (r.vel.y + Math.sqrt(disc)) / GRAV : 0;
          if (tl > 0.05) {
            const ax = sliding ? slideX(wp.dyn, tl) : tx;
            const spd = runSpeed(r);
            inp.mx = clamp((ax - r.pos.x) / tl / spd, -1, 1);
            inp.mz = clamp((tz - r.pos.z) / tl / spd, -1, 1);
          }
        }
      }

      if (r.ground && r.stun <= 0) {
        const probe = 0.75 + a.skill * 0.6;
        const px = r.pos.x + dx * probe, pz = r.pos.z + dz * probe;
        const g = groundAt(px, pz, r.pos.y - 1.2, r.pos.y + STEP_UP);
        if (g === null) {
          let ok = true;
          if (wp && wp.dyn) {
            const s = wp.dyn;
            if (wp.lift) ok = s.max.y < r.pos.y + 0.8 && s.max.y > r.pos.y - 1.8 && Math.cos(C.time * s.move.w + s.move.ph) <= 0.2;
            else ok = Math.abs(slideX(s, 0.45) - r.pos.x) < 0.7 + a.skill * 0.3 && s.min.z - r.pos.z < 3.2;
          }
          if (ok) {
            if (a.jumpDelay <= 0) a.jumpDelay = rand(0.001, 0.08 * (1.2 - a.skill));
          } else {
            // Wait at the lip. Riding a platform, stand still and let it carry us.
            inp.mz = 0;
            inp.mx = sliding && !r.ground.move ? clamp((slideX(wp.dyn, 0.45) - r.pos.x) * 0.6, -0.6, 0.6) : 0;
            if (groundAt(r.pos.x, r.pos.z + 0.35, r.pos.y - 0.3, r.pos.y + 0.3) === null) inp.mz = -0.4;
          }
        } else if (groundAt(px, pz, r.pos.y + STEP_UP + 0.01, r.pos.y + 1.3) !== null) {
          // Something knee-high ahead (a hurdle): hop it.
          if (a.jumpDelay <= 0) a.jumpDelay = rand(0.001, 0.06);
        }
      }
      if (a.jumpDelay > 0) { a.jumpDelay -= dt; if (a.jumpDelay <= 0) inp.jump = true; }

      for (const b of C.rollers) {
        const dzz = b.pos.z - r.pos.z;
        if (dzz < 0 || dzz > 7) continue;
        const dxx = r.pos.x - b.pos.x;
        if (Math.abs(dxx) < 2.2) inp.mx += Math.sign(dxx || 1) * 1.6 * a.skill;
      }
      for (const p of C.pends) {
        const dzz = p.pivot.z - r.pos.z;
        if (dzz < 0.5 || dzz > 2.6) continue;
        if (Math.abs(p.bob.x - r.pos.x) < 3 && Math.random() < a.skill) inp.mz = Math.min(inp.mz, 0.1);
      }
      if (r.pos.z > a.bestZ + 0.5) { a.bestZ = r.pos.z; a.stuckT = 0; }
      else a.stuckT += dt;
      if (a.stuckT > 2.6) {
        // Back up to an earlier waypoint (a pad, a doorway) and try again.
        inp.jump = true; a.lo = rand(-3, 3); a.stuckT = 1.2;
        const back = C.wps.findIndex((p) => p.z > r.pos.z - 4);
        if (back >= 0 && back < a.wi) { a.wi = back; a.backT = 2.5; }
      }
    }

    // Spinning bats: hop the low ones, dive the high ones.
    for (const s of C.sweeps) {
      if (Math.abs(s.c.z - r.pos.z) > s.R + 1 || Math.abs(s.c.y - r.pos.y) > 2.5) continue;
      const px = r.pos.x - s.c.x, pz = r.pos.z - s.c.z;
      if (Math.hypot(px, pz) > s.R + 0.4) continue;
      let diff = wrapA(Math.atan2(px, pz) - s.ang);
      if (diff > Math.PI / 2) diff -= Math.PI; else if (diff < -Math.PI / 2) diff += Math.PI;
      const approaching = diff * s.w > 0;
      const tHit = Math.abs(diff) / Math.abs(s.w);
      if (approaching && tHit < a.react + 0.08 && Math.random() < a.skill + 0.1) {
        if (s.high) { if (r.ground && r.diveCd <= 0) inp.dive = true; }
        else if (r.ground) inp.jump = true;
      }
    }
    for (const b of C.balls) {
      if (b.owner === r) continue;
      const dxx = r.pos.x - b.pos.x, dzz = r.pos.z - b.pos.z;
      if (Math.abs(dzz) < 1.2 && Math.abs(dxx) < 3 && Math.sign(dxx) === Math.sign(b.vel.x) && r.ground && Math.random() < a.skill * 0.25) inp.jump = true;
    }

    a.abT -= dt;
    if (r.abCd <= 0 && a.abT <= 0) {
      const ab = r.p.ability;
      let use = false;
      if (ab === 'steal' || ab === 'slide') use = !C.survival && r.ground && groundAt(r.pos.x, r.pos.z + 6, r.pos.y - 0.3, r.pos.y + 0.3) !== null && C.sweeps.every((s) => Math.abs(s.c.z - r.pos.z) > 8);
      else if (ab === 'moonshot') use = inp.jump && !C.survival;
      else if (ab === 'gear') use = C.survival ? Math.random() < 0.3 : C.sweeps.some((s) => Math.abs(s.c.z - r.pos.z) < 5) || C.pends.some((p) => Math.abs(p.pivot.z - r.pos.z) < 5) || C.rollers.some((b) => Math.abs(b.pos.z - r.pos.z) < 5);
      else if (ab === 'heater') use = world.racers.some((o) => o !== r && active(o) && o.pos.z > r.pos.z + 2 && o.pos.z < r.pos.z + 18 && Math.abs(o.pos.x - r.pos.x) < 1.6 && Math.abs(o.pos.y - r.pos.y) < 1);
      if (C.survival && ab === 'heater') use = world.racers.some((o) => o !== r && active(o) && o.pos.distanceTo(r.pos) < 10 && Math.abs(wrapA(Math.atan2(o.pos.x - r.pos.x, o.pos.z - r.pos.z) - r.yaw)) < 0.25);
      if (use) { inp.ability = true; if (ab === 'moonshot') inp.jump = false; a.abT = rand(1, 3); }
    }
    return inp;
  }

  function humanInput() {
    let mx = 0, mz = 0;
    if (held('KeyW', 'ArrowUp')) mz += 1;
    if (held('KeyS', 'ArrowDown')) mz -= 1;
    if (held('KeyA', 'ArrowLeft')) mx += 1;
    if (held('KeyD', 'ArrowRight')) mx -= 1;
    mx += touch.mx; mz += touch.mz;
    const inp = {
      mx, mz,
      jump: edge('Space') || touch.jump,
      dive: edge('ShiftLeft', 'ShiftRight', 'KeyQ') || touch.dive,
      ability: edge('KeyE', 'KeyF') || touch.ability,
    };
    touch.jump = touch.dive = touch.ability = false;
    return inp;
  }

  function raceStep(dt) {
    const w = world, C = w.C;
    w.t += dt;
    C.time += dt;
    for (const s of C.movers) {
      const m = s.move;
      const off = Math.sin(C.time * m.w + m.ph) * m.amp;
      const cur = m.axis === 'x' ? s.cx() : s.max.y;
      const target = m.axis === 'x' ? m.base.x + off : m.base.y + off;
      const dd = target - cur;
      s.delta.set(m.axis === 'x' ? dd : 0, m.axis === 'y' ? dd : 0, 0);
      s.min.add(s.delta); s.max.add(s.delta);
      s.mesh.position.add(s.delta);
    }
    const spin = C.survival && w.state === 'race' ? 1 + C.time / 24 : 1;
    for (const s of C.sweeps) {
      s.w = s.w0 * spin;
      if (w.state !== 'count' || !C.survival) s.ang += s.w * dt;
      s.g.rotation.y = s.ang;
    }
    for (const p of C.pends) {
      const a = p.A * Math.sin(C.time * p.w + p.ph);
      p.g.rotation.z = a;
      p.bob.set(p.pivot.x + p.L * Math.sin(a), p.pivot.y - p.L * Math.cos(a), p.pivot.z);
      p.vx = p.A * p.w * Math.cos(C.time * p.w + p.ph);
    }
    if (C.convMats) for (const c of C.convMats) c.map.offset.y -= (c.speed * dt) / 4;

    for (const sp of C.spawners) {
      sp.t -= dt;
      if (sp.t <= 0 && w.state !== 'count') {
        sp.t = sp.every * rand(0.7, 1.3);
        const m = mesh(GEO.ball, BALL_MAT, 0, 0, 0, 1.2, 1.2, 1.2);
        w.scene.add(m);
        C.rollers.push({ pos: V(rand(-4.6, 4.6), sp.y + 1.2, sp.z1 - 0.5), v: sp.speed, r: 1.2, z0: sp.z0, mesh: m });
      }
    }
    for (let i = C.rollers.length - 1; i >= 0; i--) {
      const b = C.rollers[i];
      b.pos.z -= b.v * dt;
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x -= (b.v * dt) / b.r;
      if (b.pos.z < b.z0 - 3) { w.scene.remove(b.mesh); C.rollers.splice(i, 1); }
    }
    for (const m of C.machines) {
      if (w.state === 'count' || (m.delay && C.time < m.delay)) continue;
      m.t -= dt;
      if (m.t <= 0) {
        m.t = m.every * rand(0.8, 1.2);
        const mm = mesh(GEO.ball, BALL_MAT, 0, 0, 0, 0.35, 0.35, 0.35);
        w.scene.add(mm);
        C.balls.push({ pos: V(m.x, m.y, m.z + rand(-m.zr, m.zr)), vel: V(m.dir * 15, 0, 0), r: 0.35, life: 1.9, mesh: mm });
      }
    }
    for (let i = C.balls.length - 1; i >= 0; i--) {
      const b = C.balls[i];
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.z += dt * 20;
      b.life -= dt;
      let hit = false;
      for (const r of w.racers) {
        if (r === b.owner || !active(r)) continue;
        const dy = b.pos.y - (r.pos.y + 0.8);
        if (Math.abs(dy) > 0.95 || Math.hypot(b.pos.x - r.pos.x, b.pos.z - r.pos.z) > b.r + RAD) continue;
        if (knock(r, b.vel.x, b.vel.z, b.heater ? 9 : 8, 5)) { hit = true; break; }
      }
      if (hit || b.life <= 0) { w.scene.remove(b.mesh); C.balls.splice(i, 1); }
    }

    const racing = w.state === 'race' || w.state === 'end';
    for (const r of w.racers) {
      if (!active(r)) { if (r.human) humanInput(); continue; }
      let inp = { mx: 0, mz: 0 };
      if (racing && !r.finished) inp = r.human ? humanInput() : aiInput(r, dt);
      else if (r.human) humanInput();
      racerStep(r, inp, dt);
      if (active(r)) hazards(r);
      if (r.goneT > 0) { r.goneT -= dt; if (r.goneT <= 0) { r.gone = true; r.bean.root.visible = false; r.blob.visible = false; } }
    }
    const rs = w.racers;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i];
      if (!active(a)) continue;
      for (let j = i + 1; j < rs.length; j++) {
        const b = rs[j];
        if (!active(b) || Math.abs(a.pos.y - b.pos.y) > 1.4) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const dd = Math.hypot(dx, dz);
        if (dd > 0.8 || dd < 1e-4) continue;
        const push = (0.8 - dd) / 2;
        a.pos.x -= (dx / dd) * push; a.pos.z -= (dz / dd) * push;
        b.pos.x += (dx / dd) * push; b.pos.z += (dz / dd) * push;
        if (a.sliding > 0 && b.stun <= 0) knock(b, dx, dz + 0.3, 8);
        else if (b.sliding > 0 && a.stun <= 0) knock(a, -dx, -dz + 0.3, 8);
      }
    }

    // Winning, qualifying, surviving.
    if (w.state === 'race') {
      if (C.finish) {
        const f = C.finish;
        for (const r of rs) {
          if (w.winner || !active(r)) continue;
          if (Math.hypot(r.pos.x - f.x, r.pos.z - f.z) < 1.9 && r.pos.y > f.y - 0.5 && r.pos.y < f.y + 3) grabBat(r);
        }
      } else if (C.gateZ !== null) {
        for (const r of rs) {
          if (r.qualified || !active(r) || r.pos.z < C.gateZ || r.pos.y < C.gateY - 1) continue;
          r.qualified = true; r.finished = true; r.goneT = 1.2;
          w.qualified.push(r);
          if (r.human) {
            banner('QUALIFIED!', `${ORD(w.qualified.length)} through · spectating`, 2.2, 'hr');
            Snd.win();
            $('#btn-skip').hidden = false;
          }
          if (w.qualified.length >= w.opts.need) { endRound(); break; }
        }
        if (w.state === 'race' && w.t > 150) endRound();
      } else if (C.survival) {
        const alive = rs.filter((r) => !r.out).length;
        if (alive <= w.opts.need || C.time >= SURVIVE_T + 3.5) endRound();
      }
    }
    const prog = (r) => (r.qualified ? 1e6 - w.qualified.indexOf(r) : r.finished ? 2e6 : r.out ? -1e6 + w.t : r.pos.z + r.cpi * 0.01);
    const order = [...rs].sort((a, b) => prog(b) - prog(a));
    order.forEach((r, i) => (r.place = i + 1));
    w.order = order;

    // Who the camera follows.
    if (active(w.me) && !w.me.qualified) w.focus = w.me;
    else if (!w.focus || !active(w.focus) || w.focus.qualified) w.focus = order.find((r) => active(r) && !r.qualified) || w.me;

    if (w.state === 'count') {
      const before = Math.ceil(w.count);
      w.count -= dt;
      const after = Math.ceil(w.count);
      if (after !== before && after > 0 && after <= 3) { banner(String(after), '', 0.8, 'count'); Snd.beep(false); }
      if (w.count <= 0) { w.state = 'race'; w.t = 0; C.time = 0; banner('GO!', '', 0.8, 'count'); Snd.beep(true); }
    } else if (w.state === 'end') {
      w.endT += dt;
      if (w.endT > 3.2 && !w.shown) { w.shown = true; roundOver(); }
    }
  }

  function grabBat(r) {
    const w = world, f = w.C.finish;
    w.winner = r; r.finished = true;
    w.state = 'end'; w.endT = 0;
    f.bat.visible = false; f.halo.visible = false;
    const gb = makeBat(GOLD); gb.scale.setScalar(1.1);
    r.bean.batPivot.visible = false;
    r.bean.rig.add(gb);
    gb.position.set(-0.55, 1.35, 0.1); gb.rotation.z = -0.25;
    r.trophy = gb;
    w.focus = r;
    if (r.human) { banner('YOU GOT THE GOLDEN BAT!', `${fmtTime(w.t)} on ${w.C.M.name}`, 3.2, 'gold'); Snd.win(); Snd.cheer(3, 0.35); }
    else { banner(`${r.p.name.toUpperCase()} GRABBED IT`, `“${r.p.nick}” took the Golden Bat`, 3.2, 'bad'); Snd.lose(); }
  }

  // End a knockout round now, topping up the qualifiers by who is furthest along.
  function endRound() {
    const w = world;
    if (w.state !== 'race') return;
    const C = w.C;
    if (C.survival) {
      w.qualified = w.racers.filter((r) => !r.out);
    } else if (!C.finish) {
      const rest = w.racers.filter((r) => !r.qualified && active(r)).sort((a, b) => b.pos.z - a.pos.z);
      while (w.qualified.length < w.opts.need && rest.length) w.qualified.push(rest.shift());
    } else {
      // A skipped final: whoever is closest to the bat gets it.
      const lead = w.racers.filter(active).sort((a, b) => b.pos.z - a.pos.z)[0];
      grabBat(lead);
      return;
    }
    w.state = 'end'; w.endT = 0;
    const meThrough = w.qualified.includes(w.me);
    if (!C.survival || !w.me.out) {
      banner(meThrough ? (C.survival ? 'YOU SURVIVED!' : 'ROUND OVER') : 'ELIMINATED', meThrough ? 'On to the next round' : 'So close', 2.6, meThrough ? 'hr' : 'bad');
      (meThrough ? Snd.win : Snd.lose)();
    } else {
      banner('ROUND OVER', `${w.qualified.length} survived`, 2.4);
    }
    $('#btn-skip').hidden = true;
  }

  function roundOver() {
    const w = world, t = Flow.tour;
    const C = w.C;
    const rows = (list) => list.map((r, i) => ({
      name: r.p.name, label: r.human ? 'You' : ORD(i + 1), val: C.finish && i === 0 ? '🏆' : C.finish ? ORD(i + 1) : '✓', sub: `“${r.p.nick}”`, win: C.finish && i === 0, me: r.human,
    }));
    if (!t) {
      // Practice course.
      resActions = { again: () => startPractice(Flow.map), next: () => startPractice((Flow.map + 1) % MAPS.length) };
      const won = w.winner === w.me;
      const pay = REWARDS.practice[Math.min(w.me.place, REWARDS.practice.length) - 1] * (1 + C.M.diff);
      showResult(won ? 'Golden Bat is yours!' : `${ORD(w.me.place)} place`,
        won ? `${C.M.name} in ${fmtTime(w.t)}` : `${w.winner.p.name} grabbed the Golden Bat on ${C.M.name}`,
        rows(w.order), { again: 'Race again', next: 'Next course', tokens: Save.award(pay) });
      return;
    }
    const R = t.plan[t.round];
    if (R.final) {
      const won = w.winner === w.me;
      resActions = { again: startTournament };
      showResult(won ? 'TOURNAMENT CHAMPION!' : `${w.winner.p.name} wins it all`,
        won ? `You beat ${t.plan.length} rounds and 15 other beans to the Golden Bat` : `You made the final and finished ${ORD(w.me.place)} of ${w.racers.length}`,
        rows(w.order), { again: 'New tournament', tokens: Save.award(won ? REWARDS.champion : REWARDS.finalist) });
      if (won) Snd.cheer(3.5, 0.4);
      return;
    }
    // Racers carry your boosted, reskinned copy; the tournament keeps the roster entry.
    const through = w.qualified.map((r) => r.p.base || r.p);
    const meThrough = through.includes(Flow.picks[0]);
    const nextR = t.plan[t.round + 1];
    if (meThrough) {
      resActions = {
        next: () => { t.alive = through; t.round++; startRound(); },
      };
      showResult(C.survival ? 'SURVIVED!' : 'QUALIFIED!', `Round ${t.round + 1} done · ${through.length} of ${w.racers.length} go through to the ${nextR.final ? 'final' : nextR.label.toLowerCase() + ' round'}`,
        rows(w.qualified), { next: nextR.final ? 'On to the final' : 'Next round', tokens: Save.award(C.survival ? REWARDS.survive : REWARDS.qualify) });
    } else {
      resActions = { again: startTournament };
      showResult('ELIMINATED', `Knocked out in round ${t.round + 1} of ${t.plan.length}. These ${through.length} went through:`, rows(w.qualified),
        { again: 'New tournament', tokens: Save.award(REWARDS.knockedOut) });
    }
  }

  function hazards(r) {
    const C = world.C;
    if (r.inv > 0 || r.shield > 0 || r.finished) return;
    const H = r.dive > 0 ? 0.8 : 1.6;
    for (const s of C.sweeps) {
      if (Math.abs(s.c.z - r.pos.z) > s.R + 1) continue;
      if (r.pos.y > s.c.y + 0.28 || r.pos.y + H < s.c.y - 0.28) continue;
      const px = r.pos.x - s.c.x, pz = r.pos.z - s.c.z;
      const ux = Math.sin(s.ang), uz = Math.cos(s.ang);
      const along = px * ux + pz * uz;
      if (Math.abs(along) > s.R) continue;
      const perp = px * uz - pz * ux;
      if (Math.abs(perp) > 0.62) continue;
      const tx = -uz * Math.sign(along) * -Math.sign(s.w), tz = ux * Math.sign(along) * -Math.sign(s.w);
      // The arena is small, so its bats shove rather than launch.
      if (C.survival) knock(r, tx, tz, 5.5 + Math.abs(s.w) * Math.abs(along) * 0.3, 5.5);
      else knock(r, tx, tz, 7 + Math.abs(s.w) * Math.abs(along) * 0.6, 7);
    }
    for (const p of C.pends) {
      const cx = r.pos.x - p.bob.x, cy = r.pos.y + H / 2 - p.bob.y, cz = r.pos.z - p.pivot.z;
      if (Math.abs(cz) > 1.8 || Math.hypot(cx, cy) > 1.3) continue;
      knock(r, Math.sign(p.vx) || 1, 0.25, 13, 7);
    }
    for (const b of C.rollers) {
      const dx = r.pos.x - b.pos.x, dz = r.pos.z - b.pos.z;
      if (r.pos.y > b.pos.y + 1.1 || Math.hypot(dx, dz) > b.r + RAD) continue;
      knock(r, dx * 0.6, -1, 11, 6);
    }
  }

  const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

  function showResult(title, sub, rows, labels = {}) {
    $('#res-title').textContent = title;
    $('#res-sub').textContent = sub;
    $('#res-rows').innerHTML = rows.map((r) => `
      <div class="rrow${r.win ? ' win' : ''}${r.me ? ' me' : ''}">
        <span class="rl">${r.label}</span><span class="rn">${r.name}<small>${r.sub || ''}</small></span><span class="rv">${r.val}</span>
      </div>`).join('');
    $('#res-again').hidden = !labels.again;
    $('#res-again').textContent = labels.again || '';
    $('#res-next').hidden = !labels.next;
    $('#res-next').textContent = labels.next || '';
    $('#res-tokens').innerHTML = labels.tokens ? `+${labels.tokens} <span class="coin"></span> tokens` : '';
    $('#res-tokens').classList.toggle('on', !!labels.tokens);
    setHud(null);
    showScreen('scr-result');
    updateTokens();
  }

  // HUD nodes are made once per race and then only nudged.
  let hud = null;
  function setupRaceHud() {
    const w = world;
    const prog = $('#hr-prog');
    prog.hidden = !!w.C.survival;
    prog.innerHTML = '<i></i>' + w.racers.map((r) => `<b class="${r.human ? 'me' : ''}" style="background:${r.human ? '' : r.p.jersey}"></b>`).join('');
    $('#hr-feed').innerHTML = '';
    hud = { fill: prog.querySelector('i'), dots: [...prog.querySelectorAll('b')], place: '', time: '', abF: -1, ready: null };
  }

  function updateRaceVisuals(dt) {
    const w = world, C = w.C;
    for (const r of w.racers) {
      if (!active(r)) continue;
      const b = r.bean;
      b.root.position.copy(r.pos);
      b.root.rotation.y = r.yaw;
      const sp = Math.hypot(r.vel.x, r.vel.z);
      animRun(b, {
        speed: clamp(sp / 9, 0, 1), air: !r.ground && r.vel.y !== 0, dive: r.dive > 0 && r.stun <= 0, stun: r.stun > 0,
      }, dt);
      if (r.finished) {
        b.root.position.y += Math.abs(Math.sin(w.t * 6)) * 0.4;
        b.armR.rotation.x = -2.9; b.armL.rotation.x = -2.9;
        if (r.trophy) b.root.rotation.y += w.t * 3;
      }
      r.bubble.visible = r.shield > 0;
      r.tag.visible = !r.human || w.state === 'count';
      b.root.visible = r.inv <= 0.6 || Math.floor(r.inv * 12) % 2 === 0;
      // A soft blob under every bean, on whatever is below it.
      const gy = groundAt(r.pos.x, r.pos.z, r.pos.y - 12, r.pos.y + 0.05);
      r.blob.visible = gy !== null;
      if (gy !== null) {
        r.blob.position.set(r.pos.x, gy + 0.03, r.pos.z);
        const k = clamp(1 - (r.pos.y - gy) / 8, 0.3, 1);
        r.blob.scale.set(1.3 * k, 1.3 * k, 1);
      }
    }
    if (C.finish && C.finish.bat.visible) {
      C.finish.bat.rotation.y += dt * 1.6;
      C.finish.bat.position.y = C.finish.y + 1.3 + Math.sin(w.t * 2) * 0.2;
    }
    const f = w.focus || w.me;
    if (C.survival) {
      // Stay outside the arena, behind whoever we are watching, looking in.
      const len = Math.hypot(f.pos.x, f.pos.z);
      const ox = len > 1 ? f.pos.x / len : 0, oz = len > 1 ? f.pos.z / len : -1;
      const goal = V(f.pos.x + ox * 9.5, Math.max(f.pos.y, 0) + 10, f.pos.z + oz * 9.5);
      camera.position.lerp(goal, damp(3, dt));
      w.lookCur.lerp(V(f.pos.x * 0.35, 0, f.pos.z * 0.35), damp(5, dt));
    } else {
      const falling = f.pos.y < C.cps[f.cpi].y - 3;
      camera.position.lerp(V(f.pos.x * 0.55, f.pos.y + 5.2, f.pos.z - 9), damp(falling ? 1 : 5, dt));
      w.lookCur.lerp(V(f.pos.x * 0.75, f.pos.y + 1.2, f.pos.z + 6), damp(8, dt));
    }
    camera.lookAt(w.lookCur);
    w.dome.position.copy(camera.position);
    w.sun.position.set(f.pos.x + 12, f.pos.y + 30, f.pos.z - 8);
    w.sun.target.position.set(f.pos.x, f.pos.y, f.pos.z + 4);
    if (w.stars) w.stars.position.set(camera.position.x, 0, camera.position.z);
    if (w.rain) {
      w.rain.position.set(camera.position.x, camera.position.y - 10, camera.position.z);
      const a = w.rain.geometry.attributes.position;
      for (let i = 0; i < a.count; i += 2) {
        let y = a.getY(i) - dt * 30;
        if (y < -10) y += 40;
        a.setY(i, y); a.setY(i + 1, y - 0.6);
      }
      a.needsUpdate = true;
    }
    // HUD, touching the DOM only when something changed.
    const me = w.me;
    let place;
    if (C.survival) place = `${w.racers.filter((r) => !r.out).length}<small> alive · need ${w.opts.need}</small>`;
    else if (!C.finish) place = `${w.qualified.length}<small>/${w.opts.need} in</small>`;
    else place = `${ORD(me.place)}<small>/${w.racers.length}</small>`;
    if (place !== hud.place) { $('#hr-place').innerHTML = place; hud.place = place; }
    const tt = C.survival ? `${Math.max(0, Math.ceil(SURVIVE_T - (w.state === 'count' ? 0 : C.time)))}s left` : fmtTime(w.state === 'count' ? 0 : w.t);
    if (tt !== hud.time) { $('#hr-time').textContent = tt; hud.time = tt; }
    const ab = ABILITIES[me.p.ability];
    const frac = Math.round((1 - me.abCd / (ab.cd * (me.p.cdMul || 1))) * 50) / 50;
    if (frac !== hud.abF) { $('#hr-ab').style.setProperty('--f', frac); hud.abF = frac; }
    const ready = me.abCd <= 0;
    if (ready !== hud.ready) { $('#hr-ab').classList.toggle('ready', ready); hud.ready = ready; }
    if (!C.survival) {
      const end = C.endZ || 1;
      hud.fill.style.width = (clamp(me.pos.z / end, 0, 1) * 100).toFixed(1) + '%';
      w.racers.forEach((r, i) => {
        const d = hud.dots[i];
        d.style.left = (r.qualified ? 100 : clamp(r.pos.z / end, 0, 1) * 100).toFixed(1) + '%';
      });
    }
    if (cpFlashT > 0) { cpFlashT -= dt; if (cpFlashT <= 0) $('#hr-cp').classList.remove('on'); }
  }

  /* ========================================================= shop & binder */
  const COIN = '<span class="coin"></span>';
  function updateTokens() { $('#tokens b').textContent = Save.tokens; }

  // Card portraits: the real bean, rendered once on a small canvas of its own.
  let pr = null;
  const portraitCache = new Map();
  function portrait(p) {
    if (portraitCache.has(p.id)) return portraitCache.get(p.id);
    if (!pr) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(160, 180);
      r.outputEncoding = THREE.sRGBEncoding;
      r.setClearColor(0x000000, 0);
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight('#ffffff', '#6a7ad0', 1.0));
      const d = new THREE.DirectionalLight('#fff2d6', 0.9);
      d.position.set(2, 3, 4);
      s.add(d);
      const cam = new THREE.PerspectiveCamera(30, 160 / 180, 0.1, 20);
      cam.position.set(0.9, 1.35, 3.7);
      cam.lookAt(0, 0.88, 0);
      const holder = new THREE.Group();
      s.add(holder);
      pr = { r, s, cam, holder };
    }
    while (pr.holder.children.length) pr.holder.remove(pr.holder.children[0]);
    const b = makeBean(p);
    b.root.rotation.y = 0.3;
    b.armR.rotation.x = -0.5;
    b.batPivot.rotation.z = 1.1;
    pr.holder.add(b.root);
    pr.r.render(pr.s, pr.cam);
    const url = pr.r.domElement.toDataURL();
    portraitCache.set(p.id, url);
    return url;
  }
  const RARITY_LABEL = { legend: 'LEGEND', rare: 'RARE', common: 'COMMON' };
  function cardHTML(p, holo, extra = '') {
    const r = Save.rarity(p);
    return `<div class="bcard r-${r}${holo ? ' holo' : ''}" style="--j:${p.jersey};--t:${p.trim}">
      <div class="bc-top"><span>#${p.num}</span><span>${holo ? 'HOLO ' : ''}${RARITY_LABEL[r]}</span></div>
      <img class="bc-img" src="${portrait(p)}" alt="">
      <div class="bc-name">${p.name}</div><div class="bc-nick">“${p.nick}”</div>
      <div class="bc-stats"><span>PWR ${p.pow}</span><span>CON ${p.con}</span><span>SPD ${p.spd}</span></div>${extra}</div>`;
  }
  const skinned = (base, s) => (s.jersey ? Object.assign({}, base, { jersey: s.jersey, trim: s.trim, cap: s.cap, id: `${base.id}@skin@${s.id}` }) : base);

  let shopTab = 'gear';
  let shopBack = toTitle;
  function openShop(tab, back) {
    if (tab) shopTab = tab;
    shopBack = back || toTitle;
    showScreen('scr-shop');
    renderShop();
  }
  function shopNote(t, bad) {
    const n = $('#shop-note');
    n.textContent = t;
    n.className = bad ? 'bad' : '';
  }
  function renderShop() {
    updateTokens();
    $$('#shop-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
    const D = Save.data;
    const price = (n, attr) => `<button class="btn sm${D.tokens >= n ? '' : ' dis'}" ${attr}>${COIN} ${n}</button>`;
    let h = '';
    if (shopTab === 'gear') {
      const ICON = { bat: '🏏', gloves: '🧤', cleats: '👟', helmet: '⛑️' };
      h = '<p class="shop-lead">Gear goes on whoever you pick — in every race and in the derby against the CPU.</p>' +
        GEAR_SLOTS.map((slot) => `<h4>${slot.label} <small>${slot.what}</small></h4><div class="items">` +
          EQUIPMENT.filter((e) => e.slot === slot.id).map((e) => {
            const owned = D.gear.owned.includes(e.id), on = D.gear.on[e.slot] === e.id;
            const eff = e.stat === 'cd' ? `${e.plus}% faster ability` : `+${e.plus} ${slot.what}`;
            const btn = on ? `<button class="btn sm pink" data-wear="${e.id}">Equipped ✓</button>`
              : owned ? `<button class="btn sm ghost" data-wear="${e.id}">Equip</button>` : price(e.cost, `data-buy-gear="${e.id}"`);
            return `<div class="item${on ? ' on' : ''}"><i class="ico" style="--c:${e.color}">${ICON[slot.id]}</i><b>${e.name}</b><span>${eff}</span>${btn}</div>`;
          }).join('') + '</div>').join('');
    } else if (shopTab === 'packs') {
      const have = ROSTER.filter((p) => D.cards[p.id]).length;
      h = `<p class="shop-lead">Own a player’s card and they play at <b>+1 in every stat</b> when you pick them (<b>+2</b> for a holo).
        Doubles pay back ${REWARDS.dupe} ${COIN}. A finished binder page pays ${REWARDS.page} ${COIN}. You have <b>${have}/${ROSTER.length}</b>.</p>
        <div class="packs">` + PACKS.map((pk) => `
        <div class="pack" style="--c:${pk.color}">
          <div class="pack-art"><span>BIG SWING</span><b>${pk.name.replace(' Pack', '')}</b><em>${pk.cards} cards</em></div>
          <p>${pk.blurb}</p>${price(pk.cost, `data-pack="${pk.id}"`)}
        </div>`).join('') + '</div>';
    } else if (shopTab === 'skins') {
      const base = Flow.picks[0] || PLAYER_BY_ID.nova;
      h = `<p class="shop-lead">Skins recolour your player in every mode. Shown on ${base.name}.</p><div class="skins">` + SKINS.map((s) => {
        const owned = D.skins.owned.includes(s.id), on = D.skins.on === s.id;
        const btn = on ? `<button class="btn sm pink" data-wear-skin="${s.id}">Wearing ✓</button>`
          : owned ? `<button class="btn sm ghost" data-wear-skin="${s.id}">Wear</button>` : price(s.cost, `data-buy-skin="${s.id}"`);
        return `<div class="skin${on ? ' on' : ''}"><img src="${portrait(skinned(base, s))}" alt=""><b>${s.name}</b>${btn}</div>`;
      }).join('') + '</div>';
    } else {
      h = ERAS.map((era) => {
        const list = ROSTER.filter((p) => p.era === era.id);
        const got = list.filter((p) => D.cards[p.id]).length;
        return `<h4>${era.label} <small>${got}/${list.length}${D.pages[era.id] ? ' · page complete ✓' : ''}</small></h4><div class="binder">` +
          list.map((p) => {
            const c = D.cards[p.id];
            if (!c) return `<div class="bcard missing"><div class="bc-top"><span>#${p.num}</span></div><div class="bc-q">?</div><div class="bc-name">???</div></div>`;
            return cardHTML(p, c.holo, c.n > 1 ? `<i class="bc-count">×${c.n}</i>` : '');
          }).join('') + '</div>';
      }).join('');
    }
    $('#shop-body').innerHTML = h;
  }
  $('#shop-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    shopTab = b.dataset.tab; shopNote(''); Snd.pop(); renderShop();
  });
  $('#shop-back').addEventListener('click', () => shopBack());
  $('#btn-shop').addEventListener('click', () => { Snd.unlock(); openShop('gear'); });
  $('#shop-body').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    const broke = () => { shopNote('Not enough tokens yet — win a derby or a race.', true); Snd.groan(); };
    if (d.buyGear) {
      if (Save.buyGear(d.buyGear)) { Snd.win(); shopNote(`Bought and equipped the ${EQUIPMENT.find((x) => x.id === d.buyGear).name}.`); } else broke();
    } else if (d.wear) { Save.wearGear(d.wear); Snd.pop(); }
    else if (d.buySkin) {
      if (Save.buySkin(d.buySkin)) { Snd.win(); shopNote('New skin on.'); } else broke();
    } else if (d.wearSkin) { Save.wearSkin(d.wearSkin); Snd.pop(); }
    else if (d.pack) {
      const res = Save.openPack(d.pack);
      if (!res) { broke(); return; }
      showPack(PACKS.find((x) => x.id === d.pack), res);
    }
    renderShop();
  });

  function showPack(pk, res) {
    Snd.organ();
    const el = $('#pack-open');
    el.hidden = false;
    el.querySelector('.pack-cards').innerHTML = res.cards.map((c, i) => {
      const tag = c.upgraded ? '<i class="bc-tag new">HOLO UPGRADE!</i>' : c.isNew ? '<i class="bc-tag new">NEW!</i>'
        : `<i class="bc-tag">+${c.dupeTokens} ${COIN}</i>`;
      return `<div class="flip" data-i="${i}" data-r="${Save.rarity(c.p)}" style="--d:${i * 0.08}s">
        <div class="flip-in"><div class="flip-back" style="--c:${pk.color}"><span>BIG<br>SWING</span></div>
        <div class="flip-front">${cardHTML(c.p, c.holo, tag)}</div></div></div>`;
    }).join('');
    el.querySelector('.pack-msg').innerHTML = res.pageDone.length
      ? `Page complete: ${res.pageDone.join(', ')}! +${REWARDS.page * res.pageDone.length} ${COIN}` : 'Tap a card to flip it.';
  }
  $('#pack-open').addEventListener('click', (e) => {
    const f = e.target.closest('.flip');
    if (f && !f.classList.contains('open')) {
      f.classList.add('open');
      if (f.dataset.r === 'legend') { Snd.cheer(1.6, 0.3); Snd.win(); } else Snd.pop();
    }
  });
  $('#pack-all').addEventListener('click', () => $$('#pack-open .flip:not(.open)').forEach((f, i) => setTimeout(() => f.click(), i * 140)));
  $('#pack-done').addEventListener('click', () => { $('#pack-open').hidden = true; renderShop(); });

  /* ================================================================ touch */
  (function setupTouch() {
    const stick = $('#stick'), knob = $('#stick i');
    let id = null, ox = 0, oy = 0;
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = stick.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const l = Math.hypot(dx, dy), max = 50;
        if (l > max) { dx *= max / l; dy *= max / l; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        touch.mx = -dx / max; touch.mz = -dy / max;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) { id = null; touch.mx = touch.mz = 0; knob.style.transform = ''; }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);
    for (const b of $$('[data-touch]')) {
      b.addEventListener('touchstart', (e) => {
        Snd.unlock();
        const k = b.dataset.touch;
        touch[k] = true;
        e.preventDefault();
      }, { passive: false });
      b.addEventListener('touchend', () => { if (b.dataset.touch === 'ff') touch.ff = false; });
    }
    let lx = null, ly = null;
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; lx = t.clientX; ly = t.clientY; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (mode !== 'derby' || !world || world.bats[world.cur].cpu) return;
      const t = e.touches[0];
      world.pciPos.x -= (t.clientX - lx) * 0.004;
      world.pciPos.y -= (t.clientY - ly) * 0.004;
      lx = t.clientX; ly = t.clientY;
      e.preventDefault();
    }, { passive: false });
  })();

  /* ================================================================= loop */
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0, clock = 0;
  let perfT = 0, perfN = 0, perfSlow = 0;
  function update(dt) {
    clock += dt;
    if (mode === 'menu') { updateShow(dt, clock); return; }
    if (paused || !world) return;
    if (mode === 'derby') {
      const B = world.bats[world.cur];
      const ff = B && B.cpu && (held('KeyF') || touch.ff) && world.state !== 'done';
      const n = ff ? 3 : 1;
      for (let i = 0; i < n; i++) if (world && world.kind === 'derby') derbyStep(dt);
      tickBanner(dt * n);
    } else if (mode === 'race') {
      raceStep(dt);
      if (world) updateRaceVisuals(dt);
      tickBanner(dt);
    }
  }
  function render() {
    if (mode === 'menu') renderer.render(show.scene, camera);
    else if (world) renderer.render(world.scene, camera);
  }
  function frame(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.1, raw);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 4) { update(STEP); acc -= STEP; n++; }
    if (n === 4) acc = 0;
    if (n > 0) pressed.clear();
    render();
    // Watch our own frame rate: two slow seconds in a row costs a quality step.
    // A stall longer than a quarter second is a hidden tab, not a slow machine.
    if (raw < 0.25 && mode !== 'menu') {
      perfT += raw; perfN++;
      if (perfT > 1) {
        const fps = perfN / perfT;
        perfSlow = fps < 42 ? perfSlow + 1 : 0;
        if (perfSlow >= 2 && quality > 0) { quality--; applyQuality(); perfSlow = 0; }
        perfT = 0; perfN = 0;
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  toTitle();
  requestAnimationFrame(frame);
})();
