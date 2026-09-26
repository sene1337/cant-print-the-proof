// VERSE 2 1933: the round bank-vault door. Liberty double eagles roll in through it, it slams on "ten",
// the bolts shoot home, and cell bars drop in front of the lens.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { Dust } from '../props/dust.js';
import { coinFace, edgeText } from '../tex.js';
import { clamp, lerp, hash1, rng, easeIn, easeOut, easeInOut } from '../util.js';
import { clampHot, SoftPoints, pointScale, canvas2d, canvasTex, Pieces } from '../props/verse2-kit.js';

const DEG = Math.PI / 180;
export const DOOR = { R: 2.05, T: 0.62, cy: 2.0, hingeX: -2.32, z: 0.33, openAngle: -100 * DEG };
export const COIN_R = 0.42;
const NCOIN = 6;

// Engine-turned steel: concentric machining rings.
function turnedSteel(size = 1024) {
  const [c, g] = canvas2d(size, size);
  const R = rng(4);
  g.fillStyle = '#b9bdc2'; g.fillRect(0, 0, size, size);
  for (let r = size / 2; r > 0; r -= 2.2) {
    g.strokeStyle = `rgba(${R() < 0.5 ? '255,255,255' : '40,44,50'},${0.05 + R() * 0.09})`;
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(size / 2, size / 2, r, 0, Math.PI * 2); g.stroke();
  }
  return canvasTex(c);
}

function wallTexture() {
  const w = 1024, h = 512;
  const [c, g] = canvas2d(w, h);
  const R = rng(8);
  g.fillStyle = '#35363a'; g.fillRect(0, 0, w, h);
  // riveted steel panels
  for (let x = 0; x <= w; x += 256) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 2, 0, 4, h); }
  for (let y = 0; y <= h; y += 256) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y - 2, w, 4); }
  for (let x = 0; x <= w; x += 256) {
    for (let y = 16; y < h; y += 32) {
      for (const dx of [-12, 12]) { g.fillStyle = 'rgba(200,200,205,0.35)'; g.beginPath(); g.arc(x + dx, y, 3.2, 0, Math.PI * 2); g.fill(); }
    }
  }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 2 + R() * 6, 1); }
  return canvasTex(c, { repeat: true });
}

export async function vaultStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010101);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 4], size: [5, 1.5], color: [0.9, 0.95, 1], intensity: 2.2 },
    { pos: [-6, 2, 3], size: [0.6, 4], color: [0.85, 0.9, 1], intensity: 2.0 },
    { pos: [6, 2, 2], size: [0.6, 4], color: [1, 0.85, 0.6], intensity: 1.6 },
    { pos: [0, 1, -6], size: [4, 1.2], color: [1, 0.7, 0.35], intensity: 2.5 },
    // low and back-right: what the rolling coins' faces mirror from the tracking camera
    { pos: [5, 0.4, -4.5], size: [3, 1.6], color: [1, 0.8, 0.5], intensity: 3.0 },
  ], { top: [0.08, 0.085, 0.09], horizon: [0.03, 0.03, 0.03], bottom: [0.005, 0.005, 0.005] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xdfe8ff, 90, 30, 0.5, 0.6, 2);
  key.position.set(-2.5, 7.5, 6.5);
  key.target.position.set(0, 1.2, 0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  // Warm light inside the vault, aimed down at the gold so it does not leak through the wall onto the door.
  const warm = new THREE.SpotLight(0xffb45a, 16, 9, 0.75, 0.6, 2);
  warm.position.set(0, 3.7, -3.4);
  warm.target.position.set(0, 0, -2.6);
  scene.add(warm, warm.target);
  // short-range glow among the stacks (its range ends before the door and frame)
  const glow = new THREE.PointLight(0xffb040, 22, 3.1, 2);
  glow.position.set(0, 1.3, -2.9);
  scene.add(glow);
  const fill = new THREE.DirectionalLight(0x8090a8, 0.35);
  fill.position.set(4, 3, 6);
  scene.add(fill);
  // A warm light from the camera side for the rolling coins' faces.
  const coinKey = new THREE.SpotLight(0xffdca8, 0, 20, 0.5, 0.7, 2);
  coinKey.position.set(4.5, 2.6, 6.5);
  coinKey.target.position.set(0, 0.4, 2.5);
  scene.add(coinKey, coinKey.target);

  // Floor: dark polished stone.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshPhysicalMaterial({ color: 0x121212, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Wall with the round opening.
  const wshape = new THREE.Shape();
  wshape.moveTo(-9, 0); wshape.lineTo(9, 0); wshape.lineTo(9, 8); wshape.lineTo(-9, 8); wshape.lineTo(-9, 0);
  const hole = new THREE.Path();
  hole.absarc(0, DOOR.cy, DOOR.R - 0.05, 0, Math.PI * 2, true);
  wshape.holes.push(hole);
  const wallTex = wallTexture();
  wallTex.repeat.set(1 / 4, 1 / 4);
  const wallGeo = new THREE.ExtrudeGeometry(wshape, { depth: 0.9, bevelEnabled: false, curveSegments: 96 });
  wallGeo.translate(0, 0, -0.9);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.4 }));
  wall.receiveShadow = true; wall.castShadow = true;
  scene.add(wall);
  const steel = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xc4c8ce, metalness: 1, roughness: 0.3 }), 4);
  const frameRing = new THREE.Mesh(new THREE.TorusGeometry(DOOR.R + 0.06, 0.16, 24, 160), steel);
  frameRing.position.set(0, DOOR.cy, 0.02);
  scene.add(frameRing);

  // Inside: stacks of gold bars in a warm light.
  const barGeo = new RoundedBoxGeometry(0.5, 0.17, 0.24, 2, 0.02);
  const goldMat = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.25 }), 5);
  const stacks = new Pieces(barGeo, goldMat, 220);
  scene.add(stacks);
  stacks.layout(220, (i, d) => {
    const layer = Math.floor(i / 22), k = i % 22;
    const row = Math.floor(k / 11), col = k % 11;
    const side = row === 0 ? -1 : 1;
    if (layer > 8) return false;
    d.position.set(side * (1.3 + (layer % 2) * 0.12) + (col % 2) * 0.02 * side, 0.09 + layer * 0.175, -1.5 - col * 0.27 - (layer % 2) * 0.13);
    d.rotation.set(0, Math.PI / 2 + (hash1(i) - 0.5) * 0.05, 0);
  });
  const vaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshPhysicalMaterial({ color: 0x241a10, roughness: 0.35, clearcoat: 0.5 }));
  vaultFloor.rotation.x = -Math.PI / 2;
  vaultFloor.position.set(0, 0.001, -4.5);
  scene.add(vaultFloor);

  // The door, hinged on the left.
  const hinge = new THREE.Group();
  hinge.position.set(DOOR.hingeX, DOOR.cy, DOOR.z);
  scene.add(hinge);
  const door = new THREE.Group();
  door.position.set(-DOOR.hingeX, 0, 0);
  hinge.add(door);
  const face = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: turnedSteel(), metalness: 1, roughness: 0.34 }), 2.2);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(DOOR.R, DOOR.R, DOOR.T, 128, 1), [steel, face, face]);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  door.add(disc);
  const addRing = (r, tube, z) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 128), steel); m.position.z = z; door.add(m); return m; };
  addRing(1.78, 0.06, DOOR.T / 2);
  addRing(1.0, 0.05, DOOR.T / 2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 48), steel);
  hub.rotation.x = Math.PI / 2; hub.position.z = DOOR.T / 2 + 0.15;
  door.add(hub);
  const wheel = new THREE.Group();
  wheel.position.z = DOOR.T / 2 + 0.28;
  door.add(wheel);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.05, 16), steel);
    spoke.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), steel);
    knob.position.set(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0);
    wheel.add(knob);
  }
  // Locking bolts in the door's edge.
  const bolts = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 20), steel);
    b.userData.a = a;
    door.add(b);
    bolts.push(b);
  }
  const hingeArm = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.4, 0.5, 3, 0.06), steel);
  hingeArm.position.set(0.1, 0, 0);
  hinge.add(hingeArm);
  const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 24), steel);
  hinge.add(hingePin);

  // The coins: 1907 double eagles, LIBERTY walking.
  const eagle = await coinFace('eagle');
  const edge = edgeText('E  PLURIBUS  UNUM');
  const coins = [];
  for (let i = 0; i < NCOIN; i++) {
    const c = new Coin({ radius: COIN_R, thickness: 0.075, face: eagle, back: eagle, metal: 'gold', edge, seed: 90 + i });
    // softer metal and capped glints: the rolling faces must not strobe
    for (const m of [c.faceMat, c.sideMat, c.backMat, c.band?.material]) if (m) { clampHot(m, 2.2); m.roughness = Math.max(m.roughness, 0.34); }
    c.setRelief(0.7);
    if (c.backMat) c.backMat.normalScale.set(0.7, 0.7);
    scene.add(c);
    coins.push(c);
  }

  // Cell bars that drop in front of the lens.
  const iron = clampHot(new THREE.MeshPhysicalMaterial({ color: 0x5a5c60, metalness: 0.9, roughness: 0.32 }), 3);
  const cell = new THREE.Group();
  for (let k = -6; k <= 6; k++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 3.4, 20), iron);
    b.position.set(k * 0.27, 1.7, 0);
    cell.add(b);
  }
  scene.add(cell);

  const NP = 700;
  const puff = new SoftPoints(NP, { color: [0.62, 0.62, 0.63], opacity: 0.9 });
  scene.add(puff);
  const dust = new Dust({ count: 600, size: 0.012, box: [8, 5, 8], color: [0.85, 0.9, 1], gain: 0.6 });
  dust.position.set(0, 2.5, 2.5);
  scene.add(dust);

  const S = {
    scene, hinge, door, wheel, bolts, coins, cell, puff, key, warm, glow, fill, coinKey, floor, wall, stacks, dust, DOOR,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.045, vignette: 0.55, tint: [0.97, 1.0, 1.04] },

    setDoor(angle, boltOut = 0) {
      hinge.rotation.set(0, angle, 0);
      bolts.forEach((b) => {
        const a = b.userData.a, r = DOOR.R - 0.3 + boltOut * 0.4;
        b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        b.rotation.z = a - Math.PI / 2;
      });
    },

    // Coins roll in a line along -z through the doorway. d0 is how far the lead coin has rolled.
    rollAt(t, t0, speed = 3.8, z0 = 5.6, gap = 0.9) {
      coins.forEach((c, i) => {
        const dist = Math.max(0, (t - t0) * speed);
        const z = z0 - dist + i * gap;
        c.visible = z > -3.2;
        const wob = Math.sin(t * 3.5 + i) * 0.03;
        c.position.set(0.05 * Math.sin(i * 1.7), COIN_R + 0.004, z);
        c.rotation.set(wob, Math.PI / 2, (z - z0) / COIN_R);
      });
    },

    // The slam pushes air out of the seam: a fine spray of dust blows outward and forward from the door's edge,
    // mostly along the bottom where it settles, gone in half a second.
    slamDust(t, tHit) {
      const dt = t - tHit;
      puff.visible = dt > 0 && dt < 0.7;
      if (!puff.visible) return;
      puff.layout(NP, (i, o) => {
        const h = (q) => hash1(i * 11 + q);
        // seam position, weighted toward the lower half of the door
        const a = -Math.PI / 2 + (h(1) - 0.5) * Math.PI * (h(2) < 0.7 ? 1.1 : 2);
        const life = 0.25 + h(3) * 0.35;
        if (dt > life) return false;
        const sp = 0.8 + h(4) * 1.6;
        const out = sp * (1 - Math.exp(-dt * 7)) / 7;
        const r = DOOR.R + 0.02 + out;
        o.x = Math.cos(a) * r;
        o.y = Math.max(0.01, DOOR.cy + Math.sin(a) * r - 0.9 * dt * dt);
        o.z = DOOR.z + 0.34 + out * (0.6 + h(5) * 0.8);
        o.size = 0.012 + h(6) * 0.02;
        o.alpha = (1 - dt / life) * (0.25 + 0.45 * h(7));
      }, pointScale(film, film.camera));
    },

    update(ctx) {
      S.setDoor(DOOR.openAngle, 0);
      wheel.rotation.z = 0;
      coins.forEach((c) => { c.visible = false; });
      cell.visible = false;
      cell.position.set(0, 0, 6);
      puff.visible = false;
      warm.intensity = 16;
      glow.intensity = 22;
      coinKey.intensity = 0;
      key.intensity = 90;
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t, [0.02, 0.03, 0]);
    },
  };
  return S;
}
