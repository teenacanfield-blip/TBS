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

  function poll() {
    if (!running) return;
    requestAnimationFrame(poll);

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

    for (const code of [...held]) if (!want.has(code)) release(code);
    for (const code of want) {
      if (held.has(code)) continue;
      held.add(code);
      fire('keydown', code);
    }
  }

  /* `keys` names the key each control should press. Anything left out is
   * simply not sent, so a game that has no use for Y never sees it. */
  function start(keys) {
    map = Object.assign({}, DEFAULTS, keys || {});
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
  };
})();
