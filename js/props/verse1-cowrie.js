// A cowrie shell: glossy dome, flat base, toothed slit. Modelled from a parametric surface.
// Local frame: long axis X (length 1, x in -0.5..0.5), dome up (+Y), slit on the underside (-Y).
import * as THREE from 'three';
import { rng } from '../util.js';

const L = 0.5, W = 0.33, HB = 0.12;
const SLIT = 0.045; // half-width of the slit, radians around the long axis
const TEETH = 30;
// The slit is not straight: it curves a little towards one side along the length.
const slitC = (s) => 0.05 * s + 0.04 * s * s * s;

export const rhoOf = (s) => Math.pow(Math.max(0, 1 - s * s), 0.42) * (1 + 0.07 * s);

// Around-angle th: 0 = bottom centre (the slit), PI = top of the dome. Denser near the slit.
function thetaOf(a) {
  return (a * Math.PI * 2) * 0.35 + Math.PI * (1 - Math.cos(Math.PI * a)) * 0.65;
}

function wrapAngle(a) {
  a = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a;
}

function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export function cowrieGeometry({ NU = 200, NV = 180 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const s = -1 + (2 * i) / NU;
    const rho = rhoOf(s);
    for (let j = 0; j <= NV; j++) {
      const th = thetaOf(j / NV);
      const c = -Math.cos(th); // +1 top, -1 bottom
      const sn = Math.sin(th);
      // Egg-shaped cross-section (widest just above the base), then a soft flat base.
      let y = rho * (0.1 + 0.3 * c);
      const floor = -HB * Math.pow(rho, 0.5);
      const kk = 0.05 * rho + 0.004;
      y = 0.5 * (y + floor + Math.sqrt((y - floor) * (y - floor) + kk * kk));
      let z = W * sn * rho;
      let x = L * s;
      // Slit and toothed lips on the underside.
      const wa = wrapAngle(th - slitC(s));
      const d = Math.abs(wa);
      if (d < SLIT * 3.4 && c < 0) {
        const endFade = 1 - smoothstep(0.93, 1.0, Math.abs(s));
        const side = wa > 0 ? 0 : Math.PI * 0.5;
        const tooth = Math.pow(0.5 + 0.5 * Math.cos(s * Math.PI * TEETH + side), 3);
        if (d < SLIT) {
          const k = 1 - (d / SLIT) * (d / SLIT);
          // the teeth run down into the slit as ridges
          y += 0.12 * Math.pow(rho, 0.7) * Math.sqrt(k) * endFade * (1 - 0.3 * tooth * (1 - k));
        }
        const lip = smoothstep(SLIT * 0.5, SLIT * 1.0, d) * (1 - smoothstep(SLIT * 1.6, SLIT * 2.8, d));
        y -= (0.0025 + 0.004 * tooth) * lip * Math.pow(rho, 0.6);
      }
      // Small canal notches at both ends, on the slit side.
      if (Math.abs(s) > 0.82 && c < -0.2) {
        const k = smoothstep(0.82, 1.0, Math.abs(s)) * smoothstep(-0.2, -0.9, c) * (1 - smoothstep(SLIT, SLIT * 4, d));
        x *= 1 - 0.07 * k;
      }
      pos.push(x, y, z);
      uv.push((s + 1) / 2, th / (Math.PI * 2));
    }
  }
  const row = NV + 1;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * row + j, b = a + row, c = b + 1, d = a + 1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Colour map in (u = along the length, v = around) space: cream dome with brown spots, white base,
// dark slit with white teeth.
export function cowrieTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = rng(31);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0.0, '#f6f0e2');
  grd.addColorStop(0.2, '#f1e6cc');
  grd.addColorStop(0.27, '#e6cc98');
  grd.addColorStop(0.5, '#d2aa6c');
  grd.addColorStop(0.73, '#e6cc98');
  grd.addColorStop(0.8, '#f1e6cc');
  grd.addColorStop(1.0, '#f6f0e2');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // End caps a little darker and warmer.
  for (const x0 of [0, w]) {
    const eg = g.createRadialGradient(x0, h / 2, 0, x0, h / 2, w * 0.12);
    eg.addColorStop(0, 'rgba(150,100,60,0.35)'); eg.addColorStop(1, 'rgba(150,100,60,0)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
  }
  const mantle = (u) => 0.5 + 0.012 * Math.sin(u * 11) + 0.006 * Math.sin(u * 29);
  const spot = (u, v, r, dark, alpha) => {
    const s = u * 2 - 1, rho = Math.max(0.25, rhoOf(s));
    const rx = r * w, ry = (r * 441) / rho;
    const x = u * w, y = v * h;
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, `rgba(${dark[0]},${dark[1]},${dark[2]},${alpha})`);
    rg.addColorStop(0.62, `rgba(${dark[0]},${dark[1]},${dark[2]},${alpha * 0.92})`);
    rg.addColorStop(0.8, `rgba(${dark[0] + 50},${dark[1] + 36},${dark[2] + 20},${alpha * 0.5})`);
    rg.addColorStop(1, `rgba(${dark[0] + 90},${dark[1] + 70},${dark[2] + 40},0)`);
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  // Soft grey-brown clouds under the spots.
  for (let i = 0; i < 70; i++) {
    const u = 0.04 + R() * 0.92, v = 0.3 + R() * 0.4;
    spot(u, v, 0.03 + R() * 0.05, [150, 104, 60], 0.3);
  }
  // Crisp dark spots, dense on top, thinning towards the base.
  let n = 0;
  for (let tries = 0; tries < 4000 && n < 260; tries++) {
    const u = 0.03 + R() * 0.94;
    const v = 0.26 + R() * 0.48;
    const top = 1 - Math.abs(v - 0.5) / 0.25;
    if (R() > Math.pow(Math.max(0, top), 0.7)) continue;
    if (Math.abs(v - mantle(u)) < 0.008) continue;
    const r = 0.008 + Math.pow(R(), 1.8) * 0.034;
    const tone = R();
    spot(u, v, r, [40 + tone * 36 | 0, 20 + tone * 16 | 0, 8 + tone * 8 | 0], 0.97);
    n++;
  }
  // Slit: a dark curved line, with fine white teeth separated by warm brown grooves.
  // CanvasTexture flips Y: texture v maps to canvas y = (1 - v) * h; the slit sits on the v = 0/1 seam.
  const vpx = h / (Math.PI * 2);
  const slitY = (u) => (1 - slitC(u * 2 - 1) / (Math.PI * 2)) * h;
  for (const off of [0, -h]) {
    for (let x = 0; x <= w; x += 2) {
      const u = x / w, y = slitY(u) + off;
      const sg = g.createLinearGradient(0, y - SLIT * vpx * 1.3, 0, y + SLIT * vpx * 1.3);
      sg.addColorStop(0, 'rgba(14,8,5,0)'); sg.addColorStop(0.25, 'rgba(14,8,5,1)');
      sg.addColorStop(0.75, 'rgba(14,8,5,1)'); sg.addColorStop(1, 'rgba(14,8,5,0)');
      g.fillStyle = sg; g.fillRect(x, y - SLIT * vpx * 1.3, 2, SLIT * vpx * 2.6);
    }
    g.strokeStyle = 'rgba(150,90,48,0.7)'; g.lineWidth = (w / TEETH) * 0.16;
    for (const side of [0, 1]) {
      const phase = side ? 0.5 : 0;
      for (let k = -TEETH / 2 - 1; k <= TEETH / 2 + 1; k++) {
        const sGap = (2 * k + 1 - phase) / TEETH;
        if (Math.abs(sGap) > 0.92) continue;
        const u = (sGap + 1) / 2, x = u * w, y = slitY(u) + off;
        const a = SLIT * 0.8 * vpx, b = SLIT * 2.5 * vpx;
        g.beginPath();
        if (side === 0) { g.moveTo(x, y - a); g.lineTo(x + 3, y - b); } else { g.moveTo(x, y + a); g.lineTo(x - 3, y + b); }
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A cowrie hanging by its top end from a cord. The group origin is the hang point; the shell turns about Y.
export function hangingCowrie({ length = 0.25, cord = 1.6, env = null } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    map: cowrieTexture(), roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 1.0,
  });
  if (env) mat.envMap = env;
  const shell = new THREE.Mesh(cowrieGeometry(), mat);
  shell.castShadow = true;
  const holder = new THREE.Group(); // tilt of the shell on its cord
  shell.rotation.z = Math.PI / 2; // long axis up; dome faces -X
  shell.position.y = -0.5;
  holder.add(shell);
  holder.scale.setScalar(length);
  group.add(holder);
  // The cord, rising from the drilled top end.
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new THREE.Vector3(Math.sin(u * 2.1) * 0.012, u * cord, Math.sin(u * 1.3 + 1) * 0.01));
  }
  const cordMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0028, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }),
  );
  cordMesh.position.y = -0.004;
  group.add(cordMesh);
  // A knot where the cord meets the shell.
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 12), cordMesh.material);
  knot.scale.set(1, 0.8, 1);
  group.add(knot);
  return { group, holder, shell, mat, cord: cordMesh };
}
