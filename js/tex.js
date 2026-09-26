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
  const od = og.createImageData(w, h), o = od.data;
  // Sobel slope from the 3x3 neighbourhood, edges clamped. Row and column offsets are worked out once per row and
  // pixel instead of per sample: the page builds about 30 of these maps at load, and this loop was most of the wait.
  for (let y = 0; y < h; y++) {
    const rm = (y > 0 ? y - 1 : 0) * w, r0 = y * w, rp = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : w - 1;
      const dx = (H[rm + xp] + 2 * H[r0 + xp] + H[rp + xp]) - (H[rm + xm] + 2 * H[r0 + xm] + H[rp + xm]);
      const dy = (H[rp + xm] + 2 * H[rp + x] + H[rp + xp]) - (H[rm + xm] + 2 * H[rm + x] + H[rm + xp]);
      const nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.sqrt(nx * nx + ny * ny + 1); // nz is 1; faster than Math.hypot and the same bytes out
      const i = (r0 + x) * 4;
      o[i] = (nx / l * 0.5 + 0.5) * 255;
      o[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      o[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
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

// ---------------------------------------------------------------------------------------------- bank notes
// A fictional note, "FIAT RESERVE NOTE", printed like the real thing (never a copy of any real currency): deep
// green-black intaglio line work over a tinted underprint in a second, sepia ink. The portrait is the king from
// the gold coin, engraved the way medal and banknote portraits were: parallel lines lifted by the relief.
// Layout units are the 1024x436 canvas. res scales everything (res 2 = 2048x872, for close-ups).
// The box x 262-404, y 290-336 (layout units) is kept clear for the signature drawn in chorus 1.

const NOTE_INK = '#16281f';
const NOTE_TINT = '154,107,60';          // the second ink, sepia (as an rgb triple for rgba())
const NOTE_RED = '#7a2a1c';
const NOTE_W = 1024, NOTE_H = 436;
const SIG_BOX = [256, 284, 410, 342];     // kept clear (a little larger than the signature area)
const NOTE_TEMPLATES = new Map();         // res -> Promise<{ canvas, normalMap }>
const NOTE_EXTRAS = new WeakMap();        // texture -> { normalMap, res }

// The ink relief and resolution of a note texture made by banknote() (null for any other texture).
export function noteExtras(t) { return NOTE_EXTRAS.get(t) || null; }

// Medal-style engraving of the king from the gold coin: horizontal lines lifted by the relief, their weight
// following the tone. Drawn supersampled into its own canvas (transparent, ink only).
function notePortrait(im, pw, ph) {
  const SS = 2, W = Math.round(pw * SS), H = Math.round(ph * SS);
  // the head, cropped from the coin photo to the oval's proportions
  const crop = { cx: 548, cy: 486, h: 900 };
  crop.w = crop.h * (pw / ph);
  const src = canvas(W, H), sg = src.getContext('2d');
  sg.drawImage(im, crop.cx - crop.w / 2, crop.cy - crop.h / 2, crop.w, crop.h, 0, 0, W, H);
  const tone = sg.getImageData(0, 0, W, H).data;
  const blur = canvas(W, H), bg = blur.getContext('2d');
  bg.filter = `blur(${7 * SS}px)`;
  bg.drawImage(src, 0, 0);
  const hgt = bg.getImageData(0, 0, W, H).data;
  // the large-scale light and shade, to be compressed: seen small (in crowds, on a moving sheet) the portrait must not
  // swing from dark to light across a few pixels, or it strobes. Lines, edges and texture keep their full contrast.
  const low = canvas(W, H), lg = low.getContext('2d');
  lg.filter = `blur(${50 * SS}px)`;
  lg.drawImage(src, 0, 0);
  const lowTone = lg.getImageData(0, 0, W, H).data;
  const at = (d, x, y) => {
    const i = (Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * 4;
    return (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
  };
  const out = canvas(W, H), g = out.getContext('2d');
  g.fillStyle = NOTE_INK;
  const sp = 2.05 * SS, lift = 6.5 * SS, step = 1.25 * SS;
  for (let y0 = -lift; y0 < H + lift; y0 += sp) {
    const top = [], bot = [];
    for (let x = 0; x <= W; x += step) {
      const yc = y0 - lift * (at(hgt, x, y0) - 0.45);
      let t = at(tone, x, yc);
      const tl = at(lowTone, x, yc);
      t = 0.52 + 0.3 * (tl - 0.52) + (t - tl);
      t = Math.min(1, Math.max(0, (t - 0.1) / 0.6));
      const wgt = sp * (0.1 + 0.55 * Math.pow(1 - t, 1.1));   // the darkest tones stay mid-grey at a distance (flash safety)
      top.push(x, yc - wgt / 2);
      bot.push(x, yc + wgt / 2);
    }
    g.beginPath();
    g.moveTo(top[0], top[1]);
    for (let k = 2; k < top.length; k += 2) g.lineTo(top[k], top[k + 1]);
    for (let k = bot.length - 2; k >= 0; k -= 2) g.lineTo(bot[k], bot[k + 1]);
    g.closePath();
    g.fill();
  }
  return out;
}

// A rosette of interlaced curves (lathe work).
function noteRosette(g, cx, cy, r0, r1, n, color, lw, petals, twist = 0) {
  g.save(); g.strokeStyle = color; g.lineWidth = lw;
  for (let k = 0; k < n; k++) {
    g.beginPath();
    const ph = (k / n) * Math.PI * 2;
    for (let i = 0; i <= 900; i++) {
      const a = (i / 900) * Math.PI * 2;
      const r = r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(a * petals + ph + twist * Math.sin(a * 3)));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// A rope of interwoven waves along a line from (x0, y0) to (x1, y1).
function noteRope(g, x0, y0, x1, y1, amp, freq, n, color, lw) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  g.save(); g.strokeStyle = color; g.lineWidth = lw;
  for (let k = 0; k < n; k++) {
    g.beginPath();
    for (let s = 0; s <= len; s += 1.5) {
      const o = amp * Math.sin(s * freq + (k / n) * Math.PI * 2) * (0.75 + 0.25 * Math.sin(s * freq * 0.25 + k));
      const x = x0 + ux * s - uy * o, y = y0 + uy * s + ux * o;
      s ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// Microprint: tiny repeated text along a straight line (a dotted rule from afar, words up close).
function noteMicro(g, text, x0, x1, y, px, color) {
  g.save(); g.fillStyle = color; g.font = `600 ${px}px "Figtree"`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const unit = text + ' • ';
  const uw = g.measureText(unit).width;
  for (let x = x0; x < x1 - uw * 0.5; x += uw) g.fillText(unit, x, y);
  g.restore();
}

// Microprint around an ellipse.
function noteMicroRing(g, text, cx, cy, rx, ry, px, color) {
  g.save(); g.fillStyle = color; g.font = `600 ${px}px "Figtree"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const unit = (text + ' • ').split('');
  const fits = (Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))) / (px * 0.62);
  const per = Math.max(1, Math.round(fits / unit.length)) * unit.length;   // whole repeats: no collision where it closes
  for (let i = 0; i < per; i++) {
    const a = (i / per) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    g.save(); g.translate(x, y); g.rotate(Math.atan2(ry * Math.cos(a), -rx * Math.sin(a)));
    g.fillText(unit[i % unit.length], 0, 0);
    g.restore();
  }
  g.restore();
}

// Everything that is the same on every note: drawn once per resolution, with its ink-relief normal map.
function noteTemplate(res) {
  if (NOTE_TEMPLATES.has(res)) return NOTE_TEMPLATES.get(res);
  const p = (async () => {
    const w = NOTE_W, h = NOTE_H;
    const c = canvas(w * res, h * res), g = c.getContext('2d');
    g.scale(res, res);
    const R = rng(1234);
    // paper: a faintly green, warm-edged stock with a soft mottle
    const paper = g.createLinearGradient(0, 0, w, h);
    paper.addColorStop(0, '#e1e6d4'); paper.addColorStop(0.5, '#ebeee2'); paper.addColorStop(1, '#dde3cf');
    g.fillStyle = paper; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      g.fillStyle = `rgba(90,110,80,${R() * 0.07})`;
      g.fillRect(R() * w, R() * h, R() * 2.2 + 0.4, R() * 0.8 + 0.3);
    }
    // underprint: a split-fountain tint (green to sepia to green) and fine lathe lines in the second ink
    const tint = g.createLinearGradient(0, 0, w, 0);
    tint.addColorStop(0, 'rgba(160,190,150,0.20)'); tint.addColorStop(0.5, `rgba(${NOTE_TINT},0.13)`); tint.addColorStop(1, 'rgba(160,190,150,0.20)');
    g.fillStyle = tint; g.fillRect(24, 24, w - 48, h - 48);
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.rect(SIG_BOX[0], SIG_BOX[1], SIG_BOX[2] - SIG_BOX[0], SIG_BOX[3] - SIG_BOX[1]);
    g.clip('evenodd');
    g.strokeStyle = `rgba(${NOTE_TINT},0.16)`; g.lineWidth = 0.45;
    for (let y = 30; y < h - 30; y += 3.2) {
      g.beginPath();
      for (let x = 28; x <= w - 28; x += 3) g.lineTo(x, y + 1.6 * Math.sin(x * 0.045 + y * 0.09) + 0.8 * Math.sin(x * 0.13));
      g.stroke();
    }
    g.restore();
    // frame: heavy outer rule, microprint in the channel, fine inner rule, a rope border inside
    g.strokeStyle = NOTE_INK; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 0.8; g.strokeRect(25, 25, w - 50, h - 50);
    noteMicro(g, 'FIAT RESERVE NOTE • IN PRINT WE TRUST • LEGAL TENDER BY DECREE', 30, w - 30, 19.8, 5.2, NOTE_INK);
    noteMicro(g, 'FIAT RESERVE NOTE • IN PRINT WE TRUST • LEGAL TENDER BY DECREE', 30, w - 30, h - 19.8, 5.2, NOTE_INK);
    const ink = (a) => `rgba(22,40,31,${a})`, sep = (a) => `rgba(${NOTE_TINT},${a})`;
    noteRope(g, 34, 37, w - 34, 37, 5.5, 0.12, 8, ink(0.62), 0.5);
    noteRope(g, 34, h - 37, w - 34, h - 37, 5.5, 0.12, 8, ink(0.62), 0.5);
    noteRope(g, 37, 48, 37, h - 48, 4.5, 0.14, 6, ink(0.55), 0.45);
    noteRope(g, w - 37, 48, w - 37, h - 48, 4.5, 0.14, 6, ink(0.55), 0.45);
    // rosettes: two inks interlaced, with a clear centre for their words
    for (const [cx, petalsA, petalsB] of [[150, 21, 13], [w - 150, 17, 11]]) {
      noteRosette(g, cx, h / 2, 56, 94, 26, sep(0.26), 0.42, petalsA, 0.35);
      noteRosette(g, cx, h / 2, 62, 88, 14, ink(0.28), 0.5, petalsB);
      g.fillStyle = 'rgba(233,237,224,0.5)'; g.beginPath(); g.arc(cx, h / 2, 52, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink(0.8); g.lineWidth = 0.8; g.beginPath(); g.arc(cx, h / 2, 52, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.4; g.beginPath(); g.arc(cx, h / 2, 48, 0, Math.PI * 2); g.stroke();
    }
    // small rosettes behind the corner numerals
    for (const [cx, cy] of [[110, 88], [w - 110, h - 88]]) noteRosette(g, cx, cy, 26, 44, 12, sep(0.55), 0.4, 9);
    // the portrait: medal engraving in a clear oval, framed by rules, a wave band and a microprint ring
    const ox = w / 2, oy = h / 2 + 4, orx = 118, ory = 142;
    g.save();
    g.beginPath(); g.ellipse(ox, oy, orx, ory, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#edf0e5'; g.fillRect(ox - orx, oy - ory, orx * 2, ory * 2);
    const face = notePortrait(await img('stater_height.png'), orx * 2 * res, ory * 2 * res);
    g.drawImage(face, ox - orx, oy - ory, orx * 2, ory * 2);
    g.restore();
    g.strokeStyle = NOTE_INK; g.lineWidth = 2.0; g.beginPath(); g.ellipse(ox, oy, orx + 3, ory + 3, 0, 0, Math.PI * 2); g.stroke();
    // the outer ornaments stop short of the title, the motto and the signature box (a cartouche, as on real notes)
    g.save();
    g.beginPath(); g.rect(0, 0, w, h);
    g.rect(346, 38, 332, 40); g.rect(404, 364, 216, 30); g.rect(SIG_BOX[0], SIG_BOX[1], SIG_BOX[2] - SIG_BOX[0], SIG_BOX[3] - SIG_BOX[1]);
    g.clip('evenodd');
    g.save(); g.strokeStyle = ink(0.55); g.lineWidth = 0.45;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      for (let i = 0; i <= 1440; i++) {
        const a = (i / 1440) * Math.PI * 2, o = 8.5 + 3.2 * Math.sin(a * 72 + k * 1.2566);
        const x = ox + Math.cos(a) * (orx + o), y = oy + Math.sin(a) * (ory + o);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    g.lineWidth = 0.9; g.beginPath(); g.ellipse(ox, oy, orx + 14.5, ory + 14.5, 0, 0, Math.PI * 2); g.stroke();
    noteMicroRing(g, 'IN PRINT WE TRUST • FIAT RESERVE NOTE', ox, oy, orx + 18.5, ory + 18.5, 4.6, NOTE_INK);
    g.restore();
    // the security thread: a grey metallic strip woven in and out of the paper (kept low in contrast: on a moving
    // sheet a dark line repeating every note would strobe)
    g.fillStyle = 'rgba(96,112,104,0.45)'; g.fillRect(684.2, 14, 3.6, h - 28);
    for (let y = 16; y < h - 16; y += 22) {
      g.fillStyle = 'rgba(88,104,96,0.35)'; g.fillRect(684.2, y, 3.6, 14);
      g.fillStyle = 'rgba(214,226,218,0.8)'; g.fillRect(685.6, y + 1, 0.8, 12);
    }
    // the seal, in the second ink: toothed rim, microprint ring, lathe centre, and a pen nib (a stroke of a pen)
    {
      const sx = w - 270, sy = h / 2 + 70;
      g.save(); g.translate(sx, sy);
      g.fillStyle = sep(0.9);
      g.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2, r = i % 2 ? 31 : 34;
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.fill();
      g.fillStyle = '#ecefe3'; g.beginPath(); g.arc(0, 0, 28.5, 0, Math.PI * 2); g.fill();
      g.restore();
      noteMicroRing(g, 'FIAT RESERVE SYSTEM • BY DECREE', sx, sy, 24.5, 24.5, 5, sep(1));
      noteRosette(g, sx, sy, 6, 19, 10, sep(0.75), 0.4, 7);
      g.save(); g.translate(sx, sy);
      g.strokeStyle = sep(1); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 20.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = sep(1);
      g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(4.5, 5, 6.5, -2, 5, -9); g.lineTo(-5, -9); g.bezierCurveTo(-6.5, -2, -4.5, 5, 0, 12); g.fill();
      g.fillStyle = '#ecefe3'; g.fillRect(-0.5, -2, 1, 11); g.beginPath(); g.arc(0, -2.5, 1.6, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // lettering in the green-black ink
    g.fillStyle = NOTE_INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 30px "Cormorant Garamond"';
    g.fillText('FIAT  RESERVE  NOTE', w / 2, 58);
    g.font = '600 17px "Cormorant Garamond"';
    g.fillText('IN  PRINT  WE  TRUST', w / 2, h - 58);
    g.font = '700 20px "Cormorant Garamond"';
    g.fillText('LEGAL TENDER', 150, h / 2 - 8); g.fillText('BY DECREE', 150, h / 2 + 16);
    g.fillText('ONE HUNDRED', w - 150, h / 2 - 8); g.fillText('UNITS', w - 150, h / 2 + 16);
    // paper fibres, the same on every note
    for (let i = 0; i < 90; i++) noteFibre(g, R, w, h);
    // the ink relief: ink stands proud of the paper
    const d = g.getImageData(0, 0, c.width, c.height);
    const hc = canvas(c.width, c.height), hg = hc.getContext('2d');
    const hd = hg.createImageData(c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255;
      const v = Math.round(255 * Math.min(1, Math.max(0, (0.93 - lum) / 0.8)));
      hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = v; hd.data[i + 3] = 255;
    }
    hg.putImageData(hd, 0, 0);
    const normalMap = normalFromHeight(hc, 1.4, 0.5 * res);
    return { canvas: c, normalMap };
  })();
  NOTE_TEMPLATES.set(res, p);
  return p;
}

function noteFibre(g, R, w, h) {
  const x = 30 + R() * (w - 60), y = 30 + R() * (h - 60);
  if (x > SIG_BOX[0] - 20 && x < SIG_BOX[2] + 20 && y > SIG_BOX[1] - 20 && y < SIG_BOX[3] + 20) return;
  const len = 5 + R() * 13, a = R() * Math.PI, bend = (R() - 0.5) * 6;
  g.strokeStyle = R() < 0.5 ? 'rgba(170,60,52,0.38)' : 'rgba(58,86,170,0.36)';
  g.lineWidth = 0.55;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
  g.stroke();
}

// A fictional paper note. The portrait is the same king from the gold coin: money changing form.
// Returns a CanvasTexture whose image is the (1024*res x 436*res) canvas; noteExtras(texture) gives its ink relief.
export async function banknote({ w = 1024, h = 436, seed = 1, denom = '100', serial = 'A 0000320F B', res = 1 } = {}) {
  const T = await noteTemplate(res);
  const c = canvas(w * res, h * res), g = c.getContext('2d');
  g.drawImage(T.canvas, 0, 0, c.width, c.height);
  g.setTransform((w * res) / NOTE_W, 0, 0, (h * res) / NOTE_H, 0, 0);
  const W = NOTE_W, H = NOTE_H;
  const R = rng(seed);
  // corner numerals
  g.fillStyle = NOTE_INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 64px "Playfair Display"';
  g.fillText(denom, 110, 88); g.fillText(denom, W - 110, H - 88);
  g.font = '900 44px "Playfair Display"';
  g.fillText(denom, W - 105, 80); g.fillText(denom, 105, H - 80);
  // serial numbers in red-brown, and a few more fibres of this sheet's own
  g.font = '500 18px "JetBrains Mono"';
  g.fillStyle = NOTE_RED;
  g.fillText(serial, 240, 104); g.fillText(serial, W - 240, H - 104);
  for (let i = 0; i < 40; i++) noteFibre(g, R, W, H);
  const t = tex(c);
  NOTE_EXTRAS.set(t, { normalMap: T.normalMap, res });
  return t;
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
