/* One touch layer for every game on the site.
 *
 * gamepad.js turns an Xbox pad into the keys a game already listens for. This
 * does the same for a phone or tablet: an on-screen stick and buttons that press
 * those same keys, so a game opts in with one script tag and one line saying
 * what its controls are, and nothing else about it changes.
 *
 *     <script src="../touch.js?v=1"></script>
 *     <script>window.TouchKeys && TouchKeys.start({
 *       stick: { keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } },
 *       buttons: [{ label: 'Jump', key: 'Space', at: { right: 24, bottom: 40 }, big: true }],
 *     });</script>
 *
 * The controls only appear on a touch screen: a phone or tablet straight away,
 * a laptop the moment someone touches its screen. Desktop players never see
 * them. Put ?touch in the address to force them on when testing with a mouse.
 *
 * Three kinds of game are covered:
 *
 *   Keys games. The stick and the buttons press and release keys, exactly as a
 *   keyboard would. A button is held for as long as the finger stays on it.
 *
 *   Mouse-look games. `look: { drag: true }` turns a drag across the right of
 *   the screen into mousemove events carrying movementX/Y, the way a captured
 *   mouse sends them. A phone cannot capture the pointer, so the game has to
 *   accept those events while `TouchKeys.active` is true.
 *
 *   Games that read a controller themselves (Floodlight). `pad: true` shows the
 *   controls to the game as a standard gamepad instead: the left stick, a right
 *   stick for aiming, and each button by its standard index. A built game whose
 *   source is somewhere else works without a line of it changing. A real pad,
 *   if one is plugged in, still comes first.
 *
 * Optional extras: `slider` (a vertical bar, for a throttle), `visible` (a
 * function polled every frame; while it returns false the controls hide and
 * let go of everything, which is how they stay off a game's menus) and `onShow`.
 *
 * It is called TouchKeys rather than Touch because browsers already own `Touch`.
 */
const TouchKeys = (() => {
  'use strict';

  /* Same naming as gamepad.js: a KeyboardEvent needs `key` as well as `code`,
   * because some games read one and some the other. */
  function keyFor(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    const named = {
      Space: ' ', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab',
      Backspace: 'Backspace', ShiftLeft: 'Shift', ShiftRight: 'Shift',
      ControlLeft: 'Control', ControlRight: 'Control',
      ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
      BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.',
      Slash: '/', Semicolon: ';', Minus: '-', Equal: '=',
    };
    return named[code] || code;
  }

  // Fired on an element, never on `document`, for the same reason gamepad.js
  // gives: handlers that treat the target as an element throw otherwise.
  const target = () => (document.activeElement instanceof Element ? document.activeElement : document.body);

  const down = new Map();     // key code -> how many controls are holding it
  function press(code) {
    const n = down.get(code) || 0;
    down.set(code, n + 1);
    if (!n) target().dispatchEvent(new KeyboardEvent('keydown', { code, key: keyFor(code), bubbles: true, cancelable: true }));
  }
  function release(code) {
    const n = down.get(code) || 0;
    if (!n) return;
    if (n > 1) { down.set(code, n - 1); return; }
    down.delete(code);
    target().dispatchEvent(new KeyboardEvent('keyup', { code, key: keyFor(code), bubbles: true, cancelable: true }));
  }

  function mouse(type, button, x = innerWidth / 2, y = innerHeight / 2) {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, button, buttons: type === 'mouseup' ? 0 : 1 << button, clientX: x, clientY: y });
    document.body.dispatchEvent(ev);
  }

  function look(dx, dy) {
    const ev = new MouseEvent('mousemove', { bubbles: true, cancelable: true, movementX: dx, movementY: dy, clientX: innerWidth / 2, clientY: innerHeight / 2 });
    // Older Safari drops movementX/Y from the constructor; put them back on.
    if (ev.movementX !== dx) {
      Object.defineProperty(ev, 'movementX', { value: dx });
      Object.defineProperty(ev, 'movementY', { value: dy });
    }
    document.body.dispatchEvent(ev);
  }

  /* ------------------------------------------------------ virtual gamepad */
  /* For games that poll navigator.getGamepads() themselves. It is appended
   * after any real pads, and only while the controls are on screen, so a real
   * controller always wins. */
  const vpad = {
    id: 'TouchKeys on-screen controls', index: 3, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0], vibrationActuator: null, hapticActuators: [],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  function padButton(i, on) {
    const b = vpad.buttons[i];
    if (!b) return;
    b.pressed = b.touched = on;
    b.value = on ? 1 : 0;
    vpad.timestamp = performance.now();
  }
  function hookGamepads() {
    const real = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
    const list = () => {
      const pads = [...real()];
      if (active) pads.push(vpad);
      return pads;
    };
    try { Object.defineProperty(navigator, 'getGamepads', { value: list, configurable: true }); }
    catch (e) { navigator.getGamepads = list; }
  }

  /* ---------------------------------------------------------- the controls */
  const CSS = `
  #tk{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:700 13px/1 system-ui,sans-serif;
    -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
  #tk.off{display:none}
  #tk .c{position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box}
  #tk .look{inset:0 0 0 38%}
  #tk .base{width:150px;height:150px;border-radius:50%;background:rgba(10,16,28,.32);border:2px solid rgba(255,255,255,.28)}
  #tk .knob{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;
    background:rgba(255,255,255,.34);border:2px solid rgba(255,255,255,.6);pointer-events:none}
  #tk .btn{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;
    color:#fff;background:rgba(10,16,28,.42);border:2px solid rgba(255,255,255,.4);text-shadow:0 1px 2px #000;letter-spacing:.02em}
  #tk .btn.big{width:84px;height:84px;font-size:15px}
  #tk .btn.small{width:50px;height:40px;border-radius:12px;font-size:11px}
  #tk .btn.on{background:rgba(255,191,71,.55);border-color:#ffbf47}
  #tk .sl{width:52px;border-radius:14px;background:rgba(10,16,28,.42);border:2px solid rgba(255,255,255,.4);overflow:hidden}
  #tk .sl i{position:absolute;left:0;right:0;bottom:0;background:rgba(255,191,71,.55)}
  #tk .sl b{position:absolute;left:0;right:0;top:6px;text-align:center;color:#fff;font-size:11px;text-shadow:0 1px 2px #000}`;

  let cfg = null, root = null, shown = false, active = false;
  const updaters = [];     // run every frame (slider fill)
  const letGo = [];        // let go of everything a control is holding

  // `at` is { left|right, top|bottom } in pixels from that edge, inside the safe area.
  function place(el, at = {}) {
    for (const side of ['left', 'right', 'top', 'bottom']) {
      if (at[side] == null) continue;
      el.style[side] = typeof at[side] === 'number' ? `calc(env(safe-area-inset-${side}, 0px) + ${at[side]}px)` : at[side];
    }
    if (at.height != null) el.style.height = typeof at.height === 'number' ? at.height + 'px' : at.height;
  }

  /* Pointer events, one finger per control, captured so a thumb that slides
   * off the edge keeps driving it until it lifts. */
  function track(el, { start, move, end }) {
    let id = null;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (err) {}
      e.preventDefault();
      start(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); move && move(e); } });
    const stop = (e) => { if (e.pointerId !== id) return; id = null; end(e); };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop);
    letGo.push(() => { if (id !== null) { id = null; end(); } });
  }

  function makeStick(spec, side) {
    const base = document.createElement('div');
    base.className = 'c base';
    const knob = document.createElement('div');
    knob.className = 'knob';
    base.appendChild(knob);
    place(base, spec.at || (side === 'left' ? { left: 28, bottom: 28 } : { right: 28, bottom: 28 }));
    const R = 60;
    const held = new Set();
    let cx = 0, cy = 0;
    const set = (dx, dy) => {
      const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      dx *= k; dy *= k;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const x = dx / R, y = dy / R;
      if (spec.keys) {
        const want = new Set();
        if (y < -0.38) want.add(spec.keys.up);
        if (y > 0.38) want.add(spec.keys.down);
        if (x < -0.38) want.add(spec.keys.left);
        if (x > 0.38) want.add(spec.keys.right);
        for (const c of held) if (!want.has(c)) { held.delete(c); release(c); }
        for (const c of want) if (c && !held.has(c)) { held.add(c); press(c); }
      } else {
        const a = side === 'left' ? 0 : 2;
        vpad.axes[a] = x; vpad.axes[a + 1] = y;
        vpad.timestamp = performance.now();
      }
    };
    track(base, {
      start(e) { const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; set(e.clientX - cx, e.clientY - cy); },
      move(e) { set(e.clientX - cx, e.clientY - cy); },
      end() { set(0, 0); },
    });
    root.appendChild(base);
  }

  function makeLook(spec) {
    const area = document.createElement('div');
    area.className = 'c look';
    if (spec.at) { area.style.inset = 'auto'; place(area, spec.at); }
    let lx = 0, ly = 0;
    const sens = spec.sens || 1;
    track(area, {
      start(e) { lx = e.clientX; ly = e.clientY; },
      move(e) {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        if (dx || dy) look(dx * sens, dy * sens);
      },
      end() {},
    });
    root.appendChild(area);
  }

  function makeButton(b) {
    const el = document.createElement('div');
    el.className = 'c btn' + (b.big ? ' big' : '') + (b.small ? ' small' : '');
    el.textContent = b.label;
    place(el, b.at);
    track(el, {
      start() {
        el.classList.add('on');
        if (b.key) press(b.key);
        if (b.pad != null) padButton(b.pad, true);
        if (b.mouse != null) mouse('mousedown', b.mouse);
      },
      end() {
        el.classList.remove('on');
        if (b.key) release(b.key);
        if (b.pad != null) padButton(b.pad, false);
        if (b.mouse != null) mouse('mouseup', b.mouse);
      },
    });
    root.appendChild(el);
  }

  function makeSlider(s) {
    const el = document.createElement('div');
    el.className = 'c sl';
    el.innerHTML = '<i></i><b></b>';
    el.querySelector('b').textContent = s.label || '';
    place(el, s.at || { right: 24, bottom: 120, height: 180 });
    const fill = el.querySelector('i');
    const setFrom = (e) => {
      const r = el.getBoundingClientRect();
      s.set(Math.max(0, Math.min(1, 1 - (e.clientY - r.top - 8) / (r.height - 16))));
    };
    track(el, { start: setFrom, move: setFrom, end() {} });
    updaters.push(() => { fill.style.height = Math.round(Math.max(0, Math.min(1, s.get())) * 100) + '%'; });
    root.appendChild(el);
  }

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'tk';
    root.setAttribute('aria-hidden', 'true');
    // Order matters: the look area goes first so the sticks and buttons sit on top of it.
    if (cfg.look && cfg.look.drag) makeLook(cfg.look);
    if (cfg.stick) makeStick(cfg.stick, 'left');
    if (cfg.look && cfg.look.stick) makeStick(cfg.look, 'right');
    if (cfg.slider) makeSlider(cfg.slider);
    for (const b of cfg.buttons || []) makeButton(b);
    document.body.appendChild(root);
  }

  function letGoAll() {
    for (const f of letGo) f();
    for (const c of [...down.keys()]) { down.set(c, 1); release(c); }
    vpad.axes.fill(0);
    vpad.buttons.forEach((b, i) => padButton(i, false));
  }

  function sync() {
    let want = true;
    if (cfg.visible) { try { want = !!cfg.visible(); } catch (e) { want = true; } }
    if (want !== active) {
      if (!want) letGoAll();
      active = want;
      root.classList.toggle('off', !want);
    }
    if (active) for (const u of updaters) u();
  }
  function frame() { sync(); requestAnimationFrame(frame); }

  function show() {
    if (shown || !cfg) return;
    shown = true;
    build();
    active = false;
    root.classList.add('off');
    if (cfg.onShow) try { cfg.onShow(); } catch (e) {}
    sync();   // straight away, not a frame later: a heavy game can take a while to give us one
    requestAnimationFrame(frame);
    setInterval(sync, 250);   // and on a timer too, so a menu still hides them if frames stall
  }

  function start(config) {
    cfg = config || {};
    if (cfg.pad) hookGamepads();
    let forced = /[?&]touch\b/.test(location.search);
    try { forced = forced || (window.parent !== window && /[?&]touch\b/.test(window.parent.location.search)); } catch (e) {}
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const go = () => (document.body ? show() : addEventListener('DOMContentLoaded', show));
    if (forced || coarse) go();
    else addEventListener('touchstart', go, { once: true, passive: true });
    addEventListener('blur', () => active && letGoAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden && active) letGoAll(); });
    return TouchKeys;
  }

  return {
    start,
    /* True while the controls are on screen and in use: games that only take
     * mouse-look from a captured pointer check this to take it from a finger. */
    get active() { return active; },
  };
})();
window.TouchKeys = TouchKeys;
