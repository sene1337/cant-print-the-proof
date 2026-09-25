// Verse 3 kit: textures, shader patches and small props shared by the verse 3 stages.
// Everything here is drawn once at build time; per-frame work only moves things.
import * as THREE from 'three';
import { rng, hash1, clamp } from '../util.js';
import { normalFromHeight } from '../tex.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTex(c, { srgb = true, aniso = 8, repeat = false, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (!mips) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  t.needsUpdate = true;
  return t;
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------------------------------------
// The white paper. Page 1 carries the real title block; the body is greeked (grey bars).
const HEADINGS = {
  1: ['1. Introduction'],
  2: ['2. Transactions'],
  3: ['3. Timestamp Server', '4. Proof-of-Work'],
  4: ['5. Network', '6. Incentive'],
  5: ['7. Reclaiming Disk Space', '8. Simplified Payment Verification'],
  6: ['9. Combining and Splitting Value', '10. Privacy'],
  7: ['11. Calculations'],
  8: ['12. Conclusion'],
  9: ['References'],
};

export function pageTexture(n, { w = 1224, h = 1584 } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  const s = w / 1224;
  const R = rng(300 + n * 17);
  g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w, h);
  // paper fibre
  for (let i = 0; i < 7000 * s * s; i++) {
    g.fillStyle = `rgba(110,100,80,${R() * 0.035})`;
    g.fillRect(R() * w, R() * h, (1 + R() * 3) * s, 1 * s);
  }
  const M = 150 * s, X1 = w - 150 * s;
  const lh = 27 * s;
  // One line of greeked body text: a grey bar at x-height, shorter at the end of a paragraph.
  const textLine = (x0, x1, y, last = false) => {
    const end = x0 + (x1 - x0) * (last ? 0.25 + R() * 0.55 : 1);
    g.fillStyle = 'rgba(45,45,45,0.30)';
    let x = x0;
    while (x < end - 4 * s) {
      const run = Math.min(end - x, (28 + R() * 90) * s);
      g.fillRect(x, y - 10 * s, run, 6 * s);
      x += run + 7 * s;
    }
  };
  const bottom = h - 150 * s;
  const para = (x0, x1, y, lines, indent = 30 * s) => {
    lines = Math.min(lines, Math.floor((bottom - y) / lh));
    for (let i = 0; i < lines; i++) textLine(i === 0 ? x0 + indent : x0, x1, y + i * lh, i === lines - 1);
    return y + Math.max(0, lines) * lh;
  };
  const heading = (txt, y) => {
    g.fillStyle = '#141414'; g.textAlign = 'left';
    g.font = `700 ${Math.round(27 * s)}px "Cormorant Garamond"`;
    g.fillText(txt, M, y);
    return y + 40 * s;
  };
  // A little box-and-arrow diagram, like the paper's figures.
  const diagram = (y, kind) => {
    g.save();
    g.strokeStyle = '#1a1a1a'; g.fillStyle = '#1a1a1a'; g.lineWidth = 2.2 * s;
    g.font = `600 ${Math.round(17 * s)}px "Cormorant Garamond"`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const bw = 190 * s, bh = kind === 'block' ? 120 * s : 90 * s, gap = 70 * s;
    const x0 = w / 2 - (bw * 3 + gap * 2) / 2;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (bw + gap);
      g.strokeRect(x, y, bw, bh);
      if (kind === 'block') {
        g.strokeRect(x + 12 * s, y + 12 * s, bw * 0.46, 34 * s); g.fillText('Prev Hash', x + 12 * s + bw * 0.23, y + 29 * s);
        g.strokeRect(x + bw * 0.52 + 6 * s, y + 12 * s, bw * 0.4, 34 * s); g.fillText('Nonce', x + bw * 0.72 + 6 * s, y + 29 * s);
        for (let k = 0; k < 3; k++) { g.strokeRect(x + 12 * s + k * 58 * s, y + 64 * s, 48 * s, 34 * s); g.fillText('Tx', x + 36 * s + k * 58 * s, y + 81 * s); }
      } else {
        g.fillText(kind === 'tx' ? 'Transaction' : 'Hash', x + bw / 2, y + 26 * s);
        g.strokeRect(x + 20 * s, y + 46 * s, bw - 40 * s, 30 * s);
      }
      if (i < 2) {
        const ax = x + bw + 8 * s, ay = y + bh / 2;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + gap - 16 * s, ay); g.stroke();
        g.beginPath(); g.moveTo(ax + gap - 16 * s, ay - 7 * s); g.lineTo(ax + gap - 6 * s, ay); g.lineTo(ax + gap - 16 * s, ay + 7 * s); g.fill();
      }
    }
    g.restore();
    return y + bh + 50 * s;
  };

  let y;
  if (n === 1) {
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `700 ${Math.round(50 * s)}px "Cormorant Garamond"`;
    g.fillText('Bitcoin: A Peer-to-Peer Electronic Cash System', w / 2, 178 * s);
    g.font = `600 ${Math.round(38 * s)}px "Cormorant Garamond"`;
    g.fillText('Satoshi Nakamoto', w / 2, 262 * s);
    g.font = `500 ${Math.round(26 * s)}px "Cormorant Garamond"`;
    g.fillText('satoshin@gmx.com', w / 2, 304 * s);
    g.fillText('www.bitcoin.org', w / 2, 338 * s);
    // Abstract, indented both sides.
    g.textAlign = 'left';
    g.font = `700 ${Math.round(22 * s)}px "Cormorant Garamond"`;
    y = 430 * s;
    g.fillStyle = '#141414'; g.fillText('Abstract.', M + 70 * s, y);
    const aw = g.measureText('Abstract.  ').width;
    // The one real line: the abstract's opening words.
    g.font = `500 ${Math.round(22 * s)}px "Cormorant Garamond"`;
    const first = 'A purely peer-to-peer version of electronic cash';
    g.fillStyle = 'rgba(22,22,22,0.88)';
    g.fillText(first, M + 70 * s + aw, y);
    const fw = g.measureText(first + ' ').width;
    textLine(M + 70 * s + aw + fw, X1 - 70 * s, y);
    y = para(M + 70 * s, X1 - 70 * s, y + lh, 9, 0);
  } else {
    y = para(M, X1, 150 * s, 3 + Math.floor(R() * 4), 0) + 14 * s;
  }
  // Section headings, each followed by body text; some pages carry a figure.
  const heads = HEADINGS[n] || [];
  const fig = { 2: 'tx', 3: 'block', 5: 'hash' }[n];
  heads.forEach((hd, j) => {
    if (y > bottom - lh * 3) return;
    y = heading(hd, y + 26 * s);
    y = para(M, X1, y, 4 + Math.floor(R() * 4)) + 12 * s;
    if (fig && j === heads.length - 1 && y < bottom - 300 * s) y = diagram(y + 16 * s, fig);
  });
  while (y < bottom - lh) y = para(M, X1, y, 4 + Math.floor(R() * 6)) + 12 * s;
  g.fillStyle = '#333'; g.textAlign = 'center';
  g.font = `500 ${Math.round(22 * s)}px "Cormorant Garamond"`;
  g.fillText(String(n), w / 2, h - 80 * s);
  return canvasTex(c, { aniso: 16 });
}

// ---------------------------------------------------------------------------------------------
// Burn-away: paper (or anything with UVs) chars and burns from its edges inward as uBurn goes 0 -> 1.
// Also gives double-sided sheets a clean unprinted back.
export function patchBurn(mat, { seed = 0, back = [0.9, 0.885, 0.85], ember = [1.0, 0.42, 0.07] } = {}) {
  const u = {
    uBurn: { value: 0 }, uSeed: { value: seed }, uTime: { value: 0 },
    uEmber: { value: new THREE.Color(...ember) }, uBack: { value: new THREE.Color(...back) },
  };
  mat.userData.burn = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vBUv;
        uniform float uBurn, uSeed, uTime; uniform vec3 uEmber, uBack;
        float v3h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float v3n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(v3h(i), v3h(i + vec2(1.0, 0.0)), f.x), mix(v3h(i + vec2(0.0, 1.0)), v3h(i + vec2(1.0, 1.0)), f.x), f.y); }
        float v3fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * v3n(p); p *= 2.03; a *= 0.5; } return s; }
        float v3burn() {
          vec2 q = vBUv;
          float e = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)) * 2.0;
          float v = 0.62 * v3fbm(q * vec2(4.0, 5.0) + uSeed * 7.31) + 0.38 * (1.0 - e);
          return (1.08 - uBurn * 1.45) - v;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (!gl_FrontFacing) diffuseColor.rgb = uBack;
        float v3d = v3burn();
        if (v3d < 0.0) discard;
        diffuseColor.rgb *= mix(0.06, 1.0, smoothstep(0.035, 0.17, v3d));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float v3e = (1.0 - smoothstep(0.0, 0.022, v3d)) * step(0.0005, uBurn);
        totalEmissiveRadiance += uEmber * v3e * (2.2 + 2.0 * v3n(vBUv * 38.0 + uTime * 7.0));`);
  };
  mat.customProgramCacheKey = () => 'verse3-burn';
  return u;
}

// ---------------------------------------------------------------------------------------------
// A soft beam of light: an open cone, brightest at the source, fading at its silhouette.
export function lightCone({ radius = 1.6, height = 6, color = [1, 0.93, 0.8], gain = 0.12 } = {}) {
  const geo = new THREE.CylinderGeometry(radius * 0.08, radius, height, 64, 12, true);
  geo.translate(0, -height / 2, 0); // apex at the origin, opening downward
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(...color) }, uGain: { value: gain }, uH: { value: height } },
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        vY = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uGain, uH;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        float along = clamp(-vY / uH, 0.0, 1.0);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = uGain * edge * pow(1.0 - along, 1.4) * smoothstep(0.0, 0.08, along);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 10;
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------------------------------------
// Round soft sprite for sparks, embers and glows.
let SPRITE = null;
export function softSprite() {
  if (SPRITE) return SPRITE;
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SPRITE = new THREE.CanvasTexture(c);
  return SPRITE;
}

// Time-pure particles: fn(i, out[3]) returns a brightness 0..1 (0 hides the particle).
export class Motes extends THREE.Points {
  constructor({ count = 300, size = 0.04, color = [1, 0.55, 0.15], gain = 5 } = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({
      size, map: softSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexColors: true, sizeAttenuation: true,
    });
    super(geo, mat);
    this.n = count;
    this.base = new THREE.Color(...color).multiplyScalar(gain);
    this.frustumCulled = false;
  }
  layout(fn) {
    const p = this.geometry.attributes.position.array, c = this.geometry.attributes.color.array;
    const v = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      v[0] = v[1] = v[2] = 0;
      const b = fn(i, v) || 0;
      p[i * 3] = v[0]; p[i * 3 + 1] = v[1]; p[i * 3 + 2] = v[2];
      c[i * 3] = this.base.r * b; c[i * 3 + 1] = this.base.g * b; c[i * 3 + 2] = this.base.b * b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
  // A ballistic burst from origin: dt seconds after impact.
  burst(dt, origin, { power = 1, spread = 1, up = 0.6, dir = [0, 0, 0], life = 0.8, gravity = 9, seed = 1 } = {}) {
    this.visible = dt >= 0 && dt < life * 1.6;
    if (!this.visible) return;
    this.layout((i, o) => {
      const h = (k) => hash1(i * 7 + k + seed * 1013);
      const a = h(1) * Math.PI * 2, e = (h(2) - 0.5) * Math.PI * spread + up;
      const v = (1.5 + h(3) * 4.5) * power;
      const my = life * (0.4 + h(4) * 0.9);
      if (dt > my) return 0;
      const vx = Math.cos(a) * Math.cos(e) * v + dir[0] * v, vy = Math.sin(e) * v + dir[1] * v, vz = Math.sin(a) * Math.cos(e) * v + dir[2] * v;
      o[0] = origin[0] + vx * dt; o[1] = origin[1] + vy * dt - 0.5 * gravity * dt * dt; o[2] = origin[2] + vz * dt;
      return clamp(1 - dt / my) * (0.6 + 0.4 * h(5));
    });
  }
}

// A crisp point of light: a hot core, a tight halo and four thin rays (reads as a spark, not a smudge).
let STAR = null;
export function starSprite() {
  if (STAR) return STAR;
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const m = S / 2;
  const halo = g.createRadialGradient(m, m, 0, m, m, m * 0.5);
  halo.addColorStop(0, 'rgba(255,255,255,1)'); halo.addColorStop(0.08, 'rgba(255,255,255,0.9)');
  halo.addColorStop(0.25, 'rgba(255,255,255,0.18)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const gr = g.createLinearGradient(m - dx * m, m - dy * m, m + dx * m, m + dy * m);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    if (dx) g.fillRect(0, m - 1.2, S, 2.4); else g.fillRect(m - 1.2, 0, 2.4, S);
  }
  STAR = new THREE.CanvasTexture(c);
  return STAR;
}
export function sparkCard(color = [1, 0.7, 0.35], size = 1) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starSprite(), color: new THREE.Color(...color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.scale.setScalar(size);
  return m;
}

// A glow card that always faces the camera (for light sources).
export function glowCard(color = [1, 0.6, 0.2], size = 1) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softSprite(), color: new THREE.Color(...color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.scale.setScalar(size);
  return m;
}

// ---------------------------------------------------------------------------------------------
// The orange coin's face: a raised Bitcoin glyph and rim (polished) on a satin field.
// Returns maps in the Coin prop's face format, plus a roughness map to add after construction.
const FACES = new Map();
export function orangeFace(glyph, { size = 1024, rim = 0.075 } = {}) {
  const key = `${size}|${rim}`;
  if (FACES.has(key)) return FACES.get(key);
  const R = size / 2;
  const hc = canvas(size, size), hg = hc.getContext('2d');
  const cc = canvas(size, size), cg = cc.getContext('2d');
  const rc = canvas(size, size), rg = rc.getContext('2d');
  hg.fillStyle = '#5c5c5c'; hg.fillRect(0, 0, size, size);
  cg.fillStyle = '#c9c4bd'; cg.fillRect(0, 0, size, size);
  rg.fillStyle = '#5c5c5c'; rg.fillRect(0, 0, size, size);
  const ring = (g, col, lw, rr) => { g.lineWidth = lw; g.strokeStyle = col; g.beginPath(); g.arc(R, R, rr, 0, Math.PI * 2); g.stroke(); };
  // outer rim and a fine inner ring
  ring(hg, '#f2f2f2', R * rim * 1.1, R * (1 - rim * 0.45)); ring(cg, '#ffffff', R * rim * 1.1, R * (1 - rim * 0.45)); ring(rg, '#262626', R * rim * 1.1, R * (1 - rim * 0.45));
  ring(hg, '#d0d0d0', R * 0.012, R * 0.8); ring(cg, '#ffffff', R * 0.012, R * 0.8); ring(rg, '#262626', R * 0.012, R * 0.8);
  // beads between the rings
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, x = R + Math.cos(a) * R * 0.86, y = R + Math.sin(a) * R * 0.86;
    for (const [g, col] of [[hg, '#e0e0e0'], [cg, '#ffffff'], [rg, '#262626']]) { g.fillStyle = col; g.beginPath(); g.arc(x, y, R * 0.012, 0, Math.PI * 2); g.fill(); }
  }
  for (const [g, col] of [[hg, '#ffffff'], [cg, '#ffffff'], [rg, '#1c1c1c']]) { g.save(); g.translate(R, R); g.scale(0.82, 0.82); glyph(g, R, col); g.restore(); }
  const t = (c, srgb) => { const x = canvasTex(c, { srgb }); return x; };
  const out = { normal: normalFromHeight(hc, 3.0, 3), color: t(cc, true), rough: t(rc, false) };
  FACES.set(key, out);
  return out;
}

// Same transform the Coin prop applies to its face maps.
export function coinMap(tex, R) {
  const c = tex.clone();
  c.repeat.set(1 / (2 * R), 1 / (2 * R));
  c.offset.set(0.5, 0.5);
  c.needsUpdate = true;
  return c;
}
