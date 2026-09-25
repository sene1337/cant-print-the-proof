// A cupped right hand, palm up, built once from a smooth signed-distance model (capsules blended
// with a smooth union) and meshed with surface nets. Units: metres. Palm centre at the origin,
// palm facing +Y, fingers pointing -X and curling up, thumb on the far (-Z) side.
import * as THREE from 'three';

const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };

function sdCapsule(px, py, pz, a, b, r) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.hypot(dx, dy, dz) - (r[0] + (r[1] - r[0]) * h);
}

function sdRoundBox(px, py, pz, hx, hy, hz, r) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r, qz = Math.abs(pz) - hz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

// Chain of bones from a root, bending about the Z axis (curl up) with a little splay about Y.
function finger(root, dir, lens, radii, curl, splay) {
  const segs = [];
  let p = root.slice();
  let ang = 0;
  const yaw = splay;
  for (let i = 0; i < lens.length; i++) {
    ang += curl[i];
    // direction: start along dir (in XZ), pitch up by ang
    const cx = Math.cos(yaw) * dir[0] - Math.sin(yaw) * dir[2];
    const cz = Math.sin(yaw) * dir[0] + Math.cos(yaw) * dir[2];
    const d = [cx * Math.cos(ang), Math.sin(ang), cz * Math.cos(ang)];
    const q = [p[0] + d[0] * lens[i], p[1] + d[1] * lens[i], p[2] + d[2] * lens[i]];
    segs.push({ a: p, b: q, r: [radii[i], radii[i + 1]] });
    p = q;
  }
  return segs;
}

function handModel() {
  const cm = 0.01;
  const bones = [];
  // Fingers: index (far side, next to the thumb) to little finger (near side).
  const F = [
    { z: -2.9, len: [4.0, 2.4, 2.0], r: [0.98, 0.9, 0.8, 0.68], splay: -0.1, curl: [0.42, 0.62, 0.5] },
    { z: -1.0, len: [4.4, 2.7, 2.2], r: [1.0, 0.92, 0.82, 0.7], splay: -0.03, curl: [0.45, 0.66, 0.52] },
    { z: 0.95, len: [4.1, 2.6, 2.1], r: [0.96, 0.88, 0.78, 0.66], splay: 0.05, curl: [0.5, 0.68, 0.52] },
    { z: 2.75, len: [3.3, 2.0, 1.7], r: [0.85, 0.78, 0.7, 0.58], splay: 0.15, curl: [0.55, 0.7, 0.5] },
  ];
  for (const f of F) {
    const root = [-4.4, 0.3, f.z];
    const segs = finger(root, [-1, 0, 0], f.len, f.r, f.curl, f.splay);
    bones.push(...segs);
  }
  // The fleshy walls of the cup: the ball of the thumb and the heel along the little-finger side.
  bones.push({ a: [2.6, 0.4, -2.6], b: [-1.0, 0.9, -3.4], r: [2.0, 1.4] });
  bones.push({ a: [2.8, 0.3, 3.0], b: [-2.8, 0.8, 3.4], r: [1.6, 1.3] });
  // Thumb: from the heel of the palm on the far side, up and over.
  const t0 = [1.6, 0.0, -3.2];
  const tsegs = finger(t0, [-0.62, 0, -0.78], [4.2, 3.2, 2.6], [1.45, 1.1, 0.95, 0.82], [0.3, 0.42, 0.38], 0.55);
  bones.push(...tsegs);
  // Wrist and forearm.
  bones.push({ a: [4.0, -0.4, 0], b: [14, -3.6, 0.6], r: [2.2, 2.4] });
  return (x, y, z) => {
    const px = x / cm, py = y / cm, pz = z / cm;
    // Palm, cupped: lift the edges.
    const cup = 0.06 * (px * px * 0.45 + pz * pz);
    let d = sdRoundBox(px, py - cup, pz, 4.6, 1.15, 4.3, 1.1);
    for (const b of bones) d = smin(d, sdCapsule(px, py, pz, b.a, b.b, b.r), 0.9);
    return d * cm;
  };
}

// Naive surface nets over a box.
function surfaceNets(f, min, max, step) {
  const nx = Math.ceil((max[0] - min[0]) / step), ny = Math.ceil((max[1] - min[1]) / step), nz = Math.ceil((max[2] - min[2]) / step);
  const V = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));
  const idx = (i, j, k) => i + (nx + 1) * (j + (ny + 1) * k);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    V[idx(i, j, k)] = f(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  }
  const cellV = new Int32Array(nx * ny * nz).fill(-1);
  const cidx = (i, j, k) => i + nx * (j + ny * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { cv[c] = V[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; if (cv[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      const A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cellV[cidx(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
  }
  const tri = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tri.push(a, c, b, a, d, c); else tri.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const v0 = V[idx(i, j, k)];
    // edge along x from (i,j,k) to (i+1,j,k): cells sharing it vary in j-1..j, k-1..k
    if (i < nx) {
      const v1 = V[idx(i + 1, j, k)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i, j - 1, k - 1)], cellV[cidx(i, j, k - 1)], cellV[cidx(i, j, k)], cellV[cidx(i, j - 1, k)], v0 < 0);
    }
    if (j < ny) {
      const v1 = V[idx(i, j + 1, k)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i - 1, j, k - 1)], cellV[cidx(i - 1, j, k)], cellV[cidx(i, j, k)], cellV[cidx(i, j, k - 1)], v0 < 0);
    }
    if (k < nz) {
      const v1 = V[idx(i, j, k + 1)];
      if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i - 1, j - 1, k)], cellV[cidx(i, j - 1, k)], cellV[cidx(i, j, k)], cellV[cidx(i - 1, j, k)], v0 < 0);
    }
  }
  // Normals from the field gradient.
  const nor = new Float32Array(pos.length);
  const e = step * 0.5;
  for (let v = 0; v < pos.length; v += 3) {
    const x = pos[v], y = pos[v + 1], z = pos[v + 2];
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[v] = gx / l; nor[v + 1] = gy / l; nor[v + 2] = gz / l;
  }
  // Wind every triangle to agree with the field normal (outward = counter-clockwise).
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const nx = nor[a] + nor[b] + nor[c], ny = nor[a + 1] + nor[b + 1] + nor[c + 1], nz = nor[a + 2] + nor[b + 2] + nor[c + 2];
    if (cx * nx + cy * ny + cz * nz < 0) { const tmp = tri[t + 1]; tri[t + 1] = tri[t + 2]; tri[t + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(tri);
  return g;
}

export function cuppedHandGeometry(step = 0.0022) {
  const f = handModel();
  return surfaceNets(f, [-0.15, -0.045, -0.085], [0.2, 0.09, 0.07], step);
}
