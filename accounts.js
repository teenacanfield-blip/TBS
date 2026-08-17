/* Accounts and live reviews.
 *
 * Talks to Supabase over plain HTTP with fetch. There is deliberately no SDK:
 * the rest of this site has no dependencies, and a CDN script is a real failure
 * mode here — the 3D demos already go blank on networks that block CDNs. Doing
 * it by hand is a couple of hundred lines and cannot be blocked separately from
 * the site itself.
 *
 * Everything degrades: if supabase-config.js is empty, `Accounts.configured` is
 * false, the sign-in box never appears, and the hub falls back to the old
 * browser-only reviews.
 */
const Accounts = (() => {
  const url = (typeof SUPABASE !== 'undefined' && SUPABASE.url || '').replace(/\/+$/, '');
  const key = (typeof SUPABASE !== 'undefined' && SUPABASE.anonKey) || '';
  const configured = Boolean(url && key);

  const SESSION_KEY = 'arcade.session.v1';
  const listeners = new Set();

  let session = loadSession();

  /* ------------------------------------------------------------- session */

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; // storage blocked; you just cannot stay signed in
    }
  }

  function storeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* nothing worth breaking over */ }
    listeners.forEach((fn) => fn(session));
  }

  // Supabase returns expires_in (seconds from now); we keep an absolute time so
  // a session that sat in storage overnight is correctly seen as stale.
  function sessionFrom(data, username) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      user: { id: data.user && data.user.id, email: data.user && data.user.email },
      username: username || (data.user && data.user.user_metadata && data.user.user_metadata.username) || '',
    };
  }

  /* ----------------------------------------------------------- plumbing */

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(url + path, {
        ...opts,
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      });
    } catch (e) {
      // fetch only rejects when the request never got there at all — no
      // internet, a blocked network, or a wrong project URL. "Failed to fetch"
      // means nothing to the person reading it.
      throw new Error('Could not reach the accounts server. Check your internet connection and try again.');
    }

    const body = await res.text();
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch (e) { /* not json */ }

    if (!res.ok) {
      const msg =
        (json && (json.msg || json.message || json.error_description || json.error)) ||
        `Something went wrong (${res.status}).`;
      throw new Error(friendly(msg));
    }
    return json;
  }

  // Supabase's wording is aimed at developers. These are the ones a visitor is
  // actually likely to hit.
  function friendly(msg) {
    const m = String(msg);
    if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Try signing in instead.';
    if (/invalid login credentials/i.test(m)) return 'That email and password do not match.';
    if (/email not confirmed/i.test(m)) return 'Check your email and click the confirmation link first.';
    if (/duplicate key|profiles_username_key/i.test(m)) return 'That username is taken. Pick another.';
    if (/password should be at least/i.test(m)) return 'Password needs to be at least 6 characters.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
    return m;
  }

  // Refreshes the token when it is within a minute of expiring, so a long
  // session does not fail mid-post.
  async function freshToken() {
    if (!session) return null;
    if (Date.now() < session.expires_at - 60000) return session.access_token;

    try {
      const data = await api('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      storeSession(sessionFrom(data, session.username));
      return session.access_token;
    } catch (e) {
      storeSession(null); // refresh token is dead — make them sign in again
      return null;
    }
  }

  async function authed(path, opts = {}) {
    const token = await freshToken();
    if (!token) throw new Error('You need to sign in again.');
    return api(path, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
  }

  /* --------------------------------------------------------------- auth */

  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

  function checkUsername(name) {
    if (!USERNAME_RE.test(name)) {
      return 'Username must be 3–20 characters: letters, numbers and _ only.';
    }
    return null;
  }

  async function usernameTaken(name) {
    const rows = await api(
      `/rest/v1/profiles?select=username&username=eq.${encodeURIComponent(name)}&limit=1`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async function signUp(email, password, username) {
    const bad = checkUsername(username);
    if (bad) throw new Error(bad);
    if (await usernameTaken(username)) throw new Error('That username is taken. Pick another.');

    // The username rides along in the signup so the database trigger can make
    // the profile row in the same breath as the account.
    const data = await api('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { username } }),
    });

    // With email confirmation on (the default, and the point of asking for an
    // email at all) there is no session yet — they have to click the link.
    if (data && data.access_token) {
      storeSession(sessionFrom(data, username));
      return { needsConfirmation: false };
    }
    return { needsConfirmation: true };
  }

  async function signIn(email, password) {
    const data = await api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeSession(sessionFrom(data));

    // user_metadata is the fast path; fall back to the profiles table for
    // accounts made before the username was stored there.
    if (!session.username) {
      try {
        const rows = await authed(`/rest/v1/profiles?select=username&id=eq.${session.user.id}&limit=1`);
        if (rows && rows[0]) storeSession({ ...session, username: rows[0].username });
      } catch (e) { /* the name is cosmetic; do not fail the sign-in over it */ }
    }
    return session;
  }

  function signOut() {
    // Best-effort server-side revoke; the local session goes either way.
    if (session) {
      api('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    storeSession(null);
  }

  /* ------------------------------------------------------------ reviews */

  async function listReviews(gameKey) {
    const rows = await api(
      `/rest/v1/reviews?select=id,game_key,stars,text,created_at,user_id,profiles(username)` +
      `&game_key=eq.${encodeURIComponent(gameKey)}&order=created_at.desc`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    return (rows || []).map((r) => ({
      id: r.id,
      stars: r.stars,
      text: r.text || '',
      who: (r.profiles && r.profiles.username) || 'Player',
      ts: new Date(r.created_at).getTime(),
      mine: Boolean(session && session.user && r.user_id === session.user.id),
    }));
  }

  async function postReview(gameKey, stars, text) {
    if (!session) throw new Error('Sign in to post a review.');
    await authed('/rest/v1/reviews', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        game_key: gameKey,
        stars,
        text: text || '',
        user_id: session.user.id,
      }),
    });
  }

  async function deleteReview(id) {
    await authed(`/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  return {
    configured,
    get session() { return session; },
    get username() { return session ? session.username : ''; },
    onChange(fn) { listeners.add(fn); },
    checkUsername,
    signUp,
    signIn,
    signOut,
    listReviews,
    postReview,
    deleteReview,
  };
})();
