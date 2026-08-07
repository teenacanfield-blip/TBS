/* Cover art for the arcade.
 *
 * Every picture on this site is drawn here, in code — there are no image files
 * to lose, resize or wait for. Each function returns SVG markup that gets
 * dropped straight into the page, so CSS can animate it (the fire flickers, the
 * saucer bobs, the stars twinkle).
 *
 * The art is deliberately blocky: `shape-rendering="crispEdges"` on the root
 * <svg> keeps every edge hard, which matches the pixel art inside both games.
 */

const Art = (() => {

  /* ---- tiny helpers ------------------------------------------------ */

  const R = (x, y, w, h, fill, attr = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${attr}/>`;

  // Several covers share one page, and a gradient is looked up by id across the
  // whole document — so every drawing gets its own namespace for its <defs>.
  let seq = 0;
  const namespace = () => `a${++seq}`;

  // A repeatable random number generator. Same seed always draws the same
  // scene, so the art never shuffles around between page loads.
  const rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // A triangle built out of stacked bars, widest at the bottom.
  const triUp = (cx, baseY, rows, u, fill) => {
    let s = '';
    for (let i = 0; i < rows; i++) {
      const w = (rows - i) * 2 * u;
      s += R(cx - w / 2, baseY - (i + 1) * u, w, u, fill);
    }
    return s;
  };

  // The same triangle upside down, for stalactites.
  const triDown = (cx, topY, rows, u, fill) => {
    let s = '';
    for (let i = 0; i < rows; i++) {
      const w = (rows - i) * 2 * u;
      s += R(cx - w / 2, topY + i * u, w, u, fill);
    }
    return s;
  };

  // A pine: trunk plus two overlapping canopies.
  const pine = (cx, baseY, u, leaf, trunk) =>
    R(cx - u, baseY - u * 3, u * 2, u * 3, trunk) +
    triUp(cx, baseY - u * 2, 4, u, leaf) +
    triUp(cx, baseY - u * 5, 3, u, leaf);

  // A little person: head, torso, two legs. Reads as a character at any size.
  const person = (x, y, u, skin, shirt, legs) =>
    R(x + u, y, u * 3, u * 3, skin) +          // head
    R(x, y + u * 3, u * 5, u * 4, shirt) +     // body + arms
    R(x + u, y + u * 7, u, u * 3, legs) +      // left leg
    R(x + u * 3, y + u * 7, u, u * 3, legs);   // right leg

  /* ---- a 5x7 bitmap font ------------------------------------------- */
  /* Same trick the games use for their own text: each letter is a little grid,
     and every lit cell becomes one square. Drawn as SVG so it scales to any
     size and still lands on hard pixel edges. */

  const GLYPHS = {
    A: '01110 10001 10001 11111 10001 10001 10001',
    B: '11110 10001 10001 11110 10001 10001 11110',
    C: '01110 10001 10000 10000 10000 10001 01110',
    D: '11100 10010 10001 10001 10001 10010 11100',
    E: '11111 10000 10000 11110 10000 10000 11111',
    F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111',
    H: '10001 10001 10001 11111 10001 10001 10001',
    I: '11111 00100 00100 00100 00100 00100 11111',
    J: '00111 00010 00010 00010 00010 10010 01100',
    K: '10001 10010 10100 11000 10100 10010 10001',
    L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001',
    N: '10001 11001 10101 10011 10001 10001 10001',
    O: '01110 10001 10001 10001 10001 10001 01110',
    P: '11110 10001 10001 11110 10000 10000 10000',
    Q: '01110 10001 10001 10001 10101 10010 01101',
    R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110',
    T: '11111 00100 00100 00100 00100 00100 00100',
    U: '10001 10001 10001 10001 10001 10001 01110',
    V: '10001 10001 10001 10001 10001 01010 00100',
    W: '10001 10001 10001 10101 10101 11011 10001',
    X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 01010 00100 00100 00100 00100',
    Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10001 10011 10101 11001 10001 01110',
    1: '00100 01100 00100 00100 00100 00100 01110',
    2: '01110 10001 00001 00010 00100 01000 11111',
    3: '11111 00010 00100 00010 00001 10001 01110',
    4: '00010 00110 01010 10010 11111 00010 00010',
    5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110',
    7: '11111 00001 00010 00100 01000 01000 01000',
    8: '01110 10001 10001 01110 10001 10001 01110',
    9: '01110 10001 10001 01111 00001 00010 01100',
    '&': '01100 10010 10100 01000 10101 10010 01101',
    '.': '00000 00000 00000 00000 00000 01100 01100',
    ',': '00000 00000 00000 00000 01100 01100 01000',
    '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100',
    "'": '00100 00100 01000 00000 00000 00000 00000',
    '’': '00100 00100 01000 00000 00000 00000 00000',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    ':': '00000 01100 01100 00000 01100 01100 00000',
    '/': '00001 00010 00010 00100 01000 01000 10000',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000',
  };

  const GLYPH_W = 5, GLYPH_H = 7, TRACK = 1, LEAD = 2;

  // Break a string into lines of at most `max` characters, on spaces.
  const wrapText = (str, max) => {
    if (!max) return [str];
    const out = [];
    let line = '';
    for (const word of str.split(' ')) {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= max) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out;
  };

  /* Renders `str` as pixel letters. `u` is the size of one pixel, `wrap` the
     longest line allowed. Colour comes from CSS (`currentColor`), so a heading
     tints itself the same way ordinary text would. */
  const text = (str, { u = 4, wrap = 0, fill = 'currentColor', cls = '' } = {}) => {
    const lines = wrapText(String(str).toUpperCase().trim(), wrap);
    const cols = Math.max(...lines.map((l) => l.length));
    const w = cols * (GLYPH_W + TRACK) - TRACK;
    const h = lines.length * (GLYPH_H + LEAD) - LEAD;

    let body = '';
    lines.forEach((line, li) => {
      const oy = li * (GLYPH_H + LEAD);
      [...line].forEach((ch, ci) => {
        const rows = GLYPHS[ch];
        if (!rows) return;                       // spaces and anything unknown
        const ox = ci * (GLYPH_W + TRACK);
        rows.split(' ').forEach((row, y) => {
          for (let x = 0; x < GLYPH_W; x++) {
            if (row[x] === '1') body += R(ox + x, oy + y, 1, 1, fill);
          }
        });
      });
    });

    return `<svg class="pixtext ${cls}" viewBox="0 0 ${w} ${h}" width="${w * u}" height="${h * u}"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"
      role="img" aria-label="${String(str).replace(/[&<>"]/g, '')}">${body}</svg>`;
  };

  /* ---- scene 1: The 13 Dynasties ----------------------------------- */
  /* Dusk on the surface — treeline, campfire, the cave mouth that leads
     down into the Undergrove. */

  /* `focal` is where the subject of the scene sits across the frame, as a
     fraction of the width. Wide banners put it right of centre so the title
     text on the left never lands on top of it; tall capsules centre it. */
  const dynastiesScene = (w, h, focal, ns) => {
    const rand = rng(1313);
    const horizon = h * 0.63;
    let s = '';

    s += R(0, 0, w, horizon, `url(#${ns}-dyn-sky)`);

    // Stars, thinning out as they approach the warm part of the sky.
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * horizon * 0.72);
      const size = rand() > 0.85 ? 3 : 2;
      const delay = (rand() * 4).toFixed(2);
      s += R(x, y, size, size, '#dfe8ff',
        ` opacity="${(0.25 + rand() * 0.6).toFixed(2)}" class="tw" style="animation-delay:${delay}s"`);
    }

    // Moon.
    const mx = w * 0.81, my = horizon * 0.26;
    s += `<circle cx="${mx}" cy="${my}" r="${h * 0.19}" fill="url(#${ns}-dyn-moonglow)"/>`;
    s += `<circle cx="${mx}" cy="${my}" r="${h * 0.062}" fill="#f4efdc"/>`;
    s += `<circle cx="${mx + h * 0.022}" cy="${my - h * 0.014}" r="${h * 0.014}" fill="#e2dcc4" opacity="0.7"/>`;
    s += `<circle cx="${mx - h * 0.021}" cy="${my + h * 0.02}" r="${h * 0.01}" fill="#e2dcc4" opacity="0.55"/>`;

    // Two ridgelines of hills, the far one paler.
    const ridge = (baseY, amp, fill, step) => {
      let d = `M0 ${h} L0 ${baseY}`;
      for (let x = 0; x <= w; x += step) {
        const y = baseY - Math.sin(x / (w / 5.5)) * amp - Math.sin(x / (w / 17)) * (amp * 0.4);
        d += ` L${x} ${Math.round(y)}`;
      }
      return `<path d="${d} L${w} ${h} Z" fill="${fill}"/>`;
    };
    s += ridge(horizon - h * 0.05, h * 0.055, '#1b2947', Math.max(6, w / 90));
    s += ridge(horizon - h * 0.01, h * 0.03, '#14243c', Math.max(5, w / 120));

    // Distant treeline sitting on the horizon.
    for (let x = -10; x < w + 20; x += Math.max(9, w / 70)) {
      const u = 2 + Math.floor(rand() * 2);
      s += pine(x + rand() * 6, horizon + 3, u, '#132a1a', '#0f2015');
    }

    // Ground.
    s += R(0, horizon, w, h - horizon, `url(#${ns}-dyn-ground)`);
    for (let i = 0; i < 220; i++) {
      const y = horizon + rand() * (h - horizon);
      const depth = (y - horizon) / (h - horizon);
      s += R(Math.floor(rand() * w), Math.floor(y), 2 + Math.floor(depth * 3), 2,
        rand() > 0.5 ? '#3a6b35' : '#274d26', ` opacity="${(0.35 + depth * 0.4).toFixed(2)}"`);
    }

    // Cave mouth: the way down to the Undergrove.
    const cx = w * Math.min(0.93, focal + 0.29), cy = horizon + (h - horizon) * 0.18;
    s += `<path d="M${cx - w * 0.11} ${cy + h * 0.16} Q${cx} ${cy - h * 0.13} ${cx + w * 0.13} ${cy + h * 0.16} Z" fill="#2b2b33"/>`;
    s += `<path d="M${cx - w * 0.068} ${cy + h * 0.16} Q${cx + w * 0.004} ${cy - h * 0.05} ${cx + w * 0.078} ${cy + h * 0.16} Z" fill="#07080c"/>`;
    s += `<path d="M${cx - w * 0.03} ${cy + h * 0.16} Q${cx + w * 0.004} ${cy + h * 0.03} ${cx + w * 0.038} ${cy + h * 0.16} Z" fill="#2a1440" opacity="0.85" class="pulse-slow"/>`;

    // Campfire and the pool of light around it.
    const fx = w * focal, fy = horizon + (h - horizon) * 0.62;
    s += `<ellipse cx="${fx}" cy="${fy}" rx="${w * 0.2}" ry="${h * 0.17}" fill="url(#${ns}-dyn-fireglow)" class="flick"/>`;
    for (let i = -3; i <= 3; i++) {
      s += R(fx + i * 9 - 4, fy + 4, 9, 6, i % 2 ? '#6c6a63' : '#585650');
    }
    s += R(fx - 22, fy - 2, 44, 6, '#4a3527');
    s += R(fx - 16, fy - 7, 32, 6, '#5c412e');
    s += `<g class="flick">`;
    s += triUp(fx, fy - 6, 5, 4, '#e8641f');
    s += triUp(fx, fy - 8, 4, 3.5, '#ffa32e');
    s += triUp(fx, fy - 9, 3, 3, '#ffe066');
    s += `</g>`;

    // The two of you, sat either side of it.
    s += person(fx - w * 0.075, fy - h * 0.115, Math.max(3, h * 0.011), '#e0a978', '#4b7f43', '#2f4a6b');
    s += person(fx + w * 0.045, fy - h * 0.105, Math.max(3, h * 0.0102), '#c98d63', '#8a4b3a', '#3b3b52');

    // Big pines in the near ground, framing the shot.
    s += pine(w * 0.1, h * 1.0, Math.max(6, h * 0.026), '#12331a', '#241a12');
    s += pine(w * 0.21, h * 0.97, Math.max(5, h * 0.019), '#173d1f', '#241a12');
    s += pine(w * Math.max(0.33, focal - 0.27), h * 1.02, Math.max(5, h * 0.021), '#12331a', '#241a12');

    return s;
  };

  /* ---- scene 2: Ugg & the Undersaucer ------------------------------ */
  /* Inside the cave that lies to you — floating bricks, crystals, and one
     caveman with a flying saucer bolted to his underside. */

  const uggScene = (w, h, focal, ns) => {
    const rand = rng(5050);
    const beam = Math.min(0.92, focal + 0.24);   // the mothership sits above and behind him
    let s = '';

    s += R(0, 0, w, h, `url(#${ns}-ugg-cave)`);

    // Rock strata across the back wall.
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * h + rand() * 14;
      s += `<path d="M0 ${y} Q${w * 0.3} ${y - 18} ${w * 0.6} ${y + 10} T${w} ${y - 6} L${w} ${y + 9} Q${w * 0.6} ${y + 25} ${w * 0.3} ${y + 3} T0 ${y + 15} Z"
        fill="#1d0f33" opacity="${(0.2 + rand() * 0.3).toFixed(2)}"/>`;
    }

    // Light from the mothership, far above.
    s += `<path d="M${w * (beam - 0.09)} 0 L${w * (beam + 0.09)} 0 L${w * (beam + 0.21)} ${h} L${w * (beam - 0.29)} ${h} Z" fill="url(#${ns}-ugg-beam)" opacity="0.5"/>`;
    s += `<ellipse cx="${w * beam}" cy="${h * 0.055}" rx="${w * 0.075}" ry="${h * 0.022}" fill="#3b2a63"/>`;
    s += `<ellipse cx="${w * beam}" cy="${h * 0.045}" rx="${w * 0.04}" ry="${h * 0.026}" fill="#4b3780"/>`;
    for (let i = -2; i <= 2; i++) {
      s += R(w * beam + i * (w * 0.026) - 3, h * 0.062, 6, 5, '#8de8ff',
        ` class="pulse" style="animation-delay:${(i * 0.3).toFixed(1)}s"`);
    }

    // Stalactites down from the ceiling, stalagmites up from the floor.
    for (let i = 0; i < 16; i++) {
      const x = rand() * w;
      const rows = 3 + Math.floor(rand() * 6);
      const u = 4 + rand() * 4;
      s += triDown(x, -2, rows, u, rand() > 0.5 ? '#241338' : '#190c2a');
    }
    for (let i = 0; i < 12; i++) {
      const x = rand() * w;
      const rows = 2 + Math.floor(rand() * 5);
      const u = 4 + rand() * 4;
      s += triUp(x, h + 2, rows, u, '#1c0e2e');
    }

    // Floating brick platforms — the ones you land on, and the ones that lie.
    const platform = (px, py, cols, top, body) => {
      let g = '';
      for (let c = 0; c < cols; c++) {
        g += R(px + c * 22, py, 21, 9, top);
        g += R(px + c * 22, py + 9, 21, 15, body);
        g += R(px + c * 22, py + 9, 21, 2, '#00000033');
      }
      return g;
    };
    s += platform(w * Math.max(0.04, focal - 0.36), h * 0.66, 5, '#a06fd4', '#4c2f78');
    s += platform(w * (focal + 0.22), h * 0.76, 6, '#a06fd4', '#4c2f78');
    s += platform(w * Math.max(0.06, focal - 0.06), h * 0.86, 7, '#8f5fc4', '#412869');
    // A phantom platform: the cave's favourite trick.
    s += `<g opacity="0.42" class="pulse-slow">${platform(w * (focal + 0.04), h * 0.5, 3, '#7ce6ff', '#2c5f7a')}</g>`;

    // Crystals.
    const crystal = (x, y, size, col, delay) =>
      `<g class="pulse" style="animation-delay:${delay}s">` +
      `<circle cx="${x}" cy="${y}" r="${size * 2.6}" fill="${col}" opacity="0.16"/>` +
      `<path d="M${x} ${y - size * 1.7} L${x + size} ${y} L${x} ${y + size * 1.7} L${x - size} ${y} Z" fill="${col}"/>` +
      `<path d="M${x} ${y - size * 1.7} L${x + size} ${y} L${x} ${y} Z" fill="#ffffff" opacity="0.35"/></g>`;
    s += crystal(w * Math.max(0.08, focal - 0.28), h * 0.62, h * 0.03, '#6ff0ff', 0);
    s += crystal(w * Math.max(0.15, focal - 0.22), h * 0.63, h * 0.019, '#6ff0ff', 0.8);
    s += crystal(w * (focal + 0.3), h * 0.72, h * 0.026, '#ff77d4', 1.4);
    s += crystal(w * Math.min(0.94, focal + 0.48), h * 0.44, h * 0.022, '#6ff0ff', 2.1);

    // Ugg himself, hovering on the saucer.
    const ux = w * focal, uy = h * 0.42, u = Math.max(4, h * 0.017);
    s += `<g class="bob">`;
    s += `<ellipse cx="${ux}" cy="${uy + u * 9}" rx="${u * 9}" ry="${u * 5}" fill="#7ce6ff" opacity="0.14"/>`;
    // thrust
    s += `<g class="flick">` +
      triUp(ux, uy + u * 13, 4, u * 0.9, '#7ce6ff') +
      triUp(ux, uy + u * 11.5, 3, u * 0.8, '#ffffff') +
      `</g>`;
    // saucer
    s += `<ellipse cx="${ux}" cy="${uy + u * 6}" rx="${u * 7.5}" ry="${u * 2.1}" fill="#b9c4d6"/>`;
    s += `<ellipse cx="${ux}" cy="${uy + u * 5.2}" rx="${u * 7.5}" ry="${u * 1.8}" fill="#e6edf7"/>`;
    for (let i = -2; i <= 2; i++) {
      s += R(ux + i * u * 2.6 - u * 0.5, uy + u * 5.6, u, u, '#ff9d3d');
    }
    // caveman: hair, face, club, fur
    s += R(ux - u * 2.5, uy - u * 2, u * 5, u * 2, '#3a2a1c');            // hair
    s += R(ux - u * 2, uy, u * 4, u * 3, '#d79a6a');                       // face
    s += R(ux - u * 1.2, uy + u, u * 0.8, u * 0.8, '#241608');             // eyes
    s += R(ux + u * 0.4, uy + u, u * 0.8, u * 0.8, '#241608');
    s += R(ux - u * 2.6, uy + u * 3, u * 5.2, u * 2.4, '#8d6b3f');         // fur
    s += R(ux + u * 2.6, uy + u * 2.6, u * 1.1, u * 3, '#6b4a2a');         // club
    s += R(ux + u * 2.2, uy + u * 1.4, u * 2, u * 1.6, '#7d5730');
    s += `</g>`;

    // Dust in the beam.
    for (let i = 0; i < 40; i++) {
      s += R(Math.floor(rand() * w), Math.floor(rand() * h), 2, 2, '#c9a6ff',
        ` opacity="${(0.1 + rand() * 0.4).toFixed(2)}" class="tw" style="animation-delay:${(rand() * 5).toFixed(2)}s"`);
    }

    return s;
  };

  /* ---- shared defs ------------------------------------------------- */

  const defs = (id, ns) => id === 'the-13-dynasties' ? `
    <defs>
      <linearGradient id="${ns}-dyn-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#08101f"/>
        <stop offset="42%" stop-color="#16294c"/>
        <stop offset="72%" stop-color="#42375f"/>
        <stop offset="90%" stop-color="#a85f38"/>
        <stop offset="100%" stop-color="#d98c42"/>
      </linearGradient>
      <radialGradient id="${ns}-dyn-moonglow">
        <stop offset="0%" stop-color="#fff6d8" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#fff6d8" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${ns}-dyn-fireglow">
        <stop offset="0%" stop-color="#ffb347" stop-opacity="0.6"/>
        <stop offset="55%" stop-color="#ff8a2b" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#ff8a2b" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${ns}-dyn-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2c5a2b"/>
        <stop offset="100%" stop-color="#15301a"/>
      </linearGradient>
    </defs>` : `
    <defs>
      <radialGradient id="${ns}-ugg-cave" cx="42%" cy="42%" r="78%">
        <stop offset="0%" stop-color="#3a1c6b"/>
        <stop offset="55%" stop-color="#1a0d33"/>
        <stop offset="100%" stop-color="#07050e"/>
      </radialGradient>
      <linearGradient id="${ns}-ugg-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#9be8ff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#9be8ff" stop-opacity="0"/>
      </linearGradient>
    </defs>`;

  const vignette = (ns, w, h, strength = 0.72) => `
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${ns}-vig)"/>
    <defs>
      <radialGradient id="${ns}-vig" cx="50%" cy="46%" r="72%">
        <stop offset="55%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="${strength}"/>
      </radialGradient>
    </defs>`;

  const scene = (id, w, h, focal, ns) =>
    id === 'the-13-dynasties' ? dynastiesScene(w, h, focal, ns) : uggScene(w, h, focal, ns);

  /* ---- demo covers -------------------------------------------------- */
  /* Demos do not get a hand-painted scene. They get a lit stage — accent
     glow, a grid floor, a starfield — with one big pixel motif standing on
     it. Swap the `motif` name in games.js to change the shape. */

  const motifs = {
    // RC Craze: a radio-controlled car, antenna and all.
    car: (cx, cy, u, c) =>
      R(cx - u * 5, cy - u * 2, u * 10, u * 3, c) +
      R(cx - u * 3, cy - u * 4, u * 6, u * 2, c) +
      R(cx - u * 2, cy - u * 3.6, u * 4, u * 1.4, '#0b0e14') +
      R(cx - u * 4.4, cy + u, u * 2.6, u * 2.6, '#e8edf6') +
      R(cx + u * 1.8, cy + u, u * 2.6, u * 2.6, '#e8edf6') +
      R(cx - u * 3.9, cy + u * 1.5, u * 1.6, u * 1.6, '#0b0e14') +
      R(cx + u * 2.3, cy + u * 1.5, u * 1.6, u * 1.6, '#0b0e14') +
      R(cx + u * 4.6, cy - u * 8, u * 0.7, u * 6, '#e8edf6') +
      R(cx + u * 4.1, cy - u * 9, u * 1.7, u * 1.4, c),

    // Liz: something small, green and quick.
    lizard: (cx, cy, u, c) =>
      R(cx - u * 3, cy - u * 1.5, u * 6, u * 3, c) +
      R(cx + u * 3, cy - u * 1, u * 2.5, u * 2, c) +
      R(cx + u * 5, cy - u * 2.5, u * 2, u * 2, c) +
      R(cx + u * 6.2, cy - u * 2, u * 1, u * 1, '#0b0e14') +
      R(cx - u * 5.5, cy - u * 0.5, u * 2.5, u * 1.4, c) +
      R(cx - u * 7.5, cy - u * 2, u * 2, u * 1.4, c) +
      R(cx - u * 3, cy + u * 1.5, u * 1.4, u * 2.4, c) +
      R(cx + u * 1.6, cy + u * 1.5, u * 1.4, u * 2.4, c) +
      R(cx - u * 2, cy - u * 2.4, u * 1.2, u * 1, '#ffffff') +
      R(cx + u * 0.6, cy - u * 2.4, u * 1.2, u * 1, '#ffffff'),

    // Ninja Wing Wing: a shuriken mid-spin.
    star: (cx, cy, u, c) =>
      `<g class="spin" style="transform-origin:${cx}px ${cy}px">` +
      triUp(cx, cy - u * 1.4, 4, u, c) +
      triDown(cx, cy + u * 1.4, 4, u, c) +
      R(cx - u * 8, cy - u, u * 4, u * 2, c) +
      R(cx + u * 4, cy - u, u * 4, u * 2, c) +
      R(cx - u * 2, cy - u * 2, u * 4, u * 4, c) +
      R(cx - u, cy - u, u * 2, u * 2, '#0b0e14') +
      `</g>`,

    // Legend Cart: sword and shield.
    sword: (cx, cy, u, c) =>
      R(cx + u, cy - u * 8, u * 2, u * 9, '#dfe7f5') +
      R(cx + u * 1.6, cy - u * 8, u * 0.8, u * 9, '#ffffff') +
      R(cx, cy - u * 9.6, u * 4, u * 1.6, '#dfe7f5') +
      R(cx - u, cy + u, u * 6, u * 1.4, c) +
      R(cx + u * 1.2, cy + u * 2.4, u * 1.6, u * 3, '#7d5730') +
      R(cx + u * 0.8, cy + u * 5.4, u * 2.4, u * 1.2, c) +
      R(cx - u * 8, cy - u * 5, u * 6, u * 8, c) +
      R(cx - u * 7, cy - u * 4, u * 4, u * 6, '#0b0e14') +
      R(cx - u * 6, cy - u * 3, u * 2, u * 4, c),

    // Animabal1: the baseball one.
    ball: (cx, cy, u, c) =>
      `<circle cx="${cx - u * 2}" cy="${cy}" r="${u * 4.2}" fill="#f2f4f8"/>` +
      R(cx - u * 4.6, cy - u * 2, u * 0.9, u * 0.9, c) +
      R(cx - u * 4, cy - u * 0.5, u * 0.9, u * 0.9, c) +
      R(cx - u * 4.6, cy + u, u * 0.9, u * 0.9, c) +
      R(cx + u * 0.2, cy - u * 2, u * 0.9, u * 0.9, c) +
      R(cx - u * 0.4, cy - u * 0.5, u * 0.9, u * 0.9, c) +
      R(cx + u * 0.2, cy + u, u * 0.9, u * 0.9, c) +
      `<g transform="rotate(-32 ${cx + u * 5} ${cy})">` +
      R(cx + u * 4, cy - u * 7, u * 2.2, u * 9, '#a8703f') +
      R(cx + u * 4.3, cy + u * 2, u * 1.6, u * 3.4, '#7d5730') +
      `</g>`,

    // The Dragon's Last Breath: head, horn, and the breath itself.
    dragon: (cx, cy, u, c) =>
      R(cx - u * 5, cy - u * 3, u * 7, u * 5, c) +
      R(cx + u * 2, cy - u * 1.5, u * 4, u * 3, c) +
      R(cx + u * 5, cy - u * 0.5, u * 2, u * 1.6, c) +
      R(cx - u * 3, cy - u * 5.5, u * 1.4, u * 2.6, c) +
      R(cx - u * 4.6, cy - u * 7, u * 1.4, u * 3, c) +
      R(cx + u * 0.4, cy - u * 2, u * 1.6, u * 1.6, '#ffdd55') +
      R(cx + u * 0.9, cy - u * 1.5, u * 0.7, u * 0.9, '#0b0e14') +
      R(cx - u * 7.5, cy + u * 2, u * 5, u * 2, c) +
      `<g class="flick">` +
      R(cx + u * 6.6, cy - u * 0.6, u * 3, u * 2, '#ff9d3d') +
      R(cx + u * 9, cy - u * 1.6, u * 3.4, u * 4, '#ffb84d') +
      R(cx + u * 11.6, cy - u * 3, u * 3.6, u * 6.4, '#ffd166') +
      R(cx + u * 14.6, cy - u * 4.4, u * 3, u * 9, '#ffe9a8') +
      `</g>`,
  };

  const demoScene = (d, w, h, focal, ns) => {
    const rand = rng(d.id.length * 977 + d.title.charCodeAt(0) * 13);
    let s = `<defs>
      <radialGradient id="${ns}-bg" cx="${focal * 100}%" cy="46%" r="82%">
        <stop offset="0%" stop-color="${d.accent}" stop-opacity="0.4"/>
        <stop offset="46%" stop-color="#141a25" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#07090e"/>
      </radialGradient>
    </defs>`;

    s += R(0, 0, w, h, '#07090e') + R(0, 0, w, h, `url(#${ns}-bg)`);

    for (let i = 0; i < 55; i++) {
      s += R(Math.floor(rand() * w), Math.floor(rand() * h * 0.8), 2, 2, '#dfe8ff',
        ` opacity="${(0.15 + rand() * 0.5).toFixed(2)}" class="tw" style="animation-delay:${(rand() * 4).toFixed(2)}s"`);
    }

    // A grid floor, receding — the "this is a prototype" look, on purpose.
    const fy = h * 0.74;
    s += R(0, fy, w, h - fy, '#0a0d14');
    for (let i = 0; i <= 14; i++) {
      const y = fy + Math.pow(i / 14, 1.9) * (h - fy);
      s += R(0, y, w, 1, d.accent, ' opacity="0.22"');
    }
    for (let i = -8; i <= 8; i++) {
      s += `<path d="M${w * focal + i * (w * 0.03)} ${fy} L${w * focal + i * (w * 0.16)} ${h}" stroke="${d.accent}" stroke-width="1" opacity="0.16" fill="none"/>`;
    }

    // Motif, standing on the floor with a glow behind it.
    const u = Math.max(4, h * 0.026);
    const cx = w * focal, cy = fy - h * 0.1;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${u * 16}" ry="${u * 12}" fill="${d.accent}" opacity="0.14"/>`;
    s += `<ellipse cx="${cx}" cy="${fy + h * 0.02}" rx="${u * 9}" ry="${u * 1.6}" fill="#000" opacity="0.5"/>`;
    s += (motifs[d.motif] || motifs.star)(cx, cy, u, d.accent);

    return s;
  };

  const demoHero = (d) => {
    const w = 1200, h = 520, ns = namespace();
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      ${demoScene(d, w, h, 0.68, ns)}${vignette(ns, w, h, 0.55)}</svg>`;
  };

  const demoCapsule = (d) => {
    const w = 600, h = 800, ns = namespace();
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      ${demoScene(d, w, h, 0.5, ns)}
      <rect x="0" y="${h * 0.44}" width="${w}" height="${h * 0.56}" fill="url(#${ns}-cap)"/>
      <defs><linearGradient id="${ns}-cap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#07090e" stop-opacity="0"/>
        <stop offset="55%" stop-color="#07090e" stop-opacity="0.74"/>
        <stop offset="100%" stop-color="#07090e" stop-opacity="0.99"/>
      </linearGradient></defs></svg>`;
  };

  const demoIcon = (d) => `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="64" height="64" rx="10" fill="#12161f"/>
      <rect width="64" height="64" rx="10" fill="${d.accent}" opacity="0.16"/>
      ${(motifs[d.motif] || motifs.star)(30, 34, 2.6, d.accent)}
    </svg>`;

  /* ---- public: the three sizes the site uses ----------------------- */

  // Wide banner, for the hero on the home page and the top of a game page.
  const hero = (id) => {
    const w = 1200, h = 520, ns = namespace();
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      ${defs(id, ns)}${scene(id, w, h, 0.66, ns)}${vignette(ns, w, h, 0.6)}</svg>`;
  };

  // Tall capsule, for the cards in the library grid.
  const capsule = (id) => {
    const w = 600, h = 800, ns = namespace();
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      ${defs(id, ns)}${scene(id, w, h, 0.5, ns)}
      <rect x="0" y="${h * 0.44}" width="${w}" height="${h * 0.56}" fill="url(#${ns}-cap)"/>
      <defs><linearGradient id="${ns}-cap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0b0e14" stop-opacity="0"/>
        <stop offset="55%" stop-color="#0b0e14" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#0b0e14" stop-opacity="0.99"/>
      </linearGradient></defs></svg>`;
  };

  // Square emblem, for the sidebar list and the play overlay.
  const icon = (id) => {
    const s = 64;
    if (id === 'the-13-dynasties') {
      return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
        <rect width="${s}" height="${s}" rx="10" fill="#16321f"/>
        <rect y="42" width="${s}" height="22" fill="#2c5a2b"/>
        ${pine(20, 46, 4, '#4f9a4a', '#3b2a1f')}
        ${pine(43, 50, 5, '#3f7d3d', '#3b2a1f')}
        <circle cx="49" cy="15" r="6" fill="#f4efdc"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="${s}" height="${s}" rx="10" fill="#1e1038"/>
      <circle cx="32" cy="26" r="16" fill="#6ff0ff" opacity="0.16"/>
      <rect x="24" y="14" width="16" height="6" fill="#3a2a1c"/>
      <rect x="26" y="20" width="12" height="9" fill="#d79a6a"/>
      <ellipse cx="32" cy="36" rx="20" ry="5" fill="#e6edf7"/>
      <ellipse cx="32" cy="39" rx="20" ry="4" fill="#b9c4d6"/>
      <rect x="20" y="35" width="4" height="4" fill="#ff9d3d"/>
      <rect x="30" y="35" width="4" height="4" fill="#ff9d3d"/>
      <rect x="40" y="35" width="4" height="4" fill="#ff9d3d"/>
      <rect x="28" y="46" width="8" height="6" fill="#7ce6ff"/>
      <rect x="30" y="52" width="4" height="6" fill="#ffffff"/>
    </svg>`;
  };

  return { hero, capsule, icon, demoHero, demoCapsule, demoIcon, text };
})();
