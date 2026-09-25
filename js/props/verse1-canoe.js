// An outrigger canoe carrying a rai stone, with paddlers. Built to read as a silhouette on moonlit water.
// Bow points to -X. The outrigger float is on the -Z side; the stone stands on a platform, facing Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function hullGeometry(L = 9, beam = 0.36, depth = 0.55) {
  const NS = 48, NK = 14;
  const pos = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = -1 + (2 * i) / NS;
    const x = (s * L) / 2;
    const e = Math.abs(s);
    const b = beam * Math.pow(Math.max(0, 1 - e * e), 0.55);
    const d = depth * Math.pow(Math.max(0, 1 - e * e), 0.45);
    const sheer = 0.42 + 0.55 * Math.pow(e, 5); // ends sweep up
    for (let k = 0; k <= NK; k++) {
      const a = (k / NK) * Math.PI;
      pos.push(x, sheer - d * Math.sin(a), b * Math.cos(a));
    }
  }
  for (let i = 0; i < NS; i++) for (let k = 0; k < NK; k++) {
    const a = i * (NK + 1) + k, b = a + NK + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function rod(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 8, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  return g;
}

// A seated paddler: body is static, the arms+paddle group swings about the shoulder.
function paddler(mat) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), mat);
  torso.position.y = 0.36;
  torso.scale.set(1, 1, 0.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), mat);
  head.position.y = 0.78;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat); // topknot
  hair.position.set(0.03, 0.9, 0);
  body.add(torso, head, hair);
  const arm = new THREE.Group();
  arm.position.set(0, 0.58, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 6), mat);
  shaft.position.y = -0.35;
  const blade = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
  blade.scale.set(0.35, 2.1, 1.1);
  blade.position.y = -1.05;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 3, 6), mat);
  armL.position.set(0, -0.05, 0.12); armL.rotation.x = 0.5;
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 3, 6), mat);
  armR.position.set(0, -0.12, -0.12); armR.rotation.x = -0.4;
  arm.add(shaft, blade, armL, armR);
  body.add(arm);
  g.add(body);
  return { g, body, arm };
}

export function canoe({ stone, silhouette = 0x05080a } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: silhouette, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(hullGeometry(), mat);
  hull.castShadow = true;
  group.add(hull);
  // Outrigger: float, booms, platform.
  const parts = [];
  const fl = new THREE.CapsuleGeometry(0.12, 5.2, 4, 10);
  fl.rotateZ(Math.PI / 2); fl.translate(0, 0.12, -2.3);
  parts.push(fl);
  for (const x of [-1.6, 1.6]) {
    parts.push(rod([x, 0.5, 0.35], [x, 0.62, -2.3], 0.045));
    parts.push(rod([x, 0.62, -2.3], [x, 0.14, -2.3], 0.035));
  }
  const plat = new THREE.BoxGeometry(2.6, 0.06, 1.5);
  plat.translate(0, 0.6, -1.15);
  parts.push(plat);
  for (const p of parts) p.deleteAttribute('uv');
  const rig = new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), mat);
  group.add(rig);
  if (stone) {
    stone.position.set(0, 0.63 + 1.02, -1.15);
    group.add(stone);
  }
  const paddlers = [];
  for (const [x, ph] of [[-3.0, 0.0], [-1.95, 0.08], [2.0, 0.16], [3.05, 0.24]]) {
    const p = paddler(mat);
    p.g.position.set(x, 0.2, 0.05);
    group.add(p.g);
    paddlers.push({ ...p, ph });
  }
  // Stroke: phase 0 = catch (blade forward, entering the water), 0.55 = exit behind, then recovery in the air.
  const pose = (phase) => {
    for (const p of paddlers) {
      const f = ((phase - p.ph) % 1 + 1) % 1;
      let a, lift;
      if (f < 0.55) { const k = f / 0.55; a = -0.75 + k * 1.35; lift = 0; }
      else { const k = (f - 0.55) / 0.45; a = 0.6 - (1 - Math.cos(k * Math.PI)) / 2 * 1.35; lift = Math.sin(k * Math.PI); }
      p.arm.rotation.z = a;       // swing fore/aft: negative throws the blade toward the bow (-X)
      p.arm.rotation.x = -0.45 - lift * 0.25; // paddle on the near (+Z) side, lifted on recovery
      p.arm.position.y = 0.58 + lift * 0.12;
      p.body.rotation.z = -a * 0.22;
    }
  };
  pose(0);
  return { group, hull, paddlers, pose, mat };
}
