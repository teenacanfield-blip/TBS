/* Octant Vanguard — screens, HUD, dialogue, hangar, settings, flow */
'use strict';

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');

/* ================= DIALOGUE ================= */
const Dialog = {
  lines: null, i: 0, shown: 0, full: '', who: 'sys', done: null, active: false, ctx: null,
  play(lines, done) {
    this.ctx = this.ctx || $('dlg-portrait').getContext('2d');
    this.lines = lines; this.i = -1; this.done = done; this.active = true; G.dialog = true;
    $('dialog').hidden = false;
    $('dlg-voice').textContent = Voice.label();
    UI.hideBark();
    this.next();
  },
  next() {
    this.i++;
    if (this.i >= this.lines.length) return this.finish();
    const [who, raw] = this.lines[this.i];
    const text = raw.replace(/\{cs\}/g, Save.d.cs);
    const ch = CHARACTERS[who] || CHARACTERS.sys;
    this.who = who; this.full = text; this.shown = 0;
    $('dlg-name').textContent = ch.name.replace('{cs}', Save.d.cs);
    $('dlg-name').style.color = ch.color;
    $('dlg-box').style.setProperty('--edge', rgba(ch.color, 0.55));
    $('dlg-text').textContent = '';
    Voice.speak(who, text);
    Sound.sfx('blip');
  },
  advance() {
    if (!this.active) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; $('dlg-text').textContent = this.full; }
    else this.next();
  },
  skip() { this.finish(); },
  finish() {
    Voice.stop();
    this.active = false; G.dialog = false;
    $('dialog').hidden = true;
    const d = this.done; this.done = null;
    if (d) d();
  },
  update(dt) {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      const before = this.shown | 0;
      this.shown = Math.min(this.full.length, this.shown + dt * 50);
      if ((this.shown | 0) !== before) { $('dlg-text').textContent = this.full.slice(0, this.shown | 0); if ((this.shown | 0) % 3 === 0) Sound.sfx('blip'); }
    }
    drawPortrait(this.ctx, this.who, this.ctx.canvas.width, this.ctx.canvas.height, G.t, this.shown < this.full.length || Voice.speaking);
  },
};

/* ================= UI ================= */
const UI = {
  modalStack: [], pcards: [], barkT: 0, barkWho: 'sys', bannerT: 0, toastT: 0, hangarTab: 'ship', briefed: {}, lastHud: {}, hudT: 0,

  init() {
    const s = Save.d.settings;
    Voice.mode = s.voice;
    $('callsign').value = Save.d.cs;
    $('btn-continue').hidden = !Save.has;
    if (!Save.has) $('btn-new').classList.add('primary');
    // title
    $('btn-continue').onclick = () => { this.boot(); this.saveCallsign(); this.toMap(); };
    $('btn-new').onclick = e => {
      this.boot();
      const b = e.currentTarget;
      if (Save.has && !b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Erase save and start?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'New campaign'; }, 3500); return; }
      Save.reset(this.cleanCallsign()); Save.has = true; Save.d.prologue = true; Save.write();
      this.hideAll(); G.state = 'map';
      $('scr-map').hidden = true;
      Dialog.play(STORY.prologue, () => this.toMap());
    };
    $('btn-coop-title').onclick = () => { this.boot(); this.saveCallsign(); this.openModal('scr-coop'); };
    $('btn-settings-title').onclick = () => { this.boot(); this.openModal('scr-settings'); };
    $('callsign').addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9 _-]/g, ''); if (v !== e.target.value) e.target.value = v; });
    // map
    $('btn-hangar').onclick = () => this.openModal('scr-hangar');
    $('btn-coop').onclick = () => this.openModal('scr-coop');
    $('btn-settings').onclick = () => this.openModal('scr-settings');
    $('btn-title').onclick = () => this.goTitle();
    $('chk-p2').onchange = e => { G.coopLocal = e.target.checked; };
    $('btn-launch').onclick = () => {
      const i = MapView.sel, st = planetStatus(i);
      if (st.locked) return;
      this.startMission(i, { patrol: st.saved });
    };
    // modals
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closeModal(b.closest('.screen').id));
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => { this.hangarTab = t.dataset.tab; document.querySelectorAll('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); }); this.renderHangar(); });
    // settings
    $('set-voice').value = s.voice;
    $('set-voice').onchange = e => { s.voice = Voice.mode = e.target.value; Save.write(); this.updateVoiceNote(); if (s.voice === 'off') Voice.stop(); };
    const rng = (id, key, apply) => { const el = $(id), out = $('out-' + id.split('-')[1]); el.value = s[key]; out.textContent = Math.round(s[key] * 100); el.oninput = () => { s[key] = +el.value; out.textContent = Math.round(s[key] * 100); apply(); Save.write(); }; };
    rng('set-mus', 'mus', () => Sound.setVolumes(s.sfx, s.mus));
    rng('set-sfx', 'sfx', () => { Sound.setVolumes(s.sfx, s.mus); Sound.sfx('ui'); });
    $('set-shake').checked = s.shake; $('set-shake').onchange = e => { s.shake = e.target.checked; Save.write(); };
    $('btn-reset').onclick = e => {
      const b = e.currentTarget;
      if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Click again to erase everything'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Erase campaign progress'; }, 3500); return; }
      Save.reset(Save.d.cs); Save.has = false; b.dataset.confirm = ''; b.textContent = 'Erase campaign progress';
      this.toast('Campaign erased'); this.closeModal('scr-settings'); this.goTitle();
    };
    // pause
    $('btn-pause').onclick = () => this.togglePause();
    $('btn-resume').onclick = () => this.togglePause(false);
    $('btn-pause-settings').onclick = () => this.openModal('scr-settings');
    $('btn-abandon').onclick = () => { this.togglePause(false); const w = G.world; if (w && w.phase === 'play') { w.earned *= 0.5; endMission(w, false, 'abandon'); } };
    // results
    $('btn-res-continue').onclick = () => {
      $('scr-results').hidden = true;
      if (Net.role === 'guest') { if (G.state !== 'guest') Net.showLobby(`${Net.hostCs} is choosing the next planet…`); else $('hud').hidden = false; }
      else this.toMap();
    };
    $('btn-res-retry').onclick = () => { $('scr-results').hidden = true; const w = this.lastWorld; this.startMission(w.idx, { patrol: planetStatus(w.idx).saved }); };
    // dialog
    $('dlg-box').addEventListener('click', () => Dialog.advance());
    $('dlg-skip').addEventListener('click', e => { e.stopPropagation(); Dialog.skip(); });
    // touch
    const tb = $('tb-boost');
    tb.addEventListener('pointerdown', e => { e.preventDefault(); Input.touch.boost = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => tb.addEventListener(ev, () => { Input.touch.boost = false; }));
    $('tb-nova').addEventListener('pointerdown', e => { e.preventDefault(); Input.touch.nova = true; });
    // guest lobby
    $('btn-guest-hangar').onclick = () => this.openModal('scr-hangar');
    $('btn-guest-leave').onclick = () => Net.leaveGuest();
    this.updateVoiceNote();
    Voice.init().then(() => this.updateVoiceNote());
    Voice.onStateCb = () => {};
  },
  boot() {
    Sound.init();
    Sound.setVolumes(Save.d.settings.sfx, Save.d.settings.mus);
  },
  cleanCallsign() { return ($('callsign').value || 'NOVA').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12) || 'NOVA'; },
  saveCallsign() { Save.d.cs = this.cleanCallsign(); Save.write(); },
  updateVoiceNote() {
    const eng = Voice.engine();
    $('voice-engine').textContent = Voice.mode === 'off' ? 'Dialogue is shown as text only.' : eng === 'claude' ? 'Characters speak in Claude voices.' : eng === 'browser' ? 'Characters speak with your browser’s built-in voices.' : 'Voices are not available in this view; dialogue is shown as text.';
  },
  hideAll() {
    ['scr-title', 'scr-map', 'scr-hangar', 'scr-coop', 'scr-settings', 'scr-pause', 'scr-results', 'scr-guest', 'hud'].forEach(id => { $(id).hidden = true; });
    this.modalStack = [];
  },
  goTitle() {
    if (Net.role === 'guest') Net.leaveGuest(true);
    G.state = 'title'; G.world = null; G.paused = false;
    this.hideAll(); $('scr-title').hidden = false;
    $('btn-continue').hidden = !Save.has;
    $('btn-new').classList.toggle('primary', !Save.has);
    $('callsign').value = Save.d.cs;
    Sound.setMusic('calm', 0);
    cv.style.cursor = '';
  },
  toMap() {
    G.state = 'map'; G.world = null; G.paused = false;
    this.hideAll(); $('scr-map').hidden = false;
    $('chk-p2').checked = G.coopLocal;
    const sel = Math.min(Save.d.progress, 7);
    MapView.sel = sel; this.selectPlanet(sel);
    this.refreshMap();
    Sound.setMusic('calm', 0);
    cv.style.cursor = '';
    Net.onMap();
  },
  refreshMap() {
    $('map-credits').textContent = fmt(Save.d.credits);
    $('map-saved').textContent = `${Math.min(8, Save.d.progress)} / 8`;
  },
  selectPlanet(i) {
    const P = PLANETS[i], { saved, cur, locked } = planetStatus(i);
    $('pp-chapter').textContent = P.side ? 'Side story' : `Chapter ${P.chapter}`;
    $('pp-name').textContent = P.name;
    $('pp-title').textContent = P.title;
    $('pp-desc').textContent = P.desc;
    $('pp-kind').textContent = P.kind;
    const m = P.mission;
    let mt = m.kind === 'survive' ? 'Survive 2:00' : `${m.waves.length} waves`;
    if (m.waves && m.waves.some(wv => wv.some(([t]) => ENEMY_TYPES[t].boss))) mt += ' + boss';
    if (m.hazard === 'asteroids') mt += ' · asteroids';
    if (m.hazard === 'dark') mt += ' · darkness';
    $('pp-mission').textContent = mt;
    $('pp-threat').innerHTML = Array.from({ length: 8 }, (_, k) => `<i class="${k < P.threat ? 'on' : ''}"></i>`).join('');
    $('pp-reward').textContent = `${fmt(saved ? P.reward * 0.4 : P.reward)} cr`;
    const st = $('pp-status'), btn = $('btn-launch');
    st.className = 'status' + (cur ? ' attack' : locked ? ' locked' : '');
    if (saved) { st.textContent = 'Saved · patrols open'; btn.textContent = 'Fly patrol'; btn.disabled = false; $('pp-hint').textContent = 'Patrols pay 40% of the mission reward, plus every credit you collect.'; }
    else if (cur) { st.textContent = P.side ? 'Friends need help' : 'Under attack'; btn.textContent = 'Launch mission'; btn.disabled = false; $('pp-hint').textContent = P.crew ? `Save ${P.name} and ${CREW[P.crew].name} joins your team.` : 'Save it to continue the story.'; }
    else { st.textContent = 'Locked'; btn.textContent = 'Locked'; btn.disabled = true; $('pp-hint').textContent = P.side ? 'Save Verdance first.' : `Save ${PLANETS[i - 1].name} first.`; }
    const n = Net.remoteCount();
    if (Net.role === 'host') $('pp-hint').textContent += n ? ` ${n} wingmate${n > 1 ? 's' : ''} will launch with you.` : ' Your online game is open.';
  },

  /* ---------- modals ---------- */
  openModal(id) {
    $(id).hidden = false; this.modalStack.push(id);
    if (id === 'scr-hangar') { this.renderHangar(); $('hg-credits').textContent = fmt(Save.d.credits); }
    if (id === 'scr-coop') Net.openPanel();
    if (id === 'scr-settings') this.updateVoiceNote();
    Sound.sfx('ui');
    const f = $(id).querySelector('button, input, select'); if (f) f.focus({ preventScroll: true });
  },
  closeModal(id) {
    $(id).hidden = true; this.modalStack = this.modalStack.filter(x => x !== id);
    if (G.state === 'map') { this.refreshMap(); this.selectPlanet(MapView.sel); }
  },
  togglePause(force) {
    if (G.state !== 'mission' || !G.world) return;
    const w = G.world;
    if (w.phase === 'win' || w.phase === 'lose') return;
    G.paused = force === undefined ? !G.paused : force;
    $('scr-pause').hidden = !G.paused;
    $('pause-note').textContent = Net.role === 'host' && Net.remoteCount() ? 'Your wingmates are paused too.' : 'The Vorr wait for no one, but they will wait for you.';
    if (!G.paused) { $('scr-settings').hidden = true; Input.mouse.down = false; }
  },

  /* ---------- hangar ---------- */
  renderHangar() {
    const list = $('hg-list'); list.textContent = '';
    $('hg-credits').textContent = fmt(Save.d.credits);
    const pips = (lv, max) => `<div class="pips" aria-label="Level ${lv} of ${max}">${Array.from({ length: max }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div>`;
    if (this.hangarTab === 'ship') {
      $('hg-blurb').textContent = 'An octagonal hull built around the first Octacore ever found. Upgrades carry between missions.';
      for (const u of UPGRADES) {
        const lv = Save.d.upg[u.id], max = lv >= UPG_MAX, cost = upgCost(lv);
        const el = document.createElement('div'); el.className = 'oct card';
        el.innerHTML = `<h3></h3><div class="now"></div><div class="next"></div>${pips(lv, UPG_MAX)}<button class="btn small"></button>`;
        el.querySelector('h3').textContent = u.name;
        el.querySelector('.now').textContent = u.desc(lv);
        el.querySelector('.next').textContent = max ? 'Fully upgraded' : 'Next: ' + u.desc(lv + 1);
        const b = el.querySelector('button');
        b.textContent = max ? 'Maxed' : `Upgrade · ${fmt(cost)} cr`;
        b.disabled = max || Save.d.credits < cost;
        if (!max && Save.d.credits >= cost) b.classList.add('primary');
        b.onclick = () => { if (Save.d.credits < cost || max) { Sound.sfx('deny'); return; } Save.d.credits -= cost; Save.d.upg[u.id]++; Save.write(); Sound.sfx('buy'); this.renderHangar(); };
        list.append(el);
      }
    } else {
      $('hg-blurb').textContent = 'Your team fights beside you. Pilots and drones fly in every mission; specialists boost the Vanguard.';
      for (const id of CREW_ORDER) {
        const c = CREW[id], lv = Save.d.crew[id], max = lv >= CREW_MAX, cost = crewCost(lv);
        const el = document.createElement('div'); el.className = 'oct card';
        el.innerHTML = `<div class="card-head"><canvas width="32" height="32"></canvas><div><h3></h3><div class="role"></div></div></div><p></p><div class="now"></div><div class="next"></div>${lv ? pips(lv, CREW_MAX) : ''}<button class="btn small"></button>`;
        el.querySelector('h3').textContent = c.name;
        el.querySelector('.role').textContent = c.role + (c.ship ? ' · flies with you' : ' · specialist');
        el.querySelector('p').textContent = c.blurb;
        drawPortrait(el.querySelector('canvas').getContext('2d'), id, 32, 32, 0.3, false);
        const b = el.querySelector('button');
        if (!lv) {
          el.querySelector('.now').textContent = '';
          el.querySelector('.next').innerHTML = '';
          const note = document.createElement('div'); note.className = 'locked-note'; note.textContent = PLANETS[c.joins].side ? `Joins after the ${PLANETS[c.joins].name} side story` : `Joins after Chapter ${PLANETS[c.joins].chapter} · ${PLANETS[c.joins].name}`;
          el.querySelector('.next').append(note);
          b.textContent = 'Not on the team yet'; b.disabled = true;
        } else {
          el.querySelector('.now').textContent = c.perk(lv);
          el.querySelector('.next').textContent = max ? 'Fully trained' : 'Next: ' + c.perk(lv + 1);
          b.textContent = max ? 'Maxed' : `Train · ${fmt(cost)} cr`;
          b.disabled = max || Save.d.credits < cost;
          if (!max && Save.d.credits >= cost) b.classList.add('primary');
          b.onclick = () => { if (Save.d.credits < cost || max) { Sound.sfx('deny'); return; } Save.d.credits -= cost; Save.d.crew[id]++; Save.write(); Sound.sfx('buy'); Voice.speak(id, ['Upgrades installed. I feel faster already.', 'Nice. Let us put this to work.', 'Calibrated and ready, Commander.'][Math.random() * 3 | 0]); this.renderHangar(); };
        }
        list.append(el);
      }
    }
  },
  drawHangarPreview() {
    const c = $('hg-preview'), g = c.getContext('2d'), W = c.width;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W);
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, '#ffb347', W / 2, W / 2, W * 0.45, 0.25);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,198,92,0.25)'; g.lineWidth = 2; octPath(g, W * 0.42, G.t * 0.1, W / 2, W / 2); g.stroke();
    g.setLineDash([6, 10]); octPath(g, W * 0.34, -G.t * 0.15, W / 2, W / 2); g.stroke(); g.setLineDash([]);
    const sc = W / 120;
    drawVanguard(g, W / 2, W / 2, -Math.PI / 2 + Math.sin(G.t * 0.6) * 0.25, SCHEMES[0], G.t, 0.5 + Math.sin(G.t * 2) * 0.3, false, 0.25, 0, sc);
  },

  /* ---------- mission flow ---------- */
  startMission(idx, opts = {}) {
    if (Net.role === 'guest') return;
    this.saveCallsign();
    const w = newWorld(idx, opts);
    G.world = w; G.state = 'mission'; G.paused = false;
    this.hideAll(); $('hud').hidden = false;
    this.buildPlayerCards(w);
    this.lastHud = {};
    $('hud-boss').hidden = true;
    $('touch-btns').hidden = !Input.touch.used;
    cv.style.cursor = Input.touch.used ? '' : 'none';
    Net.onMissionStart(w);
    Sound.setMusic('calm', 0.5);
    Sound.sfx('warp');
    const P = PLANETS[idx];
    const pre = STORY[P.id + '_pre'];
    if (!w.patrol && pre && !this.briefed[idx]) {
      this.briefed[idx] = true;
      setTimeout(() => { if (G.world === w) Dialog.play(pre, () => { if (G.world === w) beginPlay(w); }); }, 700);
    } else {
      this.banner(P.name, w.patrol ? 'Patrol' : P.title);
      setTimeout(() => { if (G.world === w && w.phase === 'brief') beginPlay(w); }, 1800);
    }
  },
  buildPlayerCards(w) {
    const wrap = $('hud-players'); wrap.textContent = '';
    this.pcards = w.players.filter(p => p.kind === 'local').map(p => {
      const el = document.createElement('div'); el.className = 'oct pcard';
      const label = { hull: 'Hull', shield: 'Shield', fuel: 'Rocket fuel', nova: 'Nova' };
      el.innerHTML = `<div class="pc-head"><b></b><span></span></div>` + ['hull', 'shield', 'fuel', 'nova'].map(k => `<div class="meter ${k}"><span>${label[k]}</span><div class="bar"><i></i></div><em></em></div>`).join('');
      el.querySelector('b').textContent = (p.idx === 0 ? 'Cmdr ' : 'Wing ') + (p.idx === 0 ? Save.d.cs : 'P2');
      el.querySelector('b').style.color = p.scheme.shield;
      el.querySelector('.pc-head span').textContent = p.idx === 0 ? 'P1' : 'P2';
      wrap.append(el);
      const m = k => el.querySelector('.meter.' + k);
      return { p, el, hull: m('hull'), shield: m('shield'), fuel: m('fuel'), nova: m('nova'), last: {} };
    });
  },
  setBar(meter, frac, text, cache, key) {
    const f = Math.round(clamp(frac, 0, 1) * 200) / 200;
    if (cache[key] !== f) { cache[key] = f; meter.querySelector('i').style.transform = `scaleX(${f})`; }
    if (cache[key + 't'] !== text) { cache[key + 't'] = text; meter.querySelector('em').textContent = text; }
  },
  updateHUD(w) {
    for (const c of this.pcards) {
      const p = c.p, st = p.st, L = c.last;
      this.setBar(c.hull, p.hull / st.hullMax, Math.ceil(p.hull), L, 'h');
      this.setBar(c.shield, p.shield / st.shieldMax, Math.ceil(p.shield), L, 's');
      this.setBar(c.fuel, p.fuel / st.fuelMax, Math.ceil(p.fuel / st.fuelMax * 100) + '%', L, 'f');
      const nf = 1 - p.novaCd / st.novaCd;
      this.setBar(c.nova, nf, p.novaCd <= 0 ? 'Ready' : Math.ceil(p.novaCd) + 's', L, 'n');
      const low = p.fuel < st.fuelMax * 0.2;
      if (L.low !== low) { L.low = low; c.fuel.classList.toggle('low', low); }
      if (L.ref !== p.refuel) { L.ref = p.refuel; c.fuel.classList.toggle('refuel', !!p.refuel); }
      const ready = p.novaCd <= 0;
      if (L.ready !== ready) { L.ready = ready; c.nova.classList.toggle('ready', ready); }
      if (L.dead !== p.dead) { L.dead = p.dead; c.el.classList.toggle('dead', p.dead); }
    }
    const H = this.lastHud;
    let mission;
    if (w.survive) mission = `${w.P.name} <small>Seal resonance ${Math.min(100, Math.floor(w.survive.t / w.survive.dur * 100))}%</small>`;
    else mission = `${w.P.name} <small>${w.wave >= 0 ? `Wave ${w.wave + 1} of ${w.P.mission.waves.length}` : 'Approaching'}${w.enemies ? ` · ${w.enemies.length} hostiles` : ''}</small>`;
    if (H.m !== mission) { H.m = mission; $('hud-mission').innerHTML = mission; }
    const pf = Math.round(clamp(w.planet.hp / w.planet.maxHp, 0, 1) * 300) / 300;
    if (H.pf !== pf) { H.pf = pf; $('hud-planet').style.transform = `scaleX(${pf})`; $('hud-planet-wrap').classList.toggle('crit', pf < 0.3); }
    const cr = fmt(w.earned);
    if (H.cr !== cr) { H.cr = cr; $('hud-credits').textContent = cr; }
    const pods = w.pods === undefined ? '—' : String(w.pods);
    if (H.pods !== pods) { H.pods = pods; $('hud-pods').textContent = pods; }
  },
  bossBar(name, frac) {
    const el = $('hud-boss');
    if (!name) { el.hidden = true; return; }
    el.hidden = false;
    if (this.lastHud.bn !== name) { this.lastHud.bn = name; $('hud-boss-name').textContent = name; }
    const f = Math.round(clamp(frac, 0, 1) * 300) / 300;
    if (this.lastHud.bf !== f) { this.lastHud.bf = f; $('hud-boss-bar').style.transform = `scaleX(${f})`; }
  },
  banner(text, sub) {
    $('banner-text').textContent = text; $('banner-sub').textContent = sub || '';
    $('banner').classList.add('show'); this.bannerT = 2.4;
    if (Net.role === 'host') Net.noteBanner(text, sub);
  },
  showBark(who, text) {
    const ch = CHARACTERS[who] || CHARACTERS.sys;
    $('bark').hidden = false;
    $('bark-name').textContent = ch.name.replace('{cs}', Save.d.cs); $('bark-name').style.color = ch.color;
    $('bark-text').textContent = text;
    $('bark').style.setProperty('--edge', rgba(ch.color, 0.5));
    this.barkT = 5.5; this.barkWho = who;
  },
  hideBark() { $('bark').hidden = true; this.barkT = 0; },
  showTouch(on) { if (G.state === 'mission' || G.state === 'guest') $('touch-btns').hidden = !on; },
  toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; this.toastT = 3; },

  missionOver(w) {
    this.lastWorld = w;
    const P = w.P, win = w.phase === 'win';
    const first = win && !w.patrol && (P.side ? !Save.d.side[P.id] : w.idx === Save.d.progress);
    const reward = win ? Math.round(first ? P.reward : P.reward * 0.4) : 0;
    const collected = Math.round(w.earned);
    Save.d.credits += collected + reward;
    if (win) Save.d.wins++;
    let joined = null;
    if (first) {
      if (P.side) Save.d.side[P.id] = true; else Save.d.progress++;
      if (P.crew && !Save.d.crew[P.crew]) { Save.d.crew[P.crew] = 1; joined = P.crew; }
      if (P.id === 'prime') Save.d.ended = true;
    }
    Save.write(); Save.has = true;
    const rows = [
      ['Aliens destroyed', fmt(w.kills)],
      ['Credits collected', fmt(collected) + ' cr'],
      ['Mission reward', fmt(reward) + ' cr'],
      ['Rocket fuel burned', fmt(w.fuelUsed) + ' u'],
      ['Planet integrity', Math.max(0, Math.round(w.planet.hp / w.planet.maxHp * 100)) + '%'],
      ['Time', `${Math.floor(w.t / 60)}:${String(Math.floor(w.t % 60)).padStart(2, '0')}`],
    ];
    if (joined) rows.push(['New teammate', CREW[joined].name]);
    const show = () => this.showResults({
      win, eyebrow: `${P.side ? 'Side story' : 'Chapter ' + P.chapter} · ${P.title}`,
      title: win ? (P.id === 'prime' && first ? 'The Eighth Seal is closed' : `${P.name} saved`) : (w.endReason === 'planet' ? `${P.name} has fallen` : w.endReason === 'abandon' ? 'Mission abandoned' : 'The Vanguard was lost'),
      sub: win ? (P.id === 'prime' && first ? 'Thank you for playing. Patrols stay open across the Octant, and the Hushed still roam.' : first && Save.d.progress < 8 ? `Next: ${PLANETS[Save.d.progress].name}. Visit the Hangar to spend your credits.` : 'Patrol complete.') : 'Credits you collected are kept. Upgrade in the Hangar and try again.',
      rows,
    });
    const post = first ? STORY[P.id + '_post'] : null;
    if (post) Dialog.play(post, show); else show();
  },
  showResults(o) {
    $('hud').hidden = true;
    $('scr-results').hidden = false;
    $('res-eyebrow').textContent = o.eyebrow;
    $('res-title').textContent = o.title;
    $('res-title').className = 'result-title ' + (o.win ? 'win' : 'lose');
    $('res-sub').textContent = o.sub;
    const dl = $('res-list'); dl.textContent = '';
    for (const [k, v] of o.rows) { const d = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.append(d); }
    $('btn-res-retry').hidden = false;
    cv.style.cursor = '';
    $('btn-res-continue').focus({ preventScroll: true });
  },

  /* ---------- keys & per-frame ---------- */
  onKey(e) {
    if (Dialog.active) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); Dialog.advance(); return true; }
      if (e.code === 'Escape') { Dialog.skip(); return true; }
      return false;
    }
    const top = this.modalStack[this.modalStack.length - 1];
    if (top && e.code === 'Escape') { e.preventDefault(); this.closeModal(top); return true; }
    if (G.state === 'mission' && (e.code === 'Escape' || e.code === 'KeyP') && $('scr-results').hidden) { e.preventDefault(); this.togglePause(); return true; }
    if (G.state === 'guest' && e.code === 'Escape') { e.preventDefault(); Net.guestMenu(); return true; }
    return false;
  },
  tick(dt) {
    Dialog.update(dt);
    if (this.barkT > 0) {
      this.barkT -= dt;
      drawPortrait($('bark-portrait').getContext('2d'), this.barkWho, 40, 40, G.t, this.barkT > 2.5);
      if (this.barkT <= 0) $('bark').hidden = true;
    }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').hidden = true; }
    if (!$('scr-hangar').hidden) this.drawHangarPreview();
  },
};

/* ================= BOOT ================= */
initStars();
UI.init();
Net.init();
requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
