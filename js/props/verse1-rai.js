// Rai: the stone money of Yap. A thick limestone disc, thicker at the hole, a little irregular.
// Geometry lies flat (axis Y); rotate x by PI/2 to stand it up facing +Z.
import * as THREE from 'three';
import { normalFromHeight, loadImage, TEX } from '../tex.js';
import { rng } from '../util.js';

export function raiGeometry({ R = 1, rh = 0.22, th = 0.34, te = 0.17, seed = 1, segs = 128, tile = 0 } = {}) {
  tile = tile || R * 2.25; // one texture tile per face, so the face has no seams
  const pts = [];
  const b = Math.min(th * 0.35, rh * 0.5);
  const t = (r) => th + (te - th) * Math.pow((r - rh) / (R - rh), 1.2);
  const edgeR = t(R) / 2;
  const push = (r, y) => pts.push(new THREE.Vector2(r, y));
  // Profile, traced so the lathe normals face out: hole wall (bottom to top), top face outward,
  // round outer edge, bottom face inward.
  const arc = (cx, cy, rad, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } };
  // hole wall bottom bevel -> top bevel
  arc(rh + b, -th / 2 + b, b, Math.PI * 1.5, Math.PI, 5);
  arc(rh + b, th / 2 - b, b, Math.PI, Math.PI * 0.5, 5);
  const N = 18;
  for (let i = 1; i < N; i++) { const r = rh + b + (R - edgeR - rh - b) * (i / N); push(r, t(r) / 2); }
  arc(R - edgeR, 0, edgeR, Math.PI * 0.5, -Math.PI * 0.5, 10);
  for (let i = N - 1; i >= 1; i--) { const r = rh + b + (R - edgeR - rh - b) * (i / N); push(r, -t(r) / 2); }
  pts.push(pts[0].clone());
  pts.reverse(); // counter-clockwise in (r, y), so the lathe faces point out of the stone
  const g = new THREE.LatheGeometry(pts, segs);
  // Hand-carved irregularity: periodic noise around the ring, stronger towards the rim.
  const R0 = rng(seed);
  const harm = [];
  for (let k = 1; k <= 6; k++) harm.push({ k, a: (R0() - 0.5) * 0.05 / k, p: R0() * 6.283, ay: (R0() - 0.5) * 0.18 / k, py: R0() * 6.283 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z), phi = Math.atan2(z, x);
    let dr = 0, dy = 0;
    for (const h of harm) { dr += h.a * Math.sin(h.k * phi + h.p); dy += h.ay * Math.sin(h.k * phi + h.py); }
    const w = Math.min(1, Math.max(0, (r - rh) / (R - rh)));
    const rr = r * (1 + dr * w);
    const k = rr / Math.max(1e-6, r);
    p.setXYZ(i, x * k, y * (1 + dy * w), z * k);
  }
  g.computeVertexNormals();
  // Weld the lathe seam normals.
  const n = g.attributes.normal, np = pts.length;
  for (let j = 0; j < np; j++) {
    const a = j, c = segs * np + j;
    const v = new THREE.Vector3(n.getX(a) + n.getX(c), n.getY(a) + n.getY(c), n.getZ(a) + n.getZ(c)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(c, v.x, v.y, v.z);
  }
  // UVs: flat projection on the two faces, wrap-around on the rim and the hole (in metres / tile).
  const uv = g.attributes.uv;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ny = n.getY(i);
    const r = Math.hypot(x, z), phi = Math.atan2(z, x);
    if (Math.abs(ny) > 0.45) uv.setXY(i, (ny > 0 ? x : -x) / tile + 0.5, z / tile + 0.5);
    else uv.setXY(i, (phi + Math.PI) * r / tile, y / tile + 0.4);
    // darker in the hole and on the rim, like old weathered stone
    const w = Math.min(1, Math.max(0, (r - rh) / (R - rh)));
    const hole = Math.exp(-w * 9);
    const rim = Math.pow(w, 6);
    const k = 1 - 0.45 * hole - 0.2 * rim;
    col.push(k, k, k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

let texCache = null;
export async function raiTextures() {
  if (texCache) return texCache;
  const im = await loadImage(`${TEX.base}tex/stone.jpg`);
  const w = im.width, h = im.height;
  const hc = document.createElement('canvas');
  hc.width = w; hc.height = h;
  const hg = hc.getContext('2d');
  hg.filter = 'grayscale(1) contrast(1.4)';
  hg.drawImage(im, 0, 0);
  const normal = normalFromHeight(hc, 2.2, 1.2);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  // Colour: pale limestone, a little desaturated so moonlight turns it to bone.
  const cc = document.createElement('canvas');
  cc.width = w; cc.height = h;
  const cg = cc.getContext('2d');
  cg.filter = 'saturate(0.4) brightness(1.18) contrast(1.05)';
  cg.drawImage(im, 0, 0);
  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 8;
  texCache = { color, normal };
  return texCache;
}

export async function raiMaterial({ tint = 0xffffff } = {}) {
  const { color, normal } = await raiTextures();
  return new THREE.MeshStandardMaterial({
    map: color, normalMap: normal, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.93, metalness: 0,
    color: new THREE.Color(tint), vertexColors: true,
  });
}
