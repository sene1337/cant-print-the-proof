// Verse 3, "block after block": the chain lands one block per beat on a granite bedrock that runs to the horizon.
// Each landed block shows the real art-chain block being mined at the moment it lands.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { studioEnv } from '../film.js';
import { blockFace, normalFromHeight } from '../tex.js';
import { canvas, canvasTex, Motes, glowCard, fmt } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, rng, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const SP = 2.1;        // block spacing along x

const NVIS = 34;              // blocks drawn behind the head
const FACE_PX = 320;
const UNIQUE_FROM = 136.3; // blocks landing earlier are far down the chain: one shared face

// ---------------------------------------------------------------------------------------------
// Granite, as a mineral mosaic: interlocking crystals (feldspar as elongated laths, smoky quartz, dark
// hornblende/biotite), then small black mica flakes. The tile is seamless. Colours are sRGB 0-255.
const PAL_WALL = { // light grey granite, honed (contrast kept moderate so the grain doesn't shimmer in motion)
  feld: [[198, 194, 186], [188, 166, 156]], pink: 0.14, quartz: [148, 148, 153], dark: [74, 72, 74], mica: [42, 40, 42],
  p: [0.60, 0.28, 0.12], micaN: 2400,
};
const PAL_PANEL = { // dark granite, polished: grey crystals in near-black
  feld: [[76, 75, 73], [66, 70, 78]], pink: 0.4, quartz: [50, 50, 54], dark: [26, 25, 26], mica: [15, 15, 16],
  p: [0.40, 0.25, 0.35], micaN: 1800,
};
function graniteCanvas({ S = 1024, cell = 26, seed = 3, pal }) {
  const R = rng(seed);
  const n = Math.max(4, Math.round(S / cell)), cs = S / n, N2 = n * n;
  const sx = new Float32Array(N2), sy = new Float32Array(N2), ca = new Float32Array(N2), sa = new Float32Array(N2);
  const el = new Float32Array(N2), cr = new Float32Array(N2), cg = new Float32Array(N2), cb = new Float32Array(N2);
  const wt = new Float32Array(N2); // > 1 shrinks a crystal: quartz a little, the dark minerals a lot
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    sx[k] = (i + 0.1 + 0.8 * R()) * cs; sy[k] = (j + 0.1 + 0.8 * R()) * cs;
    const a = R() * Math.PI; ca[k] = Math.cos(a); sa[k] = Math.sin(a);
    const u = R();
    let col;
    if (u < pal.p[0]) { col = pal.feld[R() < pal.pink ? 1 : 0]; el[k] = 1.3 + R() * 0.8; wt[k] = 1; }
    else if (u < pal.p[0] + pal.p[1]) { col = pal.quartz; el[k] = 1 + R() * 0.3; wt[k] = 1.35; }
    else { col = pal.dark; el[k] = 1 + R() * 0.5; wt[k] = 2.4; }
    const v = 0.9 + R() * 0.2;
    cr[k] = col[0] * v; cg[k] = col[1] * v; cb[k] = col[2] * v;
  }
  const c = canvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) {
    const gj = Math.floor(y / cs);
    for (let x = 0; x < S; x++) {
      const gi = Math.floor(x / cs);
      let b1 = 1e12, b2 = 1e12, k1 = 0;
      for (let dj = -2; dj <= 2; dj++) {
        let jj = gj + dj, oy = 0;
        if (jj < 0) { jj += n; oy = -S; } else if (jj >= n) { jj -= n; oy = S; }
        for (let di = -2; di <= 2; di++) {
          let ii = gi + di, ox = 0;
          if (ii < 0) { ii += n; ox = -S; } else if (ii >= n) { ii -= n; ox = S; }
          const k = jj * n + ii;
          const dx = x - sx[k] - ox, dy = y - sy[k] - oy;
          const pu = dx * ca[k] + dy * sa[k], pv = dy * ca[k] - dx * sa[k];
          const dd = ((pu * pu) / (el[k] * el[k]) + pv * pv) * wt[k]; // stretched along the crystal's long axis
          if (dd < b1) { b2 = b1; b1 = dd; k1 = k; } else if (dd < b2) b2 = dd;
        }
      }
      const edge = Math.sqrt(b2) - Math.sqrt(b1);
      const e = edge < 1.5 ? 0.82 + 0.18 * (edge / 1.5) : 1; // a fine darker line where crystals meet
      const i4 = (y * S + x) * 4;
      d[i4] = cr[k1] * e; d[i4 + 1] = cg[k1] * e; d[i4 + 2] = cb[k1] * e; d[i4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  // soft variation inside the crystals, so none reads as flat paint
  for (let i = 0; i < 420; i++) {
    const x = R() * S, y = R() * S, r = cs * (0.4 + R() * 0.9), v = R() < 0.5 ? '255,255,255' : '0,0,0', a = 0.05 + R() * 0.07;
    wrap((dx, dy) => {
      const gd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gd.addColorStop(0, `rgba(${v},${a})`); gd.addColorStop(1, `rgba(${v},0)`);
      g.fillStyle = gd; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    });
  }
  // mica: small black flakes, a few with a bronze edge
  for (let i = 0; i < pal.micaN; i++) {
    const x = R() * S, y = R() * S, l = 1.5 + R() * 3.2, w = 0.7 + R() * 1.3, a = R() * Math.PI;
    const m = pal.mica, bronze = R() < 0.2;
    g.fillStyle = bronze ? `rgb(${m[0] + 40},${m[1] + 28},${m[2] + 12})` : `rgb(${m[0]},${m[1]},${m[2]})`;
    wrap((dx, dy) => { g.beginPath(); g.ellipse(x + dx, y + dy, l, w, a, 0, Math.PI * 2); g.fill(); });
  }
  // a hair of blur to anti-alias the crystal edges, done on a wrapped copy so the tile stays seamless
  const M = 8, big = canvas(S + 2 * M, S + 2 * M), bg = big.getContext('2d');
  wrap((dx, dy) => bg.drawImage(c, M + dx, M + dy));
  const out = canvas(S, S), og = out.getContext('2d');
  og.filter = 'blur(0.55px)';
  og.drawImage(big, -M, -M);
  return out;
}

// Exact Euclidean distance transform (Felzenszwalb): for each inside pixel, the distance to the nearest outside pixel.
function distanceInside(inside, w, h) {
  const INF = 1e12, L = Math.max(w, h);
  const f = new Float64Array(L), dd = new Float64Array(L), v = new Int32Array(L), z = new Float64Array(L + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = inside[i] ? INF : 0;
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; pass(h); for (let y = 0; y < h; y++) grid[y * w + x] = dd[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; pass(w); for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(dd[x]); }
  return grid;
}

// The carved face of the monolith: polished dark granite with the rule cut in as V-grooves (45-degree walls meeting
// in a sharp centre line, the classic chisel cut), the cut surfaces frosted pale. Returns colour, normal and roughness.
function inscriptionMaps(text, darkTile, pxPerUnit, w = 2048, h = 600) {
  // polished ground: the dark granite at its true scale
  const col = canvas(w, h), cg = col.getContext('2d');
  const tpx = Math.round(1.6 * pxPerUnit); // one granite tile is 1.6 world units
  for (let x = 0; x < w; x += tpx) for (let y = 0; y < h; y += tpx) cg.drawImage(darkTile, x, y, tpx, tpx);
  const ground = cg.getImageData(0, 0, w, h);
  // the cut: letters and an incised border line
  const mk = canvas(w, h), mg = mk.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h);
  mg.fillStyle = '#fff'; mg.strokeStyle = '#fff';
  mg.font = `700 ${Math.round(h * 0.62)}px "Cormorant Garamond"`; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.fillText(text, w / 2, h * 0.56);
  mg.lineWidth = 11; mg.strokeRect(46, 46, w - 92, h - 92);
  const md = mg.getImageData(0, 0, w, h).data;
  const cover = new Float32Array(w * h), inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { cover[i] = md[i * 4] / 255; inside[i] = cover[i] >= 0.5 ? 1 : 0; }
  const dist = distanceInside(inside, w, h);
  // colour: frosted cut (pale, the crystals faintly visible) over polished dark granite
  const out = cg.createImageData(w, h), od = out.data, gd = ground.data;
  // normal: height = -distance (a V with 45-degree walls); roughness: polished 0.12, frosted 0.85
  const nC = canvas(w, h), ng = nC.getContext('2d'), nImg = ng.createImageData(w, h), nd = nImg.data;
  const rC = canvas(w, h), rgx = rC.getContext('2d'), rImg = rgx.createImageData(w, h), rd = rImg.data;
  const H = (x, y) => -dist[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, i4 = i * 4, c = cover[i];
      for (let k = 0; k < 3; k++) {
        const base = gd[i4 + k];
        const frost = 142 + (base - 50) * 0.55;
        od[i4 + k] = base + (frost - base) * c;
      }
      od[i4 + 3] = 255;
      const dx = (H(x + 1, y) - H(x - 1, y)) * 0.5, dy = (H(x, y + 1) - H(x, y - 1)) * 0.5;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      nd[i4] = (nx * 0.5 + 0.5) * 255; nd[i4 + 1] = (ny * 0.5 + 0.5) * 255; nd[i4 + 2] = (nz * 0.5 + 0.5) * 255; nd[i4 + 3] = 255;
      const r = 0.12 + (0.85 - 0.12) * c;
      rd[i4] = rd[i4 + 1] = rd[i4 + 2] = r * 255; rd[i4 + 3] = 255;
    }
  }
  cg.putImageData(out, 0, 0); ng.putImageData(nImg, 0, 0); rgx.putImageData(rImg, 0, 0);
  return { map: canvasTex(col, { aniso: 16 }), normal: canvasTex(nC, { srgb: false, aniso: 16 }), rough: canvasTex(rC, { srgb: false, aniso: 16 }) };
}

// Planar UVs chosen per vertex by its normal (a box of any size gets undistorted granite on every face),
// in world units, shifted per stone so neighbours never line up; plus a per-stone tone as vertex colour.
function dressStone(geo, tile, ox, oy, tone) {
  const p = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    if (ay > 0.7) uv.setXY(i, (x + ox) / tile, (z + oy) / tile);
    else if (ax > 0.7) uv.setXY(i, (z + ox) / tile, (y + oy) / tile);
    else uv.setXY(i, (x + ox) / tile, (y + oy) / tile);
    col[i * 3] = tone[0]; col[i * 3 + 1] = tone[1]; col[i * 3 + 2] = tone[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Churning digits for the block being mined next.
function miningFace(seed) {
  const w = FACE_PX, c = canvas(w, w), g = c.getContext('2d');
  const R = rng(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(247,147,26,0.8)'; g.lineWidth = w * 0.012; g.strokeRect(w * 0.05, w * 0.05, w * 0.9, w * 0.9);
  g.font = `500 ${Math.round(w * 0.052)}px "JetBrains Mono"`; g.textBaseline = 'alphabetic';
  const hex = '0123456789abcdef';
  for (let r = 0; r < 4; r++) for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(255,${170 + R() * 60},${90 + R() * 60},${0.35 + R() * 0.5})`;
    g.fillText(hex[Math.floor(R() * 16)], w * 0.1 + i * w * 0.05, w * 0.52 + r * w * 0.075);
  }
  g.fillStyle = 'rgba(247,147,26,0.9)';
  g.font = `800 ${Math.round(w * 0.2)}px "Figtree"`;
  g.fillText('#', w * 0.095, w * 0.38);
  return canvasTex(c);
}

export async function verse3ChainStage(film) {
  const T = film.T, chain = film.chain;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.028);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 1.5], color: [1, 0.7, 0.4], intensity: 2.5 },
    { pos: [-6, 0.5, 1], size: [0.6, 5], color: [1, 0.6, 0.25], intensity: 3 },
    { pos: [5, 1, -3], size: [0.6, 5], color: [0.8, 0.85, 1], intensity: 2 },
  ]);
  scene.environmentIntensity = 0.7;

  // Beats that carry a block: from before the chain shot to the end of the verse.
  const beats = T.beats.filter((b) => b > 127 && b < 156);
  const K0 = 0;
  const xOf = (k) => SP * k;

  // Faces for every block that lands close to the camera (drawn once); far blocks share one.
  const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.05);
  const farFace = miningFace(77);
  const blocks = beats.map((b, k) => {
    const i = chain.frameAt(b);
    const bk = chain.block(i);
    const tex = b >= UNIQUE_FROM ? blockFace({ hash: bk.hash, height: '#' + fmt(i), nonce: bk.nonce, w: FACE_PX, label: 'BLOCK' }) : farFace;
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.02, 0.016, 0.012), metalness: 0.7, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12,
      emissive: new THREE.Color(1, 0.55, 0.12), emissiveMap: tex, emissiveIntensity: 2.2,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return { m, mat, t: b, i, k };
  });
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(2.2), transparent: true, opacity: 0.85 });
  for (const b of blocks) { const e = new THREE.LineSegments(edgeGeo, edgeMat); b.m.add(e); }

  // Links between neighbours.
  const linkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(3) });
  const linkGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
  const links = blocks.map(() => { const l = new THREE.Mesh(linkGeo, linkMat.clone()); scene.add(l); return l; });

  // The block being mined next: a ghost with churning digits.
  const mineTex = [0, 1, 2, 3, 4, 5].map((s) => miningFace(900 + s));
  const mineMat = new THREE.MeshBasicMaterial({ map: mineTex[0], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const mining = new THREE.Mesh(geo, mineMat);
  scene.add(mining);
  const mineEdge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(1.5), transparent: true, opacity: 0.5 }));
  mining.add(mineEdge);

  // ---- The bedrock, dressed: honed granite ashlar under a projecting coping; one polished dark monolith carries the rule.
  const TILE_W = 1.6; // one granite tile spans 1.6 world units: feldspar laths 2.5-4 cm, dark minerals ~1 cm, mica 3-8 mm
  const wallTile = graniteCanvas({ S: 1024, cell: 16, seed: 3, pal: PAL_WALL });
  const darkTile = graniteCanvas({ S: 1024, cell: 16, seed: 8, pal: PAL_PANEL });
  const wallTex = canvasTex(wallTile, { repeat: true, aniso: 16 });
  const honed = new THREE.MeshStandardMaterial({ map: wallTex, vertexColors: true, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 });
  const L = 300, X0 = -200;
  const FRONT_Z = 1.3;
  const tGranite = T.wordAfter('granite', 150).s;
  const XG = xOf(beats.filter((b) => b <= tGranite).length - 1) - 1.4; // where the carved monolith sits
  const PANEL = { x: XG, y: -3.3, w: 9.2, h: 2.7 };
  const R = rng(41);
  const stones = [];
  const GAP = 0.022, BEVEL = 0.03;
  const stone = (x0, x1, yTop, hgt, depth, zFront, bevel = BEVEL) => {
    const w = x1 - x0;
    const g = new RoundedBoxGeometry(w - GAP, hgt - GAP, depth, 1, bevel);
    g.translate((x0 + x1) / 2, yTop - hgt / 2, zFront - depth / 2);
    const v = 0.8 + R() * 0.24, warm = (R() - 0.5) * 0.05;
    stones.push(dressStone(g, TILE_W, R() * TILE_W, R() * TILE_W, [v * (1 + warm), v, v * (1 - warm)]));
  };
  // a course of stones between x0 and x1, lengths 2.3-3.9, the last one trimmed to fit
  const course = (x0, x1, yTop, hgt, depth, zFront, lmin = 2.3, lmax = 3.9) => {
    let x = x0;
    while (x < x1 - 1e-6) {
      let len = lmin + R() * (lmax - lmin);
      if (x1 - (x + len) < 0.9) len = x1 - x;
      stone(x, x + len, yTop, hgt, depth, zFront);
      x += len;
    }
  };
  const WX0 = -80, WX1 = 112;
  const mono = { x0: PANEL.x - PANEL.w / 2, x1: PANEL.x + PANEL.w / 2, yTop: PANEL.y + PANEL.h / 2, yBot: PANEL.y - PANEL.h / 2 };
  // coping: long capstones projecting 0.14 in front of the wall, the chain rests on their top (y = 0)
  course(WX0 - R() * 3, WX1, 0, 0.45, 1.2, FRONT_Z + 0.14, 3.6, 5.6);
  // first course, then two courses beside the monolith, then plain courses into the dark
  course(WX0 - R() * 3, WX1, -0.45, -0.45 - mono.yTop, 0.5, FRONT_Z);
  const midH = (mono.yTop - mono.yBot) / 2;
  for (const yTop of [mono.yTop, mono.yTop - midH]) {
    course(WX0 - R() * 3, mono.x0, yTop, midH, 0.5, FRONT_Z);
    course(mono.x1, WX1, yTop, midH, 0.5, FRONT_Z);
  }
  for (let yTop = mono.yBot; yTop > -15; yTop -= 1.5) course(WX0 - R() * 3, WX1, yTop, 1.5, 0.5, FRONT_Z);
  const wallGeo = mergeGeometries(stones);
  for (const g of stones) g.dispose();
  const wall = new THREE.Mesh(wallGeo, honed);
  wall.castShadow = true;
  wall.receiveShadow = false;
  scene.add(wall);
  // black behind the joints
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0 + 10, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  backing.position.set((WX0 + WX1) / 2, -0.5 - 8, FRONT_Z - 0.45); // from just under the coping down: never above the ledge
  scene.add(backing);
  // An invisible fence in front of the chain: it only casts shadow (no colour, no depth), so the raking light rakes the
  // stone but never reaches the glossy blocks on top, whose fronts would flare white.
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0 + 10, 1.8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  shield.position.set((WX0 + WX1) / 2, 0.85, 0.95);
  shield.castShadow = true;
  scene.add(shield);
  // the top the chain runs along: one long honed surface
  const topTex = wallTex.clone(); topTex.repeat.set(L / TILE_W, 6 / TILE_W); topTex.needsUpdate = true;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(L, 6), new THREE.MeshStandardMaterial({ map: topTex, color: 0x9a9894, roughness: 0.55, metalness: 0, envMapIntensity: 0.5 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(X0 + L / 2, -0.004, FRONT_Z - 0.9 - 3);
  top.receiveShadow = true;
  scene.add(top);

  // The monolith: one polished block, 5 cm proud of the wall, with the rule chiselled into it.
  const ins = inscriptionMaps('21,000,000', darkTile, 2048 / PANEL.w);
  const monoGeo = new RoundedBoxGeometry(PANEL.w, PANEL.h, 0.6, 2, 0.035);
  {
    const p = monoGeo.attributes.position, uv = monoGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / PANEL.w + 0.5, p.getY(i) / PANEL.h + 0.5);
  }
  const carve = new THREE.Mesh(monoGeo, new THREE.MeshStandardMaterial({
    map: ins.map, normalMap: ins.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: ins.rough, roughness: 1, metalness: 0, envMapIntensity: 1.0,
  }));
  carve.position.set(PANEL.x, PANEL.y, FRONT_Z + 0.05 - 0.3);
  scene.add(carve);
  const cliff = wall;

  // Light: moonlight from high front-left for form; a low cool light raking across the wall from the left.
  const moon = new THREE.DirectionalLight(0xc6d4ff, 0.35);
  moon.position.set(-6, 10, 12);
  scene.add(moon);
  // Far down the wall, so every stone in frame is raked at nearly the same low angle (no hotspot). It sits below the
  // coping's top, so the coping shades the chain from it: the stone is lit, the glossy blocks are not.
  const graze = new THREE.SpotLight(0xe8eeff, 14, 0, 0.42, 0.95, 0);
  graze.position.set(PANEL.x - 45, -1.5, FRONT_Z + 5.0);
  graze.target.position.set(PANEL.x + 2, -3.3, FRONT_Z);
  graze.castShadow = true;
  graze.shadow.mapSize.set(2048, 2048);
  graze.shadow.bias = -0.0005;
  graze.shadow.normalBias = 0.05;
  graze.shadow.camera.near = 10;
  graze.shadow.camera.far = 90;
  scene.add(graze, graze.target);
  const warm = [0, 1, 2].map(() => { const p = new THREE.PointLight(0xff8a2a, 0, 7, 1.6); scene.add(p); return p; });

  const puff = new Motes({ count: 220, size: 0.03, color: [1, 0.66, 0.3], gain: 5 });
  scene.add(puff);
  const horizon = glowCard([1, 0.45, 0.12], 90);
  horizon.material.opacity = 0.08;
  horizon.material.fog = false;
  scene.add(horizon);

  // Beat index of the newest block landed by time t (plus how far into its drop we are).
  const headAt = (t) => {
    let k = -1;
    for (let j = 0; j < beats.length; j++) if (beats[j] <= t) k = j;
    return k;
  };
  // Continuous head position (for cameras): glides from one block to the next between beats.
  const headX = (t) => {
    const k = headAt(t);
    if (k < 0) return xOf(0);
    if (k + 1 >= beats.length) return xOf(k);
    const f = clamp((t - beats[k]) / (beats[k + 1] - beats[k]));
    return xOf(k) + SP * f;
  };

  const S = {
    scene, blocks, links, mining, top, cliff, carve, moon, graze, warm, puff, horizon, beats, headAt, headX, xOf, FRONT_Z, PANEL, XG,
    fx: { bloom: 0.55, threshold: 1.0, bloomRadius: 0.4, grain: 0.045, vignette: 0.55, tint: [1.03, 0.99, 0.95] },
    update(ctx) {
      const t = ctx.t;
      const k = headAt(t + 0.2); // include the block that is dropping in
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j];
        const vis = j <= k && j > k - NVIS;
        b.m.visible = vis;
        links[j].visible = false;
        if (!vis) continue;
        const dt = t - b.t; // < 0 while dropping
        const drop = dt < 0 ? easeIn(clamp(1 + dt / 0.2), 2) : 1;
        const bounce = dt > 0 ? Math.exp(-dt * 14) * Math.sin(dt * 40) * 0.04 : 0;
        b.m.position.set(xOf(j), 0.5 + (1 - drop) * 1.9 + Math.abs(bounce), 0);
        b.m.rotation.set(0, 0, 0);
        const fresh = dt > 0 ? Math.exp(-dt * 3) : 0;
        b.mat.emissiveIntensity = (dt < 0 ? 1.2 : 2.2) + 1.8 * fresh;
        if (j > 0 && dt >= 0) {
          const l = links[j];
          l.visible = true;
          l.position.set(xOf(j) - SP / 2, 0.5, 0);
          l.scale.set(SP - 1, 1, 1);
          l.material.color.set(1, 0.5, 0.1).multiplyScalar(3 + 5 * Math.exp(-dt * 6));
        }
      }
      // the next block, being mined
      const kn = headAt(t) + 1;
      mining.visible = kn < blocks.length && t < blocks[Math.min(kn, blocks.length - 1)].t - 0.2;
      if (mining.visible) {
        mining.position.set(xOf(kn), 0.5, 0);
        // the next block's digits churn gently (a few times a second), at a steady brightness
        mineMat.map = mineTex[Math.floor(t * 2.5) % mineTex.length];
        mineMat.opacity = 0.4;
      }
      // warm light rides with the newest blocks
      const hk = headAt(t);
      warm.forEach((p, j) => {
        const kk = Math.max(0, hk - j * 2);
        p.position.set(xOf(kk), 1.6, -1.1);
        p.intensity = hk >= 0 ? 2.0 : 0;
      });
      // dust where the newest block hit
      const lastT = hk >= 0 ? blocks[hk].t : -99;
      puff.burst(t - lastT, [hk >= 0 ? xOf(hk) : 0, 0.05, 0.3], { power: 0.4, spread: 0.6, up: 0.3, life: 0.6, gravity: 1.5, seed: hk + 50 });
      graze.intensity = t >= 150.95 ? 14 : 0; // the raking light belongs to the granite shots only
      moon.intensity = 0.35;
      carve.visible = true;
      horizon.position.set(headX(t) - 160, 4, -20);
    },
  };
  return S;
}
