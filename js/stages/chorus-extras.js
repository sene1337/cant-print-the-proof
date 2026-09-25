// Scenes that make the second and third choruses go further than the first.
//   decree:    chorus 2, "Stroke of a pen, they did it again": one decree signed, then the stack of them grows on the beat.
//   city:      chorus 2, "They can print the paper": a city of cash towers rises in waves.
//   penProof:  chorus 3, "Stroke of a pen": the pen tries to sign the bronze block; the ink won't take and the nib breaks.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { buildPen, posePen } from './paper.js';
import { Block } from '../props/block.js';
import { Dust } from '../props/dust.js';
import { banknote, loadImage, TEX } from '../tex.js';
import { clamp, hash1, lerp, easeIn, easeOut, fmtInt } from '../util.js';

const SHEET_W = 1.7, SHEET_D = 2.2, SHEET_T = 0.014;
const _tip = new THREE.Vector3();
const toV = (p) => (Array.isArray(p) ? _tip.set(p[0], p[1], p[2]) : p);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// A decree: heading, body lines, a signature line; optionally already signed in green ink with a wax seal.
function decreeTexture(signed) {
  return canvasTex(768, 994, (g, w, h) => {
    g.fillStyle = '#efe9da'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(80,70,50,${hash1(i * 3) * 0.05})`; g.fillRect(hash1(i * 3 + 1) * w, hash1(i * 3 + 2) * h, 2, 1); }
    g.strokeStyle = '#2a2520'; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = '#1d1a16'; g.textAlign = 'center';
    g.font = '900 86px "Playfair Display"'; g.fillText('DECREE', w / 2, 150);
    g.font = '600 26px "Cormorant Garamond"'; g.fillText('BY ORDER, EFFECTIVE IMMEDIATELY', w / 2, 196);
    g.fillStyle = 'rgba(29,26,22,0.55)';
    for (let y = 250, k = 0; y < 700; y += 26, k++) {
      const len = (w - 180) * (k % 5 === 4 ? 0.55 : 0.95 - hash1(k) * 0.08);
      g.fillRect(90, y, len, 8);
    }
    g.fillStyle = '#1d1a16'; g.fillRect(360, 860, 300, 2);
    g.font = '600 20px "Cormorant Garamond"'; g.fillText('SIGNED', 510, 890);
    if (signed) {
      g.strokeStyle = '#1f8a4c'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        const x = 380 + u * 260, y = 840 - Math.sin(u * 11) * 18 * (1 - u * 0.5) - Math.sin(u * 27) * 6;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#8f1d16'; g.beginPath(); g.arc(170, 850, 52, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,200,180,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(170, 850, 38, 0, Math.PI * 2); g.stroke();
    }
  });
}

function blackStudio(film, warm = true) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 1.6], color: warm ? [1, 0.84, 0.64] : [0.9, 1, 0.92], intensity: 2.4 },
    { pos: [-6, 1, 2], size: [0.5, 5], color: warm ? [1, 0.7, 0.4] : [0.8, 1, 0.85], intensity: 3.0 },
    { pos: [6, 1, -1], size: [0.4, 5], color: [1, 0.92, 0.8], intensity: 2.0 },
  ], { top: [0.28, 0.22, 0.16], horizon: [0.07, 0.05, 0.04], bottom: [0.01, 0.008, 0.006] });
  return scene;
}

// ───────────────────────────── decree ─────────────────────────────
export async function decreeStage(film) {
  const scene = blackStudio(film, false);
  scene.fog = new THREE.FogExp2(0x020403, 0.03);
  scene.background.set(0x020403);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.8, envMapIntensity: 0.05 }));
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);
  const lamp = new THREE.SpotLight(0xffe6c4, 40, 30, 0.5, 0.9, 1.4);
  lamp.position.set(-3, 7, 3);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0003;
  scene.add(lamp, lamp.target);
  const fill = new THREE.DirectionalLight(0xbfe8c8, 0.8);
  fill.position.set(3, 3, -4);
  scene.add(fill);
  const front = new THREE.DirectionalLight(0xfff0dc, 0.9);
  front.position.set(8, 2, 6);
  scene.add(front);

  const paperSide = new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.9 });
  const signedTop = new THREE.MeshStandardMaterial({ map: decreeTexture(true), roughness: 0.85 });
  const blankTop = new THREE.MeshStandardMaterial({ map: decreeTexture(false), roughness: 0.85 });

  // The sheet being signed, and its live signature.
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(SHEET_W, SHEET_T, SHEET_D), [paperSide, paperSide, blankTop, paperSide, paperSide, paperSide]);
  sheet.receiveShadow = true;
  scene.add(sheet);
  const sigPts = [];
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    // texture px -> sheet coords: x = (px/768 - 0.5) * W, z = (py/994 - 0.5) * D
    const px = 380 + u * 260, py = 840 - Math.sin(u * 11) * 18 * (1 - u * 0.5) - Math.sin(u * 27) * 6;
    sigPts.push(new THREE.Vector3((px / 768 - 0.5) * SHEET_W, SHEET_T + 0.002, (py / 994 - 0.5) * SHEET_D));
  }
  const sigCurve = new THREE.CatmullRomCurve3(sigPts);
  const sigGeo = new THREE.TubeGeometry(sigCurve, 240, 0.006, 6, false);
  const sig = new THREE.Mesh(sigGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.95, 0.45).multiplyScalar(1.4) }));
  scene.add(sig);

  const { pen } = buildPen(film);
  pen.scale.setScalar(0.22);
  scene.add(pen);

  // The stack: signed decrees, landing one after another.
  const CAP = 420;
  const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(SHEET_W, SHEET_T, SHEET_D), [paperSide, paperSide, signedTop, paperSide, paperSide, paperSide], CAP);
  stack.castShadow = true; stack.receiveShadow = true;
  stack.frustumCulled = false;
  scene.add(stack);
  const dummy = new THREE.Object3D();

  const dust = new Dust({ count: 500, size: 0.012, box: [8, 5, 8], color: [0.9, 1, 0.9], gain: 0.7 });
  scene.add(dust);

  return {
    scene, desk, lamp, sheet, sig, sigCurve, pen, stack, dust, SHEET_T,
    fx: { bloom: 0.4, threshold: 1.0, grain: 0.045, vignette: 0.5, tint: [0.97, 1.02, 0.98] },
    posePen(p, axis) { pen.visible = true; posePen(pen, toV(p), axis); },
    // Draw the live signature to fraction k; returns the pen-tip point in world space.
    sign(k, at = [0, 0, 0]) {
      sig.visible = k > 0;
      sig.geometry.setDrawRange(0, Math.floor(clamp(k) * 240) * 36);
      sig.position.set(...at);
      const p = sigCurve.getPointAt(clamp(k));
      return new THREE.Vector3(p.x + at[0], p.y + at[1], p.z + at[2]);
    },
    // Signed sheets rain onto the stack: landAt(i) is when sheet i lands (-Infinity: already there).
    // Landing times must rise with i. Returns the stack's height at time t.
    layoutStack(t, landAt, base = [0, 0, 0]) {
      const FALL = 0.3, DROP = 3.2;
      let k = 0, landed = 0;
      for (let i = 0; i < CAP; i++) {
        const tl = landAt(i);
        if (tl - FALL > t) break;
        const fall = clamp((t - (tl - FALL)) / FALL);
        if (fall >= 1) landed = i + 1;
        const y = i * SHEET_T + SHEET_T / 2;
        dummy.position.set(base[0] + (hash1(i * 3) - 0.5) * 0.08, base[1] + y + (1 - easeIn(fall, 2)) * DROP, base[2] + (hash1(i * 3 + 1) - 0.5) * 0.08);
        dummy.rotation.set((1 - fall) * (hash1(i * 5) - 0.5) * 0.5, (hash1(i * 3 + 2) - 0.5) * 0.12 + (1 - fall) * 0.9, (1 - fall) * (hash1(i * 7) - 0.5) * 0.4);
        dummy.updateMatrix();
        stack.setMatrixAt(k++, dummy.matrix);
      }
      stack.count = k;
      stack.instanceMatrix.needsUpdate = true;
      return landed * SHEET_T;
    },
    update(ctx) {
      sheet.visible = false; sheet.position.set(0, SHEET_T / 2, 0); sheet.rotation.set(0, 0, 0);
      sig.visible = false;
      pen.visible = false;
      stack.visible = false;
      lamp.intensity = 40;
      dust.setTime(ctx.t);
    },
  };
}

// ───────────────────────────── city ─────────────────────────────
export async function cityStage(film) {
  const scene = blackStudio(film, false);
  scene.background.set(0x020403);
  scene.fog = new THREE.FogExp2(0x020403, 0.028);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0a0d0b, roughness: 0.7, envMapIntensity: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const sky = new THREE.DirectionalLight(0xe8fff0, 2.4);
  sky.position.set(-8, 20, 10);
  sky.castShadow = true;
  sky.shadow.mapSize.set(2048, 2048);
  Object.assign(sky.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 80 });
  scene.add(sky);
  const back = new THREE.DirectionalLight(0x9fe0b8, 1.6);
  back.position.set(6, 4, -12);
  scene.add(back);
  scene.add(new THREE.AmbientLight(0x1c2a22, 0.8));

  // Towers of bank notes: printed tops, paper-edge sides with a strap every so often.
  const top = new THREE.MeshStandardMaterial({ map: await banknote({ seed: 23 }), roughness: 0.8 });
  const side = new THREE.MeshStandardMaterial({ color: 0xdfe6d2, roughness: 0.85 });
  side.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float leaf = 0.5 + 0.5 * sin(vWY * 260.0);
        diffuseColor.rgb *= mix(0.8, 1.0, leaf);
        float strap = step(0.86, fract(vWY * 0.55));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.48, 0.28), strap * 0.85);`);
  };
  side.customProgramCacheKey = () => 'cash-tower-side';
  const geo = new THREE.BoxGeometry(2.35, 1, 1.0);
  geo.translate(0, 0.5, 0);
  const NX = 15, NZ = 13, SX = 3.1, SZ = 1.75;
  const towers = new THREE.InstancedMesh(geo, [side, side, top, side, side, side], NX * NZ);
  towers.castShadow = true; towers.receiveShadow = true;
  towers.frustumCulled = false;
  scene.add(towers);
  const info = [];
  for (let ix = 0; ix < NX; ix++) {
    for (let iz = 0; iz < NZ; iz++) {
      const x = (ix - (NX - 1) / 2) * SX, z = -iz * SZ * 1.6 + 4;
      const avenue = Math.abs(x) < 1.6; // leave a street down the middle for the camera
      if (avenue) continue;
      const r = hash1(ix * 97 + iz * 13);
      const h = 0.6 + 7.5 * r * r + (iz / NZ) * 2.5;
      const ring = Math.floor(Math.hypot(x / 6, (z - 2) / 5));
      info.push({ x, z, h, ring });
    }
  }
  const dummy = new THREE.Object3D();
  const dust = new Dust({ count: 700, size: 0.02, box: [20, 8, 30], color: [0.85, 1, 0.9], gain: 0.7 });
  scene.add(dust);

  return {
    scene, towers, info, dust,
    fx: { bloom: 0.35, threshold: 1.0, grain: 0.045, vignette: 0.5, tint: [0.96, 1.03, 0.98] },
    // The city rises in rings from the centre, one ring per step seconds, each tower overshooting a little.
    grow(t, t0, step) {
      let k = 0;
      for (const b of info) {
        const u = clamp((t - t0 - b.ring * step) / 0.45);
        if (u <= 0) continue;
        const e = u < 1 ? 1 - Math.pow(1 - u, 3) * Math.cos(u * 7) : 1;
        dummy.position.set(b.x, 0, b.z);
        dummy.scale.set(1, Math.max(0.02, b.h * e), 1);
        dummy.updateMatrix();
        towers.setMatrixAt(k++, dummy.matrix);
      }
      towers.count = k;
      towers.instanceMatrix.needsUpdate = true;
    },
    update(ctx) {
      towers.count = 0;
      dust.setTime(ctx.t, [0.2, 0.05, 0.4]);
    },
  };
}

// ───────────────────────────── penProof ─────────────────────────────
export async function penProofStage(film) {
  const T = film.T, chain = film.chain;
  const scene = blackStudio(film, true);
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.FogExp2(0x000000, 0.03);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.6, envMapIntensity: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const key = new THREE.SpotLight(0xffdcb0, 40, 30, 0.5, 0.8, 1.4);
  key.position.set(-3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff9a4a, 1.6);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  const b = chain.block(chain.frameAt(T.wordAfter('stroke', 154).s));
  const block = new Block({ hash: b.hash, height: '#' + fmtInt(b.i), nonce: b.nonce, style: 'engraved' });
  block.scale.setScalar(3);
  block.position.set(0, 1.5, 0);
  scene.add(block);

  const { pen, nib } = buildPen(film);
  pen.scale.setScalar(0.42);
  scene.add(pen);

  // Beads of ink that won't soak in: they sit on the bronze, then roll off.
  const beadGeo = new THREE.SphereGeometry(1, 16, 12);
  const beadMat = new THREE.MeshPhysicalMaterial({ color: 0x0a4d24, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color(0.1, 1, 0.4), emissiveIntensity: 0.45 });
  const beads = [];
  for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(beadGeo, beadMat); scene.add(m); beads.push(m); }

  // Sparks where the nib skids and snaps.
  const NS = 220;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.03, color: new THREE.Color(1, 0.7, 0.3).multiplyScalar(5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  const TOP = 3.0; // top face height
  return {
    scene, block, pen, nib, beads, sparks, key, rim, TOP,
    fx: { bloom: 0.5, threshold: 1.0, grain: 0.04, vignette: 0.5, tint: [1.03, 0.99, 0.94] },
    // Place the pen with its tip at p, leaning along axis; bend > 0 snaps the nib sideways.
    posePen(p, axis, bend = 0) {
      pen.visible = true;
      posePen(pen, toV(p), axis);
      nib.rotation.set(0, 0, bend);
    },
    // Beads left along the nib's path (xs: list of x positions where ink was pressed out, with birth times).
    lay(t, drops) {
      beads.forEach((m, i) => {
        const d = drops[i];
        if (!d || t < d.t0) { m.visible = false; return; }
        const a = t - d.t0;
        m.visible = true;
        const grow = clamp(a / 0.18);
        const r = d.r * (0.3 + 0.7 * grow);
        // sit, then roll toward the edge and drop off
        const roll = Math.max(0, a - d.wait);
        const x = d.x + d.dx * roll * roll * 0.8, z = d.z + d.dz * roll * roll * 0.8;
        const off = Math.max(Math.abs(x), Math.abs(z)) > 1.5;
        const fall = off ? Math.max(0, roll - 0.3) : 0;
        // ink on metal that won't take it: flattened beads
        m.position.set(x, TOP + r * 0.4 - 4.9 * fall * fall, z);
        m.scale.set(r, r * 0.55, r);
      });
    },
    burst(t, t0, origin, power = 1) {
      const p = sparks.geometry.attributes.position.array;
      const dt = t - t0;
      sparks.visible = dt >= 0 && dt < 0.7;
      if (!sparks.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = hash1(i * 3) * Math.PI * 2, e = hash1(i * 3 + 1) * 0.9 + 0.1, v = (1.2 + hash1(i * 3 + 2) * 3) * power;
        p[i * 3] = origin[0] + Math.cos(a) * Math.cos(e) * v * dt;
        p[i * 3 + 1] = origin[1] + Math.sin(e) * v * dt - 4.9 * dt * dt;
        p[i * 3 + 2] = origin[2] + Math.sin(a) * Math.cos(e) * v * dt;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      sparks.material.opacity = clamp(1 - dt / 0.7);
    },
    update(ctx) {
      pen.visible = false;
      nib.rotation.set(0, 0, 0);
      beads.forEach((m) => { m.visible = false; });
      sparks.visible = false;
      block.setGlow(1);
      key.position.set(-3, 7, 4); key.target.position.set(0, TOP, 0); key.intensity = 22;
      rim.position.set(3, 2, -4); rim.intensity = 1.6;
    },
  };
}
