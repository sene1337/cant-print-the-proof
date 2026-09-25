// Verse 3, "keys you can carry": an orange key on a string turns in front of a full moon over black water.
// A callback to verse 1's cowrie on a string in front of the same moon.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { METALS } from '../props/coin.js';
import { loadImage, TEX, bitcoinGlyph } from '../tex.js';
import { orangeFace, canvas, canvasTex, softSprite, glowCard } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth } from '../util.js';

export const KEY_AT = [0, 1.0, 0];

function discAlpha() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 118, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  return canvasTex(c, { srgb: false });
}

// The moon's light on the water: a soft vertical column of glitter.
function pathTexture() {
  const c = canvas(256, 1024), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 9000; i++) {
    const y = Math.pow(hash1(i * 3 + 1), 0.8) * 1024;
    const spread = 14 + (y / 1024) * 80;
    const x = 128 + (hash1(i * 3 + 2) - 0.5) * 2 * spread * Math.pow(hash1(i * 3 + 3), 0.8);
    const w = 1 + (y / 1024) * 6 * (0.3 + hash1(i * 5)), a = (0.1 + 0.55 * Math.pow(hash1(i * 7), 2)) * (1 - Math.abs(x - 128) / (spread * 1.1));
    if (a <= 0) continue;
    g.fillStyle = `rgba(230,236,240,${a})`;
    g.fillRect(x - w / 2, y, w, 1);
  }
  return canvasTex(c);
}

function buildKey(face) {
  const orange = METALS.orange;
  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.26 });
  const G = new THREE.Group();
  // bow: a ring with a medallion carrying the glyph
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 20, 80), metal);
  G.add(ring);
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.016, 64), [
    metal,
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.38, normalMap: face.normal, normalScale: new THREE.Vector2(1.6, 1.6), map: face.color }),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.38, normalMap: face.normal, normalScale: new THREE.Vector2(1.6, 1.6), map: face.color }),
  ]);
  medal.rotation.set(Math.PI / 2, Math.PI / 2, 0); // the cap's UVs run sideways: turn the glyph upright
  G.add(medal);
  // loop at the top for the cord
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 12, 32), metal);
  loop.position.set(0, 0.098, 0);
  G.add(loop);
  // collar and shaft
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 32), metal);
  collar.position.set(0, -0.098, 0);
  G.add(collar);
  const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 32), metal);
  collar2.position.set(0, -0.125, 0);
  G.add(collar2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.23, 24), metal);
  shaft.position.set(0, -0.225, 0);
  G.add(shaft);
  // bit with teeth
  const bitShape = new THREE.Shape();
  bitShape.moveTo(0, 0); bitShape.lineTo(0.062, 0); bitShape.lineTo(0.062, -0.014); bitShape.lineTo(0.045, -0.014); bitShape.lineTo(0.045, -0.028);
  bitShape.lineTo(0.062, -0.028); bitShape.lineTo(0.062, -0.05); bitShape.lineTo(0.03, -0.05); bitShape.lineTo(0.03, -0.062); bitShape.lineTo(0, -0.062); bitShape.lineTo(0, 0);
  const bit = new THREE.Mesh(new THREE.ExtrudeGeometry(bitShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), metal);
  bit.position.set(0.004, -0.278, -0.007);
  G.add(bit);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), metal);
  tip.position.set(0, -0.342, 0);
  G.add(tip);
  G.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: G, metal };
}

export async function verse3MoonStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // The moon lives in the environment too, so the metal key reflects it.
  scene.environment = studioEnv(film.renderer, [
    { pos: [-12, 4, -46], size: [14, 14], color: [0.95, 0.97, 1], intensity: 3.0 },
    { pos: [4, 2, 6], size: [4, 3], color: [1, 0.72, 0.42], intensity: 0.7 },
    { pos: [-5, 5, 3], size: [3, 1.5], color: [1, 0.85, 0.7], intensity: 1.0 },
  ], { top: [0.03, 0.035, 0.045], horizon: [0.02, 0.022, 0.028], bottom: [0, 0, 0] });
  scene.environmentIntensity = 1.0;

  const moonIm = await loadImage(`${TEX.base}tex/moon.jpg`);
  const moonTex = new THREE.Texture(moonIm);
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.anisotropy = 8; moonTex.needsUpdate = true;
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: moonTex, alphaMap: discAlpha(), transparent: true, depthWrite: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
  moon.renderOrder = -8;
  scene.add(moon);
  const halo = glowCard([0.75, 0.8, 0.9], 1);
  halo.renderOrder = -9;
  scene.add(halo);

  // Black water with the moon's path on it.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.2;
  scene.add(water);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: pathTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.5, 0.52, 0.55) }));
  path.rotation.x = -Math.PI / 2;
  scene.add(path);

  // Stars, sparse.
  const NS = 500;
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) {
    const a = (hash1(i * 3) - 0.5) * 2.4 - 0.2, e = 0.04 + hash1(i * 3 + 1) * 0.7;
    sp[i * 3] = Math.sin(a) * Math.cos(e) * 150; sp[i * 3 + 1] = Math.sin(e) * 150; sp[i * 3 + 2] = -Math.cos(a) * Math.cos(e) * 150;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.1, map: softSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.8, 0.85, 1).multiplyScalar(0.6), sizeAttenuation: true }));
  scene.add(stars);

  const face = orangeFace(bitcoinGlyph, { size: 512 });
  const key = buildKey(face);
  scene.add(key.group);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 3, 8), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.8 }));
  scene.add(cord);

  const moonLight = new THREE.DirectionalLight(0xdfe8ff, 2.4);
  scene.add(moonLight, moonLight.target);
  const warm = new THREE.PointLight(0xffa860, 0.6, 6, 2);
  scene.add(warm);

  const S = {
    scene, moon, halo, water, path, stars, key, cord, moonLight, warm,
    moonAz: -14, moonEl: 7.5, moonSize: 16,
    fx: { bloom: 0.5, threshold: 1.0, bloomRadius: 0.5, grain: 0.05, vignette: 0.55, tint: [1.0, 1.0, 1.0] },
    update(ctx) {
      S.moonAz = -14; S.moonEl = 7.5; S.moonSize = 16;
      key.group.position.set(...KEY_AT);
      key.group.rotation.set(0, 0, 0);
      moonLight.intensity = 2.4;
      warm.intensity = 0.6;
    },
    // Hang the moon on the camera, like verse 1 does: fixed direction and size relative to the view.
    place(cam) {
      const D = 80;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const yaw = Math.atan2(fwd.x, -fwd.z);
      const az = yaw + (S.moonAz * Math.PI) / 180, el = (S.moonEl * Math.PI) / 180;
      const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      moon.position.copy(cam.position).addScaledVector(d, D);
      moon.lookAt(cam.position);
      const size = 2 * D * Math.tan(((S.moonSize / 2) * Math.PI) / 180);
      moon.scale.set(size, size, 1);
      halo.position.copy(moon.position).addScaledVector(d, 1);
      halo.scale.setScalar(size * 2.2);
      halo.material.opacity = 0.12;
      // the path runs across the water from under the moon toward the camera
      const foot = new THREE.Vector3(moon.position.x, -0.19, moon.position.z);
      const toCam = new THREE.Vector3(cam.position.x - foot.x, 0, cam.position.z - foot.z);
      const len = toCam.length();
      path.position.copy(foot).addScaledVector(toCam, 0.5);
      path.position.y = -0.19;
      path.rotation.set(-Math.PI / 2, 0, Math.atan2(toCam.x, toCam.z));
      path.scale.set(size * 0.22, len, 1);
      moonLight.position.copy(key.group.position).addScaledVector(d, 30);
      moonLight.target.position.copy(key.group.position);
      stars.position.copy(cam.position);
    },
    // The key turns on its cord.
    // tFace: when the medallion turns square to the camera.
    hang(t, lt, tFace) {
      const g = key.group;
      g.position.set(KEY_AT[0] + Math.sin(t * 1.1) * 0.004, KEY_AT[1], KEY_AT[2]);
      g.rotation.set(0.03 * Math.sin(t * 1.7), -0.12 + (t - tFace) * 0.6, 0.04 * Math.sin(t * 1.3 + 1));
      cord.position.set(g.position.x, g.position.y + 0.105 + 1.5, g.position.z);
      warm.position.set(g.position.x + 0.5, g.position.y + 0.1, g.position.z + 0.6);
    },
  };
  return S;
}
