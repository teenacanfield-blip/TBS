/* Octant Vanguard — online co-op over the artifact `room` capability.
   The host simulates the battle and shares a compact snapshot through its presence;
   each guest flies its own ship locally and shares position, aim and trigger through presence. */
'use strict';

const BCOL = ['#c6ff5c', '#ff5ad0', '#b6ff4a', '#eaff6a', '#ff6a3a', '#ff3d71', '#b98cff', '#8fa6ff', '#ffc04a', '#d08bff', '#6fd2ff', '#ffb46b', '#ff8ad8', '#c6ff6b', '#b06bff', '#ffb3d9'];
const WM_KINDS = ['fighter', 'drone', 'spore', 'hopper', 'hoppling'];
const PK_TYPES = ['credit', 'fuel', 'repair'];
const CODE_RE = /^oct-[a-z0-9]{4}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const cleanCs = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 12) || 'PILOT';
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const R = Math.round;

const Net = {
  room: null, role: null, named: null, code: null, myPeer: null,
  sendT: 0, counters: {}, schemeOf: {}, lastBanner: null, bannerSeq: 0,
  gw: null, lastS: null, applied: null, fxSeen: 0, barkSeen: 0, bannerSeen: 0, novaSeq: 0,
  hostGoneT: 0, resultShown: false, resultDone: false, resultAt: 0, hostCs: 'HOST',

  async init() {
    $('btn-host').onclick = () => this.host();
    $('btn-unhost').onclick = () => this.unhost();
    $('btn-join').onclick = () => this.join($('join-code').value);
    $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') this.join($('join-code').value); });
    try { if (window.claude && typeof window.claude.use === 'function') this.room = await window.claude.use('room'); } catch (e) { this.room = null; }
    if (!this.room) { this.unavailable(); return; }
    this.room.onConnection(c => { if (!this.dead) this.setStatus(c ? 'Connected' : 'Connecting…', c ? 'ok' : ''); }, () => { this.dead = true; this.unavailable(); });
    this.room.onPeers(ch => this.renderHosts(ch.peers));
  },
  unavailable() {
    this.setStatus('Online co-op needs a signed-in viewer on claude.ai. Same-screen co-op works everywhere.', 'bad');
    $('btn-host').disabled = true; $('btn-join').disabled = true;
  },
  setStatus(msg, cls) { const el = $('net-status'); el.textContent = msg; el.className = 'netstatus ' + (cls || ''); },
  isHosting() { return this.role === 'host'; },
  guests() { return this.named ? this.named.peers().filter(p => !p.sameTab && p.presence && p.presence.role === 'guest') : []; },
  remoteCount() { return this.role === 'host' ? this.guests().length : 0; },

  /* ---------- lobby panel ---------- */
  openPanel() { this.renderPanel(); if (this.room) this.renderHosts(this.room.peers()); },
  renderPanel() {
    const hosting = this.role === 'host';
    $('host-info').hidden = !hosting;
    $('btn-host').hidden = hosting; $('btn-unhost').hidden = !hosting;
    if (hosting) {
      $('host-code').textContent = this.code.toUpperCase();
      const g = this.guests();
      $('host-peers').textContent = g.length ? `On your wing: ${g.map(p => cleanCs(p.presence.cs)).join(', ')}` : 'Waiting for wingmates. Share the code, or they can pick you from their list.';
    }
  },
  renderHosts(peers) {
    const list = $('host-list'); if (!list) return;
    const hosts = (peers || []).filter(p => !p.sameTab && p.presence && typeof p.presence.host === 'string' && CODE_RE.test(p.presence.host));
    list.textContent = '';
    if (!hosts.length) { const p = document.createElement('p'); p.className = 'fine'; p.textContent = 'No open games yet.'; list.append(p); return; }
    for (const h of hosts) {
      const row = document.createElement('div'); row.className = 'host-item';
      const b = document.createElement('b'); b.textContent = `${cleanCs(h.presence.cs)} · ${h.presence.host.toUpperCase()}`;
      const n = document.createElement('span'); n.className = 'fine'; n.textContent = `${num(h.presence.n, 1, 4, 1)}/4`;
      const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = 'Join';
      btn.onclick = () => this.join(h.presence.host);
      row.append(b, n, btn); list.append(row);
    }
  },

  /* ---------- hosting ---------- */
  async host() {
    if (!this.room || this.role) return;
    const code = 'oct-' + Array.from({ length: 4 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.random() * 31 | 0]).join('');
    this.setStatus('Opening your game…');
    try { this.named = await this.room.join(code); }
    catch (e) { this.setStatus(`Could not open a game (${(e && e.code) || 'error'}).`, 'bad'); return; }
    this.role = 'host'; this.code = code; this.counters = {}; this.schemeOf = {};
    this.named.presence({ role: 'host', cs: Save.d.cs, s: { v: 1, ph: 'map' } }).catch(() => {});
    this.room.presence({ host: code, cs: Save.d.cs, n: 1 }).catch(() => {});
    let known = new Set();
    this.named.onPeers(ch => {
      const g = ch.peers.filter(p => !p.sameTab && p.presence && p.presence.role === 'guest');
      const now = new Set(g.map(p => p.peer));
      for (const p of g) if (!known.has(p.peer)) UI.toast(`${cleanCs(p.presence.cs)} joined your game`);
      known = now;
      this.room.presence({ n: 1 + g.length }).catch(() => {});
      if (!$('scr-coop').hidden) this.renderPanel();
      if (G.state === 'map') UI.selectPlanet(MapView.sel);
    }, () => this.lostRoom());
    this.setStatus('Your game is open', 'ok');
    this.renderPanel();
  },
  unhost() {
    if (this.named) this.named.leave().catch(() => {});
    this.named = null; this.role = null; this.code = null;
    if (this.room) this.room.presence({ host: null, cs: null, n: null }).catch(() => {});
    if (G.world) { G.world.players = G.world.players.filter(p => p.kind !== 'remote'); recalcPlayers(G.world); }
    this.setStatus('Game closed');
    this.renderPanel();
    if (G.state === 'map') UI.selectPlanet(MapView.sel);
  },
  lostRoom() {
    if (this.role === 'guest') { this.leaveGuest(); UI.toast('Lost connection to the game'); }
    else if (this.role === 'host') { this.named = null; this.role = null; this.renderPanel(); UI.toast('Your online game was closed'); }
  },
  onMissionStart(w) {
    this.counters = {};
    this.sendT = 0;
    if (this.role === 'host') w.players[0].label = Save.d.cs;
  },
  onMap() {
    if (this.role === 'host' && this.named) this.named.presence({ s: { v: 1, ph: 'map' } }).catch(() => {});
  },
  noteBanner(text, sub) { this.lastBanner = { s: ++this.bannerSeq, text: String(text).slice(0, 60), sub: String(sub || '').slice(0, 60), at: performance.now() }; },
  guestEvent(peer, kind, amt) {
    const c = this.counters[peer] || (this.counters[peer] = [0, 0, 0, 0, 0]);
    const i = { dmg: 0, fuel: 1, repair: 2, cr: 3, kill: 4 }[kind];
    if (i !== undefined) c[i] += amt;
  },
  parseStats(a) {
    const st = shipStats({ upg: { hull: 0, shield: 0, dmg: 0, rate: 0, spread: 0, fuel: 0, engine: 0, nova: 0 }, crew: { kira: 0, wrench: 0, lys: 0, tak: 0, ssiv: 0 } });
    if (Array.isArray(a)) {
      st.hullMax = num(a[0], 50, 400, st.hullMax); st.shieldMax = num(a[1], 1, 300, st.shieldMax);
      st.dmg = num(a[2], 1, 40, st.dmg); st.rate = num(a[3], 1, 14, st.rate); st.spread = num(a[4], 0, 5, 0) | 0;
      st.novaDmg = num(a[5], 0, 300, st.novaDmg); st.novaR = num(a[6], 100, 450, st.novaR); st.novaCd = num(a[7], 5, 30, st.novaCd);
    }
    st.crit = 0;
    return st;
  },
  syncRemotes(w) {
    const live = new Set();
    for (const pr of this.named.peers()) {
      if (pr.sameTab || !pr.presence || pr.presence.role !== 'guest' || !Array.isArray(pr.presence.p)) continue;
      const a = pr.presence.p; if (a.length < 11) continue;
      live.add(pr.peer);
      let rp = w.players.find(p => p.kind === 'remote' && p.peer === pr.peer);
      if (!rp) {
        if (w.players.filter(p => p.kind === 'remote').length >= 3) continue;
        if (!(pr.peer in this.schemeOf)) { const used = new Set(Object.values(this.schemeOf)); this.schemeOf[pr.peer] = [2, 3, 1].find(i => !used.has(i)) ?? 2; }
        const si = this.schemeOf[pr.peer];
        rp = makePlayer(si, 'remote', num(a[0], -2200, 2200), num(a[1], -2200, 2200), this.parseStats(pr.presence.st));
        rp.idx = 9; rp.peer = pr.peer; rp.scheme = SCHEMES[si]; rp.novaSeqSeen = a[10];
        w.players.push(rp); recalcPlayers(w);
        bark(w, 'coop');
      }
      rp.label = cleanCs(pr.presence.cs);
      rp.remote = { x: num(a[0], -2200, 2200), y: num(a[1], -2200, 2200), ang: num(a[2], -1000, 1000) / 100, aim: num(a[3], -1000, 1000) / 100, fire: !!a[4], boost: !!a[5], thrust: num(a[6], 0, 100) / 100, hullPct: num(a[7], 0, 1000) / 1000, shieldPct: num(a[8], 0, 1000) / 1000, dead: !!a[9], novaSeq: num(a[10], 0, 1e9) };
    }
    for (const p of [...w.players]) if (p.kind === 'remote' && !live.has(p.peer)) { w.players.splice(w.players.indexOf(p), 1); recalcPlayers(w); }
  },
  hostTick(w, dt) {
    if (this.role !== 'host' || !this.named) return;
    this.syncRemotes(w);
    this.sendT -= dt;
    if (this.sendT > 0) return;
    const many = w.players.some(p => p.kind === 'remote');
    this.sendT = many ? 0.05 : 0.5;
    const s = many ? this.buildSnap(w) : { v: 1, m: w.idx, ph: w.phase };
    this.named.presence({ s }).catch(() => {});
  },
  buildSnap(w) {
    const s = { v: 1, m: w.idx, ph: w.phase, pl: [R(w.planet.hp), R(w.planet.maxHp)], wv: [w.wave, w.P.mission.waves ? w.P.mission.waves.length : 0], sv: w.survive ? R(w.survive.t / w.survive.dur * 1000) : -1, pods: w.pods };
    if (w.boss) s.bs = [ENEMY_KEYS.indexOf(w.boss.type), R(w.boss.hp / w.boss.maxHp * 1000)];
    const guests = w.players.filter(p => p.kind === 'remote');
    const prio = o => { let d = 1e12; for (const g of guests) d = Math.min(d, (o.x - g.x) ** 2 + (o.y - g.y) ** 2); return d; };
    const es = w.enemies.slice().sort((a, b) => prio(a) - prio(b)).slice(0, 40);
    s.e = []; for (const e of es) s.e.push(e.id, ENEMY_KEYS.indexOf(e.type), R(e.x), R(e.y), R((e.type === 'nullheart' || e.type === 'inkwraith' ? e.eye : e.ang) * 10), (e.hit > 0.3 ? 1 : 0) | (e.slow > 0 ? 2 : 0) | (e.ghost > 0 ? 4 : 0));
    const near = b => prio(b) < 1150 * 1150;
    s.b = [];
    const addB = b => { let ci = BCOL.indexOf(b.color); if (ci < 0) ci = 0; s.b.push(R(b.x), R(b.y), R(b.vx / 10), R(b.vy / 10), ci + (b.team === 1 ? 100 : 0), R(b.r)); };
    w.bullets.filter(b => b.team === 1 && near(b)).slice(0, 60).forEach(addB);
    w.bullets.filter(b => b.team !== 1 && near(b)).slice(0, 30).forEach(addB);
    s.k = []; w.pickups.slice(0, 30).forEach(k => s.k.push(R(k.x), R(k.y), PK_TYPES.indexOf(k.type)));
    s.r = []; w.rocks.forEach(r => s.r.push(r.id, R(r.x), R(r.y), R(r.r), R(r.rot * 10)));
    s.po = []; w.portals.forEach(p => s.po.push(R(p.x), R(p.y), R(p.t / p.dur * 10), R(p.r)));
    s.wm = []; w.wingmen.forEach(m => s.wm.push(WM_KINDS.indexOf(m.kind), R(m.x), R(m.y), R(m.ang * 10), R((m.aim || 0) * 10)));
    s.h = []; w.players.filter(p => p.kind === 'local').forEach(p => s.h.push(SCHEMES.indexOf(p.scheme), R(p.x), R(p.y), R(p.ang * 100), R(p.thrust * 10), p.boost ? 1 : 0, R(p.st.shieldMax ? p.shield / p.st.shieldMax * 10 : 0), R(p.hit * 10), p.dead ? 1 : 0));
    s.bm = []; w.beams.forEach(b => s.bm.push(R(b.x), R(b.y), R(b.a * 100), b.t > b.warn ? 1 : 0, R(b.len), R(b.w)));
    s.g = {};
    for (const g of guests) { const c = this.counters[g.peer] || [0, 0, 0, 0, 0]; s.g[g.peer] = [R(c[0] * 10) / 10, R(c[1]), R(c[2]), R(c[3] * 10) / 10, c[4], this.schemeOf[g.peer] ?? 2]; }
    s.fx = w.fx.filter(f => w.t - f.t < 1).map(f => [f.s, f.k, f.x, f.y, f.a, f.c]);
    if (w.lastBark && w.t - w.lastBark.t < 4) s.bk = [w.lastBark.s, w.lastBark.who, w.lastBark.text.slice(0, 180)];
    if (this.lastBanner && performance.now() - this.lastBanner.at < 2500) s.bn = [this.lastBanner.s, this.lastBanner.text, this.lastBanner.sub];
    let json = JSON.stringify(s);
    while (json.length > 3500) {
      if (s.b.length) s.b.length = Math.max(0, s.b.length - 36);
      else if (s.k.length) s.k.length = Math.max(0, s.k.length - 15);
      else if (s.fx.length) s.fx.length = 0;
      else if (s.e.length > 60) s.e.length -= 60;
      else break;
      json = JSON.stringify(s);
    }
    return s;
  },

  /* ---------- joining ---------- */
  statsArr() { const st = shipStats(); return [R(st.hullMax), R(st.shieldMax), +st.dmg.toFixed(1), +st.rate.toFixed(2), st.spread, R(st.novaDmg), R(st.novaR), +st.novaCd.toFixed(1)]; },
  async join(code) {
    if (!this.room) return;
    code = String(code || '').trim().toLowerCase();
    if (!CODE_RE.test(code)) { this.setStatus('Game codes look like OCT-AB12.', 'bad'); return; }
    if (this.role === 'host') this.unhost();
    if (this.role === 'guest') this.leaveGuest(true);
    this.setStatus('Joining…');
    UI.saveCallsign();
    try { this.named = await this.room.join(code); }
    catch (e) { this.setStatus(`Could not join that game (${(e && e.code) || 'error'}).`, 'bad'); return; }
    this.role = 'guest'; this.code = code; this.lastS = null; this.gw = null; this.hostGoneT = 0;
    this.named.presence({ role: 'guest', cs: Save.d.cs, p: null, st: this.statsArr() }).catch(() => {});
    this.named.onPeers(ch => { const me = ch.peers.find(p => p.sameTab); if (me) this.myPeer = me.peer; }, () => this.lostRoom());
    this.setStatus('Joined', 'ok');
    this.showLobby('Waiting for the host to launch a mission…');
  },
  showLobby(msg) {
    UI.hideAll(); G.state = 'guestlobby'; G.world = null; G.paused = false;
    $('scr-guest').hidden = false;
    $('guest-title').textContent = `Game ${this.code ? this.code.toUpperCase() : ''}`;
    $('guest-status').textContent = msg;
    $('btn-guest-hangar').hidden = false;
    Sound.setMusic('calm', 0);
    cv.style.cursor = '';
  },
  leaveGuest(silent) {
    if (this.named) this.named.leave().catch(() => {});
    this.named = null; this.role = null; this.gw = null; this.code = null;
    if (!silent) { if (Save.has) UI.toMap(); else UI.goTitle(); }
    this.setStatus('Left the game');
  },
  guestMenu() {
    if (G.state !== 'guest') return;
    const el = $('scr-guest');
    if (el.hidden) { el.hidden = false; G.paused = true; $('guest-status').textContent = 'The mission keeps running. Your ship is holding position.'; $('btn-guest-hangar').hidden = true; }
    else { el.hidden = true; G.paused = false; }
  },
  guestPoll(dt) {
    if (!this.named) return null;
    const host = this.named.peers().find(p => !p.sameTab && p.presence && p.presence.role === 'host');
    if (!host) {
      this.hostGoneT += dt;
      if (this.hostGoneT > 5) { this.leaveGuest(); UI.toast('The host closed the game'); }
      return null;
    }
    this.hostGoneT = 0;
    this.hostCs = cleanCs(host.presence.cs);
    return host.presence.s || null;
  },
  lobbyTick(dt) {
    if (this.role !== 'guest' || G.state !== 'guestlobby') return;
    const s = this.guestPoll(dt);
    if (s && s !== this.lastS) {
      this.lastS = s;
      if (s.ph && s.ph !== 'map' && Number.isInteger(s.m) && s.m >= 0 && s.m < PLANETS.length && $('scr-results').hidden) this.enterGuestMission(s);
      else if (s.ph === 'map') $('guest-status').textContent = `${this.hostCs} is choosing the next planet…`;
    }
    this.sendT -= dt;
    if (this.sendT <= 0 && this.named) { this.sendT = 1; this.named.presence({ cs: Save.d.cs, st: this.statsArr(), p: null }).catch(() => {}); }
  },
  enterGuestMission(s) {
    const gw = newWorld(s.m, {});
    gw.isGuest = true; gw.pods = undefined; gw.rocks = []; gw.wingmen = []; gw.enemies = []; gw.portals = [];
    const me = makePlayer(0, 'local', (Math.random() - 0.5) * 200, -gw.planet.r - 200);
    me.scheme = SCHEMES[2]; me.label = Save.d.cs;
    gw.me = me; gw.players = [me]; gw.ghosts = []; gw.others = new Map(); gw.emap = new Map(); gw.rshape = new Map();
    gw.phase = s.ph;
    this.gw = gw; this.applied = null; this.resultShown = false; this.resultDone = false;
    this.fxSeen = Math.max(0, ...(Array.isArray(s.fx) ? s.fx.map(f => +f[0] || 0) : [0]));
    this.barkSeen = Array.isArray(s.bk) ? +s.bk[0] || 0 : 0;
    this.bannerSeen = Array.isArray(s.bn) ? +s.bn[0] || 0 : 0;
    G.state = 'guest'; G.world = null; G.paused = false;
    UI.hideAll(); $('hud').hidden = false; $('hud-boss').hidden = true;
    UI.buildPlayerCards(gw); UI.lastHud = {};
    $('touch-btns').hidden = !Input.touch.used;
    cv.style.cursor = Input.touch.used ? '' : 'none';
    UI.banner(gw.P.name, `Flying with ${this.hostCs}`);
    Sound.setMusic('combat', 1); Sound.sfx('warp');
    this.applySnap(s);
  },
  exitGuestMission() {
    this.creditGuest();
    this.gw = null;
    if ($('scr-results').hidden) this.showLobby(`${this.hostCs} is choosing the next planet…`);
    else { G.state = 'guestlobby'; $('hud').hidden = true; }
  },
  creditGuest() {
    const gw = this.gw;
    if (!gw || this.resultDone) return;
    this.resultDone = true;
    const win = gw.phase === 'win';
    const bonus = win ? Math.round(gw.P.reward * 0.3) : 0;
    this.lastCredits = { collected: Math.round(gw.earned), bonus, win, P: gw.P, kills: gw.kills };
    Save.d.credits += this.lastCredits.collected + bonus; Save.has = true; Save.write();
  },
  showGuestResults() {
    const r = this.lastCredits; if (!r) return;
    UI.showResults({
      win: r.win, eyebrow: `Online co-op · ${r.P.name}`,
      title: r.win ? `${r.P.name} saved` : 'Mission failed',
      sub: `You flew on ${this.hostCs}'s wing. Your credits are saved to your own campaign.`,
      rows: [['Aliens destroyed (your shots)', fmt(r.kills)], ['Credits collected', fmt(r.collected) + ' cr'], ['Wingmate bonus', fmt(r.bonus) + ' cr']],
    });
    $('btn-res-retry').hidden = true;
  },
  guestFired(w, p) {
    const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
    part(w, p.x + ca * 30, p.y + sa * 30, ca * 60, sa * 60, 0.08, 18, p.scheme.flame, 1);
    Sound.sfx('laser');
  },
  guestNova(w, p) {
    p.novaCd = p.st.novaCd; this.novaSeq++;
    part(w, p.x, p.y, 0, 0, 0.55, p.st.novaR, p.scheme.shield, 2);
    Sound.sfx('nova');
  },
  guestDamage(gw, amt) {
    const p = gw.me;
    if (p.dead || p.inv > 0 || amt <= 0) return;
    p.lastHit = gw.t;
    if (p.shield > 0) { const s = Math.min(p.shield, amt); p.shield -= s; amt -= s; p.shieldHit = 1; Sound.sfx('shieldhit'); }
    if (amt > 0) { p.hull -= amt; p.hit = 1; Sound.sfx('hurt'); if (Save.d.settings.shake) gw.shake = Math.max(gw.shake, 5 + amt * 0.3); }
    if (p.hull <= 0) { p.hull = 0; p.dead = true; p.respawnT = 4; explode(gw, p.x, p.y, 2.2, p.scheme.flame, false); }
  },
  applySnap(s) {
    const gw = this.gw; if (!gw) return;
    if (!s || s.ph === 'map' || s.m !== gw.idx) {
      this.exitGuestMission();
      if (s && s.ph && s.ph !== 'map' && Number.isInteger(s.m) && s.m >= 0 && s.m < PLANETS.length && $('scr-results').hidden) this.enterGuestMission(s);
      return;
    }
    if (!Array.isArray(s.e)) { gw.phase = ['brief', 'play', 'win', 'lose'].includes(s.ph) ? s.ph : gw.phase; return; } // light snapshot
    gw.phase = ['brief', 'play', 'win', 'lose'].includes(s.ph) ? s.ph : 'play';
    if (Array.isArray(s.pl)) { gw.planet.maxHp = num(s.pl[1], 1, 1e5, 1000); gw.planet.hp = num(s.pl[0], 0, gw.planet.maxHp); }
    if (Array.isArray(s.wv)) gw.wave = num(s.wv[0], -1, 30, -1) | 0;
    if (gw.survive && s.sv >= 0) gw.survive.t = num(s.sv, 0, 1000) / 1000 * gw.survive.dur;
    gw.pods = Number.isFinite(+s.pods) ? +s.pods : undefined;
    if (Array.isArray(s.bs) && ENEMY_KEYS[s.bs[0]]) UI.bossBar(ENEMY_TYPES[ENEMY_KEYS[s.bs[0]]].name, num(s.bs[1], 0, 1000) / 1000); else UI.bossBar(null);
    // enemies
    const seen = new Set(), E = s.e;
    for (let i = 0; i + 5 < E.length; i += 6) {
      const id = E[i], type = ENEMY_KEYS[E[i + 1]]; if (!type) continue;
      const x = num(E[i + 2], -2500, 2500), y = num(E[i + 3], -2500, 2500), a = num(E[i + 4], -1e4, 1e4) / 10, fl = E[i + 5] | 0;
      let e = gw.emap.get(id);
      if (!e) { e = { id, type, x, y, ang: a, seed: (Math.abs(+id) * 7.31) % 100, hit: 0, slow: 0, eye: 0, t: 0, charge: 0 }; gw.emap.set(id, e); }
      e.tx = x; e.ty = y; e.ta = a; if (fl & 1) e.hit = 1; e.slow = fl & 2 ? 1 : 0; e.ghost = fl & 4 ? 1 : 0; if (type === 'nullheart' || type === 'inkwraith') e.eye = a;
      seen.add(id);
    }
    for (const id of [...gw.emap.keys()]) if (!seen.has(id)) gw.emap.delete(id);
    gw.enemies = [...gw.emap.values()];
    // bullets
    gw.bullets = [];
    const B = Array.isArray(s.b) ? s.b : [];
    for (let i = 0; i + 5 < B.length; i += 6) { const ci = B[i + 4] | 0; gw.bullets.push({ x: +B[i] || 0, y: +B[i + 1] || 0, vx: (+B[i + 2] || 0) * 10, vy: (+B[i + 3] || 0) * 10, color: BCOL[ci % 100] || '#ffffff', core: '#ffffff', star: BCOL[ci % 100] === '#ffb3d9', team: ci >= 100 ? 1 : 0, r: num(B[i + 5], 1, 12, 4) }); }
    gw.pickups = [];
    const K = Array.isArray(s.k) ? s.k : [];
    for (let i = 0; i + 2 < K.length; i += 3) { const ty = PK_TYPES[K[i + 2]]; if (ty) gw.pickups.push({ x: +K[i] || 0, y: +K[i + 1] || 0, type: ty, life: 10, t: 1 }); }
    gw.rocks = [];
    const Rk = Array.isArray(s.r) ? s.r : [];
    for (let i = 0; i + 4 < Rk.length; i += 5) {
      const id = Rk[i] | 0, rr = num(Rk[i + 3], 5, 80, 20);
      let shape = gw.rshape.get(id); if (!shape) { shape = makeRockShape(id * 977 + 13, rr); gw.rshape.set(id, shape); }
      gw.rocks.push({ x: +Rk[i + 1] || 0, y: +Rk[i + 2] || 0, r: rr, rot: (+Rk[i + 4] || 0) / 10, pts: shape, fuel: id % 3 !== 0, hit: 0 });
    }
    gw.portals = [];
    const Po = Array.isArray(s.po) ? s.po : [];
    for (let i = 0; i + 3 < Po.length; i += 4) gw.portals.push({ x: +Po[i] || 0, y: +Po[i + 1] || 0, t: num(Po[i + 2], 0, 10) / 10, dur: 1, r: num(Po[i + 3], 5, 90, 15) });
    // wingmen
    const Wm = Array.isArray(s.wm) ? s.wm : [], wms = [];
    for (let i = 0, j = 0; i + 4 < Wm.length; i += 5, j++) {
      const kind = WM_KINDS[Wm[i]]; if (!kind) continue;
      const old = gw.wingmen[j] && gw.wingmen[j].kind === kind ? gw.wingmen[j] : { kind, x: +Wm[i + 1] || 0, y: +Wm[i + 2] || 0, ang: 0, thrust: 0.5, twin: true, seed: j * 2.1, scarf: kind === 'hopper' ? '#ffd84f' : ['#8fd3ff', '#caffbf', '#ffb3d9', '#c9b6ff'][j % 4] };
      old.tx = +Wm[i + 1] || 0; old.ty = +Wm[i + 2] || 0; old.ta = (+Wm[i + 3] || 0) / 10; old.aim = (+Wm[i + 4] || 0) / 10;
      wms.push(old);
    }
    gw.wingmen = wms;
    // host ships
    const Hh = Array.isArray(s.h) ? s.h : [], gh = [];
    for (let i = 0, j = 0; i + 8 < Hh.length; i += 9, j++) {
      const sc = SCHEMES[Hh[i]] || SCHEMES[0];
      const g = gw.ghosts[j] || { kind: 'ghost', x: +Hh[i + 1] || 0, y: +Hh[i + 2] || 0, ang: 0, inv: 0, shieldHit: 0, st: { shieldMax: 1, hullMax: 1 } };
      g.scheme = sc; g.tx = +Hh[i + 1] || 0; g.ty = +Hh[i + 2] || 0; g.ta = (+Hh[i + 3] || 0) / 100; g.thrust = num(Hh[i + 4], 0, 10) / 10; g.boost = !!Hh[i + 5];
      g.shield = num(Hh[i + 6], 0, 10) / 10; g.hit = num(Hh[i + 7], 0, 10) / 10; g.dead = !!Hh[i + 8];
      g.label = j === 0 ? this.hostCs : `${this.hostCs} P2`;
      gh.push(g);
    }
    gw.ghosts = gh;
    // beams
    gw.beams = [];
    const Bm = Array.isArray(s.bm) ? s.bm : [];
    for (let i = 0; i + 5 < Bm.length; i += 6) gw.beams.push({ x: +Bm[i] || 0, y: +Bm[i + 1] || 0, a: (+Bm[i + 2] || 0) / 100, t: Bm[i + 3] ? 2 : 0, warn: 1, dur: 9, len: num(Bm[i + 4], 0, 2500), w: num(Bm[i + 5], 1, 60, 20), owner: {} });
    // my counters: damage taken, pickups, credits
    const g = s.g && this.myPeer && s.g[this.myPeer];
    if (Array.isArray(g)) {
      const base = this.applied || [0, 0, 0, 0, 0];
      const d = i => Math.max(0, (+g[i] || 0) - (+base[i] || 0));
      const me = gw.me;
      if (d(0)) this.guestDamage(gw, d(0));
      if (d(1) && !me.dead) { me.fuel = Math.min(me.st.fuelMax, me.fuel + d(1)); floatText(gw, me.x, me.y - 30, '+' + R(d(1)) + ' FUEL', '#ffb366'); Sound.sfx('fuel'); }
      if (d(2) && !me.dead) { me.hull = Math.min(me.st.hullMax, me.hull + d(2)); floatText(gw, me.x, me.y - 30, '+' + R(d(2)) + ' HULL', '#7dffc9'); Sound.sfx('pickup'); }
      if (d(3)) { gw.earned += d(3); Sound.sfx('coin'); }
      if (d(4)) gw.kills += d(4);
      const sc = SCHEMES[g[5]]; if (sc && me.scheme !== sc) { me.scheme = sc; UI.buildPlayerCards(gw); }
      this.applied = g.slice(0, 5);
    }
    // effects, radio chatter, banners
    for (const f of Array.isArray(s.fx) ? s.fx : []) {
      if (!Array.isArray(f) || !(+f[0] > this.fxSeen)) continue;
      this.fxSeen = +f[0];
      const col = HEX_RE.test(f[5]) ? f[5] : '#ffffff';
      if (f[1] === 1) explode(gw, +f[2] || 0, +f[3] || 0, num(f[4], 0.3, 6, 1), col, false);
      else if (f[1] === 2) { part(gw, +f[2] || 0, +f[3] || 0, 0, 0, 0.55, num(f[4], 50, 500, 280), col, 2); Sound.sfx('nova'); }
    }
    if (Array.isArray(s.bk) && +s.bk[0] > this.barkSeen) {
      this.barkSeen = +s.bk[0];
      const who = Object.prototype.hasOwnProperty.call(CHARACTERS, s.bk[1]) ? s.bk[1] : 'sys';
      const text = String(s.bk[2] || '').slice(0, 200);
      if (text) { UI.showBark(who, text); Voice.speak(who, text); }
    }
    if (Array.isArray(s.bn) && +s.bn[0] > this.bannerSeen) { this.bannerSeen = +s.bn[0]; UI.banner(String(s.bn[1] || '').slice(0, 60), String(s.bn[2] || '').slice(0, 60)); }
    if ((gw.phase === 'win' || gw.phase === 'lose') && !this.resultShown) {
      this.resultShown = true; this.resultAt = performance.now();
      Sound.sfx(gw.phase === 'win' ? 'victory' : 'defeat');
      this.creditGuest();
    }
  },
  guestFrame(dt) {
    const s = this.guestPoll(dt);
    if (!this.gw) return;
    if (s !== this.lastS) { this.lastS = s; this.applySnap(s); if (!this.gw) return; }
    const gw = this.gw, me = gw.me;
    gw.t += dt; gw.planet.rot += dt * 0.05; gw.shake = Math.max(0, gw.shake - dt * 30);
    me.hit = Math.max(0, me.hit - dt * 4); me.shieldHit = Math.max(0, me.shieldHit - dt * 3); me.inv = Math.max(0, me.inv - dt);
    if (me.dead) {
      me.respawnT -= dt;
      if (me.respawnT <= 0) { me.dead = false; me.hull = me.st.hullMax; me.shield = me.st.shieldMax; me.fuel = Math.max(me.fuel, me.st.fuelMax * 0.6); const a = Math.random() * TAU; me.x = Math.cos(a) * (gw.planet.r + 90); me.y = Math.sin(a) * (gw.planet.r + 90); me.vx = me.vy = 0; me.inv = 2.5; }
    } else if (!G.paused) stepLocalPlayer(gw, me, dt, readPads());
    else { me.inp.fire = false; me.vx *= 0.95; me.vy *= 0.95; }
    const k = Math.min(1, dt * 12);
    for (const e of gw.enemies) { e.t += dt; e.x = lerp(e.x, e.tx, k); e.y = lerp(e.y, e.ty, k); let da = e.ta - e.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); e.ang += da * k; e.hit = Math.max(0, e.hit - dt * 6); }
    for (const b of gw.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const m of gw.wingmen) { m.x = lerp(m.x, m.tx, k); m.y = lerp(m.y, m.ty, k); m.ang = m.ta; }
    for (const g of gw.ghosts) { g.x = lerp(g.x, g.tx, k); g.y = lerp(g.y, g.ty, k); let da = g.ta - g.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); g.ang += da * k; }
    // other guests straight from their own presence
    const others = [];
    for (const pr of this.named ? this.named.peers() : []) {
      if (pr.sameTab || !pr.presence || pr.presence.role !== 'guest' || !Array.isArray(pr.presence.p)) continue;
      const a = pr.presence.p;
      let o = gw.others.get(pr.peer);
      if (!o) { o = { kind: 'ghost', x: +a[0] || 0, y: +a[1] || 0, ang: 0, inv: 0, shieldHit: 0, hit: 0, st: { shieldMax: 1, hullMax: 1 }, scheme: SCHEMES[3] }; gw.others.set(pr.peer, o); }
      const gi = s && s.g && s.g[pr.peer]; if (Array.isArray(gi) && SCHEMES[gi[5]]) o.scheme = SCHEMES[gi[5]];
      o.x = lerp(o.x, num(a[0], -2500, 2500), k); o.y = lerp(o.y, num(a[1], -2500, 2500), k); o.ang = num(a[2], -1000, 1000) / 100;
      o.thrust = num(a[6], 0, 100) / 100; o.boost = !!a[5]; o.shield = num(a[8], 0, 1000) / 1000; o.dead = !!a[9]; o.label = cleanCs(pr.presence.cs);
      others.push(o);
    }
    gw.players = [me, ...gw.ghosts, ...others];
    for (let i = gw.parts.length - 1; i >= 0; i--) {
      const p = gw.parts[i]; p.life -= dt;
      if (p.life <= 0) { gw.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; const dr = p.type === 3 ? 1.2 : p.type === 0 ? 2.6 : 1.8; p.vx *= Math.exp(-dr * dt); p.vy *= Math.exp(-dr * dt); p.rot += dt * 6;
    }
    for (let i = gw.texts.length - 1; i >= 0; i--) { const t = gw.texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) gw.texts.splice(i, 1); }
    updateCamera(gw, dt);
    renderWorld(gw);
    UI.updateHUD(gw);
    if (this.resultShown && $('scr-results').hidden && !this.resultsOpened && performance.now() - this.resultAt > 2600) { this.resultsOpened = true; this.showGuestResults(); }
    if (!this.resultShown) this.resultsOpened = false;
    this.sendT -= dt;
    if (this.sendT <= 0 && this.named) {
      this.sendT = 0.05;
      const st = me.st;
      this.named.presence({ cs: Save.d.cs, st: this.statsArr(), p: [R(me.x), R(me.y), R(me.ang * 100), R(me.aim * 100), me.inp.fire && !me.dead && !G.paused ? 1 : 0, me.boost ? 1 : 0, R(me.thrust * 100), R(me.hull / st.hullMax * 1000), R(me.shield / st.shieldMax * 1000), me.dead ? 1 : 0, this.novaSeq] }).catch(() => {});
    }
  },
};
