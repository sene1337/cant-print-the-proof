// Verse 3, paper to proof: the white paper floats in the dark, nine pages drop into a ring,
// fold into a paper cube, and the paper burns away to reveal the orange proof block.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Block } from '../props/block.js';
import { Dust } from '../props/dust.js';
import { pageTexture, patchBurn, lightCone, Motes, glowCard, fmt } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const PW = 1.0, PH = 11 / 8.5; // US letter

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4();
function basisQuat(r, u, n) {
  _m.makeBasis(r, u, n);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

// A sheet of paper: bends (flutter) and folds along a crease, burns away from its edges.
class Sheet extends THREE.Mesh {
  constructor(map, seed) {
    // 22 rows so creases at 1.0 and 0.294 from the bottom land exactly on vertex rows.
    const geo = new THREE.PlaneGeometry(PW, PH, 10, 22);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    super(geo, mat);
    this.burn = patchBurn(mat, { seed });
    this.base = Float32Array.from(geo.attributes.position.array);
    this.castShadow = true;
    this.receiveShadow = true;
    this.key = '';
  }
  // curl: flutter amount; fold: { at, side (+1 folds the part above 'at', -1 the part below), angle }
  shape(curl = 0, phase = 0, fold = null) {
    const ang = fold ? fold.angle : 0;
    const key = `${curl.toFixed(4)}|${phase.toFixed(3)}|${fold ? fold.at + '|' + fold.side + '|' + ang.toFixed(4) : ''}`;
    if (key === this.key) return;
    this.key = key;
    const p = this.geometry.attributes.position.array, b = this.base;
    for (let i = 0; i < p.length; i += 3) {
      let x = b[i], y = b[i + 1], z = 0;
      if (curl) z += curl * (Math.sin(y * 2.6 + phase) * 0.09 + x * x * 0.16 + Math.sin(x * 3.1 + phase * 1.3) * 0.03);
      if (ang) {
        const d = (y - fold.at) * fold.side;
        if (d > 0) {
          y = fold.at + fold.side * d * Math.cos(ang);
          z += -d * Math.sin(ang);
        }
      }
      p[i] = x; p[i + 1] = y; p[i + 2] = z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
  setBurn(k, t) { this.burn.uBurn.value = clamp(k); this.burn.uTime.value = t; this.visible = this.visible && k < 1; }
}

export async function verse3PaperStage(film) {
  await document.fonts.load('500 40px "Cormorant Garamond"');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 1], size: [4, 4], color: [1, 0.96, 0.9], intensity: 2.2 },
    { pos: [-6, 1, 2], size: [0.6, 5], color: [1, 0.62, 0.25], intensity: 3.5 },
    { pos: [6, 1, -2], size: [0.6, 5], color: [1, 0.9, 0.8], intensity: 2.5 },
  ], { top: [0.08, 0.07, 0.06], horizon: [0.02, 0.015, 0.01], bottom: [0, 0, 0] });
  scene.environmentIntensity = 0.5;

  // Hard light from above.
  const key = new THREE.SpotLight(0xfff6ec, 2.2, 30, 0.42, 0.55, 0);
  key.position.set(1.6, 6.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffd2a0, 0.25);
  fill.position.set(-4, 2, 5);
  scene.add(fill);
  const cone = lightCone({ radius: 1.5, height: 5, gain: 0.06 });
  scene.add(cone);

  // Black lacquer floor.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x101010, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Nine pages. sheets[k] carries page k + 1.
  const texs = [];
  for (let n = 1; n <= 9; n++) texs.push(pageTexture(n, n === 1 ? {} : { w: 612, h: 792 }));
  const sheets = texs.map((t, k) => { const s = new Sheet(t, k * 1.7 + 0.3); scene.add(s); return s; });
  const hero = new Sheet(texs[0], 11.1);
  scene.add(hero);

  // The proof block the paper hides.
  const chain = film.chain;
  const bi = chain.frameAt(127.12);
  const bk = chain.block(bi);
  const block = new Block({ hash: bk.hash, height: '#' + fmt(bi), nonce: bk.nonce, label: 'BLOCK' });
  block.scale.setScalar(0.985);
  scene.add(block);
  const core = new THREE.PointLight(0xff8a2a, 0, 8, 1.8);
  scene.add(core);
  const flare = glowCard([1, 0.55, 0.15], 4);
  scene.add(flare);

  const embers = new Motes({ count: 160, size: 0.03, color: [1, 0.55, 0.18], gain: 3.2 });
  scene.add(embers);
  const dust = new Dust({ count: 700, size: 0.012, box: [6, 6, 6], color: [1, 0.93, 0.82], gain: 0.9 });
  scene.add(dust);

  // Ring and cube poses --------------------------------------------------------------------
  const RC = 1.95; // ring radius to page centres
  const ringPose = (k) => {
    const th = (k / 9) * Math.PI * 2 + Math.PI; // the title page (k = 0) lands at the back
    const d = V(Math.sin(th), 0, Math.cos(th));
    const n = V(0, 1, 0);
    const r = d.clone().cross(n);
    return { pos: d.clone().multiplyScalar(RC).add(V(0, 0.004 + k * 0.0006, 0)), quat: basisQuat(r, d, n) };
  };
  const RING = [...Array(9)].map((_, k) => ringPose(k));

  // Who goes where: sheet 0 (the title page) is the lid; walls take the pages nearest each side.
  const WALLS = [{ k: 4, f: V(0, 0, 1) }, { k: 7, f: V(1, 0, 0) }, { k: 8, f: V(0, 0, -1) }, { k: 2, f: V(-1, 0, 0) }];
  const BASE = [1, 3, 5, 6];
  const CREASE_WALL = PH / 2 - (PH - 1); // 1.0 from the bottom
  const CREASE_LID = -PH / 2 + (PH - 1);  // 0.294 from the bottom
  const cubePose = {};
  WALLS.forEach(({ k, f }, j) => {
    const u = V(0, 1, 0), n = f.clone(), r = u.clone().cross(n);
    const lift = j * 0.0025;
    const pos = f.clone().multiplyScalar(0.506 + j * 0.001).add(V(0, PH / 2 + lift, 0));
    // stand upright outside the face first, then slide straight in: no page cuts through another
    cubePose[k] = { pos, stage: pos.clone().addScaledVector(f, 0.35), quat: basisQuat(r, u, n), fold: { at: CREASE_WALL, side: 1 } };
  });
  BASE.forEach((k, j) => {
    // flat, nearly square to the cube, small enough to sit inside the walls (0.70 x 0.91)
    const a = (j % 2) * Math.PI / 2 + (j - 1.5) * 0.06;
    const u = V(Math.sin(a), 0, Math.cos(a)), n = V(0, 1, 0), r = u.clone().cross(n);
    cubePose[k] = { pos: V(0, 0.006 + j * 0.0015, 0), quat: basisQuat(r, u, n), scale: 0.7, flat: true };
  });
  {
    const u = V(0, 0, -1), n = V(0, 1, 0), r = u.clone().cross(n);
    const pos = V(0, 1.0 + 0.016, (PH - 1) / 2 + 0.016); // its front flap hangs outside the front wall
    cubePose[0] = { pos, stage: pos.clone().add(V(0, 0.25, 0)), quat: basisQuat(r, u, n), fold: { at: CREASE_LID, side: -1 } };
  }

  const tmpQ = new THREE.Quaternion();

  const S = {
    scene, key, fill, cone, floor, sheets, hero, block, core, flare, embers, dust,
    fx: { bloom: 0.55, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.0, 0.99, 0.97] },

    update(ctx) {
      for (const s of sheets) { s.visible = false; s.scale.setScalar(1); s.setBurn(0, ctx.t); }
      hero.visible = false; hero.setBurn(0, ctx.t);
      block.visible = false; block.position.set(0, 0.5, 0); block.rotation.set(0, 0, 0); block.setGlow(1);
      core.intensity = 0; flare.visible = false;
      embers.visible = false;
      floor.visible = true;
      key.position.set(1.6, 6.5, 3.2); key.target.position.set(0, 0.3, 0); key.intensity = 2.2; key.angle = 0.42;
      cone.visible = false; cone.position.copy(key.position); cone.rotation.set(0, 0, 0);
      dust.visible = true; dust.position.set(0, 3, 0); dust.setTime(ctx.t, [0.02, 0.04, 0.01]);
      scene.environmentIntensity = 0.5;
    },

    // Shot 1: the first page floats in the beam, gently turning.
    float(t) {
      hero.visible = true;
      hero.position.set(0, 2.6 + Math.sin(t * 0.9) * 0.03, 0);
      hero.rotation.set(-0.28 + Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.45) * 0.07, Math.sin(t * 0.5) * 0.025);
      hero.shape(0.2, t * 1.1);
      floor.visible = false;
      key.position.set(0, 6.4, 1.1); key.target.position.set(0, 2.9, 0); key.intensity = 3.6; key.angle = 0.36;
      // the beam: a soft shaft from the lamp down onto the page
      cone.visible = true;
      cone.position.copy(key.position);
      cone.lookAt(0, 2.9, 0); cone.rotateX(-Math.PI / 2);
      dust.position.set(0, 3.4, 0.4);
      hero.updateMatrixWorld(true);
    },

    // Shots 2-3: drop, ring, fold, burn. tm holds the song times of each step.
    pagesAt(t, tm) {
      let allLanded = true;
      for (let k = 0; k < 9; k++) {
        const s = sheets[k];
        const td = tm.drop0 + k * tm.dropStep; // this page's drop start
        const fall = tm.fall;
        const u = (t - td) / fall;
        if (u < 0) { allLanded = false; continue; }
        s.visible = true;
        const R = RING[k];
        let pos = R.pos.clone(), quat = R.quat.clone(), curl = 0, phase = 0, fold = null, scale = 1;
        if (u < 1) {
          allLanded = false;
          // Falling: from high above, drifting in, tumbling flat, flutter dying as it lands.
          const e = easeIn(u, 1.7);
          const h = (i) => hash1(k * 13 + i);
          pos.y = lerp(3.4 + h(1) * 1.0, R.pos.y, e);
          pos.x += (1 - e) * (h(2) - 0.5) * 1.4;
          pos.z += (1 - e) * (h(3) - 0.5) * 1.4;
          const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((1 - u) * (h(4) - 0.5) * 2.2, (1 - u) * (h(5) - 0.5) * 3, (1 - u) * (h(6) - 0.5) * 2.2));
          quat.premultiply(tilt);
          curl = (1 - u) * 0.9;
          phase = t * 9 + k;
        } else {
          // Landed: a tiny settle.
          const land = t - td - fall;
          pos.y += Math.max(0, Math.sin(Math.min(1, land / 0.12) * Math.PI)) * 0.03;
          curl = 0.08 * Math.exp(-land * 6) * Math.sin(land * 30);
        }
        // Assembly flight.
        const fl = tm.fly[k];
        const f = clamp((t - fl.t0) / fl.dur);
        if (f > 0) {
          const P = cubePose[k];
          const e = easeInOut(f);
          if (P.stage) {
            // walls and lid: rise and turn to their final orientation at a staging point, then move straight in
            const fa = clamp(f / 0.6), fb = clamp((f - 0.6) / 0.4);
            const ea = easeInOut(fa);
            pos = pos.clone().lerp(P.stage, ea);
            pos.y += Math.sin(fa * Math.PI) * fl.lift * (1 - fb);
            pos.lerp(P.pos, easeOut(fb, 2));
            quat = quat.clone().slerp(P.quat, easeInOut(clamp(fa * 1.1)));
            curl = Math.sin(fa * Math.PI) * 0.22;
          } else {
            // base pages: lift off, glide flat to the middle, settle onto the stack
            const eh = easeInOut(clamp((f - 0.12) / 0.88));
            pos = pos.clone().lerp(P.pos, eh);
            pos.y += Math.pow(Math.sin(f * Math.PI), 0.7) * fl.lift;
            quat = quat.clone().slerp(P.quat, eh);
            curl = Math.sin(f * Math.PI) * 0.18;
          }
          phase = f * 6;
          scale = lerp(1, P.scale || 1, e);
          if (P.fold) {
            // walls fold their top flap in while they rise (the box's dark inside is never exposed);
            // the lid folds its front flap down just after it lands
            const fk = P.fold.side > 0 ? clamp((f - 0.55) / 0.45) : clamp((t - fl.t0 - fl.dur) / 0.1);
            if (fk > 0) fold = { at: P.fold.at, side: P.fold.side, angle: smooth(fk) * Math.PI / 2 * 0.995 };
          }
        }
        s.position.copy(pos);
        s.quaternion.copy(quat);
        s.scale.setScalar(scale);
        s.shape(curl, phase, fold);
        // Burn (only the pages you can see burn; the base stays hidden under the walls).
        const b = clamp((t - tm.burn0 - (k % 3) * 0.03) / tm.burnDur);
        if (b > 0) s.setBurn(b, t);
      }
      // The block appears as the paper burns.
      const bb = (t - tm.burn0) / tm.burnDur;
      if (bb > -0.05) {
        block.visible = true;
        // the block's light comes up with the burn and swells once, smoothly, on "proof" (no one-frame pop)
        const pr = t - tm.proof;
        const swell = pr > 0 ? smooth(clamp(pr / 0.25)) * Math.exp(-Math.max(0, pr - 0.25) * 1.5) : 0;
        const glow = smooth(clamp(bb * 1.1)) * (1 + 0.15 * swell);
        block.setGlow(Math.max(0.02, glow));
        core.position.set(0, 0.6, 0.2);
        core.intensity = 1.6 * smooth(clamp(bb));
        flare.visible = false;
        flare.position.set(0, 0.5, 0);
        flare.material.opacity = 0.35 * Math.sin(clamp(bb / 1.4) * Math.PI);
        flare.scale.setScalar(1.2 + bb * 0.8);
      }
      // Embers lift off the burning paper.
      if (bb > 0) {
        embers.visible = true;
        embers.layout((i, o) => {
          const h = (j) => hash1(i * 11 + j + 500);
          const born = tm.burn0 + h(1) * tm.burnDur * 1.1;
          const age = t - born;
          if (age < 0 || age > 1.3) return 0;
          // A point on one of the four walls or the lid, drifting outward and up.
          const face = Math.floor(h(2) * 5);
          const a = h(3) - 0.5, bq = h(4);
          const P = [[a, bq, 0.52], [0.52, bq, a], [a, bq, -0.52], [-0.52, bq, a], [a, 1.02, bq - 0.5]][face];
          const N = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, 0.3, 0]][face];
          const vx = N[0] * 0.6 + (h(5) - 0.5) * 0.8, vz = N[2] * 0.6 + (h(6) - 0.5) * 0.8;
          o[0] = P[0] + vx * age + Math.sin(age * 5 + i) * 0.05;
          o[1] = P[1] + age * (0.9 + h(7) * 1.4) + age * age * 0.4;
          o[2] = P[2] + vz * age + Math.cos(age * 4 + i) * 0.05;
          return smooth(clamp(age / 0.2)) * clamp(1 - age / 1.3) * (0.4 + 0.6 * h(8));
        });
      }
      return allLanded;
    },
  };
  return S;
}
