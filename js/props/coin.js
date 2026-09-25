// A struck coin: extruded disc with a relief face, a lettered edge, and a shape that can be clipped.
import * as THREE from 'three';
import { rng, clamp } from '../util.js';

export const METALS = {
  gold: { color: [1.0, 0.72, 0.3], roughness: 0.2 },
  silver: { color: [0.93, 0.92, 0.88], roughness: 0.25 },
  tin: { color: [0.36, 0.36, 0.34], roughness: 0.62 },
  orange: { color: [0.97, 0.36, 0.035], roughness: 0.22 },
  bronze: { color: [0.62, 0.34, 0.16], roughness: 0.4 },
};

const geoCache = new Map();

function coinShape(R, clip, seed) {
  const s = new THREE.Shape();
  const N = 720;
  const r = rng(seed);
  const notches = [];
  for (let i = 0; i < 9; i++) notches.push({ a: r() * Math.PI * 2, w: 0.12 + r() * 0.25, d: 0.05 + r() * 0.11, at: i / 9 });
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let rr = R;
    for (const n of notches) {
      const k = clamp((clip - n.at) * 9);
      if (k <= 0) continue;
      let da = Math.abs(((a - n.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < n.w) {
        // A flat chord cut, like shears taking a sliver off the edge.
        const flat = R * (1 - n.d * k);
        const chord = flat / Math.cos(da);
        rr = Math.min(rr, chord);
      }
    }
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

function coinGeometry(R, T, clip, seed) {
  const q = Math.round(clip * 36) / 36;
  const key = `${R}|${T}|${q}|${seed}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const bevel = T * 0.18;
  const g = new THREE.ExtrudeGeometry(coinShape(R, q, seed), {
    depth: T - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelOffset: -bevel * 0.9, bevelSegments: 4, curveSegments: 1,
  });
  g.translate(0, 0, -(T - bevel * 2) / 2);
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

function faceTex(t, R) {
  if (!t) return null;
  const c = t.clone();
  c.repeat.set(1 / (2 * R), 1 / (2 * R));
  c.offset.set(0.5, 0.5);
  c.needsUpdate = true;
  return c;
}

export class Coin extends THREE.Group {
  constructor({ radius = 1, thickness = 0.14, face, back, metal = 'gold', edge = null, seed = 7, env = null } = {}) {
    super();
    this.R = radius; this.T = thickness; this.seed = seed;
    this.clip = 0;
    const m = METALS[metal];
    this.base = new THREE.Color().setRGB(...m.color);
    this.faceMat = new THREE.MeshPhysicalMaterial({
      color: this.base.clone(), metalness: 1, roughness: m.roughness,
      normalMap: faceTex(face?.normal, radius), normalScale: new THREE.Vector2(1, 1),
      map: faceTex(face?.color, radius),
      envMapIntensity: 1.0,
    });
    this.sideMat = new THREE.MeshPhysicalMaterial({ color: this.base.clone(), metalness: 1, roughness: m.roughness + 0.05 });
    if (env) { this.faceMat.envMap = env; this.sideMat.envMap = env; }
    this.mesh = new THREE.Mesh(coinGeometry(radius, thickness, 0, seed), [this.faceMat, this.sideMat]);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.add(this.mesh);
    if (back) {
      // A second face on the reverse, slightly proud of the main cap.
      const bm = this.faceMat.clone();
      bm.normalMap = faceTex(back.normal, radius); bm.map = faceTex(back.color, radius);
      this.backMat = bm;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.985, 128), bm);
      const uv = disc.geometry.attributes.uv;
      const pos = disc.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
      disc.rotation.y = Math.PI;
      disc.position.z = -thickness / 2 - 0.0015;
      this.backDisc = disc;
      this.add(disc);
    }
    if (edge) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.001, radius * 1.001, thickness * 0.62, 720, 1, true),
        new THREE.MeshPhysicalMaterial({ color: this.base.clone(), metalness: 1, roughness: 0.3, normalMap: edge.normal, map: edge.color }),
      );
      edge.normal.repeat.set(2, 1);
      edge.color.repeat.set(2, 1);
      band.rotation.x = Math.PI / 2;
      this.band = band;
      this.add(band);
    }
  }

  setClip(k) {
    if (Math.abs(k - this.clip) < 1e-3) return;
    this.clip = k;
    this.mesh.geometry = coinGeometry(this.R, this.T, k, this.seed);
    if (this.band) this.band.visible = k < 0.01;
    if (this.backDisc) this.backDisc.visible = k < 0.01;
  }

  // 0 = pure metal, 1 = the target metal (e.g. debased to tin).
  setMetal(from, to, k) {
    const a = METALS[from], b = METALS[to];
    const c = new THREE.Color().setRGB(...a.color).lerp(new THREE.Color().setRGB(...b.color), k);
    for (const m of [this.faceMat, this.sideMat, this.band?.material, this.backMat]) {
      if (!m) continue;
      m.color.copy(c);
      m.roughness = a.roughness + (b.roughness - a.roughness) * k;
    }
  }

  setRelief(k) {
    this.faceMat.normalScale.set(k, k);
  }

  setEmissive(color, k) {
    for (const m of [this.faceMat, this.sideMat, this.band?.material, this.backMat]) {
      if (!m) continue;
      m.emissive.setRGB(...color);
      m.emissiveIntensity = k;
    }
  }
}
