// The monument: "21,000,000" cast in solid metal. The chorus's answer to endless paper.
// Chorus 1 raises it, chorus 2 throws the storm at it, chorus 3 sets it at world scale at dawn.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { banknote } from '../tex.js';
import { hash1, clamp } from '../util.js';

// Build extruded glyph geometry from outlines in data/glyphs.json (Playfair Display Black, OFL).
function glyphGeometry(g, scale, depth, bevel) {
  const path = new THREE.ShapePath();
  const s = scale / 1000;
  for (const c of g.cmds) {
    if (c[0] === 'M') path.moveTo(c[1] * s, c[2] * s);
    else if (c[0] === 'L') path.lineTo(c[1] * s, c[2] * s);
    else if (c[0] === 'Q') path.quadraticCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s);
    else if (c[0] === 'C') path.bezierCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s, c[5] * s, c[6] * s);
  }
  const shapes = path.toShapes(false);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildNumerals(glyphs, text, { scale = 2.2, depth = 0.45, bevel = 0.05, material }) {
  const group = new THREE.Group();
  const parts = [];
  let x = 0;
  for (const ch of text) {
    const g = glyphs.glyphs[ch];
    const mesh = new THREE.Mesh(glyphGeometry(g, scale, depth, bevel), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.x = x;
    holder.userData = { ch, x0: x, w: (g.advance * scale) / 1000 };
    group.add(holder);
    parts.push(holder);
    x += (g.advance * scale) / 1000;
  }
  // centre horizontally
  for (const p of parts) { p.position.x -= x / 2; p.userData.x0 -= x / 2; }
  group.userData.width = x;
  return { group, parts };
}

const BASE = 0.62; // baseline height above the floor: comma tails hang below it

export async function monumentStage(film) {
  const glyphs = await (await fetch('./data/glyphs.json')).json();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.02);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 7, 3], size: [8, 2], color: [1, 0.85, 0.66], intensity: 2.4 },
    { pos: [-7, 1.5, 2], size: [0.6, 6], color: [1, 0.7, 0.4], intensity: 3.0 },
    { pos: [7, 1, -2], size: [0.5, 6], color: [1, 0.9, 0.8], intensity: 2.2 },
    { pos: [0, 0.5, -7], size: [10, 0.4], color: [1, 0.55, 0.2], intensity: 2.4 },
  ], { top: [0.34, 0.26, 0.18], horizon: [0.1, 0.07, 0.04], bottom: [0.01, 0.008, 0.006] });

  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.96, 0.44, 0.07), metalness: 1, roughness: 0.26, clearcoat: 0.3, clearcoatRoughness: 0.15 });
  const { group: numerals, parts } = buildNumerals(glyphs, '21,000,000', { material: metal });
  scene.add(numerals);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(400, 96), new THREE.MeshPhysicalMaterial({ color: 0x060504, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.3, envMapIntensity: 0.04 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new THREE.SpotLight(0xffe0b8, 60, 60, 0.5, 0.7, 1.4);
  key.position.set(-5, 9, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff8a3a, 2.2);
  rim.position.set(4, 3, -6);
  scene.add(rim);
  // A light that sweeps across the face on "That's the truth".
  const sweep = new THREE.SpotLight(0xfff0d8, 0, 40, 0.18, 0.6, 1.2);
  scene.add(sweep, sweep.target);

  // Dawn, for the last chorus: a sky dome and a low sun behind the numerals.
  const skyGeo = new THREE.SphereGeometry(900, 48, 24);
  const sc = [];
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) / 900, z = sp.getZ(i) / 900;
    const h = Math.max(0, y);
    const toSun = Math.max(0, -z); // sun sits toward -z
    const r = 0.02 + 0.55 * Math.pow(1 - h, 6) * (0.5 + 0.5 * toSun) + 0.02 * (1 - h);
    const g = 0.02 + 0.26 * Math.pow(1 - h, 7) * (0.4 + 0.6 * toSun) + 0.03 * (1 - h);
    const b = 0.06 + 0.12 * Math.pow(1 - h, 3) - 0.04 * toSun * Math.pow(1 - h, 6);
    sc.push(r, g, Math.max(0.02, b));
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 256;
  const sg = sunCanvas.getContext('2d');
  const grd = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,210,1)'); grd.addColorStop(0.12, 'rgba(255,200,120,0.9)'); grd.addColorStop(0.4, 'rgba(255,140,50,0.25)'); grd.addColorStop(1, 'rgba(255,120,40,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), color: new THREE.Color(3, 2.4, 1.8), transparent: true, depthWrite: false, fog: false }));
  sun.scale.setScalar(260);
  sun.position.set(0, 40, -800);
  scene.add(sun);
  const dawnLight = new THREE.DirectionalLight(0xffa860, 0);
  dawnLight.position.set(0, 2, -10);
  scene.add(dawnLight);

  const cloud = new NoteCloud(await banknote({ seed: 17 }), 2600, { emissive: 0.06 });
  scene.add(cloud);
  const dust = new Dust({ count: 900, size: 0.02, box: [16, 6, 12], color: [1, 0.75, 0.45], gain: 0.9 });
  scene.add(dust);

  return {
    BASE, scene, numerals, parts, metal, floor, key, rim, sweep, sky, sun, dawnLight, cloud, dust,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.45, grain: 0.04, vignette: 0.45, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      numerals.visible = true;
      numerals.position.set(0, BASE, 0);
      numerals.rotation.set(0, 0, 0);
      numerals.scale.setScalar(1);
      for (const p of parts) { p.position.set(p.userData.x0, 0, 0); p.rotation.set(0, 0, 0); p.scale.setScalar(1); p.visible = true; }
      floor.visible = true;
      key.position.set(-5, 9, 9); key.target.position.set(0, 1, 0); key.intensity = 60; key.distance = 60; key.angle = 0.5;
      rim.intensity = 2.2; rim.color.set(0xff8a3a);
      sweep.intensity = 0;
      sky.visible = false; sun.visible = false; dawnLight.intensity = 0;
      scene.fog.density = 0.02;
      scene.background.set(0x000000);
      scene.environmentIntensity = 1.0;
      cloud.visible = false;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
    // Lay out the storm hitting the numerals: notes fly in from the camera side, strike, and fall.
    storm(t, t0, { n = 900, speed = 9, spread = 7 } = {}) {
      cloud.visible = true;
      cloud.setTime(t);
      cloud.setFlutter(1);
      const W = numerals.userData.width;
      cloud.layout(n, (i, d) => {
        const r1 = hash1(i * 5 + 1), r2 = hash1(i * 5 + 2), r3 = hash1(i * 5 + 3), r4 = hash1(i * 5 + 4);
        const born = t0 + r1 * 2.6;
        const a = t - born;
        if (a < 0) return false;
        const x = (r2 - 0.5) * (W + 2), y = BASE + 0.1 + r3 * 1.6;
        const z0 = 9 + r4 * spread;
        const hitT = (z0 - 0.4) / speed;
        let z, yy = y, xx = x, rx, ry, rz;
        if (a < hitT) { z = z0 - speed * a; rx = a * 5 + i; ry = a * 3; rz = a * 2 + i; }
        else {
          const b = a - hitT; // after the hit: stop, slide down, flutter off to the side
          z = 0.4 + b * 0.8; yy = Math.max(0.02, y - 4.9 * b * b); xx = x + (r2 - 0.5) * b * 3;
          rx = hitT * 5 + i + b * 2; ry = hitT * 3 + b; rz = hitT * 2 + i + b * 4;
        }
        d.position.set(xx, yy, z);
        d.rotation.set(rx, ry, rz);
        d.scale.setScalar(0.26);
      });
    },
  };
}
