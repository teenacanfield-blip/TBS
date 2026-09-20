/* Pokémon Rip and Go — your sprite sheets.
 *
 * The game ships with its own art, typed out in dex.js, and none of it is
 * precious. This file is the other half of the deal: drop a PNG sheet in the
 * Sprite Lab, cut it into frames, and point a frame at a species — from then
 * on that creature is yours, everywhere it appears. Cards, the box, the team
 * list, the battle. There is no second set of art to keep in sync, because
 * everything that draws a creature asks this file first.
 *
 * ------------------------------------------------------------------ how it
 *
 * A sheet is kept as a data URL, which means the browser's own storage rather
 * than a server, which means this works from a file:// address and survives a
 * reload with nothing running behind it. It also means a 4MB sheet will not
 * fit: localStorage gives you a few megabytes for the whole origin. Loading a
 * sheet that does not fit fails loudly — see lastError — instead of quietly
 * dropping it and confusing you later.
 *
 * ---------------------------------------------------------------- targets
 *
 * A target is a string. Species targets are the species id from dex.js
 * ('oozlet', 'suntitan'). The trainer has four of its own:
 *
 *     trainer.down   trainer.up   trainer.side   trainer.sideb
 *
 * 'side' is drawn facing RIGHT and mirrored for walking left, the same rule
 * the typed art follows. 'sideb' is the second frame of the walk; leave it
 * unset and the walk just uses the first.
 */
const Sprites = (() => {
  'use strict';

  const STORE = 'ripgo.sheets.v1';
  const LIMIT = 3.2 * 1024 * 1024;   // a sheet bigger than this will not store

  /* sheets: id -> { id, name, url, w, h, fw, fh, ox, oy, gap }
   * map:    target -> { sheet, col, row } */
  let state = { sheets: {}, map: {} };
  const images = {};                 // id -> HTMLImageElement, once decoded
  let lastError = '';
  const waiting = [];

  /* ------------------------------------------------------------- storage */

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sheets && parsed.map) state = parsed;
      }
    } catch (e) {
      lastError = 'Could not read saved sheets.';
    }
    Object.keys(state.sheets).forEach(decode);
    return state;
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      return true;
    } catch (e) {
      lastError = 'Out of browser storage. Remove a sheet, or use a smaller PNG.';
      return false;
    }
  }

  /* An <img> per sheet, decoded once. Everything that draws waits on these,
   * so a sheet that is still decoding falls back to the typed art for a frame
   * or two rather than drawing nothing. */
  function decode(id) {
    const sh = state.sheets[id];
    if (!sh || images[id]) return;
    const img = new Image();
    img.onload = () => {
      sh.w = img.naturalWidth;
      sh.h = img.naturalHeight;
      waiting.forEach((fn) => fn());
    };
    img.onerror = () => { lastError = 'That file did not decode as an image.'; };
    img.src = sh.url;
    images[id] = img;
  }

  /* --------------------------------------------------------------- sheets */

  function addSheet(name, dataUrl, fw, fh) {
    if (dataUrl.length > LIMIT) {
      lastError = 'That PNG is too big to keep in browser storage (over ' +
        Math.round(LIMIT / 1024 / 1024 * 10) / 10 + 'MB as text). Try a smaller one.';
      return null;
    }
    const id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
    state.sheets[id] = {
      id, name: name || 'sheet', url: dataUrl, w: 0, h: 0,
      fw: fw || 16, fh: fh || 16, ox: 0, oy: 0, gap: 0,
    };
    decode(id);
    if (!save()) { delete state.sheets[id]; delete images[id]; return null; }
    return id;
  }

  function removeSheet(id) {
    delete state.sheets[id];
    delete images[id];
    Object.keys(state.map).forEach((k) => {
      if (state.map[k].sheet === id) delete state.map[k];
    });
    save();
  }

  function sheetList() {
    return Object.keys(state.sheets).map((k) => state.sheets[k]);
  }

  function sheet(id) { return state.sheets[id] || null; }
  function image(id) { return images[id] || null; }

  function setGrid(id, fw, fh, ox, oy, gap) {
    const sh = state.sheets[id];
    if (!sh) return;
    sh.fw = Math.max(1, fw | 0);
    sh.fh = Math.max(1, fh | 0);
    sh.ox = Math.max(0, ox | 0);
    sh.oy = Math.max(0, oy | 0);
    sh.gap = Math.max(0, gap | 0);
    save();
  }

  function cols(id) {
    const sh = state.sheets[id], img = images[id];
    if (!sh || !img || !img.naturalWidth) return 0;
    return Math.max(1, Math.floor((img.naturalWidth - sh.ox + sh.gap) / (sh.fw + sh.gap)));
  }
  function rows(id) {
    const sh = state.sheets[id], img = images[id];
    if (!sh || !img || !img.naturalHeight) return 0;
    return Math.max(1, Math.floor((img.naturalHeight - sh.oy + sh.gap) / (sh.fh + sh.gap)));
  }

  /* -------------------------------------------------------------- targets */

  function assign(target, sheetId, col, row) {
    if (!state.sheets[sheetId]) return false;
    state.map[target] = { sheet: sheetId, col: col | 0, row: row | 0 };
    return save();
  }

  function clear(target) {
    delete state.map[target];
    save();
  }

  function assignment(target) { return state.map[target] || null; }

  function count() { return Object.keys(state.map).length; }

  /* The rectangle to lift out of the sheet, or null if this target has no
   * frame, the sheet is gone, or the image has not decoded yet. */
  function frame(target) {
    const a = state.map[target];
    if (!a) return null;
    const sh = state.sheets[a.sheet], img = images[a.sheet];
    if (!sh || !img || !img.naturalWidth) return null;
    return {
      img,
      sx: sh.ox + a.col * (sh.fw + sh.gap),
      sy: sh.oy + a.row * (sh.fh + sh.gap),
      sw: sh.fw,
      sh: sh.fh,
    };
  }

  /* ---------------------------------------------------------------- draw */
  /* Draws the target into the box if there is a frame for it, and returns
   * whether it did. Callers draw their own art when this says no, which is
   * what makes a half-finished sheet perfectly usable — assign the six you
   * care about and leave the rest as they were.
   *
   * The frame keeps its aspect and sits on the bottom of the box, because a
   * creature standing on the floor of a card should not float when its sheet
   * happens to be 32x24. */
  function draw(g, target, x, y, w, h, flip) {
    const f = frame(target);
    if (!f) return false;
    const k = Math.min(w / f.sw, h / f.sh);
    const dw = Math.max(1, Math.round(f.sw * k));
    const dh = Math.max(1, Math.round(f.sh * k));
    const dx = Math.round(x + (w - dw) / 2);
    const dy = Math.round(y + h - dh);
    g.save();
    g.imageSmoothingEnabled = false;
    if (flip) {
      g.translate(dx + dw, dy);
      g.scale(-1, 1);
      g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, dw, dh);
    } else {
      g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, dx, dy, dw, dh);
    }
    g.restore();
    return true;
  }

  /* Reading a dropped file. Kept here so the game and the lab agree about
   * what counts as a sheet. */
  function readFile(file, done) {
    if (!file) { done('No file.'); return; }
    if (!/^image\//.test(file.type)) { done('That is not an image file.'); return; }
    const fr = new FileReader();
    fr.onload = () => done(null, fr.result, file.name.replace(/\.[^.]+$/, ''));
    fr.onerror = () => done('Could not read that file.');
    fr.readAsDataURL(file);
  }

  function onReady(fn) { waiting.push(fn); }
  function wipe() { state = { sheets: {}, map: {} }; Object.keys(images).forEach((k) => delete images[k]); save(); }

  return {
    load, save, addSheet, removeSheet, sheetList, sheet, image, setGrid,
    cols, rows, assign, clear, assignment, count, frame, draw, readFile,
    onReady, wipe,
    error: () => lastError,
    clearError: () => { lastError = ''; },
    TRAINER: ['trainer.down', 'trainer.up', 'trainer.side', 'trainer.sideb'],
  };
})();

Sprites.load();
