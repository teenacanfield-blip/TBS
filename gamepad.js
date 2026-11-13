/* One gamepad layer for every game on the site.
 *
 * Each game here already listens for the keyboard. Rather than teach fifteen
 * separate games to poll `navigator.getGamepads()` — fifteen deadzones to get
 * wrong, fifteen places for a stuck button to live — this turns an Xbox pad
 * into the key presses that game is already waiting for. A game opts in with
 * one script tag and one line saying which key each control stands for, and
 * nothing else about it changes.
 *
 *     <script src="../gamepad.js"></script>
 *     <script>Pad.start({ a: 'Space', b: 'Escape', start: 'Enter' });</script>
 *
 * Directions default to the arrow keys, so a game that only needs arrows and
 * a button can call `Pad.start({ a: 'Space' })` and be done.
 *
 * Browsers will not list a pad until it has been used, so there is nothing to
 * ask the player and nothing to configure: press anything on the controller
 * and it starts working.
 */
const Pad = (() => {
  'use strict';

  /* The standard mapping every Xbox-style pad reports. Index order is fixed by
   * the Gamepad API, which is the only reason hard-coding numbers is safe. */
  const BUTTON = {
    a: 0, b: 1, x: 2, y: 3,
    lb: 4, rb: 5, lt: 6, rt: 7,
    back: 8, start: 9,
    ls: 10, rs: 11,
    up: 12, down: 13, left: 14, right: 15,
  };

  // Sticks rest slightly off centre, and a worn one rests further off still.
  const DEADZONE = 0.45;

  // Triggers are axes pretending to be buttons; half pressed is pressed.
  const TRIGGER = 0.5;

  const DEFAULTS = {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  };

  /* A KeyboardEvent needs `key` as well as `code`, because some of these games
   * read one and some read the other, and a game that reads the wrong one just
   * silently ignores the pad. */
  function keyFor(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    const named = {
      Space: ' ', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab',
      Backspace: 'Backspace', ShiftLeft: 'Shift', ShiftRight: 'Shift',
      ControlLeft: 'Control', ControlRight: 'Control',
      ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
      Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
      Minus: '-', Equal: '=',
    };
    return named[code] || code;
  }

  let map = null;             // control name -> key code
  let held = new Set();       // key codes currently down because of the pad
  let running = false;
  let onChange = null;

  function fire(type, code) {
    const ev = new KeyboardEvent(type, {
      code,
      key: keyFor(code),
      bubbles: true,
      cancelable: true,
    });
    /* Dispatched once, on an element, exactly like a real key press — it then
     * bubbles through the document to the window, so a game listening on any
     * of the three hears it, and hears it only once.
     *
     * It has to be an *element*. Firing on `document` makes `event.target` the
     * document itself, and any handler that does something element-shaped with
     * the target — `e.target.matches(...)`, as the hub's own does — throws on
     * every single button press. */
    const el = (document.activeElement instanceof Element)
      ? document.activeElement
      : document.body;
    if (el) el.dispatchEvent(ev);
  }

  function release(code) {
    if (!held.has(code)) return;
    held.delete(code);
    fire('keyup', code);
  }

  /* Everything the pad is asking for this frame, as key codes. */
  function pressedNow(gp) {
    const want = new Set();
    const press = (name) => { const c = map[name]; if (c) want.add(c); };

    for (const name in map) {
      const i = BUTTON[name];
      if (i === undefined) continue;
      // Triggers report as buttons on most pads and as axes on some.
      if (name === 'lt' || name === 'rt') {
        const b = gp.buttons[i];
        if (b && (b.pressed || b.value > TRIGGER)) press(name);
        continue;
      }
      if (gp.buttons[i] && gp.buttons[i].pressed) press(name);
    }

    // The left stick doubles as the d-pad, so either works without the game
    // knowing there is a difference.
    const [lx = 0, ly = 0] = gp.axes;
    if (lx < -DEADZONE) press('left');
    if (lx > DEADZONE) press('right');
    if (ly < -DEADZONE) press('up');
    if (ly > DEADZONE) press('down');

    return want;
  }

  /* ------------------------------------------------------------- menus */

  /* Turning the pad into key presses only gets a controller as far as the
   * game's keyboard goes, and several of these games have menus that are
   * buttons you click and nothing else. A pad pressing Space at Big Swing
   * Bonanza's front screen did precisely nothing.
   *
   * So when a game names its clickable menu, the d-pad moves focus through it
   * and A clicks — and those presses stop there rather than also being sent on
   * as keys, which would otherwise fire the menu and the game at once.
   *
   * Opt-in by selector, never guessed: in a game where the d-pad is movement,
   * silently stealing it to walk a menu would be worse than no support. */
  let menuSel = null;
  let navCooldown = 0;
  let menuIdx = -1;            // where the pad's cursor is, tracked here not in the DOM

  // Tags that can already take focus without being given a tabindex.
  const FOCUSABLE = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/;

  function menuItems() {
    if (!menuSel) return [];
    return [...document.querySelectorAll(menuSel)].filter((el) => {
      if (el.disabled || el.hidden) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;      // laid out but not shown
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    });
  }

  // A focus ring of our own: these games style their buttons but rarely style
  // focus, and a menu you are walking with a pad has to show where you are.
  function ensureRing() {
    if (document.getElementById('pad-ring-style')) return;
    const s = document.createElement('style');
    s.id = 'pad-ring-style';
    s.textContent =
      '.pad-focus{outline:3px solid #5ce08a !important;outline-offset:3px !important;}';
    document.head.appendChild(s);
  }

  function markFocus(el) {
    for (const o of document.querySelectorAll('.pad-focus')) o.classList.remove('pad-focus');
    if (!el) return;
    ensureRing();
    el.classList.add('pad-focus');

    /* Half these menus are divs, and a div cannot take focus — Legend Cart's
     * racer cards are exactly that. Without a tabindex the focus call is a
     * no-op, activeElement stays on the body, and the pad sticks on the first
     * item forever. -1 makes it focusable by script without putting it into
     * the tab order, which is what a menu item wants. */
    if (!el.hasAttribute('tabindex') && !FOCUSABLE.test(el.tagName)) {
      el.setAttribute('tabindex', '-1');
    }
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* Returns a word describing what the press was spent on, or null when there
   * is no menu to drive. Anything non-null means the directions and A stop
   * here rather than also going on as keys. */
  function driveMenu(want, dt) {
    const items = menuItems();
    if (items.length < 1) { menuIdx = -1; return null; }

    if (navCooldown > 0) navCooldown -= dt;

    const step = (want.has(map.down) ? 1 : 0) - (want.has(map.up) ? 1 : 0)
               || (want.has(map.right) ? 1 : 0) - (want.has(map.left) ? 1 : 0);

    /* Position is tracked here rather than read back from activeElement: the
     * focus call can legitimately fail (a div with no tabindex, a disabled
     * control, a browser that refuses), and reading it back would then pin the
     * cursor to item one. activeElement is still preferred when it agrees,
     * so clicking with the mouse and then picking up the pad carries on from
     * wherever the mouse left off. */
    const fromDom = items.indexOf(document.activeElement);
    if (fromDom >= 0) menuIdx = fromDom;
    if (menuIdx >= items.length) menuIdx = -1;

    if (step && navCooldown <= 0) {
      navCooldown = menuIdx < 0 ? 0.22 : 0.16;
      menuIdx = menuIdx < 0 ? (step > 0 ? 0 : items.length - 1)
                            : (menuIdx + step + items.length) % items.length;
      markFocus(items[menuIdx]);
      return 'nav';
    }

    if (want.has(map.a)) {
      if (menuIdx >= 0) { markFocus(items[menuIdx]); items[menuIdx].click(); return 'click'; }
      // Nothing chosen yet, so the first press lands the cursor rather than
      // firing something the player cannot see they had selected.
      menuIdx = 0;
      markFocus(items[0]);
      return 'nav';
    }

    return 'idle';
  }

  let lastPoll = 0;

  function poll(now) {
    if (!running) return;
    requestAnimationFrame(poll);

    // Seconds since the previous poll, for the menu's repeat rate. Clamped so
    // a backgrounded tab does not come back and skip a whole menu.
    const t = typeof now === 'number' ? now : performance.now();
    const dt = Math.min(0.1, lastPoll ? (t - lastPoll) / 1000 : 0.016);
    lastPoll = t;

    let gp = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) { gp = p; break; }

    if (!gp) {
      // Unplugged mid-press: let go of everything rather than leaving the
      // player walking into a wall forever.
      if (held.size) { [...held].forEach(release); if (onChange) onChange(false); }
      return;
    }

    const want = pressedNow(gp);

    /* A game that named a menu gets it driven whenever one is on screen, and
     * the directions and A are spent there. Everything else still becomes a
     * key, so a pause button or mute keeps working over an open menu. */
    const menu = menuSel ? driveMenu(want, dt) : null;
    if (menu) {
      for (const name of ['up', 'down', 'left', 'right', 'a']) {
        if (map[name]) want.delete(map[name]);
      }
    }

    for (const code of [...held]) if (!want.has(code)) release(code);
    for (const code of want) {
      if (held.has(code)) continue;
      held.add(code);
      fire('keydown', code);
    }
  }

  /* `keys` names the key each control should press. Anything left out is
   * simply not sent, so a game that has no use for Y never sees it.
   *
   * `opts.menu` is a selector for a clickable menu the d-pad should walk —
   * see driveMenu. Leave it out and the pad only ever presses keys. */
  function start(keys, opts) {
    map = Object.assign({}, DEFAULTS, keys || {});
    menuSel = (opts && opts.menu) || null;
    if (running) return Pad;
    running = true;

    // Chrome will not report a pad until it has been touched, so this is the
    // earliest moment the first one can appear.
    addEventListener('gamepadconnected', () => { if (onChange) onChange(true); });
    addEventListener('gamepaddisconnected', () => {
      [...held].forEach(release);
      if (onChange) onChange(false);
    });

    // A tab that loses focus stops getting gamepad updates; drop everything
    // rather than leaving a key stuck down until it comes back.
    addEventListener('blur', () => [...held].forEach(release));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) [...held].forEach(release);
    });

    requestAnimationFrame(poll);
    return Pad;
  }

  return {
    start,
    get connected() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) return true;
      return false;
    },
    // Lets a game show a "controller connected" hint if it wants one.
    onChange(fn) { onChange = fn; },
    // Exposed for testing: what the pad is holding down right now.
    get held() { return [...held]; },
    // Exposed for testing: the menu items the pad can currently reach.
    get menu() { return menuItems(); },
  };
})();

/* `const Pad` at the top level of a classic script makes a global *lexical*
 * binding, not a property of window — so `window.Pad` is undefined and the
 * guard every game uses, `window.Pad && Pad.start(...)`, silently never ran.
 * Publishing it explicitly is what makes that guard mean what it says. */
window.Pad = Pad;
