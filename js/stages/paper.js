// The paper stage: the pen that writes money, the clock whose hours turn to paper, and the storm.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud, NOTE } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { banknote } from '../tex.js';
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

function signaturePath() {
  // A long flourish, like a signature on a decree.
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const x = -6 + u * 12;
    const y = Math.sin(u * 9.5) * 0.9 * (1 - u * 0.4) + Math.sin(u * 23) * 0.18 + (u > 0.8 ? (u - 0.8) * 3 : 0);
    const z = Math.cos(u * 7) * 0.15;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts);
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

  // Pen: gold nib on a black barrel.
  const pen = new THREE.Group();
  const nib = new THREE.Mesh(nibGeometry(), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.18 }));
  nib.position.set(0, 1.9, 0);
  pen.add(nib);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.7, 7, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.3, roughness: 0.18, clearcoat: 1 }),
  );
  barrel.position.set(0, 3.25 + 3.5, 0.2);
  pen.add(barrel);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.25, 64), nib.material);
  band.position.set(0, 3.4, 0.2);
  pen.add(band);
  scene.add(pen);

  // The ink stroke: the signature that makes money from nothing.
  const curve = signaturePath();
  const inkGeo = new THREE.TubeGeometry(curve, 800, 0.045, 10, false);
  const ink = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1, 0.55).multiplyScalar(3.2) }));
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
  scene.add(clock);

  const dust = new Dust({ count: 1000, size: 0.02, box: [10, 6, 10], color: [0.8, 1, 0.85], gain: 1.0 });
  scene.add(dust);

  const S = {
    scene, cloud, pen, nib, ink, inkGeo, curve, clock, clockFace, hourHand, minHand, dust, key, back,
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
    storm(t, { n = 6000, center = [0, 0, 0], radius = 14, height = 9, wind = [3.5, 0.6, -1.2], swirl = 0.5, scale = 1 } = {}) {
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
        d.position.set(center[0] + x, center[1] + y, center[2] + z);
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
      ink.visible = false;
      clock.visible = false;
      dust.visible = true;
      dust.setTime(ctx.t, [0.3, 0.05, -0.1]);
      scene.fog.density = 0.018;
      scene.background.set(0x020403);
    },
  };
  return S;
}
