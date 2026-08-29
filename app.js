/* Thirsty Bear Hub — the launcher.
 *
 * Three views (home, library, one game), a play overlay that runs the game in
 * place, and a little bit of memory so the shelf knows what you have been
 * playing. Everything is plain JS on purpose: no build step, same as the games.
 */

/* ------------------------------------------------------------------ state */

/* Playtime, favourites and launch counts live in this browser only — there is
   no account and no server, which is why the profile chip says so. */
const STORE_KEY = 'arcade.state.v1';

const blank = () => ({ favorite: false, launches: 0, seconds: 0, last: 0 });

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { games: parsed.games || {}, reviews: parsed.reviews || {} };
  } catch (e) {
    // Private browsing modes can refuse storage entirely. The site still works,
    // it just forgets everything on reload.
    return { games: {}, reviews: {} };
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) { /* nothing we can do, and nothing worth breaking over */ }
}

const stats = (id) => (state.games[id] ||= blank());

/* ----------------------------------------------------------- formatting */

function playtime(sec) {
  if (!sec) return 'Never played';
  if (sec < 90) return 'Under a minute played';
  if (sec < 3600) return `${Math.round(sec / 60)} min played`;
  return `${(sec / 3600).toFixed(1)} hrs played`;
}

function playtimeShort(sec) {
  if (!sec) return '—';
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

function lastPlayed(ts) {
  if (!ts) return 'Never';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function clock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const byId = (id) => GAMES.find((g) => g.id === id);
const byDemo = (id) => DEMOS.find((d) => d.id === id);

/* ------------------------------------------------------- finding demos */

/* Nobody should have to type a path to play a demo. Drop the demo in a folder
   named after it and the hub finds it on its own: on load it quietly checks the
   handful of places a demo could reasonably be, and the first file that
   actually answers becomes that demo's Play button.
   Setting `url` in games.js still wins, for anything in an odd place. */

const found = {};   // demo id -> the path that answered

/* People do not name folders the way an id is written. `Ninja Wing Wing` might
   be sitting in `NinjaWingWing`, `ninja-wing-wing` or `Ninja Wing Wing`, so all
   of those count as the same demo. */
function demoFolders(d) {
  const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const squashed = d.title.replace(/[^A-Za-z0-9]+/g, '');       // NinjaWingWing
  return [...new Set([d.folder, d.id, slug, squashed, d.title].filter(Boolean))];
}

/* Ordered most-likely-first and kept short on purpose: every candidate that is
   not there costs a 404, and this runs on every page load for any demo still
   missing.

   Both `./` and `../` are tried so the hub keeps working wherever it is put —
   at the top of the site, which is where it lives now, or one folder down. */
function demoCandidates(d) {
  const folders = demoFolders(d);
  const out = [];

  // The obvious place first: demos/<name>/index.html, then beside the hub.
  for (const folder of folders) {
    out.push(`./demos/${folder}/index.html`);
    out.push(`../demos/${folder}/index.html`);
    out.push(`./${folder}/index.html`);
    out.push(`../${folder}/index.html`);
  }
  // Then the other names a main file gets given, for the first folder only.
  for (const file of ['game.html', 'play.html']) {
    out.push(`./demos/${folders[0]}/${file}`);
    out.push(`../demos/${folders[0]}/${file}`);
  }

  return [...new Set(out)].map(encodeURI);
}

const demoUrl = (d) => d.url || found[d.id] || '';

async function discoverDemos() {
  let anyFound = false;

  await Promise.all(DEMOS.map(async (d) => {
    if (d.url) return;
    for (const path of demoCandidates(d)) {
      try {
        // A plain GET, not HEAD: some small static servers (including the dev
        // server in .claude/) answer HEAD with a 500. Only the demo's HTML
        // entry point is fetched, which is a few hundred bytes.
        const res = await fetch(path);
        if (res.ok) { found[d.id] = path; anyFound = true; return; }
      } catch (e) {
        // Opening index.html straight off the disk (file://) blocks these
        // checks. Nothing is broken — the demo just cannot be auto-found, and
        // the page says so.
        return;
      }
    }
  }));

  if (anyFound) render();
}

/* --------------------------------------------------------------- reviews */

/* Two modes, decided by whether supabase-config.js has been filled in.
 *
 *   configured   — reviews live in the database and everyone sees them. Posting
 *                  needs an account, so `live` below is a cache of what came
 *                  back from the server, per game.
 *   not set up   — the original behaviour: reviews sit in this browser only.
 *
 * The rest of the file does not care which is running; it asks reviewsFor(). */
const LIVE = typeof Accounts !== 'undefined' && Accounts.configured;

// { [key]: { state: 'idle'|'loading'|'ready'|'error', list: [], error: '' } }
const live = {};

function liveSlot(key) {
  return (live[key] ||= { state: 'idle', list: [], error: '' });
}

// Fetches a game's reviews once, then re-renders so they appear. Called from
// the render pass, so it has to be careful not to loop: only an 'idle' slot
// starts a request.
function ensureReviews(key) {
  const slot = liveSlot(key);
  if (!LIVE || slot.state !== 'idle') return;
  slot.state = 'loading';
  Accounts.listReviews(key)
    .then((list) => { slot.state = 'ready'; slot.list = list; })
    .catch((err) => { slot.state = 'error'; slot.error = err.message; })
    .then(() => render());
}

// Throws away what we know about a game's reviews so the next render refetches.
function invalidateReviews(key) {
  delete live[key];
}

const reviewsFor = (key) => (LIVE ? liveSlot(key).list : state.reviews[key] || []);

function averageStars(key) {
  const list = reviewsFor(key);
  if (!list.length) return 0;
  return list.reduce((n, r) => n + r.stars, 0) / list.length;
}

// Five stars, filled up to `n`. `interactive` makes them clickable buttons.
function starRow(n, interactive) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const on = i <= Math.round(n) ? ' on' : '';
    out += interactive
      ? `<button type="button" class="star${on}" data-star="${i}" aria-label="${i} out of 5">${ICON.star}</button>`
      : `<span class="star${on}">${ICON.star}</span>`;
  }
  return `<span class="stars${interactive ? ' pick' : ''}">${out}</span>`;
}

function reviewSummary(key) {
  const list = reviewsFor(key);
  if (!list.length) return `<span class="rv-none">No reviews yet</span>`;
  const avg = averageStars(key);
  return `<span class="rv-avg"><b>${avg.toFixed(1)}</b>${starRow(avg)}
    <span>${list.length} review${list.length === 1 ? '' : 's'}</span></span>`;
}

/* Which of the two account forms is showing, and anything we need to tell the
   person. Module-level so a re-render does not bounce them back to the wrong
   tab or swallow an error they have not read yet. */
let authMode = 'in';   // 'in' | 'up'
let authNote = '';     // shown in green — "check your email", etc
let authError = '';    // shown in red

// The sign-in / create-account panel that stands in for the post box when
// nobody is signed in.
function authBox() {
  const signingUp = authMode === 'up';
  return `
  <form class="rv-auth" data-auth="${signingUp ? 'signup' : 'signin'}">
    <p class="rv-auth-lead">${signingUp
      ? 'Make an account to post reviews. Your username is what everyone sees — your email is not shown to anyone.'
      : 'Sign in to post a review.'}</p>

    <input name="email" class="rv-input" type="email" required
      maxlength="120" placeholder="Email" autocomplete="email" />

    ${signingUp ? `<input name="username" class="rv-input" required
      maxlength="20" placeholder="Username (3–20 letters, numbers or _)"
      autocomplete="username" />` : ''}

    <input name="password" class="rv-input" type="password" required
      minlength="6" maxlength="72" placeholder="Password (at least 6 characters)"
      autocomplete="${signingUp ? 'new-password' : 'current-password'}" />

    <div class="row">
      <button type="submit" class="btn play small">${signingUp ? 'Create account' : 'Sign in'}</button>
      <button type="button" class="btn ghost small" data-authmode="${signingUp ? 'in' : 'up'}">
        ${signingUp ? 'I already have one' : 'Create an account'}
      </button>
    </div>

    ${authError ? `<p class="rv-error-msg">${esc(authError)}</p>` : ''}
    ${authNote ? `<p class="rv-note-msg">${esc(authNote)}</p>` : ''}
  </form>`;
}

// The star-and-words form, for someone who is allowed to post.
function postForm(key, what) {
  return `
  <form class="rv-form" data-review="${esc(key)}">
    <div class="rv-stars" role="group" aria-label="Your rating">
      ${starRow(0, true)}
      <input type="hidden" name="rating" value="0" />
      <span class="rv-hint">Tap a star</span>
    </div>
    ${LIVE
      ? `<p class="rv-as">Posting as <b>${esc(Accounts.username || 'you')}</b>
           <button type="button" class="rv-signout" data-signout>Sign out</button></p>`
      : `<input name="who" class="rv-input" maxlength="24" placeholder="Your name (optional)" autocomplete="off" />`}
    <textarea name="text" class="rv-input" rows="3" maxlength="600"
      placeholder="What did you think of ${esc(what)}?"></textarea>
    <div class="row">
      <button type="submit" class="btn play small">Post review</button>
      <span class="rv-error" hidden>Pick a star rating first.</span>
    </div>
  </form>`;
}

// The whole review box: the score so far, the form, and everything posted.
// `key` is a game or demo id, so both kinds of page can use the same block.
function reviewBlock(key, what) {
  if (LIVE) ensureReviews(key);
  const slot = LIVE ? liveSlot(key) : null;
  const signedIn = LIVE && Accounts.session;
  const list = reviewsFor(key).slice().sort((a, b) => b.ts - a.ts);

  const body = !LIVE || signedIn ? postForm(key, what) : authBox();

  return `
  <div class="panel reviews">
    <div class="rv-head">
      <h3 style="margin:0">Reviews</h3>
      ${reviewSummary(key)}
    </div>

    ${body}

    ${LIVE && slot.state === 'loading' ? `<p class="rv-loading">Loading reviews…</p>` : ''}
    ${LIVE && slot.state === 'error'
      ? `<p class="rv-error-msg">Could not load reviews: ${esc(slot.error)}</p>` : ''}

    ${list.length ? `<ul class="rv-list">
      ${list.map((r) => `
        <li class="rv-item">
          <div class="rv-meta">
            ${starRow(r.stars)}
            <b>${esc(r.who || 'Player')}</b>
            <span>${new Date(r.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            ${!LIVE || r.mine
              ? `<button class="rv-del" data-unreview="${esc(key)}:${LIVE ? esc(String(r.id)) : r.ts}" title="Delete this review">Delete</button>`
              : ''}
          </div>
          ${r.text ? `<p>${esc(r.text)}</p>` : ''}
        </li>`).join('')}
    </ul>` : ''}

    <p class="rv-foot">${LIVE
      ? 'Reviews are public — everyone who visits sees them. You can delete your own at any time.'
      : 'Reviews are saved in this browser only — they are yours to read, not published anywhere.'}</p>
  </div>`;
}

/* ------------------------------------------------------------- fragments */

/* Icons are drawn on the same grid as the letters — a row of dots per line,
   '#' where a pixel is lit. Anything else on the page would look imported. */
function pixIcon(rows) {
  let body = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '#') body += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }));
  return `<svg class="pxi" viewBox="0 0 ${rows[0].length} ${rows.length}"
    xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

const ICON = {
  play: pixIcon([
    '#......',
    '##.....',
    '###....',
    '####...',
    '###....',
    '##.....',
    '#......']),
  star: pixIcon([
    '...#...',
    '...#...',
    '#######',
    '.#####.',
    '..###..',
    '..#.#..',
    '.#...#.']),
  back: pixIcon([
    '...#...',
    '..##...',
    '.###...',
    '####...',
    '.###...',
    '..##...',
    '...#...']),
  pop: pixIcon([
    '...####',
    '.....##',
    '....#.#',
    '...#..#',
    '..#....',
    '.#.....',
    '#......']),
};

// Titles are pixel letters. `u` is how big one pixel is, `wrap` where the name
// breaks — a long title scales down to fit rather than overflowing.
const pixTitle = (str, u, wrap) => Art.text(str, { u, wrap });

const fullTitle = (g) => g.title + (g.suffix || '');

const accentVars = (g) => `--accent:${g.accent};--accent-ink:${g.accentDark}`;

function card(g) {
  const st = stats(g.id);
  return `
  <button class="card" data-go="${g.id}" style="${accentVars(g)}" aria-label="${esc(g.title)}">
    <div class="card-art">
      ${Art.capsule(g.id)}
      <div class="card-play"><span>${ICON.play}</span></div>
    </div>
    ${st.launches ? '' : '<span class="card-badge">New</span>'}
    <span class="card-fav ${st.favorite ? 'on' : ''}" data-fav="${g.id}" role="button" tabindex="0"
          aria-label="${st.favorite ? 'Remove from' : 'Add to'} pinned">${ICON.star}</span>
    <div class="card-body">
      <div class="card-title">${pixTitle(fullTitle(g), 3, 12)}</div>
      <div class="card-tag">${esc(g.tagline)}</div>
      <div class="card-meta">
        <span>${esc(g.genres[0])}</span><span class="dot"></span>
        <span>${playtime(st.seconds)}</span>
      </div>
    </div>
  </button>`;
}

function demoCard(d) {
  const n = reviewsFor(d.id).length;
  return `
  <button class="card" data-demo="${d.id}" style="--accent:${d.accent};--accent-ink:${d.accentDark}"
          aria-label="${esc(d.title)}">
    <div class="card-art">
      ${Art.demoCapsule(d)}
      ${demoUrl(d) ? `<div class="card-play"><span>${ICON.play}</span></div>` : ''}
    </div>
    <span class="card-badge">${demoUrl(d) ? 'Demo' : 'Soon'}</span>
    <div class="card-body">
      <div class="card-title">${pixTitle(d.title, 3, 12)}</div>
      <div class="card-tag">${esc(d.tagline)}</div>
      <div class="card-meta">
        ${n ? `${starRow(averageStars(d.id))}<span>${n}</span>`
            : '<span>No reviews yet</span>'}
      </div>
    </div>
  </button>`;
}

function viewDemos(q) {
  const list = q ? DEMOS.filter((d) =>
    (d.title + ' ' + d.tagline + ' ' + d.blurb).toLowerCase().includes(q.toLowerCase())) : DEMOS;

  if (q && !list.length) return empty(q);

  // Everything anyone has said about any demo, newest first.
  const latest = DEMOS.flatMap((d) => reviewsFor(d.id).map((r) => ({ ...r, demo: d })))
    .sort((a, b) => b.ts - a.ts).slice(0, 4);

  return `
  <div class="wrap">
    <div class="sec-head" style="margin-bottom:6px">
      <h2>${pixTitle('Demos', 5)}</h2>
      <span class="sub">${DEMOS.length} works in progress</span>
    </div>
    <p style="margin:0 0 22px;color:var(--text-dim);max-width:62ch">
      Unfinished games, put up early on purpose. Open one and leave a review — say what works,
      what does not, and what you want next.
    </p>

    <div class="grid">${list.map(demoCard).join('')}</div>

    ${latest.length ? `
    <section class="sec">
      <div class="sec-head"><h2>${pixTitle('Latest reviews', 3)}</h2><span class="sub">across every demo</span></div>
      <div class="rail">
        ${latest.map((r) => `
          <button class="rail-item" data-demo="${r.demo.id}" style="--accent:${r.demo.accent}">
            <span class="rail-body" style="padding:14px 16px">
              <span class="rv-meta">${starRow(r.stars)}<b>${esc(r.who || 'Player')}</b><span>on ${esc(r.demo.title)}</span></span>
              ${r.text ? `<span style="color:var(--text-dim);font-size:13px">${esc(r.text.slice(0, 110))}${r.text.length > 110 ? '…' : ''}</span>` : ''}
            </span>
          </button>`).join('')}
      </div>
    </section>` : ''}
  </div>`;
}

function viewDemo(id) {
  const d = byDemo(id);
  if (!d) return empty('');
  const n = reviewsFor(d.id).length;

  return `
  <div class="wrap" style="--accent:${d.accent};--accent-ink:${d.accentDark}">
    <button class="back" data-back>${ICON.back} Back</button>

    <section class="hero detail-hero">
      <div class="hero-art">${Art.demoHero(d)}</div>
      <div class="hero-inner">
        <span class="eyebrow">Demo · work in progress</span>
        <h1>${pixTitle(d.title, 5, 13)}</h1>
        <p class="hero-tag">${esc(d.tagline)} — ${esc(d.blurb)}</p>
        <div class="row" style="margin-top:8px">
          ${demoUrl(d)
            ? `<button class="btn play" data-playdemo="${d.id}">${ICON.play} Play the demo</button>`
            : `<span class="btn ghost" aria-disabled="true" style="cursor:default;opacity:.7">Not playable yet</span>`}
          <span class="chip accent">${n ? `${averageStars(d.id).toFixed(1)} / 5 · ${n} review${n === 1 ? '' : 's'}` : 'Be the first to review'}</span>
        </div>
      </div>
    </section>

    <div class="cols">
      <div>
        ${reviewBlock(d.id, d.title)}
      </div>
      <div>
        <div class="panel">
          <h3>Status</h3>
          <dl class="kv">
            <dt>Stage</dt><dd>${demoUrl(d) ? 'Playable demo' : 'In progress'}</dd>
            <dt>Reviews</dt><dd>${n}</dd>
            <dt>Rating</dt><dd>${n ? `${averageStars(d.id).toFixed(1)} / 5` : '—'}</dd>
          </dl>
        </div>
        <div class="panel">
          <h3>Making it playable</h3>
          ${demoUrl(d) ? `
            <p style="font-size:13px;color:var(--text-mute);margin:0">
              Found and running from <code>${esc(demoUrl(d))}</code>. Nothing to set up.
            </p>` : `
            <p style="font-size:13px;color:var(--text-mute);margin:0 0 10px">
              Drop the demo into the <code>demos</code> folder, in a folder called
              <b>${esc(d.id)}</b>, with an <code>index.html</code> inside it. The hub
              finds it on the next reload and turns Play on — there is no path to type.
            </p>
            <p style="font-size:12px;color:var(--text-mute);margin:0">
              It also checks ${demoFolders(d).slice(0, 2).map((f) => `<code>${esc(f)}</code>`).join(' and ')}
              beside this folder.
            </p>`}
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------- sidebar */

function renderSidebar() {
  const list = document.getElementById('side-list');
  const here = location.hash.startsWith('#/game/') ? location.hash.slice(7) : '';

  list.innerHTML = GAMES.map((g) => {
    const st = stats(g.id);
    return `
    <button class="side-item ${here === g.id ? 'on' : ''} ${st.favorite ? 'fav' : ''}"
            data-go="${g.id}" style="${accentVars(g)}">
      ${Art.icon(g.id)}
      <span class="side-body">
        <span class="side-name">${esc(g.title)}</span>
        <span class="side-sub">${st.seconds ? playtime(st.seconds) : 'Ready to play'}</span>
      </span>
      <span class="side-star">${ICON.star}</span>
    </button>`;
  }).join('');

  const hereDemo = location.hash.startsWith('#/demo/') ? location.hash.slice(7) : '';
  list.innerHTML += `<div class="side-group">Demos</div>` + DEMOS.map((d) => `
    <button class="side-item ${hereDemo === d.id ? 'on' : ''}" data-demo="${d.id}"
            style="--accent:${d.accent}">
      ${Art.demoIcon(d)}
      <span class="side-body">
        <span class="side-name">${esc(d.title)}</span>
        <span class="side-sub">${reviewsFor(d.id).length
          ? `${averageStars(d.id).toFixed(1)} / 5 · ${reviewsFor(d.id).length} review${reviewsFor(d.id).length === 1 ? '' : 's'}`
          : demoUrl(d) ? 'Demo' : 'In progress'}</span>
      </span>
    </button>`).join('');

  document.getElementById('side-count').textContent = GAMES.length;

  const total = GAMES.reduce((n, g) => n + stats(g.id).seconds, 0);
  document.getElementById('side-foot').textContent =
    total ? `${playtime(total)} across ${GAMES.length} games` : 'Nothing played yet';

  const played = GAMES.filter((g) => stats(g.id).launches).length;
  document.getElementById('who-text').textContent =
    played ? `${played} of ${GAMES.length} played` : 'Player';
}

/* ----------------------------------------------------------- home view */

let featured = 0;

function viewHome(q) {
  const list = filter(q);
  const demoMatches = q
    ? DEMOS.filter((d) => (d.title + ' ' + d.tagline + ' ' + d.blurb).toLowerCase().includes(q.toLowerCase()))
    : DEMOS;

  if (q && !list.length && !demoMatches.length) return empty(q);

  const g = list[Math.min(featured, list.length - 1)] || GAMES[0];
  const st = stats(g.id);

  const recent = GAMES
    .filter((x) => stats(x.id).last)
    .sort((a, b) => stats(b.id).last - stats(a.id).last);

  return `
  <div class="wrap">
    ${!list.length ? '' : `
    <section class="hero" style="${accentVars(g)}">
      <div class="hero-art">${Art.hero(g.id)}</div>
      <div class="hero-inner">
        <span class="eyebrow">${st.launches ? 'In your library' : 'Featured'}</span>
        <h1>${pixTitle(fullTitle(g), 5, 13)}</h1>
        <p class="hero-tag">${esc(g.short)}</p>
        <div class="chips">
          ${g.genres.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}
          <span class="chip accent">Free</span>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn play" data-play="${g.id}">${ICON.play} Play now</button>
          <button class="btn ghost" data-go="${g.id}">Details</button>
        </div>
      </div>
      ${list.length > 1 ? `
      <div class="row" style="position:absolute;right:22px;bottom:20px;z-index:2;gap:7px">
        ${list.map((x, i) => `
          <button class="dot-btn" data-feature="${i}" aria-label="Show ${esc(x.title)}"
            style="width:${i === Math.min(featured, list.length - 1) ? 26 : 9}px;height:9px;border:0;padding:0;
                   border-radius:999px;cursor:pointer;transition:width .2s var(--ease),background .2s var(--ease);
                   background:${i === Math.min(featured, list.length - 1) ? g.accent : 'rgba(255,255,255,.32)'}"></button>`).join('')}
      </div>` : ''}
    </section>`}

    ${recent.length && list.length ? `
    <section class="sec">
      <div class="sec-head"><h2>${pixTitle('Jump back in', 3)}</h2><span class="sub">picks up where you left it</span></div>
      <div class="rail">
        ${recent.map((x) => {
          const s = stats(x.id);
          return `
          <button class="rail-item" data-play="${x.id}" style="${accentVars(x)}">
            <span class="rail-thumb">${Art.capsule(x.id)}</span>
            <span class="rail-body">
              <b>${esc(x.title)}</b>
              <span>${playtime(s.seconds)} · last played ${lastPlayed(s.last).toLowerCase()}</span>
            </span>
            <span class="rail-go">Play</span>
          </button>`;
        }).join('')}
      </div>
    </section>` : ''}

    ${list.length ? `
    <section class="sec">
      <div class="sec-head">
        <h2>${pixTitle(q ? 'Games' : 'All games', 3)}</h2>
        <span class="sub">${list.length} title${list.length === 1 ? '' : 's'} · free · nothing to install</span>
      </div>
      <div class="grid">${list.map(card).join('')}</div>
    </section>` : ''}

    ${demoMatches.length ? `
    <section class="sec">
      <div class="sec-head">
        <h2>${pixTitle('Demos', 3)}</h2>
        <span class="sub">${DEMOS.length} works in progress · leave a review</span>
        <span style="margin-left:auto"></span>
        <a class="btn ghost small" href="#/demos">See all</a>
      </div>
      <div class="grid">${demoMatches.slice(0, 6).map(demoCard).join('')}</div>
    </section>` : ''}
  </div>`;
}

/* -------------------------------------------------------- library view */

let sortBy = 'recent';

function viewLibrary(q) {
  const list = filter(q).slice().sort((a, b) => {
    const A = stats(a.id), B = stats(b.id);
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'played') return B.seconds - A.seconds;
    return (B.last || 0) - (A.last || 0) || a.title.localeCompare(b.title);
  });

  if (q && !list.length) return empty(q);

  const total = GAMES.reduce((n, g) => n + stats(g.id).seconds, 0);
  const launches = GAMES.reduce((n, g) => n + stats(g.id).launches, 0);

  return `
  <div class="wrap">
    <div class="sec-head" style="margin-bottom:20px">
      <h2>${pixTitle('Library', 5)}</h2>
      <span class="sub">${GAMES.length} games · ${playtime(total)} · ${launches} launch${launches === 1 ? '' : 'es'}</span>
      <span style="margin-left:auto"></span>
      <div class="row">
        ${[['recent', 'Recent'], ['name', 'Name'], ['played', 'Playtime']].map(([k, label]) =>
          `<button class="btn ghost small ${sortBy === k ? 'on' : ''}" data-sort="${k}">${label}</button>`).join('')}
      </div>
    </div>
    <div class="grid">
      ${list.map(card).join('')}
      <a class="card add" href="README.md" target="_blank" rel="noopener">
        <div>
          <b>+ Add a game</b>
          <p>Drop the game in its own folder, then add one entry to <code>games.js</code>. That is the whole job.</p>
          <p style="color:var(--accent)">Read the how-to →</p>
        </div>
      </a>
    </div>
  </div>`;
}

/* --------------------------------------------------------- detail view */

function viewGame(id) {
  const g = byId(id);
  if (!g) return empty('');
  const st = stats(g.id);

  return `
  <div class="wrap" style="${accentVars(g)}">
    <button class="back" data-back>${ICON.back} Back</button>

    <section class="hero detail-hero">
      <div class="hero-art">${Art.hero(g.id)}</div>
      <div class="hero-inner">
        <span class="eyebrow">${esc(g.developer)}</span>
        <h1>${pixTitle(fullTitle(g), 5, 13)}</h1>
        <p class="hero-tag">${esc(g.tagline)} — ${esc(g.short)}</p>
        <div class="row" style="margin-top:8px">
          <button class="btn play" data-play="${g.id}">${ICON.play} ${st.launches ? 'Play' : 'Play now'}</button>
          <button class="btn ghost ${st.favorite ? 'on' : ''}" data-fav="${g.id}">
            ${ICON.star} ${st.favorite ? 'Pinned' : 'Pin'}
          </button>
          <a class="btn ghost" href="${g.url}" target="_blank" rel="noopener" title="Open in its own tab">${ICON.pop}</a>
          ${/* Anything else a game wants a button for — an art book, a manual.
                Optional: a game with no `extras` in games.js gets nothing. */ ''}
          ${(g.extras || []).map((x) => `
            <a class="btn ghost" href="${x.url}"${x.blank ? ' target="_blank" rel="noopener"' : ''}>${esc(x.label)}</a>`).join('')}
        </div>
      </div>
    </section>

    <div class="stat-row" style="margin-top:18px">
      <div class="stat-cell"><b>${playtimeShort(st.seconds)}</b><span>Time played</span></div>
      <div class="stat-cell"><b>${st.launches}</b><span>Sessions</span></div>
      <div class="stat-cell"><b>${lastPlayed(st.last)}</b><span>Last played</span></div>
    </div>

    <div class="cols">
      <div>
        <div class="panel">
          <h3>About this game</h3>
          ${g.about.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>

        ${g.stages ? `
        <div class="panel">
          <h3>${esc(g.stagesTitle || 'Stages')}</h3>
          <table class="stages">
            ${g.stages.map(([n, name, desc]) => `
              <tr><td class="num">${esc(n)}</td><td class="nm">${esc(name)}</td><td class="ds">${esc(desc)}</td></tr>`).join('')}
          </table>
        </div>` : ''}

        <div class="panel">
          <h3>Controls</h3>
          <table class="keys">
            ${g.controls.map(([k, what]) => `
              <tr><td>${k.split(' / ').map((one) => `<kbd>${esc(one)}</kbd>`).join(' ')}</td><td>${esc(what)}</td></tr>`).join('')}
          </table>
          <p style="margin-top:14px;font-size:13px;color:var(--text-mute)">
            On a phone or tablet, touch controls appear on screen automatically.
          </p>
        </div>

        ${reviewBlock(g.id, g.title)}
      </div>

      <div>
        <div class="panel">
          <h3>Details</h3>
          <dl class="kv">
            <dt>Developer</dt><dd>${esc(g.developer)}</dd>
            <dt>Released</dt><dd>${esc(g.released)}</dd>
            <dt>Price</dt><dd style="color:var(--accent)">Free</dd>
            <dt>Runs in</dt><dd>Any browser</dd>
          </dl>
        </div>

        <div class="panel">
          <h3>Features</h3>
          <div class="chips">
            ${g.features.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}
          </div>
        </div>

        <div class="panel">
          <h3>Good to know</h3>
          <ul class="notes">
            ${g.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
            <li>Your progress is saved in this browser, on this device.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>`;
}

function empty(q) {
  return `<div class="wrap"><div class="empty">
    <b>Nothing matches “${esc(q)}”</b>
    There are only ${GAMES.length} games on the shelf so far.
  </div></div>`;
}

function filter(q) {
  if (!q) return GAMES;
  const t = q.toLowerCase();
  return GAMES.filter((g) =>
    (g.title + ' ' + g.tagline + ' ' + g.short + ' ' + g.genres.join(' ') + ' ' + g.features.join(' '))
      .toLowerCase().includes(t));
}

/* -------------------------------------------------------- play overlay */

const player = {
  el: document.getElementById('player'),
  frame: document.getElementById('player-frame'),
  bar: document.getElementById('player-bar'),
  clock: document.getElementById('player-clock'),
  title: document.getElementById('player-title'),
  pop: document.getElementById('player-pop'),
  id: null,
  started: 0,
  timer: null,
  sleep: null,
};

// `entry` is a game by default, but a playable demo works the same way.
function play(id, entry) {
  const g = entry || byId(id);
  if (!g || !g.url) return;

  const st = stats(id);
  st.launches++;
  st.last = Date.now();
  save();

  player.id = id;
  player.started = Date.now();
  player.title.textContent = g.title;
  player.pop.href = g.url;
  player.el.style.setProperty('--accent', g.accent);
  player.el.hidden = false;
  player.frame.src = g.url;
  document.body.style.overflow = 'hidden';

  player.timer = setInterval(() => {
    player.clock.textContent = clock(Math.floor((Date.now() - player.started) / 1000));
  }, 1000);
  player.clock.textContent = '0:00';

  wakeBar();
  player.frame.addEventListener('load', onFrameReady, { once: true });
}

// The game runs in an iframe, so its key presses and mouse moves never reach
// this page. Same origin means we are allowed to listen inside it instead —
// that is what keeps the exit pill responsive while you are playing.
function onFrameReady() {
  try {
    const doc = player.frame.contentDocument;
    if (!doc) return;
    doc.addEventListener('mousemove', wakeBar, { passive: true });
    doc.addEventListener('touchstart', wakeBar, { passive: true });
    doc.addEventListener('keydown', (e) => {
      // Esc belongs to the games (they use it for their own menus), so exiting
      // is a deliberate two-key combo instead.
      if (e.key === 'Escape' && e.shiftKey) stop();
    });
    player.frame.contentWindow.focus();
  } catch (e) { /* a game served from elsewhere would land here; harmless */ }
}

function wakeBar() {
  player.bar.classList.add('awake');
  clearTimeout(player.sleep);
  player.sleep = setTimeout(() => player.bar.classList.remove('awake'), 2600);
}

function bank() {
  if (!player.id || !player.started) return;
  const secs = Math.floor((Date.now() - player.started) / 1000);
  if (secs > 2) stats(player.id).seconds += secs;
  player.started = Date.now();
  save();
}

function stop() {
  if (!player.id) return;
  bank();
  clearInterval(player.timer);
  clearTimeout(player.sleep);
  player.frame.src = 'about:blank';
  player.el.hidden = true;
  player.id = null;
  player.started = 0;
  render();
  document.getElementById('view').focus();
}

// Closing the tab mid-game should still count the session.
addEventListener('pagehide', bank);
document.addEventListener('visibilitychange', () => { if (document.hidden) bank(); });

document.getElementById('player-exit').addEventListener('click', stop);
player.el.addEventListener('mousemove', wakeBar, { passive: true });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.shiftKey && player.id) stop(); });

/* --------------------------------------------------------------- router */

const view = document.getElementById('view');
const search = document.getElementById('search');

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('game/')) return { name: 'game', id: h.slice(5) };
  if (h.startsWith('demo/')) return { name: 'demo', id: h.slice(5) };
  if (h === 'library') return { name: 'library' };
  if (h === 'demos') return { name: 'demos' };
  return { name: 'home' };
}

// Which top tab lights up for each view.
const TAB_FOR = { game: 'library', library: 'library', demo: 'demos', demos: 'demos', home: 'home' };

function render() {
  const r = route();
  const q = search.value.trim();

  view.innerHTML =
    r.name === 'game' ? viewGame(r.id) :
    r.name === 'demo' ? viewDemo(r.id) :
    r.name === 'library' ? viewLibrary(q) :
    r.name === 'demos' ? viewDemos(q) :
    viewHome(q);

  document.querySelectorAll('.tabs a').forEach((a) =>
    a.classList.toggle('on', a.dataset.tab === TAB_FOR[r.name]));

  renderSidebar();

  const named = r.name === 'game' ? byId(r.id) : r.name === 'demo' ? byDemo(r.id) : null;
  document.title = named ? `${named.title} · Thirsty Bear Hub` : 'Thirsty Bear Hub';
}

addEventListener('hashchange', () => { view.scrollTop = 0; render(); });

/* --------------------------------------------------------------- events */

// One listener for the whole page: every button carries what it does in a
// data- attribute, so re-rendering never leaves stale handlers behind.
document.addEventListener('click', (e) => {
  // Stars are set straight on the DOM rather than through a re-render, so the
  // half-written review in the textarea below them survives being rated.
  const star = e.target.closest('[data-star]');
  if (star) {
    const n = +star.dataset.star;
    const group = star.closest('.stars');
    group.querySelectorAll('[data-star]').forEach((b) =>
      b.classList.toggle('on', +b.dataset.star <= n));
    const form = star.closest('form');
    form.elements.rating.value = n;
    form.querySelector('.rv-hint').textContent = ['', 'Bad', 'Poor', 'Fine', 'Good', 'Great'][n];
    form.querySelector('.rv-error').hidden = true;
    return;
  }

  const del = e.target.closest('[data-unreview]');
  if (del) {
    const [key, id] = del.dataset.unreview.split(':');
    if (LIVE) {
      del.disabled = true;
      Accounts.deleteReview(id)
        .then(() => { invalidateReviews(key); render(); })
        .catch((err) => { del.disabled = false; alert(err.message); });
    } else {
      state.reviews[key] = reviewsFor(key).filter((r) => String(r.ts) !== id);
      save();
      render();
    }
    return;
  }

  // Swap between "sign in" and "create an account" without losing the page.
  const mode = e.target.closest('[data-authmode]');
  if (mode) {
    authMode = mode.dataset.authmode;
    authError = '';
    authNote = '';
    render();
    return;
  }

  if (e.target.closest('[data-signout]')) {
    Accounts.signOut();
    Object.keys(live).forEach(invalidateReviews); // drop the "mine" flags
    render();
    return;
  }

  const demo = e.target.closest('[data-demo]');
  if (demo) { location.hash = `#/demo/${demo.dataset.demo}`; return; }

  const playDemo = e.target.closest('[data-playdemo]');
  if (playDemo) {
    const d = byDemo(playDemo.dataset.playdemo);
    play(d.id, { ...d, url: demoUrl(d) });
    return;
  }

  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.preventDefault();
    e.stopPropagation();
    const st = stats(fav.dataset.fav);
    st.favorite = !st.favorite;
    save();
    render();
    return;
  }

  const playBtn = e.target.closest('[data-play]');
  if (playBtn) { play(playBtn.dataset.play); return; }

  const go = e.target.closest('[data-go]');
  if (go) { location.hash = `#/game/${go.dataset.go}`; return; }

  const sort = e.target.closest('[data-sort]');
  if (sort) { sortBy = sort.dataset.sort; render(); return; }

  const feat = e.target.closest('[data-feature]');
  if (feat) { featured = +feat.dataset.feature; render(); return; }

  if (e.target.closest('[data-back]')) {
    history.length > 1 ? history.back() : (location.hash = '#/library');
    return;
  }
});

document.addEventListener('submit', (e) => {
  const auth = e.target.closest('[data-auth]');
  if (auth) {
    e.preventDefault();
    handleAuth(auth);
    return;
  }

  const form = e.target.closest('[data-review]');
  if (!form) return;
  e.preventDefault();

  const key = form.dataset.review;
  const stars = +form.elements.rating.value;
  const text = form.elements.text.value.trim();

  // A star is the one thing a review cannot do without — the words are optional.
  if (!stars) {
    form.querySelector('.rv-error').hidden = false;
    return;
  }

  if (LIVE) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    Accounts.postReview(key, stars, text)
      .then(() => { invalidateReviews(key); render(); })
      .catch((err) => {
        btn.disabled = false;
        btn.textContent = 'Post review';
        const slot = form.querySelector('.rv-error');
        slot.textContent = err.message;
        slot.hidden = false;
      });
    return;
  }

  const who = form.elements.who.value.trim();
  (state.reviews[key] ||= []).push({ stars, text, who, ts: Date.now() });
  save();
  render();
});

function handleAuth(form) {
  const signingUp = form.dataset.auth === 'signup';
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const username = signingUp ? form.elements.username.value.trim() : '';
  const btn = form.querySelector('button[type="submit"]');

  authError = '';
  authNote = '';

  if (signingUp) {
    const bad = Accounts.checkUsername(username);
    if (bad) { authError = bad; render(); return; }
  }

  btn.disabled = true;
  btn.textContent = signingUp ? 'Creating…' : 'Signing in…';

  const done = (fn) => fn
    .then((res) => {
      if (signingUp && res && res.needsConfirmation) {
        authMode = 'in';
        authNote = `Account made. Check ${email} for a confirmation link, then sign in.`;
      }
      Object.keys(live).forEach(invalidateReviews); // pick up "mine" flags
      render();
    })
    .catch((err) => { authError = err.message; render(); });

  done(signingUp
    ? Accounts.signUp(email, password, username)
    : Accounts.signIn(email, password));
}

// Enter/Space on the pin star, which is a span inside a button.
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-fav]')) {
    e.preventDefault();
    e.target.click();
  }
});

// Typing while you are on a single game or demo page bounces you back out to
// the list you were searching, otherwise the results have nowhere to appear.
search.addEventListener('input', () => {
  const r = route().name;
  if (r === 'game') location.hash = '#/library';
  else if (r === 'demo') location.hash = '#/demos';
  else render();
});

// "/" focuses search, the way it does everywhere else.
addEventListener('keydown', (e) => {
  if (player.id) return;
  if (e.key === '/' && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
    search.select();
  }
  if (e.key === 'Escape' && document.activeElement === search) {
    search.value = '';
    search.blur();
    render();
  }
});

/* -------------------------------------------------- mobile sidebar */

const sideToggle = document.getElementById('side-toggle');
const scrim = document.getElementById('scrim');

function closeSide() {
  document.body.classList.remove('side-open');
  scrim.hidden = true;
  sideToggle.setAttribute('aria-expanded', 'false');
}

sideToggle.addEventListener('click', () => {
  const open = document.body.classList.toggle('side-open');
  scrim.hidden = !open;
  sideToggle.setAttribute('aria-expanded', String(open));
});
scrim.addEventListener('click', closeSide);
document.getElementById('side-list').addEventListener('click', closeSide);

/* ------------------------------------------------------------------ go */

// The bits of chrome that are pixel type rather than markup.
document.getElementById('brand-text').innerHTML =
  Art.text('Thirsty Bear', { u: 2 }) + Art.text('Hub', { u: 2 });
document.getElementById('player-exit-icon').innerHTML = ICON.back;
document.getElementById('player-pop').innerHTML = ICON.pop;

render();
discoverDemos();
