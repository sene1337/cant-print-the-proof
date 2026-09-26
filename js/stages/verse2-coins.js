// VERSE 2 coin studio: the shears that clip the coin, the tin that creeps in, and the row of emperors.
// Same studio look as the shared gold stage (copied env and lights) so the coin reads as the same coin.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { Dust } from '../props/dust.js';
import { coinFace, edgeText } from '../tex.js';
import { clamp, hash1, rng, lerp, smooth, easeOut, easeIn, easeInOut } from '../util.js';
import { noiseField, tinUniforms, patchTin, clampHot, Pieces, canvas2d, canvasTex } from '../props/verse2-kit.js';

const DEG = Math.PI / 180;
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
const R = 1, TH = 0.16, BEVEL = TH * 0.18;
const RISER_H = 0.9;
export const COIN_Y = RISER_H + TH / 2 + 0.005;

// Cut 0 is the nick from verse 1 (the shared coin's first notch). Cuts 1-3 are clean chords taken by the shears.
const chord = (aDeg, d) => ({ a: aDeg * DEG, d, w: Math.acos(1 - d) + 0.4 * DEG });
export const CUTS = [
  { a: 184.2 * DEG, w: 14.5 * DEG, d: 0.117 },
  chord(90, 0.15),
  chord(330, 0.16),
  chord(240, 0.13),
];
// Song times the shear blades close (beat, "clipped", "edges").
export const SNIPS = [50.933, 52.16, 52.82];
// The shears always cut at this world angle (far right as the wide camera sees it); the coin turns to meet them.
export const CUT_DIR = 60 * DEG;
const presentAngle = (j) => CUT_DIR - CUTS[j].a;
// A point in the cutting rig's frame (+x = outward through the cut) in world space.
export function rigPoint(x, y, z) {
  const c = Math.cos(CUT_DIR), s = Math.sin(CUT_DIR);
  return [x * c + z * s, y, -x * s + z * c];
}

function clipShape(n) {
  const s = new THREE.Shape();
  const N = 720;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let rr = R;
    for (let j = 0; j < n; j++) {
      const c = CUTS[j];
      const da = Math.abs(((a - c.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < c.w) rr = Math.min(rr, (R * (1 - c.d)) / Math.cos(da));
    }
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

const EXTRUDE = { depth: TH - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.9, bevelSegments: 4, curveSegments: 1 };

function coinGeo(n) {
  const g = new THREE.ExtrudeGeometry(clipShape(n), EXTRUDE);
  g.translate(0, 0, -(TH - BEVEL * 2) / 2);
  g.computeVertexNormals();
  return g;
}

// The piece a chord cut removes: the circular segment beyond the chord. Centred on its centroid.
function chunkGeo(j) {
  const c = CUTS[j];
  const s = new THREE.Shape();
  const flat = R * (1 - c.d);
  const half = Math.acos(1 - c.d);
  const M = 48;
  for (let i = 0; i <= M; i++) {
    const a = c.a - half + (2 * half * i) / M;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.lineTo(Math.cos(c.a - half) * R, Math.sin(c.a - half) * R);
  const g = new THREE.ExtrudeGeometry(s, EXTRUDE);
  g.translate(0, 0, -(TH - BEVEL * 2) / 2);
  const cen = new THREE.Vector2(Math.cos(c.a), Math.sin(c.a)).multiplyScalar((flat + R) / 2 + 0.02);
  g.translate(-cen.x, -cen.y, 0);
  g.computeVertexNormals();
  return { geo: g, cen };
}

// ------------------------------------------------------------------ shears
function jawShape(sign) {
  // Upper jaw above the cutting line (sign = 1), lower jaw below (sign = -1). Pivot at the origin, tip toward +x.
  const s = new THREE.Shape();
  const P = (x, y) => [x, y * sign];
  s.moveTo(...P(-0.34, 0));
  s.lineTo(...P(1.7, 0));
  s.quadraticCurveTo(...P(1.52, 0.1), ...P(1.05, 0.2));
  s.quadraticCurveTo(...P(0.55, 0.3), ...P(0.12, 0.34));
  s.quadraticCurveTo(...P(-0.34, 0.34), ...P(-0.34, 0));
  return s;
}

// Brushed-steel roughness streaks along the blade (x).
function brushed() {
  const [c, g] = canvas2d(512, 128);
  const R = rng(77);
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 900; i++) {
    const y = R() * 128, v = Math.round(150 + R() * 105);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(R() * 512 - 100, y, 60 + R() * 400, R() < 0.8 ? 1 : 2);
  }
  const t = canvasTex(c, { srgb: false, repeat: true });
  t.repeat.set(1.5, 4);
  return t;
}

// Fine wear on the steel: faint scratches and a slightly tarnished patch near the pivot (colour; 1 = clean).
function wear() {
  const W = 512, H = 128;
  const [c, g] = canvas2d(W, H);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  const smudge = g.createRadialGradient(40, 64, 4, 40, 64, 150);
  smudge.addColorStop(0, 'rgba(120,112,100,0.35)'); smudge.addColorStop(1, 'rgba(120,112,100,0)');
  g.fillStyle = smudge; g.fillRect(0, 0, W, H);
  const R = rng(91);
  for (let i = 0; i < 70; i++) {
    const x = R() * W, y = R() * H, len = 20 + R() * 120, a = (R() - 0.5) * 0.5;
    g.strokeStyle = `rgba(${R() < 0.5 ? '90,90,90' : '255,255,255'},${0.08 + R() * 0.12})`;
    g.lineWidth = R() < 0.8 ? 0.8 : 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  const t = canvasTex(c, { repeat: true });
  t.repeat.set(1.1, 3);
  return t;
}

// Tailor's shears: polished steel blades with a ground bevel along each cutting edge, a domed slotted pivot screw on a
// washer, and black-enamelled handles with finger bows. Pivot at the origin, blades toward +x, cut line at y = 0.
export function buildShears() {
  const steel = clampHot(new THREE.MeshPhysicalMaterial({
    color: 0xd9dce0, map: wear(), metalness: 1, roughness: 0.15, roughnessMap: brushed(), anisotropy: 0.6,
  }), 3.5);
  const polished = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.07 }), 3.5);
  const japan = clampHot(new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }), 3);
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const T = 0.075, B = 0.02;
  const G = new THREE.Group();
  const pieces = [];
  for (const sign of [1, -1]) {
    const piece = new THREE.Group();
    const jaw = new THREE.Mesh(new THREE.ExtrudeGeometry(jawShape(sign), { depth: T - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: 0.018, bevelSegments: 3, curveSegments: 32 }), steel);
    jaw.position.z = sign > 0 ? 0.004 + B : -0.004 - T + B;
    jaw.castShadow = true;
    piece.add(jaw);
    // the ground bevel: a narrow facet along the cutting edge, tilted 25 degrees off the blade's face, so it mirrors a
    // different part of the room than the face does: the bright line along a sharpened edge
    const zOut = sign > 0 ? 0.004 + T + 0.002 : -0.004 - T - 0.002;
    const ground = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 0.004), polished);
    ground.position.set(0.72, 0.032 * sign, zOut);
    ground.rotation.x = sign * 25 * Math.PI / 180;
    ground.userData.groundEdge = true;
    piece.add(ground);
    // enamelled handle: a short curved shank from the pivot boss to a finger bow (tailor's-shears proportions)
    const zMid = sign * (0.004 + T / 2);
    const pts = [[-0.22, -0.02], [-0.55, -0.1], [-0.85, -0.22], [-1.02, -0.3]].map(([x, y]) => new THREE.Vector3(x, y * sign, zMid));
    const shank = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.065, 12, false), japan);
    shank.scale.z = 0.8;
    shank.castShadow = true;
    piece.add(shank);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(sign > 0 ? 0.2 : 0.26, 0.055, 14, 48), japan);
    bow.position.set(sign > 0 ? -1.2 : -1.28, (sign > 0 ? -0.4 : -0.46) * sign, zMid);
    bow.scale.set(sign > 0 ? 1.1 : 1.35, 1, 1);
    bow.castShadow = true;
    piece.add(bow);
    G.add(piece);
    pieces.push(piece);
  }
  // pivot: a domed, slotted screw head on a washer, the same on both sides
  for (const side of [1, -1]) {
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 40), steel);
    washer.rotation.x = Math.PI / 2;
    washer.position.z = side * (0.004 + T + 0.006);
    G.add(washer);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), polished);
    head.rotation.x = side * Math.PI / 2;
    head.scale.set(1, 0.45, 1);
    head.position.z = side * (0.004 + T + 0.012);
    G.add(head);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.03), dark);
    slot.position.z = side * (0.004 + T + 0.074);
    slot.rotation.z = 0.5;
    G.add(slot);
  }
  return { group: G, upper: pieces[0], lower: pieces[1] };
}

export async function coinsStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 1.5], size: [6, 2.5], color: [1, 0.9, 0.78], intensity: 2.2 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.82, 0.62], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [1, 0.92, 0.8], intensity: 2.4 },
    { pos: [0, 0.4, -6], size: [7, 0.3], color: [1, 0.62, 0.3], intensity: 2.0 },
  ], { top: [0.55, 0.47, 0.38], horizon: [0.12, 0.09, 0.06], bottom: [0.01, 0.008, 0.006] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xffe2b0, 9, 30, 0.6, 1.0, 1.5);
  key.position.set(-4.5, 4.2 + RISER_H, 1.5);
  key.target.position.set(0, RISER_H, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  scene.add(key, key.target);
  // Back light kept high so its mirror image off the coin face never lands in these cameras.
  const rim = new THREE.DirectionalLight(0xffb86b, 1.8);
  rim.position.set(-2.5, 7 + RISER_H, -4.5);
  scene.add(rim);

  const field = noiseField(256, 21);

  // The hero coin, same face and edge as the shared gold stage's coin.
  const face = await coinFace('stater');
  const coin = new Coin({ radius: R, thickness: TH, face, metal: 'gold', edge: edgeText("CAN'T PRINT THE PROOF"), seed: 11 });
  coin.band.visible = false;
  const geos = [0, 1, 2, 3, 4].map((n) => coinGeo(n));
  const tinU = tinUniforms(field);
  patchTin(coin.faceMat, tinU);
  patchTin(coin.sideMat, tinU);
  clampHot(coin.faceMat, 6);
  clampHot(coin.sideMat, 6);
  CUTS.forEach((c, j) => {
    const r = R * (1 - c.d * 0.5);
    tinU.uWounds.value[j].set(Math.cos(c.a) * r, Math.sin(c.a) * r, 0, 1);
  });
  const turn = new THREE.Group();
  turn.position.set(0, COIN_Y, 0);
  coin.rotation.set(-Math.PI / 2, 0, 0);
  turn.add(coin);
  scene.add(turn);

  // The cutting rig: shears, falling pieces and shavings, in a frame whose +x points out through the cut.
  const rig = new THREE.Group();
  rig.rotation.y = CUT_DIR;
  scene.add(rig);
  // flash safety: the falling pieces are capped so they cannot pop bright through the frame
  const chunkFace = clampHot(new THREE.MeshPhysicalMaterial({ color: coin.base.clone(), metalness: 1, roughness: 0.4, map: coin.faceMat.map, normalMap: coin.faceMat.normalMap }), 1.2);
  const chunkSide = clampHot(new THREE.MeshPhysicalMaterial({ color: coin.base.clone(), metalness: 1, roughness: 0.42 }), 1.2);
  const chunks = [1, 2, 3].map((j) => {
    const { geo, cen } = chunkGeo(j);
    const m = new THREE.Mesh(geo, [chunkFace, chunkSide]);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.r = cen.length();
    rig.add(m);
    return m;
  });

  // Riser and floor.
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.35, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), lacquer);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, RISER_H, 64), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.35 }));
  riser.position.y = RISER_H / 2;
  riser.castShadow = true; riser.receiveShadow = true;
  scene.add(riser);

  const shears = buildShears();
  // flash safety: the thin polished edge lines swept the same cells on every snip as one-frame pops. Here the
  // edge is a narrower, satin strip, and the whole tool's highlights are capped.
  const edgeMat = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, metalness: 1, roughness: 0.1 }), 1.4);
  shears.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.groundEdge) { o.material = edgeMat; o.scale.y = 0.6; } else clampHot(o.material, 1.8);
  });
  rig.add(shears.group);

  // Gold shavings: small bright slivers thrown off each cut.
  // flash safety: a few dull shavings, not a spray of sparkles
  const NSH = 14;
  const shavMat = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.74, 0.32), metalness: 1, roughness: 0.5 }), 1.0);
  const shav = new Pieces(new THREE.BoxGeometry(1, 1, 1), shavMat, NSH * SNIPS.length);
  shav.castShadow = false;
  rig.add(shav);

  // The emperors: a row of silver denarii, each one smaller, more clipped and greyer.
  const dface = await coinFace('denarius');
  const ROW = 4;
  const row = [];
  for (let i = 0; i < ROW; i++) {
    const c = new Coin({ radius: R, thickness: TH, face: dface, metal: 'silver', seed: 40 + i * 3 });
    c.setClip([0, 0.24, 0.47, 0.72][i]);
    // Silver debased toward bronze, as late Roman coins were (a silver wash over copper).
    const k = [0, 0.33, 0.66, 0.97][i];
    const col = new THREE.Color(0.93, 0.92, 0.88).lerp(new THREE.Color(0.42, 0.26, 0.15), k);
    for (const m of [c.faceMat, c.sideMat]) { m.color.copy(col); m.roughness = 0.38 + k * 0.25; }
    // flash safety: soft glints and gentler relief, so the faces do not flicker as the camera pans
    clampHot(c.faceMat, 2.0); clampHot(c.sideMat, 2.0);
    c.setRelief(0.75);
    c.userData.s = [1, 0.88, 0.76, 0.64][i];
    c.visible = false;
    scene.add(c);
    row.push(c);
  }

  const dust = new Dust({ count: 500, size: 0.009, box: [9, 6, 9], gain: 0.7 });
  scene.add(dust);

  // Turntable angle at song time t: settles to cut 1, then turns to cuts 2 and 3 between the snips.
  function turnAngle(t) {
    const th1 = presentAngle(1);
    let th2 = presentAngle(2), th3 = presentAngle(3);
    while (th2 < th1) th2 += Math.PI * 2;
    while (th3 < th2) th3 += Math.PI * 2;
    if (t < SNIPS[0]) return lerp(th1 - 0.9, th1, easeOut(clamp((t - 49.9) / 0.75), 2.5));
    if (t < SNIPS[1]) return lerp(th1, th2, easeInOut(clamp((t - SNIPS[0] - 0.3) / 0.62)));
    if (t < SNIPS[2]) return lerp(th2, th3, easeInOut(clamp((t - SNIPS[1] - 0.16) / 0.42)));
    return th3 + (t - SNIPS[2]) * 0.0;
  }
  function cutsDone(t) {
    let n = 1;
    for (const s of SNIPS) if (t >= s) n++;
    return n;
  }

  const S = {
    scene, coin, turn, rig, chunks, shears, shav, row, riser, floor, key, rim, dust, tinU, CUTS, SNIPS,
    fx: { bloom: 0.32, threshold: 1.1, bloomRadius: 0.35, grain: 0.04, vignette: 0.5, tint: [1.02, 0.98, 0.92] },

    // The whole clipping sequence as a function of song time.
    clipAt(t, { shearsOn = true } = {}) {
      const n = cutsDone(t);
      coin.mesh.geometry = geos[n];
      turn.rotation.y = turnAngle(t);
      // Falling pieces (rig frame): the closing blade pushes each piece down; it tips outward over the cut line,
      // drops straight to the floor, bounces once and lies flat.
      chunks.forEach((m, k) => {
        const j = k + 1, ts = SNIPS[k];
        const dt = t - ts;
        m.visible = dt >= 0;
        if (!m.visible) return;
        const r = m.userData.r;
        const g = 24, vy = -1.2, dy = COIN_Y - TH / 2;
        const tf = (vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
        const vout = 0.12 + hash1(j * 7) * 0.08;   // drops nearly straight down beside the riser
        const side = (hash1(j * 11) - 0.5) * 0.5;
        let y, flip, slide;
        if (dt < tf) {
          y = COIN_Y + vy * dt - 0.5 * g * dt * dt;
          flip = Math.PI * easeIn(dt / tf, 1.6);
          slide = vout * dt;
        } else {
          const b = dt - tf, tb = 0.16;
          y = TH / 2 + (b < tb ? Math.sin((Math.PI * b) / tb) * 0.05 : 0);
          flip = Math.PI + (b < tb ? Math.sin((Math.PI * b) / tb) * 0.1 : 0);
          slide = vout * tf + (vout * 0.5) * (1 - Math.exp(-6 * b)) / 6;
        }
        m.position.set(r + slide, y, side * Math.min(dt, 0.4));
        const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -CUTS[j].a);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2));
        m.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -flip).multiply(q));
      });
      // Shavings.
      shav.visible = true;
      shav.layout(NSH * SNIPS.length, (i, d) => {
        const k = Math.floor(i / NSH), ts = SNIPS[k], dt = t - ts;
        if (dt < 0) return false;
        const h = (q) => hash1(i * 13 + q);
        const zc = (h(1) - 0.5) * 0.9;
        const x0 = R * (1 - CUTS[k + 1].d), y0 = COIN_Y;
        const vx = 0.2 + h(2) * 0.7, vy = h(3) * 0.6 - 0.3, vz = (h(4) - 0.5) * 0.9;
        const g = 14;
        const tl = (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g;
        const tt = Math.min(dt, tl);
        d.position.set(x0 + vx * tt, Math.max(0.004, y0 + vy * tt - 0.5 * g * tt * tt), zc + vz * tt);
        const spin = dt < tl ? dt * (8 + h(5) * 20) : tl * (8 + h(5) * 20);
        d.rotation.set(dt < tl ? spin : 0, h(6) * 6.28 + spin * 0.3, dt < tl ? spin * 0.7 : 0);
        const s = 0.5 + h(7);
        d.scale.set(0.05 * s, 0.006, 0.014 * s);
      });
      // Shears.
      shears.group.visible = shearsOn;
      if (shearsOn) {
        let close = 0;
        SNIPS.forEach((s, k) => {
          const a = t - s;
          const last = k === SNIPS.length - 1;   // after the last bite the shears stay shut (no extra sweep before the cut)
          if (a > -0.13 && a <= 0) close = Math.max(close, easeIn(1 + a / 0.13, 2));
          else if (a > 0 && (last || a < 0.3)) close = Math.max(close, last || a < 0.06 ? 1 : 1 - easeOut((a - 0.06) / 0.24, 2));
        });
        const open = (1 - close) * 24 * DEG;
        shears.upper.rotation.z = open;
        shears.lower.rotation.z = -open;
        // cutting plane follows the chord of the next cut; the shears come in, then leave.
        let d = CUTS[1].d;
        if (t >= SNIPS[0] + 0.3) d = lerp(CUTS[1].d, CUTS[2].d, clamp((t - SNIPS[0] - 0.3) / 0.6));
        if (t >= SNIPS[1] + 0.2) d = lerp(CUTS[2].d, CUTS[3].d, clamp((t - SNIPS[1] - 0.2) / 0.3));
        const approach = 1 - easeOut(clamp((t - 49.96) / 0.8), 2.2);
        const leave = easeIn(clamp((t - SNIPS[2] - 0.6) / 0.5), 2);   // only after the cut to the next shot
        // back off while the coin turns to the next cut, so the turning rim never meets the jaws
        let back = 0;
        for (let k = 0; k < SNIPS.length - 1; k++) {
          const a0 = SNIPS[k] + 0.08, a1 = SNIPS[k + 1] - 0.14;
          back = Math.max(back, Math.sin(Math.PI * clamp((t - a0) / (a1 - a0))));
        }
        const x = R * (1 - d) + approach * 2.6 + leave * 3.0 + back * 0.22;
        // pivot level with the coin's underside: the closed blades meet under the coin, never inside it
        shears.group.position.set(x, COIN_Y - TH / 2 - 0.004, -1.1 - approach * 1.2 - leave * 1.5);
        shears.group.rotation.set(0, -Math.PI / 2, 0);
        // mirrored so the descending blade sits outside the cut line, over the piece being removed
        shears.group.scale.set(1, 1, -1);
      }
    },

    // The emperors' row: coins lying in a line, each smaller, more clipped, greyer. Returns the x of coin i.
    rowAt() {
      coin.visible = false;
      riser.visible = false;
      // centred on x = 0: from the first coin's outer edge to the last coin's
      const gap = 0.3;
      const span = row.reduce((a, c) => a + 2 * R * c.userData.s, 0) + gap * (row.length - 1);
      let x = -span / 2 + R * row[0].userData.s;
      row.forEach((c, i) => {
        const k = c.userData.s;
        if (i > 0) x += (row[i - 1].userData.s + k) * R + gap;
        c.userData.x = x;
        c.visible = true;
        c.scale.setScalar(k);
        // Laid out toward -x and turned 180 degrees: seen from the far side, where the faces mirror the top soft box.
        c.position.set(-x, (TH / 2) * k + 0.002, 0);
        c.rotation.set(-Math.PI / 2, 0, Math.PI + (hash1(i * 5 + 1) - 0.5) * 0.25);
      });
      return row.map((c) => c.userData.x);
    },

    update(ctx) {
      coin.visible = true;
      turn.position.set(0, COIN_Y, 0);
      turn.rotation.set(0, 0, 0);
      coin.mesh.geometry = geos[1];
      coin.setRelief(1);
      coin.faceMat.roughness = 0.2;
      coin.setEmissive([0, 0, 0], 0);
      tinU.uTin.value = -1;
      chunks.forEach((m) => { m.visible = false; });
      shears.group.visible = false;
      shav.visible = false;
      riser.visible = true;
      floor.visible = true;
      lacquer.clearcoat = 0.6;
      for (const c of row) c.visible = false;
      key.intensity = 9;
      key.color.set(0xffe2b0);
      key.position.set(-4.5, 4.2 + RISER_H, 1.5);
      key.target.position.set(0, RISER_H, 0);
      key.angle = 0.6;
      rim.intensity = 1.8;
      rim.position.set(-2.5, 7 + RISER_H, -4.5);
      rim.color.set(0xffb86b);
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
  };
  return S;
}
