// The bank (bridge, 112.23-116.96): a stone temple of money at night under alarm-red light.
// It shakes on the hits and cracks spread across its carved motto; a colossal strapped brick of new notes comes down
// out of the dark into its roof (the bailout); the floor under the savers' coins at its door swings down like a
// trapdoor and the coins slide off it into a dark shaft. Flash safety: slow, heavy motion and rough coins (few glints); nothing strobes.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { NoteCloud } from '../props/notes.js';
import { METALS } from '../props/coin.js';
import { coinFace, normalFromHeight } from '../tex.js';
import { bridgeNote } from '../props/bridge-note.js';
import { clamp, hash1, lerp, rng, smooth, easeOut, easeIn } from '../util.js';

// Layout (bank space: columns stand on the stylobate top at y = 0, column axes at z = 0).
export const BANK = {
  colX: [-7.25, -4.35, -1.45, 1.45, 4.35, 7.25],
  shaftH: 7.6, capTop: 8.35, archTop: 9.3, friezeTop: 10.65, corniceTop: 11.1, apex: 13.7,
  halfW: 8.4, corniceHalfW: 8.85,
  stepH: 0.36, stepD: 0.7, steps: 5, styFront: 1.6,
  crackRect: [-9.6, -2.3, 19.2, 16.4],
};
export const HEAP = { z: 0.78 };   // centre of the savers' hole, on the stylobate in front of the door
// The trapdoor: one slab of paving plugs the hole. Its back edge is a straight stone joint (the hinge); the other three
// sides are fresh breaks. On "savers" it snaps free and swings down into a dark shaft, pivoting on its bottom-back edge.
export const TRAP = { xL: -0.78, xR: 0.78, zB: 0.12, zF: 1.42, th: 0.24, t1: 0.03, tt: 0.6, max: 1.15 };
// The shaft under the slab: a rectangular opening through the stylobate and steps (the lined walls follow the breaks).
export const PIT = { x0: -0.95, x1: 0.95, z0: 0.0, z1: 1.55, depth: 3.4 };
export const stepTop = (i) => -BANK.stepH * i;                 // i = 0 (stylobate) .. 5
export const stepFront = (i) => BANK.styFront + BANK.stepD * i;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function texOf(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// Pale limestone: colour and a subtle pitted normal map. Tiles every 4 units.
function limestone() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d'), hc = canvas(S, S), h = hc.getContext('2d');
  const R = rng(19);
  g.fillStyle = '#cbc3b4'; g.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  const wrapArc = (ctx, x, y, r) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
  };
  for (let i = 0; i < 260; i++) {
    const v = R();
    g.fillStyle = v < 0.5 ? `rgba(120,108,92,${0.03 + R() * 0.05})` : `rgba(235,230,220,${0.03 + R() * 0.05})`;
    wrapArc(g, R() * S, R() * S, 30 + R() * 140);
  }
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, r = 0.4 + R() * R() * 2.2;
    g.fillStyle = `rgba(70,62,52,${R() * 0.18})`; wrapArc(g, x, y, r);
    h.fillStyle = `rgba(0,0,0,${R() * 0.4})`; wrapArc(h, x, y, r);
  }
  // faint bedding lines
  for (let i = 0; i < 26; i++) {
    const y = R() * S;
    g.strokeStyle = `rgba(110,98,84,${0.04 + R() * 0.06})`; g.lineWidth = 1 + R() * 3;
    g.beginPath();
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6);
    g.stroke();
  }
  return { map: texOf(c), normal: (() => { const n = normalFromHeight(hc, 1.4, 1); n.wrapS = n.wrapT = THREE.RepeatWrapping; return n; })() };
}

// The carved frieze: the bank's motto cut into the stone (dark recessed letters, bevelled in the normal map).
function friezeTextures(text) {
  const W = 2048, H = Math.round(2048 * (BANK.friezeTop - BANK.archTop) / (BANK.halfW * 2));
  const col = canvas(W, H), g = col.getContext('2d'), hc = canvas(W, H), h = hc.getContext('2d');
  h.fillStyle = '#fff'; h.fillRect(0, 0, W, H);
  g.clearRect(0, 0, W, H);
  const font = `700 ${Math.round(H * 0.72)}px "Cormorant Garamond"`;
  for (const ctx of [g, h]) { ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
  // letter-spaced
  const spaced = text;
  for (const ctx of [g, h]) ctx.letterSpacing = `${Math.round(H * 0.09)}px`;
  h.filter = 'blur(2px)'; h.fillStyle = '#000'; h.fillText(spaced, W / 2, H * 0.55); h.filter = 'none';
  g.fillStyle = 'rgba(40,32,26,0.78)'; g.fillText(spaced, W / 2, H * 0.55);
  // guide fillets above and below the letters
  g.fillStyle = 'rgba(60,50,40,0.35)'; g.fillRect(0, H * 0.06, W, 3); g.fillRect(0, H * 0.94, W, 3);
  h.fillStyle = '#000'; h.fillRect(0, H * 0.06, W, 3); h.fillRect(0, H * 0.94, W, 3);
  const letters = texOf(col, { repeat: false });
  const normal = normalFromHeight(hc, 2.4, 1.5);
  return { letters, normal, aspect: W / H };
}

// Crack atlas over the facade: G = crack coverage, R/G = arrival (0..1) so cracks can grow with a threshold.
function crackTexture() {
  // Three layers, one per channel: R = when the crack reaches this point (0..1, for growth), G = the open gap (core),
  // B = the depth of the crevice (a soft V profile plus chipped edges), which the shader turns into sloped walls.
  const [x0, y0, w, h] = BANK.crackRect;
  const CW = 2048, CH = Math.round(2048 * h / w);
  const mk = (bg) => { const c = canvas(CW, CH), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, CW, CH); g.lineCap = 'round'; g.lineJoin = 'round'; return [c, g]; };
  const [cA, gA] = mk('#fff'), [cC, gC] = mk('#000'), [cD, gD] = mk('#000');
  gA.globalCompositeOperation = 'darken';   // where cracks overlap, the earliest arrival wins
  gC.globalCompositeOperation = 'lighten';
  gD.globalCompositeOperation = 'lighten';
  const ppu = CW / w;                          // atlas pixels per bank unit
  const px = (x) => ((x - x0) / w) * CW, py = (y) => (1 - (y - y0) / h) * CH;
  const R = rng(2008);
  const chips = [];
  // A crack runs in fairly straight runs that kink around its main direction (they don't wander off), narrows toward
  // its tip and now and then branches. In a column it keeps to the column's width.
  function crack(x, y, base, len, width, a0, a1, bounds, depth = 0) {
    let s = 0, ang = base, run = 0;
    const vertical = Math.abs(Math.sin(base)) > 0.7;
    while (s < len) {
      const step = 0.05;
      if (run <= 0) {
        const dev = clamp((R() + R() + R() - 1.5) * 0.45, -0.6, 0.6);
        ang = base + dev;
        run = 0.2 + R() * 0.4;
        if (bounds && vertical) {
          const mid = (bounds[0] + bounds[1]) / 2, half = (bounds[1] - bounds[0]) / 2;
          if (Math.abs(x - mid) > 0.55 * half) ang = base + Math.sign(mid - x) * Math.sign(Math.sin(base) < 0 ? 1 : -1) * (0.25 + R() * 0.2);
        }
        if (depth < 2 && R() < 0.12 && len - s > 0.8) {
          const side = R() < 0.5 ? -1 : 1;
          const at = lerp(a0, a1, s / len);
          crack(x, y, ang + side * (0.5 + R() * 0.4), (len - s) * (0.25 + R() * 0.25), width * 0.55, at, Math.min(1, at + (a1 - a0) * 0.3), bounds, depth + 1);
        }
      }
      if (bounds && !vertical && (x < bounds[0] || x > bounds[1])) break;
      const jit = (R() - 0.5) * 0.015;
      const nx = x + Math.cos(ang) * step - Math.sin(ang) * jit, ny = y + Math.sin(ang) * step + Math.cos(ang) * jit;
      const u = s / len, arr = lerp(a0, a1, u);
      const core = Math.max(0.012, width * (1 - 0.8 * u));          // bank units
      const halo = core * 2.6 + 0.05;
      const v = Math.round(arr * 255);
      gA.strokeStyle = `rgb(${v},${v},${v})`; gA.lineWidth = (halo + 0.06) * ppu;
      gA.beginPath(); gA.moveTo(px(x), py(y)); gA.lineTo(px(nx), py(ny)); gA.stroke();
      gC.strokeStyle = '#fff'; gC.lineWidth = core * ppu;
      gC.beginPath(); gC.moveTo(px(x), py(y)); gC.lineTo(px(nx), py(ny)); gC.stroke();
      gD.strokeStyle = '#fff'; gD.lineWidth = halo * ppu;
      gD.beginPath(); gD.moveTo(px(x), py(y)); gD.lineTo(px(nx), py(ny)); gD.stroke();
      if (R() < 0.05 && core > 0.025) chips.push([nx, ny, ang, core, arr]);
      x = nx; y = ny; s += step; run -= step;
    }
  }
  const down = -Math.PI / 2;
  const cx = BANK.colX;
  // 1. through the motto near FAIL, down the architrave and into a column
  crack(4.95, 11.05, down - 0.15, 3.2, 0.075, 0.0, 0.26, null);
  crack(4.5, 8.3, down, 5.4, 0.06, 0.26, 0.5, [cx[4] - 0.4, cx[4] + 0.4]);
  // 2. from the pediment's apex down through the tympanum into the frieze
  crack(0.2, 13.55, down + 0.35, 4.3, 0.065, 0.24, 0.6, null);
  // 3. along the frieze, splitting the motto
  crack(4.4, 9.95, Math.PI + 0.04, 12.8, 0.055, 0.42, 0.86, [-8.2, 8.2]);
  // 4. the left architrave
  crack(-8.3, 9.05, -0.18, 3.8, 0.05, 0.55, 0.85, [-8.4, 8.4]);
  // 5-7. columns: long vertical splits
  crack(cx[1] + 0.1, 8.25, down, 6.4, 0.055, 0.5, 0.88, [cx[1] - 0.4, cx[1] + 0.4]);
  crack(cx[2] - 0.05, 8.25, down, 3.8, 0.045, 0.74, 1.0, [cx[2] - 0.4, cx[2] + 0.4]);
  crack(cx[5], 8.25, down, 5.0, 0.045, 0.78, 1.0, [cx[5] - 0.4, cx[5] + 0.4]);
  // 8. across the steps
  crack(-5.5, -0.1, -0.06, 11, 0.05, 0.72, 1.0, [-9, 9]);
  crack(1.8, -0.05, down + 0.6, 3.2, 0.045, 0.8, 1.0, null);
  // chipped edges: small flakes of stone gone from the lip of the wider cracks
  for (const [x, y, ang, core, arr] of chips) {
    const side = R() < 0.5 ? -1 : 1, r = core * (2.2 + R() * 2.2);
    const cxp = x - Math.sin(ang) * side * r * 0.6, cyp = y + Math.cos(ang) * side * r * 0.6;
    const v = Math.round(arr * 255);
    for (const [g2, fill] of [[gD, 'rgb(150,150,150)'], [gA, `rgb(${v},${v},${v})`]]) {
      g2.fillStyle = fill;
      g2.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + R() * 0.6, rr = r * (0.55 + R() * 0.6);
        const qx = px(cxp + Math.cos(a) * rr), qy = py(cyp + Math.sin(a) * rr);
        k ? g2.lineTo(qx, qy) : g2.moveTo(qx, qy);
      }
      g2.closePath(); g2.fill();
    }
  }
  // the crevice's V profile: blur the depth layer
  const [cB, gB] = mk('#000');
  gB.filter = `blur(${Math.round(0.035 * ppu)}px)`;
  gB.drawImage(cD, 0, 0);
  const A = gA.getImageData(0, 0, CW, CH).data, C = gC.getImageData(0, 0, CW, CH).data, D = gB.getImageData(0, 0, CW, CH).data;
  const out = canvas(CW, CH), go = out.getContext('2d'), img = go.createImageData(CW, CH);
  for (let i = 0; i < CW * CH * 4; i += 4) { img.data[i] = A[i]; img.data[i + 1] = C[i]; img.data[i + 2] = D[i]; img.data[i + 3] = 255; }
  go.putImageData(img, 0, 0);
  const t = texOf(out, { srgb: false, repeat: false });
  t.generateMipmaps = true;
  t.userData.texel = [1 / CW, 1 / CH];
  return t;
}

// Inject bank-space cracks into a standard material: a dark open gap, walls shaded by depth, and the surface normal
// bent into the crevice so the flood light catches one wall and leaves the other in shadow.
function crackify(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uBankInv; varying vec3 vBankPos; varying vec3 vBankNrm;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBankPos = (uBankInv * modelMatrix * vec4(transformed, 1.0)).xyz;
        vBankNrm = normalize(mat3(uBankInv) * mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uCrackTex; uniform float uCrack, uCrackNormal; uniform vec4 uCrackRect; uniform vec2 uCrackTexel;
        uniform vec3 uBankAxX, uBankAxY;
        varying vec3 vBankPos; varying vec3 vBankNrm;
        float crackCore = 0.0, crackD = 0.0; vec2 crackGrad = vec2(0.0);
        float crackDepthAt(vec2 uv) {
          vec3 c = texture2D(uCrackTex, uv).rgb;
          return c.b * (1.0 - smoothstep(uCrack - 0.02, uCrack, c.r));
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 cuv = (vBankPos.xy - uCrackRect.xy) / uCrackRect.zw;
          if (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0 && vBankNrm.z > 0.45) {
            vec3 c0 = texture2D(uCrackTex, cuv).rgb;
            float rev = 1.0 - smoothstep(uCrack - 0.02, uCrack, c0.r);
            crackCore = c0.g * rev;
            crackD = c0.b * rev;
            vec2 e = uCrackTexel * 2.0;
            crackGrad = vec2(crackDepthAt(cuv + vec2(e.x, 0.0)) - crackDepthAt(cuv - vec2(e.x, 0.0)),
                             crackDepthAt(cuv + vec2(0.0, e.y)) - crackDepthAt(cuv - vec2(0.0, e.y)));
          }
          // walls darken with depth (occlusion); the open gap is almost black
          diffuseColor.rgb *= (1.0 - 0.5 * crackD) * (1.0 - 0.92 * crackCore);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (crackD > 0.001) {
          vec3 vx = normalize(mat3(viewMatrix) * uBankAxX), vy = normalize(mat3(viewMatrix) * uBankAxY);
          normal = normalize(normal + (crackGrad.x * vx + crackGrad.y * vy) * uCrackNormal);
        }`);
  };
  mat.customProgramCacheKey = () => 'bridge-crack-depth';
  return mat;
}

// Box-projected UVs in bank units so one tiling texture sits at the same scale on every block.
function boxUV(geo, offset = [0, 0, 0], scale = 0.25) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + offset[0], y = p.getY(i) + offset[1], z = p.getZ(i) + offset[2];
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (az >= ax && az >= ay) uv.setXY(i, x * scale, y * scale);
    else if (ax >= ay) uv.setXY(i, z * scale, y * scale);
    else uv.setXY(i, x * scale, z * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

// A fluted Doric shaft with entasis.
function columnGeometry() {
  const H = BANK.shaftH, r0 = 0.62, r1 = 0.52, flutes = 20, radial = 160, rings = 24;
  const g = new THREE.CylinderGeometry(1, 1, H, radial, rings, true);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = (y + H / 2) / H;
    const a = Math.atan2(z, x);
    const ent = lerp(r0, r1, v) + Math.sin(v * Math.PI) * 0.018;
    const f = Math.abs(Math.cos((a * flutes) / 2));
    const r = ent * (1 - 0.055 * (1 - Math.pow(f, 0.6)));
    p.setXYZ(i, Math.cos(a) * r, y + H / 2, Math.sin(a) * r);
    uv.setXY(i, (a / (Math.PI * 2)) * 4 * 0.7, (y + H / 2) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}
function echinusGeometry() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    pts.push(new THREE.Vector2(0.53 + 0.34 * Math.pow(u, 1.6), BANK.shaftH + u * 0.42));
  }
  pts.push(new THREE.Vector2(0.001, BANK.shaftH + 0.42));
  const g = new THREE.LatheGeometry(pts, 96);
  return g;
}

// Worn paving stone for the close-up: grain, pits, stains, chisel marks and slab joints (colour + height).
function paving() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d'), hc = canvas(S, S), h = hc.getContext('2d');
  const R = rng(415);
  g.fillStyle = '#c2b9a8'; g.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  const wrap = (ctx, x, y, r) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
  };
  // broad tonal clouds and stains
  for (let i = 0; i < 180; i++) {
    const v = R();
    g.fillStyle = v < 0.55 ? `rgba(96,84,68,${0.03 + R() * 0.07})` : `rgba(232,226,212,${0.03 + R() * 0.06})`;
    wrap(g, R() * S, R() * S, 25 + R() * 150);
  }
  // grain and pits
  for (let i = 0; i < 26000; i++) {
    const x = R() * S, y = R() * S, r = 0.4 + R() * R() * 3.2, d = R();
    g.fillStyle = `rgba(60,52,42,${d * 0.28})`; wrap(g, x, y, r);
    h.fillStyle = `rgba(0,0,0,${d * 0.55})`; wrap(h, x, y, r);
  }
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, r = 0.5 + R() * 1.6;
    g.fillStyle = `rgba(240,234,222,${R() * 0.18})`; wrap(g, x, y, r);
    h.fillStyle = `rgba(255,255,255,${R() * 0.3})`; wrap(h, x, y, r);
  }
  // chisel marks: short parallel strokes in patches
  for (let p = 0; p < 40; p++) {
    const cx = R() * S, cy = R() * S, ang = R() * Math.PI, n = 6 + Math.floor(R() * 10);
    for (let k = 0; k < n; k++) {
      const off = (k - n / 2) * 5, len = 14 + R() * 26;
      const x = cx + Math.cos(ang + Math.PI / 2) * off, y = cy + Math.sin(ang + Math.PI / 2) * off;
      h.strokeStyle = 'rgba(0,0,0,0.35)'; h.lineWidth = 2;
      h.beginPath(); h.moveTo(x, y); h.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); h.stroke();
      g.strokeStyle = 'rgba(90,80,66,0.12)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    }
  }
  // slab joints (tile edges line up, so the texture repeats as a paved floor)
  for (const [ctx, col, w] of [[g, 'rgba(58,50,40,0.85)', 5], [h, '#000', 6]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(S, 2); ctx.moveTo(2, 0); ctx.lineTo(2, S); ctx.moveTo(S * 0.5, 0); ctx.lineTo(S * 0.5, S); ctx.stroke();
  }
  const map = texOf(c);
  const normal = normalFromHeight(hc, 1.8, 1);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  return { map, normal };
}

// The bundle's sides: the edges of stacked notes, seen edge-on as soft horizontal layers (low contrast, so the fine
// layers never shimmer), slightly uneven, with the odd sheet standing proud.
function stackEdges() {
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d');
  const R = rng(2008);
  g.fillStyle = '#dfe4d6'; g.fillRect(0, 0, W, H);
  let y = 0;
  while (y < H) {
    const th = 5 + R() * 5;
    const v = R();
    g.fillStyle = v < 0.5 ? `rgba(92,108,92,${0.1 + R() * 0.12})` : `rgba(250,252,244,${0.25 + R() * 0.3})`;
    // each layer wavers a little along its length
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 0.8);
    for (let x = W; x >= 0; x -= 32) g.lineTo(x, y + th * 0.55 + Math.sin(x * 0.02 + y + 1) * 0.8);
    g.closePath(); g.fill();
    y += th;
  }
  // grime at the edges of the pile, where hands hold it
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(60,70,60,0.18)'); gr.addColorStop(0.12, 'rgba(60,70,60,0)'); gr.addColorStop(0.88, 'rgba(60,70,60,0)'); gr.addColorStop(1, 'rgba(60,70,60,0.18)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return texOf(c);
}

// The paper strap around the bundle: a mustard band with printed rules and the amount.
function strapTexture() {
  const W = 256, H = 1024, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#c9a24a'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(60,40,10,0.75)';
  g.fillRect(14, 0, 5, H); g.fillRect(W - 19, 0, 5, H);
  g.fillRect(28, 0, 2, H); g.fillRect(W - 30, 0, 2, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 2);
  g.font = '800 92px "Figtree"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('10 000', 0, 0);
  g.restore();
  return texOf(c);
}

// The hole: straight along the back joint, broken along the sides and the front. Returns the outline (counter-
// clockwise in x-z) and the front break, sorted by x, so a coin can find where the slab's front edge is.
function holeOutline() {
  const R = rng(77), pts = [];
  const { xL, xR, zB, zF } = TRAP;
  const jag = () => (R() - 0.5) * 0.07 + (R() < 0.25 ? (R() - 0.5) * 0.1 : 0);
  for (let i = 0; i < 8; i++) pts.push([lerp(xL, xR, i / 8), zB]);                    // back joint, left to right
  for (let i = 0; i < 8; i++) pts.push([xR + (i < 2 ? 0 : jag() * 0.8), lerp(zB, zF, i / 8)]); // right break
  const front = [];
  for (let i = 0; i <= 14; i++) { const q = [lerp(xR, xL, i / 14), zF + jag()]; pts.push(q); front.push(q); } // front break
  for (let i = 7; i >= 1; i--) pts.push([xL + (i < 2 ? 0 : jag() * 0.8), lerp(zB, zF, i / 8)]);  // left break
  front.sort((p, q) => p[0] - q[0]);
  const frontZ = (x) => {
    if (x <= front[0][0]) return front[0][1];
    for (let i = 1; i < front.length; i++) {
      if (x <= front[i][0]) { const f = (x - front[i - 1][0]) / (front[i][0] - front[i - 1][0]); return lerp(front[i - 1][1], front[i][1], f); }
    }
    return front[front.length - 1][1];
  };
  return { pts, frontZ };
}

// Darken a material with depth below the floor (the shaft swallows the light).
function depthFade(mat, tag, reach = 1.1) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n varying float vWY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vWY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= pow(clamp(1.0 + vWY / ${reach.toFixed(2)}, 0.0, 1.0), 1.3);`);
  };
  mat.customProgramCacheKey = () => `bridge-depth-fade-${tag}`;
  return mat;
}

// The trapdoor's angle at time t (tOpen = the moment it breaks free): a small drop as it snaps loose, then a heavy
// swing down that slows as it meets the shaft wall, and a last knock.
function trapPose(t, tOpen) {
  const sag = 0.02 * easeOut(clamp((t - tOpen) / 0.06), 2);
  const u = clamp((t - tOpen - TRAP.t1) / TRAP.tt);
  let theta = TRAP.max * u * u * (3 - 2 * u);
  const dtheta = u > 0 && u < 1 ? (TRAP.max * 6 * u * (1 - u)) / TRAP.tt : 0;
  const a = t - (tOpen + TRAP.t1 + TRAP.tt);
  if (a > 0) theta += 0.035 * Math.exp(-a * 8) * Math.sin(a * 22);
  return { sag, theta, dtheta };
}

function sprite() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export async function bankStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050101);
  scene.fog = new THREE.FogExp2(0x0a0202, 0.012);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 3], size: [6, 1.2], color: [1, 0.95, 0.9], intensity: 3 },
    { pos: [-6, 0.5, 2], size: [0.8, 4], color: [1, 0.2, 0.12], intensity: 4 },
    { pos: [6, 0.5, 1], size: [0.8, 4], color: [1, 0.2, 0.12], intensity: 3 },
    { pos: [0, -1, 6], size: [8, 1], color: [0.9, 0.9, 1], intensity: 1.5 },
  ], { top: [0.08, 0.02, 0.02], horizon: [0.12, 0.03, 0.02], bottom: [0.01, 0.0, 0.0] });
  scene.environmentIntensity = 0.9;

  // Sky: black above, a low red glow on the horizon behind the bank.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uGlow: { value: new THREE.Color(0.55, 0.05, 0.02) }, uGain: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uGlow; uniform float uGain; varying vec3 vP;
      void main(){ float h = vP.y; float g = exp(-abs(h - 0.02) * 9.0) * smoothstep(-0.2, 0.02, h);
        gl_FragColor = vec4(uGlow * g * uGain, 1.0); }`,
  }));
  scene.add(sky);

  const bank = new THREE.Group();
  scene.add(bank);

  const stone = limestone();
  const crackTex = crackTexture();
  const U = {
    uCrackTex: { value: crackTex }, uCrack: { value: 0 }, uCrackNormal: { value: 3.0 },
    uCrackRect: { value: new THREE.Vector4(...BANK.crackRect) },
    uCrackTexel: { value: new THREE.Vector2(...crackTex.userData.texel) },
    uBankAxX: { value: new THREE.Vector3(1, 0, 0) }, uBankAxY: { value: new THREE.Vector3(0, 1, 0) },
    uBankInv: { value: new THREE.Matrix4() },
  };
  const stoneMat = crackify(new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.86, metalness: 0, color: 0xe2dbcf }), U);
  const plainStone = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.9, metalness: 0, color: 0xc9c1b4 });

  const add = (geo, mat, pos, parent = bank) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, pos, mat = stoneMat) => add(boxUV(new THREE.BoxGeometry(w, h, d), pos), mat, pos);
  // A box from [x0,x1] x [y0,y1] x [z0,z1], built around the shaft's opening when it passes through it.
  const boxAround = (x0, x1, y0, y1, z0, z1) => {
    const { x0: px0, x1: px1, z0: pz0, z1: pz1 } = PIT;
    const part = (a0, a1, c0, c1) => { if (a1 - a0 > 1e-4 && c1 - c0 > 1e-4) box(a1 - a0, y1 - y0, c1 - c0, [(a0 + a1) / 2, (y0 + y1) / 2, (c0 + c1) / 2]); };
    if (z1 <= pz0 || z0 >= pz1) return part(x0, x1, z0, z1);
    part(x0, px0, z0, z1); part(px1, x1, z0, z1);
    part(px0, px1, z0, pz0); part(px0, px1, pz1, z1);
  };

  // Steps and stylobate (with the shaft cut through them).
  const back = -5.2;
  for (let i = 0; i <= BANK.steps; i++) {
    const top = stepTop(i), front = stepFront(i);
    const hw = 9.3 + i * 0.35;
    const bottom = stepTop(i + 1);
    boxAround(-hw, hw, bottom, top, back, front);
  }
  // The plaza the bank stands on, at the foot of the steps (so no view ever sees under the stairs).
  {
    const g = new THREE.PlaneGeometry(600, 600);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.25, p.getZ(i) * 0.25);
    const plaza = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92, color: 0x6e665c }));
    plaza.position.y = stepTop(BANK.steps + 1);
    plaza.receiveShadow = true;
    bank.add(plaza);
  }
  // Columns.
  const colGeo = columnGeometry();
  const echGeo = echinusGeometry();
  const columns = [];
  for (const x of BANK.colX) {
    const c = add(colGeo, stoneMat, [x, 0, 0]);
    add(echGeo, stoneMat, [x, 0, 0]);
    box(1.78, 0.33, 1.78, [x, BANK.capTop - 0.165, 0]);
    columns.push(c);
  }
  // Entablature.
  const { halfW, archTop, friezeTop, corniceTop, capTop, apex, corniceHalfW } = BANK;
  box(halfW * 2, archTop - capTop, 5.6, [0, (capTop + archTop) / 2, -2.0]);
  // Frieze, with the bank's motto carved into its face (letters ride on a thin overlay so the stone keeps its scale).
  box(halfW * 2 - 0.1, friezeTop - archTop, 5.5, [0, (archTop + friezeTop) / 2, -2.05]);
  const fr = friezeTextures('TOO BIG TO FAIL');
  const letterMat = crackify(new THREE.MeshStandardMaterial({
    map: fr.letters, normalMap: fr.normal, normalScale: new THREE.Vector2(1.8, 1.8), transparent: true, roughness: 0.9, color: 0xffffff,
    polygonOffset: true, polygonOffsetFactor: -2,
  }), U);
  const letters = add(new THREE.PlaneGeometry(halfW * 2 - 0.3, friezeTop - archTop - 0.08), letterMat, [0, (archTop + friezeTop) / 2, 0.704]);
  letters.castShadow = false;
  // Cornice (two stacked slabs for a moulded edge).
  box(corniceHalfW * 2, 0.18, 6.4, [0, friezeTop + 0.09, -2.0]);
  box(corniceHalfW * 2 + 0.3, corniceTop - friezeTop - 0.18, 6.8, [0, (friezeTop + 0.18 + corniceTop) / 2, -2.0]);
  // Pediment: tympanum + raking cornices.
  const ph = apex - corniceTop;
  const tri = new THREE.Shape();
  tri.moveTo(-corniceHalfW + 0.3, 0); tri.lineTo(corniceHalfW - 0.3, 0); tri.lineTo(0, ph - 0.35); tri.lineTo(-corniceHalfW + 0.3, 0);
  const tym = new THREE.ExtrudeGeometry(tri, { depth: 5.4, bevelEnabled: false });
  tym.translate(0, 0, -5.4);
  boxUV(tym, [0, corniceTop, 0.7]);
  add(tym, stoneMat, [0, corniceTop, 0.7]);
  const rakeLen = Math.hypot(corniceHalfW + 0.15, ph);
  const rakeAng = Math.atan2(ph, corniceHalfW + 0.15);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(rakeLen + 0.2, 0.42, 6.9);
    const m = new THREE.Mesh(g, stoneMat);
    m.position.set(s * (corniceHalfW + 0.15) / 2, corniceTop + ph / 2 - 0.02, -2.0);
    m.rotation.z = -s * rakeAng;
    m.castShadow = m.receiveShadow = true;
    boxUV(g, [0, 0, 0]);
    bank.add(m);
  }
  // Roof slopes (dark lead) so the torrent has something to fall into.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.6, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(rakeLen, 0.2, 7.2);
    const m = new THREE.Mesh(g, roofMat);
    m.position.set(s * corniceHalfW / 2, corniceTop + ph / 2 + 0.05, -2.3);
    m.rotation.z = -s * rakeAng;
    bank.add(m);
  }
  // Cella wall with a tall doorway into the dark.
  const wallZ = -2.6;
  const doorW = 3.0, doorH = 5.6;
  box((halfW - 0.8) - doorW / 2, capTop, 0.8, [-(doorW / 2 + (halfW - 0.8 - doorW / 2) / 2), capTop / 2, wallZ - 0.4], plainStone);
  box((halfW - 0.8) - doorW / 2, capTop, 0.8, [(doorW / 2 + (halfW - 0.8 - doorW / 2) / 2), capTop / 2, wallZ - 0.4], plainStone);
  box(doorW, capTop - doorH, 0.8, [0, doorH + (capTop - doorH) / 2, wallZ - 0.4], plainStone);
  for (const sx of [-1, 1]) box(0.8, capTop, 2.6, [sx * 8.0, capTop / 2, -3.9], plainStone);
  const vaultMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const vault = add(new THREE.PlaneGeometry(doorW, doorH), vaultMat, [0, doorH / 2, wallZ - 1.2]);
  vault.castShadow = false;
  // bronze door leaves, standing open
  const doorMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.32, 0.2, 0.1), metalness: 1, roughness: 0.38 });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2, doorH, 0.12), doorMat);
    leaf.geometry.translate(-s * doorW / 4, 0, 0);
    leaf.position.set(s * doorW / 2, doorH / 2, wallZ - 0.1);
    leaf.rotation.y = s * 1.1;
    bank.add(leaf);
  }

  // Light: a cold floodlight from below, alarm red behind the columns, a red rim from behind.
  const flood = new THREE.SpotLight(0xe4eaff, 300, 70, 0.62, 0.55, 1.5);
  flood.position.set(0, -2.6, 14);
  flood.target.position.set(0, 7, 0);
  flood.castShadow = true;
  flood.shadow.mapSize.set(2048, 2048);
  flood.shadow.bias = -0.0003;
  scene.add(flood, flood.target);
  // Alarm red lives behind the columns: it floods the cella wall so the white columns stand against red.
  const redL = new THREE.PointLight(0xff2010, 14, 8.5, 1.4);
  redL.position.set(-4.4, 5.5, -1.3);
  const redR = new THREE.PointLight(0xff2010, 14, 8.5, 1.4);
  redR.position.set(4.4, 5.5, -1.3);
  scene.add(redL, redR);
  const rimRed = new THREE.DirectionalLight(0xff3018, 0.9);
  rimRed.position.set(0, 6, -10);
  scene.add(rimRed);
  const coinKey = new THREE.SpotLight(0xf6f2ea, 0, 20, 0.42, 0.6, 1.2);
  coinKey.position.set(-1.1, 3.4, 3.2);
  coinKey.target.position.set(0, -0.2, HEAP.z);
  coinKey.castShadow = true;
  coinKey.shadow.mapSize.set(1024, 1024);
  coinKey.shadow.bias = -0.0004;
  scene.add(coinKey, coinKey.target);
  const amb = new THREE.AmbientLight(0x1c1010, 0.5);
  scene.add(amb);

  // Dust shaken loose on every hit.
  const DUST_PER = 320;
  const HITS = [112.233, 112.867, 113.533, 114.033, 115.34, 116.133, 116.667];
  const ND = DUST_PER * HITS.length;
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.55, map: sprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  bank.add(dust);

  // The bailout: notes pouring from the sky into the bank.
  const noteTex = await bridgeNote();
  const torrent = new NoteCloud(noteTex, 60, { emissive: 0.05 });
  scene.add(torrent);
  // The bailout itself: a colossal strapped bundle of bank notes (they lie flat: printed top and bottom, stacked paper
  // edges all round), lowered out of the dark into the bank.
  const BR = { w: 8.6, h: 2.4, d: 4.1 };
  const edges = stackEdges();
  const faceTop = noteTex.clone(); faceTop.needsUpdate = true;
  const faceBot = noteTex.clone(); faceBot.needsUpdate = true; // (the box's underside already reads upright from below)
  const paperMat = (map, em = 0.05) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: new THREE.Color(1, 1, 1), emissiveMap: map, emissiveIntensity: em });
  const sideMat = paperMat(edges), topMat = paperMat(faceTop, 0.06), botMat = paperMat(faceBot, 0.06);
  const brick = new THREE.Group();
  const brickBody = new THREE.Mesh(new RoundedBoxGeometry(BR.w, BR.h, BR.d, 3, 0.09), [sideMat, sideMat, topMat, botMat, sideMat, sideMat]);
  brickBody.castShadow = true;
  brick.add(brickBody);
  // a few sheets that are not squared up with the rest stick out of the sides
  const looseMat = new THREE.MeshStandardMaterial({ color: 0xe6ebdd, roughness: 0.85, emissive: 0x1a1d18 });
  const Rb = rng(115);
  for (let i = 0; i < 7; i++) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(BR.w * 0.97, 0.014, BR.d * 0.97), looseMat);
    sh.position.set((Rb() - 0.5) * 0.3, (Rb() - 0.5) * (BR.h - 0.3), (Rb() - 0.5) * 0.3);
    sh.rotation.y = (Rb() - 0.5) * 0.05;
    brick.add(sh);
  }
  const strapMap = strapTexture();
  const strapMat = new THREE.MeshStandardMaterial({ map: strapMap, roughness: 0.6 });
  const strap = new THREE.Mesh(new THREE.BoxGeometry(1.35, BR.h + 0.05, BR.d + 0.05), strapMat);
  brick.add(strap);
  scene.add(brick);
  const bailFall = (t, tLand) => {
    // heavy and accelerating, lands on the word, then sinks slowly into the roof
    const t0 = tLand - 0.97;
    if (t < t0) return 40;
    if (t < tLand) { const u = (t - t0) / 0.97; return lerp(24, BANK.apex - 1.3, u * u * (0.35 + 0.65 * u)); }
    return BANK.apex - 1.3 - 1.0 * easeOut(clamp((t - tLand) / 0.9), 2); // the roof half-swallows it
  };

  // The savers' coins: a small heap on the stylobate at the bank's door, and the crack that swallows it.
  const heapFaces = [await coinFace('denarius', { size: 512 }), await coinFace('stater', { size: 512 })];
  const coinGeo = new THREE.CylinderGeometry(1, 1, 1, 48);
  // The coins reflect a neutral studio of their own, so silver reads as silver under the alarm-red scene.
  const coinEnv = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 2], color: [1, 1, 1], intensity: 3 },
    { pos: [-5, 2, 3], size: [1, 4], color: [1, 0.96, 0.9], intensity: 2.5 },
    { pos: [5, 1, -2], size: [1, 4], color: [0.92, 0.95, 1], intensity: 2 },
  ], { top: [0.4, 0.4, 0.4], horizon: [0.14, 0.13, 0.12], bottom: [0.02, 0.02, 0.02] });
  const mkCoins = (metal, face, count) => {
    const m = METALS[metal];
    const col = new THREE.Color().setRGB(...m.color);
    const faceMat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: m.roughness + 0.2, map: face.color, normalMap: face.normal, normalScale: new THREE.Vector2(1.2, 1.2), envMap: coinEnv, envMapIntensity: 0.6 });
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: m.roughness + 0.25, envMap: coinEnv, envMapIntensity: 0.6 });
    const im = new THREE.InstancedMesh(coinGeo, [edgeMat, faceMat, faceMat], count);
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    bank.add(im);
    return im;
  };
  // Two short stacks of savings and a loose pile around them, lying on the slab that will give way. Positions are in
  // the slab's frame: x across, z forward from the hinge joint, y up from the slab's underside.
  const COIN_T = 0.028;
  const Rh = rng(1160);
  const heap = [];
  const stacks = [[-0.36, 0.62, 6], [0.33, 0.98, 5]];
  stacks.forEach(([sx, sz, n], si) => {
    for (let k = 0; k < n; k++) {
      heap.push({ x: sx + (Rh() - 0.5) * 0.02, z: sz + (Rh() - 0.5) * 0.02, lift: k * COIN_T, stack: si, k, rad: 0.165,
        tx: (Rh() - 0.5) * 0.03, tz: (Rh() - 0.5) * 0.03, spin: Rh() * 6.28, silver: si === 0 ? k % 3 !== 2 : k % 2 === 0, j: Rh(), j3: 0.5 });
    }
  });
  [17, 10, 5].forEach((n, L) => {
    const RX = 0.66 * (1 - 0.3 * L), RZ = 0.34 * (1 - 0.3 * L);
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, rr = Math.sqrt(u) * (0.88 + 0.12 * Rh()), ang = k * 2.39996 + L * 0.9 + Rh() * 0.3;
      const x = Math.cos(ang) * rr * RX, z = 0.78 + Math.sin(ang) * rr * RZ;
      const spin = Rh() * 6.28, tx = (Rh() - 0.5) * (0.1 + 0.12 * L), tz = (Rh() - 0.5) * (0.1 + 0.12 * L);
      const rad = 0.15 + Rh() * 0.05, silver = Rh() < 0.6, j = Rh(), j3 = Rh(), lift = L * 0.03 + Rh() * 0.006;
      if (stacks.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.27)) continue;
      heap.push({ x, z, lift, stack: -1, k: 0, rad, tx, tz, spin, silver, j, j3, L });
    }
  });
  // Each coin: its rest pose on the slab, when it breaks loose (the slab angle its friction gives way at: the loose top
  // coins first, the stacks a moment later) and how hard it slides.
  const unSmooth = (v) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < v) lo = m; else hi = m; } return (lo + hi) / 2; };
  for (const c of heap) {
    c.y = TRAP.th + COIN_T / 2 + c.lift;
    c.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.tx, c.spin, c.tz));
    const thetaS = c.stack >= 0 ? 0.44 + 0.05 * c.stack : 0.36 + 0.12 * c.j - 0.04 * (c.L || 0);
    c.us = unSmooth(thetaS / TRAP.max);
    c.A = c.stack >= 0 ? 6.0 + 0.4 * c.stack : 5.7 + 1.4 * c.j;
    c.axis = new THREE.Vector3(1, 0.3, c.j - 0.5).normalize();
  }
  const nSilver = heap.filter((c) => c.silver).length;
  const silverCoins = mkCoins('silver', heapFaces[0], nSilver);
  const bronzeCoins = mkCoins('bronze', heapFaces[1], heap.length - nSilver);
  for (const im of [silverCoins, bronzeCoins]) for (let i = 0; i < im.count; i++) im.setColorAt(i, new THREE.Color(1, 1, 1));
  // The paving slab around the heap (the close-up's floor) with the jagged hole cut out of it.
  const pave = paving();
  const paveMat = new THREE.MeshStandardMaterial({ map: pave.map, normalMap: pave.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92, metalness: 0, color: 0xe9e2d6 });
  const hole = holeOutline();
  const outline = hole.pts;
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-2.7, -0.75); floorShape.lineTo(2.7, -0.75); floorShape.lineTo(2.7, BANK.styFront); floorShape.lineTo(-2.7, BANK.styFront); floorShape.lineTo(-2.7, -0.75);
  const holePath = new THREE.Path();
  outline.slice().reverse().forEach(([x, z], i) => (i ? holePath.lineTo(x, z) : holePath.moveTo(x, z)));
  floorShape.holes.push(holePath);
  const floorGeo = new THREE.ShapeGeometry(floorShape, 1);
  // shape is in (x, z); lay it flat at y = 0 and give it world-scaled UVs (one tile per 2.2 units)
  {
    const p = floorGeo.attributes.position, uv = floorGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getY(i);
      p.setXYZ(i, x, 0.0015, z);
      uv.setXY(i, x / 2.2, -z / 2.2);
    }
    const ix = floorGeo.index.array;
    for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
    const n = floorGeo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  }
  const paveFloor = new THREE.Mesh(floorGeo, paveMat);
  paveFloor.receiveShadow = true;
  paveFloor.castShadow = true; // its broken edge shades the slab as it drops away
  bank.add(paveFloor);
  // The shaft's walls follow the jagged rim down into the dark (vertex colours fade them to black with depth).
  const wallGeo = (() => {
    const pos = [], col = [], uv = [], idx = [];
    const rows = [0, -0.08, -0.25, -0.5, -0.9, -1.5, -2.4, -PIT.depth];
    const N = outline.length;
    let per = 0;
    for (let i = 0; i <= N; i++) {
      const [x, z] = outline[i % N];
      if (i > 0) { const [px, pz] = outline[i - 1]; per += Math.hypot(x - px, z - pz); }
      rows.forEach((y, r) => {
        // the rim breaks back a little under the surface: the shaft is wider than the hole
        const flare = 1 + Math.min(1, -y / 0.5) * 0.06;
        pos.push(x * flare, y, HEAP.z + (z - HEAP.z) * flare);
        const k = Math.pow(Math.max(0, 1 + y / 0.8), 1.6);
        col.push(k, k * 0.96, k * 0.92);
        uv.push(per / 2.2, y / 2.2);
      });
    }
    const R = rows.length;
    for (let i = 0; i < N; i++) for (let r = 0; r < R - 1; r++) {
      const a = i * R + r, b = (i + 1) * R + r;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const pitWalls = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(2, 2), roughness: 0.95, vertexColors: true, side: THREE.DoubleSide, color: 0x9c9384 }));
  pitWalls.receiveShadow = true;
  bank.add(pitWalls);
  // The trapdoor slab (same paving, same world-scaled texture, so until it moves it is just the floor).
  const trapShape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? trapShape.lineTo(x, z) : trapShape.moveTo(x, z)));
  const trapGeo = new THREE.ExtrudeGeometry(trapShape, { depth: TRAP.th, bevelEnabled: false });
  {
    const pa = trapGeo.attributes.position, uv = trapGeo.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getY(i), d = pa.getZ(i);
      pa.setXYZ(i, x, TRAP.th - d, z - TRAP.zB);
    }
    trapGeo.computeVertexNormals();
    const nn = trapGeo.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i) + TRAP.zB;
      if (Math.abs(nn.getY(i)) > 0.5) uv.setXY(i, x / 2.2, -z / 2.2);          // top and underside: the floor's paving
      else if (Math.abs(nn.getX(i)) > Math.abs(nn.getZ(i))) uv.setXY(i, z / 2.2, y / 2.2); // broken sides
      else uv.setXY(i, x / 2.2, y / 2.2);
    }
  }
  const trapMesh = new THREE.Mesh(trapGeo, depthFade(paveMat.clone(), 'trap', 0.7));
  const trapBase = trapMesh.material.color.clone();
  trapMesh.castShadow = true; trapMesh.receiveShadow = true;
  const trap = new THREE.Group();
  trap.add(trapMesh);
  bank.add(trap);
  const TRAP_Y = 0.0015 - TRAP.th; // the hinge (bottom-back edge) when the slab lies flush
  // The shaft's floor, far down in the black (so nothing below ever shows through).
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1 - PIT.x0 + 0.3, PIT.z1 - PIT.z0 + 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(0, -1.9, (PIT.z0 + PIT.z1) / 2);
  bank.add(cap);

  const dcol = new THREE.Color();
  const dm = new THREE.Object3D();
  const coinM = new THREE.Matrix4(), trapM = new THREE.Matrix4();
  const vL = new THREE.Vector3(), vP = new THREE.Vector3(), vV = new THREE.Vector3(), vS = new THREE.Vector3();
  const qT = new THREE.Quaternion(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();
  const vScale = new THREE.Vector3(), AXX = new THREE.Vector3(1, 0, 0), AXY = new THREE.Vector3(0, 1, 0), fcol = new THREE.Color();
  const S = {
    scene, bank, columns, flood, redL, redR, rimRed, coinKey, vaultMat, amb, sky, dust, torrent, brick, trap, silverCoins, bronzeCoins, paveFloor, pitWalls, U,
    fx: { bloom: 0.45, threshold: 1.1, bloomRadius: 0.35, grain: 0.055, vignette: 0.55, tint: [1.04, 0.97, 0.95], contrast: 1.08 },
    HITS,
    // Crack growth: each hit of the line snaps the cracks further.
    crackAt(t) {
      const steps = [[112.233, 0.3], [112.867, 0.47], [113.533, 0.72], [114.033, 1.0]];
      let k = 0;
      for (const [th, v] of steps) if (t >= th) k = lerp(k, v, easeOut(clamp((t - th) / 0.14), 2));
      return k;
    },
    // Shudder: a damped jolt from every hit, strongest on "shook".
    shakeAt(t) {
      const amp = [0.55, 0.5, 0.75, 1.0, 0.45, 0.4, 0.45];
      let x = 0, r = 0;
      HITS.forEach((th, i) => {
        const a = t - th;
        if (a < 0 || a > 1.2) return;
        const e = Math.exp(-a * 6) * amp[i];
        x += Math.sin(a * 42 + i) * e * 0.07;
        r += Math.sin(a * 37 + i * 2) * e * 0.0045;
      });
      return { x, r };
    },
    // The bailout: the brick comes down out of the dark and lands in the roof on tLand; a few loose notes peel off
    // its top edge and flutter down after it.
    pour(t, tLand) {
      const yb = bailFall(t, tLand);
      brick.visible = yb < 30;
      brick.position.set(0, yb + BR.h / 2, 0.4 - BR.d / 2);
      const settle = t > tLand ? Math.exp(-(t - tLand) * 7) * Math.sin((t - tLand) * 26) * 0.012 : 0;
      brick.rotation.set(0.02, -0.04, settle);
      torrent.visible = t > tLand - 0.6;
      torrent.setTime(t);
      torrent.setFlutter(1);
      const nLoose = 36;
      torrent.layout(nLoose, (i, d) => {
        const h1 = hash1(i * 5 + 1), h2 = hash1(i * 5 + 2), h3 = hash1(i * 5 + 3), h4 = hash1(i * 5 + 4);
        const rel = t - (tLand - 0.55 + h1 * 0.5);
        if (rel < 0) return false;
        // released from the brick's top edge, they lag above it and drift down slowly
        const x0 = (h2 - 0.5) * BR.w * 0.95, z0 = 0.25 - BR.d * h3;
        const yRel = Math.min(24, bailFall(tLand - 0.55 + h1 * 0.5, tLand)) + BR.h + 0.2;
        const y = yRel - rel * (1.2 + h4 * 0.8);
        if (y < BANK.apex - 0.5) return false;
        d.position.set(x0 + Math.sin(rel * (1.2 + h4) + h2 * 6) * 0.6, y, z0 + Math.cos(rel * (1 + h3)) * 0.4);
        d.rotation.set(rel * (h3 - 0.5) * 2 + h4 * 6, rel * (h1 - 0.5) * 1.5, h2 * 6);
        d.scale.setScalar(0.5);
      });
    },
    // The floor gives way: at tOpen the slab snaps loose and swings down into the shaft. The coins tip with it; as it
    // steepens each one breaks loose, slides down the slab with weight and goes over its front edge into the dark.
    heapAt(t, tOpen) {
      const k = trapPose(t, tOpen);
      trap.position.set(0, TRAP_Y - k.sag, TRAP.zB);
      trap.rotation.set(k.theta, 0, 0);
      trap.updateMatrix();
      // as it swings down it turns away into the shaft's shadow, so the open hole reads dark
      trapMesh.material.color.copy(trapBase).multiplyScalar(1 - 0.6 * clamp(k.theta / TRAP.max));
      let si = 0, bi = 0;
      for (const c of heap) {
        const ts = tOpen + TRAP.t1 + TRAP.tt * c.us;
        const a = Math.max(0, t - ts);
        const Ae = c.A * (c.stack >= 0 ? 1 + 0.06 * c.k : 1);    // a stack shears: its top coins run ahead
        const s = 0.5 * Ae * a * a;
        const edge = hole.frontZ(c.x) - TRAP.zB;
        const dEdge = edge - c.z;
        const lat = (c.j3 - 0.5) * 0.15;
        let ySink = 0;
        if (s < dEdge) {
          // on the slab: riding it, then sliding down it
          vL.set(c.x + lat * s, c.y, c.z + s);
          vP.copy(vL).applyMatrix4(trap.matrix);
          qB.setFromAxisAngle(AXY, s * (c.j - 0.5) * 1.2);
          qT.copy(trap.quaternion).multiply(c.q).multiply(qB);
        } else {
          // over the edge: leaves with the slab's motion plus its own slide, then falls into the shaft, tumbling
          const te = ts + Math.sqrt((2 * dEdge) / Ae);
          const ke = trapPose(te, tOpen);
          const ve = Ae * (te - ts);
          const sn = Math.sin(ke.theta), cs = Math.cos(ke.theta);
          vL.set(c.x + lat * dEdge, c.y, edge);
          qA.setFromAxisAngle(AXX, ke.theta);
          trapM.compose(vS.set(0, TRAP_Y - ke.sag, TRAP.zB), qA, vScale.set(1, 1, 1));
          vP.copy(vL).applyMatrix4(trapM);
          vV.set(lat * ve, -sn * ve, cs * ve);                                               // the slide
          vV.y += ke.dtheta * (-vL.y * sn - vL.z * cs); vV.z += ke.dtheta * (vL.y * cs - vL.z * sn); // the swing
          const dt = t - te;
          vP.addScaledVector(vV, dt);
          vP.y -= 4.9 * dt * dt;
          qB.setFromAxisAngle(AXY, dEdge * (c.j - 0.5) * 1.2);
          qC.setFromAxisAngle(c.axis, (3 + 4 * c.j) * dt);
          qT.copy(qA).multiply(c.q).multiply(qB).multiply(qC);
          if (vP.y < -1.7) ySink = 1;
        }
        vScale.set(ySink ? 1e-4 : c.rad, COIN_T, ySink ? 1e-4 : c.rad);
        coinM.compose(vP, qT, vScale);
        const f = Math.pow(clamp(1 + vP.y / 1.4), 1.3);
        fcol.setRGB(f, f, f);
        if (c.silver) { silverCoins.setMatrixAt(si, coinM); silverCoins.setColorAt(si++, fcol); }
        else { bronzeCoins.setMatrixAt(bi, coinM); bronzeCoins.setColorAt(bi++, fcol); }
      }
      for (const im of [silverCoins, bronzeCoins]) {
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
        im.visible = true;
      }
    },
    update(ctx) {
      const t = ctx.t;
      const sh = this.shakeAt(t);
      bank.position.set(sh.x, 0, 0);
      bank.rotation.set(0, 0, sh.r);
      bank.updateMatrixWorld(true);
      U.uBankInv.value.copy(bank.matrixWorld).invert();
      U.uBankAxX.value.set(1, 0, 0).transformDirection(bank.matrixWorld);
      U.uBankAxY.value.set(0, 1, 0).transformDirection(bank.matrixWorld);
      U.uCrack.value = this.crackAt(t);
      // Alarm: red lights pulse on the beat.
      const k = ctx.T.kick(t, 5);
      redL.intensity = redR.intensity = 10 + 22 * k;
      rimRed.intensity = 0.9;
      flood.intensity = 300;
      coinKey.intensity = 0;
      scene.environmentIntensity = 0.9;
      vaultMat.color.setRGB(0, 0, 0);
      sky.material.uniforms.uGain.value = 1;
      scene.fog.density = 0.012;
      torrent.visible = false;
      brick.visible = false;
      silverCoins.visible = bronzeCoins.visible = false;
      trap.position.set(0, TRAP_Y, TRAP.zB);
      trap.rotation.set(0, 0, 0);
      trapMesh.material.color.copy(trapBase);
      // Dust: each hit shakes a veil of dust from the cornice and the cracks.
      const pa = dust.geometry.attributes.position.array, ca = dust.geometry.attributes.color.array;
      for (let h = 0; h < HITS.length; h++) {
        const a = t - HITS[h];
        for (let j = 0; j < DUST_PER; j++) {
          const i = h * DUST_PER + j;
          const r1 = hash1(i * 4 + 1), r2 = hash1(i * 4 + 2), r3 = hash1(i * 4 + 3), r4 = hash1(i * 4 + 4);
          if (a < 0 || a > 2.4) { pa[i * 3 + 1] = -999; ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0; continue; }
          const ex = (r1 - 0.5) * corniceHalfW * 2;
          const ey = r2 < 0.6 ? corniceTop - 0.1 : archTop - 0.1 + r3 * 0.6;
          const drift = a * (0.3 + r4 * 0.5);
          pa[i * 3] = ex + (r3 - 0.5) * drift;
          pa[i * 3 + 1] = ey - (1.2 + 2.2 * r4) * a - 1.2 * a * a;
          pa[i * 3 + 2] = 1.3 + r2 * 0.4 + drift * 0.8;
          const f = Math.min(1, a * 8) * Math.max(0, 1 - a / 2.4) * 0.11;
          dcol.setRGB(1, 0.86, 0.78).multiplyScalar(f);
          ca[i * 3] = dcol.r; ca[i * 3 + 1] = dcol.g; ca[i * 3 + 2] = dcol.b;
        }
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.geometry.attributes.color.needsUpdate = true;
    },
  };
  return S;
}
