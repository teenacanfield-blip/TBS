/* Community games.
 *
 * People sign in, submit a game they have made, and it sits in a queue until
 * the owner of the site approves it. Approved games show up in the Community
 * tab; the ones the owner marks as featured are the ones good enough to reach
 * the front page.
 *
 * Submissions are LINKS, not files. A game stays wherever its author already
 * put it — itch.io, their own GitHub Pages, Scratch — and this site links to it
 * and frames it. That is a deliberate safety decision, not a shortcut:
 *
 *   A game uploaded onto this domain would run on this origin, which means it
 *   could read localStorage and walk off with the signed-in visitor's access
 *   token. Keeping community games on their author's own origin, inside a
 *   sandboxed iframe, means the worst a bad submission can do is be a bad game.
 *
 * See COMMUNITY-SETUP.md for the table and the rules behind all of this. Like
 * accounts.js, everything here is dormant until supabase-config.js is filled
 * in: `Community.configured` is false and the tab says so.
 */
const Community = (() => {
  const on = typeof Accounts !== 'undefined' && Accounts.configured;

  // Everything the list views need, including who wrote it.
  const COLS = 'id,title,tagline,blurb,url,accent,status,note,featured,created_at,author_id,profiles(username)';

  const STATUSES = ['pending', 'approved', 'rejected'];

  /* --------------------------------------------------------- validation */

  /* The same checks the database enforces, run early so people get a useful
   * message instead of a Postgres constraint name. */
  function check(fields) {
    const title = (fields.title || '').trim();
    const tagline = (fields.tagline || '').trim();
    const blurb = (fields.blurb || '').trim();
    const url = (fields.url || '').trim();
    const accent = (fields.accent || '').trim();

    if (title.length < 2 || title.length > 60) return 'Give your game a name, 2 to 60 characters.';
    if (tagline.length > 90) return 'The one-line description has to be 90 characters or less.';
    if (blurb.length > 600) return 'The description has to be 600 characters or less.';
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return 'Pick a colour for the cover.';

    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return 'That link does not look like a web address. It should start with https://';
    }

    // http:// pages are blocked by the browser inside an https page anyway, so
    // catching it here saves a confusing blank frame later.
    if (u.protocol !== 'https:') return 'The link has to start with https:// so it works inside the site.';

    // A game on our own origin could read the signed-in visitor's token out of
    // localStorage. Community games live on their author's own site.
    if (u.origin === location.origin) {
      return 'Link to where your game already lives — itch.io, Scratch, your own site. It cannot be hosted here.';
    }

    return null;
  }

  /* -------------------------------------------------------------- shape */

  function row(r) {
    const me = Accounts.session && Accounts.session.user;
    return {
      id: r.id,
      title: r.title,
      tagline: r.tagline || '',
      blurb: r.blurb || '',
      url: r.url,
      accent: r.accent || '#5ce08a',
      status: r.status,
      note: r.note || '',
      featured: Boolean(r.featured),
      who: (r.profiles && r.profiles.username) || 'Someone',
      ts: new Date(r.created_at).getTime(),
      mine: Boolean(me && r.author_id === me.id),
    };
  }

  /* ------------------------------------------------------------ reading */

  // What everybody sees in the Community tab.
  async function listApproved() {
    const rows = await Accounts.rest(
      `/rest/v1/community_games?select=${COLS}&status=eq.approved` +
      `&order=featured.desc,created_at.desc`
    );
    return (rows || []).map(row);
  }

  // Your own submissions, whatever state they are in.
  async function listMine() {
    if (!Accounts.session) return [];
    const rows = await Accounts.restAuthed(
      `/rest/v1/community_games?select=${COLS}` +
      `&author_id=eq.${Accounts.session.user.id}&order=created_at.desc`
    );
    return (rows || []).map(row);
  }

  // The moderation queue. The database only returns these to an admin, so a
  // curious visitor calling this by hand gets an empty list, not the queue.
  async function listPending() {
    const rows = await Accounts.restAuthed(
      `/rest/v1/community_games?select=${COLS}&status=eq.pending&order=created_at.asc`
    );
    return (rows || []).map(row);
  }

  /* ------------------------------------------------------------ writing */

  async function submit(fields) {
    if (!Accounts.session) throw new Error('Sign in first, then you can put a game up.');
    const bad = check(fields);
    if (bad) throw new Error(bad);

    await Accounts.restAuthed('/rest/v1/community_games', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        author_id: Accounts.session.user.id,
        title: fields.title.trim(),
        tagline: (fields.tagline || '').trim(),
        blurb: (fields.blurb || '').trim(),
        url: fields.url.trim(),
        accent: fields.accent,
        // Never trust a status sent from the browser — the database refuses
        // anything but 'pending' on insert anyway.
        status: 'pending',
      }),
    });
  }

  // Approve or reject, with an optional line back to the author explaining why.
  async function decide(id, status, note) {
    if (!STATUSES.includes(status)) throw new Error('Unknown status.');
    await Accounts.restAuthed(`/rest/v1/community_games?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, note: (note || '').trim() }),
    });
  }

  // Featured is what "good enough for the main page" means in the database.
  async function feature(id, onOff) {
    await Accounts.restAuthed(`/rest/v1/community_games?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ featured: Boolean(onOff) }),
    });
  }

  async function remove(id) {
    await Accounts.restAuthed(`/rest/v1/community_games?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  return {
    configured: on,
    check,
    listApproved,
    listMine,
    listPending,
    submit,
    decide,
    feature,
    remove,
  };
})();
