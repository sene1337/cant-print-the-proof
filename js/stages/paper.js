// The paper stage: the pen that writes money, the clock whose hours turn to paper, and the storm.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud, NOTE } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { banknote, normalFromHeight } from '../tex.js';
import { clamp, hash1, smooth, easeOut, lerp } from '../util.js';

function nibGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -1.9);
  s.bezierCurveTo(0.18, -1.2, 0.55, -0.55, 0.62, 0.15);
  s.bezierCurveTo(0.66, 0.6, 0.55, 1.05, 0.48, 1.35);
  s.lineTo(-0.48, 1.35);
  s.bezierCurveTo(-0.55, 1.05, -0.66, 0.6, -0.62, 0.15);
  s.bezierCurveTo(-0.55, -0.55, -0.18, -1.2, 0, -1.9);
  const hole = new THREE.Path();
  hole.absarc(0, 0.25, 0.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 48 });
  // Curve it like a real nib.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) - x * x * 0.35);
  }
  g.computeVertexNormals();
  return g;
}

// Engraving on the nib: the slit, a ring round the breather hole, scrollwork, a hallmark. Returns a normal map
// laid over the nib's extruded cap UVs (which are its shape coordinates).
function nibEngraving() {
  const W = 512, H = 1224;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  const X = (x) => ((x + 0.7) / 1.4) * W, Y = (y) => H - ((y + 1.95) / 3.35) * H;
  g.strokeStyle = '#202020'; g.lineCap = 'round';
  g.lineWidth = 7; g.beginPath(); g.moveTo(X(0), Y(-1.9)); g.lineTo(X(0), Y(0.15)); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.arc(X(0), Y(0.25), 0.16 / 1.4 * W, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4;
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const y = 0.35 + u * 0.95;
        const x = sgn * (0.12 + 0.36 * Math.sin(u * Math.PI) * (0.4 + 0.12 * k) + 0.05 * Math.sin(u * 14 + k));
        i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y));
      }
      g.stroke();
    }
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 3; const r = 0.02 + a * 0.012; g.lineTo(X(sgn * 0.3 + Math.cos(a) * r), Y(-0.35 + Math.sin(a) * r)); }
    g.stroke();
  }
  g.fillStyle = '#303030'; g.font = '700 46px "Figtree"'; g.textAlign = 'center';
  g.fillText('750', X(0), Y(-0.75));
  const t = normalFromHeight(c, 3.0, 1.5);
  t.repeat.set(1 / 1.4, 1 / 3.35);
  t.offset.set(0.5, 1.95 / 3.35);
  return t;
}

function signaturePath() {
  // A long flourish across the desk, like a signature on a decree. Lies in the desk plane (y = 0).
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const x = -6 + u * 12;
    const z = -(Math.sin(u * 9.5) * 0.9 * (1 - u * 0.4) + Math.sin(u * 23) * 0.18 + (u > 0.8 ? (u - 0.8) * 3 : 0));
    pts.push(new THREE.Vector3(x, 0.045, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function noiseNormal(size = 512, strength = 1.2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = (i / size) | 0;
    const v = 128 + (hash1(i * 13 + 7) - 0.5) * 60 + Math.sin(x * 0.05 + Math.sin(y * 0.03) * 3) * 20;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = normalFromHeight(c, strength, 1.2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 8);
  return t;
}

// Orient the pen: its local +y runs from the nib tip up the barrel, local +z is the nib's top face.
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
export function posePen(pen, tip, axis, up = [0, 1, 0]) {
  _y.set(...axis).normalize();
  _z.set(...up);
  _z.addScaledVector(_y, -_z.dot(_y)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  pen.quaternion.setFromRotationMatrix(_m);
  pen.position.copy(tip);
}

function clockTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const R = S / 2;
  const grd = g.createRadialGradient(R, R * 0.8, R * 0.1, R, R, R);
  grd.addColorStop(0, '#f4efe2'); grd.addColorStop(1, '#d8cfb8');
  g.fillStyle = grd; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1b1712'; g.lineWidth = 10; g.beginPath(); g.arc(R, R, R * 0.95, 0, Math.PI * 2); g.stroke();
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#1b1712'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 92px "Cormorant Garamond"';
  nums.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.save(); g.translate(R + Math.cos(a) * R * 0.74, R + Math.sin(a) * R * 0.74); g.rotate(a + Math.PI / 2);
    g.fillText(n, 0, 0); g.restore();
  });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const l = i % 5 === 0 ? 34 : 16;
    g.lineWidth = i % 5 === 0 ? 6 : 3;
    g.beginPath();
    g.moveTo(R + Math.cos(a) * R * 0.9, R + Math.sin(a) * R * 0.9);
    g.lineTo(R + Math.cos(a) * (R * 0.9 - l), R + Math.sin(a) * (R * 0.9 - l));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The fountain pen: gold nib (engraved), black section, gold band, long black lacquer barrel.
// Its origin is the nib tip; +y runs up the barrel; +z is the nib's top face (see posePen).
export function buildPen(film) {
  const pen = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.3 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x030303, metalness: 0.1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const penEnv = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [5, 1.6], color: [1, 0.88, 0.68], intensity: 2.4 },
    { pos: [-6, 1, 2], size: [0.5, 5], color: [1, 0.78, 0.55], intensity: 2.8 },
    { pos: [6, 1, -1], size: [0.4, 5], color: [1, 0.9, 0.78], intensity: 2.0 },
  ], { top: [0.3, 0.24, 0.17], horizon: [0.08, 0.06, 0.04], bottom: [0.01, 0.008, 0.006] });
  gold.envMap = penEnv;
  const nibMat = gold.clone();
  nibMat.envMap = penEnv;
  nibMat.normalMap = nibEngraving();
  nibMat.normalScale.set(1.2, 1.2);
  nibMat.envMapIntensity = 0.55;
  nibMat.roughness = 0.34;
  const nib = new THREE.Mesh(nibGeometry(), nibMat);
  nib.position.set(0, 1.9, -0.02);
  pen.add(nib);
  const section = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.66, 1.6, 64), lacquer);
  section.position.set(0, 3.9, -0.28);
  pen.add(section);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.22, 64), gold);
  band.position.set(0, 4.8, -0.28);
  pen.add(band);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.62, 8, 64), lacquer);
  barrel.position.set(0, 8.9, -0.28);
  pen.add(barrel);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lacquer);
  cap.position.set(0, 12.9, -0.28);
  pen.add(cap);
  pen.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { pen, nib };
}

export async function paperStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020403);
  scene.fog = new THREE.FogExp2(0x020403, 0.018);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 3], size: [8, 2], color: [0.85, 1, 0.9], intensity: 3 },
    { pos: [-6, 1, 1], size: [0.8, 6], color: [0.8, 1, 0.85], intensity: 4 },
    { pos: [6, 1, -2], size: [0.8, 6], color: [1, 0.9, 0.7], intensity: 4 },
  ]);
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight(0xf4f8e8, 2.2);
  key.position.set(-4, 6, 5);
  scene.add(key);
  const back = new THREE.DirectionalLight(0xbfe8c8, 2.8);
  back.position.set(3, 2, -6);
  scene.add(back);
  scene.add(new THREE.AmbientLight(0x2a3a30, 0.6));

  const noteTex = await banknote({ seed: 3 });
  const cloud = new NoteCloud(noteTex, 6000, { emissive: 0.1 });
  scene.add(cloud);

  const { pen, nib } = buildPen(film);
  scene.add(pen);

  // The desk: dark leather under a lamp.
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 50),
    new THREE.MeshPhysicalMaterial({ color: 0x050302, roughness: 0.82, metalness: 0, normalMap: noiseNormal(), normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.05 }),
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);
  const lamp = new THREE.SpotLight(0xffd9a8, 8, 40, 0.42, 1.0, 1.4);
  lamp.position.set(-6, 10, -6);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0003;
  scene.add(lamp, lamp.target);

  // The ink stroke: the signature that makes money from nothing.
  const curve = signaturePath();
  const inkGeo = new THREE.TubeGeometry(curve, 800, 0.045, 10, false);
  const ink = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1, 0.5).multiplyScalar(1.6) }));
  scene.add(ink);

  // Clock.
  const clock = new THREE.Group();
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(2, 96), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.55 }));
  clock.add(clockFace);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(2.03, 0.09, 24, 128), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.2 }));
  clock.add(bezel);
  const handMat = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.4 });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.03), handMat);
  hourHand.geometry.translate(0, 0.45, 0.03);
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.03), handMat);
  minHand.geometry.translate(0, 0.7, 0.05);
  clock.add(hourHand, minHand);
  // Pocket-watch dress for the second chorus: gold case, crown, bow and a chain.
  const watch = new THREE.Group();
  const gold2 = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.22 });
  gold2.envMap = null;
  const caseRing = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.2, 32, 160), gold2);
  const caseBack = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.35, 128), gold2);
  caseBack.rotation.x = Math.PI / 2; caseBack.position.z = -0.22;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 32), gold2);
  crown.position.set(0, 2.5, 0);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 16, 64), gold2);
  bow.position.set(0, 2.95, 0);
  watch.add(caseRing, caseBack, crown, bow);
  const linkGeo = new THREE.TorusGeometry(0.16, 0.04, 8, 24);
  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    const l = new THREE.Mesh(linkGeo, gold2);
    l.position.set(Math.sin(u * 2.6) * 1.3 + u * 0.8, 3.3 + u * 3.2 - Math.sin(u * 3.1) * 0.9, -0.1 - u * 0.4);
    l.rotation.set(i % 2 ? Math.PI / 2 : 0, u * 1.3, 0);
    watch.add(l);
  }
  watch.visible = false;
  clock.add(watch);
  scene.add(clock);

  const dust = new Dust({ count: 1000, size: 0.02, box: [10, 6, 10], color: [0.8, 1, 0.85], gain: 1.0 });
  scene.add(dust);

  const S = {
    scene, cloud, pen, nib, ink, inkGeo, curve, desk, lamp, posePen, clock, watch, clockFace, hourHand, minHand, dust, key, back,
    fx: { bloom: 0.7, threshold: 0.8, grain: 0.05, vignette: 0.55, tint: [0.96, 1.02, 0.98] },
    // Draw the ink stroke up to fraction k; returns the pen-tip point.
    drawInk(k) {
      const idxPerSeg = 10 * 6;
      const segs = 800;
      const n = Math.floor(clamp(k) * segs) * idxPerSeg;
      inkGeo.setDrawRange(0, n);
      ink.visible = k > 0;
      return curve.getPointAt(clamp(k));
    },
    // A storm of notes around a centre, moving with the wind. Pure function of t.
    // clear: {from, to, r} keeps a lane open (e.g. from the camera to the subject): notes inside it are pushed to its edge.
    storm(t, { n = 6000, center = [0, 0, 0], radius = 14, height = 9, wind = [3.5, 0.6, -1.2], swirl = 0.5, scale = 1, clear = null } = {}) {
      cloud.setTime(t);
      cloud.setFlutter(1);
      cloud.layout(n, (i, d) => {
        const r1 = hash1(i * 5 + 1), r2 = hash1(i * 5 + 2), r3 = hash1(i * 5 + 3), r4 = hash1(i * 5 + 4);
        const rr = Math.sqrt(r1) * radius;
        const a = r2 * Math.PI * 2 + t * swirl * (0.3 + r3) / (0.4 + rr * 0.1);
        let x = Math.cos(a) * rr + wind[0] * t * (0.6 + r4 * 0.8);
        let y = (r3 - 0.5) * height + Math.sin(t * (0.7 + r1) + i) * 0.6 + wind[1] * t;
        let z = Math.sin(a) * rr + wind[2] * t * (0.6 + r2 * 0.8);
        const W = radius * 2;
        x = ((x % W) + W * 1.5) % W - W / 2;
        z = ((z % W) + W * 1.5) % W - W / 2;
        y = ((y % height) + height * 1.5) % height - height / 2;
        x += center[0]; y += center[1]; z += center[2];
        if (clear) {
          const [ax, ay, az] = clear.from, bx = clear.to[0] - ax, by = clear.to[1] - ay, bz = clear.to[2] - az;
          const u = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / (bx * bx + by * by + bz * bz)));
          const vx = x - (ax + bx * u), vy = y - (ay + by * u), vz = z - (az + bz * u);
          const dd = Math.hypot(vx, vy, vz) || 1e-6;
          if (dd < clear.r) { const f = (clear.r * 0.6 + dd * 0.4) / dd; x += vx * (f - 1); y += vy * (f - 1); z += vz * (f - 1); }
        }
        d.position.set(x, y, z);
        d.rotation.set(t * (0.8 + r1 * 2.2) + i, t * (0.5 + r2 * 1.7) + r3 * 6, t * (0.3 + r4) + r1 * 6);
        d.scale.setScalar(0.45 * scale);
      });
    },
    // A flat sheet of notes doubling: count = 2^k.
    printGrid(t, count, { gap = 0.08, spread = 1 } = {}) {
      cloud.setTime(t);
      cloud.setFlutter(0.15);
      const cols = Math.ceil(Math.sqrt(count * 1.6));
      const rows = Math.ceil(count / cols);
      const w = NOTE.W + gap, h = NOTE.H + gap;
      cloud.layout(count, (i, d) => {
        const cx = i % cols, cy = Math.floor(i / cols);
        d.position.set((cx - (cols - 1) / 2) * w * spread, (cy - (rows - 1) / 2) * h * spread, 0);
        d.scale.setScalar(1);
      });
      return { cols, rows, width: cols * w, height: rows * h };
    },
    update(ctx) {
      cloud.visible = false;
      pen.visible = false;
      pen.scale.setScalar(1);
      ink.visible = false;
      desk.visible = false;
      lamp.visible = false;
      key.intensity = 2.2; key.color.set(0xf4f8e8);
      lamp.intensity = 8;
      back.intensity = 2.8; back.color.set(0xbfe8c8);
      cloud.setFlutter(1);
      clock.visible = false;
      watch.visible = false;
      clock.rotation.set(0, 0, 0);
      dust.visible = true;
      dust.setTime(ctx.t, [0.3, 0.05, -0.1]);
      scene.fog.density = 0.018;
      scene.background.set(0x020403);
    },
  };
  return S;
}
