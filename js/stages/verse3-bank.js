// Verse 3, "took the bank out the middle": two nodes linked through a little bank; the bank drops away
// and the two nodes connect directly.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { canvas, canvasTex, Motes, glowCard } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

// A glowing bar between two points (unit cylinder along y, re-posed each frame, never rebuilt).
function beam(thick = 0.03, color = [1, 0.45, 0.08], gain = 1.9) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(thick, thick, 1, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...color).multiplyScalar(gain), transparent: true }),
  );
  m.frustumCulled = false;
  return m;
}
function setBeam(m, a, b) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length();
  m.visible = len > 1e-4;
  if (!m.visible) return;
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  m.scale.set(1, len, 1);
}

function friezeTexture() {
  const c = canvas(1024, 128), g = c.getContext('2d');
  g.fillStyle = '#8d998e'; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#2f3a33'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 92px "Cormorant Garamond"';
  // letter-spaced engraving
  const txt = 'B A N K';
  g.fillText(txt, 512, 70);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillText(txt, 512, 73);
  return canvasTex(c);
}

function buildTemple() {
  const G = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9aa99c, roughness: 0.78, metalness: 0 });
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, stone); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
  // steps
  add(new THREE.BoxGeometry(2.1, 0.12, 1.2), 0, 0.06, 0);
  add(new THREE.BoxGeometry(1.94, 0.12, 1.08), 0, 0.18, 0);
  add(new THREE.BoxGeometry(1.78, 0.12, 0.96), 0, 0.3, 0);
  // columns
  const colGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.9, 20);
  const capGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
  for (let i = 0; i < 6; i++) {
    const x = -0.72 + i * 0.288;
    add(colGeo, x, 0.81, 0.3);
    add(capGeo, x, 1.29, 0.3);
    add(capGeo, x, 0.39, 0.3);
  }
  // back wall (the cella) behind the columns
  add(new THREE.BoxGeometry(1.5, 0.9, 0.5), 0, 0.81, -0.12);
  // entablature with the engraved frieze
  add(new THREE.BoxGeometry(1.86, 0.22, 1.0), 0, 1.43, 0);
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.19), new THREE.MeshStandardMaterial({ map: friezeTexture(), roughness: 0.8 }));
  frieze.position.set(0, 1.43, 0.502);
  G.add(frieze);
  // pediment
  const tri = new THREE.Shape();
  tri.moveTo(-0.98, 0); tri.lineTo(0.98, 0); tri.lineTo(0, 0.4); tri.lineTo(-0.98, 0);
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.0, bevelEnabled: false }), stone);
  ped.position.set(0, 1.54, -0.5);
  ped.castShadow = true;
  G.add(ped);
  // the door, dark
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.55), new THREE.MeshBasicMaterial({ color: 0x050706 }));
  door.position.set(0, 0.64, 0.135);
  G.add(door);
  return G;
}

export async function verse3BankStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [5, 2], color: [0.85, 1, 0.9], intensity: 1.6 },
    { pos: [-6, 1, 1], size: [0.8, 5], color: [0.8, 1, 0.85], intensity: 1.6 },
  ], { top: [0.05, 0.07, 0.06], horizon: [0.01, 0.015, 0.012], bottom: [0, 0, 0] });
  scene.environmentIntensity = 0.6;

  // Sickly fluorescent light on the bank.
  const key = new THREE.SpotLight(0xd8ffe4, 34, 20, 0.5, 0.6, 1.5);
  key.position.set(-2.5, 5, 3.5);
  key.target.position.set(0, 0.8, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xa8d8ff, 1.2);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  const temple = buildTemple();
  scene.add(temple);

  // The two nodes: people who want to pay each other.
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x1a0c02, emissive: new THREE.Color(1, 0.36, 0.03), emissiveIntensity: 1.25, roughness: 0.35 });
  const nodes = [-1, 1].map((s) => {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 48, 32), nodeMat.clone());
    g.add(orb);
    const halo = glowCard([1, 0.45, 0.1], 1.0);
    g.add(halo);
    const ring = new THREE.Group();
    g.userData = { orb, halo, ring, side: s };
    scene.add(g);
    return g;
  });

  const linkA = beam(), linkB = beam(), direct = beam(0.038, [1, 0.5, 0.1], 2.3), directB = beam(0.038, [1, 0.5, 0.1], 2.3);
  scene.add(linkA, linkB, direct, directB);
  const bead = glowCard([1, 0.7, 0.35], 0.42);
  scene.add(bead);
  const snapA = new Motes({ count: 140, size: 0.03, color: [1, 0.6, 0.2], gain: 6 });
  const snapB = new Motes({ count: 140, size: 0.03, color: [1, 0.6, 0.2], gain: 6 });
  const meet = new Motes({ count: 160, size: 0.035, color: [1, 0.7, 0.35], gain: 7 });
  scene.add(snapA, snapB, meet);
  const flash = glowCard([1, 0.6, 0.25], 2.2);
  scene.add(flash);

  const NY = 1.0, NX = 2.55;

  const S = {
    scene, key, rim, temple, nodes, linkA, linkB, direct, bead,
    fx: { bloom: 0.4, threshold: 1.0, bloomRadius: 0.3, grain: 0.045, vignette: 0.5, tint: [1, 1.0, 0.98] },
    update(ctx) {
      temple.visible = true; temple.position.set(0, NY - 0.82, 0); temple.rotation.set(0, 0, 0);
      nodes.forEach((n) => {
        n.position.set(NX * n.userData.side, NY, 0);
        n.userData.orb.material.emissiveIntensity = 1.25;
        n.userData.halo.material.opacity = 0.3;
        n.userData.ring.rotation.set(Math.PI / 2 + 0.3, ctx.t * 0.8 * n.userData.side, 0);
      });
      linkA.visible = linkB.visible = direct.visible = directB.visible = false;
      bead.visible = false;
      snapA.visible = snapB.visible = meet.visible = false;
      flash.visible = false;
    },
    // tDrop: the bank starts to fall; tSnap: the old links break; tMeet: the direct link closes.
    play(t, { t0, tDrop, tSnap, tMeet }) {
      const A = [-NX + 0.3, NY, 0], B = [NX - 0.3, NY, 0];
      // the bank falls away, tipping as it goes
      const fd = Math.max(0, t - tDrop);
      const shudder = t > tDrop - 0.14 && t < tDrop ? Math.sin(t * 90) * 0.02 : 0;
      temple.position.set(shudder, NY - 0.82 - 13 * fd * fd - 0.6 * fd, 0);
      temple.rotation.set(fd * 0.35, 0, -fd * 0.5);
      temple.visible = fd < 1.2;
      const doorL = [-0.95 + temple.position.x, temple.position.y + 0.82, 0], doorR = [0.95 + temple.position.x, temple.position.y + 0.82, 0];
      // links through the bank until they snap
      if (t < tSnap) {
        setBeam(linkA, A, doorL);
        setBeam(linkB, doorR, B);
        const k = 1 - clamp((t - tSnap + 0.08) / 0.08) * 0.8;
        linkA.material.opacity = linkB.material.opacity = k;
        // a payment runs from A into the bank, and out the other side
        const u = (t - t0) / 0.55;
        if (u > 0 && u < 2) {
          bead.visible = true;
          const p = u < 1 ? [lerp(A[0], doorL[0], easeInOut(u)), lerp(A[1], doorL[1], easeInOut(u)), 0]
            : [lerp(doorR[0], B[0], easeInOut(u - 1)), lerp(doorR[1], B[1], easeInOut(u - 1)), 0];
          bead.position.set(...p);
        }
      } else {
        // snapped: sparks where the links broke
        const ds = t - tSnap;
        snapA.burst(ds, [lerp(A[0], doorL[0], 0.5), lerp(A[1], doorL[1], 0.5), 0], { power: 0.5, life: 0.6, gravity: 5, seed: 11 });
        snapB.burst(ds, [lerp(doorR[0], B[0], 0.5), lerp(doorR[1], B[1], 0.5), 0], { power: 0.5, life: 0.6, gravity: 5, seed: 12 });
        // the direct link reaches across from both ends
        const g = easeOut(clamp((t - tSnap) / (tMeet - tSnap)), 2);
        const mid = [0, NY, 0];
        if (g < 1) {
          setBeam(direct, A, [lerp(A[0], 0, g), NY, 0]);
          setBeam(directB, [lerp(B[0], 0, g), NY, 0], B);
        } else {
          setBeam(direct, A, B);
        }
        const am = t - tMeet;
        if (am > 0) {
          meet.burst(am, mid, { power: 0.8, spread: 2, up: 0.3, life: 0.6, gravity: 4, seed: 13 });
          flash.visible = am < 0.4;
          flash.position.set(...mid);
          flash.material.opacity = 0.6 * clamp(1 - am / 0.4);
          flash.scale.setScalar(0.8 + am * 1.5);
          const u2 = am / 0.45;
          if (u2 < 1) { bead.visible = true; bead.position.set(lerp(A[0], B[0], easeInOut(u2)), NY, 0); }
          nodes.forEach((n) => { n.userData.orb.material.emissiveIntensity = 1.25 + 1.2 * Math.exp(-am * 5); });
        }
      }
    },
  };
  return S;
}
