// VERSE 2 fiat: the dollar chained to a gold bar; the chain snaps and the note floats free. Then the note
// erodes away until only five percent is left.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { banknote, noteExtras } from '../tex.js';
import { readableBothSides, paperShading } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { clamp, lerp, hash1, rng, noise1, easeIn, easeOut, easeInOut } from '../util.js';
import {
  noiseField, burnUniforms, patchBurn, burnFieldJS, patch, clampHot, Pieces, Flakes, flakeMaterial,
  SoftPoints, pointScale, canvas2d, canvasTex,
} from '../props/verse2-kit.js';
import { barGeometry, stamp } from './verse2-bar.js';

export const NW = 2.35, NH = 1.0;
const NLINK = 10, BREAK = 5, PITCH = 0.15;
export const CHAIN_NOTE_SCALE = 0.85;

function flutterGeo() {
  return new THREE.PlaneGeometry(NW, NH, 28, 12);
}

function flutter(geo, base, t, amp, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    p.setZ(i, amp * (Math.sin(x * 1.9 + t * 3.1 + seed) * 0.07 + Math.sin(y * 2.7 + t * 2.3 + seed * 2) * 0.035) * (0.4 + Math.abs(x) / NW)
      + 0.05 * (x / (NW / 2)) ** 2);   // a gentle curl
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

export async function fiatStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020403);
  scene.fog = new THREE.Fog(0x020403, 9, 22);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 1.2], color: [0.85, 1, 0.9], intensity: 2.2 },
    { pos: [-6, 1.5, 2], size: [0.6, 4], color: [0.8, 1, 0.88], intensity: 1.8 },
    { pos: [6, 1.5, -1], size: [0.6, 4], color: [1, 0.85, 0.6], intensity: 1.4 },
  ], { top: [0.05, 0.07, 0.06], horizon: [0.015, 0.02, 0.018], bottom: [0, 0, 0] });
  scene.environmentIntensity = 1.0;

  const cool = new THREE.DirectionalLight(0xd8f2e2, 1.6);
  cool.position.set(2, 6, 4);
  cool.castShadow = true;
  cool.shadow.mapSize.set(2048, 2048);
  cool.shadow.camera.left = -4; cool.shadow.camera.right = 4; cool.shadow.camera.top = 4; cool.shadow.camera.bottom = -4;
  cool.shadow.bias = -0.0005;
  scene.add(cool);
  const warm = new THREE.SpotLight(0xffc27a, 0, 12, 0.5, 0.6, 2);
  warm.position.set(-2.2, 3.2, 2.4);
  warm.target.position.set(0, 0.2, 0);
  scene.add(warm, warm.target);
  const fillL = new THREE.DirectionalLight(0x6f8f80, 0.35);
  fillL.position.set(-4, 2, 3);
  scene.add(fillL);

  const field = noiseField(256, 57);
  const noteTex = await banknote({ seed: 5, serial: 'F 1971 0815 A', res: 2 });

  // The dollar.
  const noteGeo = flutterGeo();
  const noteBase = Float32Array.from(noteGeo.attributes.position.array);
  const U = burnUniforms(field, { mode: 1, noiseAmp: 0.07, noiseScale: 2.2, charW: 0.025, charCol: [0.32, 0.38, 0.35], emberW: 0.012, emberGain: 2.6, emberCol: [0.55, 1.0, 0.72] });
  // paper: ink relief, a soft sheen, light through the sheet (burn patch first, then the paper shading)
  const noteMat = new THREE.MeshPhysicalMaterial({
    map: noteTex, roughness: 0.75, side: THREE.DoubleSide, emissive: new THREE.Color(1, 1, 1), emissiveMap: noteTex, emissiveIntensity: 0.06,
    normalMap: noteExtras(noteTex).normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.92, 0.96, 0.92),
  });
  patchBurn(noteMat, U);
  const paperU = { uTranslucency: { value: 0.35 } };
  patch(noteMat, 'paper', (sh) => { readableBothSides(sh); paperShading(sh, paperU); });
  const note = new THREE.Mesh(noteGeo, noteMat);
  note.castShadow = true;
  scene.add(note);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.03), clampHot(new THREE.MeshPhysicalMaterial({ color: 0x9aa3a8, metalness: 1, roughness: 0.3 }), 3));
  note.add(clip);
  clip.position.set(0, -NH / 2 - 0.02, 0);

  // The gold bar and its chain.
  const st = stamp();
  const gold = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.22 }), 3.5);
  const goldTop = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.24, map: st.color, normalMap: st.normal }), 3.5);
  const bar = new THREE.Mesh(barGeometry(), [gold, gold, goldTop, gold, gold, gold]);
  bar.scale.setScalar(0.75);
  bar.castShadow = true; bar.receiveShadow = true;
  scene.add(bar);
  const iron = clampHot(new THREE.MeshPhysicalMaterial({ color: 0x8f969a, metalness: 1, roughness: 0.3 }), 3);
  const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 10, 24), iron);
  scene.add(anchor);
  const linkGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 20);
  linkGeo.scale(1, 1.55, 1);
  const links = new Pieces(linkGeo, iron, NLINK);
  links.castShadow = true;
  scene.add(links);
  const sparks = new SoftPoints(80, { color: [1, 0.75, 0.4], additive: true });
  scene.add(sparks);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshPhysicalMaterial({ color: 0x0b0d0c, roughness: 0.4, clearcoat: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Flakes the eroding note breaks into.
  const NFL = 650;
  const flakes = new Flakes(new THREE.PlaneGeometry(1, 1), flakeMaterial(noteTex, { emberCol: [0.55, 1, 0.72] }), NFL);
  scene.add(flakes);
  const flakeSeeds = [];
  for (let i = 0; i < NFL; i++) {
    const u = hash1(i * 3 + 5), v = hash1(i * 3 + 6);
    flakeSeeds.push({ u, v, f: burnFieldJS(field, U, u, v) });
  }

  const dust = new Dust({ count: 700, size: 0.01, box: [8, 5, 8], color: [0.8, 1, 0.88], gain: 0.7 });
  dust.position.set(0, 1.5, 0);
  scene.add(dust);

  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const X_AX = new THREE.Vector3(1, 0, 0), Z_AX = new THREE.Vector3(0, 0, 1);

  const S = {
    scene, note, noteMat, U, bar, links, anchor, sparks, flakes, cool, warm, floor, dust,
    fx: { bloom: 0.6, threshold: 0.95, bloomRadius: 0.45, grain: 0.05, vignette: 0.6, tint: [0.95, 1.03, 0.98] },

    // S15: the note tethered to the bar; the chain breaks at tBreak and the note rises.
    chainAt(t, tBreak) {
      bar.visible = true; anchor.visible = true; links.visible = true; note.visible = true;
      warm.intensity = 60;
      bar.position.set(0, 0, 0);
      bar.rotation.set(0, -0.35, 0);
      const A = new THREE.Vector3(0, 0.42 * 0.75 + 0.05, 0);
      anchor.position.copy(A).add(new THREE.Vector3(0, 0.02, 0));
      anchor.rotation.set(0, -0.35, 0);
      const dt = t - tBreak;
      const rise = dt > 0 ? dt * 0.9 + dt * dt * 1.6 : 0;
      const tug = dt > 0 ? 0 : 0.03 * Math.sin(t * 5.3);
      const clipY = A.y + NLINK * PITCH + 0.05 + tug + rise;
      const B = new THREE.Vector3(0.05 * Math.sin(t * 1.7) + (dt > 0 ? dt * 0.35 : 0), clipY, 0.04 * Math.cos(t * 1.3));
      note.scale.setScalar(CHAIN_NOTE_SCALE);
      note.position.set(B.x, B.y + (NH / 2) * CHAIN_NOTE_SCALE + 0.02, B.z);
      note.rotation.set(-0.15 + (dt > 0 ? -dt * 0.25 : 0), -0.35 + (dt > 0 ? dt * 0.4 : 0), 0.04 * Math.sin(t * 2.1) + (dt > 0 ? dt * 0.15 : 0));
      flutter(noteGeo, noteBase, t, dt > 0 ? 1.2 : 0.9);
      U.uBurn.value = -1;
      note.updateMatrixWorld(true);
      const clipW = note.localToWorld(tmp.set(0, -NH / 2 - 0.04, 0)).clone();
      const dir = new THREE.Vector3().subVectors(clipW, A);
      const len = dir.length();
      dir.normalize();
      links.layout(NLINK, (i, d) => {
        if (dt < 0) {
          const u = (i + 0.5) / NLINK;
          d.position.copy(A).addScaledVector(dir, u * len);
          d.position.x += Math.sin(t * 2 + i * 0.4) * 0.01 * Math.sin(Math.PI * u);
          d.quaternion.setFromUnitVectors(up, dir);
          d.rotateY(i % 2 ? Math.PI / 2 : 0);
          return;
        }
        if (i === BREAK) return false;
        if (i > BREAK) {
          // hangs from the rising note, swinging
          const m = NLINK - i;
          const sw = 0.5 * Math.exp(-2 * dt) * Math.sin(dt * 7);
          d.position.copy(clipW).add(new THREE.Vector3(Math.sin(sw) * (m - 0.5) * PITCH, -Math.cos(sw) * (m - 0.5) * PITCH, 0));
          d.rotation.set(0, i % 2 ? Math.PI / 2 : 0, sw);
          return;
        }
        // falls slack onto the bar
        const u = (i + 0.5) / NLINK;
        const p0 = A.clone().addScaledVector(dir, u * len);
        const rest = A.y + 0.02 + i * 0.012;
        const fall = Math.min(p0.y - rest, 0.5 * 14 * dt * dt);
        const spread = (1 - Math.exp(-dt * 4)) * 0.035 * i;
        d.position.set(p0.x + Math.sin(i * 2.3) * spread, p0.y - fall, p0.z + Math.cos(i * 1.7) * spread);
        const lie = clamp(fall / Math.max(0.001, p0.y - rest));
        d.rotation.set(lie * (Math.PI / 2) * (i % 2 ? 1 : -1), i * 0.7, lie * 0.4);
      });
      // sparks from the broken link
      const bp = A.clone().addScaledVector(dir, ((BREAK + 0.5) / NLINK) * len);
      sparks.visible = dt > 0 && dt < 0.6;
      if (sparks.visible) {
        sparks.layout(80, (i, o) => {
          const a = hash1(i * 3) * Math.PI * 2, e = (hash1(i * 3 + 1) - 0.3) * 1.6, v = 1.2 + hash1(i * 3 + 2) * 2.8;
          o.x = bp.x + Math.cos(a) * Math.cos(e) * v * dt;
          o.y = bp.y + Math.sin(e) * v * dt - 4.9 * dt * dt;
          o.z = bp.z + Math.sin(a) * Math.cos(e) * v * dt;
          o.size = 0.02 + hash1(i) * 0.02;
          o.alpha = (1 - dt / 0.6) * 2;
        }, pointScale(film, film.camera));
      }
    },

    // S16: the note alone, eroding from the left: b is the front (-0.1 intact .. 0.95 five percent left).
    erodeAt(t, bOf, t0, t1) {
      note.visible = true;
      clip.visible = false;
      floor.visible = false; // a void: the note floats alone
      note.position.set(0, 1.2 + 0.03 * Math.sin(t * 1.4), 0);
      note.rotation.set(-0.08 + 0.03 * Math.sin(t * 1.1), 0.12 + 0.03 * Math.sin(t * 0.9), 0.03 * Math.sin(t * 1.3));
      flutter(noteGeo, noteBase, t, 0.6);
      const b = bOf(t);
      U.uBurn.value = b;
      U.uTime.value = t;
      note.updateMatrixWorld(true);
      const when = (f) => {
        if (bOf(t0) >= f) return t0;
        let lo = t0, hi = t1;
        for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (bOf(m) >= f) hi = m; else lo = m; }
        return hi;
      };
      flakes.visible = true;
      flakes.layoutFlakes(NFL, (i, d, rect, glow) => {
        const s = flakeSeeds[i];
        if (s.f > b) return false;
        const a = t - when(s.f);
        if (a < 0 || a > 1.8) return false;
        const h = (k) => hash1(i * 19 + k);
        const p = note.localToWorld(tmp.set((s.u - 0.5) * NW, (s.v - 0.5) * NH, 0));
        d.position.set(p.x - a * (0.6 + h(1) * 1.2) - a * a * 0.8, p.y + a * (0.2 + h(2) * 0.5), p.z - a * (0.3 + h(3) * 0.9));
        d.rotation.set(a * (3 + h(4) * 6) + h(5) * 6, a * (2 + h(6) * 5), a * (2 + h(7) * 4));
        const sz = (0.035 + h(8) * 0.05) * (1 - clamp((a - 1.1) / 0.7));
        d.scale.set(sz, sz * (0.5 + h(9) * 0.6), 1);
        rect[0] = s.u - 0.012; rect[1] = s.v - 0.02; rect[2] = 0.024; rect[3] = 0.04;
        // flash safety: a short, dim glow as each flake breaks off, then it darkens to ash within half a second,
        // so bright flakes never stream across the dark
        glow[0] = 0.55 * Math.exp(-a * 9);
        glow[1] = 0.15 + 0.55 * clamp(a / 0.5);
      });
    },

    update(ctx) {
      note.visible = false;
      note.scale.setScalar(1);
      clip.visible = true;
      bar.visible = false; anchor.visible = false; links.visible = false;
      sparks.visible = false;
      flakes.visible = false;
      U.uBurn.value = -1;
      U.uTime.value = ctx.t;
      warm.intensity = 0;
      cool.intensity = 1.6;
      floor.visible = true;
      floor.material.clearcoat = 0.4;
      floor.material.roughness = 0.4;
      dust.visible = true;
      dust.setTime(ctx.t, [0.02, 0.04, 0]);
    },
  };
  return S;
}
