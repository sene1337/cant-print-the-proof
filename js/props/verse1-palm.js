// A coconut palm built for silhouettes: a tapered, curving trunk and drooping feathered fronds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../util.js';

function trunk(height, lean, bend, seed) {
  const R = rng(seed);
  const segs = 28, radial = 9;
  const pos = [], idx = [];
  const curve = (u) => new THREE.Vector3(lean * height * Math.pow(u, 1.6) + Math.sin(u * 3 + seed) * 0.12, u * height, bend * height * u * u * 0.3);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const c = curve(u);
    const ring = 1 + 0.06 * Math.max(0, Math.sin(u * height * 7)); // the leaf-scar rings
    const r = (0.2 - 0.07 * u) * ring * (u < 0.06 ? 1.4 - u * 6.6 : 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { g, top: curve(1) };
}

function frond(len, yaw, pitch, droop, seed) {
  const R = rng(seed);
  const pos = [];
  const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const side = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const rach = (u) => {
    const d = u * len;
    return new THREE.Vector3(dir.x * d * Math.cos(pitch), Math.sin(pitch) * d - droop * u * u * len, dir.z * d * Math.cos(pitch));
  };
  const n = 34;
  for (let i = 0; i < n; i++) {
    const u0 = 0.08 + (i / n) * 0.9, u1 = u0 + 0.9 / n;
    const a = rach(u0), b = rach(u1);
    // rachis ribbon
    const w = 0.035 * (1 - u0 * 0.7);
    pos.push(a.x - side.x * w, a.y, a.z - side.z * w, a.x + side.x * w, a.y, a.z + side.z * w, b.x, b.y, b.z);
    // a pair of leaflets
    const ll = len * 0.34 * Math.sin(Math.PI * Math.min(1, u0 * 1.1 + 0.05)) * (0.85 + R() * 0.3);
    for (const sgn of [-1, 1]) {
      const tip = a.clone().addScaledVector(side, sgn * ll * 0.9).addScaledVector(dir, ll * 0.35);
      tip.y -= ll * (0.5 + R() * 0.25);
      const base2 = a.clone().lerp(b, 0.9);
      pos.push(a.x, a.y, a.z, base2.x, base2.y, base2.z, tip.x, tip.y, tip.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function palmGeometry({ height = 9, lean = 0.22, seed = 1 } = {}) {
  const R = rng(seed * 13 + 5);
  const { g: tg, top } = trunk(height, lean, (R() - 0.5) * 0.4, seed);
  const parts = [tg];
  const nF = 10;
  for (let k = 0; k < nF; k++) {
    const yaw = (k / nF) * Math.PI * 2 + R() * 0.4;
    const f = frond(2.6 + R() * 1.2, yaw, 0.35 + R() * 0.5, 1.1 + R() * 0.7, seed * 31 + k);
    f.translate(top.x, top.y, top.z);
    parts.push(f);
  }
  // Coconuts.
  for (let k = 0; k < 4; k++) {
    const s = new THREE.SphereGeometry(0.13, 8, 6);
    const a = R() * 6.28;
    s.translate(top.x + Math.cos(a) * 0.18, top.y - 0.2, top.z + Math.sin(a) * 0.18);
    s.deleteAttribute('uv');
    parts.push(s);
  }
  for (const p of parts) { if (p.attributes.uv) p.deleteAttribute('uv'); if (!p.index) continue; }
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  return mergeGeometries(nonIndexed, false);
}
