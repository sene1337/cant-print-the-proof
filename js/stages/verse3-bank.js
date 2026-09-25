// Verse 3, "took the bank out the middle": a marble bank stands on a trapdoor in a black lacquer floor.
// The trapdoor drops it into the dark, slams shut, and the orange coin rolls straight through where it stood.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { bitcoinGlyph, edgeText, normalFromHeight } from '../tex.js';
import { canvas, canvasTex, orangeFace, coinMap, Motes } from '../props/verse3-kit.js';
import { clamp, rng, easeIn } from '../util.js';

export const DOOR_W = 2.5, DOOR_D = 1.9;  // trapdoor opening (x, z)
export const BR = 0.55;                   // rolling coin radius

// White marble with grey veins.
function marbleMaps(seed = 8, S = 1024) {
  const R = rng(seed);
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#e9e6df'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, r = 60 + R() * 220;
    const gd = g.createRadialGradient(x, y, 0, x, y, r);
    const v = R() < 0.5 ? '255,255,255' : '150,148,150';
    gd.addColorStop(0, `rgba(${v},0.10)`); gd.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = gd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const vein = (w, a) => {
    let x = R() * S, y = R() * S, ang = -0.6 + (R() - 0.5) * 0.8;
    g.lineWidth = w; g.strokeStyle = `rgba(92,92,100,${a})`;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 140; j++) {
      ang += (R() - 0.5) * 0.5;
      x += Math.cos(ang) * 9; y += Math.sin(ang) * 9;
      g.lineTo(x, y);
      if (R() < 0.04) { g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineWidth = w * (0.5 + R()); }
    }
    g.stroke();
  };
  g.filter = 'blur(2px)'; for (let i = 0; i < 10; i++) vein(5 + R() * 6, 0.12);
  g.filter = 'blur(0.6px)'; for (let i = 0; i < 26; i++) vein(0.8 + R() * 1.6, 0.4);
  g.filter = 'none';
  return { map: canvasTex(c, { repeat: true, aniso: 16 }) };
}

// Flutes around a column, as a normal map (u runs around the circumference).
function fluteNormal() {
  const c = canvas(512, 32), g = c.getContext('2d');
  const n = 20;
  for (let x = 0; x < 512; x++) {
    const v = 0.5 + 0.5 * Math.cos(((x / 512) * n) * Math.PI * 2);
    const k = Math.round(60 + 170 * Math.pow(v, 0.6));
    g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(x, 0, 1, 32);
  }
  const t = normalFromHeight(c, 2.2, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The frieze: BANK cut into the marble.
function friezeMaps(marble) {
  const w = 1024, h = 128;
  const col = canvas(w, h), cg = col.getContext('2d');
  const hgt = canvas(w, h), hg = hgt.getContext('2d');
  cg.drawImage(marble.map.image, 0, 0, w, w, 0, 0, w, w);
  hg.fillStyle = '#fff'; hg.fillRect(0, 0, w, h);
  const font = '700 92px "Cormorant Garamond"';
  for (const gg of [cg, hg]) { gg.font = font; gg.textAlign = 'center'; gg.textBaseline = 'middle'; }
  for (let k = 0; k < 5; k++) { hg.filter = `blur(${(5 - k) * 1.6}px)`; hg.fillStyle = 'rgba(0,0,0,0.32)'; hg.fillText('B A N K', w / 2, h * 0.56); }
  hg.filter = 'none';
  cg.fillStyle = 'rgba(70,68,66,0.75)'; cg.fillText('B A N K', w / 2, h * 0.56 + 2);
  return { map: canvasTex(col), normal: normalFromHeight(hgt, 3, 1) };
}

function buildBank(marble) {
  const G = new THREE.Group();
  const mat = (rx = 1, ry = 1, extra = {}) => {
    const m = marble.map.clone(); m.repeat.set(rx, ry); m.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ map: m, roughness: 0.32, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25, ...extra });
  };
  const stone = mat(1, 1);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; G.add(o); return o; };
  // steps
  add(new RoundedBoxGeometry(2.3, 0.14, 1.7, 2, 0.02), mat(1.2, 0.8), 0, 0.07, 0);
  add(new RoundedBoxGeometry(2.14, 0.14, 1.56, 2, 0.02), mat(1.1, 0.8), 0, 0.21, 0);
  add(new RoundedBoxGeometry(1.98, 0.14, 1.42, 2, 0.02), mat(1, 0.7), 0, 0.35, 0);
  // cella wall and dark bronze doors
  add(new THREE.BoxGeometry(1.6, 1.1, 0.7), stone, 0, 0.97, -0.25);
  const door = add(new THREE.BoxGeometry(0.42, 0.72, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x2a1c10, metalness: 0.9, roughness: 0.4 }), 0, 0.78, 0.115);
  door.castShadow = false;
  // fluted columns with bases and capitals
  const flute = fluteNormal();
  const colMat = mat(0.3, 1.5, { normalMap: flute, normalScale: new THREE.Vector2(0.9, 0.9) });
  const colGeo = new THREE.CylinderGeometry(0.075, 0.085, 1.02, 40, 1);
  const capGeo = new RoundedBoxGeometry(0.23, 0.07, 0.23, 2, 0.015);
  for (let i = 0; i < 6; i++) {
    const x = -0.8 + i * 0.32;
    add(colGeo, colMat, x, 0.95, 0.45);
    add(capGeo, stone, x, 1.495, 0.45);
    add(capGeo, stone, x, 0.455, 0.45);
  }
  // entablature: architrave, carved frieze, cornice
  add(new THREE.BoxGeometry(2.04, 0.12, 1.2), stone, 0, 1.59, 0);
  const fz = friezeMaps(marble);
  add(new THREE.BoxGeometry(2.0, 0.2, 1.16), stone, 0, 1.75, 0);
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.19), new THREE.MeshPhysicalMaterial({ map: fz.map, normalMap: fz.normal, roughness: 0.35, clearcoat: 0.3 }));
  frieze.position.set(0, 1.75, 0.582);
  G.add(frieze);
  add(new RoundedBoxGeometry(2.2, 0.08, 1.3, 2, 0.02), stone, 0, 1.89, 0);
  // pediment
  const tri = new THREE.Shape();
  tri.moveTo(-1.08, 0); tri.lineTo(1.08, 0); tri.lineTo(0, 0.42); tri.lineTo(-1.08, 0);
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), mat(0.5, 0.5));
  ped.position.set(0, 1.93, -0.61);
  ped.castShadow = true;
  G.add(ped);
  return G;
}

export async function verse3BankStage(film) {
  await document.fonts.load('700 92px "Cormorant Garamond"');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.07); // the stage melts into the dark: no horizon line
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 2.5], color: [1, 0.95, 0.88], intensity: 2.2 },
    { pos: [-6, 1.5, 2], size: [0.6, 5], color: [1, 0.8, 0.6], intensity: 2.6 },
    { pos: [6, 1, -2], size: [0.5, 5], color: [0.9, 0.93, 1], intensity: 2.2 },
    { pos: [0, 1.4, 7], size: [6, 3.2], color: [1, 0.9, 0.8], intensity: 1.0 },
    { pos: [-1, 3.2, -6], size: [9, 3.5], color: [1, 0.88, 0.74], intensity: 1.2 },
  ], { top: [0.3, 0.28, 0.26], horizon: [0.06, 0.05, 0.045], bottom: [0.005, 0.004, 0.004] });
  scene.environmentIntensity = 0.9;

  // Hard key from high front-left; warm rim from behind.
  const key = new THREE.SpotLight(0xfff2e0, 60, 40, 0.33, 0.75, 1.6);
  key.position.set(-5, 7.5, 6);
  key.target.position.set(-0.6, 0.4, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb070, 1.6);
  rim.position.set(4, 4, -6);
  scene.add(rim);

  // A black stage floor (no sheen, so only the key's pool and the shadows show) with a trapdoor, built as four slabs round the hole.
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x5a5856, roughness: 1, metalness: 0, specularIntensity: 0, envMapIntensity: 0 });
  const W = 60, hx = DOOR_W / 2, hz = DOOR_D / 2;
  const slab = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), lacquer);
    m.position.set(x, -0.1, z); m.receiveShadow = true; scene.add(m); return m;
  };
  slab(W, W / 2 - hz, 0, -(hz + (W / 2 - hz) / 2));
  slab(W, W / 2 - hz, 0, hz + (W / 2 - hz) / 2);
  slab(W / 2 - hx, DOOR_D, -(hx + (W / 2 - hx) / 2), 0);
  slab(W / 2 - hx, DOOR_D, hx + (W / 2 - hx) / 2, 0);
  // a thin brass inlay round the trapdoor
  const brass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.8, 0.55, 0.25), metalness: 1, roughness: 0.3 });
  for (const [w, d, x, z] of [[DOOR_W + 0.06, 0.03, 0, -hz - 0.015], [DOOR_W + 0.06, 0.03, 0, hz + 0.015], [0.03, DOOR_D, -hx - 0.015, 0], [0.03, DOOR_D, hx + 0.015, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), brass); m.position.set(x, 0.001, z); scene.add(m);
  }
  // the shaft below: black walls so the open door shows a pit
  const pit = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.02, 6, DOOR_D - 0.02), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }));
  pit.position.y = -3.05;
  scene.add(pit);
  // two leaves, hinged at the left and right edges of the opening
  const leaves = [-1, 1].map((sgn) => {
    const pivot = new THREE.Group();
    pivot.position.set(sgn * hx, 0, 0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(hx - 0.004, 0.2, DOOR_D - 0.008), lacquer);
    leaf.position.set(-sgn * (hx / 2), -0.1, 0);
    leaf.receiveShadow = true; leaf.castShadow = true;
    pivot.add(leaf);
    scene.add(pivot);
    return { pivot, sgn };
  });

  const marble = marbleMaps();
  const bank = buildBank(marble);
  scene.add(bank);

  const face = orangeFace(bitcoinGlyph);
  const coin = new Coin({ radius: BR, thickness: 0.12, face, back: face, metal: 'orange', edge: edgeText("CAN'T PRINT THE PROOF"), seed: 41 });
  for (const m of [coin.faceMat, coin.backMat]) { m.roughnessMap = coinMap(face.rough, BR); m.roughness = 1; m.needsUpdate = true; }
  coin.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(coin);

  const dustDrop = new Motes({ count: 260, size: 0.035, color: [0.95, 0.9, 0.82], gain: 1.6 });
  const dustSlam = new Motes({ count: 220, size: 0.03, color: [0.95, 0.9, 0.82], gain: 1.4 });
  scene.add(dustDrop, dustSlam);

  const S = {
    scene, key, rim, bank, coin, leaves,
    fx: { bloom: 0.4, threshold: 1.0, bloomRadius: 0.4, grain: 0.045, vignette: 0.5, tint: [1.02, 1.0, 0.97] },
    update() {
      bank.visible = true; bank.position.set(0, 0, 0); bank.rotation.set(0, 0, 0);
      for (const l of leaves) l.pivot.rotation.set(0, 0, 0);
      coin.visible = false;
      dustDrop.visible = dustSlam.visible = false;
    },
    // tDrop: the trapdoor opens under the bank; tShut: it slams shut; the coin crosses at speed v.
    play(t, { tDrop, tShut, v = 4.5 }) {
      // leaves swing down fast, hang, swing back up and slam
      const open = clamp((t - tDrop) / 0.1), close = clamp((t - (tShut - 0.08)) / 0.08);
      const ang = (Math.PI / 2 * 1.05) * (easeIn(open, 2) * (1 - easeIn(close, 2)));
      const slamBounce = t > tShut ? Math.exp(-(t - tShut) * 18) * Math.sin((t - tShut) * 60) * 0.03 : 0;
      for (const l of leaves) l.pivot.rotation.z = l.sgn * (ang + Math.abs(slamBounce));
      // the bank falls into the pit once the floor is gone, tipping a little
      const fd = Math.max(0, t - tDrop - 0.03);
      bank.position.y = -0.5 * 45 * fd * fd;
      bank.rotation.set(fd * 0.25, 0, fd * 0.18);
      bank.visible = bank.position.y > -3.2;
      dustDrop.visible = t > tDrop;
      if (dustDrop.visible) dustDrop.burst(t - tDrop, [0, 0.05, 0], { power: 0.55, spread: 0.7, up: 0.9, life: 0.7, gravity: 1.2, seed: 3 });
      dustSlam.visible = t > tShut;
      if (dustSlam.visible) dustSlam.burst(t - tShut, [0, 0.03, DOOR_D / 2], { power: 0.6, spread: 0.5, up: 0.5, dir: [0, 0, 0.4], life: 0.6, gravity: 1.5, seed: 5 });
      // the coin rolls in on its edge and over the closed door, to where the bank stood
      const x = -hx + v * (t - tShut);
      coin.visible = x > -7;
      coin.position.set(x, BR, 0.05);
      coin.rotation.set(0, 0.18 + Math.sin(t * 7) * 0.02, 0); // a slight lean of the face toward camera
      coin.rotateZ(-(x / BR));                                 // rolling
    },
  };
  return S;
}
