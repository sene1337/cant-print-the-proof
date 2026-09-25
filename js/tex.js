// Textures drawn with the 2D canvas: coin faces, bank notes, the newspaper, block faces.
import * as THREE from 'three';
import { rng } from './util.js';

const images = new Map();
export function loadImage(url) {
  if (!images.has(url)) {
    images.set(url, new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('image failed: ' + url));
      im.src = url;
    }));
  }
  return images.get(url);
}

export async function preload(base) {
  const names = ['stater_height.png', 'stater_cavity.png', 'stater_photo.jpg', 'eagle_height.png', 'eagle_cavity.png',
    'denarius_height.png', 'denarius_cavity.png', 'denarius_photo.jpg', 'eagle_photo.jpg', 'moon.jpg', 'mingnote.jpg', 'stone.jpg'];
  await Promise.all(names.map((n) => loadImage(`${base}tex/${n}`)));
  const fonts = ['300 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '700 40px "Cormorant Garamond"',
    '500 40px "JetBrains Mono"', '700 40px "JetBrains Mono"', '900 40px "Playfair Display"', '700 40px "Playfair Display"',
    '400 40px "Figtree"', '500 40px "Figtree"', '600 40px "Figtree"', '800 40px "Figtree"', '400 40px "JetBrains Mono"'];
  await Promise.all(fonts.map((f) => document.fonts.load(f)));
  TEX.base = base;
}
export const TEX = { base: './' };
const img = (n) => images.get(`${TEX.base}tex/${n}`);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}


// Turns a height canvas (white = high) into a tangent-space normal map.
export function normalFromHeight(src, strength = 2.0, blur = 2) {
  const w = src.width, h = src.height;
  const b = canvas(w, h), bg = b.getContext('2d');
  bg.filter = `blur(${blur}px)`;
  bg.drawImage(src, 0, 0);
  const d = bg.getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = d[i * 4] / 255;
  const out = canvas(w, h), og = out.getContext('2d');
  const od = og.createImageData(w, h);
  const at = (x, y) => H[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      od.data[i] = (nx / l * 0.5 + 0.5) * 255;
      od.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      od.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      od.data[i + 3] = 255;
    }
  }
  og.putImageData(od, 0, 0);
  return tex(out, { srgb: false });
}

// Coin face: the museum photo as surface colour inside a raised rim, plus a soft relief normal map.
export async function coinFace(name, { rim = 0.075, dots = true, blank = false, size = 1024, strength = 1.6, photo = true } = {}) {
  const hIm = await img(`${name}_height.png`);
  const pIm = photo ? await img(`${name}_photo.jpg`).catch(() => null) : null;
  const R = size / 2;
  const s = 1 - rim * 0.6;
  // height
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, size, size);
  if (!blank) {
    g.save(); g.beginPath(); g.arc(R, R, R * (1 - rim), 0, Math.PI * 2); g.clip();
    g.filter = 'blur(7px)';
    g.drawImage(hIm, R - R * s, R - R * s, size * s, size * s);
    g.restore();
  }
  g.filter = 'none';
  g.lineWidth = R * rim * 1.1; g.strokeStyle = '#f2f2f2';
  g.beginPath(); g.arc(R, R, R * (1 - rim * 0.45), 0, Math.PI * 2); g.stroke();
  if (dots) {
    g.fillStyle = '#d8d8d8';
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      g.beginPath(); g.arc(R + Math.cos(a) * R * (1 - rim * 1.35), R + Math.sin(a) * R * (1 - rim * 1.35), R * 0.011, 0, Math.PI * 2); g.fill();
    }
  }
  // colour: neutral gold-white so the metal colour comes from the material; the photo's light and shade carry the design
  const a = canvas(size, size), ag = a.getContext('2d');
  ag.fillStyle = '#e9e4da'; ag.fillRect(0, 0, size, size);
  if (!blank && pIm) {
    ag.save(); ag.beginPath(); ag.arc(R, R, R * (1 - rim), 0, Math.PI * 2); ag.clip();
    ag.filter = 'grayscale(1) contrast(1.25) brightness(1.08)';
    ag.drawImage(pIm, R - R * s, R - R * s, size * s, size * s);
    ag.restore();
  }
  ag.filter = 'none';
  // rim reads bright
  ag.lineWidth = R * rim * 1.1; ag.strokeStyle = '#f4efe6';
  ag.beginPath(); ag.arc(R, R, R * (1 - rim * 0.45), 0, Math.PI * 2); ag.stroke();
  return { normal: normalFromHeight(c, strength, 2.5), color: tex(a) };
}

// A face drawn from vector art (used for the Bitcoin coin): white = raised.
export function symbolFace(draw, { size = 1024, rim = 0.075 } = {}) {
  const c = canvas(size, size), g = c.getContext('2d');
  const R = size / 2;
  g.fillStyle = '#5c5c5c'; g.fillRect(0, 0, size, size);
  g.lineWidth = R * rim * 1.1; g.strokeStyle = '#f2f2f2';
  g.beginPath(); g.arc(R, R, R * (1 - rim * 0.45), 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(R, R); draw(g, R); g.restore();
  // soften edges so the bump reads as a bevel
  return { normal: normalFromHeight(c, 3.0, 3), cavity: null };
}

export function bitcoinGlyph(g, R, color = '#fff') {
  g.fillStyle = color;
  g.font = `700 ${Math.round(R * 1.25)}px "Figtree"`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.rotate(-14 * Math.PI / 180);
  g.fillText('B', 0, R * 0.05);
  const w = R * 0.07, h = R * 0.2;
  for (const x of [-R * 0.1, R * 0.08]) {
    g.fillRect(x - w / 2, -R * 0.52 - h / 2, w, h);
    g.fillRect(x - w / 2, R * 0.55 - h / 2, w, h);
  }
  g.restore();
}

// Rim lettering band, tiled around a coin edge: engraved letters (dark, recessed) on bright metal.
export function edgeText(text, { w = 4096, h = 128 } = {}) {
  const hc = canvas(w, h), g = hc.getContext('2d');
  const col = canvas(w, h), cg = col.getContext('2d');
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
  cg.fillStyle = '#efe9df'; cg.fillRect(0, 0, w, h);
  const font = `700 ${Math.round(h * 0.6)}px "Cormorant Garamond"`;
  g.font = cg.font = font;
  g.textBaseline = cg.textBaseline = 'middle';
  const unit = text + '  \u2022  ';
  const uw = g.measureText(unit).width;
  const n = Math.max(1, Math.round(w / uw));
  const sx = w / (uw * n);
  for (const [ctx, fill] of [[g, '#303030'], [cg, '#5a4a36']]) {
    ctx.save(); ctx.scale(sx, 1); ctx.fillStyle = fill;
    for (let i = 0; i < n; i++) ctx.fillText(unit, i * uw, h * 0.54);
    ctx.restore();
  }
  // milled borders top and bottom
  for (const ctx of [g, cg]) {
    ctx.fillStyle = ctx === g ? '#f0f0f0' : '#f6f0e6';
    ctx.fillRect(0, 0, w, h * 0.08); ctx.fillRect(0, h * 0.92, w, h * 0.08);
  }
  const nrm = normalFromHeight(hc, 2.0, 1.0);
  nrm.wrapS = THREE.RepeatWrapping;
  const c = tex(col);
  c.wrapS = THREE.RepeatWrapping;
  return { normal: nrm, color: c };
}

// Engraved portrait: horizontal lines whose weight follows the photo's darkness.
function engrave(g, im, x, y, w, h, ink, step = 3.2) {
  const t = canvas(Math.round(w), Math.round(h)), k = t.getContext('2d');
  k.drawImage(im, 0, 0, w, h);
  const d = k.getImageData(0, 0, t.width, t.height).data;
  g.save();
  g.strokeStyle = ink;
  for (let yy = 0; yy < h; yy += step) {
    g.beginPath();
    for (let xx = 0; xx < w; xx += 1.5) {
      const i = (Math.floor(yy) * t.width + Math.floor(xx)) * 4;
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const wgt = Math.max(0, 1 - lum) * step * 0.95;
      if (wgt > 0.15) {
        g.moveTo(x + xx, y + yy + Math.sin(xx * 0.05) * 0.6);
        g.lineTo(x + xx + 1.5, y + yy + Math.sin((xx + 1.5) * 0.05) * 0.6);
      }
    }
    g.lineWidth = step * 0.55;
    g.stroke();
  }
  g.restore();
}

function guilloche(g, cx, cy, r0, r1, n, color, lw = 0.7, petals = 18) {
  g.save(); g.strokeStyle = color; g.lineWidth = lw;
  for (let k = 0; k < n; k++) {
    g.beginPath();
    const ph = (k / n) * Math.PI * 2;
    for (let i = 0; i <= 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      const r = r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(a * petals + ph));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// A fictional paper note. The portrait is the same king from the gold coin: money changing form.
export async function banknote({ w = 1024, h = 436, seed = 1, denom = '100', serial = 'A 0000320F B' } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  const R = rng(seed);
  const paper = g.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, '#dfe4d2'); paper.addColorStop(0.5, '#e9ecdf'); paper.addColorStop(1, '#d4dac6');
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(90,110,80,${R() * 0.08})`;
    g.fillRect(R() * w, R() * h, R() * 2 + 0.5, R() * 0.8 + 0.3);
  }
  const ink = '#1f3a2c', inkSoft = 'rgba(31,58,44,0.55)';
  g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
  g.lineWidth = 1; g.strokeRect(24, 24, w - 48, h - 48);
  // border wave
  g.save(); g.strokeStyle = inkSoft; g.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    for (let x = 30; x <= w - 30; x += 2) g.lineTo(x, 36 + Math.sin(x * 0.08 + k) * 5 + k);
    g.stroke();
    g.beginPath();
    for (let x = 30; x <= w - 30; x += 2) g.lineTo(x, h - 36 + Math.sin(x * 0.08 + k) * 5 - k);
    g.stroke();
  }
  g.restore();
  guilloche(g, 150, h / 2, 60, 92, 14, 'rgba(31,58,44,0.35)', 0.7, 21);
  guilloche(g, w - 150, h / 2, 60, 92, 14, 'rgba(31,58,44,0.35)', 0.7, 17);
  // portrait oval
  const ox = w / 2, oy = h / 2 + 4, orx = 118, ory = 142;
  g.save();
  g.beginPath(); g.ellipse(ox, oy, orx, ory, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#e6e9dc'; g.fillRect(ox - orx, oy - ory, orx * 2, ory * 2);
  const photo = await img('stater_photo.jpg');
  engrave(g, photo, ox - orx * 1.1, oy - ory * 1.02, orx * 2.2, ory * 2.1, ink, 3.1);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = ink; g.beginPath(); g.ellipse(ox, oy, orx + 5, ory + 5, 0, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1; g.beginPath(); g.ellipse(ox, oy, orx + 12, ory + 12, 0, 0, Math.PI * 2); g.stroke();
  // lettering
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 30px "Cormorant Garamond"';
  g.fillText('FIAT  RESERVE  NOTE', w / 2, 58);
  g.font = '600 17px "Cormorant Garamond"';
  g.fillText('IN  PRINT  WE  TRUST', w / 2, h - 58);
  g.font = '900 64px "Playfair Display"';
  g.fillText(denom, 110, 88); g.fillText(denom, w - 110, h - 88);
  g.font = '900 44px "Playfair Display"';
  g.fillText(denom, w - 105, 80); g.fillText(denom, 105, h - 80);
  g.font = '700 20px "Cormorant Garamond"';
  g.fillText('LEGAL TENDER', 150, h / 2 - 8); g.fillText('BY DECREE', 150, h / 2 + 16);
  g.fillText('ONE HUNDRED', w - 150, h / 2 - 8); g.fillText('UNITS', w - 150, h / 2 + 16);
  g.font = '500 18px "JetBrains Mono"';
  g.fillStyle = '#7a2a1c';
  g.fillText(serial, 240, 104); g.fillText(serial, w - 240, h - 104);
  // seal
  g.save(); g.translate(w - 270, h / 2 + 70);
  g.strokeStyle = 'rgba(40,70,52,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 48; i++) { g.rotate(Math.PI / 24); g.beginPath(); g.moveTo(18, 0); g.lineTo(34, 0); g.stroke(); }
  g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.stroke();
  g.restore();
  return tex(c);
}

// The genesis headline as a newspaper front page (generic masthead; the words are from the genesis block).
export function newspaper({ w = 1400, h = 1000 } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  const R = rng(9);
  g.fillStyle = '#ece6d6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(60,50,30,${R() * 0.05})`; g.fillRect(R() * w, R() * h, 2, 1); }
  const ink = '#1a1712';
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '700 30px "Cormorant Garamond"';
  g.fillText('SATURDAY  ·  03 / JAN / 2009', w / 2, 70);
  g.fillRect(60, 92, w - 120, 3); g.fillRect(60, 100, w - 120, 1);
  g.font = '900 118px "Playfair Display"';
  g.fillText('Chancellor on brink', w / 2, 250);
  g.fillText('of second bailout', w / 2, 380);
  g.fillText('for banks', w / 2, 510);
  g.fillRect(60, 560, w - 120, 1);
  // greeked columns
  const cols = 4, cw = (w - 160) / cols;
  for (let k = 0; k < cols; k++) {
    for (let y = 600; y < h - 50; y += 17) {
      const len = cw - 30 - (R() < 0.12 ? R() * cw * 0.5 : 0);
      g.fillStyle = 'rgba(26,23,18,0.55)';
      g.fillRect(80 + k * cw, y, len, 6);
    }
  }
  return tex(c);
}

function hexLines(hash, per = 16) {
  const out = [];
  for (let i = 0; i < hash.length; i += per) out.push(hash.slice(i, i + per));
  return out;
}

// One face of a proof block: height, hash (leading zeros in orange), nonce.
export function blockFace({ hash, height, nonce, w = 512, label = 'BLOCK' } = {}) {
  const c = canvas(w, w), g = c.getContext('2d');
  g.fillStyle = '#060504'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#f7931a'; g.lineWidth = w * 0.012; g.strokeRect(w * 0.05, w * 0.05, w * 0.9, w * 0.9);
  g.fillStyle = '#f7931a';
  g.font = `700 ${Math.round(w * 0.05)}px "Figtree"`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(label, w * 0.1, w * 0.17);
  g.font = `800 ${Math.round(w * 0.2)}px "Figtree"`;
  g.fillText(height, w * 0.095, w * 0.38);
  g.font = `500 ${Math.round(w * 0.052)}px "JetBrains Mono"`;
  const lines = hexLines(hash);
  let zeros = hash.match(/^0*/)[0].length;
  lines.forEach((ln, i) => {
    let x = w * 0.1;
    const y = w * 0.52 + i * w * 0.075;
    for (const ch of ln) {
      const z = zeros > 0;
      g.fillStyle = z ? '#ffb347' : 'rgba(255,240,220,0.62)';
      g.fillText(ch, x, y);
      x += w * 0.05;
      if (z) zeros--;
    }
  });
  if (nonce != null) {
    g.fillStyle = 'rgba(255,240,220,0.5)';
    g.font = `500 ${Math.round(w * 0.042)}px "JetBrains Mono"`;
    g.fillText(`NONCE ${Number(nonce).toLocaleString('en-US')}`, w * 0.1, w * 0.88);
  }
  return tex(c);
}

// The same face as physical maps for an engraved block: dark bronze, letters cut in and lit from inside the grooves.
// Returns { color, normal, emissive } (cached per block).
const ENGRAVED = new Map();
function drawFaceLayout(g, w, { hash, height, nonce, label }, ink) {
  g.strokeStyle = ink.frame; g.lineWidth = w * 0.014; g.strokeRect(w * 0.06, w * 0.06, w * 0.88, w * 0.88);
  g.fillStyle = ink.label;
  g.font = `700 ${Math.round(w * 0.055)}px "Figtree"`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(label, w * 0.11, w * 0.18);
  g.fillStyle = ink.number;
  g.font = `800 ${Math.round(w * 0.19)}px "Figtree"`;
  g.fillText(height, w * 0.1, w * 0.385);
  g.font = `700 ${Math.round(w * 0.056)}px "JetBrains Mono"`;
  let zeros = hash.match(/^0*/)[0].length;
  hexLines(hash).forEach((ln, i) => {
    let x = w * 0.11;
    const y = w * 0.53 + i * w * 0.078;
    for (const ch of ln) {
      g.fillStyle = zeros > 0 ? ink.zero : ink.hex;
      g.fillText(ch, x, y);
      x += w * 0.049;
      if (zeros > 0) zeros--;
    }
  });
  if (nonce != null) {
    g.fillStyle = ink.hex;
    g.font = `700 ${Math.round(w * 0.042)}px "JetBrains Mono"`;
    g.fillText(`NONCE ${Number(nonce).toLocaleString('en-US')}`, w * 0.11, w * 0.885);
  }
}
export function blockFaceEngraved({ hash, height, nonce, w = 1024, label = 'BLOCK' } = {}) {
  const key = `${hash}|${height}|${label}|${w}`;
  if (ENGRAVED.has(key)) return ENGRAVED.get(key);
  const info = { hash, height, nonce, label };
  // height: grooves are dark (low)
  const h = canvas(w, w), hg = h.getContext('2d');
  hg.fillStyle = '#c8c8c8'; hg.fillRect(0, 0, w, w);
  drawFaceLayout(hg, w, info, { frame: '#3a3a3a', label: '#3a3a3a', number: '#3a3a3a', zero: '#3a3a3a', hex: '#3a3a3a' });
  // light inside the grooves
  const e = canvas(w, w), eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, w, w);
  drawFaceLayout(eg, w, info, { frame: '#5a2c08', label: '#e07a1e', number: '#f08a22', zero: '#ffb04a', hex: '#b85c16' });
  // bronze surface with a little wear
  const c = canvas(w, w), cg = c.getContext('2d');
  const R = rng(hash.length + parseInt(hash.slice(-6), 16) % 9973);
  cg.fillStyle = '#2a1d14'; cg.fillRect(0, 0, w, w);
  for (let i = 0; i < 900; i++) {
    cg.fillStyle = `rgba(${90 + R() * 60},${60 + R() * 40},${30 + R() * 20},${R() * 0.12})`;
    cg.fillRect(R() * w, R() * w, R() * 40 + 4, R() * 2 + 1);
  }
  drawFaceLayout(cg, w, info, { frame: '#120b06', label: '#120b06', number: '#120b06', zero: '#120b06', hex: '#120b06' });
  const out = { color: tex(c), normal: normalFromHeight(h, 2.2, 1.2), emissive: tex(e) };
  ENGRAVED.set(key, out);
  return out;
}

// The block face printed on paper: the look of proof without the work.
export function blockFacePaper({ hash, height, nonce, w = 512, label = 'BLOCK' } = {}) {
  const c = canvas(w, w), g = c.getContext('2d');
  const R = rng(7);
  g.fillStyle = '#ece8dc'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(60,55,40,${R() * 0.05})`; g.fillRect(R() * w, R() * w, 2, 1); }
  drawFaceLayout(g, w, { hash, height, nonce, label }, { frame: '#6a6660', label: '#6a6660', number: '#5e5a54', zero: '#8a857c', hex: '#8a857c' });
  return tex(c);
}

// Emissive mask for the same face (bright where the orange lines and digits are).
export function glowFrom(t) { return t; }

export function textCard(lines, { w = 1024, h = 256, font = '600 64px "Figtree"', color = '#fff', bg = null, align = 'center' } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = color; g.font = font; g.textAlign = align; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  // Shrink the font if a line would overflow the canvas.
  const widest = Math.max(...arr.map((ln) => g.measureText(ln).width));
  if (widest > w * 0.96) {
    const m = font.match(/(\d+(?:\.\d+)?)px/);
    if (m) g.font = font.replace(m[0], `${Math.floor(Number(m[1]) * (w * 0.96) / widest)}px`);
  }
  const lh = h / (arr.length + 0.5);
  arr.forEach((ln, i) => g.fillText(ln, align === 'center' ? w / 2 : 20, lh * (i + 0.75)));
  return tex(c);
}

export function whitepaperPage(n, { w = 612, h = 792 } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  const R = rng(100 + n);
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1b1b'; g.textAlign = 'center';
  let y = 70;
  if (n === 1) {
    g.font = '700 22px "Cormorant Garamond"';
    g.fillText('Bitcoin: A Peer-to-Peer Electronic Cash System', w / 2, 80);
    g.font = '500 15px "Cormorant Garamond"';
    g.fillText('Satoshi Nakamoto', w / 2, 108);
    y = 150;
  }
  g.textAlign = 'left';
  for (; y < h - 70; y += 13) {
    if (R() < 0.06) { y += 10; continue; }
    const len = (w - 140) * (R() < 0.1 ? 0.3 + R() * 0.5 : 1);
    g.fillStyle = 'rgba(30,30,30,0.5)';
    g.fillRect(70, y, len, 5);
  }
  g.fillStyle = '#555'; g.font = '500 12px "Cormorant Garamond"'; g.textAlign = 'center';
  g.fillText(String(n), w / 2, h - 36);
  return tex(c);
}

export function terminal(text, { w = 1024, h = 512, cursor = true } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#050805'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8e3d8';
  g.font = '500 58px "JetBrains Mono"'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(text, 70, h / 2);
  if (cursor) {
    const tw = g.measureText(text).width;
    g.fillStyle = '#f7931a'; g.fillRect(70 + tw + 10, h / 2 - 32, 30, 64);
  }
  return tex(c);
}
