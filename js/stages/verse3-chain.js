// Verse 3, "block after block": the chain lands one block per beat on a granite bedrock that runs to the horizon.
// Each landed block shows the real art-chain block being mined at the moment it lands.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { blockFace, normalFromHeight } from '../tex.js';
import { canvas, canvasTex, Motes, glowCard, fmt } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, rng, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const SP = 2.1;        // block spacing along x

// 2D value noise and fBm, seeded, for the rock face.
function vn2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (i, j) => hash1(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(seed, 83492791));
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function fbm2(x, y, seed, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vn2(x * f, y * f, seed + i * 17); f *= 2.03; a *= 0.5; }
  return s;
}
const NVIS = 34;              // blocks drawn behind the head
const FACE_PX = 320;
const UNIQUE_FROM = 136.3; // blocks landing earlier are far down the chain: one shared face

// Granite: grey ground, black mica, white quartz and a little pink feldspar; plus a matching height map.
function graniteMaps(seed = 3, S = 1024) {
  const R = rng(seed);
  const col = canvas(S, S), cg = col.getContext('2d');
  const hgt = canvas(S, S), hg = hgt.getContext('2d');
  cg.fillStyle = '#6a6866'; cg.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  const blob = (g, x, y, r, fill) => {
    g.fillStyle = fill; g.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, rr = r * (0.6 + R() * 0.7);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.fill();
  };
  // wrap-around so the tile repeats seamlessly
  const each = (count, rmin, rmax, colFn, hFn) => {
    for (let i = 0; i < count; i++) {
      const x = R() * S, y = R() * S, r = rmin + R() * (rmax - rmin);
      const c = colFn(), h = hFn();
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        if (x + dx < -r * 2 || x + dx > S + r * 2 || y + dy < -r * 2 || y + dy > S + r * 2) continue;
        blob(cg, x + dx, y + dy, r, c); blob(hg, x + dx, y + dy, r, h);
      }
    }
  };
  // broad mottling first, then the crystals
  for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, r = 40 + R() * 120; const gd = cg.createRadialGradient(x, y, 0, x, y, r); const v = R() < 0.5 ? '255,255,255' : '0,0,0'; gd.addColorStop(0, `rgba(${v},0.06)`); gd.addColorStop(1, `rgba(${v},0)`); cg.fillStyle = gd; cg.fillRect(x - r, y - r, r * 2, r * 2); }
  each(5200, 1.5, 5, () => `rgba(${140 + R() * 35},${122 + R() * 25},${118 + R() * 25},${0.3 + R() * 0.3})`, () => `rgba(140,140,140,0.5)`); // feldspar
  each(6500, 1.2, 4, () => `rgba(${195 + R() * 45},${195 + R() * 45},${195 + R() * 45},${0.4 + R() * 0.4})`, () => `rgba(170,170,170,0.6)`); // quartz
  each(8000, 1, 3.5, () => `rgba(${12 + R() * 25},${12 + R() * 22},${14 + R() * 20},${0.55 + R() * 0.4})`, () => `rgba(70,70,70,0.7)`); // mica
  for (let i = 0; i < 40000; i++) { cg.fillStyle = `rgba(0,0,0,${R() * 0.12})`; cg.fillRect(R() * S, R() * S, 1.5, 1.5); }
  const map = canvasTex(col, { repeat: true, aniso: 16 });
  const normal = normalFromHeight(hgt, 1.6, 1.2);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  // A calm version for surfaces seen at grazing angles: softened crystals, lower contrast,
  // a gentle normal map, so the stone doesn't shimmer as the camera moves.
  const calmC = canvas(S, S), kg = calmC.getContext('2d');
  kg.filter = 'blur(1.6px)'; kg.drawImage(col, 0, 0); kg.filter = 'none';
  kg.fillStyle = 'rgba(104,102,99,0.42)'; kg.fillRect(0, 0, S, S);
  const calmMap = canvasTex(calmC, { repeat: true, aniso: 16 });
  const calmNormal = normalFromHeight(hgt, 0.7, 3.5);
  calmNormal.wrapS = calmNormal.wrapT = THREE.RepeatWrapping;
  return { map, normal, calmMap, calmNormal };
}

// Carved inscription on a dressed (polished) granite panel: albedo with dark V-cut letters, plus a height map.
function inscription(text, gr, w = 2048, h = 600) {
  const col = canvas(w, h), cg = col.getContext('2d');
  const hgt = canvas(w, h), hg = hgt.getContext('2d');
  // polished granite ground: the same stone, a shade darker, with a chiselled border
  const src = gr.map.image;
  for (let x = 0; x < w; x += src.width / 2) for (let y = 0; y < h; y += src.height / 2) cg.drawImage(src, x, y, src.width / 2, src.height / 2);
  cg.fillStyle = 'rgba(0,0,0,0.32)'; cg.fillRect(0, 0, w, h);
  hg.fillStyle = '#ffffff'; hg.fillRect(0, 0, w, h);
  // border: a sunk line all round
  hg.strokeStyle = 'rgba(0,0,0,0.8)'; hg.lineWidth = 10; hg.strokeRect(28, 28, w - 56, h - 56);
  cg.strokeStyle = 'rgba(0,0,0,0.45)'; cg.lineWidth = 8; cg.strokeRect(28, 28, w - 56, h - 56);
  const font = `700 ${Math.round(h * 0.6)}px "Cormorant Garamond"`;
  for (const g of [cg, hg]) { g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; }
  for (let k = 0; k < 7; k++) {
    hg.filter = `blur(${(7 - k) * 2.4}px)`;
    hg.fillStyle = 'rgba(0,0,0,0.3)';
    hg.fillText(text, w / 2, h * 0.55);
  }
  hg.filter = 'none';
  // the groove floor in shadow, a pale fresh-cut rim on its upper edge
  cg.fillStyle = 'rgba(210,205,196,0.55)';
  cg.fillText(text, w / 2, h * 0.55 - 5);
  cg.fillStyle = 'rgba(6,5,5,0.9)';
  cg.fillText(text, w / 2, h * 0.55 + 3);
  const map = canvasTex(col, { aniso: 16 });
  const normal = normalFromHeight(hgt, 3.0, 1.5);
  return { map, normal };
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

  // Granite bedrock: a quarried top the chain sits on, and a rough cliff face that drops into the dark.
  const gr = graniteMaps(3);
  const graniteMat = (rx, ry, rough = 0.62, flat = false, calm = false) => {
    const map = (calm ? gr.calmMap : gr.map).clone(); map.repeat.set(rx, ry); map.needsUpdate = true;
    const nm = (calm ? gr.calmNormal : gr.normal).clone(); nm.repeat.set(rx, ry); nm.needsUpdate = true;
    const k = calm ? 0.8 : 1.0;
    return new THREE.MeshStandardMaterial({ map, normalMap: nm, normalScale: new THREE.Vector2(k, k), roughness: rough, metalness: 0, flatShading: flat });
  };
  const L = 300, X0 = -200;
  const FRONT_Z = 1.3, DEPTH = 40;
  const tGranite = T.wordAfter('granite', 150).s;
  const XG = xOf(beats.filter((b) => b <= tGranite).length - 1) - 1.4; // where the carved panel sits
  const PANEL = { x: XG, y: -3.3, w: 9.2, h: 2.7 };
  const TILE = 3.4;
  const TOP_TILE = 5.5; // the ledge is seen edge-on: a larger, calmer grain
  const top = new THREE.Mesh(new THREE.PlaneGeometry(L, 6), graniteMat(L / TOP_TILE, 6 / TOP_TILE, 0.6, false, true));
  top.rotation.x = -Math.PI / 2;
  top.position.set(X0 + L / 2, 0, FRONT_Z - 3);
  top.receiveShadow = true;
  scene.add(top);
  // Rock displacement: fBm lumps, ridged creases and vertical joints; flat where the panel is dressed.
  const rock = (x, y) => {
    const ridge = (v) => 1 - Math.abs(2 * v - 1);
    let d = 0.55 * ridge(fbm2(x / 3.2, y / 3.8, 5, 4)) + 0.3 * ridge(fbm2(x / 1.1, y / 1.5, 9, 3)) + 0.25 * (fbm2(x / 7, y / 7, 21, 2) - 0.5) - 0.5;
    const jx = Math.round(x / 7.5) * 7.5 + (vn2(Math.round(x / 7.5), 0.5, 13) - 0.5) * 2.5;
    const nearPanel = smooth(clamp((Math.abs(x - PANEL.x) - PANEL.w / 2 - 1.5) / 2));
    d -= 0.4 * Math.exp(-(((x - jx) / 0.22) ** 2)) * smooth(clamp((-y - 0.8) / 2)) * nearPanel;
    d *= smooth(clamp(-y / 0.7)); // meet the top edge cleanly
    const px = Math.max(0, Math.abs(x - PANEL.x) - PANEL.w / 2 - 0.25), py = Math.max(0, Math.abs(y - PANEL.y) - PANEL.h / 2 - 0.25);
    d *= smooth(clamp(Math.hypot(px, py) / 0.5));
    return d;
  };
  const rockGeo = (x0, x1, y0, y1, step) => {
    const nx = Math.round((x1 - x0) / step), ny = Math.round((y1 - y0) / step);
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, nx, ny);
    const p = g.attributes.position;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + cx, y = p.getY(i) + cy;
      // jitter interior vertices so the facets split irregularly, like broken stone, not a grid
      const edge = Math.abs(x - x0) < 1e-3 || Math.abs(x - x1) < 1e-3 || Math.abs(y - y0) < 1e-3 || Math.abs(y - y1) < 1e-3;
      if (!edge) {
        const ix = Math.round((x - x0) / step), iy = Math.round((y - y0) / step);
        x += (hash1(ix * 7919 + iy * 104729 + 1) - 0.5) * step * 0.8;
        y += (hash1(ix * 7919 + iy * 104729 + 2) - 0.5) * step * 0.8;
        p.setX(i, x - cx); p.setY(i, y - cy);
      }
      p.setZ(i, rock(x, y));
    }
    g.computeVertexNormals();
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return g;
  };
  // fine rock near the camera's work, coarse rock beyond
  const nearX0 = XG - 34, nearX1 = XG + 30;
  const cliffNear = new THREE.Mesh(rockGeo(nearX0, nearX1, -DEPTH, 0, 0.26), graniteMat((nearX1 - nearX0) / TILE, DEPTH / TILE, 0.62, true, true));
  cliffNear.position.z = FRONT_Z;
  cliffNear.castShadow = cliffNear.receiveShadow = true;
  scene.add(cliffNear);
  const cliffFar = new THREE.Mesh(rockGeo(X0, nearX0 + 0.01, -DEPTH, 0, 1.0), graniteMat((nearX0 - X0) / TILE, DEPTH / TILE, 0.62, true, true));
  cliffFar.position.z = FRONT_Z;
  scene.add(cliffFar);
  const cliffFar2 = new THREE.Mesh(rockGeo(nearX1 - 0.01, X0 + L, -DEPTH, 0, 1.0), graniteMat((X0 + L - nearX1) / TILE, DEPTH / TILE, 0.62, true, true));
  cliffFar2.position.z = FRONT_Z;
  scene.add(cliffFar2);
  const cliff = cliffNear;
  // a bevelled lip where the top meets the cliff, catching a highlight
  const lip = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.12), graniteMat(L / TOP_TILE, 0.05, 0.6, false, true));
  lip.position.set(X0 + L / 2, -0.04, FRONT_Z - 0.03);
  scene.add(lip);

  // The rule, carved deep into a dressed panel of the bedrock.
  const ins = inscription('21,000,000', gr);
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.w, PANEL.h), new THREE.MeshStandardMaterial({
    map: ins.map, normalMap: ins.normal, normalScale: new THREE.Vector2(2.4, 2.4), roughness: 0.42, metalness: 0,
  }));
  carve.position.set(PANEL.x, PANEL.y, FRONT_Z + 0.01);
  carve.receiveShadow = true;
  scene.add(carve);

  // Light: a cool high key to show the stone; warm glow near the head of the chain.
  const moon = new THREE.DirectionalLight(0xc6d4ff, 0.35);
  moon.position.set(-6, 10, 12);
  scene.add(moon);
  // cold light raking across the rock face from high left, so every lump and the carving throw shadows
  const graze = new THREE.SpotLight(0xd4e0ff, 3.2, 60, 0.42, 0.5, 0);
  graze.position.set(XG - 16, 5, FRONT_Z + 10);
  graze.target.position.set(XG, -4, FRONT_Z);
  graze.castShadow = true;
  graze.shadow.mapSize.set(2048, 2048);
  graze.shadow.bias = -0.0005;
  graze.shadow.normalBias = 0.03;
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
        mineMat.map = mineTex[Math.floor(t * 30) % mineTex.length];
        mineMat.opacity = 0.35 + 0.2 * hash1(Math.floor(t * 30));
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
      graze.intensity = 3.2;
      moon.intensity = 0.35;
      carve.visible = true;
      horizon.position.set(headX(t) - 160, 4, -20);
    },
  };
  return S;
}
