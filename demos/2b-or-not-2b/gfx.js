/* The renderer, hand-rolled.
 *
 * Four of the 3D demos on this site fetch three.js from a CDN when they start,
 * and on wifi that blocks CDNs — some school and guest networks do — they open
 * to a blank screen. A game set in a classroom is the last one that should be
 * unplayable at school, so this one carries its own renderer: raw WebGL, one
 * shader, about three hundred lines, nothing to fetch.
 *
 * It only ever has to draw boxes and short extruded polygons, because that is
 * all a classroom made of stationery is. The desk, the chair, the pencil, the
 * crumbs of graphite — all of it is flat-shaded blocks with fog for depth.
 *
 * Two meshes do the work. The world is baked once into a static buffer and
 * drawn in a single call; anything that moves is rebuilt into a scratch buffer
 * every frame, which sounds wasteful and is about a hundred boxes.
 */
const GFX = (() => {
'use strict';

/* ==================================================================== maths */
/* Column-major, the way WebGL wants them. Enough of a matrix library to put a
   camera somewhere and point a pencil in a direction, and no more. */

const m4 = {
  make: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),

  identity(o) {
    o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
    o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o;
  },

  mul(a, b, o) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
      o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return o;
  },

  perspective(fovy, aspect, near, far, o) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0]=f/aspect;o[1]=0;o[2]=0;o[3]=0;
    o[4]=0;o[5]=f;o[6]=0;o[7]=0;
    o[8]=0;o[9]=0;o[10]=(far+near)*nf;o[11]=-1;
    o[12]=0;o[13]=0;o[14]=2*far*near*nf;o[15]=0;
    return o;
  },

  lookAt(ex, ey, ez, cx, cy, cz, o) {
    let zx = ex-cx, zy = ey-cy, zz = ez-cz;
    let l = Math.hypot(zx, zy, zz) || 1; zx/=l; zy/=l; zz/=l;
    /* Up is straight up, unless we are looking along it — the camera clamp
       upstream is meant to stop that, but a fallback costs two lines. */
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(zy) > 0.9999) { uy = 0; uz = zy > 0 ? -1 : 1; }
    let xx = uy*zz - uz*zy, xy = uz*zx - ux*zz, xz = ux*zy - uy*zx;
    l = Math.hypot(xx, xy, xz) || 1; xx/=l; xy/=l; xz/=l;
    const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;
    o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;
    o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*ex+xy*ey+xz*ez);
    o[13]=-(yx*ex+yy*ey+yz*ez);
    o[14]=-(zx*ex+zy*ey+zz*ez);
    o[15]=1;
    return o;
  },

  /* Position, then yaw, then pitch, then roll, then a uniform scale. That is
     the order a character wants: turn to face, then lean. */
  compose(x, y, z, yaw, pitch, roll, s, o) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const r00 = cy*cr + sy*sp*sr,  r01 = -cy*sr + sy*sp*cr, r02 = sy*cp;
    const r10 = cp*sr,             r11 = cp*cr,             r12 = -sp;
    const r20 = -sy*cr + cy*sp*sr, r21 = sy*sr + cy*sp*cr,  r22 = cy*cp;
    o[0]=r00*s; o[1]=r10*s; o[2]=r20*s; o[3]=0;
    o[4]=r01*s; o[5]=r11*s; o[6]=r21*s; o[7]=0;
    o[8]=r02*s; o[9]=r12*s; o[10]=r22*s; o[11]=0;
    o[12]=x; o[13]=y; o[14]=z; o[15]=1;
    return o;
  },
};

/* ================================================================== meshes */
/* A growable pile of interleaved vertices: position, normal, colour. Colour
   rides on the vertex rather than a uniform, so the whole world is one draw
   call no matter how many different things are standing in it. */

const STRIDE = 9;

function Mesh(cap) {
  this.data = new Float32Array((cap || 2048) * STRIDE);
  this.n = 0;          // floats written so far
  this.buf = null;
  this.dirty = true;
}

Mesh.prototype.reset = function () { this.n = 0; this.dirty = true; return this; };

Mesh.prototype.room = function (floats) {
  if (this.n + floats <= this.data.length) return;
  let cap = this.data.length || STRIDE;
  while (cap < this.n + floats) cap *= 2;
  const next = new Float32Array(cap);
  next.set(this.data.subarray(0, this.n));
  this.data = next;
};

Mesh.prototype.vert = function (x, y, z, nx, ny, nz, r, g, b) {
  const d = this.data; let i = this.n;
  d[i++]=x; d[i++]=y; d[i++]=z; d[i++]=nx; d[i++]=ny; d[i++]=nz;
  d[i++]=r; d[i++]=g; d[i++]=b;
  this.n = i;
};

/* A quad, wound so its front face is the side the normal points at. */
Mesh.prototype.quad = function (a, b, c, d, n, col) {
  this.room(54);
  const r = ((col >> 16) & 255) / 255, g = ((col >> 8) & 255) / 255, bl = (col & 255) / 255;
  const v = (p) => this.vert(p[0], p[1], p[2], n[0], n[1], n[2], r, g, bl);
  v(a); v(b); v(c); v(a); v(c); v(d);
  this.dirty = true;
};

const CORNERS = [
  [-1,-1,-1], [ 1,-1,-1], [ 1, 1,-1], [-1, 1,-1],
  [-1,-1, 1], [ 1,-1, 1], [ 1, 1, 1], [-1, 1, 1],
];
const FACES = [
  { idx: [4,5,6,7], n: [0,0,1] },
  { idx: [1,0,3,2], n: [0,0,-1] },
  { idx: [5,1,2,6], n: [1,0,0] },
  { idx: [0,4,7,3], n: [-1,0,0] },
  { idx: [3,7,6,2], n: [0,1,0] },
  { idx: [0,1,5,4], n: [0,-1,0] },
];

const tmpP = [[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
const tmpN = [0,0,0];

/* A box, given its centre and half-extents. `m` is an optional matrix every
   corner is run through, which is how anything that rotates gets drawn. */
Mesh.prototype.box = function (cx, cy, cz, hx, hy, hz, col, m) {
  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    for (let k = 0; k < 4; k++) {
      const c = CORNERS[face.idx[k]];
      let x = cx + c[0]*hx, y = cy + c[1]*hy, z = cz + c[2]*hz;
      if (m) {
        const tx = m[0]*x + m[4]*y + m[8]*z + m[12];
        const ty = m[1]*x + m[5]*y + m[9]*z + m[13];
        const tz = m[2]*x + m[6]*y + m[10]*z + m[14];
        x = tx; y = ty; z = tz;
      }
      tmpP[k][0]=x; tmpP[k][1]=y; tmpP[k][2]=z;
    }
    let n = face.n;
    if (m) {
      const nx = m[0]*n[0] + m[4]*n[1] + m[8]*n[2];
      const ny = m[1]*n[0] + m[5]*n[1] + m[9]*n[2];
      const nz = m[2]*n[0] + m[6]*n[1] + m[10]*n[2];
      const l = Math.hypot(nx, ny, nz) || 1;
      tmpN[0]=nx/l; tmpN[1]=ny/l; tmpN[2]=nz/l; n = tmpN;
    }
    this.quad(tmpP[0], tmpP[1], tmpP[2], tmpP[3], n, col);
  }
};

/* A wedge — a box with a sloped top, for the ruler leaning against things.
   `axis` says which way it climbs; `flip` sends it downhill instead. */
Mesh.prototype.wedge = function (cx, y0, cz, hx, hz, rise, axis, col, flip) {
  const along = axis === 'x';
  const at = (sx, sz) => {
    const t = along ? (sx + 1) / 2 : (sz + 1) / 2;
    return y0 + (flip ? 1 - t : t) * rise;
  };
  const mm = [cx-hx, at(-1,-1), cz-hz], mp = [cx-hx, at(-1,1), cz+hz];
  const pm = [cx+hx, at(1,-1), cz-hz], pp = [cx+hx, at(1,1), cz+hz];
  const bmm = [cx-hx, y0, cz-hz], bmp = [cx-hx, y0, cz+hz];
  const bpm = [cx+hx, y0, cz-hz], bpp = [cx+hx, y0, cz+hz];
  const dy = flip ? -rise : rise;
  const run = along ? hx * 2 : hz * 2;
  const nl = Math.hypot(dy, run) || 1;
  const slope = along ? [-dy/nl, run/nl, 0] : [0, run/nl, -dy/nl];
  this.quad(mm, pm, pp, mp, slope, col);
  this.quad(bmm, bmp, bpp, bpm, [0,-1,0], col);
  this.quad(bmm, bpm, pm, mm, [0,0,-1], col);
  this.quad(bpp, bmp, mp, pp, [0,0,1], col);
  this.quad(bpm, bpp, pp, pm, [1,0,0], col);
  this.quad(bmp, bmm, mm, mp, [-1,0,0], col);
};

/* An extruded regular polygon standing on its end. The pencil's body is a
   hexagon of these, its tip is the same call with the top radius at zero. */
Mesh.prototype.prism = function (sides, r0, r1, y0, y1, col, m, twist) {
  const step = Math.PI * 2 / sides;
  const off = twist || 0;
  const cr = ((col >> 16) & 255)/255, cg = ((col >> 8) & 255)/255, cb = (col & 255)/255;
  const put = (x, y, z, nx, ny, nz) => {
    let px = x, py = y, pz = z, mx = nx, my = ny, mz = nz;
    if (m) {
      px = m[0]*x + m[4]*y + m[8]*z + m[12];
      py = m[1]*x + m[5]*y + m[9]*z + m[13];
      pz = m[2]*x + m[6]*y + m[10]*z + m[14];
      const ax = m[0]*nx + m[4]*ny + m[8]*nz;
      const ay = m[1]*nx + m[5]*ny + m[9]*nz;
      const az = m[2]*nx + m[6]*ny + m[10]*nz;
      const l = Math.hypot(ax, ay, az) || 1;
      mx = ax/l; my = ay/l; mz = az/l;
    }
    this.vert(px, py, pz, mx, my, mz, cr, cg, cb);
  };
  this.room(sides * 12 * STRIDE);
  const dr = r1 - r0, dy = y1 - y0, nl = Math.hypot(dy, dr) || 1;
  for (let i = 0; i < sides; i++) {
    const a0 = off + i*step, a1 = off + (i+1)*step, am = (a0+a1)/2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const nx = Math.cos(am) * dy/nl, ny = -dr/nl, nz = Math.sin(am) * dy/nl;
    // Wound anticlockwise seen from OUTSIDE. Wound the other way — which is
    // how this started — back-face culling throws away the near half of every
    // prism and you look straight through the pencil at the inside of its own
    // far wall. It reads as a ghost.
    put(c0*r0, y0, s0*r0, nx, ny, nz);
    put(c1*r1, y1, s1*r1, nx, ny, nz);
    put(c1*r0, y0, s1*r0, nx, ny, nz);
    put(c0*r0, y0, s0*r0, nx, ny, nz);
    put(c0*r1, y1, s0*r1, nx, ny, nz);
    put(c1*r1, y1, s1*r1, nx, ny, nz);
    if (r1 > 0.0001) {
      put(0, y1, 0, 0, 1, 0); put(c1*r1, y1, s1*r1, 0, 1, 0); put(c0*r1, y1, s0*r1, 0, 1, 0);
    }
    if (r0 > 0.0001) {
      put(0, y0, 0, 0, -1, 0); put(c0*r0, y0, s0*r0, 0, -1, 0); put(c1*r0, y0, s1*r0, 0, -1, 0);
    }
  }
  this.dirty = true;
};

/* ================================================================ the pipe */

let gl = null, prog = null, loc = null, canvas = null;
let dpr = 1;
const vp = m4.make(), proj = m4.make(), view = m4.make(), ident = m4.make();

const VS = [
  'attribute vec3 aPos;',
  'attribute vec3 aNrm;',
  'attribute vec3 aCol;',
  'uniform mat4 uVP;',
  'uniform mat4 uM;',
  'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
  'void main() {',
  '  vec4 w = uM * vec4(aPos, 1.0);',
  '  vW = w.xyz;',
  '  vN = mat3(uM[0].xyz, uM[1].xyz, uM[2].xyz) * aNrm;',
  '  vC = aCol;',
  '  gl_Position = uVP * w;',
  '}',
].join('\n');

/* Flat lambert, a little sky light from above and a cool bounce from below so
   undersides are not black, then distance fog in the room's own colour. A
   classroom is one big window plus a lot of strip lighting, and this is the
   cheapest lie that reads as both. */
const FS = [
  'precision mediump float;',
  'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
  'uniform vec3 uLight;',
  'uniform vec3 uFogCol;',
  'uniform vec2 uFog;',
  'uniform vec3 uEye;',
  'uniform vec4 uTint;',
  'uniform float uAlpha;',
  'void main() {',
  '  vec3 n = normalize(vN);',
  '  float key = max(dot(n, uLight), 0.0);',
  '  float sky = 0.5 + 0.5 * n.y;',
  '  float bounce = max(-n.y, 0.0) * 0.16;',
  '  vec3 c = vC * (0.34 + 0.52 * key + 0.20 * sky + bounce);',
  '  float d = length(vW - uEye);',
  '  float f = clamp((d - uFog.x) / max(uFog.y - uFog.x, 0.001), 0.0, 1.0);',
  '  c = mix(c, uFogCol, f * 0.92);',
  '  c = mix(c, uTint.rgb, uTint.a);',
  '  gl_FragColor = vec4(c, uAlpha);',
  '}',
].join('\n');

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader failed to compile');
  }
  return s;
}

function init(cv) {
  canvas = cv;
  const opts = { antialias: true, alpha: false, powerPreference: 'high-performance' };
  try {
    gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
  } catch (e) { gl = null; }
  if (!gl) return false;

  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
  } catch (e) { gl = null; return false; }
  gl.useProgram(prog);

  loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNrm: gl.getAttribLocation(prog, 'aNrm'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    uVP: gl.getUniformLocation(prog, 'uVP'),
    uM: gl.getUniformLocation(prog, 'uM'),
    uLight: gl.getUniformLocation(prog, 'uLight'),
    uFogCol: gl.getUniformLocation(prog, 'uFogCol'),
    uFog: gl.getUniformLocation(prog, 'uFog'),
    uEye: gl.getUniformLocation(prog, 'uEye'),
    uTint: gl.getUniformLocation(prog, 'uTint'),
    uAlpha: gl.getUniformLocation(prog, 'uAlpha'),
  };

  gl.enableVertexAttribArray(loc.aPos);
  gl.enableVertexAttribArray(loc.aNrm);
  gl.enableVertexAttribArray(loc.aCol);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const lx = 0.42, ly = 0.84, lz = 0.34, ll = Math.hypot(lx, ly, lz);
  gl.uniform3f(loc.uLight, lx/ll, ly/ll, lz/ll);
  gl.uniform4f(loc.uTint, 0, 0, 0, 0);
  gl.uniform1f(loc.uAlpha, 1);
  m4.identity(ident);
  return true;
}

function resize() {
  if (!gl) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
}

let eye = [0, 0, 0];

function begin(cam, fog) {
  resize();
  const aspect = canvas.width / Math.max(1, canvas.height);
  m4.perspective(cam.fov || 1.15, aspect, 0.1, 900, proj);
  m4.lookAt(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, view);
  m4.mul(proj, view, vp);
  eye = [cam.x, cam.y, cam.z];
  gl.uniformMatrix4fv(loc.uVP, false, vp);
  gl.uniform3f(loc.uEye, cam.x, cam.y, cam.z);
  const c = fog.col;
  const r = ((c>>16)&255)/255, g = ((c>>8)&255)/255, b = (c&255)/255;
  gl.uniform3f(loc.uFogCol, r, g, b);
  gl.uniform2f(loc.uFog, fog.near, fog.far);
  gl.clearColor(r, g, b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function draw(mesh, model, opts) {
  if (!mesh.n) return;
  if (!mesh.buf) mesh.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
  if (mesh.dirty) {
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data.subarray(0, mesh.n), gl.DYNAMIC_DRAW);
    mesh.dirty = false;
  }
  const s = STRIDE * 4;
  gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, s, 0);
  gl.vertexAttribPointer(loc.aNrm, 3, gl.FLOAT, false, s, 12);
  gl.vertexAttribPointer(loc.aCol, 3, gl.FLOAT, false, s, 24);
  gl.uniformMatrix4fv(loc.uM, false, model || ident);
  const o = opts || {};
  gl.uniform4f(loc.uTint, o.tintR || 0, o.tintG || 0, o.tintB || 0, o.tint || 0);
  const a = o.alpha === undefined ? 1 : o.alpha;
  gl.uniform1f(loc.uAlpha, a);
  if (a < 1) { gl.enable(gl.BLEND); gl.depthMask(false); }
  gl.drawArrays(gl.TRIANGLES, 0, mesh.n / STRIDE);
  if (a < 1) { gl.disable(gl.BLEND); gl.depthMask(true); }
}

return {
  init, resize, begin, draw, m4,
  mesh: (cap) => new Mesh(cap),
  get ok() { return !!gl; },
  get eye() { return eye; },
};
})();
