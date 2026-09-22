/* Pokémon Rip and Go — the ladder.
 *
 * A board of teams other people have posted, and a way to fight them. It is
 * the one part of this game that needs something outside the browser, so it
 * is also the one part that can be switched off and leave no hole behind:
 * with no Supabase configured, `Ladder.state()` says so and the menu entry
 * explains what is missing instead of failing at a blank screen.
 *
 * ----------------------------------------------------------------- honesty
 *
 * Records are self-reported. They have to be — this is a static site, there
 * is no referee, and the only key the page has is the public one. A trigger
 * in the database stops a record going backwards or jumping by more than one
 * at a time, which makes inventing a hundred wins tedious rather than
 * impossible. The board says as much on its own face. It is a place to find
 * teams worth fighting, not a competitive rank, and pretending otherwise
 * would be the dishonest part.
 *
 * What is NOT self-reported is the team: it travels as a code, the same one
 * codes.js validates, so nobody can post a creature that does not exist or a
 * moveset it could never learn.
 *
 * ---------------------------------------------------------------- sign-in
 *
 * There is no password field in this game and there is not going to be one.
 * Posting to the board needs an account, and accounts are made and signed
 * into on the hub, which has real form fields and a browser that can fill
 * them. The game only ever reads the session that is already there.
 */
const Ladder = (() => {
  'use strict';

  const TABLE = '/rest/v1/ladder';
  const LIMIT = 40;

  function accounts() {
    return typeof Accounts !== 'undefined' && Accounts ? Accounts : null;
  }

  /* Why the board is or is not available, in the order the player has to fix
   * them. The UI prints this rather than deciding for itself. */
  function state() {
    const a = accounts();
    if (!a) return { ok: false, why: 'nofiles' };
    if (!a.configured) return { ok: false, why: 'unconfigured' };
    if (!a.session) return { ok: false, why: 'signedout' };
    return { ok: true, why: '', name: a.username || 'ANON' };
  }

  function explain(why) {
    if (why === 'nofiles') {
      return ['The ladder needs the site\'s account files and this page cannot see them.',
        'It works when the game is opened from the site rather than on its own.'];
    }
    if (why === 'unconfigured') {
      return ['No ladder is switched on for this site yet.',
        'It takes a free Supabase project and two values pasted into supabase-config.js.',
        'LADDER-SETUP.md at the top of the repository walks through it.'];
    }
    if (why === 'signedout') {
      return ['The board is there, but you are not signed in.',
        'Sign in on the main site and come back — this game has no password box and never will.'];
    }
    return ['Something is off with the ladder.'];
  }

  /* ================================================================ board */

  async function list() {
    const a = accounts();
    if (!a || !a.configured) throw new Error('No ladder is switched on for this site.');
    const rows = await a.rest(
      TABLE + '?select=username,code,badges,wins,losses,updated_at'
      + '&order=wins.desc,losses.asc&limit=' + LIMIT
    );
    return (Array.isArray(rows) ? rows : []).filter(valid);
  }

  /* A row from a server is data, not instructions, and it arrived from
   * somebody else's browser. Anything that is not a team this game can
   * actually build is dropped here rather than halfway through drawing it. */
  function valid(row) {
    if (!row || typeof row.code !== 'string' || typeof row.username !== 'string') return false;
    if (row.username.length > 24) return false;
    const out = Codes.decode(row.code);
    return out.ok && out.team.length > 0;
  }

  function teamOf(row) {
    const out = Codes.decode(row.code);
    return out.ok ? out.team : [];
  }

  /* =============================================================== posting */

  async function post(code, badges) {
    const a = accounts();
    const s = state();
    if (!s.ok) throw new Error(explain(s.why)[0]);

    const body = {
      user_id: a.session.user.id,
      username: (a.username || 'ANON').slice(0, 24),
      code: Codes.strip(code),
      badges: Math.max(0, Math.min(3, badges | 0)),
    };
    // One row each: upsert so posting a second team replaces the first
    // rather than filling the board with one person's drafts.
    await a.restAuthed(TABLE + '?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
  }

  async function record(won) {
    const a = accounts();
    const s = state();
    if (!s.ok) return;                       // a result nobody can file is not an error
    const mine = await a.restAuthed(
      TABLE + '?select=wins,losses&user_id=eq.' + encodeURIComponent(a.session.user.id) + '&limit=1'
    );
    if (!Array.isArray(mine) || !mine[0]) return;   // nothing posted yet, nothing to add to
    const next = won
      ? { wins: (mine[0].wins | 0) + 1 }
      : { losses: (mine[0].losses | 0) + 1 };
    await a.restAuthed(TABLE + '?user_id=eq.' + encodeURIComponent(a.session.user.id), {
      method: 'PATCH',
      body: JSON.stringify(next),
      headers: { Prefer: 'return=minimal' },
    });
  }

  async function remove() {
    const a = accounts();
    const s = state();
    if (!s.ok) throw new Error(explain(s.why)[0]);
    await a.restAuthed(TABLE + '?user_id=eq.' + encodeURIComponent(a.session.user.id), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  return { state, explain, list, post, record, remove, teamOf, valid };
})();
